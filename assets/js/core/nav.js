/* Navegación: ruta del curso (sidebar), índice de la página, anterior/siguiente,
   menú móvil y "continuar donde quedaste". */
(function () {
  'use strict';

  var SD = window.SD;
  var h = SD.h;

  /* ---------- Modelo del curso ---------- */

  SD.courseItems = function () {
    var out = [];
    SD.course.parts.forEach(function (p) {
      p.items.forEach(function (it) {
        var copy = {};
        Object.keys(it).forEach(function (k) { copy[k] = it[k]; });
        copy.part = p;
        out.push(copy);
      });
    });
    return out;
  };

  SD.courseItem = function (id) {
    var items = SD.courseItems();
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  };

  /* Estado de una parada: soon | done | started | new */
  SD.statusOf = function (it) {
    if (it.status !== 'ready') return 'soon';
    if (SD.progress.isComplete(it.id)) return 'done';
    var m = SD.progress.get(it.id);
    return m && m.firstVisit ? 'started' : 'new';
  };

  SD.statusText = { soon: 'En construcción', done: 'Completado', started: 'En curso', new: 'Sin empezar' };

  /* Ítems que cuentan para el progreso: módulos y checkpoints de la Fase 1 */
  SD.countable = function () {
    return SD.courseItems().filter(function (it) { return it.kind !== 'map' && it.part.phase !== 2; });
  };

  /* ---------- Ruta (sidebar) ---------- */

  SD.buildRoute = function (container, currentId) {
    container.innerHTML = '';
    SD.course.parts.forEach(function (p) {
      var part = h('div', { class: 'route-part', style: '--line: var(' + p.line + ')', 'data-phase': p.phase || 1 });
      part.appendChild(h('p', { class: 'route-part-head' }, [
        h('span', { class: 'route-part-num', text: p.label }),
        h('span', { class: 'route-part-title', text: p.title })
      ]));
      var ol = h('ol', { class: 'route-stops' });
      p.items.forEach(function (it) {
        var st = SD.statusOf(it);
        var li = h('li', {
          class: 'stop is-' + st + (it.id === currentId ? ' is-current' : ''),
          'data-kind': it.kind || 'module'
        });
        var inner = [
          h('span', { class: 'stop-num', text: it.num }),
          h('span', { class: 'stop-title', text: it.short || it.title }),
          h('span', { class: 'visually-hidden', text: '. ' + SD.statusText[st] })
        ];
        if (st === 'soon') {
          inner.push(h('span', { class: 'stop-tag', 'aria-hidden': 'true', text: 'pronto' }));
          li.appendChild(h('span', { class: 'stop-link' }, inner));
        } else {
          var a = h('a', { class: 'stop-link', href: SD.url(it.href) }, inner);
          if (it.id === currentId) a.setAttribute('aria-current', 'page');
          li.appendChild(a);
        }
        ol.appendChild(li);
      });
      part.appendChild(ol);
      container.appendChild(part);
    });
  };

  /* Texto de un encabezado con su número de sección separado: "0.4 Estimaciones…" */
  SD.headingText = function (el) {
    var num = el.querySelector('.sec-num');
    var text = el.textContent;
    if (num) text = num.textContent + ' ' + text.replace(num.textContent, '');
    return text.replace(/\s+/g, ' ').trim();
  };

  /* ---------- Índice de la página ---------- */

  function buildTOC(tocEl) {
    var heads = Array.prototype.slice.call(document.querySelectorAll('.content h2, .content h3'))
      .filter(function (el) { return !el.closest('[data-toc="skip"]') && el.getAttribute('data-toc') !== 'skip'; });
    if (!heads.length) { tocEl.hidden = true; return; }

    var ol = h('ol');
    var links = [];
    heads.forEach(function (el) {
      if (!el.id) el.id = SD.slug(el.textContent);
      var a = h('a', { href: '#' + el.id, text: SD.headingText(el) });
      links.push({ el: el, a: a });
      ol.appendChild(h('li', { class: el.tagName === 'H3' ? 'toc-h3' : 'toc-h2' }, [a]));
    });
    tocEl.appendChild(h('p', { class: 'toc-title', text: 'En esta página' }));
    tocEl.appendChild(ol);

    if (!('IntersectionObserver' in window)) return;
    var visible = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
      var active = null;
      for (var i = 0; i < links.length; i++) {
        if (links[i].el.getBoundingClientRect().top < window.innerHeight * 0.35) active = links[i];
      }
      links.forEach(function (l) { l.a.classList.toggle('is-active', l === active); });
    }, { rootMargin: '0px 0px -60% 0px', threshold: [0, 1] });
    links.forEach(function (l) { io.observe(l.el); });
  }

  /* ---------- Anterior / siguiente ---------- */

  function buildPager(pagerEl, currentId) {
    var items = SD.courseItems();
    var idx = -1;
    items.forEach(function (it, i) { if (it.id === currentId) idx = i; });
    if (idx < 0) return;

    function cell(it, dir) {
      var cls = 'pager-cell pager-' + dir;
      if (!it) return h('span', { class: cls + ' is-empty' });
      var kids = [
        h('span', { class: 'pager-dir', text: dir === 'prev' ? 'Anterior' : 'Siguiente' }),
        h('span', { class: 'pager-title', text: it.num + '  ' + it.title })
      ];
      if (it.status !== 'ready') {
        kids.push(h('span', { class: 'pager-note', text: 'En construcción' }));
        return h('span', { class: cls + ' is-soon' }, kids);
      }
      return h('a', { class: cls, href: SD.url(it.href) }, kids);
    }
    pagerEl.appendChild(cell(items[idx - 1], 'prev'));
    pagerEl.appendChild(cell(items[idx + 1], 'next'));
  }

  /* ---------- Contador global en la barra superior ---------- */

  function renderTopProgress(el) {
    var items = SD.countable();
    var done = items.filter(function (it) { return SD.progress.isComplete(it.id); }).length;
    el.innerHTML = '';
    el.appendChild(h('span', { class: 'tp-count', text: done + ' de ' + items.length }));
    el.appendChild(h('span', { class: 'tp-label', text: ' completados' }));
    el.setAttribute('title', done + ' de ' + items.length + ' módulos y checkpoints completados');
  }

  /* ---------- Menú móvil ---------- */

  function mobileNav() {
    var btn = document.querySelector('.menu-btn');
    var sidebar = document.querySelector('.sidebar');
    if (!btn || !sidebar) return;
    var scrim = h('div', { class: 'scrim', 'aria-hidden': 'true' });
    document.body.appendChild(scrim);

    function set(open) {
      document.body.classList.toggle('nav-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        var cur = sidebar.querySelector('[aria-current="page"]') || sidebar.querySelector('a');
        if (cur) cur.focus();
      }
    }
    btn.addEventListener('click', function () { set(!document.body.classList.contains('nav-open')); });
    scrim.addEventListener('click', function () { set(false); btn.focus(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { set(false); btn.focus(); }
    });
    sidebar.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
  }

  /* ---------- Ocultar la barra lateral en escritorio (sidebars.md: "Consider letting people hide the sidebar") ---------- */

  function sideToggle() {
    var btn = document.querySelector('.side-toggle');
    if (!btn) return;
    var KEY = 'sd-ui-side-hidden';
    function set(hidden, persist) {
      document.body.classList.toggle('side-hidden', hidden);
      btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
      btn.setAttribute('aria-label', hidden ? 'Mostrar la barra lateral' : 'Ocultar la barra lateral');
      if (persist) { try { window.localStorage.setItem(KEY, hidden ? '1' : '0'); } catch (e) { /* sin almacenamiento */ } }
    }
    var initial = false;
    try { initial = window.localStorage.getItem(KEY) === '1'; } catch (e) { initial = false; }
    set(initial, false);
    btn.addEventListener('click', function () { set(!document.body.classList.contains('side-hidden'), true); });
  }

  /* ---------- Posición de lectura ---------- */

  function trackReading(currentId) {
    var it = SD.courseItem(currentId);
    if (!it) return;
    SD.progress.visit(currentId);
    var base = { id: it.id, href: it.href, title: it.title, num: it.num, at: Date.now() };
    SD.progress.setLast(base);

    var sections = document.querySelectorAll('.content h2[id]');
    if (!sections.length || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        SD.progress.setLast({
          id: base.id, href: base.href, title: base.title, num: base.num, at: Date.now(),
          section: e.target.id, sectionTitle: SD.headingText(e.target)
        });
      });
    }, { rootMargin: '0px 0px -70% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ---------- Estado en el bloque de título ---------- */

  function renderStatus() {
    document.querySelectorAll('[data-status]').forEach(function (el) {
      var it = SD.courseItem(el.getAttribute('data-status'));
      if (it) el.textContent = SD.statusText[SD.statusOf(it)];
    });
  }

  SD.ready(function () {
    var currentId = document.body.getAttribute('data-module');
    var routeEl = document.querySelector('[data-route]');
    var tocEl = document.querySelector('[data-toc-host]');
    var pagerEl = document.querySelector('[data-pager]');
    var topEl = document.querySelector('[data-top-progress]');

    if (currentId) trackReading(currentId);
    if (routeEl) SD.buildRoute(routeEl, currentId);
    if (tocEl) buildTOC(tocEl);
    if (pagerEl) buildPager(pagerEl, currentId);
    if (topEl) renderTopProgress(topEl);
    renderStatus();
    mobileNav();
    sideToggle();

    window.addEventListener('sd:progress', function () {
      if (routeEl) SD.buildRoute(routeEl, currentId);
      if (topEl) renderTopProgress(topEl);
      renderStatus();
    });
  });
})();
