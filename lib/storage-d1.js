// Storage in Cloudflare D1 — used by the Cloudflare Worker (cloudflare/worker.mjs).
// One small key/value table holds everything:
//   "db"            the menu (JSON text)
//   "media/<key>"   uploaded photos and their resized copies (binary)
// D1 reads see the latest write, which the admin relies on (save → reload shows it).

const MAX_BYTES = 1.9 * 1024 * 1024; // D1 rows are capped at 2 MB

export function d1Storage({ db, seed }) {
  let ready;
  const init = () => (ready ??= db.prepare(
    'CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, type TEXT, value BLOB, updated INTEGER)',
  ).run());
  const put = async (key, value, type) => {
    await init();
    await db.prepare('INSERT INTO kv (key, type, value, updated) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(key) DO UPDATE SET type = ?2, value = ?3, updated = ?4')
      .bind(key, type, value, Date.now()).run();
  };

  return {
    persistent: false, // other Worker instances may write: reload state on every request
    maxBytes: MAX_BYTES,

    async loadState() {
      await init();
      const row = await db.prepare('SELECT value FROM kv WHERE key = ?1').bind('db').first();
      if (row) return JSON.parse(typeof row.value === 'string' ? row.value : new TextDecoder().decode(new Uint8Array(row.value)));
      await put('db', JSON.stringify(seed), 'application/json'); // first run: start from the seed menu
      return structuredClone(seed);
    },

    async saveState(json) {
      await put('db', json, 'application/json');
    },

    async putMedia(key, buffer, type) {
      if (buffer.byteLength > MAX_BYTES) throw Object.assign(new Error('Photo is too large'), { status: 413 });
      // copy into a plain ArrayBuffer so D1 stores it as a BLOB
      const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      await put(`media/${key}`, bytes, type);
    },

    async getMedia(key) {
      await init();
      const row = await db.prepare('SELECT type, value FROM kv WHERE key = ?1').bind(`media/${key}`).first();
      if (!row) return null;
      return { body: Buffer.from(new Uint8Array(row.value)), type: row.type || 'application/octet-stream' };
    },

    async deleteMedia(key) {
      await init();
      await db.prepare('DELETE FROM kv WHERE key = ?1').bind(`media/${key}`).run();
    },
  };
}
