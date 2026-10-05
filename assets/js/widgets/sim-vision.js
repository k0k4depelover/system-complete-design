/* Widgets del M23 (imágenes y multimodal):
   <div data-calc="imgtokens">   cuántos tokens cuesta una imagen según el proveedor y el modo, con la grilla dibujada y el efecto de reescalar
   <div data-calc="imgfleet">    cuántas GPUs necesita un servicio de generación de imágenes, cuánto cuesta y cuánto espera un job en el pico (Erlang C)
   <div data-sim="imgjob">       el viaje de un job de generación en cuatro escenas (SD.flowAnim de sim-dbflow.js)
   La lógica pura está en SD.visionCore, sin DOM, para probarla en Node. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  /* ======================= Lógica pura ======================= */

  /* Redondeo al par, como round() de Python (lo usa la referencia de Anthropic) */
  function rhe(x) {
    var f = Math.floor(x), d = x - f;
    if (d > 0.5) return f + 1;
    if (d < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
  }

  /* Anthropic: un token por bloque de 28 × 28 px */
  function aTokens(w, h) { return Math.ceil(w / 28) * Math.ceil(h / 28); }

  /* Tamaño al que Anthropic achica una imagen: búsqueda binaria sobre el lado largo */
  function aResized(w, h, maxEdge, maxTokens) {
    function fits(w, h) {
      return Math.ceil(w / 28) * 28 <= maxEdge && Math.ceil(h / 28) * 28 <= maxEdge && aTokens(w, h) <= maxTokens;
    }
    if (fits(w, h)) return [w, h];
    if (h > w) { var r = aResized(h, w, maxEdge, maxTokens); return [r[1], r[0]]; }
    var ar = w / h, lo = 1, hi = w;
    while (lo + 1 < hi) {
      var mid = Math.floor((lo + hi) / 2);
      if (fits(mid, Math.max(rhe(mid / ar), 1))) lo = mid; else hi = mid;
    }
    return [lo, Math.max(rhe(lo / ar), 1)];
  }

  var TIERS = { hi: [2576, 4784], std: [1568, 1568] };

  function anth(w, h, tier) {
    var t = TIERS[tier], r = aResized(w, h, t[0], t[1]);
    return { w: r[0], h: r[1], cell: 28, cols: Math.ceil(r[0] / 28), rows: Math.ceil(r[1] / 28), tokens: aTokens(r[0], r[1]) };
  }

  /* OpenAI, modelos por parches de 32 × 32 px */
  function oaPatch(w, h, maxDim, budget, mult) {
    var s = Math.min(1, maxDim / Math.max(w, h));
    var w1 = s < 1 ? w * s : w, h1 = s < 1 ? h * s : h;
    w1 = Math.floor(w1 + 1e-9); h1 = Math.floor(h1 + 1e-9);
    var p = Math.ceil(w1 / 32) * Math.ceil(h1 / 32);
    if (p > budget) {
      var sh = Math.sqrt(32 * 32 * budget / (w1 * h1));
      var fx = w1 * sh / 32, fy = h1 * sh / 32;
      var adj = sh * Math.min(Math.floor(fx) / fx, Math.floor(fy) / fy);
      w1 = Math.floor(w1 * adj + 1e-9); h1 = Math.floor(h1 * adj + 1e-9);
      p = Math.ceil(w1 / 32) * Math.ceil(h1 / 32);
    }
    return { w: w1, h: h1, cell: 32, cols: Math.ceil(w1 / 32), rows: Math.ceil(h1 / 32), patches: p,
      tokens: Math.ceil(p * mult - 1e-9), rejected: p > 30000 };
  }

  /* OpenAI, modelos por tiles de 512 px (gpt-4o, gpt-4.1) */
  function oaTile(w, h, base, tile, detail) {
    if (detail === 'low') return { w: w, h: h, cell: 0, cols: 0, rows: 0, tiles: 0, tokens: base };
    var s = Math.min(1, 2048 / Math.max(w, h));
    var w1 = Math.floor(w * s), h1 = Math.floor(h * s), short = Math.min(w1, h1);
    if (short > 768) {
      var k = 768 / short;
      if (w1 <= h1) { h1 = Math.floor(h1 * k); w1 = 768; } else { w1 = Math.floor(w1 * k); h1 = 768; }
    }
    var cols = Math.ceil(w1 / 512), rows = Math.ceil(h1 / 512);
    return { w: w1, h: h1, cell: 512, cols: cols, rows: rows, tiles: cols * rows, tokens: base + tile * cols * rows };
  }

  /* Los modos de la calculadora */
  var MODES = {
    'a-hi': { name: 'Anthropic, alta resolución (Claude 4.7 y posteriores)', unit: 'bloques de 28 px', f: function (w, h) { return anth(w, h, 'hi'); } },
    'a-std': { name: 'Anthropic, nivel estándar', unit: 'bloques de 28 px', f: function (w, h) { return anth(w, h, 'std'); } },
    'o-high': { name: 'OpenAI gpt-5.5, detail high', unit: 'parches de 32 px', f: function (w, h) { return oaPatch(w, h, 2048, 2500, 1.2); } },
    'o-low': { name: 'OpenAI gpt-5.5, detail low', unit: 'parches de 32 px', f: function (w, h) { return oaPatch(w, h, 512, 1e12, 1.2); } },
    'o-orig': { name: 'OpenAI gpt-5.5, detail original', unit: 'parches de 32 px', f: function (w, h) { return oaPatch(w, h, 6000, 10000, 1.2); } },
    't-high': { name: 'OpenAI gpt-4.1, detail high (tiles)', unit: 'tiles de 512 px', f: function (w, h) { return oaTile(w, h, 85, 170, 'high'); } },
    't-low': { name: 'OpenAI gpt-4.1, detail low', unit: 'solo la base', f: function (w, h) { return oaTile(w, h, 85, 170, 'low'); } },
    'g3': { name: 'Gemini 3, media_resolution por defecto', unit: 'tope fijo por imagen', f: function (w, h) { return { w: w, h: h, cell: 0, cols: 0, rows: 0, tokens: 1120, fixed: true }; } }
  };

  /* Bytes aproximados de un JPEG (bits por píxel) y su versión en base64 */
  function jpegBytes(w, h, bpp) { return w * h * (bpp || 2) / 8; }

  /* Erlang C: probabilidad de esperar con c servidores y carga ofrecida A = λ·S */
  function erlangC(c, A) {
    if (A >= c) return 1;
    var b = 1;
    for (var k = 1; k <= c; k++) b = A * b / (k + A * b);
    return c * b / (c - A * (1 - b));
  }

  /* Espera de un job: probabilidad, media y p95 (cola M/M/c) */
  function wait(lam, S, c) {
    var A = lam * S;
    if (A >= c) return { C: 1, mean: Infinity, p95: Infinity };
    var C = erlangC(c, A), rate = c / S - lam;
    return { C: C, mean: C / rate, p95: C > 0.05 ? Math.log(C / 0.05) / rate : 0 };
  }

  /* La flota de GPUs de un servicio de generación */
  function fleet(p) {
    var avg = p.day / 86400, peak = avg * p.peakFactor, busy = peak * p.S;
    var gpus = Math.ceil(busy / p.util - 1e-9);
    var costMonth = gpus * p.gpuHour * 730, imgsMonth = p.day * 730 / 24;
    var w = wait(peak, p.S, gpus);
    var spare = gpus * p.util * 86400 - p.day * p.S;
    return { avg: avg, peak: peak, busy: busy, gpus: gpus, costMonth: costMonth, perImage: costMonth / imgsMonth,
      avgUse: avg * p.S / gpus, pWait: w.C, meanWait: w.mean, p95: w.p95, spareImgs: Math.max(0, spare / p.S) };
  }

  SD.visionCore = { rhe: rhe, aTokens: aTokens, aResized: aResized, anth: anth, oaPatch: oaPatch, oaTile: oaTile,
    MODES: MODES, jpegBytes: jpegBytes, erlangC: erlangC, wait: wait, fleet: fleet };

  if (typeof document === 'undefined') return;   /* en Node solo se usa la lógica */

  /* ======================= Piezas de formulario ======================= */

  var uid = 0;
  function num(label, value, step, hint) {
    var id = 'vi' + (++uid);
    var i = h('input', { id: id, type: 'number', min: 0, step: step, value: value, inputmode: 'decimal' });
    var kids = [h('label', { for: id, text: label }), i];
    if (hint) kids.push(h('p', { class: 'field-hint', text: hint }));
    return { el: h('div', { class: 'field' }, kids), input: i };
  }
  function sel(label, opts, def) {
    var id = 'vi' + (++uid);
    var s = h('select', { id: id }, opts.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    s.value = String(def);
    return { el: h('div', { class: 'field' }, [h('label', { for: id, text: label }), s]), input: s };
  }
  function out(label, formula) {
    var v = h('output', { class: 'out-value' });
    return { el: h('div', { class: 'out-row' }, [h('span', { class: 'out-label', text: label }), v, h('span', { class: 'out-formula', text: formula })]), v: v };
  }
  function presetChips(list, onPick, aria) {
    var box = h('div', { class: 'calc-presets', role: 'group', 'aria-label': aria });
    list.forEach(function (p, i) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': i === 0 ? 'true' : 'false', text: p.name });
      b.addEventListener('click', function () {
        box.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        onPick(p);
      });
      box.appendChild(b);
    });
    box.clear = function () { box.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); };
    return box;
  }
  function x(a, b) { return F.num(a, 0) + ' × ' + F.num(b, 0); }

  /* ======================= Calculadora de tokens por imagen ======================= */

  var IMGS = [
    { name: 'Foto de teléfono', w: 4032, h: 3024 },
    { name: 'Reescalada en el cliente', w: 1568, h: 1176 },
    { name: 'Captura de pantalla', w: 2560, h: 1600 },
    { name: 'Página A4 a 130 DPI', w: 1075, h: 1520 },
    { name: 'Video 4K', w: 3840, h: 2160 }
  ];

  function initImgTokens(host) {
    var f = {
      w: num('Ancho (px)', 4032, 1),
      h: num('Alto (px)', 3024, 1),
      mode: sel('Proveedor y modo', Object.keys(MODES).map(function (k) { return [k, MODES[k].name]; }), 'a-hi'),
      price: num('Precio de entrada (USD por millón de tokens)', 2, 0.1, 'El de Sonnet 5.5 en el M21. Cámbialo por el de tu modelo.')
    };
    var o = {
      seen: out('Lo que ve el modelo', 'se achica sin agrandar y conservando la proporción'),
      grid: out('Grilla', 'columnas × filas'),
      tokens: out('Tokens de la imagen', ''),
      cost: out('Costo por imagen', 'tokens × precio ÷ 1 000 000'),
      bytes: out('Bytes que viajan (JPEG a 2 bits por píxel)', 'el archivo y su versión en base64 (× 4/3)'),
      resize: out('Si la reescalas antes de mandarla', 'al tamaño que ve el modelo')
    };
    var chart = h('div', { class: 'sim-scroll vis-chart' });
    var chips = presetChips(IMGS, function (p) { f.w.input.value = p.w; f.h.input.value = p.h; run(); }, 'Imágenes de ejemplo');

    function draw(ow, oh, r, m) {
      var W = 620, H = 260, l = 14, t = 34, aw = W - 2 * l, ah = H - t - 14;
      var k = Math.min(aw / ow, ah / oh);
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="La imagen que mandas y la que ve el modelo, con su grilla">';
      s += '<rect x="' + l + '" y="' + t + '" width="' + (ow * k).toFixed(1) + '" height="' + (oh * k).toFixed(1) + '" fill="none" stroke="var(--label-3)" stroke-width="1.5" stroke-dasharray="6 4"/>';
      var rw = r.w * k, rh = r.h * k;
      s += '<rect x="' + l + '" y="' + t + '" width="' + rw.toFixed(1) + '" height="' + rh.toFixed(1) + '" style="fill: var(--fill-2); stroke: var(--l-gpu)" stroke-width="2"/>';
      var note = '';
      if (r.cell) {
        var c = r.cell * k, step = Math.max(1, Math.ceil(3 / c));
        var gw = r.cols * c, gh = r.rows * c, d = '';
        for (var i = step; i < r.cols; i += step) d += 'M' + (l + i * c).toFixed(1) + ' ' + t + ' V' + (t + gh).toFixed(1) + ' ';
        for (var j = step; j < r.rows; j += step) d += 'M' + l + ' ' + (t + j * c).toFixed(1) + ' H' + (l + gw).toFixed(1) + ' ';
        s += '<path d="' + d + '" fill="none" stroke="var(--l-gpu)" stroke-width="0.8" opacity="0.55"/>';
        if (gw - rw > 0.5 || gh - rh > 0.5) s += '<rect x="' + l + '" y="' + t + '" width="' + gw.toFixed(1) + '" height="' + gh.toFixed(1) + '" fill="none" stroke="var(--l-gpu)" stroke-width="1" stroke-dasharray="2 2"/>';
        if (step > 1) note = ' · se dibuja una de cada ' + step + ' líneas';
      }
      s += '<text class="sim-label" x="' + l + '" y="16">Lo que ve el modelo: ' + x(r.w, r.h) + ' px' + (r.cell ? ', ' + x(r.cols, r.rows) + ' ' + (r.cell === 512 ? 'tiles' : r.cell === 32 ? 'parches' : 'bloques') : '') + note + '</text>';
      if (r.w !== ow || r.h !== oh) {
        var tx = Math.min(l + ow * k - 6, W - l - 4), ty = t + oh * k - 8;
        s += '<text class="sim-axis" x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" text-anchor="end">lo que mandas: ' + x(ow, oh) + ' px</text>';
      }
      if (r.fixed) s += '<text class="sim-val" x="' + (l + rw / 2).toFixed(1) + '" y="' + (t + rh / 2).toFixed(1) + '" text-anchor="middle">tope fijo: no depende del tamaño</text>';
      if (!r.cell && !r.fixed) s += '<text class="sim-val" x="' + (l + rw / 2).toFixed(1) + '" y="' + (t + rh / 2).toFixed(1) + '" text-anchor="middle">baja resolución: solo la base</text>';
      chart.innerHTML = s + '</svg>';
    }

    function v(k) { var n = parseFloat(f[k].input.value); return isFinite(n) && n > 0 ? n : 0; }
    function run() {
      var w = Math.round(v('w')), hh = Math.round(v('h')), m = MODES[f.mode.input.value], price = v('price');
      if (!w || !hh) { Object.keys(o).forEach(function (k) { o[k].v.textContent = '—'; }); chart.innerHTML = ''; return; }
      var tooBig = f.mode.input.value.charAt(0) === 'a' && (w > 8000 || hh > 8000);
      var r = m.f(w, hh);
      o.grid.v.nextSibling.textContent = m.unit;
      if (tooBig || r.rejected) {
        o.seen.v.textContent = 'Rechazada';
        o.seen.v.nextSibling.textContent = tooBig ? 'más de 8 000 px por lado' : 'más de 30 000 parches';
        ['grid', 'tokens', 'cost', 'resize'].forEach(function (k) { o[k].v.textContent = '—'; });
        chart.innerHTML = '';
      } else {
        var shrink = r.w !== w || r.h !== hh;
        o.seen.v.textContent = x(r.w, r.h) + ' px';
        o.seen.v.nextSibling.textContent = shrink ? 'el ' + F.num(r.w / w * 100, 0) + '\u202F% del ancho; se achica conservando la proporción' : 'sin cambios: ya cabe en los límites';
        o.grid.v.textContent = r.fixed ? 'no aplica' : r.cell ? x(r.cols, r.rows) + ' = ' + F.num(r.cols * r.rows, 0) : 'ninguna';
        var tf = r.cell === 512 ? '85 + 170 × tiles' : r.cell === 32 ? 'parches × 1.2, redondeado hacia arriba' : r.cell === 28 ? 'columnas × filas' : r.fixed ? 'el máximo de media_resolution' : 'la base del modelo';
        o.tokens.v.nextSibling.textContent = tf;
        o.tokens.v.textContent = F.num(r.tokens, 0);
        var c = r.tokens * price / 1e6;
        o.cost.v.textContent = F.num(c, 5) + ' USD';
        o.cost.v.nextSibling.textContent = F.num(c * 1000, 2) + ' USD por mil; tokens × precio ÷ 1 000 000';
        var rb = jpegBytes(r.w, r.h);
        o.resize.v.textContent = shrink ? F.bytes(rb) : 'No hace falta';
        o.resize.v.nextSibling.textContent = shrink ? F.bytes(rb * 4 / 3) + ' en base64, con los mismos tokens' : 'ya está en el tamaño que ve el modelo';
        draw(w, hh, r, m);
      }
      var b = jpegBytes(w, hh);
      o.bytes.v.textContent = F.bytes(b);
      o.bytes.v.nextSibling.textContent = F.bytes(b * 4 / 3) + ' en base64 (× 4/3)';
    }

    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    Object.keys(f).forEach(function (k) {
      inCol.appendChild(f[k].el);
      f[k].input.addEventListener(f[k].input.tagName === 'SELECT' ? 'change' : 'input', function () { if (k === 'w' || k === 'h') chips.clear(); run(); });
    });
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Cuántos tokens cuesta una imagen' }), chips]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('div', { class: 'vis-chart-wrap' }, [chart]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Reglas de la documentación de cada proveedor en octubre de 2026: Anthropic achica hasta que la imagen quepa en el lado máximo y en el tope de tokens; OpenAI cuenta parches de 32 px con un presupuesto y un multiplicador por modelo, o tiles de 512 px en los modelos anteriores; Gemini 3 usa un tope fijo por imagen. Los bytes suponen un JPEG de calidad media.' }));
    run();
  }

  /* ======================= Calculadora de la flota de generación ======================= */

  var GEN = [
    { name: 'DiT de 12B, 50 pasos en FP8', S: 7.0 },
    { name: 'Destilado, 4 pasos', S: 0.56 },
    { name: 'SDXL en H200 (MLPerf)', S: 0.46 }
  ];

  function initImgFleet(host) {
    var f = {
      day: num('Imágenes por día', 3000000, 100000),
      peak: num('Pico sobre el promedio (veces)', 2, 0.1),
      S: num('Segundos de GPU por imagen', 7.0, 0.01, 'Elige un modelo arriba o escribe el tuyo.'),
      util: num('Utilización objetivo en el pico (%)', 70, 1),
      price: num('Precio de una GPU (USD por hora)', 4, 0.1, 'La H100 del M21.')
    };
    var o = {
      rate: out('Imágenes por segundo en el pico', ''),
      busy: out('GPUs ocupadas en el pico', 'pico × segundos de GPU (ley de Little)'),
      gpus: out('GPUs que provisionas', ''),
      cost: out('Costo al mes', 'GPUs × precio × 730 h'),
      per: out('Costo por imagen', ''),
      wait: out('Jobs que esperan en el pico', ''),
      spare: out('Batch que cabe en el valle', 'imágenes por día: capacidad libre del día ÷ segundos por imagen')
    };
    var chips = presetChips(GEN, function (p) { f.S.input.value = p.S; run(); }, 'Modelos de ejemplo');
    function v(k) { var n = parseFloat(f[k].input.value); return isFinite(n) && n > 0 ? n : 0; }
    function run() {
      var p = { day: v('day'), peakFactor: Math.max(1, v('peak')), S: v('S'), util: Math.min(99, v('util')) / 100, gpuHour: v('price') };
      if (!p.day || !p.S || !p.util) { Object.keys(o).forEach(function (k) { o[k].v.textContent = '—'; }); return; }
      var r = fleet(p);
      o.rate.v.textContent = F.num(r.peak, 2);
      o.rate.v.nextSibling.textContent = F.num(r.avg, 2) + ' en promedio × el factor de pico';
      o.busy.v.textContent = F.num(r.busy, 1);
      o.gpus.v.textContent = F.num(r.gpus, 0);
      o.gpus.v.nextSibling.textContent = F.num(Math.ceil(r.gpus / 8), 0) + ' nodos de 8; ocupadas ÷ utilización objetivo';
      o.cost.v.textContent = F.num(r.costMonth, 0) + ' USD';
      o.per.v.textContent = F.num(r.perImage, 4) + ' USD';
      o.per.v.nextSibling.textContent = 'uso promedio de la flota: ' + F.num(r.avgUse * 100, 0) + '\u202F%; costo al mes ÷ imágenes al mes';
      o.wait.v.textContent = r.pWait < 0.0005 ? 'casi ninguno' : F.num(r.pWait * 100, 1) + '\u202F%';
      o.wait.v.nextSibling.textContent = 'Erlang C; espera p95: ' + (r.pWait < 0.0005 || !r.p95 ? 'menos de un segundo' : F.num(r.p95, 1) + ' s');
      o.spare.v.textContent = F.num(r.spareImgs, 0);
    }
    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    Object.keys(f).forEach(function (k) {
      inCol.appendChild(f[k].el);
      f[k].input.addEventListener('input', function () { if (k === 'S') chips.clear(); run(); });
    });
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Cuántas GPUs para generar imágenes' }), chips]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Una GPU por imagen, sin batching entre jobs; los tiempos de servicio se tratan como exponenciales (M/M/c), así que la espera real es algo menor. El valle es la capacidad que sobra durante el día con la flota dimensionada para el pico. SDXL es de MLPerf (8 H200, 17.42 imágenes por segundo); los otros dos son estimaciones del texto.' }));
    run();
  }

  /* ======================= Escenas de SD.flowAnim ======================= */

  function M(f, t, k, l) { return [f, t, k, l]; }
  function S(m, say, set) { return { m: m, say: say, set: set || null }; }

  var NJ = {
    C: { x: 8, y: 124, w: 132, h: 84, name: 'Cliente', sub: 'backend de la app', c: '--l-client' },
    A: { x: 188, y: 124, w: 150, h: 84, name: 'API de jobs', sub: 'crea y consulta', c: '--l-service' },
    Q: { x: 188, y: 14, w: 150, h: 84, name: 'Cola', sub: 'por prioridad', c: '--l-queue' },
    W: { x: 386, y: 14, w: 150, h: 84, name: 'Worker de GPU', sub: 'genera la imagen', c: '--l-gpu' },
    S3: { x: 584, y: 14, w: 142, h: 84, name: 'S3', sub: 'imágenes', c: '--l-db' },
    D: { x: 386, y: 124, w: 150, h: 84, name: 'Estado de jobs', sub: 'image_jobs', c: '--l-db' },
    MO: { x: 584, y: 124, w: 142, h: 84, name: 'Moderación', sub: 'de la salida', c: '--l-external' },
    N: { x: 8, y: 234, w: 132, h: 84, name: 'Webhooks', sub: 'firma y reintenta', c: '--l-edge' },
    K: { x: 386, y: 234, w: 150, h: 84, name: 'Uso', sub: 'eventos (M21)', c: '--l-queue' }
  };
  var EJ = [['C', 'A'], ['A', 'Q'], ['A', 'D'], ['Q', 'W'], ['W', 'S3'], ['W', 'D'], ['W', 'MO'], ['A', 'N'], ['N', 'C'], ['D', 'K']];

  var JOB = {
    title: 'El viaje de un job de generación', aria: 'Cliente, API de jobs, cola, worker de GPU, S3, estado de jobs, moderación, webhooks y eventos de uso', vbw: 734, vbh: 330,
    scenes: [
      { id: 'normal', name: 'Un job normal', nodes: NJ, edges: EJ,
        def: 'Generar una imagen tarda segundos de GPU, así que la API no espera: crea un job, responde 202 y avisa cuando termina.',
        rows: [['La clave', 'Cada transición del job es una escritura en la tabla de estado; el aviso y el evento de uso salen de esa misma escritura.']],
        steps: [
          S([M('C', 'A', 'req', 'POST /v1/images/jobs')], 'El cliente manda el prompt con una <code>Idempotency-Key</code>. La API valida los parámetros y pasa el prompt por el clasificador barato, antes de gastar GPU.', { A: { st: 'on', v: ['prompt aprobado'] } }),
          S([M('A', 'D', 'write', 'INSERT queued'), M('A', 'Q', 'req', 'job_8f3')], 'Guarda el job como <code>queued</code> y lo encola en la clase interactiva.', { D: { st: 'on', v: ['job_8f3 queued'] }, Q: { st: 'on', v: ['1 job interactivo'] } }),
          S([M('A', 'C', 'res', '202 + job_8f3')], 'Responde <code>202 Accepted</code> con el id y un <code>Location</code> para consultarlo. La conexión se cierra: nadie espera 7 segundos con un socket abierto.', { A: { st: '', v: [] }, C: { st: 'on', v: ['esperando aviso'] } }),
          S([M('Q', 'W', 'req', 'job_8f3'), M('W', 'D', 'write', 'running + lease')], 'Un worker toma el job, lo marca <code>running</code> y se queda con un lease: si no lo renueva, el job vuelve a la cola.', { Q: { st: '', v: [] }, W: { st: 'on', v: ['50 pasos', '7 s de GPU'] }, D: { v: ['job_8f3 running'] } }),
          S([M('W', 'MO', 'req', 'imagen generada'), M('MO', 'W', 'ok', 'aprobada')], 'Antes de guardar nada, la imagen pasa por la moderación de salida.', { MO: { st: 'ok', v: ['aprobada'] } }),
          S([M('W', 'S3', 'write', 'PUT jobs/8f3.png'), M('W', 'D', 'write', 'succeeded')], 'La imagen se guarda con una clave que sale del id del job, y el job pasa a <code>succeeded</code>.', { S3: { st: 'ok', v: ['jobs/8f3.png'] }, W: { st: '', v: [] }, D: { st: 'ok', v: ['job_8f3 succeeded'] }, MO: { st: '' } }),
          S([M('D', 'K', 'async', 'uso: 1 imagen'), M('A', 'N', 'async', 'job.succeeded')], 'En la misma transacción se escriben el evento de uso y el aviso (el outbox del M07).', { K: { st: 'ok', v: ['1 imagen high'] }, N: { st: 'on', v: ['1 aviso'] } }),
          S([M('N', 'C', 'res', 'webhook firmado')], 'El cliente recibe un webhook firmado, verifica la firma y pide el resultado: la API le devuelve una URL firmada que vence en minutos.', { N: { st: 'ok', v: ['entregado'] }, C: { st: 'ok', v: ['imagen lista'] } })
        ] },
      { id: 'muere', name: 'El worker muere a mitad', nodes: NJ, edges: EJ, init: { D: { st: 'on', v: ['job_8f3 queued'] }, Q: { st: 'on', v: ['1 job'] } },
        def: 'Un worker de GPU puede morir en cualquier paso: un error de la GPU, un nodo spot que se va, un OOM.',
        rows: [['La regla', 'El job se reintenta, pero el resultado se escribe una sola vez: clave de S3 determinista, transición condicionada al lease y evento de uso con el id del job.']],
        steps: [
          S([M('Q', 'W', 'req', 'job_8f3'), M('W', 'D', 'write', 'lease 60 s')], 'Un worker toma el job con un lease de 60 segundos, que renueva mientras genera.', { W: { st: 'on', v: ['paso 31 de 50'] }, D: { v: ['running, intento 1'] }, Q: { st: '', v: ['en vuelo'] } }),
          S([], 'La GPU tira un error y el proceso muere. No escribe nada: ni la imagen ni el estado.', { W: { st: 'down', v: ['sin renovar'] } }),
          S([], 'El lease vence. El job vuelve a ser visible en la cola, como un mensaje de SQS cuando vence su visibility timeout.', { Q: { st: 'warn', v: ['visible de nuevo'] }, D: { st: 'warn', v: ['lease vencido'] } }),
          S([M('Q', 'W', 'req', 'job_8f3, intento 2'), M('W', 'D', 'write', 'lease 60 s')], 'Otro worker lo toma. El intento queda contado: si un job falla tres veces, va a la DLQ en lugar de matar GPUs para siempre.', { W: { st: 'on', v: ['otro worker', 'intento 2'] }, Q: { st: '', v: [] }, D: { st: 'on', v: ['running, intento 2'] } }),
          S([M('W', 'S3', 'write', 'PUT jobs/8f3.png'), M('W', 'D', 'write', 'succeeded si lease=mío')], 'Escribe en la misma clave y cierra el job con un <code>UPDATE</code> condicionado a su lease, como un fencing token.', { S3: { st: 'ok', v: ['1 objeto'] }, D: { st: 'ok', v: ['succeeded, 1 vez'] }, W: { st: '', v: [] } }),
          S([M('D', 'K', 'async', 'uso: job_8f3')], 'El evento de uso lleva el id del job como clave de idempotencia: aunque se emitiera dos veces, se factura una. Si el primer worker no había muerto sino que estaba colgado y vuelve, su <code>UPDATE</code> con el lease viejo no toca ninguna fila.', { K: { st: 'ok', v: ['1 imagen'] } })
        ] },
      { id: 'bloqueo', name: 'La moderación bloquea la salida', nodes: NJ, edges: EJ,
        def: 'Un prompt inocente puede producir una imagen que viola la política. La moderación de entrada no alcanza.',
        rows: [['El costo', 'La GPU ya trabajó. Bloquear después de generar es caro pero necesario; por eso conviene cortar antes todo lo que se pueda.']],
        steps: [
          S([M('C', 'A', 'req', 'POST /v1/images/jobs'), M('A', 'Q', 'req', 'job_2c1')], 'El prompt pasa el clasificador de entrada y el job se encola.', { A: { st: 'ok', v: ['prompt aprobado'] }, Q: { st: 'on', v: ['1 job'] } }),
          S([M('Q', 'W', 'req', 'job_2c1')], 'El worker genera la imagen: 7 segundos de GPU.', { A: { st: '', v: [] }, Q: { st: '', v: [] }, W: { st: 'on', v: ['generando'] } }),
          S([M('W', 'MO', 'req', 'imagen generada'), M('MO', 'W', 'fail', 'bloqueada')], 'El clasificador de salida la marca. La imagen no se sube a S3 ni se entrega.', { MO: { st: 'fail', v: ['bloqueada'] }, W: { st: 'warn', v: ['descartada'] } }),
          S([M('W', 'D', 'write', 'failed: content_policy')], 'El job termina en <code>failed</code> con un código que el cliente entiende. No se le muestra la imagen ni por qué exactamente: eso enseñaría a esquivar el filtro.', { D: { st: 'fail', v: ['content_policy'] }, W: { st: '', v: [] } }),
          S([M('D', 'K', 'async', 'costo interno')], 'Diseño de referencia: al cliente no se le cobra, pero los 7 segundos de GPU quedan en el metering interno, para saber cuánto cuesta moderar.', { K: { st: 'warn', v: ['0 USD al cliente', '7 s de GPU'] } }),
          S([M('A', 'N', 'async', 'job.failed'), M('N', 'C', 'res', 'webhook: failed')], 'El cliente recibe el aviso del fallo. Una cuenta con muchos bloqueos seguidos entra en revisión.', { N: { st: 'ok', v: ['entregado'] }, C: { st: 'warn', v: ['content_policy'] }, MO: { st: '' } })
        ] },
      { id: 'vuelve', name: 'El cliente no está', nodes: NJ, edges: EJ,
        def: 'El cliente que pidió la imagen puede no estar cuando el job termina: un deploy, una caída, un teléfono sin señal.',
        rows: [['La regla', 'El resultado no depende de que el aviso llegue. El webhook se reintenta con backoff, y el cliente siempre puede consultar el job.']],
        steps: [
          S([M('C', 'A', 'req', 'POST /v1/images/jobs'), M('A', 'C', 'res', '202 + job_7d9')], 'El cliente crea el job y guarda el id.', { C: { st: 'on', v: ['guardó job_7d9'] }, D: { st: 'on', v: ['job_7d9 queued'] } }),
          S([M('Q', 'W', 'req', 'job_7d9'), M('W', 'S3', 'write', 'PUT jobs/7d9.png'), M('W', 'D', 'write', 'succeeded')], 'El job corre y termina bien.', { S3: { st: 'ok', v: ['jobs/7d9.png'] }, D: { st: 'ok', v: ['job_7d9 succeeded'] }, C: { st: 'warn', v: ['en un deploy'] } }),
          S([M('A', 'N', 'async', 'job.succeeded'), M('N', 'C', 'fail', '503')], 'El webhook falla: el backend del cliente está en medio de un deploy.', { N: { st: 'warn', v: ['otro en 30 s'] } }),
          S([M('N', 'C', 'fail', 'timeout')], 'El segundo intento también falla. Los reintentos siguen con backoff exponencial y jitter durante horas.', { N: { st: 'warn', v: ['otro en 2 min'] } }),
          S([M('C', 'A', 'req', 'GET /v1/images/jobs/7d9'), M('A', 'C', 'res', '200 succeeded + URL')], 'El cliente vuelve y consulta los jobs que tenía pendientes: el polling es la red de seguridad del webhook.', { C: { st: 'ok', v: ['imagen lista'] } }),
          S([M('N', 'C', 'res', 'webhook, intento 3')], 'El tercer intento llega. El cliente reconoce el id del evento, que ya procesó, y lo descarta.', { N: { st: 'ok', v: ['entregado'] }, C: { st: 'ok', v: ['ya procesado'] } })
        ] }
    ]
  };

  SD.ready(function () {
    document.querySelectorAll('[data-calc="imgtokens"]').forEach(initImgTokens);
    document.querySelectorAll('[data-calc="imgfleet"]').forEach(initImgFleet);
    if (SD.flowAnim) document.querySelectorAll('[data-sim="imgjob"]').forEach(function (el) { SD.flowAnim(el, JOB); });
  });
})();
