/* ══════════════════════════════════════════════════════════════
   Hero avatar: the pixel-art portrait (js/avatar-data.js) rendered
   as a real 3D voxel bust with three.js — each foreground pixel
   becomes a small extruded cube, tinted its source color, bulging
   forward toward the center for a sculpted-relief look rather than
   a flat plane. It rests at a fixed 3/4-turned pose (DEFAULT_YAW) —
   no idle animation of its own — on a soft glowing pedestal that
   stays put while the bust turns above it. Click-and-drag (or
   touch-drag) turns it, clamped to a natural viewing range since
   it's a relief (not a full sphere — there's nothing to see around
   the back), with a little drag momentum. The render loop only runs
   while something's actually moving; once a drag settles it stops
   rendering entirely, rather than looping forever for a static scene.

   Rendered unlit (MeshBasicMaterial, no lights on the bust) so every
   block shows its exact sampled color from the source image — no
   lighting/shading to tint or darken it — and there's no backing
   plate behind the bust itself: a fully transparent canvas with
   nothing behind it but the hero's own background, so if the bust
   doesn't render there's genuinely nothing there (no fallback image
   by design).

   Progressive enhancement only: if the CDN import fails, WebGL is
   unsupported, or the data file is missing, this quietly does
   nothing.
   ══════════════════════════════════════════════════════════════ */
(async function () {
  const canvas = document.getElementById('heroAvatarCanvas');
  const avatarEl = document.getElementById('heroAvatar');
  if (!canvas || !avatarEl) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let THREE, AVATAR_GRID, AVATAR_VOXELS;
  try {
    const [threeMod, dataMod] = await Promise.all([
      import('https://unpkg.com/three@0.160.0/build/three.module.js'),
      import('./avatar-data.js'),
    ]);
    THREE = threeMod;
    AVATAR_GRID = dataMod.AVATAR_GRID;
    AVATAR_VOXELS = dataMod.AVATAR_VOXELS;
  } catch (err) {
    return; // offline, CDN blocked, or the data file is missing
  }
  if (!AVATAR_VOXELS || !AVATAR_VOXELS.length) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (err) {
    return; // WebGL unsupported
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

  const rootStyle = getComputedStyle(document.documentElement);
  const accent2Rgb = rootStyle.getPropertyValue('--accent2-rgb').trim() || '240, 226, 160';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 10.5);

  function resize() {
    const w = avatarEl.clientWidth;
    const h = avatarEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ── build the voxel bust, centered on the actual portrait's ──── */
  /* ── bounding box (not the full grid, which has empty margin) ─── */
  const CELL = 0.38;
  const GAP_SCALE = 1.01; // >1: a hair of overlap, not a gap — flush faces can
                          // z-fight at the seam without it, which reads as a
                          // flickering gap even though none is there
  const BASE_DEPTH = 0.27;
  const BULGE = 0.96; // extra forward push at the bust's center

  let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
  AVATAR_VOXELS.forEach(([c, r]) => {
    if (c < minCol) minCol = c;
    if (c > maxCol) maxCol = c;
    if (r < minRow) minRow = r;
    if (r > maxRow) maxRow = r;
  });
  const centerCol = (minCol + maxCol) / 2;
  const centerRow = (minRow + maxRow) / 2;

  /* ── split the bust into head vs. shoulders/neck, so each gets its own
     bulge instead of one falloff centered on the whole figure — that made
     the head read as flatter than it should (its own radius is small next
     to the wider shoulders) and the shoulders taper away to nothing at
     their outer edges instead of reading as a solid rounded slab. Found
     by scanning row widths for the biggest jump in the lower half of the
     bust — that's where the silhouette flares out into the shoulders. ── */
  const rowSpans = new Map();
  AVATAR_VOXELS.forEach(([c, r]) => {
    const e = rowSpans.get(r) || { min: Infinity, max: -Infinity };
    e.min = Math.min(e.min, c);
    e.max = Math.max(e.max, c);
    rowSpans.set(r, e);
  });
  const sortedRows = [...rowSpans.keys()].sort((a, b) => a - b);
  let splitRow = sortedRows[sortedRows.length - 1];
  let bestJump = -Infinity;
  for (let i = 1; i < sortedRows.length; i++) {
    const row = sortedRows[i];
    if (row < centerRow) continue; // shoulders are always in the lower half
    const prevSpan = rowSpans.get(sortedRows[i - 1]);
    const span = rowSpans.get(row);
    const jump = (span.max - span.min) - (prevSpan.max - prevSpan.min);
    if (jump > bestJump) { bestJump = jump; splitRow = row; }
  }

  function bbox(predicate) {
    let lo = Infinity, hi = -Infinity, loR = Infinity, hiR = -Infinity;
    AVATAR_VOXELS.forEach(([c, r]) => {
      if (!predicate(r)) return;
      if (c < lo) lo = c;
      if (c > hi) hi = c;
      if (r < loR) loR = r;
      if (r > hiR) hiR = r;
    });
    return { minCol: lo, maxCol: hi, minRow: loR, maxRow: hiR };
  }
  const head = bbox((r) => r < splitRow);
  const headCenterCol = (head.minCol + head.maxCol) / 2;
  const headCenterRow = (head.minRow + head.maxRow) / 2;
  const headHalfSpan = Math.max(head.maxCol - head.minCol, head.maxRow - head.minRow) / 2;
  const body = bbox((r) => r >= splitRow);
  const bodyCenterCol = (body.minCol + body.maxCol) / 2;
  const bodyHalfWidth = (body.maxCol - body.minCol) / 2;

  const group = new THREE.Group();
  scene.add(group);

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial(); // unlit — exact source colors, no lighting tint
  const mesh = new THREE.InstancedMesh(geo, mat, AVATAR_VOXELS.length);
  const m = new THREE.Matrix4();
  const color = new THREE.Color();

  AVATAR_VOXELS.forEach(([col, row, r, g, b], i) => {
    let dist;
    if (row < splitRow) {
      // head: full 2D radial falloff, scaled to the head's own size —
      // a rounded dome rather than a flat plane
      const dx = (col - headCenterCol) / headHalfSpan;
      const dy = (row - headCenterRow) / headHalfSpan;
      dist = Math.sqrt(dx * dx + dy * dy);
    } else {
      // shoulders/neck: horizontal falloff only (no vertical component),
      // so the whole band bulges as one solid rounded slab instead of
      // tapering to flat toward the bottom edge
      dist = Math.abs((col - bodyCenterCol) / bodyHalfWidth);
    }
    dist = Math.min(1, dist);
    const depth = BASE_DEPTH + BULGE * Math.cos((dist * Math.PI) / 2);

    const x = (col - centerCol) * CELL;
    const y = (centerRow - row) * CELL; // flip: image row 0 is the top
    const z = depth / 2;

    m.compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion(),
      new THREE.Vector3(CELL * GAP_SCALE, CELL * GAP_SCALE, depth)
    );
    mesh.setMatrixAt(i, m);
    // explicit sRGB colorSpace: without it, three.js's color management
    // treats these r/255 values as already-linear and darkens/shifts them,
    // which is why the rendered colors didn't exactly match the source.
    mesh.setColorAt(i, color.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);

  /* ── glowing pedestal — a flat soft-edged ellipse sitting just below
     the bust, added to the scene directly (not the rotating group) so
     it reads as a stationary display stand the bust turns above,
     rather than spinning along with it. ─────────────────────────── */
  function makeGlowTexture() {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, `rgba(${accent2Rgb},0.55)`);
    g.addColorStop(1, `rgba(${accent2Rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }
  const bustWidth = (maxCol - minCol + 1) * CELL;
  const bustBottom = (centerRow - maxRow) * CELL - CELL / 2;
  const pedestal = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: makeGlowTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  pedestal.rotation.x = -Math.PI / 2;
  pedestal.position.y = bustBottom;
  pedestal.scale.set(bustWidth * 1.5, bustWidth * 0.55, 1);
  scene.add(pedestal);

  /* ── drag-to-turn, clamped to a natural viewing range (this is a ── */
  /* ── front relief, not a full sphere — there's no back to see) ──── */
  const DEFAULT_YAW = 0.4; // resting pose: turned a natural 3/4 rather than dead-on
  const MAX_YAW = 0.85;
  const MAX_PITCH = 0.4;
  const DRAG_SENSITIVITY = 0.006;

  let isDragging = false;
  let lastPointerX = 0, lastPointerY = 0;
  let dragOffsetX = 0, dragOffsetY = 0;
  let dragVelocityY = 0;

  canvas.style.pointerEvents = 'auto';
  // 'pan-y': lets a vertical touch-swipe still scroll the page past the
  // avatar, matching the same fix used on the hero globe's canvas.
  canvas.style.touchAction = 'pan-y';
  canvas.dataset.cursor = 'Drag';

  function applyRotation() {
    group.rotation.x = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, dragOffsetX));
    group.rotation.y = Math.max(-MAX_YAW, Math.min(MAX_YAW, DEFAULT_YAW + dragOffsetY));
  }

  let announced = false;
  function reveal() {
    if (announced) return;
    announced = true;
    canvas.classList.add('is-ready');
    avatarEl.classList.add('is-ready'); // fades out the "FB" fallback text
  }

  function renderOnce() {
    applyRotation();
    renderer.render(scene, camera);
    reveal();
  }

  // On-demand rendering: there's no idle animation, so the render loop
  // (tick) only exists to coast the drag's momentum to a stop after
  // release — every pointermove already renders directly, and once
  // released with no residual velocity there's nothing left to animate,
  // so nothing keeps re-rendering an unchanged frame forever.
  let rafScheduled = false;
  function requestTick() {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(tick);
  }

  function tick() {
    rafScheduled = false;
    if (!onScreen || document.hidden) return;
    if (Math.abs(dragVelocityY) <= 0.00005) { dragVelocityY = 0; return; } // settled — stop

    dragOffsetY += dragVelocityY;
    dragVelocityY *= 0.94;
    renderOnce();
    requestTick();
  }

  canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    dragVelocityY = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    dragOffsetY += dx * DRAG_SENSITIVITY;
    dragOffsetX += dy * DRAG_SENSITIVITY;
    dragVelocityY = dx * DRAG_SENSITIVITY;
    renderOnce();
  });
  window.addEventListener('pointerup', () => {
    isDragging = false;
    if (!reduceMotion) requestTick(); // let any residual momentum coast to a stop
  });
  window.addEventListener('pointercancel', () => { isDragging = false; });

  let onScreen = true;
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) requestTick(); // resume coasting if it was interrupted off-screen
  }, { threshold: 0 }).observe(avatarEl);

  resize();
  window.addEventListener('resize', () => { resize(); renderOnce(); });

  renderOnce(); // always show the resting pose immediately, motion or not
})();
