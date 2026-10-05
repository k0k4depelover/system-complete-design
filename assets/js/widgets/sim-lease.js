/* Leases de caché animados: <div data-sim="lease"></div>
   Un diagrama de secuencia que se dibuja mensaje por mensaje, con cuatro casos: la carrera sin lease,
   el SET viejo rechazado, la estampida contenida y el dueño del lease que se cuelga.
   Un único botón alterna velocidad lenta, rápida y pausa; los botones de abajo cambian de caso. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;

  var TRAVEL = 1100, DWELL = 2800, LOOP = 4000, ROW = 30, TOP = 70;

  var LANES = {
    A: { x: 70, name: 'Lector A' },
    B: { x: 215, name: 'Lector B' },
    K: { x: 385, name: 'Caché' },
    D: { x: 555, name: 'Base de datos' },
    W: { x: 700, name: 'Escritor' }
  };
  var KIND = {
    req: 'var(--link)', res: 'var(--label-2)', hit: 'var(--ok)', miss: 'var(--warn)',
    write: 'var(--l-queue)', del: 'var(--l-cache)', fail: 'var(--fail)', ok: 'var(--ok)'
  };

  function M(f, t, k, l, say, set) { return { f: f, t: t, k: k, l: l, say: say, set: set || null }; }
  function N(a, b, l, say, set) { return { note: true, a: a, b: b, l: l, say: say, set: set || null }; }

  var CASES = [
    {
      id: 'race', name: 'Sin lease: la carrera',
      init: { cache: 'vacía', lease: '—', db: '100' },
      end: { ok: false, text: 'Resultado: la caché dice 100 y la base dice 120. El error dura hasta que venza el TTL, y nadie hizo nada mal.' },
      steps: [
        M('A', 'K', 'req', 'GET prod:1', 'El lector A busca el producto en la caché.'),
        M('K', 'A', 'miss', 'nil · miss', 'No está: un miss común.'),
        M('A', 'D', 'req', 'SELECT precio', 'A va a la base.'),
        M('D', 'A', 'res', 'precio = 100', 'La base todavía dice 100.'),
        N('A', 'B', 'A se demora: GC, red lenta', 'Antes de que A guarde el valor pasa algo de tiempo: un milisegundo o un segundo, según la suerte.'),
        M('W', 'D', 'write', 'UPDATE precio = 120', 'Mientras tanto, el escritor cambia el precio.', { db: '120' }),
        M('W', 'K', 'del', 'DEL prod:1', 'Y hace lo correcto: borra la clave. Pero la clave ya estaba vacía, así que el DEL no cambia nada.'),
        M('A', 'K', 'fail', 'SET prod:1 100', 'A escribe el 100 que leyó antes del UPDATE. La caché no tiene cómo saber que ese valor es viejo y lo acepta.', { cache: '100 (viejo)' })
      ]
    },
    {
      id: 'lease', name: 'Con lease: el SET viejo se rechaza',
      init: { cache: 'vacía', lease: '—', db: '100' },
      end: { ok: true, text: 'Resultado: el valor viejo nunca entró. La caché dice 120, igual que la base, sin esperar a ningún TTL.' },
      steps: [
        M('A', 'K', 'req', 'GET prod:1', 'El lector A busca el producto en la caché.'),
        M('K', 'A', 'miss', 'miss + lease, token 7', 'Con leases, el miss trae un token: el permiso de A, y solo de A, para llenar esta clave.', { lease: 'token 7, de A' }),
        M('A', 'D', 'req', 'SELECT precio', 'A va a la base.'),
        M('D', 'A', 'res', 'precio = 100', 'La base todavía dice 100.'),
        N('A', 'B', 'A se demora', 'A se demora igual que en la carrera.'),
        M('W', 'D', 'write', 'UPDATE precio = 120', 'El escritor cambia el precio…', { db: '120' }),
        M('W', 'K', 'del', 'DEL prod:1', '…y borra la clave. Este DEL ahora hace algo más: anula cualquier lease sobre la clave. El token 7 deja de valer.', { lease: 'ninguno (el 7 se anuló)' }),
        M('A', 'K', 'req', 'SET prod:1 100 · token 7', 'A intenta guardar el 100, mostrando su token.'),
        M('K', 'A', 'fail', 'rechazado: token inválido', 'La caché compara el token con el vigente y rechaza el SET. El valor viejo no entra.'),
        M('B', 'K', 'req', 'GET prod:1', 'Llega el lector B.'),
        M('K', 'B', 'miss', 'miss + lease, token 8', 'Miss, y un token nuevo para B.', { lease: 'token 8, de B' }),
        M('B', 'D', 'req', 'SELECT precio', 'B lee la base…'),
        M('D', 'B', 'res', 'precio = 120', '…que ya tiene el valor nuevo.'),
        M('B', 'K', 'req', 'SET prod:1 120 · token 8', 'B guarda el 120 con un token vigente.'),
        M('K', 'B', 'ok', 'OK', 'Aceptado: el token 8 sigue valiendo. El lease se consume.', { cache: '120', lease: '—' })
      ]
    },
    {
      id: 'herd', name: 'Con lease: la estampida',
      init: { cache: 'vacía', lease: '—', db: '100' },
      end: { ok: true, text: 'Resultado: una sola consulta a la base. Con mil lectores en lugar de dos, la base habría recibido una, no mil.' },
      steps: [
        M('A', 'K', 'req', 'GET prod:1', 'La clave venció y llegan dos lectores casi a la vez. Primero A.'),
        M('K', 'A', 'miss', 'miss + lease, token 7', 'A recibe el lease: es quien va a recalcular.', { lease: 'token 7, de A' }),
        M('B', 'K', 'req', 'GET prod:1', 'Un instante después, B pide la misma clave.'),
        M('K', 'B', 'miss', 'miss sin token: espera', 'B también tiene un miss, pero ya hay un lease vigente: la caché no le da token y le avisa que alguien está recalculando.'),
        M('A', 'D', 'req', 'SELECT precio', 'Solo A va a la base.'),
        N('B', 'B', 'B espera unos ms', 'B espera unos milisegundos antes de reintentar, en lugar de ir a la base.'),
        M('D', 'A', 'res', 'precio = 100', 'La base responde una sola vez.'),
        M('A', 'K', 'req', 'SET prod:1 100 · token 7', 'A guarda el valor con su token.'),
        M('K', 'A', 'ok', 'OK', 'Aceptado.', { cache: '100', lease: '—' }),
        M('B', 'K', 'req', 'GET prod:1 (reintento)', 'B reintenta la lectura…'),
        M('K', 'B', 'hit', '100 · hit', '…y encuentra el valor que dejó A.')
      ]
    },
    {
      id: 'expire', name: 'El dueño del lease se cuelga',
      init: { cache: 'vacía', lease: '—', db: '100' },
      end: { ok: true, text: 'Resultado: el vencimiento evita que un lector colgado bloquee la clave para siempre, y el token evita que escriba tarde un valor viejo.' },
      steps: [
        M('A', 'K', 'req', 'GET prod:1', 'El lector A busca el producto.'),
        M('K', 'A', 'miss', 'miss + lease, token 7', 'Recibe un lease que vence en 2 s.', { lease: 'token 7, de A · vence en 2 s' }),
        M('A', 'D', 'req', 'SELECT precio', 'A va a la base.'),
        M('D', 'A', 'res', 'precio = 100', 'Y lee 100.'),
        N('A', 'B', 'A se congela 3 s', 'A se congela: una pausa de GC de 3 s, o una VM que se migra. No sabe que el tiempo pasa.'),
        N('K', 'K', 'vence el lease 7', 'A los 2 s, el lease vence solo y la caché anula el token 7. Sin el vencimiento, la clave quedaría bloqueada mientras A no vuelva.', { lease: 'ninguno (el 7 venció)' }),
        M('W', 'D', 'write', 'UPDATE precio = 120', 'Mientras A sigue congelado, el escritor cambia el precio.', { db: '120' }),
        M('B', 'K', 'req', 'GET prod:1', 'Llega B.'),
        M('K', 'B', 'miss', 'miss + lease, token 8', 'Como no hay lease vigente, B recibe uno nuevo.', { lease: 'token 8, de B' }),
        M('B', 'D', 'req', 'SELECT precio', 'B lee la base…'),
        M('D', 'B', 'res', 'precio = 120', '…y obtiene el valor nuevo.'),
        M('B', 'K', 'req', 'SET prod:1 120 · token 8', 'B lo guarda.'),
        M('K', 'B', 'ok', 'OK', 'Aceptado.', { cache: '120', lease: '—' }),
        M('A', 'K', 'req', 'SET prod:1 100 · token 7', 'A despierta y, sin saber nada, intenta guardar el 100 que leyó hace 3 s.'),
        M('K', 'A', 'fail', 'rechazado: token vencido', 'Rechazado: el token 7 ya no existe. Si la caché lo aceptara, pisaría el 120 con un valor viejo.')
      ]
    }
  ];

  function esc(t) { return SD.escape(t); }

  function init(host) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var SPEEDS = [1, 2.5, 0], LABELS = ['Lento', 'Rápido', 'En pausa'];
    var sp = reduce ? 2 : 0, visible = false, raf = 0, last = 0;
    var cs = CASES[0], idx = 0, ph = 'travel', el = 0, state = null, done = false;

    var scene = h('div', { class: 'sim-scroll ls-scroll' });
    var counter = h('p', { class: 'cp-count' });
    var say = h('p', { class: 'cp-say', 'aria-live': 'polite' });
    var stCache = h('b'), stLease = h('b'), stDb = h('b');
    var stateRow = h('div', { class: 'ls-state' }, [
      h('span', {}, [h('span', { text: 'Caché, prod:1' }), stCache]),
      h('span', {}, [h('span', { text: 'Lease vigente' }), stLease]),
      h('span', {}, [h('span', { text: 'Base, precio' }), stDb])
    ]);
    var ctrl = h('button', { type: 'button', class: 'btn btn--primary cp-ctrl' });
    var speedTag = h('span', { class: 'hv-clock', 'aria-hidden': 'true' });
    var chips = CASES.map(function (c) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': c === cs ? 'true' : 'false', text: c.name });
      b.addEventListener('click', function () {
        cs = c;
        chips.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        if (SPEEDS[sp] === 0 && !reduce) sp = 0;
        restart(); setCtrl(); kick();
      });
      return b;
    });

    function restart() {
      idx = 0; ph = 'travel'; el = 0; done = false;
      state = { cache: cs.init.cache, lease: cs.init.lease, db: cs.init.db };
      draw();
    }

    function setCtrl() {
      var s = SPEEDS[sp];
      ctrl.textContent = s === 0 ? 'Reanudar' : (s === 1 ? 'Acelerar' : 'Pausar');
      ctrl.setAttribute('aria-label', 'Velocidad actual: ' + LABELS[sp].toLowerCase() + '. ' + (s === 0 ? 'Toca para reanudar despacio.' : s === 1 ? 'Toca para acelerar.' : 'Toca para pausar.'));
      speedTag.textContent = LABELS[sp];
    }
    ctrl.addEventListener('click', function () { sp = (sp + 1) % SPEEDS.length; setCtrl(); kick(); });

    function rowY(i) { return TOP + i * ROW; }

    function stepSvg(st, i, f) {
      var y = rowY(i), s = '';
      if (st.note) {
        var xa = LANES[st.a].x, xb = LANES[st.b].x;
        var w = Math.max(st.l.length * 6.4 + 20, Math.abs(xb - xa) + 40), cx = (xa + xb) / 2;
        cx = Math.max(6 + w / 2, Math.min(764 - w / 2, cx));
        s += '<g style="opacity:' + Math.min(1, f * 1.5).toFixed(2) + '"><rect class="ls-note" x="' + (cx - w / 2).toFixed(1) + '" y="' + (y - 13) + '" width="' + w.toFixed(1) + '" height="22" rx="5"/>';
        s += '<text class="dg-tiny" x="' + cx.toFixed(1) + '" y="' + (y + 2) + '" text-anchor="middle">' + esc(st.l) + '</text></g>';
        return s;
      }
      var x1 = LANES[st.f].x, x2 = LANES[st.t].x, dir = x2 > x1 ? 1 : -1;
      var xs = x1 + dir * 3, xe = x2 - dir * 3, xc = xs + (xe - xs) * f, c = KIND[st.k];
      s += '<path d="M' + xs + ' ' + y + ' L' + xc.toFixed(1) + ' ' + y + '" class="ls-msg" style="stroke:' + c + (st.k === 'res' || st.k === 'miss' || st.k === 'hit' || st.k === 'ok' || st.k === 'fail' && st.f === 'K' ? ';stroke-dasharray:6 4' : '') + '"/>';
      s += '<path d="M' + (xc - dir * 9).toFixed(1) + ' ' + (y - 5) + ' L' + xc.toFixed(1) + ' ' + y + ' L' + (xc - dir * 9).toFixed(1) + ' ' + (y + 5) + ' z" style="fill:' + c + '"/>';
      if (f > 0.35) {
        var w = st.l.length * 6.5 + 14, mx = (x1 + x2) / 2;
        s += '<rect class="ls-lbg" x="' + (mx - w / 2).toFixed(1) + '" y="' + (y - 18) + '" width="' + w.toFixed(1) + '" height="14" rx="3"/>';
        s += '<text class="dg-tiny ls-l' + (st.k === 'fail' ? ' dg-fail-text' : '') + '" x="' + mx + '" y="' + (y - 7) + '" text-anchor="middle">' + esc(st.l) + '</text>';
      }
      return s;
    }

    function draw() {
      var n = cs.steps.length, H = TOP + n * ROW + 4;
      var s = '<svg viewBox="0 0 770 ' + H + '" role="img" aria-label="Diagrama de secuencia: ' + esc(cs.name) + '">';
      Object.keys(LANES).forEach(function (k) {
        var L = LANES[k];
        var used = cs.steps.some(function (st) { return !st.note && (st.f === k || st.t === k); });
        s += '<g' + (used ? '' : ' opacity="0.35"') + '><rect class="dg-box' + (k === 'K' ? ' dg-box--em' : '') + '" x="' + (L.x - 58) + '" y="8" width="116" height="32" rx="6"/>';
        s += '<text class="dg-label" x="' + L.x + '" y="29" text-anchor="middle" style="font-size:13px">' + L.name + '</text>';
        s += '<path class="dg-frame" d="M' + L.x + ' 40 V' + (H - 4) + '"/></g>';
      });
      for (var i = 0; i <= idx && i < n; i++) {
        var f = i < idx ? 1 : (ph === 'travel' && !reduce ? Math.min(1, el / TRAVEL) : 1);
        s += stepSvg(cs.steps[i], i, f);
      }
      scene.innerHTML = s + '</svg>';
      stCache.textContent = state.cache; stLease.textContent = state.lease; stDb.textContent = state.db;
      counter.innerHTML = '<span>' + esc(cs.name) + '</span> · paso ' + (idx + 1) + ' de ' + n;
      var key = cs.id + idx + (done ? 'end' : '');
      if (say.getAttribute('data-k') !== key) {
        say.setAttribute('data-k', key);
        var txt = esc(cs.steps[idx].say);
        if (done) txt += '<span class="ls-end ' + (cs.end.ok ? 'ls-end--ok' : 'ls-end--fail') + '">' + esc(cs.end.text) + '</span>';
        say.innerHTML = txt;
      }
    }

    function arrive() {
      var st = cs.steps[idx];
      if (st.set) Object.keys(st.set).forEach(function (k) { state[k] = st.set[k]; });
      if (idx === cs.steps.length - 1) done = true;
    }

    function advance(dt) {
      el += dt;
      if (ph === 'travel' && (el >= TRAVEL || reduce)) { ph = 'dwell'; el = 0; arrive(); }
      else if (ph === 'dwell') {
        var last = idx === cs.steps.length - 1;
        if (el >= (last ? DWELL + LOOP : DWELL)) {
          if (last) { restart(); return; }
          idx++; ph = 'travel'; el = 0;
        }
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

    host.classList.add('sim', 'cp-sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Leases de caché, mensaje por mensaje' }), speedTag]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'cp-narr' }, [h('div', {}, [counter, say]), ctrl]),
      stateRow,
      scene,
      h('div', { class: 'btn-row cp-chips ls-chips', role: 'group', 'aria-label': 'Caso' }, chips)
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Basado en los leases de memcache que describe Facebook (NSDI 2013). Las líneas punteadas son respuestas; en rojo, lo que sale mal o se rechaza. El botón alterna lento, rápido y pausa.' }));
    restart(); setCtrl();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) kick();
      }, { threshold: 0.25 }).observe(host);
    } else { visible = true; kick(); }
  }

  SD.ready(function () { document.querySelectorAll('[data-sim="lease"]').forEach(init); });
})();
