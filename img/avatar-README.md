# Hero avatar assets

| File | Role |
|---|---|
| `avatar-source.jpg` | The original pixel-art portrait — input to `scripts/generate-avatar-data.py`. Replace this to change the avatar, then re-run that script. |
| `my-photo.jpg` | Unused now (was the hero avatar before it switched to the pixel-art bust) — left in place in case it's wanted again. |

There's deliberately no flat fallback image for the avatar — if the 3D render doesn't happen (offline, WebGL unsupported, or a JS error), the "FB" text in `index.html`'s `.hero-avatar` is all that's left, no background or frame behind it either.

The 3D voxel bust itself lives in `js/avatar-data.js` (generated) and is rendered by `js/avatar-scene.js` — unlit (`MeshBasicMaterial`), so every block shows the exact RGB sampled from the source image with no lighting tint. See that script's own header comment for how the voxel grid, background cutout, relief bulge, and drag-rotate range work, and `scripts/generate-avatar-data.py` for the generation pipeline (requires `pip install pillow`).

The same source image also becomes the site favicon (`favicon.png` at the repo root) — the script crops it down to just the face and cuts the background out the same way the bust does, then composites it onto a rounded dark badge.

To swap in a new portrait: replace `avatar-source.jpg`, then run:

```bash
python scripts/generate-avatar-data.py
```

That regenerates `js/avatar-data.js` and `favicon.png` — no other files need to change.
