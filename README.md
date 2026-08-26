# Faris Balubaid — Portfolio

A dark, motion-driven personal portfolio for **Faris Balubaid** — Electrical & Computer Engineering graduate (University of Colorado Boulder) working across embedded systems, networking, and cloud infrastructure.

No framework, no build step — static HTML/CSS/JS designed to load instantly and feel handcrafted.

---

## Features

- **Live WebGL network scene** — an interactive [three.js](https://threejs.org/) node network rendered in the hero, standing in for the "Embedded · Networking · Cloud" line right next to it: nodes on a sphere connect to their nearest neighbors, small pulses travel the edges like data packets, and the whole thing eases toward the pointer while auto-rotating. Loaded via dynamic `import()` so a blocked/offline CDN just quietly falls back to the CSS glow underneath — the hero never breaks.
- **Photo-forward 3D project cards** — each card leads with a cover photo that tilts in perspective toward the pointer (`rotateX`/`rotateY`) while the photo *inside* parallax-shifts the opposite way and scales up, plus a diagonal glossy light-sweep on hover — a convincing depth illusion built from nothing but CSS custom properties and one mousemove listener. Missing a cover photo yet? Falls back to a branded placeholder, no broken images. Prev/next pagination cards get the same tilt treatment.
- **3D scroll-reveal** — sections tilt up out of a slight `rotateX` and fade in via `IntersectionObserver` as they enter the viewport, staggered per item.
- **Custom cursor** — a trailing ring + dot that grows and labels itself over links, cards, and buttons; falls back to the native cursor on touch devices and when `prefers-reduced-motion` is set.
- **Magnetic interactions** — buttons and contact links gently pull toward the pointer.
- **Ambient parallax glow** — a soft radial highlight in each hero that tracks the pointer.
- **Circuit-inspired accents** — a faint dot-grid backdrop, "pad"-style section markers, and a traveling glint animation along every section divider, a nod to PCB schematics.
- **Case-study project pages** — each project gets its own page with an overview, role & contributions, tech stack, and a media section, not just a card.
- **Fully responsive** — single-column collapse for nav, hero, experience, and project grid under 680px; the WebGL scene scales its node count down on narrow viewports.
- **Accessible & battery-conscious by default** — semantic sectioning, keyboard-reachable links, a `prefers-reduced-motion` path that disables the WebGL scene (renders one static frame) and every cursor/parallax/tilt effect, and the scene itself pauses rendering when the hero scrolls out of view or the tab is backgrounded.

## Tech Stack

| Layer      | Choice                                                            |
|------------|--------------------------------------------------------------------|
| Markup     | Semantic HTML5                                                    |
| Styling    | Vanilla CSS3 — custom properties as design tokens, Grid/Flexbox   |
| Behavior   | Vanilla JS (ES6+) for everything except the hero scene            |
| 3D         | [three.js](https://threejs.org/) r160, loaded from the unpkg CDN via dynamic `import()` — the one external script dependency in the project, and it's optional: see [3D Hero Scene](#3d-hero-scene) below |
| Type       | [Syne](https://fonts.google.com/specimen/Syne) (display), [DM Sans](https://fonts.google.com/specimen/DM+Sans) (body), [DM Mono](https://fonts.google.com/specimen/DM+Mono) (labels/mono), via Google Fonts |
| Build      | None — open the HTML files directly or serve statically           |

## Project Structure

```
Website/
├── index.html            # Home — hero, experience, project grid, contact
├── project-1.html        # Case study — DemoSat RadTest (Colorado Space Grant / NASA)
├── project-2.html        # Case study — Dockerized Message Board
├── project-3.html        # Case study — Golden Arduino PCB Design
├── favicon.svg            # Site icon (monogram mark)
├── css/
│   ├── base.css           # Design tokens, reset, cursor, nav, shared components
│   ├── home.css           # Styles unique to index.html
│   └── project.css        # Styles unique to the project-N.html case studies
├── js/
│   ├── main.js            # Cursor, magnetic buttons, 3D tilt, scroll-reveal, scroll progress
│   └── hero-scene.js      # three.js WebGL node-network scene (index.html hero only)
├── img/
│   ├── README.md          # Drop your headshot in as img/my-photo.jpg
│   ├── project-1/         # DemoSat photos — cover.jpg + 01–03.jpg (see its README)
│   ├── project-2/         # Message Board photos — cover.jpg + 01–03.jpg
│   ├── project-3/         # Golden Arduino photos — cover.jpg + 01–03.jpg
│   └── experience/        # Small thumbnail for the Experience section — cover.jpg
├── video/
│   └── README.md          # Drop project footage in here (see per-project notes)
├── resume/
│   └── README.md          # Drop your exported resume in as resume/faris-balubaid-resume.pdf
└── README.md
```

> **`project-4.html`** exists in the repo but isn't linked from anywhere — it looks like a leftover draft (it duplicates `project-3.html`'s content but references a `demosat-test.mp4` video, which belongs to the DemoSat project instead). It was left untouched rather than guessed at; see [Known Issues](#known-issues--todo) below.

## Getting Started

No install, no build. Either:

```bash
# Just open it
open index.html         # macOS
start index.html         # Windows
```

or serve it locally (recommended, avoids any `file://` path quirks):

```bash
npx serve .
# or
python -m http.server 8000
```

Then visit `http://localhost:PORT`.

## Design System

All shared values live as CSS custom properties at the top of `css/base.css`:

```css
--bg:        #09090f;   /* page background */
--surface:   #111118;   /* cards, pills, boxes */
--border:    #1e1e2e;   /* hairlines */
--accent:    #d6b840;   /* primary gold, sampled from the hero photo's foliage */
--accent2:   #f0e2a0;   /* pale champagne gold, hover/emphasis */
--text:      #e2e2f0;   /* body text */
--muted:     #8a8aa8;   /* secondary text (tuned for AA contrast) */
--mono:      'DM Mono', monospace;   /* labels, tags, dates */
--display:   'Syne', sans-serif;     /* headings */
--body:      'DM Sans', sans-serif;  /* paragraphs */
--radius:    12px;
--max:       860px;      /* content column width */
```

Change a token once in `base.css` and it propagates everywhere — no per-page overrides to hunt down.

Reusable components defined in `base.css` and used across pages: `.btn` / `.btn-outline`, `.section-label`, `.tag` / `.project-tags`, `.exp-bullets` (arrow list), `.magnetic`, `.reveal`.

## 3D Hero Scene

`js/hero-scene.js` builds the node network entirely from primitives — no external model or texture files:

- **Nodes**: a Fibonacci lattice (golden-angle spiral) distributes ~70 points evenly across a sphere — the same trick used to distribute seeds on a sunflower head, which happens to be the simplest way to get an even point cloud on a sphere without clustering at the poles.
- **Edges**: each node connects to its 3 nearest neighbors (brute-force distance search — trivial at this scale), drawn as a single `LineSegments` mesh.
- **Pulses**: a handful of sprites continuously lerp between random node pairs, reading as data moving through the network.
- **Interaction**: the whole group auto-rotates slowly and eases toward the pointer's position (separately from the auto-rotation, so parallax never fights the spin or compounds into a runaway rotation).

It's deliberately cheap to render (a few hundred vertices, two draw calls for the network plus a handful of sprites) so it stays smooth even on modest hardware, and it degrades gracefully at every layer:

| Condition | Behavior |
|---|---|
| CDN unreachable / import fails | Caught silently — the `<canvas>` stays transparent, the CSS radial glow underneath is the whole hero background |
| WebGL unsupported | Same — `WebGLRenderer` construction is wrapped in `try/catch` |
| `prefers-reduced-motion: reduce` | Renders exactly one static frame, no rotation, no parallax, no render loop |
| Hero scrolled out of view / tab backgrounded | Render loop pauses via `IntersectionObserver` + `document.hidden`, resumes automatically |
| Narrow viewport (< 768px) | Node count drops from 70 to 40 |

## Adding a New Project

1. Duplicate `project-3.html` and rename it (e.g. `project-5.html`).
2. Update the `<title>`, `project-num-big`, `project-name`, status pill, overview copy, role bullets, tech-stack tags, and the media section.
3. Fix the prev/next links at the bottom of the new page and of its new neighbors, so the loop (`1 → 2 → 3 → 1`) stays intact.
4. Add a matching `<a class="project-card">` block in `index.html`'s `#projects` section (copy the `.card-media` block too), with the next sequential number.
5. Make an `img/project-5/` folder for its photos — `cover.jpg` for the card, `01.jpg`/`02.jpg`/... for the detail-page gallery.

No CSS changes needed — the shared stylesheet handles it.

## Assets Checklist

| Asset | Referenced in | Status |
|---|---|---|
| `img/my-photo.jpg` | `index.html` hero avatar | ✅ **In place** — recovered from the previous repo upload and re-cropped for the circular avatar. |
| `video/demosat-test.mp4` | `project-1.html` media section | ✅ **In place**. |
| `resume/faris-balubaid-resume.pdf` | Hero + contact "Download Resume" buttons | ✅ **In place** — buttons are live. Re-export from Overleaf and overwrite this same file to update. |
| `img/project-1/`, `project-2/`, `project-3/` | `index.html` cards + each detail-page photo gallery | **Empty** — see each folder's `README.md` for exact filenames. Cards and gallery tiles fall back to branded placeholders until filled in. |
| `img/experience/cover.jpg` | `index.html` Experience thumbnail | **Empty** — thumbnail just doesn't render until added. |

Every fallback above is functional, not broken — the site looks intentional either way, and starts using real media the moment a file is dropped into its expected path. See [`resume/README.md`](resume/README.md) for the Overleaf → PDF workflow.

## Deployment

This is a static site, so any static host works:

**GitHub Pages** (matches the `FarisBalubaid.dev`-style branding in the nav) — live at [8alubaid.github.io/Portfolio](https://8alubaid.github.io/Portfolio/):
1. Push this repo to GitHub.
2. Settings → Pages → deploy from the `main` branch, root directory.
3. For a custom domain, add a `CNAME` file at the repo root containing the domain, and point its DNS at GitHub Pages.

The repo includes a `.nojekyll` file at the root — without it, GitHub Pages runs everything through
Jekyll by default, which is unnecessary for a plain static site and can cause a push to silently fail
to rebuild (the live site keeps serving the last successful build with no obvious error). If the live
site ever looks stale after a push, check the **Actions** tab on the repo for a failed "pages build
and deployment" run — that's the real error log.

**Netlify / Vercel**: import the repo, no build command, publish directory `/`.

## Known Issues / TODO

- [x] Headshot added at `img/my-photo.jpg`
- [x] `video/demosat-test.mp4` added
- [ ] Decide the fate of `project-4.html` — merge its intended video slot into `project-1.html` (already done structurally) and remove the stray file, or repurpose it as a real fourth project
- [x] Resume PDF added at `resume/faris-balubaid-resume.pdf` — download buttons are live
- [ ] Add project cover photos + gallery images (`img/project-1/`, `project-2/`, `project-3/` — see each folder's README)
- [ ] Add an Experience thumbnail at `img/experience/cover.jpg`
- [ ] Optional: wire Overleaf's GitHub sync + a LaTeX-compile GitHub Action for a fully automatic resume pipeline (see `resume/README.md`)

## Contact

- Email: [iifbalubaid@gmail.com](mailto:iifbalubaid@gmail.com)
- LinkedIn: [linkedin.com/in/farisbalubaid](https://www.linkedin.com/in/farisbalubaid/)

## License

Site code (HTML/CSS/JS structure) is free to reference or adapt for your own portfolio — attribution appreciated. Personal content (bio, project write-ups, photos) is © Faris Balubaid and not for reuse. Fonts are served under their respective open-source licenses via Google Fonts (Syne, DM Sans, DM Mono — all OFL). [three.js](https://github.com/mrdoob/three.js) is MIT-licensed.
