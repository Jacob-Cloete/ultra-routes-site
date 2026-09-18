/* ==========================================================================
   fast. — 3D route viewer
   MapLibre GL + open terrain tiles, GPX parsed in the browser.
   ========================================================================== */

(() => {
  'use strict';

  const ROUTES = window.ROUTES || [];
  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const fmt = (n, d = 0) => {
    const r = Number(n.toFixed(d));
    return (r === 0 ? 0 : r).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }); // no "-0"
  };

  const GAIN_THRESHOLD_M = 3;   // ignore elevation wiggles smaller than this when summing climb
  const FLY_DURATION_S = 200;   // full-route fly-through at 1× speed
  const FLY_SPEEDS = [0.5, 1, 2, 4];

  const state = {
    route: null,          // entry from ROUTES
    data: null,           // parsed track for the active route
    cache: new Map(),     // id -> Promise<track>
    cursorD: null,        // km along route currently highlighted
    markers: [],
    firstFit: true,
    fly: { active: false, token: 0, d: 0, speedIdx: 1, range: 5.5, pitch: 70, bearing: 0, lng: 0, lat: 0, ele: 0, last: 0 }
  };

  /* ------------------------------------------------------------------------
     Geometry helpers
     ------------------------------------------------------------------------ */

  const R_EARTH_KM = 6371.0088;
  const rad = (deg) => deg * Math.PI / 180;

  function haversineKm(lng1, lat1, lng2, lat2) {
    const p1 = rad(lat1), p2 = rad(lat2);
    const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    return 2 * R_EARTH_KM * Math.asin(Math.sqrt(h));
  }

  function bearingDeg(lng1, lat1, lng2, lat2) {
    const p1 = rad(lat1), p2 = rad(lat2), dl = rad(lng2 - lng1);
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  const angleDiff = (to, from) => ((to - from + 540) % 360) - 180;

  /* point reached by travelling `km` from [lng, lat] on the given bearing */
  function destination(lng, lat, bearing, km) {
    const d = km / R_EARTH_KM, b = rad(bearing), p1 = rad(lat);
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
    const l2 = rad(lng) + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return [l2 * 180 / Math.PI, p2 * 180 / Math.PI];
  }

  /* ------------------------------------------------------------------------
     GPX → track
     ------------------------------------------------------------------------ */

  function parseGpx(text) {
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    if (xml.getElementsByTagName('parsererror').length) throw new Error('GPX file could not be parsed');

    let nodes = xml.getElementsByTagName('trkpt');
    if (!nodes.length) nodes = xml.getElementsByTagName('rtept');

    const lng = [], lat = [], ele = [];
    let lastEle = NaN;
    for (const node of nodes) {
      const la = parseFloat(node.getAttribute('lat'));
      const lo = parseFloat(node.getAttribute('lon'));
      if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
      const eleNode = node.getElementsByTagName('ele')[0];
      let e = eleNode ? parseFloat(eleNode.textContent) : NaN;
      if (!Number.isFinite(e)) e = lastEle;
      lastEle = e;
      lng.push(lo); lat.push(la); ele.push(e);
    }
    if (lng.length < 2) throw new Error('GPX file contains no track');

    // back-fill any leading points that had no elevation
    const firstValid = ele.find(Number.isFinite);
    for (let i = 0; i < ele.length && !Number.isFinite(ele[i]); i++) ele[i] = firstValid ?? 0;

    const n = lng.length;
    const dist = new Float64Array(n);
    let minEle = Infinity, maxEle = -Infinity, maxIdx = 0;
    let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
    for (let i = 0; i < n; i++) {
      if (i) dist[i] = dist[i - 1] + haversineKm(lng[i - 1], lat[i - 1], lng[i], lat[i]);
      if (ele[i] < minEle) minEle = ele[i];
      if (ele[i] > maxEle) { maxEle = ele[i]; maxIdx = i; }
      west = Math.min(west, lng[i]); east = Math.max(east, lng[i]);
      south = Math.min(south, lat[i]); north = Math.max(north, lat[i]);
    }

    let gain = 0, loss = 0, ref = ele[0];
    for (let i = 1; i < n; i++) {
      const diff = ele[i] - ref;
      if (diff >= GAIN_THRESHOLD_M) { gain += diff; ref = ele[i]; }
      else if (diff <= -GAIN_THRESHOLD_M) { loss -= diff; ref = ele[i]; }
    }

    const track = {
      n, lng, lat, ele, dist,
      total: dist[n - 1],
      gain, loss, minEle, maxEle, maxIdx,
      bounds: [[west, south], [east, north]],
      cosLat: Math.cos(rad((south + north) / 2)),
      waypoints: []
    };

    for (const w of xml.getElementsByTagName('wpt')) {
      const name = (w.getElementsByTagName('name')[0]?.textContent || '').trim();
      const la = parseFloat(w.getAttribute('lat')), lo = parseFloat(w.getAttribute('lon'));
      if (!name || !Number.isFinite(la) || !Number.isFinite(lo)) continue;
      track.waypoints.push({ name, lng: lo, lat: la });
    }
    return track;
  }

  function loadRoute(route) {
    if (!state.cache.has(route.id)) {
      const p = fetch(route.gpx)
        .then((res) => { if (!res.ok) throw new Error(`Could not load ${route.gpx} (${res.status})`); return res.text(); })
        .then(parseGpx);
      p.catch(() => state.cache.delete(route.id));
      state.cache.set(route.id, p);
    }
    return state.cache.get(route.id);
  }

  /* index i such that dist[i] <= d <= dist[i+1] */
  function indexAt(t, d) {
    let lo = 0, hi = t.n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (t.dist[mid] <= d) lo = mid; else hi = mid;
    }
    return lo;
  }

  function pointAt(t, d) {
    d = clamp(d, 0, t.total);
    const i = indexAt(t, d), j = Math.min(i + 1, t.n - 1);
    const span = t.dist[j] - t.dist[i];
    const f = span > 0 ? (d - t.dist[i]) / span : 0;
    return {
      lng: t.lng[i] + (t.lng[j] - t.lng[i]) * f,
      lat: t.lat[i] + (t.lat[j] - t.lat[i]) * f,
      ele: t.ele[i] + (t.ele[j] - t.ele[i]) * f
    };
  }

  function gradeAt(t, d) {
    const w = 0.1; // km either side
    const a = Math.max(0, d - w), b = Math.min(t.total, d + w);
    if (b <= a) return 0;
    return (pointAt(t, b).ele - pointAt(t, a).ele) / ((b - a) * 1000) * 100;
  }

  function nearestDistance(t, lngLat) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < t.n; i++) {
      const dx = (t.lng[i] - lngLat.lng) * t.cosLat, dy = t.lat[i] - lngLat.lat;
      const dd = dx * dx + dy * dy;
      if (dd < bestD) { bestD = dd; best = i; }
    }
    return t.dist[best];
  }

  /* ------------------------------------------------------------------------
     Map
     ------------------------------------------------------------------------ */

  // The open terrain tiles include sea-floor depth, which makes the ocean surface plunge
  // into trenches offshore (very visible around the Cape Peninsula). This protocol loads
  // each tile and flattens everything below sea level to 0 m before MapLibre sees it.
  // Terrarium encoding: height = R*256 + G + B/256 - 32768, so "below 0" is simply R < 128.
  const canClamp = typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function';
  if (canClamp) {
    maplibregl.addProtocol('sealevel', async (params, abortController) => {
      const res = await fetch(params.url.replace('sealevel://', 'https://'), { signal: abortController.signal });
      if (!res.ok) throw new Error(`Terrain tile failed: ${res.status}`);
      const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      const cv = new OffscreenCanvas(bmp.width, bmp.height);
      const c2 = cv.getContext('2d', { willReadFrequently: true });
      c2.drawImage(bmp, 0, 0);
      const img = c2.getImageData(0, 0, bmp.width, bmp.height), px = img.data;
      let changed = false;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] < 128) { px[i] = 128; px[i + 1] = 0; px[i + 2] = 0; changed = true; }
      }
      if (changed) c2.putImageData(img, 0, 0);
      const out = await cv.convertToBlob({ type: 'image/png' });
      return { data: await out.arrayBuffer() };
    });
  }
  const TERRAIN_TILES = [`${canClamp ? 'sealevel' : 'https'}://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`];
  const TERRAIN_ATTR = 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen / AWS Terrain Tiles</a>';

  const initial = ROUTES.find((r) => r.id === location.hash.slice(1)) || ROUTES[0];

  const map = new maplibregl.Map({
    container: 'map',
    center: initial.center,
    zoom: 9.5,
    pitch: initial.view?.pitch ?? 58,
    bearing: initial.view?.bearing ?? 0,
    minZoom: 3,
    maxZoom: 17.5,
    maxPitch: 80,
    attributionControl: { compact: true },
    style: {
      version: 8,
      sources: {
        satellite: {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          maxzoom: 17,
          attribution: 'Imagery © <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics'
        },
        topo: {
          type: 'raster',
          tiles: ['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
          tileSize: 256,
          maxzoom: 17,
          attribution: 'Map © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA), © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
        },
        // separate sources for terrain mesh and hillshading, as MapLibre recommends
        terrain: { type: 'raster-dem', tiles: TERRAIN_TILES, encoding: 'terrarium', tileSize: 256, maxzoom: 13, attribution: TERRAIN_ATTR },
        hillshade: { type: 'raster-dem', tiles: TERRAIN_TILES, encoding: 'terrarium', tileSize: 256, maxzoom: 13 }
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#1a2230' } },
        { id: 'satellite', type: 'raster', source: 'satellite', paint: { 'raster-saturation': -0.1, 'raster-contrast': 0.05 } },
        { id: 'topo', type: 'raster', source: 'topo', layout: { visibility: 'none' } },
        {
          id: 'hillshade', type: 'hillshade', source: 'hillshade',
          paint: { 'hillshade-exaggeration': 0.28, 'hillshade-shadow-color': '#0b1320', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#0b1320' }
        }
      ],
      terrain: { source: 'terrain', exaggeration: 1.3 },
      sky: {
        'sky-color': '#7fb2ea',
        'horizon-color': '#e6eef7',
        'fog-color': '#dfe8f2',
        'sky-horizon-blend': 0.7,
        'horizon-fog-blend': 0.6,
        'fog-ground-blend': 0.55,
        'atmosphere-blend': 0.5
      }
    }
  });

  window.fastMap = map; // handy for debugging from the console

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

  const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'tip', offset: 14, maxWidth: 'none' });

  const emptyFC = { type: 'FeatureCollection', features: [] };

  function addRouteLayers() {
    map.addSource('route', { type: 'geojson', data: emptyFC, tolerance: 0.25 });
    map.addSource('km', { type: 'geojson', data: emptyFC });
    map.addSource('cursor', { type: 'geojson', data: emptyFC });

    map.addLayer({
      id: 'route-casing', type: 'line', source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#0a0c10', 'line-opacity': 0.75, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4.5, 13, 8, 16, 11] }
    });
    map.addLayer({
      id: 'route-line', type: 'line', source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': initial.color, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2.4, 13, 4.5, 16, 6.5] }
    });
    map.addLayer({ // wide invisible line so the route is easy to hover
      id: 'route-hit', type: 'line', source: 'route',
      paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': 26 }
    });
    map.addLayer({
      id: 'km-dots', type: 'circle', source: 'km', minzoom: 9.5,
      paint: { 'circle-radius': 3.2, 'circle-color': '#fff', 'circle-stroke-color': '#0a0c10', 'circle-stroke-width': 1.5 }
    });
    map.addLayer({
      id: 'cursor-halo', type: 'circle', source: 'cursor',
      paint: { 'circle-radius': 13, 'circle-color': '#fff', 'circle-opacity': 0.25 }
    });
    map.addLayer({
      id: 'cursor-dot', type: 'circle', source: 'cursor',
      paint: { 'circle-radius': 6.5, 'circle-color': '#fff', 'circle-stroke-color': '#0a0c10', 'circle-stroke-width': 2.5 }
    });
  }

  function makeMarker(label, lng, lat, cls = '') {
    const el = document.createElement('div');
    el.className = `mk ${cls}`;
    const l = document.createElement('span'); l.className = 'mk-label'; l.textContent = label;
    const d = document.createElement('span'); d.className = 'mk-dot';
    el.append(l, d);
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, 6] }).setLngLat([lng, lat]).addTo(map);
    state.markers.push(marker);
  }

  function showTrackOnMap(route, t) {
    const coords = new Array(t.n);
    for (let i = 0; i < t.n; i++) coords[i] = [t.lng[i], t.lat[i]];
    map.getSource('route').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
    map.setPaintProperty('route-line', 'line-color', route.color);

    const kmFeatures = [];
    for (let km = 10; km < t.total - 2; km += 10) {
      const p = pointAt(t, km);
      kmFeatures.push({ type: 'Feature', properties: { km }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } });
    }
    map.getSource('km').setData({ type: 'FeatureCollection', features: kmFeatures });

    state.markers.forEach((m) => m.remove());
    state.markers = [];
    for (const w of t.waypoints) makeMarker(w.name, w.lng, w.lat);
    const last = t.n - 1;
    if (haversineKm(t.lng[0], t.lat[0], t.lng[last], t.lat[last]) < 0.5) {
      makeMarker('Start · Finish', t.lng[0], t.lat[0], 'mk-start');
    } else {
      makeMarker('Finish', t.lng[last], t.lat[last], 'mk-start');
      makeMarker('Start', t.lng[0], t.lat[0], 'mk-start');
    }
  }

  function fitPadding() {
    const stage = document.querySelector('.stage').getBoundingClientRect();
    const panel = $('panel').getBoundingClientRect();
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    const pad = { top: 50, right: 50, bottom: 40, left: 50 };
    if (mobile) { pad.top = panel.height + 24; pad.left = pad.right = 24; pad.bottom = 24; }
    else pad.left = panel.right - stage.left + 40;
    // never let padding swallow the whole viewport
    if (pad.left + pad.right > stage.width * 0.8) { pad.left = pad.right = 20; }
    if (pad.top + pad.bottom > stage.height * 0.8) { pad.top = pad.bottom = 20; }
    return pad;
  }

  function fitRoute(animate = true) {
    const route = state.route, t = state.data;
    if (!route || !t) return;
    const c = map.getCenter();
    const far = haversineKm(c.lng, c.lat, (t.bounds[0][0] + t.bounds[1][0]) / 2, (t.bounds[0][1] + t.bounds[1][1]) / 2) > 800;
    // Fit the track (not just its bounding box) to the free area of the screen for the
    // chosen bearing. Done by hand because cameraForBounds mis-centres when bearing and
    // asymmetric padding are combined.
    const bearing = route.view?.bearing ?? 0;
    const th = rad(bearing), cos = Math.cos(th), sin = Math.sin(th);
    const WORLD = 512;
    const mx = (lng) => (lng + 180) / 360 * WORLD;
    const my = (lat) => (1 - Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2)) / Math.PI) / 2 * WORLD;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < t.n; i += 8) {
      const x = mx(t.lng[i]), y = my(t.lat[i]);
      const sx = x * cos + y * sin, sy = -x * sin + y * cos;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    const pad = fitPadding();
    const stage = map.getContainer().getBoundingClientRect();
    const availW = stage.width - pad.left - pad.right, availH = stage.height - pad.top - pad.bottom;
    const zoom = Math.log2(Math.min(availW / (x1 - x0), availH / (y1 - y0))) + (route.view?.zoomOffset ?? 0);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const wx = cx * cos - cy * sin, wy = cx * sin + cy * cos;
    const center = [wx / WORLD * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * wy / WORLD))) * 180 / Math.PI];

    const view = { center, zoom, bearing, pitch: route.view?.pitch ?? 58, padding: pad };
    if (animate && !far) map.flyTo({ ...view, duration: 2200, essential: true });
    else map.jumpTo(view);
  }

  /* ------------------------------------------------------------------------
     Cursor (shared between map hover, profile hover and fly-through)
     ------------------------------------------------------------------------ */

  function setCursor(d, { popup = true } = {}) {
    const t = state.data;
    if (!t) return;
    state.cursorD = d;
    if (d == null) {
      map.getSource('cursor')?.setData(emptyFC);
      tip.remove();
      $('readout').textContent = 'Hover the profile or the route · click to jump there';
      drawProfile();
      return;
    }
    const p = pointAt(t, d);
    map.getSource('cursor')?.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } });

    const g = gradeAt(t, d);
    const gCls = g > 1 ? 'up' : g < -1 ? 'down' : '';
    $('readout').innerHTML =
      `<b>${fmt(d, 1)} km</b> of ${fmt(t.total, 1)} · <b>${fmt(p.ele)} m</b> · <span class="${gCls}">${g > 0 ? '+' : ''}${fmt(g, 1)}%</span>`;

    if (popup) tip.setLngLat([p.lng, p.lat]).setHTML(`${fmt(d, 1)} km · ${fmt(p.ele)} m`).addTo(map);
    else tip.remove();
    drawProfile();
  }

  /* ------------------------------------------------------------------------
     Elevation profile (canvas)
     ------------------------------------------------------------------------ */

  const canvas = $('profile-canvas');
  const ctx = canvas.getContext('2d');
  const PAD = { l: 56, r: 10, t: 8, b: 20 };

  function niceStep(range, maxTicks) {
    const raw = range / Math.max(1, maxTicks);
    const mag = 10 ** Math.floor(Math.log10(raw));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= raw) return m * mag;
    return 10 * mag;
  }

  function drawProfile() {
    const t = state.data;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!t) return;

    const pw = w - PAD.l - PAD.r, ph = h - PAD.t - PAD.b;
    if (pw < 20 || ph < 20) return;
    const color = state.route.color;

    // resample the track to one elevation per pixel column (cached per width)
    const cols = Math.round(pw);
    if (!t.samples || t.samples.length !== cols + 1) {
      t.samples = new Float32Array(cols + 1);
      for (let x = 0; x <= cols; x++) t.samples[x] = pointAt(t, (x / cols) * t.total).ele;
    }

    const eleRange = Math.max(50, t.maxEle - t.minEle);
    const yStep = niceStep(eleRange, ph / 30);
    const yMin = t.minEle - eleRange * 0.12;
    const yMax = t.maxEle + eleRange * 0.1;
    const X = (d) => PAD.l + (d / t.total) * pw;
    const Y = (e) => PAD.t + ph - ((e - yMin) / (yMax - yMin)) * ph;

    // grid + axis labels
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.lineWidth = 1;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (let e = Math.ceil(yMin / yStep) * yStep; e <= yMax; e += yStep) {
      const y = Math.round(Y(e)) + 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(w - PAD.r, y); ctx.stroke();
      ctx.fillStyle = '#737d8c';
      ctx.fillText(`${fmt(e)} m`, PAD.l - 8, y);
    }
    const xStep = niceStep(t.total, pw / 80);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    for (let km = 0; km <= t.total; km += xStep) {
      const x = Math.round(X(km)) + 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + ph); ctx.stroke();
      ctx.fillStyle = '#737d8c';
      if (km === 0) { ctx.textAlign = 'left'; ctx.fillText('0 km', x, PAD.t + ph + 5); ctx.textAlign = 'center'; }
      else if (X(km) < w - PAD.r - 14) ctx.fillText(fmt(km), x, PAD.t + ph + 5);
    }

    // area
    const area = new Path2D();
    area.moveTo(PAD.l, PAD.t + ph);
    for (let x = 0; x <= cols; x++) area.lineTo(PAD.l + x, Y(t.samples[x]));
    area.lineTo(PAD.l + cols, PAD.t + ph);
    area.closePath();

    const line = new Path2D();
    for (let x = 0; x <= cols; x++) {
      if (x === 0) line.moveTo(PAD.l, Y(t.samples[0])); else line.lineTo(PAD.l + x, Y(t.samples[x]));
    }

    const grad = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + ph);
    grad.addColorStop(0, 'rgba(255,255,255,0.20)');
    grad.addColorStop(1, 'rgba(255,255,255,0.03)');
    ctx.fillStyle = grad;
    ctx.fill(area);

    // tint everything behind the cursor in the route colour
    const cd = state.cursorD;
    if (cd != null) {
      const cx = X(cd);
      ctx.save();
      ctx.beginPath(); ctx.rect(PAD.l, 0, cx - PAD.l, h); ctx.clip();
      const g2 = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + ph);
      g2.addColorStop(0, color + 'cc');
      g2.addColorStop(1, color + '22');
      ctx.fillStyle = g2;
      ctx.fill(area);
      ctx.restore();
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.stroke(line);

    // high point
    const hx = X(t.dist[t.maxIdx]), hy = Y(t.maxEle);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(hx, hy, 2.5, 0, Math.PI * 2); ctx.fill();

    if (cd != null) {
      const cx = Math.round(X(cd)) + 0.5, cy = Y(pointAt(t, cd).ele);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, PAD.t); ctx.lineTo(cx, PAD.t + ph); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#0a0c10';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  function profileDistance(ev) {
    const t = state.data;
    const rect = canvas.getBoundingClientRect();
    const pw = rect.width - PAD.l - PAD.r;
    return clamp((ev.clientX - rect.left - PAD.l) / pw, 0, 1) * t.total;
  }

  canvas.addEventListener('pointermove', (ev) => {
    if (!state.data || state.fly.active) return;
    setCursor(profileDistance(ev));
  });
  canvas.addEventListener('pointerleave', () => {
    if (!state.fly.active) setCursor(null);
  });
  canvas.addEventListener('click', (ev) => {
    const t = state.data;
    if (!t) return;
    const d = profileDistance(ev);
    state.fly.d = d;
    if (state.fly.active) { // seek while flying
      const p = pointAt(t, d);
      state.fly.lng = p.lng; state.fly.lat = p.lat; state.fly.ele = p.ele;
      return;
    }
    const p = pointAt(t, d);
    setCursor(d);
    map.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 12.8), duration: 1400, essential: true });
  });

  new ResizeObserver(() => drawProfile()).observe(canvas);

  /* ------------------------------------------------------------------------
     Fly-through
     ------------------------------------------------------------------------ */

  function updateFlyButton() {
    const f = state.fly, t = state.data;
    $('fly-ico').textContent = f.active ? '❚❚' : '▶';
    const resumable = !f.active && t && f.d > 0.5 && f.d < t.total - 0.05;
    $('fly-label').textContent = f.active ? 'Pause' : resumable ? `Resume at ${fmt(f.d)} km` : 'Fly the route';
    $('speed-btn').textContent = `${FLY_SPEEDS[f.speedIdx]}×`;
  }

  /* Chase camera: sits `range` km from the runner, behind and above, looking at them.
     Built from real camera/target positions so it stays correct over 3D terrain. */
  function chaseCamera() {
    const f = state.fly;
    const ex = map.getTerrain()?.exaggeration ?? 1;
    const targetEle = f.ele * ex;
    const back = f.range * Math.sin(rad(f.pitch)), up = f.range * Math.cos(rad(f.pitch));
    const cam = destination(f.lng, f.lat, f.bearing + 180, back);
    return map.calculateCameraOptionsFromTo(
      new maplibregl.LngLat(cam[0], cam[1]), targetEle + up * 1000,
      new maplibregl.LngLat(f.lng, f.lat), targetEle
    );
  }

  function stopFly() {
    const f = state.fly;
    if (!f.active) return;
    f.active = false;
    f.token++;
    map.stop();
    updateFlyButton();
  }

  function startFly() {
    const t = state.data, f = state.fly;
    if (!t || f.active) return;
    if (f.d >= t.total - 0.05) f.d = 0;
    f.active = true;
    const token = ++f.token;
    updateFlyButton();

    const p = pointAt(t, f.d), ahead = pointAt(t, Math.min(t.total, f.d + 2));
    f.lng = p.lng; f.lat = p.lat; f.ele = p.ele;
    f.bearing = bearingDeg(p.lng, p.lat, ahead.lng, ahead.lat);
    setCursor(f.d, { popup: false });

    map.flyTo({ ...chaseCamera(), duration: 2400, essential: true });
    map.once('moveend', () => {
      if (!f.active || f.token !== token) return;
      f.last = performance.now();
      requestAnimationFrame(function frame(now) {
        if (!f.active || f.token !== token) return;
        const dt = Math.min(0.05, (now - f.last) / 1000);
        f.last = now;

        f.d += (t.total / FLY_DURATION_S) * FLY_SPEEDS[f.speedIdx] * dt;
        const done = f.d >= t.total;
        if (done) f.d = t.total;

        const pos = pointAt(t, f.d);
        if (f.d < t.total - 0.3) {
          const look = pointAt(t, Math.min(t.total, f.d + 2));
          const target = bearingDeg(pos.lng, pos.lat, look.lng, look.lat);
          f.bearing = (f.bearing + angleDiff(target, f.bearing) * (1 - Math.exp(-dt * 0.9)) + 360) % 360;
        }
        const kc = 1 - Math.exp(-dt * 3.5);
        f.lng += (pos.lng - f.lng) * kc;
        f.lat += (pos.lat - f.lat) * kc;
        f.ele += (pos.ele - f.ele) * (1 - Math.exp(-dt * 1.2));

        map.jumpTo(chaseCamera());
        setCursor(f.d, { popup: false });

        if (done) { stopFly(); return; }
        requestAnimationFrame(frame);
      });
    });
  }

  $('fly-btn').addEventListener('click', () => (state.fly.active ? stopFly() : startFly()));
  $('speed-btn').addEventListener('click', () => {
    state.fly.speedIdx = (state.fly.speedIdx + 1) % FLY_SPEEDS.length;
    updateFlyButton();
  });
  $('reset-btn').addEventListener('click', () => {
    stopFly();
    state.fly.d = 0;
    setCursor(null);
    updateFlyButton();
    fitRoute(true);
  });

  // while flying: scroll moves the chase camera closer/further, grabbing the map pauses
  $('map').addEventListener('wheel', (ev) => {
    if (!state.fly.active) return;
    ev.preventDefault();
    ev.stopPropagation();
    state.fly.range = clamp(state.fly.range * Math.exp(ev.deltaY * 0.0015), 1.2, 16);
  }, { capture: true, passive: false });
  map.getCanvasContainer().addEventListener('pointerdown', () => stopFly());

  /* ------------------------------------------------------------------------
     Map hover
     ------------------------------------------------------------------------ */

  let hoverFrame = 0;
  function onRouteHover(ev) {
    if (state.fly.active || !state.data) return;
    map.getCanvas().style.cursor = 'pointer';
    if (hoverFrame) return;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0;
      if (state.data && !state.fly.active) setCursor(nearestDistance(state.data, ev.lngLat));
    });
  }

  /* ------------------------------------------------------------------------
     UI wiring
     ------------------------------------------------------------------------ */

  const tabs = $('route-tabs');
  for (const r of ROUTES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'route-tab';
    b.role = 'tab';
    b.dataset.route = r.id;
    b.style.setProperty('--tab-color', r.color);
    b.innerHTML = `<span class="tab-name"></span><span class="tab-sub"></span>`;
    b.querySelector('.tab-name').textContent = r.name;
    b.querySelector('.tab-sub').textContent = r.tab || '';
    b.addEventListener('click', () => selectRoute(r.id));
    tabs.append(b);
  }

  function setLoading(text, isError = false) {
    const el = $('loading');
    el.hidden = !text;
    el.classList.toggle('is-error', isError);
    $('loading-text').textContent = text || '';
  }

  function renderInfo(route, t) {
    $('route-name').textContent = route.fullName || route.name;
    $('route-place').textContent = route.place || '';
    $('route-blurb').textContent = route.blurb || '';
    $('route-edition').textContent = route.edition ? `${route.edition}.` : '';
    const src = $('route-source');
    src.textContent = route.source?.label || 'the organiser';
    src.href = route.source?.url || '#';
    const set = (id, v, unit) => { $(id).innerHTML = t ? `${v}<small>${unit}</small>` : '–'; };
    set('stat-dist', t && fmt(t.total, 1), 'km');
    set('stat-gain', t && fmt(t.gain), 'm+');
    set('stat-max', t && fmt(t.maxEle), 'm');
    set('stat-min', t && fmt(t.minEle), 'm');
  }

  let mapReady = false;
  let selectSeq = 0;

  async function selectRoute(id) {
    const route = ROUTES.find((r) => r.id === id) || ROUTES[0];
    if (state.route === route && state.data) { stopFly(); fitRoute(true); return; }
    const seq = ++selectSeq;

    stopFly();
    state.route = route;
    state.data = null;
    state.cursorD = null;
    state.fly.d = 0;
    tip.remove();

    document.documentElement.style.setProperty('--accent', route.color);
    for (const b of tabs.children) {
      const on = b.dataset.route === route.id;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on);
    }
    if (location.hash.slice(1) !== route.id) history.replaceState(null, '', `#${route.id}`);
    document.title = `${route.name} — fast. Ultra routes in 3D`;
    renderInfo(route, null);
    updateFlyButton();
    drawProfile();
    setLoading(`Loading ${route.name}…`);

    try {
      const t = await loadRoute(route);
      if (seq !== selectSeq) return; // user switched again meanwhile
      state.data = t;
      renderInfo(route, t);
      setLoading('');
      setCursor(null);
      if (mapReady) applyRouteToMap();
    } catch (err) {
      if (seq !== selectSeq) return;
      console.error(err);
      setLoading(location.protocol === 'file:'
        ? 'Open this site through a web server (see README) — browsers block GPX loading from file://'
        : `Could not load this route: ${err.message}`, true);
    }
  }

  function applyRouteToMap() {
    if (!state.data) return;
    showTrackOnMap(state.route, state.data);
    fitRoute(!state.firstFit);
    state.firstFit = false;
  }

  map.on('load', () => {
    addRouteLayers();
    map.on('mousemove', 'route-hit', onRouteHover);
    map.on('mouseleave', 'route-hit', () => {
      map.getCanvas().style.cursor = '';
      if (!state.fly.active) setCursor(null);
    });
    map.on('click', 'route-hit', (ev) => {
      if (!state.data) return;
      const d = nearestDistance(state.data, ev.lngLat);
      state.fly.d = d;
      setCursor(d);
      updateFlyButton();
    });
    // on phones start with the attribution collapsed behind its (i) button
    if (window.matchMedia('(max-width: 760px)').matches) {
      document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    }
    mapReady = true;
    applyRouteToMap();
  });

  document.querySelectorAll('[data-basemap]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const which = btn.dataset.basemap;
      document.querySelectorAll('[data-basemap]').forEach((b) => b.classList.toggle('is-active', b === btn));
      map.setLayoutProperty('satellite', 'visibility', which === 'satellite' ? 'visible' : 'none');
      map.setLayoutProperty('topo', 'visibility', which === 'topo' ? 'visible' : 'none');
      map.setLayoutProperty('hillshade', 'visibility', which === 'satellite' ? 'visible' : 'none'); // OpenTopoMap is already shaded
    });
  });

  $('relief').addEventListener('input', (ev) => {
    const v = parseFloat(ev.target.value);
    $('relief-val').textContent = `×${v.toFixed(1)}`;
    map.setTerrain({ source: 'terrain', exaggeration: v });
  });

  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (id && id !== state.route?.id && ROUTES.some((r) => r.id === id)) selectRoute(id);
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (/^(INPUT|BUTTON|A|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
    const n = parseInt(ev.key, 10);
    if (n >= 1 && n <= ROUTES.length) selectRoute(ROUTES[n - 1].id);
    else if (ev.key === ' ') { ev.preventDefault(); state.fly.active ? stopFly() : startFly(); }
  });

  selectRoute(initial.id);
})();
