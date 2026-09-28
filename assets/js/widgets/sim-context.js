/* Widgets del M16 (context windows):
   <div data-sim="context">    una conversación que no entra en la ventana y lo que conserva cada estrategia
   <div data-calc="convcost">  cuánto cuesta una conversación de N turnos, con y sin prompt caching */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  /* ======================= Estrategias de contexto ======================= */

  var MSGS = [
    { role: 'system', text: 'Prompt de sistema e instrucciones', tokens: 1200 },
    { role: 'user', text: 'Pega un contrato de 30 páginas para revisar', tokens: 6500, doc: true },
    { role: 'assistant', text: 'Resumen del contrato', tokens: 700 },
    { role: 'user', text: '¿Qué dice sobre la rescisión?', tokens: 60 },
    { role: 'assistant', text: 'Explica las cláusulas 9 y 10', tokens: 450 },
    { role: 'tool', text: 'Resultado de una búsqueda web', tokens: 3000 },
    { role: 'assistant', text: 'Compara con la ley vigente', tokens: 600 },
    { role: 'user', text: 'Redacta un correo al proveedor', tokens: 80 },
    { role: 'assistant', text: 'Borrador del correo', tokens: 900 },
    { role: 'user', text: 'Hazlo más formal', tokens: 40 },
    { role: 'assistant', text: 'Correo corregido', tokens: 500 },
    { role: 'user', text: '¿La cláusula 7.2 nos obliga a pagar la multa?', tokens: 40, current: true }
  ];
  var ROLE = { system: ['Sistema', '--label-3'], user: ['Usuario', '--l-client'], assistant: ['Asistente', '--l-service'], tool: ['Herramienta', '--l-external'], summary: ['Resumen', '--l-queue'], retrieved: ['Recuperado', '--l-db'] };
  var RESERVE = 1000;

  var STRATS = {
    all: { name: 'Mandar todo', note: 'Sin estrategia. Si no entra, la API responde con un error de contexto demasiado largo.' },
    truncate: { name: 'Truncar lo más viejo', note: 'Se conserva el prompt de sistema y se borran los mensajes más viejos hasta que entre. Es lo más simple, y lo primero que se va es el documento.' },
    window: { name: 'Últimos 4 mensajes', note: 'Ventana deslizante: el sistema y los 4 mensajes más recientes. Predecible y barato; el modelo olvida todo lo anterior.' },
    summary: { name: 'Resumir lo viejo', note: 'Lo anterior a los últimos 4 mensajes se reemplaza por un resumen de 500 tokens hecho por un modelo más barato. Conserva el hilo, pierde los detalles.' },
    rag: { name: 'Recuperar lo relevante', note: 'El documento y los mensajes viejos se indexan con embeddings; se agregan solo los fragmentos parecidos a la pregunta actual, como la cláusula 7.2.' }
  };

  function plan(strat, avail) {
    var items = MSGS.map(function (m, i) { return { m: m, i: i, state: 'kept', tokens: m.tokens }; });
    var total = function () { return items.reduce(function (a, x) { return a + (x.state === 'dropped' || x.state === 'summarized' ? 0 : x.tokens); }, 0); };
    var extra = [];
    if (strat === 'truncate') {
      for (var i = 1; i < items.length - 1 && total() > avail; i++) items[i].state = 'dropped';
    } else if (strat === 'window') {
      items.forEach(function (x) { if (x.i > 0 && x.i < items.length - 4) x.state = 'dropped'; });
    } else if (strat === 'summary') {
      items.forEach(function (x) { if (x.i > 0 && x.i < items.length - 4) x.state = 'summarized'; });
      extra.push({ m: { role: 'summary', text: 'Resumen de la conversación anterior (sin el texto del contrato)' }, state: 'added', tokens: 500 });
    } else if (strat === 'rag') {
      items.forEach(function (x) { if (x.i > 0 && x.i < items.length - 4) x.state = 'dropped'; });
      extra.push({ m: { role: 'retrieved', text: 'Fragmento del contrato: cláusula 7.2 y su definición de multa' }, state: 'added', tokens: 420 });
      extra.push({ m: { role: 'retrieved', text: 'Fragmento de la respuesta anterior sobre rescisión' }, state: 'added', tokens: 180 });
    }
    var used = total() + extra.reduce(function (a, x) { return a + x.tokens; }, 0);
    var docKept = items[1].state === 'kept';
    var answer = strat === 'rag' || docKept;
    return { items: items, extra: extra, used: used, fits: used <= avail, answer: answer };
  }

  function initContext(host) {
    var win = h('select', { 'aria-label': 'Ventana de contexto' }, [8192, 16384, 32768].map(function (v) { return h('option', { value: v, text: F.num(v, 0) + ' tokens' }); }));
    var strat = h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Estrategia' });
    var current = 'truncate';
    Object.keys(STRATS).forEach(function (k) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': k === current ? 'true' : 'false', 'data-k': k, text: STRATS[k].name });
      b.addEventListener('click', function () {
        current = k;
        strat.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        run();
      });
      strat.appendChild(b);
    });
    var barHost = h('div', { class: 'ctx-bar-host' });
    var list = h('ol', { class: 'ctx-list' });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });
    var note = h('p', { class: 'sim-note' });

    function run() {
      var avail = +win.value - RESERVE, p = plan(current, avail);
      var shown = p.items.filter(function (x) { return x.state === 'kept'; }).concat(p.extra);
      var scale = Math.max(p.used, avail);
      var W = 700, x = 0, s = '<svg viewBox="0 0 ' + W + ' 46" role="img" aria-label="Tokens enviados frente a la ventana disponible">';
      s += '<rect x="0" y="6" width="' + W + '" height="24" rx="5" fill="var(--fill)"/>';
      /* orden de envío: sistema, extras (resumen o recuperados), resto en orden */
      var order = [p.items[0]].concat(p.extra, p.items.slice(1).filter(function (it) { return it.state === 'kept'; }));
      order.forEach(function (it) {
        var w = it.tokens / scale * W;
        s += '<rect x="' + x.toFixed(1) + '" y="6" width="' + Math.max(1, w - 1).toFixed(1) + '" height="24" fill="var(' + ROLE[it.m.role][1] + ')"/>';
        x += w;
      });
      var ax = avail / scale * W;
      s += '<line x1="' + ax.toFixed(1) + '" x2="' + ax.toFixed(1) + '" y1="0" y2="36" stroke="var(--fail)" stroke-width="2"/>';
      s += '<text class="sim-axis" x="' + Math.min(W - 4, ax + 4).toFixed(1) + '" y="44" text-anchor="' + (ax > W - 120 ? 'end' : 'start') + '">disponible: ' + F.num(avail, 0) + '</text>';
      s += '</svg>';
      barHost.innerHTML = s;

      list.innerHTML = '';
      p.items.concat(p.extra).forEach(function (it) {
        var st = it.state === 'kept' ? 'se envía' : it.state === 'dropped' ? 'se borra' : it.state === 'summarized' ? 'va al resumen' : 'se agrega';
        list.appendChild(h('li', { class: 'ctx-row is-' + it.state }, [
          h('span', { class: 'ctx-swatch', style: 'background: var(' + ROLE[it.m.role][1] + ')' }),
          h('span', { class: 'ctx-role', text: ROLE[it.m.role][0] }),
          h('span', { class: 'ctx-text', text: it.m.text + (it.m.current ? ' (mensaje actual)' : '') }),
          h('span', { class: 'ctx-tok', text: F.num(it.tokens, 0) }),
          h('span', { class: 'ctx-state', text: st })
        ]));
      });
      stats.innerHTML = '';
      [['Tokens enviados', F.num(p.used, 0)], ['Disponibles (ventana − 1000 de respuesta)', F.num(avail, 0)],
       ['¿Entra?', p.fits ? 'Sí' : 'No: error'], ['¿Puede responder sobre la cláusula 7.2?', !p.fits ? 'No llega a preguntar' : p.answer ? 'Sí' : 'No: ya no ve el contrato']].forEach(function (x) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
      note.textContent = STRATS[current].note;
    }
    win.addEventListener('change', run);
    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Cuando la conversación no entra' }), strat]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [h('div', { class: 'field' }, [h('label', { text: 'Ventana de contexto del modelo' }), win])]),
      barHost, note, stats, list
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Conversación de ejemplo de 14 100 tokens. Cada estrategia decide qué se envía en el turno actual; la última pregunta depende de un detalle del documento del segundo mensaje.' }));
    run();
  }

  /* ======================= Costo de una conversación ======================= */

  function initCost(host) {
    var uid = 0;
    function num(label, value, step, hint) {
      var id = 'cc' + (++uid);
      var i = h('input', { id: id, type: 'number', min: 0, step: step, value: value, inputmode: 'decimal' });
      var kids = [h('label', { for: id, text: label }), i];
      if (hint) kids.push(h('p', { class: 'field-hint', text: hint }));
      return { el: h('div', { class: 'field' }, kids), input: i };
    }
    var f = {
      N: num('Turnos de la conversación', 20, 1),
      S: num('Prompt de sistema (tokens)', 1500, 100),
      U: num('Mensaje del usuario por turno (tokens)', 150, 10),
      A: num('Respuesta por turno (tokens)', 350, 10),
      pin: num('Precio de entrada (USD por millón)', 2.5, 0.1, 'Precios ilustrativos: revisa los vigentes de tu proveedor.'),
      pout: num('Precio de salida (USD por millón)', 10, 0.5),
      disc: num('Descuento de los tokens en caché (%)', 90, 5, 'Entre 50 y 90 % según el proveedor y el modelo.')
    };
    function out(label, formula) {
      var v = h('output', { class: 'out-value' });
      return { el: h('div', { class: 'out-row' }, [h('span', { class: 'out-label', text: label }), v, h('span', { class: 'out-formula', text: formula })]), v: v };
    }
    var o = {
      last: out('Entrada del último turno', 'sistema + (N − 1) × (usuario + respuesta) + usuario'),
      inTot: out('Tokens de entrada en toda la conversación', 'N × (sistema + usuario) + (usuario + respuesta) × N(N − 1)/2'),
      content: out('Tokens de contenido nuevo', 'sistema + N × (usuario + respuesta)'),
      noCache: out('Costo sin prompt caching', 'entrada × precio de entrada + salida × precio de salida'),
      cache: out('Costo con prompt caching', 'el prefijo de cada turno ya estaba en caché: se cobra con descuento'),
      save: out('Ahorro', '1 − con caché ÷ sin caché')
    };
    function v(k) { var x = parseFloat(f[k].input.value); return isFinite(x) && x >= 0 ? x : 0; }
    function run() {
      var N = Math.max(1, Math.round(v('N'))), S = v('S'), U = v('U'), A = v('A'), T = U + A;
      var inTot = N * (S + U) + T * N * (N - 1) / 2, outTot = N * A;
      var uncached = N * U, cached = inTot - uncached, d = Math.min(100, v('disc')) / 100;
      var c0 = inTot * v('pin') / 1e6 + outTot * v('pout') / 1e6;
      var c1 = uncached * v('pin') / 1e6 + cached * v('pin') * (1 - d) / 1e6 + outTot * v('pout') / 1e6;
      o.last.v.textContent = F.num(S + (N - 1) * T + U, 0);
      o.inTot.v.textContent = F.num(inTot, 0);
      o.content.v.textContent = F.num(S + N * T, 0);
      o.noCache.v.textContent = F.num(c0, 3) + ' USD';
      o.cache.v.textContent = F.num(c1, 3) + ' USD';
      o.save.v.textContent = c0 > 0 ? F.pct(1 - c1 / c0, 0) : '—';
    }
    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    Object.keys(f).forEach(function (k) { inCol.appendChild(f[k].el); f[k].input.addEventListener('input', run); });
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Cuánto cuesta una conversación' })]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Supone que cada turno reenvía toda la conversación anterior, que el prompt de sistema ya está en caché desde el primer turno (lo comparten todos los usuarios) y que cada prefijo sigue en caché en el turno siguiente.' }));
    run();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="context"]').forEach(initContext);
    document.querySelectorAll('[data-calc="convcost"]').forEach(initCost);
  });
})();
