/* Widget del M14 (cuantización):
   <div data-sim="quant">  cuantiza 64 pesos de ejemplo a INT8, INT4, FP8 (E4M3) o FP4 (E2M1), con escala por tensor o por grupo,
                           y muestra el error que queda. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  /* Valores positivos representables de FP8 E4M3 (sesgo 7, sin infinito; el máximo es 448) y de FP4 E2M1 */
  var E4M3 = (function () {
    var v = [];
    for (var e = 0; e < 16; e++) for (var m = 0; m < 8; m++) {
      if (e === 15 && m === 7) continue;                  /* NaN */
      v.push(e === 0 ? (m / 8) * Math.pow(2, -6) : (1 + m / 8) * Math.pow(2, e - 7));
    }
    return v.sort(function (a, b) { return a - b; });
  })();
  var E2M1 = [0, 0.5, 1, 1.5, 2, 3, 4, 6];

  function nearest(list, x) {
    var lo = 0, hi = list.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (list[mid] <= x) lo = mid; else hi = mid; }
    return (x - list[lo] <= list[hi] - x) ? list[lo] : list[hi];
  }

  var FORMATS = {
    int8: { name: 'INT8', bits: 8, max: 127, q: function (y) { return Math.max(-127, Math.min(127, Math.round(y))); } },
    int4: { name: 'INT4', bits: 4, max: 7, q: function (y) { return Math.max(-7, Math.min(7, Math.round(y))); } },
    fp8:  { name: 'FP8 E4M3', bits: 8, max: 448, q: function (y) { return (y < 0 ? -1 : 1) * nearest(E4M3, Math.min(448, Math.abs(y))); } },
    fp4:  { name: 'FP4 E2M1', bits: 4, max: 6, q: function (y) { return (y < 0 ? -1 : 1) * nearest(E2M1, Math.min(6, Math.abs(y))); } }
  };

  /* 64 pesos con distribución aproximadamente normal (semilla fija) y dos outliers opcionales */
  function weights(withOutliers) {
    var seed = 20260927, out = [];
    function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
    for (var i = 0; i < 64; i++) {
      var u = Math.max(1e-9, rnd()), v = rnd();
      out.push(0.02 * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
    }
    if (withOutliers) { out[13] = 0.21; out[47] = -0.17; }
    return out;
  }

  function initQuant(host) {
    var fmt = h('select', { 'aria-label': 'Formato' });
    [['int8', 'INT8 (8 bits)'], ['int4', 'INT4 (4 bits)'], ['fp8', 'FP8 E4M3 (8 bits)'], ['fp4', 'FP4 E2M1 (4 bits)']].forEach(function (o) { fmt.appendChild(h('option', { value: o[0], text: o[1] })); });
    fmt.value = 'int4';
    var gran = h('select', { 'aria-label': 'Granularidad de la escala' }, [
      h('option', { value: '64', text: 'Una escala para los 64 (por tensor)' }),
      h('option', { value: '16', text: 'Una escala cada 16 (por grupo)' })
    ]);
    var outl = h('input', { type: 'checkbox', checked: true });
    var svgHost = h('div', { class: 'sim-scroll' });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });

    function draw() {
      var f = FORMATS[fmt.value], G = +gran.value, w = weights(outl.checked);
      var q = new Array(64), scales = [];
      for (var g0 = 0; g0 < 64; g0 += G) {
        var amax = 0;
        for (var i = g0; i < g0 + G; i++) amax = Math.max(amax, Math.abs(w[i]));
        var s = amax / f.max || 1;
        scales.push(s);
        for (i = g0; i < g0 + G; i++) q[i] = f.q(w[i] / s) * s;
      }
      var se = 0, ss = 0, maxErr = 0, zeros = 0;
      for (i = 0; i < 64; i++) {
        var e = q[i] - w[i]; se += e * e; ss += w[i] * w[i]; maxErr = Math.max(maxErr, Math.abs(e));
        if (q[i] === 0 && w[i] !== 0) zeros++;
      }

      var W = 740, H = 250, l = 46, t = 14, pw = W - l - 12, ph = H - t - 30;
      var ymax = outl.checked ? 0.24 : 0.07;
      var X = function (k) { return l + (k + 0.5) / 64 * pw; };
      var Y = function (v) { return t + ph / 2 - v / ymax * (ph / 2); };
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Pesos originales y cuantizados">';
      [-ymax, -ymax / 2, 0, ymax / 2, ymax].forEach(function (v) {
        svg += '<line class="sim-grid" x1="' + l + '" x2="' + (l + pw) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/><text class="sim-axis" x="' + (l - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + v.toFixed(2) + '</text>';
      });
      for (var gi = 0; gi < 64; gi += G) if (gi) svg += '<line x1="' + (X(gi) - pw / 128).toFixed(1) + '" x2="' + (X(gi) - pw / 128).toFixed(1) + '" y1="' + t + '" y2="' + (t + ph) + '" stroke="var(--separator-strong)" stroke-dasharray="3 3"/>';
      for (i = 0; i < 64; i++) {
        var x = X(i).toFixed(1);
        svg += '<line x1="' + x + '" x2="' + x + '" y1="' + Y(w[i]).toFixed(1) + '" y2="' + Y(q[i]).toFixed(1) + '" stroke="var(--fail)" stroke-width="2"/>';
        svg += '<circle cx="' + x + '" cy="' + Y(w[i]).toFixed(1) + '" r="3.6" fill="var(--bg)" stroke="var(--label-2)" stroke-width="1.4"/>';
        svg += '<rect x="' + (X(i) - 2.6).toFixed(1) + '" y="' + (Y(q[i]) - 2.6).toFixed(1) + '" width="5.2" height="5.2" fill="var(--l-service)"/>';
      }
      svg += '<circle cx="' + (l + 8) + '" cy="' + (H - 10) + '" r="3.6" fill="var(--bg)" stroke="var(--label-2)" stroke-width="1.4"/><text class="sim-axis" x="' + (l + 18) + '" y="' + (H - 6) + '">peso original</text>';
      svg += '<rect x="' + (l + 115) + '" y="' + (H - 13) + '" width="6" height="6" fill="var(--l-service)"/><text class="sim-axis" x="' + (l + 127) + '" y="' + (H - 6) + '">valor cuantizado</text>';
      svg += '<line x1="' + (l + 240) + '" x2="' + (l + 240) + '" y1="' + (H - 15) + '" y2="' + (H - 4) + '" stroke="var(--fail)" stroke-width="2"/><text class="sim-axis" x="' + (l + 248) + '" y="' + (H - 6) + '">error</text>';
      svg += '</svg>';
      svgHost.innerHTML = svg;

      stats.innerHTML = '';
      [['Error relativo (RMS)', F.pct(Math.sqrt(se / ss), 1)],
       ['Error máximo', maxErr.toFixed(4)],
       ['Pesos que quedaron en cero', F.num(zeros, 0) + ' de 64'],
       ['Bits por peso, con escalas', F.num(f.bits + 16 / G, 2)],
       ['Llama 3.1 70B en este formato', F.bytes(70.6e9 * (f.bits + 16 / Math.min(G, 128)) / 8)]].forEach(function (x) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
    }
    [fmt, gran, outl].forEach(function (x) { x.addEventListener('change', draw); });
    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Cuantizar 64 pesos' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [
        h('div', { class: 'field' }, [h('label', { text: 'Formato' }), fmt]),
        h('div', { class: 'field' }, [h('label', { text: 'Escala' }), gran]),
        h('label', { class: 'check' }, [outl, ' Con dos outliers'])
      ]),
      svgHost, stats,
      h('p', { class: 'sim-note', text: 'Cada grupo usa una escala: su valor absoluto máximo dividido por el mayor valor del formato. Un outlier infla la escala de todo su grupo y los pesos chicos terminan redondeados a cero: por eso se cuantiza por grupos, y por eso existen AWQ y SmoothQuant.' })
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Pesos sintéticos con distribución normal, como los de una capa real. La memoria del 70B supone escalas de 16 bits por grupo (de 128 pesos como máximo); los formatos por bloque del hardware nuevo, como NVFP4, usan escalas de 8 bits cada 16 valores.' }));
    draw();
  }

  SD.ready(function () { document.querySelectorAll('[data-sim="quant"]').forEach(initQuant); });
})();
