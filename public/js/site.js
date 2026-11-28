// ============ Ode — website ============
import { initialLang, saveLang, applyDocLang, mountPicker, pick } from './lang.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const T = {
  en: {
    menu: 'Menu', viewMenu: 'View menu', reserve: 'Reserve a table',
    liveTitle: 'Live piano',
    aboutEyebrow: 'About Ode',
    aboutText: 'Ode is a restaurant in the center of Tbilisi featuring a cozy dining room, a terrace, and warm hospitality. It is ideal for leisurely lunches, family gatherings, and elegant dinners accompanied by live piano music.',
    factTerrace: 'Terrace', factHall: 'Dining room', factPiano: 'Live piano',
    flavorsTitle: 'Flavors for Every Occasion',
    flavorsText: 'Our menu brings together Georgian classics alongside meat, fish, and seafood dishes, pasta, risotto, salads, soups, vegetarian options, and desserts. Whether you are in the mood for a hearty dinner or a light bite, you will easily find something to suit your taste.',
    locTitle: 'In the Heart of Tbilisi on Atoneli Street',
    locText: 'Located on the quiet, historic 18 Giorgi Atoneli Street, the restaurant is an easy stop during a walk through the city center—perfect for spending the evening on our open terrace or in the main dining room.',
    addressLabel: 'Address', hoursLabel: 'Hours', directions: 'Directions',
    galleryEyebrow: 'Atmosphere',
    reserveTitle: 'Reserve a table', call: 'Call', daily: 'Every day',
    hours: 'Hours', address: 'Address', contact: 'Contact',
    waText: 'Hello! I would like to reserve a table at Ode.',
  },
  ka: {
    menu: 'მენიუ', viewMenu: 'მენიუს ნახვა', reserve: 'დაჯავშნა',
    liveTitle: 'ცოცხალი პიანინო',
    aboutEyebrow: 'ოდეს შესახებ',
    aboutText: 'ოდე თბილისის ცენტრში მდებარე რესტორანია მყუდრო დარბაზით, ტერასითა და თბილი მასპინძლობით. აქ იდეალურია დაუჩქარებელი სადილი, ოჯახური შეკრება თუ ელეგანტური ვახშამი ცოცხალი ფორტეპიანოს თანხლებით.',
    factTerrace: 'ტერასა', factHall: 'დარბაზი', factPiano: 'ცოცხალი ფორტეპიანო',
    flavorsTitle: 'გემოები ყველა შემთხვევისთვის',
    flavorsText: 'ჩვენს მენიუში ქართულ კლასიკას ხორცის, თევზისა და ზღვის პროდუქტების კერძები, პასტა, რიზოტო, სალათები, სუპები, ვეგეტარიანული კერძები და დესერტები ავსებს. ნოყიერი ვახშამი გსურთ თუ მსუბუქი წასახემსებელი — აქ აუცილებლად იპოვით თქვენს გემოზე.',
    locTitle: 'თბილისის გულში, ათონელის ქუჩაზე',
    locText: 'რესტორანი წყნარ, ისტორიულ გიორგი ათონელის ქუჩა 18-ში მდებარეობს — ქალაქის ცენტრში სეირნობისას აქ შემოსვლა მარტივია. საღამო ღია ტერასაზე ან მთავარ დარბაზში გაატარეთ.',
    addressLabel: 'მისამართი', hoursLabel: 'სამუშაო საათები', directions: 'რუკაზე ნახვა',
    galleryEyebrow: 'ატმოსფერო',
    reserveTitle: 'მაგიდის დაჯავშნა', call: 'დარეკვა', daily: 'ყოველდღე',
    hours: 'სამუშაო საათები', address: 'მისამართი', contact: 'კონტაქტი',
    waText: 'გამარჯობა! მსურს მაგიდის დაჯავშნა ოდეში.',
  },
  ru: {
    menu: 'Меню', viewMenu: 'Смотреть меню', reserve: 'Забронировать',
    liveTitle: 'Живое фортепиано',
    aboutEyebrow: 'Об Ode',
    aboutText: 'Ode — ресторан в центре Тбилиси с уютным залом, террасой и тёплым гостеприимством. Здесь хорошо неспешно пообедать, собраться всей семьёй или провести элегантный ужин под живое фортепиано.',
    factTerrace: 'Терраса', factHall: 'Зал', factPiano: 'Живое фортепиано',
    flavorsTitle: 'Вкусы на любой случай',
    flavorsText: 'В нашем меню грузинская классика соседствует с блюдами из мяса, рыбы и морепродуктов, пастой, ризотто, салатами, супами, вегетарианскими блюдами и десертами. Хотите сытный ужин или лёгкий перекус — вы обязательно найдёте что-то по вкусу.',
    locTitle: 'В сердце Тбилиси, на улице Атонели',
    locText: 'Ресторан находится на тихой исторической улице Георгия Атонели, 18 — сюда легко заглянуть во время прогулки по центру города. Проведите вечер на открытой террасе или в главном зале.',
    addressLabel: 'Адрес', hoursLabel: 'Часы работы', directions: 'Как добраться',
    galleryEyebrow: 'Атмосфера',
    reserveTitle: 'Забронировать столик', call: 'Позвонить', daily: 'Ежедневно',
    hours: 'Часы работы', address: 'Адрес', contact: 'Контакты',
    waText: 'Здравствуйте! Хочу забронировать столик в Ode.',
  },
  es: {
    menu: 'Menú', viewMenu: 'Ver el menú', reserve: 'Reservar',
    liveTitle: 'Piano en vivo',
    aboutEyebrow: 'Sobre Ode',
    aboutText: 'Ode es un restaurante en el centro de Tiflis con un comedor acogedor, una terraza y una cálida hospitalidad. Es ideal para almuerzos sin prisa, reuniones familiares y cenas elegantes con música de piano en vivo.',
    factTerrace: 'Terraza', factHall: 'Comedor', factPiano: 'Piano en vivo',
    flavorsTitle: 'Sabores para cada ocasión',
    flavorsText: 'Nuestra carta reúne clásicos georgianos junto a carnes, pescados y mariscos, pasta, risotto, ensaladas, sopas, opciones vegetarianas y postres. Tanto si le apetece una cena contundente como algo ligero, encontrará fácilmente algo a su gusto.',
    locTitle: 'En el corazón de Tiflis, en la calle Atoneli',
    locText: 'En la tranquila e histórica calle Giorgi Atoneli 18, el restaurante es una parada fácil durante un paseo por el centro: perfecto para pasar la velada en nuestra terraza al aire libre o en el comedor principal.',
    addressLabel: 'Dirección', hoursLabel: 'Horario', directions: 'Cómo llegar',
    galleryEyebrow: 'Ambiente',
    reserveTitle: 'Reservar mesa', call: 'Llamar', daily: 'Todos los días',
    hours: 'Horario', address: 'Dirección', contact: 'Contacto',
    waText: '¡Hola! Me gustaría reservar una mesa en Ode.',
  },
  tr: {
    menu: 'Menü', viewMenu: 'Menüyü gör', reserve: 'Rezervasyon',
    liveTitle: 'Canlı piyano',
    aboutEyebrow: 'Ode hakkında',
    aboutText: 'Ode, Tiflis’in merkezinde sıcak bir salonu, terası ve içten misafirperverliğiyle bir restoran. Keyifli öğle yemekleri, aile buluşmaları ve canlı piyano eşliğinde şık akşam yemekleri için ideal.',
    factTerrace: 'Teras', factHall: 'Salon', factPiano: 'Canlı piyano',
    flavorsTitle: 'Her ana uygun lezzetler',
    flavorsText: 'Menümüzde Gürcü klasiklerinin yanında et, balık ve deniz ürünleri, makarna, risotto, salatalar, çorbalar, vejetaryen seçenekler ve tatlılar var. Doyurucu bir akşam yemeği de istesen hafif bir atıştırmalık da, damak tadına uygun bir şey mutlaka bulacaksın.',
    locTitle: 'Tiflis’in kalbinde, Atoneli Caddesi’nde',
    locText: 'Sakin ve tarihi Giorgi Atoneli Caddesi 18’deki restoran, şehir merkezinde yürüyüş yaparken kolayca uğranacak bir durak; akşamı açık terasımızda ya da ana salonda geçirmek için ideal.',
    addressLabel: 'Adres', hoursLabel: 'Çalışma saatleri', directions: 'Yol tarifi',
    galleryEyebrow: 'Atmosfer',
    reserveTitle: 'Masa ayırtın', call: 'Ara', daily: 'Her gün',
    hours: 'Çalışma saatleri', address: 'Adres', contact: 'İletişim',
    waText: 'Merhaba! Ode’da masa ayırtmak istiyorum.',
  },
  ar: {
    menu: 'القائمة', viewMenu: 'عرض القائمة', reserve: 'احجز',
    liveTitle: 'بيانو حي',
    aboutEyebrow: 'عن Ode',
    aboutText: 'Ode مطعم في وسط تبليسي يضم صالة طعام دافئة وتراساً وضيافة كريمة. إنه مثالي لغداء على مهل وللقاءات العائلية ولعشاء أنيق على أنغام البيانو الحي.',
    factTerrace: 'تراس', factHall: 'صالة الطعام', factPiano: 'بيانو حي',
    flavorsTitle: 'نكهات لكل مناسبة',
    flavorsText: 'تجمع قائمتنا بين الأطباق الجورجية الكلاسيكية وأطباق اللحوم والأسماك والمأكولات البحرية والمعكرونة والريزوتو والسلطات والشوربات والخيارات النباتية والحلويات. سواء رغبت في عشاء غني أو وجبة خفيفة، ستجد بسهولة ما يناسب ذوقك.',
    locTitle: 'في قلب تبليسي، في شارع أتونيلي',
    locText: 'يقع المطعم في شارع جيورجي أتونيلي 18 الهادئ والتاريخي، فهو محطة سهلة خلال نزهة في وسط المدينة، ومثالي لقضاء المساء على تراسنا المفتوح أو في الصالة الرئيسية.',
    addressLabel: 'العنوان', hoursLabel: 'ساعات العمل', directions: 'الاتجاهات',
    galleryEyebrow: 'الأجواء',
    reserveTitle: 'احجز طاولة', call: 'اتصل', daily: 'يومياً',
    hours: 'ساعات العمل', address: 'العنوان', contact: 'التواصل',
    waText: 'مرحباً! أود حجز طاولة في Ode.',
  },
  zh: {
    menu: '菜单', viewMenu: '查看菜单', reserve: '预订',
    liveTitle: '现场钢琴',
    aboutEyebrow: '关于 Ode',
    aboutText: 'Ode 位于第比利斯市中心，拥有温馨的用餐厅、露台和热情周到的服务。无论是悠闲的午餐、家庭聚会，还是伴着现场钢琴的优雅晚餐，这里都是理想之选。',
    factTerrace: '露台', factHall: '用餐厅', factPiano: '现场钢琴',
    flavorsTitle: '适合每个场合的美味',
    flavorsText: '我们的菜单汇集了格鲁吉亚经典菜肴，以及肉类、鱼类和海鲜、意面、烩饭、沙拉、汤品、素食和甜点。无论您想要一顿丰盛的晚餐还是一份轻食，都能轻松找到合口味的选择。',
    locTitle: '位于第比利斯中心的阿托涅利街',
    locText: '餐厅坐落于安静而富有历史感的乔治·阿托涅利街18号，漫步市中心时可轻松到访——无论是在露天露台还是主餐厅，都是共度夜晚的好去处。',
    addressLabel: '地址', hoursLabel: '营业时间', directions: '路线',
    galleryEyebrow: '氛围',
    reserveTitle: '预订餐桌', call: '致电', daily: '每天',
    hours: '营业时间', address: '地址', contact: '联系',
    waText: '您好！我想在 Ode 预订一张餐桌。',
  },
};

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let lang = initialLang(); // shared with the menu page
let data = { settings: {}, categories: [], products: [] };

let picker;
const t = (k) => T[lang]?.[k] ?? T.en[k] ?? k;
const tr = (o) => pick(o, lang);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const sized = (url, w) => (url?.startsWith('/media/') ? url.replace('/media/', `/media/w/${w}/`) : url);

// "+995 599 93 84 37" → display "599 93 84 37", dial "+995599938437", WhatsApp "995599938437"
function phoneParts(raw = '') {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 9) digits = `995${digits}`;
  const local = digits.startsWith('995') ? digits.slice(3) : digits;
  const display = local.length === 9 ? local.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4') : raw;
  return { display, tel: `+${digits}`, wa: digits };
}

const icons = {
  phone: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  ig: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
};

// ---------- render ----------
function render() {
  applyDocLang(lang);
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  const s = data.settings;
  const hours = s.hours ? `${t('daily')} · ${s.hours.open} — ${s.hours.close}` : '';
  const ph = phoneParts(s.phone);

  const hero = $('#heroImg');
  if (s.cover && !hero.getAttribute('src')) {
    hero.addEventListener('load', () => hero.classList.add('loaded'), { once: true });
    hero.src = s.cover;
  }
  const addr = $('#heroAddr');
  addr.hidden = !tr(s.address);
  addr.querySelector('span').textContent = tr(s.address);
  for (const a of [addr, $('#locAddr'), $('#locMap')]) { if (s.mapUrl) a.href = s.mapUrl; else a.removeAttribute('href'); }
  $('#locAddr').textContent = tr(s.address);
  $('#locMap').hidden = !s.mapUrl;
  $('#locHours').textContent = hours;
  renderStatus();

  // reservations
  $('#resPhone').textContent = ph.display;
  $('#resPhone').href = `tel:${ph.tel}`;
  $('#resCall').href = `tel:${ph.tel}`;
  $('#resWa').href = `https://wa.me/${ph.wa}?text=${encodeURIComponent(t('waText'))}`;
  $('#resHours').textContent = hours;

  renderDishes();
  renderFooter(ph);
}

function renderStatus() {
  // shows the working hours (green light always on), not a live open/closed state
  const { open, close } = data.settings.hours || {};
  if (!open || !close) return;
  $('#status span').textContent = `${t('hoursLabel')} ${open} — ${close}`;
}

// signature dishes from the live menu (managed in the admin)
function renderDishes() {
  const list = data.products.filter((p) => p.featured && p.image);
  const picks = (list.length >= 3 ? list : data.products.filter((p) => p.image)).slice(0, 8);
  const box = $('#dishes');
  box.hidden = !picks.length;
  box.innerHTML = picks.map((p, i) => `
    <a class="feature" href="/menu#${esc(p.categoryId)}" style="--i:${i}">
      <div class="media"><img src="${esc(sized(p.image, 640))}" srcset="${esc(sized(p.image, 640))} 640w, ${esc(sized(p.image, 1080))} 1080w" sizes="(min-width: 720px) 30vw, 72vw" alt="" loading="lazy" decoding="async"></div>
      <div class="ftext"><h3>${esc(tr(p.name))}</h3><span class="price">${money(p.price)}<small>${esc(data.settings.currency || '₾')}</small></span></div>
    </a>`).join('');
  $$('img', box).forEach((img) => {
    if (img.complete && img.naturalWidth) img.classList.add('loaded');
    else img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
  });
  observe($$('.feature', box));
}

function renderFooter(ph) {
  const s = data.settings;
  const links = [
    s.mapUrl && `<a class="pill-link" href="${esc(s.mapUrl)}" target="_blank" rel="noopener">${icons.pin}${t('directions')}</a>`,
    s.phone && `<a class="pill-link" href="tel:${esc(ph.tel)}">${icons.phone}${esc(ph.display)}</a>`,
    `<a class="pill-link" href="/menu">${icons.menu}${t('menu')}</a>`,
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

// ---------- motion ----------
let io;
function observe(els) {
  if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach((el) => el.classList.add('in')); return; }
  io ??= new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -10% 0px' });
  els.forEach((el) => io.observe(el));
}

function bind() {
  picker = mountPicker($('#langPick'), () => lang, (code) => {
    lang = code;
    saveLang(code);
    const update = () => { render(); picker.sync(); };
    if (document.startViewTransition && !reduceMotion) document.startViewTransition(update);
    else update();
  });

  const topbar = $('#topbar');
  const toTop = $('#toTop');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      topbar.classList.toggle('solid', scrollY > 24);
      toTop.classList.toggle('show', scrollY > innerHeight * 1.5);
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

  // in-page links land below the fixed top bar
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = id === 'top' ? document.body : document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const y = id === 'top' ? 0 : target.getBoundingClientRect().top + scrollY - topbar.offsetHeight + 1;
    scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  // gallery: thin line under the swipeable row shows how far you've scrolled
  const row = $('#galleryRow');
  const bar = $('#galleryBar');
  const progress = () => {
    const max = row.scrollWidth - row.clientWidth;
    bar.style.width = `${max > 0 ? 25 + (row.scrollLeft / max) * 75 : 100}%`;
  };
  row.addEventListener('scroll', progress, { passive: true });
  progress();

  setInterval(renderStatus, 60_000);
}

// ---------- boot ----------
render();
bind();
observe($$('.reveal'));
try {
  data = await (await fetch('/api/menu')).json();
  render();
} catch { /* the page still works without live data */ }
