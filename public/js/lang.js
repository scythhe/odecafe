// Language picker shared by the website and the menu.
export const LANGS = [
  { code: 'en', short: 'EN', name: 'English' },
  { code: 'ka', short: 'ქა', name: 'ქართული' },
  { code: 'ru', short: 'RU', name: 'Русский' },
  { code: 'es', short: 'ES', name: 'Español' },
  { code: 'tr', short: 'TR', name: 'Türkçe' },
  { code: 'ar', short: 'ع', name: 'العربية', rtl: true },
  { code: 'zh', short: '中', name: '中文' },
];
const KEY = 'ode.lang';
const valid = (c) => LANGS.some((l) => l.code === c);

// saved choice → the phone's language (if we have it) → Georgian
export function initialLang() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (valid(saved)) return saved;
  } catch {}
  for (const tag of navigator.languages || [navigator.language || '']) {
    const code = String(tag).toLowerCase().split('-')[0];
    if (valid(code)) return code;
  }
  return 'ka';
}

export function saveLang(code) {
  try { localStorage.setItem(KEY, JSON.stringify(code)); } catch {}
}

export function applyDocLang(code) {
  const l = LANGS.find((x) => x.code === code) || LANGS[0];
  document.documentElement.lang = l.code;
  document.documentElement.dir = l.rtl ? 'rtl' : 'ltr';
}

// Pick a translated value: chosen language → English → Georgian
export const pick = (obj, code) => (obj ? obj[code] || obj.en || obj.ka || '' : '');

/** Renders the picker into `root` and calls onChange(code) when a language is chosen. */
export function mountPicker(root, getLang, onChange) {
  root.innerHTML = `
    <button class="langpick-btn" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="Language">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/></svg>
      <span class="langpick-cur"></span>
    </button>
    <ul class="langpick-menu" role="listbox" hidden>
      ${LANGS.map((l) => `<li><button type="button" role="option" data-lang="${l.code}" lang="${l.code}" dir="${l.rtl ? 'rtl' : 'ltr'}">${l.name}</button></li>`).join('')}
    </ul>`;
  const btn = root.querySelector('.langpick-btn');
  const menu = root.querySelector('.langpick-menu');
  const sync = () => {
    const cur = getLang();
    root.querySelector('.langpick-cur').textContent = LANGS.find((l) => l.code === cur)?.short || 'EN';
    menu.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.lang === cur)));
  };
  const open = (yes) => {
    menu.hidden = !yes;
    btn.setAttribute('aria-expanded', String(yes));
    root.classList.toggle('open', yes);
    if (yes) menu.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); open(menu.hidden); });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (!b) return;
    open(false);
    btn.focus({ preventScroll: true });
    if (b.dataset.lang !== getLang()) onChange(b.dataset.lang);
  });
  document.addEventListener('click', (e) => { if (!root.contains(e.target)) open(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { open(false); btn.focus(); } });
  sync();
  return { sync };
}
