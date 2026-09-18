# fast.jacobcloete.pro — ultra routes in 3D

Static site: interactive 3D terrain maps of ultra-trail race routes, drawn from GPX files.

- **Map:** [MapLibre GL JS](https://maplibre.org) (loaded from CDN, no build step, no API keys)
- **Terrain:** Mapzen / AWS open terrain tiles · **Imagery:** Esri World Imagery · **Topo:** OpenTopoMap
- **Routes:** official organiser GPX files in `gpx/`, parsed in the browser

## Run locally

Browsers block `fetch()` from `file://`, so serve the folder:

    python3 -m http.server 8080

then open http://localhost:8080

## Add a route

1. Put the `.gpx` file in `gpx/`
2. Add an entry to `js/routes.js` (id, name, colour, gpx path, overview camera bearing)

Distance, climb, high/low points and the elevation profile are computed from the GPX.
Named `<wpt>` waypoints in the GPX are shown as labelled markers.

## Deploy

Push to GitHub `main`; Hostinger pulls the repo into the subdomain's `public_html` folder.
