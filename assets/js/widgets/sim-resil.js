/* Widgets de resiliencia:
   <div data-sim="bucket">  rate limiter: token bucket frente a ventana fija, con ráfagas
   <div data-sim="retry">   tormenta de reintentos tras una caída: sin reintentos, inmediatos, backoff, backoff + jitter, presupuesto */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  /* ======================= Token bucket ======================= */

  function initBucket(host) {
    var st = { algo: 'bucket', cap: 10, rate: 5, tokens: 10, windowStart: 0, windowCount: 0, t: 0, auto: true, events: [] };
    var accepted = 0, rejected = 0;
    var algo = h('select', { 'aria-label': 'Algoritmo' }, [h('option', { value: 'bucket', text: 'Token bucket (10 de capacidad, 5 por segundo)' }), h('option', { value: 'window', text: 'Ventana fija (5 por segundo)' })]);
    var burst = h('button', { type: 'button', class: 'btn btn--primary', text: 'Enviar una ráfaga de 12' });
    var autoB = h('button', { type: 'button', class: 'btn btn--ghost', 'aria-pressed': 'true', text: 'Tráfico constante: 4 por segundo' });
    var edge = h('button', { type: 'button', class: 'btn btn--ghost', text: 'Ráfaga en el borde de la ventana' });
    var viz = h('div', { class: 'sim-scroll' });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });
    var carry = 0;

    function request() {
      var ok;
      if (st.algo === 'bucket') {
        ok = st.tokens >= 1;
        if (ok) st.tokens -= 1;
      } else {
        ok = st.windowCount < st.rate;
        if (ok) st.windowCount++;
      }
      ok ? accepted++ : rejected++;
      st.events.push({ t: st.t, ok: ok });
    }

    burst.addEventListener('click', function () { for (var i = 0; i < 12; i++) request(); });
    autoB.addEventListener('click', function () { st.auto = !st.auto; autoB.setAttribute('aria-pressed', String(st.auto)); });
    edge.addEventListener('click', function () {
      /* 5 al final de una ventana y 5 al principio de la siguiente: 10 en ~100 ms */
      var toNext = 1000 - (st.t - st.windowStart);
      setTimeout(function () { for (var i = 0; i < 5; i++) request(); }, Math.max(0, toNext - 60));
      setTimeout(function () { for (var i = 0; i < 5; i++) request(); }, toNext + 40);
    });
    algo.addEventListener('change', function () {
      st.algo = algo.value; st.tokens = st.cap; st.windowCount = 0; st.windowStart = st.t; st.events = []; accepted = 0; rejected = 0;
    });

    function tick(dt) {
      st.t += dt;
      st.tokens = Math.min(st.cap, st.tokens + st.rate * dt / 1000);
      if (st.t - st.windowStart >= 1000) { st.windowStart += 1000 * Math.floor((st.t - st.windowStart) / 1000); st.windowCount = 0; }
      if (st.auto) { carry += 4 * dt / 1000; while (carry >= 1) { carry--; request(); } }
      st.events = st.events.filter(function (e) { return st.t - e.t < 6000; });
    }

    function draw() {
      var W = 700, H = 170, x0 = 90, span = 6000, pw = W - x0 - 20;
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Requests aceptadas y rechazadas en los últimos 6 segundos">';
      if (st.algo === 'bucket') {
        var fillH = st.tokens / st.cap * 110;
        s += '<rect x="20" y="30" width="44" height="110" rx="4" fill="var(--paper-sunk)" stroke="var(--rule-strong)"/>';
        s += '<rect x="20" y="' + (140 - fillH) + '" width="44" height="' + fillH + '" rx="4" fill="var(--l-service)" opacity="0.8"/>';
        s += '<text class="sim-val" x="42" y="158" text-anchor="middle">' + F.num(st.tokens, 1) + '</text>';
        s += '<text class="sim-axis" x="42" y="20" text-anchor="middle">tokens</text>';
      } else {
        var used = st.windowCount / st.rate * 110, prog = (st.t - st.windowStart) / 1000;
        s += '<rect x="20" y="30" width="44" height="110" rx="4" fill="var(--paper-sunk)" stroke="var(--rule-strong)"/>';
        s += '<rect x="20" y="' + (140 - used) + '" width="44" height="' + used + '" rx="4" fill="var(--warn)" opacity="0.8"/>';
        s += '<text class="sim-val" x="42" y="158" text-anchor="middle">' + st.windowCount + ' / ' + st.rate + '</text>';
        s += '<text class="sim-axis" x="42" y="20" text-anchor="middle">ventana ' + Math.round(prog * 100) + '%</text>';
      }
      s += '<line class="sim-grid" x1="' + x0 + '" x2="' + (x0 + pw) + '" y1="60" y2="60"/><line class="sim-grid" x1="' + x0 + '" x2="' + (x0 + pw) + '" y1="110" y2="110"/>';
      s += '<text class="sim-axis" x="' + x0 + '" y="46">aceptadas</text><text class="sim-axis" x="' + x0 + '" y="96">rechazadas (429)</text>';
      for (var k = 0; k <= 6; k++) s += '<text class="sim-axis" x="' + (x0 + pw - k * pw / 6) + '" y="158" text-anchor="middle">' + (k === 0 ? 'ahora' : '−' + k + ' s') + '</text>';
      st.events.forEach(function (e) {
        var x = x0 + pw - (st.t - e.t) / span * pw;
        s += '<circle cx="' + x.toFixed(1) + '" cy="' + (e.ok ? 60 : 110) + '" r="4" fill="' + (e.ok ? 'var(--ink)' : 'var(--fail)') + '"/>';
      });
      s += '</svg>';
      viz.innerHTML = s;
      var recent = st.events.filter(function (e) { return st.t - e.t < 1000; });
      stats.innerHTML = '';
      [['Aceptadas en el último segundo', String(recent.filter(function (e) { return e.ok; }).length)], ['Aceptadas en total', String(accepted)], ['Rechazadas en total', String(rejected)]].forEach(function (x) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
    }

    var last = null;
    function frame(ts) { if (last == null) last = ts; var dt = Math.min(200, ts - last); last = ts; tick(dt); draw(); requestAnimationFrame(frame); }

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Rate limiter: token bucket y ventana fija' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [h('div', { class: 'field' }, [h('label', { text: 'Algoritmo' }), algo]), burst, autoB, edge]),
      viz, stats
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'El token bucket permite ráfagas hasta su capacidad y después limita al ritmo de recarga. La ventana fija deja pasar el doble del límite si la ráfaga cae justo en el cambio de ventana: pruébalo con "Ráfaga en el borde".' }));
    requestAnimationFrame(frame);
  }

  /* ======================= Tormenta de reintentos ======================= */

  var POLICIES = [
    { id: 'none', name: 'Sin reintentos' },
    { id: 'immediate', name: 'Reintento inmediato, hasta 3 veces' },
    { id: 'backoff', name: 'Backoff exponencial sin jitter' },
    { id: 'jitter', name: 'Backoff exponencial con jitter' },
    { id: 'budget', name: 'Jitter + presupuesto de reintentos (10 %)' }
  ];

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* Servidor con cola FIFO y capacidad C; cada request tiene un timeout de cliente de 1 s.
     Si se atiende después de su timeout, el trabajo se desperdicia (el cliente ya se fue y reintentó).
     Entre los 10 y los 15 s un incidente (una dependencia lenta, un nodo menos) deja la capacidad al 25 %. Paso de 100 ms, 40 s. */
  function simulateRetry(policy, load, dropExpired) {
    var rand = rng(5), dt = 0.1, T = 40, C = 1000, L = load, TIMEOUT = 1, QMAX = 20000;
    var steps = Math.round(T / dt);
    var due = []; for (var z = 0; z < steps + 600; z++) due.push([]);
    var queue = [], head = 0;
    var offered = [], good = [], budget = 0;

    function schedule(i, attempt) {
      if (policy === 'none' || attempt > 3) return;
      if (policy === 'budget') { if (budget < 1) return; budget -= 1; }
      var d;
      if (policy === 'immediate') d = 0;
      else {
        var base = 0.5 * Math.pow(2, attempt - 1);
        d = policy === 'backoff' ? base : rand() * base * 2;   /* full jitter: entre 0 y 2 × base */
      }
      var j = i + Math.max(1, Math.round(d / dt));
      if (j < due.length) due[j].push(attempt + 1);
    }

    for (var i = 0; i < steps; i++) {
      var t = i * dt, outage = t >= 10 && t < 15;
      budget = Math.min(L * 0.1, budget + L * 0.1 * dt);
      /* llegan requests nuevas y reintentos */
      var arrivals = [];
      var nf = Math.round(L * dt);
      for (var k = 0; k < nf; k++) arrivals.push(1);
      arrivals = arrivals.concat(due[i]);
      offered.push(arrivals.length / dt);
      arrivals.forEach(function (attempt) {
        if (queue.length - head >= QMAX) schedule(i, attempt);                    /* cola llena: rechazo inmediato */
        else queue.push({ at: t, attempt: attempt, gaveUp: false });
      });
      /* clientes que superan su timeout abandonan y reintentan (la request sigue en la cola) */
      for (k = head; k < queue.length; k++) {
        var q = queue[k];
        if (!q.gaveUp && t - q.at >= TIMEOUT) { q.gaveUp = true; schedule(i, q.attempt); }
      }
      /* el servidor atiende en orden */
      var ok = 0;
      var cap = (outage ? C * 0.25 : C) * dt;                   /* el incidente deja al servicio al 25 % */
      while (cap >= 1 && head < queue.length) {
        var r = queue[head++];
        var expired = r.gaveUp || t - r.at >= TIMEOUT;
        if (expired && dropExpired) continue;                  /* se descarta sin gastar capacidad */
        cap--;
        if (!expired) ok++;
      }
      if (head > 5000) { queue = queue.slice(head); head = 0; }
      good.push(ok / dt);
    }
    /* recuperación sostenida: desde cuándo el goodput ya no vuelve a caer por debajo del 95 % de la carga */
    var lastBad = -1;
    for (i = Math.round(15 / dt); i < steps; i++) if (good[i] < L * 0.95) lastBad = i;
    var rec = lastBad < 0 ? 0 : lastBad >= steps - 10 ? null : (lastBad + 1) * dt - 15;
    return { offered: offered, good: good, recovery: rec, dt: dt, C: C, L: L };
  }

  function initRetry(host) {
    var pol = h('select', { 'aria-label': 'Política de reintentos' });
    POLICIES.forEach(function (p) { pol.appendChild(h('option', { value: p.id, text: p.name })); });
    pol.value = 'immediate';
    var load = h('select', { 'aria-label': 'Carga normal' }, [h('option', { value: '600', text: 'Carga 600/s (60 % de la capacidad)' }), h('option', { value: '800', selected: true, text: 'Carga 800/s (80 %)' }), h('option', { value: '900', text: 'Carga 900/s (90 %)' })]);
    var srv = h('select', { 'aria-label': 'Comportamiento del servidor' }, [h('option', { value: 'fifo', text: 'Atiende todo en orden (FIFO)' }), h('option', { value: 'drop', text: 'Descarta requests cuyo cliente ya se fue' })]);
    var viz = h('div', { class: 'sim-scroll' });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });
    var note = h('p', { class: 'sim-note' });

    function run() {
      var r = simulateRetry(pol.value, +load.value, srv.value === 'drop');
      var W = 700, H = 250, l = 56, t = 16, b = 34, pw = W - l - 120, ph = H - t - b;
      var maxY = Math.max(r.C * 1.2, Math.max.apply(null, r.offered) * 1.05);
      var top = Math.ceil(maxY / 1000) * 1000;
      function X(i) { return l + i * r.dt / 40 * pw; }
      function Y(v) { return t + ph - v / top * ph; }
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Carga ofrecida y requests exitosas antes, durante y después de una caída de 5 segundos">';
      for (var g = 0; g <= 4; g++) {
        var v = top * g / 4;
        s += '<line class="sim-grid" x1="' + l + '" x2="' + (l + pw) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/>';
        s += '<text class="sim-axis" x="' + (l - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + F.num(v, 0) + '</text>';
      }
      s += '<rect x="' + X(100) + '" y="' + t + '" width="' + (X(150) - X(100)) + '" height="' + ph + '" fill="var(--fail-tint)"/>';
      s += '<text class="sim-axis" x="' + ((X(100) + X(150)) / 2) + '" y="' + (t + 12) + '" text-anchor="middle" style="fill:var(--fail)">incidente</text>';
      s += '<line x1="' + l + '" x2="' + (l + pw) + '" y1="' + Y(r.C) + '" y2="' + Y(r.C) + '" stroke="var(--ink-3)" stroke-dasharray="5 4"/>';
      s += '<text class="sim-axis" x="' + (l + pw + 6) + '" y="' + (Y(r.C) + 4) + '">capacidad</text>';
      function line(arr, color, width) {
        var d = arr.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(Math.min(v, top)).toFixed(1); }).join(' ');
        return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + width + '" stroke-linejoin="round"/>';
      }
      s += line(r.offered, 'var(--warn)', 2);
      s += line(r.good, 'var(--link)', 2);
      var n = r.offered.length - 1;
      s += '<text class="sim-label" x="' + (l + pw + 6) + '" y="' + (Y(Math.min(r.offered[n], top)) - 4) + '" style="fill:var(--ink)">carga ofrecida</text>';
      var yo = Y(Math.min(r.offered[n], top)), yg = Y(r.good[n]);
      var ygl = Math.abs(yg - yo) < 20 ? Math.min(yo + 18, t + ph - 4) : yg - 6;
      s += '<text class="sim-label" x="' + (l + pw + 6) + '" y="' + ygl + '" style="fill:var(--ink)">exitosas</text>';
      for (var sec = 0; sec <= 40; sec += 5) s += '<text class="sim-axis" x="' + X(sec / r.dt) + '" y="' + (H - 12) + '" text-anchor="middle">' + sec + ' s</text>';
      s += '<text class="sim-axis" x="' + l + '" y="' + (t - 4) + '">requests por segundo</text>';
      s += '</svg>';
      viz.innerHTML = s;
      var peak = Math.max.apply(null, r.offered);
      stats.innerHTML = '';
      [['Pico de carga ofrecida', F.num(peak, 0) + '/s'], ['Respecto de la capacidad', F.num(peak / r.C * 100, 0) + ' %'], ['Recuperación tras la caída', r.recovery == null ? 'no se recupera' : F.num(r.recovery, 1) + ' s']].forEach(function (x) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
      note.textContent = r.recovery == null
        ? 'Falla metaestable: el incidente terminó a los 15 s y el servicio tiene capacidad de sobra para la carga normal, pero no se recupera. Atiende requests viejas cuyos clientes ya se fueron (trabajo desperdiciado), esos clientes reintentan, y la cola nunca se vacía. Hay que romper el ciclo desde afuera.'
        : r.recovery > 3 ? 'Se recupera, pero tarda ' + F.num(r.recovery, 1) + ' s en vaciar la cola acumulada.' : 'Se recupera casi de inmediato: la carga extra nunca se vuelve trabajo desperdiciado.';
    }

    [pol, load, srv].forEach(function (el) { el.addEventListener('change', run); });
    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Tormenta de reintentos: 5 segundos de capacidad reducida' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [h('div', { class: 'field' }, [h('label', { text: 'Política de reintentos' }), pol]), h('div', { class: 'field' }, [h('label', { text: 'Carga normal' }), load]), h('div', { class: 'field' }, [h('label', { text: 'Servidor' }), srv])]),
      viz, stats, note
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Capacidad de 1 000 requests/s que cae al 25 % entre los 10 y los 15 s. Cada cliente espera 1 s; si no recibe respuesta, se va y reintenta según la política (hasta 3 veces). La request abandonada sigue en la cola del servidor.' }));
    run();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="bucket"]').forEach(initBucket);
    document.querySelectorAll('[data-sim="retry"]').forEach(initRetry);
  });
  SD.simRetry = simulateRetry;
})();
