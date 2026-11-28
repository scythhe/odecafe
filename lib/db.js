// The menu state on top of a storage backend (disk or Netlify Blobs).
// Writes are serialized so two quick saves can't interleave.
import crypto from 'node:crypto';

export function createDb(storage) {
  let state = null;
  let queue = Promise.resolve();

  async function load() {
    state = await storage.loadState();
    state.settings ??= {};
    state.categories ??= [];
    state.products ??= [];
    return state;
  }

  return {
    load,
    // Disk storage keeps state in memory; serverless storage re-reads it each request
    async refresh() { if (!state || !storage.persistent) await load(); },
    persist() {
      const json = JSON.stringify(state, null, 2);
      queue = queue.then(() => storage.saveState(json));
      return queue;
    },
    replace(next) { state = next; },
    id: (prefix) => `${prefix}${crypto.randomBytes(5).toString('hex')}`,
    get state() { return state; },
  };
}
