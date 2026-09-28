/* Widgets de observabilidad:
   <div data-sim="trace">     waterfall de un trace distribuido con tres escenarios y detalle por span
   <div data-sim="burnrate">  alertas por burn rate sobre un SLO (reglas de ventanas múltiples) */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  var LAYER = { edge: '--l-edge', service: '--l-service', cache: '--l-cache', db: '--l-db', gpu: '--l-gpu', queue: '--l-queue', external: '--l-external' };

  /* span: [id, padre, servicio, capa, operación, inicio ms, duración ms, atributos, error] */
  var SCEN = {
    normal: {
      name: 'Request normal',
      note: 'El 95 % del tiempo es la generación del modelo: optimizar la base de datos no movería la experiencia del usuario. El trace dice dónde invertir.',
      spans: [
        ['a', null, 'gateway', 'edge', 'POST /v1/conversations/{id}/messages', 0, 1212, { 'http.response.status_code': 200, 'app.user.plan': 'pro', 'app.tenant.id': 'org_77' }],
        ['b', 'a', 'gateway', 'edge', 'verificar JWT', 1, 0.4, { 'app.auth.kid': 'k-2026-09' }],
        ['c', 'a', 'redis', 'cache', 'INCRBY cuota:org_77', 2, 0.6, { 'db.system': 'redis', 'server.address': 'redis-quota-1' }],
        ['d', 'a', 'chat-service', 'service', 'crear mensaje', 4, 1206, { 'app.conversation.id': 'conv_42' }],
        ['e', 'd', 'postgres', 'db', 'INSERT messages', 5, 3, { 'db.query.text': 'INSERT INTO messages …', 'app.db.rows_affected': 1 }],
        ['f', 'd', 'postgres', 'db', 'SELECT historial', 8, 4, { 'db.query.text': 'SELECT … WHERE conversation_id = $1 ORDER BY created_at LIMIT 40', 'app.db.rows': 40 }],
        ['g', 'd', 'moderation', 'service', 'moderar prompt', 12, 28, { 'app.moderation.flagged': false }],
        ['i', 'd', 'inference-router', 'gpu', 'generar respuesta', 41, 1162, { 'gen_ai.request.model': 'chat-large', 'gen_ai.usage.input_tokens': 1840, 'gen_ai.usage.output_tokens': 312, 'app.ttft_ms': 348 }],
        ['j', 'i', 'gpu-node-17', 'gpu', 'prefill + decode', 44, 1156, { 'app.gpu.node': 'node-17', 'app.batch.size': 48 }],
        ['k', 'd', 'postgres', 'db', 'UPDATE status = completed', 1204, 4, { 'app.db.rows_affected': 1 }],
        ['l', 'd', 'kafka', 'queue', 'publicar uso', 1208, 1.5, { 'messaging.destination.name': 'usage-events' }]
      ]
    },
    n1: {
      name: 'Consulta N+1',
      note: 'Cuarenta consultas iguales, una detrás de otra: la escalera en el waterfall es la firma visual del N+1. Una sola consulta con JOIN o un IN (…) la reduce a 4 ms.',
      spans: (function () {
        var s = [
          ['a', null, 'gateway', 'edge', 'GET /v1/conversations/{id}', 0, 136, { 'http.response.status_code': 200 }],
          ['d', 'a', 'chat-service', 'service', 'cargar conversación', 2, 132, {}],
          ['e', 'd', 'postgres', 'db', 'SELECT messages', 3, 4, { 'app.db.rows': 40 }]
        ];
        for (var i = 0; i < 40; i++) s.push(['n' + i, 'd', 'postgres', 'db', 'SELECT attachments WHERE message_id = $1', 8 + i * 3.1, 2.8, { 'db.query.text': 'SELECT … FROM attachments WHERE message_id = $1', 'app.iteracion': i + 1 }]);
        return s;
      })()
    },
    retry: {
      name: 'Timeout y reintento',
      note: 'La moderación no respondió en 500 ms, el cliente reintentó y la segunda vez tardó 30 ms. Sin el trace, en las métricas solo se vería "p99 alto" sin saber por qué.',
      spans: [
        ['a', null, 'gateway', 'edge', 'POST /v1/conversations/{id}/messages', 0, 1745, { 'http.response.status_code': 200 }],
        ['d', 'a', 'chat-service', 'service', 'crear mensaje', 4, 1740, {}],
        ['e', 'd', 'postgres', 'db', 'INSERT messages', 5, 3, {}],
        ['g1', 'd', 'moderation', 'service', 'moderar prompt (intento 1)', 9, 500, { 'error.type': 'timeout', 'app.retry.attempt': 1 }, true],
        ['g2', 'd', 'moderation', 'service', 'moderar prompt (intento 2)', 540, 30, { 'app.retry.attempt': 2, 'app.retry.backoff_ms': 31 }],
        ['i', 'd', 'inference-router', 'gpu', 'generar respuesta', 572, 1168, { 'gen_ai.usage.output_tokens': 312 }]
      ]
    }
  };

  function initTrace(host) {
    var sel = h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Escenario' });
    var svgHost = h('div', { class: 'sim-scroll' });
    var detail = h('div', { class: 'trace-detail', 'aria-live': 'polite' });
    var note = h('p', { class: 'sim-note' });
    var current = 'normal', selected = null;

    Object.keys(SCEN).forEach(function (k) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': k === current ? 'true' : 'false', text: SCEN[k].name });
      b.addEventListener('click', function () {
        current = k; selected = null;
        sel.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        render();
      });
      sel.appendChild(b);
    });

    function render() {
      var sc = SCEN[current], spans = sc.spans;
      var depth = {};
      spans.forEach(function (s) { depth[s[0]] = s[1] ? depth[s[1]] + 1 : 0; });
      var total = spans[0][6];
      var rows = spans.length, rowH = rows > 20 ? 14 : 26, W = 740, lw = 270, top = 26, pw = W - lw - 62;   /* 62 px a la derecha para la duración */
      var H = top + rows * rowH + 10;
      function X(ms) { return lw + ms / total * pw; }
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Waterfall del trace: ' + sc.name + '">';
      [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
        s += '<line class="sim-grid" x1="' + X(total * f) + '" x2="' + X(total * f) + '" y1="' + (top - 6) + '" y2="' + (H - 6) + '"/>';
        s += '<text class="sim-axis" x="' + X(total * f) + '" y="14" text-anchor="' + (f === 1 ? 'end' : f === 0 ? 'start' : 'middle') + '">' + F.num(total * f, 0) + ' ms</text>';
      });
      spans.forEach(function (sp, i) {
        var y = top + i * rowH, bw = Math.max(2, sp[6] / total * pw);
        var col = 'var(' + LAYER[sp[3]] + ')';
        var label = sp[2] + ': ' + sp[4];
        if (label.length > 42) label = label.slice(0, 41) + '…';
        s += '<g class="trace-row' + (selected === sp[0] ? ' is-sel' : '') + '" data-id="' + sp[0] + '" tabindex="0" role="button" aria-label="' + SD.escape(sp[2] + ' ' + sp[4] + ', ' + F.num(sp[6], 1) + ' ms') + '">';
        s += '<rect class="trace-hit" x="0" y="' + y + '" width="' + W + '" height="' + rowH + '"/>';
        if (rowH >= 20) s += '<text class="sim-label" x="' + (4 + depth[sp[0]] * 12) + '" y="' + (y + rowH * 0.65) + '">' + SD.escape(label) + '</text>';
        else if (i % 5 === 0 || i < 3) s += '<text class="sim-axis" x="' + (4 + depth[sp[0]] * 12) + '" y="' + (y + rowH * 0.8) + '">' + SD.escape(label) + '</text>';
        s += '<rect x="' + X(sp[5]).toFixed(1) + '" y="' + (y + rowH * 0.2) + '" width="' + bw.toFixed(1) + '" height="' + (rowH * 0.6) + '" rx="2" fill="' + (sp[8] ? 'var(--fail)' : col) + '"' + (sp[8] ? ' opacity="0.85"' : '') + '/>';
        if (rowH >= 20) s += '<text class="sim-val" x="' + (X(sp[5]) + bw + 5).toFixed(1) + '" y="' + (y + rowH * 0.65) + '">' + F.num(sp[6], sp[6] < 10 ? 1 : 0) + ' ms</text>';
        s += '</g>';
      });
      s += '</svg>';
      svgHost.innerHTML = s;
      svgHost.querySelectorAll('.trace-row').forEach(function (g) {
        function pick() { selected = g.getAttribute('data-id'); render(); }
        g.addEventListener('click', pick);
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      });
      note.textContent = sc.note;
      detail.innerHTML = '';
      var sp = spans.filter(function (x) { return x[0] === selected; })[0] || spans[0];
      var attrs = Object.keys(sp[7]).map(function (k) { return k + ' = ' + JSON.stringify(sp[7][k]); }).join('\n');
      detail.appendChild(h('p', { class: 'iso-title', text: sp[2] + ': ' + sp[4] }));
      detail.appendChild(h('p', { class: 'sign-step-body', text: F.num(sp[6], sp[6] < 10 ? 1 : 0) + ' ms, ' + F.pct(sp[6] / total, 1) + ' del total. Empieza a los ' + F.num(sp[5], 1) + ' ms.' + (sp[8] ? ' Terminó con error.' : '') }));
      detail.appendChild(h('pre', {}, [h('code', { text: 'trace_id = 4bf92f3577b34da6a3ce929d0e0e4736\nspan_id  = ' + (sp[0] + '0000000000000000').slice(0, 16) + '\n' + (attrs || '(sin atributos)') })]));
    }

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Waterfall de un trace distribuido' }), sel]));
    host.appendChild(h('div', { class: 'sim-body' }, [svgHost, note, h('p', { class: 'raft-log-title', text: 'Span seleccionado (haz clic en una fila)' }), detail]));
    render();
  }

  /* ======================= Burn rate ======================= */

  function initBurn(host) {
    var slo = h('input', { type: 'number', min: 90, max: 99.999, step: 0.01, value: 99.9, 'aria-label': 'SLO en porcentaje' });
    var days = h('input', { type: 'number', min: 1, max: 90, step: 1, value: 30, 'aria-label': 'Ventana del SLO en días' });
    var err = h('input', { type: 'number', min: 0, max: 100, step: 0.01, value: 0.5, 'aria-label': 'Tasa de errores actual en porcentaje' });
    var out = h('div', { 'aria-live': 'polite' });

    var RULES = [
      { budget: 0.02, long: '1 h', short: '5 min', hours: 1, action: 'Despertar a alguien' },
      { budget: 0.05, long: '6 h', short: '30 min', hours: 6, action: 'Despertar a alguien' },
      { budget: 0.10, long: '3 días', short: '6 h', hours: 72, action: 'Ticket para horario laboral' }
    ];

    function run() {
      var S = Math.min(99.999, Math.max(90, parseFloat(slo.value) || 99.9)) / 100;
      var D = Math.max(1, parseFloat(days.value) || 30);
      var E = Math.max(0, parseFloat(err.value) || 0) / 100;
      var budget = 1 - S;
      out.innerHTML = '';
      var tb = h('tbody');
      RULES.forEach(function (r) {
        var burn = r.budget * D * 24 / r.hours;
        tb.appendChild(h('tr', {}, [
          h('td', { text: F.pct(r.budget, 0) + ' del presupuesto en ' + r.long }),
          h('td', { class: 'r', text: F.num(burn, 1) + '×' }),
          h('td', { class: 'r', text: F.pct(burn * budget, 2) }),
          h('td', { text: r.long + ' y ' + r.short }),
          h('td', { text: r.action })
        ]));
      });
      out.appendChild(h('div', { class: 'table-wrap' }, [h('table', { class: 't' }, [
        h('thead', {}, [h('tr', {}, [h('th', { text: 'Regla' }), h('th', { class: 'r', text: 'Burn rate' }), h('th', { class: 'r', text: 'Tasa de errores que la dispara' }), h('th', { text: 'Ventanas (larga y corta)' }), h('th', { text: 'Acción' })])]),
        tb
      ])]));
      var burnNow = budget > 0 ? E / budget : 0;
      var exhaust = burnNow > 0 ? D / burnNow : Infinity;
      var fired = RULES.filter(function (r) { return burnNow >= r.budget * D * 24 / r.hours; });
      var stats = h('div', { class: 'sim-stats' });
      [['Presupuesto de errores', F.pct(budget, 3)], ['Burn rate actual', F.num(burnNow, 1) + '×'], ['Se agota el presupuesto en', isFinite(exhaust) ? F.duration(exhaust * 86400) : 'nunca'], ['Qué se dispara ahora', fired.length ? fired[0].action : 'Ninguna alerta']].forEach(function (x) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
      out.appendChild(stats);
    }

    [slo, days, err].forEach(function (x) { x.addEventListener('input', run); });
    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Alertas por burn rate sobre un SLO' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [
        h('div', { class: 'field' }, [h('label', { text: 'SLO (%)' }), slo]),
        h('div', { class: 'field' }, [h('label', { text: 'Ventana (días)' }), days]),
        h('div', { class: 'field' }, [h('label', { text: 'Tasa de errores actual (%)' }), err])
      ]),
      out
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Reglas de ventanas múltiples del SRE Workbook de Google: una alerta se dispara solo si la ventana larga y la corta superan el umbral a la vez, así es sensible a lo grave y se apaga rápido cuando se arregla.' }));
    run();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="trace"]').forEach(initTrace);
    document.querySelectorAll('[data-sim="burnrate"]').forEach(initBurn);
  });
})();
