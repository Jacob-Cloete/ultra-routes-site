"""Build original, hand-drawn landscape concepts for visual demonstration.

These are synthetic curves, not routes on a verified trail network. They are
not derived from race GPX files, OpenStreetMap, or a routing provider. Never use
them for navigation or advertise them as bookable/accessible itineraries.
Distances are horizontal great-circle distances along the displayed line.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONCEPTS = {
    "alps": {
        "name": "Alpine loop", "target": 50.2, "bearing": -24,
        "altitude": 2300,
        "anchors": [
            [6.866,45.924], [6.849,45.913], [6.819,45.909],
            [6.800,45.925], [6.793,45.948], [6.806,45.969],
            [6.829,45.979], [6.844,46.001], [6.870,46.009],
            [6.890,45.992], [6.894,45.970], [6.881,45.959],
            [6.904,45.944], [6.897,45.928], [6.878,45.938],
            [6.866,45.924]
        ]
    },
    "madeira": {
        "name": "Madeira traverse", "target": 49.6, "bearing": -20,
        "altitude": 1600,
        "anchors": [
            [-17.055,32.745], [-17.036,32.760], [-17.011,32.755],
            [-16.997,32.768], [-16.979,32.756], [-16.962,32.765],
            [-16.947,32.752], [-16.935,32.766], [-16.916,32.754],
            [-16.901,32.743], [-16.910,32.729], [-16.934,32.720],
            [-16.952,32.704], [-16.938,32.691]
        ]
    },
    "cape": {
        "name": "Cape mountain loop", "target": 51.1, "bearing": 160,
        "altitude": 1000,
        "anchors": [
            [18.399,-33.951], [18.416,-33.949], [18.435,-33.957],
            [18.444,-33.972], [18.426,-33.991], [18.427,-34.011],
            [18.432,-34.030], [18.413,-34.041], [18.429,-34.058],
            [18.423,-34.078], [18.402,-34.082], [18.395,-34.064],
            [18.404,-34.049], [18.389,-34.032], [18.392,-34.017], [18.377,-34.002],
            [18.377,-33.986], [18.394,-33.976], [18.389,-33.963],
            [18.399,-33.951]
        ]
    }
}

def distance(a, b):
    p, q = math.radians(a[1]), math.radians(b[1])
    dlat, dlon = q-p, math.radians(b[0]-a[0])
    h = math.sin(dlat/2)**2 + math.cos(p)*math.cos(q)*math.sin(dlon/2)**2
    return 6371.0088 * 2 * math.asin(min(1, math.sqrt(h)))

def shape(anchors):
    """Smooth the original sketch, keeping its start/end and broad geometry."""
    closed = anchors[0] == anchors[-1]
    base = anchors[:-1] if closed else anchors
    result = []
    count = len(base) if closed else len(base)-1
    for i in range(count):
        p0 = base[(i-1) % len(base)] if closed or i else base[0]
        p1 = base[i]
        p2 = base[(i+1) % len(base)]
        p3 = base[(i+2) % len(base)] if closed or i+2 < len(base) else base[-1]
        for j in range(45):
            t = j / 45
            result.append([
                .5*((2*p1[k])+(-p0[k]+p2[k])*t+
                    (2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+
                    (-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t)
                for k in (0,1)
            ])
    result.append(result[0] if closed else base[-1])
    return result

routes = {}
for key, spec in CONCEPTS.items():
    raw = shape(spec['anchors'])
    center = [sum(p[k] for p in raw)/len(raw) for k in (0,1)]
    # Scale the synthetic sketch only; this is not trail routing.
    length = sum(distance(a,b) for a,b in zip(raw,raw[1:]))
    factor = spec['target']/length
    pts = [[round(center[k]+(p[k]-center[k])*factor,6) for k in (0,1)] for p in raw]
    km = 0
    measured = []
    for i, p in enumerate(pts):
        if i:
            km += distance(pts[i-1],p)
        measured.append(p+[round(km,5)])
    assert 48 <= km <= 53, (key,km)
    assert all(b[2] >= a[2] for a,b in zip(measured,measured[1:]))
    bounds = [[min(p[k] for p in pts) for k in (0,1)],
              [max(p[k] for p in pts) for k in (0,1)]]
    routes[key] = {
        'name': spec['name'], 'distance': round(km,3),
        'illustrative': True, 'bounds': bounds,
        'center': [round(sum(p[k] for p in bounds)/2,6) for k in (0,1)],
        'bearing': spec['bearing'], 'fallbackAltitude': spec['altitude'],
        'points': measured
    }
    print(f'{key}: {km:.1f} km, {len(pts)} points; bounds {bounds}')

out = ROOT/'data/demo-routes.json'
out.write_text(json.dumps({
    'description': 'Original synthetic route illustrations, not mapped hiking trails. Not for navigation.',
    'distanceMethod': 'Horizontal great-circle distance along the drawn line.',
    'routes': routes
},separators=(',',':'))+'\n')
print(f'Wrote {out.name}: {out.stat().st_size} bytes')
