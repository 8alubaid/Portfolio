# Hero avatar assets

| File | Role |
|---|---|
| `avatar-source.png` | The pixel-art portrait — input to `scripts/generate-avatar-data.py`. A real PNG with alpha transparency (not a flattened JPEG), which is what lets the background get cut out exactly rather than guessed by color. Replace this to change the avatar, then re-run that script. |
| `avatar-source.jpg` | The previous (JPEG, no transparency) source — unused now, left in place in case it's wanted again. |
| `my-photo.jpg` | Unused now (was the hero avatar before it switched to the pixel-art bust) — left in place in case it's wanted again. |

There's deliberately no flat fallback image for the avatar — if the 3D render doesn't happen (offline, WebGL unsupported, or a JS error), the "FB" text in `index.html`'s `.hero-avatar` is all that's left, no background or frame behind it either.

The 3D voxel bust itself lives in `js/avatar-data.js` (generated) and is rendered by `js/avatar-scene.js` — unlit (`MeshBasicMaterial`), so every block shows the exact RGB sampled from the source image with no lighting tint. The voxel grid is 21×21, which isn't a stylistic pick — it's `avatar-source.png`'s actual native pixel-art resolution (confirmed by downsampling to candidate sizes and upscaling back: only exact multiples of the art's real pixel blocks reconstruct with zero error). If you swap in a source image with a different native resolution, re-derive `GRID` in `scripts/generate-avatar-data.py` rather than reusing 21 — the script's comment above that constant shows the method. See that script's own header comment for how the background cutout, relief bulge, and drag-rotate range work (requires `pip install pillow`).

The same source image also becomes the site favicon (`favicon.png` at the repo root) — the script crops it down to just the face and cuts the background out using the same alpha channel, then composites it onto a rounded dark badge.

To swap in a new portrait: replace `avatar-source.png` (needs real alpha transparency, not a flattened background), then run:

```bash
python scripts/generate-avatar-data.py
```

That regenerates `js/avatar-data.js` and `favicon.png` — no other files need to change.
