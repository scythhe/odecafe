// Fills the extra menu languages (ru, es, tr, ar, zh) from seed/translations.json.
//   node scripts/apply-translations.mjs [file …]   (default: seed/menu.json and data/db.json)
// Only fills languages that are still empty, so edits made in the admin are never overwritten.
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(await readFile(path.join(ROOT, 'seed', 'translations.json'), 'utf8'));
const LANGS = T._order; // ["ru","es","tr","ar","zh"]

const SETTINGS = {
  tagline: { ru: 'Вино и кухня', es: 'Vino y cocina', tr: 'Şarap ve mutfak', ar: 'نبيذ ومطبخ', zh: '葡萄酒与美食' },
  address: {
    ru: 'ул. Г. Атонели 18, Тбилиси, Грузия',
    es: 'Calle G. Atoneli 18, Tiflis, Georgia',
    tr: 'G. Atoneli Caddesi 18, Tiflis, Gürcistan',
    ar: 'شارع ج. أتونيلي 18، تبليسي، جورجيا',
    zh: '格鲁吉亚第比利斯 G. Atoneli 街18号',
  },
  notice: { ru: 'НДС +15%', es: 'IVA +15%', tr: 'KDV %15', ar: 'ضريبة القيمة المضافة +15%', zh: '增值税 +15%' },
};

// "Saperavi (red dry) 750ml" → per-language name from the wine glossary
function wine(en) {
  const m = en.match(/^(.+?)(?: \(([^)]+)\))?(?: (\d+)ml)?$/i);
  if (!m) return null;
  const [, base, style, vol] = m;
  const key = Object.keys(T.wine.names).find((k) => k.toLowerCase() === base.toLowerCase());
  if (!key || (style && !T.wine.styles[style.toLowerCase()])) return null;
  return LANGS.map((_, i) => {
    const zh = LANGS[i] === 'zh';
    let s = T.wine.names[key][i];
    if (style) s += zh ? `（${T.wine.styles[style.toLowerCase()][i]}）` : ` (${T.wine.styles[style.toLowerCase()][i]})`;
    if (vol) s += zh ? `${vol}${T.wine.ml[i]}` : ` ${vol} ${T.wine.ml[i]}`;
    return s;
  });
}

function fill(obj, values) {
  if (!obj || !values) return 0;
  let n = 0;
  LANGS.forEach((l, i) => { if (!obj[l] && values[i]) { obj[l] = values[i]; n++; } });
  return n;
}

const files = process.argv.slice(2).length ? process.argv.slice(2) : ['seed/menu.json', 'data/db.json'];
for (const rel of files) {
  const file = path.resolve(ROOT, rel);
  try { await access(file); } catch { console.log(`skip ${rel} (not found)`); continue; }
  const db = JSON.parse(await readFile(file, 'utf8'));
  let n = 0;
  const missing = [];
  for (const c of db.categories) n += fill(c.name, T.categories[c.id]);
  for (const p of db.products) {
    const values = T.products[p.id] || wine(p.name.en);
    if (values) n += fill(p.name, values); else missing.push(p.name.en);
    if (p.description?.en && T.descriptions[p.id]) n += fill(p.description, T.descriptions[p.id]);
  }
  for (const [k, v] of Object.entries(SETTINGS)) {
    db.settings[k] ??= {};
    n += fill(db.settings[k], LANGS.map((l) => v[l]));
  }
  await writeFile(file, JSON.stringify(db, null, 2));
  console.log(`${rel}: ${n} translations added${missing.length ? ` · no translation for: ${missing.join(', ')}` : ''}`);
}
