// The Ode API: public menu, admin, uploads and media.
// Shared by the local server (server.js) and the Netlify Function (netlify/functions/api.mjs);
// only the storage backend differs. Deliberately free of native modules (no sharp):
// the admin resizes photos in the browser before uploading.
import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { toMkhedruli } from './text.js';

export const SIZES = [360, 640, 1080]; // widths the menu asks for, via srcset
const MEDIA_NAME = /^u-[\w-]+\.(webp|jpe?g|png)$/;

export const LANGS = ['en', 'ka', 'ru', 'es', 'tr', 'ar', 'zh'];
const str = (v, max = 160) => toMkhedruli(v).trim().replace(/\s+/g, ' ').slice(0, max);
// Translated text: keep only the languages that were sent, merged over what was there,
// so saving the English/Georgian fields never wipes the other languages.
const i18n = (v, max, prev = {}) => {
  const out = { en: prev.en || '', ka: prev.ka || '', ...prev };
  for (const l of LANGS) if (v && l in v) out[l] = str(v[l], max);
  return out;
};
const byOrder = (a, b) => a.order - b.order;
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

// trust the bytes, not the file name or browser-declared type
function sniff(buf) {
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return { ext: 'png', type: 'image/png' };
  return null;
}

export function createApp({ db, storage, auth }) {
  const S = () => db.state;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    next();
  });

  function cleanProduct(body, prev = {}) {
    const out = { ...prev };
    if ('name' in body) out.name = i18n(body.name, 120, out.name);
    if ('description' in body) out.description = i18n(body.description, 240, out.description);
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
    if (!S().categories.some((c) => c.id === p.categoryId)) return 'Pick a category';
    if (p.image && !p.image.startsWith('/media/')) return 'Invalid image';
    return null;
  }

  async function removeImageIfOrphan(url) {
    if (!url?.startsWith('/media/u-')) return; // never touch seed images
    if (S().products.some((p) => p.image === url) || S().settings.cover === url) return;
    const name = url.slice('/media/'.length);
    await storage.deleteMedia(name);
    for (const w of SIZES) await storage.deleteMedia(`w/${w}/${name}`);
  }

  // always work on the latest saved menu (matters on Netlify, where many instances may run)
  app.use('/api', async (_req, _res, next) => { try { await db.refresh(); next(); } catch (e) { next(e); } });

  // ---------- public ----------
  app.get('/api/menu', (_req, res) => {
    const state = S();
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
  admin.post('/login', (req, res) => auth.login(req, res));
  admin.post('/logout', (req, res) => auth.logout(req, res));
  admin.get('/session', (req, res) => res.json({ authed: auth.isAuthed(req) }));
  admin.use(auth.require);

  admin.get('/menu', (_req, res) => {
    const state = S();
    res.set('Cache-Control', 'no-store');
    res.json({
      settings: state.settings,
      categories: [...state.categories].sort(byOrder),
      products: [...state.products].sort(byOrder),
    });
  });

  // products
  admin.post('/products', async (req, res) => {
    const state = S();
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
    const state = S();
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
    const state = S();
    const i = state.products.findIndex((p) => p.id === req.params.id);
    if (i < 0) return bad(res, 'Product not found', 404);
    const [gone] = state.products.splice(i, 1);
    await db.persist();
    await removeImageIfOrphan(gone.image);
    res.json({ ok: true });
  });

  // categories
  admin.post('/categories', async (req, res) => {
    const state = S();
    const name = i18n(req.body?.name, 60);
    if (!name.en && !name.ka) return bad(res, 'Name is required');
    const c = { id: db.id('c'), name, order: state.categories.length, visible: req.body?.visible !== false };
    state.categories.push(c);
    await db.persist();
    res.status(201).json(c);
  });

  admin.put('/categories/:id', async (req, res) => {
    const c = S().categories.find((x) => x.id === req.params.id);
    if (!c) return bad(res, 'Category not found', 404);
    if ('name' in req.body) {
      const name = i18n(req.body.name, 60, c.name);
      if (!name.en && !name.ka) return bad(res, 'Name is required');
      c.name = name;
    }
    if ('visible' in req.body) c.visible = Boolean(req.body.visible);
    await db.persist();
    res.json(c);
  });

  admin.delete('/categories/:id', async (req, res) => {
    const state = S();
    const i = state.categories.findIndex((x) => x.id === req.params.id);
    if (i < 0) return bad(res, 'Category not found', 404);
    const count = state.products.filter((p) => p.categoryId === req.params.id).length;
    if (count) return bad(res, `Move or delete its ${count} product${count > 1 ? 's' : ''} first`, 409);
    state.categories.splice(i, 1);
    await db.persist();
    res.json({ ok: true });
  });

  admin.post('/reorder', async (req, res) => {
    const state = S();
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
    const s = S().settings;
    const time = (v, d) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : d);
    if ('name' in b) s.name = str(b.name, 40) || s.name;
    if ('tagline' in b) s.tagline = i18n(b.tagline, 80, s.tagline);
    if ('address' in b) s.address = i18n(b.address, 120, s.address);
    if ('phone' in b) s.phone = str(b.phone, 40);
    if ('email' in b) s.email = str(b.email, 80);
    if ('instagram' in b) s.instagram = str(b.instagram, 120);
    if ('notice' in b) s.notice = { ...i18n(b.notice, 120, s.notice), enabled: b.notice?.enabled !== false };
    if ('mapUrl' in b) {
      const url = str(b.mapUrl, 600);
      if (url && !/^https:\/\//.test(url)) return bad(res, 'Map link must start with https://');
      s.mapUrl = url;
    }
    if ('hours' in b) s.hours = { open: time(b.hours?.open, s.hours.open), close: time(b.hours?.close, s.hours.close) };
    let prevCover;
    if ('cover' in b && String(b.cover).startsWith('/media/')) {
      prevCover = s.cover;
      s.cover = str(b.cover, 200);
    }
    await db.persist();
    if (prevCover && prevCover !== s.cover) await removeImageIfOrphan(prevCover);
    res.json(s);
  });

  // backup: download the whole menu as a file, or restore one
  admin.get('/export', (_req, res) => {
    const day = new Date().toISOString().slice(0, 10);
    res.set('Content-Disposition', `attachment; filename="ode-menu-${day}.json"`);
    res.set('Cache-Control', 'no-store');
    res.json(S());
  });

  admin.post('/import', async (req, res) => {
    const next = req.body;
    const ok = next && typeof next === 'object' && next.settings && Array.isArray(next.categories) && Array.isArray(next.products)
      && next.products.every((p) => p.id && p.name && p.categoryId);
    if (!ok) return bad(res, 'That file is not an Ode menu backup');
    db.replace(next);
    await db.persist();
    res.json({ ok: true, products: next.products.length, categories: next.categories.length });
  });

  // uploads: the admin sends the photo plus ready-made smaller copies (resized in the browser)
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 4 } });
  admin.post('/upload', upload.fields([{ name: 'image', maxCount: 1 }, ...SIZES.map((w) => ({ name: `w${w}`, maxCount: 1 }))]), async (req, res) => {
    const main = req.files?.image?.[0];
    const kind = main && sniff(main.buffer);
    if (!kind) return bad(res, 'Please choose a JPG, PNG or WEBP image');
    if (storage.maxBytes && main.buffer.length > storage.maxBytes) return bad(res, 'This photo is too large — please choose a smaller one', 413);
    const name = `u-${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}.${kind.ext}`;
    await storage.putMedia(name, main.buffer, kind.type);
    for (const w of SIZES) {
      const f = req.files?.[`w${w}`]?.[0];
      const k = f && sniff(f.buffer);
      if (k && !(storage.maxBytes && f.buffer.length > storage.maxBytes)) await storage.putMedia(`w/${w}/${name}`, f.buffer, k.type);
    }
    res.json({ url: `/media/${name}` });
  });

  app.use('/api/admin', admin);
  app.use('/api', (_req, res) => bad(res, 'Not found', 404));

  // ---------- uploaded photos ----------
  const send = (res, file) => {
    res.set('Content-Type', file.type);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(file.body);
  };
  app.get('/media/w/:w/:name', async (req, res, next) => {
    const w = Number(req.params.w);
    const { name } = req.params;
    if (!SIZES.includes(w) || !MEDIA_NAME.test(name)) return next();
    try {
      const file = (await storage.getMedia(`w/${w}/${name}`)) || (await storage.getMedia(name)); // fall back to the full photo
      return file ? send(res, file) : next();
    } catch (e) { next(e); }
  });
  app.get('/media/:name', async (req, res, next) => {
    if (!MEDIA_NAME.test(req.params.name)) return next();
    try {
      const file = await storage.getMedia(req.params.name);
      return file ? send(res, file) : next();
    } catch (e) { next(e); }
  });

  return app;
}

// error handler — added last, after any extra routes the host adds
export function finishApp(app) {
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      return bad(res, err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 5 MB)' : err.message);
    }
    console.error(err);
    bad(res, 'Something went wrong', 500);
  });
  return app;
}
