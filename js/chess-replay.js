/* ══════════════════════════════════════════════════════════════
   Latest chess game: pulls my most recent finished Chess.com game
   from their public API (no key; CORS-enabled), puts the board in
   the position just before the last few moves, and when the section
   scrolls into view plays those moves out on a pixel-art board —
   then reveals who won and how. Replay button runs it again.

   Chess rules/PGN parsing come from chess.js (BSD-2), loaded from
   the CDN via dynamic import() like three.js. The pieces are drawn
   here as pixel-art silhouettes (shaded + outlined automatically),
   not Unicode glyphs, so they look identical on every device.

   Progressive enhancement only: if the API is unreachable, the CDN
   is blocked, or no usable game turns up, the section just stays
   hidden — the rest of the page doesn't know the difference.
   ══════════════════════════════════════════════════════════════ */
(async function () {
  const section = document.getElementById('chess');
  if (!section) return;

  const USERNAME = 'Balubaidd'; // if this account is ever renamed, update it — Chess.com's games endpoints look the account up by name
  const REPLAY_PLIES = 3;          // how many of the game's final moves (plies) to play out
  const MONTHS_TO_SEARCH = 3;      // how far back to look if the latest month has nothing usable
  const CHESSJS_URL = 'https://unpkg.com/chess.js@1.4.0/dist/esm/chess.js';
  const CACHE_KEY = 'chess-latest:v2:' + USERNAME.toLowerCase(); // v2: entries now carry avatar URLs
  const CACHE_MS = 10 * 60 * 1000; // the API barely caches (max-age=5), so be polite
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let Chess;
  try {
    ({ Chess } = await import(CHESSJS_URL));
  } catch (err) {
    return; // offline / CDN blocked
  }

  /* ── data ─────────────────────────────────────────────────── */
  async function getJson(url) {
    if (!/^https:\/\/api\.chess\.com\//.test(url)) throw new Error('unexpected url');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  const slim = (g) => ({
    url: g.url, pgn: g.pgn, end_time: g.end_time, time_control: g.time_control,
    time_class: g.time_class, rated: g.rated, eco: g.eco,
    white: { username: g.white.username, rating: g.white.rating, result: g.white.result },
    black: { username: g.black.username, rating: g.black.rating, result: g.black.result },
  });

  async function findLatestGame() {
    const { archives } = await getJson(`https://api.chess.com/pub/player/${USERNAME.toLowerCase()}/games/archives`);
    for (let i = archives.length - 1; i >= Math.max(0, archives.length - MONTHS_TO_SEARCH); i--) {
      const { games } = await getJson(archives[i]);
      // standard chess only (variants need different setup handling), newest first
      const candidates = games.filter((g) => g.rules === 'chess' && g.pgn).sort((a, b) => b.end_time - a.end_time);
      for (const g of candidates) {
        try {
          const probe = new Chess();
          probe.loadPgn(g.pgn);
          if (probe.history().length >= 1) return slim(g); // skips games abandoned before a move
        } catch (err) { /* unparseable — try the next one */ }
      }
    }
    return null;
  }

  function readCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (c && Date.now() - c.t < CACHE_MS) return c.game;
    } catch (err) {}
    return null;
  }
  function writeCache(game) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), game })); } catch (err) {}
  }

  // profile picture, or '' if the player hasn't set one / the lookup fails —
  // only ever accepted from Chess.com's own image host
  async function fetchAvatar(username) {
    try {
      const profile = await getJson(`https://api.chess.com/pub/player/${username.toLowerCase()}`);
      return /^https:\/\/images\.chesscomfiles\.com\//.test(profile.avatar || '') ? profile.avatar : '';
    } catch (err) {
      return '';
    }
  }

  let game = readCache();
  if (!game) {
    try {
      game = await findLatestGame();
    } catch (err) {
      return; // API down / blocked / rate-limited
    }
    if (!game) return;
    const [white, black] = await Promise.all([fetchAvatar(game.white.username), fetchAvatar(game.black.username)]);
    game.avatars = { white, black };
    writeCache(game);
  }

  let history, replayMoves, startFen, precedingMove;
  try {
    const chess = new Chess();
    chess.loadPgn(game.pgn);
    history = chess.history({ verbose: true });
  } catch (err) {
    return;
  }
  const n = Math.min(REPLAY_PLIES, history.length);
  replayMoves = history.slice(history.length - n);
  startFen = replayMoves[0].before;
  precedingMove = history.length - n - 1 >= 0 ? history[history.length - n - 1] : null;

  /* ── who am I / who won / how ───────────────────────────── */
  const iAmWhite = game.white.username.toLowerCase() === USERNAME.toLowerCase();
  const iAmBlack = game.black.username.toLowerCase() === USERNAME.toLowerCase();
  // neither side is me (e.g. a stale cache after a username change): hide the
  // section rather than guess a side and show the board/result from the wrong one
  if (!iAmWhite && !iAmBlack) return;
  const me = iAmWhite ? game.white : game.black;
  const opp = iAmWhite ? game.black : game.white;
  const myColor = iAmWhite ? 'w' : 'b';

  const DECISIVE_BY = { checkmated: 'by checkmate', resigned: 'by resignation', timeout: 'on time', abandoned: 'by abandonment' };
  const DRAW_BY = {
    agreed: 'by agreement', repetition: 'by repetition', stalemate: 'by stalemate',
    insufficient: 'by insufficient material', '50move': 'by the 50-move rule',
    timevsinsufficient: 'timeout vs. insufficient material',
  };
  let outcome, title, detail;
  if (me.result === 'win') {
    outcome = 'win'; title = me.username + ' won'; detail = DECISIVE_BY[opp.result] || '';
  } else if (opp.result === 'win') {
    outcome = 'loss'; title = opp.username + ' won'; detail = DECISIVE_BY[me.result] || '';
  } else {
    outcome = 'draw'; title = 'Draw'; detail = DRAW_BY[me.result] || DRAW_BY[opp.result] || '';
  }

  /* ── pixel-art pieces: '#' = silhouette; outline, shade (right edge)
     and highlight (left edge) are derived, so each piece is just a shape ── */
  const SPRITE_W = 11, SPRITE_H = 12;
  const SPRITES = {
    p: ['...........', '...........', '....###....', '...#####...', '...#####...', '....###....',
        '...#####...', '....###....', '....###....', '...#####...', '..#######..', '..#######..'],
    r: ['...........', '.##.###.##.', '.#########.', '..#######..', '...#####...', '...#####...',
        '...#####...', '...#####...', '..#######..', '.#########.', '.#########.', '.#########.'],
    n: ['....##.....', '...####....', '..######...', '.#######...', '##.######..', '####.#####.',
        '####.######', '.##..######', '....#######', '.....######', '..#########', '.##########'],
    b: ['.....#.....', '....###....', '...#####...', '...##.##...', '...#####...', '....###....',
        '.....#.....', '....###....', '...#####...', '....###....', '..#######..', '..#######..'],
    q: ['.#...#...#.', '#.#.#.#.#.#', '.#########.', '.#########.', '..#######..', '...#####...',
        '...#####...', '....###....', '...#####...', '..#######..', '.#########.', '.#########.'],
    k: ['.....#.....', '...#####...', '.....#.....', '.....#.....', '..#######..', '.#########.',
        '.#########.', '..#######..', '...#####...', '..#######..', '.#########.', '.#########.'],
  };
  const spriteCache = {};
  function spriteSvg(type) {
    if (spriteCache[type]) return spriteCache[type];
    const rows = SPRITES[type];
    const solid = (x, y) => x >= 0 && x < SPRITE_W && y >= 0 && y < SPRITE_H && rows[y][x] === '#';
    const paths = { o: '', f: '', s: '', h: '' };
    for (let y = -1; y <= SPRITE_H; y++) {
      let cls = null, start = 0;
      const flush = (x) => {
        if (cls) paths[cls] += `M${start} ${y}h${x - start}v1h${start - x}z`;
      };
      for (let x = -1; x <= SPRITE_W + 1; x++) {
        let c = null;
        if (solid(x, y)) {
          if (!solid(x + 1, y) && solid(x - 1, y)) c = 's';
          else if (!solid(x - 1, y) && solid(x + 1, y)) c = 'h';
          else c = 'f';
        } else if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) {
          c = 'o';
        }
        if (c !== cls) { flush(x); cls = c; start = x; }
      }
    }
    const svg = `<svg viewBox="-1 -1 ${SPRITE_W + 2} ${SPRITE_H + 2}" preserveAspectRatio="xMidYMax meet" shape-rendering="crispEdges" aria-hidden="true">` +
      ['o', 'f', 's', 'h'].map((k) => `<path class="${k}" d="${paths[k]}"/>`).join('') + '</svg>';
    return (spriteCache[type] = svg);
  }

  /* ── board ────────────────────────────────────────────────── */
  const boardEl = document.getElementById('chessBoard');
  const flipped = myColor === 'b'; // always show my side at the bottom
  const FILES = 'abcdefgh';

  function coords(sq) {
    const f = FILES.indexOf(sq[0]), r = parseInt(sq[1], 10);
    return { x: flipped ? 7 - f : f, y: flipped ? r - 1 : 8 - r };
  }

  const squareEls = {};
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const f = flipped ? 7 - x : x;
      const r = flipped ? y + 1 : 8 - y;
      const sq = FILES[f] + r;
      const el = document.createElement('div');
      el.className = 'chess-sq ' + ((f + r) % 2 === 1 ? 'd' : 'l');
      if (x === 0) { const c = document.createElement('span'); c.className = 'chess-coord r'; c.textContent = r; el.appendChild(c); }
      if (y === 7) { const c = document.createElement('span'); c.className = 'chess-coord f'; c.textContent = FILES[f]; el.appendChild(c); }
      boardEl.appendChild(el);
      squareEls[sq] = el;
    }
  }
  const piecesEl = document.createElement('div');
  piecesEl.className = 'chess-pieces';
  boardEl.appendChild(piecesEl);

  let pieces = []; // { el, type, color, sq }
  const pieceAt = (sq) => pieces.find((p) => p.sq === sq);

  function place(el, sq) {
    const { x, y } = coords(sq);
    el.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
  }
  function addPiece(type, color, sq) {
    const el = document.createElement('div');
    el.className = 'chess-piece ' + color;
    el.innerHTML = spriteSvg(type);
    place(el, sq);
    piecesEl.appendChild(el);
    pieces.push({ el, type, color, sq });
  }

  function clearMarks() {
    Object.values(squareEls).forEach((el) => el.classList.remove('is-last', 'is-check'));
  }
  function markMove(m) {
    clearMarks();
    squareEls[m.from].classList.add('is-last');
    squareEls[m.to].classList.add('is-last');
  }

  function resetBoard() {
    piecesEl.innerHTML = '';
    pieces = [];
    clearMarks();
    new Chess(startFen).board().forEach((row) => row.forEach((cell) => {
      if (cell) addPiece(cell.type, cell.color, cell.square);
    }));
    if (precedingMove) markMove(precedingMove);
  }

  function applyMove(m, animate) {
    // en passant removes the pawn *behind* the destination, not on it
    const capturedSq = m.captured ? (m.flags.includes('e') ? m.to[0] + m.from[1] : m.to) : null;
    const victim = capturedSq && pieceAt(capturedSq);
    if (victim) {
      pieces = pieces.filter((p) => p !== victim);
      victim.el.classList.add('is-captured');
      setTimeout(() => victim.el.remove(), animate ? 500 : 0);
    }

    const mover = pieceAt(m.from);
    if (mover) {
      mover.sq = m.to;
      mover.el.classList.add('is-moving');
      place(mover.el, m.to);
      setTimeout(() => mover.el.classList.remove('is-moving'), animate ? 850 : 0);
      if (m.promotion) {
        setTimeout(() => { mover.type = m.promotion; mover.el.innerHTML = spriteSvg(m.promotion); }, animate ? 650 : 0);
      }
    }

    // castling moves the rook too
    if (m.flags.includes('k') || m.flags.includes('q')) {
      const rank = m.color === 'w' ? '1' : '8';
      const kingside = m.flags.includes('k');
      const rook = pieceAt((kingside ? 'h' : 'a') + rank);
      if (rook) { rook.sq = (kingside ? 'f' : 'd') + rank; place(rook.el, rook.sq); }
    }

    markMove(m);
    if (/[+#]$/.test(m.san)) {
      const king = pieces.find((p) => p.type === 'k' && p.color !== m.color);
      if (king) squareEls[king.sq].classList.add('is-check');
    }
  }

  /* ── players, moves, result, meta ────────────────────────── */
  function fillPlayer(el, who, color, avatarUrl) {
    el.textContent = '';

    // profile picture, with the piece color as a small badge on its corner;
    // players with no picture (or one that fails to load) get an initial tile
    const avatarWrap = document.createElement('span');
    avatarWrap.className = 'chess-avatar-wrap';
    const fallback = () => {
      const tile = document.createElement('span');
      tile.className = 'chess-avatar chess-avatar-fallback';
      tile.textContent = who.username.charAt(0);
      return tile;
    };
    if (avatarUrl) {
      const img = document.createElement('img');
      img.className = 'chess-avatar';
      img.src = avatarUrl;
      img.alt = '';
      img.width = img.height = 40;
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => img.replaceWith(fallback()));
      avatarWrap.appendChild(img);
    } else {
      avatarWrap.appendChild(fallback());
    }
    const swatch = document.createElement('span');
    swatch.className = 'chess-swatch ' + color;
    avatarWrap.appendChild(swatch);

    const name = document.createElement('span');
    name.className = 'chess-name';
    name.textContent = who.username;
    const rating = document.createElement('span');
    rating.className = 'chess-rating';
    rating.textContent = who.rating ? `(${who.rating})` : '';
    const tag = document.createElement('span');
    tag.className = 'chess-tag';
    tag.textContent = 'Winner';
    el.append(avatarWrap, name, rating, tag);
  }
  const topEl = document.getElementById('chessTop');
  const bottomEl = document.getElementById('chessBottom');
  const avatars = game.avatars || {};
  fillPlayer(topEl, opp, iAmWhite ? 'b' : 'w', iAmWhite ? avatars.black : avatars.white);
  fillPlayer(bottomEl, me, myColor, iAmWhite ? avatars.white : avatars.black);

  const movesEl = document.getElementById('chessMoves');
  const chips = replayMoves.map((m, k) => {
    const ply = history.length - n + k; // 0-based ply index in the whole game
    const li = document.createElement('li');
    li.className = 'chess-move';
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = Math.floor(ply / 2) + 1 + (ply % 2 === 0 ? '.' : '…');
    const san = document.createElement('span');
    san.textContent = m.san;
    li.append(num, san);
    movesEl.appendChild(li);
    return li;
  });

  const resultEl = document.getElementById('chessResult');
  function setResult(state) {
    resultEl.className = 'chess-result' + (state === 'done' ? ' is-' + outcome : '');
    resultEl.textContent = '';
    const t = document.createElement('span');
    t.className = 'chess-result-title';
    const d = document.createElement('span');
    d.className = 'chess-result-detail';
    if (state === 'done') {
      t.textContent = title;
      d.textContent = detail;
    } else {
      t.textContent = `Last ${n} move${n === 1 ? '' : 's'}`;
      d.textContent = 'Watch how it ended';
    }
    resultEl.append(t, d);
    const winnerEl = state === 'done' && outcome !== 'draw' ? (outcome === 'win' ? bottomEl : topEl) : null;
    [topEl, bottomEl].forEach((el) => el.classList.toggle('is-winner', el === winnerEl));
  }

  const TC_CLASS = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', daily: 'Daily' };
  function timeLabel(tc) {
    if (!tc) return '';
    if (tc.includes('/')) return 'Daily';
    const [base, inc] = tc.split('+').map(Number);
    const mins = base / 60;
    const b = mins >= 1 ? (Number.isInteger(mins) ? String(mins) : mins.toFixed(1)) : base + 's';
    return inc ? `${b}|${inc}` : mins >= 1 ? `${b} min` : b;
  }
  function openingName(url) {
    const slug = (url || '').split('/openings/')[1];
    if (!slug) return '';
    const words = [];
    for (const w of decodeURIComponent(slug).split('-')) {
      if (/^\d/.test(w)) break; // slug trails off into the move text ("3...exd5")
      words.push(w);
    }
    return words.join(' ');
  }
  const metaEl = document.getElementById('chessMeta');
  const when = new Date(game.end_time * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const metaParts = [TC_CLASS[game.time_class] || '', timeLabel(game.time_control), game.rated ? 'Rated' : 'Casual', when].filter(Boolean);
  metaEl.textContent = metaParts.join(' · ');
  const opening = openingName(game.eco);
  if (opening) {
    metaEl.appendChild(document.createElement('br'));
    metaEl.appendChild(document.createTextNode(opening));
  }

  const linkEl = document.getElementById('chessLink');
  if (/^https:\/\/www\.chess\.com\//.test(game.url || '')) linkEl.href = game.url;
  else linkEl.remove();

  /* ── playback ─────────────────────────────────────────────── */
  let runId = 0;
  async function play(animate) {
    const id = ++runId;
    resetBoard();
    chips.forEach((c) => c.classList.remove('is-played', 'is-current'));
    setResult('pending');
    await sleep(animate ? 700 : 250);
    for (let k = 0; k < replayMoves.length; k++) {
      if (id !== runId) return;
      chips.forEach((c, j) => {
        c.classList.toggle('is-current', j === k);
        c.classList.toggle('is-played', j < k);
      });
      applyMove(replayMoves[k], animate);
      await sleep(animate ? 1400 : 700);
    }
    if (id !== runId) return;
    chips.forEach((c) => { c.classList.add('is-played'); c.classList.remove('is-current'); });
    setResult('done');
  }

  function showFinal() { // reduced motion: no autoplay — land on the end state, replay is opt-in
    runId++;
    resetBoard();
    replayMoves.forEach((m) => applyMove(m, false));
    chips.forEach((c) => c.classList.add('is-played'));
    setResult('done');
  }

  document.getElementById('chessReplay').addEventListener('click', () => play(!reduceMotion));

  resetBoard();
  setResult('pending');
  section.hidden = false;

  if (reduceMotion) {
    showFinal();
  } else {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        play(true);
      }
    }, { threshold: 0.55 });
    io.observe(boardEl);
  }
})();
