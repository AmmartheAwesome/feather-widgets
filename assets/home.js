/* Feather Widgets home page. The hero is a small desktop: the app's own wallpapers (drawn with the same maths as
   Render.SceneWallpaper), and glass widgets that show your real time, day progress and a to-do list. Like the app,
   widgets drag freely and spring onto the nearest edge or neighbour, and they stop updating when you can't see them. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var desk = $('#desk');

  // ---------- smooth scrolling (off for reduced motion) ----------
  var lenis = null;
  try {
    if (!reduce && window.Lenis) {
      lenis = new Lenis({ duration: 1.05, smoothWheel: true });
      if (window.gsap) { gsap.ticker.add(function (t) { lenis.raf(t * 1000); }); gsap.ticker.lagSmoothing(0); }
      else (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
      $$('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var id = a.getAttribute('href'); if (id.length < 2) return;
          var el = $(id); if (!el) return;
          e.preventDefault(); lenis.scrollTo(el, { offset: -16 }); history.replaceState(null, '', id);
        });
      });
    }
  } catch (e) { lenis = null; }

  // ---------- wallpapers ----------
  var WALLS = {
    dusk:  { sky: ['#1E2A5A', '#E59A7A'], glow: '#FFD3A6', at: [0.62, 0.6], hills: ['#5A3F78', '#3D2C5E', '#261C40'] },
    dawn:  { sky: ['#BFD8EC', '#F6E7D4'], glow: '#FFF4DE', at: [0.72, 0.42], hills: ['#A9C3C9', '#86A9A6', '#5F8B83'], light: true },
    ocean: { sky: ['#0D3B4F', '#2E7C8C'], glow: '#9FE0D8', at: [0.3, 0.38], hills: ['#0F5162', '#0B3E4D', '#072C38'] },
    night: { sky: ['#0B1022', '#1A2140'], glow: '#3A4A86', at: [0.8, 0.25], hills: ['#171C33', '#12162A', '#0C0F1E'] },
    mist:  { sky: ['#D9D3E6', '#C7D6DE'], glow: '#F3EEF7', at: [0.25, 0.3], hills: [], light: true,
             blobs: [[0.75, 0.7, 0.5, '#B9C9E8'], [0.15, 0.85, 0.45, '#E8D2DE'], [0.55, 0.15, 0.4, '#D5E8E2']] }
  };
  var W = 1920, H = 1080, NS = 'http://www.w3.org/2000/svg';
  function hillPath(i, n) {
    var baseY = H * (0.62 + i * 0.1), amp = H * (0.07 - i * 0.012), d = 'M0 ' + H;
    for (var px = 0; px <= W; px += 16) {
      var t = px / W;
      var y = baseY - amp * (Math.sin(t * 5.1 + i * 1.7) * 0.6 + Math.sin(t * 11.3 + i * 0.9) * 0.25 + Math.sin(t * 2.3 + i * 2.6) * 0.5);
      d += ' L' + px + ' ' + y.toFixed(1);
    }
    return d + ' L' + W + ' ' + H + ' Z';
  }
  function radial(id, cx, cy, rx, ry, color, alpha) {
    // an ellipse-shaped glow: radius rx of the width, ry of the height (as WPF's RadialGradientBrush draws it)
    return '<radialGradient id="' + id + '" gradientUnits="userSpaceOnUse" cx="' + cx * W + '" cy="' + cy * H + '" r="' + rx * W +
      '" gradientTransform="translate(' + cx * W + ' ' + cy * H + ') scale(1 ' + (ry * H) / (rx * W) + ') translate(' + -cx * W + ' ' + -cy * H + ')">' +
      '<stop offset="0" stop-color="' + color + '" stop-opacity="' + alpha + '"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></radialGradient>';
  }
  function wallSvg(name) {
    var w = WALLS[name], defs = '', body = '';
    defs += '<linearGradient id="' + name + '-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + w.sky[0] + '"/><stop offset="1" stop-color="' + w.sky[1] + '"/></linearGradient>';
    defs += radial(name + '-glow', w.at[0], w.at[1], 0.45, 0.6, w.glow, 0.69);
    body += '<rect width="' + W + '" height="' + H + '" fill="url(#' + name + '-sky)"/><rect width="' + W + '" height="' + H + '" fill="url(#' + name + '-glow)"/>';
    (w.blobs || []).forEach(function (b, i) {
      defs += radial(name + '-b' + i, b[0], b[1], b[2], b[2] * 1.6, b[3], 0.75);
      body += '<rect width="' + W + '" height="' + H + '" fill="url(#' + name + '-b' + i + ')"/>';
    });
    w.hills.forEach(function (c, i) { body += '<path d="' + hillPath(i) + '" fill="' + c + '"/>'; });
    return '<svg xmlns="' + NS + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" data-wall="' + name + '"><defs>' + defs + '</defs>' + body + '</svg>';
  }
  var walls = $('#walls'), current = 'dusk';
  walls.innerHTML = Object.keys(WALLS).map(wallSvg).join('');
  $('svg[data-wall="dusk"]', walls).classList.add('on');

  function setWall(name, fromUser) {
    if (name === current || !WALLS[name]) return;
    var next = $('svg[data-wall="' + name + '"]', walls), prev = $('svg[data-wall="' + current + '"]', walls);
    current = name;
    $$('.w-walls button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.wall === name)); });
    desk.classList.toggle('light', !!WALLS[name].light);
    walls.appendChild(next);   // on top of the old one, so the crossfade never shows a gap
    if (window.gsap && !reduce) {
      gsap.killTweensOf(next);
      gsap.fromTo(next, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out', onComplete: function () { if (prev !== next) prev.classList.remove('on'); } });
      next.classList.add('on');
    } else { next.classList.add('on'); next.style.opacity = ''; prev.classList.remove('on'); }
    if (fromUser) tick('wall');
  }
  $$('.w-walls button').forEach(function (b) { b.addEventListener('click', function () { setWall(b.dataset.wall, true); }); });

  // ---------- to-do: the tasks tick themselves when you do them ----------
  var isTouch = matchMedia('(hover: none)').matches;
  if (isTouch) $('.task-drag').textContent = 'Scroll through the widgets';
  function left() {
    var n = $$('.w-todo input').filter(function (i) { return !i.checked; }).length;
    $('#todo-left').textContent = n ? n + ' left' : 'All done';
  }
  function tick(task) { var i = $('.w-todo input[data-task="' + task + '"]'); if (i && !i.checked) { i.checked = true; left(); } }
  $$('.w-todo input').forEach(function (i) { i.addEventListener('change', left); });
  $$('[data-get]').forEach(function (a) { a.addEventListener('click', function () { tick('get'); }); });
  if (isTouch && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es, o) { es.forEach(function (e) { if (e.isIntersecting) { tick('drag'); o.disconnect(); } }); }, { threshold: 0.3 }).observe($('#widgets'));
  }

  // ---------- live clock and progress (only while the hero is on screen and the tab is visible) ----------
  var timer = 0, inView = true;
  var fmtTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  var fmtWd = new Intl.DateTimeFormat(undefined, { weekday: 'long' });
  var fmtMd = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric' });
  function pct(v) { return (v * 100).toFixed(v < 0.1 ? 1 : 0) + '%'; }
  function render() {
    var now = new Date();
    var parts = fmtTime.formatToParts(now), t = '', ap = '';
    parts.forEach(function (p) { if (p.type === 'dayPeriod') ap = p.value; else if (p.type !== 'literal' || !ap) t += p.value; });
    $('#clk-t').textContent = t.trim();
    $('#clk-ap').textContent = ap;
    $('#clk-wd').textContent = fmtWd.format(now);
    $('#clk-md').textContent = fmtMd.format(now);
    var s = now.getSeconds();
    $('#clk-s').textContent = (s < 10 ? '0' : '') + s;
    $('#clk-bar').style.width = (s / 59 * 100) + '%';
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var day = (now - start) / 864e5;
    var wk = ((now.getDay() + 6) % 7 + day) / 7;   // weeks start on Monday
    var y0 = new Date(now.getFullYear(), 0, 1), y1 = new Date(now.getFullYear() + 1, 0, 1);
    var yr = (now - y0) / (y1 - y0);
    [['day', day], ['week', wk], ['year', yr]].forEach(function (p) {
      $('#p-' + p[0]).style.width = (p[1] * 100).toFixed(2) + '%';
      $('#p-' + p[0] + '-v').textContent = pct(p[1]);
    });
  }
  function schedule() {
    clearTimeout(timer);
    if (!inView || document.hidden) return;
    render();
    timer = setTimeout(schedule, 1000 - (Date.now() % 1000) + 10);
  }
  document.addEventListener('visibilitychange', schedule);
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { inView = es[0].isIntersecting; schedule(); }).observe(desk);
  schedule();

  // ---------- layout: widgets float on wide screens, stack on small ones ----------
  var floating = matchMedia('(min-width: 1000px) and (min-height: 600px)');
  var widgets = $$('.w', desk), pos = new Map(), z = 1;
  var GAP = 16;
  function margin() { return Math.max(24, Math.min(64, desk.clientWidth * 0.045)); }
  function layout() {
    widgets.forEach(function (w) { w.style.left = w.style.top = ''; w.style.transform = ''; w.style.zIndex = ''; });
    pos.clear();
    if (!floating.matches) return;
    var dw = desk.clientWidth, dh = desk.clientHeight, m = margin(), top = 96;
    var title = $('.w-title', desk), clock = $('.w-clock', desk), todo = $('.w-todo', desk), prog = $('.w-prog', desk), wp = $('.w-walls', desk);
    function place(el, x, y) { el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px'; pos.set(el, { x: 0, y: 0 }); }
    var th = title.offsetHeight;
    place(title, m, Math.max(top, (dh - th) / 2 - 10));
    place(clock, dw - m - clock.offsetWidth, top);
    place(todo, dw - m - clock.offsetWidth, top + clock.offsetHeight + GAP);
    place(prog, dw - m - prog.offsetWidth, top + clock.offsetHeight + GAP);
    place(wp, dw - m - wp.offsetWidth, dh - m - wp.offsetHeight);
  }

  // ---------- drag and snap (mouse and pen; touch scrolls the page) ----------
  function rectOf(el) { var r = el.getBoundingClientRect(), d = desk.getBoundingClientRect(); return { x: r.left - d.left, y: r.top - d.top, w: r.width, h: r.height }; }
  function snapAxis(v, size, lo, hi, guides) {
    // nearest guide within reach, like the app's SnapEdges; otherwise stay put, kept on screen
    var best = v, dist = 40;
    guides.forEach(function (g) { [g, g - size].forEach(function (c) { var dd = Math.abs(c - v); if (dd < dist) { dist = dd; best = c; } }); });
    return Math.max(lo, Math.min(hi - size, best));
  }
  widgets.forEach(function (el) {
    if (!window.Spring) return;
    var sx = new Spring.Spring({ onUpdate: function (v) { pos.get(el) && (pos.get(el).x = v); apply(); } });
    var sy = new Spring.Spring({ onUpdate: function (v) { pos.get(el) && (pos.get(el).y = v); apply(); } });
    var vx = new Spring.VelocityTracker(), vy = new Spring.VelocityTracker();
    var grab = null, moved = false, startX = 0, startY = 0;
    function apply() { var p = pos.get(el); if (p) el.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)'; }
    el.addEventListener('pointerenter', function () { el.classList.toggle('grab', floating.matches); });
    el.addEventListener('pointerdown', function (e) {
      if (!floating.matches || e.pointerType === 'touch' || e.button !== 0) return;
      if (e.target.closest('a, button, input, label')) return;
      var p = pos.get(el); if (!p) return;
      sx.stop(); sy.stop(); vx.reset(); vy.reset();
      grab = { x: e.clientX - p.x, y: e.clientY - p.y }; moved = false; startX = e.clientX; startY = e.clientY;
      el.style.zIndex = ++z;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      if (!grab) return;
      if (!moved && Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) < 4) return;
      if (!moved) { moved = true; el.classList.add('dragging'); }
      var x = e.clientX - grab.x, y = e.clientY - grab.y;
      sx.set(x); sy.set(y); vx.add(x); vy.add(y);
    });
    function end() {
      if (!grab) return;
      grab = null; el.classList.remove('dragging');
      if (!moved) return;
      var r = rectOf(el), p = pos.get(el), m = margin();
      var vX = vx.velocity(), vY = vy.velocity();
      var px = r.x + Spring.project(vX, 0.99), py = r.y + Spring.project(vY, 0.99);
      var gx = [m, desk.clientWidth - m], gy = [Math.max(m, 88), desk.clientHeight - m];
      widgets.forEach(function (o) {
        if (o === el) return;
        var q = rectOf(o);
        gx.push(q.x - GAP, q.x + q.w + GAP, q.x, q.x + q.w);
        gy.push(q.y - GAP, q.y + q.h + GAP, q.y, q.y + q.h);
      });
      var nx = snapAxis(px, r.w, m, desk.clientWidth - m, gx), ny = snapAxis(py, r.h, Math.min(88, m), desk.clientHeight - m, gy);
      sx.to(p.x + (nx - r.x), { velocity: vX, damping: 0.86, response: 0.42 });
      sy.to(p.y + (ny - r.y), { velocity: vY, damping: 0.86, response: 0.42 });
      tick('drag');
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  });

  var rt = 0;
  addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 120); });
  floating.addEventListener ? floating.addEventListener('change', layout) : floating.addListener(layout);

  // ---------- screenshot tabs ----------
  var SHOTS = [
    ['1-hero', 'A Glass Digital clock, Weather, To-do and PC Monitor on one desktop.', 'A desktop with a digital clock, a weather forecast for Colombo, a to-do list and a PC monitor.'],
    ['2-clocks', 'Analog, Rings, Dot Matrix, Seven Segment, Text Clock and Minimal. Flip, Word Clock, Nixie Tube and more come with Pro.', 'Six clock widgets: analog, rings, dot matrix, seven segment, a clock in words and a minimal clock.'],
    ['3-weather', 'Weather at three sizes, from MET Norway forecasts, refreshed every 30 minutes to 3 hours.', 'The Weather widget at small, wide and large sizes, with hourly and daily forecasts.'],
    ['4-lists', 'To-do, Notes, Habits, a Focus Timer and Word of the Day.', 'A to-do list, notes, a weekly habit tracker, a 25-minute focus timer and a word of the day.'],
    ['5-system', 'PC Monitor, Network Speed, Disks, Battery and System Info.', 'System widgets showing processor, graphics, memory and network use, disks, battery and PC details.'],
    ['6-style', 'The same clock with three fonts, text colours and glass styles. Every widget can be styled like this.', 'Three copies of the Glass Digital clock in different fonts, colours and glass.'],
    ['8-wellbeing', 'Screen Time, Eye Rest, Breathe and Water, with Calculator and Day Progress.', 'Wellbeing widgets: screen time today, an eye rest reminder, a breathing guide and a water counter, with a calculator and day progress bars.'],
    ['9-prayer', 'Prayer Times is free. Hijri & Date and Tasbih come with Pro.', 'Prayer times with a countdown to Dhuhr, a Hijri date widget and a tasbih counter.'],
    ['7-gallery', 'The gallery shows every widget live. Drag one out onto your desktop, or click it to customise it first.', 'The Feather Widgets gallery window showing clock widgets.']
  ];
  // tab order on the page: Everyday, Clocks, Weather, Lists, PC, Wellbeing, Prayer, Style, Gallery
  var ORDER = [0, 1, 2, 3, 4, 6, 7, 5, 8];
  var tabs = $$('.tabs [role="tab"]'), img = $('#shot-img'), cap = $('#shot-cap'), panel = $('#shot');
  SHOTS.forEach(function (s) { var i = new Image(); i.decoding = 'async'; i.dataset.k = s[0]; });
  function show(ti, focus) {
    var s = SHOTS[ORDER[ti]];
    tabs.forEach(function (t, i) { t.setAttribute('aria-selected', String(i === ti)); t.tabIndex = i === ti ? 0 : -1; });
    panel.setAttribute('aria-labelledby', tabs[ti].id);
    if (focus) tabs[ti].focus();
    var src = 'assets/shots/' + s[0] + '-1600.webp', set = 'assets/shots/' + s[0] + '-800.webp 800w, ' + src + ' 1600w';
    cap.textContent = s[1];
    if (img.dataset.k === s[0]) return;
    img.dataset.k = s[0];
    var next = new Image(); next.srcset = set; next.sizes = img.sizes; next.src = src;
    function swap() {
      img.srcset = set; img.src = src; img.alt = s[2];
      if (window.gsap && !reduce) gsap.fromTo(img, { opacity: 0.35 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
    }
    if (next.decode) next.decode().then(swap, swap); else swap();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { show(i); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, n = tabs.length, j = k === 'ArrowRight' ? (i + 1) % n : k === 'ArrowLeft' ? (i - 1 + n) % n : k === 'Home' ? 0 : k === 'End' ? n - 1 : -1;
      if (j < 0) return; e.preventDefault(); show(j, true);
    });
  });
  img.dataset.k = SHOTS[0][0]; img.alt = SHOTS[0][2]; cap.textContent = SHOTS[0][1];
  // warm the other screenshots once the page is idle, so tab switches are instant
  (window.requestIdleCallback || function (f) { setTimeout(f, 1500); })(function () {
    SHOTS.forEach(function (s) { var i = new Image(); i.src = 'assets/shots/' + s[0] + (innerWidth > 900 ? '-1600' : '-800') + '.webp'; });
  });

  // ---------- one entrance: the widgets settle onto the wallpaper ----------
  function boot() {
    layout();
    if (!window.gsap || reduce) return;
    var ws = widgets.slice();
    gsap.from(walls, { opacity: 0, duration: 0.5, ease: 'power1.out' });
    gsap.from(ws, { opacity: 0, y: 14, duration: 0.7, ease: 'power3.out', stagger: 0.06, delay: 0.08,
      clearProps: 'opacity', onUpdate: function () {}, onComplete: function () { ws.forEach(function (w) { var p = pos.get(w); w.style.transform = p ? 'translate(' + p.x + 'px,' + p.y + 'px)' : ''; }); } });
  }
  if (document.fonts && document.fonts.ready) {
    var done = false, go = function () { if (!done) { done = true; boot(); } };
    document.fonts.ready.then(go); setTimeout(go, 1500);
  } else boot();
})();
