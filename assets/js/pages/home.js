/* Portada: mapa de la ruta, continuar, plan por partes y gestión del progreso. */
(function () {
  'use strict';

  var SD = window.SD;
  var h = SD.h;
  var NS = 'http://www.w3.org/2000/svg';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function s(tag, attrs, children) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { if (attrs[k] != null) el.setAttribute(k, attrs[k]); });
    (children || []).forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }

  function lineVar(it) { return 'var(' + it.part.line + ')'; }

  function contentWidth(el) {
    var cs = getComputedStyle(el);
    return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }

  function currentId() {
    var last = SD.progress.last();
    var it = last && SD.courseItem(last.id);
    return it && it.status === 'ready' ? it.id : null;
  }

  /* ---------- Continuar ---------- */

  function renderContinue(host) {
    host.innerHTML = '';
    var last = SD.progress.last();
    var it = last && SD.courseItem(last.id);
    if (it && it.status === 'ready') {
      host.appendChild(h('a', { class: 'btn btn--primary btn--lg', href: it.href + (last.section ? '#' + last.section : '') }, ['Continuar donde quedaste']));
      host.appendChild(h('a', { class: 'btn btn--ghost btn--lg', href: '#plan' }, ['Ver el plan']));
      var where = it.num + '. ' + it.title + (last.sectionTitle ? ', en la sección ' + last.sectionTitle : '');
      host.appendChild(h('p', { class: 'continue-where', text: where }));
    } else {
      var first = SD.courseItems().filter(function (x) { return x.status === 'ready'; })[0];
      if (first) host.appendChild(h('a', { class: 'btn btn--primary btn--lg', href: first.href }, ['Empezar por el ' + first.num]));
      host.appendChild(h('a', { class: 'btn btn--ghost btn--lg', href: '#plan' }, ['Ver el plan completo']));
    }
  }

  /* ---------- Mapa de la ruta ---------- */

  function wrap(text, maxChars) {
    var words = text.split(' '), lines = [], cur = '';
    words.forEach(function (w) {
      if (!cur) cur = w;
      else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(' ')];
    return lines;
  }

  function renderRouteMap(host, tip) {
    host.innerHTML = '';
    /* Se mide el ancho útil de la tarjeta: el lienzo puede estar oculto por CSS en pantallas angostas */
    var section = host.closest('.route-map');
    var W = Math.round(contentWidth(section || host.parentElement));
    if (section) section.classList.toggle('is-compact', W < 880);
    if (W < 880) return;

    var items = SD.courseItems().filter(function (it) { return it.kind !== 'deep'; });
    var rows = [
      items.filter(function (it) { return it.part.id === 'p1'; }),
      items.filter(function (it) { return it.part.id === 'p2'; }),
      items.filter(function (it) { return it.part.id !== 'p1' && it.part.id !== 'p2'; })
    ];
    var padX = 96, top = 78, rowGap = 176;
    var H = top + rowGap * (rows.length - 1) + 84;
    var pts = [];
    rows.forEach(function (row, r) {
      var step = (W - padX * 2) / (row.length - 1);
      row.forEach(function (it, i) {
        pts.push({ it: it, x: r % 2 === 0 ? padX + i * step : W - padX - i * step, y: top + r * rowGap, row: r, step: step });
      });
    });

    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'rm-svg', role: 'group', 'aria-label': 'Ruta del curso con ' + pts.length + ' paradas' });
    var gLines = s('g', { class: 'rm-lines' });
    var gStops = s('g', { class: 'rm-stops' });
    svg.appendChild(gLines);

    function segD(a, b) {
      if (a.row === b.row) return 'M' + a.x + ' ' + a.y + ' L' + b.x + ' ' + b.y;
      var k = (b.y - a.y) * 2 / 3;
      var dir = a.row % 2 === 0 ? 1 : -1;
      return 'M' + a.x + ' ' + a.y + ' C' + (a.x + dir * k) + ' ' + a.y + ', ' + (b.x + dir * k) + ' ' + b.y + ', ' + b.x + ' ' + b.y;
    }

    var fullD = '';
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      var d = segD(a, b);
      fullD += (i === 1 ? d : d.replace(/^M[^LC]+/, ''));
      gLines.appendChild(s('path', {
        d: d, class: 'rm-seg' + (b.it.part.phase === 2 ? ' is-planned' : ''),
        style: 'stroke:' + lineVar(b.it)
      }));
    }

    var cur = currentId();
    var curIndex = 0;

    pts.forEach(function (p, idx) {
      var it = p.it;
      var st = SD.statusOf(it);
      if (it.id === cur) curIndex = idx;
      var kind = it.kind || 'module';
      var glyph;
      if (kind === 'checkpoint') glyph = s('rect', { x: p.x - 8, y: p.y - 8, width: 16, height: 16, transform: 'rotate(45 ' + p.x + ' ' + p.y + ')' });
      else if (kind === 'map') glyph = s('rect', { x: p.x - 9, y: p.y - 9, width: 18, height: 18, rx: 3 });
      else glyph = s('circle', { cx: p.x, cy: p.y, r: 9 });
      glyph.setAttribute('class', 'rm-glyph');
      glyph.setAttribute('style', '--c:' + lineVar(it));

      var below = (idx % 2 === 0);
      var maxChars = Math.max(10, Math.floor((p.step * 2 - 18) / 7.2));
      var lines = wrap(it.short || it.title, maxChars);
      var texts = [];
      if (below) {
        texts.push(s('text', { x: p.x, y: p.y + 32, class: 'rm-num', 'text-anchor': 'middle' }, [it.num]));
        lines.forEach(function (ln, k) { texts.push(s('text', { x: p.x, y: p.y + 50 + k * 16, class: 'rm-title', 'text-anchor': 'middle' }, [ln])); });
      } else {
        texts.push(s('text', { x: p.x, y: p.y - 22, class: 'rm-num', 'text-anchor': 'middle' }, [it.num]));
        lines.forEach(function (ln, k) { texts.push(s('text', { x: p.x, y: p.y - 40 - (lines.length - 1 - k) * 16, class: 'rm-title', 'text-anchor': 'middle' }, [ln])); });
      }

      var label = it.num + ' ' + it.title + '. ' + SD.statusText[st];
      var g;
      if (st !== 'soon') {
        g = s('a', { href: it.href, class: 'rm-stop is-' + st + (it.id === cur ? ' is-current' : ''), 'aria-label': label });
      } else {
        g = s('g', { class: 'rm-stop is-soon', 'aria-hidden': 'true' });
      }
      if (it.id === cur) g.appendChild(s('circle', { cx: p.x, cy: p.y, r: 16, class: 'rm-ring' }));
      g.appendChild(s('circle', { cx: p.x, cy: p.y, r: 22, class: 'rm-hit' }));
      g.appendChild(glyph);
      texts.forEach(function (t) { g.appendChild(t); });

      function show() {
        tip.innerHTML = '';
        tip.appendChild(h('p', { class: 'rm-tip-title', text: it.num + '. ' + it.title }));
        tip.appendChild(h('p', { class: 'rm-tip-sum', text: it.summary }));
        tip.appendChild(h('p', { class: 'rm-tip-meta', text: SD.statusText[st] + ', unos ' + it.mins + ' min' }));
        tip.hidden = false;
        var r = glyph.getBoundingClientRect();
        var tw = tip.offsetWidth, th = tip.offsetHeight;
        var left = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), document.documentElement.clientWidth - tw - 8);
        var topPos = below ? r.top - th - 12 : r.bottom + 12;
        tip.style.left = (left + window.scrollX) + 'px';
        tip.style.top = (topPos + window.scrollY) + 'px';
      }
      function hide() { tip.hidden = true; }
      g.addEventListener('mouseenter', show);
      g.addEventListener('mouseleave', hide);
      g.addEventListener('focus', show);
      g.addEventListener('blur', hide);
      gStops.appendChild(g);
    });

    svg.appendChild(gStops);
    host.appendChild(svg);

    if (!reduceMotion && !renderRouteMap.animated) {
      renderRouteMap.animated = true;
      animateRoute(svg, fullD, pts, curIndex);
    }
  }

  /* Un único momento de movimiento: la línea se dibuja y un paquete viaja hasta tu parada actual */
  function animateRoute(svg, fullD, pts, curIndex) {
    var cover = s('path', { d: fullD, class: 'rm-cover' });
    svg.insertBefore(cover, svg.querySelector('.rm-stops'));
    var L = cover.getTotalLength();
    cover.style.strokeDasharray = L + ' ' + L;
    cover.style.strokeDashoffset = '0';
    var drawMs = 1400, t0 = null;

    function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    function draw(ts) {
      if (t0 == null) t0 = ts;
      var t = Math.min(1, (ts - t0) / drawMs);
      cover.style.strokeDashoffset = String(-L * ease(t));
      if (t < 1) requestAnimationFrame(draw);
      else { cover.remove(); if (curIndex > 0) travel(); }
    }

    function travel() {
      var probe = s('path', { d: fullD, fill: 'none', stroke: 'none' });
      svg.appendChild(probe);
      /* longitud hasta la parada actual: buscar el punto del path más cercano a ella */
      var target = pts[curIndex], total = probe.getTotalLength(), best = 0, bestD = Infinity;
      for (var l = 0; l <= total; l += 4) {
        var pt = probe.getPointAtLength(l);
        var dd = (pt.x - target.x) * (pt.x - target.x) + (pt.y - target.y) * (pt.y - target.y);
        if (dd < bestD) { bestD = dd; best = l; }
      }
      var dot = s('circle', { r: 5, class: 'rm-packet' });
      svg.appendChild(dot);
      var ms = 900 + Math.min(1600, best * 0.6), t1 = null;
      function step(ts) {
        if (t1 == null) t1 = ts;
        var t = Math.min(1, (ts - t1) / ms);
        var p = probe.getPointAtLength(best * ease(t));
        dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
        if (t < 1) requestAnimationFrame(step);
        else { dot.remove(); probe.remove(); }
      }
      requestAnimationFrame(step);
    }

    requestAnimationFrame(draw);
  }

  /* ---------- Tira de progreso ---------- */

  function renderStrip(host) {
    host.innerHTML = '';
    var items = SD.countable();
    var done = items.filter(function (it) { return SD.progress.isComplete(it.id); }).length;
    var bar = h('div', { class: 'strip', role: 'img', 'aria-label': done + ' de ' + items.length + ' paradas completadas' });
    var lastPart = null;
    items.forEach(function (it) {
      if (lastPart && lastPart !== it.part.id) bar.appendChild(h('span', { class: 'strip-gap' }));
      lastPart = it.part.id;
      bar.appendChild(h('span', {
        class: 'strip-seg' + (SD.progress.isComplete(it.id) ? ' is-done' : ''),
        style: '--c: ' + lineVar(it),
        title: it.num + ' ' + it.title + ': ' + SD.statusText[SD.statusOf(it)]
      }));
    });
    host.appendChild(h('p', { class: 'strip-label' }, [h('b', { text: done + ' de ' + items.length }), ' paradas completadas en la Fase 1']));
    host.appendChild(bar);
  }

  /* ---------- Plan por partes ---------- */

  function renderParts(host) {
    host.innerHTML = '';
    var cur = currentId();
    SD.course.parts.forEach(function (p) {
      var core = p.items.filter(function (it) { return it.kind !== 'deep'; });
      var mins = core.reduce(function (acc, it) { return acc + (it.mins || 0); }, 0);
      var block = h('section', { class: 'part-block', style: '--line: var(' + p.line + ')', 'data-phase': p.phase || 1, 'aria-labelledby': 'part-' + p.id });
      block.appendChild(h('header', { class: 'part-head' }, [
        h('p', { class: 'part-label', text: p.label }),
        h('h3', { class: 'part-title', id: 'part-' + p.id, text: p.title }),
        h('p', { class: 'part-intro', text: p.intro }),
        h('p', { class: 'part-meta', text: core.length + ' paradas, unas ' + Math.round(mins / 60) + ' h' })
      ]));
      var ol = h('ol', { class: 'part-list' });
      p.items.forEach(function (it) {
        var st = SD.statusOf(it);
        var title = st === 'soon'
          ? h('span', { class: 'pl-title', text: it.title })
          : h('a', { class: 'pl-title', href: it.href, text: it.title });
        ol.appendChild(h('li', { class: 'pl-row is-' + st + (it.id === cur ? ' is-current' : ''), 'data-kind': it.kind || 'module' }, [
          h('span', { class: 'pl-num', text: it.num }),
          h('div', { class: 'pl-main' }, [title, it.kind === 'deep' ? h('span', { class: 'pl-opt', text: 'Opcional' }) : null, h('p', { class: 'pl-sum', text: it.summary })]),
          h('span', { class: 'pl-mins', text: it.mins + ' min' }),
          h('span', { class: 'pl-status' }, [
            st === 'done' ? h('span', { class: 'pl-check', 'aria-hidden': 'true', text: '✓ ' }) : null,
            SD.statusText[st]
          ])
        ]));
      });
      block.appendChild(ol);
      host.appendChild(block);
    });
  }

  /* ---------- Respaldo, restauración y reinicio ---------- */

  function initDataMgmt() {
    var msg = document.querySelector('[data-dm-msg]');
    var exp = document.querySelector('[data-export]');
    var imp = document.querySelector('[data-import]');
    var reset = document.querySelector('[data-reset]');
    if (!exp) return;

    exp.addEventListener('click', function () {
      var blob = new Blob([SD.progress.exportJSON()], { type: 'application/json' });
      var a = h('a', { href: URL.createObjectURL(blob), download: 'progreso-diseno-de-sistemas-' + new Date().toISOString().slice(0, 10) + '.json' });
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
      msg.textContent = 'Respaldo descargado. Para restaurarlo en otro navegador, usa "Restaurar desde archivo".';
    });

    imp.addEventListener('change', function () {
      var file = imp.files && imp.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          SD.progress.importJSON(String(reader.result));
          var n = SD.countable().filter(function (it) { return SD.progress.isComplete(it.id); }).length;
          msg.textContent = 'Progreso restaurado: ' + n + (n === 1 ? ' parada completada.' : ' paradas completadas.');
        } catch (e) {
          msg.textContent = 'No se pudo restaurar: ' + e.message + ' Elige el archivo .json que descargaste con "Descargar respaldo".';
        }
        imp.value = '';
      };
      reader.readAsText(file);
    });

    var armed = null;
    reset.addEventListener('click', function () {
      if (!armed) {
        reset.textContent = 'Confirmar: borrar todo';
        reset.classList.add('is-armed');
        msg.textContent = 'Pulsa otra vez para borrar quizzes, checkpoints y la posición de lectura. No se puede deshacer, salvo que tengas un respaldo.';
        armed = setTimeout(function () {
          armed = null;
          reset.textContent = 'Reiniciar progreso';
          reset.classList.remove('is-armed');
          msg.textContent = '';
        }, 6000);
        return;
      }
      clearTimeout(armed);
      armed = null;
      SD.progress.reset();
      reset.textContent = 'Reiniciar progreso';
      reset.classList.remove('is-armed');
      msg.textContent = 'Progreso reiniciado.';
    });
  }

  SD.ready(function () {
    var cont = document.querySelector('[data-continue]');
    var map = document.querySelector('[data-route-map]');
    var strip = document.querySelector('[data-progress-strip]');
    var parts = document.querySelector('[data-parts]');
    var tip = document.getElementById('rm-tip');

    function renderAll() {
      if (cont) renderContinue(cont);
      if (map) renderRouteMap(map, tip);
      if (strip) renderStrip(strip);
      if (parts) renderParts(parts);
    }
    renderAll();
    initDataMgmt();
    window.addEventListener('sd:progress', renderAll);

    function mapWidth() { return map ? contentWidth(map.closest('.route-map') || map.parentElement) : 0; }
    var lastW = mapWidth(), rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        var w = mapWidth();
        if (map && Math.abs(w - lastW) > 4) { lastW = w; tip.hidden = true; renderRouteMap(map, tip); }
      }, 120);
    });
  });
})();
