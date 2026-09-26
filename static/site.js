/* F. D. Maurice — small enhancements. The site works without any of this. */
(function () {
  "use strict";
  var doc = document.documentElement;

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  /* ---- light / dark ---- */
  document.querySelectorAll('[data-action="theme"]').forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dark = doc.dataset.theme
        ? doc.dataset.theme === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches;
      doc.dataset.theme = dark ? "light" : "dark";
      store("fdm-theme", doc.dataset.theme);
    });
  });

  /* ---- text size: steps 0-6 (see site.css); unset means the default ---- */
  var MAX_SIZE = 6;
  var sizeButtons = document.querySelectorAll('[data-action="size"]');
  function currentSize() {
    var n = parseInt(doc.dataset.size, 10);
    if (n >= 0 && n <= MAX_SIZE) return n;
    return matchMedia("(max-width: 40rem)").matches ? 1 : 2;
  }
  function markSizeLimits() {
    var n = currentSize();
    sizeButtons.forEach(function (b) {
      b.disabled = Number(b.dataset.step) < 0 ? n === 0 : n === MAX_SIZE;
    });
  }
  sizeButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      doc.dataset.size = String(Math.max(0, Math.min(MAX_SIZE, currentSize() + Number(btn.dataset.step))));
      store("fdm-size", doc.dataset.size);
      markSizeLimits();
    });
  });
  markSizeLimits();

  /* ---- home: rotating quotation ---- */
  var quote = document.querySelector(".quote[data-quotes]");
  if (quote) {
    var quotes = JSON.parse(quote.dataset.quotes);
    var qi = Math.floor(Math.random() * quotes.length);
    var showQuote = function (q) {
      quote.querySelector("blockquote p").textContent = q.text;
      var a = quote.querySelector("cite a");
      a.textContent = q.book;
      a.href = q.href;
    };
    // Only change the quotation while it is on screen: quotations differ in
    // length, and a change out of sight would shift the page under the reader.
    var onScreen = function () {
      var r = quote.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    };
    if (quotes.length > 1) {
      showQuote(quotes[qi]);
      setInterval(function () {
        if (!onScreen() || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        quote.classList.add("is-changing");
        setTimeout(function () {
          qi = (qi + 1) % quotes.length;
          showQuote(quotes[qi]);
          quote.classList.remove("is-changing");
        }, 500);
      }, 14000);
    }
  }

  /* ---- book page: "continue where you left off" ---- */
  var resume = document.querySelector("[data-resume]");
  if (resume) {
    try {
      var last = JSON.parse(store("fdm-last:" + resume.dataset.resume) || "null");
      if (last && last.href) {
        var a = resume.querySelector("a");
        a.href = last.href;
        a.textContent = last.title;
        resume.hidden = false;
      }
    } catch (e) {}
  }

  var reader = document.querySelector("main.reader");
  if (!reader) return;

  /* ---- remember the page being read ---- */
  store("fdm-last:" + reader.dataset.book, JSON.stringify({
    href: reader.dataset.page,
    title: reader.dataset.title + (reader.classList.contains("is-modern") ? " (modern English)" : "")
  }));

  /* ---- contents drawer ---- */
  var drawer = document.getElementById("drawer");
  var scrim = document.querySelector(".scrim");
  var opener = document.querySelector('[data-action="drawer"]');
  function setDrawer(open) {
    if (open) {
      drawer.hidden = false;
      scrim.hidden = false;
      requestAnimationFrame(function () { drawer.classList.add("open"); });
      var cur = drawer.querySelector(".current");
      if (cur) cur.scrollIntoView({ block: "center" });
      drawer.querySelector("a, button").focus({ preventScroll: true });
    } else {
      drawer.classList.remove("open");
      scrim.hidden = true;
      setTimeout(function () { if (!drawer.classList.contains("open")) drawer.hidden = true; }, 250);
    }
    opener.setAttribute("aria-expanded", String(open));
  }
  opener.addEventListener("click", function () { setDrawer(!drawer.classList.contains("open")); });
  document.querySelectorAll('[data-action="drawer-close"]').forEach(function (el) {
    el.addEventListener("click", function () { setDrawer(false); opener.focus(); });
  });

  /* ---- reading progress ---- */
  var bar = document.querySelector(".progress span");
  var ticking = false;
  function progress() {
    var max = doc.scrollHeight - doc.clientHeight;
    bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, doc.scrollTop / max) : 1) + ")";
    ticking = false;
  }
  addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(progress); }
  }, { passive: true });
  progress();

  /* ---- keyboard: ← → between pages, Esc closes things ---- */
  addEventListener("keydown", function (ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.shiftKey) return;
    if (ev.target.closest && ev.target.closest("input, textarea, select, [contenteditable]")) return;
    if (ev.key === "Escape") { setDrawer(false); closeNote(); return; }
    var rel = ev.key === "ArrowLeft" ? "prev" : ev.key === "ArrowRight" ? "next" : null;
    var link = rel && document.querySelector('.pager a[rel="' + rel + '"]');
    if (link) location.href = link.href;
  });

  /* ---- "Report a mistake": bring along the words the reader selected ---- */
  var report = document.querySelector(".report-link");
  if (report) {
    report.addEventListener("click", function () {
      var sel = window.getSelection();
      var text = sel ? String(sel).trim().replace(/\s+/g, " ").slice(0, 600) : "";
      if (!text) return;
      var node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
      var para = node && node.closest && node.closest(".text p[id], .text li[id]");
      var url = new URL(report.href, location.href);
      url.searchParams.set("quote", text);
      if (para) url.searchParams.set("url", url.searchParams.get("url").split("#")[0] + "#" + para.id);
      report.href = url.toString();
    });
  }

  /* ---- paragraph links (¶ in the margin) ---- */
  document.querySelectorAll(".text > p[id]").forEach(function (p) {
    var a = document.createElement("a");
    a.className = "pl";
    a.href = "#" + p.id;
    a.textContent = "¶";
    a.setAttribute("aria-label", "Link to this paragraph");
    p.insertBefore(a, p.firstChild);
  });

  /* ---- footnotes as pop-ups ---- */
  var pop = null;
  function closeNote() { if (pop) { pop.remove(); pop = null; } }
  document.addEventListener("click", function (ev) {
    var ref = ev.target.closest && ev.target.closest("a.footnote-ref");
    if (!ref) {
      if (pop && !pop.contains(ev.target)) closeNote();
      return;
    }
    var note = document.getElementById(ref.getAttribute("href").slice(1));
    if (!note) return;
    ev.preventDefault();
    closeNote();
    pop = document.createElement("div");
    pop.className = "note-pop";
    pop.setAttribute("role", "note");
    pop.innerHTML = note.innerHTML;
    pop.querySelectorAll(".footnote-back").forEach(function (b) { b.remove(); });
    document.body.appendChild(pop);
    var r = ref.getBoundingClientRect();
    var w = pop.offsetWidth;
    var left = Math.max(16, Math.min(r.left + scrollX - w / 2, scrollX + doc.clientWidth - w - 16));
    pop.style.left = left + "px";
    pop.style.top = (r.bottom + scrollY + 8) + "px";
  });

  /* ---- highlight search terms (?hl=…) in the linked paragraph ---- */
  var hl = new URLSearchParams(location.search).get("hl");
  var target = location.hash && document.getElementById(location.hash.slice(1));
  if (hl && target) {
    var terms = (hl.match(/"[^"]+"|\S+/g) || []).map(function (t) { return t.replace(/"/g, ""); }).filter(Boolean);
    if (terms.length) {
      var re = new RegExp("(" + terms.map(function (t) {
        return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }).join("|") + ")", "gi");
      var walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (node) {
        if (!re.test(node.nodeValue)) return;
        re.lastIndex = 0;
        var frag = document.createDocumentFragment();
        node.nodeValue.split(re).forEach(function (part, i) {
          if (i % 2) {
            var m = document.createElement("mark");
            m.textContent = part;
            frag.appendChild(m);
          } else if (part) {
            frag.appendChild(document.createTextNode(part));
          }
        });
        node.parentNode.replaceChild(frag, node);
      });
    }
  }
})();
