/* ══════════════════════════════════════════════════════════════
   Coursework archive — draws the "parts cabinet" of category drawers
   and the project list from js/coursework-data.js. Click a drawer to
   file-filter the list to that category; click it again (or "Show
   all") to see everything. The chosen drawer is mirrored in the URL
   hash (coursework.html#electronics) so a drawer can be linked to.

   All text goes in with textContent, and links are only used when
   they point at a page in this site or under github.com/8alubaid/.
   ══════════════════════════════════════════════════════════════ */
(function () {
  const data = window.COURSEWORK;
  const cabinetEl = document.getElementById('cwCabinet');
  const listEl = document.getElementById('cwList');
  const statusEl = document.getElementById('cwStatus');
  if (!data || !cabinetEl || !listEl || !statusEl) return;

  const plural = (n) => n + ' project' + (n === 1 ? '' : 's');
  const SAFE_PAGE = /^[a-z0-9-]+\.html$/i;
  const SAFE_GITHUB = /^https:\/\/github\.com\/8alubaid\//;

  const projects = data.projects.filter((p) => p && p.title && p.summary);
  const nameOf = {};
  data.categories.forEach((c) => { nameOf[c.id] = c.name; });
  // a drawer only exists once something is filed in it
  const drawers = data.categories.filter((c) => projects.some((p) => p.category === c.id));

  let active = null; // category id, or null for "everything"

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ── the cabinet ─────────────────────────────────────────── */
  const drawerEls = {};
  drawers.forEach((c) => {
    const n = projects.filter((p) => p.category === c.id).length;
    const btn = el('button', 'drawer');
    btn.type = 'button';
    btn.setAttribute('aria-pressed', 'false');
    btn.append(
      el('span', 'drawer-plate', c.name),
      el('span', 'drawer-count', plural(n)),
      el('span', 'drawer-blurb', c.blurb || ''),
      el('span', 'drawer-handle')
    );
    btn.addEventListener('click', () => select(active === c.id ? null : c.id, true));
    cabinetEl.appendChild(btn);
    drawerEls[c.id] = btn;
  });

  /* ── the list ────────────────────────────────────────────── */
  function renderItem(p, i) {
    const li = el('li', 'cw-item');
    li.style.setProperty('--i', i);

    const head = el('div', 'cw-head');
    head.append(el('h3', 'cw-name', p.title));
    if (nameOf[p.category]) head.append(el('span', 'cw-cat', nameOf[p.category]));
    li.appendChild(head);

    const meta = [p.course, p.term].filter(Boolean).join(' · ');
    if (meta) li.appendChild(el('p', 'cw-meta', meta));
    li.appendChild(el('p', 'cw-summary', p.summary));

    if (p.tags && p.tags.length) {
      const tags = el('div', 'project-tags');
      p.tags.forEach((t) => tags.appendChild(el('span', 'tag', t)));
      li.appendChild(tags);
    }

    const links = el('div', 'cw-links');
    if (SAFE_PAGE.test(p.page || '')) {
      const a = el('a', 'cw-link', 'Read the write-up →');
      a.href = p.page;
      links.appendChild(a);
    }
    if (SAFE_GITHUB.test(p.github || '')) {
      const a = el('a', 'cw-link', 'Code on GitHub ↗');
      a.href = p.github;
      a.target = '_blank';
      a.rel = 'noopener';
      links.appendChild(a);
    }
    if (links.children.length) li.appendChild(links);
    return li;
  }

  function select(id, updateHash) {
    active = drawers.some((c) => c.id === id) ? id : null;
    Object.keys(drawerEls).forEach((k) => drawerEls[k].setAttribute('aria-pressed', String(k === active)));

    const shown = active ? projects.filter((p) => p.category === active) : projects;
    listEl.textContent = '';
    shown.forEach((p, i) => listEl.appendChild(renderItem(p, i)));

    statusEl.textContent = '';
    statusEl.appendChild(el('span', null, (active ? nameOf[active] : 'All coursework') + ' · ' + plural(shown.length)));
    if (active) {
      const clear = el('button', 'cw-clear', 'Show all');
      clear.type = 'button';
      clear.addEventListener('click', () => select(null, true));
      statusEl.appendChild(clear);
    }

    if (updateHash) {
      try { history.replaceState(null, '', active ? '#' + active : location.pathname + location.search); } catch (err) {}
    }
  }

  const fromHash = () => decodeURIComponent(location.hash.slice(1));
  window.addEventListener('hashchange', () => select(fromHash(), false));
  select(fromHash(), false);
})();
