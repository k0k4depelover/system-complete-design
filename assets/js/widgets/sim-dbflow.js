/* Animaciones de flujo para bases de datos (M05).
   SD.flowAnim(host, cfg) es un motor genérico: cajas fijas y mensajes que viajan entre ellas, paso a paso,
   con la narración y el estado de cada caja a la vista. Lo usan este archivo y sim-dtx.js.

   cfg = { title, foot, aria, vbw, vbh, scenes: [escena] }
   escena = { id, name, vbh?, nodes: { id: { x, y, w, h, name, sub, c: '--l-db' } },
              edges: [['a', 'b']]            aristas que se dibujan aunque ningún paso las use,
              deco: 'SVG'                    marcas fijas que se dibujan debajo de las cajas,
              init: { id: { v: ['línea'], st: 'on|ok|fail|warn|down' } },
              def, rows: [['Ganas', '…']],   tarjeta de abajo (HTML),
              steps: [ { m: [['a', 'b', kind, 'etiqueta']], say: 'HTML', set: { id: { v, st } } } ] }
   kind: req, res, ok, fail, write, async (punteado), warn. Un paso sin mensajes solo cambia estados.

   Escenas de este archivo:
   <div data-sim="txlife">     ciclo de vida de una transacción
   <div data-sim="idxlookup">  búsquedas en un índice clusterizado (InnoDB) y en un heap (PostgreSQL)
   <div data-sim="mvcc">       versiones de filas y snapshots
   <div data-sim="replsync">   replicación síncrona y asíncrona, con caídas
   <div data-sim="quorumflow"> quórums de lectura y escritura con versiones */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;

  var TRAVEL = 1400;
  var KIND = {
    req: { c: 'var(--link)' }, res: { c: 'var(--label-2)' }, ok: { c: 'var(--ok)' }, fail: { c: 'var(--fail)' },
    write: { c: 'var(--l-queue)' }, async: { c: 'var(--l-queue)', dash: true }, warn: { c: 'var(--warn)' }
  };
  var MARK = { ok: '✓ ', fail: '✗ ', warn: '! ' };

  function esc(t) { return SD.escape(String(t)); }
  function plain(html) { return String(html).replace(/<[^>]+>/g, '').replace(/&[#a-z0-9]+;/gi, ' '); }

  function clip(n, tx, ty, pad) {
    var cx = n.x + n.w / 2, cy = n.y + n.h / 2, dx = tx - cx, dy = ty - cy;
    if (!dx && !dy) return [cx, cy];
    var sx = dx ? (n.w / 2 + pad) / Math.abs(dx) : Infinity, sy = dy ? (n.h / 2 + pad) / Math.abs(dy) : Infinity, s = Math.min(sx, sy);
    return [cx + dx * s, cy + dy * s];
  }
  function edgePts(nodes, a, b) {
    var A = nodes[a], B = nodes[b];
    return [clip(A, B.x + B.w / 2, B.y + B.h / 2, 3), clip(B, A.x + A.w / 2, A.y + A.h / 2, 3)];
  }

  function flowAnim(host, cfg) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var SPEEDS = [1, 2.5, 0], LABELS = ['Lento', 'Rápido', 'En pausa'];
    var sp = reduce ? 2 : 0, visible = false, raf = 0, last = 0;
    var sc = cfg.scenes[0], idx = 0, ph = 'travel', el = 0;

    var scene = h('div', { class: 'sim-scroll cp-scroll fa-scroll' });
    var counter = h('p', { class: 'cp-count' });
    var say = h('p', { class: 'cp-say', 'aria-live': 'polite' });
    var prev = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Paso anterior', title: 'Paso anterior', text: '‹' });
    var next = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Paso siguiente', title: 'Paso siguiente', text: '›' });
    var ctrl = h('button', { type: 'button', class: 'btn btn--primary cp-ctrl' });
    var info = h('div', { class: 'cp-info' });
    var chips = cfg.scenes.map(function (s) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': s === sc ? 'true' : 'false', text: s.name });
      b.addEventListener('click', function () {
        sc = s;
        chips.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        if (SPEEDS[sp] === 0 && !reduce) sp = 0;
        goto(0, false); showInfo(); setCtrl(); kick();
      });
      return b;
    });

    function stateAt(i, arrived) {
      var st = {};
      Object.keys(sc.nodes).forEach(function (k) { var x = (sc.init || {})[k] || {}; st[k] = { v: x.v || [], st: x.st || '' }; });
      var upto = arrived ? i + 1 : i;
      for (var j = 0; j < upto; j++) {
        var set = sc.steps[j].set;
        if (set) Object.keys(set).forEach(function (k) {
          var x = set[k];
          st[k] = { v: x.v !== undefined ? x.v : st[k].v, st: x.st !== undefined ? x.st : st[k].st, fl: j === i };
        });
      }
      return st;
    }

    function goto(i, arrived) {
      idx = Math.max(0, Math.min(sc.steps.length - 1, i));
      var moves = sc.steps[idx].m || [];
      ph = arrived || !moves.length ? 'dwell' : 'travel'; el = 0;
      draw();
    }

    function showInfo() {
      var s = sc.def ? '<p class="cp-def"><b>' + esc(sc.name) + '.</b> ' + sc.def + '</p>' : '';
      if (sc.rows) s += '<dl class="cp-rows">' + sc.rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>';
      info.innerHTML = s;
      info.hidden = !s;
    }

    function setCtrl() {
      var s = SPEEDS[sp];
      ctrl.textContent = s === 0 ? 'Reanudar' : (s === 1 ? 'Acelerar' : 'Pausar');
      ctrl.setAttribute('aria-label', 'Velocidad actual: ' + LABELS[sp].toLowerCase() + '. ' + (s === 0 ? 'Toca para reanudar despacio.' : s === 1 ? 'Toca para acelerar.' : 'Toca para pausar.'));
      ctrl.title = 'Cambia entre lento, rápido y pausa';
      var c = host.querySelector('.cp-speed'); if (c) c.textContent = LABELS[sp];
    }
    ctrl.addEventListener('click', function () { sp = (sp + 1) % SPEEDS.length; setCtrl(); kick(); });
    function manual(d) { sp = 2; setCtrl(); goto(idx + d, true); }
    prev.addEventListener('click', function () { manual(-1); });
    next.addEventListener('click', function () { manual(1); });

    function nodeSvg(id, n, s) {
      var out = '', st = s.st, cx = n.x + n.w / 2;
      out += '<g class="fa-g' + (st === 'down' ? ' fa-down' : '') + '">';
      out += '<rect class="dg-layer fa-node' + (st ? ' fa-' + st : '') + '" style="--c: var(' + (n.c || '--l-service') + ')" x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="10"/>';
      if (s.fl) out += '<rect class="cp-hl cp-hl--on" x="' + (n.x + 5) + '" y="' + (n.y + 5) + '" width="' + (n.w - 10) + '" height="' + (n.h - 10) + '" rx="7"/>';
      out += '<text class="dg-label fa-name" x="' + cx + '" y="' + (n.y + 22) + '" text-anchor="middle">' + esc(n.name) + (st === 'down' ? ' · caído' : '') + '</text>';
      var y = n.y + 22;
      if (n.sub) { y += 17; out += '<text class="dg-tiny" x="' + cx + '" y="' + y + '" text-anchor="middle">' + esc(n.sub) + '</text>'; }
      (s.v || []).forEach(function (line, i) {
        y += i === 0 ? 20 : 17;
        var pre = i === 0 && MARK[st] ? MARK[st] : '';
        out += '<text class="fa-v' + (i === 0 && (st === 'ok' || st === 'fail' || st === 'warn') ? ' fa-v--' + st : '') + '" x="' + cx + '" y="' + y + '" text-anchor="middle">' + esc(pre + line) + '</text>';
      });
      return out + '</g>';
    }

    function draw() {
      var step = sc.steps[idx], moves = step.m || [], nodes = sc.nodes;
      var vbh = sc.vbh || cfg.vbh, vbw = cfg.vbw;
      var f = ph === 'travel' ? Math.min(1, el / TRAVEL) : 1;
      var ease = reduce ? 1 : (f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2);
      var st = stateAt(idx, ph === 'dwell');
      var pairs = {}, list = [];
      function addEdge(a, b) { var k = a < b ? a + '|' + b : b + '|' + a; if (!pairs[k]) { pairs[k] = { a: a, b: b, on: null }; list.push(pairs[k]); } return pairs[k]; }
      (sc.edges || []).forEach(function (e) { addEdge(e[0], e[1]); });
      sc.steps.forEach(function (s) { (s.m || []).forEach(function (m) { addEdge(m[0], m[1]); }); });
      moves.forEach(function (m) { addEdge(m[0], m[1]).on = KIND[m[2]]; });

      var s = '<svg viewBox="0 0 ' + vbw + ' ' + vbh + '" role="img" aria-label="' + esc(cfg.aria || cfg.title) + '">';
      list.forEach(function (e) {
        var p = edgePts(nodes, e.a, e.b), on = e.on;
        s += '<path class="cp-edge' + (on ? ' cp-edge--on' : '') + '" d="M' + p[0][0].toFixed(1) + ' ' + p[0][1].toFixed(1) + ' L' + p[1][0].toFixed(1) + ' ' + p[1][1].toFixed(1) + '"' +
          (on ? ' style="stroke:' + on.c + (on.dash ? ';stroke-dasharray:7 5' : '') + '"' : '') + '/>';
      });
      if (sc.deco) s += sc.deco;
      Object.keys(nodes).forEach(function (id) { s += nodeSvg(id, nodes[id], st[id]); });
      moves.forEach(function (m, i) {
        var p = edgePts(nodes, m[0], m[1]), k = KIND[m[2]];
        var x = p[0][0] + (p[1][0] - p[0][0]) * ease, y = p[0][1] + (p[1][1] - p[0][1]) * ease;
        var w = Math.round(m[3].length * 7.4 + 20);
        var lx = Math.max(4 + w / 2, Math.min(vbw - 4 - w / 2, x)), ly = Math.max(16, y - 20 - (moves.length > 1 && i % 2 ? -36 : 0));
        if (ly > vbh - 14) ly = vbh - 14;
        s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="7" style="fill:' + k.c + '"/>';
        s += '<rect class="cp-pill" x="' + (lx - w / 2).toFixed(1) + '" y="' + (ly - 14).toFixed(1) + '" width="' + w + '" height="25" rx="12.5" style="stroke:' + k.c + '"/>';
        s += '<text class="cp-pill-t" x="' + lx.toFixed(1) + '" y="' + (ly + 3).toFixed(1) + '" text-anchor="middle">' + esc(m[3]) + '</text>';
      });
      scene.innerHTML = s + '</svg>';
      counter.innerHTML = '<span>' + esc(sc.name) + '</span> · paso ' + (idx + 1) + ' de ' + sc.steps.length;
      prev.disabled = idx === 0; next.disabled = idx === sc.steps.length - 1;
      if (say.getAttribute('data-k') !== sc.id + idx) { say.innerHTML = step.say; say.setAttribute('data-k', sc.id + idx); }
    }

    function dwell() { return Math.max(2400, Math.min(8500, plain(sc.steps[idx].say).length * 42)); }

    function advance(dt) {
      el += dt;
      if (ph === 'travel' && (el >= TRAVEL || reduce)) { ph = 'dwell'; el = 0; }
      else if (ph === 'dwell' && el >= dwell() + (idx === sc.steps.length - 1 ? 3500 : 0)) {
        goto(idx === sc.steps.length - 1 ? 0 : idx + 1, false);
      }
    }

    function tick(ts) {
      raf = 0;
      var s = SPEEDS[sp];
      if (!s || !visible) { last = 0; return; }
      if (last) advance(Math.min(100, ts - last) * s);
      last = ts;
      draw();
      raf = requestAnimationFrame(tick);
    }
    function kick() { if (!raf && SPEEDS[sp] && visible) { last = 0; raf = requestAnimationFrame(tick); } }

    host.classList.add('sim', 'cp-sim', 'fa-sim');
    host.appendChild(h('div', { class: 'sim-head' }, [
      h('p', { class: 'sim-title', text: cfg.title }),
      h('span', { class: 'cp-speed hv-clock', 'aria-hidden': 'true' })
    ]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      scene,
      h('div', { class: 'cp-narr' }, [h('div', {}, [counter, say]), h('div', { class: 'fa-ctrls' }, [prev, ctrl, next])]),
      cfg.scenes.length > 1 ? h('div', { class: 'btn-row cp-chips', role: 'group', 'aria-label': 'Escenario' }, chips) : '',
      info
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: cfg.foot || 'Colores: azul, una petición; gris, una respuesta; verde, éxito; rojo, error; violeta, una escritura (punteada si es en segundo plano). El botón alterna lento, rápido y pausa; las flechas avanzan de a un paso.' }));
    goto(0, false); showInfo(); setCtrl();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); }, { threshold: 0.3 }).observe(host);
    } else { visible = true; kick(); }
  }
  SD.flowAnim = flowAnim;

  function M(f, t, k, l) { return [f, t, k, l]; }
  function S(m, say, set) { return { m: m, say: say, set: set || null }; }

  /* ======================= Ciclo de vida de una transacción ======================= */

  var TXN = {
    A: { x: 14, y: 112, w: 176, h: 96, name: 'Activa', c: '--l-service' },
    P: { x: 262, y: 10, w: 220, h: 96, name: 'Parcialmente confirmada', c: '--l-queue' },
    C: { x: 552, y: 10, w: 168, h: 96, name: 'Confirmada', c: '--l-db' },
    F: { x: 262, y: 222, w: 220, h: 96, name: 'Fallida', c: '--l-gpu' },
    X: { x: 552, y: 222, w: 168, h: 96, name: 'Abortada', c: '--l-external' }
  };
  var TXE = [['A', 'P'], ['P', 'C'], ['A', 'F'], ['P', 'F'], ['F', 'X']];
  /* Frontera entre los estados en los que la base puede quedar a medias (izquierda) y los finales, consistentes (derecha). */
  var TXD = '<line x1="517" y1="4" x2="517" y2="324" style="stroke: var(--fail); stroke-width: 2; stroke-dasharray: 7 5"/>' +
    '<text class="dg-tiny" x="507" y="344" text-anchor="end" style="fill: var(--fail)">← estado inconsistente</text>' +
    '<text class="dg-tiny" x="527" y="344" style="fill: var(--fail)">estado consistente →</text>';

  var TXLIFE = {
    title: 'Ciclo de vida de una transacción', aria: 'Diagrama de estados: activa, parcialmente confirmada, confirmada, fallida y abortada; una ficha recorre los estados', vbw: 734, vbh: 352,
    scenes: [
      { id: 'commit', name: 'Commit normal', nodes: TXN, edges: TXE, deco: TXD,
        def: 'Una transferencia de 100 entre dos cuentas que termina bien. La transacción pasa por activa y parcialmente confirmada antes de quedar confirmada.',
        rows: [['La clave', 'Confirmada no significa "terminó la última sentencia": significa que el registro de commit ya está en disco, en el WAL.']],
        steps: [
          S([], '<code>BEGIN</code>: la transacción nace en estado <b>activa</b>. Mientras está activa ejecuta sentencias, toma locks sobre las filas que modifica y deja registros en el WAL, todavía en memoria.', { A: { st: 'on', v: ['BEGIN'] } }),
          S([], 'Primera sentencia: <code>UPDATE cuentas SET saldo = saldo − 100 WHERE id = 1</code>. La fila 1 queda bloqueada para otros escritores hasta que la transacción termine.', { A: { v: ['UPDATE id 1: −100', 'lock en fila 1'] } }),
          S([], 'Segunda sentencia: <code>UPDATE … + 100 WHERE id = 2</code>. Nadie fuera de la transacción ve todavía estos cambios.', { A: { v: ['UPDATE id 1: −100', 'UPDATE id 2: +100', 'locks en filas 1 y 2'] } }),
          S([M('A', 'P', 'req', 'COMMIT')], 'La aplicación envía <code>COMMIT</code>. La última sentencia terminó y la transacción pasa a <b>parcialmente confirmada</b>: los cambios están hechos, pero solo en memoria. Un corte de luz en este instante todavía la deshace.', { A: { st: '', v: [] }, P: { st: 'on', v: ['escribe el registro', 'de commit en el WAL'] } }),
          S([M('P', 'C', 'ok', 'fsync del WAL')], 'La base escribe el registro de commit en el WAL y espera el <code>fsync</code>. En el instante en que ese registro está en disco, la transacción está <b>confirmada</b>: si la luz se corta ahora, al arrancar la base rehace los cambios leyendo el WAL.', { P: { st: '', v: [] }, C: { st: 'ok', v: ['durable en el WAL', 'locks liberados'] } }),
          S([], 'Recién ahora el cliente recibe <code>COMMIT</code>. Las páginas de datos modificadas se escriben al disco más tarde, en el próximo checkpoint: no hace falta esperarlas, porque el WAL ya garantiza la durabilidad.', { C: { v: ['durable en el WAL', 'locks liberados', 'cliente: COMMIT OK'] } })
        ] },
      { id: 'error', name: 'Error en una sentencia', nodes: TXN, edges: TXE, deco: TXD,
        def: 'Una sentencia falla a mitad de la transacción, por ejemplo por una clave duplicada.',
        rows: [['La clave', 'Desde que una sentencia falla, la transacción ya no puede confirmarse: solo queda deshacerla. Un <code>SAVEPOINT</code> previo permite volver a ese punto sin perder todo.']],
        steps: [
          S([], '<code>BEGIN</code> y un <code>UPDATE</code> que sale bien. La transacción está activa.', { A: { st: 'on', v: ['BEGIN', 'UPDATE stock: OK'] } }),
          S([M('A', 'F', 'fail', 'ERROR 23505')], 'El <code>INSERT</code> siguiente viola un <code>UNIQUE</code>: <code>duplicate key value violates unique constraint</code>. La transacción pasa a <b>fallida</b>: no puede seguir normalmente.', { A: { st: '', v: [] }, F: { st: 'fail', v: ['INSERT: clave duplicada'] } }),
          S([], 'En PostgreSQL, cualquier sentencia que envíes ahora responde <code>current transaction is aborted, commands ignored until end of transaction block</code> (código <code>25P02</code>). El <code>UPDATE</code> que salió bien tampoco se va a confirmar.', { F: { v: ['INSERT: clave duplicada', 'todo lo demás: 25P02'] } }),
          S([M('F', 'X', 'res', 'ROLLBACK')], 'La aplicación envía <code>ROLLBACK</code> (si mandara <code>COMMIT</code>, PostgreSQL también haría rollback). La transacción queda <b>abortada</b>: la base descarta sus cambios y libera los locks. Con MVCC no hay que "deshacer" en las páginas: las versiones nuevas simplemente quedan invisibles.', { F: { st: '', v: [] }, X: { st: 'warn', v: ['cambios descartados', 'locks liberados'] } }),
          S([], 'Desde abortada hay dos salidas: <b>reiniciar</b> la transacción completa, si el error fue transitorio (un deadlock o un error de serialización), o <b>matarla</b> y devolver el error, si fue lógico, como esta clave duplicada. Reintentar una clave duplicada vuelve a fallar.', { X: { v: ['cambios descartados', 'reiniciar o devolver el error'] } })
        ] },
      { id: 'crash', name: 'Se corta la luz al confirmar', nodes: TXN, edges: TXE, deco: TXD,
        def: 'La máquina se apaga entre el <code>COMMIT</code> y el <code>fsync</code> del WAL.',
        rows: [['La clave', 'El cliente no sabe si su transacción se confirmó: la conexión se cortó antes de la respuesta. Por eso los reintentos necesitan una clave de idempotencia (M02).']],
        steps: [
          S([], 'Una transacción activa que inserta un pedido.', { A: { st: 'on', v: ['BEGIN', 'INSERT pedido 991'] } }),
          S([M('A', 'P', 'req', 'COMMIT')], 'El cliente envía <code>COMMIT</code>. La transacción está parcialmente confirmada: falta que el registro de commit llegue al disco.', { A: { st: '', v: [] }, P: { st: 'on', v: ['esperando el fsync'] } }),
          S([M('P', 'F', 'fail', 'corte de luz')], 'Se corta la luz antes del <code>fsync</code>. Lo que estaba en memoria se pierde. La transacción pasa a <b>fallida</b>, aunque nadie lo va a saber hasta que la base vuelva.', { P: { st: '', v: [] }, F: { st: 'fail', v: ['sin registro de commit', 'en disco'] } }),
          S([M('F', 'X', 'res', 'recuperación con el WAL')], 'Al arrancar, la base reproduce el WAL. No encuentra el registro de commit de esta transacción, así que la trata como <b>abortada</b>: el pedido 991 no existe.', { F: { st: '', v: [] }, X: { st: 'warn', v: ['pedido 991: no existe'] } }),
          S([], 'Del lado del cliente, la conexión se cortó sin respuesta. Si el corte hubiera sido un instante después del <code>fsync</code>, el pedido existiría. Desde afuera, los dos casos se ven igual: reintenta con la misma clave de idempotencia y deja que un <code>UNIQUE</code> descarte el duplicado.', { X: { v: ['pedido 991: no existe', 'cliente: ¿se guardó?'] } })
        ] },
      { id: 'serial', name: 'Conflicto al confirmar', nodes: TXN, edges: TXE, deco: TXD,
        def: 'Con aislamiento serializable, PostgreSQL puede detectar el conflicto recién al confirmar.',
        rows: [['La clave', 'Una transacción puede fallar estando parcialmente confirmada. El código <code>40001</code> significa "reintenta todo": la base garantiza que la próxima vez verás datos nuevos.']],
        steps: [
          S([], 'Una transacción <code>SERIALIZABLE</code> lee cuántos médicos hay de guardia y da de baja a uno (el write skew de 5.6).', { A: { st: 'on', v: ['SELECT count(*) → 2', 'UPDATE guardia Ana'] } }),
          S([M('A', 'P', 'req', 'COMMIT')], 'Envía <code>COMMIT</code>. Antes de escribir el registro de commit, la base revisa las dependencias que anotó entre transacciones concurrentes.', { A: { st: '', v: [] }, P: { st: 'on', v: ['revisa dependencias', 'de lectura y escritura'] } }),
          S([M('P', 'F', 'fail', 'ERROR 40001')], 'Encuentra un ciclo peligroso con otra transacción que ya confirmó: <code>could not serialize access due to read/write dependencies among transactions</code>. La transacción pasa a <b>fallida</b> sin llegar a confirmarse.', { P: { st: '', v: [] }, F: { st: 'fail', v: ['40001: serialización'] } }),
          S([M('F', 'X', 'res', 'ROLLBACK')], 'Se deshace. La aplicación tiene que estar preparada para esto.', { F: { st: '', v: [] }, X: { st: 'warn', v: ['cambios descartados'] } }),
          S([], 'La aplicación <b>reinicia</b> la transacción entera, desde el <code>BEGIN</code>. Esta vez el <code>SELECT</code> ve 1 médico de guardia y la regla de negocio impide la baja.', { X: { st: '', v: [] }, A: { st: 'on', v: ['SELECT count(*) → 1', 'no se da de baja'] } })
        ] }
    ]
  };

  /* ======================= Índice clusterizado frente a heap ======================= */

  var Q = { x: 8, y: 120, w: 150, h: 92, name: 'Consulta', c: '--l-client' };
  var IDX_SCENES = [
    { id: 'inno-pk', name: 'InnoDB: por clave primaria',
      nodes: { Q: Q,
        R: { x: 250, y: 12, w: 190, h: 70, name: 'Raíz de la PK', sub: 'ids 1 … 9 000 000', c: '--l-db' },
        I: { x: 250, y: 130, w: 190, h: 70, name: 'Página interna', sub: 'ids 40 001 … 80 000', c: '--l-db' },
        L: { x: 520, y: 220, w: 200, h: 98, name: 'Hoja de la PK', sub: 'aquí vive la fila entera', c: '--l-db' } },
      def: 'En InnoDB (MySQL), la tabla es el B-tree de la clave primaria: las hojas guardan las filas completas, ordenadas por <code>id</code>.',
      rows: [['Páginas', '3, todas del mismo árbol.'], ['La clave', 'Buscar por la PK es el camino más corto que existe: la fila está en la hoja, no hay que ir a buscarla a otro lado.']],
      steps: [
        S([], '<code>SELECT * FROM usuarios WHERE id = 42017</code>. El árbol de la clave primaria es la tabla misma: no existe otra copia de las filas.', { Q: { st: 'on', v: ['id = 42017', 'páginas leídas: 0'] } }),
        S([M('Q', 'R', 'req', 'id = 42017')], 'Lee la raíz: casi siempre está en memoria. Dice que los ids entre 40 001 y 80 000 están en la página interna 7.', { Q: { v: ['id = 42017', 'páginas leídas: 1'] }, R: { v: ['→ página 7'] } }),
        S([M('R', 'I', 'req', 'página 7')], 'Baja a la página interna, que apunta a la hoja donde cae el 42 017.', { Q: { v: ['id = 42017', 'páginas leídas: 2'] }, I: { v: ['→ hoja 3 120'] } }),
        S([M('I', 'L', 'req', 'hoja 3 120')], 'La hoja tiene la fila completa: nombre, email, fecha. Se terminó.', { Q: { v: ['id = 42017', 'páginas leídas: 3'] }, L: { st: 'ok', v: ['42017 · Ana · ana@…'] } }),
        S([M('L', 'Q', 'res', 'fila completa')], 'Tres páginas, y la fila llegó entera. Por eso en InnoDB la clave primaria importa tanto: define el orden físico de la tabla.', { Q: { st: 'ok' } })
      ] },
    { id: 'inno-sec', name: 'InnoDB: por índice secundario',
      nodes: { Q: Q,
        SR: { x: 196, y: 12, w: 176, h: 70, name: 'Índice de email', sub: 'raíz', c: '--l-cache' },
        SL: { x: 196, y: 236, w: 176, h: 84, name: 'Hoja del índice', sub: 'email → id', c: '--l-cache' },
        PR: { x: 430, y: 12, w: 160, h: 70, name: 'Raíz de la PK', c: '--l-db' },
        PI: { x: 430, y: 124, w: 160, h: 60, name: 'Página interna', c: '--l-db' },
        PL: { x: 560, y: 236, w: 166, h: 84, name: 'Hoja de la PK', sub: 'fila completa', c: '--l-db' } },
      def: 'Un índice secundario de InnoDB no apunta a la fila: guarda el valor de la clave primaria. Para traer la fila hay que buscar dos veces.',
      rows: [['Páginas', '2 en el índice + 3 en la PK = 5.'], ['La clave', 'Cada índice secundario lleva una copia de la PK en cada entrada: una PK de UUID de 16 bytes engorda todos los índices de la tabla.']],
      steps: [
        S([], '<code>SELECT * FROM usuarios WHERE email = \'ana@ej.com\'</code>. Hay un índice sobre <code>email</code>.', { Q: { st: 'on', v: ['email = ana@…', 'páginas leídas: 0'] } }),
        S([M('Q', 'SR', 'req', 'ana@ej.com')], 'Lee la raíz del índice de email, ordenado alfabéticamente.', { Q: { v: ['email = ana@…', 'páginas leídas: 1'] } }),
        S([M('SR', 'SL', 'req', 'hoja a…')], 'La hoja del índice tiene la entrada, pero no la fila: solo <code>ana@ej.com → id 42017</code>.', { Q: { v: ['email = ana@…', 'páginas leídas: 2'] }, SL: { st: 'on', v: ['ana@… → 42017'] } }),
        S([M('SL', 'PR', 'req', 'buscar id 42017')], 'Con el <code>id</code> en la mano, empieza una segunda búsqueda, ahora en el árbol de la clave primaria.', { SL: { st: '' }, Q: { v: ['email = ana@…', 'páginas leídas: 3'] } }),
        S([M('PR', 'PI', 'req', 'página 7')], 'Raíz e interna de la PK, como en la búsqueda por clave primaria.', { Q: { v: ['email = ana@…', 'páginas leídas: 4'] } }),
        S([M('PI', 'PL', 'req', 'hoja 3 120')], 'Llega a la hoja de la PK, donde está la fila.', { Q: { v: ['email = ana@…', 'páginas leídas: 5'] }, PL: { st: 'ok', v: ['42017 · Ana · …'] } }),
        S([M('PL', 'Q', 'res', 'fila completa')], 'Cinco páginas. Si la consulta pidiera solo <code>id</code> y <code>email</code>, se habría quedado en la hoja del índice: ya tiene las dos columnas (un índice que cubre).', { Q: { st: 'ok' } })
      ] },
    { id: 'pg-idx', name: 'PostgreSQL: índice + heap',
      nodes: { Q: Q,
        SR: { x: 220, y: 12, w: 190, h: 70, name: 'Índice de email', sub: 'raíz', c: '--l-cache' },
        SL: { x: 220, y: 236, w: 190, h: 84, name: 'Hoja del índice', sub: 'email → (página, posición)', c: '--l-cache' },
        H: { x: 500, y: 120, w: 220, h: 108, name: 'Heap: página 17', sub: 'filas sin orden', c: '--l-db' } },
      def: 'En PostgreSQL la tabla es un heap: páginas de 8 kB con filas en el orden en que llegaron. Todos los índices, también el de la clave primaria, son estructuras aparte que apuntan a una posición física (el ctid).',
      rows: [['Páginas', '2 en el índice + 1 en el heap = 3.'], ['La clave', 'La clave primaria no tiene nada especial: es un índice único más. Ninguna búsqueda paga doble árbol, pero un rango por índice puede saltar por muchas páginas del heap.']],
      steps: [
        S([], 'La misma consulta por <code>email</code>, ahora en PostgreSQL.', { Q: { st: 'on', v: ['email = ana@…', 'páginas leídas: 0'] } }),
        S([M('Q', 'SR', 'req', 'ana@ej.com')], 'Raíz del índice.', { Q: { v: ['email = ana@…', 'páginas leídas: 1'] } }),
        S([M('SR', 'SL', 'req', 'hoja a…')], 'La hoja tiene <code>ana@ej.com → (17, 3)</code>: página 17 del heap, posición 3. Un puntero físico, no un id.', { Q: { v: ['email = ana@…', 'páginas leídas: 2'] }, SL: { st: 'on', v: ['ana@… → (17, 3)'] } }),
        S([M('SL', 'H', 'req', 'ctid (17, 3)')], 'Va directo a la página 17 del heap y toma la tupla 3. La base todavía revisa que esa versión sea visible para tu snapshot (5.6).', { SL: { st: '' }, Q: { v: ['email = ana@…', 'páginas leídas: 3'] }, H: { st: 'ok', v: ['(17, 3): 42017 · Ana', 'visible: sí'] } }),
        S([M('H', 'Q', 'res', 'fila completa')], 'Tres páginas. El precio está en otro lado: cuando una actualización mueve la fila a otra página, hay que actualizar los punteros de todos los índices, salvo que sea una actualización HOT.', { Q: { st: 'ok' } })
      ] },
    { id: 'pg-only', name: 'PostgreSQL: index-only scan',
      nodes: { Q: Q,
        SR: { x: 220, y: 12, w: 200, h: 70, name: 'Índice (email)', sub: 'INCLUDE (nombre)', c: '--l-cache' },
        SL: { x: 220, y: 236, w: 200, h: 84, name: 'Hoja del índice', sub: 'email, nombre → ctid', c: '--l-cache' },
        VM: { x: 520, y: 30, w: 200, h: 84, name: 'Visibility map', sub: '2 bits por página', c: '--l-queue' },
        H: { x: 520, y: 220, w: 200, h: 98, name: 'Heap: página 17', c: '--l-db' } },
      def: 'Si el índice tiene todas las columnas que pide la consulta, la base puede no tocar la tabla. En PostgreSQL eso depende además del visibility map, que dice qué páginas tienen solo filas visibles para todos.',
      rows: [['Páginas', '2 del índice y un bit del visibility map; el heap, solo si la página no está marcada.'], ['La clave', 'Una tabla con muchas escrituras recientes tiene pocas páginas marcadas, y el index-only scan termina leyendo el heap igual. <code>VACUUM</code> vuelve a marcarlas.']],
      steps: [
        S([], '<code>SELECT nombre FROM usuarios WHERE email = \'ana@ej.com\'</code>, con <code>CREATE INDEX … ON usuarios (email) INCLUDE (nombre)</code>.', { Q: { st: 'on', v: ['solo pide nombre', 'páginas leídas: 0'] } }),
        S([M('Q', 'SR', 'req', 'ana@ej.com')], 'Raíz del índice.', { Q: { v: ['solo pide nombre', 'páginas leídas: 1'] } }),
        S([M('SR', 'SL', 'req', 'hoja a…')], 'La hoja ya tiene el nombre: <code>ana@ej.com, Ana → (17, 3)</code>. Pero el índice no sabe si esa versión de la fila es visible para tu transacción.', { Q: { v: ['solo pide nombre', 'páginas leídas: 2'] }, SL: { st: 'on', v: ['ana@…, Ana → (17, 3)'] } }),
        S([M('SL', 'VM', 'req', '¿página 17?')], 'Pregunta al visibility map por la página 17. Es un mapa diminuto (2 bits por página de 8 kB) que casi siempre está en memoria.', { SL: { st: '' }, VM: { st: 'ok', v: ['página 17: todo visible'] } }),
        S([M('VM', 'Q', 'ok', 'Ana, sin tocar el heap')], 'La página está marcada como "todo visible": la respuesta sale del índice y el heap no se lee. En <code>EXPLAIN</code> aparece <code>Index Only Scan … Heap Fetches: 0</code>.', { Q: { st: 'ok', v: ['solo pide nombre', 'páginas leídas: 2'] } }),
        S([], 'Si la página 17 tuviera cambios recientes, el bit estaría apagado y la base iría al heap a comprobar la versión. Por eso <code>Heap Fetches</code> alto en una tabla muy escrita es normal hasta que corre <code>VACUUM</code>.', { H: { st: 'warn', v: ['se lee solo si el bit', 'está apagado'] } })
      ] },
    { id: 'range', name: 'Un rango en los dos',
      nodes: { Q: Q,
        IL: { x: 210, y: 120, w: 170, h: 92, name: 'Hojas del índice', sub: 'created_at en orden', c: '--l-cache' },
        H1: { x: 470, y: 8, w: 120, h: 66, name: 'Heap 903', c: '--l-db' },
        H2: { x: 600, y: 90, w: 120, h: 66, name: 'Heap 12', c: '--l-db' },
        H3: { x: 470, y: 172, w: 120, h: 66, name: 'Heap 4 410', c: '--l-db' },
        H4: { x: 600, y: 254, w: 120, h: 66, name: 'Heap 77', c: '--l-db' } },
      def: 'Un rango por un índice que no define el orden físico de la tabla termina saltando a una página distinta por cada fila. Cuando el rango es grande, el planner prefiere leer la tabla entera.',
      rows: [['Páginas', 'Hasta una página del heap por fila. 4 filas en 4 páginas en este ejemplo; 10 000 filas pueden ser 10 000 lecturas aleatorias.'], ['La clave', 'En InnoDB, un rango por la clave primaria lee hojas contiguas. En PostgreSQL, una tabla cargada en orden de llegada queda casi ordenada por fecha, y un bitmap scan ordena los punteros por página antes de leer.']],
      steps: [
        S([], '<code>SELECT * FROM pedidos WHERE cliente_id = 7 AND created_at &gt;= \'2026-09-01\'</code>, con un índice <code>(cliente_id, created_at)</code>. Las filas del cliente 7 llegaron en momentos distintos y quedaron repartidas por todo el heap.', { Q: { st: 'on', v: ['cliente 7, septiembre', 'páginas de heap: 0'] } }),
        S([M('Q', 'IL', 'req', 'cliente 7, sep')], 'En el índice, las entradas del cliente 7 de septiembre están juntas: un tramo contiguo, gracias al orden (cliente_id, created_at).', { IL: { st: 'on', v: ['4 entradas seguidas', '→ 903, 12, 4 410, 77'] } }),
        S([M('IL', 'H1', 'req', '(903, 2)'), M('IL', 'H2', 'req', '(12, 5)'), M('IL', 'H3', 'req', '(4410, 1)'), M('IL', 'H4', 'req', '(77, 9)')], 'Pero cada entrada apunta a una página distinta del heap. Cuatro filas, cuatro lecturas aleatorias. Si no están en memoria, cada una es un viaje al disco.', { Q: { v: ['cliente 7, septiembre', 'páginas de heap: 4'] }, H1: { st: 'ok' }, H2: { st: 'ok' }, H3: { st: 'ok' }, H4: { st: 'ok' } }),
        S([], 'Con 10 000 filas el planner hace la cuenta: 10 000 lecturas aleatorias pueden costar más que leer la tabla entera de corrido. Por eso un índice que "debería usarse" a veces no se usa: no es un error, es el costo estimado.', { IL: { st: '' } })
      ] }
  ];

  /* ======================= MVCC y snapshots ======================= */

  var MV = {
    T1: { x: 8, y: 14, w: 210, h: 116, name: 'T1 · xid 100', c: '--l-service' },
    T2: { x: 8, y: 204, w: 210, h: 116, name: 'T2 · xid 101', c: '--l-gpu' },
    V1: { x: 470, y: 14, w: 250, h: 92, name: 'Versión 1 de la fila', c: '--l-db' },
    V2: { x: 470, y: 150, w: 250, h: 92, name: 'Versión 2 de la fila', c: '--l-db' },
    VC: { x: 470, y: 262, w: 250, h: 62, name: 'Vacuum', c: '--l-queue' }
  };
  function mvNodes(keys) { var o = {}; keys.forEach(function (k) { o[k] = MV[k]; }); return o; }
  var MVCC = {
    title: 'MVCC: versiones de filas y snapshots', aria: 'Dos transacciones a la izquierda y las versiones de una fila a la derecha', vbw: 734, vbh: 334,
    scenes: [
      { id: 'rc', name: 'Read committed', nodes: mvNodes(['T1', 'T2', 'V1', 'V2']),
        init: { V1: { v: ['xmin 90 · xmax —', 'saldo = 500'] } },
        def: 'Cada sentencia toma un snapshot nuevo: ve lo que estaba confirmado en el instante en que empezó esa sentencia.',
        rows: [['Ganas', 'Siempre ves datos confirmados recientes, y casi no hay errores de serialización.'], ['Pagas', 'Dos lecturas de la misma transacción pueden dar resultados distintos (lectura no repetible).']],
        steps: [
          S([], 'Una fila de <code>cuentas</code> con <code>saldo = 500</code>. Cada versión guarda <code>xmin</code> (la transacción que la creó) y <code>xmax</code> (la que la borró o reemplazó). La versión 1 la creó la transacción 90, ya confirmada.', { T1: { st: 'on', v: ['BEGIN (read committed)'] } }),
          S([M('T1', 'V1', 'req', 'SELECT saldo')], 'T1 lee. Su snapshot dice "veo lo confirmado hasta ahora": la 90 está confirmada, así que ve la versión 1.', { T1: { v: ['BEGIN (read committed)', 'lee: 500'] } }),
          S([M('T2', 'V2', 'write', 'UPDATE saldo = 400')], 'T2 actualiza. MVCC no pisa la fila: crea la versión 2 con <code>xmin 101</code> y marca la versión 1 con <code>xmax 101</code>. Las dos versiones conviven.', { T2: { st: 'on', v: ['UPDATE saldo = 400', 'sin confirmar'] }, V1: { v: ['xmin 90 · xmax 101', 'saldo = 500'] }, V2: { st: 'warn', v: ['xmin 101 · xmax —', 'saldo = 400 (sin confirmar)'] } }),
          S([M('T1', 'V1', 'req', 'SELECT saldo')], 'T1 lee otra vez. La 101 no está confirmada: para T1, la versión 2 no existe y la versión 1 sigue viva. Lee 500. Nadie se bloqueó: los lectores no esperan a los escritores.', { T1: { v: ['BEGIN (read committed)', 'lee: 500', 'lee: 500'] } }),
          S([], 'T2 hace <code>COMMIT</code>.', { T2: { st: 'ok', v: ['COMMIT'] }, V2: { st: 'ok', v: ['xmin 101 · xmax —', 'saldo = 400'] } }),
          S([M('T1', 'V2', 'req', 'SELECT saldo')], 'T1 lee por tercera vez. Esta sentencia toma un snapshot nuevo, donde la 101 ya está confirmada: ve la versión 2 y lee 400. Dentro de la misma transacción leyó 500 y después 400: una <b>lectura no repetible</b>.', { T1: { st: 'warn', v: ['lee: 500', 'lee: 500', 'lee: 400 ← cambió'] } })
        ] },
      { id: 'rr', name: 'Snapshot isolation', nodes: mvNodes(['T1', 'T2', 'V1', 'V2']),
        init: { V1: { v: ['xmin 90 · xmax —', 'saldo = 500'] } },
        def: 'Repeatable read en PostgreSQL. La transacción toma un solo snapshot, en su primera sentencia, y lo usa hasta el final: ve la base congelada en ese instante.',
        rows: [['Ganas', 'Lecturas repetibles y reportes coherentes, sin bloquear a nadie.'], ['Pagas', 'Si escribes una fila que otro cambió después de tu snapshot, recibes el error 40001 y reintentas. Y no detecta el write skew.']],
        steps: [
          S([], 'La misma fila. T1 empieza con <code>BEGIN ISOLATION LEVEL REPEATABLE READ</code>.', { T1: { st: 'on', v: ['BEGIN (repeatable read)'] } }),
          S([M('T1', 'V1', 'req', 'SELECT saldo')], 'Primera sentencia: T1 toma su snapshot. Queda anotado, en esencia, "veo lo confirmado antes de la transacción 101". Lee 500.', { T1: { v: ['snapshot: < 101', 'lee: 500'] } }),
          S([M('T2', 'V2', 'write', 'UPDATE saldo = 400')], 'T2 crea la versión 2 y confirma.', { T2: { st: 'ok', v: ['UPDATE saldo = 400', 'COMMIT'] }, V1: { v: ['xmin 90 · xmax 101', 'saldo = 500'] }, V2: { st: 'ok', v: ['xmin 101 · xmax —', 'saldo = 400'] } }),
          S([M('T1', 'V1', 'req', 'SELECT saldo')], 'T1 lee otra vez con el <b>mismo snapshot</b>. Para ese snapshot, la 101 todavía no existía: la versión 2 es invisible y la versión 1, que la 101 reemplazó, sigue siendo la buena. Lee 500. Esto es <b>snapshot isolation</b>.', { T1: { st: 'ok', v: ['snapshot: < 101', 'lee: 500', 'lee: 500 ← igual'] } }),
          S([], 'La base no copió nada para darte el snapshot: solo usa <code>xmin</code> y <code>xmax</code> para decidir qué versión ves. El costo es guardar las versiones viejas mientras algún snapshot pueda necesitarlas.')
        ] },
      { id: 'fuw', name: 'Dos escriben la misma fila', nodes: mvNodes(['T1', 'T2', 'V1', 'V2']),
        init: { V1: { v: ['xmin 90 · xmax —', 'stock = 10'] } },
        def: 'Con snapshot isolation gana el primero que escribe: si otro confirmó un cambio a tu fila después de tu snapshot, tu escritura falla.',
        rows: [['La clave', 'Así evita PostgreSQL la actualización perdida en repeatable read. En read committed, en cambio, el segundo espera, relee la versión nueva y aplica su cambio sobre ella.']],
        steps: [
          S([], 'Las dos transacciones están en repeatable read y quieren vender una unidad: <code>UPDATE productos SET stock = stock − 1</code>.', { T1: { st: 'on', v: ['snapshot tomado'] }, T2: { st: 'on', v: ['snapshot tomado'] } }),
          S([M('T2', 'V2', 'write', 'stock = 9')], 'T2 escribe primero: crea la versión 2 y toma el lock de la fila.', { T2: { v: ['UPDATE: stock = 9', 'tiene el lock'] }, V1: { v: ['xmin 90 · xmax 101', 'stock = 10'] }, V2: { st: 'warn', v: ['xmin 101', 'stock = 9 (sin confirmar)'] } }),
          S([M('T1', 'V1', 'warn', 'UPDATE: espera el lock')], 'T1 intenta actualizar la misma fila y se queda esperando: no puede escribir una fila que otro tiene bloqueada.', { T1: { st: 'warn', v: ['UPDATE: esperando'] } }),
          S([], 'T2 hace <code>COMMIT</code> y libera el lock.', { T2: { st: 'ok', v: ['COMMIT'] }, V2: { st: 'ok', v: ['xmin 101', 'stock = 9'] } }),
          S([M('V1', 'T1', 'fail', 'ERROR 40001')], 'T1 despierta y ve que la fila cambió después de su snapshot. Aplicar su <code>stock − 1</code> sobre el 10 que ve perdería la venta de T2, así que falla: <code>could not serialize access due to concurrent update</code>.', { T1: { st: 'fail', v: ['ERROR 40001', 'ROLLBACK y reintentar'] } }),
          S([M('T1', 'V2', 'req', 'reintento: stock = 8')], 'T1 reintenta desde el principio con un snapshot nuevo, ve 9 y deja 8. Las dos ventas cuentan.', { T1: { st: 'ok', v: ['reintento: stock = 8'] }, V2: { v: ['xmin 101 · xmax 102', 'stock = 9'] } })
        ] },
      { id: 'vacuum', name: 'Versiones viejas y vacuum', nodes: mvNodes(['T1', 'T2', 'V1', 'V2', 'VC']),
        init: { V1: { v: ['xmin 90 · xmax 101', 'saldo = 500 (vieja)'] }, V2: { st: 'ok', v: ['xmin 101 · xmax —', 'saldo = 400'] } },
        def: 'Una versión vieja solo se puede borrar cuando ningún snapshot activo la necesita. Lo hace <code>VACUUM</code>, normalmente el autovacuum.',
        rows: [['La clave', 'Una transacción que queda abierta horas retiene todas las versiones viejas de todas las tablas: la base se hincha y las consultas se vuelven lentas (5.16).']],
        steps: [
          S([], 'Después del <code>UPDATE</code> quedaron dos versiones. La vieja, con <code>xmax 101</code> confirmado, ya no la ve ninguna transacción nueva.', {}),
          S([], 'Pero T1 sigue abierta, con un snapshot de antes de la 101: para ella, la versión 1 es la buena. Alguien abrió una transacción en una consola y se fue a almorzar.', { T1: { st: 'warn', v: ['abierta hace 3 horas', 'snapshot: < 101'] } }),
          S([M('VC', 'V1', 'warn', '¿la borro?')], 'El vacuum revisa la versión 1. Hay un snapshot activo más viejo que la 101: no puede borrarla. Lo mismo con cada fila que se actualizó en estas 3 horas.', { VC: { st: 'warn', v: ['no puede limpiar'] } }),
          S([], 'T1 por fin termina.', { T1: { st: '', v: ['COMMIT'] } }),
          S([M('VC', 'V1', 'ok', 'borrar versión 1')], 'Ahora ningún snapshot necesita la versión 1: el vacuum marca su espacio como libre para filas nuevas y actualiza el visibility map.', { VC: { st: 'ok', v: ['espacio recuperado'] }, V1: { st: 'down', v: ['espacio libre'] } })
        ] }
    ]
  };

  /* ======================= Replicación síncrona y asíncrona ======================= */

  var RP = {
    C: { x: 8, y: 124, w: 130, h: 80, name: 'Aplicación', c: '--l-client' },
    L: { x: 250, y: 112, w: 190, h: 104, name: 'Líder', sub: 'zona a', c: '--l-db' },
    R1: { x: 540, y: 10, w: 186, h: 104, name: 'Réplica 1', sub: 'zona b', c: '--l-db' },
    R2: { x: 540, y: 218, w: 186, h: 104, name: 'Réplica 2', sub: 'zona c', c: '--l-db' }
  };
  var REPL = {
    title: 'Replicación síncrona y asíncrona', aria: 'Una aplicación, un líder y dos réplicas en zonas distintas', vbw: 734, vbh: 330,
    scenes: [
      { id: 'sync', name: 'Síncrona: el líder se cae', nodes: RP,
        init: { L: { v: ['saldo = 100'] }, R1: { v: ['saldo = 100', 'síncrona'] }, R2: { v: ['saldo = 100', 'asíncrona'] } },
        def: 'El commit espera a que la réplica síncrona confirme que tiene el WAL. Si el líder se cae, esa réplica tiene todo lo confirmado.',
        rows: [['Ganas', 'Un failover sin perder transacciones confirmadas (RPO = 0).'], ['Pagas', 'Cada commit suma la ida y vuelta a la otra zona, de 1 a 2 ms en la misma región. Entre regiones, decenas de milisegundos.']],
        steps: [
          S([M('C', 'L', 'write', 'UPDATE saldo = 50; COMMIT')], 'La aplicación confirma una escritura. El líder la escribe en su WAL.', { L: { st: 'on', v: ['saldo = 50', 'esperando a réplica 1'] } }),
          S([M('L', 'R1', 'write', 'WAL'), M('L', 'R2', 'async', 'WAL')], 'Envía el WAL a las dos réplicas. Solo espera a la réplica 1, la síncrona.', {}),
          S([M('R1', 'L', 'ok', 'ACK: lo tengo')], 'La réplica 1 escribe el WAL en su disco y avisa. La réplica 2 lo aplicará cuando pueda.', { R1: { st: 'ok', v: ['saldo = 50', 'síncrona'] } }),
          S([M('L', 'C', 'ok', 'COMMIT OK')], 'Recién ahora el líder responde. La escritura tardó lo del líder más una ida y vuelta a la zona b.', { L: { st: 'ok', v: ['saldo = 50'] } }),
          S([], 'El líder se cae.', { L: { st: 'down', v: [] }, R1: { st: '' } }),
          S([], 'Se promueve la réplica 1. Tiene el saldo 50: <b>no se perdió nada</b> de lo que el cliente vio confirmado.', { R1: { st: 'ok', v: ['saldo = 50', 'nuevo líder'] }, R2: { v: ['saldo = 50', 'sigue al nuevo líder'] } })
        ] },
      { id: 'async', name: 'Asíncrona: el líder se cae', nodes: RP,
        init: { L: { v: ['saldo = 100'] }, R1: { v: ['saldo = 100', 'asíncrona'] }, R2: { v: ['saldo = 100', 'asíncrona'] } },
        def: 'El líder confirma en cuanto el WAL está en su propio disco, y envía el WAL a las réplicas después.',
        rows: [['Ganas', 'Commits rápidos, y el líder no se frena si una réplica se atrasa o se cae.'], ['Pagas', 'Un failover pierde lo que no alcanzó a viajar. El cliente recibió OK por algo que ya no existe.']],
        steps: [
          S([M('C', 'L', 'write', 'UPDATE saldo = 50; COMMIT')], 'La aplicación confirma una escritura.', { L: { st: 'on', v: ['saldo = 50'] } }),
          S([M('L', 'C', 'ok', 'COMMIT OK (rápido)')], 'El líder escribe su WAL local y responde de inmediato, sin esperar a nadie.', { L: { st: 'ok', v: ['saldo = 50', 'WAL por enviar'] } }),
          S([], 'Antes de enviar ese WAL, el líder se cae. Pasa más de lo que parece: el WAL suele viajar con milisegundos de retraso, pero bajo carga el retraso crece.', { L: { st: 'down', v: [] } }),
          S([], 'Se promueve la réplica 1. Tiene <code>saldo = 100</code>.', { R1: { st: 'warn', v: ['saldo = 100', 'nuevo líder'] } }),
          S([], 'La escritura se <b>perdió</b>, y la aplicación le dijo al usuario que se había guardado. Si el viejo líder vuelve con su <code>saldo = 50</code>, hay dos historias distintas: se descarta la suya y se reconstruye desde el nuevo líder (con <code>pg_rewind</code>, en PostgreSQL).', { R1: { st: 'fail', v: ['saldo = 100', 'perdió el saldo = 50'] } })
        ] },
      { id: 'anyone', name: 'Síncrona con una réplica caída', nodes: RP,
        init: { L: { v: ['saldo = 100'] }, R1: { v: ['saldo = 100'] }, R2: { v: ['saldo = 100'] } },
        def: 'Con una sola réplica síncrona, si esa réplica se cae, el líder deja de confirmar. La salida es pedir confirmación a cualquiera de varias: <code>synchronous_standby_names = \'ANY 1 (r1, r2)\'</code> en PostgreSQL.',
        rows: [['La clave', 'Síncrona no significa "espera a todas": espera a un quórum. Con ANY 1 entre dos réplicas, una puede caerse sin frenar las escrituras.']],
        steps: [
          S([], 'La réplica 1 se cae.', { R1: { st: 'down', v: [] } }),
          S([M('C', 'L', 'write', 'UPDATE saldo = 50; COMMIT')], 'Llega una escritura.', { L: { st: 'on', v: ['saldo = 50', 'espera 1 de (r1, r2)'] } }),
          S([M('L', 'R1', 'fail', 'WAL: sin respuesta'), M('L', 'R2', 'write', 'WAL')], 'El líder envía el WAL a las dos. La 1 no contesta.', {}),
          S([M('R2', 'L', 'ok', 'ACK')], 'Con <code>ANY 1 (r1, r2)</code>, alcanza con la réplica 2.', { R2: { st: 'ok', v: ['saldo = 50'] } }),
          S([M('L', 'C', 'ok', 'COMMIT OK')], 'La escritura se confirma. Con <code>synchronous_standby_names = \'r1\'</code>, en cambio, este commit se habría quedado colgado hasta que la réplica 1 volviera: la base sigue viva, pero no confirma nada.', { L: { st: 'ok', v: ['saldo = 50'] } })
        ] },
      { id: 'lag', name: 'Leer de una réplica atrasada', nodes: RP,
        init: { L: { v: ['nombre = "Ana"'] }, R1: { v: ['nombre = "Ana"'] }, R2: { v: ['nombre = "Ana"', 'retraso: 2 s'] } },
        def: 'Con réplicas asíncronas para lecturas, el usuario puede no ver lo que acaba de escribir. Es la falta de read-your-writes.',
        rows: [['La clave', 'El problema no es la réplica: es mandar la lectura de quien acaba de escribir a cualquier réplica. 5.10 muestra las soluciones.']],
        steps: [
          S([M('C', 'L', 'write', 'nombre = "Ana María"')], 'El usuario cambia su nombre. La escritura va al líder.', { L: { st: 'ok', v: ['nombre = "Ana María"'] } }),
          S([M('L', 'C', 'ok', 'COMMIT OK')], 'Confirmado. La aplicación redirige al perfil.', {}),
          S([M('C', 'R2', 'req', 'SELECT nombre')], 'La página del perfil lee de una réplica, como todas las lecturas. Le toca la réplica 2, que va 2 segundos atrás.', {}),
          S([M('R2', 'C', 'fail', '"Ana"')], 'Devuelve el nombre viejo. El usuario piensa que su cambio no se guardó y lo vuelve a intentar.', { R2: { st: 'fail', v: ['nombre = "Ana"', 'retraso: 2 s'] } }),
          S([M('L', 'R2', 'async', 'WAL')], 'Dos segundos después llega el WAL. Si recarga, ve el nombre nuevo. El dato nunca se perdió: solo se leyó de un lugar atrasado.', { R2: { st: 'ok', v: ['nombre = "Ana María"'] } })
        ] }
    ]
  };

  /* ======================= Quórum paso a paso ======================= */

  var QN = {
    C: { x: 8, y: 116, w: 196, h: 100, name: 'Coordinador', sub: 'recibe la petición', c: '--l-service' },
    R1: { x: 520, y: 8, w: 206, h: 86, name: 'Réplica 1', c: '--l-db' },
    R2: { x: 520, y: 122, w: 206, h: 86, name: 'Réplica 2', c: '--l-db' },
    R3: { x: 520, y: 236, w: 206, h: 86, name: 'Réplica 3', c: '--l-db' }
  };
  var V1 = ['x = "rojo" · v1'];
  var QUORUM = {
    title: 'Quórum paso a paso: N = 3 réplicas', aria: 'Un coordinador y tres réplicas; cada réplica muestra su valor y su versión', vbw: 734, vbh: 330,
    scenes: [
      { id: 'w2r2', name: 'W = 2, R = 2', nodes: QN,
        init: { R1: { v: V1 }, R2: { v: V1 }, R3: { v: V1 } },
        def: 'La escritura espera 2 confirmaciones y la lectura consulta 2 réplicas. 2 + 2 = 4, más que las 3 réplicas: los dos grupos tienen que compartir al menos una.',
        rows: [['Ganas', 'La lectura siempre incluye una réplica con el valor nuevo, y una réplica puede caerse sin frenar ni escrituras ni lecturas.'], ['Pagas', 'Cada operación espera a la segunda réplica más rápida, no a la primera.']],
        steps: [
          S([], 'Tres réplicas con <code>x = "rojo"</code>, versión 1. Cada valor viaja con su versión: es lo que permite saber cuál es el más nuevo.', {}),
          S([M('C', 'R1', 'write', 'x = azul · v2'), M('C', 'R2', 'write', 'x = azul · v2'), M('C', 'R3', 'fail', 'x = azul · v2')], 'Llega <code>x = "azul"</code>. El coordinador lo envía a <b>las tres</b> réplicas, siempre. W no dice a cuántas se envía: dice a cuántas se espera. El mensaje a la réplica 3 se pierde.', { R1: { st: 'ok', v: ['x = "azul" · v2'] }, R2: { st: 'ok', v: ['x = "azul" · v2'] }, R3: { st: 'warn', v: ['x = "rojo" · v1', 'no le llegó'] } }),
          S([M('R1', 'C', 'ok', 'ACK'), M('R2', 'C', 'ok', 'ACK')], 'Llegan 2 confirmaciones. W = 2: alcanza. El coordinador responde OK al cliente, aunque la réplica 3 sigue con el valor viejo.', { C: { st: 'ok', v: ['escritura OK', '2 de 3 confirmaron'] } }),
          S([M('C', 'R2', 'req', 'GET x'), M('C', 'R3', 'req', 'GET x')], 'Más tarde, una lectura. R = 2: el coordinador consulta dos réplicas. Elegimos el peor caso: justo la réplica atrasada y una sola de las buenas. Con 2 de 3 no hay forma de esquivar a las dos que tienen v2.', { C: { st: 'on', v: ['lectura: espera 2'] }, R1: { st: '' }, R2: { st: '' }, R3: { st: '', v: ['x = "rojo" · v1'] } }),
          S([M('R2', 'C', 'res', 'azul · v2'), M('R3', 'C', 'res', 'rojo · v1')], 'Responden con valores distintos. El coordinador no vota por mayoría: se queda con la <b>versión más alta</b>, v2.', { C: { st: 'ok', v: ['devuelve "azul"', 'v2 > v1'] } }),
          S([M('C', 'R3', 'write', 'read repair: azul · v2')], 'De paso, le envía el valor nuevo a la réplica atrasada. Eso es <b>read repair</b>: las lecturas van arreglando réplicas.', { R3: { st: 'ok', v: ['x = "azul" · v2', 'reparada'] } })
        ] },
      { id: 'w1r1', name: 'W = 1, R = 1', nodes: QN,
        init: { R1: { v: V1 }, R2: { v: V1 }, R3: { v: V1 } },
        def: 'Escribe esperando 1 confirmación y lee de 1 réplica. 1 + 1 = 2, no supera 3: la réplica que lees puede no ser ninguna de las que recibieron la escritura.',
        rows: [['Ganas', 'Lo más rápido posible, y tolera dos réplicas caídas.'], ['Pagas', 'Lecturas viejas: consistencia eventual.']],
        steps: [
          S([M('C', 'R1', 'write', 'x = azul · v2'), M('C', 'R2', 'write', 'x = azul · v2'), M('C', 'R3', 'write', 'x = azul · v2')], 'La escritura se envía a las tres. La réplica 1 es la más rápida.', { R1: { st: 'ok', v: ['x = "azul" · v2'] }, R2: { st: 'warn', v: ['x = "rojo" · v1', 'todavía aplicando'] }, R3: { st: 'warn', v: ['x = "rojo" · v1', 'todavía aplicando'] } }),
          S([M('R1', 'C', 'ok', 'ACK')], 'W = 1: con la primera confirmación, el coordinador responde OK.', { C: { st: 'ok', v: ['escritura OK', '1 de 3 confirmó'] } }),
          S([M('C', 'R3', 'req', 'GET x')], 'Una lectura inmediata. R = 1: pregunta a una sola réplica, y le toca la 3.', { C: { st: 'on', v: ['lectura: espera 1'] } }),
          S([M('R3', 'C', 'fail', 'rojo · v1')], 'Devuelve el valor viejo. No hay otra respuesta con qué compararlo. El cliente escribió "azul" y leyó "rojo".', { C: { st: 'fail', v: ['devuelve "rojo"', 'valor viejo'] } }),
          S([], 'Unos milisegundos después, las réplicas 2 y 3 terminan de aplicar la escritura y todas convergen en "azul". Eso es consistencia eventual: converge, pero no sabes cuándo.', { R2: { st: 'ok', v: ['x = "azul" · v2'] }, R3: { st: 'ok', v: ['x = "azul" · v2'] }, C: { st: '', v: [] } })
        ] },
      { id: 'w3r1', name: 'W = 3, R = 1', nodes: QN,
        init: { R1: { v: V1 }, R2: { v: V1 }, R3: { v: V1, st: 'down' } },
        def: 'Escribe esperando a las tres réplicas y lee de una. 3 + 1 = 4 &gt; 3, así que una lectura siempre ve la última escritura confirmada. Pero ninguna escritura sobrevive a una réplica caída.',
        rows: [['Ganas', 'Lecturas de una sola réplica, rápidas y al día.'], ['Pagas', 'Con una réplica caída, ninguna escritura se confirma. Y un error de escritura no deshace lo que sí llegó.']],
        steps: [
          S([], 'La réplica 3 está caída.', {}),
          S([M('C', 'R1', 'write', 'x = azul · v2'), M('C', 'R2', 'write', 'x = azul · v2'), M('C', 'R3', 'fail', 'x = azul · v2')], 'Llega una escritura. Se envía a las tres.', { R1: { v: ['x = "azul" · v2'] }, R2: { v: ['x = "azul" · v2'] } }),
          S([M('R1', 'C', 'ok', 'ACK'), M('R2', 'C', 'ok', 'ACK')], 'Confirman 2. W = 3 necesita 3.', { C: { st: 'warn', v: ['2 de 3: esperando'] } }),
          S([], 'Vence el timeout y el coordinador responde error al cliente.', { C: { st: 'fail', v: ['escritura: error'] } }),
          S([], 'Lo traicionero: las réplicas 1 y 2 ya tienen "azul", y nadie lo deshace. Un quórum no es una transacción. Una lectura posterior puede devolver "azul" aunque el cliente recibió un error. Por eso estas escrituras tienen que ser idempotentes y reintentables.', { R1: { st: 'warn', v: ['x = "azul" · v2', 'quedó escrito'] }, R2: { st: 'warn', v: ['x = "azul" · v2', 'quedó escrito'] } })
        ] }
    ]
  };

  SD.ready(function () {
    function each(sel, cfg) { document.querySelectorAll(sel).forEach(function (el) { flowAnim(el, cfg); }); }
    each('[data-sim="txlife"]', TXLIFE);
    each('[data-sim="idxlookup"]', { title: 'Buscar una fila: índice clusterizado contra heap', aria: 'Páginas de un índice y de una tabla; la búsqueda salta de página en página', vbw: 734, vbh: 330, scenes: IDX_SCENES,
      foot: 'Cada salto es una página leída (8 kB en PostgreSQL, 16 kB en InnoDB). Las de arriba casi siempre están en memoria; las hojas y el heap, no siempre. El botón alterna lento, rápido y pausa; las flechas avanzan de a un paso.' });
    each('[data-sim="mvcc"]', MVCC);
    each('[data-sim="replsync"]', REPL);
    each('[data-sim="quorumflow"]', QUORUM);
  });
})();
