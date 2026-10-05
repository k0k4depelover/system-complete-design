/* Widgets del M02 (protocolos y APIs):
   <div data-sim="paginate">  offset contra cursor mientras la tabla cambia: inserts, borrados y commits tardíos
   <div data-sim="protobuf">  un mensaje de Protocol Buffers byte por byte, comparado con el mismo JSON */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  /* ======================= Paginación con la tabla en movimiento ======================= */

  var LIMIT = 4, START = 36000;          /* 10:00:00 en segundos */

  function clock(t) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(Math.floor(t / 3600)) + ':' + p(Math.floor(t / 60) % 60) + ':' + p(t % 60);
  }
  /* Orden del feed: created_at DESC, id DESC. La clave compara primero el tiempo y después el id. */
  function cmp(a, b) { return a.t !== b.t ? a.t - b.t : a.seq - b.seq; }

  function initPaginate(host) {
    var rows, seq, readers, overlap = false, lastNote;

    function reset() {
      rows = []; seq = 0;
      for (var i = 0; i < 16; i++) add(START + i * 7, 'post');
      readers = { off: mkReader(), cur: mkReader() };
      lastNote = 'Dos lectores recorren el mismo feed de a ' + LIMIT + ' posts: uno con OFFSET y otro con cursor. Pide páginas y cambia la tabla entre una y otra.';
    }
    function add(t, kind) {
      seq++;
      var r = { id: (kind === 'late' ? 'tarde_' : 'post_') + (seq < 10 ? '0' : '') + seq, t: t, seq: seq, kind: kind };
      rows.push(r);
      return r;
    }
    function mkReader() { return { offset: 0, cursor: null, top: null, frontier: null, pages: 0, read: 0, seen: {}, dedup: 0 }; }
    function sorted() { return rows.slice().sort(function (a, b) { return cmp(b, a); }); }

    function deliver(rd, page) {
      rd.pages++;
      page.forEach(function (r) { (rd.seen[r.id] = rd.seen[r.id] || []).push(rd.pages); });
      if (page.length) {
        if (!rd.top) rd.top = page[0];
        rd.frontier = page[page.length - 1];
      }
    }
    function nextPage() {
      var s = sorted(), o = readers.off, c = readers.cur;
      var pOff = s.slice(o.offset, o.offset + LIMIT);
      o.read += Math.min(s.length, o.offset + LIMIT);
      o.offset += LIMIT;
      deliver(o, pOff);
      var pCur = c.cursor ? s.filter(function (r) { return cmp(r, c.cursor) < 0; }).slice(0, LIMIT) : s.slice(0, LIMIT);
      c.read += pCur.length;
      if (pCur.length) c.cursor = pCur[pCur.length - 1];
      deliver(c, pCur);
      lastNote = 'OFFSET ' + (o.offset - LIMIT) + ' LIMIT ' + LIMIT + ' leyó ' + Math.min(s.length, o.offset) + ' filas para devolver ' + pOff.length +
        '. El cursor pidió WHERE (created_at, id) < (' + (pCur.length ? clock(c.cursor.t) + ', ' + c.cursor.id : '…') + ') y leyó solo las ' + pCur.length + ' que devuelve, más bajar el índice.';
    }
    function insertNew() {
      var max = rows.reduce(function (m, r) { return Math.max(m, r.t); }, START);
      for (var i = 1; i <= 3; i++) add(max + i * 5, 'new');
      lastNote = 'Llegaron 3 posts más nuevos que todo lo leído. Quedan arriba: el OFFSET de la próxima página cae 3 lugares antes y repite posts; el cursor no se entera, porque los nuevos están del otro lado de su marca.';
    }
    function deleteSeen() {
      var s = sorted(), victim = null;
      for (var i = 0; i < s.length && !victim; i++) if (readers.off.seen[s[i].id]) victim = s[i];
      if (!victim) { lastNote = 'Primero pide una página: el borrado afecta a un post que ya se leyó.'; return; }
      rows = rows.filter(function (r) { return r !== victim; });
      lastNote = 'Se borró ' + victim.id + ', que ya estaba leído. Todo lo de abajo sube un lugar: el OFFSET siguiente se saltea un post. Al cursor no le importa: compara valores, no necesita que la fila de la marca exista.';
    }
    function lateCommit() {
      if (!readers.cur.top) { lastNote = 'Primero pide una página: el commit tardío cae dentro de lo que el lector ya pasó.'; return; }
      /* Una transacción tomó su created_at con now() al empezar y confirmó segundos después:
         su fila aparece con una hora anterior a la marca de arriba del lector con cursor. */
      var t = readers.cur.top.t - 3;
      var r = add(t, 'late');
      lastNote = 'Confirmó una transacción que empezó a las ' + clock(t) + ' y tardó en hacer commit. Su fila aparece "en el pasado", entre posts que los dos lectores ya pasaron: ninguno la va a ver bajando, y "traer lo nuevo" con created_at > la marca de arriba tampoco. ' + r.id + ' se pierde.';
    }
    function since() {
      var c = readers.cur;
      if (!c.top) { lastNote = 'Primero pide una página.'; return; }
      var from = overlap ? { t: c.top.t - 10, seq: -1 } : c.top;
      var fresh = rows.filter(function (r) { return cmp(r, from) > 0; }).sort(cmp);
      var got = 0, dup = 0;
      c.pages++;
      fresh.forEach(function (r) {
        if (c.seen[r.id]) { dup++; c.dedup++; return; }
        c.seen[r.id] = [c.pages]; got++;
      });
      c.read += fresh.length;
      var newest = fresh[fresh.length - 1];
      if (newest && cmp(newest, c.top) > 0) c.top = newest;
      lastNote = (overlap
        ? 'Pidió WHERE created_at > ' + clock(from.t) + ' (la marca menos 10 s de solape), ORDER BY created_at ASC. Trajo ' + fresh.length + ' filas, ' + dup + ' ya vistas que se descartan por id.'
        : 'Pidió WHERE (created_at, id) > (' + clock(from.t) + ', ' + from.id + '), ORDER BY created_at ASC. Trajo ' + got + ' posts nuevos.') +
        (rows.some(function (r) { return r.kind === 'late' && !c.seen[r.id]; }) ? ' Sigue habiendo un commit tardío sin ver.' : '');
    }

    function state(rd, r) {
      var pages = rd.seen[r.id];
      if (pages && pages.length > 1) return ['is-dup', 'repetido: pág. ' + pages.join(' y ')];
      if (pages) return ['is-seen', 'pág. ' + pages[0]];
      if (!rd.top) return ['is-wait', '—'];
      if (cmp(r, rd.top) > 0) return ['is-new', 'nuevo arriba'];
      if (rd.frontier && cmp(r, rd.frontier) > 0) return ['is-lost', 'saltado'];
      return ['is-wait', 'pendiente'];
    }
    function count(rd, cls) { return rows.filter(function (r) { return state(rd, r)[0] === cls; }).length; }

    var tbody = h('tbody');
    var statsOff = h('div', { class: 'sim-stats' }), statsCur = h('div', { class: 'sim-stats' });
    var note = h('p', { class: 'sim-note', 'aria-live': 'polite' });
    var ovBtn = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'false', text: 'Solape de 10 s al traer lo nuevo' });

    function stat(host, rd, extra) {
      host.innerHTML = '';
      [['Páginas', F.num(rd.pages, 0)], ['Filas leídas por la base', F.num(rd.read, 0)],
       ['Repetidos', F.num(count(rd, 'is-dup'), 0)], ['Saltados', F.num(count(rd, 'is-lost'), 0)]].concat(extra || []).forEach(function (x) {
        host.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
    }
    function render() {
      tbody.innerHTML = '';
      sorted().forEach(function (r) {
        var a = state(readers.off, r), b = state(readers.cur, r);
        tbody.appendChild(h('tr', { class: r.kind === 'late' ? 'pg-late' : r.kind === 'new' ? 'pg-fresh' : '' }, [
          h('td', {}, [h('code', { text: r.id }), h('span', { class: 'pg-time', text: clock(r.t) })]),
          h('td', {}, [h('span', { class: 'pg-pill ' + a[0], text: a[1] })]),
          h('td', {}, [h('span', { class: 'pg-pill ' + b[0], text: b[1] })])
        ]));
      });
      stat(statsOff, readers.off);
      stat(statsCur, readers.cur, [['Descartados por solape', F.num(readers.cur.dedup, 0)]]);
      note.textContent = lastNote;
    }

    function btn(label, fn, primary) {
      var b = h('button', { type: 'button', class: 'btn' + (primary ? ' btn--primary' : ''), text: label });
      b.addEventListener('click', function () { fn(); render(); });
      return b;
    }
    ovBtn.addEventListener('click', function () {
      overlap = !overlap; ovBtn.setAttribute('aria-pressed', overlap ? 'true' : 'false');
      lastNote = overlap ? 'Ahora "traer lo nuevo" vuelve a pedir los últimos 10 s y descarta por id lo que ya tenía. Así atrapa los commits tardíos de hasta 10 s.' : 'Sin solape: "traer lo nuevo" pide estrictamente lo posterior a la marca.';
      render();
    });

    reset();
    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Paginar mientras la tabla cambia' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'btn-row' }, [
        btn('Página siguiente', nextPage, true),
        btn('Llegan 3 posts nuevos', insertNew),
        btn('Se borra un post leído', deleteSeen),
        btn('Commit tardío', lateCommit)
      ]),
      h('div', { class: 'btn-row pg-row2' }, [btn('Cursor: traer lo nuevo', since), ovBtn, btn('Reiniciar', reset)]),
      note,
      h('div', { class: 'pg-wrap' }, [h('table', { class: 't pg-table' }, [
        h('thead', {}, [h('tr', {}, [h('th', { text: 'Post en la base (más nuevo arriba)' }), h('th', { text: 'Lector con OFFSET' }), h('th', { text: 'Lector con cursor' })])]),
        tbody
      ])]),
      h('p', { class: 'sim-sub', text: 'Lector con OFFSET' }), statsOff,
      h('p', { class: 'sim-sub', text: 'Lector con cursor' }), statsCur
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Feed ordenado por created_at DESC, id DESC, de a ' + LIMIT + ' posts. "Saltado" es un post que quedó entre lo más nuevo y lo más viejo que el lector ya recibió, sin que lo haya visto. "Filas leídas" cuenta las filas que la base recorre: OFFSET lee y descarta las anteriores; el cursor baja por el índice y lee solo las que devuelve.' }));
    render();
  }

  /* ======================= Protobuf byte por byte ======================= */

  var enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  function utf8(s) {
    if (enc) return Array.prototype.slice.call(enc.encode(s));
    return unescape(encodeURIComponent(s)).split('').map(function (c) { return c.charCodeAt(0); });
  }
  function varint(big) {           /* big: BigInt sin signo */
    var out = [];
    do {
      var b = Number(big & BigInt(127));
      big = big >> BigInt(7);
      out.push(big > BigInt(0) ? b | 128 : b);
    } while (big > BigInt(0));
    return out;
  }
  function hex(b) { return (b < 16 ? '0' : '') + b.toString(16).toUpperCase(); }
  function bin7(b) { var s = (b & 127).toString(2); while (s.length < 7) s = '0' + s; return s; }

  var WIRE = { 0: 'VARINT', 2: 'LEN' };

  function initProtobuf(host) {
    var uid = 0;
    function field(label, input, hint) {
      var id = 'pb' + (++uid); input.id = id;
      var kids = [h('label', { for: id, text: label }), input];
      if (hint) kids.push(h('p', { class: 'field-hint', text: hint }));
      return h('div', { class: 'field' }, kids);
    }
    var fConv = h('input', { type: 'text', value: 'conv_42', spellcheck: 'false' });
    var fText = h('input', { type: 'text', value: 'Hola', spellcheck: 'false' });
    var fMax = h('input', { type: 'number', value: 150, step: 1, inputmode: 'numeric' });
    var fType = h('select', {}, [h('option', { value: 'int32', text: 'int32' }), h('option', { value: 'sint32', text: 'sint32 (ZigZag)' })]);
    var fStream = h('input', { type: 'checkbox', checked: 'checked' });

    var proto = h('pre', { class: 'pb-proto' });
    var bytesHost = h('div', { class: 'pb-bytes', 'aria-label': 'Bytes del mensaje' });
    var rowsHost = h('ol', { class: 'pb-rows' });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });

    function run() {
      var max = parseInt(fMax.value, 10); if (!isFinite(max)) max = 0;
      max = Math.max(-2147483648, Math.min(2147483647, max));
      var sint = fType.value === 'sint32';
      proto.textContent = 'message SendMessageRequest {\n  string conversation_id = 1;\n  string content = 2;\n  ' + fType.value + ' max_tokens = 3;\n  bool stream = 4;\n}';
      var parts = [], rows = [];
      function tag(n, w) { return (n << 3) | w; }

      [[1, 'conversation_id', fConv.value], [2, 'content', fText.value]].forEach(function (f) {
        if (!f[2]) { rows.push({ f: f[0], omit: f[1] + ' vacío: no se escribe (es el valor por defecto en proto3)' }); return; }
        var data = utf8(f[2]), len = varint(BigInt(data.length));
        parts.push({ f: f[0], kind: 'tag', b: [tag(f[0], 2)] }, { f: f[0], kind: 'len', b: len }, { f: f[0], kind: 'val', b: data });
        rows.push({ f: f[0], text: hex(tag(f[0], 2)) + ' = (' + f[0] + ' << 3) | 2: campo ' + f[0] + ', tipo LEN. Después, ' + len.map(hex).join(' ') + ' = largo ' + data.length + ' y los ' + data.length + ' bytes de "' + f[2] + '" en UTF-8.' });
      });

      if (max === 0) rows.push({ f: 3, omit: 'max_tokens = 0: no se escribe' });
      else {
        var big = sint ? BigInt(((max << 1) ^ (max >> 31)) >>> 0) : BigInt.asUintN(64, BigInt(max));
        var v = varint(big);
        parts.push({ f: 3, kind: 'tag', b: [tag(3, 0)] }, { f: 3, kind: 'val', b: v });
        var how = sint ? 'ZigZag convierte ' + max + ' en ' + big.toString() + '. ' : (max < 0 ? 'Un int32 negativo se extiende a 64 bits en complemento a dos: ocupa 10 bytes. ' : '');
        rows.push({ f: 3, text: hex(tag(3, 0)) + ' = (3 << 3) | 0: campo 3, tipo VARINT. ' + how + 'Grupos de 7 bits, del menos significativo al más: ' +
          v.map(function (b) { return bin7(b); }).join(' · ') + '. Cada byte lleva un 1 adelante si sigue otro: ' + v.map(hex).join(' ') + '.' });
      }
      if (!fStream.checked) rows.push({ f: 4, omit: 'stream = false: no se escribe' });
      else {
        parts.push({ f: 4, kind: 'tag', b: [tag(4, 0)] }, { f: 4, kind: 'val', b: [1] });
        rows.push({ f: 4, text: '20 = (4 << 3) | 0: campo 4, tipo VARINT, y 01 = true.' });
      }

      var total = parts.reduce(function (a, p) { return a + p.b.length; }, 0);
      bytesHost.innerHTML = '';
      var prefix = [0, (total >>> 24) & 255, (total >>> 16) & 255, (total >>> 8) & 255, total & 255];
      var grpc = h('span', { class: 'pb-group pb-grpc', title: 'Prefijo de gRPC: 1 byte de compresión y 4 bytes de largo' });
      prefix.forEach(function (b) { grpc.appendChild(h('span', { class: 'pb-b', text: hex(b) })); });
      bytesHost.appendChild(grpc);
      parts.forEach(function (p) {
        var g = h('span', { class: 'pb-group pb-f' + p.f + ' pb-' + p.kind });
        p.b.forEach(function (b) { g.appendChild(h('span', { class: 'pb-b', text: hex(b) })); });
        bytesHost.appendChild(g);
      });

      rowsHost.innerHTML = '';
      rowsHost.appendChild(h('li', { class: 'pb-row' }, [h('span', { class: 'pb-sw pb-grpc' }), h('span', { text: 'Prefijo de gRPC: 00 = sin comprimir, y ' + prefix.slice(1).map(hex).join(' ') + ' = el mensaje mide ' + total + ' bytes (4 bytes, big endian). No es Protobuf: es el sobre de cada mensaje en el stream HTTP/2.' })]));
      rows.forEach(function (r) {
        rowsHost.appendChild(h('li', { class: 'pb-row' + (r.omit ? ' is-omit' : '') }, [h('span', { class: 'pb-sw pb-f' + r.f }), h('span', { text: r.omit || r.text })]));
      });

      var json = JSON.stringify({ conversation_id: fConv.value, content: fText.value, max_tokens: max, stream: fStream.checked });
      var jl = utf8(json).length;
      stats.innerHTML = '';
      [['Protobuf', F.num(total, 0) + ' bytes'], ['El mismo JSON', F.num(jl, 0) + ' bytes'], ['Protobuf ÷ JSON', jl ? F.pct(total / jl, 0) : '—']].forEach(function (x) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
    }
    [fConv, fText, fMax].forEach(function (i) { i.addEventListener('input', run); });
    [fType, fStream].forEach(function (i) { i.addEventListener('change', run); });

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Un mensaje de Protobuf, byte por byte' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'pb-grid' }, [
        h('div', {}, [proto]),
        h('div', { class: 'pb-inputs' }, [
          field('conversation_id (campo 1)', fConv), field('content (campo 2)', fText),
          field('max_tokens (campo 3)', fMax, 'Prueba 1, 127, 128, 300 y −1.'), field('Tipo de max_tokens', fType),
          h('label', { class: 'check' }, [fStream, h('span', { text: 'stream (campo 4)' })])
        ])
      ]),
      stats,
      bytesHost,
      rowsHost
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Codificación real de proto3: tag = (número de campo << 3) | tipo, varints de 7 bits y largos por delante. Los valores por defecto (texto vacío, 0, false) no se escriben. El JSON es el mismo mensaje sin espacios.' }));
    run();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="paginate"]').forEach(initPaginate);
    document.querySelectorAll('[data-sim="protobuf"]').forEach(initProtobuf);
  });
})();
