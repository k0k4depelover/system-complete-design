/* Widgets del M15 (motores de inferencia):
   <div data-sim="batching">        static batching contra continuous batching con las mismas llegadas
   <div data-calc="speculative">    cuánto acelera el speculative decoding según la tasa de aceptación, k y el costo del draft */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  /* ======================= Batching ======================= */

  var SLOTS = 8, STEPS = 320, MAX_WAIT = 20;

  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

  /* Llegadas de Poisson y largos de respuesta; misma semilla para los dos modos */
  function workload(rate, variable) {
    var r = rng(7 + Math.round(rate * 100) + (variable ? 1000 : 0)), reqs = [], t = 0, id = 0;
    while (t < STEPS) {
      t += -Math.log(1 - r()) / rate;
      if (t >= STEPS) break;
      var len = variable ? Math.round(10 + Math.pow(r(), 3) * 230) : Math.round(50 + r() * 30);
      reqs.push({ id: id++, arrive: Math.floor(t), len: len });
    }
    return reqs;
  }

  function simulate(reqs, mode) {
    var queue = [], slots = new Array(SLOTS).fill(null), grid = [], next = 0, done = [], busy = 0;
    for (var t = 0; t < STEPS; t++) {
      while (next < reqs.length && reqs[next].arrive <= t) queue.push(reqs[next++]);
      var batchEmpty = slots.every(function (s) { return !s; });
      /* Static: arranca un batch nuevo cuando se llena, o cuando la primera request en cola lleva 20 pasos esperando */
      var ready = queue.length >= SLOTS || (queue.length && t - queue[0].arrive >= MAX_WAIT);
      if (mode === 'continuous' || (batchEmpty && ready)) {
        for (var i = 0; i < SLOTS && queue.length; i++) {
          if (!slots[i]) { var q = queue.shift(); q.start = t; q.left = q.len; slots[i] = q; }
        }
      }
      var col = [];
      for (i = 0; i < SLOTS; i++) {
        var s = slots[i];
        if (s && s.left > 0) {
          col.push({ id: s.id, state: 'run' }); busy++;
          s.left--;
          if (s.left === 0) { s.end = t + 1; done.push(s); if (mode === 'continuous') slots[i] = null; }
        } else if (s) {
          col.push({ id: s.id, state: 'pad' });           /* terminó, pero su lugar espera al más largo del batch */
        } else col.push(null);
      }
      if (mode === 'static' && slots.every(function (x) { return !x || x.left === 0; })) slots = new Array(SLOTS).fill(null);
      grid.push(col);
    }
    var lat = done.map(function (d) { return d.end - d.arrive; });
    var wait = done.map(function (d) { return d.start - d.arrive; });
    var avg = function (a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : NaN; };
    return { grid: grid, done: done.length, lat: avg(lat), wait: avg(wait), util: busy / (SLOTS * STEPS), queue: queue.length + (reqs.length - next) };
  }

  function initBatching(host) {
    var rate = h('select', { 'aria-label': 'Llegadas' }, [h('option', { value: '0.08', text: 'Tranquilas (una cada 12 pasos)' }), h('option', { value: '0.14', text: 'Cargadas (una cada 7 pasos)' })]);
    rate.value = '0.14';
    var lens = h('select', { 'aria-label': 'Largo de las respuestas' }, [h('option', { value: 'var', text: 'Muy variable (10 a 240 tokens)' }), h('option', { value: 'eq', text: 'Parecido (50 a 80 tokens)' })]);
    var panels = h('div', { class: 'batch-panels' });

    function panel(title, res) {
      var W = 680, rowH = 13, l = 4, H = SLOTS * rowH + 6, pw = W - l;
      var cw = pw / STEPS;
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + title + ': ocupación de los ' + SLOTS + ' lugares del batch en ' + STEPS + ' pasos">';
      for (var r = 0; r < SLOTS; r++) {
        var y = 3 + r * rowH, t = 0;
        s += '<rect x="' + l + '" y="' + y + '" width="' + pw + '" height="' + (rowH - 3) + '" fill="var(--fill)"/>';
        while (t < STEPS) {
          var c = res.grid[t][r];
          if (!c) { t++; continue; }
          var t0 = t;
          while (t < STEPS && res.grid[t][r] && res.grid[t][r].id === c.id && res.grid[t][r].state === c.state) t++;
          var fill = c.state === 'pad' ? 'var(--warn-tint)' : (c.id % 2 ? 'var(--l-gpu)' : 'color-mix(in srgb, var(--l-gpu) 55%, var(--bg))');
          s += '<rect x="' + (l + t0 * cw).toFixed(1) + '" y="' + y + '" width="' + Math.max(0.8, (t - t0) * cw - 0.6).toFixed(1) + '" height="' + (rowH - 3) + '" fill="' + fill + '"/>';
        }
      }
      s += '</svg>';
      var stats = h('div', { class: 'sim-stats' });
      [['Requests terminadas', F.num(res.done, 0)], ['Latencia promedio', F.num(res.lat, 0) + ' pasos'], ['Espera en cola', F.num(res.wait, 0) + ' pasos'], ['Ocupación útil', F.pct(res.util, 0)]].forEach(function (x) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
      var box = h('div', { class: 'batch-panel' }, [h('p', { class: 'raft-log-title', text: title }), h('div', { class: 'sim-scroll', html: s }), stats]);
      return box;
    }

    function run() {
      var reqs = workload(+rate.value, lens.value === 'var');
      var clone = function () { return reqs.map(function (q) { return { id: q.id, arrive: q.arrive, len: q.len }; }); };
      panels.innerHTML = '';
      panels.appendChild(panel('Static batching', simulate(clone(), 'static')));
      panels.appendChild(panel('Continuous batching', simulate(clone(), 'continuous')));
    }
    [rate, lens].forEach(function (x) { x.addEventListener('change', run); });
    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Static contra continuous batching' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [
        h('div', { class: 'field' }, [h('label', { text: 'Llegadas' }), rate]),
        h('div', { class: 'field' }, [h('label', { text: 'Largo de las respuestas' }), lens])
      ]),
      panels,
      h('div', { class: 'batch-legend' }, [
        h('span', {}, [h('i', { style: 'background: var(--l-gpu)' }), 'generando (dos tonos para distinguir requests seguidas)']),
        h('span', {}, [h('i', { style: 'background: var(--warn-tint)' }), 'terminó, pero espera al más largo del batch']),
        h('span', {}, [h('i', { style: 'background: var(--fill)' }), 'lugar libre'])
      ])
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Cada fila es uno de los 8 lugares del batch y cada columna, un paso de decode. Las mismas requests llegan en el mismo momento en los dos casos; se ignora el prefill. El static batching arranca un batch cuando junta 8 requests o cuando la primera lleva 20 pasos esperando.' }));
    run();
  }

  /* ======================= Speculative decoding ======================= */

  function initSpec(host) {
    function range(label, min, max, step, value, fmt) {
      var input = h('input', { type: 'range', min: min, max: max, step: step, value: value, 'aria-label': label });
      var out = h('output', { class: 'range-val' });
      return { input: input, out: out, fmt: fmt, el: h('div', { class: 'field' }, [h('label', {}, [label + ': ', out]), input]) };
    }
    var a = range('Tasa de aceptación (α)', 0.3, 0.95, 0.05, 0.7, function (v) { return F.pct(v, 0); });
    var k = range('Tokens propuestos por paso (k)', 1, 8, 1, 4, function (v) { return F.num(v, 0); });
    var c = range('Costo de un paso del draft', 0.02, 0.3, 0.01, 0.05, function (v) { return F.pct(v, 0) + ' del grande'; });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });
    var note = h('p', { class: 'sim-note' });

    function speed(al, kk, cc) { var E = (1 - Math.pow(al, kk + 1)) / (1 - al); return { E: E, s: E / (1 + kk * cc) }; }
    function run() {
      [a, k, c].forEach(function (r) { r.out.textContent = r.fmt(+r.input.value); });
      var al = +a.input.value, kk = +k.input.value, cc = +c.input.value, r = speed(al, kk, cc);
      var best = 1, bestS = 0;
      for (var i = 1; i <= 8; i++) { var x = speed(al, i, cc).s; if (x > bestS) { bestS = x; best = i; } }
      stats.innerHTML = '';
      [['Tokens aceptados por paso del modelo grande', F.num(r.E, 2)], ['Aceleración del decode', F.num(r.s, 2) + '×'], ['Mejor k para este α y costo', best + ' (' + F.num(bestS, 2) + '×)']].forEach(function (x) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
      note.textContent = r.s < 1.05 ? 'Casi no conviene: el draft falla demasiado o cuesta demasiado para lo que acierta.' : '';
    }
    [a, k, c].forEach(function (r) { r.input.addEventListener('input', run); });
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Cuánto acelera el speculative decoding' })]));
    host.appendChild(h('div', { class: 'calc-pad' }, [h('div', { class: 'sim-controls' }, [a.el, k.el, c.el]), stats, note]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Tokens por paso = (1 − α^(k+1)) ÷ (1 − α), suponiendo que cada token propuesto se acepta con probabilidad α, independiente de los demás. Aceleración = tokens por paso ÷ (1 + k × costo del draft). Con batches grandes el modelo grande ya no tiene cómputo ocioso y la ganancia se achica.' }));
    run();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="batching"]').forEach(initBatching);
    document.querySelectorAll('[data-calc="speculative"]').forEach(initSpec);
  });
})();
