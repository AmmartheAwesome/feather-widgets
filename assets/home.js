/* Feather Widgets home (revamp 2026-11-26). One signature: the page window scrolls up over the wallpaper, and a
   widget it fully covers stops ticking, as the app's widgets do; the window's title bar says how many are paused.
   Also: the island opens once on load (then on hover or tap), the group chips' pill slides like the app's, and the two
   widgets can be dragged (mouse) and tapped to change their glass, settling onto even edges as the app's do. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var hasGsap = typeof window.gsap !== 'undefined';

  // ---------- smooth scrolling (light), off for reduced motion ----------
  var lenis = null;
  if (!reduce && typeof window.Lenis === 'function') {
    try {
      lenis = new Lenis({ lerp: 0.14, wheelMultiplier: 0.9 });
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
      $$('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var id = a.getAttribute('href'); if (id.length < 2) return;
          var el = document.querySelector(id); if (!el) return;
          e.preventDefault(); lenis.scrollTo(el, { offset: -72 });
          history.replaceState(null, '', id);
        });
      });
    } catch (e) { lenis = null; }
  }

  // ---------- the widgets on the wallpaper: live, and paused while covered ----------
  var widgets = $$('[data-widget]').map(function (el) { return { el: el, paused: false }; });
  var main = $('#main'), stage = $('#stage'), status = $('#status');
  var fmt;
  try { fmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }); } catch (e) { fmt = null; }
  var wdFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });
  var dtFmt = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });

  function timeParts(d) {
    var h = '', m = '', ap = '';
    if (fmt && fmt.formatToParts) {
      fmt.formatToParts(d).forEach(function (p) { if (p.type === 'hour') h = p.value; if (p.type === 'minute') m = p.value; if (p.type === 'dayPeriod') ap = p.value.toUpperCase(); });
    }
    if (!h) { h = String(d.getHours()); m = String(d.getMinutes()).padStart(2, '0'); }
    return { hm: h + ':' + m, ap: ap };
  }
  function pct(a, b) { return Math.max(0, Math.min(100, a / b * 100)); }

  function drawClock(d) {
    var t = timeParts(d);
    $('#hm').textContent = t.hm;
    var ap = $('#ap'); ap.textContent = t.ap; ap.hidden = !t.ap;
    $('#wd').textContent = wdFmt.format(d);
    $('#dt').textContent = dtFmt.format(d);
    $('#secbar').style.width = (d.getSeconds() / 59 * 100).toFixed(1) + '%';
    fitClock(false);
  }
  // The card keeps its size, as the app's widgets do, so the text fits itself to the card: "12:58" with
  // "Wednesday, September 30" is about 50 px wider than "7:37" with "Thursday, November 26". Measured only when the
  // words or the card's width change (once a minute at most), never every second.
  var fitKey = '';
  function fitClock(force) {
    var card = $('.w-clock'), hm = $('#hm'), dt = $('#dt'), time = $('.clock-time'), side = $('.clock-side');
    if (!card || !card.clientWidth) return;   // hidden (small phones)
    var key = hm.textContent + '|' + $('#ap').textContent + '|' + $('#wd').textContent + '|' + dt.textContent + '|' + card.clientWidth;
    if (!force && key === fitKey) return;
    fitKey = key;
    hm.style.fontSize = ''; dt.style.fontSize = '';
    var cs = getComputedStyle(card);
    var room = card.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (parseFloat(cs.columnGap) || 0);
    var over = time.scrollWidth + side.scrollWidth - room;
    if (over <= 0) return;
    var hmW = hm.getBoundingClientRect().width, base = parseFloat(getComputedStyle(hm).fontSize);
    hm.style.fontSize = Math.max(base * 0.7, Math.floor(base * (hmW - over) / hmW)) + 'px';
    over = time.scrollWidth + side.scrollWidth - room;
    if (over > 0) {   // still too wide: the date gives a little too
      var dtW = dt.getBoundingClientRect().width, dtBase = parseFloat(getComputedStyle(dt).fontSize);
      dt.style.fontSize = Math.max(dtBase * 0.75, Math.floor(dtBase * (dtW - over) / dtW)) + 'px';
    }
  }
  addEventListener('resize', function () { fitClock(true); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitClock(true); });
  function drawProgress(d) {
    var dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = pct(d - dayStart, 864e5);
    var dow = (d.getDay() + 6) % 7;   // Monday first
    var week = pct(dow * 864e5 + (d - dayStart), 7 * 864e5);
    var y0 = new Date(d.getFullYear(), 0, 1), y1 = new Date(d.getFullYear() + 1, 0, 1);
    var year = pct(d - y0, y1 - y0);
    [['day', day], ['week', week], ['year', year]].forEach(function (p) {
      $('#p' + p[0]).style.width = p[1].toFixed(1) + '%';
      $('#t' + p[0]).textContent = Math.floor(p[1]) + '%';
    });
  }
  function tick() {
    var d = new Date();
    widgets.forEach(function (w) {
      if (w.paused) return;
      if (w.el.dataset.widget === 'clock') drawClock(d);
      if (w.el.dataset.widget === 'progress') drawProgress(d);
    });
    var t = timeParts(d); $('#pilltime').textContent = t.hm + (t.ap ? ' ' + t.ap : '');
  }
  tick();
  setTimeout(function () { tick(); setInterval(tick, 1000); }, 1000 - new Date().getMilliseconds());

  // covered = the window fully covers the widget (as in the app: a widget rests only when completely hidden)
  var lastPaused = -1;
  function checkCover() {
    var r = main.getBoundingClientRect();
    stage.classList.toggle('past', r.top < innerHeight * 0.35);
    var n = 0;
    widgets.forEach(function (w) {
      var b = w.el.getBoundingClientRect();
      var visible = getComputedStyle(w.el).display !== 'none';
      var covered = visible && r.top <= b.top + 1 && r.bottom >= b.bottom - 1;
      if (covered !== w.paused) {
        w.paused = covered;
        w.el.classList.toggle('paused', covered);
        if (!covered) tick();   // catch up at once when uncovered
      }
      if (covered) n++;
    });
    if (n !== lastPaused) {
      lastPaused = n;
      status.textContent = n === 0 ? 'Your widgets are running' : (n === 1 ? '1 widget paused while covered' : n + ' widgets paused while covered');
      status.classList.toggle('paused', n > 0);
    }
  }
  var coverQueued = false;
  function queueCover() { if (coverQueued) return; coverQueued = true; requestAnimationFrame(function () { coverQueued = false; checkCover(); }); }
  addEventListener('scroll', queueCover, { passive: true });
  addEventListener('resize', queueCover);
  checkCover();

  // ---------- move the widgets and change their glass, as in the app ----------
  // Mouse: drag with 1:1 tracking from where you grabbed; on release the widget springs onto the nearest even edge
  // or gap (projected from your flick) and never settles on the headline, the header or the island. A click (under
  // 4 px of movement) cycles the glass: Frosted, Lighter, Text only, Solid. Touch: tap only, so scrolling always works.
  // Positions are not saved; a window resize puts them back.
  (function () {
    var S = window.Spring;
    var looks = [['', 'Frosted glass'], ['g-lighter', 'Lighter glass'], ['g-text', 'Text only'], ['g-solid', 'Solid']];
    var GAP = 16, tipEl = document.createElement('div');
    tipEl.className = 'glass-tip'; tipEl.setAttribute('aria-live', 'polite'); stage.appendChild(tipEl);
    var items = widgets.map(function (w) {
      var it = { el: w.el, dx: 0, dy: 0, look: 0, sx: null, sy: null };
      if (S) {
        it.sx = new S.Spring({ onUpdate: function (v) { it.dx = v; apply(it); } });
        it.sy = new S.Spring({ onUpdate: function (v) { it.dy = v; apply(it); } });
      }
      w.el.tabIndex = 0;
      w.el.setAttribute('role', 'button');
      w.el.title = finePointer ? 'Drag to move. Click to change the glass.' : 'Tap to change the glass.';
      return it;
    });
    function apply(it) { it.el.style.transform = (it.dx || it.dy) ? 'translate3d(' + it.dx.toFixed(2) + 'px,' + it.dy.toFixed(2) + 'px,0)' : ''; queueCover(); }

    function cycle(it) {
      var old = looks[it.look][0];
      it.look = (it.look + 1) % looks.length; markHinted();
      if (old) it.el.classList.remove(old);
      if (looks[it.look][0]) it.el.classList.add(looks[it.look][0]);
      showTip(it, looks[it.look][1]);
    }
    function showTip(it, text, secs) {
      tipEl.textContent = text;
      var r = it.el.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      var below = r.bottom + 44 < Math.min(innerHeight, pill.getBoundingClientRect().top - 8);
      tipEl.style.left = (r.left - sr.left + r.width / 2) + 'px';
      tipEl.style.top = (below ? r.bottom - sr.top + 10 : r.top - sr.top - 40) + 'px';
      tipEl.style.translate = '-50% 0';
      if (hasGsap && !reduce) {
        gsap.killTweensOf(tipEl);
        gsap.fromTo(tipEl, { opacity: 0, y: below ? -4 : 4 }, { opacity: 1, y: 0, duration: 0.16, ease: 'power2.out' });
        gsap.to(tipEl, { opacity: 0, duration: 0.3, delay: secs || 1.1, ease: 'power1.in' });
      } else { tipEl.style.opacity = 1; clearTimeout(tipEl._t); tipEl._t = setTimeout(function () { tipEl.style.opacity = 0; }, ((secs || 1.1) + 0.3) * 1000); }
    }
    function hideTip() { if (hasGsap) { gsap.killTweensOf(tipEl); gsap.to(tipEl, { opacity: 0, duration: 0.15 }); } else tipEl.style.opacity = 0; }

    // one hint, once per visitor, so people find out the widgets move: on the first hover (mouse) or a few seconds
    // after load (touch); gone after the first use or 6 s
    var hinted = false;
    try { hinted = localStorage.getItem('fw-widget-hint') === '1'; } catch (e) {}
    function markHinted() { hinted = true; try { localStorage.setItem('fw-widget-hint', '1'); } catch (e) {} }
    var hintItem = items[0];
    if (hintItem && !hinted) {
      if (finePointer) {
        hintItem.el.addEventListener('mouseenter', function once() {
          hintItem.el.removeEventListener('mouseenter', once);
          if (hinted || hintItem.el.classList.contains('paused')) return;
          markHinted(); showTip(hintItem, 'Drag it, or click to change its glass', 6);
        });
      } else {
        setTimeout(function () {
          if (hinted || getComputedStyle(hintItem.el).display === 'none' || hintItem.el.classList.contains('paused')) return;
          markHinted(); showTip(hintItem, 'Tap to change its glass', 3);
        }, reduce ? 800 : 4400);   // after the island's first opening has closed
      }
    }

    // where a widget may rest: inside the edge margin, clear of the header, the headline block, the island and the
    // other widget (with the app's even gap)
    function rects(it) {
      var out = [], pad = function (r, p) { return { l: r.left - p, t: r.top - p, r: r.right + p, b: r.bottom + p }; };
      var top = $('.top'), hero = $('.hero');
      if (top) out.push(pad(top.getBoundingClientRect(), 8));
      if (hero && !stage.classList.contains('past')) out.push(pad(hero.getBoundingClientRect(), GAP));
      var pr = pill.getBoundingClientRect(); out.push({ l: pr.left - 24, t: pr.top - GAP, r: pr.right + 24, b: innerHeight });
      items.forEach(function (o) { if (o !== it && getComputedStyle(o.el).display !== 'none') out.push(pad(o.el.getBoundingClientRect(), GAP)); });
      return out;
    }
    function free(x, y, w, h, block) {
      for (var i = 0; i < block.length; i++) { var b = block[i]; if (x < b.r - 0.5 && x + w > b.l + 0.5 && y < b.b - 0.5 && y + h > b.t + 0.5) return false; }
      return true;
    }
    function settle(it, vx, vy) {
      var r = it.el.getBoundingClientRect(), w = r.width, h = r.height;
      var bx = r.left - it.dx, by = r.top - it.dy;               // where the widget sits with no offset
      var m = $('.top').getBoundingClientRect().left;              // the page's edge margin
      var minX = m, maxX = innerWidth - m - w, minY = m, maxY = innerHeight - m - h;
      var px = r.left + (S ? S.project(vx, 0.99) : 0), py = r.top + (S ? S.project(vy, 0.99) : 0);
      px = Math.max(minX, Math.min(maxX, px)); py = Math.max(minY, Math.min(maxY, py));
      var block = rects(it);
      // guides: the edge margin, and an even gap beside (or alignment with) everything in the way
      var gx = [minX, maxX], gy = [minY, maxY];
      block.forEach(function (b) { gx.push(b.l - w, b.r, b.l + GAP, b.r - GAP - w); gy.push(b.t - h, b.b, b.t + GAP, b.b - GAP - h); });
      function snap(v, list) { var best = v, bd = 28; list.forEach(function (g) { var d = Math.abs(g - v); if (d < bd) { bd = d; best = g; } }); return best; }
      var xs = [snap(px, gx)].concat(gx), ys = [snap(py, gy)].concat(gy);
      var best = null, bd = Infinity;
      xs.forEach(function (x) {
        ys.forEach(function (y) {
          if (x < minX - 0.5 || x > maxX + 0.5 || y < minY - 0.5 || y > maxY + 0.5) return;
          if (!free(x, y, w, h, block)) return;
          var d = Math.hypot(x - px, y - py);
          if (d < bd) { bd = d; best = { x: x, y: y }; }
        });
      });
      if (!best) best = { x: bx, y: by };                          // nowhere free: back home
      var damping = Math.hypot(vx, vy) > 900 ? 0.82 : 1;           // a little bounce only after a flick
      if (S) { it.sx.to(best.x - bx, { velocity: vx, damping: damping, response: 0.4 }); it.sy.to(best.y - by, { velocity: vy, damping: damping, response: 0.4 }); }
      else { it.dx = best.x - bx; it.dy = best.y - by; apply(it); }
    }

    items.forEach(function (it) {
      var el = it.el, id = null, sx0 = 0, sy0 = 0, ox = 0, oy = 0, moved = false, mouse = false;
      var tx = S ? new S.VelocityTracker() : null, ty = S ? new S.VelocityTracker() : null;
      el.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 || id !== null) return;
        mouse = e.pointerType === 'mouse' && finePointer;
        id = e.pointerId; sx0 = e.clientX; sy0 = e.clientY; moved = false;
        el.classList.add('pressed');
        if (mouse) {
          e.preventDefault();
          el.setPointerCapture(id);
          if (S) { it.sx.stop(); it.sy.stop(); tx.reset(); ty.reset(); tx.add(it.dx); ty.add(it.dy); }   // grab it mid-flight
          ox = it.dx; oy = it.dy;
        }
      });
      el.addEventListener('pointermove', function (e) {
        if (e.pointerId !== id) return;
        var mx = e.clientX - sx0, my = e.clientY - sy0;
        if (!moved && Math.hypot(mx, my) >= 4) { moved = true; el.classList.remove('pressed'); if (mouse) { el.classList.add('dragging'); hideTip(); markHinted(); } }
        if (!mouse || !moved) return;
        it.dx = ox + mx; it.dy = oy + my; apply(it);
        if (S) { tx.add(it.dx); ty.add(it.dy); }
      });
      function end(e, cancelled) {
        if (e.pointerId !== id) return;
        id = null;
        el.classList.remove('pressed', 'dragging');
        if (!moved && !cancelled) { cycle(it); return; }
        if (mouse && moved) settle(it, S ? tx.velocity() : 0, S ? ty.velocity() : 0);
      }
      el.addEventListener('pointerup', function (e) { end(e, false); });
      el.addEventListener('pointercancel', function (e) { end(e, true); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycle(it); } });
    });
    addEventListener('resize', function () { items.forEach(function (it) { if (it.sx) { it.sx.set(0); it.sy.set(0); } else { it.dx = it.dy = 0; apply(it); } }); });
  })();

  // ---------- the island ----------
  var island = $('#island'), pill = $('#pill'), panel = $('#panel');
  var open = false, closeTimer = 0, openedAt = 0;
  function setOpen(on) {
    if (on === open) return;
    open = on;
    if (on) openedAt = performance.now();
    clearTimeout(closeTimer);
    pill.setAttribute('aria-expanded', String(on));
    if (hasGsap && !reduce) {
      gsap.killTweensOf(panel);
      if (on) {
        island.classList.add('open');
        gsap.fromTo(panel, { scaleX: 0.42, scaleY: 0.12, opacity: 0.4 }, { scaleX: 1, scaleY: 1, opacity: 1, duration: 0.28, ease: 'power3.out' });
      } else {
        gsap.to(panel, { scaleX: 0.42, scaleY: 0.12, opacity: 0, duration: 0.16, ease: 'power2.in', onComplete: function () { island.classList.remove('open'); gsap.set(panel, { clearProps: 'transform,opacity' }); } });
      }
    } else island.classList.toggle('open', on);
  }
  // a click just after hovering opened it keeps it open (the hover and the click are one gesture)
  pill.addEventListener('click', function () { if (open && performance.now() - openedAt < 600) return; setOpen(!open); });
  if (finePointer) {
    island.addEventListener('mouseenter', function () { clearTimeout(closeTimer); setOpen(true); });
    island.addEventListener('mouseleave', function () { closeTimer = setTimeout(function () { setOpen(false); }, 250); });
  }
  panel.addEventListener('click', function () { if (!finePointer) setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) { setOpen(false); pill.focus(); } });
  document.addEventListener('pointerdown', function (e) { if (open && !island.contains(e.target)) setOpen(false); });
  if (!reduce) setTimeout(function () { if (!open) { setOpen(true); closeTimer = setTimeout(function () { setOpen(false); }, 3200); } }, 900);

  // the calendar page: this month, Sunday first, today marked
  (function () {
    var d = new Date(), y = d.getFullYear(), m = d.getMonth();
    var monthName = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(d);
    $('#cdname').textContent = wdFmt.format(d);
    $('#cday').textContent = d.getDate();
    $('#cmonth').textContent = monthName + ' ' + y;
    $('#cmtitle').textContent = monthName + ' ' + y;
    var t = new Date(Date.UTC(y, m, d.getDate())); var dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn);
    var wk = Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 864e5 + 1) / 7);
    $('#cweek').textContent = 'Week ' + wk;
    var grid = $('#cgrid'), html = '';
    'SMTWTFS'.split('').forEach(function (c) { html += '<span class="h">' + c + '</span>'; });
    var first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), prev = new Date(y, m, 0).getDate();
    for (var i = 0; i < 42; i++) {
      var n = i - first + 1, cls = '', v = n;
      if (n < 1) { v = prev + n; cls = 'out'; } else if (n > days) { v = n - days; cls = 'out'; } else if (n === d.getDate()) cls = 'now';
      html += '<span' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</span>';
    }
    grid.innerHTML = html;
  })();

  // ---------- the group chips: one pill slides to the chip you pick (0.26 s, quint ease, as in the app) ----------
  var chips = $$('.chips [role="tab"]'), pillEl = $('#chippill'), groups = $$('#list > div');
  function placePill(btn, animate) {
    var x = btn.offsetLeft, w = btn.offsetWidth;
    if (animate && hasGsap && !reduce) gsap.to(pillEl, { x: x, width: w, duration: 0.26, ease: 'power4.out', overwrite: true });   // quint, as the app
    else if (hasGsap) gsap.set(pillEl, { x: x, width: w });
    else { pillEl.style.transform = 'translateX(' + x + 'px)'; pillEl.style.width = w + 'px'; }
  }
  function pick(i, focus) {
    var g = chips[i].dataset.g;
    chips.forEach(function (c, j) { c.setAttribute('aria-selected', String(i === j)); c.tabIndex = i === j ? 0 : -1; });
    groups.forEach(function (el) { el.hidden = g !== 'all' && el.dataset.g !== g; });
    placePill(chips[i], true);
    if (focus) chips[i].focus();
  }
  chips.forEach(function (c, i) {
    c.addEventListener('click', function () { pick(i); });
    c.addEventListener('keydown', function (e) {
      var n = chips.length, k = e.key;
      var j = k === 'ArrowRight' ? (i + 1) % n : k === 'ArrowLeft' ? (i - 1 + n) % n : k === 'Home' ? 0 : k === 'End' ? n - 1 : -1;
      if (j >= 0) { e.preventDefault(); pick(j, true); }
    });
  });
  // ---------- the demo video: loads and plays only while on screen; never starts on its own under reduced motion ----------
  (function () {
    var vid = $('#demo-video'), tog = $('#demo-toggle');
    if (!vid || !tog) return;
    var held = reduce;                 // true once the visitor pauses it (or under reduced motion, until they press play)
    var inView = false;
    function show() {
      var p = vid.paused;
      tog.classList.toggle('is-paused', p);
      tog.setAttribute('aria-label', p ? 'Play the video' : 'Pause the video');
    }
    function play() { var r = vid.play(); if (r && r.catch) r.catch(function () { show(); }); }
    function toggle() {
      if (vid.paused) { held = false; play(); } else { held = true; vid.pause(); }
    }
    tog.addEventListener('click', toggle);
    vid.addEventListener('click', toggle);
    vid.addEventListener('play', show);
    vid.addEventListener('pause', show);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          inView = e.isIntersecting;
          if (inView && !held) play();
          else if (!inView && !vid.paused) vid.pause();
        });
      }, { threshold: 0.4 }).observe(vid);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && !vid.paused) vid.pause();
      else if (!document.hidden && inView && !held) play();
    });
    show();
  })();

  function snapPill() { var on = chips.filter(function (c) { return c.getAttribute('aria-selected') === 'true'; })[0]; if (on) placePill(on, false); }
  snapPill();
  addEventListener('resize', snapPill);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(snapPill);
})();
