// ============ Ode — menu ============
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const T = {
  en: {
    menu: 'Menu', search: 'Search the menu', signature: 'Signature', noResults: 'No matches',
    tryElse: 'Try another word', results: 'Results', hours: 'Hours', address: 'Address', daily: 'Every day',
    call: 'Call', directions: 'Directions', notice: 'Please note', gotIt: 'Got it', unavailable: 'The menu is unavailable right now.',
  },
  ka: {
    menu: 'მენიუ', search: 'მენიუში ძებნა', signature: 'რჩეული', noResults: 'ვერაფერი მოიძებნა',
    tryElse: 'სცადეთ სხვა სიტყვა', results: 'შედეგები', hours: 'სამუშაო საათები', address: 'მისამართი', daily: 'ყოველდღე',
    call: 'დარეკვა', directions: 'რუკაზე ნახვა', notice: 'გთხოვთ, გაითვალისწინოთ', gotIt: 'გასაგებია', unavailable: 'მენიუ დროებით მიუწვდომელია.',
  },
};

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
try { localStorage.removeItem('ode.cart'); } catch {}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let lang = store.get('ode.lang', 'ka');
let menu = { settings: {}, categories: [], products: [] };
let byId = new Map();

const t = (k) => T[lang][k] ?? k;
const tr = (o) => (o ? o[lang] || o.en || o.ka || '' : '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const priceHTML = (n) => `${money(n)}<small>${esc(menu.settings.currency || '₾')}</small>`;
// resized copies served by /media/w/<width>/… — the browser picks the one that fits its screen
const sized = (url, w) => (url?.startsWith('/media/') ? url.replace('/media/', `/media/w/${w}/`) : url);
const srcset = (url) => (url?.startsWith('/media/') ? [360, 640, 1080].map((w) => `${sized(url, w)} ${w}w`).concat(`${url} 1600w`).join(', ') : '');
const SIZES = {
  // deliberately one step generous so photos stay crisp on phones
  card: '(min-width: 1100px) 30vw, (min-width: 720px) 40vw, 64vw',
  feature: '(min-width: 720px) 30vw, 72vw',
  sheet: '(min-width: 820px) 470px, 100vw',
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const icons = {
  phone: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  ig: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>',
};

// ---------- language ----------
function applyLang() {
  document.documentElement.lang = lang;
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $('#q').placeholder = t('search');
}

function switchLang() {
  lang = lang === 'ka' ? 'en' : 'ka';
  store.set('ode.lang', lang);
  const update = () => { applyLang(); renderStatic(); renderMenu(); if (sheet.open) fillSheet(current, 0); if (notice.open) fillNotice(); };
  if (document.startViewTransition && !reduceMotion) document.startViewTransition(update);
  else update();
}

// ---------- hero, status, footer ----------
function renderStatic() {
  const s = menu.settings;
  const hero = $('#heroImg');
  if (s.cover && !hero.getAttribute('src')) {
    hero.addEventListener('load', () => hero.classList.add('loaded'), { once: true });
    hero.src = s.cover;
  }
  const addr = $('#heroAddr');
  addr.hidden = !tr(s.address);
  addr.querySelector('span').textContent = tr(s.address);
  if (s.mapUrl) addr.href = s.mapUrl; else addr.removeAttribute('href');
  renderStatus();

  const links = [
    s.mapUrl && `<a class="pill-link" href="${esc(s.mapUrl)}" target="_blank" rel="noopener">${icons.pin}${t('directions')}</a>`,
    s.phone && `<a class="pill-link" href="tel:${esc(s.phone.replace(/[^\d+]/g, ''))}">${icons.phone}${esc(s.phone)}</a>`,
    s.instagram && `<a class="pill-link" href="${esc(s.instagram)}" target="_blank" rel="noopener">${icons.ig}Instagram</a>`,
    s.email && `<a class="pill-link" href="mailto:${esc(s.email)}">${icons.mail}${esc(s.email)}</a>`,
  ].filter(Boolean).join('');
  $('#footer').innerHTML = `
    <div class="footer-inner">
      <img class="fmark" src="/img/logo.webp" alt="Ode — wine & kitchen" width="474" height="394" loading="lazy">
      <div><h4>${t('hours')}</h4><p>${t('daily')}<br>${esc(s.hours?.open || '')} — ${esc(s.hours?.close || '')}</p></div>
      <div><h4>${t('address')}</h4>${s.mapUrl ? `<a class="addr" href="${esc(s.mapUrl)}" target="_blank" rel="noopener">${esc(tr(s.address))}</a>` : `<p>${esc(tr(s.address))}</p>`}</div>
      <div class="contact">${links}</div>
      <p class="fine">© ${new Date().getFullYear()} ${esc(s.name || 'Ode')}</p>
    </div>`;
}

function renderStatus() {
  // shows the working hours (green light always on), not a live open/closed state
  const { open, close } = menu.settings.hours || {};
  if (!open || !close) return;
  $('#status span').textContent = `${lang === 'ka' ? 'სამუშაო საათები' : 'Hours'} ${open} — ${close}`;
}

// ---------- menu ----------
const imgTag = (url, sizes) => `<img src="${esc(sized(url, 640))}" srcset="${esc(srcset(url))}" sizes="${sizes}" alt="" loading="lazy" decoding="async" width="640" height="640">`;

function cardHTML(p, i, q) {
  const name = tr(p.name);
  const desc = tr(p.description);
  const re = q && new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  const hl = (s) => (re ? esc(s).replace(re, '<mark>$1</mark>') : esc(s));
  return `
  <button class="card" type="button" data-id="${p.id}" style="--i:${i % 6}">
    <div class="media">${p.image ? imgTag(p.image, SIZES.card) : `<span class="noimg">${esc(name[0] || 'o')}</span>`}</div>
    <div class="body">
      <h3 class="name">${hl(name)}</h3>
      ${desc ? `<p class="desc">${hl(desc)}</p>` : ''}
      <span class="price">${priceHTML(p.price)}</span>
    </div>
  </button>`;
}

const productsIn = (cid) => menu.products.filter((p) => p.categoryId === cid);

function renderMenu() {
  const q = $('#q').value.trim().toLowerCase();
  const main = $('#menu');

  if (q) {
    const hits = menu.products.filter((p) =>
      [p.name.en, p.name.ka, p.description?.en, p.description?.ka].some((s) => s?.toLowerCase().includes(q)));
    main.innerHTML = hits.length
      ? `<section class="section" data-list="search"><div class="section-head"><h2>${t('results')}</h2><span class="count">${hits.length}</span><span class="rule"></span></div>
         <div class="grid">${hits.map((p, i) => cardHTML(p, i, q)).join('')}</div></section>`
      : `<div class="empty-search"><b>${t('noResults')}</b>${t('tryElse')}</div>`;
    lists.search = hits.map((p) => p.id);
    reveal();
    return;
  }

  const cats = menu.categories.filter((c) => productsIn(c.id).length);
  $('#chips').innerHTML = '<span class="chip-ink" id="chipInk"></span>' +
    cats.map((c) => `<button class="chip" type="button" data-cat="${c.id}">${esc(tr(c.name))}</button>`).join('');

  const featured = menu.products.filter((p) => p.featured);
  lists.featured = featured.map((p) => p.id);
  const featuredHTML = featured.length ? `
    <section class="featured" data-list="featured">
      <div class="section-head"><h2><em>${t('signature')}</em></h2><span class="rule"></span></div>
      <div class="strip">${featured.map((p, i) => `
        <button class="feature" type="button" data-id="${p.id}" style="--i:${i}">
          <div class="media">${p.image ? imgTag(p.image, SIZES.feature) : ''}</div>
          <div class="ftext"><h3>${esc(tr(p.name))}</h3><span class="price">${priceHTML(p.price)}</span></div>
        </button>`).join('')}
      </div>
    </section>` : '';

  main.innerHTML = featuredHTML + cats.map((c) => {
    const items = productsIn(c.id);
    lists[c.id] = items.map((p) => p.id);
    return `
    <section class="section" id="${c.id}" data-cat="${c.id}" data-list="${c.id}">
      <div class="section-head"><h2>${esc(tr(c.name))}</h2><span class="count">${String(items.length).padStart(2, '0')}</span><span class="rule"></span></div>
      <div class="grid">${items.map((p, i) => cardHTML(p, i)).join('')}</div>
    </section>`;
  }).join('');

  reveal();
  spy();
}

// image fade-in + scroll reveal
let revealObs;
function reveal() {
  $$('#menu img').forEach((img) => {
    if (img.complete && img.naturalWidth) img.classList.add('loaded');
    else img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
  });
  revealObs?.disconnect();
  if (!('IntersectionObserver' in window)) { $$('.card, .feature').forEach((el) => el.classList.add('in')); return; }
  revealObs = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); }
  }, { rootMargin: '0px 0px -6% 0px' });
  $$('.card, .feature').forEach((el) => revealObs.observe(el));
}

// scroll-spy for the category rail
let sections = [], activeCat, jumping = false;
function spy() {
  sections = $$('.section[data-cat]');
  setActive(activeCat && $(`.chip[data-cat="${activeCat}"]`) ? activeCat : $('.chip')?.dataset.cat, false);
  updateSpy();
}
// active category = the last section whose heading has passed the upper third of the screen
function updateSpy() {
  if (jumping || !sections.length) return;
  const line = innerHeight * 0.34;
  let pick = sections[0];
  for (const s of sections) { if (s.getBoundingClientRect().top <= line) pick = s; else break; }
  setActive(pick.dataset.cat);
}

function setActive(id, scrollChip = true) {
  const chip = $(`.chip[data-cat="${id}"]`);
  if (!chip) return;
  if (activeCat === id && chip.classList.contains('active')) return;
  activeCat = id;
  $$('.chip').forEach((c) => c.classList.toggle('active', c === chip));
  const ink = $('#chipInk');
  ink.style.width = `${chip.offsetWidth}px`;
  ink.style.transform = `translateX(${chip.offsetLeft}px)`;
  if (scrollChip) {
    const chips = $('#chips');
    chips.scrollTo({ left: chip.offsetLeft - chips.clientWidth / 2 + chip.offsetWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
}

// ---------- product sheet ----------
const sheet = $('#sheet');
const lists = {};      // list name -> product ids, used for prev / next in the sheet
let list = [];
let current = null;

function openSheet(id, listName) {
  list = lists[listName] || [id];
  sheet.classList.toggle('single', list.length < 2);
  fillSheet(byId.get(id), 0);
  sheet.showModal();
  sheet.querySelector('.close').focus({ preventScroll: true });
  requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add('show')));
  history.pushState({ sheet: true }, '');
}

function fillSheet(p, dir) {
  if (!p) return;
  current = p;
  const cat = menu.categories.find((c) => c.id === p.categoryId);
  const media = $('#sheetMedia');
  const img = $('#sheetImg');
  media.classList.toggle('empty', !p.image);
  if (p.image) {
    // show the grid's (already cached) copy instantly, then swap in the sharpest size for this screen
    img.removeAttribute('srcset');
    img.src = sized(p.image, 640);
    const sharp = new Image();
    sharp.sizes = SIZES.sheet;
    sharp.srcset = srcset(p.image);
    sharp.onload = () => { if (current === p) img.src = sharp.currentSrc || sharp.src; };
  }
  $('#sheetCat').textContent = tr(cat?.name);
  $('#sheetTitle').textContent = tr(p.name);
  $('#sheetDesc').textContent = tr(p.description);
  $('#sheetPrice').innerHTML = priceHTML(p.price);
  const i = list.indexOf(p.id);
  $('#sheetPos').textContent = `${i + 1} / ${list.length}`;
  $('#prevBtn').disabled = i <= 0;
  $('#nextBtn').disabled = i >= list.length - 1;
  if (dir && !reduceMotion) {
    for (const el of [img, $('#sheetBody')]) {
      el.classList.remove('slide-in-l', 'slide-in-r');
      void el.offsetWidth;
      el.classList.add(dir > 0 ? 'slide-in-r' : 'slide-in-l');
    }
  }
}

function step(dir) {
  const i = list.indexOf(current.id) + dir;
  if (i < 0 || i >= list.length) return;
  fillSheet(byId.get(list[i]), dir);
}

let closing = false;
async function closeSheet(fromHistory = false) {
  if (!sheet.open || closing) return;
  if (!fromHistory && history.state?.sheet) { history.back(); return; } // popstate brings us back here
  closing = true;
  sheet.classList.remove('show');
  sheet.style.removeProperty('--drag');
  await wait(reduceMotion ? 0 : 420);
  sheet.close();
  closing = false;
}

// swipe down to dismiss, swipe sideways for the next / previous dish
function sheetGestures() {
  let x0, y0, t0, axis, id = null;
  const zone = (e) => e.target.closest('.sheet-media, .grab') || (e.target.closest('.sheet-inner') && !e.target.closest('.sheet-body, button'));
  sheet.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !zone(e)) return;
    id = e.pointerId; x0 = e.clientX; y0 = e.clientY; t0 = performance.now(); axis = null;
  });
  sheet.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (!axis && Math.hypot(dx, dy) > 8) axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
    if (axis === 'y') {
      sheet.classList.add('dragging');
      sheet.style.setProperty('--drag', `${Math.max(0, dy) + Math.min(0, dy) * 0.15}px`);
    } else if (axis === 'x') {
      $('#sheetImg').style.transform = `translateX(${dx * 0.35}px)`;
    }
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    const dx = e.clientX - x0, dy = e.clientY - y0, v = dy / (performance.now() - t0);
    sheet.classList.remove('dragging');
    $('#sheetImg').style.transform = '';
    if (axis === 'y') {
      if (dy > 110 || v > 0.6) closeSheet();
      else sheet.style.removeProperty('--drag');
    } else if (axis === 'x' && Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);
}

// ---------- popup shown on every visit (e.g. "Tax +15%") ----------
const notice = $('#notice');
// "+15%" (or any percentage / number) is set large in the accent colour
const noticeHTML = (text) => esc(text).replace(/([+−-]?\s?\d+(?:[.,]\d+)?\s?%?)/, '<b>$1</b>');
function fillNotice() {
  const n = menu.settings.notice || {};
  const main = n[lang] || n.en || n.ka || '';
  const alt = n[lang === 'ka' ? 'en' : 'ka'] || '';
  $('#noticeMain').innerHTML = noticeHTML(main);
  $('#noticeAlt').textContent = alt && alt !== main ? alt : '';
  return !!main;
}
function showNotice() {
  if (menu.settings.notice?.enabled === false || !fillNotice()) return;
  notice.showModal();
  notice.querySelector('.notice-ok').focus({ preventScroll: true });
  requestAnimationFrame(() => requestAnimationFrame(() => notice.classList.add('show')));
}
async function closeNotice() {
  if (!notice.open || notice.classList.contains('closing')) return;
  notice.classList.add('closing');
  notice.classList.remove('show');
  await wait(reduceMotion ? 0 : 320);
  notice.close();
  notice.classList.remove('closing');
}
notice.addEventListener('click', (e) => { if (e.target === notice || e.target.closest('[data-close]')) closeNotice(); });
notice.addEventListener('cancel', (e) => { e.preventDefault(); closeNotice(); });

// scroll position where the category rail docks under the (always visible) top bar
const menuTop = () => $('#top').offsetHeight - $('#topbar').offsetHeight;

// ---------- events ----------
function bindUI() {
  $('#langBtn').addEventListener('click', switchLang);

  $('#menu').addEventListener('click', (e) => {
    const item = e.target.closest('[data-id]');
    if (item) openSheet(item.dataset.id, item.closest('[data-list]')?.dataset.list);
  });

  $('#chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    setActive(chip.dataset.cat);
    jumping = true;
    document.getElementById(chip.dataset.cat)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    clearTimeout(spy.t);
    spy.t = setTimeout(() => { jumping = false; }, 900);
  });

  // search
  const search = $('#search');
  const q = $('#q');
  const closeSearch = () => { q.value = ''; search.classList.remove('open'); q.blur(); renderMenu(); };
  q.addEventListener('focus', () => search.classList.add('open'));
  q.addEventListener('blur', () => { if (!q.value) search.classList.remove('open'); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearch();
    if (e.key === 'Enter') q.blur(); // hides the phone keyboard
  });
  let deb;
  q.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(() => {
      renderMenu();
      const top = menuTop();
      if (window.scrollY < top - 1 || q.value) window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    }, 140);
  });
  $('#qClear').addEventListener('pointerdown', (e) => e.preventDefault()); // keep focus in the input
  $('#qClear').addEventListener('click', () => { if (q.value) { q.value = ''; renderMenu(); q.focus(); } else closeSearch(); });

  // sheet
  sheet.addEventListener('click', (e) => { if (e.target === sheet || e.target.closest('[data-close]')) closeSheet(); });
  sheet.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });
  sheet.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
  $('#prevBtn').addEventListener('click', () => step(-1));
  $('#nextBtn').addEventListener('click', () => step(1));
  addEventListener('popstate', () => { if (sheet.open) closeSheet(true); });
  sheetGestures();

  // top bar, rail border, back-to-top
  const rail = $('#rail');
  const topbar = $('#topbar');
  const toTop = $('#toTop');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const stuck = rail.getBoundingClientRect().top <= topbar.offsetHeight + 0.5;
      rail.classList.toggle('stuck', stuck);
      topbar.classList.toggle('solid', window.scrollY > 24);
      toTop.classList.toggle('show', window.scrollY > innerHeight * 2);
      updateSpy();
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
  $('#toMenu').addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: menuTop(), behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  let rw;
  addEventListener('resize', () => { clearTimeout(rw); rw = setTimeout(() => { const a = activeCat; activeCat = null; setActive(a, false); }, 150); });
  setInterval(renderStatus, 60_000);
}

// ---------- boot ----------
applyLang();
try {
  const res = await fetch('/api/menu');
  if (!res.ok) throw new Error();
  menu = await res.json();
} catch {
  $('#menu').innerHTML = `<p class="empty-search"><b>ode</b>${t('unavailable')}</p>`;
}
byId = new Map(menu.products.map((p) => [p.id, p]));
renderStatic();
renderMenu();
bindUI();
setTimeout(showNotice, reduceMotion ? 0 : 650);
if (location.hash.length > 1) document.getElementById(location.hash.slice(1))?.scrollIntoView();
