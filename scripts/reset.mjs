// Restores the menu to the imported seed (removes all admin edits).
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
await mkdir(DATA_DIR, { recursive: true });
await copyFile(path.join(ROOT, 'seed', 'menu.json'), path.join(DATA_DIR, 'db.json'));
console.log('Menu reset to seed. Restart the server.');
