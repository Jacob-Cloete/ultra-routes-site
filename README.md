# FAST. — private adventures, personally filmed

Static landing page for https://fast.jacobcloete.pro/. Mountain footage, three original 3D route illustrations, and a minimal private-fastpacking offer.

## Develop locally

```sh
python3 -m http.server 8778 --bind 127.0.0.1
```

Open http://127.0.0.1:8778/. There is no build step or package installation.

- `index.html`: page content and asset versions.
- `css/adventure.css`: layout and responsive styling.
- `js/adventure.js`: video, terrain, demo route controls and contact behaviour.
- `js/config.js`: public enquiry email; never add secrets.
- `data/demo-routes.json`: original synthetic route concepts, approximately 50 km.
- `tools/build_demo_routes.py`: regenerates that data with standard Python.

Set `enquiryEmail` in `js/config.js` to the chosen contact address to enable an email-draft enquiry. Visitors send it from their own email app; the website does not store or submit personal details. Until an address is configured, the enquiry dialog clearly says enquiries are opening soon and hides the form.

## Routes and imagery

The three hand-drawn concepts measure 50.2 km (Alps), 49.6 km (Madeira) and 51.1 km (Cape Town). They are synthetic illustrations, not mapped hiking trails or navigable itineraries. They must retain their visible demo labels. No race GPX files are used by the landing page. Distances measure the drawn line horizontally; access, difficulty and suitability have not been checked.

MapLibre GL JS 5.24.0 loads on demand. Imagery: Esri World Imagery; terrain: Mapzen/AWS Terrarium, displayed with 1.15× relief. Attributions remain on-map.

Stock media illustrates the setting; it is not footage of a customer trip:

- [Taryn Elliott / Pexels](https://www.pexels.com/video/fly-by-drone-shot-over-the-mountains-4046338/): hero film and poster.
- [Kristian Bechthold / Pexels](https://www.pexels.com/video/cloudy-mountains-27607601/): terrain-loading poster.
- [Pexels licence](https://www.pexels.com/license/).

Media streams from the providers. Phone, data-saving and reduced-motion users choose when to load video; phones and data-saving users also opt into 3D.

## Release

Use a `codex/` branch, review locally, then merge to `main`. The existing Hostinger GitHub integration deploys the repository root to the subdomain. Check the actual domain after each release. See [DEVELOPMENT.md](DEVELOPMENT.md).

The original race viewer is preserved in Git history at `597e59e`; its old CSS, JavaScript and GPX files remain in the repository but are not loaded. Earlier local design boards in `preview/` are ignored by Git.
