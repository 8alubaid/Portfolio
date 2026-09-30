#!/usr/bin/env python3
"""
Generates js/avatar-data.js and img/avatar-pixelart.png from img/avatar-source.jpg
— the pixel-art portrait rendered as a real 3D voxel bust on the homepage hero
avatar (see js/avatar-scene.js). Run this only if you replace the source image
or want to change the voxel grid resolution; the generated files are already
committed, so this script isn't part of the site's runtime or build.

Usage:
    python scripts/generate-avatar-data.py

Requires Pillow (pip install pillow) — the only script in this repo with a
dependency beyond the standard library, since it's processing a raster image
rather than GeoJSON.
"""
import os
from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_IMAGE = os.path.join(REPO_ROOT, "img", "avatar-source.jpg")
DATA_OUT = os.path.join(REPO_ROOT, "js", "avatar-data.js")
FALLBACK_OUT = os.path.join(REPO_ROOT, "img", "avatar-pixelart.png")

GRID = 24            # voxel grid resolution (cols == rows) — deliberately coarse
                      # for bold, distinct Minecraft-style blocks rather than a
                      # fine pixel mosaic
BG_TOLERANCE = 110   # color-distance threshold to treat a cell as background
                      # (deliberately high — JPEG compression leaves a soft
                      # cream halo around the silhouette edge that a low
                      # threshold misses, showing up as a fringe of stray
                      # background-colored voxels)


def main():
    img = Image.open(SOURCE_IMAGE).convert("RGB")
    small = img.resize((GRID, GRID), Image.BOX)

    bg = small.getpixel((0, 0))

    def is_bg(px):
        return sum((a - b) ** 2 for a, b in zip(px, bg)) ** 0.5 < BG_TOLERANCE

    voxels = []
    fallback = Image.new("RGBA", (GRID, GRID), (0, 0, 0, 0))
    for row in range(GRID):
        for col in range(GRID):
            px = small.getpixel((col, row))
            if is_bg(px):
                continue
            voxels.append((col, row, px[0], px[1], px[2]))
            fallback.putpixel((col, row), (px[0], px[1], px[2], 255))

    fallback.save(FALLBACK_OUT)

    js = (
        "/* Voxel data for the homepage hero avatar's 3D pixel-art bust\n"
        "   (js/avatar-scene.js). Generated from img/avatar-source.jpg by\n"
        "   scripts/generate-avatar-data.py — background cells (matched by\n"
        "   color distance from the top-left corner pixel) are omitted so\n"
        "   the bust renders as a cutout, not a solid block. Regenerate with\n"
        "   that script if you replace the source image. */\n"
        f"export const AVATAR_GRID = {{ cols: {GRID}, rows: {GRID} }};\n"
        "export const AVATAR_VOXELS = [\n"
        + "\n".join(f"  [{c},{r},{rr},{g},{b}]," for c, r, rr, g, b in voxels)
        + "\n];\n"
    )
    with open(DATA_OUT, "w", encoding="utf-8") as f:
        f.write(js)

    print(f"voxels: {len(voxels)} / {GRID*GRID} cells ({len(voxels)/(GRID*GRID):.0%} foreground)")
    print(f"wrote {DATA_OUT} ({os.path.getsize(DATA_OUT)} bytes)")
    print(f"wrote {FALLBACK_OUT} ({os.path.getsize(FALLBACK_OUT)} bytes)")


if __name__ == "__main__":
    main()
