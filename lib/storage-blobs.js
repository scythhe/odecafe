// Storage in Netlify Blobs — used by the Netlify Function.
//   "db"                 the menu (JSON)
//   "media/<key>"        uploaded photos and their resized copies
// Each deploy context/branch gets its own store (see netlify/functions/api.mjs),
// so testing on a branch never touches the live menu.
import { getStore } from '@netlify/blobs';

export function blobStorage({ name, seed }) {
  // created lazily: the store needs the request context Netlify provides per invocation
  const store = () => getStore({ name, consistency: 'strong' });

  return {
    persistent: false, // other function instances may write: reload state on every request

    async loadState() {
      const state = await store().get('db', { type: 'json' });
      if (state) return state;
      await store().setJSON('db', seed); // first run: start from the seed menu
      return structuredClone(seed);
    },

    async saveState(json) {
      await store().set('db', json);
    },

    async putMedia(key, buffer, type) {
      const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); // Buffer → ArrayBuffer
      await store().set(`media/${key}`, bytes, { metadata: { type } });
    },

    async getMedia(key) {
      const hit = await store().getWithMetadata(`media/${key}`, { type: 'arrayBuffer' });
      if (!hit) return null;
      return { body: Buffer.from(hit.data), type: hit.metadata?.type || 'application/octet-stream' };
    },

    async deleteMedia(key) {
      await store().delete(`media/${key}`);
    },
  };
}
