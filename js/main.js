(function () {
  "use strict";

  /* ---------- Theme toggle ---------- */
  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");
  function currentTheme() {
    var set = root.getAttribute("data-theme");
    if (set) return set;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  try {
    var saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
  } catch (e) {}
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      drawEQ();
    });
  }

  /* ---------- Copy email ---------- */
  var copyBtn = document.getElementById("copy-email");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var email = document.getElementById("email").textContent.trim();
      var done = function () {
        copyBtn.textContent = "Copied";
        setTimeout(function () { copyBtn.textContent = "Copy email"; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(done, function () { selectEmail(); });
      } else {
        selectEmail();
      }
    });
  }
  function selectEmail() {
    var el = document.getElementById("email");
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /* ---------- Live GitHub stats (static fallback already in the markup) ---------- */
  var cards = document.querySelectorAll("[data-repo]");
  var seen = {};
  Array.prototype.forEach.call(cards, function (card) {
    var repo = card.getAttribute("data-repo");
    if (seen[repo]) return;
    seen[repo] = true;
    fetch("https://api.github.com/repos/" + repo, { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        Array.prototype.forEach.call(document.querySelectorAll('[data-repo="' + repo + '"] [data-stars]'), function (el) {
          el.textContent = data.stargazers_count;
        });
      })
      .catch(function () {});
    if (!document.querySelector('[data-repo="' + repo + '"] [data-release]')) return;
    fetch("https://api.github.com/repos/" + repo + "/releases/latest", { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.tag_name) return;
        Array.prototype.forEach.call(document.querySelectorAll('[data-repo="' + repo + '"] [data-release]'), function (el) {
          el.textContent = data.tag_name;
          if (el.tagName === "A") el.href = data.html_url;
        });
      })
      .catch(function () {});
  });

  /* ---------- Interactive parametric EQ curve ---------- */
  var canvas = document.getElementById("eq");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var FS = 48000;
  var FMIN = 20, FMAX = 20000, DBMAX = 12;
  var bands = [
    { type: "lowshelf", f: 90, g: 3.0, q: 0.7 },
    { type: "peak", f: 420, g: -3.5, q: 1.4 },
    { type: "peak", f: 2800, g: 2.5, q: 1.0 },
    { type: "highshelf", f: 9000, g: -2.0, q: 0.7 }
  ];
  var readout = document.getElementById("eq-readout");
  var dragging = -1;
  var W = 0, H = 0, dpr = 1;

  function coeffs(b) {
    var A = Math.pow(10, b.g / 40);
    var w0 = 2 * Math.PI * b.f / FS;
    var cw = Math.cos(w0), sw = Math.sin(w0);
    var alpha = sw / (2 * b.q);
    var b0, b1, b2, a0, a1, a2;
    if (b.type === "peak") {
      b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A;
    } else {
      var sq = 2 * Math.sqrt(A) * alpha;
      if (b.type === "lowshelf") {
        b0 = A * ((A + 1) - (A - 1) * cw + sq); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - sq);
        a0 = (A + 1) + (A - 1) * cw + sq; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - sq;
      } else {
        b0 = A * ((A + 1) + (A - 1) * cw + sq); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - sq);
        a0 = (A + 1) - (A - 1) * cw + sq; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - sq;
      }
    }
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  function magDb(c, f) {
    var w = 2 * Math.PI * f / FS;
    var c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
    var nr = c[0] + c[1] * c1 + c[2] * c2, ni = -(c[1] * s1 + c[2] * s2);
    var dr = 1 + c[3] * c1 + c[4] * c2, di = -(c[3] * s1 + c[4] * s2);
    return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
  }
  function xOf(f) { return Math.log(f / FMIN) / Math.log(FMAX / FMIN) * W; }
  function fOf(x) { return FMIN * Math.pow(FMAX / FMIN, x / W); }
  function yOf(db) { return H / 2 - (db / DBMAX) * (H / 2 - 14); }
  function dbOf(y) { return (H / 2 - y) / (H / 2 - 14) * DBMAX; }
  function css(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawEQ();
  }

  function drawEQ() {
    if (!W) return;
    var grid = css("--grid"), muted = css("--muted"), accent = css("--accent"), surface = css("--surface");
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = surface; ctx.fillRect(0, 0, W, H);
    ctx.font = "10px " + css("--font-mono");
    ctx.textBaseline = "top";
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].forEach(function (f) {
      var x = Math.round(xOf(f)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      if (f !== 20 && f !== 20000) {
        ctx.fillStyle = muted;
        ctx.fillText(f >= 1000 ? (f / 1000) + "k" : String(f), x + 3, H - 13);
      }
    });
    [-12, -6, 0, 6, 12].forEach(function (db) {
      var y = Math.round(yOf(db)) + 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      if (db !== 12 && db !== -12) { ctx.fillStyle = muted; ctx.fillText((db > 0 ? "+" : "") + db + " dB", 4, y + 2); }
    });
    var cs = bands.map(coeffs);
    ctx.beginPath();
    var N = Math.max(120, Math.floor(W / 2));
    for (var i = 0; i <= N; i++) {
      var x = i / N * W;
      var f = fOf(x), db = 0;
      for (var k = 0; k < cs.length; k++) db += magDb(cs[k], f);
      var y = yOf(Math.max(-DBMAX, Math.min(DBMAX, db)));
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = accent; ctx.lineWidth = 2.25; ctx.lineJoin = "round"; ctx.stroke();
    ctx.lineTo(W, yOf(0)); ctx.lineTo(0, yOf(0)); ctx.closePath();
    ctx.fillStyle = css("--accent-soft"); ctx.fill();
    bands.forEach(function (b, i) {
      var x = xOf(b.f), y = yOf(b.g);
      ctx.beginPath(); ctx.arc(x, y, i === dragging ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = surface; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = accent; ctx.stroke();
      ctx.fillStyle = muted;
      ctx.fillText(String(i + 1), x - 3, y - 18);
    });
    if (readout) {
      readout.textContent = bands.map(function (b, i) {
        var f = b.f >= 1000 ? (b.f / 1000).toFixed(b.f >= 10000 ? 1 : 2) + " kHz" : Math.round(b.f) + " Hz";
        return (i + 1) + ": " + f + " " + (b.g >= 0 ? "+" : "") + b.g.toFixed(1) + " dB";
      }).join("   ");
    }
  }

  function pointer(ev) {
    var r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }
  canvas.addEventListener("pointerdown", function (ev) {
    var p = pointer(ev), best = -1, bd = 400;
    bands.forEach(function (b, i) {
      var dx = xOf(b.f) - p.x, dy = yOf(b.g) - p.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0) return;
    dragging = best;
    canvas.setPointerCapture(ev.pointerId);
    canvas.style.cursor = "grabbing";
    drawEQ();
  });
  canvas.addEventListener("pointermove", function (ev) {
    if (dragging < 0) return;
    var p = pointer(ev);
    var b = bands[dragging];
    b.f = Math.max(FMIN, Math.min(FMAX, fOf(Math.max(0, Math.min(W, p.x)))));
    b.g = Math.max(-DBMAX, Math.min(DBMAX, dbOf(p.y)));
    drawEQ();
  });
  function release() { if (dragging < 0) return; dragging = -1; canvas.style.cursor = "grab"; drawEQ(); }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  window.addEventListener("resize", resize);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawEQ);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawEQ);
  resize();
})();
