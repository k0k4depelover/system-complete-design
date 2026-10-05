/* Widget del M01 (HTTP/1.1, HTTP/2 y HTTP/3):
   <div data-sim="httpver">  tres conexiones lado a lado que piden los mismos tres recursos (A, B y C),
                             con el handshake de cada una, la multiplexación y una pérdida de paquete opcional.
   Modelo: RTT de 60 ms (30 ms por sentido), cada recurso son 3 paquetes y el servidor manda uno cada 8 ms.
   TCP entrega en orden toda la conexión; QUIC entrega en orden solo dentro de cada stream. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;
  var OW = 30, RTT = 60, GAP = 8;
  var RES = ['A', 'B', 'C'];
  var CLS = { A: 'hv-a', B: 'hv-b', C: 'hv-c' };

  var LANES = [
    { id: 'h1', name: 'HTTP/1.1', sub: 'TCP + TLS 1.3, una request a la vez', tcp: true },
    { id: 'h2', name: 'HTTP/2', sub: 'TCP + TLS 1.3, streams multiplexados', tcp: true },
    { id: 'h3', name: 'HTTP/3', sub: 'QUIC sobre UDP, TLS 1.3 integrado', tcp: false }
  ];

  /* Arma la lista de paquetes de una conexión. Cada paquete: quién lo envía (dir 'cs' o 'sc'),
     cuándo sale, cuándo llega, a qué recurso pertenece y si se pierde. */
  function build(lane, loss, zero) {
    var pk = [];
    function push(o) { o.arrive = o.send + OW; pk.push(o); return o; }
    var tReq;
    if (lane.tcp) {
      push({ dir: 'cs', send: 0, label: 'SYN', note: 'Handshake TCP: el cliente pide abrir la conexión. Nada de HTTP puede salir todavía.' });
      push({ dir: 'sc', send: 30, label: 'SYN-ACK', note: 'El servidor acepta. Ya pasó 1 RTT solo para tener una conexión TCP.' });
      push({ dir: 'cs', send: 60, label: 'ACK + ClientHello', note: 'Handshake TLS 1.3, encima de TCP: el cliente propone cifrado y manda su clave.' });
      push({ dir: 'sc', send: 90, label: 'ServerHello + cert', note: 'El servidor responde con su certificado. Segundo RTT antes de la primera request.' });
      tReq = 120;
    } else if (zero) {
      push({ dir: 'cs', send: 0, label: 'ClientHello + GET (0-RTT)', note: 'Reconexión: QUIC reusa la clave de la visita anterior y la request viaja cifrada en el primer paquete (0-RTT).', req: true });
      push({ dir: 'sc', send: 30, label: 'ServerHello', note: 'El servidor completa el handshake y empieza a responder en el mismo vuelo.' });
      tReq = 0;
    } else {
      push({ dir: 'cs', send: 0, label: 'Initial: ClientHello', note: 'El primer paquete QUIC ya lleva el ClientHello de TLS 1.3: transporte y cifrado se negocian juntos.' });
      push({ dir: 'sc', send: 30, label: 'ServerHello + cert', note: 'El servidor responde con su certificado. Con 1 RTT, la conexión ya está cifrada y lista.' });
      tReq = 60;
    }
    function respond(r, i, t) {
      var p = push({ dir: 'sc', send: t, label: r + i, res: r, idx: i, note: lane.id === 'h1' ? 'Llega la respuesta de ' + r + '. La conexión está ocupada hasta que termine.' : 'Las respuestas llegan intercaladas: un frame de cada stream por turno.' });
      if (loss && r === 'A' && i === 2) {
        p.lost = true; p.note = 'Se pierde el paquete A2 en la red.';
        push({ dir: 'sc', send: t + RTT, label: 'A2 (reenvío)', res: 'A', idx: 2, retx: true, note: 'El servidor reenvía A2 cuando nota la pérdida, un RTT después.' });
      }
    }
    if (lane.id === 'h1') {
      var t = tReq;
      RES.forEach(function (r) {
        push({ dir: 'cs', send: t, label: 'GET ' + r, req: true, note: r === 'A' ? 'Primera request. HTTP/1.1 no puede mandar B hasta que termine A.' : 'Recién ahora sale ' + r + ': cada request espera a la anterior.' });
        for (var i = 1; i <= 3; i++) respond(r, i, t + OW + (i - 1) * GAP);
        deliver(pk, lane);
        t = Math.max.apply(null, pk.filter(function (p) { return p.res === r && !p.lost; }).map(function (p) { return p.deliver; }));
      });
    } else {
      if (!zero || lane.tcp) push({ dir: 'cs', send: tReq, label: 'GET A, B, C', req: true, note: lane.id === 'h2' ? 'Las tres requests salen juntas, cada una en su stream, por la misma conexión TCP.' : 'Las tres requests salen juntas, cada una en su stream QUIC.' });
      var k = 0;
      for (var i = 1; i <= 3; i++) RES.forEach(function (r) { respond(r, i, tReq + OW + (k++) * GAP); });
    }
    deliver(pk, lane);
    pk.sort(function (a, b) { return a.send - b.send; });
    return pk;
  }

  /* Momento en que cada paquete de respuesta llega a la aplicación. */
  function deliver(pk, lane) {
    var data = pk.filter(function (p) { return p.res && !p.lost; });
    var order = pk.filter(function (p) { return p.res && !p.retx; }).sort(function (a, b) { return a.send - b.send; });
    order.forEach(function (p) {
      var real = p.lost ? data.filter(function (q) { return q.retx && q.res === p.res && q.idx === p.idx; })[0] : p;
      var prev = order.slice(0, order.indexOf(p)).filter(function (q) { return lane.tcp || q.res === p.res; });
      var gate = prev.reduce(function (m, q) { return Math.max(m, q._d || 0); }, 0);
      p._d = Math.max(real.arrive, gate);
      real.deliver = p._d;
    });
  }

  function doneTimes(pk) {
    var o = {};
    RES.forEach(function (r) {
      o[r] = Math.max.apply(null, pk.filter(function (p) { return p.res === r && !p.lost; }).map(function (p) { return p.deliver; }));
    });
    o.all = Math.max(o.A, o.B, o.C);
    return o;
  }

  function init(host) {
    var loss = false, zero = false, playing = false, now = 0, speed = 1, last = 0, raf = 0;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var uid = 'hv' + Math.random().toString(36).slice(2, 7);
    var data;
    function rebuild() {
      data = LANES.map(function (l) { var pk = build(l, loss, zero); return { lane: l, pk: pk, done: doneTimes(pk) }; });
    }
    var END = function () { return Math.max.apply(null, data.map(function (d) { return d.done.all; })) + 30; };

    var svgBox = h('div', { class: 'sim-scroll hv-scroll' });
    var clock = h('span', { class: 'hv-clock' });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });
    var play = h('button', { type: 'button', class: 'btn btn--primary' });
    var spd = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'false', text: 'Más rápido' });
    var lossBtn = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'false', text: 'Perder un paquete de A' });
    var zeroBtn = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'false', text: 'HTTP/3: reconexión 0-RTT' });
    var reset = h('button', { type: 'button', class: 'btn', text: 'Reiniciar' });

    var W = 720, LH = 132;
    function x(dir, frac) { var a = 336, b = 616; return dir === 'cs' ? a + (b - a) * frac : b - (b - a) * frac; }
    function pill(px, py, label, cls, op) {
      var w = Math.max(30, label.length * 6.2 + 14);
      return '<g' + (op < 1 ? ' opacity="' + op.toFixed(2) + '"' : '') + '><rect class="' + cls + '" x="' + (px - w / 2).toFixed(1) + '" y="' + (py - 10) + '" width="' + w.toFixed(1) + '" height="20" rx="10"/>' +
        '<text class="dg-tiny dg-in" x="' + px.toFixed(1) + '" y="' + (py + 4) + '" text-anchor="middle">' + SD.escape(label) + '</text></g>';
    }

    function draw() {
      var s = '<svg viewBox="0 0 ' + W + ' ' + (LH * 3 + 6) + '" role="img" aria-label="Animación de tres conexiones: HTTP/1.1, HTTP/2 y HTTP/3, en el instante ' + Math.round(now) + ' ms">';
      s += '<defs>' + data.map(function (d, i) { return '<clipPath id="' + uid + i + '"><rect x="334" y="' + (i * LH) + '" width="284" height="' + LH + '"/></clipPath>'; }).join('') + '</defs>';
      data.forEach(function (d, li) {
        var y0 = li * LH, l = d.lane, yc = y0 + 58;
        if (li) s += '<path class="dg-frame" d="M0 ' + (y0 + 2) + ' H' + W + '"/>';
        s += '<text class="dg-label" x="4" y="' + (y0 + 26) + '">' + l.name + '</text>';
        s += '<text class="dg-tiny" x="4" y="' + (y0 + 42) + '">' + l.sub.split(', ')[0] + ',</text>';
        s += '<text class="dg-tiny" x="4" y="' + (y0 + 56) + '">' + l.sub.split(', ')[1] + '</text>';
        // barras de lo entregado a la aplicación
        var held = [];
        RES.forEach(function (r, ri) {
          var by = y0 + 18 + ri * 24;
          s += '<text class="dg-tiny" x="150" y="' + (by + 13) + '" text-anchor="end">' + r + '</text>';
          for (var i = 1; i <= 3; i++) {
            var p = d.pk.filter(function (q) { return q.res === r && q.idx === i && !q.lost; })[0];
            var cls = 'dg-box', bx = 156 + (i - 1) * 24;
            if (p.deliver <= now) cls = CLS[r];
            else if (p.arrive <= now) { cls = 'dg-warnbox'; held.push(r + i); }
            s += '<rect class="' + cls + '" x="' + bx + '" y="' + by + '" width="20" height="18" rx="3"/>';
          }
          var dt = d.done[r];
          if (dt <= now) s += '<text class="dg-num" x="232" y="' + (by + 13) + '">' + Math.round(dt) + ' ms</text>';
        });
        // cliente, cable y servidor
        s += '<rect class="dg-box" x="280" y="' + (yc - 22) + '" width="54" height="44" rx="8"/><text class="dg-tiny" x="307" y="' + (yc + 4) + '" text-anchor="middle">Cliente</text>';
        s += '<rect class="dg-box" x="618" y="' + (yc - 22) + '" width="62" height="44" rx="8"/><text class="dg-tiny" x="649" y="' + (yc + 4) + '" text-anchor="middle">Servidor</text>';
        s += '<path class="dg-edge" d="M334 ' + (yc - 12) + ' H618 M334 ' + (yc + 12) + ' H618" style="opacity:.35"/>';
        s += '<text class="dg-tiny" x="476" y="' + (y0 + 20) + '" text-anchor="middle">' + (l.tcp ? '1 conexión TCP' : '1 conexión QUIC (UDP)') + '</text>';
        // paquetes en vuelo
        s += '<g clip-path="url(#' + uid + li + ')">';
        d.pk.forEach(function (p) {
          if (now < p.send) return;
          var py = p.dir === 'cs' ? yc - 12 : yc + 12;
          var cls = p.res ? (p.lost ? 'hb-lost' : CLS[p.res]) : 'dg-box--em dg-box';
          if (p.lost) {
            var f = (now - p.send) / OW;
            if (f > 0.75) return;
            var op = f < 0.5 ? 1 : 1 - (f - 0.5) / 0.25;
            s += pill(x(p.dir, Math.min(f, 0.5)), py, f >= 0.5 ? p.label + ' ✕' : p.label, cls, op);
            return;
          }
          if (now > p.arrive) return;
          s += pill(x(p.dir, (now - p.send) / OW), py, p.label, cls, 1);
        });
        s += '</g>';
        // nota de la fase
        var cur = null;
        d.pk.forEach(function (p) { if (p.send <= now) cur = p; });
        var msg = cur ? cur.note : 'Esperando para empezar.';
        var cls2 = 'dg-tiny';
        if (held.length) {
          msg = l.tcp ? 'TCP retiene ' + held.join(', ') + ': ya llegaron, pero falta A2 y TCP entrega en orden.' : 'QUIC retiene solo ' + held.join(', ') + ': los otros streams siguen.';
          cls2 = 'dg-tiny dg-fail-text';
        } else if (d.done.all <= now) {
          msg = 'Los tres recursos listos a los ' + Math.round(d.done.all) + ' ms.';
        }
        s += '<text class="' + cls2 + '" x="280" y="' + (y0 + 108) + '">' + SD.escape(msg) + '</text>';
      });
      s += '</svg>';
      svgBox.innerHTML = s;
      clock.textContent = 't = ' + Math.round(now) + ' ms';
    }
    function summary() {
      stats.innerHTML = '';
      data.forEach(function (d) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: d.lane.name + ': todo listo' }), h('b', { text: Math.round(d.done.all) + ' ms' })]));
      });
    }
    function setPlay(v) {
      playing = v;
      play.textContent = v ? 'Pausa' : (now >= END() ? 'Repetir' : 'Reproducir');
      if (v) { last = performance.now(); raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf);
    }
    function tick(ts) {
      var dt = Math.min(100, ts - last); last = ts;
      now += dt * (speed / 40);  // lento: 1 ms simulado = 40 ms reales
      if (now >= END()) { now = END(); draw(); setPlay(false); return; }
      draw();
      raf = requestAnimationFrame(tick);
    }
    play.addEventListener('click', function () {
      if (!playing && now >= END()) now = 0;
      setPlay(!playing);
    });
    spd.addEventListener('click', function () {
      speed = speed === 1 ? 4 : 1;
      spd.setAttribute('aria-pressed', speed > 1 ? 'true' : 'false');
    });
    function toggle(btn, set) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', v ? 'true' : 'false');
        set(v); rebuild(); summary();
        now = 0; draw(); if (!reduce) setPlay(true); else setPlay(false);
      });
    }
    toggle(lossBtn, function (v) { loss = v; });
    toggle(zeroBtn, function (v) { zero = v; });
    reset.addEventListener('click', function () { now = 0; draw(); setPlay(false); });

    rebuild();
    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'HTTP/1.1, HTTP/2 y HTTP/3 piden lo mismo' }), clock]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'btn-row' }, [play, spd, lossBtn, zeroBtn, reset]),
      svgBox, stats
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Los tres clientes piden los mismos recursos A, B y C (3 paquetes cada uno) a un servidor a 30 ms. Las celdas a la izquierda son lo que la aplicación ya recibió: llenas si se entregaron, amarillas si llegaron pero el transporte las retiene. Modelo simplificado: RTT fijo de 60 ms, un paquete cada 8 ms y el reenvío de una pérdida un RTT después.' }));
    if (reduce) now = END();
    draw(); summary(); setPlay(false);
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { io.disconnect(); setPlay(true); }
      }, { threshold: 0.5 });
      io.observe(host);
    }
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="httpver"]').forEach(init);
  });
})();
