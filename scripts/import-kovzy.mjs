// One-off importer: pulls the current Ode menu (KA + EN) and its photos
// from the old kovzy menu and writes seed/menu.json + seed/images/*.webp.
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tidy } from '../lib/text.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = path.join(ROOT, 'seed');
const IMG_DIR = path.join(SEED, 'images');
const API = 'https://odecafe.kovzy.com/api';
const BUCKET = 'https://storage.googleapis.com/kovzy-prod-images-x15cbi78ocz8iei2/';
const KA = 1, EN = 2;
const hasGeorgian = (s) => /[Ⴀ-ჿ]/.test(s || '');

async function post(endpoint, lang) {
  const res = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ Languageid: lang }),
  });
  if (!res.ok) throw new Error(`${endpoint} → ${res.status}`);
  return res.json();
}

const exists = (p) => access(p).then(() => true, () => false);

async function download(hash, suffix = '') {
  if (!hash) return '';
  const file = `${hash.slice(0, 20)}${suffix}.webp`; // always the 'large' (960px) version, the biggest the old menu has
  const dest = path.join(IMG_DIR, file);
  if (!(await exists(dest))) {
    const res = await fetch(`${BUCKET}${hash}/large.webp`);
    if (!res.ok) { console.warn('  ! missing image', hash); return ''; }
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  }
  return `/media/${file}`;
}

const strip = (url) => (url || '').replace(BUCKET, '');

await mkdir(IMG_DIR, { recursive: true });
console.log('Fetching menu…');
const [catKa, catEn, prodKa, prodEn] = await Promise.all([
  post('getCategories', KA), post('getCategories', EN),
  post('getProductsWithCategory', KA), post('getProductsWithCategory', EN),
]);

const enCat = Object.fromEntries(catEn.map((c) => [c.id, c]));
const kaProd = Object.fromEntries(prodKa.Products.map((p) => [p.id, p]));

const categories = catKa
  .sort((a, b) => a.order - b.order)
  .map((c, i) => ({
    id: `c${c.id}`,
    name: { ka: tidy(c.name), en: tidy(enCat[c.id]?.name || c.name) },
    order: i,
    visible: true,
  }));

const order = {};
const products = [];
console.log(`Downloading ${prodEn.Products.length} product photos…`);
for (const p of prodEn.Products) {
  const ka = kaProd[p.id] || {};
  const catId = `c${p.category_id}`;
  order[catId] = (order[catId] ?? -1) + 1;
  products.push({
    id: `p${p.id}`,
    categoryId: catId,
    name: { en: tidy(p.name), ka: tidy(ka.name || p.name) },
    description: {
      en: tidy(p.description),
      ka: hasGeorgian(ka.description) ? tidy(ka.description) : '',
    },
    price: Number(p.price),
    image: await download(strip(p.image_name)),
    available: true,
    featured: false,
    order: order[catId],
  });
  process.stdout.write('.');
}

// Content fixes on top of the old menu's data (typos, missing volumes, stray quotes).
const FIX = {
  p20: { en: 'Beef chashushuli', ka: 'საქონლის ჩაშუშული' },
  p21: { ka: 'ოჯახური ღორის ხორცით და კარტოფილით' },
  p19: { en: 'Trout rolls with walnuts and salad' },
  p42: { en: 'Beef steak with truffle sauce' },
  p98: { en: 'Rkatsiteli (white dry)' },
  p143: { ka: 'რქაწითელი (ქარვისფერი მშრალი) 180მლ' },
  p84: { en: 'Piña colada', ka: 'პინა კოლადა' },
};
for (const p of products) {
  Object.assign(p.name, FIX[p.id] || {});
  p.name.en = tidy(p.name.en
    .replace(/Henessy/g, 'Hennessy')
    .replace(/Saferavi/g, 'Saperavi')
    .replace(/\((Red|White) /g, (_, w) => `(${w.toLowerCase()} `)
    .replace(/\(Pink\)/g, '(pink)')
    .replace(/(\d) ml\b/g, '$1ml')
    .replace(/(\w)\(/g, '$1 ('));
  p.name.ka = tidy(p.name.ka.replace(/ნახევრადტკბილი/g, 'ნახევრად ტკბილი'));
  // English name lacks the bottle size the Georgian one has
  const vol = p.name.ka.match(/(\d+)მლ$/);
  if (vol && !/\d\s?ml/i.test(p.name.en)) p.name.en += ` ${vol[1]}ml`;
}

// A few signature dishes start out as "featured" so the menu has a highlight row.
for (const id of ['p130', 'p27', 'p42', 'p58', 'p81', 'p8']) {
  const p = products.find((x) => x.id === id);
  if (p) p.featured = true;
}

const settings = {
  name: 'Ode',
  tagline: { en: 'Wine & kitchen', ka: 'ღვინო და სამზარეულო' },
  notice: { en: 'Tax +15%', ka: 'დღგ +15%', enabled: true },
  hours: { open: '09:00', close: '00:00' },
  phone: '+995 599 93 84 37',
  email: 'ode.cafe18@gmail.com',
  address: { en: 'G. Atoneli street 18, Tbilisi, Georgia', ka: 'გ. ათონელის ქ. 18, თბილისი, საქართველო' },
  mapUrl: 'https://maps.app.goo.gl/8yqYCDWy1q1xCM9g7',
  instagram: '',
  currency: '₾',
  cover: '/media/cover-ode.webp', // photo supplied by the cafe (seed/images/cover-ode.webp)
};

await writeFile(path.join(SEED, 'menu.json'), JSON.stringify({ settings, categories, products }, null, 2));
console.log(`\nDone: ${categories.length} categories, ${products.length} products.`);
