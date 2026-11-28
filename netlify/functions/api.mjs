// Netlify Function (v2) running the Ode API (/api/*) and serving uploaded photos (/media/u-*).
// Same app as `npm start` (lib/app.js); data and photos live in Netlify Blobs.
// v2 functions get the full Blobs context from Netlify automatically, which strong
// (always up-to-date) reads require.
import serverless from 'serverless-http';
import { createApp, finishApp } from '../../lib/app.js';
import { createDb } from '../../lib/db.js';
import { createAuth } from '../../lib/auth.js';
import { blobStorage } from '../../lib/storage-blobs.js';
import seed from '../../seed/menu.json' with { type: 'json' };
import deploy from '../../lib/deploy-context.mjs'; // written at build time by scripts/netlify-build.mjs

// One store per deploy context: the live site uses "ode-live"; a branch deploy such as
// odecafe-netlify uses its own store, so testing there never touches the real menu.
const slug = (s) => String(s || 'preview').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40);
const STORE = deploy.context === 'production' ? 'ode-live' : `ode-${slug(deploy.branch || deploy.context)}`;

const PASSWORD = process.env.ADMIN_PASSWORD;
const storage = blobStorage({ name: STORE, seed });
const db = createDb(storage);
const auth = createAuth({ password: PASSWORD || crypto.randomUUID(), secret: process.env.SESSION_SECRET, secure: true });
const app = finishApp(createApp({ db, storage, auth }));
const run = serverless(app, { binary: ['image/*'] });

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  const url = new URL(req.url);
  if (!PASSWORD && url.pathname.startsWith('/api/admin/login')) {
    return json(503, { error: 'Admin is not set up yet: add ADMIN_PASSWORD in Netlify → Environment variables' });
  }

  // hand the request to Express in the classic event shape serverless-http understands
  const body = req.method === 'GET' || req.method === 'HEAD' ? null : Buffer.from(await req.arrayBuffer());
  const headers = Object.fromEntries(req.headers);
  const out = await run({
    httpMethod: req.method,
    path: url.pathname,
    headers,
    multiValueHeaders: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, [v]])),
    queryStringParameters: Object.fromEntries(url.searchParams),
    multiValueQueryStringParameters: null,
    body: body ? body.toString('base64') : null,
    isBase64Encoded: Boolean(body),
  }, {});

  const res = new Headers();
  for (const [k, v] of Object.entries(out.headers || {})) res.set(k, String(v));
  for (const [k, vs] of Object.entries(out.multiValueHeaders || {})) { res.delete(k); for (const v of vs) res.append(k, String(v)); }
  const payload = out.body ? Buffer.from(out.body, out.isBase64Encoded ? 'base64' : 'utf8') : null;
  return new Response(payload, { status: out.statusCode, headers: res });
};

// The function claims /api/* and /media/*; built files (menu photos) still win over it.
export const config = { path: ['/api/*', '/media/*'], preferStatic: true };
