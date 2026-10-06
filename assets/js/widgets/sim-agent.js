/* Widgets del M25 (agentes y herramientas):
   <div data-sim="agentloop">   el bucle de un agente paso a paso, en cuatro escenarios, con y sin los topes del orquestador
   <div data-calc="agentcost">  costo de una tarea de varios pasos con y sin prompt caching, y lo que pide una flota de tareas
   <div data-calc="trifecta">   las herramientas de un agente contra la regla de dos: qué propiedades junta y qué defensas las separan
   <div data-sim="durable">     una tarea larga cuando el worker muere, sin checkpoints, con checkpoints y con un efecto a medias;
                                necesita sim-dbflow.js (SD.flowAnim)
   La lógica pura está en SD.agentCore, sin DOM, para probarla en Node. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  /* ======================= Lógica pura ======================= */

  /* Precios en dólares por millón de tokens: entrada, escritura de caché de 5 minutos, lectura de caché y salida */
  var PRICES = {
    sonnet: { name: 'Sonnet 5.5', in: 2, cw: 2.5, cr: 0.2, out: 10 },
    haiku: { name: 'Haiku 4.5', in: 1, cw: 1.25, cr: 0.1, out: 5 }
  };
  var CONTEXT = 200000;   /* ventana de contexto */

  /* Costo de una llamada. inTok es la entrada completa; prevIn, la entrada de la llamada anterior, que ya está en el caché.
     Con caché, lo ya mandado se lee y lo nuevo se escribe; sin caché, todo se cobra como entrada. */
  function callCost(inTok, prevIn, outTok, p, cache) {
    if (!cache) return (inTok * p.in + outTok * p.out) / 1e6;
    var read = Math.min(prevIn, inTok);
    return (read * p.cr + (inTok - read) * p.cw + outTok * p.out) / 1e6;
  }

  /* Una tarea de n pasos: el prefijo fijo y, en cada paso, la salida del modelo más el resultado de la herramienta */
  function task(q) {
    var p = q.price, inTot = 0, outTot = 0, reads = 0, writes = 0, costNo = 0, costCache = 0, prev = 0, ctx = q.prefix, steps = [];
    for (var i = 1; i <= q.steps; i++) {
      var r = i === 1 ? 0 : prev;
      inTot += ctx; outTot += q.out; reads += r; writes += ctx - r;
      var cn = callCost(ctx, 0, q.out, p, false), cc = callCost(ctx, prev, q.out, p, true);
      costNo += cn; costCache += cc;
      steps.push({ i: i, in: ctx, costNo: cn, costCache: cc });
      prev = ctx; ctx += q.out + q.result;
    }
    return { inTot: inTot, outTot: outTot, reads: reads, writes: writes, ctxFinal: prev, costNo: costNo, costCache: costCache,
      cost: q.cache ? costCache : costNo, steps: steps, overflow: prev > CONTEXT };
  }

  /* Una flota de tareas iguales: llegada promedio, pico, tareas en curso (Little) y tokens por minuto en el pico */
  function fleet(q, t) {
    var avg = q.perDay / 86400, peak = avg * q.peak, dur = q.steps * q.secPerStep;
    return { avg: avg, peakTps: peak, duration: dur, inFlight: peak * dur, callsPerSec: peak * q.steps,
      uncachedPerMin: peak * 60 * (q.cache ? t.writes : t.inTot), cachedPerMin: q.cache ? peak * 60 * t.reads : 0,
      outPerMin: peak * 60 * t.outTot, daily: q.perDay * t.cost, monthly: q.perDay * t.cost * 30 };
  }

  /* ----- El bucle con topes ----- */

  var NORMAL = [['buscar_pedido', '{"id": 8812}'], ['historial_cliente', '{"cliente": 301}'], ['buscar_politica', '{"tema": "reembolsos"}'],
    ['consultar_pago', '{"pedido": 8812}'], ['buscar_envio', '{"pedido": 8812}'], ['leer_ticket', '{"ticket": 5120}']];

  function normalCall(i) {
    var c = NORMAL[(i - 1) % NORMAL.length];
    return { tool: c[0], args: c[1].replace('}', i > NORMAL.length ? ', "pagina": ' + Math.ceil(i / NORMAL.length) + '}' : '}'), res: 700 };
  }

  /* Cada escenario dice qué pide el modelo en el paso i. Diseño de referencia: 300 tokens de salida por paso,
     700 de resultado y un prefijo de 5 500, como la tarea de 25.1. */
  var SCENARIOS = {
    normal: { name: 'Una tarea normal', step: function (i) { return i >= 30 ? { final: true } : normalCall(i); } },
    bucle: { name: 'Un bucle', step: function (i) {
      return i <= 5 ? normalCall(i) : { tool: 'buscar_pedido', args: '{"id": 8812}', res: 700 }; } },
    cascada: { name: 'Una herramienta caída', step: function (i) {
      return i <= 3 ? normalCall(i) : { tool: 'consultar_pago', args: '{"pedido": 8812}', res: 150, fail: true }; } },
    grande: { name: 'Un resultado gigante', step: function (i) {
      if (i >= 30) return { final: true };
      return i === 5 || i === 12 || i === 19 ? { tool: 'buscar_logs', args: '{"texto": "timeout", "minutos": ' + (i * 10) + '}', res: 60000 } : normalCall(i); } }
  };

  var NOTE = 100;   /* lo que agrega el orquestador cuando corta: "se acabó el presupuesto, resume lo que sabes" */

  /* opts: { maxSteps, maxUsd, repeat, truncate, cache, price, prefix, out, secPerStep } (null apaga un tope) */
  function runAgent(key, o) {
    var sc = SCENARIOS[key], p = o.price, out = o.out || 300, prefix = o.prefix || 5500;
    var acc = 0, prev = 0, cum = 0, tIn = 0, time = 0, calls = [], seen = {}, stop = null, i;
    function call(ctx, kind, extra) {
      var c = callCost(ctx, prev, out, p, o.cache);
      cum += c; tIn += ctx; time += kind === 'resumen' ? 2.5 : 4;
      var rec = { n: calls.length + 1, in: ctx, cost: c, cum: cum, kind: kind };
      for (var k in extra) rec[k] = extra[k];
      calls.push(rec); prev = ctx;
      return rec;
    }
    for (i = 1; i <= 600; i++) {
      var ctx = prefix + acc;
      if (ctx > CONTEXT) { stop = 'contexto'; break; }
      if (o.maxSteps && i > o.maxSteps) { stop = 'pasos'; break; }
      var est = callCost(ctx, prev, out, p, o.cache);
      if (o.maxUsd && cum + 2 * est > o.maxUsd) { stop = 'dinero'; break; }   /* reserva una llamada para el resumen */
      var s = sc.step(i);
      if (s.final) { call(ctx, 'final', { step: i }); stop = 'fin'; break; }
      var sig = s.tool + s.args;
      seen[sig] = (seen[sig] || 0) + 1;
      var res = s.res, cut = false;
      if (o.truncate && res > o.truncate) { res = o.truncate; cut = true; }
      var blocked = o.repeat && seen[sig] >= 3;
      call(ctx, s.fail ? 'falla' : seen[sig] > 1 ? 'repetida' : 'herramienta',
        { step: i, tool: s.tool, args: s.args, res: blocked ? 0 : res, raw: s.res, truncated: cut, blocked: blocked, times: seen[sig] });
      if (blocked) { acc += out; stop = 'repetida'; break; }
      acc += out + res;
    }
    if (i > 600) stop = 'limite';
    var summary = null;
    if (stop === 'pasos' || stop === 'dinero' || stop === 'repetida') {
      acc += NOTE;
      summary = call(prefix + acc, 'resumen', {});
    }
    var steps = calls.filter(function (c) { return c.kind !== 'resumen'; }).length;
    return { calls: calls, stop: stop, steps: steps, cost: cum, inTok: tIn, outTok: calls.length * out, time: time,
      ctxFinal: calls.length ? calls[calls.length - 1].in : 0, summary: summary,
      done: stop === 'fin', maxCtx: calls.reduce(function (m, c) { return Math.max(m, c.in); }, 0) };
  }

  /* ----- La regla de dos ----- */

  /* a: procesa entradas no confiables; b: accede a datos privados o sistemas sensibles; c: cambia estado o comunica afuera.
     net: la salida es una petición a internet, que una lista de destinos puede cerrar */
  var AGENTS = {
    correo: { name: 'Asistente de correo', tools: [
      { k: 'leer_correo', a: 1, b: 1, d: 'correos de cualquiera, en tu bandeja' },
      { k: 'leer_calendario', b: 1, d: 'tus reuniones' },
      { k: 'buscar_web', a: 1, c: 1, net: 1, d: 'páginas de terceros; la URL puede llevar datos' },
      { k: 'enviar_correo', c: 1, d: 'a cualquier dirección' }], def: {} },
    soporte: { name: 'Agente de soporte', tools: [
      { k: 'leer_ticket', a: 1, d: 'lo que escribió el cliente' },
      { k: 'buscar_pedido', b: 1, d: 'pedidos y direcciones' },
      { k: 'historial_cliente', b: 1, d: 'compras y pagos' },
      { k: 'reembolsar', c: 1, d: 'mueve dinero' },
      { k: 'responder_ticket', c: 1, d: 'escribe al cliente' }], def: {} },
    github: { name: 'Agente con el MCP de GitHub', tools: [
      { k: 'leer_issues', a: 1, d: 'issues de un repositorio público' },
      { k: 'leer_repos_privados', b: 1, d: 'el código de tus repositorios privados' },
      { k: 'abrir_pull_request', c: 1, d: 'en un repositorio público' }], def: {} },
    guardia: { name: 'Agente de guardia (IA01)', tools: [
      { k: 'buscar_logs', a: 1, b: 1, d: 'los logs llevan texto que escribió cualquiera' },
      { k: 'consultar_metricas', b: 1, d: 'Prometheus, solo lectura' },
      { k: 'consultar_sql', b: 1, d: 'rol de solo lectura' },
      { k: 'buscar_runbooks', d: 'documentos del equipo' },
      { k: 'cambiar_flag', c: 1, d: 'cambia la tienda' },
      { k: 'cancelar_consulta', c: 1, d: 'corta una consulta' }], def: { approve: true } }
  };

  /* on: herramientas activas; d: { approve, quarantine, egress }; attempts: contenidos envenenados por día; rate: éxito por intento */
  function trifecta(tools, on, d, attempts, rate) {
    var A = false, B = false, C = false, Cnet = false, Cother = false;
    tools.forEach(function (t, i) {
      if (!on[i]) return;
      if (t.a) A = true;
      if (t.b) B = true;
      if (t.c) { C = true; if (t.net) Cnet = true; else Cother = true; }
    });
    /* La lista de destinos cierra la salida por internet, no las acciones */
    var Ceff = C && (Cother || (Cnet && !d.egress));
    /* El lector en cuarentena lee lo no confiable y no tiene herramientas: el planificador ya no lo procesa */
    var Aeff = A && !d.quarantine;
    var count = (Aeff ? 1 : 0) + (B ? 1 : 0) + (Ceff ? 1 : 0);
    var level, hits = attempts * rate;
    if (Aeff && B && Ceff && !d.approve) level = 'trifecta';
    else if (Aeff && B && Ceff) level = 'supervisada';
    else level = 'dos';
    return { A: A, B: B, C: C, Aeff: Aeff, Ceff: Ceff, count: count, level: level, hits: hits,
      autonomous: level === 'trifecta' ? hits : 0, toApprover: level === 'supervisada' ? hits : 0 };
  }

  SD.agentCore = { PRICES: PRICES, CONTEXT: CONTEXT, callCost: callCost, task: task, fleet: fleet,
    SCENARIOS: SCENARIOS, runAgent: runAgent, AGENTS: AGENTS, trifecta: trifecta };

  if (typeof document === 'undefined') return;   /* en Node solo se usa la lógica */

  /* ======================= Piezas comunes ======================= */

  var uid = 0;
  function num(label, value, step) {
    var id = 'ag' + (++uid);
    var i = h('input', { id: id, type: 'number', min: 0, step: step, value: value, inputmode: 'decimal' });
    return { el: h('div', { class: 'field' }, [h('label', { for: id, text: label }), i]), input: i };
  }
  function out(label, formula) {
    var v = h('output', { class: 'out-value' });
    return { el: h('div', { class: 'out-row' }, [h('span', { class: 'out-label', text: label }), v, h('span', { class: 'out-formula', text: formula })]), v: v };
  }
  function chipRow(list, def, onPick, aria) {
    var box = h('div', { class: 'calc-presets', role: 'group', 'aria-label': aria });
    Object.keys(list).forEach(function (k) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': k === def ? 'true' : 'false', text: list[k].name });
      b.addEventListener('click', function () {
        box.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        onPick(k);
      });
      box.appendChild(b);
    });
    box.clear = function () { box.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); };
    return box;
  }
  function toggle(label, on, onChange) {
    var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': on ? 'true' : 'false', text: label });
    b.addEventListener('click', function () {
      var v = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', v ? 'true' : 'false');
      onChange(v);
    });
    b.set = function (v) { b.setAttribute('aria-pressed', v ? 'true' : 'false'); };
    return b;
  }
  function stat(label) {
    var b = h('b');
    return { el: h('div', { class: 'sim-stat' }, [h('span', { text: label }), b]), v: b };
  }
  function usd(x) { return F.num(x, x < 0.1 ? 4 : x < 10 ? 2 : 0) + ' USD'; }
  function tok(x) { return F.num(x, 0); }
  /* F.words dice "1.88 millón"; en plural, salvo el 1 exacto */
  function words(x) { return F.words(x).replace(/^(?!1 )(.+) millón$/, '$1 millones'); }

  /* ======================= El bucle con topes ======================= */

  var KC = { herramienta: 'var(--l-gpu)', repetida: 'var(--warn)', falla: 'var(--fail)', final: 'var(--ok)', resumen: 'var(--ok)' };
  var STOP = {
    fin: '✓ El modelo terminó: respondió sin pedir herramientas.',
    pasos: '! El tope de pasos cortó la tarea. El orquestador pidió una última llamada sin herramientas para resumir lo que se sabe.',
    dinero: '! El tope de dinero cortó la tarea antes de pasarse, con una llamada reservada para el resumen.',
    repetida: '! El orquestador vio la misma llamada, con los mismos argumentos, por tercera vez, no la ejecutó y pidió un resumen.',
    contexto: '✗ El contexto ya no cabe en 200 000 tokens: la API rechaza la llamada y la tarea muere sin respuesta.',
    limite: '✗ La simulación se detuvo en 600 pasos.'
  };

  function initLoop(host) {
    var C = SD.agentCore, key = 'normal';
    var opt = { maxSteps: true, maxUsd: true, repeat: true, truncate: true, cache: true };
    var chart = h('div', { class: 'sim-scroll ag-chart' });
    var note = h('p', { class: 'sim-note', 'aria-live': 'polite' });
    var log = h('ol', { class: 'ag-log' });
    var st = { calls: stat('Llamadas al modelo'), tin: stat('Tokens de entrada'), cost: stat('Costo de la tarea'),
      time: stat('Tiempo'), ctx: stat('Contexto al final') };
    var stats = h('div', { class: 'sim-stats' }, Object.keys(st).map(function (k) { return st[k].el; }));
    var scen = chipRow(C.SCENARIOS, key, function (k) { key = k; run(); }, 'Escenarios');
    var togs = h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Topes y defensas del orquestador' });
    [['maxSteps', 'Tope de 40 pasos'], ['maxUsd', 'Tope de 1 USD'], ['repeat', 'Cortar llamadas repetidas'],
      ['truncate', 'Truncar resultados a 2 000 tokens'], ['cache', 'Prompt caching']].forEach(function (t) {
      togs.appendChild(toggle(t[1], opt[t[0]], function (v) { opt[t[0]] = v; run(); }));
    });

    function draw(r) {
      var W = 680, H = 196, l = 56, rr = 12, top = 18, bot = 160, pw = W - l - rr, ph = bot - top;
      var n = Math.max(r.calls.length, 30), max = Math.max(r.maxCtx, 40000) * 1.08;
      var X = function (i) { return l + i / n * pw; }, Y = function (v) { return bot - v / max * ph; };
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tokens de entrada de cada llamada al modelo, en barras; la última llamada de ' + tok(r.ctxFinal) + ' tokens">';
      var stepV = max > 120000 ? 50000 : max > 60000 ? 20000 : 10000;
      for (var v = 0; v <= max; v += stepV) {
        s += '<line class="sim-grid" x1="' + l + '" x2="' + (W - rr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/>';
        s += '<text class="sim-axis" x="' + (l - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + (v ? F.num(v / 1000, 0) + ' mil' : '0') + '</text>';
      }
      var bw = pw / n;
      r.calls.forEach(function (c, i) {
        var x = X(i) + (bw > 4 ? 1 : 0), w = Math.max(0.8, bw - (bw > 4 ? 2 : 0.4));
        s += '<rect x="' + x.toFixed(1) + '" y="' + Y(c.in).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (bot - Y(c.in)).toFixed(1) + '" style="fill: ' + KC[c.kind] + '" opacity="0.7"/>';
      });
      if (max > C.CONTEXT * 0.6) {
        var y = Y(C.CONTEXT);
        s += '<line x1="' + l + '" x2="' + (W - rr) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="var(--fail)" stroke-width="1.5" stroke-dasharray="5 4"/>';
        s += '<text class="sim-label" x="' + (l + 6) + '" y="' + (y - 6).toFixed(1) + '">ventana de 200 000 tokens</text>';
      }
      [1, Math.round(n / 2), n].forEach(function (k) {
        s += '<text class="sim-axis" x="' + (X(k - 0.5)).toFixed(1) + '" y="' + (bot + 15) + '" text-anchor="middle">' + k + '</text>';
      });
      var lx = l;
      [['herramienta', 'herramienta'], ['repetida', 'repetida'], ['falla', 'falla'], ['final', 'respuesta o resumen']].forEach(function (g) {
        s += '<rect x="' + lx + '" y="' + (H - 14) + '" width="11" height="11" style="fill: ' + KC[g[0]] + '" opacity="0.7"/>';
        s += '<text class="sim-axis" x="' + (lx + 16) + '" y="' + (H - 4) + '">' + g[1] + '</text>';
        lx += g[1].length * 6.4 + 34;
      });
      s += '<text class="sim-axis" x="' + (W - rr) + '" y="' + (H - 4) + '" text-anchor="end">llamada al modelo</text>';
      chart.innerHTML = s + '</svg>';
    }

    function line(c) {
      var what = c.kind === 'final' ? 'responde sin herramientas' : c.kind === 'resumen' ? 'resumen sin herramientas, por el corte'
        : c.tool + '(' + c.args + ')' + (c.blocked ? ': no se ejecuta, es la tercera vez'
          : c.kind === 'falla' ? ': 503' : c.truncated ? ': ' + tok(c.raw) + ' tokens, truncado a ' + tok(c.res) : c.raw > 5000 ? ': ' + tok(c.raw) + ' tokens' : '');
      return h('li', { class: 'ag-' + c.kind }, [h('b', { text: '#' + c.n }), h('code', { text: what }),
        h('span', { text: tok(c.in) + ' de entrada · ' + usd(c.cum) })]);
    }

    function run() {
      var r = C.runAgent(key, { maxSteps: opt.maxSteps ? 40 : null, maxUsd: opt.maxUsd ? 1 : null, repeat: opt.repeat,
        truncate: opt.truncate ? 2000 : null, cache: opt.cache, price: C.PRICES.sonnet });
      st.calls.v.textContent = F.num(r.calls.length, 0) + (r.summary ? ' (1 de resumen)' : '');
      st.tin.v.textContent = words(r.inTok);
      st.cost.v.textContent = usd(r.cost);
      st.time.v.textContent = F.duration(r.time);
      st.ctx.v.textContent = tok(r.ctxFinal);
      var msg = STOP[r.stop];
      if (r.stop === 'contexto') msg += ' Se gastaron ' + usd(r.cost) + ' en ' + F.num(r.steps, 0) + ' pasos.';
      if (key === 'bucle' && r.stop === 'repetida') msg += ' Sin este corte, el bucle sigue hasta que algo más lo pare.';
      if (key === 'cascada' && r.stop !== 'repetida') msg += ' Reintentar la misma llamada fallida no la arregla: devolver el error como resultado ayuda solo si el orquestador también corta.';
      if (key === 'grande' && !opt.truncate) msg += ' Cada resultado de 60 000 tokens se paga otra vez en cada llamada que sigue.';
      note.textContent = msg;
      log.innerHTML = '';
      var cs = r.calls, show = cs.length <= 14 ? cs : cs.slice(0, 6).concat([null], cs.slice(-6));
      show.forEach(function (c) {
        log.appendChild(c ? line(c) : h('li', { class: 'ag-gap', text: '… ' + F.num(cs.length - 12, 0) + ' llamadas más …' }));
      });
      draw(r);
    }

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'El bucle de un agente, con y sin topes' }), scen]));
    host.appendChild(h('div', { class: 'sim-body' }, [h('div', { class: 'sim-controls' }, [togs]), chart, note, stats, log]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Diseño de referencia: cada paso pide 300 tokens de salida y la herramienta devuelve 700, sobre un prefijo de 5 500, con los precios de Sonnet 5.5 (2, 2.50, 0.20 y 10 dólares por millón). Cada paso tarda unos 4 s. El tope de dinero reserva el costo de una llamada para el resumen. Una llamada repetida es la misma herramienta con los mismos argumentos.' }));
    run();
  }

  /* ======================= Costo de una tarea y de la flota ======================= */

  var TASKS = {
    agente: { name: 'Agente de 30 pasos', v: { steps: 30, prefix: 5500, out: 300, result: 700 } },
    workflow: { name: 'Workflow de 3 llamadas', v: { steps: 3, prefix: 5500, out: 300, result: 700 } },
    chat: { name: 'Una sola llamada', v: { steps: 1, prefix: 5500, out: 300, result: 0 } },
    largo: { name: 'Agente de 120 pasos', v: { steps: 120, prefix: 5500, out: 300, result: 700 } }
  };

  function initCost(host) {
    var C = SD.agentCore, price = 'sonnet', cache = true;
    var f = { steps: num('Pasos por tarea', 30, 1), prefix: num('Prefijo: instrucciones y herramientas (tokens)', 5500, 100),
      out: num('Salida del modelo por paso (tokens)', 300, 50), result: num('Resultado de la herramienta por paso (tokens)', 700, 50),
      perDay: num('Tareas por día', 100000, 1000), peak: num('Pico sobre el promedio (veces)', 3, 0.5), sec: num('Segundos por paso', 4, 0.5) };
    var o = {
      tin: out('Tokens de entrada por tarea', 'cada paso manda otra vez todo el contexto'),
      cost: out('Costo por tarea', ''),
      ratio: out('Contra una sola llamada', ''),
      inflight: out('Tareas en curso en el pico', 'llegadas por segundo × duración (Little)'),
      calls: out('Llamadas al modelo por segundo', 'en el pico'),
      tpm: out('Tokens por minuto en el pico', ''),
      month: out('Costo del modelo al mes', '30 días')
    };
    var chart = h('div', { class: 'sim-scroll ag-chart' });
    var tChips = chipRow(TASKS, 'agente', function (k) {
      Object.keys(TASKS[k].v).forEach(function (x) { f[x].input.value = TASKS[k].v[x]; });
      run();
    }, 'Tareas de ejemplo');
    var pChips = chipRow(C.PRICES, price, function (k) { price = k; run(); }, 'Modelo');
    var cTog = toggle('Prompt caching', cache, function (v) { cache = v; run(); });

    function val(k, d) { var n = parseFloat(f[k].input.value); return isFinite(n) && n >= 0 ? n : d; }

    function draw(t, one) {
      var W = 680, H = 132, l = 190, rr = 70, pw = W - l - rr;
      var bars = [['Una sola llamada', one.costNo], ['Esta tarea, sin caché', t.costNo], ['Esta tarea, con caché', t.costCache]];
      var max = Math.max.apply(null, bars.map(function (b) { return b[1]; })) || 1;
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Costo por tarea: una sola llamada, la tarea sin caché y la tarea con caché">';
      bars.forEach(function (b, i) {
        var y = 14 + i * 38, w = Math.max(1, b[1] / max * pw);
        s += '<text class="sim-label" x="' + (l - 10) + '" y="' + (y + 18) + '" text-anchor="end">' + b[0] + '</text>';
        s += '<rect x="' + l + '" y="' + y + '" width="' + w.toFixed(1) + '" height="26" rx="3" style="fill: ' + (i === 2 ? 'var(--l-cache)' : 'var(--l-gpu)') + '" opacity="0.6"/>';
        s += '<text class="sim-val" x="' + (l + w + 6).toFixed(1) + '" y="' + (y + 18) + '">' + usd(b[1]) + '</text>';
      });
      chart.innerHTML = s + '</svg>';
    }

    function run() {
      var p = C.PRICES[price];
      var q = { steps: Math.max(1, Math.round(val('steps', 30))), prefix: val('prefix', 5500), out: val('out', 300), result: val('result', 700), price: p, cache: cache };
      var t = C.task(q), one = C.task({ steps: 1, prefix: q.prefix, out: q.out, result: 0, price: p, cache: false });
      var fl = C.fleet({ perDay: val('perDay', 100000), peak: val('peak', 3) || 1, steps: q.steps, secPerStep: val('sec', 4), cache: cache }, t);
      o.tin.v.textContent = tok(t.inTot);
      o.tin.v.nextSibling.textContent = 'y ' + tok(t.outTot) + ' de salida; la última llamada lee ' + tok(t.ctxFinal) + (t.overflow ? ' ✗ no cabe en 200 000' : '');
      o.cost.v.textContent = usd(t.cost);
      o.cost.v.nextSibling.textContent = cache ? 'sin caché serían ' + usd(t.costNo) + ': el caché cobra lo ya mandado a ' + F.num(p.cr, 2) + ' por millón'
        : 'con caché serían ' + usd(t.costCache);
      o.ratio.v.textContent = F.num(t.cost / one.costNo, 1) + ' veces';
      o.ratio.v.nextSibling.textContent = 'una llamada con el mismo prefijo cuesta ' + usd(one.costNo);
      o.inflight.v.textContent = F.num(fl.inFlight, 0);
      o.inflight.v.nextSibling.textContent = F.num(fl.peakTps, 2) + ' tareas por segundo × ' + F.duration(fl.duration) + ' (Little)';
      o.calls.v.textContent = F.num(fl.callsPerSec, 1);
      o.tpm.v.textContent = words(fl.uncachedPerMin) + ' de entrada';
      o.tpm.v.nextSibling.textContent = (cache ? 'sin contar ' + words(fl.cachedPerMin) + ' leídos del caché; ' : '') + words(fl.outPerMin) + ' de salida';
      o.month.v.textContent = usd(fl.monthly);
      o.month.v.nextSibling.textContent = usd(fl.daily) + ' por día';
      draw(t, one);
    }

    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    inCol.appendChild(h('div', { class: 'calc-presets' }, [pChips, cTog]));
    Object.keys(f).forEach(function (k) {
      inCol.appendChild(f[k].el);
      f[k].input.addEventListener('input', function () { if (k in TASKS.agente.v) tChips.clear(); run(); });
    });
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Lo que cuesta una tarea de agente' }), tChips]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('div', { class: 'vis-chart-wrap' }, [chart]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Precios por millón de tokens de la documentación de Anthropic (octubre de 2026): Sonnet 5.5, 2 de entrada, 2.50 de escritura de caché de 5 minutos, 0.20 de lectura y 10 de salida; Haiku 4.5, 1, 1.25, 0.10 y 5. Con caché, cada paso lee del caché la entrada del paso anterior y escribe solo lo nuevo. Los tamaños de la tarea son un diseño de referencia.' }));
    run();
  }

  /* ======================= La regla de dos ======================= */

  function initTrifecta(host) {
    var C = SD.agentCore, key = 'correo', on = [], d = {};
    var tbox = h('div', { class: 'ag-tools', role: 'group', 'aria-label': 'Herramientas del agente' });
    var dbox = h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Defensas' });
    var props = h('div', { class: 'ag-props' });
    var verdict = h('p', { class: 'sim-note ag-verdict', 'aria-live': 'polite' });
    var att = num('Contenidos envenenados que lee al día', 1000, 100), rate = num('Éxito de cada intento (%)', 2, 0.5);
    var o = { hits: out('Ataques que funcionan al día', '') };
    var DEF = [['approve', 'Aprobación humana antes de cada acción'], ['quarantine', 'Lector en cuarentena, sin herramientas'], ['egress', 'Salida a internet solo a una lista de destinos']];
    var dT = {};
    DEF.forEach(function (x) { dT[x[0]] = toggle(x[1], false, function (v) { d[x[0]] = v; run(); }); dbox.appendChild(dT[x[0]]); });
    var chips = chipRow(C.AGENTS, key, function (k) { key = k; load(); }, 'Agentes de ejemplo');

    function load() {
      var a = C.AGENTS[key];
      on = a.tools.map(function () { return true; });
      d = { approve: !!a.def.approve, quarantine: !!a.def.quarantine, egress: !!a.def.egress };
      DEF.forEach(function (x) { dT[x[0]].set(d[x[0]]); });
      tbox.innerHTML = '';
      a.tools.forEach(function (t, i) {
        var tags = (t.a ? 'A' : '') + (t.b ? 'B' : '') + (t.c ? 'C' : '');
        var b = h('button', { type: 'button', class: 'ag-tool', 'aria-pressed': 'true' }, [
          h('code', { text: t.k }), h('span', { class: 'ag-tags', text: tags.split('').join(' ') || 'ninguna' }), h('small', { text: t.d })]);
        b.addEventListener('click', function () { on[i] = !on[i]; b.setAttribute('aria-pressed', on[i] ? 'true' : 'false'); run(); });
        tbox.appendChild(b);
      });
      run();
    }

    function badge(k, name, has, eff, why) {
      return h('div', { class: 'ag-prop' + (eff ? ' is-on' : has ? ' is-cut' : '') }, [h('b', { text: k }), h('span', { text: name }),
        h('small', { text: !has ? 'ninguna herramienta' : eff ? 'la sesión la tiene' : why })]);
    }

    function run() {
      var a = C.AGENTS[key], n = parseFloat(att.input.value), p = parseFloat(rate.input.value) / 100;
      var r = C.trifecta(a.tools, on, d, isFinite(n) ? n : 0, isFinite(p) ? p : 0);
      props.innerHTML = '';
      props.appendChild(badge('A', 'Procesa entradas no confiables', r.A, r.Aeff, 'la lee el lector en cuarentena'));
      props.appendChild(badge('B', 'Accede a datos privados o sistemas sensibles', r.B, r.B, ''));
      props.appendChild(badge('C', 'Cambia estado o comunica hacia afuera', r.C, r.Ceff, 'la lista de destinos la cierra'));
      if (r.level === 'trifecta') {
        verdict.textContent = '✗ Las tres juntas y sin supervisión. Un contenido envenenado puede leer datos privados y sacarlos, o actuar, sin que nadie lo vea.';
        o.hits.v.textContent = F.num(r.autonomous, 0);
        o.hits.v.nextSibling.textContent = 'intentos × éxito, y ninguno pasa por una persona';
      } else if (r.level === 'supervisada') {
        verdict.textContent = '! Las tres, pero cada acción pasa por una persona. La regla de Meta lo permite así: el agente no actúa solo. Sirve si quien aprueba ve qué datos salen y adónde, y si no aprueba en automático.';
        o.hits.v.textContent = F.num(r.toApprover, 0) + ' llegan a quien aprueba';
        o.hits.v.nextSibling.textContent = 'cada uno es una propuesta que una persona tiene que rechazar';
      } else {
        var miss = !r.Aeff ? 'A: nada no confiable llega al modelo que actúa' : !r.B ? 'B: no hay datos privados que sacar' : 'C: no puede actuar ni sacar nada';
        verdict.textContent = '✓ ' + r.count + ' de 3. Falta ' + miss + '. Sigue haciendo falta privilegio mínimo en cada herramienta.';
        o.hits.v.textContent = '0 por esta vía';
        o.hits.v.nextSibling.textContent = r.count === 2 && r.Aeff ? 'un ataque todavía puede hacer que el agente se equivoque' : '';
      }
    }

    var inCol = h('div', { class: 'calc-inputs' }, [h('p', { class: 'ag-cap', text: 'Herramientas (toca para quitar o poner)' }), tbox, h('p', { class: 'ag-cap', text: 'Defensas' }), dbox, att.el, rate.el]);
    var outCol = h('div', { class: 'calc-outputs' }, [props, verdict, o.hits.el]);
    [att, rate].forEach(function (x) { x.input.addEventListener('input', run); });
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'La regla de dos, herramienta por herramienta' }), chips]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Las propiedades A, B y C son las de "Agents Rule of Two" (Meta, octubre de 2025). Los agentes de ejemplo, las herramientas y el 2 % de éxito por intento son un diseño de referencia: la tasa real depende del modelo, del ataque y de las defensas, y cambia con cada versión.' }));
    load();
  }

  /* ======================= Ejecución durable ======================= */

  function M(f, t, k, l) { return [f, t, k, l]; }
  function S(m, say, set) { return { m: m, say: say, set: set || null }; }

  var ND = {
    C: { x: 8, y: 124, w: 142, h: 84, name: 'Cliente', sub: 'creó la tarea', c: '--l-client' },
    Q: { x: 8, y: 14, w: 142, h: 84, name: 'Cola', sub: 'tareas y reanudaciones', c: '--l-queue' },
    W: { x: 296, y: 14, w: 142, h: 84, name: 'Worker', sub: 'el bucle', c: '--l-service' },
    MO: { x: 584, y: 14, w: 142, h: 84, name: 'Modelo', sub: 'API de Claude', c: '--l-gpu' },
    CK: { x: 296, y: 124, w: 142, h: 84, name: 'Checkpoints', sub: 'PostgreSQL', c: '--l-db' },
    P: { x: 584, y: 124, w: 142, h: 84, name: 'API de pagos', sub: 'idempotente', c: '--l-external' }
  };
  var ED = [['C', 'Q'], ['Q', 'W'], ['W', 'MO'], ['W', 'CK'], ['W', 'P']];

  var DURABLE = {
    title: 'Una tarea de 30 pasos cuando el worker muere', aria: 'Cliente, cola, worker, modelo, checkpoints y API de pagos', vbw: 734, vbh: 218,
    scenes: [
      { id: 'sin', name: 'Sin checkpoints', nodes: ND, edges: ED,
        def: 'El estado del bucle vive en la memoria del worker: la lista de mensajes, los pasos, el gasto.',
        rows: [['El costo', 'Morir en el paso 15 repite 14 pasos: unos 0.12 USD y casi un minuto por tarea, en el diseño de 25.1. Un deploy que mata 417 tareas en curso tira unos 54 USD y mucha paciencia.']],
        steps: [
          S([M('C', 'Q', 'req', 'tarea t_91')], 'El cliente crea la tarea: reembolsar el pedido 8812 si corresponde. Queda en la cola.', { Q: { st: 'on', v: ['t_91'] } }),
          S([M('Q', 'W', 'req', 't_91 + lease')], 'Un worker la toma con un lease, como un job del M23.', { Q: { st: '', v: ['en vuelo'] }, W: { st: 'on', v: ['paso 1'] } }),
          S([M('W', 'MO', 'req', 'contexto'), M('MO', 'W', 'res', 'tool_calls')], 'Pasos 1 a 14: el modelo pide herramientas, el worker las ejecuta y agrega los resultados. Todo está en memoria.', { W: { st: 'on', v: ['paso 14', '0.12 USD gastados'] }, MO: { st: 'ok', v: ['14 llamadas'] } }),
          S([], 'Un deploy reemplaza el contenedor en el paso 15. El proceso muere y la memoria se va con él.', { W: { st: 'down', v: ['muerto'] }, MO: { st: '', v: [] } }),
          S([], 'El lease vence y la tarea vuelve a la cola.', { Q: { st: 'warn', v: ['t_91, intento 2'] } }),
          S([M('Q', 'W', 'req', 't_91, intento 2'), M('W', 'MO', 'req', 'paso 1 otra vez')], 'Otro worker la toma y empieza desde cero: los 14 pasos se vuelven a pagar, y las herramientas se vuelven a llamar.', { Q: { st: '', v: [] }, W: { st: 'warn', v: ['paso 1 otra vez'] }, MO: { st: 'warn', v: ['se repite todo'] } })
        ] },
      { id: 'con', name: 'Un checkpoint por paso', nodes: ND, edges: ED,
        def: 'Después de cada paso, el worker guarda el estado: los mensajes, el contador de pasos y el gasto, con el id de la tarea.',
        rows: [['La regla', 'Reanudar es cargar el último checkpoint y seguir. Lo único que se repite es el paso que estaba a medias.']],
        steps: [
          S([M('Q', 'W', 'req', 't_91 + lease')], 'Un worker toma la tarea.', { W: { st: 'on', v: ['paso 1'] } }),
          S([M('W', 'MO', 'req', 'contexto'), M('MO', 'W', 'res', 'tool_calls'), M('W', 'CK', 'write', 'checkpoint')], 'Cada paso termina con una escritura: el estado completo del bucle, versionado por paso.', { W: { v: ['paso 14'] }, CK: { st: 'on', v: ['t_91: paso 14'] } }),
          S([], 'El worker muere en el paso 15.', { W: { st: 'down', v: ['muerto'] } }),
          S([], 'El lease vence y la tarea vuelve a la cola, ahora como una reanudación.', { Q: { st: 'warn', v: ['reanudar t_91'] } }),
          S([M('Q', 'W', 'req', 'reanudar t_91'), M('CK', 'W', 'res', 'paso 14')], 'Otro worker carga el checkpoint del paso 14. Tiene la misma lista de mensajes que tenía el primero.', { Q: { st: '', v: [] }, W: { st: 'on', v: ['otro worker', 'desde el paso 15'] } }),
          S([M('W', 'MO', 'req', 'paso 15'), M('W', 'CK', 'write', 'checkpoint 15')], 'Repite solo el paso 15 y sigue. La tarea termina unos 56 segundos antes que sin checkpoints, y sin pagar dos veces.', { W: { st: 'ok', v: ['paso 15'] }, CK: { st: 'ok', v: ['t_91: paso 15'] } })
        ] },
      { id: 'efecto', name: 'Muere después de un efecto', nodes: ND, edges: ED, init: { CK: { st: 'on', v: ['t_91: paso 14'] } },
        def: 'El caso difícil: la herramienta ya cambió algo afuera, pero el worker muere antes de guardar el checkpoint.',
        rows: [['La regla', 'El paso que se repite repite sus efectos. Cada llamada con efectos lleva una idempotency key que sale del id de la tarea y del id de la llamada, que está en el checkpoint.']],
        steps: [
          S([M('W', 'MO', 'req', 'paso 15'), M('MO', 'W', 'res', 'reembolsar call_7'), M('W', 'CK', 'write', 'tool_call call_7')], 'El modelo pide reembolsar 120 USD. La respuesta del modelo, con el id <code>call_7</code>, se guarda antes de ejecutar nada.', { W: { st: 'on', v: ['paso 15'] }, CK: { v: ['t_91: llamada call_7'] } }),
          S([M('W', 'P', 'req', 'POST /refunds, key t_91:call_7'), M('P', 'W', 'ok', '200 re_31')], 'El worker llama a la API de pagos con <code>Idempotency-Key: t_91:call_7</code>. El reembolso se hace.', { P: { st: 'ok', v: ['re_31: 120 USD'] } }),
          S([], 'El worker muere antes de guardar el resultado.', { W: { st: 'down', v: ['muerto'] } }),
          S([M('Q', 'W', 'req', 'reanudar t_91'), M('CK', 'W', 'res', 'call_7 pendiente')], 'Otro worker carga el checkpoint: la llamada <code>call_7</code> está pedida y sin resultado. No vuelve a llamar al modelo: ejecuta la llamada pendiente.', { W: { st: 'on', v: ['otro worker', 'call_7 pendiente'] } }),
          S([M('W', 'P', 'req', 'POST /refunds, key t_91:call_7'), M('P', 'W', 'ok', '200 re_31 (repetida)')], 'La API de pagos reconoce la clave y devuelve el mismo reembolso, sin hacer otro. Sin la clave, el cliente recibe 240 USD.', { P: { st: 'ok', v: ['re_31: 120 USD', '1 solo reembolso'] } }),
          S([M('W', 'CK', 'write', 'resultado + paso 15')], 'Ahora sí se guarda el resultado, y la tarea sigue.', { W: { st: 'ok', v: ['paso 16'] }, CK: { st: 'ok', v: ['t_91: paso 15'] } })
        ] }
    ]
  };

  SD.ready(function () {
    document.querySelectorAll('[data-sim="agentloop"]').forEach(initLoop);
    document.querySelectorAll('[data-calc="agentcost"]').forEach(initCost);
    document.querySelectorAll('[data-calc="trifecta"]').forEach(initTrifecta);
    if (SD.flowAnim) document.querySelectorAll('[data-sim="durable"]').forEach(function (el) { SD.flowAnim(el, DURABLE); });
  });
})();
