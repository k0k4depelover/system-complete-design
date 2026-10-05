/* Widgets del M06.1 (teoría distribuida a fondo):
   <div data-sim="consist">  una misma historia y qué modelos de consistencia la permiten, según lo que devuelve cada lectura
   <div data-sim="replat">   latencia de una escritura replicada según cuántas réplicas espera (W de N), con réplicas lentas */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  function esc(t) { return SD.escape(String(t)); }

  /* ======================= Una historia, cinco veredictos ======================= */

  /* Historia fija sobre un registro x (valor inicial 0):
     Ana escribe x = 1 y, al terminar, lee x (a).
     Beto lee x dos veces (b1, b2), las dos después de que terminó la escritura de Ana, y después comenta "¡listo!".
     Carla ve el comentario de Beto y entonces lee x (cx).
     Las reglas de cada modelo están escritas a mano para esta historia; el verificador general está en sim-lin.js. */
  var READS = [
    { k: 'a', short: 'la de Ana', text: 'Ana lee x justo después de su propia escritura' },
    { k: 'b1', short: 'la primera de Beto', text: 'Beto lee x por primera vez' },
    { k: 'b2', short: 'la segunda de Beto', text: 'Beto lee x otra vez' },
    { k: 'cx', short: 'la de Carla', text: 'Carla ve el comentario de Beto y lee x' }
  ];

  var MODELS = [
    { id: 'lin', name: 'Linealizable', check: function (v) {
      var bad = READS.filter(function (r) { return v[r.k] === 0; });
      if (!bad.length) return [true, 'Todas las lecturas ven 1. Se comporta como una sola copia: la escritura de Ana terminó antes de que empezara cualquier lectura.'];
      return [false, 'La escritura de Ana terminó antes de que empezara cada una de estas lecturas, así que en una sola copia todas ven 1. ' + (bad.length === 1 ? 'Leyó 0 ' : 'Leyeron 0 ') + bad.map(function (r) { return r.short; }).join(', ') + '.'];
    } },
    { id: 'seq', name: 'Secuencial', check: function (v) {
      if (v.a === 0) return [false, 'Ana lee después de su propia escritura. El orden de cada cliente se respeta siempre, así que tiene que ver 1.'];
      if (v.b1 === 1 && v.b2 === 0) return [false, 'Beto ya vio 1 y después ve 0. En un orden único, si su primera lectura va después de la escritura de Ana, la segunda también.'];
      if ((v.b1 || v.b2) && v.cx === 0) return [false, 'Beto comentó después de ver 1, y Carla vio el comentario. En el orden único quedan: escritura de Ana, lectura de Beto, comentario, Carla. Carla tiene que ver 1.'];
      var zero = v.b1 === 0 || v.b2 === 0 || v.cx === 0;
      return [true, zero ? 'Existe un orden único que respeta el de cada cliente: las lecturas que vieron 0 se ubican antes de la escritura de Ana. No respeta el reloj, y no hace falta.' : 'Todas ven 1: el orden único coincide con el del reloj.'];
    } },
    { id: 'causal', name: 'Causal', check: function (v) {
      if (v.a === 0) return [false, 'Ana escribió x = 1: su propia escritura está en su pasado causal, así que no puede dejar de verla.'];
      if (v.b1 === 1 && v.b2 === 0) return [false, 'Después de ver 1, la escritura de Ana está en el pasado causal de Beto. Volver a ver 0 es mostrarle un estado que no la incluye.'];
      if ((v.b1 || v.b2) && v.cx === 0) return [false, 'El comentario de Beto depende de que vio x = 1 (la causa). Carla vio el comentario (el efecto), así que tiene que ver también la causa.'];
      return [true, (v.b1 || v.b2) ? 'Cada efecto llega con su causa: quien vio el comentario de Beto también ve x = 1.' : 'Beto nunca vio 1, así que su comentario no depende de la escritura de Ana: Carla puede ver cualquiera de los dos valores.'];
    } },
    { id: 'session', name: 'Sesión', sub: 'read-your-writes y lecturas monótonas', check: function (v) {
      if (v.a === 0) return [false, 'Read-your-writes: Ana tiene que ver su propia escritura.'];
      if (v.b1 === 1 && v.b2 === 0) return [false, 'Lecturas monótonas: Beto ya vio 1 y no puede volver a un estado más viejo.'];
      if ((v.b1 || v.b2) && v.cx === 0) return [true, 'Permitido. La sesión de Carla solo cubre lo que Carla hizo y vio; lo que hizo Beto no le promete nada. La garantía de escrituras después de lecturas, en la sesión de Beto, cerraría este caso.'];
      return [true, 'Cada cliente ve lo suyo en orden; de lo ajeno no se promete nada.'];
    } },
    { id: 'eventual', name: 'Eventual', check: function (v) {
      return [true, 'Siempre permitido: mientras hay escrituras, cualquier réplica puede estar atrasada, incluso más que la que ya consultaste. Solo promete que, si nadie escribe más, todas terminan en 1.'];
    } }
  ];

  function initConsist(host) {
    var v = { a: 1, b1: 0, b2: 1, cx: 1 };
    var svgHost = h('div', { class: 'sim-scroll cs-scroll' });
    var controls = h('div', { class: 'cs-reads' });
    var out = h('ul', { class: 'cs-out', 'aria-live': 'polite' });

    READS.forEach(function (r) {
      var group = h('div', { class: 'btn-row', role: 'group', 'aria-label': r.text });
      [0, 1].forEach(function (val) {
        var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': v[r.k] === val ? 'true' : 'false', text: 'devuelve ' + val });
        b.addEventListener('click', function () {
          v[r.k] = val;
          group.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          run();
        });
        group.appendChild(b);
      });
      controls.appendChild(h('div', { class: 'cs-read' }, [h('p', { class: 'cs-read-t', text: r.text }), group]));
    });

    function op(x1, x2, y, label, kind) {
      var cls = kind === 'w' ? 'dg-layer' : 'dg-box';
      var st = kind === 'w' ? ' style="--c: var(--l-queue)"' : '';
      return '<rect class="' + cls + '"' + st + ' x="' + x1 + '" y="' + (y - 15) + '" width="' + (x2 - x1) + '" height="30" rx="6"/>' +
        '<text class="dg-tiny" x="' + ((x1 + x2) / 2) + '" y="' + (y + 4) + '" text-anchor="middle">' + esc(label) + '</text>';
    }

    function draw() {
      var s = '<svg viewBox="0 0 770 196" role="img" aria-label="Línea de tiempo: Ana escribe x = 1 y lee; Beto lee dos veces y comenta; Carla ve el comentario y lee x">';
      [['Ana', 40], ['Beto', 92], ['Carla', 144]].forEach(function (l) {
        s += '<text class="dg-label" x="8" y="' + (l[1] + 5) + '">' + l[0] + '</text>';
        s += '<path class="dg-frame" d="M70 ' + l[1] + ' H762"/>';
      });
      s += op(80, 190, 40, 'escribe x = 1', 'w');
      s += op(205, 285, 40, 'lee x → ' + v.a, 'r');
      s += op(300, 380, 92, 'lee x → ' + v.b1, 'r');
      s += op(395, 475, 92, 'lee x → ' + v.b2, 'r');
      s += op(480, 560, 92, 'comenta', 'w');
      s += op(572, 674, 144, 've el comentario', 'r');
      s += op(686, 762, 144, 'lee x → ' + v.cx, 'r');
      s += '<path class="dg-feedback" d="M560 100 C 590 110 606 118 618 128"/>';
      s += '<text class="dg-tiny" x="8" y="186">Toda lectura empieza después de que la escritura de Ana terminó. El comentario de Beto llega a Carla.</text>';
      svgHost.innerHTML = s + '</svg>';
    }

    function run() {
      draw();
      out.innerHTML = '';
      MODELS.forEach(function (m) {
        var r = m.check(v);
        out.appendChild(h('li', { class: 'cs-row ' + (r[0] ? 'is-ok' : 'is-bad') }, [
          h('span', { class: 'cs-verdict', text: r[0] ? '✓ Permitido' : '✗ No permitido' }),
          h('span', { class: 'cs-model' }, [h('b', { text: m.name }), m.sub ? h('span', { class: 'cs-sub', text: ' (' + m.sub + ')' }) : null]),
          h('span', { class: 'cs-why', text: r[1] })
        ]));
      });
    }

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Una historia, cinco veredictos' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [svgHost, controls, out]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'x vale 0 al principio y solo Ana lo escribe. Cambia lo que devolvió cada lectura y mira qué modelos aceptan la historia. Cuanto más fuerte el modelo, menos historias acepta.' }));
    run();
  }

  /* ======================= Latencia de una escritura replicada ======================= */

  /* Idas y vueltas aproximadas desde Virginia (us-east-1), redondeadas. El primario solo paga su fsync. */
  var REG = [
    { n: 'Virginia (primario, disco local)', rtt: 2 },
    { n: 'Ohio', rtt: 11 },
    { n: 'Irlanda', rtt: 75 },
    { n: 'Oregón', rtt: 62 },
    { n: 'Fráncfort', rtt: 88 }
  ];
  var SAMPLES = 20000;

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* Devuelve, para cada W de 1 a N, el p50 y el p99 de la escritura */
  function simulate(n, pSlow) {
    var r = rng(7), regs = REG.slice(0, n), byW = [];
    for (var w = 0; w < n; w++) byW.push(new Float64Array(SAMPLES));
    var lat = new Float64Array(n);
    for (var i = 0; i < SAMPLES; i++) {
      for (var j = 0; j < n; j++) {
        var base = regs[j].rtt;
        var jitter = -Math.log(1 - r()) * base * 0.08;          /* cola exponencial chica */
        var slow = r() < pSlow ? 100 + 400 * r() : 0;            /* pausa de GC, disco lento, cola llena */
        lat[j] = base + jitter + slow;
      }
      var sorted = Array.prototype.slice.call(lat).sort(function (a, b) { return a - b; });
      for (var k = 0; k < n; k++) byW[k][i] = sorted[k];
    }
    return byW.map(function (arr) {
      var s = Array.prototype.slice.call(arr).sort(function (a, b) { return a - b; });
      return { p50: s[Math.floor(SAMPLES * 0.5)], p99: s[Math.floor(SAMPLES * 0.99)] };
    });
  }

  function initReplat(host) {
    var n = 3, w = 2, p = 0.01, uid = 'rl' + Math.random().toString(36).slice(2, 7);
    var nRow = h('div', { class: 'btn-row', role: 'group', 'aria-label': 'Cantidad de réplicas' });
    var wRow = h('div', { class: 'btn-row', role: 'group', 'aria-label': 'Réplicas que espera cada escritura' });
    var slider = h('input', { id: uid, type: 'range', min: 0, max: 5, step: 0.5, value: 1 });
    var sliderOut = h('span', { class: 'rl-pct' });
    var regsHost = h('p', { class: 'sim-note rl-regs' });
    var chart = h('div', { class: 'sim-scroll' });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });
    var note = h('p', { class: 'sim-note' });

    function chips(row, values, cur, label, onPick) {
      row.innerHTML = '';
      values.forEach(function (val) {
        var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': val === cur ? 'true' : 'false', text: label(val) });
        b.addEventListener('click', function () { onPick(val); });
        row.appendChild(b);
      });
    }

    function run() {
      chips(nRow, [3, 5], n, function (x) { return x + ' réplicas'; }, function (x) { n = x; w = Math.min(w, n); if (n === 5 && w === 2) w = 3; run(); });
      var ws = []; for (var i = 1; i <= n; i++) ws.push(i);
      chips(wRow, ws, w, function (x) { return 'W = ' + x; }, function (x) { w = x; run(); });
      sliderOut.textContent = F.num(p * 100, 1) + ' %';
      regsHost.textContent = 'Réplicas: ' + REG.slice(0, n).map(function (r) { return r.n + ' (' + r.rtt + ' ms)'; }).join(', ') + '.';

      var res = simulate(n, p);
      var max = Math.max.apply(null, res.map(function (x) { return x.p99; }));
      var rowH = 44, top = 26, W = 700, x0 = 70, x1 = W - 70, H = top + n * rowH + 10;
      var sc = function (ms) { return x0 + (x1 - x0) * ms / max; };
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="p50 y p99 de la escritura para cada W">';
      s += '<text class="sim-axis" x="' + x0 + '" y="14">p50 (barra fina) y p99 (barra gruesa), en ms</text>';
      res.forEach(function (r, i) {
        var y = top + i * rowH, on = i + 1 === w;
        s += '<text class="sim-label" x="0" y="' + (y + 20) + '"' + (on ? ' style="fill: var(--label)"' : '') + '>W = ' + (i + 1) + '</text>';
        s += '<rect x="' + x0 + '" y="' + (y + 4) + '" width="' + Math.max(2, sc(r.p50) - x0).toFixed(1) + '" height="8" rx="2" style="fill: var(--l-service); opacity: ' + (on ? 1 : 0.45) + '"/>';
        s += '<rect x="' + x0 + '" y="' + (y + 15) + '" width="' + Math.max(2, sc(r.p99) - x0).toFixed(1) + '" height="14" rx="3" style="fill: var(--l-queue); opacity: ' + (on ? 1 : 0.45) + '"/>';
        s += '<text class="sim-val" x="' + (sc(r.p99) + 6).toFixed(1) + '" y="' + (y + 27) + '">' + F.num(r.p99, 0) + '</text>';
        s += '<text class="sim-axis" x="' + (sc(r.p50) + 6).toFixed(1) + '" y="' + (y + 12) + '">' + F.num(r.p50, 0) + '</text>';
      });
      chart.innerHTML = s + '</svg>';

      var r = res[w - 1];
      var waits = w === 1 ? 'Solo su disco' : w === n ? 'A todas' : 'A la ' + w + '.ª más rápida';
      stats.innerHTML = '';
      [['Espera a', waits], ['p50 de la escritura', F.num(r.p50, 0) + ' ms'], ['p99 de la escritura', F.num(r.p99, 0) + ' ms'], ['Caídas que aguanta sin perder lo confirmado', String(w - 1)]].forEach(function (x) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
      note.textContent = w === 1
        ? 'EL: responde con lo que sabe el primario, sin esperar a nadie. La cola de las demás réplicas no lo toca, pero si el primario cae antes de replicar, la escritura confirmada se pierde.'
        : w === n
          ? 'Esperar a todas convierte a la peor réplica en tu latencia: basta con que una de las ' + n + ' vaya lenta para que la escritura vaya lenta. Sube la probabilidad y mira cómo se dispara el p99.'
          : 'Un quórum espera a la ' + w + '.ª respuesta más rápida, no a la más lenta: ' + (n - w === 1 ? 'la réplica restante puede estar lejos o en una pausa de GC' : 'las ' + (n - w) + ' réplicas restantes pueden estar lejos o en una pausa de GC') + ' y la escritura no se entera.';
    }

    slider.addEventListener('input', function () { p = +slider.value / 100; run(); });
    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: '¿A cuántas réplicas espera una escritura?' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [
        h('div', { class: 'field' }, [h('p', { class: 'cs-read-t', text: 'Réplicas' }), nRow]),
        h('div', { class: 'field' }, [h('p', { class: 'cs-read-t', text: 'Cada escritura espera a' }), wRow]),
        h('div', { class: 'field' }, [h('label', { for: uid }, ['Probabilidad de que una réplica vaya lenta: ', sliderOut]), slider])
      ]),
      regsHost, chart, stats, note
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Simulación de 20 000 escrituras con idas y vueltas aproximadas desde Virginia (diseño de referencia, no mediciones). Una réplica lenta suma entre 100 y 500 ms. W cuenta al primario: W = 1 es confirmar solo en el disco local.' }));
    run();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="consist"]').forEach(initConsist);
    document.querySelectorAll('[data-sim="replat"]').forEach(initReplat);
  });
})();
