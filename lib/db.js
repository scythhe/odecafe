// Tiny JSON-file store. Writes are serialized and atomic (tmp file + rename),
// so a crash mid-write never corrupts the menu.
import { readFile, writeFile, rename, mkdir, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export function createDb({ dataDir, seedFile }) {
  const file = path.join(dataDir, 'db.json');
  let state = null;
  let queue = Promise.resolve();

  async function load() {
    await mkdir(dataDir, { recursive: true });
    try { await access(file); } catch { await copyFile(seedFile, file); }
    state = JSON.parse(await readFile(file, 'utf8'));
    state.settings ??= {};
    state.categories ??= [];
    state.products ??= [];
    return state;
  }

  function persist() {
    const snapshot = JSON.stringify(state, null, 2);
    queue = queue.then(async () => {
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, snapshot);
      await rename(tmp, file);
    });
    return queue;
  }

  const id = (prefix) => `${prefix}${crypto.randomBytes(5).toString('hex')}`;

  return {
    load,
    persist,
    id,
    get state() { return state; },
  };
}
