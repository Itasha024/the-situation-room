/* Puts the page's plain labels in the reader's language (public/i18n/he.js or
 * ar.js, loaded just before this file). It watches the page as it is drawn:
 * any text or label (title, aria-label, placeholder, alt) that is exactly an
 * English key in the list is swapped for its translation. Sentences with
 * numbers or names in them are put together by app.js's T() instead. */
(function () {
  var I = window.DESK_I18N;
  if (!I || !I.s) return;
  var S = I.s;
  var ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
  // What a reader wrote or a source said is never touched here.
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };
  var done = new WeakMap();

  var root = document.documentElement;
  root.lang = I.lang;
  root.dir = I.dir;

  function look(text) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
    var key = m[2].replace(/\s+/g, ' ');
    if (!key) return null;
    var v = S[key];
    if (typeof v !== 'string') return null;
    return m[1] + v + m[3];
  }

  function textNode(n) {
    if (done.get(n) === n.data) return;
    var p = n.parentNode;
    if (p && (SKIP[p.nodeName] || (p.closest && p.closest('[data-no-tr]')))) return;
    var t = look(n.data);
    if (t != null && t !== n.data) n.data = t;
    done.set(n, n.data);
  }

  function attrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      var v = el.getAttribute(a);
      if (!v) continue;
      var t = look(v);
      if (t != null && t !== v) el.setAttribute(a, t);
    }
  }

  function walk(node) {
    if (node.nodeType === 3) { textNode(node); return; }
    if (node.nodeType !== 1 || SKIP[node.nodeName]) return;
    if (node.hasAttribute && node.hasAttribute('data-no-tr')) return;
    attrs(node);
    var w = document.createTreeWalker(node, 5, null); // elements and text
    var n = w.nextNode();
    while (n) {
      if (n.nodeType === 3) textNode(n);
      else if (!SKIP[n.nodeName]) attrs(n);
      n = w.nextNode();
    }
  }

  var mo = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r.type === 'childList') {
        for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]);
      } else if (r.type === 'characterData') {
        textNode(r.target);
      } else if (r.type === 'attributes' && r.target.nodeType === 1) {
        var a = r.attributeName;
        var v = r.target.getAttribute(a);
        var t = v && look(v);
        if (t != null && t !== v) r.target.setAttribute(a, t);
      }
    }
  });
  mo.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  if (document.body) walk(document.body);
  document.addEventListener('DOMContentLoaded', function () { walk(document.body); document.title = look(document.title) || document.title; });
})();
