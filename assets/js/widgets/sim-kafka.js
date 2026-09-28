/* Simulador de un tópico particionado con un consumer group: <div data-sim="kafka"></div>
   Productores escriben eventos con clave; la clave decide la partición; cada partición la consume
   un solo consumidor del grupo. Se ve el lag por partición, el orden por clave y el rebalanceo. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;
  var P = 6;
  var KEYS = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10', 'u11', 'u12'];

  function hashStr(s) { var x = 2166136261; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }

  function init(host) {
    var st = {
      consumers: 3, rate: 60, perConsumer: 30, hotKey: false, slowConsumer: false,
      parts: [], t: 0, rebalanceUntil: 0, running: true, log: [], budget: []
    };
    for (var p = 0; p < P; p++) st.parts.push({ end: 0, committed: 0, lastKey: {} });
    var carry = 0, keyCounters = {}, orderViolations = 0;

    function assignment() {
      /* asignación por rangos: particiones contiguas a cada consumidor */
      var a = [];
      for (var c = 0; c < st.consumers; c++) a.push([]);
      for (var q = 0; q < P; q++) a[Math.floor(q * st.consumers / P) % st.consumers].push(q);
      if (st.consumers > P) { a = []; for (c = 0; c < st.consumers; c++) a.push(c < P ? [c] : []); }
      return a;
    }

    function rebalance(reason) {
      st.rebalanceUntil = st.t + 1500;
      event(reason + ' El grupo se rebalancea: durante ~1.5 s nadie consume y el lag crece.');
    }

    function event(text) {
      st.log.unshift((st.t / 1000).toFixed(1) + ' s  ' + text);
      st.log = st.log.slice(0, 6);
    }

    function tick(dt) {
      st.t += dt;
      /* producir */
      carry += st.rate * dt / 1000;
      var n = Math.floor(carry); carry -= n;
      for (var i = 0; i < n; i++) {
        var key = st.hotKey && Math.random() < 0.6 ? 'u1' : KEYS[Math.floor(Math.random() * KEYS.length)];
        var part = hashStr(key) % P;
        keyCounters[key] = (keyCounters[key] || 0) + 1;
        st.parts[part].end++;
        (st.parts[part].keys = st.parts[part].keys || []).push({ key: key, seq: keyCounters[key] });
      }
      /* consumir */
      if (st.t < st.rebalanceUntil) return;
      var asg = assignment();
      asg.forEach(function (ps, c) {
        if (!ps.length) return;
        var speed = st.perConsumer * (st.slowConsumer && c === 0 ? 0.2 : 1);
        /* el presupuesto fraccionario se acumula entre cuadros (a 60 fps, cada cuadro vale menos de un evento) */
        st.budget[c] = Math.min(Math.max(2, speed * 0.5), (st.budget[c] || 0) + speed * dt / 1000);
        var budget = st.budget[c];
        /* reparte el presupuesto entre sus particiones, round robin */
        var progress = true;
        while (budget >= 1 && progress) {
          progress = false;
          for (var j = 0; j < ps.length && budget >= 1; j++) {
            var pt = st.parts[ps[j]];
            if (pt.committed < pt.end) {
              var ev = pt.keys.shift();
              if (ev) {
                if (pt.lastKey[ev.key] && pt.lastKey[ev.key] > ev.seq) orderViolations++;
                pt.lastKey[ev.key] = ev.seq;
              }
              pt.committed++; budget--; progress = true;
            }
          }
        }
        st.budget[c] = budget;
      });
    }

    /* ---- vista ---- */
    var svgHost = h('div', { class: 'sim-scroll' });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'off' });
    var logEl = h('ol', { class: 'raft-log', 'aria-live': 'polite' });
    var consOut = h('output', {});
    var addC = h('button', { type: 'button', class: 'btn', text: 'Agregar consumidor' });
    var remC = h('button', { type: 'button', class: 'btn btn--ghost', text: 'Quitar consumidor' });
    var hot = h('button', { type: 'button', class: 'btn btn--ghost', 'aria-pressed': 'false', text: 'Clave caliente' });
    var slow = h('button', { type: 'button', class: 'btn btn--ghost', 'aria-pressed': 'false', text: 'Consumidor 1 lento' });
    var rate = h('input', { type: 'range', min: 20, max: 200, step: 10, value: 60, 'aria-label': 'Eventos producidos por segundo' });
    var rateOut = h('output', {});

    addC.addEventListener('click', function () { if (st.consumers < 8) { st.consumers++; rebalance('Se une el consumidor ' + st.consumers + '.'); } });
    remC.addEventListener('click', function () { if (st.consumers > 1) { st.consumers--; rebalance('Sale un consumidor.'); } });
    hot.addEventListener('click', function () {
      st.hotKey = !st.hotKey; hot.setAttribute('aria-pressed', String(st.hotKey));
      event(st.hotKey ? 'El 60 % de los eventos ahora son del usuario u1: todos van a la misma partición.' : 'La clave caliente se calmó.');
    });
    slow.addEventListener('click', function () {
      st.slowConsumer = !st.slowConsumer; slow.setAttribute('aria-pressed', String(st.slowConsumer));
      event(st.slowConsumer ? 'El consumidor 1 procesa al 20 % de su velocidad: sus particiones acumulan lag, las demás no.' : 'El consumidor 1 vuelve a su velocidad normal.');
    });
    rate.addEventListener('input', function () { st.rate = +rate.value; });

    var COLORS = ['var(--l-service)', 'var(--l-gpu)', 'var(--l-queue)', 'var(--l-cache)', 'var(--l-db)', 'var(--l-edge)', 'var(--ink-2)', 'var(--link)'];

    function draw() {
      var asg = assignment();
      var owner = {};
      asg.forEach(function (ps, c) { ps.forEach(function (q) { owner[q] = c; }); });
      var W = 700, rowH = 40, top = 30, H = top + P * rowH + 20, x0 = 110, bw = 360;
      var maxLag = 1;
      st.parts.forEach(function (pt) { maxLag = Math.max(maxLag, pt.end - pt.committed); });
      var scale = Math.max(60, Math.pow(2, Math.ceil(Math.log2(maxLag))));
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Lag por partición y consumidor asignado">';
      s += '<text class="sim-axis" x="' + x0 + '" y="16">Lag por partición (eventos escritos y todavía no procesados)</text>';
      s += '<text class="sim-axis" x="' + (x0 + bw + 30) + '" y="16">Consumidor</text>';
      st.parts.forEach(function (pt, q) {
        var y = top + q * rowH, lag = pt.end - pt.committed;
        var c = owner[q];
        s += '<text class="sim-label" x="0" y="' + (y + 20) + '">Partición ' + q + '</text>';
        s += '<rect x="' + x0 + '" y="' + (y + 8) + '" width="' + bw + '" height="16" rx="2" fill="var(--paper-sunk)"/>';
        s += '<rect x="' + x0 + '" y="' + (y + 8) + '" width="' + Math.max(1, Math.min(bw, lag / scale * bw)) + '" height="16" rx="2" fill="' + (lag > 200 ? 'var(--warn)' : 'var(--ink-2)') + '"/>';
        s += '<text class="sim-val" x="' + (x0 + Math.min(bw, lag / scale * bw) + 6) + '" y="' + (y + 21) + '">' + F.num(lag) + '</text>';
        var label = c == null ? 'sin consumidor' : 'C' + (c + 1) + (st.slowConsumer && c === 0 ? ' (lento)' : '');
        if (c != null) s += '<circle cx="' + (x0 + bw + 38) + '" cy="' + (y + 16) + '" r="6" fill="' + COLORS[c % COLORS.length] + '"/>';
        s += '<text class="sim-label" x="' + (x0 + bw + 50) + '" y="' + (y + 20) + '">' + label + '</text>';
      });
      if (st.t < st.rebalanceUntil) s += '<text class="sim-val" x="' + (W - 8) + '" y="16" text-anchor="end" style="fill:var(--warn)">rebalanceando…</text>';
      s += '</svg>';
      svgHost.innerHTML = s;

      var idle = asg.filter(function (ps) { return !ps.length; }).length;
      var totalLag = st.parts.reduce(function (a, pt) { return a + pt.end - pt.committed; }, 0);
      stats.innerHTML = '';
      [['Consumidores en el grupo', String(st.consumers)], ['Consumidores ociosos', String(idle)], ['Lag total', F.num(totalLag)], ['Eventos fuera de orden por clave', String(orderViolations)]].forEach(function (x) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
      consOut.textContent = String(st.consumers);
      rateOut.textContent = st.rate + ' eventos/s (cada consumidor procesa 30/s)';
      logEl.innerHTML = '';
      st.log.forEach(function (l) { logEl.appendChild(h('li', {}, [h('span', { class: 'raft-t', text: l.split('  ')[0] }), l.split('  ').slice(1).join('  ')])); });
    }

    var last = null;
    function frame(ts) {
      if (last == null) last = ts;
      var dt = Math.min(200, ts - last); last = ts;
      tick(dt);
      draw();
      requestAnimationFrame(frame);
    }

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Un tópico con 6 particiones y un consumer group' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [addC, remC, hot, slow, h('div', { class: 'field' }, [h('label', {}, ['Producción: ', rateOut]), rate])]),
      svgHost, stats,
      h('p', { class: 'raft-log-title', text: 'Qué está pasando' }), logEl
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Asignación por rangos. Cada partición la consume un único miembro del grupo, así que el orden de los eventos de una misma clave se conserva, y con más consumidores que particiones, los que sobran no hacen nada.' }));
    event('Tres consumidores, dos particiones cada uno. Sube la producción por encima de 90 eventos/s y mira qué pasa.');
    requestAnimationFrame(frame);
  }

  SD.ready(function () { document.querySelectorAll('[data-sim="kafka"]').forEach(init); });
})();
