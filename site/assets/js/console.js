/* ============================================================================
   console.js — the terminal in section 06.
   Real command parsing, history, tab completion. Output is authored here, so
   only user input is ever escaped before it touches the DOM.
   ========================================================================= */
(function () {
  "use strict";

  var out = document.getElementById("term-out");
  var input = document.getElementById("term-in");
  var shell = document.getElementById("term");
  if (!out || !input || !shell) return;

  var history = [];
  var cursor = -1;
  var draft = "";
  var booted = false;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function line(html, cls) {
    var p = document.createElement("p");
    if (cls) p.className = cls;
    p.innerHTML = html == null ? "" : html;
    out.appendChild(p);
    return p;
  }

  function print(rows) {
    (Array.isArray(rows) ? rows : [rows]).forEach(function (row) {
      if (typeof row === "string") line(row);
      else line(row.t, row.c);
    });
    out.scrollTop = out.scrollHeight;
  }

  function gap() { line(""); }

  function pad(s, n) {
    s = String(s);
    while (s.length < n) s += " ";
    return s;
  }

  function key(k, v) {
    return '<span class="k">' + pad(k, 13) + "</span>" + v;
  }

  /* ── command table ───────────────────────────────────────────────────── */
  var commands = {
    help: {
      about: "list everything this shell answers to",
      run: function () {
        print([{ t: "Available commands", c: "g" }, ""]);
        Object.keys(commands).sort().forEach(function (name) {
          print(key(name, '<span class="d">' + commands[name].about + "</span>"));
        });
        print(["", { t: "Tab completes. ↑ / ↓ walks history.", c: "d" }]);
      }
    },

    whoami: {
      about: "the short version",
      run: function () {
        print([
          { t: "Arpit Mishra", c: "k" },
          "Software engineer · Hyderabad, India",
          "",
          key("role", "Engineer 1 @ Ryan, LLC"),
          key("product", "Owner Claims Portal · Tracker Pro"),
          key("before", "Tezo — Keka HRMS, then GenAI for Habasit"),
          key("writes", "C#, TypeScript, T-SQL, Python"),
          key("cares about", "clean abstractions and review that pushes back")
        ]);
      }
    },

    now: {
      about: "what I'm working on this quarter",
      run: function () {
        print([
          "Building the <span class=\"k\">Owner Claims Portal</span> inside Tracker Pro — the workflow",
          "owners use to file, track and resolve property tax claims.",
          "",
          "Angular on the front. .NET Core and MS SQL Server behind it. Azure underneath.",
          { t: "Tax data has to survive an audit; the screen still has to be readable.", c: "d" }
        ]);
      }
    },

    career: {
      about: "reverse-chronological work history",
      run: function () {
        print([
          key("now", "Engineer 1 — Ryan, LLC · Tracker Pro"),
          key("2025 · oct", "Full Stack + GenAI Developer — Tezo · Habasit"),
          key("2024 · oct", "Employee of the Month — Tezo"),
          key("2024 · jul", "Full Stack Developer — Tezo · Keka HRMS"),
          key("2024 · jan", "Intern — Tezo"),
          key("2020 — 2024", "B.Tech — Rungta College of Engineering & Technology"),
          "",
          { t: "impact →  process turnaround −40%   ·   client escalations −28%", c: "g" },
          { t: "Run 'goto career' for the long form.", c: "d" }
        ]);
      }
    },

    stack: {
      about: "tools by layer — try 'stack data'",
      run: function (args) {
        var layers = {
          interface: ["L5 · Interface", "Angular, TypeScript, RxJS, HTML, CSS, i18n / localization"],
          services: ["L4 · Services", ".NET Core, C#, REST APIs, OOP, SOLID, design patterns"],
          intelligence: ["L3 · Intelligence", "Python, LangChain, LangGraph, intent detection, prompt validation, evals"],
          data: ["L2 · Data", "MS SQL Server, T-SQL, stored procedures, Azure AI Search, vector + hybrid search"],
          platform: ["L1 · Platform", "Azure App Service, Function Apps, Service Bus, Blob Storage, Azure DevOps, Git, Scrum"]
        };
        var pick = (args[0] || "").toLowerCase();
        var names = Object.keys(layers);
        if (pick && names.indexOf(pick) === -1) {
          print({ t: "no such layer: " + esc(pick) + "  (try: " + names.join(", ") + ")", c: "err" });
          return;
        }
        (pick ? [pick] : names).forEach(function (n) {
          print([{ t: layers[n][0], c: "k" }, layers[n][1], ""]);
        });
      }
    },

    work: {
      about: "public repositories",
      run: function () {
        print([
          key("R-01", '<a href="https://github.com/arpitmishra04/Whatsapp-Automated-Reply" target="_blank" rel="noopener">WhatsApp Automated Reply</a>'),
          key("R-02", '<a href="https://github.com/arpitmishra04/User-Authentication-System-Using-Sessions-" target="_blank" rel="noopener">User Authentication System</a>'),
          key("R-03", '<a href="https://github.com/arpitmishra04/EmployeeDirectory" target="_blank" rel="noopener">Employee Directory</a>'),
          "",
          { t: "The rest is client-owned and private. Ask me about it instead.", c: "d" }
        ]);
      }
    },

    contact: {
      about: "how to reach me",
      run: function () {
        print([
          key("email", '<a href="mailto:mishra.arpit4040@gmail.com">mishra.arpit4040@gmail.com</a>'),
          key("linkedin", '<a href="https://www.linkedin.com/in/arpit-mishra-201a331b9/" target="_blank" rel="noopener">arpit-mishra</a>'),
          key("github", '<a href="https://github.com/arpitmishra04" target="_blank" rel="noopener">arpitmishra04</a>'),
          key("timezone", "IST · UTC+5:30"),
          "",
          { t: "LinkedIn or email — I answer both.", c: "d" }
        ]);
      }
    },

    open: {
      about: "open a link — linkedin | github | email | ryan | source",
      run: function (args) {
        var map = {
          linkedin: "https://www.linkedin.com/in/arpit-mishra-201a331b9/",
          github: "https://github.com/arpitmishra04",
          email: "mailto:mishra.arpit4040@gmail.com?subject=Hello%20Arpit",
          ryan: "https://tax.com/",
          source: "https://github.com/arpitmishra04/arpitmishra04"
        };
        var target = (args[0] || "").toLowerCase();
        if (!map[target]) {
          print({ t: "open: unknown target. try " + Object.keys(map).join(" | "), c: "err" });
          return;
        }
        print("opening " + target + " …");
        window.open(map[target], target === "email" ? "_self" : "_blank", "noopener");
      }
    },

    goto: {
      about: "scroll to a section — try 'goto stack'",
      run: function (args) {
        var id = (args[0] || "").toLowerCase();
        var known = ["hero", "now", "impact", "career", "stack", "work", "console", "contact"];
        if (known.indexOf(id) === -1) {
          print({ t: "goto: sections are " + known.join(", "), c: "err" });
          return;
        }
        print("→ " + id);
        var el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },

    theme: {
      about: "switch between ink and paper",
      run: function (args) {
        var want = (args[0] || "").toLowerCase();
        var next = want === "ink" || want === "paper"
          ? want
          : document.documentElement.dataset.theme === "ink" ? "paper" : "ink";
        if (window.Site && window.Site.setTheme) window.Site.setTheme(next);
        print("theme → " + next);
      }
    },

    date: {
      about: "my local time",
      run: function () {
        var f = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Kolkata", weekday: "short", day: "2-digit", month: "short",
          year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false
        });
        print(f.format(new Date()) + " IST");
      }
    },

    clear: {
      about: "wipe the scrollback",
      run: function () { out.innerHTML = ""; }
    },

    sudo: {
      about: "you already know how this ends",
      run: function () {
        print([
          { t: "arpit is not in the sudoers file. This incident has been reported.", c: "err" },
          { t: "…to me. I'll allow it, this once.", c: "d" }
        ]);
      }
    }
  };

  /* ── evaluation ──────────────────────────────────────────────────────── */
  var aliases = {
    ls: "help", "?": "help", man: "help", about: "whoami", who: "whoami",
    skills: "stack", tech: "stack", projects: "work", repos: "work",
    resume: "career", cv: "career", experience: "career", mail: "contact",
    cls: "clear", exit: "clear", dark: "theme", light: "theme", time: "date"
  };

  function run(raw) {
    var text = String(raw).trim();
    line('<span class="d">PS ~ &gt;</span> <b>' + esc(text) + "</b>", "echo");
    if (!text) { out.scrollTop = out.scrollHeight; return; }

    var parts = text.split(/\s+/);
    var name = parts[0].toLowerCase();
    var args = parts.slice(1);

    if (aliases[name]) {
      if (name === "dark") args = ["ink"];
      if (name === "light") args = ["paper"];
      name = aliases[name];
    }

    var cmd = commands[name];
    if (!cmd) {
      print([
        { t: "'" + esc(parts[0]) + "' is not recognised as a command.", c: "err" },
        { t: "Type 'help' for the list.", c: "d" }
      ]);
    } else {
      cmd.run(args);
    }
    gap();
    out.scrollTop = out.scrollHeight;
  }

  function complete(value) {
    var parts = value.split(/\s+/);
    if (parts.length > 1) return null;
    var stem = parts[0].toLowerCase();
    if (!stem) return null;
    var hits = Object.keys(commands).filter(function (n) { return n.indexOf(stem) === 0; });
    if (hits.length === 1) return hits[0] + " ";
    if (hits.length > 1) { print({ t: hits.join("   "), c: "d" }); gap(); }
    return null;
  }

  /* ── events ──────────────────────────────────────────────────────────── */
  input.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      var value = input.value;
      if (value.trim()) {
        history.push(value.trim());
        if (history.length > 60) history.shift();
      }
      cursor = -1;
      draft = "";
      input.value = "";
      run(value);
      return;
    }

    if (ev.key === "Tab") {
      ev.preventDefault();
      var filled = complete(input.value);
      if (filled) input.value = filled;
      return;
    }

    if (ev.key === "ArrowUp") {
      if (!history.length) return;
      ev.preventDefault();
      if (cursor === -1) { draft = input.value; cursor = history.length; }
      cursor = Math.max(0, cursor - 1);
      input.value = history[cursor];
      return;
    }

    if (ev.key === "ArrowDown") {
      if (cursor === -1) return;
      ev.preventDefault();
      cursor++;
      if (cursor >= history.length) { cursor = -1; input.value = draft; }
      else input.value = history[cursor];
      return;
    }

    if (ev.key === "l" && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      out.innerHTML = "";
    }
  });

  shell.addEventListener("click", function (ev) {
    if (ev.target.closest("a, button")) return;
    input.focus();
  });

  document.querySelectorAll("[data-cmd]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      run(btn.dataset.cmd);
      input.focus({ preventScroll: true });
    });
  });

  /* ── boot ────────────────────────────────────────────────────────────── */
  function boot() {
    if (booted) return;
    booted = true;
    print([
      { t: "portfolio shell · v1.0 · type 'help' to begin", c: "d" },
      "",
      { t: "Arpit Mishra — Engineer 1 @ Ryan, LLC", c: "k" },
      "Angular · .NET Core · MS SQL Server · Azure · LangChain",
      ""
    ]);
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { boot(); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(shell);
  } else {
    boot();
  }

  window.Term = {
    run: function (cmd) { boot(); run(cmd); },
    focus: function () {
      boot();
      shell.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(function () { input.focus({ preventScroll: true }); }, 420);
    }
  };
})();
