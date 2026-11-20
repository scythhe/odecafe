# Ode — digital menu

Bilingual (ქა / EN) menu for Ode cafe with an admin panel to manage products, categories and cafe details.

- **Menu** — `/`
- **Admin** — `/admin`

## Run

```bash
npm install
npm start
```

Open http://localhost:3000. The admin password defaults to `ode-admin` locally — set `ADMIN_PASSWORD` before deploying (see `.env.example`).

## How it works

- `server.js` — Express server: public menu API, admin API, image uploads (re-encoded to WebP with sharp).
- `public/` — the menu (`index.html`, `css/`, `js/`) and admin panel (`admin/`). Plain HTML/CSS/JS, no build step.
- `seed/` — the original menu (138 products, 19 categories) and photos, imported from the old menu.
- `data/` — the live menu (`db.json`) and uploaded photos. Created from `seed/` on first run. Not committed.

## Admin

- Add, edit, delete products — photo, EN/KA name and short note, price, category.
- **On menu** switch: off hides a product from guests (it stays in admin, switch it back on any time).
- **Signature** products appear in the highlight row at the top.
- Drag to reorder products and categories; hide categories without deleting them.
- Edit opening hours, contacts, address and cover photo.
- Built for phones first — the admin works fully from a phone.

## Notes

- Georgian has no capital letters. The server converts any Mtavruli (ᲐᲑᲒ…) to regular letters on save, and the menu never applies uppercase styling to Georgian.
- The menu grid loads small thumbnails (`/media/t/…`, generated on first request and cached in `data/thumbs`); full photos load only when a dish is opened.

## Deploying

Any Node 20+ host works. `data/` must live on **persistent storage** (e.g. a Render disk or Railway volume — point `DATA_DIR` at it), otherwise admin edits are lost on redeploy.

## Scripts

- `npm run reset` — restore the menu to the seed (removes all admin edits)
- `npm run import` — re-import menu and photos from the old kovzy menu into `seed/`
