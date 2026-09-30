/* ══════════════════════════════════════════════════════════════
   Hero avatar: the pixel-art portrait (js/avatar-data.js) rendered
   as a real 3D voxel bust with three.js — each foreground pixel
   becomes a small extruded cube, tinted its source color, bulging
   forward toward the center for a sculpted-relief look rather than
   a flat plane. Click-and-drag (or touch-drag) turns it, clamped to
   a natural viewing range since it's a relief (not a full sphere —
   there's nothing to see around the back), with a gentle idle sway
   and a little drag momentum, echoing the hero globe's interaction.

   Progressive enhancement only: if the CDN import fails, WebGL is
   unsupported, or the data file is missing, this quietly does
   nothing and the flat img/avatar-pixelart.png underneath carries
   the avatar instead.
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
    return; // offline, CDN blocked, or the data file is missing — flat PNG remains the fallback
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
  const accentHex = rootStyle.getPropertyValue('--accent').trim() || '#d6b840';

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

  /* ── lighting: flat-ish Lambert shading to match the pixel-art's
     flat-color aesthetic, warmed with the site's gold accent ─────── */
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const key = new THREE.DirectionalLight(0xfff4d6, 0.9);
  key.position.set(3, 4, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color().setStyle(accentHex), 0.5);
  rim.position.set(-4, -2, 3);
  scene.add(rim);

  /* ── build the voxel bust, centered on the actual portrait's ──── */
  /* ── bounding box (not the full grid, which has empty margin) ─── */
  const CELL = 0.36;
  const GAP_SCALE = 1.01; // >1: a hair of overlap, not a gap — flush faces can
                          // z-fight at the seam without it, which reads as a
                          // flickering gap even though none is there
  const BASE_DEPTH = 0.26;
  const BULGE = 0.9; // extra forward push at the bust's center

  let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
  AVATAR_VOXELS.forEach(([c, r]) => {
    if (c < minCol) minCol = c;
    if (c > maxCol) maxCol = c;
    if (r < minRow) minRow = r;
    if (r > maxRow) maxRow = r;
  });
  const centerCol = (minCol + maxCol) / 2;
  const centerRow = (minRow + maxRow) / 2;
  const halfSpan = Math.max(maxCol - minCol, maxRow - minRow) / 2;

  const group = new THREE.Group();
  scene.add(group);

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshLambertMaterial();
  const mesh = new THREE.InstancedMesh(geo, mat, AVATAR_VOXELS.length);
  const m = new THREE.Matrix4();
  const color = new THREE.Color();

  AVATAR_VOXELS.forEach(([col, row, r, g, b], i) => {
    const dx = (col - centerCol) / halfSpan;
    const dy = (row - centerRow) / halfSpan;
    const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy));
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
    mesh.setColorAt(i, color.setRGB(r / 255, g / 255, b / 255));
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
