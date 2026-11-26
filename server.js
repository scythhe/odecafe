import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'node:path';
import crypto from 'node:crypto';
import { unlink, access, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDb } from './lib/db.js';
import { createAuth } from './lib/auth.js';
import { toMkhedruli } from './lib/text.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PROD = process.env.NODE_ENV === 'production';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ode-admin';
if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠  ADMIN_PASSWORD not set — using the default "ode-admin". Set it before going live.');
}

const db = createDb({ dataDir: DATA_DIR, seedFile: path.join(ROOT, 'seed', 'menu.json') });
await db.load();
const auth = createAuth({ password: ADMIN_PASSWORD, secret: process.env.SESSION_SECRET, secure: PROD });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  next();
});

// ---------- helpers ----------
const str = (v, max = 160) => toMkhedruli(v).trim().replace(/\s+/g, ' ').slice(0, max);
const i18n = (v, max) => ({ en: str(v?.en, max), ka: str(v?.ka, max) });
const byOrder = (a, b) => a.order - b.order;
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const { state } = db;

function cleanProduct(body, prev = {}) {
  const out = { ...prev };
  if ('name' in body) out.name = i18n(body.name, 120);
  if ('description' in body) out.description = i18n(body.description, 240);
  if ('price' in body) out.price = Math.round(Number(body.price) * 100) / 100;
  if ('categoryId' in body) out.categoryId = str(body.categoryId, 40);
  if ('image' in body) out.image = str(body.image, 200);
  if ('available' in body) out.available = Boolean(body.available);
  if ('featured' in body) out.featured = Boolean(body.featured);
  return out;
}

function validateProduct(p) {
  if (!p.name?.en && !p.name?.ka) return 'Name is required';
  if (!Number.isFinite(p.price) || p.price < 0 || p.price > 100000) return 'Price must be a valid number';
  if (!state.categories.some((c) => c.id === p.categoryId)) return 'Pick a category';
  if (p.image && !p.image.startsWith('/media/')) return 'Invalid image';
  return null;
}

async function removeImageIfOrphan(url) {
  if (!url?.startsWith('/media/u-')) return; // never touch seed images
  if (state.products.some((p) => p.image === url) || state.settings.cover === url) return;
  await unlink(path.join(UPLOAD_DIR, path.basename(url))).catch(() => {});
  for (const w of SIZES) await unlink(path.join(THUMB_DIR, String(w), path.basename(url))).catch(() => {});
}

// ---------- public ----------
app.get('/api/menu', (_req, res) => {
  const categories = state.categories.filter((c) => c.visible !== false).sort(byOrder);
  const visible = new Set(categories.map((c) => c.id));
  // Switched-off products are simply left out of the public menu.
  const products = state.products
    .filter((p) => p.available !== false && visible.has(p.categoryId))
    .sort(byOrder)
    .map(({ id, categoryId, name, description, price, image, featured }) => ({ id, categoryId, name, description, price, image, featured }));
  const withItems = new Set(products.map((p) => p.categoryId));
  const { name, tagline, hours, phone, email, address, mapUrl, instagram, currency, cover, notice } = state.settings;
  res.set('Cache-Control', 'no-cache');
  res.json({
    settings: { name, tagline, hours, phone, email, address, mapUrl, instagram, currency, cover, notice },
    categories: categories.filter((c) => withItems.has(c.id)).map(({ id, name }) => ({ id, name })),
    products,
  });
});

// ---------- admin ----------
const admin = express.Router();
admin.post('/login', express.json(), (req, res) => auth.login(req, res));
admin.post('/logout', (req, res) => auth.logout(req, res));
admin.get('/session', (req, res) => res.json({ authed: auth.isAuthed(req) }));
admin.use(auth.require);

admin.get('/menu', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    settings: state.settings,
    categories: [...state.categories].sort(byOrder),
    products: [...state.products].sort(byOrder),
  });
});

// products
admin.post('/products', async (req, res) => {
  const p = cleanProduct(req.body, { available: true, featured: false, image: '', description: { en: '', ka: '' } });
  const err = validateProduct(p);
  if (err) return bad(res, err);
  p.id = db.id('p');
  p.order = Math.max(-1, ...state.products.filter((x) => x.categoryId === p.categoryId).map((x) => x.order)) + 1;
  state.products.push(p);
  await db.persist();
  res.status(201).json(p);
});

admin.put('/products/:id', async (req, res) => {
  const i = state.products.findIndex((p) => p.id === req.params.id);
  if (i < 0) return bad(res, 'Product not found', 404);
  const prev = state.products[i];
  const next = cleanProduct(req.body, prev);
  const err = validateProduct(next);
  if (err) return bad(res, err);
  if (next.categoryId !== prev.categoryId) {
    next.order = Math.max(-1, ...state.products.filter((x) => x.categoryId === next.categoryId).map((x) => x.order)) + 1;
  }
  state.products[i] = next;
  await db.persist();
  if (prev.image !== next.image) await removeImageIfOrphan(prev.image);
  res.json(next);
});

admin.delete('/products/:id', async (req, res) => {
  const i = state.products.findIndex((p) => p.id === req.params.id);
  if (i < 0) return bad(res, 'Product not found', 404);
  const [gone] = state.products.splice(i, 1);
  await db.persist();
  await removeImageIfOrphan(gone.image);
  res.json({ ok: true });
});

// categories
admin.post('/categories', async (req, res) => {
  const name = i18n(req.body?.name, 60);
  if (!name.en && !name.ka) return bad(res, 'Name is required');
  const c = { id: db.id('c'), name, order: state.categories.length, visible: req.body?.visible !== false };
  state.categories.push(c);
  await db.persist();
  res.status(201).json(c);
});

admin.put('/categories/:id', async (req, res) => {
  const c = state.categories.find((x) => x.id === req.params.id);
  if (!c) return bad(res, 'Category not found', 404);
  if ('name' in req.body) {
    const name = i18n(req.body.name, 60);
    if (!name.en && !name.ka) return bad(res, 'Name is required');
    c.name = name;
  }
  if ('visible' in req.body) c.visible = Boolean(req.body.visible);
  await db.persist();
  res.json(c);
});

admin.delete('/categories/:id', async (req, res) => {
  const i = state.categories.findIndex((x) => x.id === req.params.id);
  if (i < 0) return bad(res, 'Category not found', 404);
  const count = state.products.filter((p) => p.categoryId === req.params.id).length;
  if (count) return bad(res, `Move or delete its ${count} product${count > 1 ? 's' : ''} first`, 409);
  state.categories.splice(i, 1);
  await db.persist();
  res.json({ ok: true });
});

admin.post('/reorder', async (req, res) => {
  const { type, ids } = req.body || {};
  const list = type === 'categories' ? state.categories : type === 'products' ? state.products : null;
  if (!list || !Array.isArray(ids)) return bad(res, 'Invalid reorder request');
  ids.forEach((id, idx) => {
    const item = list.find((x) => x.id === id);
    if (item) item.order = idx;
  });
  await db.persist();
  res.json({ ok: true });
});

// settings
admin.put('/settings', async (req, res) => {
  const b = req.body || {};
  const s = state.settings;
  const time = (v, d) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : d);
  if ('name' in b) s.name = str(b.name, 40) || s.name;
  if ('tagline' in b) s.tagline = i18n(b.tagline, 80);
  if ('address' in b) s.address = i18n(b.address, 120);
  if ('phone' in b) s.phone = str(b.phone, 40);
  if ('email' in b) s.email = str(b.email, 80);
  if ('instagram' in b) s.instagram = str(b.instagram, 120);
  if ('notice' in b) s.notice = { ...i18n(b.notice, 120), enabled: b.notice?.enabled !== false };
  if ('mapUrl' in b) {
    const url = str(b.mapUrl, 600);
    if (url && !/^https:\/\//.test(url)) return bad(res, 'Map link must start with https://');
    s.mapUrl = url;
  }
  if ('hours' in b) s.hours = { open: time(b.hours?.open, s.hours.open), close: time(b.hours?.close, s.hours.close) };
  if ('cover' in b && String(b.cover).startsWith('/media/')) {
    const prev = s.cover;
    s.cover = str(b.cover, 200);
    await db.persist();
    if (prev !== s.cover) await removeImageIfOrphan(prev);
  }
  await db.persist();
  res.json(s);
});

// uploads — every image is re-encoded, so nothing but clean webp reaches disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|avif|heic|heif|gif)$/.test(file.mimetype)),
});

admin.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return bad(res, 'Please choose a JPG, PNG or WEBP image');
  const wide = req.query.kind === 'cover';
  try {
    const name = `u-${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}.webp`;
    await sharp(req.file.buffer)
      .rotate()
      // keep the full frame and plenty of pixels; the menu crops and picks a size per screen
      .resize(wide ? { width: 2400, height: 1600, fit: 'inside', withoutEnlargement: true } : { width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(path.join(UPLOAD_DIR, name));
    res.json({ url: `/media/${name}` });
  } catch {
    bad(res, 'Could not read that image');
  }
});

app.use('/api/admin', admin);
app.use('/api', (_req, res) => bad(res, 'Not found', 404));

// ---------- static ----------
const SEED_IMG = path.join(ROOT, 'seed', 'images');
const THUMB_DIR = path.join(DATA_DIR, 'thumbs');
const SIZES = [360, 640, 1080]; // widths the menu asks for, via srcset
await mkdir(UPLOAD_DIR, { recursive: true });
for (const w of SIZES) await mkdir(path.join(THUMB_DIR, String(w)), { recursive: true });
const longCache = { maxAge: '30d', immutable: true };
const exists = (p) => access(p).then(() => true, () => false);

// Resized copies (/media/w/640/x.webp) so each phone downloads only what its screen can show.
// Generated on first request, then cached on disk. Never upscales.
const pending = new Map();
app.get('/media/w/:w/:name', async (req, res, next) => {
  const w = Number(req.params.w);
  const { name } = req.params;
  if (!SIZES.includes(w) || !/^[\w-]+\.webp$/.test(name)) return next();
  const out = path.join(THUMB_DIR, String(w), name);
  try {
    if (!(await exists(out))) {
      const src = [path.join(UPLOAD_DIR, name), path.join(SEED_IMG, name)];
      const from = (await exists(src[0])) ? src[0] : (await exists(src[1])) ? src[1] : null;
      if (!from) return next();
      const key = `${w}/${name}`;
      if (!pending.has(key)) {
        pending.set(key, sharp(from).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out).finally(() => pending.delete(key)));
      }
      await pending.get(key);
    }
    res.sendFile(out, { maxAge: '30d', immutable: true });
  } catch (err) { next(err); }
});
app.use('/media', express.static(UPLOAD_DIR, longCache), express.static(SEED_IMG, longCache));
// odecafe.com → website (public/index.html) · /menu → menu (public/menu.html) · /admin → admin
app.use((req, res, next) => {
  if (req.path === '/menu/') return res.redirect(301, '/menu' + req.url.slice(req.path.length));
  next();
});
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));
app.get('/admin', (_req, res) => res.sendFile(path.join(ROOT, 'public', 'admin', 'index.html')));

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) return bad(res, err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 12 MB)' : err.message);
  console.error(err);
  bad(res, 'Something went wrong', 500);
});

app.listen(PORT, () => console.log(`Ode menu → http://localhost:${PORT}   admin → http://localhost:${PORT}/admin`));
