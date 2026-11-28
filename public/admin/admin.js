// ============ Ode — admin ============
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (Number.isInteger(n) ? String(n) : Number(n).toFixed(2));
const label = (o) => o?.en || o?.ka || '—';
const thumb = (url) => (url?.startsWith('/media/') ? url.replace('/media/', '/media/w/360/') : url);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ic = {
  grip: '<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.1"/><circle cx="15" cy="6" r="1.1"/><circle cx="9" cy="12" r="1.1"/><circle cx="15" cy="12" r="1.1"/><circle cx="9" cy="18" r="1.1"/><circle cx="15" cy="18" r="1.1"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 4 2.5 5 5.5.8-4 3.9.9 5.5L12 16.6 7.1 19.2l.9-5.5-4-3.9L9.5 9z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/></svg>',
};

let data = { settings: {}, categories: [], products: [] };
let filterCat = '';

// Extra menu languages (English and Georgian have their own fields). Empty → guests see English.
const EXTRA = [['ru', 'Русский'], ['es', 'Español'], ['tr', 'Türkçe'], ['ar', 'العربية'], ['zh', '中文']];
const ALL_LANGS = ['en', 'ka', ...EXTRA.map(([c]) => c)];
const extraField = (name, label, c, max, optional) => `<label class="field"><span>${label} · ${EXTRA.find((x) => x[0] === c)[1]}${optional ? ' <i>optional</i>' : ''}</span><input name="${name}.${c}" maxlength="${max}" autocomplete="off" lang="${c}" dir="${c === 'ar' ? 'rtl' : 'auto'}"></label>`;
$('#mlProduct').innerHTML = EXTRA.map(([c]) => extraField('name', 'Name', c, 120) + extraField('description', 'Note', c, 240, true)).join('');
$('#mlNotice').innerHTML = EXTRA.map(([c]) => extraField('notice', 'Popup text', c, 120)).join('');
const langValues = (prefix) => Object.fromEntries(ALL_LANGS.map((c) => [c, ($('#editorForm')[`${prefix}.${c}`]?.value || '').trim()]));

// ---------- api ----------
async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.endsWith('/login')) { showLogin(); throw new Error('Session expired — sign in again'); }
  if (!res.ok) throw new Error(json.error || 'Something went wrong');
  return json;
}

let toastTimer;
function toast(msg, err = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('err', err);
  try { if (el.matches(':popover-open')) el.hidePopover(); el.showPopover(); } catch {}
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    toastTimer = setTimeout(() => { try { el.hidePopover(); } catch {} }, 500);
  }, 2200);
}
const fail = (e) => toast(e.message, true);

function confirmBox(title, text, yes = 'Delete') {
  const d = $('#confirm');
  $('#confirmTitle').textContent = title;
  $('#confirmText').textContent = text;
  $('#confirmYes').textContent = yes;
  d.showModal();
  return new Promise((resolve) => {
    const done = (v) => {
      d.removeEventListener('click', onClick);
      d.removeEventListener('cancel', onCancel);
      d.close();
      resolve(v);
    };
    const onClick = (e) => {
      if (e.target === d) return done(false);
      const b = e.target.closest('button[value]');
      if (b) done(b.value === 'yes');
    };
    const onCancel = (e) => { e.preventDefault(); done(false); };
    d.addEventListener('click', onClick);
    d.addEventListener('cancel', onCancel);
  });
}

// ---------- auth ----------
function showLogin() {
  $('#app').hidden = true;
  $('#login').hidden = false;
  if (matchMedia('(hover: hover)').matches) $('#loginForm').password.focus();
}
async function showApp() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  data = await api('GET', '/api/admin/menu');
  renderAll();
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  $('#loginError').textContent = '';
  try {
    await api('POST', '/api/admin/login', { password: form.password.value });
    form.reset();
    form.password.blur();
    await showApp();
  } catch (err) {
    $('#loginError').textContent = err.message;
    form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
  }
});
$('#logout').addEventListener('click', async () => { await api('POST', '/api/admin/logout').catch(() => {}); showLogin(); });

// ---------- navigation ----------
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-view]');
  if (!b) return;
  $$('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
  $$('.view').forEach((v) => { v.hidden = v.id !== `view-${b.dataset.view}`; });
  scrollTo({ top: 0 });
});

function renderAll() {
  renderProducts();
  renderCategories();
  renderSettings();
}

const sortedCats = () => [...data.categories].sort((a, b) => a.order - b.order);
const productsOf = (cid) => data.products.filter((p) => p.categoryId === cid).sort((a, b) => a.order - b.order);

// ---------- products ----------
function renderFilter() {
  if (filterCat && !data.categories.some((c) => c.id === filterCat)) filterCat = '';
  $('#pFilter').innerHTML = `<button type="button" class="fchip${filterCat ? '' : ' active'}" data-cat="">All<small>${data.products.length}</small></button>` +
    sortedCats().map((c) => `<button type="button" class="fchip${filterCat === c.id ? ' active' : ''}" data-cat="${c.id}">${esc(label(c.name))}<small>${productsOf(c.id).length}</small></button>`).join('');
  $('#catSelect').innerHTML = sortedCats().map((c) => `<option value="${c.id}">${esc(label(c.name))}${c.name.ka && c.name.en ? ` · ${esc(c.name.ka)}` : ''}</option>`).join('');
}

function productRow(p, i, draggable) {
  const sub = p.name.ka && p.name.ka !== p.name.en ? p.name.ka : p.description?.en || '';
  return `
  <li class="item${p.available ? '' : ' off'}" data-id="${p.id}" style="--i:${i}">
    <span class="handle${draggable ? '' : ' none'}" aria-label="Drag to reorder">${ic.grip}</span>
    ${p.image ? `<img class="thumb" src="${esc(thumb(p.image))}" alt="" loading="lazy" decoding="async">` : `<span class="thumb ph">${esc(label(p.name)[0])}</span>`}
    <div class="item-main">
      <div class="item-name">${esc(label(p.name))}</div>
      ${sub ? `<div class="item-sub" lang="ka">${esc(sub)}</div>` : ''}
      <div class="item-price">${money(p.price)}<small>₾</small>${p.featured ? '<span class="feat-dot" title="Signature"></span>' : ''}</div>
    </div>
    <div class="item-price">${money(p.price)}<small>₾</small></div>
    <div class="item-actions">
      <button class="icon star${p.featured ? ' on' : ''}" type="button" data-act="featured" title="Signature">${ic.star}</button>
      <input class="switch" type="checkbox" data-act="available" ${p.available ? 'checked' : ''} title="On menu" aria-label="Show on menu">
      <button class="icon edit" type="button" data-edit title="Edit">${ic.edit}</button>
      <button class="icon danger del" type="button" data-act="delete" title="Delete">${ic.trash}</button>
    </div>
  </li>`;
}

function renderProducts() {
  renderFilter();
  const q = $('#pSearch').value.trim().toLowerCase();
  const out = $('#productList');
  const off = data.products.filter((p) => !p.available).length;
  $('#stats').innerHTML = `<b>${data.products.length}</b> products${off ? ` · <b>${off}</b> hidden` : ''}`;

  const match = (p) => !q || [...Object.values(p.name || {}), ...Object.values(p.description || {})].some((s) => String(s).toLowerCase().includes(q));
  const groups = sortedCats()
    .filter((c) => !filterCat || c.id === filterCat)
    .map((c) => ({ c, items: productsOf(c.id).filter(match) }))
    .filter((g) => g.items.length || (!q && filterCat));
  if (!groups.length) {
    out.innerHTML = `<div class="empty-state"><b>Nothing here</b>${q ? 'Try another search' : 'Tap + to add a product'}</div>`;
    return;
  }
  out.innerHTML = groups.map(({ c, items }) => `
    <section class="group">
      <h2 class="group-head">${esc(label(c.name))} <span class="n">${items.length}</span>${c.visible === false ? '<span class="tag-off">hidden category</span>' : ''}</h2>
      ${items.length ? `<ul class="list" data-cat="${c.id}">${items.map((p, i) => productRow(p, i, !q)).join('')}</ul>` : '<p class="stats">No products yet</p>'}
    </section>`).join('');
  $$('.list[data-cat]', out).forEach((ul) => sortable(ul, async (ids) => {
    ids.forEach((id, i) => { const p = data.products.find((x) => x.id === id); if (p) p.order = i; });
    try { await api('POST', '/api/admin/reorder', { type: 'products', ids }); toast('Order saved'); } catch (e) { fail(e); }
  }));
}

$('#pSearch').addEventListener('input', renderProducts);
$('#pFilter').addEventListener('click', (e) => {
  const chip = e.target.closest('.fchip');
  if (!chip) return;
  filterCat = chip.dataset.cat;
  renderProducts();
  chip.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
});
$('#newProduct').addEventListener('click', () => openEditor(null));

$('#productList').addEventListener('click', async (e) => {
  const row = e.target.closest('.item');
  if (!row || e.target.closest('.handle, .switch')) return;
  const p = data.products.find((x) => x.id === row.dataset.id);
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'featured') {
    try {
      Object.assign(p, await api('PUT', `/api/admin/products/${p.id}`, { featured: !p.featured }));
      renderProducts();
      toast(p.featured ? 'Added to signature' : 'Removed from signature');
    } catch (err) { fail(err); }
  } else if (act === 'delete') {
    deleteProduct(p, row);
  } else {
    openEditor(p);
  }
});
$('#productList').addEventListener('change', async (e) => {
  if (e.target.dataset.act !== 'available') return;
  const row = e.target.closest('.item');
  const p = data.products.find((x) => x.id === row.dataset.id);
  row.classList.toggle('off', !e.target.checked);
  try {
    Object.assign(p, await api('PUT', `/api/admin/products/${p.id}`, { available: e.target.checked }));
    const off = data.products.filter((x) => !x.available).length;
    $('#stats').innerHTML = `<b>${data.products.length}</b> products${off ? ` · <b>${off}</b> hidden` : ''}`;
    toast(p.available ? 'Shown on the menu' : 'Hidden from the menu');
  } catch (err) {
    e.target.checked = !e.target.checked;
    row.classList.toggle('off', !e.target.checked);
    fail(err);
  }
});

async function deleteProduct(p, row) {
  if (!(await confirmBox('Delete product?', `“${label(p.name)}” will be removed for good. To hide it for a while, switch it off instead.`))) return false;
  try {
    await api('DELETE', `/api/admin/products/${p.id}`);
    data.products = data.products.filter((x) => x.id !== p.id);
    if (row) { row.classList.add('removing'); await wait(320); }
    renderProducts();
    renderCategories();
    toast('Product deleted');
    return true;
  } catch (err) { fail(err); return false; }
}

// ---------- drag to reorder (pointer events: mouse + touch, auto-scrolls near the edges) ----------
function sortable(list, onDrop) {
  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.handle');
    if (!handle || handle.classList.contains('none') || e.button > 0) return;
    e.preventDefault();
    const item = handle.closest('.item');
    const items = [...list.children];
    if (items.length < 2) return;
    const from = items.indexOf(item);
    const step = items[1].getBoundingClientRect().top - items[0].getBoundingClientRect().top;
    const y0 = e.clientY;
    const s0 = scrollY;
    let y = y0, to = from, raf = 0;
    try { handle.setPointerCapture(e.pointerId); } catch {}
    item.classList.add('dragging');
    navigator.vibrate?.(8);
    items.forEach((el) => { if (el !== item) el.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)'; });

    const layout = () => {
      const dy = y - y0 + (scrollY - s0);
      item.style.transform = `translateY(${dy}px) scale(1.015)`;
      to = Math.max(0, Math.min(items.length - 1, Math.round(from + dy / step)));
      items.forEach((el, i) => {
        if (el === item) return;
        let s = 0;
        if (from < to && i > from && i <= to) s = -step;
        if (from > to && i < from && i >= to) s = step;
        el.style.transform = s ? `translateY(${s}px)` : '';
      });
    };
    const edge = 90;
    const tick = () => {
      const v = y < edge ? -(edge - y) / 6 : y > innerHeight - edge - 70 ? (y - (innerHeight - edge - 70)) / 6 : 0;
      if (v) { scrollBy(0, v); layout(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const move = (ev) => { y = ev.clientY; layout(); };
    const up = () => {
      cancelAnimationFrame(raf);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      item.classList.remove('dragging');
      items.forEach((el) => { el.style.transform = ''; el.style.transition = 'none'; });
      if (to !== from) {
        list.insertBefore(item, to > from ? items[to].nextSibling : items[to]);
        onDrop([...list.children].map((el) => el.dataset.id));
      }
      requestAnimationFrame(() => items.forEach((el) => { el.style.transition = ''; }));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
}

// ---------- product editor ----------
const editor = $('#editor');
const form = $('#editorForm');
let editing = null;
let image = '';

function setImage(url) {
  image = url || '';
  if (image) $('#dropImg').src = image; else $('#dropImg').removeAttribute('src');
  $('#drop').classList.toggle('has', !!image);
  $('#drop .drop-hint b').textContent = image ? 'Change' : 'Add photo';
  $('#removeImg').hidden = !image;
}

function syncAvailHint() {
  $('#availHint').textContent = form.available.checked ? 'Visible to guests' : 'Hidden — only you can see it';
}
form.available.addEventListener('change', syncAvailHint);

function openEditor(p) {
  editing = p;
  form.reset();
  $('#editorError').textContent = '';
  $$('.invalid', form).forEach((el) => el.classList.remove('invalid'));
  $('#editorTitle').textContent = p ? 'Edit' : 'New product';
  $('#editorDelete').hidden = !p;
  form['name.en'].value = p?.name.en || '';
  form['name.ka'].value = p?.name.ka || '';
  form['description.en'].value = p?.description?.en || '';
  form['description.ka'].value = p?.description?.ka || '';
  for (const [c] of EXTRA) {
    form[`name.${c}`].value = p?.name?.[c] || '';
    form[`description.${c}`].value = p?.description?.[c] || '';
  }
  form.querySelector('.more-langs').open = false;
  form.price.value = p ? p.price : '';
  form.categoryId.value = p?.categoryId || filterCat || sortedCats()[0]?.id || '';
  form.available.checked = p ? p.available : true;
  form.featured.checked = p ? p.featured : false;
  syncAvailHint();
  setImage(p?.image);
  editor.showModal();
  $('.editor-body').scrollTop = 0;
  history.pushState({ editor: true }, '');
}

let closingEditor = false;
async function closeEditor(fromHistory = false) {
  if (!editor.open || closingEditor) return;
  if (!fromHistory && history.state?.editor) { history.back(); return; }
  closingEditor = true;
  editor.classList.add('closing');
  await wait(280);
  editor.close();
  editor.classList.remove('closing');
  closingEditor = false;
}
addEventListener('popstate', () => { if (editor.open) closeEditor(true); });
editor.addEventListener('click', (e) => { if (e.target === editor || e.target.closest('[data-close]')) closeEditor(); });
editor.addEventListener('cancel', (e) => { e.preventDefault(); closeEditor(); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    name: langValues('name'),
    description: langValues('description'),
    price: Number(String(form.price.value).replace(',', '.')),
    categoryId: form.categoryId.value,
    available: form.available.checked,
    featured: form.featured.checked,
    image,
  };
  $$('.invalid', form).forEach((el) => el.classList.remove('invalid'));
  let err = '';
  if (!body.name.en && !body.name.ka) { form['name.en'].classList.add('invalid'); form['name.ka'].classList.add('invalid'); err = 'Add a name in at least one language'; }
  else if (form.price.value === '' || !(body.price >= 0)) { form.price.classList.add('invalid'); err = 'Add a valid price'; }
  if (err) {
    $('#editorError').textContent = err;
    $('.invalid', form)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  const btn = $('#editorSave');
  btn.disabled = true;
  try {
    if (editing) {
      Object.assign(editing, await api('PUT', `/api/admin/products/${editing.id}`, body));
      toast('Saved');
    } else {
      data.products.push(await api('POST', '/api/admin/products', body));
      toast('Product added');
    }
    renderProducts();
    renderCategories();
    closeEditor();
  } catch (e2) {
    $('#editorError').textContent = e2.message;
  } finally { btn.disabled = false; }
});

$('#editorDelete').addEventListener('click', async () => {
  if (!editing) return;
  const p = editing;
  if (await deleteProduct(p)) closeEditor();
});

// image upload (tap or drag & drop)
// Photos are resized here in the browser, then uploaded together with smaller copies for phones.
// Keeps uploads small and fast on mobile data, and the server needs no image library.
async function encode(bitmap, maxW, quality) {
  const scale = Math.min(1, maxW / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = (type) => new Promise((res) => canvas.toBlob(res, type, quality));
  const webp = await blob('image/webp');
  // older Safari can't encode WebP and silently returns PNG — use JPEG there
  return webp?.type === 'image/webp' ? webp : blob('image/jpeg');
}

async function upload(file, kind = 'product') {
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch {
    throw new Error('This photo format isn’t supported — please use a JPG or PNG');
  }
  const fd = new FormData();
  if (kind === 'cover') {
    fd.append('image', await encode(bitmap, 2400, 0.85), 'cover');
  } else {
    fd.append('image', await encode(bitmap, 1600, 0.85), 'photo');
    for (const [w, q] of [[1080, 0.83], [640, 0.8], [360, 0.78]]) fd.append(`w${w}`, await encode(bitmap, w, q), `w${w}`);
  }
  bitmap.close?.();
  return (await api('POST', `/api/admin/upload?kind=${kind}`, fd)).url;
}
function dropzone(zone, input, onFile) {
  input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); input.value = ''; });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  });
}
dropzone($('#drop'), $('#file'), async (file) => {
  const zone = $('#drop');
  zone.classList.add('busy');
  try { setImage(await upload(file)); } catch (e) { $('#editorError').textContent = e.message; }
  finally { zone.classList.remove('busy'); }
});
$('#removeImg').addEventListener('click', () => setImage(''));

// ---------- categories ----------
function renderCategories() {
  $('#catList').innerHTML = sortedCats().map((c, i) => {
    const n = data.products.filter((p) => p.categoryId === c.id).length;
    return `
    <li class="item cat${c.visible === false ? ' off' : ''}" data-id="${c.id}" style="--i:${i}">
      <span class="handle" aria-label="Drag to reorder">${ic.grip}</span>
      <div class="cat-names">
        <input data-k="en" value="${esc(c.name.en)}" placeholder="English name" maxlength="60" aria-label="English name" autocomplete="off">
        <input data-k="ka" value="${esc(c.name.ka)}" placeholder="ქართული სახელი" maxlength="60" aria-label="Georgian name" autocomplete="off" lang="ka">
      </div>
      <div class="item-actions">
        <span class="count">${n}</span>
        <input class="switch" type="checkbox" data-act="visible" ${c.visible !== false ? 'checked' : ''} aria-label="Show on menu">
        <button class="icon danger del" type="button" data-act="delete" aria-label="Delete">${ic.trash}</button>
      </div>
    </li>`;
  }).join('');
}
sortable($('#catList'), async (ids) => {
  ids.forEach((id, i) => { const c = data.categories.find((x) => x.id === id); if (c) c.order = i; });
  try { await api('POST', '/api/admin/reorder', { type: 'categories', ids }); toast('Order saved'); renderProducts(); } catch (e) { fail(e); }
});

$('#catList').addEventListener('change', async (e) => {
  const row = e.target.closest('.item');
  const c = data.categories.find((x) => x.id === row.dataset.id);
  try {
    if (e.target.dataset.act === 'visible') {
      row.classList.toggle('off', !e.target.checked);
      Object.assign(c, await api('PUT', `/api/admin/categories/${c.id}`, { visible: e.target.checked }));
      toast(c.visible ? 'Category shown' : 'Category hidden');
    } else if (e.target.dataset.k) {
      const name = { ...c.name, [e.target.dataset.k]: e.target.value.trim() };
      Object.assign(c, await api('PUT', `/api/admin/categories/${c.id}`, { name }));
      toast('Renamed');
    } else return;
    renderProducts();
  } catch (err) {
    fail(err);
    renderCategories();
  }
});
$('#catList').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.k) e.target.blur(); });
$('#catList').addEventListener('click', async (e) => {
  if (e.target.closest('[data-act]')?.dataset.act !== 'delete') return;
  const row = e.target.closest('.item');
  const c = data.categories.find((x) => x.id === row.dataset.id);
  if (!(await confirmBox('Delete category?', `“${label(c.name)}” will be removed.`))) return;
  try {
    await api('DELETE', `/api/admin/categories/${c.id}`);
    data.categories = data.categories.filter((x) => x.id !== c.id);
    row.classList.add('removing');
    await wait(320);
    renderCategories();
    renderProducts();
    toast('Category deleted');
  } catch (err) { fail(err); }
});
$('#addCat').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const name = { en: f.en.value.trim(), ka: f.ka.value.trim() };
  if (!name.en && !name.ka) return toast('Enter a category name', true);
  try {
    data.categories.push(await api('POST', '/api/admin/categories', { name }));
    f.reset();
    document.activeElement?.blur();
    renderCategories();
    renderProducts();
    toast('Category added');
  } catch (err) { fail(err); }
});

// ---------- settings ----------
function renderSettings() {
  const s = data.settings;
  const f = $('#settingsForm');
  const get = (path) => path.split('.').reduce((o, k) => o?.[k], s);
  $$('input[name]', f).forEach((el) => {
    if (el.type === 'checkbox') el.checked = get(el.name) !== false;
    else el.value = get(el.name) ?? '';
  });
  if (s.cover) $('#coverImg').src = s.cover;
  $('#coverDrop').classList.toggle('has', !!s.cover);
}
$('#settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {};
  $$('input[name]', e.currentTarget).forEach((el) => {
    const [a, b] = el.name.split('.');
    const v = el.type === 'checkbox' ? el.checked : el.value;
    if (b) (body[a] ??= {})[b] = v; else body[a] = v;
  });
  try {
    data.settings = await api('PUT', '/api/admin/settings', body);
    renderSettings();
    document.activeElement?.blur();
    toast('Saved');
  } catch (err) { fail(err); }
});
dropzone($('#coverDrop'), $('#coverFile'), async (file) => {
  const zone = $('#coverDrop');
  zone.classList.add('busy');
  try {
    const url = await upload(file, 'cover');
    data.settings = await api('PUT', '/api/admin/settings', { cover: url });
    renderSettings();
    toast('Cover updated');
  } catch (e) { fail(e); } finally { zone.classList.remove('busy'); }
});

// ---------- backup restore ----------
$('#restoreFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let backup;
  try { backup = JSON.parse(await file.text()); } catch { return toast('That file is not an Ode menu backup', true); }
  const n = backup?.products?.length ?? 0;
  if (!(await confirmBox('Restore backup?', `The current menu will be replaced with this backup (${n} products). Download a backup first if you might need today’s version.`, 'Restore'))) return;
  try {
    await api('POST', '/api/admin/import', backup);
    data = await api('GET', '/api/admin/menu');
    renderAll();
    toast('Backup restored');
  } catch (err) { fail(err); }
});

// ---------- boot ----------
const { authed } = await api('GET', '/api/admin/session').catch(() => ({ authed: false }));
if (authed) showApp().catch(fail); else showLogin();
