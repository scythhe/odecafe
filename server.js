// Local / regular-Node-host server: `npm start`.
// On Netlify the same API runs as a function instead (netlify/functions/api.mjs).
import express from 'express';
import sharp from 'sharp';
import path from 'node:path';
import { access, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDb } from './lib/db.js';
import { createAuth } from './lib/auth.js';
import { fileStorage } from './lib/storage-file.js';
import { createApp, finishApp, SIZES } from './lib/app.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const SEED_IMG = path.join(ROOT, 'seed', 'images');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ode-admin';
if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠  ADMIN_PASSWORD not set — using the default "ode-admin". Set it before going live.');
}

const storage = fileStorage({ dataDir: DATA_DIR, seedFile: path.join(ROOT, 'seed', 'menu.json') });
const db = createDb(storage);
await db.load();
const auth = createAuth({ password: ADMIN_PASSWORD, secret: process.env.SESSION_SECRET, secure: process.env.NODE_ENV === 'production' });
const app = createApp({ db, storage, auth });

// Resized copies of the seed photos (/media/w/640/x.webp), made on first request and cached on disk.
// (On Netlify these are generated at build time instead — see scripts/netlify-build.mjs.)
const exists = (p) => access(p).then(() => true, () => false);
for (const w of SIZES) await mkdir(path.join(storage.thumbsDir, String(w)), { recursive: true });
const pending = new Map();
app.get('/media/w/:w/:name', async (req, res, next) => {
  const w = Number(req.params.w);
  const { name } = req.params;
  if (!SIZES.includes(w) || !/^[\w-]+\.webp$/.test(name)) return next();
  const out = path.join(storage.thumbsDir, String(w), name);
  try {
    if (!(await exists(out))) {
      const from = path.join(SEED_IMG, name);
      if (!(await exists(from))) return next();
      const key = `${w}/${name}`;
      if (!pending.has(key)) {
        pending.set(key, sharp(from).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out).finally(() => pending.delete(key)));
      }
      await pending.get(key);
    }
    res.sendFile(out, { maxAge: '30d', immutable: true });
  } catch (err) { next(err); }
});
app.use('/media', express.static(SEED_IMG, { maxAge: '30d', immutable: true }));

// odecafe.com → website (public/index.html) · /menu → menu (public/menu.html) · /admin → admin
app.use((req, res, next) => {
  if (req.path === '/menu/') return res.redirect(301, '/menu' + req.url.slice(req.path.length));
  next();
});
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));
app.get('/admin', (_req, res) => res.sendFile(path.join(ROOT, 'public', 'admin', 'index.html')));

finishApp(app);
app.listen(PORT, () => console.log(`Ode → http://localhost:${PORT}   menu → /menu   admin → /admin`));
