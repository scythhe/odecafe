// Storage on local disk — used by `npm start` (and any normal Node host).
//   data/db.json            the menu
//   data/uploads/<name>     uploaded photos
//   data/thumbs/<w>/<name>  resized copies
import { readFile, writeFile, rename, mkdir, copyFile, access, unlink } from 'node:fs/promises';
import path from 'node:path';

const TYPES = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

export function fileStorage({ dataDir, seedFile }) {
  const dbFile = path.join(dataDir, 'db.json');
  const uploads = path.join(dataDir, 'uploads');
  const thumbs = path.join(dataDir, 'thumbs');
  // "u-x.webp" → uploads/u-x.webp, "w/640/u-x.webp" → thumbs/640/u-x.webp
  const fileFor = (key) => (key.startsWith('w/') ? path.join(thumbs, ...key.slice(2).split('/')) : path.join(uploads, key));

  return {
    persistent: true, // state stays valid in memory between requests
    uploadsDir: uploads,
    thumbsDir: thumbs,

    async loadState() {
      await mkdir(uploads, { recursive: true });
      try { await access(dbFile); } catch { await copyFile(seedFile, dbFile); }
      return JSON.parse(await readFile(dbFile, 'utf8'));
    },

    async saveState(json) {
      const tmp = `${dbFile}.${process.pid}.tmp`;
      await writeFile(tmp, json);
      await rename(tmp, dbFile); // atomic: a crash mid-write never corrupts the menu
    },

    async putMedia(key, buffer) {
      const file = fileFor(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, buffer);
    },

    async getMedia(key) {
      try {
        const body = await readFile(fileFor(key));
        return { body, type: TYPES[key.split('.').pop()] || 'application/octet-stream' };
      } catch { return null; }
    },

    async deleteMedia(key) {
      await unlink(fileFor(key)).catch(() => {});
    },
  };
}
