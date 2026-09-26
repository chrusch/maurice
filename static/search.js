/* Full-text search over the books. Each book's text is a JSON file in
   search/, fetched the first time it's needed. */
(function () {
  "use strict";
  var books = JSON.parse(document.getElementById("search-books").textContent);
  var form = document.querySelector(".search-form");
  var input = document.getElementById("q");
  var select = document.getElementById("in");
  var out = document.getElementById("results");
  var cache = {};        // slug -> Promise of prepared index
  var PER_BOOK = 20;

  // Fold case, accents, ligatures and curly quotes so that "Cæsar" matches "caesar".
  function foldChar(c) {
    switch (c) {
      case "æ": return "ae"; case "Æ": return "ae";
      case "œ": return "oe"; case "Œ": return "oe";
      case "‘": case "’": case "ʼ": return "'";
      case "“": case "”": return '"';
      case "—": case "–": return "-";
    }
    return c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  function fold(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) out += foldChar(s[i]);
    return out;
  }
  // Folded text plus, for each folded character, its index in the original.
  function foldMap(s) {
    var text = "", map = [];
    for (var i = 0; i < s.length; i++) {
      var f = foldChar(s[i]);
      for (var j = 0; j < f.length; j++) { text += f[j]; map.push(i); }
    }
    map.push(s.length);
    return { text: text, map: map };
  }

  function load(slug) {
    if (!cache[slug]) {
      cache[slug] = fetch("search/" + slug + ".json")
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) {
          var paras = [];
          data.pages.forEach(function (pg) {
            pg[2].forEach(function (p) {
              paras.push({ page: pg[0], href: pg[1], n: p[0], text: p[1], folded: fold(p[1]) });
            });
          });
          return { slug: data.slug, title: data.title, paras: paras };
        });
    }
    return cache[slug];
  }

  function parse(q) {
    return (q.match(/"[^"]+"|[^\s"]+/g) || [])
      .map(function (t) { return fold(t.replace(/"/g, "").trim()); })
      .filter(function (t) { return t.length > 0; });
  }

  function esc(s) {
    return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // A term must start at a word boundary: "love" finds "loved" but not "glove".
  function termRegex(t) { return new RegExp("(^|[^a-z0-9])" + reEsc(t), "g"); }

  function snippet(para, res) {
    var fm = foldMap(para.text);
    var spans = [];
    res.forEach(function (re) {
      re.lastIndex = 0;
      var m;
      while ((m = re.exec(fm.text))) {
        var start = m.index + m[1].length;
        var end = m.index + m[0].length;
        spans.push([fm.map[start], fm.map[end]]);
        if (m[0].length === 0) re.lastIndex++;
      }
    });
    spans.sort(function (a, b) { return a[0] - b[0]; });
    var first = spans.length ? spans[0][0] : 0;
    var from = Math.max(0, first - 110), to = Math.min(para.text.length, first + 220);
    if (from > 0) from = para.text.indexOf(" ", from) + 1;
    var html = "", pos = from;
    spans.forEach(function (s) {
      if (s[0] < pos || s[1] > to) return;
      html += esc(para.text.slice(pos, s[0])) + "<mark>" + esc(para.text.slice(s[0], s[1])) + "</mark>";
      pos = s[1];
    });
    html += esc(para.text.slice(pos, to));
    return (from > 0 ? "… " : "") + html + (to < para.text.length ? " …" : "");
  }

  var seq = 0;
  function run(push) {
    var q = input.value.trim();
    var only = select.value;
    var params = new URLSearchParams();
    if (q) params.set("q", q);
    if (only) params.set("in", only);
    var url = "search.html" + (params.toString() ? "?" + params : "");
    if (push) history.replaceState(null, "", url);

    var terms = parse(q);
    if (!terms.length || terms.join("").length < 2) { out.innerHTML = ""; return; }
    var my = ++seq;
    var targets = books.filter(function (b) { return !only || b.slug === only; });
    out.innerHTML = '<p class="results-summary">Searching…</p>';
    var res = terms.map(termRegex);

    Promise.all(targets.map(function (b) { return load(b.slug); })).then(function (indexes) {
      if (my !== seq) return;
      var total = 0, bookCount = 0, html = "";
      indexes.forEach(function (ix) {
        var hits = ix.paras.filter(function (p) {
          return res.every(function (re) { re.lastIndex = 0; return re.test(p.folded); });
        });
        if (!hits.length) return;
        total += hits.length;
        bookCount++;
        html += '<section class="result-book" data-slug="' + esc(ix.slug) + '"><h2>' + esc(ix.title) +
          "<span>" + hits.length + (hits.length === 1 ? " passage" : " passages") + "</span></h2>";
        html += hits.slice(0, PER_BOOK).map(function (p) { return result(p, res, q); }).join("");
        if (hits.length > PER_BOOK) {
          html += '<p class="more-results"><button type="button" data-more="' + esc(ix.slug) + '">Show all ' + hits.length + "</button></p>";
        }
        html += "</section>";
        cacheHits[ix.slug] = hits;
      });
      out.innerHTML = total
        ? '<p class="results-summary">' + total + (total === 1 ? " passage" : " passages") + " in " + bookCount + (bookCount === 1 ? " book" : " books") + "</p>" + html
        : '<p class="results-summary">Nothing found for “' + esc(q) + "”.</p>";
      lastRes = res;
      lastQ = q;
    }).catch(function () {
      out.innerHTML = '<p class="results-summary">The search index could not be loaded. (Search needs the site to be served over HTTP, not opened as a file.)</p>';
    });
  }

  var cacheHits = {}, lastRes = [], lastQ = "";
  function result(p, res, q) {
    return '<a class="result" href="' + esc(p.href) + "?hl=" + encodeURIComponent(q) + "#p" + p.n + '">' +
      '<span class="result-where">' + esc(p.page) + "</span>" +
      '<span class="result-text">' + snippet(p, res) + "</span></a>";
  }

  out.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-more]");
    if (!btn) return;
    var slug = btn.dataset.more;
    var section = out.querySelector('.result-book[data-slug="' + slug + '"]');
    section.querySelectorAll(".result").forEach(function (r) { r.remove(); });
    btn.parentNode.insertAdjacentHTML("beforebegin", cacheHits[slug].map(function (p) { return result(p, lastRes, lastQ); }).join(""));
    btn.parentNode.remove();
  });

  var timer;
  input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { run(true); }, 280); });
  select.addEventListener("change", function () { run(true); });
  form.addEventListener("submit", function (ev) { ev.preventDefault(); run(true); });

  var params = new URLSearchParams(location.search);
  if (params.get("in")) select.value = params.get("in");
  if (params.get("q")) { input.value = params.get("q"); run(false); }
})();
