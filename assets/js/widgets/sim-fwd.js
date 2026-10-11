/* Widgets del M12.1 (prefill y decode a fondo):
   <div data-sim="attnrows">  la matriz de atención de una request: el prefill calcula el triángulo entero de una vez y cada
                              paso de decode agrega una fila; sin KV cache, cada paso recalcula todo
   <div data-calc="fwdcost">  dónde se va el tiempo de una pasada: FLOPs, bytes y límite de cada pieza del modelo
                              (proyecciones de atención, atención, MLP y LM head) para prefill, decode o un paso mixto
   Usa SD.data.llm (data/llm.data.js), que la página carga antes. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt, LLM = SD.data.llm;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var uid = 0;

  /* ======================= Matriz de atención ======================= */

  var PROMPT = ['¿', 'Qué', ' es', ' el', ' KV', ' cache', '?'];
  var GEN = [' Guarda', ' las', ' claves', ' y', ' los', ' valores'];
  var TOKS = PROMPT.concat(GEN);
  var NP = PROMPT.length, NT = TOKS.length;

  function initAttn(host) {
    var cache = true, step = 0, timer = null;       /* step 0: nada; 1: prefill hecho; 1 + k: k pasos de decode */
    var LAST = 1 + GEN.length;                       /* el último paso procesa el último token y produce el fin */
    var tot = { cells: 0, kv: 0 };

    var chipOn = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'true', text: 'Con KV cache' });
    var chipOff = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'false', text: 'Sin KV cache' });
    var bPre = h('button', { type: 'button', class: 'btn btn--primary', text: 'Prefill' });
    var bDec = h('button', { type: 'button', class: 'btn', text: 'Paso de decode' });
    var bAll = h('button', { type: 'button', class: 'btn', text: 'Reproducir todo' });
    var bReset = h('button', { type: 'button', class: 'btn', text: 'Reiniciar' });
    var svgHost = h('div', { class: 'sim-scroll attn-chart' });
    var note = h('p', { class: 'sim-note', 'aria-live': 'polite' });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });

    /* Filas que calcula el paso s: el prefill, las 7 del prompt; el decode k, la fila 6 + k (o todas, sin cache) */
    function rowsOf(s) {
      if (s === 1) return { from: 0, to: NP - 1 };
      var r = NP - 2 + s;
      return cache ? { from: r, to: r } : { from: 0, to: r };
    }
    function cellsOf(s) {
      var rr = rowsOf(s), n = 0;
      for (var i = rr.from; i <= rr.to; i++) n += i + 1;
      return n;
    }
    function lastRow(s) { return s === 0 ? -1 : NP - 2 + s; }

    function draw() {
      var cur = step > 0 ? rowsOf(step) : null;
      var lr = lastRow(step);
      var C = 26, L = 92, T = 74, KX = L + NT * C + 28;
      var W = KX + 92, H = T + NT * C + 16;
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Matriz de atención: filas son consultas, columnas son claves">';
      s += '<text class="sim-label" x="' + L + '" y="14">Claves (K) de cada token: columnas</text>';
      s += '<text class="sim-label" x="0" y="' + (T - 8) + '">Consultas (Q)</text>';
      for (var j = 0; j < NT; j++) {
        var known = j < NP || (step > 0 && j <= lr + 1);
        var cx = L + j * C + C / 2;
        s += '<text class="sim-axis" transform="translate(' + (cx + 4) + ' ' + (T - 6) + ') rotate(-60)"' + (known ? '' : ' opacity="0.35"') + '>' + SD.escape(TOKS[j].trim()) + '</text>';
      }
      for (var i = 0; i < NT; i++) {
        var y = T + i * C;
        var rowKnown = i < NP || (step > 0 && i <= lr + 1);
        s += '<text class="sim-axis" x="' + (L - 8) + '" y="' + (y + C / 2 + 4) + '" text-anchor="end"' + (rowKnown ? '' : ' opacity="0.35"') + '>' + SD.escape(TOKS[i].trim()) + '</text>';
        for (var k = 0; k < NT; k++) {
          var x = L + k * C, cls;
          if (k > i) cls = 'fill="none" stroke="var(--separator)" stroke-dasharray="2 3"';
          else if (cur && i >= cur.from && i <= cur.to) cls = 'fill="var(--accent-tint)" stroke="var(--accent)"';
          else if (i <= lr) cls = 'fill="var(--fill-2)" stroke="var(--separator-strong)"';
          else cls = 'fill="var(--bg)" stroke="var(--separator)"';
          s += '<rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (C - 2) + '" height="' + (C - 2) + '" rx="4" ' + cls + '/>';
        }
        /* columna del KV cache */
        var inCache = cache ? i <= lr : false;
        var fresh = cur && i >= cur.from && i <= cur.to;
        var kfill = fresh ? 'var(--accent-tint)' : inCache ? 'color-mix(in srgb, var(--l-cache) 30%, var(--bg))' : 'var(--bg)';
        var kstroke = fresh ? 'var(--accent)' : inCache ? 'var(--l-cache)' : 'var(--separator)';
        s += '<rect x="' + KX + '" y="' + (y + 2) + '" width="74" height="' + (C - 4) + '" rx="5" fill="' + kfill + '" stroke="' + kstroke + '"/>';
        if (inCache || fresh) s += '<text class="sim-axis" x="' + (KX + 37) + '" y="' + (y + C / 2 + 4) + '" text-anchor="middle">K, V</text>';
      }
      s += '<text class="sim-label" x="' + KX + '" y="' + (T - 8) + '">KV cache</text>';
      if (step > 0 && lr + 1 < NT) {
        var ny = T + (lr + 1) * C + C / 2 + 4;
        s += '<text class="sim-axis" x="4" y="' + ny + '" fill="var(--accent)">sale</text>';
      }
      s += '</svg>';
      svgHost.innerHTML = s;

      stats.innerHTML = '';
      var passTok = step > 0 ? rowsOf(step).to - rowsOf(step).from + 1 : 0;
      [['Tokens que entran en esta pasada', step > 0 ? F.num(passTok, 0) : '—'],
       ['Celdas de QKᵀ en esta pasada', step > 0 ? F.num(cellsOf(step), 0) : '—'],
       ['Celdas calculadas en total', F.num(tot.cells, 0)],
       ['Pares K, V calculados en total', F.num(tot.kv, 0)],
       ['K, V guardados en el cache', cache ? F.num(Math.max(0, lr + 1), 0) : '0: se descartan']].forEach(function (x) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
      bPre.disabled = step !== 0;
      bDec.disabled = step === 0 || step >= LAST;
      bAll.disabled = step >= LAST;
    }

    function explain() {
      if (step === 0) {
        note.textContent = 'Cada celda es una comparación entre la consulta de un token (fila) y la clave de otro (columna), por cabeza y por capa. Las celdas punteadas son el futuro: la máscara causal las tapa. Empieza con el prefill.';
        return;
      }
      var out = step < LAST ? '«' + TOKS[NP - 1 + step].trim() + '»' : 'el token de fin';
      if (step === 1) {
        note.textContent = 'Prefill: los ' + NP + ' tokens del prompt entran juntos y se calcula el triángulo entero de una sola vez (' + cellsOf(1) + ' celdas). ' + (cache ? 'Se guardan K y V de los ' + NP + ' tokens.' : 'Sin cache, K y V se usan y se tiran.') + ' De la última fila sale el primer token: ' + out + '.';
        return;
      }
      var r = NP - 2 + step, tok = '«' + TOKS[r].trim() + '»';
      note.textContent = cache
        ? 'Paso de decode ' + (step - 1) + ': entra solo ' + tok + '. Se calculan su Q, K y V, su K y V se agregan al cache, y su fila compara Q con las ' + (r + 1) + ' claves: ' + (r + 1) + ' celdas nuevas. Sale ' + out + '.'
        : 'Paso de decode ' + (step - 1) + ' sin cache: para usar una sola fila hay que volver a procesar los ' + (r + 1) + ' tokens, recalcular K y V de todos y el triángulo entero: ' + cellsOf(step) + ' celdas. Sale ' + out + '.';
    }

    function advance() {
      if (step >= LAST) return false;
      step++;
      var rr = rowsOf(step);
      tot.cells += cellsOf(step);
      tot.kv += rr.to - rr.from + 1;
      explain(); draw();
      return step < LAST;
    }
    function stop() { if (timer) { clearTimeout(timer); timer = null; } bAll.textContent = 'Reproducir todo'; }
    function reset() { stop(); step = 0; tot = { cells: 0, kv: 0 }; explain(); draw(); }
    function setMode(on) {
      cache = on;
      chipOn.setAttribute('aria-pressed', on ? 'true' : 'false');
      chipOff.setAttribute('aria-pressed', on ? 'false' : 'true');
      reset();
    }

    bPre.addEventListener('click', function () { stop(); advance(); });
    bDec.addEventListener('click', function () { stop(); advance(); });
    bReset.addEventListener('click', reset);
    bAll.addEventListener('click', function () {
      if (timer) { stop(); return; }
      if (reduceMotion) { while (advance()) { /* hasta el final */ } return; }
      bAll.textContent = 'Pausar';
      (function loop() {
        if (advance()) timer = setTimeout(loop, 1100);
        else stop();
      })();
    });
    chipOn.addEventListener('click', function () { setMode(true); });
    chipOff.addEventListener('click', function () { setMode(false); });

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [
      h('p', { class: 'sim-title', text: 'La matriz de atención, pasada por pasada' }),
      h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Modo' }, [chipOn, chipOff])
    ]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'btn-row' }, [bPre, bDec, bAll, bReset]),
      svgHost, note, stats
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Una sola cabeza de una sola capa. En Llama 3.1 70B esto pasa en 64 cabezas y 80 capas a la vez. Celeste: lo que calcula la pasada actual; gris: lo calculado en pasadas anteriores.' }));
    reset();
  }

  /* ======================= Costo de una pasada ======================= */

  var RESERVE = 5e9;
  var PIECES = [
    { k: 'proj', name: 'Proyecciones Q, K, V y O', c: 'var(--l-service)' },
    { k: 'attn', name: 'Atención (QKᵀ y suma de V)', c: 'var(--l-cache)' },
    { k: 'mlp', name: 'MLP (gate, up y down)', c: 'var(--l-gpu)' },
    { k: 'head', name: 'LM head', c: 'var(--l-queue)' }
  ];

  /* Modelo de una pasada: P tokens de prefill (de una request con c0 tokens ya en cache) y B usuarios en decode con C
     tokens de contexto cada uno. Cada pieza tarda lo que diga el mayor de sus dos límites, cómputo o memoria, y las
     piezas corren una detrás de otra. Supone tensor parallelism perfecto, sin costo de comunicación. */
  function pass(m, o) {
    var d = m.dModel, f = m.ffn, L = m.layers, V = m.vocab;
    var qd = m.heads * m.headDim, kvd = m.kvHeads * m.headDim;
    var kvTok = 2 * L * kvd * o.kvB, N = o.P + o.B, A = 2;               /* activaciones en BF16 */
    var pa = L * (d * qd + 2 * d * kvd + qd * d), pm = L * 3 * d * f;
    var R = (o.P > 0 ? 1 : 0) + o.B;                                     /* posiciones que necesitan logits */
    var raw = {
      proj: [2 * N * pa, pa * o.wB + N * L * (d + qd + 2 * kvd + qd + d) * A],
      attn: [4 * qd * L * (o.P * o.c0 + o.P * (o.P + 1) / 2) + 4 * qd * L * o.B * o.C,
             (o.P > 0 ? o.P * kvTok + o.P * L * (2 * qd + 2 * kvd) * A + o.c0 * kvTok : 0) + o.B * (o.C + 1) * kvTok],
      mlp: [2 * N * pm, pm * o.wB + N * L * (d + 3 * f + d) * A],
      head: [2 * R * d * V, d * V * o.wB + R * V * A]
    };
    var res = { total: 0, flops: 0, bytes: 0, pieces: {} };
    PIECES.forEach(function (p) {
      var fl = raw[p.k][0], by = raw[p.k][1];
      var tc = fl / o.peak, tm = by / o.bw;
      res.pieces[p.k] = { flops: fl, bytes: by, tc: tc, tm: tm, t: Math.max(tc, tm), bound: tc > tm ? 'cómputo' : 'memoria' };
      res.total += Math.max(tc, tm); res.flops += fl; res.bytes += by;
    });
    res.weights = (pa + pm + 2 * d * V) * o.wB;
    res.kv = (o.B * o.C + o.P + o.c0) * kvTok;
    return res;
  }
  SD.fwdCore = { pass: pass };

  var PRESETS = [
    { name: 'Prefill de 2000 tokens', v: { P: 2000, B: 0, C: 4000 } },
    { name: 'Prompt de 100 tokens', v: { P: 100, B: 0, C: 4000 } },
    { name: 'Decode, 1 usuario', v: { P: 0, B: 1, C: 4000 } },
    { name: 'Decode, 64 usuarios', v: { P: 0, B: 64, C: 4000 } },
    { name: 'Paso mixto', v: { P: 512, B: 64, C: 4000 } }
  ];

  function initCost(host) {
    function select(label, opts, value) {
      var id = 'fw' + (++uid);
      var s = h('select', { id: id });
      opts.forEach(function (o) { s.appendChild(h('option', { value: o[0], text: o[1] })); });
      s.value = value;
      return { el: h('div', { class: 'field' }, [h('label', { for: id, text: label }), s]), input: s };
    }
    function number(label, value, step, hint) {
      var id = 'fw' + (++uid);
      var i = h('input', { id: id, type: 'number', inputmode: 'numeric', min: 0, step: step, value: value });
      var kids = [h('label', { for: id, text: label }), i];
      if (hint) kids.push(h('p', { class: 'field-hint', text: hint }));
      return { el: h('div', { class: 'field' }, kids), input: i };
    }
    var f = {
      model: select('Modelo', ['llama8b', 'llama70b', 'llama405b'].map(function (k) { return [k, LLM.models[k].name]; }), 'llama70b'),
      w: select('Pesos en', [['fp8', 'FP8 (1 byte)'], ['bf16', 'BF16 (2 bytes)']], 'fp8'),
      kv: select('KV cache en', [['bf16', 'BF16 (2 bytes)'], ['fp8', 'FP8 (1 byte)']], 'bf16'),
      gpu: select('GPU', ['a100', 'h100', 'h200', 'b200', 'mi300x'].map(function (k) { return [k, LLM.gpus[k].name]; }), 'h100'),
      n: select('GPUs con tensor parallelism', [1, 2, 4, 8].map(function (x) { return [String(x), String(x)]; }), '4'),
      mfu: number('Eficiencia de cómputo (%)', 40, 5, 'Qué fracción del pico de FLOPS logra el motor. 40 % es razonable en prefill.'),
      P: number('Tokens de prefill en la pasada', 2000, 1, 'El prompt de una request nueva, o un trozo de él.'),
      B: number('Usuarios en decode', 0, 1, 'Cada uno aporta un token a la pasada.'),
      C: number('Contexto de cada usuario en decode (tokens)', 4000, 100)
    };
    var rows = {}, tbody = h('tbody');
    PIECES.forEach(function (p) {
      var cells = [h('td', {}, [h('span', { class: 'fw-dot', style: '--c: ' + p.c }), p.name]), h('td', { class: 'r' }), h('td', { class: 'r' }), h('td', { class: 'r' }), h('td', { class: 'r' }), h('td', {})];
      rows[p.k] = cells;
      tbody.appendChild(h('tr', {}, cells));
    });
    var totalCells = [h('td', {}, [h('b', { text: 'La pasada' })]), h('td', { class: 'r' }), h('td', { class: 'r' }), h('td', { class: 'r' }), h('td', { class: 'r' }), h('td', {})];
    tbody.appendChild(h('tr', { class: 'fw-total' }, totalCells));
    var table = h('div', { class: 'table-wrap' }, [h('table', { class: 't t--mini' }, [
      h('thead', {}, [h('tr', {}, ['Pieza', 'FLOPs', 'Bytes leídos y escritos', 'Por cómputo', 'Por memoria', 'Manda'].map(function (x, i) { return h('th', { class: i > 0 && i < 5 ? 'r' : null, text: x }); }))]),
      tbody
    ])]);
    var bar = h('div', { class: 'fw-bar', 'aria-hidden': 'true' });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });
    var note = h('p', { class: 'calc-note', 'aria-live': 'polite' });

    function v(k) { var x = parseFloat(f[k].input.value); return isFinite(x) && x >= 0 ? x : 0; }

    function compute() {
      var m = LLM.models[f.model.input.value], g = LLM.gpus[f.gpu.input.value], n = +f.n.input.value;
      var wB = LLM.bytes[f.w.input.value], kvB = LLM.bytes[f.kv.input.value];
      var fp8 = f.w.input.value === 'fp8' && g.fp8;
      var o = { wB: wB, kvB: kvB, P: Math.round(v('P')), c0: 0, B: Math.round(v('B')), C: Math.round(v('C')),
        peak: n * (fp8 ? g.fp8 : g.bf16) * Math.max(0.01, Math.min(1, v('mfu') / 100)), bw: n * g.bw };
      if (o.P + o.B === 0) {
        note.textContent = 'La pasada está vacía: pon tokens de prefill, usuarios en decode o las dos cosas.';
        bar.innerHTML = ''; stats.innerHTML = '';
        PIECES.forEach(function (p) { rows[p.k].slice(1).forEach(function (c) { c.textContent = '—'; }); });
        totalCells.slice(1).forEach(function (c) { c.textContent = '—'; });
        return;
      }
      var r = pass(m, o);
      PIECES.forEach(function (p) {
        var x = r.pieces[p.k], c = rows[p.k];
        c[1].textContent = F.words(x.flops);
        c[2].textContent = F.bytes(x.bytes);
        c[3].textContent = F.duration(x.tc);
        c[4].textContent = F.duration(x.tm);
        c[5].textContent = x.bound;
      });
      totalCells[1].textContent = F.words(r.flops);
      totalCells[2].textContent = F.bytes(r.bytes);
      totalCells[3].textContent = '';
      totalCells[4].textContent = '';
      totalCells[5].textContent = F.duration(r.total);

      bar.innerHTML = '';
      PIECES.forEach(function (p) {
        var x = r.pieces[p.k], w = x.t / r.total * 100;
        if (w < 0.2) return;
        bar.appendChild(h('span', { class: 'fw-seg' + (x.bound === 'memoria' ? ' fw-seg--mem' : ''), style: '--c: ' + p.c + '; width: ' + w.toFixed(2) + '%', title: p.name + ': ' + F.duration(x.t) + ', manda ' + x.bound }));
      });

      var ridge = (fp8 ? g.fp8 : g.bf16) / g.bw;
      stats.innerHTML = '';
      var items = [['Tiempo de la pasada', F.duration(r.total)],
        ['Intensidad aritmética', F.num(r.flops / r.bytes, 0) + ' FLOP/byte'],
        ['Punto de quiebre de la GPU', F.num(ridge, 0) + ' FLOP/byte']];
      if (o.B > 0) items.push(['Tokens/s de cada usuario en decode', F.num(1 / r.total, 0)], ['Tokens de salida por segundo', F.num(o.B / r.total, 0)]);
      if (o.P > 0) items.push(['Tokens de prompt por segundo', F.num(o.P / r.total, 0)]);
      items.forEach(function (x) { stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })])); });

      var msgs = [];
      var free = n * (g.mem - RESERVE) - r.weights;
      if (r.weights + r.kv > n * (g.mem - RESERVE)) msgs.push('No cabe: pesos (' + F.bytes(r.weights) + ') más KV cache (' + F.bytes(r.kv) + ') superan la memoria de ' + n + ' × ' + g.name + ' con 5 GB de reserva por GPU. Libres para KV: ' + F.bytes(Math.max(0, free)) + '.');
      if (f.w.input.value === 'fp8' && !g.fp8) msgs.push('La A100 no tiene tensor cores FP8: guarda los pesos en FP8 pero calcula en BF16.');
      var mem = PIECES.filter(function (p) { return r.pieces[p.k].bound === 'memoria'; }).length;
      if (mem === PIECES.length) msgs.push('Toda la pasada espera a la memoria: el cómputo está casi ocioso. Más tokens por pasada (más usuarios o un trozo de prefill) saldrían casi gratis, salvo por la atención, que lee un KV distinto por usuario.');
      else if (mem === 0 || (mem === 1 && r.pieces.head.bound === 'memoria')) msgs.push('La pasada está limitada por cómputo: cada token más cuesta tiempo en proporción.');
      note.textContent = msgs.join(' ');
    }

    var presetBar = h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Ejemplos precargados' });
    PRESETS.forEach(function (p, i) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': i === 0 ? 'true' : 'false', text: p.name });
      b.addEventListener('click', function () {
        presetBar.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        Object.keys(p.v).forEach(function (k) { f[k].input.value = p.v[k]; });
        compute();
      });
      presetBar.appendChild(b);
    });
    var inCol = h('div', { class: 'calc-inputs' });
    Object.keys(f).forEach(function (k) {
      inCol.appendChild(f[k].el);
      f[k].input.addEventListener(f[k].input.tagName === 'SELECT' ? 'change' : 'input', compute);
    });
    var legend = h('p', { class: 'fw-legend' }, PIECES.map(function (p) { return h('span', {}, [h('span', { class: 'fw-dot', style: '--c: ' + p.c }), p.name]); }).concat([h('span', {}, [h('span', { class: 'fw-dot fw-dot--mem' }), 'rayado: manda la memoria'])]));
    var outCol = h('div', { class: 'calc-outputs' }, [bar, legend, stats, note]);

    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Dónde se va el tiempo de una pasada' }), presetBar]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('div', { class: 'calc-pad' }, [table]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Límite teórico: el cómputo al porcentaje elegido del pico de FLOPS y la memoria al 100 % del ancho de banda de HBM. Cada pieza tarda lo que diga el mayor de sus dos límites, y las piezas corren en serie. No cuenta la comunicación entre GPUs, el lanzamiento de kernels ni las normas y el embedding, que son chicos.' }));
    compute();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="attnrows"]').forEach(initAttn);
    document.querySelectorAll('[data-calc="fwdcost"]').forEach(initCost);
  });
})();
