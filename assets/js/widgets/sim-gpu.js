/* Widgets del M13 (hardware GPU):
   <div data-calc="gpusizing">  cuántas GPUs necesita un modelo, con TPOT teórico y costo por millón de tokens
   <div data-sim="roofline">     modelo roofline: dónde caen el decode y el prefill según la GPU, el batch y el contexto */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt, LLM = SD.data.llm;
  var RESERVE = 5e9, EFF = 0.6;
  var uid = 0;

  function select(label, opts, value) {
    var id = 'g' + (++uid);
    var s = h('select', { id: id });
    opts.forEach(function (o) { s.appendChild(h('option', { value: o[0], text: o[1] })); });
    s.value = value;
    return { el: h('div', { class: 'field' }, [h('label', { for: id, text: label }), s]), input: s };
  }
  function number(label, value, step, hint) {
    var id = 'g' + (++uid);
    var i = h('input', { id: id, type: 'number', inputmode: 'decimal', min: 0, step: step || 'any', value: value });
    var kids = [h('label', { for: id, text: label }), i];
    if (hint) kids.push(h('p', { class: 'field-hint', text: hint }));
    return { el: h('div', { class: 'field' }, kids), input: i };
  }
  function outRow(label, formula) {
    var value = h('output', { class: 'out-value' });
    return { el: h('div', { class: 'out-row' }, [h('span', { class: 'out-label', text: label }), value, h('span', { class: 'out-formula', text: formula })]), value: value };
  }

  var MODEL_OPTS = ['llama8b', 'llama70b', 'llama405b', 'mixtral', 'dsv3', 'gpt3'].map(function (k) { return [k, LLM.models[k].name]; });
  var GPU_OPTS = ['a100', 'h100', 'h200', 'b200', 'mi300x'].map(function (k) { return [k, LLM.gpus[k].name + ' (' + F.bytes(LLM.gpus[k].mem) + ')']; });
  var SIZES = [1, 2, 4, 8, 16, 24, 32, 40, 48, 56, 64];

  /* ======================= Calculadora de sizing ======================= */

  var PRESETS = [
    { name: 'Asistente 8B', v: { model: 'llama8b', w: 'bf16', kv: 'bf16', gpu: 'h100', ctx: 8192, users: 32, price: 2.5 } },
    { name: 'Chat 70B', v: { model: 'llama70b', w: 'fp8', kv: 'bf16', gpu: 'h100', ctx: 8192, users: 32, price: 2.5 } },
    { name: '405B de frontera', v: { model: 'llama405b', w: 'fp8', kv: 'fp8', gpu: 'h200', ctx: 16384, users: 64, price: 3.5 } }
  ];

  function sizing(host) {
    var f = {
      model: select('Modelo', MODEL_OPTS, 'llama70b'),
      w: select('Pesos en', [['bf16', 'BF16 (2 bytes)'], ['fp8', 'FP8 (1 byte)'], ['int4', 'INT4 (0.5 bytes)']], 'fp8'),
      kv: select('KV cache en', [['bf16', 'BF16 (2 bytes)'], ['fp8', 'FP8 (1 byte)']], 'bf16'),
      gpu: select('GPU', GPU_OPTS, 'h100'),
      ctx: number('Contexto por usuario (tokens)', 8192, 256, 'Prompt más respuesta, en el peor momento de la conversación.'),
      users: number('Usuarios generando a la vez', 32, 1),
      price: number('Precio por GPU y hora (USD)', 2.5, 0.1, 'Supuesto editable: cambia mucho entre proveedores y contratos.')
    };
    var o = {
      weights: outRow('Pesos', 'parámetros × bytes por parámetro'),
      kvTok: outRow('KV cache por token', '2 × capas × kv_heads × head_dim × bytes'),
      kvAll: outRow('KV cache de todos los usuarios', 'usuarios × contexto × KV por token'),
      gpus: outRow('GPUs necesarias', 'la menor cantidad en la que caben pesos + KV + 5 GB de reserva por GPU'),
      room: outRow('Usuarios que caben en total', 'memoria libre ÷ KV de una conversación'),
      tpot: outRow('TPOT teórico', '(pesos leídos + KV del batch) ÷ ancho de banda total'),
      tps: outRow('Tokens de salida por segundo', 'usuarios ÷ TPOT'),
      cost: outRow('Costo por millón de tokens de salida', 'GPUs × precio ÷ (tokens/s × 60 % × 3600) × 10⁶')
    };
    var note = h('p', { class: 'calc-note', 'aria-live': 'polite' });

    function v(k) { var x = parseFloat(f[k].input.value); return isFinite(x) && x >= 0 ? x : 0; }

    function compute() {
      var m = LLM.models[f.model.input.value], g = LLM.gpus[f.gpu.input.value];
      var wB = LLM.bytes[f.w.input.value], kvB = LLM.bytes[f.kv.input.value];
      var W = m.params * wB * (f.w.input.value === 'int4' ? 1.03 : 1);   /* INT4: escalas por grupo, ~3 % extra */
      var kvTok = LLM.kvPerToken(m, kvB), ctx = Math.max(1, v('ctx')), U = Math.max(1, Math.round(v('users')));
      var K = U * ctx * kvTok, n = null;
      for (var i = 0; i < SIZES.length; i++) {
        if (SIZES[i] * (g.mem - RESERVE) - W >= K) { n = SIZES[i]; break; }
      }
      o.weights.value.textContent = F.bytes(W);
      o.kvTok.value.textContent = F.bytes(kvTok);
      o.kvAll.value.textContent = F.bytes(K);
      if (!n) {
        ['gpus', 'room', 'tpot', 'tps', 'cost'].forEach(function (k) { o[k].value.textContent = '—'; });
        note.textContent = 'No cabe ni en 64 GPUs: baja el contexto, los usuarios o la precisión.';
        return;
      }
      var free = n * (g.mem - RESERVE) - W;
      var readW = m.active ? Math.min(m.params, LLM.activeParams(m) * U) * wB : W;
      var step = (readW + K) / (n * g.bw);
      var peak = f.w.input.value === 'bf16' ? g.bf16 : (g.fp8 || g.bf16);
      var comp = 2 * LLM.activeParams(m) * U / (n * peak * 0.5);
      if (comp > step) step = comp;
      var tps = U / step;
      o.gpus.value.textContent = n + (n > 8 ? ' (' + Math.ceil(n / 8) + ' servidores)' : '');
      o.room.value.textContent = F.num(Math.floor(free / (ctx * kvTok)), 0);
      o.tpot.value.textContent = F.duration(step);
      o.tps.value.textContent = F.num(tps, 0) + ' (' + F.num(1 / step, 0) + ' por usuario)';
      o.cost.value.textContent = F.num(n * v('price') / (tps * EFF * 3600) * 1e6, 2) + ' USD';
      var msgs = [];
      if (n > 8) msgs.push('Más de 8 GPUs no entran en un solo servidor con NVLink: tensor parallelism dentro de cada servidor y pipeline entre servidores (M15).');
      if (f.w.input.value === 'fp8' && !g.fp8) msgs.push('La A100 no tiene cómputo FP8: guarda los pesos en FP8 pero calcula en BF16.');
      if (1 / step < 20) msgs.push('Menos de 20 tokens por segundo por usuario: más lento de lo que se espera en un chat. Usa más GPUs o menos usuarios por réplica.');
      if (m.active) msgs.push('MoE: con pocos usuarios solo se leen los expertos activos, pero cabe el modelo entero en memoria.');
      note.textContent = msgs.join(' ');
    }

    function apply(p) { Object.keys(p.v).forEach(function (k) { f[k].input.value = p.v[k]; }); compute(); }

    var bar = h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Ejemplos precargados' });
    PRESETS.forEach(function (p, i) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': i === 1 ? 'true' : 'false', text: p.name });
      b.addEventListener('click', function () {
        bar.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        apply(p);
      });
      bar.appendChild(b);
    });
    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    Object.keys(f).forEach(function (k) { inCol.appendChild(f[k].el); f[k].input.addEventListener(f[k].input.tagName === 'SELECT' ? 'change' : 'input', compute); });
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });
    outCol.appendChild(note);
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Cuántas GPUs necesita un modelo' }), bar]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Límite teórico con el contexto completo de cada usuario: un motor real reparte mejor la memoria (M15) y logra un 60–80 % del ancho de banda. El costo supone un 60 % de eficiencia y solo cuenta GPUs.' }));
    apply(PRESETS[1]);
  }

  /* ======================= Roofline ======================= */

  function roofline(host) {
    var gpu = select('GPU', GPU_OPTS, 'h100');
    var prec = select('Precisión', [['fp8', 'FP8'], ['bf16', 'BF16']], 'fp8');
    var model = select('Modelo', ['llama8b', 'llama70b', 'llama405b'].map(function (k) { return [k, LLM.models[k].name]; }), 'llama70b');
    function range(label, min, max, value) {
      var input = h('input', { type: 'range', min: min, max: max, step: 1, value: value, 'aria-label': label });
      var out = h('output', { class: 'range-val' });
      return { input: input, out: out, el: h('div', { class: 'field' }, [h('label', {}, [label + ': ', out]), input]) };
    }
    var batch = range('Usuarios en el batch', 0, 9, 4);          /* 2^k: 1 … 512 */
    var ctx = range('Contexto por usuario', 0, 6, 3);             /* 500 × 2^k: 500 … 32 000 */
    var svgHost = h('div', { class: 'sim-scroll' });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });

    function draw() {
      var g = LLM.gpus[gpu.input.value], m = LLM.models[model.input.value];
      var p = prec.input.value;
      if (p === 'fp8' && !g.fp8) p = 'bf16';
      var peak = g[p], bw = g.bw, wB = LLM.bytes[p];
      var B = Math.pow(2, +batch.input.value), C = 500 * Math.pow(2, +ctx.input.value);
      batch.out.textContent = F.num(B, 0);
      ctx.out.textContent = F.num(C, 0) + ' tokens';
      var kvTok = LLM.kvPerToken(m, wB);
      var P = m.params;
      var aiDec = 2 * P * B / (P * wB + B * C * kvTok);
      var aiPre = 2 * P * 2000 / (P * wB);
      var ridge = peak / bw;
      var att = function (ai) { return Math.min(peak, ai * bw); };

      var W = 740, H = 300, l = 60, r = 16, t = 16, b = 44, pw = W - l - r, ph = H - t - b;
      var x0 = Math.log10(0.5), x1 = Math.log10(20000), y0 = Math.log10(1e12), y1 = Math.log10(peak * 3);
      var X = function (ai) { return l + (Math.log10(ai) - x0) / (x1 - x0) * pw; };
      var Y = function (fl) { return t + ph - (Math.log10(fl) - y0) / (y1 - y0) * ph; };
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Modelo roofline de la ' + g.name + '">';
      [1, 10, 100, 1000, 10000].forEach(function (v) { s += '<line class="sim-grid" x1="' + X(v) + '" x2="' + X(v) + '" y1="' + t + '" y2="' + (t + ph) + '"/><text class="sim-axis" x="' + X(v) + '" y="' + (t + ph + 16) + '" text-anchor="middle">' + F.num(v, 0) + '</text>'; });
      [1e12, 1e13, 1e14, 1e15].forEach(function (v) { if (Math.log10(v) <= y1) s += '<line class="sim-grid" x1="' + l + '" x2="' + (l + pw) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="sim-axis" x="' + (l - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + F.num(v / 1e12, 0) + ' T</text>'; });
      /* techo: pendiente del ancho de banda hasta el punto de quiebre, luego horizontal */
      var aMin = 0.5;
      s += '<path d="M' + X(aMin).toFixed(1) + ' ' + Y(att(aMin)).toFixed(1) + ' L' + X(ridge).toFixed(1) + ' ' + Y(peak).toFixed(1) + ' L' + X(20000).toFixed(1) + ' ' + Y(peak).toFixed(1) + '" fill="none" stroke="var(--label)" stroke-width="2.5"/>';
      s += '<line x1="' + X(ridge).toFixed(1) + '" x2="' + X(ridge).toFixed(1) + '" y1="' + Y(peak).toFixed(1) + '" y2="' + (t + ph) + '" stroke="var(--separator-strong)" stroke-dasharray="4 4"/>';
      s += '<text class="sim-axis" x="' + (X(ridge) + 6).toFixed(1) + '" y="' + (t + ph - 8) + '">quiebre: ' + F.num(ridge, 0) + ' FLOPs/byte</text>';
      s += '<text class="sim-axis" x="' + (l + pw) + '" y="' + (Y(peak) + 16).toFixed(1) + '" text-anchor="end">pico ' + p.toUpperCase() + ': ' + F.num(peak / 1e12, 0) + ' TFLOPS</text>';
      s += '<text class="sim-axis" x="' + (X(3)).toFixed(1) + '" y="' + (Y(att(3)) + 22).toFixed(1) + '">techo de memoria: ' + F.num(bw / 1e12, 2) + ' TB/s</text>';
      function point(ai, label, color, anchor) {
        var x = X(Math.max(0.6, Math.min(19000, ai))), y = Y(att(ai));
        s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="6" fill="' + color + '" stroke="var(--bg)" stroke-width="2"/>';
        s += '<text class="sim-val" x="' + (x + (anchor === 'end' ? -10 : 10)).toFixed(1) + '" y="' + (y + (anchor === 'end' ? -10 : 20)).toFixed(1) + '" text-anchor="' + anchor + '">' + label + '</text>';
      }
      point(aiDec, 'decode', 'var(--l-cache)', 'start');
      point(aiPre, 'prefill de 2000', 'var(--l-gpu)', 'end');
      s += '<text class="sim-axis" x="' + (l + pw) + '" y="' + (H - 6) + '" text-anchor="end">intensidad aritmética (FLOPs por byte leído, escala logarítmica)</text>';
      s += '</svg>';
      svgHost.innerHTML = s;
      stats.innerHTML = '';
      [['Intensidad del decode', F.num(aiDec, 1) + ' FLOPs/byte'],
       ['El decode ' + (aiDec < ridge ? '(límite: memoria)' : '(límite: cómputo)') + ' usa', F.pct(att(aiDec) / peak, 0) + ' del pico'],
       ['Intensidad del prefill', F.num(aiPre, 0) + ' FLOPs/byte'],
       ['El prefill ' + (aiPre < ridge ? '(límite: memoria)' : '(límite: cómputo)') + ' usa', F.pct(att(aiPre) / peak, 0) + ' del pico']].forEach(function (x) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
    }
    [gpu, prec, model].forEach(function (x) { x.input.addEventListener('change', draw); });
    [batch, ctx].forEach(function (x) { x.input.addEventListener('input', draw); });
    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Modelo roofline' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [h('div', { class: 'sim-controls' }, [gpu.el, prec.el, model.el, batch.el, ctx.el]), svgHost, stats]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Cada paso de decode lee los pesos una vez y el KV cache de cada usuario; hace unas 2 operaciones por parámetro y por usuario. El prefill lee los pesos una vez para 2000 tokens. Se ignora el cómputo propio de la atención.' }));
    draw();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-calc="gpusizing"]').forEach(sizing);
    document.querySelectorAll('[data-sim="roofline"]').forEach(roofline);
  });
})();
