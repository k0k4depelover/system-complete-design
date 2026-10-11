/* Motor de mapas explorables.
   <div class="sdmap" data-map="id"></div> + SD.defineMap('id', {...})
   Definición:
     { title, intro, width, height, pieces?, stepPanel?,
       groups: [{ id, label, x, y, w, h }],
       nodes:  [{ id, layer, label, sub, brief?, x, y, w?, h?, bus?, info: { resp, api, data, fail, nums } }]   (x, y = centro)
               (bus: true = una barra larga, como un log, que recibe cada arista de frente a la altura o en la columna del otro nodo)
               (brief: una frase con lo que hace la pieza; sale en el tooltip, en el detalle y en la lista de piezas)
       pieces: true = el panel lateral lista las piezas por grupo, con su brief, y cada una abre su detalle
       edges:  [{ id, from, to, label?, async?, bend?, labelAt? }],   (labelAt: 0–1, dónde va la etiqueta; 0.5 por defecto)
       scenarios: [...] (ver flow-sim.js) }
   Deep link: #node=<id>&scenario=<id>&step=<n> */
(function () {
  'use strict';

  var SD = window.SD;
  var h = SD.h;
  var NS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  var LAYERS = {
    client: { name: 'Cliente', c: '--l-client' },
    edge: { name: 'Entrada', c: '--l-edge' },
    service: { name: 'Servicios', c: '--l-service' },
    queue: { name: 'Colas y streams', c: '--l-queue' },
    cache: { name: 'Caché', c: '--l-cache' },
    db: { name: 'Bases de datos', c: '--l-db' },
    gpu: { name: 'GPU e inferencia', c: '--l-gpu' },
    external: { name: 'Externos', c: '--l-external' }
  };
  var LAYER_ORDER = ['client', 'edge', 'service', 'queue', 'cache', 'db', 'gpu', 'external'];

  /* Iconos en una caja de 24 × 24 */
  var ICONS = {
    client: '<rect x="2" y="3.5" width="20" height="13.5" rx="2"/><path d="M8 21h8M12 17v4"/>',
    edge: '<path d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z"/>',
    service: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M6 10h12M6 14.5h8"/>',
    queue: '<rect x="1" y="7.5" width="22" height="9" rx="4.5"/><path d="M7 7.5v9M12 7.5v9M17 7.5v9"/>',
    cache: '<path d="M14 2 L5 13.5 H11 L9.5 22 L19 10 H13 Z"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    gpu: '<rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M9 2.5v3.5M12 2.5v3.5M15 2.5v3.5M9 18v3.5M12 18v3.5M15 18v3.5M2.5 9h3.5M2.5 12h3.5M2.5 15h3.5M18 9h3.5M18 12h3.5M18 15h3.5"/>',
    external: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19"/><ellipse cx="12" cy="12" rx="4" ry="9.5"/>'
  };

  var TABS = [
    ['resp', 'Responsabilidad'],
    ['api', 'Endpoints'],
    ['data', 'Esquema'],
    ['fail', 'Fallos'],
    ['nums', 'Números']
  ];

  function s(tag, attrs, kids) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { if (attrs[k] != null) el.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  SD.mapLayers = LAYERS;
  SD.mapIcons = ICONS;

  /* ======================================================================== */

  function MapView(host, def) {
    this.host = host;
    this.def = def;
    this.id = 'sdm' + (++uid);
    this.nodes = {};
    this.edges = {};
    this.k = 1; this.tx = 0; this.ty = 0;
    this.selected = null;
    this.hidden = {};
    this.build();
    this.render();
    if (this.initScenarios) this.initScenarios();
    var self = this;
    requestAnimationFrame(function () {
      self.home();
      self.applyDeepLink();
    });
  }

  MapView.prototype.build = function () {
    var self = this, def = this.def;
    this.host.classList.add('sdmap');
    if (def.stepPanel) this.host.classList.add('has-steppanel');
    this.host.innerHTML = '';
    if (def.stageHeight) this.host.style.setProperty('--sdm-h', def.stageHeight + 'px');

    /* Barra */
    var layersPresent = LAYER_ORDER.filter(function (l) { return def.nodes.some(function (n) { return n.layer === l; }); });
    var chips = h('div', { class: 'sdm-layers', role: 'group', 'aria-label': 'Resaltar capas' });
    layersPresent.forEach(function (l) {
      var b = h('button', { type: 'button', class: 'sdm-layer', 'aria-pressed': 'true', style: '--c: var(' + LAYERS[l].c + ')', text: LAYERS[l].name });
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        self.hidden[l] = !on;
        self.applyDim();
      });
      chips.appendChild(b);
    });
    function tool(label, text, fn) {
      var b = h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label, text: text });
      b.addEventListener('click', fn);
      return b;
    }
    this.fsBtn = tool('Pantalla completa', '⛶', function () { self.toggleFullscreen(); });
    var tools = h('div', { class: 'sdm-tools' }, [
      tool('Acercar', '+', function () { self.zoomAt(self.W / 2, self.H / 2, 1.25); }),
      tool('Alejar', '−', function () { self.zoomAt(self.W / 2, self.H / 2, 0.8); }),
      tool('Ver todo el mapa', '⤢', function () { self.fit(); }),
      this.fsBtn
    ]);
    this.host.appendChild(h('div', { class: 'sdm-toolbar' }, [
      h('p', { class: 'sdm-title', text: def.title }), chips, tools
    ]));

    /* Lienzo */
    this.svg = s('svg', { class: 'sdm-svg', role: 'group', 'aria-label': 'Mapa: ' + def.title });
    this.world = s('g', { class: 'sdm-world' });
    this.svg.appendChild(this.defs());
    this.svg.appendChild(this.world);
    this.stage = h('div', { class: 'sdm-stage', tabindex: '0', 'aria-label': 'Lienzo del mapa. Flechas para moverse, más y menos para zoom, cero para ver todo.' });
    this.stage.appendChild(this.svg);
    this.hint = h('p', { class: 'sdm-hint', text: 'Arrastra para moverte. Clic en el mapa y rueda para zoom, o Ctrl + rueda.' });
    this.stage.appendChild(this.hint);
    this.mini = h('div', { class: 'sdm-minimap', 'aria-hidden': 'true' });
    this.stage.appendChild(this.mini);

    this.panel = h('aside', { class: 'sdm-panel', 'aria-live': 'polite', 'aria-label': 'Detalle del mapa' });
    this.host.appendChild(h('div', { class: 'sdm-body' }, [this.stage, this.panel]));

    this.scenEl = h('div', { class: 'sdm-scen' });
    if (def.scenarios && def.scenarios.length) this.host.appendChild(this.scenEl);

    this.bindStage();
    this.showDefaultPanel();
  };

  MapView.prototype.defs = function () {
    var d = s('defs');
    d.appendChild(s('marker', { id: this.id + '-ah', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, [
      s('path', { d: 'M0 0 L10 5 L0 10 z', class: 'sdm-arrow' })
    ]));
    /* Rayado de nodo caído (id fijo: todos los mapas usan el mismo) */
    if (!document.getElementById('sdm-hatch')) {
      var p = s('pattern', { id: 'sdm-hatch', patternUnits: 'userSpaceOnUse', width: 10, height: 10, patternTransform: 'rotate(45)' }, [
        s('rect', { class: 'sdm-hatch-bg', width: 10, height: 10 }),
        s('line', { class: 'sdm-hatch-line', x1: 0, y1: 0, x2: 0, y2: 10, 'stroke-width': 4 })
      ]);
      d.appendChild(p);
    }
    return d;
  };

  /* ---------- Render ---------- */

  MapView.prototype.render = function () {
    var self = this, def = this.def;
    var gGroups = s('g', { class: 'sdm-groups' });
    var gEdges = s('g', { class: 'sdm-edges' });
    var gNodes = s('g', { class: 'sdm-nodes' });
    this.gPackets = s('g', { class: 'sdm-packets' });
    this.world.appendChild(gGroups);
    this.world.appendChild(gEdges);
    this.world.appendChild(gNodes);
    this.world.appendChild(this.gPackets);

    (def.groups || []).forEach(function (g) {
      gGroups.appendChild(s('g', { class: 'sdm-group' }, [
        s('rect', { x: g.x, y: g.y, width: g.w, height: g.h, rx: 10 }),
        s('text', { x: g.x + 14, y: g.y + 22 }, [g.label])
      ]));
    });

    def.nodes.forEach(function (n) {
      /* ancho estimado según el texto: etiqueta 15 px semicondensada, subtítulo 12 px */
      var need = 46 + Math.max(n.label.length * 7.6, (n.sub || '').length * 6.1) + 16;
      n.w = Math.max(n.w || 188, Math.ceil(need)); n.h = n.h || 60;
      var L = LAYERS[n.layer] || LAYERS.service;
      var x0 = n.x - n.w / 2, y0 = n.y - n.h / 2;
      var icon = s('g', { class: 'sdm-icon', transform: 'translate(' + (x0 + 12) + ' ' + (n.y - 12) + ')' });
      icon.innerHTML = ICONS[n.layer] || ICONS.service;
      var kids = [
        s('rect', { class: 'sdm-sel', x: x0 - 6, y: y0 - 6, width: n.w + 12, height: n.h + 12, rx: 10 }),
        s('rect', { class: 'sdm-box', x: x0, y: y0, width: n.w, height: n.h, rx: 6 }),
        icon,
        s('text', { class: 'sdm-label', x: x0 + 46, y: n.sub ? n.y - 3 : n.y + 5 }, [n.label])
      ];
      if (n.sub) kids.push(s('text', { class: 'sdm-sub', x: x0 + 46, y: n.y + 15 }, [n.sub]));
      kids.push(s('g', { class: 'sdm-down-tag' }, [
        s('rect', { x: x0 + n.w - 50, y: y0 - 10, width: 50, height: 18, rx: 3 }),
        s('text', { x: x0 + n.w - 25, y: y0 + 3, 'text-anchor': 'middle' }, ['Caído'])
      ]));
      /* Tooltip al pasar el mouse: qué hace la pieza */
      kids.unshift(s('title', {}, [n.label + ': ' + (n.brief || n.sub || L.name)]));
      var el = s('g', {
        class: 'sdm-node', 'data-id': n.id, 'data-layer': n.layer, tabindex: '0', role: 'button',
        style: '--c: var(' + L.c + ')',
        'aria-label': n.label + (n.sub ? ', ' + n.sub : '') + '. Capa: ' + L.name + '. Abrir detalle.'
      }, kids);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.select(n.id, true); }
      });
      el.addEventListener('focus', function () { self.ensureVisible([[n.x, n.y]]); });
      gNodes.appendChild(el);
      self.nodes[n.id] = { def: n, el: el };
    });

    (def.edges || []).forEach(function (e) {
      var a = self.nodes[e.from], b = self.nodes[e.to];
      if (!a || !b) { console.warn('[SD mapa] arista con nodo inexistente:', e); return; }
      var d = self.edgePath(a.def, b.def, e.bend || 0, e.labelAt);
      var path = s('path', { d: d.d, 'marker-end': e.oneway === false ? null : 'url(#' + self.id + '-ah)' });
      if (e.both) path.setAttribute('marker-start', 'url(#' + self.id + '-ah)');
      var g = s('g', { class: 'sdm-edge' + (e.async ? ' is-async' : ''), 'data-id': e.id }, [path]);
      gEdges.appendChild(g);
      if (e.label) {
        var t = s('text', { x: d.mx, y: d.my + 3.5, 'text-anchor': 'middle' }, [e.label]);
        var bg = s('rect', { class: 'sdm-elabel-bg', rx: 3 });
        g.appendChild(bg);
        g.appendChild(t);
        requestAnimationFrame(function () {
          try {
            var bb = t.getBBox();
            bg.setAttribute('x', bb.x - 4); bg.setAttribute('y', bb.y - 1);
            bg.setAttribute('width', bb.width + 8); bg.setAttribute('height', bb.height + 2);
          } catch (err) { /* sin layout todavía */ }
        });
      }
      self.edges[e.id] = { def: e, el: g, path: path };
    });

    this.bounds = this.computeBounds();
    this.renderMinimap();
  };

  /* Punto del borde de un nodo en dirección a (tx, ty) */
  function boxPoint(n, tx, ty, pad) {
    var dx = tx - n.x, dy = ty - n.y;
    if (!dx && !dy) return [n.x, n.y];
    var hw = n.w / 2 + pad, hh = n.h / 2 + pad;
    /* Un bus (un log largo, por ejemplo) recibe cada arista de frente, a la altura o en la columna del otro nodo */
    if (n.bus) {
      if (Math.abs(dx) > n.w / 2) return [n.x + (dx > 0 ? hw : -hw), clamp(ty, n.y - n.h / 2 + 12, n.y + n.h / 2 - 12)];
      return [clamp(tx, n.x - n.w / 2 + 12, n.x + n.w / 2 - 12), n.y + (dy > 0 ? hh : -hh)];
    }
    var sc = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    return [n.x + dx * sc, n.y + dy * sc];
  }

  MapView.prototype.edgePath = function (a, b, bend, t) {
    var cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    if (t == null) t = 0.5;
    if (bend) {
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      cx += -dy / len * bend; cy += dx / len * bend;
    }
    var p1, p2;
    if (!bend && b.bus) { p2 = boxPoint(b, a.x, a.y, 5); p1 = boxPoint(a, p2[0], p2[1], 3); }
    else if (!bend && a.bus) { p1 = boxPoint(a, b.x, b.y, 3); p2 = boxPoint(b, p1[0], p1[1], 5); }
    else {
      p1 = boxPoint(a, bend ? cx : b.x, bend ? cy : b.y, 3);
      p2 = boxPoint(b, bend ? cx : a.x, bend ? cy : a.y, 5);
    }
    var d = bend
      ? 'M' + p1[0] + ' ' + p1[1] + ' Q' + cx + ' ' + cy + ' ' + p2[0] + ' ' + p2[1]
      : 'M' + p1[0] + ' ' + p1[1] + ' L' + p2[0] + ' ' + p2[1];
    /* punto de la etiqueta sobre la arista (en la curva cuadrática, su punto en t) */
    var u = 1 - t;
    var mx = bend ? u * u * p1[0] + 2 * u * t * cx + t * t * p2[0] : p1[0] + t * (p2[0] - p1[0]);
    var my = bend ? u * u * p1[1] + 2 * u * t * cy + t * t * p2[1] : p1[1] + t * (p2[1] - p1[1]);
    return { d: d, mx: mx, my: my };
  };

  MapView.prototype.computeBounds = function () {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    this.def.nodes.forEach(function (n) {
      x0 = Math.min(x0, n.x - n.w / 2); y0 = Math.min(y0, n.y - n.h / 2);
      x1 = Math.max(x1, n.x + n.w / 2); y1 = Math.max(y1, n.y + n.h / 2);
    });
    (this.def.groups || []).forEach(function (g) {
      x0 = Math.min(x0, g.x); y0 = Math.min(y0, g.y);
      x1 = Math.max(x1, g.x + g.w); y1 = Math.max(y1, g.y + g.h);
    });
    var m = 30;
    return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
  };

  /* ---------- Minimapa ---------- */

  MapView.prototype.renderMinimap = function () {
    var b = this.bounds, self = this;
    var svg = s('svg', { viewBox: b.x + ' ' + b.y + ' ' + b.w + ' ' + b.h });
    this.def.nodes.forEach(function (n) {
      svg.appendChild(s('rect', { class: 'sdm-mm-node', x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, rx: 6, fill: 'var(' + (LAYERS[n.layer] || LAYERS.service).c + ')' }));
    });
    this.mmView = s('rect', { class: 'sdm-mm-view' });
    svg.appendChild(this.mmView);
    this.mini.innerHTML = '';
    this.mini.appendChild(svg);
    this.mmSvg = svg;

    var dragging = false;
    function go(e) {
      var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      var w = pt.matrixTransform(svg.getScreenCTM().inverse());
      self.centerOnWorld(w.x, w.y);
    }
    this.mini.addEventListener('pointerdown', function (e) { e.stopPropagation(); dragging = true; self.mini.setPointerCapture(e.pointerId); go(e); });
    this.mini.addEventListener('pointermove', function (e) { if (dragging) go(e); });
    this.mini.addEventListener('pointerup', function () { dragging = false; });
  };

  /* ---------- Transformación ---------- */

  MapView.prototype.measure = function () {
    var r = this.stage.getBoundingClientRect();
    this.W = r.width || 800; this.H = r.height || 500;
  };

  MapView.prototype.apply = function () {
    this.world.setAttribute('transform', 'translate(' + this.tx + ' ' + this.ty + ') scale(' + this.k + ')');
    if (this.mmView) {
      this.mmView.setAttribute('x', -this.tx / this.k);
      this.mmView.setAttribute('y', -this.ty / this.k);
      this.mmView.setAttribute('width', this.W / this.k);
      this.mmView.setAttribute('height', this.H / this.k);
    }
  };

  /* Alto libre para el mapa: abajo quedan el minimapa y la ayuda, que no deben tapar nodos */
  MapView.prototype.fitH = function () {
    return this.W > 640 ? Math.max(120, this.H - 104) : this.H;
  };

  MapView.prototype.fit = function () {
    this.measure();
    var b = this.bounds, H = this.fitH();
    this.k = clamp(Math.min(this.W / b.w, H / b.h), 0.2, 1.3);
    this.tx = (this.W - b.w * this.k) / 2 - b.x * this.k;
    this.ty = (H - b.h * this.k) / 2 - b.y * this.k;
    this.apply();
  };

  /* Vista inicial: el mapa completo si se lee bien; si no, un zoom legible centrado en el punto de partida */
  MapView.prototype.home = function () {
    this.measure();
    var b = this.bounds, minK = this.def.minZoom || 0.72;
    var kFit = Math.min(this.W / b.w, this.fitH() / b.h);
    if (kFit >= minK) { this.fit(); return; }
    this.k = minK;
    var start = this.nodes[this.def.start] || this.nodes[this.firstNodeId()];
    var n = start.def;
    /* el nodo de partida queda en el tercio izquierdo-superior para mostrar hacia dónde sigue el camino */
    this.tx = this.W * 0.28 - n.x * this.k;
    this.ty = this.H * 0.4 - n.y * this.k;
    this.apply();
  };

  MapView.prototype.firstNodeId = function () {
    var sc = this.def.scenarios && this.def.scenarios[0];
    var st = sc && sc.steps[0];
    return (st && (st.at || st.from)) || this.def.nodes[0].id;
  };

  MapView.prototype.zoomAt = function (sx, sy, factor) {
    this.measure();
    var k2 = clamp(this.k * factor, 0.2, 2.6);
    var wx = (sx - this.tx) / this.k, wy = (sy - this.ty) / this.k;
    this.k = k2;
    this.tx = sx - wx * k2; this.ty = sy - wy * k2;
    this.apply();
  };

  MapView.prototype.centerOnWorld = function (wx, wy, animate) {
    this.measure();
    var tx = this.W / 2 - wx * this.k, ty = this.H / 2 - wy * this.k;
    if (!animate || SD.reduceMotion) { this.tx = tx; this.ty = ty; this.apply(); return; }
    var self = this, fx = this.tx, fy = this.ty, t0 = null;
    function step(ts) {
      if (t0 == null) t0 = ts;
      var t = Math.min(1, (ts - t0) / 320), e = t * (2 - t);
      self.tx = fx + (tx - fx) * e; self.ty = fy + (ty - fy) * e; self.apply();
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  /* Si algún punto del mundo queda fuera de la vista, centra en su promedio */
  MapView.prototype.ensureVisible = function (pts) {
    this.measure();
    /* márgenes: el minimapa ocupa la esquina inferior derecha */
    var m = 60, mr = this.W > 640 ? 180 : 60, mb = this.W > 640 ? 110 : 60, self = this;
    var out = pts.some(function (p) {
      var sx = p[0] * self.k + self.tx, sy = p[1] * self.k + self.ty;
      return sx < m || sy < m || sx > self.W - mr || sy > self.H - mb;
    });
    if (!out) return;
    var cx = 0, cy = 0;
    pts.forEach(function (p) { cx += p[0]; cy += p[1]; });
    this.centerOnWorld(cx / pts.length, cy / pts.length, true);
  };

  /* ---------- Interacción ---------- */

  MapView.prototype.bindStage = function () {
    var self = this, st = this.stage;
    var pointers = {}, downTarget = null, moved = false, start = null, pinch = null;

    st.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 1) {
        downTarget = e.target.closest ? e.target.closest('.sdm-node') : null;
        moved = false; start = { x: e.clientX, y: e.clientY, tx: self.tx, ty: self.ty };
      } else if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: self.k };
        moved = true;
      }
      st.setPointerCapture(e.pointerId);
      self.active = true;
    });

    st.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 2 && pinch) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var r = st.getBoundingClientRect();
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        self.zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, (pinch.k * d / pinch.d) / self.k);
        return;
      }
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) > 5) { moved = true; st.classList.add('is-dragging'); }
      if (moved) { self.tx = start.tx + dx; self.ty = start.ty + dy; self.apply(); }
    });

    function end(e) {
      if (!pointers[e.pointerId]) return;
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinch = null;
      if (!Object.keys(pointers).length) {
        st.classList.remove('is-dragging');
        if (!moved && downTarget) self.select(downTarget.getAttribute('data-id'), false);
        start = null; downTarget = null;
      }
    }
    st.addEventListener('pointerup', end);
    st.addEventListener('pointercancel', end);

    st.addEventListener('wheel', function (e) {
      var fs = document.fullscreenElement === self.host;
      if (!(e.ctrlKey || e.metaKey || fs || self.active)) {
        self.hint.textContent = 'Para hacer zoom: clic en el mapa y rueda, o Ctrl + rueda.';
        return;
      }
      e.preventDefault();
      var r = st.getBoundingClientRect();
      self.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016));
    }, { passive: false });

    /* La rueda solo hace zoom después de hacer clic en el mapa; al salir, vuelve a hacer scroll de página */
    st.addEventListener('pointerleave', function () { self.active = false; });

    st.addEventListener('keydown', function (e) {
      if (e.target !== st) return;
      var step = 60, handled = true;
      if (e.key === 'ArrowLeft') self.tx += step;
      else if (e.key === 'ArrowRight') self.tx -= step;
      else if (e.key === 'ArrowUp') self.ty += step;
      else if (e.key === 'ArrowDown') self.ty -= step;
      else if (e.key === '+' || e.key === '=') { self.measure(); self.zoomAt(self.W / 2, self.H / 2, 1.2); }
      else if (e.key === '-') { self.measure(); self.zoomAt(self.W / 2, self.H / 2, 0.83); }
      else if (e.key === '0') self.fit();
      else handled = false;
      if (handled) { e.preventDefault(); self.apply(); }
    });

    window.addEventListener('resize', function () { self.measure(); self.apply(); });
    window.addEventListener('hashchange', function () { self.applyDeepLink(); });
    document.addEventListener('fullscreenchange', function () {
      self.fsBtn.setAttribute('aria-label', document.fullscreenElement === self.host ? 'Salir de pantalla completa' : 'Pantalla completa');
      setTimeout(function () { self.fit(); }, 60);
    });
  };

  MapView.prototype.toggleFullscreen = function () {
    if (document.fullscreenElement === this.host) { document.exitFullscreen(); return; }
    if (this.host.requestFullscreen) this.host.requestFullscreen().catch(function () {});
  };

  MapView.prototype.applyDim = function () {
    var self = this;
    Object.keys(this.nodes).forEach(function (id) {
      var n = self.nodes[id];
      n.el.classList.toggle('is-dim', !!self.hidden[n.def.layer]);
    });
    Object.keys(this.edges).forEach(function (id) {
      var e = self.edges[id], a = self.nodes[e.def.from].def, b = self.nodes[e.def.to].def;
      e.el.classList.toggle('is-dim', !!(self.hidden[a.layer] || self.hidden[b.layer]));
    });
  };

  /* ---------- Panel ---------- */

  MapView.prototype.showDefaultPanel = function () {
    var def = this.def;
    var inner = h('div', { class: 'sdm-panel-inner sdm-empty' });
    inner.appendChild(h('h3', { text: 'Cómo usar el mapa' }));
    if (def.intro) inner.appendChild(h('p', { html: def.intro }));
    inner.appendChild(h('ul', {}, [
      h('li', { text: 'Haz clic en cualquier nodo para ver su responsabilidad, endpoints, esquema, fallos y números.' }),
      h('li', { text: 'Arrastra para moverte; usa + y − o la rueda (después de hacer clic en el mapa) para zoom.' }),
      def.scenarios && def.scenarios.length ? h('li', { text: 'Abajo, elige un escenario y pulsa Reproducir para ver viajar la request paso a paso.' }) : null
    ]));
    var legend = h('ul', { class: 'sdm-legend' });
    legend.appendChild(h('li', { html: '<svg width="26" height="10" aria-hidden="true"><path d="M1 5h24" stroke="var(--ink-3)" stroke-width="1.6"/></svg>Llamada síncrona' }));
    legend.appendChild(h('li', { html: '<svg width="26" height="10" aria-hidden="true"><path d="M1 5h24" stroke="var(--ink-3)" stroke-width="1.6" stroke-dasharray="5 4"/></svg>Asíncrona o de control' }));
    legend.appendChild(h('li', { html: '<svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="var(--ink)"/></svg>Request' }));
    legend.appendChild(h('li', { html: '<svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="var(--link)"/></svg>Respuesta' }));
    legend.appendChild(h('li', { html: '<svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="var(--fail)"/></svg>Error o falla' }));
    legend.appendChild(h('li', { html: '<svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="var(--l-queue)"/></svg>Evento asíncrono' }));
    inner.appendChild(h('h4', { text: 'Leyenda' }));
    inner.appendChild(legend);
    /* (la ayuda plegable del panel de pasos reusa esta función sobre un objeto sin piezas: por eso el guard) */
    if (def.pieces && this.piecesBlock) inner.appendChild(this.piecesBlock(true));
    this.panel.innerHTML = '';
    this.panel.appendChild(inner);
  };

  /* Lista de piezas del mapa, agrupadas como en el lienzo, con una frase de qué hace cada una (def.pieces).
     active: ids que participan en el paso actual; se marcan en la lista. */
  MapView.prototype.piecesBlock = function (open, active) {
    var self = this, def = this.def, act = {};
    /* El bloque anterior se reemplaza bajo el puntero sin recibir mouseleave: se limpia el resaltado */
    function clearHl() { Object.keys(self.nodes).forEach(function (id) { self.nodes[id].el.classList.remove('is-hl'); }); }
    clearHl();
    (active || []).forEach(function (id) { act[id] = true; });
    var groups = (def.groups || []).map(function (g) { return { label: g.label, g: g, items: [] }; });
    var rest = { label: 'Otras piezas', items: [] };
    def.nodes.forEach(function (n) {
      var home = groups.filter(function (x) {
        var g = x.g;
        return n.x >= g.x && n.x <= g.x + g.w && n.y >= g.y && n.y <= g.y + g.h;
      })[0];
      (home || rest).items.push(n);
    });
    var box = h('details', { class: 'sdm-pieces' });
    var sum = h('summary', { text: 'Qué hace cada pieza' });
    /* Si el lector la abrió o la cerró, esa elección se mantiene entre pasos y escenarios */
    sum.addEventListener('click', function () { self.piecesOpen = !box.open; });
    if (self.piecesOpen != null ? self.piecesOpen : open) box.open = true;
    box.appendChild(sum);
    groups.concat([rest]).forEach(function (grp) {
      if (!grp.items.length) return;
      box.appendChild(h('p', { class: 'sdm-pc-group', text: grp.label }));
      var ul = h('ul', { class: 'sdm-pc-list' });
      grp.items.forEach(function (n) {
        var L = LAYERS[n.layer] || LAYERS.service;
        var b = h('button', {
          type: 'button', class: 'sdm-pc-item' + (act[n.id] ? ' is-now' : ''), style: '--c: var(' + L.c + ')',
          'aria-label': n.label + '. ' + (n.brief || n.sub || '') + ' Abrir detalle.'
        }, [h('b', { text: n.label }), h('span', { text: n.brief || n.sub || L.name })]);
        b.addEventListener('click', function () { clearHl(); if (self.pause) self.pause(); self.select(n.id, true); });
        function hl() { self.nodes[n.id].el.classList.add('is-hl'); }
        function unhl() { self.nodes[n.id].el.classList.remove('is-hl'); }
        b.addEventListener('mouseenter', hl);
        b.addEventListener('mouseleave', unhl);
        b.addEventListener('focus', hl);
        b.addEventListener('blur', unhl);
        ul.appendChild(h('li', {}, [b]));
      });
      box.appendChild(ul);
    });
    return box;
  };

  MapView.prototype.select = function (id, focusPanel) {
    var self = this, n = this.nodes[id];
    if (!n) return;
    if (this.selected) this.nodes[this.selected].el.classList.remove('is-selected');
    this.selected = id;
    n.el.classList.add('is-selected');
    var d = n.def, info = d.info || {}, L = LAYERS[d.layer] || LAYERS.service;

    var inner = h('div', { class: 'sdm-panel-inner' });
    var close = h('button', { type: 'button', class: 'icon-btn sdm-close', 'aria-label': 'Cerrar detalle', text: '✕' });
    close.addEventListener('click', function () {
      n.el.classList.remove('is-selected'); self.selected = null; self.showDefaultPanel(); n.el.focus();
    });
    inner.appendChild(close);
    if (this.def.stepPanel && this.scen) {
      var back = h('button', { type: 'button', class: 'chip-btn sdm-back', text: '← Volver al escenario' });
      back.addEventListener('click', function () {
        n.el.classList.remove('is-selected'); self.selected = null; self.showDefaultPanel();
      });
      inner.appendChild(back);
    }
    inner.appendChild(h('p', { class: 'sdm-plabel', style: '--c: var(' + L.c + ')', text: L.name }));
    inner.appendChild(h('h3', { text: d.label }));
    if (d.sub) inner.appendChild(h('p', { class: 'muted', text: d.sub }));
    if (d.brief) inner.appendChild(h('p', { class: 'sdm-brief', text: d.brief }));

    var tablist = h('div', { class: 'sdm-tabs', role: 'tablist', 'aria-label': 'Detalle de ' + d.label });
    var body = h('div', { class: 'sdm-tabbody', role: 'tabpanel', tabindex: '0' });
    var btns = [];
    TABS.forEach(function (t, i) {
      var b = h('button', { type: 'button', class: 'sdm-tab', role: 'tab', id: self.id + '-tab-' + t[0], 'aria-selected': i === 0 ? 'true' : 'false', tabindex: i === 0 ? '0' : '-1', text: t[1] });
      b.addEventListener('click', function () { show(i); });
      b.addEventListener('keydown', function (e) {
        var j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
        if (j == null) return;
        e.preventDefault();
        j = (j + TABS.length) % TABS.length;
        show(j); btns[j].focus();
      });
      btns.push(b); tablist.appendChild(b);
    });
    function show(i) {
      btns.forEach(function (b, j) { b.setAttribute('aria-selected', i === j ? 'true' : 'false'); b.tabIndex = i === j ? 0 : -1; });
      body.setAttribute('aria-labelledby', btns[i].id);
      body.innerHTML = info[TABS[i][0]] || '<p class="muted">Este nodo no tiene detalle en esta pestaña.</p>';
      SD.highlight(body);
      if (SD.autolink) SD.autolink(body);
      self.lastTab = i;
    }
    inner.appendChild(tablist);
    inner.appendChild(body);
    show(this.lastTab || 0);
    this.panel.innerHTML = '';
    this.panel.appendChild(inner);
    this.panel.scrollTop = 0;
    if (focusPanel) btns[this.lastTab || 0].focus();
    this.ensureVisible([[d.x, d.y]]);
  };

  /* ---------- Deep link ---------- */

  MapView.prototype.params = function () {
    var out = {};
    (location.hash || '').replace(/^#/, '').split('&').forEach(function (kv) {
      var p = kv.split('=');
      if (p.length === 2) out[decodeURIComponent(p[0])] = decodeURIComponent(p[1]);
    });
    return out;
  };

  MapView.prototype.applyDeepLink = function () {
    var p = this.params();
    if (p.map && p.map !== this.def.id) return;
    if (p.node && this.nodes[p.node]) {
      this.host.scrollIntoView({ block: 'start' });
      this.select(p.node, false);
      var n = this.nodes[p.node].def;
      this.centerOnWorld(n.x, n.y);
    }
    if (p.scenario && this.openScenario) {
      this.host.scrollIntoView({ block: 'start' });
      this.openScenario(p.scenario, p.step != null ? parseInt(p.step, 10) - 1 : -1);
    }
  };

  SD.MapView = MapView;
  SD.reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  SD.ready(function () {
    document.querySelectorAll('[data-map]').forEach(function (el) {
      var id = el.getAttribute('data-map');
      var def = SD.data.maps[id];
      if (!def) { console.warn('[SD mapa] no existe el mapa', id); return; }
      def.id = id;
      el._map = new MapView(el, def);
    });
  });
})();
