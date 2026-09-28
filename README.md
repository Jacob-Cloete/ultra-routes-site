# FAST. — Two adventures a year

Small-group fastpacking calendar for https://fast.jacobcloete.pro/. Eight proposed departures in 2027–2030, four guest places per adventure, a 12-week training lead-in and a film of the trip.

## Source files

- `index.html`, `css/adventure.css`, `css/calendar.css`: minimal landing page and responsive calendar.
- `js/calendar.js`: year filters, world map selection, expandable trip details, optional 3D terrain and signup UI.
- `data/adventures.json`: proposed dates, training starts, distances, outline stages and primary route references. Edit the calendar here.
- `api/interest.php`, `api/storage.php`: PHP + PDO SQLite interest storage. No mail service or payment integration is required.
- `privacy.html`, `manage.html`, `js/manage.js`: data-use explanation and private withdrawal links.
- `tools/manage-interest.php`: private CLI administration. Never expose it as an HTTP endpoint.

## What the calendar means

Every departure is **proposed**. Months, trail-day counts and overnight stages are planning choices, not confirmed availability. Distances are approximate and sourced in each trip. No huts, permits, commercial permissions, guides, transfers or flights have been booked. Any final sale needs a confirmed itinerary, suitability review, delivery arrangements, price and terms.

Four is the intended guest capacity, in addition to Jacob. An interest signup does **not** use a guest place. There are no fabricated live availability counts. The CLI confirmation operation atomically enforces a maximum of four confirmed guests per trip; further people can remain interested or be marked waitlist.

The 3D views show real terrain at the destinations; no unverified demo line is presented as an actual hiking route. The previous synthetic routes and race viewer remain in Git history and are not loaded by the new page.

## Signups and privacy

The endpoint creates `fast-private/interests.sqlite` outside the public web root. It walks above Hostinger's `public_html` even when FAST is hosted in a subdirectory. Files use restrictive permissions. For other layouts, set `FAST_PRIVATE_DIR` to an absolute directory outside all web roots. PHP needs PDO SQLite and filesystem write permission there. The endpoint fails closed if storage is unavailable.

Records contain name, email, trip, time, consent version, expiry, status and a hash of a random withdrawal token. Signup email addresses are unverified. Duplicates keep the first record and do not issue another private token. No email is sent. The on-screen success message asks visitors to save their private manage link. Invalid input, cross-origin requests and repeated requests are rejected. A one-hour IP-derived hash is used for rate limiting.

A withdrawal removes the record. Remaining records expire four months after the first day of their departure month and are purged when the endpoint next runs. Review and handle these leads regularly; no notification email is configured.

On Hostinger SSH, from the deployed site directory:

```sh
php tools/manage-interest.php list
php tools/manage-interest.php list scotland-2027
php tools/manage-interest.php confirm 12
php tools/manage-interest.php waitlist 12
php tools/manage-interest.php delete 12
```

`list` emits CSV to the authenticated terminal only. IDs above are examples; inspect your list first. Confirmation is an internal status update, not an email, a payment or a contract. For unusual hosting layouts, set `FAST_DOCUMENT_ROOT` to the actual web document root so the CLI finds the same private directory as HTTP requests. Back up the private database separately from Git.

## Local development

Use PHP for the complete signup flow:

```sh
php -S 127.0.0.1:8778 -t .
```

A plain Python server can preview the design, but cannot accept signups. The UI reports an error instead of pretending success.

In this Mac workspace, PHP is also available through the temporary WordPress PHP-WASM test runtime. See `DEVELOPMENT.md`.

## Media and map data

Stock footage by [Taryn Elliott / Pexels](https://www.pexels.com/video/fly-by-drone-shot-over-the-mountains-4046338/) illustrates the setting; it is not customer-trip footage. The local world silhouette is derived from Natural Earth 50m land sampling originally generated for the user's MatricMap project. No MatricMap customer or grade data is used.

MapLibre GL JS 5.24.0, Esri satellite imagery and Mapzen/AWS terrain load only when a visitor requests a 3D preview. Phone, data-saving and reduced-motion users choose whether to play video.

## Publishing

Branch → review and tests → pull request → `main` → Hostinger automatic deployment. Verify the page and one disposable signup/withdrawal on the live domain. Never commit signup data, keys or hosting credentials.
