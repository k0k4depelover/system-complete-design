/* Glosario: enlaces automáticos a términos técnicos, tooltips para [data-term] y renderizado de glosario.html.

   Cada término técnico enlaza a la sección donde se explica a fondo (campo `deep` del glosario) o, si ese
   módulo aún no está publicado, a su entrada del glosario. Se enlaza la primera mención por sección h2:
   un párrafo con diez enlaces se lee peor que uno con dos. Los términos `basic` no se enlazan solos. */
(function () {
  'use strict';

  var SD = window.SD;
  var h = SD.h;
  var terms = SD.data.glossary;

  SD.catNames = {
    metodo: 'Método y operación',
    redes: 'Redes y protocolos',
    datos: 'Datos y almacenamiento',
    distribuidos: 'Sistemas distribuidos',
    resiliencia: 'Resiliencia',
    seguridad: 'Seguridad',
    ia: 'IA e inferencia',
    pagos: 'Pagos',
    edge: 'Edge y CDN'
  };

  var here = document.body.getAttribute('data-module');
  var onGlossary = !!document.querySelector('[data-glossary-index]');

  /* ---------- Destino de cada término ---------- */

  /* Sección h2 que contiene cada id de encabezado de esta página: evita enlazar a la sección en la que ya estás. */
  var secOfId = null;
  function sectionOf(id) {
    if (!secOfId) {
      secOfId = {};
      var cur = '';
      document.querySelectorAll('.content h2[id], .content h3[id], .content h4[id]').forEach(function (el) {
        if (el.tagName === 'H2') cur = el.id;
        secOfId[el.id] = cur;
      });
    }
    return secOfId[id];
  }

  /* Enlace a la explicación a fondo, o null si no aplica (módulo sin publicar o misma sección). */
  function deepLink(t, secId) {
    if (!t || !t.deep) return null;
    var p = t.deep.split('#');
    var it = SD.courseItem(p[0]);
    if (!it || it.status !== 'ready') return null;
    var anchor = p[1] || '';
    if (p[0] !== here) {
      return { href: SD.url(it.href) + (anchor ? '#' + anchor : ''), label: 'Tema completo: ' + it.num + ' ' + it.short };
    }
    var target = anchor && document.getElementById(anchor);
    if (!target || (secId != null && sectionOf(anchor) === secId)) return null;
    return { href: '#' + anchor, label: 'En esta página: ' + SD.headingText(target) };
  }

  function glossaryHref(t) { return onGlossary ? '#t-' + t.id : SD.url('glosario.html#t-' + t.id); }

  function targetOf(t, secId) {
    if (onGlossary) return glossaryHref(t);
    var d = deepLink(t, secId);
    return d ? d.href : glossaryHref(t);
  }

  /* ---------- Buscador de alias ---------- */

  var matcher = null;

  function esc(s) { return s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&'); }

  /* Las frases de un término compuesto ("RED y USE", "QPS / RPS") no se buscan tal cual: se usan sus alias. */
  function namesOf(t) {
    var names = (t.aliases || []).slice();
    if (!/ \/ | y | e /.test(t.term)) names.push(t.term);
    return names;
  }

  function buildMatcher() {
    var ci = [], cs = [], owner = {};
    Object.keys(terms).forEach(function (id) {
      var t = terms[id];
      if (t.basic || t.noauto) return;
      namesOf(t).forEach(function (n) {
        var key = n.toLowerCase();
        if (owner[key] && owner[key] !== id) console.warn('[SD glosario] alias repetido:', n, owner[key], id);
        owner[key] = id;
        /* Mayúsculas después de la primera letra (JWT, gRPC, reloj de Lamport): se respeta la capitalización */
        (/\p{Lu}/u.test(n.slice(1)) ? cs : ci).push(n);
      });
    });
    function rx(list, flags, keepCase) {
      if (!list.length) return null;
      list.sort(function (a, b) { return b.length - a.length; });
      var alt = list.map(function (n) {
        var e = esc(n).replace(/ +/g, '\\s+');
        var c = n.charAt(0);
        if (keepCase && c.toLowerCase() !== c.toUpperCase()) e = '[' + c.toLowerCase() + c.toUpperCase() + ']' + e.slice(1);
        return e;
      }).join('|');
      /* Límites de palabra con Unicode: "sharding" no dispara "shard", "Spanner" no dispara "span" */
      return new RegExp('(?<![\\p{L}\\p{N}_\\-/.@#])(' + alt + ')(?:s|es)?(?![\\p{L}\\p{N}_/]|-[\\p{L}\\p{N}])', flags);
    }
    matcher = { ci: rx(ci, 'giu', false), cs: rx(cs, 'gu', true), owner: owner };
  }

  function findTerms(text) {
    var found = [];
    [matcher.ci, matcher.cs].forEach(function (re) {
      if (!re) return;
      re.lastIndex = 0;
      var m;
      while ((m = re.exec(text))) {
        var id = matcher.owner[m[1].replace(/\s+/g, ' ').toLowerCase()];
        if (id) found.push({ i: m.index, len: m[0].length, id: id });
      }
    });
    found.sort(function (a, b) { return a.i - b.i || b.len - a.len; });
    var out = [], end = 0;
    found.forEach(function (x) { if (x.i >= end) { out.push(x); end = x.i + x.len; } });
    return out;
  }

  /* ---------- Enlazado ---------- */

  /* Dentro de estos elementos no se enlaza texto: encabezados, código, controles, widgets y bloques de datos. */
  var SKIP = 'h1,h2,h3,h4,h5,h6,a,code,pre,kbd,samp,button,label,summary,select,textarea,svg,script,style,' +
    '.objectives,.title-block,.tb-grid,.toc,.pager,[data-quiz],[data-checkpoint],[data-sim],[data-calc],[data-map],' +
    '.ep-head,.schema-head,.schema-chip,.sdm-step-n,.sdm-step-title,.sdm-plabel,.no-autolink';

  /* <dfn data-term> y <span data-term> escritos a mano se convierten en enlaces. */
  function linkExplicit(el, secId) {
    var id = el.getAttribute('data-term');
    var t = terms[id];
    if (!t) {
      console.warn('[SD glosario] término no definido:', id);
      el.classList.add('term-missing');
      return;
    }
    if (el.tagName === 'A') {
      el.classList.add('term-link');
      if (!el.getAttribute('href')) el.setAttribute('href', targetOf(t, secId));
      return;
    }
    if (el.parentNode && el.parentNode.closest && el.parentNode.closest('a')) {
      /* Un enlace no puede ir dentro de otro: queda como término con tooltip */
      el.classList.add('term');
      if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
      return;
    }
    var a = h('a', { class: 'term-link', href: targetOf(t, secId), 'data-term': id });
    while (el.firstChild) a.appendChild(el.firstChild);
    if (el.tagName === 'DFN') {
      el.removeAttribute('data-term');
      el.appendChild(a);
    } else {
      el.parentNode.replaceChild(a, el);
    }
  }

  /* Enlaza los términos de root. opts.exclude: id que no se enlaza (la propia entrada del glosario). */
  function autolink(root, opts) {
    if (!root) return;
    opts = opts || {};
    if (!matcher) buildMatcher();

    var items = [], explicit = {}, secIds = [null], sec = 0;
    function walk(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      for (var i = 0; i < kids.length; i++) {
        var n = kids[i];
        if (n.nodeType === 3) {
          if (/\S/.test(n.nodeValue)) items.push({ node: n, sec: sec });
          continue;
        }
        if (n.nodeType !== 1) continue;
        if (n.tagName === 'H2') { sec++; secIds[sec] = n.id || ''; continue; }
        if (n.hasAttribute('data-term')) {
          items.push({ el: n, sec: sec });
          (explicit[sec] = explicit[sec] || {})[n.getAttribute('data-term')] = true;
          continue;
        }
        if (n.matches(SKIP)) {
          /* Los términos marcados a mano dentro de bloques omitidos también se convierten */
          n.querySelectorAll('[data-term]').forEach(function (d) {
            if (!d.closest('svg')) items.push({ el: d, sec: sec });
          });
          continue;
        }
        walk(n);
      }
    }
    walk(root);

    var seen = {};
    items.forEach(function (x) {
      var secId = secIds[x.sec];
      var s = seen[x.sec] || (seen[x.sec] = {});
      if (x.el) { s[x.el.getAttribute('data-term')] = true; linkExplicit(x.el, secId); return; }
      var text = x.node.nodeValue;
      var hits = findTerms(text).filter(function (m) {
        if (m.id === opts.exclude || s[m.id] || (explicit[x.sec] && explicit[x.sec][m.id])) return false;
        s[m.id] = true;
        return true;
      });
      if (!hits.length) return;
      var frag = document.createDocumentFragment(), pos = 0;
      hits.forEach(function (m) {
        if (m.i > pos) frag.appendChild(document.createTextNode(text.slice(pos, m.i)));
        frag.appendChild(h('a', { class: 'term-link', href: targetOf(terms[m.id], secId), 'data-term': m.id, text: text.substr(m.i, m.len) }));
        pos = m.i + m.len;
      });
      if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
      x.node.parentNode.replaceChild(frag, x.node);
    });
  }

  SD.autolink = autolink;

  /* ---------- Tooltips (delegación: sirven también para enlaces creados después) ---------- */

  function initTooltips() {
    var tip = h('div', { class: 'gl-tip', id: 'gl-tip', role: 'tooltip', hidden: true });
    document.body.appendChild(tip);
    var owner = null, hideTimer = null, lastPointer = 'mouse';

    function termOf(node) {
      var el = node && node.closest ? node.closest('[data-term]') : null;
      return el && terms[el.getAttribute('data-term')] && !tip.contains(el) ? el : null;
    }

    function sectionIdOf(el) {
      var hd = el.closest('.gl-entry');
      if (hd) return null;
      var n = el, prev;
      while (n && n !== document.body) {
        prev = n.previousElementSibling;
        while (prev) {
          if (prev.tagName === 'H2') return prev.id || '';
          prev = prev.previousElementSibling;
        }
        n = n.parentElement;
      }
      return '';
    }

    function fill(t, el) {
      tip.innerHTML = '';
      var head = h('p', { class: 'gl-tip-term' }, [t.term]);
      if (t.en && t.en !== t.term) head.appendChild(h('span', { class: 'gl-tip-en', text: t.en }));
      tip.appendChild(head);
      tip.appendChild(h('p', { class: 'gl-tip-short', text: t.short }));
      var links = h('p', { class: 'gl-tip-links' });
      var d = deepLink(t, sectionIdOf(el));
      if (d) links.appendChild(h('a', { class: 'gl-tip-link', href: d.href, text: d.label }));
      if (!onGlossary) links.appendChild(h('a', { class: 'gl-tip-link', href: SD.url('glosario.html#t-' + t.id), text: 'Ver en el glosario' }));
      if (links.childNodes.length) tip.appendChild(links);
    }

    function place(el) {
      var r = el.getBoundingClientRect();
      tip.style.left = '0px'; tip.style.top = '0px';
      var tw = tip.offsetWidth, th = tip.offsetHeight, gap = 8;
      var vw = document.documentElement.clientWidth;
      var left = Math.min(Math.max(8, r.left), vw - tw - 8);
      var below = r.bottom + gap + th < window.innerHeight || r.top < th + gap;
      var top = below ? r.bottom + gap : r.top - th - gap;
      tip.style.left = (left + window.scrollX) + 'px';
      tip.style.top = (top + window.scrollY) + 'px';
    }

    function show(el) {
      clearTimeout(hideTimer);
      var t = terms[el.getAttribute('data-term')];
      if (!t) return;
      if (owner && owner !== el) owner.removeAttribute('aria-describedby');
      owner = el;
      el.setAttribute('aria-describedby', 'gl-tip');
      fill(t, el);
      tip.hidden = false;
      place(el);
    }

    function hide(delay) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        tip.hidden = true;
        if (owner) owner.removeAttribute('aria-describedby');
        owner = null;
      }, delay || 0);
    }

    function isOpen(el) { return owner === el && !tip.hidden; }

    document.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType || 'mouse'; }, true);
    document.addEventListener('keydown', function (e) {
      lastPointer = 'keyboard';
      if (e.key === 'Escape' && !tip.hidden) hide(0);
      var el = termOf(e.target);
      if (el && el.tagName !== 'A' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        if (isOpen(el)) hide(0); else show(el);
      }
    }, true);

    document.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'mouse') return;
      var el = termOf(e.target);
      if (el) { if (isOpen(el)) clearTimeout(hideTimer); else show(el); }
    });
    document.addEventListener('pointerout', function (e) {
      if (e.pointerType !== 'mouse') return;
      var el = termOf(e.target);
      var to = e.relatedTarget;
      if (el && !(to && (el.contains(to) || tip.contains(to)))) hide(180);
    });
    tip.addEventListener('pointerenter', function () { clearTimeout(hideTimer); });
    tip.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hide(120); });

    document.addEventListener('focusin', function (e) {
      var el = termOf(e.target);
      if (el && lastPointer !== 'touch' && lastPointer !== 'pen') show(el);
    });
    document.addEventListener('focusout', function (e) {
      var el = termOf(e.target);
      if (el && !(e.relatedTarget && tip.contains(e.relatedTarget))) hide(180);
    });

    document.addEventListener('click', function (e) {
      if (tip.contains(e.target)) return;
      var el = termOf(e.target);
      if (el) {
        var isLink = el.tagName === 'A' && el.getAttribute('href');
        var touch = lastPointer === 'touch' || lastPointer === 'pen';
        /* En pantallas táctiles no hay hover: el primer toque muestra la definición y el segundo sigue el enlace */
        if (!isLink || (touch && !isOpen(el))) {
          e.preventDefault();
          if (isOpen(el)) hide(0); else show(el);
        }
        return;
      }
      if (!tip.hidden) hide(0);
    });

    window.addEventListener('resize', function () { if (owner && !tip.hidden) place(owner); });
    window.addEventListener('hashchange', function () { if (!tip.hidden) hide(0); });
  }

  /* ---------- Página del glosario ---------- */

  function initGlossaryPage(host) {
    var list = Object.keys(terms).map(function (k) { return terms[k]; })
      .sort(function (a, b) { return a.term.localeCompare(b.term, 'es', { sensitivity: 'base' }); });
    var input = document.querySelector('[data-glossary-filter]');
    var chipsHost = document.querySelector('[data-glossary-cats]');
    var countEl = document.querySelector('[data-glossary-count]');
    var activeCat = null;

    var cats = [];
    list.forEach(function (t) { if (cats.indexOf(t.cat) < 0) cats.push(t.cat); });
    cats.sort(function (a, b) { return (SD.catNames[a] || a).localeCompare(SD.catNames[b] || b, 'es'); });

    function setCat(c) {
      activeCat = c;
      if (chipsHost) chipsHost.querySelectorAll('button').forEach(function (x) {
        x.setAttribute('aria-pressed', (x.getAttribute('data-cat') || null) === c ? 'true' : 'false');
      });
    }

    if (chipsHost) {
      chipsHost.appendChild(h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'true', text: 'Todas' }));
      cats.forEach(function (c) {
        chipsHost.appendChild(h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'false', 'data-cat': c, text: SD.catNames[c] || c }));
      });
      chipsHost.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        setCat(b.getAttribute('data-cat'));
        render();
      });
    }

    function deepLine(t) {
      var d = deepLink(t, null);
      if (!d) return null;
      return h('p', { class: 'gl-deep' }, [h('a', { href: d.href, text: d.label })]);
    }

    function modLinks(t) {
      /* El módulo del tema completo ya tiene su enlace: aquí van solo los demás */
      var deepMod = deepLink(t, null) ? t.deep.split('#')[0] : null;
      var mods = (t.mods || []).filter(function (id) { return id !== deepMod && SD.courseItem(id); });
      if (!mods.length) return null;
      var p = h('p', { class: 'gl-mods' }, [deepMod ? 'También aparece en: ' : 'Aparece en: ']);
      mods.forEach(function (id, i) {
        var it = SD.courseItem(id);
        if (!it) return;
        if (i) p.appendChild(document.createTextNode(', '));
        p.appendChild(it.status === 'ready'
          ? h('a', { href: SD.url(it.href), text: it.num + ' ' + it.short })
          : h('span', { text: it.num + ' ' + it.short }));
      });
      return p;
    }

    function relLinks(t) {
      if (!t.related || !t.related.length) return null;
      var p = h('p', { class: 'gl-rel' }, ['Relacionado: ']);
      t.related.forEach(function (id, i) {
        var r = terms[id];
        if (!r) return;
        if (i) p.appendChild(document.createTextNode(', '));
        p.appendChild(h('a', { href: '#t-' + id, 'data-term': id, text: r.term }));
      });
      return p;
    }

    function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

    function render() {
      var q = norm(input ? input.value : '');
      host.innerHTML = '';
      var shown = 0, letter = null, group = null;
      list.forEach(function (t) {
        if (activeCat && t.cat !== activeCat) return;
        if (q && norm(t.term + ' ' + (t.en || '') + ' ' + (t.aliases || []).join(' ') + ' ' + t.short).indexOf(q) < 0) return;
        var L = norm(t.term).charAt(0).toUpperCase();
        if (!/[A-Z]/.test(L)) L = '#';
        if (L !== letter) {
          letter = L;
          group = h('section', { class: 'gl-group' }, [h('h2', { class: 'gl-letter', text: L })]);
          host.appendChild(group);
        }
        var head = h('h3', { class: 'gl-term' }, [t.term]);
        if (t.en && t.en !== t.term) head.appendChild(h('span', { class: 'gl-en', text: t.en }));
        var body = h('div', { class: 'gl-body' }, [
          h('p', { class: 'gl-short', text: t.short }),
          t.long ? h('p', { class: 'gl-long', text: t.long }) : null
        ]);
        autolink(body, { exclude: t.id });
        group.appendChild(h('article', { class: 'gl-entry', id: 't-' + t.id }, [
          head,
          h('p', { class: 'gl-cat', text: SD.catNames[t.cat] || t.cat }),
          body,
          deepLine(t),
          relLinks(t),
          modLinks(t)
        ]));
        shown++;
      });
      if (!shown) host.appendChild(h('p', { class: 'gl-empty', text: 'Ningún término coincide. Prueba con otra palabra o elige "Todas".' }));
      if (countEl) countEl.textContent = shown + (shown === 1 ? ' término' : ' términos');
    }

    if (input) input.addEventListener('input', render);
    render();

    /* Ir a #t-algo: si el filtro lo oculta, se limpia; luego se resalta y se desplaza */
    function goToHash() {
      if (!/^#t-/.test(location.hash)) return;
      var id = location.hash.slice(1);
      var target = document.getElementById(id);
      if (!target) {
        if (input) input.value = '';
        setCat(null);
        render();
        target = document.getElementById(id);
      }
      if (!target) return;
      host.querySelectorAll('.gl-entry.is-target').forEach(function (x) { x.classList.remove('is-target'); });
      target.classList.add('is-target');
      target.scrollIntoView();
    }
    window.addEventListener('hashchange', goToHash);
    goToHash();
  }

  SD.ready(function () {
    var page = document.querySelector('[data-glossary-index]');
    if (page) initGlossaryPage(page);
    else document.querySelectorAll('article.content').forEach(function (c) { autolink(c); });
    initTooltips();
  });
})();
