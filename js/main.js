/* ══════════════════════════════════════════════════════════════
   Shared behavior: scroll progress, scroll-reveal, custom cursor,
   magnetic buttons, ambient glow parallax, project-card glow.
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

    document.querySelectorAll('a, button').forEach((el) => {
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

  /* ── magnetic pull ────────────────────────────────────────── */
  document.querySelectorAll('.magnetic').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const relX = e.clientX - r.left - r.width / 2;
      const relY = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${relX * 0.3}px, ${relY * 0.3}px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'translate(0, 0)';
    });
  });

  /* ── ambient glow parallax (hero / project-hero) ─────────── */
  document.querySelectorAll('.glow-section').forEach((section) => {
    const glow = section.querySelector('.glow');
    if (!glow) return;
    const isHome = section.id === 'hero';
    const restX = isHome ? -60 : -50;
    section.addEventListener('mousemove', (e) => {
      const r = section.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      glow.style.transform = `translate(${restX + px * 18}%, ${-50 + py * 18}%)`;
    });
    section.addEventListener('mouseleave', () => {
      glow.style.transform = `translate(${restX}%, -50%)`;
    });
  });

  /* ── avatar tilt (home only) ──────────────────────────────── */
  const avatar = document.getElementById('heroAvatar');
  if (avatar) {
    avatar.addEventListener('mousemove', (e) => {
      const r = avatar.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      avatar.style.transform = `rotateX(${-py * 12}deg) rotateY(${px * 12}deg)`;
    });
    avatar.addEventListener('mouseleave', () => {
      avatar.style.transform = 'rotateX(0) rotateY(0)';
    });
  }

  /* ── project-card cursor-following glow + 3D tilt + photo parallax ── */
  document.querySelectorAll('.project-card').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const relX = e.clientX - r.left;
      const relY = e.clientY - r.top;
      const px = relX / r.width - 0.5;
      const py = relY / r.height - 0.5;
      card.style.setProperty('--gx', `${relX}px`);
      card.style.setProperty('--gy', `${relY}px`);
      card.style.setProperty('--ry', `${px * 8}deg`);
      card.style.setProperty('--rx', `${-py * 8}deg`);
      card.style.setProperty('--ix', `${-px * 16}px`);
      card.style.setProperty('--iy', `${-py * 12}px`);
    });
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ix', '0px');
      card.style.setProperty('--iy', '0px');
    });
  });

  /* ── 3D cursor-tilt on pagination cards (no photo, tilt only) ── */
  document.querySelectorAll('.pagination-link').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', `${px * 8}deg`);
      card.style.setProperty('--rx', `${-py * 8}deg`);
    });
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--rx', '0deg');
    });
  });
})();
