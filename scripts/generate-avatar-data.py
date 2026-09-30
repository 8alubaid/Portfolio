#!/usr/bin/env python3
"""
Generates js/avatar-data.js and favicon.png from img/avatar-source.png — the
pixel-art portrait rendered as a real 3D voxel bust on the homepage hero
avatar (see js/avatar-scene.js) and, cropped to just the face, as the site
favicon. Run this only if you replace the source image or want to change the
voxel grid resolution; the generated files are already committed, so this
script isn't part of the site's runtime or build.

Usage:
    python scripts/generate-avatar-data.py

Requires Pillow (pip install pillow) — the only script in this repo with a
dependency beyond the standard library, since it's processing a raster image
rather than GeoJSON.
"""
import os
from PIL import Image, ImageDraw

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_IMAGE = os.path.join(REPO_ROOT, "img", "avatar-source.png")
DATA_OUT = os.path.join(REPO_ROOT, "js", "avatar-data.js")
FAVICON_OUT = os.path.join(REPO_ROOT, "favicon.png")

# 21 is this source image's actual native pixel-art resolution, not a
# stylistic choice — confirmed by downsampling to candidate grid sizes and
# upscaling back with nearest-neighbor: only exact divisors of the source's
# 336x336 that line up with the art's real pixel boundaries (21, 42, 84...)
# reconstruct with zero error, and 21 is the coarsest of those. Any other
# grid size would cut across the art's real pixel blocks and blur colors at
# the boundaries. If you swap in a different source image, re-derive this —
# don't just reuse 21.
GRID = 21
ALPHA_THRESHOLD = 128  # a cell below this average alpha counts as background
FAVICON_SIZE = 256          # output resolution (browsers scale down as needed)
FAVICON_BG = (9, 9, 15)     # matches --bg in css/base.css
FAVICON_RADIUS_FRAC = 0.25  # corner rounding, matches the old favicon.svg's rx=8/32
FAVICON_PADDING_FRAC = 0.12 # margin around the cropped face inside the badge


def find_head_bbox(grid, is_bg_at):
    """Same idea as the head/shoulders split in js/avatar-scene.js: scan row
    widths for the biggest jump in the lower half, which is where the
    silhouette flares from head into shoulders. Returns the head's
    (min_col, min_row, max_col, max_row) in grid cells."""
    row_span = {}
    for row in range(grid):
        cols = [c for c in range(grid) if not is_bg_at(c, row)]
        if cols:
            row_span[row] = (min(cols), max(cols))
    rows_sorted = sorted(row_span)
    center_row = (rows_sorted[0] + rows_sorted[-1]) / 2
    split_row = rows_sorted[-1]
    best_jump = float("-inf")
    for i in range(1, len(rows_sorted)):
        row = rows_sorted[i]
        if row < center_row:
            continue
        prev_lo, prev_hi = row_span[rows_sorted[i - 1]]
        lo, hi = row_span[row]
        jump = (hi - lo) - (prev_hi - prev_lo)
        if jump > best_jump:
            best_jump = jump
            split_row = row
    head_rows = [r for r in rows_sorted if r < split_row] or rows_sorted
    min_col = min(row_span[r][0] for r in head_rows)
    max_col = max(row_span[r][1] for r in head_rows)
    return min_col, min(head_rows), max_col, max(head_rows)


def generate_favicon(img, is_bg_at):
    min_col, min_row, max_col, max_row = find_head_bbox(GRID, is_bg_at)
    cell_w, cell_h = img.width / GRID, img.height / GRID
    pad_cols = (max_col - min_col + 1) * 0.1
    pad_rows = (max_row - min_row + 1) * 0.1
    left = max(0, (min_col - pad_cols) * cell_w)
    top = max(0, (min_row - pad_rows) * cell_h)
    right = min(img.width, (max_col + 1 + pad_cols) * cell_w)
    bottom = min(img.height, (max_row + 1 + pad_rows) * cell_h)
    face = img.crop((left, top, right, bottom)).convert("RGB")

    # cut the background out using the source's own alpha channel, replacing
    # it with the badge color instead of transparency showing through as black
    alpha_full = img.split()[3]
    alpha_crop = alpha_full.crop((left, top, right, bottom))
    face_cutout = Image.new("RGB", face.size, FAVICON_BG)
    face_cutout.paste(face, (0, 0), alpha_crop)
    face = face_cutout

    # letterbox the (non-square) crop onto a square canvas before the resize,
    # so the face is centered and undistorted rather than stretched
    side = max(face.width, face.height)
    square = Image.new("RGB", (side, side), FAVICON_BG)
    square.paste(face, ((side - face.width) // 2, (side - face.height) // 2))

    inner = int(FAVICON_SIZE * (1 - 2 * FAVICON_PADDING_FRAC))
    face_resized = square.resize((inner, inner), Image.LANCZOS)

    badge = Image.new("RGBA", (FAVICON_SIZE, FAVICON_SIZE), (0, 0, 0, 0))
    mask = Image.new("L", (FAVICON_SIZE, FAVICON_SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, FAVICON_SIZE - 1, FAVICON_SIZE - 1),
        radius=int(FAVICON_SIZE * FAVICON_RADIUS_FRAC),
        fill=255,
    )
    bg_layer = Image.new("RGBA", (FAVICON_SIZE, FAVICON_SIZE), FAVICON_BG + (255,))
    badge = Image.composite(bg_layer, badge, mask)
    offset = (FAVICON_SIZE - inner) // 2
    badge.paste(face_resized, (offset, offset))
    badge.save(FAVICON_OUT)
    print(f"wrote {FAVICON_OUT} ({os.path.getsize(FAVICON_OUT)} bytes)")


def main():
    img = Image.open(SOURCE_IMAGE).convert("RGBA")
    small = img.resize((GRID, GRID), Image.BOX)

    def is_bg(col, row):
        return small.getpixel((col, row))[3] < ALPHA_THRESHOLD

    voxels = []
    for row in range(GRID):
        for col in range(GRID):
            if is_bg(col, row):
                continue
            r, g, b, _a = small.getpixel((col, row))
            voxels.append((col, row, r, g, b))

    generate_favicon(img, is_bg)

    js = (
        "/* Voxel data for the homepage hero avatar's 3D pixel-art bust\n"
        "   (js/avatar-scene.js). Generated from img/avatar-source.png by\n"
        "   scripts/generate-avatar-data.py — background cells (the source's\n"
        "   own alpha channel, not a color guess) are omitted so the bust\n"
        "   renders as a cutout, not a solid block. Colors are the exact\n"
        "   sampled RGB from the source — avatar-scene.js renders them unlit\n"
        "   (MeshBasicMaterial) so nothing here gets tinted by scene\n"
        "   lighting. Regenerate with that script if you replace the source\n"
        "   image. */\n"
        f"export const AVATAR_GRID = {{ cols: {GRID}, rows: {GRID} }};\n"
        "export const AVATAR_VOXELS = [\n"
        + "\n".join(f"  [{c},{r},{rr},{g},{b}]," for c, r, rr, g, b in voxels)
        + "\n];\n"
    )
    with open(DATA_OUT, "w", encoding="utf-8") as f:
        f.write(js)

    print(f"voxels: {len(voxels)} / {GRID*GRID} cells ({len(voxels)/(GRID*GRID):.0%} foreground)")
    print(f"wrote {DATA_OUT} ({os.path.getsize(DATA_OUT)} bytes)")


if __name__ == "__main__":
    main()
