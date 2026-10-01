/* Simulador de flujos sobre un mapa: escenarios paso a paso con paquetes animados.
   Escenario: { id, title, desc, down: [nodos caídos al inicio], steps: [
     { from, to,            // arista a recorrer (en cualquier sentido)  o  at: 'nodo' (proceso local)
       kind: 'req'|'res'|'fail'|'async'|'info',
       tag: 'SYN',           // etiqueta corta junto al paquete
       ms: 20,               // lo que tarda este paso (red o proceso)
       title, text,          // explicación (HTML permitido en text)
       code, lang,           // payload opcional (json | http | sse | sql)
       down: [], up: [] }    // cambios de estado que empiezan en este paso
   ]} */
(function () {
  'use strict';

  var SD = window.SD;
  var h = SD.h;
  var NS = 'http://www.w3.org/2000/svg';
  var MapView = SD.MapView;
  if (!MapView) return;

  function s(tag, attrs, kids) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { if (attrs[k] != null) el.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }

  function fmtMs(ms) {
    if (ms > 0 && ms < 0.01) return SD.fmt.sig(ms * 1e6) + ' ns';
    if (ms < 1) return SD.fmt.num(ms, 2) + ' ms';
    if (ms < 10000) return SD.fmt.num(ms, ms < 10 ? 1 : 0) + ' ms';
    if (ms < 120000) return SD.fmt.num(ms / 1000, 1) + ' s';
    return SD.fmt.duration(ms / 1000);
  }

  MapView.prototype.initScenarios = function () {
    var self = this, def = this.def;
    if (!def.scenarios || !def.scenarios.length) return;
    this.speed = 1;
    this.idx = -1;
    this.playing = false;
    this.animToken = 0;

    var list = h('div', { class: 'sdm-scen-list', role: 'group', 'aria-label': 'Escenarios' });
    this.scenBtns = {};
    def.scenarios.forEach(function (sc) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'false', text: sc.title });
      b.addEventListener('click', function () { self.openScenario(sc.id, -1); });
      self.scenBtns[sc.id] = b;
      list.appendChild(b);
    });

    this.btnPrev = h('button', { type: 'button', class: 'btn', text: 'Anterior' });
    this.btnPlay = h('button', { type: 'button', class: 'btn btn--primary', text: 'Reproducir' });
    this.btnNext = h('button', { type: 'button', class: 'btn', text: 'Siguiente' });
    this.btnReset = h('button', { type: 'button', class: 'btn btn--ghost', text: 'Reiniciar' });
    this.selSpeed = h('select', { class: 'sdm-speed', 'aria-label': 'Velocidad' }, [
      h('option', { value: '0.5', text: '0.5×' }), h('option', { value: '1', selected: true, text: '1×' }), h('option', { value: '2', text: '2×' })
    ]);
    this.clock = h('p', { class: 'sdm-clock', 'aria-live': 'off' });
    this.timeline = h('div', { class: 'sdm-timeline', role: 'group', 'aria-label': 'Pasos del escenario' });
    this.stepEl = h('div', { class: 'sdm-step', 'aria-live': 'polite' });

    this.btnPrev.addEventListener('click', function () { self.pause(); self.go(self.idx - 1, false); });
    this.btnNext.addEventListener('click', function () { self.pause(); self.go(self.idx + 1, true); });
    this.btnPlay.addEventListener('click', function () { self.playing ? self.pause() : self.play(); });
    this.btnReset.addEventListener('click', function () { self.pause(); self.go(-1, false); });
    this.selSpeed.addEventListener('change', function () { self.speed = parseFloat(self.selSpeed.value) || 1; });

    this.scenEl.innerHTML = '';
    this.scenEl.appendChild(list);
    this.scenEl.appendChild(h('div', { class: 'sdm-scen-head' }, [
      h('div', { class: 'sdm-controls' }, [this.btnPrev, this.btnPlay, this.btnNext, this.btnReset, this.selSpeed]),
      this.clock
    ]));
    this.scenEl.appendChild(this.timeline);
    this.scenEl.appendChild(this.stepEl);

    this.openScenario(def.scenarios[0].id, -1, true);
  };

  MapView.prototype.openScenario = function (id, stepIdx, silent) {
    var self = this;
    var sc = this.def.scenarios.filter(function (x) { return x.id === id; })[0];
    if (!sc) return;
    this.pause();
    this.scen = sc;
    Object.keys(this.scenBtns).forEach(function (k) { self.scenBtns[k].setAttribute('aria-pressed', k === id ? 'true' : 'false'); });

    this.timeline.innerHTML = '';
    this.tlSegs = sc.steps.map(function (st, i) {
      var b = h('button', {
        type: 'button', class: 'sdm-tl-seg k-' + (st.kind || 'req'),
        style: 'flex-grow:' + Math.max(1, Math.log2(1 + (st.ms || 0))),
        'aria-label': 'Paso ' + (i + 1) + ': ' + st.title,
        title: (i + 1) + '. ' + st.title + ' (' + fmtMs(st.ms || 0) + ')'
      });
      b.addEventListener('click', function () { self.pause(); self.go(i, true); });
      self.timeline.appendChild(b);
      return b;
    });
    this.go(stepIdx == null ? -1 : stepIdx, stepIdx >= 0 && !silent);
  };

  /* Estado de nodos caídos tras aplicar los pasos 0..i */
  MapView.prototype.downSet = function (i) {
    var down = {};
    (this.scen.down || []).forEach(function (id) { down[id] = true; });
    for (var j = 0; j <= i; j++) {
      var st = this.scen.steps[j];
      (st.down || []).forEach(function (id) { down[id] = true; });
      (st.up || []).forEach(function (id) { delete down[id]; });
    }
    return down;
  };

  MapView.prototype.findEdge = function (a, b) {
    var ids = Object.keys(this.edges);
    for (var i = 0; i < ids.length; i++) {
      var e = this.edges[ids[i]];
      if (e.def.from === a && e.def.to === b) return { e: e, rev: false };
      if (e.def.from === b && e.def.to === a) return { e: e, rev: true };
    }
    return null;
  };

  MapView.prototype.go = function (i, animate) {
    var self = this, sc = this.scen, n = sc.steps.length;
    i = Math.max(-1, Math.min(n - 1, i));
    this.idx = i;
    this.animToken++;
    this.gPackets.innerHTML = '';

    var down = this.downSet(i);
    Object.keys(this.nodes).forEach(function (id) {
      var el = self.nodes[id].el;
      el.classList.toggle('is-down', !!down[id]);
      el.classList.remove('is-active');
    });
    Object.keys(this.edges).forEach(function (id) { self.edges[id].el.classList.remove('is-active'); });

    var total = 0;
    for (var j = 0; j <= i; j++) total += sc.steps[j].ms || 0;
    this.clock.innerHTML = '';
    this.clock.appendChild(h('small', { text: 'Tiempo acumulado' }));
    this.clock.appendChild(document.createTextNode('t = ' + fmtMs(total)));
    this.tlSegs.forEach(function (b, j) {
      b.classList.toggle('is-past', j < i);
      b.classList.toggle('is-now', j === i);
    });
    this.btnPrev.disabled = i < 0;
    this.btnNext.disabled = i >= n - 1;

    this.stepEl.innerHTML = '';
    if (i < 0) {
      var total2 = sc.steps.reduce(function (a, st) { return a + (st.ms || 0); }, 0);
      this.stepEl.appendChild(h('p', { class: 'sdm-step-n', text: n + ' pasos, ' + fmtMs(total2) + ' en total' }));
      this.stepEl.appendChild(h('p', { class: 'sdm-step-title', text: sc.title }));
      this.stepEl.appendChild(h('p', { class: 'sdm-step-intro', html: sc.desc || '' }));
      if (SD.autolink) SD.autolink(this.stepEl);
      return Promise.resolve();
    }

    var st = sc.steps[i];
    this.stepEl.appendChild(h('p', { class: 'sdm-step-n', text: 'Paso ' + (i + 1) + ' de ' + n + (st.ms ? ', ' + fmtMs(st.ms) : '') }));
    this.stepEl.appendChild(h('p', { class: 'sdm-step-title', text: st.title }));
    if (st.text) this.stepEl.appendChild(h('p', { class: 'sdm-step-text', html: st.text }));
    if (SD.autolink) SD.autolink(this.stepEl);
    if (st.code) {
      var pre = h('pre', { 'data-lang': st.lang || 'json' }, [h('code', { text: st.code })]);
      this.stepEl.appendChild(pre);
      SD.highlight(this.stepEl);
    }

    if (st.at) {
      var node = this.nodes[st.at];
      if (!node) { console.warn('[SD flujo] nodo inexistente', st.at); return Promise.resolve(); }
      node.el.classList.add('is-active');
      this.ensureVisible([[node.def.x, node.def.y]]);
      return this.pulse(node.def, animate);
    }
    var found = this.findEdge(st.from, st.to);
    if (!found) {
      console.warn('[SD flujo] no hay arista entre', st.from, st.to);
      return Promise.resolve();
    }
    found.e.el.classList.add('is-active');
    var A = this.nodes[st.from], B = this.nodes[st.to];
    A.el.classList.add('is-active'); B.el.classList.add('is-active');
    this.ensureVisible([[A.def.x, A.def.y], [B.def.x, B.def.y]]);
    return this.packet(found.e.path, found.rev, st, animate);
  };

  MapView.prototype.pulse = function (n, animate) {
    var ring = s('rect', { class: 'sdm-pulse', x: n.x - n.w / 2 - 8, y: n.y - n.h / 2 - 8, width: n.w + 16, height: n.h + 16, rx: 12 });
    this.gPackets.appendChild(ring);
    if (!animate || SD.reduceMotion) return Promise.resolve();
    var token = this.animToken, dur = 700 / this.speed, self = this;
    return new Promise(function (res) {
      var t0 = null;
      function step(ts) {
        if (token !== self.animToken) return res();
        if (t0 == null) t0 = ts;
        var t = Math.min(1, (ts - t0) / dur);
        ring.style.opacity = String(1 - t * 0.6);
        ring.setAttribute('stroke-width', String(2 + 3 * Math.sin(t * Math.PI)));
        if (t < 1) requestAnimationFrame(step); else res();
      }
      requestAnimationFrame(step);
    });
  };

  MapView.prototype.packet = function (path, rev, st, animate) {
    var self = this;
    var g = s('g', { class: 'sdm-packet k-' + (st.kind || 'req') });
    var dot = s('circle', { r: 7 });
    g.appendChild(dot);
    var bg = null, txt = null;
    if (st.tag) {
      bg = s('rect', { class: 'sdm-ptag-bg', rx: 3, height: 17 });
      txt = s('text', {}, [st.tag]);
      g.appendChild(bg); g.appendChild(txt);
    }
    this.gPackets.appendChild(g);
    var L = path.getTotalLength();
    var tw = txt ? txt.getComputedTextLength() : 0;
    if (bg) bg.setAttribute('width', tw + 10);

    function place(t) {
      var p = path.getPointAtLength(rev ? L * (1 - t) : L * t);
      dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
      if (txt) {
        txt.setAttribute('x', p.x + 13); txt.setAttribute('y', p.y - 9);
        bg.setAttribute('x', p.x + 8); bg.setAttribute('y', p.y - 22);
      }
    }
    if (!animate || SD.reduceMotion) { place(1); return Promise.resolve(); }

    var dur = (500 + Math.min(st.ms || 0, 150) * 6) / this.speed;
    var token = this.animToken;
    return new Promise(function (res) {
      var t0 = null;
      function step(ts) {
        if (token !== self.animToken) return res();
        if (t0 == null) t0 = ts;
        var t = Math.min(1, (ts - t0) / dur);
        place(t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        if (t < 1) requestAnimationFrame(step); else res();
      }
      requestAnimationFrame(step);
    });
  };

  MapView.prototype.play = function () {
    var self = this, sc = this.scen;
    if (this.idx >= sc.steps.length - 1) this.go(-1, false);
    this.playing = true;
    this.btnPlay.textContent = 'Pausa';
    var token;
    function next() {
      if (!self.playing) return;
      if (self.idx >= sc.steps.length - 1) { self.pause(); return; }
      self.go(self.idx + 1, true).then(function () {
        token = self.animToken;
        var text = (sc.steps[self.idx].text || '').length;
        var dwell = (1100 + Math.min(text, 400) * 6) / self.speed;
        setTimeout(function () { if (self.playing && token === self.animToken) next(); }, dwell);
      });
    }
    next();
  };

  MapView.prototype.pause = function () {
    this.playing = false;
    if (this.btnPlay) this.btnPlay.textContent = 'Reproducir';
  };
})();
