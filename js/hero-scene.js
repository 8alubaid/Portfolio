/* ══════════════════════════════════════════════════════════════
   Hero background: an interactive, semi-transparent 3D globe
   rendered with three.js — real country border outlines (from
   js/world-data.js), auto-rotating and easing toward the pointer,
   with two marked locations: Jeddah, Saudi Arabia (raised & born)
   and Boulder, Colorado (Bachelor's degree), connected by an arc.
   The United States and Saudi Arabia are drawn with a brighter
   outline + a soft glow (js/highlight-data.js). Click-and-drag (or
   touch-drag) spins the globe directly, with a little momentum on
   release; auto-spin pauses while dragging and resumes after.

   Progressive enhancement only: if the CDN import fails, WebGL is
   unsupported, or the data files are missing, this quietly does
   nothing and the CSS radial glow underneath carries the hero.
   ══════════════════════════════════════════════════════════════ */
(async function () {
  const canvas = document.getElementById('heroCanvas');
  const heroSection = document.getElementById('hero');
  if (!canvas || !heroSection) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let THREE, WORLD_RINGS, HIGHLIGHT_RINGS, HIGHLIGHT_CENTROIDS, REGION_RINGS;
  try {
    const [threeMod, worldMod, highlightMod, regionMod] = await Promise.all([
      import('https://unpkg.com/three@0.160.0/build/three.module.js'),
      import('./world-data.js'),
      import('./highlight-data.js'),
      import('./region-data.js'),
    ]);
    THREE = threeMod;
    WORLD_RINGS = worldMod.WORLD_RINGS;
    HIGHLIGHT_RINGS = highlightMod.HIGHLIGHT_RINGS;
    HIGHLIGHT_CENTROIDS = highlightMod.HIGHLIGHT_CENTROIDS;
    REGION_RINGS = regionMod.REGION_RINGS;
  } catch (err) {
    return; // offline, CDN blocked, or a local data file missing — CSS glow remains the fallback
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (err) {
    return; // WebGL unsupported
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

  /* ── read the live theme colors instead of hardcoding them, so a  ── */
  /* ── future palette change in base.css just works here too       ── */
  const rootStyle = getComputedStyle(document.documentElement);
  const accentHex = rootStyle.getPropertyValue('--accent').trim() || '#d6b840';
  const accent2Hex = rootStyle.getPropertyValue('--accent2').trim() || '#f0e2a0';
  const accent2Rgb = rootStyle.getPropertyValue('--accent2-rgb').trim() || '240, 226, 160';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 11.5);

  function resize() {
    const w = heroSection.clientWidth;
    const h = heroSection.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const RADIUS = 5.2;

  /* standard lat/lon -> sphere-surface conversion, shared by every  */
  /* piece of geometry below so borders, pins, and the arc all line  */
  /* up on the same globe                                            */
  function latLonToVec3(lat, lon, r) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }

  function ringsToSegments(rings, radiusScale) {
    const positions = [];
    rings.forEach((flat) => {
      const pts = [];
      for (let i = 0; i < flat.length; i += 2) {
        pts.push(latLonToVec3(flat[i + 1], flat[i], RADIUS * radiusScale));
      }
      for (let i = 0; i < pts.length - 1; i++) {
        positions.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
      }
    });
    return positions;
  }

  const group = new THREE.Group();
  scene.add(group);

  /* ── faint transparent globe fill ────────────────────────────── */
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 48, 32),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color().setStyle(accentHex),
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
    })
  );
  group.add(globe);

  /* ── real country border outlines ────────────────────────────── */
  const borderGeo = new THREE.BufferGeometry();
  borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(ringsToSegments(WORLD_RINGS, 1.002), 3));
  const borders = new THREE.LineSegments(
    borderGeo,
    new THREE.LineBasicMaterial({ color: new THREE.Color().setStyle(accentHex), transparent: true, opacity: 0.5 })
  );
  group.add(borders);

  /* ── soft circular sprite texture, reused for markers + pulses + glows ── */
  function makeDotTexture() {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, `rgba(${accent2Rgb},0.85)`);
    g.addColorStop(1, `rgba(${accent2Rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }
  const dotTexture = makeDotTexture();

  /* ── highlighted countries: brighter outline + soft area glow ─── */
  const highlightGlows = [];
  Object.keys(HIGHLIGHT_RINGS).forEach((key) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(ringsToSegments(HIGHLIGHT_RINGS[key], 1.006), 3));
    const line = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: new THREE.Color().setStyle(accent2Hex), transparent: true, opacity: 0.95 })
    );
    group.add(line);

    const [clon, clat] = HIGHLIGHT_CENTROIDS[key];
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: dotTexture,
        color: new THREE.Color().setStyle(accent2Hex),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.35,
      })
    );
    glow.position.copy(latLonToVec3(clat, clon, RADIUS * 1.01));
    glow.scale.setScalar(2.6);
    group.add(glow);
    highlightGlows.push(glow);
  });

  /* ── outlined regions (states/provinces) — bright outline, no glow ── */
  Object.keys(REGION_RINGS).forEach((key) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(ringsToSegments(REGION_RINGS[key], 1.008), 3));
    const line = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: new THREE.Color().setStyle(accent2Hex), transparent: true, opacity: 0.85 })
    );
    group.add(line);
  });

  /* ── two marked locations ────────────────────────────────────── */
  const LOCATIONS = [
    { name: 'Jeddah, Saudi Arabia', lat: 21.4858, lon: 39.1925 },
    { name: 'Boulder, Colorado', lat: 40.015, lon: -105.2705 },
  ];

  const markers = LOCATIONS.map((loc) => {
    const surface = latLonToVec3(loc.lat, loc.lon, RADIUS);
    const outward = surface.clone().normalize();
    const tip = surface.clone().add(outward.clone().multiplyScalar(0.4));

    const pinGeo = new THREE.BufferGeometry().setFromPoints([surface, tip]);
    const pin = new THREE.Line(
      pinGeo,
      new THREE.LineBasicMaterial({ color: new THREE.Color().setStyle(accent2Hex), transparent: true, opacity: 0.9 })
    );

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: dotTexture,
        color: new THREE.Color().setStyle(accent2Hex),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    sprite.position.copy(tip);
    sprite.scale.setScalar(0.42);

    group.add(pin, sprite);

    const labelEl = document.createElement('div');
    labelEl.className = 'globe-label';
    labelEl.innerHTML = `<span class="globe-label-dot"></span>${loc.name}`;
    // insert right after the canvas (not appended at the end) so it stays
    // behind the hero text/avatar in paint order — see the z-index note
    // on .globe-label in home.css for why both pieces matter together
    canvas.insertAdjacentElement('afterend', labelEl);

    return { ...loc, surface, tip, sprite, labelEl };
  });

  /* ── arc connecting the two locations, lifted above the surface ── */
  const [origin, dest] = markers;
  const ARC_SEGMENTS = 64;
  const arcPoints = [];
  const originDir = origin.surface.clone().normalize();
  const destDir = dest.surface.clone().normalize();
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const t = i / ARC_SEGMENTS;
    const dir = originDir.clone().lerp(destDir, t).normalize();
    const lift = RADIUS * (1 + 0.3 * Math.sin(Math.PI * t));
    arcPoints.push(dir.multiplyScalar(lift));
  }
  const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
  const arc = new THREE.Line(
    arcGeo,
    new THREE.LineBasicMaterial({ color: new THREE.Color().setStyle(accent2Hex), transparent: true, opacity: 0.4 })
  );
  group.add(arc);

  /* traveling pulses along the arc */
  const PULSE_COUNT = 2;
  const pulses = [];
  for (let i = 0; i < PULSE_COUNT; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: dotTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    sprite.scale.setScalar(0.3);
    pulses.push({ sprite, t: i / PULSE_COUNT, speed: 0.12 });
    group.add(sprite);
  }

  /* ── slow ambient auto-rotation ───────────────────────────────── */
  const SPIN_SPEED = 0.0005; // ~3x slower than the original network scene's spin
  let autoRotation = 0.4;

  /* ── passive pointer parallax (eased, only when not dragging) ─── */
  let targetRotX = 0, targetRotY = 0, parallaxX = 0, parallaxY = 0;
  window.addEventListener('mousemove', (e) => {
    const r = heroSection.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) return;
    targetRotY = ((e.clientX - r.left) / r.width - 0.5) * 0.6;
    targetRotX = ((e.clientY - r.top) / r.height - 0.5) * 0.4;
  });

  /* ── click/touch-and-drag control, with a little momentum ──────── */
  const MAX_TILT = 1.3; // radians — keeps the poles from flipping past view
  const DRAG_SENSITIVITY = 0.004; // radians per pixel of pointer movement
  let isDragging = false;
  let lastPointerX = 0, lastPointerY = 0;
  let dragOffsetX = 0, dragOffsetY = 0;
  let dragVelocityY = 0;

  canvas.style.pointerEvents = 'auto';
  canvas.style.touchAction = 'none';
  canvas.dataset.cursor = 'Drag';

  function applyRotation() {
    group.rotation.x = dragOffsetX + (isDragging ? 0 : parallaxX);
    group.rotation.y = autoRotation + dragOffsetY + (isDragging ? 0 : parallaxY);
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
    dragOffsetX = Math.max(-MAX_TILT, Math.min(MAX_TILT, dragOffsetX + dy * DRAG_SENSITIVITY));
    dragVelocityY = dx * DRAG_SENSITIVITY;
    if (reduceMotion) renderOnce(); // no rAF loop in that mode — render on every explicit input
  });
  window.addEventListener('pointerup', () => { isDragging = false; });
  window.addEventListener('pointercancel', () => { isDragging = false; });

  /* ── only animate while the hero is actually on screen ──────── */
  let onScreen = true;
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }, { threshold: 0 }).observe(heroSection);

  resize();
  window.addEventListener('resize', resize);

  let announced = false;
  function reveal() {
    if (announced) return;
    announced = true;
    canvas.classList.add('is-ready');
  }

  /* project each marker to screen space; hide its label when the  */
  /* marker has rotated to the far side of the globe               */
  const _worldPos = new THREE.Vector3();
  function updateLabels() {
    const rect = heroSection.getBoundingClientRect();
    markers.forEach((m) => {
      m.sprite.getWorldPosition(_worldPos);
      const normal = _worldPos.clone().normalize();
      const camDir = camera.position.clone().sub(_worldPos).normalize();
      const front = normal.dot(camDir) > 0.15;

      const projected = _worldPos.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * rect.width;
      const y = (-projected.y * 0.5 + 0.5) * rect.height;
      m.labelEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -140%)`;
      m.labelEl.style.opacity = front ? '1' : '0';
    });
  }

  function renderOnce() {
    applyRotation();
    updateLabels();
    renderer.render(scene, camera);
    reveal();
  }

  if (reduceMotion) {
    renderOnce(); // static frame; drag still works via the listeners above, rendering on demand
    return; // no rAF loop — no autonomous motion
  }

  let clock = 0;
  function tick() {
    requestAnimationFrame(tick);
    if (!onScreen || document.hidden) return;

    if (!isDragging) {
      autoRotation += SPIN_SPEED;
      parallaxX += (targetRotX - parallaxX) * 0.04;
      parallaxY += (targetRotY - parallaxY) * 0.04;
      if (Math.abs(dragVelocityY) > 0.00005) {
        dragOffsetY += dragVelocityY;
        dragVelocityY *= 0.95;
      } else {
        dragVelocityY = 0;
      }
    }
    applyRotation();

    clock += 0.02;
    const pulse = 0.28 + Math.sin(clock) * 0.1;
    highlightGlows.forEach((g) => { g.material.opacity = pulse; });

    pulses.forEach((p) => {
      p.t += p.speed * 0.01;
      if (p.t > 1) p.t -= 1;
      const idx = p.t * ARC_SEGMENTS;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, ARC_SEGMENTS);
      p.sprite.position.lerpVectors(arcPoints[i0], arcPoints[i1], idx - i0);
    });

    updateLabels();
    renderer.render(scene, camera);
    reveal();
  }
  tick();
})();
