/* Widgets del M18 (rate limiting y cuotas por tokens):
   <div data-sim="reserve">   un cliente contra su límite de tokens por minuto: contar al terminar, reservar max_tokens,
                              reservar y reconciliar, o estimar y reconciliar
   <div data-sim="tenants">   cuatro clientes comparten una flota: sin límites, con cuotas, con reparto justo y con admission control
   <div data-calc="escrow">   contador central, sincronización periódica o préstamos de cuota: exceso, cuota varada y coordinación
   La lógica de las dos simulaciones está en SD.quotaCore (sin DOM) para poder probarla aparte. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
  function normal(r) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }
  function p95(a) { if (!a.length) return NaN; var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.min(s.length - 1, Math.floor(0.95 * s.length))]; }

  /* ======================= Reservar, consumir, reconciliar ======================= */

  var R = { LIMIT: 60000, T: 600, DT: 0.25, WIN: 60, TTFT: 0.6, SPEED: 40, EST: 1300 };

  /* Llegadas de Poisson (con ráfagas si load = 'burst'); la salida real sigue una lognormal de mediana 350 tokens.
     La semilla depende solo de la carga: todas las estrategias y todos los max_tokens ven las mismas requests. */
  function reserveWorkload(load, maxTok) {
    var r = rng(11 + (load === 'burst' ? 500 : 0)), reqs = [], t = 0;
    var lmax = load === 'burst' ? 1.3 : 0.34;
    function rate(x) { return load === 'burst' ? (x % 120 < 25 ? 1.3 : 0.12) : 0.34; }
    for (;;) {
      t += -Math.log(1 - r()) / lmax;
      if (t >= R.T) break;
      var keep = r() < rate(t) / lmax, inp = Math.round(1000 + r() * 2000), out = Math.round(350 * Math.exp(0.8 * normal(r)));
      if (keep) reqs.push({ at: t, inp: inp, out: Math.max(1, Math.min(maxTok, out)) });
    }
    return reqs;
  }

  function simulateReserve(mode, maxTok, load) {
    var reqs = reserveWorkload(load, maxTok), N = Math.round(R.T / R.DT), W = Math.round(R.WIN / R.DT);
    var real = new Float64Array(N), lim = new Float64Array(N), realWin = [], limWin = [], rejects = [], running = [];
    var next = 0, limSum = 0, realSum = 0, admitted = 0, rejected = 0, est = Math.min(R.EST, maxTok);
    for (var s = 0; s < N; s++) {
      var t = s * R.DT;
      if (s >= W) { limSum -= lim[s - W]; realSum -= real[s - W]; }
      /* llegadas de este paso */
      while (next < reqs.length && reqs[next].at < t + R.DT) {
        var q = reqs[next++], cost = mode === 'end' ? 0 : q.inp + (mode === 'estimate' ? est : maxTok);
        var ok = mode === 'end' ? limSum < R.LIMIT : limSum + cost <= R.LIMIT;
        if (!ok) { rejected++; rejects.push(t); continue; }
        admitted++;
        if (cost) { lim[s] += cost; limSum += cost; }
        real[s] += q.inp; realSum += q.inp;
        running.push({ q: q, s0: s, charged: cost, done: 0, start: t + R.TTFT });
      }
      /* generación de los que están en curso */
      for (var i = running.length - 1; i >= 0; i--) {
        var x = running[i];
        if (t + R.DT <= x.start) continue;
        var n = Math.min(x.q.out - x.done, R.SPEED * R.DT);
        x.done += n; real[s] += n; realSum += n;
        if (x.done >= x.q.out - 1e-9) {
          /* reconciliar: la diferencia entre lo cobrado y lo real */
          if (mode === 'end') { var c = x.q.inp + x.q.out; lim[s] += c; limSum += c; }
          else if (mode === 'refund' || mode === 'estimate') {
            var d = x.q.inp + x.q.out - x.charged;
            if (d < 0) { if (s - x.s0 < W) { lim[x.s0] += d; limSum += d; } }
            else { lim[s] += d; limSum += d; }
          }
          running.splice(i, 1);
        }
      }
      realWin.push(realSum); limWin.push(limSum);
    }
    var totalReal = 0; for (s = 0; s < N; s++) totalReal += real[s];
    var peak = 0; for (s = W; s < N; s++) peak = Math.max(peak, realWin[s]);
    return { realWin: realWin, limWin: limWin, rejects: rejects, admitted: admitted, rejected: rejected,
      sent: admitted + rejected, avgPerMin: totalReal / (R.T / 60), peak: peak };
  }

  /* ======================= Varios clientes sobre la misma flota ======================= */

  var TEN = [
    { id: 'A', name: 'Chat de un cliente pro', w: 3, quota: 1800, deadline: 5, color: '--l-service', size: [300, 1300],
      rate: function () { return 1.5; } },
    { id: 'B', name: 'Integración de una empresa', w: 3, quota: 2400, deadline: 20, color: '--l-db', size: [1500, 4500],
      rate: function (t) { return t >= 100 && t < 220 ? 0.9 : 0.5; } },
    { id: 'C', name: 'Script mal configurado', w: 2, quota: 1500, deadline: 60, color: '--l-edge', size: [2000, 6000],
      rate: function (t) { return t >= 60 && t < 150 ? 3 : 0.1; } },
    { id: 'D', name: 'Plan gratis', w: 1, quota: 900, deadline: 5, color: '--l-queue', size: [100, 500],
      rate: function (t) { return t >= 120 && t < 200 ? 5 : 2; } }
  ];
  var M = { CAP: 5000, SLOTS: 64, RMAX: 120, T: 300, DT: 0.25, BURST: 10, BIN: 2 };

  function tenantWorkload() {
    var reqs = [];
    TEN.forEach(function (tn, k) {
      var r = rng(101 + k * 37), t = 0, lmax = 6;
      for (;;) {
        t += -Math.log(1 - r()) / lmax;
        if (t >= M.T) break;
        var keep = r() < tn.rate(t) / lmax, size = Math.round(tn.size[0] + r() * (tn.size[1] - tn.size[0]));
        if (keep) reqs.push({ k: k, at: t, size: size });
      }
    });
    return reqs.sort(function (a, b) { return a.at - b.at; });
  }

  function simulateTenants(policy) {
    var reqs = tenantWorkload(), N = Math.round(M.T / M.DT), bins = Math.round(M.T / M.BIN), perBin = Math.round(M.BIN / M.DT);
    var st = TEN.map(function (tn) {
      return { sent: 0, r429: 0, r503: 0, done: 0, tokens: 0, waits: [], queue: [], qWork: 0, bucket: tn.quota * M.BURST, recent: 0 };
    });
    var served = TEN.map(function () { return new Float64Array(bins); });
    var fifo = [], running = [], next = 0, quotas = policy !== 'fifo', fair = policy === 'fair' || policy === 'admit';
    var decay = Math.exp(-M.DT / 20);

    function activeWeight() {
      var w = 0;
      TEN.forEach(function (tn, k) { if (st[k].queue.length || running.some(function (x) { return x.k === k; })) w += tn.w; });
      return w;
    }

    for (var s = 0; s < N; s++) {
      var t = s * M.DT;
      if (quotas) TEN.forEach(function (tn, k) { st[k].bucket = Math.min(tn.quota * M.BURST, st[k].bucket + tn.quota * M.DT); });
      /* llegadas: cuota (429) y admission control (503) */
      while (next < reqs.length && reqs[next].at < t + M.DT) {
        var q = reqs[next++], S = st[q.k];
        S.sent++;
        if (quotas) {
          if (S.bucket < q.size) { S.r429++; continue; }
          S.bucket -= q.size;
        }
        if (policy === 'admit') {
          var aw = Math.max(activeWeight(), TEN[q.k].w), share = M.CAP * TEN[q.k].w / aw;
          if ((S.qWork + q.size) / share > TEN[q.k].deadline) { S.r503++; S.bucket += q.size; continue; }
        }
        var item = { k: q.k, at: q.at, size: q.size, left: q.size };
        if (fair) { S.queue.push(item); S.qWork += q.size; } else fifo.push(item);
      }
      /* llenar los lugares libres del batch */
      while (running.length < M.SLOTS) {
        var pick = null;
        if (fair) {
          var best = -1, bestScore = Infinity;
          TEN.forEach(function (tn, k) {
            if (!st[k].queue.length) return;
            var score = st[k].recent / tn.w;
            if (score < bestScore) { bestScore = score; best = k; }
          });
          if (best < 0) break;
          pick = st[best].queue.shift(); st[best].qWork -= pick.size;
        } else {
          if (!fifo.length) break;
          pick = fifo.shift();
        }
        st[pick.k].waits.push(t - pick.at);
        running.push(pick);
      }
      /* procesar: la capacidad se reparte entre los que están corriendo */
      var speed = running.length ? Math.min(M.RMAX, M.CAP / running.length) : 0, bin = Math.min(bins - 1, Math.floor(s / perBin));
      st.forEach(function (x) { x.recent *= decay; });
      for (var i = running.length - 1; i >= 0; i--) {
        var x = running[i], n = Math.min(x.left, speed * M.DT);
        x.left -= n; st[x.k].tokens += n; st[x.k].recent += n; served[x.k][bin] += n / M.BIN;
        if (x.left <= 1e-9) { st[x.k].done++; running.splice(i, 1); }
      }
    }
    return {
      served: served,
      rows: TEN.map(function (tn, k) {
        var S = st[k], pending = S.queue.length + fifo.filter(function (x) { return x.k === k; }).length;
        return { sent: S.sent, r429: S.r429, r503: S.r503, done: S.done, tokens: S.tokens, p95: p95(S.waits), pending: pending };
      })
    };
  }

  SD.quotaCore = { simulateReserve: simulateReserve, simulateTenants: simulateTenants, R: R, M: M, TEN: TEN };
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
    return h('div', { class: 'batch-legend' }, items.map(function (it) {
      return h('span', {}, [h('i', { style: it[1] }), it[0]]);
    }));
  }

  var RMODES = {
    end: { name: 'Contar al terminar', note: 'No reserva nada: deja pasar mientras quede saldo y descuenta cuando la request termina. Las requests en curso son invisibles para el limitador, así que en una ráfaga el uso real se pasa del límite antes de que el limitador se entere.' },
    max: { name: 'Reservar max_tokens', note: 'Cobra la entrada más max_tokens al entrar y no devuelve nada. Nunca se pasa del límite, pero el cliente recibe 429 con el uso real muy por debajo de lo que paga: el limitador cree que gastó mucho más de lo que gastó.' },
    refund: { name: 'Reservar y reconciliar', note: 'Reserva la entrada más max_tokens al entrar y devuelve lo que no usó al terminar. Nunca se pasa del límite y cobra lo real; el costo es que las reservas de las requests en curso bloquean cuota mientras duran. Con max_tokens grande, eso alcanza para rechazar.' },
    estimate: { name: 'Estimar y reconciliar', note: 'Reserva la entrada más una estimación de la salida (el p95 histórico, 1 300 tokens) y corrige al terminar, hacia arriba o hacia abajo. Casi no rechaza de más; a cambio, el uso real puede pasarse un poco del límite cuando varias respuestas salen más largas que lo estimado, y esa deuda se paga frenando las siguientes.' }
  };

  function initReserve(host) {
    var mode = 'end', load = 'burst';
    var maxSel = h('select', { id: 'rsv-max-' + (++uid) }, [1024, 4096, 16384].map(function (v) { return h('option', { value: v, text: F.num(v, 0) }); }));
    maxSel.value = '4096';
    var loadSel = h('select', { id: 'rsv-load-' + uid }, [h('option', { value: 'burst', text: 'En ráfagas cada 2 minutos' }), h('option', { value: 'steady', text: 'Constante, cerca del 75 % del límite' })]);
    var chart = h('div', { class: 'sim-scroll' }), stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' }), note = h('p', { class: 'sim-note' });

    function draw(res) {
      var W = 700, H = 246, l = 54, r = 14, top = 14, bot = 50, pw = W - l - r, ph = H - top - bot, N = res.realWin.length;
      var ymax = Math.max(R.LIMIT * 1.25, res.peak * 1.08, Math.max.apply(null, res.limWin) * 1.05);
      var X = function (sec) { return l + sec / R.T * pw; }, Y = function (v) { return top + ph - v / ymax * ph; };
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tokens usados en los últimos 60 segundos frente al límite de ' + F.num(R.LIMIT, 0) + ', durante 10 minutos">';
      [0, 20000, 40000, 60000, 80000, 100000, 120000, 140000].forEach(function (v) {
        if (v > ymax) return;
        s += '<line class="sim-grid" x1="' + l + '" x2="' + (W - r) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/>';
        s += '<text class="sim-axis" x="' + (l - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + (v ? F.num(v / 1000, 0) + ' mil' : '0') + '</text>';
      });
      for (var m = 0; m <= 10; m += 2) s += '<text class="sim-axis" x="' + X(m * 60).toFixed(1) + '" y="' + (H - bot + 16) + '" text-anchor="' + (m === 10 ? 'end' : 'middle') + '">' + m + ' min</text>';
      function path(arr) {
        var d = '', step = Math.max(1, Math.floor(N / 350));
        for (var i = 0; i < N; i += step) d += (i ? ' L' : 'M') + X(i * R.DT).toFixed(1) + ' ' + Y(arr[i]).toFixed(1);
        return d;
      }
      s += '<path d="' + path(res.limWin) + '" fill="none" stroke="var(--l-queue)" stroke-width="2" stroke-dasharray="5 4"/>';
      s += '<path d="' + path(res.realWin) + '" fill="none" stroke="var(--l-service)" stroke-width="2"/>';
      s += '<line x1="' + l + '" x2="' + (W - r) + '" y1="' + Y(R.LIMIT).toFixed(1) + '" y2="' + Y(R.LIMIT).toFixed(1) + '" stroke="var(--fail)" stroke-width="1.5" stroke-dasharray="3 3"/>';
      res.rejects.forEach(function (sec) { s += '<line x1="' + X(sec).toFixed(1) + '" x2="' + X(sec).toFixed(1) + '" y1="' + (H - 16) + '" y2="' + (H - 6) + '" stroke="var(--fail)" stroke-width="1.2"/>'; });
      s += '<text class="sim-axis" x="' + (l - 6) + '" y="' + (H - 7) + '" text-anchor="end">429</text>';
      s += '</svg>';
      chart.innerHTML = s;
    }

    function run() {
      var res = simulateReserve(mode, +maxSel.value, load);
      draw(res);
      stats.innerHTML = '';
      stat(stats, 'Requests rechazadas (429)', F.pct(res.rejected / Math.max(1, res.sent), 0));
      stat(stats, 'Uso real promedio', F.pct(res.avgPerMin / R.LIMIT, 0) + ' del límite');
      stat(stats, 'Pico de uso real en 60 s', F.pct(res.peak / R.LIMIT, 0) + ' del límite');
      note.textContent = RMODES[mode].note;
    }
    [maxSel, loadSel].forEach(function (x) { x.addEventListener('change', function () { load = loadSel.value; run(); }); });

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Cobrar antes de saber cuánto va a costar' }),
      chips('Estrategia de conteo', Object.keys(RMODES).map(function (k) { return [k, RMODES[k].name]; }), mode, function (k) { mode = k; run(); })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [
        h('div', { class: 'field' }, [h('label', { for: maxSel.id, text: 'max_tokens de cada request' }), maxSel]),
        h('div', { class: 'field' }, [h('label', { for: loadSel.id, text: 'Tráfico del cliente' }), loadSel])
      ]),
      chart,
      legend([['Uso real en los últimos 60 s', 'background: var(--l-service)'], ['Lo que cuenta el limitador', 'background: var(--l-queue)'], ['Límite: 60 000 tokens por minuto (línea punteada)', 'background: var(--fail)'], ['Cada raya de la fila 429 es un rechazo', 'background: var(--fail)']]),
      note, stats
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Un cliente con un límite de 60 000 tokens por minuto, medido en ventana deslizante. Entrada de 1 000 a 3 000 tokens; salida real de mediana 350 y p95 de 1 300 tokens, a 40 tokens por segundo. Las mismas requests llegan en el mismo momento con cualquier estrategia.' }));
    run();
  }

  var POL = {
    fifo: { name: 'Sin límites', note: 'Una sola cola, en orden de llegada. Cuando el script dispara su ráfaga, sus requests ocupan la flota y todos los demás esperan detrás: el cliente pro paga por un servicio que no recibe.' },
    quota: { name: 'Cuotas por cliente', note: 'Cada cliente tiene su balde de tokens por minuto: al script se le rechaza casi toda la ráfaga con 429. Pero las cuotas suman más que la flota (se vendió de más, a propósito), y cuando varios clientes usan su cuota a la vez la cola compartida vuelve a crecer para todos.' },
    fair: { name: 'Cuotas y reparto justo', note: 'Cada cliente tiene su propia cola y el próximo lugar libre va al que menos recibió en proporción a su peso (3, 3, 2 y 1). El cliente pro casi no espera; la espera se concentra en quien pide más de lo que le toca.' },
    admit: { name: 'Con admission control', note: 'Además, si la espera estimada de una request supera el plazo de su plan (5 s en el chat y en el plan gratis, 20 s para la empresa), se rechaza en el momento con un 503 en lugar de dejarla esperar. Las colas quedan acotadas y quien reintenta lo hace enseguida.' }
  };

  function initTenants(host) {
    var policy = 'fifo';
    var chart = h('div', { class: 'sim-scroll' }), note = h('p', { class: 'sim-note' });
    var table = h('div', { class: 'table-wrap tenants-table' });

    function draw(res) {
      var W = 700, H = 240, l = 54, r = 12, top = 16, bot = 30, pw = W - l - r, ph = H - top - bot;
      var bins = res.served[0].length, ymax = M.CAP * 1.3;
      var X = function (sec) { return l + sec / M.T * pw; }, Y = function (v) { return top + ph - v / ymax * ph; };
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tokens por segundo que la flota procesa para cada cliente durante 5 minutos, frente a la capacidad de ' + F.num(M.CAP, 0) + '">';
      s += '<rect x="' + X(60).toFixed(1) + '" y="' + top + '" width="' + (X(150) - X(60)).toFixed(1) + '" height="' + ph + '" fill="var(--fill)"/>';
      s += '<text class="sim-axis" x="' + ((X(60) + X(150)) / 2).toFixed(1) + '" y="' + (top + 12) + '" text-anchor="middle">ráfaga del script</text>';
      [0, 2500, 5000].forEach(function (v) {
        s += '<line class="sim-grid" x1="' + l + '" x2="' + (W - r) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/>';
        s += '<text class="sim-axis" x="' + (l - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + F.num(v, 0) + '</text>';
      });
      for (var m = 0; m <= 5; m++) s += '<text class="sim-axis" x="' + X(m * 60).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="' + (m === 5 ? 'end' : 'middle') + '">' + m + ' min</text>';
      var base = new Float64Array(bins);
      TEN.forEach(function (tn, k) {
        var up = '', down = '';
        for (var b = 0; b < bins; b++) {
          var x0 = X(b * M.BIN), x1 = X((b + 1) * M.BIN), y = Y(base[b] + res.served[k][b]);
          up += (b ? ' L' : 'M') + x0.toFixed(1) + ' ' + y.toFixed(1) + ' L' + x1.toFixed(1) + ' ' + y.toFixed(1);
        }
        for (b = bins - 1; b >= 0; b--) {
          down += ' L' + X((b + 1) * M.BIN).toFixed(1) + ' ' + Y(base[b]).toFixed(1) + ' L' + X(b * M.BIN).toFixed(1) + ' ' + Y(base[b]).toFixed(1);
        }
        s += '<path d="' + up + down + ' Z" fill="var(' + tn.color + ')" stroke="var(--bg)" stroke-width="1"/>';
        for (b = 0; b < bins; b++) base[b] += res.served[k][b];
      });
      s += '<line x1="' + l + '" x2="' + (W - r) + '" y1="' + Y(M.CAP).toFixed(1) + '" y2="' + Y(M.CAP).toFixed(1) + '" stroke="var(--label)" stroke-width="1.5" stroke-dasharray="4 3"/>';
      s += '<text class="sim-val" x="' + (W - r) + '" y="' + (Y(M.CAP) - 6).toFixed(1) + '" text-anchor="end">capacidad de la flota: 5 000 tokens/s</text>';
      s += '</svg>';
      chart.innerHTML = s;
    }

    function run() {
      var res = simulateTenants(policy);
      draw(res);
      var rows = res.rows.map(function (x, k) {
        var wait = isFinite(x.p95) ? F.duration(x.p95) : '—';
        return '<tr><td><span class="ten-sw" style="background: var(' + TEN[k].color + ')"></span>' + TEN[k].name + '</td>' +
          '<td class="r">' + F.num(x.sent, 0) + '</td><td class="r">' + F.num(x.r429, 0) + '</td><td class="r">' + F.num(x.r503, 0) + '</td>' +
          '<td class="r">' + wait + (x.pending ? ' <span class="muted">(+' + F.num(x.pending, 0) + ' en cola)</span>' : '') + '</td>' +
          '<td class="r">' + F.words(x.tokens) + '</td></tr>';
      }).join('');
      table.innerHTML = '<table class="t"><thead><tr><th>Cliente</th><th class="r">Enviadas</th><th class="r">429 por cuota</th><th class="r">503 por capacidad</th><th class="r">Espera p95</th><th class="r">Tokens servidos</th></tr></thead><tbody>' + rows + '</tbody></table>';
      note.textContent = POL[policy].note;
    }

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Cuatro clientes, una flota' }),
      chips('Política', Object.keys(POL).map(function (k) { return [k, POL[k].name]; }), policy, function (k) { policy = k; run(); })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      chart,
      legend(TEN.map(function (tn) { return [tn.name, 'background: var(' + tn.color + ')']; })),
      note, table
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Flota de 5 000 tokens por segundo y 64 lugares en el batch; cada request avanza a lo sumo a 120 tokens por segundo. Cuotas de 1 800, 2 400, 1 500 y 900 tokens por segundo con 10 segundos de ráfaga: suman 6 600, un 32 % más que la flota. La espera es el tiempo hasta que la request consigue un lugar en el batch.' }));
    run();
  }

  /* ======================= Tres formas de repartir un límite ======================= */

  function initEscrow(host) {
    function num(label, value, step, hint) {
      var id = 'esc' + (++uid);
      var i = h('input', { id: id, type: 'number', min: 0, step: step, value: value, inputmode: 'decimal' });
      var kids = [h('label', { for: id, text: label }), i];
      if (hint) kids.push(h('p', { class: 'field-hint', text: hint }));
      return { el: h('div', { class: 'field' }, kids), input: i };
    }
    var f = {
      limit: num('Límite del cliente (tokens por minuto)', 600000, 10000),
      use: num('Uso real (% del límite)', 90, 5),
      tpr: num('Tokens por request, en promedio', 2500, 100),
      gw: num('Gateways que atienden al cliente', 20, 1),
      rtt: num('Ida y vuelta hasta el contador (ms)', 0.5, 0.5, 'Medio milisegundo dentro de una zona; unos 70 ms si el contador está en otro continente.'),
      sync: num('Sincronización periódica: cada cuántos segundos', 2, 0.5),
      burst: num('Ráfaga: cuántas veces sube la tasa de llegada', 3, 0.5),
      chunk: num('Préstamo de cada gateway (% del límite)', 1, 0.25)
    };
    function out(label, formula) {
      var v = h('output', { class: 'out-value' });
      return { el: h('div', { class: 'out-row' }, [h('span', { class: 'out-label', text: label }), v, h('span', { class: 'out-formula', text: formula })]), v: v };
    }
    var o = {
      rps: out('Requests del cliente por segundo', 'límite × uso ÷ 60 ÷ tokens por request'),
      cOps: out('Contador central: operaciones por segundo', '2 por request (reservar y reconciliar); exceso: cero'),
      cLat: out('Contador central: latencia agregada', 'una ida y vuelta por request'),
      sOver: out('Sincronización periódica: exceso posible', 'tasa de tokens × ráfaga × intervalo'),
      eStr: out('Préstamos: cuota que puede quedar varada', 'gateways × préstamo; exceso: cero'),
      eOps: out('Préstamos: pedidos al contador por segundo', 'tasa de tokens ÷ tamaño del préstamo')
    };
    function v(k) { var x = parseFloat(f[k].input.value); return isFinite(x) && x >= 0 ? x : 0; }
    function run() {
      var L = v('limit'), rate = L * v('use') / 100 / 60, rps = rate / Math.max(1, v('tpr'));
      var over = rate * Math.max(1, v('burst')) * v('sync'), chunk = L * v('chunk') / 100, strand = Math.round(v('gw')) * chunk;
      o.rps.v.textContent = F.num(rps, rps < 10 ? 1 : 0);
      o.cOps.v.textContent = F.num(2 * rps, 0) + ' /s';
      o.cLat.v.textContent = '+' + F.num(v('rtt'), v('rtt') < 10 ? 1 : 0) + ' ms';
      o.sOver.v.textContent = F.words(over) + ' tokens (' + (L ? F.pct(over / L, 0) : '—') + ')';
      o.eStr.v.textContent = F.words(strand) + ' tokens (' + (L ? F.pct(strand / L, 0) : '—') + ')';
      o.eOps.v.textContent = chunk ? F.num(rate / chunk, rate / chunk < 10 ? 1 : 0) + ' /s' : '—';
    }
    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    Object.keys(f).forEach(function (k) { inCol.appendChild(f[k].el); f[k].input.addEventListener('input', run); });
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Tres formas de repartir un límite entre gateways' })]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'El exceso de la sincronización periódica es una cota: lo que puede entrar de más mientras ningún gateway se enteró del consumo de los demás. La cuota varada es la que los gateways tienen prestada y no usan; si un gateway muere, vuelve cuando vence su préstamo.' }));
    run();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="reserve"]').forEach(initReserve);
    document.querySelectorAll('[data-sim="tenants"]').forEach(initTenants);
    document.querySelectorAll('[data-calc="escrow"]').forEach(initEscrow);
  });
})();
