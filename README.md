# Ode — website & menu

Bilingual (ქა / EN) website for Ode restaurant, with its menu and an admin panel to manage products, categories and cafe details.

- **Website** — `/`
- **Menu** — `/menu`
- **Admin** — `/admin`

## Run

```bash
npm install
npm start
```

Open http://localhost:3000. `npm start` reads `ADMIN_PASSWORD` and `SESSION_SECRET` from a local `.env` file (never committed — see `.env.example`); without one, the admin password falls back to `ode-admin` for local testing only. On Netlify the same values are set under Environment variables.

## How it works

- `lib/app.js` — the API (public menu, admin, uploads, backup), shared by both ways of running:
  - `server.js` — `npm start`: data on disk (`lib/storage-file.js`)
  - `netlify/functions/api.mjs` — on Netlify: data in Netlify Blobs (`lib/storage-blobs.js`)
- Photos are resized in the admin (in the browser) before upload: a 1600px photo plus 1080/640/360px copies.
- `public/` — plain HTML/CSS/JS, no build step:
  - website: `index.html`, `css/site.css`, `js/site.js` (texts in both languages live in `js/site.js`)
  - menu: `menu.html`, `css/app.css`, `js/app.js` (the website reuses `app.css` for the shared header and footer)
  - admin: `admin/`
  - photos: `img/` (logo, and the website photos as WebP in `img/site/`)
- The website reads hours, address, phone, map link and cover from the admin's Cafe tab, and shows the menu's signature dishes. Reservations call or open WhatsApp with the Cafe-tab phone number.
- `seed/` — the original menu (138 products, 19 categories) and photos, imported from the old menu.
- `data/` — the live menu (`db.json`) and uploaded photos. Created from `seed/` on first run. Not committed.

## Admin

- Add, edit, delete products — photo, EN/KA name and short note, price, category.
- **On menu** switch: off hides a product from guests (it stays in admin, switch it back on any time).
- **Signature** products appear in the highlight row at the top.
- Drag to reorder products and categories; hide categories without deleting them.
- Edit opening hours, contacts, address, popup and cover photo.
- **Backup** (Cafe tab): download the whole menu as a file, or restore one.
- Built for phones first — the admin works fully from a phone.

## Languages

English, Georgian, Russian, Spanish, Turkish, Arabic (right-to-left) and Chinese — picked from the globe button in the top bar; the choice is shared between the website and the menu. First-time visitors get their phone's language if it's one of these, otherwise Georgian.

- Website and menu texts live in `public/js/site.js` and `public/js/app.js`.
- Menu names in the extra languages come from `seed/translations.json` (`node scripts/apply-translations.mjs` fills any that are empty; it never overwrites). In the admin they're under **Other languages** in the product editor. Empty → English is shown.

## Notes

- Georgian has no capital letters. The server converts any Mtavruli (ᲐᲑᲒ…) to regular letters on save, and the menu never applies uppercase styling to Georgian.
- Photos come in several widths (`/media/w/<360|640|1080>/…`); each phone downloads the size that fits its screen.

## Deploying on Netlify

Netlify builds automatically on every push (`netlify.toml`, build: `npm run build:netlify`).

1. **Environment variables** (Netlify → Site configuration → Environment variables):
   - `ADMIN_PASSWORD` — required; the admin can't sign in without it
   - `SESSION_SECRET` — recommended; any long random string
2. **Branch deploys**: to test a branch (e.g. `odecafe-netlify`) before it goes live, enable branch deploys under Build & deploy → Branches and deploy contexts. It's served at `odecafe-netlify--<site>.netlify.app`.
3. **Data**: each branch has its own store, so testing never touches the live menu. The live site uses the store `ode-live`. A new store starts from `seed/menu.json`; to move data between them, use **Backup → Download** on one and **Restore** on the other.

## Deploying elsewhere

Any Node 20+ host works with `npm start`. `data/` must live on **persistent storage** (e.g. a Render disk or Railway volume — point `DATA_DIR` at it), otherwise admin edits are lost on redeploy.

## Scripts

- `npm run reset` — restore the menu to the seed (removes all admin edits)
- `npm run import` — re-import menu and photos from the old kovzy menu into `seed/`
