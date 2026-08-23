/* ============================================================================
   trace.js — the hero backdrop.
   A sparse blueprint lattice with requests walking it. Nodes lean toward the
   pointer, edges light up inside its radius, and clicking fires a fresh trace
   from whichever node you clicked nearest. No dependencies.
   ========================================================================= */
(function () {
  "use strict";

  var canvas = document.getElementById("trace");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d", { alpha: true });
  var hero = canvas.parentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  var W = 0, H = 0, dpr = 1;
  var nodes = [], edges = [], pulses = [];
  var pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: false };
  var raf = 0, visible = true, t0 = performance.now();
  var ink = { amber: [224, 164, 76], line: [38, 50, 74], dim: [92, 103, 123] };

  var CELL = 116;      // lattice pitch before jitter
  var REACH = 1.55;    // neighbour radius, in cells
  var LIGHT = 230;     // pointer light radius, px

  /* ── colour plumbing ─────────────────────────────────────────────────── */
  function toRgb(value, fallback) {
    var s = (value || "").trim();
    if (s.charAt(0) === "#") {
      if (s.length === 4) s = "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
      var n = parseInt(s.slice(1), 16);
      if (!isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var m = s.match(/(\d+(?:\.\d+)?)/g);
    if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
    return fallback;
  }

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    ink.amber = toRgb(cs.getPropertyValue("--amber"), ink.amber);
    ink.line = toRgb(cs.getPropertyValue("--line-2"), ink.line);
    ink.dim = toRgb(cs.getPropertyValue("--dim"), ink.dim);
  }

  function rgba(c, a) {
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
  }

  /* ── lattice ─────────────────────────────────────────────────────────── */
  function build() {
    nodes = [];
    edges = [];
    pulses = [];

    var cols = Math.max(3, Math.ceil(W / CELL) + 1);
    var rows = Math.max(3, Math.ceil(H / CELL) + 1);
    var offX = (W - (cols - 1) * CELL) / 2;
    var offY = (H - (rows - 1) * CELL) / 2;

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        // punch holes so the grid reads hand-drawn rather than printed
        if (Math.random() < 0.17) continue;
        var jx = (Math.random() - 0.5) * CELL * 0.52;
        var jy = (Math.random() - 0.5) * CELL * 0.52;
        nodes.push({
          x: offX + c * CELL + jx,
          y: offY + r * CELL + jy,
          ox: offX + c * CELL + jx,
          oy: offY + r * CELL + jy,
          ph: Math.random() * Math.PI * 2,
          amp: 1.1 + Math.random() * 2.2,
          big: Math.random() < 0.13,
          heat: 0,
          links: []
        });
      }
    }

    var max = CELL * REACH;
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var dx = nodes[i].ox - nodes[j].ox;
        var dy = nodes[i].oy - nodes[j].oy;
        var d2 = dx * dx + dy * dy;
        if (d2 > max * max) continue;
        if (nodes[i].links.length > 3 || nodes[j].links.length > 3) continue;
        var e = { a: i, b: j, len: Math.sqrt(d2) };
        nodes[i].links.push(edges.length);
        nodes[j].links.push(edges.length);
        edges.push(e);
      }
    }

    var want = Math.min(9, Math.max(4, Math.round(edges.length / 34)));
    for (var p = 0; p < want; p++) spawn();
  }

  function spawn(fromNode) {
    if (!edges.length) return;
    var edge, dir;
    if (fromNode != null && nodes[fromNode] && nodes[fromNode].links.length) {
      var ls = nodes[fromNode].links;
      edge = ls[(Math.random() * ls.length) | 0];
      dir = edges[edge].a === fromNode ? 1 : -1;
    } else {
      edge = (Math.random() * edges.length) | 0;
      dir = Math.random() < 0.5 ? 1 : -1;
    }
    pulses.push({
      e: edge,
      dir: dir,
      t: Math.random() * 0.6,
      speed: 0.10 + Math.random() * 0.16,
      hops: 5 + ((Math.random() * 9) | 0),
      fade: 0
    });
  }

  function step(pulse, dt) {
    var e = edges[pulse.e];
    if (!e) { pulse.hops = 0; return; }
    pulse.t += (pulse.speed * dt * 60) / e.len;

    if (pulse.t >= 1) {
      var landed = pulse.dir === 1 ? e.b : e.a;
      nodes[landed].heat = 1;
      pulse.hops--;
      if (pulse.hops <= 0) return;

      var opts = nodes[landed].links.filter(function (id) { return id !== pulse.e; });
      if (!opts.length) { pulse.hops = 0; return; }
      var next = opts[(Math.random() * opts.length) | 0];
      pulse.e = next;
      pulse.dir = edges[next].a === landed ? 1 : -1;
      pulse.t = 0;
    }
  }

  function at(pulse) {
    var e = edges[pulse.e];
    var a = nodes[pulse.dir === 1 ? e.a : e.b];
    var b = nodes[pulse.dir === 1 ? e.b : e.a];
    return {
      x: a.x + (b.x - a.x) * pulse.t,
      y: a.y + (b.y - a.y) * pulse.t,
      ax: a.x, ay: a.y, bx: b.x, by: b.y
    };
  }

  /* ── frame ───────────────────────────────────────────────────────────── */
  function draw(now) {
    var dt = Math.min(2.2, (now - t0) / 16.667);
    t0 = now;
    var still = reduced.matches;

    pointer.x += (pointer.tx - pointer.x) * 0.09;
    pointer.y += (pointer.ty - pointer.y) * 0.09;

    ctx.clearRect(0, 0, W, H);

    var i, n, d, pull;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      var bob = still ? 0 : Math.sin(now / 1700 + n.ph) * n.amp;
      n.x = n.ox;
      n.y = n.oy + bob;
      if (pointer.on) {
        var dx = pointer.x - n.ox, dy = pointer.y - n.oy;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d < LIGHT * 1.3 && d > 0.001) {
          pull = (1 - d / (LIGHT * 1.3)) * 13;
          n.x += (dx / d) * pull;
          n.y += (dy / d) * pull;
        }
      }
      n.heat *= 0.955;
    }

    // edges
    ctx.lineWidth = 1;
    for (i = 0; i < edges.length; i++) {
      var e = edges[i];
      var a = nodes[e.a], b = nodes[e.b];
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var lit = 0;
      if (pointer.on) {
        var ex = pointer.x - mx, ey = pointer.y - my;
        var ed = Math.sqrt(ex * ex + ey * ey);
        lit = ed < LIGHT ? 1 - ed / LIGHT : 0;
      }
      var heat = Math.max(nodes[e.a].heat, nodes[e.b].heat);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = lit > 0.02 || heat > 0.02
        ? rgba(ink.amber, 0.05 + lit * 0.30 + heat * 0.16)
        : rgba(ink.line, 0.30);
      ctx.stroke();
    }

    // nodes
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      var glow = 0;
      if (pointer.on) {
        var nx = pointer.x - n.x, ny = pointer.y - n.y;
        var nd = Math.sqrt(nx * nx + ny * ny);
        glow = nd < LIGHT ? 1 - nd / LIGHT : 0;
      }
      var hot = Math.max(glow, n.heat);
      var size = (n.big ? 2.4 : 1.5) + hot * 2.1;

      if (n.big) {
        ctx.beginPath();
        ctx.rect(n.x - size, n.y - size, size * 2, size * 2);
      } else {
        ctx.beginPath();
        ctx.arc(n.x, n.y, size, 0, Math.PI * 2);
      }
      ctx.fillStyle = hot > 0.04
        ? rgba(ink.amber, 0.28 + hot * 0.7)
        : rgba(ink.dim, n.big ? 0.42 : 0.26);
      ctx.fill();

      if (hot > 0.5) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, size + 5 + hot * 6, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(ink.amber, (hot - 0.5) * 0.34);
        ctx.stroke();
      }
    }

    // pulses
    for (i = pulses.length - 1; i >= 0; i--) {
      var p = pulses[i];
      if (!still) step(p, dt);
      if (p.hops <= 0) {
        p.fade += 0.05 * dt;
        if (p.fade >= 1) {
          pulses.splice(i, 1);
          if (pulses.length < 9 && !still) spawn();
          continue;
        }
      }
      var pos = at(p);
      var alpha = 1 - p.fade;

      var trail = ctx.createLinearGradient(pos.ax, pos.ay, pos.x, pos.y);
      trail.addColorStop(0, rgba(ink.amber, 0));
      trail.addColorStop(1, rgba(ink.amber, 0.5 * alpha));
      ctx.beginPath();
      ctx.moveTo(pos.ax, pos.ay);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = trail;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.lineWidth = 1;

      var halo = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 13);
      halo.addColorStop(0, rgba(ink.amber, 0.42 * alpha));
      halo.addColorStop(1, rgba(ink.amber, 0));
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 13, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2.3, 0, Math.PI * 2);
      ctx.fillStyle = rgba(ink.amber, alpha);
      ctx.fill();
    }

    raf = still ? 0 : requestAnimationFrame(draw);
  }

  /* ── wiring ──────────────────────────────────────────────────────────── */
  function resize() {
    var rect = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function start() {
    if (raf || !visible) return;
    t0 = performance.now();
    raf = requestAnimationFrame(draw);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var was = W;
      resize();
      if (reduced.matches) draw(performance.now());
      else if (was !== W) start();
    }, 180);
  });

  hero.addEventListener("pointermove", function (ev) {
    var rect = hero.getBoundingClientRect();
    pointer.tx = ev.clientX - rect.left;
    pointer.ty = ev.clientY - rect.top;
    if (!pointer.on) { pointer.x = pointer.tx; pointer.y = pointer.ty; }
    pointer.on = true;
  }, { passive: true });

  hero.addEventListener("pointerleave", function () {
    pointer.on = false;
    pointer.tx = pointer.ty = -9999;
  });

  hero.addEventListener("pointerdown", function (ev) {
    if (reduced.matches || !nodes.length) return;
    var rect = hero.getBoundingClientRect();
    var cx = ev.clientX - rect.left, cy = ev.clientY - rect.top;
    var best = 0, bestD = Infinity;
    for (var i = 0; i < nodes.length; i++) {
      var dx = nodes[i].x - cx, dy = nodes[i].y - cy;
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    nodes[best].heat = 1.6;
    spawn(best);
    spawn(best);
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else start();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start(); else stop();
    }, { threshold: 0.01 }).observe(hero);
  }

  document.addEventListener("themechange", function () {
    readPalette();
    if (reduced.matches) draw(performance.now());
  });

  reduced.addEventListener("change", function () {
    stop();
    if (reduced.matches) draw(performance.now());
    else start();
  });

  readPalette();
  resize();
  if (reduced.matches) draw(performance.now());
  else start();
})();
