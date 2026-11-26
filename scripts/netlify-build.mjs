// Netlify build: `npm run build:netlify` (run by Netlify on every push).
//   dist/               the website, menu and admin (copied from public/)
//   dist/media/         the seed menu photos
//   dist/media/w/<w>/   their resized copies, made here once instead of on every request
//   lib/deploy-context.mjs  which context/branch this deploy is (picks the data store)
import { cp, mkdir, rm, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SEED_IMG = path.join(ROOT, 'seed', 'images');
const SIZES = [360, 640, 1080];

await rm(DIST, { recursive: true, force: true });
await cp(path.join(ROOT, 'public'), DIST, { recursive: true });
await cp(SEED_IMG, path.join(DIST, 'media'), { recursive: true });

const files = (await readdir(SEED_IMG)).filter((f) => f.endsWith('.webp'));
for (const w of SIZES) await mkdir(path.join(DIST, 'media', 'w', String(w)), { recursive: true });
let made = 0;
await Promise.all(files.map(async (f) => {
  for (const w of SIZES) {
    await sharp(path.join(SEED_IMG, f)).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 })
      .toFile(path.join(DIST, 'media', 'w', String(w), f));
    made++;
  }
}));

// long browser caching for photos that never change under the same name
await writeFile(path.join(DIST, '_headers'), [
  '/media/*', '  Cache-Control: public, max-age=31536000, immutable',
  '/img/*', '  Cache-Control: public, max-age=2592000',
  '/admin/*', '  X-Robots-Tag: noindex', '',
].join('\n'));

const deploy = { context: process.env.CONTEXT || 'dev', branch: process.env.BRANCH || 'local' };
await writeFile(path.join(ROOT, 'lib', 'deploy-context.mjs'), `export default ${JSON.stringify(deploy)};\n`);

console.log(`Built dist/: ${files.length} menu photos, ${made} resized copies · deploy ${deploy.context} (${deploy.branch})`);
