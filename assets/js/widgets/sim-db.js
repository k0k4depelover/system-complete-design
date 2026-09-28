/* Widgets de bases de datos:
   <div data-sim="isolation">  anomalías posibles por nivel de aislamiento, con una ejecución intercalada de ejemplo
   <div data-sim="quorum">     N, W, R: solapamiento y tolerancia a fallas
   <div data-sim="ring">       hashing consistente con nodos virtuales frente a hash módulo N */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  /* ======================= Aislamiento ======================= */

  var LEVELS = [
    { id: 'ru', name: 'Read uncommitted' },
    { id: 'rc', name: 'Read committed', note: 'Por defecto en PostgreSQL, Oracle y SQL Server.' },
    { id: 'rr', name: 'Repeatable read / snapshot', note: 'Por defecto en MySQL InnoDB. En PostgreSQL, este nivel es snapshot isolation.' },
    { id: 'ser', name: 'Serializable', note: 'PostgreSQL lo implementa con SSI: detecta conflictos y aborta una de las transacciones.' }
  ];

  /* posible[nivel] = true si la anomalía puede ocurrir (según la semántica de PostgreSQL para rr) */
  var ANOMALIES = [
    { id: 'dirty', name: 'Lectura sucia', possible: { ru: true, rc: false, rr: false, ser: false },
      desc: 'Leer datos que otra transacción escribió pero todavía no confirmó (y quizá nunca confirme).',
      t1: ['BEGIN', 'UPDATE cuentas SET saldo = 0 WHERE id = 1', '…', 'ROLLBACK'],
      t2: ['', '', 'SELECT saldo FROM cuentas WHERE id = 1  → 0', ''],
      bad: 'T2 vio un saldo de 0 que nunca existió: T1 hizo rollback.' },
    { id: 'nonrep', name: 'Lectura no repetible', possible: { ru: true, rc: true, rr: false, ser: false },
      desc: 'Leer la misma fila dos veces en una transacción y obtener valores distintos porque otra la cambió en medio.',
      t1: ['BEGIN', 'SELECT saldo WHERE id = 1  → 100', '', 'SELECT saldo WHERE id = 1  → 40', 'COMMIT'],
      t2: ['', '', 'UPDATE … SET saldo = 40 WHERE id = 1; COMMIT', '', ''],
      bad: 'Un reporte que suma saldos en dos pasos obtiene totales que nunca coincidieron en ningún instante.' },
    { id: 'phantom', name: 'Fantasma', possible: { ru: true, rc: true, rr: false, ser: false },
      desc: 'Repetir una consulta con condición y encontrar filas nuevas que otra transacción insertó.',
      t1: ['BEGIN', 'SELECT count(*) FROM reservas WHERE sala = 3  → 0', '', 'SELECT count(*) … WHERE sala = 3  → 1', 'COMMIT'],
      t2: ['', '', 'INSERT INTO reservas (sala) VALUES (3); COMMIT', '', ''],
      bad: 'La misma consulta cambia de resultado dentro de la transacción. (En el estándar SQL, repeatable read todavía permite fantasmas; en PostgreSQL no.)' },
    { id: 'lost', name: 'Actualización perdida', possible: { ru: true, rc: true, rr: false, ser: false },
      desc: 'Dos transacciones leen, modifican y escriben el mismo valor: la segunda pisa a la primera.',
      t1: ['BEGIN', 'SELECT stock WHERE id = 7  → 10', '', 'UPDATE … SET stock = 9  (10 − 1)', 'COMMIT'],
      t2: ['BEGIN', '', 'SELECT stock WHERE id = 7  → 10', 'UPDATE … SET stock = 9  (10 − 1)', 'COMMIT'],
      bad: 'Se vendieron 2 unidades y el stock bajó 1. Se evita con UPDATE … SET stock = stock − 1, con SELECT … FOR UPDATE o con control optimista. (En PostgreSQL con repeatable read, la segunda transacción falla con un error de serialización.)' },
    { id: 'skew', name: 'Write skew', possible: { ru: true, rc: true, rr: true, ser: false },
      desc: 'Dos transacciones leen el mismo conjunto, cada una decide según lo que leyó y escriben filas distintas: juntas violan una regla que ninguna violaba sola.',
      t1: ['BEGIN', 'SELECT count(*) FROM guardias WHERE turno = hoy  → 2', '', 'UPDATE guardias SET activo = false WHERE medico = \'Ana\'', 'COMMIT'],
      t2: ['BEGIN', 'SELECT count(*) FROM guardias WHERE turno = hoy  → 2', '', 'UPDATE guardias SET activo = false WHERE medico = \'Luis\'', 'COMMIT'],
      bad: 'La regla era "siempre al menos un médico de guardia". Cada uno vio 2 y se dio de baja: quedaron 0. Snapshot isolation no lo detecta porque escribieron filas distintas; solo serializable (o un SELECT … FOR UPDATE sobre las filas leídas) lo evita.' }
  ];

  function initIsolation(host) {
    var level = 'rc', anomaly = 'skew';
    var levelBar = h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Nivel de aislamiento' });
    var matrix = h('div', { class: 'iso-matrix' });
    var detail = h('div', { class: 'iso-detail', 'aria-live': 'polite' });
    var note = h('p', { class: 'sim-note' });

    LEVELS.forEach(function (L) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': L.id === level ? 'true' : 'false', text: L.name });
      b.addEventListener('click', function () {
        level = L.id;
        levelBar.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        render();
      });
      levelBar.appendChild(b);
    });

    function render() {
      var L = LEVELS.filter(function (x) { return x.id === level; })[0];
      note.textContent = L.note || '';
      matrix.innerHTML = '';
      ANOMALIES.forEach(function (a) {
        var pos = a.possible[level];
        var b = h('button', { type: 'button', class: 'iso-cell ' + (pos ? 'is-possible' : 'is-prevented') + (a.id === anomaly ? ' is-sel' : ''), 'aria-pressed': a.id === anomaly ? 'true' : 'false' }, [
          h('span', { class: 'iso-mark', 'aria-hidden': 'true', text: pos ? '!' : '✓' }),
          h('span', { class: 'iso-name', text: a.name }),
          h('span', { class: 'iso-state', text: pos ? 'Puede ocurrir' : 'Prevenida' })
        ]);
        b.addEventListener('click', function () { anomaly = a.id; render(); });
        matrix.appendChild(b);
      });
      var A = ANOMALIES.filter(function (x) { return x.id === anomaly; })[0];
      var pos = A.possible[level];
      detail.innerHTML = '';
      detail.appendChild(h('p', { class: 'iso-title', text: A.name + ': ' + (pos ? 'puede ocurrir en ' : 'prevenida en ') + L.name }));
      detail.appendChild(h('p', { text: A.desc }));
      var rows = Math.max(A.t1.length, A.t2.length);
      var tb = h('tbody');
      for (var i = 0; i < rows; i++) {
        tb.appendChild(h('tr', {}, [h('td', { class: 'r muted', text: String(i + 1) }), h('td', {}, [A.t1[i] ? h('code', { text: A.t1[i] }) : '']), h('td', {}, [A.t2[i] ? h('code', { text: A.t2[i] }) : ''])]));
      }
      detail.appendChild(h('div', { class: 'table-wrap' }, [h('table', { class: 't iso-sched' }, [
        h('thead', {}, [h('tr', {}, [h('th', { text: 't' }), h('th', { text: 'Transacción 1' }), h('th', { text: 'Transacción 2' })])]), tb
      ])]));
      detail.appendChild(h('p', { class: pos ? 'iso-bad' : 'iso-good', text: pos ? A.bad : 'En este nivel la base impide la anomalía: bloquea a una transacción o aborta una con un error de serialización que la aplicación debe reintentar.' }));
    }

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Niveles de aislamiento y anomalías' }), levelBar]));
    host.appendChild(h('div', { class: 'sim-body' }, [note, matrix, detail]));
    render();
  }

  /* ======================= Quórum ======================= */

  function initQuorum(host) {
    var st = { n: 3, w: 2, r: 2 };
    var inputs = {};
    var out = h('div', { 'aria-live': 'polite' });
    var viz = h('div', { class: 'sim-scroll' });

    function field(key, label, min, max) {
      var id = 'q' + key + Math.random().toString(36).slice(2, 6);
      var inp = h('input', { id: id, type: 'number', min: min, max: max, step: 1, value: st[key] });
      inp.addEventListener('input', function () { st[key] = Math.max(1, parseInt(inp.value, 10) || 1); render(); });
      inputs[key] = inp;
      return h('div', { class: 'field' }, [h('label', { for: id, text: label }), inp]);
    }

    function render() {
      var n = Math.min(9, Math.max(1, st.n)), w = Math.min(n, st.w), r = Math.min(n, st.r);
      var overlap = w + r > n;
      out.innerHTML = '';
      var stats = h('div', { class: 'sim-stats' });
      function stat(l, v) { stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: l }), h('b', { text: v })])); }
      stat('¿Lectura ve la última escritura?', overlap ? 'Sí: W + R > N' : 'No garantizado');
      stat('Escrituras toleran caídas de', (n - w) + (n - w === 1 ? ' réplica' : ' réplicas'));
      stat('Lecturas toleran caídas de', (n - r) + (n - r === 1 ? ' réplica' : ' réplicas'));
      stat('Réplicas que contesta cada operación', 'W = ' + w + ', R = ' + r);
      out.appendChild(stats);
      out.appendChild(h('p', { class: 'sim-note', text: overlap
        ? 'Cualquier conjunto de ' + r + ' réplicas leídas incluye al menos una de las ' + w + ' que confirmaron la última escritura. Ojo: aun así hay casos límite (escrituras concurrentes, fallas a mitad de escritura) que un quórum no resuelve solo.'
        : 'Una lectura puede consultar solo réplicas que todavía no recibieron la última escritura: la consistencia es eventual. A cambio, las operaciones esperan menos respuestas y son más rápidas.' }));

      /* dibujo: réplicas en fila, las W primeras escritas, las R últimas leídas */
      var W = 640, H = 120, gap = W / (n + 1);
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Réplicas escritas y leídas">';
      for (var i = 0; i < n; i++) {
        var x = gap * (i + 1), wrote = i < w, read = i >= n - r;
        s += '<circle cx="' + x + '" cy="58" r="22" fill="' + (wrote ? 'var(--l-db)' : 'var(--bg)') + '" fill-opacity="' + (wrote ? 0.3 : 1) + '" stroke="' + (wrote ? 'var(--l-db)' : 'var(--rule-strong)') + '" stroke-width="2.5"/>';
        if (read) s += '<circle cx="' + x + '" cy="58" r="29" fill="none" stroke="var(--link)" stroke-width="2" stroke-dasharray="5 4"/>';
        s += '<text class="sim-label" x="' + x + '" y="63" text-anchor="middle">R' + (i + 1) + '</text>';
        s += '<text class="sim-axis" x="' + x + '" y="108" text-anchor="middle">' + (wrote && read ? 'escrita y leída' : wrote ? 'escrita' : read ? 'leída' : '—') + '</text>';
      }
      s += '<text class="sim-axis" x="8" y="14">Relleno: confirmó la escritura (W). Anillo punteado: consultada por la lectura (R). Peor caso: los conjuntos se eligen lo más separados posible.</text>';
      s += '</svg>';
      viz.innerHTML = s;
    }

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Calculadora de quórum' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [field('n', 'Réplicas (N)', 1, 9), field('w', 'Confirmaciones de escritura (W)', 1, 9), field('r', 'Respuestas de lectura (R)', 1, 9)]),
      viz, out
    ]));
    render();
  }

  /* ======================= Anillo de hashing consistente ======================= */

  function hash32(str) {
    var x = 2166136261;
    for (var i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
    x ^= x >>> 13; x = Math.imul(x, 0x5bd1e995); x ^= x >>> 15;
    return x >>> 0;
  }

  var COLORS = ['var(--l-service)', 'var(--l-gpu)', 'var(--l-queue)', 'var(--l-cache)', 'var(--l-db)', 'var(--l-edge)', 'var(--ink-2)', 'var(--link)'];

  function initRing(host) {
    var st = { nodes: 4, vnodes: 1, mode: 'ring' };
    var KEYS = 400;
    var prevOwner = null;
    var vSel = h('select', { 'aria-label': 'Nodos virtuales por nodo' }, [1, 8, 64, 256].map(function (v) { return h('option', { value: v, text: v === 1 ? 'Sin nodos virtuales' : v + ' nodos virtuales por nodo' }); }));
    var mSel = h('select', { 'aria-label': 'Método' }, [h('option', { value: 'ring', text: 'Hashing consistente' }), h('option', { value: 'mod', text: 'hash(clave) mod N' })]);
    var addB = h('button', { type: 'button', class: 'btn', text: 'Agregar un nodo' });
    var remB = h('button', { type: 'button', class: 'btn btn--ghost', text: 'Quitar un nodo' });
    var viz = h('div', { class: 'sim-scroll' });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });

    function owners() {
      var out = [];
      if (st.mode === 'mod') {
        for (var k = 0; k < KEYS; k++) out.push(hash32('key-' + k) % st.nodes);
        return { owner: out, points: [] };
      }
      var points = [];
      for (var n = 0; n < st.nodes; n++) for (var v = 0; v < st.vnodes; v++) points.push({ pos: hash32('nodo-' + n + '#' + v), node: n });
      points.sort(function (a, b) { return a.pos - b.pos; });
      for (k = 0; k < KEYS; k++) {
        var hk = hash32('key-' + k), lo = 0, hi = points.length;
        while (lo < hi) { var mid = (lo + hi) >> 1; if (points[mid].pos < hk) lo = mid + 1; else hi = mid; }
        out.push(points[lo % points.length].node);
      }
      return { owner: out, points: points };
    }

    function render(changed) {
      var res = owners();
      var moved = null;
      if (changed && prevOwner) {
        moved = 0;
        for (var k = 0; k < KEYS; k++) if (prevOwner[k] !== res.owner[k]) moved++;
      }
      prevOwner = res.owner;
      var load = new Array(st.nodes).fill(0);
      res.owner.forEach(function (o) { load[o]++; });
      var ideal = KEYS / st.nodes, maxL = Math.max.apply(null, load);

      var W = 640, H = 300, cx = 150, cy = 150, R = 118;
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Anillo de hashes con nodos y claves">';
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="var(--rule-strong)" stroke-width="1.5"/>';
      function pt(pos, rad) { var a = pos / 4294967296 * Math.PI * 2 - Math.PI / 2; return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]; }
      for (k = 0; k < KEYS; k += 2) {
        var p = pt(hash32('key-' + k), R - 12);
        s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.2" fill="' + COLORS[res.owner[k] % COLORS.length] + '"/>';
      }
      if (st.mode === 'ring') {
        res.points.forEach(function (q) {
          var a = pt(q.pos, R - 4), b2 = pt(q.pos, R + 8);
          s += '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b2[0].toFixed(1) + '" y2="' + b2[1].toFixed(1) + '" stroke="' + COLORS[q.node % COLORS.length] + '" stroke-width="' + (st.vnodes > 8 ? 1.2 : 3) + '"/>';
        });
      } else {
        s += '<text class="sim-axis" x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle">sin anillo: módulo N</text>';
      }
      /* barras de carga */
      var bx = 330, bw = 190, rowH = Math.min(30, 240 / st.nodes);
      s += '<text class="sim-axis" x="' + bx + '" y="20">Claves por nodo (ideal: ' + F.num(ideal, 0) + ')</text>';
      load.forEach(function (l, i) {
        var y = 32 + i * rowH;
        s += '<text class="sim-label" x="' + bx + '" y="' + (y + rowH * 0.6) + '">Nodo ' + (i + 1) + '</text>';
        s += '<rect x="' + (bx + 60) + '" y="' + (y + rowH * 0.2) + '" width="' + Math.max(2, l / Math.max(maxL, ideal * 1.5) * bw) + '" height="' + rowH * 0.5 + '" rx="2" fill="' + COLORS[i % COLORS.length] + '"/>';
        s += '<text class="sim-val" x="' + (bx + 66 + l / Math.max(maxL, ideal * 1.5) * bw) + '" y="' + (y + rowH * 0.6) + '">' + l + '</text>';
      });
      var ix = bx + 60 + ideal / Math.max(maxL, ideal * 1.5) * bw;
      s += '<line x1="' + ix + '" x2="' + ix + '" y1="28" y2="' + (32 + st.nodes * rowH) + '" stroke="var(--ink-3)" stroke-dasharray="3 3"/>';
      s += '</svg>';
      viz.innerHTML = s;

      stats.innerHTML = '';
      function stat(l, v) { stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: l }), h('b', { text: v })])); }
      stat('Nodos', String(st.nodes));
      stat('Nodo más cargado', F.num(maxL / ideal * 100, 0) + ' % del ideal');
      stat('Claves movidas en el último cambio', moved == null ? '—' : F.pct(moved / KEYS, 0));
      stat('Mínimo teórico al cambiar 1 nodo', '≈ ' + F.pct(1 / st.nodes, 0));
    }

    addB.addEventListener('click', function () { if (st.nodes < 8) { st.nodes++; render(true); } });
    remB.addEventListener('click', function () { if (st.nodes > 2) { st.nodes--; render(true); } });
    vSel.addEventListener('change', function () { st.vnodes = +vSel.value; prevOwner = null; render(false); });
    mSel.addEventListener('change', function () { st.mode = mSel.value; prevOwner = null; render(false); });

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Hashing consistente: 400 claves repartidas entre nodos' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [
        h('div', { class: 'field' }, [h('label', { text: 'Método' }), mSel]),
        h('div', { class: 'field' }, [h('label', { text: 'Nodos virtuales' }), vSel]),
        addB, remB
      ]),
      viz, stats
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Agrega o quita un nodo y mira qué fracción de claves cambia de dueño. Con módulo N casi todas se mueven; con el anillo, solo ~1/N. Los nodos virtuales emparejan la carga.' }));
    render(false);
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="isolation"]').forEach(initIsolation);
    document.querySelectorAll('[data-sim="quorum"]').forEach(initQuorum);
    document.querySelectorAll('[data-sim="ring"]').forEach(initRing);
  });
})();
