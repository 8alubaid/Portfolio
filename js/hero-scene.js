/* ══════════════════════════════════════════════════════════════
   Hero background: an interactive WebGL node network rendered
   with three.js — nodes on a sphere, connected to their nearest
   neighbors, with small "data pulse" sprites traveling the edges.
   Meant to read as a distributed/networked system, tying into the
   "Embedded · Networking · Cloud" line right next to it.

   Progressive enhancement only: if the CDN import fails, WebGL is
   unsupported, or the user prefers reduced motion, this quietly
   does nothing and the CSS radial glow underneath carries the hero.
   ══════════════════════════════════════════════════════════════ */
(async function () {
  const canvas = document.getElementById('heroCanvas');
  const heroSection = document.getElementById('hero');
  if (!canvas || !heroSection) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let THREE;
  try {
    THREE = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
  } catch (err) {
    return; // offline or CDN blocked — CSS glow remains the fallback
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (err) {
    return; // WebGL unsupported
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  function resize() {
    const w = heroSection.clientWidth;
    const h = heroSection.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ── build nodes evenly across a sphere (Fibonacci lattice) ── */
  const NODE_COUNT = window.innerWidth < 768 ? 40 : 70;
  const RADIUS = 5.4;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const nodes = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const y = 1 - (i / (NODE_COUNT - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    nodes.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(RADIUS));
  }

  /* ── connect each node to its nearest few neighbors ─────────── */
  const K = 3;
  const edgePositions = [];
  nodes.forEach((n, i) => {
    const nearest = nodes
      .map((m, j) => ({ j, d: i === j ? Infinity : n.distanceTo(m) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, K);
    nearest.forEach(({ j }) => {
      edgePositions.push(n.x, n.y, n.z, nodes[j].x, nodes[j].y, nodes[j].z);
    });
  });

  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  const edges = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({ color: 0x7c6af7, transparent: true, opacity: 0.22 })
  );

  /* ── soft circular sprite texture, reused for nodes + pulses ── */
  function makeDotTexture() {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(196,181,253,0.85)');
    g.addColorStop(1, 'rgba(196,181,253,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }
  const dotTexture = makeDotTexture();

  const nodePositions = new Float32Array(nodes.length * 3);
  nodes.forEach((n, i) => {
    nodePositions[i * 3] = n.x;
    nodePositions[i * 3 + 1] = n.y;
    nodePositions[i * 3 + 2] = n.z;
  });
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.Float32BufferAttribute(nodePositions, 3));
  const points = new THREE.Points(
    nodeGeo,
    new THREE.PointsMaterial({
      size: 0.22,
      map: dotTexture,
      transparent: true,
      depthWrite: false,
      color: 0xc4b5fd,
      blending: THREE.AdditiveBlending,
    })
  );

  const group = new THREE.Group();
  group.add(edges, points);
  scene.add(group);

  /* ── traveling "data pulse" sprites along random edges ──────── */
  const PULSE_COUNT = 9;
  const pulses = [];
  for (let i = 0; i < PULSE_COUNT; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: dotTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    sprite.scale.setScalar(0.34);
    let a = nodes[(Math.random() * nodes.length) | 0];
    let b = nodes[(Math.random() * nodes.length) | 0];
    while (b === a) b = nodes[(Math.random() * nodes.length) | 0];
    pulses.push({ sprite, a, b, t: Math.random(), speed: 0.25 + Math.random() * 0.35 });
    group.add(sprite);
  }

  /* ── pointer parallax (eased, independent of auto-spin) ─────── */
  let targetRotX = 0, targetRotY = 0, parallaxX = 0, parallaxY = 0, autoRotation = 0;
  window.addEventListener('mousemove', (e) => {
    const r = heroSection.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) return;
    targetRotY = ((e.clientX - r.left) / r.width - 0.5) * 0.6;
    targetRotX = ((e.clientY - r.top) / r.height - 0.5) * 0.4;
  });

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

  if (reduceMotion) {
    renderer.render(scene, camera);
    reveal();
    return; // static single frame only — no rAF loop, no spin, no parallax
  }

  function tick() {
    requestAnimationFrame(tick);
    if (!onScreen || document.hidden) return;

    autoRotation += 0.0022;
    parallaxX += (targetRotX - parallaxX) * 0.04;
    parallaxY += (targetRotY - parallaxY) * 0.04;
    group.rotation.x = parallaxX;
    group.rotation.y = autoRotation + parallaxY;

    pulses.forEach((p) => {
      p.t += p.speed * 0.01;
      if (p.t >= 1) {
        p.t = 0;
        p.a = p.b;
        let next = nodes[(Math.random() * nodes.length) | 0];
        while (next === p.a) next = nodes[(Math.random() * nodes.length) | 0];
        p.b = next;
      }
      p.sprite.position.lerpVectors(p.a, p.b, p.t);
    });

    renderer.render(scene, camera);
    reveal();
  }
  tick();
})();
