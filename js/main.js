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
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }

  /* ---------- Copy email ---------- */
  var copyBtn = document.getElementById("copy-email");
  function selectEmail() {
    var el = document.getElementById("email");
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var email = document.getElementById("email").textContent.trim();
      var done = function () {
        copyBtn.textContent = "Copied";
        setTimeout(function () { copyBtn.textContent = "Copy email"; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(done, selectEmail);
      } else {
        selectEmail();
      }
    });
  }

  /* ---------- Rail: highlight the section being read ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll(".index a"));
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
  function mark(id) {
    links.forEach(function (a) { a.removeAttribute("aria-current"); });
    if (byId[id]) byId[id].setAttribute("aria-current", "true");
  }
  var ids = Object.keys(byId);
  window.addEventListener("scroll", function () {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) mark(ids[ids.length - 1]);
  }, { passive: true });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) mark(e.target.id); });
    }, { rootMargin: "-20% 0px -70% 0px" });
    Object.keys(byId).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) io.observe(s);
    });
  }

  /* ---------- Live GitHub stars and release tags (static values are the fallback) ---------- */
  var seen = {};
  Array.prototype.forEach.call(document.querySelectorAll("[data-repo]"), function (card) {
    var repo = card.getAttribute("data-repo");
    if (seen[repo]) return;
    seen[repo] = true;
    var scope = '[data-repo="' + repo + '"] ';
    fetch("https://api.github.com/repos/" + repo, { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        Array.prototype.forEach.call(document.querySelectorAll(scope + "[data-stars]"), function (el) {
          el.textContent = data.stargazers_count;
        });
      })
      .catch(function () {});
    if (!document.querySelector(scope + "[data-release]")) return;
    fetch("https://api.github.com/repos/" + repo + "/releases/latest", { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.tag_name) return;
        Array.prototype.forEach.call(document.querySelectorAll(scope + "[data-release]"), function (el) {
          el.textContent = data.tag_name;
          if (el.tagName === "A") el.href = data.html_url;
        });
      })
      .catch(function () {});
  });
})();
