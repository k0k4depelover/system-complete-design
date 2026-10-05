/* Slow start en el balanceador (M03).
   Tres instancias calientes reciben 300 rps con round robin ponderado. A los 5 s entra
   una cuarta, fría: su capacidad arranca en el 20 % y llega al 100 % en 40 s (JIT, cachés
   y pools de conexiones). Sin slow start recibe su parte completa desde el primer segundo;
   con slow start, el balanceador le sube el peso de forma lineal durante la ventana, con un
   mínimo del 10 %, como el slow_start_config de Envoy con aggression 1.
   Modelo de fluidos: la cola crece cuando el tráfico supera la capacidad; con 100 requests
   en cola, la instancia responde 503 a lo que no entra (su límite de concurrencia). */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;

  var LAMBDA = 300, MU = 120, JOIN = 5, WARM = 40, MAXQ = 100, END = 70, DT = 0.05;
  var PER_DOT = 20, TRAVEL = 0.8, REAL_MS = 350;
  var MODES = [
    { id: 0, label: 'Sin slow start' },
    { id: 30, label: 'Slow start de 30 s' },
    { id: 60, label: 'Slow start de 60 s' }
  ];

  function capNew(tau) { return MU * (0.2 + 0.8 * Math.min(1, Math.max(0, tau) / WARM)); }
  function weightNew(tau, win) { return win ? Math.max(0.1, Math.min(1, tau / win)) : 1; }

  /* Serie completa para una ventana de slow start: un punto cada DT. */
  function simulate(win) {
    var pts = [], q = [0, 0, 0, 0], err = 0, dots = [], acc = [0, 0, 0, 0], accF = 0;
    for (var k = 0; k * DT <= END + 1e-9; k++) {
      var t = k * DT, tau = t - JOIN, on = t >= JOIN;
      var w = on ? weightNew(tau, win) : 0;
      var tot = 3 + w, row = [];
      for (var i = 0; i < 4; i++) {
        var share = i < 3 ? 1 / tot : w / tot;
        var arr = LAMBDA * share, mu = i < 3 ? MU : (on ? capNew(tau) : 0);
        var rej = 0;
        if (i === 3 && !on) arr = 0;
        q[i] = Math.max(0, q[i] + (arr - mu) * DT);
        if (q[i] > MAXQ) { rej = (q[i] - MAXQ) / DT; q[i] = MAXQ; err += rej * DT; }
        var lat = mu ? 1000 * (0.02 * MU / mu + q[i] / mu) : 0;
        row.push({ share: share, arr: arr, mu: mu, q: q[i], rej: rej, lat: lat });
        acc[i] += arr * DT / PER_DOT;
        if (acc[i] >= 1) {
          acc[i] -= 1;
          var fail = false;
          if (i === 3 && rej > 0) { accF += rej / arr; if (accF >= 1) { accF -= 1; fail = true; } }
          dots.push({ i: i, t: t, fail: fail });
        }
      }
      pts.push({ t: t, w: w, inst: row, err: err });
    }
    return { pts: pts, dots: dots };
  }

  function phase(p, win) {
    var n = p.inst[3];
    if (p.t < JOIN) return 'Tres instancias calientes se reparten 300 rps: 100 cada una, el 83&#8239;% de lo que pueden atender. La instancia 4 está arrancando y todavía no pasa el readiness check.';
    if (!win) {
      if (n.rej > 0) return 'La cola de la instancia 4 llegó a su límite de concurrencia (100 requests): responde 503 a todo lo que no entra. Es la propia instancia la que se protege; el balanceador sigue mandándole el 25&#8239;%.';
      if (n.q > 1 && n.arr > n.mu) return 'Sin slow start, el balanceador le da su parte completa (75 rps) desde el primer segundo, pero fría solo atiende ' + Math.round(n.mu) + ' rps: la cola crece y la latencia se dispara.';
      if (n.q > 1) return 'Ya atiende más de lo que recibe y empieza a vaciar la cola, pero cada request de esa cola esperó segundos.';
      if (p.t < JOIN + 3) return 'Entra la instancia 4: pasó el readiness check y el balanceador la agrega con el mismo peso que las otras.';
      return 'La instancia 4 ya está caliente y la latencia volvió a la normal. El costo: los 503 y los segundos de espera del arranque.';
    }
    if (p.w < 1) return 'Con slow start, el balanceador le asigna un peso del ' + Math.round(p.w * 100) + '&#8239;% y lo sube en línea recta durante ' + win + ' s. Recibe ' + Math.round(n.arr) + ' rps y puede atender ' + Math.round(n.mu) + ': nunca se le forma cola.';
    return 'Terminó la ventana: la instancia 4 recibe su parte completa y ya está caliente. Sin errores y sin picos de latencia.';
  }

  function init(host) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var win = 0, data = simulate(0), now = 0, playing = false, speed = 1, last = 0, raf = 0;

    var scene = h('div', { class: 'sim-scroll ss-scroll' });
    var chart = h('div', { class: 'sim-scroll ss-scroll' });
    var clock = h('span', { class: 'hv-clock' });
    var stats = h('div', { class: 'sim-stats' });
    var note = h('p', { class: 'sim-note ss-note', 'aria-live': 'polite' });
    var play = h('button', { type: 'button', class: 'btn btn--primary' });
    var spd = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'false', text: 'Más rápido' });
    var reset = h('button', { type: 'button', class: 'btn', text: 'Reiniciar' });
    var modeBtns = MODES.map(function (m) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': m.id === win ? 'true' : 'false', text: m.label });
      b.addEventListener('click', function () {
        win = m.id; data = simulate(win); now = 0;
        modeBtns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        if (reduce) { now = END; setPlay(false); } else setPlay(true);
        draw();
      });
      return b;
    });

    function at(t) { return data.pts[Math.min(data.pts.length - 1, Math.max(0, Math.round(t / DT)))]; }
    function f0(v) { return SD.fmt.num(Math.round(v)); }

    var LBX = 170, LBY = 152, IX = 430, RH = 70;
    function rowY(i) { return 14 + i * RH; }

    function drawScene(p) {
      var s = '<svg viewBox="0 0 770 300" role="img" aria-label="Balanceador y cuatro instancias; la cuarta es nueva">';
      s += '<rect class="dg-layer" style="--c: var(--l-edge)" x="20" y="110" width="150" height="84" rx="8"/>';
      s += '<text class="dg-label" x="95" y="138" text-anchor="middle">Balanceador</text>';
      s += '<text class="dg-tiny" x="95" y="156" text-anchor="middle">round robin ponderado</text>';
      s += '<text class="dg-tiny" x="95" y="176" text-anchor="middle">300 rps de entrada</text>';
      for (var i = 0; i < 4; i++) {
        var y = rowY(i), r = p.inst[i], off = i === 3 && p.t < JOIN;
        s += '<path class="dg-edge" d="M' + LBX + ' ' + LBY + ' L' + IX + ' ' + (y + 30) + '" style="opacity:' + (off ? 0.15 : 0.35) + '"/>';
        var cls = i === 3 ? (r.rej > 0 ? 'dg-bad' : 'dg-box--em dg-box') : 'dg-box';
        s += '<g' + (off ? ' opacity="0.45"' : '') + '><rect class="' + cls + '" x="' + IX + '" y="' + y + '" width="330" height="60" rx="8"/>';
        var name = 'Instancia ' + (i + 1) + (i < 3 ? ' · caliente' : off ? ' · arrancando' : ' · nueva, al ' + Math.round(r.mu / MU * 100) + ' % de su capacidad');
        s += '<text class="dg-label" x="' + (IX + 12) + '" y="' + (y + 19) + '" style="font-size:13px">' + name + '</text>';
        var bw = 150, bx = IX + 82;
        s += '<text class="dg-tiny" x="' + (IX + 12) + '" y="' + (y + 37) + '">recibe</text>';
        s += '<rect class="ss-bar" x="' + bx + '" y="' + (y + 29) + '" width="' + bw + '" height="9" rx="4"/>';
        s += '<rect class="ss-bar-t" x="' + bx + '" y="' + (y + 29) + '" width="' + (bw * Math.min(1, r.arr / MU)).toFixed(1) + '" height="9" rx="4"/>';
        s += '<text class="dg-tiny" x="' + (bx + bw + 8) + '" y="' + (y + 37) + '">' + f0(r.arr) + ' rps</text>';
        s += '<text class="dg-tiny" x="' + (IX + 12) + '" y="' + (y + 52) + '">puede</text>';
        s += '<rect class="ss-bar" x="' + bx + '" y="' + (y + 44) + '" width="' + bw + '" height="9" rx="4"/>';
        s += '<rect class="ss-bar-c" x="' + bx + '" y="' + (y + 44) + '" width="' + (bw * r.mu / MU).toFixed(1) + '" height="9" rx="4"/>';
        s += '<text class="dg-tiny" x="' + (bx + bw + 8) + '" y="' + (y + 52) + '">' + f0(r.mu) + ' rps</text>';
        s += '<text class="dg-tiny" x="750" y="' + (y + 37) + '" text-anchor="end">cola ' + f0(r.q) + '</text>';
        s += '<text class="dg-tiny dg-in" x="750" y="' + (y + 52) + '" text-anchor="end">' + (off ? '—' : f0(r.lat) + ' ms') + '</text></g>';
        if (i === 3 && r.rej > 0) s += '<text class="dg-small dg-fail-text" x="' + (IX - 10) + '" y="' + (y + 56) + '" text-anchor="end" style="font-weight:600">503</text>';
      }
      if (p.t >= JOIN) {
        s += '<text class="dg-tiny" x="' + (LBX + 14) + '" y="' + (rowY(3) + 62) + '">peso de la instancia 4: ' + Math.round(p.w * 100) + ' %</text>';
      }
      data.dots.forEach(function (d) {
        var f = (p.t - d.t) / TRAVEL;
        if (f < 0 || f > 1) return;
        var x = LBX + (IX - LBX) * f, y = LBY + (rowY(d.i) + 30 - LBY) * f;
        s += '<circle class="' + (d.fail ? 'ss-dot ss-dot--fail' : 'ss-dot') + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.5"/>';
      });
      scene.innerHTML = s + '</svg>';
    }

    function drawChart(p) {
      var W = 770, H = 196, pw = 350, ph = 120, top = 30;
      var panels = [{ x: 40, title: 'Instancia 4: lo que recibe y lo que puede (rps)', max: 120, ticks: [0, 40, 80, 120] },
                    { x: 420, title: 'Instancia 4: latencia (ms)', max: 4000, ticks: [0, 1000, 2000, 3000, 4000] }];
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tráfico, capacidad y latencia de la instancia 4 en el tiempo">';
      function X(px, t) { return px + t / END * pw; }
      panels.forEach(function (pn, k) {
        function Y(v) { return top + ph - Math.min(1, v / pn.max) * ph; }
        s += '<text class="sim-label" x="' + pn.x + '" y="16">' + pn.title + '</text>';
        pn.ticks.forEach(function (v) {
          s += '<path class="sim-grid" d="M' + pn.x + ' ' + Y(v).toFixed(1) + ' H' + (pn.x + pw) + '"/>';
          s += '<text class="sim-axis" x="' + (pn.x - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + SD.fmt.num(v) + '</text>';
        });
        [0, 10, 20, 30, 40, 50, 60, 70].forEach(function (v) {
          s += '<text class="sim-axis" x="' + X(pn.x, v).toFixed(1) + '" y="' + (top + ph + 16) + '" text-anchor="middle">' + v + ' s</text>';
        });
        s += '<path class="dg-feedback" d="M' + X(pn.x, JOIN).toFixed(1) + ' ' + top + ' V' + (top + ph) + '"/>';
        var upto = data.pts.filter(function (q) { return q.t <= p.t && q.t >= JOIN; });
        function path(get) {
          return upto.map(function (q, j) { return (j ? 'L' : 'M') + X(pn.x, q.t).toFixed(1) + ' ' + Y(get(q)).toFixed(1); }).join(' ');
        }
        if (upto.length > 1) {
          if (k === 0) {
            s += '<path class="ss-line ss-cap" d="' + path(function (q) { return q.inst[3].mu; }) + '"/>';
            s += '<path class="ss-line ss-traffic" d="' + path(function (q) { return q.inst[3].arr; }) + '"/>';
          } else {
            s += '<path class="ss-line ss-lat" d="' + path(function (q) { return q.inst[3].lat; }) + '"/>';
            upto.forEach(function (q, j) {
              if (q.inst[3].rej > 0 && j % 10 === 0) s += '<circle class="dg-bad" cx="' + X(pn.x, q.t).toFixed(1) + '" cy="' + (top + ph - 4) + '" r="3"/>';
            });
          }
        }
        s += '<path class="sim-grid" d="M' + X(pn.x, p.t).toFixed(1) + ' ' + top + ' V' + (top + ph) + '" style="stroke:var(--label-3)"/>';
      });
      var ly = H - 10;
      s += '<path class="ss-line ss-traffic" d="M40 ' + (ly - 4) + ' h22"/><text class="sim-axis" x="68" y="' + ly + '">recibe</text>';
      s += '<path class="ss-line ss-cap" d="M124 ' + (ly - 4) + ' h22"/><text class="sim-axis" x="152" y="' + ly + '">puede atender</text>';
      s += '<path class="ss-line ss-lat" d="M420 ' + (ly - 4) + ' h22"/><text class="sim-axis" x="448" y="' + ly + '">latencia</text>';
      s += '<circle class="dg-bad" cx="520" cy="' + (ly - 4) + '" r="3"/><text class="sim-axis" x="528" y="' + ly + '">responde 503</text>';
      s += '<text class="sim-axis" x="' + (X(40, JOIN) + 4).toFixed(1) + '" y="' + (top + 10) + '">entra</text>';
      chart.innerHTML = s + '</svg>';
    }

    var lastNote = '';
    function draw() {
      var p = at(now), n = p.inst[3];
      drawScene(p);
      drawChart(p);
      clock.textContent = 't = ' + now.toFixed(1) + ' s';
      var peak = 0, errs = p.err;
      data.pts.forEach(function (q) { if (q.t <= now && q.inst[3].lat > peak) peak = q.inst[3].lat; });
      stats.innerHTML = '';
      [['Peso de la instancia 4', p.t < JOIN ? '—' : Math.round(p.w * 100) + ' %'],
       ['Recibe / puede atender', p.t < JOIN ? '—' : f0(n.arr) + ' / ' + f0(n.mu) + ' rps'],
       ['Latencia máxima de la 4', p.t < JOIN ? '—' : f0(peak) + ' ms'],
       ['Requests con 503', f0(errs)]].forEach(function (r) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: r[0] }), h('b', { text: r[1] })]));
      });
      var txt = phase(p, win);
      if (txt !== lastNote) { note.innerHTML = txt; lastNote = txt; }
    }

    function setPlay(v) {
      playing = v;
      play.textContent = v ? 'Pausa' : (now >= END ? 'Repetir' : 'Reproducir');
      cancelAnimationFrame(raf);
      if (v) { last = 0; raf = requestAnimationFrame(tick); }
    }
    function tick(ts) {
      if (!playing) return;
      if (last) now = Math.min(END, now + (ts - last) / REAL_MS * speed);
      last = ts;
      draw();
      if (now >= END) { setPlay(false); return; }
      raf = requestAnimationFrame(tick);
    }
    play.addEventListener('click', function () {
      if (!playing && now >= END) now = 0;
      setPlay(!playing);
    });
    spd.addEventListener('click', function () {
      speed = speed === 1 ? 4 : 1;
      spd.setAttribute('aria-pressed', speed > 1 ? 'true' : 'false');
    });
    reset.addEventListener('click', function () { now = 0; setPlay(false); draw(); });

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Una instancia nueva entra a la flota' }), clock]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'btn-row', role: 'group', 'aria-label': 'Configuración del balanceador' }, modeBtns),
      h('div', { class: 'btn-row ss-play' }, [play, spd, reset]),
      scene, note, chart, stats
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Modelo simplificado: 300 rps constantes; cada instancia caliente atiende 120 rps; la nueva arranca al 20 % y se calienta en 40 s; 100 requests en cola como límite de concurrencia. Con slow start, el peso sube en línea recta desde un mínimo del 10 %. Cada punto que viaja representa 20 requests.' }));
    if (reduce) now = END;
    draw();
    setPlay(false);
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { io.disconnect(); setPlay(true); }
      }, { threshold: 0.4 });
      io.observe(host);
    }
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="slowstart"]').forEach(init);
  });
})();
