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
    // Where the system asks for reduced motion the quotation still changes,
    // on the same schedule, but without the fade.
    var still = matchMedia("(prefers-reduced-motion: reduce)");
    var next = function () {
      qi = (qi + 1) % quotes.length;
      showQuote(quotes[qi]);
    };
    if (quotes.length > 1) {
      showQuote(quotes[qi]);
      setInterval(function () {
        if (!onScreen() || document.hidden) return;
        if (still.matches) return next();
        quote.classList.add("is-changing");
        setTimeout(function () {
          next();
          quote.classList.remove("is-changing");
        }, 500);
      }, 42000);
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

  /* ---- Index of Quotations: a verse's words from its number; one group of
     books only (?in=sermons); every verse shown; a search of the verses (?q=) ---- */
  var qMenu = document.getElementById("q-in");
  if (qMenu) {
    var qFind = document.getElementById("q-find"), qAll = document.getElementById("q-all");
    var qCount = document.getElementById("q-count");
    var fold = function (s) {
      return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’‘]/g, "'");
    };
    var reEsc = function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); };
    var rows = Array.prototype.map.call(document.querySelectorAll(".text-row"), function (r) {
      var verse = r.querySelector(".verse");
      return { el: r, verse: verse, html: verse.innerHTML, button: r.querySelector(".vref"), open: false,
               words: fold(r.closest(".text-book").querySelector("h2").textContent + " " +
                           r.querySelector("dt").textContent + " " + verse.textContent) };
    });
    var marked = function (el, re) {             // the words searched for, marked in the verse
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (node) {
        if (!re.test(node.nodeValue)) return;
        re.lastIndex = 0;
        var frag = document.createDocumentFragment();
        node.nodeValue.split(re).forEach(function (part, i) {
          if (i % 2) { var m = document.createElement("mark"); m.textContent = part; frag.appendChild(m); }
          else if (part) frag.appendChild(document.createTextNode(part));
        });
        node.parentNode.replaceChild(frag, node);
      });
    };
    var showQuotations = function () {
      var kind = qMenu.value, q = qFind.value.trim(), shown = 0;
      var terms = (q.match(/"[^"]+"|[^\s"]+/g) || []).map(function (t) { return fold(t.replace(/"/g, "")); })
        .filter(Boolean);
      var tests = terms.map(function (t) { return new RegExp("(^|[^a-z0-9])" + reEsc(t)); });
      var mark = terms.length && new RegExp("(" + terms.map(reEsc).join("|") + ")", "gi");
      rows.forEach(function (r) {
        r.el.querySelectorAll(".q").forEach(function (p) { p.hidden = !!kind && p.dataset.kind !== kind; });
        r.el.hidden = !r.el.querySelector(".q:not([hidden])") || !tests.every(function (t) { return t.test(r.words); });
        var open = !r.el.hidden && (qAll.checked || terms.length > 0 || r.open);
        r.verse.innerHTML = r.html;
        if (open && mark) marked(r.verse, mark);
        r.verse.hidden = !open;
        r.button.setAttribute("aria-expanded", open);
        if (!r.el.hidden) shown++;
      });
      document.querySelectorAll(".text-book").forEach(function (b) {
        b.hidden = !b.querySelector(".text-row:not([hidden])");
        var link = document.querySelector('.brief-toc a[href="#' + b.id + '"]');
        if (link) link.hidden = b.hidden;
      });
      qCount.hidden = !(kind || terms.length);
      qCount.textContent = shown ? shown + (shown === 1 ? " passage" : " passages") : "Nothing found.";
      var params = new URLSearchParams();
      if (q) params.set("q", q);
      if (kind) params.set("in", kind);
      history.replaceState(null, "", (params.toString() ? "?" + params : location.pathname) + location.hash);
    };
    rows.forEach(function (r) {
      r.button.addEventListener("click", function () {
        r.open = r.verse.hidden;
        r.verse.hidden = !r.open;
        r.button.setAttribute("aria-expanded", r.open);
      });
    });
    var given = new URLSearchParams(location.search);
    if (given.get("in") && qMenu.querySelector('option[value="' + given.get("in") + '"]')) qMenu.value = given.get("in");
    if (given.get("q")) qFind.value = given.get("q");
    var typing;
    qFind.addEventListener("input", function () { clearTimeout(typing); typing = setTimeout(showQuotations, 250); });
    qMenu.addEventListener("change", showQuotations);
    qAll.addEventListener("change", showQuotations);
    qFind.form.addEventListener("submit", function (ev) { ev.preventDefault(); showQuotations(); });
    if (qMenu.value || qFind.value) showQuotations();
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

  /* ---- mark the words quoted from the Bible (?quote=…, from the Index of
     Quotations) in the linked paragraph. Words are reckoned as
     tools/quotations.py reckons them, SPELLING and all. ---- */
  var quote = new URLSearchParams(location.search).get("quote");
  var quoted = location.hash && document.getElementById(location.hash.slice(1));
  if (quote && quoted) {
    var SPELLING = { neighbor: "neighbour", neighbors: "neighbours", honor: "honour", labor: "labour",
      labored: "laboured", savior: "saviour", favor: "favour", color: "colour", shew: "show", shewed: "showed",
      shewn: "shown", shewing: "showing", sheweth: "showeth", oh: "o" };
    var walker = document.createTreeWalker(quoted, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    var folded = "", from = [];                 // the paragraph folded, and where each of its letters came from
    nodes.forEach(function (node, n) {
      for (var i = 0; i < node.nodeValue.length; i++) {
        var f = node.nodeValue[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
          .replace("æ", "ae").replace("œ", "oe").replace(/[’‘]/, "'");
        for (var j = 0; j < f.length; j++) { folded += f[j]; from.push([n, i]); }
      }
    });
    var words = [], m, wordRe = /[a-z]+(?:'[a-z]+)?/g;
    while ((m = wordRe.exec(folded))) {
      var w = m[0].replace(/'s/g, "s");
      words.push({ w: SPELLING[w] || w, start: m.index, end: m.index + m[0].length });
    }
    var spans = nodes.map(function () { return []; });
    quote.split("|").forEach(function (part) {
      var want = part.trim().split(/\s+/).filter(Boolean);
      for (var i = 0; want.length && i + want.length <= words.length; i++) {
        if (!want.every(function (w, k) { return words[i + k].w === w; })) continue;
        var a = from[words[i].start], b = from[words[i + want.length - 1].end - 1];
        for (var n = a[0]; n <= b[0]; n++) {       // (not the spaces that only lay out the lines between)
          var t = nodes[n].nodeValue;
          var lo = n === a[0] ? a[1] : t.length - t.replace(/^\s+/, "").length;
          var hi = n === b[0] ? b[1] + 1 : t.replace(/\s+$/, "").length;
          if (lo < hi) spans[n].push([lo, hi]);
        }
      }
    });
    nodes.forEach(function (node, n) {
      if (!spans[n].length) return;
      var text = node.nodeValue, frag = document.createDocumentFragment(), pos = 0;
      spans[n].sort(function (x, y) { return x[0] - y[0]; }).forEach(function (sp) {
        var start = Math.max(sp[0], pos);
        if (start >= sp[1]) return;
        if (start > pos) frag.appendChild(document.createTextNode(text.slice(pos, start)));
        var mk = document.createElement("mark");
        mk.className = "quoted";
        mk.textContent = text.slice(start, sp[1]);
        frag.appendChild(mk);
        pos = sp[1];
      });
      if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
      node.parentNode.replaceChild(frag, node);
    });
  }

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
