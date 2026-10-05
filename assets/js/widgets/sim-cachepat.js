/* Patrones de caché animados: <div data-sim="cachepat"></div>
   Cuatro elementos fijos (cliente, servidor, caché y base de datos) y un paquete que viaja entre ellos,
   paso a paso y despacio, con la narración y el estado de la caché y de la base a la vista.
   Los botones de abajo cambian de patrón; un único botón alterna velocidad lenta, rápida y pausa. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;

  var TRAVEL = 1500, DWELL = 2700, LOOP = 3500;       /* milisegundos a velocidad 1× */

  /* Nodos y puntos de anclaje de cada arista */
  var NODES = {
    C: { x: 6, y: 120, w: 122, h: 66, name: 'Cliente', sub: 'navegador o app', c: '--l-client' },
    S: { x: 214, y: 120, w: 140, h: 66, name: 'Servidor', sub: 'tu aplicación', c: '--l-service' },
    K: { x: 444, y: 12, w: 230, h: 108, name: 'Caché', sub: 'Redis', c: '--l-cache' },
    D: { x: 444, y: 192, w: 230, h: 92, name: 'Base de datos', sub: 'PostgreSQL', c: '--l-db' }
  };
  var VBW = 680, VBH = 292;
  var EDGES = {
    'C-S': [[128, 153], [214, 153]],
    'S-K': [[354, 136], [444, 76]],
    'S-D': [[354, 170], [444, 236]],
    'K-D': [[559, 120], [559, 192]]
  };
  var KIND = {
    req: { c: 'var(--link)' },
    res: { c: 'var(--label-2)' },
    hit: { c: 'var(--ok)' },
    miss: { c: 'var(--warn)' },
    write: { c: 'var(--l-queue)' },
    del: { c: 'var(--l-cache)' },
    async: { c: 'var(--l-queue)', dash: true }
  };

  function S(f, t, k, l, say, set) { return { f: f, t: t, k: k, l: l, say: say || '', set: set || null }; }

  var PATTERNS = [
    {
      id: 'aside', name: 'Cache-aside',
      init: { cache: null, ttl: '', db: '100', q: 0 },
      def: 'La aplicación habla con la caché y con la base por separado. Lee de la caché; si la clave falta, lee la base y llena la caché. Al escribir, actualiza la base y borra la clave.',
      gain: 'Es simple, y si la caché se cae no pierdes datos: la base tiene todo.',
      pay: 'Cada miss cuesta tres viajes, y entre leer la base y llenar la caché hay una carrera que puede dejar un valor viejo (4.3).',
      use: 'Por defecto, en casi todos los casos.',
      steps: [
        S('C', 'S', 'req', 'GET /productos/1', 'El cliente pide el producto 1. Solo tu aplicación conoce la caché y la base: en cache-aside, la caché es pasiva y guarda lo que la app le pone.'),
        S('S', 'K', 'req', 'GET prod:1', 'La app pregunta primero a la caché.'),
        S('K', 'S', 'miss', 'nil · miss', 'La clave no está: es un miss. Nadie la pidió todavía, o ya venció.'),
        S('S', 'D', 'req', 'SELECT precio … id = 1', 'La app va a la base, la fuente de verdad.'),
        S('D', 'S', 'res', 'precio = 100', 'La base responde en unos milisegundos.'),
        S('S', 'K', 'write', 'SET prod:1 100 EX 300', 'La app guarda el valor en la caché con un TTL de 300 s, para los próximos lectores.', { cache: '100', ttl: 'vence en 300 s' }),
        S('S', 'C', 'res', '200 · precio 100', 'Este primer lector pagó el miss: caché, base y escritura en la caché.'),
        S('C', 'S', 'req', 'GET /productos/1', 'Llega otra lectura del mismo producto.'),
        S('S', 'K', 'req', 'GET prod:1', 'De nuevo, primero la caché.'),
        S('K', 'S', 'hit', '100 · hit', 'Esta vez la clave está: un hit de medio milisegundo, sin tocar la base.'),
        S('S', 'C', 'res', '200 · precio 100', 'La mayoría de las lecturas termina así. Con 99&#8239;% de hits, a la base llega solo el 1&#8239;%.'),
        S('C', 'S', 'write', 'PUT precio = 120', 'Ahora alguien cambia el precio.'),
        S('S', 'D', 'write', 'UPDATE precio = 120', 'La app escribe primero en la base…', { db: '120' }),
        S('S', 'K', 'del', 'DEL prod:1', '…y después borra la clave en lugar de reescribirla. La próxima lectura tendrá un miss y leerá el 120 de la base. Si este DEL se pierde, el valor viejo dura como mucho un TTL.', { cache: null, ttl: '' }),
        S('S', 'C', 'res', '204', 'Escritura confirmada. La caché se volverá a llenar con la próxima lectura.')
      ]
    },
    {
      id: 'readthrough', name: 'Read-through',
      init: { cache: null, ttl: '', db: '100', q: 0 },
      def: 'La caché se pone delante de la base. La app solo le pide valores a la caché y, en un miss, es la caché la que lee la base con un cargador que le configuraste y se llena sola.',
      gain: 'El código de la app es más simple, y la lógica de carga y de TTL vive en un solo lugar.',
      pay: 'La caché tiene que saber leer la base: las cachés en proceso con cargador lo traen; con Redis, tienes que escribir esa capa.',
      use: 'Con cachés en proceso (loading cache) o productos que lo traen. Para escribir se combina con write-through o con borrar la clave.',
      steps: [
        S('C', 'S', 'req', 'GET /productos/1', 'El cliente pide el producto 1.'),
        S('S', 'K', 'req', 'get(prod:1)', 'La app le pide el valor a la caché. No sabe ni le importa si está.'),
        S('K', 'D', 'req', 'SELECT … (carga la caché)', 'La clave falta, y la caché misma va a la base con su cargador. La app no ve el miss.'),
        S('D', 'K', 'res', 'precio = 100', 'La base responde a la caché, que guarda el valor con su TTL.', { cache: '100', ttl: 'vence en 300 s' }),
        S('K', 'S', 'res', '100', 'Y se lo entrega a la app como si siempre hubiera estado. El miss costó lo mismo que en cache-aside, pero el código que lo maneja está en la caché.'),
        S('S', 'C', 'res', '200 · precio 100', 'Respuesta al cliente.'),
        S('C', 'S', 'req', 'GET /productos/1', 'Otra lectura.'),
        S('S', 'K', 'req', 'get(prod:1)', 'La misma llamada de siempre.'),
        S('K', 'S', 'hit', '100 · hit', 'Hit: la caché responde sin ir a la base.'),
        S('S', 'C', 'res', '200 · precio 100', 'Para la app, leer siempre es una sola llamada: la diferencia con cache-aside está en quién maneja el miss.')
      ]
    },
    {
      id: 'writethrough', name: 'Write-through',
      init: { cache: '100', ttl: 'vence en 300 s', db: '100', q: 0 },
      def: 'Toda escritura pasa por la caché, que la escribe en la base de forma síncrona antes de confirmar. La caché y la base se actualizan juntas.',
      gain: 'Las lecturas que vienen justo después de escribir son hits y ven el valor nuevo.',
      pay: 'Cada escritura paga la latencia de la caché y la de la base, y llenas la caché con datos que quizá nadie lea. Si la base falla después de escribir la caché, hay que deshacer.',
      use: 'Datos que se leen enseguida después de escribirse: perfiles, configuraciones, carritos.',
      steps: [
        S('C', 'S', 'write', 'PUT precio = 120', 'El cliente cambia el precio de 100 a 120.'),
        S('S', 'K', 'write', 'SET prod:1 120', 'La app escribe en la caché…', { cache: '120', ttl: 'vence en 300 s' }),
        S('K', 'D', 'write', 'UPDATE precio = 120 (síncrono)', '…y la caché escribe en la base en el mismo paso, antes de responder.', { db: '120' }),
        S('D', 'K', 'res', 'OK', 'La base confirma.'),
        S('K', 'S', 'res', 'OK', 'Solo cuando las dos tienen el valor, la caché confirma la escritura.'),
        S('S', 'C', 'res', '200 · caché + base', 'La escritura tardó lo que tarda la caché más lo que tarda la base. A cambio…'),
        S('C', 'S', 'req', 'GET /productos/1', '…la lectura siguiente…'),
        S('S', 'K', 'req', 'GET prod:1', 'va a la caché…'),
        S('K', 'S', 'hit', '120 · hit', '…y encuentra el valor nuevo. No hubo ventana con el valor viejo ni un miss después de escribir.'),
        S('S', 'C', 'res', '200 · precio 120', 'Lecturas siempre al día, pagadas con escrituras más lentas.')
      ]
    },
    {
      id: 'writebehind', name: 'Write-behind',
      init: { cache: '100', ttl: '', db: '100', q: 0 },
      def: 'La app escribe solo en la caché, que confirma enseguida y anota el cambio en una cola. Cada cierto tiempo, o cada N cambios, vuelca la cola a la base en lote. También se llama write-back.',
      gain: 'Escrituras de un milisegundo, y muchas menos escrituras a la base: los cambios a la misma clave se agrupan.',
      pay: 'Si la caché se cae antes del volcado, esos cambios se pierden. La base va atrasada: quien la lea directo ve valores viejos.',
      use: 'Contadores, métricas, vistas, posiciones de lectura: datos que toleran perder unos segundos.',
      steps: [
        S('C', 'S', 'write', 'PUT precio = 120', 'El cliente cambia el precio.'),
        S('S', 'K', 'write', 'SET prod:1 120', 'La app escribe solo en la caché, que anota el cambio en su cola hacia la base.', { cache: '120', q: 1 }),
        S('K', 'S', 'res', 'OK', 'La caché confirma de inmediato. La base todavía dice 100.'),
        S('S', 'C', 'res', '200 · 1 ms', 'Una escritura rapidísima: no esperó a la base.'),
        S('C', 'S', 'write', 'PUT precio = 130', 'Otro cambio a la misma clave.'),
        S('S', 'K', 'write', 'SET prod:1 130', 'La cola lo agrupa con el anterior: a la base solo le importa el último valor. Si la caché se cae ahora, el 120 y el 130 se pierden.', { cache: '130', q: 2 }),
        S('K', 'S', 'res', 'OK', 'Confirmado otra vez sin tocar la base.'),
        S('S', 'C', 'res', '200 · 1 ms', 'Dos escrituras confirmadas; la base sigue en 100.'),
        S('K', 'D', 'async', 'volcado en lote: 1 UPDATE', 'Pasado el intervalo de volcado, la caché escribe la cola en la base: dos cambios se volvieron un solo UPDATE.', { db: '130', q: 0 })
      ]
    },
    {
      id: 'writearound', name: 'Write-around',
      init: { cache: '100', ttl: 'vence en 300 s', db: '100', q: 0 },
      def: 'Las escrituras van solo a la base y rodean la caché. La caché se llena únicamente cuando alguien lee, normalmente con cache-aside.',
      gain: 'La caché no se llena de datos que se escriben y nadie lee.',
      pay: 'La primera lectura después de cada escritura es un miss.',
      use: 'Datos que se escriben mucho y se leen poco o tarde: logs, historiales, archivos subidos.',
      steps: [
        S('C', 'S', 'write', 'PUT precio = 120', 'El cliente cambia el precio.'),
        S('S', 'D', 'write', 'UPDATE precio = 120', 'La escritura va directo a la base: rodea la caché.', { db: '120' }),
        S('S', 'K', 'del', 'DEL prod:1', 'Si la clave estaba en la caché, se invalida para no seguir sirviendo el 100.', { cache: null, ttl: '' }),
        S('S', 'C', 'res', '204', 'Escritura confirmada. La caché no recibió el valor nuevo.'),
        S('C', 'S', 'req', 'GET /productos/1', 'Más tarde, alguien lee.'),
        S('S', 'K', 'req', 'GET prod:1', 'La app pregunta a la caché…'),
        S('K', 'S', 'miss', 'nil · miss', '…y la primera lectura paga el miss: la caché solo tiene lo que alguien leyó.'),
        S('S', 'D', 'req', 'SELECT precio … id = 1', 'La app lee la base.'),
        S('D', 'S', 'res', 'precio = 120', 'El valor nuevo.'),
        S('S', 'K', 'write', 'SET prod:1 120 EX 300', 'Ahora sí, el valor entra a la caché, porque alguien lo leyó.', { cache: '120', ttl: 'vence en 300 s' }),
        S('S', 'C', 'res', '200 · precio 120', 'Si nadie lo hubiera leído, nunca habría ocupado memoria en la caché.')
      ]
    },
    {
      id: 'refresh', name: 'Refresh-ahead',
      init: { cache: '100', ttl: 'vence en 40 s', db: '100', q: 0 },
      def: 'La caché renueva en segundo plano las claves que se siguen pidiendo antes de que venzan, por ejemplo cuando les queda menos del 20&#8239;% del TTL.',
      gain: 'Las claves calientes no vencen nunca: no hay misses ni estampidas en ellas.',
      pay: 'Recalculas cosas que quizá nadie vuelva a pedir, y hay que decidir qué renovar y cuándo.',
      use: 'Pocas claves muy leídas y caras de calcular: la portada, los precios del día, un ranking.',
      steps: [
        S('C', 'S', 'req', 'GET /productos/1', 'Una lectura de una clave popular. Le quedan 40 de sus 300 s de vida.'),
        S('S', 'K', 'req', 'GET prod:1', 'La app pregunta a la caché.'),
        S('K', 'S', 'hit', '100 · hit', 'Hit: la respuesta sale enseguida.'),
        S('S', 'C', 'res', '200 · precio 100', 'El lector no espera a nadie.'),
        S('K', 'D', 'async', 'recargar antes de vencer', 'Como le queda menos del 20&#8239;% del TTL y la siguen pidiendo, la caché la recarga en segundo plano. Nadie espera esta consulta.'),
        S('D', 'K', 'res', 'precio = 100', 'El valor se guarda con un TTL nuevo de 300 s.', { cache: '100', ttl: 'vence en 300 s' }),
        S('C', 'S', 'req', 'GET /productos/1', 'La lectura siguiente…'),
        S('S', 'K', 'req', 'GET prod:1', '…va a la caché…'),
        S('K', 'S', 'hit', '100 · hit', '…y vuelve a ser un hit. Esta clave nunca llega a vencer, así que nunca hay un miss ni una estampida sobre ella.'),
        S('S', 'C', 'res', '200 · precio 100', 'El costo: la recarga se hace aunque nadie vuelva a pedir la clave.')
      ]
    }
  ];

  function esc(t) { return SD.escape(t); }

  function init(host) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var SPEEDS = [1, 2.5, 0];
    var LABELS = ['Lento', 'Rápido', 'En pausa'];
    var sp = reduce ? 2 : 0, visible = false, raf = 0, last = 0;
    var pat = PATTERNS[0], idx = 0, ph = 'travel', el = 0, state = null, flash = {};

    var scene = h('div', { class: 'sim-scroll cp-scroll' });
    var counter = h('p', { class: 'cp-count' });
    var say = h('p', { class: 'cp-say', 'aria-live': 'polite' });
    var ctrl = h('button', { type: 'button', class: 'btn btn--primary cp-ctrl' });
    var info = h('div', { class: 'cp-info' });
    var chips = PATTERNS.map(function (p) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': p === pat ? 'true' : 'false', text: p.name });
      b.addEventListener('click', function () {
        pat = p;
        chips.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        if (SPEEDS[sp] === 0 && !reduce) sp = 0;
        restart(); showInfo(); setCtrl(); kick();
      });
      return b;
    });

    function restart() {
      idx = 0; ph = 'travel'; el = 0; flash = {};
      state = { cache: pat.init.cache, ttl: pat.init.ttl, db: pat.init.db, q: pat.init.q };
      draw();
    }

    function showInfo() {
      info.innerHTML = '<p class="cp-def"><b>' + esc(pat.name) + '.</b> ' + pat.def + '</p>' +
        '<dl class="cp-rows"><dt>Ganas</dt><dd>' + pat.gain + '</dd><dt>Pagas</dt><dd>' + pat.pay + '</dd><dt>Úsalo para</dt><dd>' + pat.use + '</dd></dl>';
    }

    function setCtrl() {
      var s = SPEEDS[sp];
      ctrl.textContent = s === 0 ? 'Reanudar' : (s === 1 ? 'Acelerar' : 'Pausar');
      ctrl.setAttribute('aria-label', 'Velocidad actual: ' + LABELS[sp].toLowerCase() + '. ' + (s === 0 ? 'Toca para reanudar despacio.' : s === 1 ? 'Toca para acelerar.' : 'Toca para pausar.'));
      ctrl.title = 'Cambia entre lento, rápido y pausa';
      host.querySelector('.cp-speed') && (host.querySelector('.cp-speed').textContent = LABELS[sp]);
    }
    ctrl.addEventListener('click', function () {
      sp = (sp + 1) % SPEEDS.length;
      setCtrl(); kick();
    });

    function pos(step, f) {
      var key = step.f + '-' + step.t, rev = false, e = EDGES[key];
      if (!e) { e = EDGES[step.t + '-' + step.f]; rev = true; }
      var a = rev ? e[1] : e[0], b = rev ? e[0] : e[1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, e];
    }

    function nodeSvg(id) {
      var n = NODES[id], s = '';
      s += '<rect class="dg-layer" style="--c: var(' + n.c + ')" x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="10"/>';
      var cx = n.x + n.w / 2;
      s += '<text class="dg-label cp-name" x="' + cx + '" y="' + (n.y + 25) + '" text-anchor="middle">' + n.name + '</text>';
      s += '<text class="dg-tiny" x="' + cx + '" y="' + (n.y + 43) + '" text-anchor="middle">' + n.sub + '</text>';
      if (id === 'K') {
        var v = state.cache === null ? 'prod:1 · vacía' : 'prod:1 = ' + state.cache;
        var line2 = state.q ? 'pendiente para la base: ' + (state.q === 1 ? '1 cambio' : '2 cambios, 1 UPDATE') : state.ttl;
        s += '<rect class="' + (flash.cache ? 'cp-hl cp-hl--on' : 'cp-hl') + '" x="' + (n.x + 16) + '" y="' + (n.y + 52) + '" width="' + (n.w - 32) + '" height="26" rx="6"/>';
        s += '<text class="cp-val" x="' + cx + '" y="' + (n.y + 70) + '" text-anchor="middle">' + v + '</text>';
        if (line2) s += '<text class="dg-tiny' + (state.q ? ' cp-q' : '') + '" x="' + cx + '" y="' + (n.y + 96) + '" text-anchor="middle">' + line2 + '</text>';
      }
      if (id === 'D') {
        s += '<rect class="' + (flash.db ? 'cp-hl cp-hl--on' : 'cp-hl') + '" x="' + (n.x + 16) + '" y="' + (n.y + 52) + '" width="' + (n.w - 32) + '" height="26" rx="6"/>';
        s += '<text class="cp-val" x="' + cx + '" y="' + (n.y + 70) + '" text-anchor="middle">producto 1: precio = ' + state.db + '</text>';
      }
      return s;
    }

    function draw() {
      var step = pat.steps[idx], f = ph === 'travel' ? Math.min(1, el / TRAVEL) : 1;
      var ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      var p = pos(step, reduce ? 1 : ease), kind = KIND[step.k];
      var s = '<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" role="img" aria-label="Cliente, servidor, caché y base de datos; un mensaje viaja entre ellos según el patrón elegido">';
      Object.keys(EDGES).forEach(function (k) {
        var e = EDGES[k], on = e === p[2];
        s += '<path class="cp-edge' + (on ? ' cp-edge--on' : '') + '" d="M' + e[0][0] + ' ' + e[0][1] + ' L' + e[1][0] + ' ' + e[1][1] + '"' +
          (on ? ' style="stroke:' + kind.c + (kind.dash ? ';stroke-dasharray:7 5' : '') + '"' : '') + '/>';
      });
      ['C', 'S', 'K', 'D'].forEach(function (id) { s += nodeSvg(id); });
      /* paquete y su etiqueta */
      var label = step.l, w = Math.round(label.length * 7.4 + 20);
      var lx = Math.max(4 + w / 2, Math.min(VBW - 4 - w / 2, p[0])), ly = p[1] - 22;
      if (step.f + step.t === 'KD' || step.f + step.t === 'DK') { lx = 559 - 16 - w / 2; ly = 158; }
      s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="7" style="fill:' + kind.c + '"/>';
      s += '<rect class="cp-pill" x="' + (lx - w / 2).toFixed(1) + '" y="' + (ly - 14).toFixed(1) + '" width="' + w + '" height="25" rx="12.5" style="stroke:' + kind.c + '"/>';
      s += '<text class="cp-pill-t" x="' + lx.toFixed(1) + '" y="' + (ly + 3).toFixed(1) + '" text-anchor="middle">' + esc(label) + '</text>';
      scene.innerHTML = s + '</svg>';
      counter.innerHTML = '<span>' + esc(pat.name) + '</span> · paso ' + (idx + 1) + ' de ' + pat.steps.length;
      if (say.getAttribute('data-k') !== pat.id + idx) { say.innerHTML = step.say; say.setAttribute('data-k', pat.id + idx); }
    }

    function arrive() {
      var step = pat.steps[idx];
      flash = {};
      if (step.set) {
        Object.keys(step.set).forEach(function (k) {
          state[k] = step.set[k];
          if (k === 'cache' || k === 'q' || k === 'ttl') flash.cache = true;
          if (k === 'db') flash.db = true;
        });
      }
    }

    function advance(dt) {
      el += dt;
      if (ph === 'travel' && (el >= TRAVEL || reduce)) { ph = 'dwell'; el = 0; arrive(); }
      else if (ph === 'dwell' && el >= (idx === pat.steps.length - 1 ? DWELL + LOOP : DWELL)) {
        if (idx === pat.steps.length - 1) { restart(); return; }
        idx++; ph = 'travel'; el = 0; flash = {};
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
    host.appendChild(h('div', { class: 'sim-head' }, [
      h('p', { class: 'sim-title', text: 'Patrones de caché, paso a paso' }),
      h('span', { class: 'cp-speed hv-clock', 'aria-hidden': 'true' })
    ]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      scene,
      h('div', { class: 'cp-narr' }, [h('div', {}, [counter, say]), ctrl]),
      h('div', { class: 'btn-row cp-chips', role: 'group', 'aria-label': 'Patrón' }, chips),
      info
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Colores: azul, una petición; gris, una respuesta; verde, un hit; naranja, un miss; violeta, una escritura (punteada si es en segundo plano). El botón alterna lento, rápido y pausa.' }));
    restart(); showInfo(); setCtrl();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) kick();
      }, { threshold: 0.3 }).observe(host);
    } else { visible = true; kick(); }
  }

  SD.ready(function () { document.querySelectorAll('[data-sim="cachepat"]').forEach(init); });
})();
