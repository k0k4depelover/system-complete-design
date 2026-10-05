/* Widgets del M21 (metering y facturación por uso):
   <div data-calc="pricing">   cuánto cuesta una request por tipo de token, por día y por mes, y el error de redondear cada request
   <div data-sim="credits">    saldo prepagado con streams en vuelo: cobrar al final, reservar el máximo o reservar por tramos
   <div data-sim="usagepipe">  un evento de uso de punta a punta: normal, duplicado, tardío y perdido (SD.flowAnim de sim-dbflow.js)
   La lógica pura está en SD.meterCore, sin DOM, para probarla en Node. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  /* ======================= Lógica pura ======================= */

  var UNITS = [
    ['input', 'Entrada sin caché'],
    ['cacheWrite', 'Escritura en caché'],
    ['cacheRead', 'Lectura de caché'],
    ['output', 'Salida (incluye razonamiento)']
  ];

  /* u: tokens por tipo; p: USD por millón de tokens; mult: 0.5 en batch. Devuelve USD sin redondear. */
  function cost(u, p, mult) {
    var m = mult == null ? 1 : mult, lines = [], total = 0;
    UNITS.forEach(function (x) {
      var k = x[0], usd = (u[k] || 0) * (p[k] || 0) * m / 1e6;
      lines.push({ k: k, name: x[1], qty: u[k] || 0, usd: usd });
      total += usd;
    });
    return { lines: lines, total: total };
  }

  /* Redondeo al centavo, mitad hacia arriba. Primero pasa a micro-dólares enteros (como el ledger del M27)
     para no arrastrar errores de coma flotante, y redondea una sola vez. */
  function cents(usd) {
    var micro = Math.round(usd * 1e6);
    return (micro >= 0 ? Math.floor((micro + 5000) / 10000) : -Math.floor((-micro + 5000) / 10000)) / 100;
  }

  /* PRNG con semilla (mulberry32): la misma corrida da siempre el mismo resultado */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Saldo prepagado con requests en vuelo.
     policy: 'final' cobra al terminar y solo mira que el saldo sea positivo al admitir;
             'max'   reserva el costo máximo de la request y libera lo que sobra al terminar;
             'chunk' reserva un tramo y pide otro cada vez que el anterior se gasta; si no hay saldo, corta el stream.
     p: { balance, rate (requests por segundo), dur (s), mean (USD), max (USD), chunk (USD), T (s), seed } */
  function simulateCredits(policy, p) {
    var R = rng(p.seed || 7), bal = p.balance, holds = 0, live = [], t, k;
    var res = { admitted: 0, rejected: 0, cut: 0, finished: 0, minBal: bal, charged: 0, unpaid: 0, firstReject: null, series: [] };
    var carry = 0;
    for (t = 0; t <= p.T; t++) {
      /* 1. Avanza cada request en vuelo un segundo */
      for (k = live.length - 1; k >= 0; k--) {
        var q = live[k], step = q.cost / p.dur, done = false;
        q.spent += step;
        if (policy === 'chunk' && q.spent > q.hold + 1e-12) {
          /* se gastó el tramo: pide otro al saldo disponible */
          if (bal - holds >= p.chunk - 1e-12) { q.hold += p.chunk; holds += p.chunk; }
          else { q.spent = q.hold; q.cutNow = true; done = true; }
        }
        if (q.spent >= q.cost - 1e-12) { q.spent = q.cost; done = true; }
        if (done) {
          bal -= q.spent; res.charged += q.spent;
          holds -= q.hold;
          if (q.cutNow) res.cut++; else res.finished++;
          live.splice(k, 1);
        }
      }
      /* 2. Llegan requests nuevas (llegadas regulares con rate fraccional) */
      carry += p.rate;
      while (carry >= 1 - 1e-9) {
        carry -= 1;
        var c = Math.min(p.max, -Math.log(1 - R()) * p.mean);
        var ok, hold = 0;
        if (policy === 'final') ok = bal > 0;
        else if (policy === 'max') { ok = bal - holds >= p.max - 1e-12; hold = p.max; }
        else { ok = bal - holds >= p.chunk - 1e-12; hold = p.chunk; }
        if (ok) {
          res.admitted++; holds += hold;
          live.push({ cost: c, spent: 0, hold: hold });
        } else {
          res.rejected++;
          if (res.firstReject == null) res.firstReject = { t: t, bal: bal };
        }
      }
      if (bal < res.minBal) res.minBal = bal;
      res.series.push({ t: t, bal: bal, avail: bal - holds, live: live.length });
    }
    res.unpaid = Math.max(0, -res.minBal);
    res.final = bal;
    return res;
  }

  SD.meterCore = { cost: cost, cents: cents, rng: rng, simulateCredits: simulateCredits, UNITS: UNITS };

  if (typeof document === 'undefined') return;   /* en Node solo se usa la lógica */

  /* ======================= Calculadora de precios ======================= */

  function initPricing(host) {
    var uid = 0;
    function num(label, value, step, hint) {
      var id = 'mp' + (++uid);
      var i = h('input', { id: id, type: 'number', min: 0, step: step, value: value, inputmode: 'decimal' });
      var kids = [h('label', { for: id, text: label }), i];
      if (hint) kids.push(h('p', { class: 'field-hint', text: hint }));
      return { el: h('div', { class: 'field' }, kids), input: i };
    }
    var f = {
      input: num('Tokens de entrada sin caché por request', 1200, 100),
      cacheWrite: num('Tokens escritos en el caché', 0, 100),
      cacheRead: num('Tokens leídos del caché', 8000, 100),
      output: num('Tokens de salida (con razonamiento)', 400, 50),
      reqs: num('Requests por día', 100000, 1000),
      pin: num('Precio de entrada (USD por millón)', 2, 0.1, 'Por defecto, los de Claude Sonnet 5.5 en octubre de 2026. Edítalos con los de tu proveedor.'),
      pcw: num('Precio de escritura en caché', 2.5, 0.05),
      pcr: num('Precio de lectura de caché', 0.2, 0.01),
      pout: num('Precio de salida', 10, 0.5)
    };
    var mode = h('select', { id: 'mp-mode', 'aria-label': 'Modo de procesamiento' }, [
      h('option', { value: '1', text: 'Síncrono' }), h('option', { value: '0.5', text: 'Batch (50 % menos)' })
    ]);
    function out(label, formula) {
      var v = h('output', { class: 'out-value' });
      return { el: h('div', { class: 'out-row' }, [h('span', { class: 'out-label', text: label }), v, h('span', { class: 'out-formula', text: formula })]), v: v };
    }
    var o = {
      req: out('Costo de una request', 'Σ tokens × precio ÷ 1 000 000'),
      share: out('Peso de la salida', 'salida ÷ total'),
      nocache: out('La misma request sin prompt caching', 'leídos y escritos se cobran como entrada normal'),
      day: out('Por día', 'costo × requests por día'),
      month: out('Por mes (30 días), redondeando una vez por línea', 'se suma el uso del mes y se redondea al final'),
      bad: out('Por mes, redondeando cada request al centavo', 'cada request se redondea antes de sumar'),
      err: out('Error de redondear por request', 'redondeado ÷ exacto − 1')
    };
    function v(k) { var x = parseFloat(f[k].input.value); return isFinite(x) && x >= 0 ? x : 0; }
    function run() {
      var u = { input: v('input'), cacheWrite: v('cacheWrite'), cacheRead: v('cacheRead'), output: v('output') };
      var p = { input: v('pin'), cacheWrite: v('pcw'), cacheRead: v('pcr'), output: v('pout') };
      var m = parseFloat(mode.value), c = cost(u, p, m);
      var flat = cost({ input: u.input + u.cacheWrite + u.cacheRead, output: u.output }, p, m);
      var R = Math.round(v('reqs'));
      var exactMonth = c.total * R * 30, badMonth = cents(c.total) * R * 30;
      o.req.v.textContent = F.num(c.total, 6) + ' USD';
      o.share.v.textContent = c.total > 0 ? F.pct(c.lines[3].usd / c.total, 0) : '—';
      o.nocache.v.textContent = F.num(flat.total, 6) + ' USD' + (c.total > 0 ? ' (' + F.num(flat.total / c.total, 2) + '×)' : '');
      o.day.v.textContent = F.num(cents(c.total * R), 2) + ' USD';
      o.month.v.textContent = F.num(cents(exactMonth), 2) + ' USD';
      o.bad.v.textContent = F.num(cents(badMonth), 2) + ' USD';
      o.err.v.textContent = exactMonth > 0 ? (badMonth >= exactMonth ? '+' : '') + F.pct(badMonth / exactMonth - 1, 0) : '—';
    }
    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    Object.keys(f).forEach(function (k) {
      if (k === 'pin') inCol.appendChild(h('div', { class: 'field' }, [h('label', { for: 'mp-mode', text: 'Modo' }), mode]));
      inCol.appendChild(f[k].el); f[k].input.addEventListener('input', run);
    });
    mode.addEventListener('change', run);
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Tarifar una request' })]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'El redondeo es al centavo, mitad hacia arriba. Los tokens de razonamiento no se ven en la respuesta, pero se cobran como salida. Batch y prompt caching se combinan: el 50 % se aplica también a los tokens de caché.' }));
    run();
  }

  /* ======================= Saldo prepagado ======================= */

  var POL = {
    final: { name: 'Cobrar al terminar', note: 'Se admite cualquier request mientras el saldo sea positivo y se descuenta al terminar. Es lo más simple, y el saldo termina negativo: las requests que estaban en vuelo cuando llegó a cero siguen generando.' },
    max: { name: 'Reservar el máximo', note: 'Cada request reserva su costo máximo (max_tokens × precio) y devuelve lo que sobra al terminar. El saldo nunca baja de cero, pero con poco saldo las reservas bloquean dinero que nadie va a gastar y se rechazan requests que sí se podían pagar.' },
    chunk: { name: 'Reservar por tramos', note: 'Cada request reserva un tramo chico y pide otro cuando lo gasta, como los préstamos del escrow del M18. El saldo nunca baja de cero y se rechaza poco; a cambio, algunos streams se cortan a la mitad cuando no queda saldo para el tramo siguiente.' }
  };

  function initCredits(host) {
    var policy = 'final';
    var chips = h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Política de cobro' });
    Object.keys(POL).forEach(function (k) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': k === policy ? 'true' : 'false', text: POL[k].name });
      b.addEventListener('click', function () {
        policy = k;
        chips.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        run();
      });
      chips.appendChild(b);
    });
    function sel(label, opts, def) {
      var s = h('select', { 'aria-label': label }, opts.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
      s.value = String(def);
      return { el: h('div', { class: 'field' }, [h('label', { text: label }), s]), s: s };
    }
    var fBal = sel('Saldo inicial', [[10, '10 USD'], [20, '20 USD'], [50, '50 USD']], 20);
    var fCon = sel('Streams a la vez', [[5, '5'], [20, '20'], [60, '60']], 20);
    var fMax = sel('Costo máximo por request', [[0.2, '0.20 USD'], [0.5, '0.50 USD'], [1, '1.00 USD']], 0.5);
    var chart = h('div', { class: 'sim-scroll meter-chart' });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });
    var note = h('p', { class: 'sim-note' });

    function draw(res, T, b0) {
      var W = 700, H = 240, l = 52, r = 14, top = 14, bot = 34, pw = W - l - r, ph = H - top - bot;
      var ymin = Math.min(-2, Math.floor(res.minBal)), ymax = b0;
      var X = function (t) { return l + t / T * pw; }, Y = function (v) { return top + (ymax - v) / (ymax - ymin) * ph; };
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Saldo contable y saldo disponible a lo largo del tiempo">';
      var stepY = b0 <= 10 ? 2 : b0 <= 20 ? 5 : 10;
      for (var v = Math.ceil(ymin / stepY) * stepY; v <= ymax; v += stepY) {
        s += '<line class="sim-grid" x1="' + l + '" x2="' + (W - r) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/>';
        s += '<text class="sim-axis" x="' + (l - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + '</text>';
      }
      [0, T / 4, T / 2, 3 * T / 4, T].forEach(function (t) {
        s += '<text class="sim-axis" x="' + X(t).toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle">' + Math.round(t) + ' s</text>';
      });
      s += '<line x1="' + l + '" x2="' + (W - r) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="var(--label)" stroke-width="1.2"/>';
      function path(key) {
        return res.series.map(function (p, i) { return (i ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p[key]).toFixed(1); }).join(' ');
      }
      if (policy !== 'final') s += '<path d="' + path('avail') + '" fill="none" stroke="var(--l-queue)" stroke-width="2" stroke-dasharray="5 4"/>';
      s += '<path d="' + path('bal') + '" fill="none" stroke="var(--l-db)" stroke-width="2.5"/>';
      if (res.minBal < 0) {
        var low = res.series.reduce(function (a, p) { return p.bal < a.bal ? p : a; });
        s += '<circle cx="' + X(low.t).toFixed(1) + '" cy="' + Y(low.bal).toFixed(1) + '" r="4" fill="var(--fail)"/>';
        s += '<text class="sim-val" x="' + (X(low.t) - 8).toFixed(1) + '" y="' + (Y(low.bal) + 4).toFixed(1) + '" text-anchor="end">✗ ' + F.num(low.bal, 2) + ' USD</text>';
      }
      s += '<text class="sim-label" x="' + (W - r) + '" y="' + (top + 10) + '" text-anchor="end">línea llena: saldo contable' + (policy !== 'final' ? ' · punteada: saldo menos reservas' : '') + '</text>';
      s += '<text class="sim-axis" x="4" y="' + (top + 4) + '">USD</text>';
      s += '</svg>';
      chart.innerHTML = s;
    }

    function stat(label, val) { stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: label }), h('b', { text: val })])); }

    function run() {
      var b0 = +fBal.s.value, con = +fCon.s.value, max = +fMax.s.value, dur = 20, mean = 0.08;
      var T = Math.round(b0 / (con / dur * mean) * 1.4);
      var res = simulateCredits(policy, { balance: b0, rate: con / dur, dur: dur, mean: mean, max: max, chunk: 0.04, T: T, seed: 21 });
      draw(res, T, b0);
      stats.innerHTML = '';
      stat('Requests atendidas', F.num(res.finished, 0));
      stat('Rechazadas por saldo', F.num(res.rejected, 0));
      stat('Cortadas a la mitad', F.num(res.cut, 0));
      stat('Saldo mínimo', (res.minBal < 0 ? '✗ ' : '✓ ') + F.num(res.minBal, 2) + ' USD');
      stat('Saldo al llegar el primer rechazo', res.firstReject ? F.num(res.firstReject.bal, 2) + ' USD' : '—');
      note.textContent = POL[policy].note;
    }
    [fBal, fCon, fMax].forEach(function (x) { x.s.addEventListener('change', run); });

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Saldo prepagado con streams en vuelo' }), chips]));
    host.appendChild(h('div', { class: 'sim-body' }, [h('div', { class: 'sim-controls' }, [fBal.el, fCon.el, fMax.el]), chart, note, stats]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Cada stream dura 20 s y gasta su costo de forma pareja. El costo real sigue una distribución exponencial de 0.08 USD de media, recortada al máximo. Los tramos son de 0.04 USD. Semilla fija: la corrida se repite igual.' }));
    run();
  }

  /* ======================= El viaje de un evento de uso ======================= */

  function M(f, t, k, l) { return [f, t, k, l]; }
  function S(m, say, set) { return { m: m, say: say, set: set || null }; }

  var N = {
    GW: { x: 8, y: 14, w: 150, h: 84, name: 'Gateway', sub: 'cierra el stream', c: '--l-edge' },
    EN: { x: 8, y: 234, w: 150, h: 84, name: 'Motor', sub: 'cuenta tokens', c: '--l-gpu' },
    K: { x: 206, y: 124, w: 150, h: 84, name: 'Kafka', sub: 'tópico usage', c: '--l-queue' },
    RC: { x: 206, y: 234, w: 150, h: 84, name: 'Conciliación', sub: 'cada hora', c: '--l-service' },
    FL: { x: 404, y: 14, w: 150, h: 84, name: 'Streaming', sub: 'dedupe y ventanas', c: '--l-service' },
    S3: { x: 404, y: 234, w: 150, h: 84, name: 'Log crudo', sub: 'S3, inmutable', c: '--l-db' },
    AG: { x: 594, y: 14, w: 132, h: 84, name: 'Agregados', sub: 'por hora', c: '--l-db' },
    LD: { x: 594, y: 234, w: 132, h: 84, name: 'Saldo', sub: 'ledger', c: '--l-db' }
  };
  var E = [['GW', 'K'], ['EN', 'RC'], ['K', 'FL'], ['K', 'S3'], ['FL', 'AG'], ['FL', 'LD'], ['S3', 'RC'], ['RC', 'K']];

  var PIPE = {
    title: 'El viaje de un evento de uso', aria: 'Gateway, motor, Kafka, procesador de streaming, log crudo, conciliación, agregados y saldo', vbw: 734, vbh: 330,
    scenes: [
      { id: 'normal', name: 'Un evento normal', nodes: N, edges: E,
        init: { AG: { v: ['14:00 · 9.1 M'] }, LD: { v: ['182.40 USD'] } },
        def: 'Un evento de uso describe qué se consumió, no cuánto cuesta. Nace en el gateway cuando el stream termina y viaja por un log durable hasta los agregados y el saldo.',
        rows: [['La clave', 'El <code>event_id</code> se deriva del <code>request_id</code>: cualquier copia del mismo evento tiene el mismo id y se puede descartar.']],
        steps: [
          S([], 'Termina un stream de la organización <code>org_7</code>: 1 200 tokens de entrada, 8 000 leídos del caché y 400 de salida, a las 14:05:09.', { GW: { st: 'on', v: ['req_9f2 terminó'] } }),
          S([M('GW', 'K', 'write', 'evt req_9f2:final')], 'El gateway produce el evento con <code>acks=all</code> y el productor idempotente de Kafka. La clave del mensaje es la organización: todos sus eventos van a la misma partición, en orden.', { GW: { st: '', v: [] }, K: { st: 'on', v: ['partición 3', 'offset 88 120'] } }),
          S([M('K', 'S3', 'async', 'archivar')], 'Un consumidor aparte copia el tópico tal cual al log crudo en S3, particionado por día. Es la fuente para reprocesar todo si algo sale mal.', { S3: { st: 'ok', v: ['2026-10-04/…'] } }),
          S([M('K', 'FL', 'req', 'consumir')], 'El procesador de streaming lee el evento.', { K: { st: '', v: [] }, FL: { st: 'on', v: ['¿visto req_9f2:final?'] } }),
          S([], 'Busca el <code>event_id</code> en su estado de deduplicación (las últimas 48 horas de ids). No está: es nuevo. Lo anota.', { FL: { st: 'ok', v: ['nuevo: se anota'] } }),
          S([M('FL', 'AG', 'write', '+9 600 tokens · 14:00')], 'Suma las unidades a la ventana de la hora del evento (14:00 a 15:00), según la hora en que ocurrió y no la hora en que llegó.', { AG: { st: 'ok', v: ['14:00 · 9.1096 M'] } }),
          S([M('FL', 'LD', 'write', '−0.008 USD')], 'El tarifador aplica el precio vigente a las 14:05 y descuenta el saldo: 1 200 × 2 + 8 000 × 0.2 + 400 × 10 = 8 000 millonésimas de dólar.', { FL: { st: '', v: [] }, LD: { st: 'ok', v: ['182.392 USD'] } })
        ] },
      { id: 'dup', name: 'El mismo evento dos veces', nodes: N, edges: E,
        init: { AG: { v: ['14:00 · 9.1096 M'] }, LD: { v: ['182.392 USD'] } },
        def: 'Hay dos fuentes de duplicados: los reintentos del productor, que Kafka descarta solo, y un proceso que reenvía lo que ya había enviado, que Kafka no puede detectar.',
        rows: [['La clave', 'El productor idempotente cubre los reintentos dentro de una sesión. Lo demás lo cubre el dedupe por <code>event_id</code>.']],
        steps: [
          S([M('GW', 'K', 'write', 'evt req_a41:final')], 'El gateway produce un evento. Kafka lo escribe, pero la confirmación se pierde por un corte de red.', { K: { st: 'on', v: ['offset 88 121'] } }),
          S([M('GW', 'K', 'write', 'reintento, misma secuencia')], 'El productor reintenta con el mismo id de productor y el mismo número de secuencia. El broker ya tiene esa secuencia en la partición y no lo escribe de nuevo.', { K: { st: 'ok', v: ['un solo offset'] } }),
          S([], 'Ahora un caso que Kafka no ve: el gateway se reinicia y su outbox vuelve a publicar el evento, porque no llegó a marcarlo como enviado. Es un productor nuevo, con otro id.', { GW: { st: 'warn', v: ['reinicio', 'outbox reenvía'] }, K: { st: '' } }),
          S([M('GW', 'K', 'write', 'evt req_a41:final')], 'Kafka lo guarda como un mensaje distinto, en el offset 88 140.', { GW: { st: '', v: [] }, K: { st: 'warn', v: ['dos copias'] } }),
          S([M('K', 'FL', 'req', 'copia 1'), M('FL', 'AG', 'write', 'se suma')], 'La primera copia pasa: es nueva.', { AG: { st: 'ok' } }),
          S([M('K', 'FL', 'req', 'copia 2')], 'La segunda copia tiene el mismo <code>event_id</code>, que ya está en el estado. Se descarta y se cuenta en una métrica de duplicados.', { FL: { st: 'ok', v: ['duplicado: descartado'] }, AG: { st: '' } }),
          S([], 'Los agregados y el saldo cambiaron una sola vez. Si el estado de dedupe se perdiera, el log crudo tiene las dos copias y el reproceso las vuelve a deduplicar.', { FL: { st: '', v: [] }, K: { st: '', v: [] } })
        ] },
      { id: 'late', name: 'Un evento que llega tarde', nodes: N, edges: E,
        init: { AG: { v: ['14:00 cerrada', '15:00 cerrada'] }, LD: { v: ['175.10 USD'] } },
        def: 'La marca de agua (watermark) dice hasta qué hora del evento el procesador cree haber visto todo. Una ventana se cierra cuando la marca de agua pasa su fin más la tolerancia.',
        rows: [['La clave', 'Un evento tardío no se descarta en un sistema de facturación: va a una salida aparte y se aplica como corrección.']],
        steps: [
          S([], 'Una región quedó aislada dos horas. Su gateway guardó los eventos en disco y los publica al volver, a las 16:10. Uno es de las 14:05.', { GW: { st: 'warn', v: ['2 h sin red', 'cola local'] } }),
          S([M('GW', 'K', 'write', 'evt de las 14:05')], 'Kafka lo acepta: el log no juzga la hora del evento.', { GW: { st: '', v: [] }, K: { st: 'on', v: ['llega 16:10'] } }),
          S([M('K', 'FL', 'req', 'consumir')], 'El procesador tiene la marca de agua en 16:05 y una tolerancia de 1 hora: la ventana de las 14:00 se cerró a las 16:00 de la marca de agua.', { K: { st: '' }, FL: { st: 'warn', v: ['marca de agua: 16:05', 'ventana 14:00 cerrada'] } }),
          S([M('FL', 'AG', 'write', 'corrección · 14:00')], 'Va a la salida de eventos tardíos. Un job de corrección suma el evento a la hora 14:00 como una fila nueva, sin reescribir la que ya existía.', { FL: { st: '', v: [] }, AG: { st: 'ok', v: ['14:00 + corrección'] } }),
          S([M('FL', 'LD', 'write', '−0.008 USD')], 'El saldo se descuenta igual. Si la factura del período ya se hubiera emitido, la corrección va como línea de ajuste en la siguiente.', { LD: { st: 'ok', v: ['175.092 USD'] } })
        ] },
      { id: 'lost', name: 'El gateway muere antes de emitir', nodes: N, edges: E,
        init: { AG: { v: ['14:00 abierta'] }, LD: { v: ['182.392 USD'] } },
        def: 'Si el único registro del uso está en el proceso que se cayó, el uso se pierde. Por eso el motor deja su propia cuenta y la conciliación compara las dos.',
        rows: [['La clave', 'El evento de reemplazo usa el mismo <code>event_id</code> que habría usado el gateway: si el original aparece después, el dedupe lo descarta.']],
        steps: [
          S([], 'El motor termina de generar <code>req_c07</code>, pero el gateway muere antes de publicar el evento.', { GW: { st: 'down', v: ['caído'] }, EN: { st: 'ok', v: ['req_c07: 3 100 tokens'] } }),
          S([M('EN', 'RC', 'async', 'registro del motor')], 'El motor escribe por su cuenta, en lotes, qué requests procesó y cuántos tokens generó. Es la cuenta de la GPU, no la del cliente.', { EN: { st: '', v: [] }, RC: { st: 'on', v: ['motor: 41 220 requests'] } }),
          S([M('S3', 'RC', 'req', 'eventos de la hora')], 'A las 15:20, la conciliación compara la hora 14:00: 41 220 requests según el motor, 41 219 eventos en el log crudo. Falta <code>req_c07</code>.', { GW: { st: '' }, RC: { st: 'warn', v: ['falta 1 evento'] } }),
          S([M('RC', 'K', 'write', 'evt req_c07:final')], 'Publica un evento de reemplazo, marcado como reconstruido, con el mismo <code>event_id</code> que hubiera usado el gateway.', { RC: { st: 'ok', v: ['1 evento reconstruido'] }, K: { st: 'on' } }),
          S([M('K', 'FL', 'req', 'consumir'), M('FL', 'LD', 'write', 'tarde, pero se cobra')], 'Entra por el camino normal, como un evento tardío, y el saldo se descuenta.', { K: { st: '' }, LD: { st: 'ok', v: ['182.351 USD'] } })
        ] }
    ]
  };

  SD.ready(function () {
    document.querySelectorAll('[data-calc="pricing"]').forEach(initPricing);
    document.querySelectorAll('[data-sim="credits"]').forEach(initCredits);
    if (SD.flowAnim) document.querySelectorAll('[data-sim="usagepipe"]').forEach(function (el) { SD.flowAnim(el, PIPE); });
  });
})();
