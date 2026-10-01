/* Widget del M06: <div data-sim="lin"></div>
   ¿Es linealizable? Historias de operaciones sobre un registro x (valor inicial 0) hechas por varios clientes.
   Cada operación tiene un intervalo [inicio, fin]: la invocación y la respuesta. El lector cambia lo que devolvió
   cada lectura y el verificador busca, por fuerza bruta, un orden total que:
     - linealizable: respete el tiempo real (si A terminó antes de que B empezara, A va antes) y sea legal;
     - secuencial: respete solo el orden de cada cliente y sea legal.
   Legal: cada lectura devuelve el valor de la última escritura anterior en el orden (o 0 si no hay).
   La lógica está en SD.linCore, sin DOM, para poder probarla aparte. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;

  /* ======================= Verificador ======================= */

  function search(ops, realTime) {
    var n = ops.length, placed = new Array(n).fill(false), order = [];
    function mustPrecede(a, b) {                     /* a tiene que ir antes que b */
      if (realTime && ops[a].end < ops[b].start) return true;
      return ops[a].client === ops[b].client && ops[a].end <= ops[b].start;
    }
    function dfs(value) {
      if (order.length === n) return true;
      for (var i = 0; i < n; i++) {
        if (placed[i]) continue;
        var free = true;
        for (var j = 0; j < n && free; j++) if (!placed[j] && j !== i && mustPrecede(j, i)) free = false;
        if (!free) continue;
        var op = ops[i];
        if (op.type === 'r' && op.value !== value) continue;
        placed[i] = true; order.push(i);
        if (dfs(op.type === 'w' ? op.value : value)) return true;
        placed[i] = false; order.pop();
      }
      return false;
    }
    return dfs(0) ? order.slice() : null;
  }

  /* Puntos de linealización: dentro del intervalo de cada operación y en el orden encontrado */
  function points(ops, order) {
    var p = {}, t = -Infinity;
    order.forEach(function (i) { t = Math.max(ops[i].start, t + 0.12); p[i] = Math.min(t, ops[i].end); });
    return p;
  }

  SD.linCore = { search: search, points: points };
  if (!SD.ready || typeof document === 'undefined') return;

  /* ======================= Historias ======================= */

  var CASES = {
    solapadas: {
      name: 'Lectura durante una escritura',
      clients: ['A', 'B', 'C'],
      ops: [
        { client: 'A', type: 'w', value: 1, start: 1, end: 7 },
        { client: 'B', type: 'r', value: 0, start: 2, end: 4 },
        { client: 'C', type: 'r', value: 1, start: 8, end: 10 }
      ],
      note: 'La lectura de B se solapa con la escritura: puede ver el 0 o el 1, las dos son linealizables. La de C empieza después de que la escritura terminó, así que tiene que ver el 1. Prueba ponerle 0.'
    },
    vuelta: {
      name: 'Nuevo y después viejo',
      clients: ['A', 'B', 'C'],
      ops: [
        { client: 'A', type: 'w', value: 1, start: 1, end: 9 },
        { client: 'B', type: 'r', value: 1, start: 2, end: 4 },
        { client: 'C', type: 'r', value: 0, start: 5, end: 7 }
      ],
      note: 'B ya vio el 1 y terminó; después empieza C y ve el 0. Las dos lecturas se solapan con la escritura, pero una vez que alguien vio el valor nuevo, nadie que empiece después puede ver el viejo. Es lo que pasa al leer de réplicas distintas en un quórum sin reparación.'
    },
    atrasada: {
      name: 'Una réplica atrasada',
      clients: ['A', 'B'],
      ops: [
        { client: 'A', type: 'w', value: 1, start: 1, end: 3 },
        { client: 'A', type: 'r', value: 1, start: 4, end: 5 },
        { client: 'B', type: 'r', value: 0, start: 6, end: 8 }
      ],
      note: 'La escritura terminó y B, que empieza después, lee el 0 de una réplica atrasada. No es linealizable, pero sí secuencial: si el orden entre clientes no importa, la lectura de B puede ubicarse antes de la escritura. La diferencia entre los dos modelos es exactamente el tiempo real.'
    },
    concurrentes: {
      name: 'Dos escrituras concurrentes',
      clients: ['A', 'B', 'C', 'D'],
      ops: [
        { client: 'A', type: 'w', value: 1, start: 1, end: 5 },
        { client: 'B', type: 'w', value: 2, start: 2, end: 6 },
        { client: 'C', type: 'r', value: 2, start: 7, end: 8 },
        { client: 'D', type: 'r', value: 1, start: 9, end: 10 }
      ],
      note: 'Las escrituras se solapan, así que cualquiera puede quedar última. Pero todos tienen que ver el mismo ganador: si C vio el 2 y D empieza después, D no puede ver el 1. Cambia D a 2, o C a 1.'
    }
  };

  var uid = 0;

  function init(host) {
    var key = 'solapadas', ops = null;
    var chips = h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Historia' });
    Object.keys(CASES).forEach(function (k) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': k === key ? 'true' : 'false', text: CASES[k].name });
      b.addEventListener('click', function () {
        key = k;
        chips.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        load();
      });
      chips.appendChild(b);
    });
    var chart = h('div', { class: 'sim-scroll lin-chart' });
    var controls = h('div', { class: 'sim-controls lin-controls' });
    var verdict = h('div', { class: 'lin-verdict', 'aria-live': 'polite' });
    var note = h('p', { class: 'sim-note' });

    function label(op) { return op.type === 'w' ? 'escribe ' + op.value : 'lee → ' + op.value; }

    function draw(order) {
      var c = CASES[key], W = 700, rowH = 46, top = 16, l = 40, r = 14, H = top + c.clients.length * rowH + 28;
      var tmax = 11, X = function (t) { return l + t / tmax * (W - l - r); };
      var pts = order ? points(ops, order) : {};
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Operaciones de cada cliente en el tiempo">';
      c.clients.forEach(function (cl, k) {
        var y = top + k * rowH + 20;
        s += '<text class="sim-label" x="' + (l - 12) + '" y="' + (y + 4) + '" text-anchor="end">' + cl + '</text>';
        s += '<line class="sim-grid" x1="' + l + '" x2="' + (W - r) + '" y1="' + y + '" y2="' + y + '"/>';
      });
      ops.forEach(function (op, i) {
        var k = c.clients.indexOf(op.client), y = top + k * rowH + 20;
        var x0 = X(op.start), x1 = X(op.end);
        var fill = op.type === 'w' ? 'var(--l-service)' : 'var(--l-db)';
        s += '<rect x="' + x0.toFixed(1) + '" y="' + (y - 11) + '" width="' + (x1 - x0).toFixed(1) + '" height="22" rx="5" fill="color-mix(in srgb, ' + fill + ' 22%, var(--bg))" stroke="' + fill + '" stroke-width="1.5"/>';
        s += '<text class="sim-val" x="' + ((x0 + x1) / 2).toFixed(1) + '" y="' + (y + 4.5) + '" text-anchor="middle">' + label(op) + '</text>';
        if (pts[i] != null) {
          var px = X(pts[i]);
          s += '<line x1="' + px.toFixed(1) + '" x2="' + px.toFixed(1) + '" y1="' + (y - 17) + '" y2="' + (y - 11) + '" stroke="var(--label)" stroke-width="2"/>';
          s += '<circle cx="' + px.toFixed(1) + '" cy="' + (y - 19) + '" r="3.5" fill="var(--label)"/>';
        }
      });
      for (var t = 0; t <= 10; t += 2) s += '<text class="sim-axis" x="' + X(t).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + t + '</text>';
      s += '</svg>';
      chart.innerHTML = s;
    }

    function check() {
      var lin = search(ops, true), seq = search(ops, false);
      draw(lin);
      verdict.innerHTML = '';
      function row(ok, name, text) {
        verdict.appendChild(h('p', { class: 'lin-row ' + (ok ? 'is-ok' : 'is-bad') }, [
          h('span', { class: 'lin-mark', 'aria-hidden': 'true', text: ok ? '✓' : '✕' }),
          h('span', {}, [h('b', { text: name + ': ' + (ok ? 'sí' : 'no') + '. ' }), text])
        ]));
      }
      var fmt = function (order) { return order.map(function (i) { return ops[i].client + ' ' + label(ops[i]); }).join(', luego '); };
      row(!!lin, 'Linealizable', lin ? 'Un orden que respeta el tiempo real: ' + fmt(lin) + '. Los puntos marcan dónde "ocurre" cada operación.' : 'Ningún orden que respete el tiempo real deja a cada lectura con el valor de la última escritura.');
      row(!!seq, 'Secuencial', seq ? (lin ? 'Toda historia linealizable también es secuencial.' : 'Existe un orden si se ignora el tiempo real entre clientes: ' + fmt(seq) + '.') : 'Ni siquiera ignorando el tiempo real entre clientes hay un orden legal.');
    }

    function load() {
      ops = CASES[key].ops.map(function (o) { return { client: o.client, type: o.type, value: o.value, start: o.start, end: o.end }; });
      controls.innerHTML = '';
      ops.forEach(function (op) {
        if (op.type !== 'r') return;
        var id = 'lin' + (++uid);
        var sel = h('select', { id: id }, [0, 1, 2].map(function (v) { return h('option', { value: v, text: String(v) }); }));
        sel.value = String(op.value);
        sel.addEventListener('change', function () { op.value = +sel.value; check(); });
        controls.appendChild(h('div', { class: 'field' }, [h('label', { for: id, text: 'La lectura de ' + op.client + ' devuelve' }), sel]));
      });
      note.textContent = CASES[key].note;
      check();
    }

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: '¿Es linealizable?' }), chips]));
    host.appendChild(h('div', { class: 'sim-body' }, [chart, controls, verdict, note]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Un registro x que empieza en 0. Cada barra va desde que el cliente pide la operación hasta que recibe la respuesta. El verificador prueba todos los órdenes posibles: con historias chicas es instantáneo; en general, decidir si una historia es linealizable es un problema NP-completo.' }));
    load();
  }

  SD.ready(function () { document.querySelectorAll('[data-sim="lin"]').forEach(init); });
})();
