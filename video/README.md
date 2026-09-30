# video/

| File | Used on | Notes |
|---|---|---|
| `demosat-test.mp4` | `project-1.html` "Test Footage" section | Real flight/bench footage, has controls, not looped. |
| `hero-bg.mp4` | `index.html` hero background | Ambient looping clip behind the 3D globe. Autoplays muted at low opacity (`mix-blend-mode: screen`) — see [generating with Higgsfield](#generating-hero-bg-with-higgsfield) below. |
| `project-1/01.mp4` `02.mp4` `03.mp4` | `project-1.html` photos grid | Optional motion clip layered over the matching numbered photo in `img/project-1/`. |
| `project-2/01.mp4` `02.mp4` `03.mp4` | `project-2.html` photos grid | Same pattern, for `img/project-2/`. |
| `project-3/01.mp4` `02.mp4` `03.mp4` | `project-3.html` photos grid | Same pattern, for `img/project-3/`. |

Every slot is optional and independent — drop in whichever ones you have. A missing video falls back to the static photo beneath it (or the placeholder tile if that's missing too); nothing else to touch. All clips should be **muted** (autoplay requires it), **short and seamlessly looping**, and **silent-safe** (no audio track needed — it's stripped by the `muted` attribute anyway, but a smaller file with no audio track encodes faster).

## Generating hero-bg with Higgsfield

Higgsfield (higgsfield.ai) generates short AI video clips from a text prompt or a source image — good for producing an abstract ambient loop without needing footage of your own. Rough workflow:

1. **Pick a generation mode.** A text-to-video prompt is simplest for a pure abstract background. If you want the loop to echo the site's own visual language, feed it a screenshot of the 3D globe or an image of a PCB/circuit as the source image and use an image-to-video mode instead.
2. **Prompt direction** (adjust to taste): *"abstract dark background, thin glowing amber/gold light trails and particles slowly drifting, minimal geometric grid lines, deep space black backdrop, slow smooth camera drift, seamless loop, no text, no faces, high detail, cinematic"*. Keep it abstract — it plays behind text and the interactive globe, so it needs to stay unobtrusive.
3. **Color**: aim it at the site's accent gold, `#d6b840` (and the lighter `#f0e2a0`), on a near-black `#09090f` background — that's what the rest of the theme is built from, so anything warmer/cooler will clash.
4. **Loop**: use a "seamless loop" or "loop" output option if Higgsfield's UI offers one for your plan/mode. If not, pick a clip where the first and last frame are visually close (e.g. a slow orbital drift) — the `<video loop>` attribute will hard-cut back to frame one, so a clip that already ends near where it started hides the seam best.
5. **Length/resolution**: Higgsfield clips are typically a few seconds — that's fine, it'll loop continuously. Export at the highest resolution your plan allows (1920×1080 or better); it's stretched full-bleed behind the hero on desktop.
6. **Export and drop in** the file here as `hero-bg.mp4` (H.264 in an MP4 container plays everywhere; that's almost always Higgsfield's default export). No code changes needed — refresh the page and it's live.

The same prompting approach works for the per-project clips above: feed Higgsfield one of your project photos (the PCB board, the DemoSat shield, etc.) as the source image in image-to-video mode with a prompt like *"subtle slow zoom and parallax, cinematic lighting, no distortion of the subject"* — a "living photo" effect rather than a fully synthetic scene, since these are meant to document real hardware.
