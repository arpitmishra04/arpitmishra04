/* ============================================================================
   main.js — everything that isn't the hero canvas or the console.
   Theme, command palette, scroll spy, reveals, counters, timeline, stack tabs,
   clipboard, clocks. Plain DOM, no dependencies.
   ========================================================================= */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ── toast ───────────────────────────────────────────────────────────── */
  var toastEl = $("#toast");
  var toastTimer;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-on"); }, 2100);
  }

  /* ── theme ───────────────────────────────────────────────────────────── */
  var themeBtn = $("#theme-toggle");

  function setTheme(next, quiet) {
    root.dataset.theme = next;
    try { localStorage.setItem("am-theme", next); } catch (e) { /* private mode */ }
    if (themeBtn) {
      themeBtn.setAttribute("aria-label", next === "ink" ? "Switch to paper theme" : "Switch to ink theme");
    }
    document.dispatchEvent(new CustomEvent("themechange", { detail: next }));
    if (!quiet) toast(next === "ink" ? "Ink — lights out" : "Paper — lights on");
  }

  function flipTheme() {
    setTheme(root.dataset.theme === "ink" ? "paper" : "ink");
  }

  if (themeBtn) themeBtn.addEventListener("click", flipTheme);
  setTheme(root.dataset.theme === "paper" ? "paper" : "ink", true);

  /* ── clocks ──────────────────────────────────────────────────────────── */
  var clocks = [$("#clock"), $("#clock-2")].filter(Boolean);
  if (clocks.length) {
    var fmt;
    try {
      fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false
      });
    } catch (e) { fmt = null; }

    var tick = function () {
      var now = new Date();
      var text = fmt
        ? fmt.format(now) + " IST"
        : new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000)
            .toTimeString().slice(0, 5) + " IST";
      clocks.forEach(function (el) { el.textContent = text; });
    };
    tick();
    setInterval(tick, 20000);
  }

  var yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ── scroll progress + sticky bar ────────────────────────────────────── */
  var bar = $("#scroll-bar");
  var topbar = $(".topbar");
  var timeline = $(".timeline");
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY || window.pageYOffset;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.width = (max > 0 ? Math.min(1, y / max) * 100 : 0) + "%";
      if (topbar) topbar.classList.toggle("is-stuck", y > 40);

      if (timeline) {
        var box = timeline.getBoundingClientRect();
        var mark = window.innerHeight * 0.62;
        var p = box.height > 0 ? (mark - box.top) / box.height : 0;
        timeline.style.setProperty("--p", Math.max(0, Math.min(1, p)).toFixed(3));
      }
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ── reveal on enter ─────────────────────────────────────────────────── */
  var revealables = $$(".reveal");
  if ("IntersectionObserver" in window && !reduced.matches) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var siblings = el.parentElement ? $$(".reveal", el.parentElement) : [];
        var index = Math.max(0, siblings.indexOf(el));
        el.style.transitionDelay = Math.min(index, 6) * 70 + "ms";
        el.classList.add("is-in");
        revealIO.unobserve(el);
        if (el.querySelector(".count") || el.classList.contains("count")) countUp(el);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
    revealables.forEach(function (el) { revealIO.observe(el); });
  } else {
    revealables.forEach(function (el) {
      el.classList.add("is-in");
      countUp(el);
    });
  }

  /* ── counters ────────────────────────────────────────────────────────── */
  function countUp(scope) {
    $$(".count", scope).forEach(function (el) {
      if (el.dataset.done) return;
      el.dataset.done = "1";
      var target = parseFloat(el.dataset.to || "0");
      var suffix = el.dataset.suffix || "";
      if (reduced.matches) { el.textContent = target + suffix; return; }

      var duration = 1150;
      var started = 0;
      var frame = function (now) {
        if (!started) started = now;
        var p = Math.min(1, (now - started) / duration);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }

  /* ── timeline accordion ──────────────────────────────────────────────── */
  $$(".node").forEach(function (node) {
    var head = $(".node-head", node);
    if (!head) return;
    head.addEventListener("click", function () {
      var open = node.classList.toggle("is-open");
      head.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  /* ── stack tabs ──────────────────────────────────────────────────────── */
  var tabs = $$(".layer");
  if (tabs.length) {
    var selectTab = function (tab, focus) {
      tabs.forEach(function (other) {
        var on = other === tab;
        other.classList.toggle("is-on", on);
        other.setAttribute("aria-selected", on ? "true" : "false");
        other.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(other.getAttribute("aria-controls"));
        if (!panel) return;
        panel.hidden = !on;
        panel.classList.toggle("is-on", on);
        if (on) {
          panel.classList.remove("is-in");
          void panel.offsetWidth;
          panel.classList.add("is-in");
          $$(".chips li", panel).forEach(function (chip, i) {
            chip.style.animationDelay = i * 38 + "ms";
          });
        }
      });
      if (focus) tab.focus();
    };

    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () { selectTab(tab); });
      tab.addEventListener("keydown", function (ev) {
        var map = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        if (map[ev.key]) {
          ev.preventDefault();
          selectTab(tabs[(index + map[ev.key] + tabs.length) % tabs.length], true);
        } else if (ev.key === "Home") {
          ev.preventDefault();
          selectTab(tabs[0], true);
        } else if (ev.key === "End") {
          ev.preventDefault();
          selectTab(tabs[tabs.length - 1], true);
        }
      });
    });

    selectTab(tabs[0]);
  }

  /* ── scroll spy (rail + nav) ─────────────────────────────────────────── */
  var sections = $$("main section[id]");
  var railLinks = $$(".rail a");
  var navLinks = $$(".nav a");

  function markActive(id) {
    railLinks.forEach(function (a) { a.classList.toggle("is-active", a.dataset.rail === id); });
    navLinks.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + id); });
  }

  if ("IntersectionObserver" in window && sections.length) {
    var seen = {};
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { seen[entry.target.id] = entry.intersectionRatio; });
      var best = null, bestRatio = 0;
      Object.keys(seen).forEach(function (id) {
        if (seen[id] > bestRatio) { bestRatio = seen[id]; best = id; }
      });
      if (best && bestRatio > 0) markActive(best);
    }, { threshold: [0, 0.2, 0.5, 0.8], rootMargin: "-15% 0px -35% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ── clipboard ───────────────────────────────────────────────────────── */
  function copy(text) {
    var done = function () { toast("Copied " + text); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); }
      catch (e) { toast("Copy failed — " + text); }
      document.body.removeChild(ta);
    }
  }

  $$("[data-copy]").forEach(function (el) {
    el.addEventListener("click", function () { copy(el.dataset.copy); });
  });

  /* ── command palette ─────────────────────────────────────────────────── */
  var palette = $("#palette");
  var paletteInput = $("#palette-input");
  var paletteList = $("#palette-list");
  var lastFocus = null;
  var active = 0;
  var shown = [];

  var items = [
    { icon: "01", title: "Now", hint: "section", run: function () { goTo("now"); } },
    { icon: "02", title: "What changed", hint: "section", run: function () { goTo("impact"); } },
    { icon: "03", title: "Career line", hint: "section", run: function () { goTo("career"); } },
    { icon: "04", title: "The stack", hint: "section", run: function () { goTo("stack"); } },
    { icon: "05", title: "Public work", hint: "section", run: function () { goTo("work"); } },
    { icon: "06", title: "Console", hint: "section", run: function () { goTo("console"); } },
    { icon: "07", title: "Contact", hint: "section", run: function () { goTo("contact"); } },
    { icon: "↑", title: "Back to top", hint: "nav", run: function () { window.scrollTo({ top: 0, behavior: reduced.matches ? "auto" : "smooth" }); } },
    { icon: "◐", title: "Toggle theme", hint: "T", run: flipTheme },
    { icon: "@", title: "Copy email address", hint: "action", run: function () { copy("mishra.arpit4040@gmail.com"); } },
    { icon: "✉", title: "Write me an email", hint: "mailto", run: function () { window.location.href = "mailto:mishra.arpit4040@gmail.com?subject=Hello%20Arpit"; } },
    { icon: "in", title: "Open LinkedIn", hint: "external", run: function () { window.open("https://www.linkedin.com/in/arpit-mishra-201a331b9/", "_blank", "noopener"); } },
    { icon: "gh", title: "Open GitHub", hint: "external", run: function () { window.open("https://github.com/arpitmishra04", "_blank", "noopener"); } },
    { icon: "R", title: "Ryan, LLC — tax.com", hint: "external", run: function () { window.open("https://tax.com/", "_blank", "noopener"); } },
    { icon: "<>", title: "View the source of this site", hint: "external", run: function () { window.open("https://github.com/arpitmishra04/arpitmishra04", "_blank", "noopener"); } },
    { icon: ">_", title: "Jump into the console", hint: "shell", run: function () { if (window.Term) window.Term.focus(); else goTo("console"); } },
    { icon: "?", title: "Run 'help' in the console", hint: "shell", run: function () { if (window.Term) { window.Term.run("help"); window.Term.focus(); } } },
    { icon: "⎙", title: "Print / save as PDF", hint: "action", run: function () { window.print(); } }
  ];

  function goTo(id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduced.matches ? "auto" : "smooth", block: "start" });
  }

  function score(item, query) {
    if (!query) return 1;
    var haystack = (item.title + " " + item.hint).toLowerCase();
    if (haystack.indexOf(query) !== -1) return 100 - haystack.indexOf(query);
    var qi = 0;
    for (var i = 0; i < haystack.length && qi < query.length; i++) {
      if (haystack[i] === query[qi]) qi++;
    }
    return qi === query.length ? 10 : 0;
  }

  function renderPalette() {
    var query = (paletteInput.value || "").trim().toLowerCase();
    shown = items
      .map(function (item) { return { item: item, s: score(item, query) }; })
      .filter(function (row) { return row.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .map(function (row) { return row.item; });

    paletteList.innerHTML = "";
    if (!shown.length) {
      var empty = document.createElement("li");
      empty.className = "palette-empty";
      empty.textContent = "Nothing matches that. Try “career”, “email” or “theme”.";
      paletteList.appendChild(empty);
      return;
    }

    active = Math.min(active, shown.length - 1);
    shown.forEach(function (item, i) {
      var li = document.createElement("li");
      li.id = "palette-opt-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === active ? "true" : "false");
      li.innerHTML =
        '<span class="p-i mono"></span><span class="p-t"></span><span class="p-s"></span>';
      li.children[0].textContent = item.icon;
      li.children[1].textContent = item.title;
      li.children[2].textContent = item.hint;
      li.addEventListener("mousemove", function () { setActive(i); });
      li.addEventListener("click", function () { fire(i); });
      paletteList.appendChild(li);
    });
    paletteInput.setAttribute("aria-activedescendant", "palette-opt-" + active);
  }

  function setActive(i) {
    active = i;
    paletteInput.setAttribute("aria-activedescendant", "palette-opt-" + active);
    $$("li[role='option']", paletteList).forEach(function (li, idx) {
      li.setAttribute("aria-selected", idx === active ? "true" : "false");
      if (idx === active && li.scrollIntoView) li.scrollIntoView({ block: "nearest" });
    });
  }

  function fire(i) {
    var item = shown[i];
    closePalette();
    if (item) setTimeout(item.run, 60);
  }

  function openPalette() {
    if (!palette || !palette.hidden) return;
    lastFocus = document.activeElement;
    palette.hidden = false;
    paletteInput.value = "";
    active = 0;
    renderPalette();
    paletteInput.focus();
  }

  function closePalette() {
    if (!palette || palette.hidden) return;
    palette.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  if (palette && paletteInput && paletteList) {
    $$("[data-open-palette]").forEach(function (btn) {
      btn.addEventListener("click", openPalette);
    });
    $$("[data-close-palette]").forEach(function (el) {
      el.addEventListener("click", closePalette);
    });

    paletteInput.addEventListener("input", function () { active = 0; renderPalette(); });

    paletteInput.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { ev.preventDefault(); if (shown.length) setActive((active + 1) % shown.length); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); if (shown.length) setActive((active - 1 + shown.length) % shown.length); }
      else if (ev.key === "Enter") { ev.preventDefault(); fire(active); }
      else if (ev.key === "Escape") { ev.preventDefault(); closePalette(); }
      else if (ev.key === "Tab") { ev.preventDefault(); }
    });

    var hint = $("#palette-hint");
    if (hint && isMac) hint.textContent = "⌘ K";
  }

  /* ── global keys ─────────────────────────────────────────────────────── */
  document.addEventListener("keydown", function (ev) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) ||
      document.activeElement.isContentEditable;

    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
      ev.preventDefault();
      palette && palette.hidden ? openPalette() : closePalette();
      return;
    }

    if (ev.key === "Escape") { closePalette(); return; }
    if (typing || ev.ctrlKey || ev.metaKey || ev.altKey) return;

    if (ev.key === "/") { ev.preventDefault(); openPalette(); return; }
    if (ev.key.toLowerCase() === "t") { flipTheme(); return; }
    if (ev.key.toLowerCase() === "c" && window.Term) { window.Term.focus(); }
  });

  /* ── in-page anchors keep the URL clean ──────────────────────────────── */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (ev) {
      var id = a.getAttribute("href").slice(1);
      var el = id && document.getElementById(id);
      if (!el) return;
      ev.preventDefault();
      el.scrollIntoView({ behavior: reduced.matches ? "auto" : "smooth", block: "start" });
      if (history.replaceState) history.replaceState(null, "", "#" + id);
    });
  });

  window.Site = { setTheme: setTheme, toast: toast, copy: copy };
})();
