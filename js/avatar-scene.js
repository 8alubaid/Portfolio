/* ══════════════════════════════════════════════════════════════
   Hero avatar: the pixel-art portrait (js/avatar-data.js) rendered
   as a real 3D voxel bust with three.js — each foreground pixel
   becomes a small extruded cube, tinted its source color, bulging
   forward toward the center for a sculpted-relief look rather than
   a flat plane. Click-and-drag (or touch-drag) turns it, clamped to
   a natural viewing range since it's a relief (not a full sphere —
   there's nothing to see around the back), with a gentle idle sway
   and a little drag momentum, echoing the hero globe's interaction.

   Rendered unlit (MeshBasicMaterial, no lights in the scene) so
   every block shows its exact sampled color from the source image —
   no lighting/shading to tint or darken it — and there's no backing
   plate of any kind: a fully transparent canvas with nothing behind
   it but the hero's own background, so if the bust doesn't render
   there's genuinely nothing there (no fallback image by design).

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
  const CELL = 0.55;
  const GAP_SCALE = 1.01; // >1: a hair of overlap, not a gap — flush faces can
                          // z-fight at the seam without it, which reads as a
                          // flickering gap even though none is there
  const BASE_DEPTH = 0.4;
  const BULGE = 1.4; // extra forward push at the bust's center

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

  /* ── drag-to-turn, clamped to a natural viewing range (this is a ── */
  /* ── front relief, not a full sphere — there's no back to see) ──── */
  const MAX_YAW = 0.85;
  const MAX_PITCH = 0.4;
  const DRAG_SENSITIVITY = 0.006;
  const IDLE_AMPLITUDE = 0.3;
  const IDLE_SPEED = 0.35;

  let isDragging = false;
  let lastPointerX = 0, lastPointerY = 0;
  let dragOffsetX = 0, dragOffsetY = 0;
  let dragVelocityY = 0;
  let idleClock = 0;

  canvas.style.pointerEvents = 'auto';
  // 'pan-y': lets a vertical touch-swipe still scroll the page past the
  // avatar, matching the same fix used on the hero globe's canvas.
  canvas.style.touchAction = 'pan-y';
  canvas.dataset.cursor = 'Drag';

  function applyRotation(idleYaw) {
    group.rotation.x = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, dragOffsetX));
    group.rotation.y = Math.max(-MAX_YAW, Math.min(MAX_YAW, idleYaw + dragOffsetY));
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
    if (reduceMotion) renderOnce();
  });
  window.addEventListener('pointerup', () => { isDragging = false; });
  window.addEventListener('pointercancel', () => { isDragging = false; });

  let onScreen = true;
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }, { threshold: 0 }).observe(avatarEl);

  resize();
  window.addEventListener('resize', resize);

  let announced = false;
  function reveal() {
    if (announced) return;
    announced = true;
    canvas.classList.add('is-ready');
    avatarEl.classList.add('is-ready'); // fades out the "FB" fallback text
  }

  function renderOnce() {
    applyRotation(0);
    renderer.render(scene, camera);
    reveal();
  }

  if (reduceMotion) {
    renderOnce();
    return; // no rAF loop — no autonomous motion, drag still works on demand
  }

  function tick() {
    requestAnimationFrame(tick);
    if (!onScreen || document.hidden) return;

    idleClock += 0.016;
    const idleYaw = isDragging ? 0 : Math.sin(idleClock * IDLE_SPEED) * IDLE_AMPLITUDE;

    if (!isDragging && Math.abs(dragVelocityY) > 0.00005) {
      dragOffsetY += dragVelocityY;
      dragVelocityY *= 0.94;
    } else if (!isDragging) {
      dragVelocityY = 0;
    }

    applyRotation(idleYaw);
    renderer.render(scene, camera);
    reveal();
  }
  tick();
})();
