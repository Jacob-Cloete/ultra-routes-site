/* ==========================================================================
   Route catalogue.

   To add a race: drop its .gpx file into /gpx and add an entry below.
   Distance, elevation gain and high/low points are computed from the GPX,
   so nothing else needs to change.

     id      – used in the URL (fast.jacobcloete.pro/#utmb)
     color   – route line + accent colour (pick something that reads on snow)
     center  – rough [lng, lat], only used before the GPX has loaded
     view    – camera bearing/pitch for the overview of the whole route
   ========================================================================== */

window.ROUTES = [
  {
    id: 'utmb',
    name: 'UTMB',
    fullName: 'UTMB Mont-Blanc',
    tab: 'Chamonix',
    place: 'Chamonix, France — through Italy and Switzerland',
    gpx: 'gpx/utmb.gpx',
    color: '#ff5a36',
    center: [6.92, 45.88],
    view: { bearing: -20, pitch: 58 },
    blurb: 'A full loop of the Mont Blanc massif, starting and finishing in Chamonix and crossing three countries.',
    source: { label: 'montblanc.utmb.world', url: 'https://montblanc.utmb.world/races/UTMB' },
    edition: '2026 course'
  },
  {
    id: 'eiger-e250',
    name: 'Eiger E250',
    fullName: 'Eiger Ultra Trail E250',
    tab: 'Grindelwald',
    place: 'Grindelwald, Switzerland',
    gpx: 'gpx/eiger-e250.gpx',
    color: '#ffb300',
    center: [8.0, 46.5],
    view: { bearing: 0, pitch: 55 },
    blurb: 'The UNESCO Trail: a giant loop from Grindelwald around the Jungfrau-Aletsch region via Kandersteg, Belalp, Oberwald and Guttannen.',
    source: { label: 'eiger.utmb.world', url: 'https://eiger.utmb.world/races/E250' },
    edition: '2026 course'
  },
  {
    id: 'utct',
    name: 'UTCT 100 Miler',
    fullName: 'Ultra-trail Cape Town 100 Miler',
    tab: 'Cape Town',
    place: 'Cape Town, South Africa',
    gpx: 'gpx/utct-100-miler.gpx',
    color: '#19e3c2',
    center: [18.42, -34.08],
    view: { bearing: 165, pitch: 58 },
    blurb: 'From the city bowl over Table Mountain and down the Cape Peninsula — Silvermine, Kalk Bay, Kommetjie, Simon’s Town — and back.',
    source: { label: 'ultratrailcapetown.com', url: 'https://www.ultratrailcapetown.com/100miles' },
    edition: '2026 course'
  },
  {
    id: 'tor-des-geants',
    name: 'Tor des Géants',
    fullName: 'TOR330 – Tor des Géants',
    tab: 'Courmayeur',
    place: 'Courmayeur, Aosta Valley, Italy',
    gpx: 'gpx/tor-des-geants.gpx',
    color: '#ff5fa8',
    center: [7.4, 45.72],
    view: { bearing: 0, pitch: 55 },
    blurb: 'A 330 km loop of the entire Aosta Valley from Courmayeur, following the Alte Vie 2 and 1 beneath Gran Paradiso, Monte Rosa, the Matterhorn and Mont Blanc.',
    source: { label: 'torxtrail.com', url: 'https://torxtrail.com/tor330-tor-des-geants/' },
    edition: '2026 course'
  },
  {
    id: 'transgrancanaria',
    name: 'Transgrancanaria',
    fullName: 'Transgrancanaria Classic',
    tab: 'Gran Canaria',
    place: 'Las Palmas to Maspalomas, Gran Canaria, Spain',
    gpx: 'gpx/transgrancanaria-classic.gpx',
    color: '#4dc3ff',
    center: [-15.58, 27.96],
    view: { bearing: -25, pitch: 55 },
    blurb: 'Across Gran Canaria from north to south: from the beach at Las Palmas over the volcanic summits at the centre of the island and down to the dunes of Maspalomas.',
    source: { label: 'transgrancanaria.net', url: 'https://transgrancanaria.net/en/classic-126km/' },
    edition: '2026 course'
  }
];
