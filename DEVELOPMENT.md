# FAST development loop

Repository: `Jacob-Cloete/ultra-routes-site`.
Live domain: `https://fast.jacobcloete.pro/`.

## Work locally

The repository root is now the editable site. The old `preview/` directory contains historical design drafts and is ignored; do not edit it for releases.

```sh
python3 -m http.server 8778 --bind 127.0.0.1
```

Open http://127.0.0.1:8778/. Edit `index.html`, `css/adventure.css`, `js/adventure.js` and `js/config.js` directly. No build command is required.

When changing CSS, JavaScript or config, update their version query strings in `index.html`. When changing route JSON, update the fetch version in the JS.

Regenerate the original demo geometry with:

```sh
python3 tools/build_demo_routes.py
```

The geometry is illustrative, not a route-planning engine. Keep its demo and not-for-navigation labels until verified hiking itineraries replace it.

## Check and release

1. Make changes on a `codex/` branch.
2. Check JavaScript syntax and load the local page in a browser.
3. Check the hero, route selection, fly/pause/overview controls and enquiry dialog. Check a phone layout, console errors and asset loading.
4. Push the branch and open a pull request against `main`.
5. Merge the approved release. Hostinger should pull the updated `main` branch.
6. Verify the updated page and assets on the actual live domain. If content is stale, check Hostinger deployment status and CDN caching before changing code.

`main` is the production branch. Avoid force-pushing. Revert the release commit if a rollback is needed. The original race viewer remains recoverable at `597e59eefd8489c69c5481677b4615379c537142`.

## Enquiries

Set the destination email in `js/config.js`. A configured enquiry creates a draft in the visitor's email app. It is sent only when they send that draft. There is no server-side form, CRM, analytics or stored enquiry data.

With an empty email setting, the live dialog says enquiries are opening soon and does not present a form that appears to send messages.

Do not put credentials, mailbox passwords or hosting keys into Git.
