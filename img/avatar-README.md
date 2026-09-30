# Hero avatar assets

| File | Role |
|---|---|
| `avatar-source.jpg` | The original pixel-art portrait — input to `scripts/generate-avatar-data.py`. Replace this to change the avatar, then re-run that script. |
| `avatar-pixelart.png` | Generated. A clean 40×40 cutout (background removed) of the source, shown as `<img>` in `index.html` — the flat fallback if the 3D render doesn't happen (offline, WebGL unsupported, or a JS error). Displayed with `image-rendering: pixelated` so it stays crisp when scaled up. |
| `my-photo.jpg` | Unused now (was the hero avatar before it switched to the pixel-art bust) — left in place in case it's wanted again. |

The 3D voxel bust itself lives in `js/avatar-data.js` (also generated) and is rendered by `js/avatar-scene.js`. See that script's own header comment for how the voxel grid, background cutout, relief bulge, and drag-rotate range work, and `scripts/generate-avatar-data.py` for the generation pipeline (requires `pip install pillow`).

To swap in a new portrait: replace `avatar-source.jpg`, then run:

```bash
python scripts/generate-avatar-data.py
```

That regenerates both `avatar-pixelart.png` and `js/avatar-data.js` — no other files need to change.
