// Cloudflare Worker running the Ode API (/api/*) and serving uploaded photos (/media/u-*).
// Same app as `npm start` (lib/app.js); data and photos live in Cloudflare D1.
// The website, menu, admin pages and menu photos are static files (dist/, see wrangler.toml)
// and are served by Cloudflare directly — this Worker only sees what isn't a file.
import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import { createApp, finishApp } from '../lib/app.js';
import { createDb } from '../lib/db.js';
import { createAuth } from '../lib/auth.js';
import { d1Storage } from '../lib/storage-d1.js';
import seed from '../seed/menu.json' with { type: 'json' };

const PASSWORD = env.ADMIN_PASSWORD;
const storage = d1Storage({ db: env.DB, seed });
const db = createDb(storage);
// (No random values here: Cloudflare forbids generating them while the Worker loads.)
const auth = createAuth({ password: PASSWORD || '', secret: env.SESSION_SECRET, secure: true });

const app = express();
// Until ADMIN_PASSWORD is set, the whole admin API is closed — no login, no saving.
app.use('/api/admin', (req, res, next) => {
  if (PASSWORD) return next();
  if (req.path === '/session') return res.json({ authed: false });
  res.status(503).json({ error: 'Admin is not set up yet: add the ADMIN_PASSWORD secret in Cloudflare → Worker → Settings → Variables and Secrets' });
});
app.use(finishApp(createApp({ db, storage, auth })));

const PORT = 8080;
app.listen(PORT);
export default httpServerHandler({ port: PORT });
