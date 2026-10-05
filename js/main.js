/* ══════════════════════════════════════════════════════════════
   Shared behavior: scroll progress, scroll-reveal, resume-button
   reveal, and the custom cursor.
   Every selector guards for the element's existence, so this one
   file works unmodified across index.html and every project page.
   ══════════════════════════════════════════════════════════════ */
(function () {
  /* ── scroll progress bar ─────────────────────────────────── */
  const progress = document.getElementById('scrollProgress');
  if (progress) {
    const updateProgress = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      progress.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  /* ── scroll-reveal ────────────────────────────────────────── */
  const revealTargets = document.querySelectorAll('.exp-item, .project-card, .reveal');
  if (revealTargets.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 80);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    revealTargets.forEach((el) => observer.observe(el));
  }

  /* ── media fallback: swap a missing video for a placeholder ── */
  document.querySelectorAll('.project-video').forEach((video) => {
    video.addEventListener('error', () => {
      const placeholder = document.createElement('div');
      placeholder.className = 'video-placeholder';
      placeholder.innerHTML = '<span class="media-icon">▶</span>Flight/bench test footage coming soon';
      video.replaceWith(placeholder);
    });
  });

  /* ── resume buttons: reveal only once the PDF actually exists ─ */
  document.querySelectorAll('.resume-btn').forEach((el) => {
    fetch(el.getAttribute('href'), { method: 'HEAD' })
      .then((res) => { if (res.ok) el.style.display = ''; })
      .catch(() => {});
  });

  /* ── custom cursor (fine pointers only) ──────────────────── */
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!isFinePointer) return;

  document.body.classList.add('has-cursor');

  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  const label = document.getElementById('cursorLabel');

  if (dot && ring) {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.left = mouseX + 'px';
      dot.style.top = mouseY + 'px';
    });

    (function loop() {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      ring.style.left = ringX + 'px';
      ring.style.top = ringY + 'px';
      requestAnimationFrame(loop);
    })();

    window.addEventListener('mousedown', () => ring.classList.add('is-down'));
    window.addEventListener('mouseup', () => ring.classList.remove('is-down'));

    document.querySelectorAll('a, button, .hero-canvas, .hero-avatar-canvas').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        ring.classList.add('is-link');
        if (label) label.textContent = el.dataset.cursor || (el.classList.contains('project-card') ? 'View' : '');
      });
      el.addEventListener('mouseleave', () => {
        ring.classList.remove('is-link');
        if (label) label.textContent = '';
      });
    });
  }
})();
