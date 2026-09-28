/* Simulador de cache stampede: <div data-sim="stampede"></div>
   Una clave caliente vence en t = 1000 ms. Se simula milisegundo a milisegundo cuántas consultas
   llegan a la base según la estrategia, con una base que se vuelve más lenta cuanto más concurrencia tiene. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  var STRATS = [
    { id: 'none', name: 'Sin protección' },
    { id: 'sf', name: 'Single-flight por instancia' },
    { id: 'lease', name: 'Lease distribuido (un solo recálculo)' },
    { id: 'swr', name: 'Servir el valor viejo y recalcular en segundo plano' },
    { id: 'xfetch', name: 'Expiración anticipada probabilística' }
  ];

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* rps: lecturas/s de la clave; inst: instancias; base: ms de la consulta sin carga */
  function simulate(o) {
    var rand = rng(11), T = 3000, EXP = 1000, bucket = 50;
    var perMs = o.rps / 1000, base = o.base;
    var valid = true, expAt = EXP;                  /* la clave es válida hasta expAt */
    var active = [];                                /* consultas en curso: { rem, done } */
    var instBusy = new Array(o.inst).fill(null);    /* single-flight: consulta en curso de cada instancia */
    var lease = null, xfetchDone = false;
    var waiting = [];                               /* llegada de cada usuario que espera el valor */
    var started = new Array(Math.ceil(T / bucket)).fill(0);
    var totalQ = 0, maxConc = 0, lat = [], carry = 0;

    function startQuery(t) {
      var q = { rem: base, done: false };
      active.push(q); totalQ++;
      started[Math.floor(t / bucket)]++;
      return q;
    }
    function busy(q) { return q && !q.done; }

    for (var t = 0; t < T; t++) {
      /* la base reparte su capacidad entre las consultas activas: con más concurrencia, todas avanzan más lento */
      var finished = false, rate = 1 / (1 + active.length / 40);
      for (var i = active.length - 1; i >= 0; i--) {
        active[i].rem -= rate;
        if (active[i].rem <= 0) { active[i].done = true; active.splice(i, 1); finished = true; }
      }
      if (finished) {
        /* el primer resultado repone la clave; los que esperaban reciben el valor */
        if (!valid || o.strat === 'xfetch') { valid = true; expAt = t + 30000; }
        waiting.forEach(function (a) { lat.push(t - a); });
        waiting = [];
      }
      maxConc = Math.max(maxConc, active.length);
      if (valid && t >= expAt) valid = false;

      carry += perMs;
      var n = Math.floor(carry); carry -= n;
      for (var k = 0; k < n; k++) {
        if (o.strat === 'xfetch' && !xfetchDone && valid && t + base * -Math.log(1 - rand()) >= expAt) {
          /* XFetch: cada lectura cercana al vencimiento tiene una probabilidad creciente de recalcular antes */
          startQuery(t); xfetchDone = true;
        }
        if (valid) { lat.push(0.3); continue; }
        var inst = Math.floor(rand() * o.inst);
        switch (o.strat) {
          case 'none': startQuery(t); waiting.push(t); break;
          case 'sf': if (!busy(instBusy[inst])) instBusy[inst] = startQuery(t); waiting.push(t); break;
          case 'lease': case 'xfetch': if (!busy(lease)) lease = startQuery(t); waiting.push(t); break;
          case 'swr': if (!busy(lease)) lease = startQuery(t); lat.push(0.3); break;
        }
      }
    }
    /* quienes siguen esperando al final: su espera es al menos hasta el final de la simulación */
    var stuck = waiting.length;
    waiting.forEach(function (w) { lat.push(T - w); });
    lat.sort(function (a, b) { return a - b; });
    return { stuck: stuck, started: started, bucket: bucket, totalQ: totalQ, maxConc: maxConc, p99: lat[Math.floor(lat.length * 0.99)] || 0, maxLat: lat[lat.length - 1] || 0 };
  }

  function init(host) {
    var strat = h('select', { 'aria-label': 'Estrategia' });
    STRATS.forEach(function (s) { strat.appendChild(h('option', { value: s.id, text: s.name })); });
    var rps = h('select', { 'aria-label': 'Lecturas por segundo de la clave' }, [
      h('option', { value: '2000', text: '2 000 lecturas/s' }),
      h('option', { value: '10000', selected: true, text: '10 000 lecturas/s' }),
      h('option', { value: '40000', text: '40 000 lecturas/s' })
    ]);
    var base = h('select', { 'aria-label': 'Costo de recalcular' }, [
      h('option', { value: '20', text: 'Recalcular cuesta 20 ms' }),
      h('option', { value: '100', selected: true, text: 'Recalcular cuesta 100 ms' }),
      h('option', { value: '400', text: 'Recalcular cuesta 400 ms' })
    ]);
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });
    var chart = h('div', { class: 'sim-scroll' });
    var note = h('p', { class: 'sim-note', 'aria-live': 'polite' });

    function stat(l, v) { return h('div', { class: 'sim-stat' }, [h('span', { text: l }), h('b', { text: v })]); }

    function run() {
      var r = simulate({ strat: strat.value, rps: +rps.value, base: +base.value, inst: 20 });
      stats.innerHTML = '';
      stats.appendChild(stat('Consultas a la base', F.num(r.totalQ)));
      stats.appendChild(stat('Máx. consultas simultáneas', F.num(r.maxConc)));
      stats.appendChild(stat('Espera p99 de usuarios', F.num(r.p99, r.p99 < 10 ? 1 : 0) + ' ms'));
      stats.appendChild(stat('Peor espera', F.num(r.maxLat, 0) + ' ms' + (r.stuck ? ' o más' : '')));
      note.textContent = r.stuck ? 'La base no se recupera: al terminar la simulación, ' + F.num(r.stuck) + ' usuarios siguen esperando y ninguna consulta terminó. Es un colapso por congestión: cada consulta nueva hace más lentas a todas las demás.' : '';
      draw(r);
    }

    function draw(r) {
      var from = 700 / r.bucket, to = 2400 / r.bucket;
      var data = r.started.slice(from, to);
      var W = 700, H = 220, l = 46, b = 30, t = 14, pw = W - l - 10, ph = H - b - t;
      var max = Math.max(10, Math.max.apply(null, data));
      var nice = Math.pow(10, Math.floor(Math.log10(max)));
      var top = Math.ceil(max / nice) * nice;
      var bw = pw / data.length;
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Consultas a la base por intervalo de 50 ms">';
      for (var g = 0; g <= 4; g++) {
        var gy = t + ph - ph * g / 4;
        s += '<line class="sim-grid" x1="' + l + '" x2="' + (W - 10) + '" y1="' + gy + '" y2="' + gy + '"/>';
        s += '<text class="sim-axis" x="' + (l - 6) + '" y="' + (gy + 4) + '" text-anchor="end">' + F.num(top * g / 4, 0) + '</text>';
      }
      data.forEach(function (v, i) {
        var bh = v / top * ph;
        var x = l + i * bw + 1;
        if (v > 0) s += '<rect x="' + x + '" y="' + (t + ph - bh) + '" width="' + Math.max(1, bw - 2) + '" height="' + bh + '" rx="2" fill="var(--l-db)"><title>' + ((from + i) * r.bucket) + '–' + ((from + i + 1) * r.bucket) + ' ms: ' + v + ' consultas</title></rect>';
      });
      var ex = l + (1000 / r.bucket - from) * bw;
      s += '<line x1="' + ex + '" x2="' + ex + '" y1="' + t + '" y2="' + (t + ph) + '" stroke="var(--fail)" stroke-dasharray="4 3"/>';
      s += '<text class="sim-axis" x="' + (ex + 5) + '" y="' + (t + 10) + '" style="fill:var(--fail)">vence la clave</text>';
      for (var ms = 800; ms <= 2400; ms += 400) {
        var x2 = l + (ms / r.bucket - from) * bw;
        s += '<text class="sim-axis" x="' + x2 + '" y="' + (H - 10) + '" text-anchor="' + (ms === 2400 ? 'end' : 'middle') + '">' + ms + ' ms</text>';
      }
      s += '<text class="sim-axis" x="' + l + '" y="' + (t - 3) + '">consultas iniciadas cada 50 ms</text>';
      s += '</svg>';
      chart.innerHTML = s;
    }

    [strat, rps, base].forEach(function (el) { el.addEventListener('change', run); });
    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Simulador de estampida: vence una clave caliente' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [
        h('div', { class: 'field' }, [h('label', { text: 'Estrategia' }), strat]),
        h('div', { class: 'field' }, [h('label', { text: 'Tráfico de la clave' }), rps]),
        h('div', { class: 'field' }, [h('label', { text: 'Costo de recalcular' }), base])
      ]),
      stats, chart, note
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: '20 instancias de la aplicación. La consulta a la base se vuelve más lenta con la concurrencia (latencia × (1 + consultas activas / 40)), como una base real que se satura.' }));
    run();
  }

  SD.ready(function () { document.querySelectorAll('[data-sim="stampede"]').forEach(init); });
  SD.simStampede = simulate;
})();
