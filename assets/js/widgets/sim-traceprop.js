/* Un trace que se forma y se sigue (M11): <div data-sim="traceprop"></div>
   Tres escenas sobre SD.flowAnim (sim-dbflow.js), con un waterfall que crece paso a paso debajo de los servicios:
   cómo nacen los spans mientras el traceparent viaja, qué pasa cuando un servicio no lo propaga,
   y cómo se sigue después la request, de la alerta al exemplar, al trace y al log. */
(function () {
  'use strict';
  var SD = window.SD;

  function M(f, t, k, l) { return [f, t, k, l]; }
  function S(m, say, set, deco) { return { m: m, say: say, set: set || null, deco: deco || '' }; }
  function esc(t) { return SD.escape(String(t)); }
  function fmt(ms) { return (ms < 10 && ms % 1 ? ms.toFixed(1) : Math.round(ms)) + ' ms'; }

  var VBW = 734, VBH = 512, TOP = 266, WX = 262, WW = 400;

  /* Marco del panel de abajo, con su título. */
  function frame(title, right) {
    var s = '<rect class="dg-frame" x="4" y="' + TOP + '" width="' + (VBW - 8) + '" height="' + (VBH - TOP - 4) + '" rx="12"/>';
    s += '<text class="dg-group" x="18" y="' + (TOP + 22) + '">' + esc(title) + '</text>';
    if (right) s += '<text class="dg-tiny" x="' + (VBW - 18) + '" y="' + (TOP + 22) + '" text-anchor="end">' + esc(right) + '</text>';
    return s;
  }

  /* Waterfall. rows: { d: profundidad, l: etiqueta, s: inicio, e: fin, c: token de capa,
     st: 'o' abierto | 'c' cerrado | 'x' con error | 'g' hueco sin span | 'h' encabezado de otro trace, hl: resaltado } */
  function wf(title, now, total, rows, right) {
    function X(ms) { return WX + ms / total * WW; }
    var s = frame(title, right), y0 = TOP + 50, rh = 21, bottom = VBH - 14;
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
      var x = X(total * f);
      s += '<line class="sim-grid" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (y0 - 10) + '" y2="' + (bottom - 14) + '"/>';
      s += '<text class="sim-axis" x="' + x.toFixed(1) + '" y="' + (y0 - 14) + '" text-anchor="middle">' + Math.round(total * f) + ' ms</text>';
    });
    rows.forEach(function (r, i) {
      var y = y0 + i * rh;
      if (r.st === 'h') { s += '<text class="dg-group" x="18" y="' + (y + 14) + '">' + esc(r.l) + '</text>'; return; }
      var col = 'var(' + r.c + ')';
      s += '<text class="dg-tiny" x="' + (18 + r.d * 12) + '" y="' + (y + 14) + '"' + (r.hl ? ' style="font-weight: 700"' : '') + '>' + esc(r.l) + '</text>';
      var x = X(r.s), end = r.st === 'o' ? now : r.e, w = Math.max(3, X(end) - x), txt;
      if (r.st === 'o') {
        s += '<rect x="' + x.toFixed(1) + '" y="' + (y + 4) + '" width="' + w.toFixed(1) + '" height="13" rx="2" style="fill: ' + col + '; fill-opacity: 0.25; stroke: ' + col + '; stroke-width: 1.5; stroke-dasharray: 4 3"/>';
        txt = 'abierto…';
      } else if (r.st === 'g') {
        s += '<rect x="' + x.toFixed(1) + '" y="' + (y + 4) + '" width="' + w.toFixed(1) + '" height="13" rx="2" style="fill: none; stroke: var(--warn); stroke-width: 1.5; stroke-dasharray: 3 3"/>';
        txt = '¿' + fmt(r.e - r.s) + ' sin explicar?';
      } else {
        s += '<rect x="' + x.toFixed(1) + '" y="' + (y + 4) + '" width="' + w.toFixed(1) + '" height="13" rx="2" style="fill: ' + (r.st === 'x' ? 'var(--fail)' : col) + '"/>';
        txt = (r.st === 'x' ? '✗ ' : '') + fmt(r.e - r.s);
      }
      if (r.hl) s += '<rect x="' + (x - 3).toFixed(1) + '" y="' + (y + 1) + '" width="' + (w + 6).toFixed(1) + '" height="19" rx="4" style="fill: none; stroke: var(--link); stroke-width: 2"/>';
      s += '<text class="sim-val" x="' + (x + w + 6).toFixed(1) + '" y="' + (y + 15) + '"' + (r.st === 'g' ? ' style="fill: var(--warn)"' : '') + '>' + esc(txt) + '</text>';
    });
    if (now !== null) {
      var nx = X(now);
      s += '<line x1="' + nx.toFixed(1) + '" x2="' + nx.toFixed(1) + '" y1="' + (y0 - 8) + '" y2="' + (bottom - 14) + '" style="stroke: var(--link); stroke-width: 1.5"/>';
      s += '<text class="dg-tiny" x="' + Math.min(nx, VBW - 60).toFixed(1) + '" y="' + bottom + '" text-anchor="middle" style="fill: var(--link)">ahora: ' + fmt(now) + '</text>';
    }
    return s;
  }

  /* ======================= Escena 1: se forman los spans ======================= */

  var N1 = {
    CL: { x: 8, y: 70, w: 118, h: 90, name: 'App', sub: 'del usuario', c: '--l-client' },
    GW: { x: 160, y: 70, w: 134, h: 90, name: 'gateway', sub: 'el borde', c: '--l-edge' },
    CH: { x: 330, y: 70, w: 150, h: 90, name: 'chat-service', sub: 'con el SDK de OTel', c: '--l-service' },
    PG: { x: 560, y: 0, w: 166, h: 60, name: 'PostgreSQL', c: '--l-db' },
    MO: { x: 560, y: 72, w: 166, h: 60, name: 'moderation', c: '--l-service' },
    IN: { x: 560, y: 144, w: 166, h: 60, name: 'inference-router', c: '--l-gpu' },
    KF: { x: 330, y: 196, w: 150, h: 56, name: 'Kafka', c: '--l-queue' },
    ME: { x: 160, y: 196, w: 134, h: 56, name: 'metering', c: '--l-service' }
  };
  var E1 = [['CL', 'GW'], ['GW', 'CH'], ['CH', 'PG'], ['CH', 'MO'], ['CH', 'IN'], ['CH', 'KF'], ['KF', 'ME']];

  var SP = {
    a: { d: 0, l: 'gateway · POST /messages', s: 0, e: 1212, c: '--l-edge' },
    d: { d: 1, l: 'chat-service · crear mensaje', s: 4, e: 1210, c: '--l-service' },
    e: { d: 2, l: 'postgres · INSERT', s: 5, e: 8, c: '--l-db' },
    g: { d: 2, l: 'moderation · moderar', s: 12, e: 40, c: '--l-service' },
    i: { d: 2, l: 'inference · generar', s: 41, e: 1203, c: '--l-gpu' },
    k: { d: 2, l: 'postgres · UPDATE', s: 1203, e: 1207, c: '--l-db' },
    l: { d: 2, l: 'kafka · publicar uso', s: 1207, e: 1208.5, c: '--l-queue' },
    m: { d: 3, l: 'metering · consumir uso', s: 1340, e: 1346, c: '--l-service' }
  };
  var ORDER = ['a', 'd', 'e', 'g', 'i', 'k', 'l', 'm'];
  /* st: { id: 'o' | 'c' }; los spans que no aparecen todavía no existen. */
  function W1(now, st, hl) {
    var rows = ORDER.filter(function (k) { return st[k]; }).map(function (k) {
      var r = SP[k]; return { d: r.d, l: r.l, s: r.s, e: r.e, c: r.c, st: st[k], hl: k === hl };
    });
    return wf('Trace 4bf92f35…0e4736', now, 1400, rows, rows.length + (rows.length === 1 ? ' span' : ' spans'));
  }
  var C = 'c';

  var FORM = {
    id: 'formar', name: 'Se forman los spans', nodes: N1, edges: E1,
    init: {},
    def: 'Un mensaje de chat entra por el gateway y toca cinco servicios. Mira el waterfall de abajo: cada span nace cuando empieza su operación y se cierra cuando termina.',
    rows: [['La clave', 'Nadie arma el trace en un lugar central. Cada servicio crea sus spans con el mismo <code>trace_id</code>, que recibió en el header <code>traceparent</code>, y los exporta por su cuenta; el backend los junta después por ese id.']],
    steps: [
      S([M('CL', 'GW', 'req', 'POST /messages')], 'La app manda el mensaje <b>sin</b> <code>traceparent</code>. El gateway no recibe contexto, así que <b>empieza un trace nuevo</b>: genera un <code>trace_id</code> aleatorio de 16 bytes (<code>4bf92f35…0e4736</code>) y abre el <b>span raíz</b>, el que no tiene padre. Desde ahora su reloj corre.',
        { GW: { st: 'on', v: ['trace 4bf9…4736', 'span a1, raíz'] } }, W1(0, { a: 'o' }, 'a')),
      S([M('GW', 'CH', 'req', 'traceparent …-a1-01')], 'El gateway llama a chat-service y agrega el header <code>traceparent: 00-4bf92f35…0e4736-<b>a1</b>-01</code>: el mismo trace, y como padre su propio span. chat-service lo lee y abre su span <b>d4</b>, <b>hijo</b> de a1. En la realidad los ids de span tienen 8 bytes (16 caracteres hex); aquí los acortamos.',
        { GW: { st: '' }, CH: { st: 'on', v: ['span d4', 'padre: a1'] } }, W1(4, { a: 'o', d: 'o' }, 'd')),
      S([M('CH', 'PG', 'req', 'INSERT')], 'chat-service guarda el mensaje. PostgreSQL no sabe nada de traces: el span <b>e7</b> lo crea el driver instrumentado <b>dentro de chat-service</b>, como span de cliente, y mide cuánto tardó la base en responder.',
        { CH: { st: 'on', v: ['span d4', 'abre e7 (cliente)'] }, PG: { st: 'on', v: ['no ve el trace'] } }, W1(5, { a: 'o', d: 'o', e: 'o' }, 'e')),
      S([M('PG', 'CH', 'res', 'OK · 3 ms')], 'La base responde y el span e7 se cierra con su duración y sus atributos: <code>db.system.name = "postgresql"</code>, la operación y las filas afectadas. Un span cerrado ya no cambia.',
        { PG: { st: '', v: [] }, CH: { v: ['span d4', 'e7 cerrado: 3 ms'] } }, W1(8, { a: 'o', d: 'o', e: C }, 'e')),
      S([M('CH', 'MO', 'req', 'traceparent …-d4-01')], 'Ahora chat-service llama a moderation, y en <b>su</b> llamada el padre ya no es a1 sino <b>d4</b>: <code>traceparent: 00-4bf92f35…0e4736-<b>d4</b>-01</code>. Así se forma el árbol: cada salto propaga el mismo trace y cambia el padre.',
        { CH: { v: ['span d4', 'propaga d4'] }, MO: { st: 'on', v: ['span g2, padre d4'] } }, W1(12, { a: 'o', d: 'o', e: C, g: 'o' }, 'g')),
      S([M('MO', 'CH', 'res', '200 · 28 ms')], 'moderation responde que el texto está bien y cierra su span g2 con <code>app.moderation.flagged = false</code>. Ese span lo exporta moderation, desde su propio proceso, al Collector.',
        { MO: { st: 'ok', v: ['g2 cerrado: 28 ms'] }, CH: { v: ['span d4', 'g2 respondió'] } }, W1(40, { a: 'o', d: 'o', e: C, g: C }, 'g')),
      S([M('CH', 'IN', 'req', 'traceparent …-d4-01')], 'Pide la respuesta al modelo. El router de inferencia abre el span i9, también hijo de d4. Por gRPC, el <code>traceparent</code> viaja en la metadata de la llamada en lugar de un header HTTP.',
        { MO: { st: '', v: [] }, IN: { st: 'on', v: ['span i9, padre d4'] } }, W1(41, { a: 'o', d: 'o', e: C, g: C, i: 'o' }, 'i')),
      S([M('IN', 'CH', 'res', 'stream · 1162 ms')], 'La generación termina. Mira las proporciones: <b>i9 ocupa el 96&#8239;%</b> del trace. Si alguien quisiera acelerar esta request optimizando la base, el waterfall le diría que no vale la pena.',
        { IN: { st: 'ok', v: ['i9 cerrado: 1162 ms'] } }, W1(1203, { a: 'o', d: 'o', e: C, g: C, i: C }, 'i')),
      S([M('CH', 'PG', 'write', 'UPDATE')], 'Marca el mensaje como completo. Otro span de cliente, k3, de 4 ms.',
        { IN: { st: '', v: [] }, PG: { st: 'ok', v: ['UPDATE: 4 ms'] } }, W1(1207, { a: 'o', d: 'o', e: C, g: C, i: C, k: C }, 'k')),
      S([M('CH', 'KF', 'async', 'uso + traceparent')], 'Publica el evento de uso para cobrar los tokens (M21). El <code>traceparent</code> viaja <b>dentro del mensaje</b>, en los headers del registro de Kafka. Sin eso, el trabajo asíncrono quedaría desconectado de la request que lo causó.',
        { PG: { st: '', v: [] }, KF: { st: 'on', v: ['lleva traceparent'] } }, W1(1208.5, { a: 'o', d: 'o', e: C, g: C, i: C, k: C, l: C }, 'l')),
      S([M('CH', 'GW', 'res', '201 · 1206 ms')], 'chat-service responde y cierra d4. Su duración (1206 ms) incluye las de sus hijos, más el tiempo de su propio código entre llamada y llamada.',
        { CH: { st: 'ok', v: ['d4 cerrado: 1206 ms'] } }, W1(1210, { a: 'o', d: C, e: C, g: C, i: C, k: C, l: C }, 'd')),
      S([M('GW', 'CL', 'res', '200 · 1212 ms')], 'El gateway cierra el span raíz. Para el usuario, la request terminó: 1212 ms. Para el trace, todavía no.',
        { CH: { st: '', v: [] }, GW: { st: 'ok', v: ['a1 cerrado: 1212 ms'] } }, W1(1212, { a: C, d: C, e: C, g: C, i: C, k: C, l: C }, 'a')),
      S([M('KF', 'ME', 'async', 'evento + traceparent')], 'Unos 130 ms después, metering consume el evento. Lee el <code>traceparent</code> del mensaje y abre el span m8 en el <b>mismo trace</b>, aunque la request ya respondió. Por eso el span queda a la derecha del final del raíz.',
        { GW: { st: '', v: [] }, KF: { st: '', v: [] }, ME: { st: 'ok', v: ['span m8: 6 ms'] } }, W1(1346, { a: C, d: C, e: C, g: C, i: C, k: C, l: C, m: C }, 'm')),
      S([], 'El trace completo: <b>8 spans</b> de <b>5 procesos</b>, unidos solo por el <code>trace_id</code> y por el padre de cada uno. Ningún servicio vio el árbol entero; lo armó el backend al recibir los spans. Si un solo salto no hubiera propagado el header, el árbol estaría partido: es la escena siguiente.',
        { ME: { st: '', v: [] } }, W1(null, { a: C, d: C, e: C, g: C, i: C, k: C, l: C, m: C }))
    ]
  };

  /* ======================= Escena 2: un servicio no propaga ======================= */

  var N2 = { CL: N1.CL, GW: N1.GW, CH: N1.CH, MO: N1.MO, IN: N1.IN };
  var E2 = [['CL', 'GW'], ['GW', 'CH'], ['CH', 'MO'], ['CH', 'IN']];
  function W2(now, st) {
    var A = [{ st: 'h', l: 'Trace A · 4bf92f35…0e4736' }];
    A.push({ d: 0, l: 'gateway · POST /messages', s: 0, e: 1212, c: '--l-edge', st: st.a });
    if (st.d) A.push({ d: 1, l: 'chat-service · crear mensaje', s: 4, e: 1210, c: '--l-service', st: st.d });
    if (st.gap) A.push({ d: 2, l: '(nada)', s: 12, e: 40, c: '--l-service', st: 'g' });
    if (st.i) A.push({ d: 2, l: 'inference · generar', s: 41, e: 1203, c: '--l-gpu', st: st.i });
    if (st.b) {
      A.push({ st: 'h', l: 'Trace B · 7c1e09d2…a3b511 (huérfano)' });
      A.push({ d: 0, l: 'moderation · moderar', s: 12, e: 40, c: '--l-service', st: st.b, hl: true });
    }
    return wf(st.b ? 'Dos traces en lugar de uno' : 'Trace 4bf92f35…0e4736', now, 1400, A);
  }

  var BROKEN = {
    id: 'roto', name: 'Un servicio no propaga', nodes: N2, edges: E2,
    def: 'La misma request, pero chat-service llama a moderation con un cliente HTTP que alguien escribió a mano, sin instrumentar.',
    rows: [['La clave', 'Un solo salto sin <code>traceparent</code> parte el trace en dos. Ninguno de los dos está mal por separado; lo que falta es la relación.']],
    steps: [
      S([M('CL', 'GW', 'req', 'POST /messages')], 'Igual que antes: el gateway empieza el trace A y abre el span raíz.',
        { GW: { st: 'on', v: ['trace A', 'span a1, raíz'] } }, W2(0, { a: 'o' })),
      S([M('GW', 'CH', 'req', 'traceparent …-a1-01')], 'chat-service recibe el contexto y abre d4, hijo de a1. Hasta aquí, todo bien.',
        { GW: { st: '' }, CH: { st: 'on', v: ['span d4', 'padre: a1'] } }, W2(4, { a: 'o', d: 'o' })),
      S([M('CH', 'MO', 'fail', 'POST sin traceparent')], 'chat-service llama a moderation con un cliente HTTP sin instrumentar: <b>no agrega el header</b>. moderation no recibe contexto y hace lo mismo que el gateway al principio: <b>empieza un trace nuevo</b>, el B, con su propio <code>trace_id</code>.',
        { CH: { st: 'warn', v: ['span d4', 'no propagó'] }, MO: { st: 'warn', v: ['trace B, raíz'] } }, W2(12, { a: 'o', d: 'o', b: 'o' })),
      S([M('MO', 'CH', 'res', '200 · 28 ms')], 'moderation responde y cierra su span… en el trace B. En el trace A queda un <b>hueco</b>: 28 ms en los que chat-service esperó algo y el waterfall no dice qué.',
        { MO: { st: '', v: ['trace B, raíz'] }, CH: { st: 'on', v: ['span d4', 'esperó 28 ms'] } }, W2(40, { a: 'o', d: 'o', gap: true, b: C })),
      S([M('CH', 'IN', 'req', 'traceparent …-d4-01')], 'La llamada al modelo usa el cliente gRPC instrumentado, así que el contexto vuelve a propagarse y el span i9 cae en el trace A.',
        { IN: { st: 'on', v: ['span i9, padre d4'] } }, W2(41, { a: 'o', d: 'o', gap: true, i: 'o', b: C })),
      S([M('GW', 'CL', 'res', '200 · 1212 ms')], 'La request termina. El día que moderation tarde 500 ms, el trace A mostrará un hueco de medio segundo sin culpable, y el trace B, una request a moderation sin cliente conocido. Nadie los va a relacionar.',
        { IN: { st: '', v: [] }, CH: { st: '', v: [] }, GW: { st: 'ok', v: ['a1 cerrado'] } }, W2(1212, { a: C, d: C, gap: true, i: C, b: C })),
      S([], 'Cómo se detecta: muchos traces <b>raíz</b> que empiezan en un servicio interno (moderation no recibe tráfico de internet: si es raíz, alguien no propagó) y huecos entre hijos. Cómo se arregla: usar los clientes instrumentados por OpenTelemetry, o inyectar el contexto a mano con su API de <code>propagator</code>. Lo mismo vale para colas, cron jobs y llamadas a terceros.',
        { GW: { st: '', v: [] }, MO: { st: 'warn', v: ['raíz sospechosa'] } }, W2(null, { a: C, d: C, gap: true, i: C, b: C }))
    ]
  };

  /* ======================= Escena 3: seguir la request ======================= */

  var N3 = {
    ON: { x: 8, y: 30, w: 150, h: 90, name: 'Guardia', sub: 'quien recibe la alerta', c: '--l-client' },
    GR: { x: 262, y: 30, w: 170, h: 90, name: 'Grafana', sub: 'una sola pantalla', c: '--l-edge' },
    PR: { x: 556, y: 0, w: 170, h: 70, name: 'Prometheus', sub: 'métricas y exemplars', c: '--l-db' },
    TE: { x: 556, y: 92, w: 170, h: 70, name: 'Tempo', sub: 'traces', c: '--l-db' },
    LO: { x: 556, y: 184, w: 170, h: 70, name: 'Loki', sub: 'logs', c: '--l-db' }
  };
  var E3 = [['PR', 'ON'], ['ON', 'GR'], ['GR', 'PR'], ['GR', 'TE'], ['GR', 'LO']];

  function chartDeco() {
    var s = frame('Panel: p99 de POST /messages, últimos 60 min', 'cada punto es un exemplar');
    var x0 = 60, x1 = 700, y0 = TOP + 50, y1 = VBH - 34;
    var pts = [0.42, 0.44, 0.41, 0.43, 0.45, 0.44, 0.46, 0.43, 0.45, 0.44, 0.47, 0.46, 1.62, 1.71, 1.68, 1.74, 1.7, 1.66];
    function X(i) { return x0 + i / (pts.length - 1) * (x1 - x0); }
    function Y(v) { return y1 - v / 2 * (y1 - y0); }
    [0, 0.5, 1, 1.5, 2].forEach(function (v) {
      s += '<line class="sim-grid" x1="' + x0 + '" x2="' + x1 + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/>';
      s += '<text class="sim-axis" x="' + (x0 - 8) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + ' s</text>';
    });
    s += '<path d="M' + pts.map(function (v, i) { return X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' L') + '" style="fill: none; stroke: var(--l-service); stroke-width: 2"/>';
    pts.forEach(function (v, i) {
      if (i % 2) return;
      s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v + 0.06).toFixed(1) + '" r="4" style="fill: var(--l-queue)"/>';
    });
    var hx = X(14), hy = Y(1.68 + 0.06);
    s += '<circle cx="' + hx.toFixed(1) + '" cy="' + hy.toFixed(1) + '" r="8" style="fill: none; stroke: var(--link); stroke-width: 2"/>';
    s += '<path class="dg-feedback" d="M' + (hx - 10).toFixed(1) + ' ' + hy.toFixed(1) + ' H' + (hx - 70).toFixed(1) + '"/>';
    s += '<text class="dg-tiny" x="' + (hx - 76).toFixed(1) + '" y="' + (hy - 6).toFixed(1) + '" text-anchor="end">exemplar: trace_id 4bf92f35…0e4736</text>';
    s += '<text class="dg-tiny" x="' + (hx - 76).toFixed(1) + '" y="' + (hy + 10).toFixed(1) + '" text-anchor="end">latencia de esa request: 1.74 s</text>';
    s += '<text class="dg-tiny" x="' + X(12).toFixed(1) + '" y="' + (y1 + 18) + '" text-anchor="middle" style="fill: var(--fail)">14:02, empieza el problema</text>';
    return s;
  }

  function W3(hl) {
    var rows = [
      { d: 0, l: 'gateway · POST /messages', s: 0, e: 1745, c: '--l-edge', st: C },
      { d: 1, l: 'chat-service · crear mensaje', s: 4, e: 1744, c: '--l-service', st: C },
      { d: 2, l: 'postgres · INSERT', s: 5, e: 8, c: '--l-db', st: C },
      { d: 2, l: 'moderation · intento 1', s: 9, e: 509, c: '--l-service', st: 'x', hl: hl },
      { d: 2, l: 'moderation · intento 2', s: 540, e: 570, c: '--l-service', st: C },
      { d: 2, l: 'inference · generar', s: 572, e: 1740, c: '--l-gpu', st: C }
    ];
    return wf('Trace 4bf92f35…0e4736', null, 1800, rows, '6 spans, 1 con error');
  }

  function logDeco() {
    var s = frame('Logs con trace_id = 4bf92f35…0e4736', 'Loki devolvió 2 líneas');
    var lines = [
      ['14:07:31.342', 'moderation', 'pool.acquire_wait', 'wait_ms=498 pool_size=10 in_use=10'],
      ['14:07:31.842', 'chat-service', 'moderation.call_failed', 'error.type=timeout timeout_ms=500 attempt=1']
    ];
    s += '<text class="dg-tiny" x="18" y="' + (TOP + 52) + '" style="font-family: var(--f-mono)">{service=~"chat-service|moderation"} | json | trace_id="4bf92f35…"</text>';
    lines.forEach(function (l, i) {
      var y = TOP + 92 + i * 52;
      s += '<rect class="dg-box" x="18" y="' + (y - 22) + '" width="' + (VBW - 44) + '" height="44" rx="8"/>';
      s += '<text class="dg-tiny" x="30" y="' + (y - 3) + '" style="font-family: var(--f-mono)">' + esc(l[0] + '  ' + l[1] + '  ' + l[2]) + '</text>';
      s += '<text class="dg-tiny" x="30" y="' + (y + 14) + '" style="font-family: var(--f-mono)' + (i === 0 ? '; fill: var(--fail)' : '') + '">' + esc(l[3]) + '</text>';
    });
    s += '<text class="dg-small" x="18" y="' + (VBH - 18) + '">El pool de moderation tenía 10 conexiones y las 10 estaban ocupadas: la request esperó 498 ms por una.</text>';
    return s;
  }

  var FOLLOW = {
    id: 'seguir', name: 'Seguir la request', nodes: N3, edges: E3,
    def: 'Es martes, 14:09. Nadie está mirando el trace de la escena 1: hay que encontrarlo. Así se pasa de una alerta a la línea de log exacta con los identificadores compartidos (figura 11.1).',
    rows: [['La clave', 'Cada salto usa un id que la señal anterior ya trae: el exemplar lleva el <code>trace_id</code>, y cada span lleva el <code>trace_id</code> y su <code>span_id</code>, que también están en los logs. Sin esos ids, cada salto es una búsqueda por hora entre millones de datos.']],
    steps: [
      S([M('PR', 'ON', 'async', 'alerta: burn rate 15×')], 'Prometheus evalúa la regla de burn rate de 11.6 y la alerta llega a quien está de guardia: el 1.5&#8239;% de los mensajes falla y el presupuesto del mes dura dos días a este ritmo. La métrica dice que pasa algo; todavía no dice por qué.',
        { PR: { st: 'warn', v: ['burn rate 15×'] }, ON: { st: 'on', v: ['alerta + runbook'] } }, frame('Todavía no hay trace', 'la investigación empieza con una métrica')),
      S([M('ON', 'GR', 'req', 'abre el dashboard')], 'Abre el dashboard RED del servicio, enlazado desde la alerta. Errores y p99 por ruta: el problema está en <code>POST /messages</code> y empezó a las 14:02.',
        { PR: { st: '', v: [] }, GR: { st: 'on', v: ['dashboard RED'] } }, frame('Todavía no hay trace', 'la investigación empieza con una métrica')),
      S([M('GR', 'PR', 'req', 'p99 + exemplars')], 'Grafana le pide a Prometheus la serie del p99 <b>y sus exemplars</b>: junto a cada bucket del histograma, Prometheus guardó el <code>trace_id</code> de alguna request real que cayó ahí.',
        { PR: { st: 'on', v: ['serie + exemplars'] } }, chartDeco()),
      S([M('TE', 'GR', 'res', 'waterfall')], 'Un clic en un punto del pico abre ese trace en Tempo. Ya no es "el p99 subió": es una request concreta de 1.74 s, con su árbol de spans.',
        { PR: { st: '', v: [] }, TE: { st: 'on', v: ['trace 4bf9…4736'] }, GR: { v: ['trace abierto'] } }, W3(false)),
      S([], 'El waterfall muestra la causa a simple vista: el primer intento a moderation tardó <b>500 ms y falló</b> por timeout, y el segundo, 30 ms. El cuello de botella no es el modelo esta vez.',
        { GR: { st: 'warn', v: ['moderation: timeout'] } }, W3(true)),
      S([M('GR', 'LO', 'req', 'logs del span')], 'Desde el span con error, "logs de este span" arma la consulta a Loki con el <code>trace_id</code>: dos líneas de entre millones.',
        { TE: { st: '', v: [] }, LO: { st: 'on', v: ['filtra por trace_id'] } }, logDeco()),
      S([], 'La causa exacta: el pool de conexiones de moderation tenía 10 y estaban todas ocupadas. Es el postmortem de 11.8. Primero se mitiga (rollback de moderation) y después se escribe por qué el sistema lo permitió.',
        { LO: { st: '', v: [] }, ON: { st: 'ok', v: ['rollback hecho'] }, GR: { st: 'ok', v: ['causa encontrada'] } }, logDeco())
    ]
  };

  var CFG = {
    title: 'Un trace que se forma y se sigue',
    aria: 'Servicios de la API de chat arriba y un waterfall abajo que crece con cada span; una segunda escena muestra un trace partido y una tercera, cómo se pasa de una alerta al exemplar, al trace y al log',
    vbw: VBW, vbh: VBH,
    foot: 'Colores de los mensajes: azul, una petición; gris, una respuesta; verde, éxito; rojo, una llamada que pierde el contexto; violeta punteado, un mensaje asíncrono. En el waterfall, un span abierto tiene borde punteado y uno cerrado está lleno. Los ids están acortados. El botón alterna lento, rápido y pausa; las flechas avanzan de a un paso.',
    scenes: [FORM, BROKEN, FOLLOW]
  };

  SD.ready(function () {
    if (!SD.flowAnim) return;
    document.querySelectorAll('[data-sim="traceprop"]').forEach(function (el) { SD.flowAnim(el, CFG); });
  });
})();
