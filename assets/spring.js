/* spring.js: Apple-style springs for gesture UI (apple-design skill, sections 3-6 and 9).
   GSAP stays the engine for everything else. Use this only where people drag, flick or grab
   something mid-motion (sheets, swipe galleries, draggable cards), because a spring keeps its
   velocity when the target changes and GSAP tweens do not.
   Params follow Apple: damping (1 = no bounce, ~0.8 only after a flick) and response (seconds;
   lower = snappier; not a duration). One Spring per axis. Load after gsap.min.js, before main.js. */
(function (global) {
  'use strict';
  var reduce = global.matchMedia('(prefers-reduced-motion: reduce)');
  var STEP = 1 / 240; // fixed integration step, stable for any response >= 0.05s
  var noop = function () {};

  // Shared clock: gsap.ticker when present (so ticker.sleep()/wake() stress tests cover springs too).
  var active = [], last = 0, rafId = 0;
  function frame(dt) {
    for (var i = active.length - 1; i >= 0; i--) active[i]._step(dt);
  }
  function gsapTick(time, deltaTime) { frame(Math.min(deltaTime / 1000, 1 / 30)); }
  function rafTick(now) {
    frame(Math.min((now - last) / 1000, 1 / 30));
    last = now;
    rafId = active.length ? requestAnimationFrame(rafTick) : 0;
  }
  function start(s) {
    if (active.indexOf(s) > -1) return;
    active.push(s);
    if (active.length > 1) return;
    if (global.gsap) global.gsap.ticker.add(gsapTick);
    else { last = performance.now(); rafId = requestAnimationFrame(rafTick); }
  }
  function stop(s) {
    var i = active.indexOf(s);
    if (i < 0) return;
    active.splice(i, 1);
    if (active.length) return;
    if (global.gsap) global.gsap.ticker.remove(gsapTick);
    else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  function Spring(o) {
    o = o || {};
    this.value = this.target = o.value || 0;
    this.velocity = 0; // units per second
    this.damping = o.damping == null ? 1 : o.damping;
    this.response = o.response || 0.4;
    this.precision = o.precision || 0.01;
    this.onUpdate = o.onUpdate || noop;
    this.onRest = o.onRest || noop;
  }
  // Animate from the live value toward target. Velocity carries over unless you hand one off
  // (pointer release velocity in px/s). Calling to() mid-flight re-targets without a jump.
  Spring.prototype.to = function (target, o) {
    o = o || {};
    if (o.velocity != null) this.velocity = o.velocity;
    if (o.damping != null) this.damping = o.damping;
    if (o.response != null) this.response = o.response;
    this.target = target;
    if (reduce.matches) { this.set(target); this.onRest(target); return this; }
    start(this);
    return this;
  };
  // Jump with no motion (1:1 drag tracking). Stops the spring and zeroes its velocity.
  Spring.prototype.set = function (v) {
    stop(this);
    this.value = this.target = v;
    this.velocity = 0;
    this.onUpdate(v);
    return this;
  };
  Spring.prototype.stop = function () { stop(this); this.velocity = 0; return this; };
  Spring.prototype.isActive = function () { return active.indexOf(this) > -1; };
  Spring.prototype._step = function (dt) {
    var w = 2 * Math.PI / this.response, k = w * w, c = 2 * this.damping * w;
    for (var t = dt; t > 1e-9; t -= STEP) {
      var h = Math.min(STEP, t);
      this.velocity += (-k * (this.value - this.target) - c * this.velocity) * h;
      this.value += this.velocity * h;
    }
    var p = this.precision;
    if (Math.abs(this.value - this.target) < p && Math.abs(this.velocity) < p * 10) {
      this.value = this.target;
      this.velocity = 0;
      stop(this);
      this.onUpdate(this.value);
      this.onRest(this.value);
      return;
    }
    this.onUpdate(this.value);
  };

  // Pointer velocity from the last 100ms of moves. Returns 0 if the finger paused before release.
  function VelocityTracker() { this.samples = []; }
  VelocityTracker.prototype.reset = function () { this.samples.length = 0; };
  VelocityTracker.prototype.add = function (v, t) {
    t = t == null ? performance.now() : t;
    var s = this.samples;
    s.push({ v: v, t: t });
    while (s.length > 2 && t - s[0].t > 100) s.shift();
  };
  VelocityTracker.prototype.velocity = function (now) {
    var s = this.samples;
    if (s.length < 2) return 0;
    var a = s[0], b = s[s.length - 1];
    now = now == null ? performance.now() : now;
    if (now - b.t > 50 || b.t === a.t) return 0;
    return (b.v - a.v) / ((b.t - a.t) / 1000);
  };

  global.Spring = {
    Spring: Spring,
    VelocityTracker: VelocityTracker,
    // Where a flick would come to rest (Apple's sample code). d 0.998 = scroll feel, 0.99 = snappier.
    project: function (velocity, d) {
      d = d || 0.998;
      return (velocity / 1000) * d / (1 - d);
    },
    // Resistance past an edge: the further past, the less it follows.
    rubberband: function (overshoot, dimension, constant) {
      constant = constant || 0.55;
      var r = (Math.abs(overshoot) * dimension * constant) / (dimension + constant * Math.abs(overshoot));
      return overshoot < 0 ? -r : r;
    },
    nearest: function (points, x) {
      return points.reduce(function (a, b) { return Math.abs(b - x) < Math.abs(a - x) ? b : a; });
    }
  };
})(window);
