#!/usr/bin/env python3
"""
Regenerates js/world-data.js, js/highlight-data.js, and js/region-data.js
from public-domain boundary datasets. Run this only if you want to change
the simplification tolerance, add/remove highlighted countries or outlined
states/provinces, or refresh the source data — the generated files are
already committed, so this script isn't part of the site's runtime or build.

Usage:
    python scripts/generate-map-data.py

Source data:
  - World country outlines: johan/world.geo.json (MIT)
  - US state outlines: PublicaMundi/MappingAPI (US Census-derived, public domain)
Both fetched fresh each run from GitHub — no extra dependency beyond the
standard library.
"""
import json
import math
import os
import urllib.request

WORLD_SOURCE_URL = "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json"
US_STATES_SOURCE_URL = "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json"
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORLD_OUT = os.path.join(REPO_ROOT, "js", "world-data.js")
HIGHLIGHT_OUT = os.path.join(REPO_ROOT, "js", "highlight-data.js")
REGION_OUT = os.path.join(REPO_ROOT, "js", "region-data.js")

# Countries to break out into js/highlight-data.js (brighter outline + a
# soft pulsing glow over the centroid), with a short key used by
# hero-scene.js. Add an entry here (matching the "name" property in the
# source GeoJSON) and re-run this script to highlight another country.
HIGHLIGHT_TARGETS = {
    "United States of America": "usa",
    "Saudi Arabia": "saudi",
}

# US states/provinces to break out into js/region-data.js — outline only,
# no glow (they nest inside an already-highlighted country, so a second
# glow layered on top would just be visual noise). Add an entry here
# (matching the "name" property in the US states GeoJSON) to outline
# another state.
REGION_TARGETS = {
    "Colorado": "colorado",
}

WORLD_TOLERANCE = 0.35   # degrees — coarse, sized for a small decorative globe
HIGHLIGHT_TOLERANCE = 0.12  # finer, since it's only a couple of countries
REGION_TOLERANCE = 0.05  # finer still — a single state, mostly straight borders
WORLD_MIN_AREA = 0.4     # skip tiny islands/specks below this bbox-area (sq degrees)
HIGHLIGHT_MIN_AREA = 0.5


def dist_point_to_segment(p, a, b):
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0, min(1, t))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy)


def douglas_peucker(points, tolerance):
    if len(points) < 3:
        return points
    dmax, index = 0, 0
    for i in range(1, len(points) - 1):
        d = dist_point_to_segment(points[i], points[0], points[-1])
        if d > dmax:
            index, dmax = i, d
    if dmax > tolerance:
        left = douglas_peucker(points[: index + 1], tolerance)
        right = douglas_peucker(points[index:], tolerance)
        return left[:-1] + right
    return [points[0], points[-1]]


def ring_bbox_area(ring):
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return (max(lons) - min(lons)) * (max(lats) - min(lats))


def simplify_ring(exterior, tolerance):
    simplified = douglas_peucker([tuple(pt) for pt in exterior], tolerance)
    if len(simplified) < 3:
        return None
    flat = []
    for lon, lat in simplified:
        flat.append(round(lon, 2))
        flat.append(round(lat, 2))
    return flat


def js_rings_array(rings, indent=""):
    lines = [f"{indent}[" + ",".join(str(v) for v in ring) + "]," for ring in rings]
    return "\n".join(lines)


def main():
    print(f"Fetching {WORLD_SOURCE_URL} ...")
    with urllib.request.urlopen(WORLD_SOURCE_URL) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    world_rings = []
    highlight_rings = {key: [] for key in HIGHLIGHT_TARGETS.values()}
    highlight_centroids = {}

    for feature in data["features"]:
        name = feature.get("properties", {}).get("name")
        geom = feature.get("geometry")
        if not geom:
            continue
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]

        for poly in polys:
            exterior = poly[0]  # holes skipped — irrelevant at this simplification level
            if ring_bbox_area(exterior) < WORLD_MIN_AREA and len(exterior) < 30:
                continue
            flat = simplify_ring(exterior, WORLD_TOLERANCE)
            if flat:
                world_rings.append(flat)

        if name in HIGHLIGHT_TARGETS:
            key = HIGHLIGHT_TARGETS[name]
            for poly in polys:
                exterior = poly[0]
                if ring_bbox_area(exterior) < HIGHLIGHT_MIN_AREA and len(exterior) < 20:
                    continue
                flat = simplify_ring(exterior, HIGHLIGHT_TOLERANCE)
                if flat:
                    highlight_rings[key].append(flat)
            largest = max(polys, key=lambda p: len(p[0]))[0]
            clon = sum(p[0] for p in largest) / len(largest)
            clat = sum(p[1] for p in largest) / len(largest)
            highlight_centroids[key] = (round(clon, 2), round(clat, 2))

    print(f"world rings: {len(world_rings)}  points: {sum(len(r)//2 for r in world_rings)}")
    for key, rings in highlight_rings.items():
        print(f"highlight[{key}] rings: {len(rings)}  points: {sum(len(r)//2 for r in rings)}")

    print(f"Fetching {US_STATES_SOURCE_URL} ...")
    with urllib.request.urlopen(US_STATES_SOURCE_URL) as resp:
        states_data = json.loads(resp.read().decode("utf-8"))

    region_rings = {key: [] for key in REGION_TARGETS.values()}
    for feature in states_data["features"]:
        name = feature.get("properties", {}).get("name")
        if name not in REGION_TARGETS:
            continue
        key = REGION_TARGETS[name]
        geom = feature["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        for poly in polys:
            exterior = poly[0]
            flat = simplify_ring(exterior, REGION_TOLERANCE)
            if flat:
                region_rings[key].append(flat)

    for key, rings in region_rings.items():
        print(f"region[{key}] rings: {len(rings)}  points: {sum(len(r)//2 for r in rings)}")

    world_js = (
        "/* Simplified world-country border outlines used by hero-scene.js to draw\n"
        "   the globe. [lon,lat,lon,lat,...] per ring — one array per country ring.\n"
        "   Derived from the johan/world.geo.json dataset (MIT license), simplified\n"
        "   with Douglas-Peucker at a coarse tolerance sized for a small decorative\n"
        "   globe rather than a detailed map. Regenerate with\n"
        "   scripts/generate-map-data.py. */\n"
        "export const WORLD_RINGS = [\n"
        + js_rings_array(world_rings)
        + "\n];\n"
    )
    with open(WORLD_OUT, "w", encoding="utf-8") as f:
        f.write(world_js)

    highlight_js = (
        "/* Highlighted-country border outlines and their approximate centroids,\n"
        "   used by hero-scene.js to draw a brighter outline + soft glow over\n"
        "   specific countries. Same source as world-data.js, finer tolerance\n"
        "   since it's only a couple of countries. To highlight a different or\n"
        "   additional country, add it to HIGHLIGHT_TARGETS in\n"
        "   scripts/generate-map-data.py and re-run that script. */\n"
        "export const HIGHLIGHT_RINGS = {\n"
    )
    for key, rings in highlight_rings.items():
        highlight_js += f"  {key}: [\n{js_rings_array(rings, '    ')}\n  ],\n"
    highlight_js += "};\n"
    highlight_js += "export const HIGHLIGHT_CENTROIDS = {\n"
    for key, (clon, clat) in highlight_centroids.items():
        highlight_js += f"  {key}: [{clon}, {clat}],\n"
    highlight_js += "};\n"
    with open(HIGHLIGHT_OUT, "w", encoding="utf-8") as f:
        f.write(highlight_js)

    region_js = (
        "/* Outline-only region borders (US states/provinces) — brighter than\n"
        "   the world borders, but no glow, since these nest inside a country\n"
        "   that's often already highlighted. Source: US Census-derived state\n"
        "   boundaries via PublicaMundi/MappingAPI (public domain). To outline\n"
        "   another state/province, add it to REGION_TARGETS in\n"
        "   scripts/generate-map-data.py and re-run that script. */\n"
        "export const REGION_RINGS = {\n"
    )
    for key, rings in region_rings.items():
        region_js += f"  {key}: [\n{js_rings_array(rings, '    ')}\n  ],\n"
    region_js += "};\n"
    with open(REGION_OUT, "w", encoding="utf-8") as f:
        f.write(region_js)

    print(f"wrote {WORLD_OUT} ({os.path.getsize(WORLD_OUT)} bytes)")
    print(f"wrote {HIGHLIGHT_OUT} ({os.path.getsize(HIGHLIGHT_OUT)} bytes)")
    print(f"wrote {REGION_OUT} ({os.path.getsize(REGION_OUT)} bytes)")


if __name__ == "__main__":
    main()
