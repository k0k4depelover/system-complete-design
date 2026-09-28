/* Simulador de balanceo de carga: <div data-sim="lb"></div>
   Simulación de eventos discretos: llegadas de Poisson, 5 servidores FIFO con tiempos de servicio
   exponenciales; uno puede estar lento. Compara algoritmos por p50, p99 y reparto. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  var ALGOS = [
    { id: 'rr', name: 'Round robin' },
    { id: 'random', name: 'Aleatorio' },
    { id: 'leastconn', name: 'Menos conexiones' },
    { id: 'p2c', name: 'Power of two choices' },
    { id: 'hash', name: 'Hash por usuario' }
  ];

  /* Generador pseudoaleatorio con semilla (mulberry32), para resultados reproducibles */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hashStr(s) {
    var x = 2166136261;
    for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    return x >>> 0;
  }

  function percentile(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]; }

  /* N servidores, servicio medio 10 ms; slowFactor multiplica el del servidor 0 */
  function simulate(opts) {
    var N = 5, mean = 10, n = opts.requests || 20000;
    var rand = rng(opts.seed || 7);
    var capacity = N / mean;                  /* requests por ms con todos sanos */
    var lambda = opts.util * capacity;
    var free = new Array(N).fill(0);          /* instante en que cada servidor queda libre */
    var inflight = []; for (var i = 0; i < N; i++) inflight.push([]);
    var count = new Array(N).fill(0), lat = [], perLat = []; for (i = 0; i < N; i++) perLat.push([]);
    var qsum = new Array(N).fill(0);
    var t = 0, rr = 0;
    for (var k = 0; k < n; k++) {
      t += -Math.log(1 - rand()) / lambda;
      for (i = 0; i < N; i++) { var q = inflight[i]; while (q.length && q[0] <= t) q.shift(); }
      var s;
      switch (opts.algo) {
        case 'rr': s = rr++ % N; break;
        case 'random': s = Math.floor(rand() * N); break;
        case 'leastconn':
          var minL = Infinity, cands = [];
          for (i = 0; i < N; i++) {
            if (inflight[i].length < minL) { minL = inflight[i].length; cands = [i]; }
            else if (inflight[i].length === minL) cands.push(i);
          }
          s = cands[Math.floor(rand() * cands.length)]; /* empate: al azar, para no favorecer al primero */
          break;
        case 'p2c':
          var a = Math.floor(rand() * N), b = Math.floor(rand() * (N - 1)); if (b >= a) b++;
          s = inflight[a].length <= inflight[b].length ? a : b; break;
        case 'hash':
          /* 300 usuarios con popularidad desigual (Zipf aproximado) */
          var u = Math.floor(Math.pow(rand(), 2.2) * 300);
          s = hashStr('user-' + u) % N; break;
      }
      var svc = -Math.log(1 - rand()) * mean * (s === 0 ? opts.slow : 1);
      var start = Math.max(t, free[s]);
      free[s] = start + svc;
      inflight[s].push(free[s]);
      qsum[s] += inflight[s].length;
      count[s]++;
      var r = free[s] - t;
      lat.push(r); perLat[s].push(r);
    }
    lat.sort(function (x, y) { return x - y; });
    return {
      p50: percentile(lat, 0.5), p99: percentile(lat, 0.99), max: lat[lat.length - 1],
      share: count.map(function (c) { return c / n; }),
      q: qsum.map(function (qs, j) { return count[j] ? qs / count[j] : 0; }),
      p99s: perLat.map(function (l) { if (!l.length) return 0; l.sort(function (x, y) { return x - y; }); return percentile(l, 0.99); })
    };
  }

  function ms(v) { return v >= 1000 ? F.num(v / 1000, 1) + ' s' : F.num(v, v < 10 ? 1 : 0) + ' ms'; }

  function init(host) {
    var algo = h('select', { id: 'lb-algo-' + Math.random().toString(36).slice(2, 7) });
    ALGOS.forEach(function (a) { algo.appendChild(h('option', { value: a.id, text: a.name })); });
    algo.value = 'rr';
    var util = h('input', { type: 'range', min: 30, max: 90, step: 5, value: 70, 'aria-label': 'Carga del clúster' });
    var utilOut = h('output', {});
    var slow = h('select', { 'aria-label': 'Estado del servidor 1' }, [
      h('option', { value: '1', text: 'Todos sanos' }),
      h('option', { value: '3', text: 'Servidor 1 × 3 más lento' }),
      h('option', { value: '6', selected: true, text: 'Servidor 1 × 6 más lento (pausa de GC)' })
    ]);
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });
    var bars = h('div', { class: 'sim-scroll' });
    var cmpBody = h('tbody');
    var cmp = h('div', { class: 'table-wrap', hidden: true }, [h('table', { class: 't' }, [
      h('thead', {}, [h('tr', {}, [h('th', { text: 'Algoritmo' }), h('th', { class: 'r', text: 'p50' }), h('th', { class: 'r', text: 'p99' }), h('th', { class: 'r', text: 'Tráfico al servidor lento' })])]),
      cmpBody
    ])]);

    function params() { return { algo: algo.value, util: +util.value / 100, slow: +slow.value }; }

    function stat(label, value) { return h('div', { class: 'sim-stat' }, [h('span', { text: label }), h('b', { text: value })]); }

    function run() {
      var p = params();
      utilOut.textContent = util.value + ' %';
      var r = simulate(p);
      stats.innerHTML = '';
      stats.appendChild(stat('Latencia p50', ms(r.p50)));
      stats.appendChild(stat('Latencia p99', ms(r.p99)));
      stats.appendChild(stat('Peor request', ms(r.max)));
      stats.appendChild(stat('Tráfico al servidor 1', F.pct(r.share[0], 1)));
      renderBars(r, p);
    }

    function renderBars(r, p) {
      var W = 700, rowH = 34, top = 24, H = top + rowH * 5 + 8, x0 = 140, bw = 250, xq = 450;
      var maxQ = Math.max.apply(null, r.q.concat([1]));
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Reparto de requests por servidor">';
      svg += '<text class="sim-axis" x="' + x0 + '" y="14">Parte del tráfico</text>';
      svg += '<text class="sim-axis" x="' + xq + '" y="14">Cola promedio al llegar</text>';
      svg += '<text class="sim-axis" x="' + (W - 8) + '" y="14" text-anchor="end">p99</text>';
      r.share.forEach(function (sh, i) {
        var y = top + i * rowH;
        var slowS = i === 0 && p.slow > 1;
        svg += '<text class="sim-label" x="0" y="' + (y + 16) + '">Servidor ' + (i + 1) + (slowS ? ' (lento)' : '') + '</text>';
        svg += '<rect x="' + x0 + '" y="' + (y + 6) + '" width="' + bw + '" height="12" rx="2" fill="var(--paper-sunk)"/>';
        svg += '<rect x="' + x0 + '" y="' + (y + 6) + '" width="' + Math.min(bw, Math.max(2, sh * bw * 2.5)) + '" height="12" rx="2" fill="' + (slowS ? 'var(--warn)' : 'var(--ink-2)') + '"/>';
        svg += '<text class="sim-val" x="' + (x0 + Math.min(bw, Math.max(2, sh * bw * 2.5)) + 6) + '" y="' + (y + 16) + '">' + F.pct(sh, 0) + '</text>';
        var qw = Math.max(2, r.q[i] / maxQ * 80);
        svg += '<rect x="' + xq + '" y="' + (y + 6) + '" width="' + qw + '" height="12" rx="2" fill="' + (slowS ? 'var(--warn)' : 'var(--link)') + '" opacity="0.8"/>';
        svg += '<text class="sim-val" x="' + (xq + 6 + qw) + '" y="' + (y + 16) + '">' + F.num(r.q[i], 1) + '</text>';
        svg += '<text class="sim-val" x="' + (W - 8) + '" y="' + (y + 16) + '" text-anchor="end">' + ms(r.p99s[i]) + '</text>';
      });
      svg += '</svg>';
      bars.innerHTML = svg;
    }

    function compare() {
      var p = params();
      cmpBody.innerHTML = '';
      ALGOS.forEach(function (a) {
        var r = simulate({ algo: a.id, util: p.util, slow: p.slow });
        cmpBody.appendChild(h('tr', { class: a.id === p.algo ? 'is-sel' : '' }, [
          h('td', { text: a.name }), h('td', { class: 'r', text: ms(r.p50) }), h('td', { class: 'r', text: ms(r.p99) }), h('td', { class: 'r', text: F.pct(r.share[0], 1) })
        ]));
      });
      cmp.hidden = false;
    }

    [algo, util, slow].forEach(function (el) { el.addEventListener('input', run); el.addEventListener('change', run); });
    var cmpBtn = h('button', { type: 'button', class: 'btn', text: 'Comparar todos los algoritmos' });
    cmpBtn.addEventListener('click', compare);

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Simulador de balanceo: 5 servidores, uno puede estar lento' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [
        h('div', { class: 'field' }, [h('label', { for: algo.id, text: 'Algoritmo' }), algo]),
        h('div', { class: 'field' }, [h('label', {}, ['Carga del clúster: ', utilOut]), util]),
        h('div', { class: 'field' }, [h('label', { text: 'Servidor 1' }), slow]),
        cmpBtn
      ]),
      stats, bars, cmp
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: '20 000 requests con llegadas de Poisson y tiempo de servicio exponencial de 10 ms en promedio; cada servidor atiende una request a la vez. Semilla fija: los resultados son reproducibles.' }));
    run();
  }

  SD.ready(function () { document.querySelectorAll('[data-sim="lb"]').forEach(init); });
  SD.simLB = simulate;
})();
