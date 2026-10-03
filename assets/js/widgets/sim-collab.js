/* Widgets del M31 (Google Docs):
   <div data-sim="ot">        dos clientes y un servidor que editan el mismo texto con OT, con red pausable y modo sin transformar
   <div data-calc="collab">   flota de servidores de sesión, mensajes y almacenamiento de un editor colaborativo
   La lógica de OT es pura y está en SD.otCore, para probarla en Node sin navegador. */
(function () {
  'use strict';
  var SD = window.SD || (window.SD = {});

  /* ======================= SD.otCore =======================
     Una operación es una lista de componentes que recorre el documento entero:
       número positivo  retain n: deja n caracteres como están
       texto            insert: inserta ese texto
       número negativo  delete n: borra n caracteres
     Es el formato de Wave y de ot.js. Con él, transform siempre está definida y cumple TP1. */

  function isRetain(c) { return typeof c === 'number' && c > 0; }
  function isDelete(c) { return typeof c === 'number' && c < 0; }
  function isInsert(c) { return typeof c === 'string'; }

  /* Agrega un componente fusionándolo con el anterior si es del mismo tipo. */
  function push(op, c) {
    if (c === 0 || c === '') return op;
    var last = op[op.length - 1];
    if (isRetain(c) && isRetain(last)) op[op.length - 1] = last + c;
    else if (isDelete(c) && isDelete(last)) op[op.length - 1] = last + c;
    else if (isInsert(c) && isInsert(last)) op[op.length - 1] = last + c;
    /* Convención: un insert va antes que un delete en la misma posición, así dos ops equivalentes se escriben igual. */
    else if (isInsert(c) && isDelete(last)) {
      if (isInsert(op[op.length - 2])) op[op.length - 2] += c;
      else op.splice(op.length - 1, 0, c);
    }
    else op.push(c);
    return op;
  }
  function pad(op, n) { return n > 0 ? op.concat(n) : op; }
  function trim(op) { if (isRetain(op[op.length - 1])) op.pop(); return op; }

  function baseLen(op) { return op.reduce(function (a, c) { return a + (isInsert(c) ? 0 : Math.abs(c)); }, 0); }
  function targetLen(op) { return op.reduce(function (a, c) { return a + (isInsert(c) ? c.length : isRetain(c) ? c : 0); }, 0); }

  function apply(doc, op) {
    var out = '', i = 0;
    op.forEach(function (c) {
      if (isRetain(c)) { if (i + c > doc.length) throw new Error('retain fuera del documento'); out += doc.slice(i, i + c); i += c; }
      else if (isInsert(c)) out += c;
      else { if (i - c > doc.length) throw new Error('delete fuera del documento'); i -= c; }
    });
    return out + doc.slice(i);          /* lo que la op no recorre se conserva */
  }

  /* Corta componentes en trozos para recorrer dos ops a la vez. */
  function reader(op) {
    var i = 0, cur = op[0];
    return {
      peek: function () { return cur; },
      take: function (n, split) {          /* toma hasta n; un insert sale entero salvo que se pida cortarlo */
        var c = cur;
        if (c === undefined) return undefined;
        if (isInsert(c)) {
          if (split && n < c.length) { cur = c.slice(n); return c.slice(0, n); }
          cur = op[++i]; return c;
        }
        if (n === undefined || Math.abs(c) <= n) { cur = op[++i]; return c; }
        if (isRetain(c)) { cur = c - n; return n; }
        cur = c + n; return -n;
      }
    };
  }

  /* transform(a, b, aFirst) devuelve [a', b'] con apply(apply(d, a), b') === apply(apply(d, b), a').
     Si las dos insertan en el mismo lugar, aFirst decide cuál queda antes. */
  function transform(a, b, aFirst) {
    var len = Math.max(baseLen(a), baseLen(b));
    a = pad(a, len - baseLen(a)); b = pad(b, len - baseLen(b));   /* retain final implícito */
    var A = reader(a), B = reader(b), a2 = [], b2 = [];
    for (;;) {
      var x = A.peek(), y = B.peek();
      if (x === undefined && y === undefined) break;
      if (isInsert(x) && (aFirst || !isInsert(y))) { push(a2, A.take()); push(b2, x.length); continue; }
      if (isInsert(y)) { push(b2, B.take()); push(a2, y.length); continue; }
      if (x === undefined || y === undefined) throw new Error('las ops no tienen el mismo largo base');
      var n = Math.min(Math.abs(x), Math.abs(y));
      var xc = A.take(n), yc = B.take(n);
      if (isRetain(xc) && isRetain(yc)) { push(a2, n); push(b2, n); }
      else if (isDelete(xc) && isRetain(yc)) push(a2, -n);
      else if (isRetain(xc) && isDelete(yc)) push(b2, -n);
      /* las dos borran lo mismo: ninguna tiene que volver a borrarlo */
    }
    return [trim(a2), trim(b2)];
  }

  /* compose(a, b): una sola op que equivale a aplicar a y después b. Sirve para juntar lo pendiente. */
  function compose(a, b) {
    var lenA = targetLen(a), lenB = baseLen(b), len = Math.max(lenA, lenB);
    a = pad(a, len - lenA); b = pad(b, len - lenB);
    var A = reader(a), B = reader(b), out = [];
    for (;;) {
      var x = A.peek(), y = B.peek();
      if (x === undefined && y === undefined) break;
      if (isDelete(x)) { push(out, A.take()); continue; }
      if (isInsert(y)) { push(out, B.take()); continue; }
      if (x === undefined || y === undefined) throw new Error('las ops no encajan');
      var n = Math.min(isInsert(x) ? x.length : x, Math.abs(y));
      var xc = A.take(n, true), yc = B.take(n);
      if (isInsert(xc)) { if (isRetain(yc)) push(out, xc); }   /* insertar y después borrar se anulan */
      else push(out, isRetain(yc) ? n : -n);
    }
    return trim(out);
  }

  /* Op mínima que transforma oldS en newS: prefijo y sufijo comunes, y lo del medio se reemplaza. */
  function diff(oldS, newS) {
    var p = 0, max = Math.min(oldS.length, newS.length);
    while (p < max && oldS[p] === newS[p]) p++;
    var s = 0;
    while (s < max - p && oldS[oldS.length - 1 - s] === newS[newS.length - 1 - s]) s++;
    var op = [];
    push(op, p);
    push(op, newS.slice(p, newS.length - s));
    push(op, -(oldS.length - p - s));
    return trim(op);
  }

  /* Mueve una posición de cursor a través de una op. Un insert justo en el cursor lo empuja, salvo con stay (como en ot.js). */
  function cursor(pos, op, stay) {
    var i = 0, out = pos;
    for (var k = 0; k < op.length; k++) {
      var c = op[k];
      if (isRetain(c)) i += c;
      else if (isInsert(c)) { if (i < pos || (i === pos && !stay)) out += c.length; }
      else { var n = -c; out -= Math.max(0, Math.min(i + n, pos) - i); i += n; }
      if (i > pos) break;
    }
    return out;
  }

  /* Sin transformar: cada pedazo se aplica en su posición original, recortada al largo del documento. */
  function applyNaive(doc, op) {
    var pos = 0;
    op.forEach(function (c) {
      if (isRetain(c)) pos += c;
      else if (isInsert(c)) { var p = Math.min(pos, doc.length); doc = doc.slice(0, p) + c + doc.slice(p); pos = p + c.length; }
      else { var q = Math.min(pos, doc.length); doc = doc.slice(0, q) + doc.slice(Math.min(doc.length, q - c)); }
    });
    return doc;
  }

  /* La notación del blog de Google Drive de 2010: posiciones desde 1 y rangos cerrados. */
  function describe(op) {
    var parts = [], i = 0;
    op.forEach(function (c) {
      if (isRetain(c)) i += c;
      else if (isInsert(c)) { parts.push("InsertText '" + c + "' @" + (i + 1)); i += c.length; }
      else { var n = -c; parts.push('DeleteText @' + (i + 1) + (n > 1 ? '-' + (i + n) : '')); }
    });
    return parts.length ? parts.join(' + ') : 'sin cambios';
  }

  SD.otCore = { apply: apply, transform: transform, compose: compose, diff: diff, cursor: cursor,
    applyNaive: applyNaive, describe: describe, baseLen: baseLen, targetLen: targetLen };

  /* ======================= Protocolo cliente-servidor =======================
     Lo que describe el blog de 2010: cada cliente tiene una revisión, un cambio enviado sin ack
     y un buffer de pendientes; el servidor transforma lo que llega contra lo commiteado desde
     la base del cliente y lo guarda como la revisión siguiente. En un empate queda antes lo que
     ya estaba en el log (así sale "Hello world!" en el ejemplo del blog). */

  function Session(text, names, opts) {
    this.ot = opts && opts.ot !== undefined ? opts.ot : true;
    this.server = { doc: text, log: [] };
    this.clients = names.map(function (n, i) { return { id: i, name: n, doc: text, rev: 0, sent: null, pending: null }; });
    this.net = [];          /* {from, to, kind: 'op' | 'ack' | 'remote', op, base, rev, at} */
    this.now = 0;
    this.lat = names.map(function () { return 200; });
    this.events = [];
    this.lastAt = {};       /* orden FIFO por enlace */
  }
  Session.prototype.log = function (who, text) { this.events.unshift({ t: this.now, who: who, text: text }); };
  Session.prototype.send = function (msg) {
    var c = msg.from === 'server' ? msg.to : msg.from, key = msg.from + '>' + msg.to;
    msg.at = Math.max(this.now + this.lat[c], this.lastAt[key] || 0);
    this.lastAt[key] = msg.at;
    msg.sentAt = this.now;
    this.net.push(msg);
  };
  Session.prototype.edit = function (ci, op) {
    var c = this.clients[ci];
    if (!op.length) return;
    c.doc = apply(c.doc, op);
    if (!c.sent) {
      c.sent = op;
      this.send({ from: ci, to: 'server', kind: 'op', op: op, base: c.rev });
      this.log(c.name, 'escribe ' + describe(op) + ' y lo envía con base r' + c.rev + '.');
    } else {
      c.pending = c.pending ? compose(c.pending, op) : op;
      this.log(c.name, 'escribe ' + describe(op) + '. Ya tiene un cambio sin ack: queda en el buffer.');
    }
  };
  Session.prototype.next = function () {
    if (!this.net.length) return null;
    var k = 0;
    for (var i = 1; i < this.net.length; i++) if (this.net[i].at < this.net[k].at) k = i;
    return this.net[k];
  };
  Session.prototype.deliver = function (msg) {
    this.net.splice(this.net.indexOf(msg), 1);
    this.now = Math.max(this.now, msg.at);
    var S = this.server, self = this;
    if (msg.to === 'server') {
      var c = this.clients[msg.from], op = msg.op, rev = S.log.length;
      if (this.ot) {
        var steps = [];
        for (var r = msg.base; r < rev; r++) {
          var before = describe(op);
          op = transform(op, S.log[r].op, false)[0];
          steps.push('contra r' + (r + 1) + ' (' + S.log[r].by + ': ' + describe(S.log[r].op) + '): ' + before + ' queda ' + describe(op));
        }
        S.doc = apply(S.doc, op);
        this.log('Servidor', 'recibe de ' + c.name + ' ' + describe(msg.op) + ' con base r' + msg.base + '. ' +
          (steps.length ? 'Lo transforma ' + steps.join('; ') + '. ' : 'No hay nada nuevo desde su base: no se transforma. ') +
          'Lo guarda como r' + (rev + 1) + '.');
      } else {
        S.doc = applyNaive(S.doc, op);
        this.log('Servidor', 'recibe de ' + c.name + ' ' + describe(op) + ' y lo aplica tal cual, sin transformar. Lo guarda como r' + (rev + 1) + '.');
      }
      S.log.push({ op: op, by: c.name, orig: msg.op, base: msg.base });
      this.send({ from: 'server', to: msg.from, kind: 'ack', rev: rev + 1 });
      this.clients.forEach(function (o) { if (o.id !== msg.from) self.send({ from: 'server', to: o.id, kind: 'remote', op: op, rev: rev + 1, by: c.name }); });
      return;
    }
    var cl = this.clients[msg.to];
    if (msg.kind === 'ack') {
      cl.sent = null; cl.rev = msg.rev;
      if (cl.pending) {
        cl.sent = cl.pending; cl.pending = null;
        this.send({ from: cl.id, to: 'server', kind: 'op', op: cl.sent, base: cl.rev });
        this.log(cl.name, 'recibe el ack de r' + msg.rev + ' y envía su buffer: ' + describe(cl.sent) + ' con base r' + cl.rev + '.');
      } else this.log(cl.name, 'recibe el ack de r' + msg.rev + '. Queda sincronizado.');
      return;
    }
    var s = msg.op, orig = describe(s);
    if (this.ot) {
      if (cl.sent) { var t1 = transform(s, cl.sent, true); s = t1[0]; cl.sent = t1[1]; }
      if (cl.pending) { var t2 = transform(s, cl.pending, true); s = t2[0]; cl.pending = t2[1]; }
      cl.doc = apply(cl.doc, s);
    } else cl.doc = applyNaive(cl.doc, s);
    cl.rev = msg.rev;
    this.log(cl.name, 'recibe r' + msg.rev + ' de ' + msg.by + ': ' + orig +
      (orig !== describe(s) ? '. Lo transforma contra lo suyo sin ack y queda ' + describe(s) + '.' : (cl.sent && this.ot ? '. No choca con lo suyo: no cambia.' : '.')));
    msg.applied = s;
  };
  Session.prototype.idle = function () { return !this.net.length && this.clients.every(function (c) { return !c.sent && !c.pending; }); };
  Session.prototype.converged = function () {
    var d = this.server.doc;
    return this.clients.every(function (c) { return c.doc === d; });
  };
  SD.otCore.Session = Session;

  if (typeof document === 'undefined') return;     /* en Node solo se usa la lógica */

  /* ======================= data-sim="ot" ======================= */

  var h = SD.h, F = SD.fmt;
  var NAMES = ['Ana', 'Beto'];
  var PRESETS = {
    easy: {
      label: 'EASY AS 123', text: 'EASY AS 123', lat: [300, 900],
      note: 'El ejemplo del blog de 2010: Ana cambia 123 por ABC mientras Beto agrega IT\'S al principio. La red está en pausa; entrega los mensajes de a uno.',
      run: function (s) {
        s.edit(0, diff('EASY AS 123', 'EASY AS '));
        s.edit(0, diff('EASY AS ', 'EASY AS ABC'));
        s.edit(1, diff('EASY AS 123', "IT'S EASY AS 123"));
      }
    },
    hello: {
      label: 'Hello world!', text: '', lat: [100, 900],
      note: 'El segundo ejemplo del blog: Ana escribe Hello y después world; Beto escribe ! en su documento vacío. La red de Beto es lenta.',
      run: function (s) {
        s.edit(0, diff('', 'Hello'));
        s.edit(0, diff('Hello', 'Hello world'));
        s.edit(1, diff('', '!'));
      }
    },
    tie: {
      label: 'Mismo lugar', text: 'Hola', lat: [300, 300],
      note: 'Las dos personas escriben al final a la vez. Es un empate: el servidor pone primero lo que ya está en el log, o sea, lo que llegó antes.',
      run: function (s) {
        s.edit(0, diff('Hola', 'Hola, Beto'));
        s.edit(1, diff('Hola', 'Hola, Ana'));
      }
    },
    overlap: {
      label: 'Borrar lo que el otro cambia', text: 'Nos vemos el lunes', lat: [300, 600],
      note: 'Ana borra «el lunes» mientras Beto cambia lunes por martes; su editor lo registra como cambiar «lun» por «mart», porque «es» no cambia. OT conserva las dos intenciones letra por letra: converge en «Nos vemos mart», que no es lo que quería ninguno.',
      run: function (s) {
        s.edit(0, diff('Nos vemos el lunes', 'Nos vemos '));
        s.edit(1, diff('Nos vemos el lunes', 'Nos vemos el martes'));
      }
    }
  };
  var LATS = [50, 200, 600, 1500, 3000];

  function initOT(host) {
    var preset = 'easy', ot = true, paused = true, sess, timer = null, last = 0;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var presetBar = h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Ejemplo' });
    Object.keys(PRESETS).forEach(function (k) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': k === preset ? 'true' : 'false', text: PRESETS[k].label });
      b.addEventListener('click', function () { preset = k; presetBar.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); reset(true); });
      presetBar.appendChild(b);
    });
    var modeBar = h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Modo' });
    [['Con OT', true], ['Sin transformar', false]].forEach(function (m) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': m[1] === ot ? 'true' : 'false', text: m[0] });
      b.addEventListener('click', function () { ot = m[1]; modeBar.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); reset(true); });
      modeBar.appendChild(b);
    });
    var latSel = NAMES.map(function (n, i) {
      var sel = h('select', { id: 'otlat' + i + '-' + (++uid) }, LATS.map(function (v) { return h('option', { value: v, text: F.num(v, 0) + ' ms' }); }));
      sel.addEventListener('change', function () { sess.lat[i] = +sel.value; });
      return sel;
    });
    var pauseBtn = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'true', text: 'Red en pausa' });
    var stepBtn = h('button', { type: 'button', class: 'btn btn--primary', text: 'Entregar el siguiente' });
    var resetBtn = h('button', { type: 'button', class: 'btn', text: 'Reiniciar' });
    pauseBtn.addEventListener('click', function () { paused = !paused; pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false'); pauseBtn.textContent = paused ? 'Red en pausa' : 'Red corriendo'; last = performance.now(); tick(); render(); });
    stepBtn.addEventListener('click', function () { var m = sess.next(); if (m) { sess.deliver(m); render(); } });
    resetBtn.addEventListener('click', function () { reset(true); });

    /* columnas: Ana, servidor, Beto */
    var cols = {}, grid = h('div', { class: 'ot-grid' });
    function clientCol(i) {
      var ta = h('textarea', { class: 'ot-doc', rows: 3, spellcheck: 'false', 'aria-label': 'Documento de ' + NAMES[i] });
      var col = { ta: ta, state: h('span', { class: 'ot-chip' }), meta: h('dl', { class: 'ot-meta' }) };
      ta.addEventListener('input', function () {
        var op = diff(sess.clients[i].doc, ta.value);
        sess.edit(i, op);
        if (!paused) ensureTimer();
        render(i);
      });
      col.el = h('div', { class: 'ot-col' }, [h('div', { class: 'ot-col-head' }, [h('p', { class: 'ot-name', text: NAMES[i] }), col.state]), ta, col.meta]);
      return col;
    }
    cols[0] = clientCol(0); cols[1] = clientCol(1);
    cols.s = { doc: h('p', { class: 'ot-doc ot-doc--ro' }), state: h('span', { class: 'ot-chip' }), list: h('ol', { class: 'ot-revs', 'aria-label': 'Revision log del servidor' }) };
    cols.s.el = h('div', { class: 'ot-col ot-col--server' }, [h('div', { class: 'ot-col-head' }, [h('p', { class: 'ot-name', text: 'Servidor' }), cols.s.state]), cols.s.doc, h('p', { class: 'ot-sub', text: 'Revision log' }), cols.s.list]);
    grid.appendChild(cols[0].el); grid.appendChild(cols.s.el); grid.appendChild(cols[1].el);

    var wire = h('ul', { class: 'ot-wire', 'aria-label': 'Mensajes en la red' });
    var verdict = h('p', { class: 'ot-verdict', 'aria-live': 'polite' });
    var note = h('p', { class: 'sim-note' });
    var events = h('ol', { class: 'raft-log', 'aria-label': 'Registro de eventos' });

    function reset(runPreset) {
      var P = PRESETS[preset];
      sess = new Session(P.text, NAMES, { ot: ot });
      sess.lat = P.lat.slice();
      latSel.forEach(function (s, i) { s.value = String(sess.lat[i]); });
      paused = true; pauseBtn.setAttribute('aria-pressed', 'true'); pauseBtn.textContent = 'Red en pausa';
      if (runPreset) P.run(sess);
      note.textContent = P.note + (ot ? '' : ' Modo sin transformar: cada cambio se aplica en la posición con que se escribió.');
      render();
    }

    function ensureTimer() {
      if (timer || paused) return;
      last = performance.now();
      timer = setInterval(tick, 60);
    }
    function tick() {
      if (paused || !sess.net.length) { clearInterval(timer); timer = null; return; }
      var t = performance.now(); sess.now += t - last; last = t;
      var m, moved = false;
      while ((m = sess.next()) && m.at <= sess.now) { sess.deliver(m); moved = true; }
      if (moved) render(); else renderWire();
      if (!sess.net.length) { clearInterval(timer); timer = null; }
      else ensureTimer();
    }

    function stateOf(c) {
      if (c.sent && c.pending) return ['Esperando ack, con buffer', 'is-warn'];
      if (c.sent) return ['Esperando ack', 'is-warn'];
      return ['Sincronizado en r' + c.rev, 'is-ok'];
    }
    function row(dt, dd) { return [h('dt', { text: dt }), h('dd', { text: dd })]; }

    function renderWire() {
      wire.innerHTML = '';
      var list = sess.net.slice().sort(function (a, b) { return a.at - b.at; });
      if (!list.length) wire.appendChild(h('li', { class: 'ot-msg is-empty', text: 'No hay mensajes en la red.' }));
      list.forEach(function (m, k) {
        var from = m.from === 'server' ? 'Servidor' : NAMES[m.from], to = m.to === 'server' ? 'servidor' : NAMES[m.to];
        var what = m.kind === 'ack' ? 'ack de r' + m.rev : m.kind === 'op' ? describe(m.op) + ' (base r' + m.base + ')' : describe(m.op) + ' (r' + m.rev + ')';
        var total = Math.max(1, m.at - m.sentAt), left = Math.max(0, m.at - sess.now);
        var bar = h('span', { class: 'ot-bar' }, [h('span', { style: 'width:' + (reduce ? 0 : (100 * (1 - left / total)).toFixed(0)) + '%' })]);
        wire.appendChild(h('li', { class: 'ot-msg' + (k === 0 ? ' is-next' : '') }, [
          h('span', { class: 'ot-route', text: from + ' → ' + to }),
          h('span', { class: 'ot-what', text: what }),
          paused ? h('span', { class: 'ot-eta', text: k === 0 ? 'el siguiente' : '' }) : h('span', { class: 'ot-eta', text: 'llega en ' + F.num(left / 1000, 1) + ' s' }),
          bar
        ]));
      });
      stepBtn.disabled = !list.length;
    }

    function render(skip) {
      [0, 1].forEach(function (i) {
        var c = sess.clients[i], col = cols[i], st = stateOf(c);
        if (i !== skip && col.ta.value !== c.doc) {
          var focused = document.activeElement === col.ta, a = col.ta.selectionStart, b = col.ta.selectionEnd, old = col.ta.value;
          col.ta.value = c.doc;
          if (focused) { var op = diff(old, c.doc); col.ta.setSelectionRange(cursor(a, op), cursor(b, op)); }
        }
        col.state.textContent = st[0]; col.state.className = 'ot-chip ' + st[1];
        col.meta.innerHTML = '';
        row('Última revisión', 'r' + c.rev).concat(
          row('Enviado, sin ack', c.sent ? describe(c.sent) : 'nada'),
          row('Buffer', c.pending ? describe(c.pending) : 'vacío')).forEach(function (x) { col.meta.appendChild(x); });
      });
      cols.s.doc.textContent = sess.server.doc || ' ';
      cols.s.state.textContent = 'r' + sess.server.log.length; cols.s.state.className = 'ot-chip';
      cols.s.list.innerHTML = '';
      if (!sess.server.log.length) cols.s.list.appendChild(h('li', { class: 'is-empty', text: 'Vacío' }));
      sess.server.log.slice().reverse().forEach(function (e, k) {
        var r = sess.server.log.length - k, changed = describe(e.orig) !== describe(e.op);
        cols.s.list.appendChild(h('li', {}, [h('b', { text: 'r' + r + ' ' }), e.by + ': ' + describe(e.op) + (changed ? ' (llegó como ' + describe(e.orig) + ')' : '')]));
      });
      renderWire();
      if (!sess.idle()) {
        verdict.className = 'ot-verdict';
        verdict.textContent = 'Hay cambios en camino: todavía no se puede comparar.';
      } else if (sess.converged()) {
        verdict.className = 'ot-verdict is-ok';
        verdict.textContent = 'Convergen: los tres tienen «' + sess.server.doc + '».';
      } else {
        verdict.className = 'ot-verdict is-fail';
        verdict.textContent = 'Divergen: Ana tiene «' + sess.clients[0].doc + '», el servidor «' + sess.server.doc + '» y Beto «' + sess.clients[1].doc + '».';
      }
      events.innerHTML = '';
      sess.events.slice(0, 40).forEach(function (e) {
        events.appendChild(h('li', {}, [h('span', { class: 'raft-t', text: F.num(e.t / 1000, 2) + ' s' }), h('span', {}, [h('b', { text: e.who + ' ' }), e.text])]));
      });
      ensureTimer();
    }

    host.classList.add('sim', 'ot-sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Dos personas, un servidor y OT' }), presetBar]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [
        modeBar,
        h('div', { class: 'field' }, [h('label', { for: latSel[0].id, text: 'Latencia de Ana' }), latSel[0]]),
        h('div', { class: 'field' }, [h('label', { for: latSel[1].id, text: 'Latencia de Beto' }), latSel[1]]),
        h('div', { class: 'btn-row' }, [pauseBtn, stepBtn, resetBtn])
      ]),
      note, grid,
      h('p', { class: 'ot-sub', text: 'En la red, en el orden en que llegan' }), wire,
      verdict,
      h('p', { class: 'raft-log-title', text: 'Qué pasó' }), events
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Escribe en cualquiera de los dos documentos. Las posiciones se cuentan desde 1, como en el blog de Google Drive de 2010. Cada cliente tiene a lo sumo un cambio sin ack; lo que escribe mientras tanto se junta en el buffer.' }));
    reset(true);
  }
  var uid = 0;

  /* ======================= data-calc="collab" ======================= */

  function field(label, value, step, hint) {
    var id = 'co' + (++uid);
    var i = h('input', { id: id, type: 'number', min: 0, step: step, value: value, inputmode: 'decimal' });
    var kids = [h('label', { for: id, text: label }), i];
    if (hint) kids.push(h('p', { class: 'field-hint', text: hint }));
    return { el: h('div', { class: 'field' }, kids), input: i };
  }
  function out(label, formula) {
    var v = h('output', { class: 'out-value' });
    return { el: h('div', { class: 'out-row' }, [h('span', { class: 'out-label', text: label }), v, h('span', { class: 'out-formula', text: formula })]), v: v };
  }
  function words(n) { var t = F.words(n); return /^1 millón/.test(t) ? t : t.replace(' millón', ' millones'); }

  function initCollab(host) {
    var f = {
      docs: field('Documentos abiertos a la vez', 2000000, 100000, 'En el pico, con al menos una persona conectada.'),
      people: field('Personas conectadas por documento', 1.5, 0.1, 'Promedio. Docs admite hasta 100 a la vez.'),
      editors: field('Personas escribiendo por documento', 1.2, 0.1),
      ops: field('Cambios por segundo de cada persona que escribe', 0.5, 0.1, 'Ya agrupados: un cambio sin ack a la vez.'),
      presence: field('Actualizaciones de cursor por segundo por persona', 1, 0.5),
      opBytes: field('Bytes por cambio guardado en el log', 300, 50, 'La op, el autor, la revisión y el timestamp.'),
      snapEvery: field('Revisiones entre snapshots', 500, 50),
      snapKB: field('Tamaño de un snapshot (KB)', 40, 5),
      perDocs: field('Documentos que atiende un servidor de sesión', 20000, 1000, 'Lo limita la memoria: el estado y el final del log de cada uno.'),
      perOps: field('Cambios por segundo que procesa un servidor', 20000, 1000)
    };
    var o = {
      opsS: out('Cambios por segundo en la flota', 'documentos × personas escribiendo × cambios por persona'),
      fanS: out('Mensajes de cambios por segundo', 'cambios × personas conectadas (un ack y las copias para los demás)'),
      presS: out('Mensajes de presencia por segundo', 'documentos × personas × cursores × (personas − 1)'),
      conns: out('Conexiones abiertas', 'documentos × personas conectadas'),
      servers: out('Servidores de sesión', 'máx(documentos ÷ por servidor, cambios ÷ por servidor) × 1.3 de margen'),
      logDay: out('Log de operaciones por día', 'cambios × bytes × 86 400'),
      snapDay: out('Snapshots por día', 'cambios ÷ revisiones por snapshot × tamaño × 86 400')
    };
    function v(k) { var x = parseFloat(f[k].input.value); return isFinite(x) && x >= 0 ? x : 0; }
    function run() {
      var people = Math.max(v('people'), v('editors'));
      var ops = v('docs') * v('editors') * v('ops');
      o.opsS.v.textContent = words(ops);
      o.fanS.v.textContent = words(ops * people);
      o.presS.v.textContent = words(v('docs') * people * v('presence') * Math.max(0, people - 1));
      o.conns.v.textContent = words(v('docs') * people);
      var srv = Math.max(v('perDocs') > 0 ? v('docs') / v('perDocs') : 0, v('perOps') > 0 ? ops / v('perOps') : 0);
      o.servers.v.textContent = F.num(Math.ceil(srv * 1.3), 0);
      o.logDay.v.textContent = F.bytes(ops * v('opBytes') * 86400);
      o.snapDay.v.textContent = v('snapEvery') > 0 ? F.bytes(ops / v('snapEvery') * v('snapKB') * 1024 * 86400) : '—';
    }
    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    Object.keys(f).forEach(function (k) { inCol.appendChild(f[k].el); f[k].input.addEventListener('input', run); });
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'La flota de un editor colaborativo' })]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Diseño de referencia: Google no publica estas cifras. Los valores iniciales son ilustrativos; cambia uno por vez y mira qué recurso se agota primero.' }));
    run();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="ot"]').forEach(initOT);
    document.querySelectorAll('[data-calc="collab"]').forEach(initCollab);
  });
})();
