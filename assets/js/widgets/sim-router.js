/* Widgets del M19 (router y flota GPU):
   <div data-sim="router">       ocho réplicas y cinco formas de elegir a cuál mandar cada turno de una conversación:
                                 round robin, la menos cargada, hash del prefijo inicial, afinidad por conversación
                                 y prefijo con carga acotada; mide los aciertos de prefijo, el TTFT y el desbalance
   <div data-calc="coldstart">   cuánto tarda en arrancar una réplica, cuánto crece el tráfico mientras tanto y cuánto
                                 cuesta el colchón de réplicas que cubre ese tiempo
   La simulación está en SD.routerCore (sin DOM) para poder probarla aparte. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
  function normal(r) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }
  function pct(a, p) { if (!a.length) return NaN; var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; }
  function hash(x) { x = (x ^ 61) ^ (x >>> 16); x = x + (x << 3); x = x ^ (x >>> 4); x = Math.imul(x, 0x27d4eb2d); x = x ^ (x >>> 15); return x >>> 0; }

  /* ======================= Simulación ======================= */

  /* Ocho réplicas de 24 lugares; el prefill de cada réplica procesa 8 000 tokens por segundo, de a una request por vez;
     el decode avanza a 30 ms por token. Cuatro apps con prompts de sistema de 3 000, 1 200, 600 y 200 tokens. */
  var C = {
    N: 8, SLOTS: 24, PREFILL: 8000, OVERHEAD: 0.02, TPOT: 0.03, T: 900, WARM: 180, THINK: 12, TURNS: 8, REF_RPS: 16,
    APPS: [{ S: 3000, share: 0.4 }, { S: 1200, share: 0.3 }, { S: 600, share: 0.2 }, { S: 200, share: 0.1 }]
  };

  /* Conversaciones que llegan como Poisson; de 1 a 24 turnos (media 8); entre turnos, el usuario lee y escribe
     (exponencial de media 12 s). El 15 % de los mensajes pega un texto largo. La semilla es fija: todas las
     políticas ven las mismas conversaciones. */
  function workload(load) {
    var r = rng(7), convs = [], t = 0, convRate = load * C.REF_RPS / C.TURNS;
    for (;;) {
      t += -Math.log(1 - r()) / convRate;
      if (t > C.T) break;
      var u = r(), app = 0, acc = 0;
      for (var a = 0; a < C.APPS.length; a++) { acc += C.APPS[a].share; if (u < acc) { app = a; break; } }
      var turns = Math.min(24, 1 + Math.floor(-Math.log(1 - r()) * (C.TURNS - 1))), msgs = [];
      for (var k = 0; k < turns; k++) {
        var paste = r() < 0.15;
        msgs.push({
          u: Math.round(paste ? 1000 + r() * 3000 : 60 + r() * 340),
          o: Math.max(20, Math.min(1500, Math.round(350 * Math.exp(0.6 * normal(r))))),
          think: -Math.log(1 - r()) * C.THINK
        });
      }
      convs.push({ id: convs.length, app: app, start: t, msgs: msgs });
    }
    return convs;
  }

  /* KV cache libre de cada réplica: LRU por tokens. Claves: 'a<app>' (prompt de sistema) y 'c<conversación>' (historial). */
  function Cache(cap) { this.cap = cap; this.map = new Map(); this.size = 0; }
  Cache.prototype.peek = function (k) { var v = this.map.get(k); return v == null ? 0 : v; };
  Cache.prototype.touch = function (k) { var v = this.map.get(k); if (v != null) { this.map.delete(k); this.map.set(k, v); } };
  Cache.prototype.put = function (k, v) {
    var old = this.map.get(k);
    if (old != null) { this.size -= old; this.map.delete(k); }
    this.map.set(k, v); this.size += v;
    while (this.size > this.cap && this.map.size) { var first = this.map.keys().next().value; this.size -= this.map.get(first); this.map.delete(first); }
  };

  function simulate(policy, opts) {
    opts = opts || {};
    var load = opts.load || 0.7, cap = opts.cache || 250000, N = C.N, convs = workload(load), reps = [], ev = [], i;
    for (i = 0; i < N; i++) reps.push({ q: [], active: 0, pfree: 0, cache: new Cache(cap), served: 0, hit: 0, prompt: 0, actInt: 0, qInt: 0 });
    function push(e) {
      ev.push(e);
      var j = ev.length - 1;
      while (j > 0) { var p = (j - 1) >> 1; if (ev[p].t <= ev[j].t) break; var tmp = ev[p]; ev[p] = ev[j]; ev[j] = tmp; j = p; }
    }
    function pop() {
      var top = ev[0], last = ev.pop();
      if (ev.length) {
        ev[0] = last;
        var j = 0;
        for (;;) {
          var l = 2 * j + 1, rr = l + 1, m = j;
          if (l < ev.length && ev[l].t < ev[m].t) m = l;
          if (rr < ev.length && ev[rr].t < ev[m].t) m = rr;
          if (m === j) break;
          var tmp = ev[m]; ev[m] = ev[j]; ev[j] = tmp; j = m;
        }
      }
      return top;
    }
    convs.forEach(function (cv) { cv.hist = 0; cv.turn = 0; push({ t: cv.start, arr: true, cv: cv }); });
    var rr = 0, now = 0, lastT = 0, ttft = [], hitTok = 0, promptTok = 0;
    function loadOf(x) { return x.active + x.q.length; }
    function least() { var b = 0; for (var k = 1; k < N; k++) if (loadOf(reps[k]) < loadOf(reps[b])) b = k; return b; }
    function hitOn(x, cv) {
      var s = x.cache.peek('a' + cv.app) ? C.APPS[cv.app].S : 0;
      return s + (s && cv.hist ? Math.min(cv.hist, x.cache.peek('c' + cv.id)) : 0);
    }
    function choose(cv) {
      if (policy === 'rr') return (rr++) % N;
      if (policy === 'least') return least();
      if (policy === 'prefixhash') return hash(cv.app + 101) % N;
      if (policy === 'sticky') return hash(cv.id + 1) % N;
      /* prefijo con carga acotada: entre las réplicas con carga menor que 1.25 veces el promedio (+1),
         la que más prefijo tiene; si empatan, la menos cargada */
      var total = 0, k;
      for (k = 0; k < N; k++) total += loadOf(reps[k]);
      var bound = Math.ceil(1.25 * (total + 1) / N) + 1, best = -1, bh = -1;
      for (k = 0; k < N; k++) {
        var L = loadOf(reps[k]);
        if (L >= bound) continue;
        var hv = hitOn(reps[k], cv);
        if (hv > bh || (hv === bh && L < loadOf(reps[best]))) { bh = hv; best = k; }
      }
      return best < 0 ? least() : best;
    }
    function tryStart(x, ri) {
      while (x.active < C.SLOTS && x.q.length) {
        var req = x.q.shift(), cv = req.cv, m = cv.msgs[cv.turn];
        x.active++;
        var prompt = C.APPS[cv.app].S + cv.hist + m.u, hit = hitOn(x, cv);
        x.cache.touch('a' + cv.app);
        if (cv.hist) x.cache.touch('c' + cv.id);
        var end = Math.max(now, x.pfree) + (prompt - hit) / C.PREFILL + C.OVERHEAD;
        x.pfree = end;
        x.cache.put('a' + cv.app, C.APPS[cv.app].S);
        if (req.at >= C.WARM) { ttft.push(end - req.at); hitTok += hit; promptTok += prompt; x.hit += hit; x.prompt += prompt; x.served++; }
        push({ t: end + m.o * C.TPOT, arr: false, cv: cv, ri: ri });
      }
    }
    while (ev.length) {
      var e = pop();
      if (e.t > C.WARM && lastT < C.T) {
        var dt = Math.min(e.t, C.T) - Math.max(lastT, C.WARM);
        if (dt > 0) reps.forEach(function (x) { x.actInt += x.active * dt; x.qInt += x.q.length * dt; });
      }
      lastT = now = e.t;
      if (e.arr) {
        var ri = choose(e.cv);
        reps[ri].q.push({ cv: e.cv, at: now });
        tryStart(reps[ri], ri);
      } else {
        var x = reps[e.ri], cv = e.cv, m = cv.msgs[cv.turn];
        x.active--;
        cv.hist += m.u + m.o;
        x.cache.put('c' + cv.id, cv.hist);
        cv.turn++;
        if (cv.turn < cv.msgs.length && now + m.think < C.T) push({ t: now + m.think, arr: true, cv: cv });
        tryStart(x, e.ri);
      }
    }
    var span = C.T - C.WARM, loads = reps.map(function (x) { return (x.actInt + x.qInt) / span; });
    var avg = loads.reduce(function (s, v) { return s + v; }, 0) / N;
    return {
      hit: promptTok ? hitTok / promptTok : 0, p50: pct(ttft, 0.5), p95: pct(ttft, 0.95), p99: pct(ttft, 0.99), n: ttft.length,
      imbalance: avg ? Math.max.apply(null, loads) / avg : 1,
      reps: reps.map(function (x) { return { act: x.actInt / span, q: x.qInt / span, hit: x.prompt ? x.hit / x.prompt : 0, served: x.served }; })
    };
  }

  SD.routerCore = { simulate: simulate, workload: workload, C: C };
  if (!SD.ready || typeof document === 'undefined') return;

  /* ======================= Vistas ======================= */

  var uid = 0;
  function chips(label, items, current, onPick) {
    var g = h('div', { class: 'calc-presets', role: 'group', 'aria-label': label });
    items.forEach(function (it) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': it[0] === current ? 'true' : 'false', text: it[1] });
      b.addEventListener('click', function () {
        g.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        onPick(it[0]);
      });
      g.appendChild(b);
    });
    return g;
  }
  function stat(host, label, value) { host.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: label }), h('b', { text: value })])); }
  function legend(items) {
    return h('div', { class: 'batch-legend' }, items.map(function (it) { return h('span', {}, [h('i', { style: it[1] }), it[0]]); }));
  }

  var POL = {
    rr: { name: 'Round robin', note: 'Reparte en orden, sin mirar nada. Cada turno de una conversación cae en otra réplica: el prompt de sistema suele estar en todas, pero el historial casi nunca, y cada turno vuelve a calcular el prefill de todo lo anterior. Con carga alta, el prefill satura las réplicas y el TTFT se dispara.' },
    least: { name: 'La menos cargada', note: 'Elige la réplica con menos requests en curso y en cola. Reparte parejo, pero tampoco sabe dónde está cada historial: acierta lo mismo que round robin. Y contar requests no ve el prefill pendiente: una réplica con pocas requests puede estar calculando un prompt de 4 000 tokens.' },
    prefixhash: { name: 'Hash del prefijo inicial', note: 'Hashea los primeros tokens del prompt, que son el prompt de sistema: todas las conversaciones de una app van a la misma réplica. La app que manda el 40 % del tráfico satura una réplica de ocho y su cola crece sin límite, mientras otras quedan casi vacías. Quien rutea así tiene que desbordar a más réplicas cuando un prefijo supera cierta tasa.' },
    sticky: { name: 'Afinidad por conversación', note: 'Hashea el id de la conversación: todos sus turnos van a la misma réplica, que conserva el historial en su KV cache. Los aciertos suben mucho. Pero el hash no mira la carga: cuando varias conversaciones activas coinciden en una réplica, su cola crece, y con carga alta la cola de latencias empeora.' },
    prefix: { name: 'Prefijo con carga acotada', note: 'Entre las réplicas cuya carga no supera 1.25 veces el promedio, elige la que tiene en su KV cache el prefijo más largo de esta request; si ninguna lo tiene, la menos cargada. Conserva casi todos los aciertos de la afinidad sin dejar que una réplica se sature: la mejor cola de latencias con carga alta.' }
  };

  function initRouter(host) {
    var policy = 'rr';
    var loadSel = h('select', { id: 'rt-load-' + (++uid) }, [0.5, 0.7, 0.85, 1].map(function (x) { return h('option', { value: x, text: F.pct(x, 0) }); }));
    loadSel.value = '0.85';
    var cacheSel = h('select', { id: 'rt-cache-' + uid }, [100000, 250000, 1000000].map(function (x) { return h('option', { value: x, text: F.num(x, 0) + ' tokens' }); }));
    cacheSel.value = '250000';
    var chart = h('div', { class: 'sim-scroll router-chart' }), stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' }), note = h('p', { class: 'sim-note' });

    function draw(res) {
      var W = 700, H = 250, l = 46, r = 12, top = 16, bot = 52, pw = W - l - r, ph = H - top - bot, ymax = C.SLOTS * 2;
      var Y = function (v) { return top + ph - Math.min(v, ymax) / ymax * ph; }, bw = pw / C.N;
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Carga promedio de cada una de las ocho réplicas: requests generando y requests en cola, y el porcentaje del prompt que encontró en su KV cache">';
      [0, 12, 24, 36, 48].forEach(function (v) {
        s += '<line class="sim-grid" x1="' + l + '" x2="' + (W - r) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/>';
        s += '<text class="sim-axis" x="' + (l - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + '</text>';
      });
      res.reps.forEach(function (x, k) {
        var x0 = l + k * bw + bw * 0.2, w = bw * 0.6;
        s += '<rect x="' + x0.toFixed(1) + '" y="' + Y(x.act).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (Y(0) - Y(x.act)).toFixed(1) + '" rx="3" fill="var(--l-gpu)"/>';
        if (x.q > 0.05) {
          s += '<rect x="' + x0.toFixed(1) + '" y="' + Y(x.act + x.q).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(1, Y(x.act) - Y(x.act + x.q) - 2).toFixed(1) + '" rx="3" fill="var(--l-queue)"/>';
        }
        if (x.act + x.q > ymax) s += '<text class="sim-val" x="' + (x0 + w / 2).toFixed(1) + '" y="' + (top + 12) + '" text-anchor="middle">cola: ' + F.num(x.q, 0) + '</text>';
        s += '<text class="sim-axis" x="' + (x0 + w / 2).toFixed(1) + '" y="' + (H - bot + 18) + '" text-anchor="middle">R' + (k + 1) + '</text>';
        s += '<text class="sim-label" x="' + (x0 + w / 2).toFixed(1) + '" y="' + (H - bot + 36) + '" text-anchor="middle">' + F.pct(x.hit, 0) + '</text>';
      });
      s += '<line x1="' + l + '" x2="' + (W - r) + '" y1="' + Y(C.SLOTS).toFixed(1) + '" y2="' + Y(C.SLOTS).toFixed(1) + '" stroke="var(--label)" stroke-width="1.5" stroke-dasharray="4 3"/>';
      s += '<text class="sim-val" x="' + (W - r) + '" y="' + (Y(C.SLOTS) - 6).toFixed(1) + '" text-anchor="end">24 lugares por réplica</text>';
      s += '<text class="sim-axis" x="' + l + '" y="' + (H - 4) + '">fila de abajo: porcentaje del prompt que la réplica encontró en su KV cache</text>';
      s += '</svg>';
      chart.innerHTML = s;
    }

    function run() {
      var res = simulate(policy, { load: +loadSel.value, cache: +cacheSel.value });
      draw(res);
      stats.innerHTML = '';
      stat(stats, 'Prompt reutilizado del KV cache', F.pct(res.hit, 0));
      stat(stats, 'TTFT p50', F.duration(res.p50));
      stat(stats, 'TTFT p95', F.duration(res.p95));
      stat(stats, 'Réplica más cargada ÷ promedio', F.num(res.imbalance, 2) + '×');
      note.textContent = POL[policy].note;
    }
    [loadSel, cacheSel].forEach(function (x) { x.addEventListener('change', run); });

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Cinco formas de elegir réplica' }),
      chips('Política del router', Object.keys(POL).map(function (k) { return [k, POL[k].name]; }), policy, function (k) { policy = k; run(); })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [
        h('div', { class: 'field' }, [h('label', { for: loadSel.id, text: 'Carga de la flota' }), loadSel]),
        h('div', { class: 'field' }, [h('label', { for: cacheSel.id, text: 'KV cache libre por réplica' }), cacheSel])
      ]),
      chart,
      legend([['Requests generando (promedio)', 'background: var(--l-gpu)'], ['Requests en cola (promedio)', 'background: var(--l-queue)']]),
      note, stats
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Ocho réplicas de 24 lugares; el prefill de cada una procesa 8 000 tokens por segundo y el decode avanza a 30 ms por token. Conversaciones de 8 turnos en promedio, con 12 s entre turnos; cuatro apps con prompts de sistema de 3 000, 1 200, 600 y 200 tokens, y la primera manda el 40 % del tráfico. Se miden 12 minutos después de 3 de calentamiento. Las mismas conversaciones llegan en el mismo momento con cualquier política.' }));
    run();
  }

  /* ======================= Cold start y colchón ======================= */

  var PRESETS = {
    nuevo: { name: 'Nodo nuevo', v: { prov: 300, img: 90, bw: 2, init: 60 } },
    nvme: { name: 'Nodo listo, pesos en NVMe', v: { prov: 0, img: 0, bw: 6, init: 60 } },
    pool: { name: 'Pool precalentado', v: { prov: 0, img: 0, bw: 20, init: 20 } }
  };

  function initColdStart(host) {
    function num(label, value, step, hint) {
      var id = 'cs' + (++uid);
      var i = h('input', { id: id, type: 'number', min: 0, step: step, value: value, inputmode: 'decimal' });
      var kids = [h('label', { for: id, text: label }), i];
      if (hint) kids.push(h('p', { class: 'field-hint', text: hint }));
      return { el: h('div', { class: 'field' }, kids), input: i };
    }
    var f = {
      gb: num('Pesos del modelo (GB)', 141, 1, '141 GB: un 70B en BF16.'),
      bw: num('Velocidad de carga de los pesos (GB/s)', 2, 0.5, 'Objetos en paralelo: 1 a 3. NVMe local: 5 a 7. RAM del host: 15 a 25. Otra GPU por RDMA: 25 a 50.'),
      prov: num('Conseguir y arrancar el nodo (s)', 300, 30, '0 si hay un nodo libre esperando.'),
      img: num('Bajar la imagen del contenedor (s)', 90, 10),
      init: num('Inicializar el motor (s)', 60, 10, 'Perfilar la memoria, reservar el KV cache, compilar y capturar los CUDA graphs.'),
      growth: num('Crecimiento del tráfico en el pico (% por minuto)', 3, 0.5),
      reps: num('Réplicas en el pico', 100, 10),
      gpus: num('GPUs por réplica', 4, 1),
      price: num('Precio por GPU y hora (USD)', 4, 0.5)
    };
    function out(label, formula) {
      var v = h('output', { class: 'out-value' });
      return { el: h('div', { class: 'out-row' }, [h('span', { class: 'out-label', text: label }), v, h('span', { class: 'out-formula', text: formula })]), v: v };
    }
    var o = {
      load: out('Cargar los pesos', 'pesos ÷ velocidad de carga'),
      total: out('Arranque de una réplica', 'nodo + imagen + pesos + motor'),
      grow: out('Cuánto crece el tráfico mientras tanto', '(1 + crecimiento) elevado a los minutos de arranque'),
      extra: out('Réplicas de colchón', 'réplicas × crecimiento, redondeado hacia arriba'),
      cost: out('Lo que cuesta el colchón', 'réplicas de colchón × GPUs × precio × 730 h')
    };
    function v(k) { var x = parseFloat(f[k].input.value); return isFinite(x) && x >= 0 ? x : 0; }
    function run() {
      var load = v('bw') ? v('gb') / v('bw') : Infinity, total = v('prov') + v('img') + load + v('init');
      var g = Math.pow(1 + v('growth') / 100, total / 60) - 1, extra = Math.ceil(v('reps') * g - 1e-9);
      o.load.v.textContent = F.duration(load);
      o.total.v.textContent = F.duration(total);
      o.grow.v.textContent = isFinite(g) ? '+' + F.pct(g, g < 0.1 ? 1 : 0) : '—';
      o.extra.v.textContent = isFinite(extra) ? F.num(extra, 0) + ' (' + F.num(extra * v('gpus'), 0) + ' GPUs)' : '—';
      o.cost.v.textContent = isFinite(extra) ? F.num(extra * v('gpus') * v('price') * 730, 0) + ' USD por mes' : '—';
    }
    var presetBar = chips('Punto de partida', Object.keys(PRESETS).map(function (k) { return [k, PRESETS[k].name]; }), 'nuevo', function (k) {
      var p = PRESETS[k].v;
      Object.keys(p).forEach(function (key) { f[key].input.value = p[key]; });
      run();
    });
    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    Object.keys(f).forEach(function (k) { inCol.appendChild(f[k].el); f[k].input.addEventListener('input', run); });
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Cold start y colchón de réplicas' }), presetBar]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'El colchón son las réplicas que ya tienen que estar corriendo cuando empieza a subir el tráfico, porque las que se pidan en ese momento llegan tarde. Supone que el autoscaler reacciona en el instante; con la ventana de medición y la decisión, el arranque efectivo es más largo.' }));
    run();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="router"]').forEach(initRouter);
    document.querySelectorAll('[data-calc="coldstart"]').forEach(initColdStart);
  });
})();
