/* Simulador de cache stampede: <div data-sim="stampede"></div>
   Una clave caliente vence en t = 1000 ms. Se simula milisegundo a milisegundo cuántas consultas
   llegan a la base según la estrategia, con una base que se vuelve más lenta cuanto más concurrencia tiene.
   La escena se reproduce en cámara lenta: 20 instancias, el estado de la clave y la base con sus consultas en curso.
   La explicación de cada estrategia vive en la misma tarjeta, junto a los botones. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  var INST = 20, T = 3000, EXP = 1000, FROM = 700, TO = 2400, FRAME = 10;
  var SLOW = 10;                       /* milisegundos reales por milisegundo simulado, a velocidad 1× */

  var STRATS = [
    { id: 'none', name: 'Sin protección',
      how: 'Cada request que encuentra la clave vencida va a la base por su cuenta. Nadie coordina nada.',
      why: function (o) { return 'No baja nada. Mientras la consulta tarda ' + F.num(o.base) + '&#8239;ms llegan unas ' + F.num(o.rps * o.base / 1000) + ' requests, y cada una lanza su propia consulta idéntica.'; },
      pay: 'Si la base se vuelve más lenta con más consultas en paralelo, la ventana se alarga, llegan más requests y el ciclo se realimenta.' },
    { id: 'sf', name: 'Single-flight',
      how: 'Dentro de cada instancia, la primera request que encuentra la clave vencida lanza la consulta; las demás de esa instancia no consultan: se cuelgan de esa misma consulta y reciben su resultado.',
      why: function () { return 'Pasa de una consulta por request a una por instancia: con 20 instancias, 20 consultas como mucho, sin importar cuánto tráfico llegue.'; },
      pay: 'Los usuarios igual esperan la consulta, y con cientos de instancias vuelven a ser cientos de consultas.' },
    { id: 'lease', name: 'Lease',
      how: 'La primera request que encuentra la clave vencida obtiene un lease en la caché compartida (en Redis, <code>SET lease:prod:1 &lt;token&gt; NX PX 2000</code>). Las demás no lo obtienen: esperan unos milisegundos y vuelven a leer la caché.',
      why: function () { return 'Una sola consulta en todo el sistema, aunque haya mil instancias: el lease es único para la clave, no para la instancia.'; },
      pay: 'Todos esperan el recálculo completo, y si el dueño del lease se cae, esperan hasta que el lease venza (4.4).' },
    { id: 'swr', name: 'Servir lo viejo (SWR)',
      how: 'La clave tiene dos vencimientos: el lógico (por ejemplo, 60 s) y el real, más largo (por ejemplo, 120 s). Pasado el lógico, quien la lee recibe el valor viejo de inmediato, y una sola request, con un lease, la recalcula en segundo plano.',
      why: function () { return 'Una sola consulta y nadie espera: la estampida desaparece del todo, porque la clave nunca queda vacía.'; },
      pay: 'Durante el recálculo sirves un valor viejo. Sirve para un catálogo o un feed; no para un saldo.' },
    { id: 'xfetch', name: 'Expiración anticipada',
      how: 'Antes de vencer, cada lectura decide al azar si recalcula, con una probabilidad que sube a medida que se acerca el vencimiento y con lo que cuesta recalcular: recalcula si <code>ahora + costo × β × (−ln azar) ≥ vencimiento</code>. Es el algoritmo XFetch.',
      why: function () { return 'Con mucho tráfico, alguna request renueva la clave un poco antes de que venza, sin coordinarse con nadie: la clave nunca llega a estar vacía.'; },
      pay: 'Con poco tráfico la clave puede vencer igual, y siempre se recalcula un poco antes de lo necesario.' }
  ];

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* rps: lecturas/s de la clave; inst: instancias; base: ms de la consulta sin carga */
  function simulate(o) {
    var rand = rng(11), bucket = 50, inst = o.inst || INST;
    var perMs = o.rps / 1000, base = o.base;
    var valid = true, expAt = EXP, refilledAt = -1, early = false;
    var active = [];                                /* consultas en curso: { rem, done, inst } */
    var instBusy = new Array(inst).fill(null);      /* single-flight: consulta en curso de cada instancia */
    var lease = null, xfetchDone = false;
    var waiting = [];                               /* { t, inst }: usuarios que esperan el valor */
    var started = new Array(Math.ceil(T / bucket)).fill(0);
    var totalQ = 0, maxConc = 0, lat = [], carry = 0, frames = [];

    function startQuery(t, i) {
      var q = { rem: base, done: false, inst: i };
      active.push(q); totalQ++;
      started[Math.floor(t / bucket)]++;
      return q;
    }
    function busy(q) { return q && !q.done; }

    for (var t = 0; t < T; t++) {
      /* la base reparte su capacidad entre las consultas activas: con más concurrencia, todas avanzan más lento */
      var finished = false, rate = 1 / (1 + active.length / 40);
      for (var i = active.length - 1; i >= 0; i--) {
        active[i].rem -= rate;
        if (active[i].rem <= 0) { active[i].done = true; active.splice(i, 1); finished = true; }
      }
      if (finished) {
        /* el primer resultado repone la clave; los que esperaban reciben el valor */
        if (!valid || o.strat === 'xfetch') { if (!valid || early) refilledAt = t; valid = true; expAt = t + 30000; early = false; }
        waiting.forEach(function (a) { lat.push(t - a.t); });
        waiting = [];
      }
      maxConc = Math.max(maxConc, active.length);
      if (valid && t >= expAt) valid = false;

      carry += perMs;
      var n = Math.floor(carry); carry -= n;
      for (var k = 0; k < n; k++) {
        var who = Math.floor(rand() * inst);
        if (o.strat === 'xfetch' && !xfetchDone && valid && t + base * -Math.log(1 - rand()) >= expAt) {
          /* XFetch: cada lectura cercana al vencimiento tiene una probabilidad creciente de recalcular antes */
          startQuery(t, who); xfetchDone = true; early = true;
        }
        if (valid) { lat.push(0.3); continue; }
        switch (o.strat) {
          case 'none': startQuery(t, who); waiting.push({ t: t, inst: who }); break;
          case 'sf': if (!busy(instBusy[who])) instBusy[who] = startQuery(t, who); waiting.push({ t: t, inst: who }); break;
          case 'lease': case 'xfetch': if (!busy(lease)) lease = startQuery(t, who); waiting.push({ t: t, inst: who }); break;
          case 'swr': if (!busy(lease)) lease = startQuery(t, who); lat.push(0.3); break;
        }
      }

      if (t >= FROM && t <= TO && t % FRAME === 0) {
        var iq = new Array(inst).fill(0), iw = new Array(inst).fill(0);
        active.forEach(function (q) { iq[q.inst]++; });
        waiting.forEach(function (w) { iw[w.inst]++; });
        frames.push({ t: t, valid: valid, early: early, refilled: refilledAt, active: active.length, waiting: waiting.length,
          lat: base * (1 + active.length / 40), q: totalQ, iq: iq, iw: iw });
      }
    }
    /* quienes siguen esperando al final: su espera es al menos hasta el final de la simulación */
    var stuck = waiting.length;
    waiting.forEach(function (w) { lat.push(T - w.t); });
    lat.sort(function (a, b) { return a - b; });
    return { stuck: stuck, started: started, bucket: bucket, totalQ: totalQ, maxConc: maxConc, frames: frames,
      p99: lat[Math.floor(lat.length * 0.99)] || 0, maxLat: lat[lat.length - 1] || 0 };
  }

  function init(host) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var SPEEDS = [1, 3, 0], LABELS = ['Lento', 'Rápido', 'En pausa'];
    var sp = reduce ? 2 : 0, visible = false, raf = 0, last = 0, now = reduce ? TO : FROM, hold = 0;
    var strat = STRATS[0], r = null;

    var rps = h('select', { 'aria-label': 'Lecturas por segundo de la clave' }, [
      h('option', { value: '2000', text: '2 000 lecturas/s' }),
      h('option', { value: '10000', selected: true, text: '10 000 lecturas/s' }),
      h('option', { value: '40000', text: '40 000 lecturas/s' })
    ]);
    var base = h('select', { 'aria-label': 'Costo de recalcular' }, [
      h('option', { value: '20', text: 'Recalcular cuesta 20 ms' }),
      h('option', { value: '100', selected: true, text: 'Recalcular cuesta 100 ms' }),
      h('option', { value: '400', text: 'Recalcular cuesta 400 ms' })
    ]);
    var clock = h('span', { class: 'hv-clock' });
    var info = h('div', { class: 'st-info' });
    var verdict = h('p', { class: 'st-verdict', 'aria-live': 'polite' });
    var scene = h('div', { class: 'sim-scroll st-scroll' });
    var chart = h('div', { class: 'sim-scroll st-scroll' });
    var stats = h('div', { class: 'sim-stats' });
    var ctrl = h('button', { type: 'button', class: 'btn btn--primary cp-ctrl' });
    var chips = STRATS.map(function (s) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': s === strat ? 'true' : 'false', text: s.name });
      b.addEventListener('click', function () {
        strat = s;
        chips.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        run(true);
      });
      return b;
    });

    function opts() { return { strat: strat.id, rps: +rps.value, base: +base.value, inst: INST }; }

    function run(restart) {
      var o = opts();
      r = simulate(o);
      info.innerHTML = '<p class="st-name">' + SD.escape(strat.name) + '</p><dl class="cp-rows">' +
        '<dt>Cómo funciona</dt><dd>' + strat.how + '</dd>' +
        '<dt>Por qué baja la carga</dt><dd>' + strat.why(o) + '</dd>' +
        '<dt>Qué pagas</dt><dd>' + strat.pay + '</dd></dl>';
      var v = 'En esta corrida: <b>' + F.num(r.totalQ) + (r.totalQ === 1 ? ' consulta' : ' consultas') + '</b> a la base por una sola clave que venció, con hasta ' +
        F.num(r.maxConc) + ' a la vez. Espera p99 de los usuarios: ' + F.num(r.p99, r.p99 < 10 ? 1 : 0) + '&#8239;ms.';
      if (r.stuck) v += ' <span class="st-bad">La base no se recupera: al final, ' + F.num(r.stuck) + ' usuarios siguen esperando. Cada consulta nueva hace más lentas a todas las demás.</span>';
      verdict.innerHTML = v;
      stats.innerHTML = '';
      [['Consultas a la base', F.num(r.totalQ)], ['Máx. consultas a la vez', F.num(r.maxConc)],
       ['Espera p99 de usuarios', F.num(r.p99, r.p99 < 10 ? 1 : 0) + ' ms'],
       ['Peor espera', F.num(r.maxLat, 0) + ' ms' + (r.stuck ? ' o más' : '')]].forEach(function (x) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
      if (restart) { now = reduce || !SPEEDS[sp] ? TO : FROM; hold = 0; }
      draw();
      kick();
    }

    function frameAt(t) {
      var i = Math.max(0, Math.min(r.frames.length - 1, Math.round((t - FROM) / FRAME)));
      return r.frames[i];
    }

    function keyState(fr) {
      if (fr.valid && fr.early) return { cls: 'st-k--warm', t: 'válida, y una lectura ya la está renovando antes de que venza' };
      if (fr.valid && fr.refilled >= 0 && fr.t >= fr.refilled) return { cls: 'st-k--ok', t: fr.refilled < EXP ? 'válida: se renovó a los ' + F.num(fr.refilled) + ' ms, antes de vencer' : 'válida otra vez: se repuso a los ' + F.num(fr.refilled) + ' ms' };
      if (fr.valid) return { cls: 'st-k--ok', t: 'válida: todas las lecturas son hits (vence a los 1 000 ms)' };
      if (strat.id === 'swr') return { cls: 'st-k--warm', t: 'vencida: se sirve el valor viejo mientras una sola request la recalcula' };
      return { cls: 'st-k--bad', t: 'vencida: cada lectura es un miss' };
    }

    var GX = 20, GY = 74, BW = 52, BH = 36, GAP = 8, DBX = 520, DBY = 74, DBW = 230, DBH = 170;
    function boxXY(i) { return [GX + (i % 5) * (BW + GAP), GY + Math.floor(i / 5) * (BH + GAP + 4)]; }

    function drawScene(fr) {
      var ks = keyState(fr);
      var s = '<svg viewBox="0 0 770 286" role="img" aria-label="Veinte instancias de la aplicación, el estado de la clave en Redis y la base de datos con sus consultas en curso">';
      s += '<rect class="st-key ' + ks.cls + '" x="20" y="8" width="730" height="34" rx="8"/>';
      s += '<text class="dg-small" x="34" y="30"><tspan style="font-weight:600">Redis, clave prod:1:</tspan> ' + ks.t + '</text>';
      s += '<text class="dg-small" x="20" y="64" style="font-weight:600">20 instancias de la app</text>';
      s += '<text class="dg-tiny" x="' + (GX + 5 * (BW + GAP) - GAP) + '" y="64" text-anchor="end">' + F.num(+rps.value) + ' lecturas/s en total</text>';
      var DY = DBY + DBH / 2;
      for (var i = 0; i < INST; i++) {
        var p = boxXY(i), q = fr.iq[i];
        if (q > 0) {
          var w = 1 + Math.min(6, Math.log(1 + q) / Math.LN2);
          s += '<path class="st-line" d="M' + (p[0] + BW) + ' ' + (p[1] + BH / 2) + ' L' + DBX + ' ' + (DY - 40 + i * 4) + '" style="stroke-width:' + w.toFixed(1) + '"/>';
        }
      }
      for (var j = 0; j < INST; j++) {
        var b = boxXY(j), wt = fr.iw[j], qq = fr.iq[j];
        var cls = qq > 0 ? 'st-inst st-inst--q' : wt > 0 ? 'st-inst st-inst--w' : 'st-inst';
        s += '<rect class="' + cls + '" x="' + b[0] + '" y="' + b[1] + '" width="' + BW + '" height="' + BH + '" rx="6"/>';
        s += '<text class="dg-tiny" x="' + (b[0] + BW / 2) + '" y="' + (b[1] + 22) + '" text-anchor="middle"' + (wt ? ' style="font-weight:700;fill:var(--label)"' : '') + '>' + (wt ? F.num(wt) : '·') + '</text>';
      }
      s += '<rect class="dg-layer" style="--c: var(--l-db)" x="' + DBX + '" y="' + DBY + '" width="' + DBW + '" height="' + DBH + '" rx="10"/>';
      var cx = DBX + DBW / 2;
      s += '<text class="dg-label" x="' + cx + '" y="' + (DBY + 26) + '" text-anchor="middle">Base de datos</text>';
      s += '<text class="dg-tiny" x="' + cx + '" y="' + (DBY + 50) + '" text-anchor="middle">consultas en curso</text>';
      s += '<text class="dg-big st-big" x="' + cx + '" y="' + (DBY + 86) + '" text-anchor="middle">' + F.num(fr.active) + '</text>';
      /* escala logarítmica: de 1 a 30 000 consultas en curso */
      var bx = DBX + 20, bw = DBW - 40, by = DBY + 100, LM = Math.log(30001);
      function bxOf(n) { return bw * Math.min(1, Math.log(1 + n) / LM); }
      s += '<rect class="ss-bar" x="' + bx + '" y="' + by + '" width="' + bw + '" height="10" rx="5"/>';
      if (fr.active > 0) s += '<rect class="st-bar" x="' + bx + '" y="' + by + '" width="' + Math.max(6, bxOf(fr.active)).toFixed(1) + '" height="10" rx="5"/>';
      var m40 = bx + bxOf(40);
      s += '<path class="dg-feedback" d="M' + m40.toFixed(1) + ' ' + (by - 4) + ' V' + (by + 14) + '"/>';
      s += '<text class="dg-tiny" x="' + m40.toFixed(1) + '" y="' + (by + 27) + '" text-anchor="middle">40: el doble de lenta</text>';
      s += '<text class="dg-tiny" x="' + (bx + bw) + '" y="' + (by - 6) + '" text-anchor="end">30 000</text>';
      s += '<text class="dg-tiny" x="' + bx + '" y="' + (by - 6) + '">1</text>';
      s += '<text class="dg-tiny" x="' + cx + '" y="' + (DBY + 160) + '" text-anchor="middle">cada consulta tarda ~' + F.num(fr.lat, 0) + ' ms</text>';
      var ly = 272;
      s += '<rect class="st-inst st-inst--w" x="20" y="' + (ly - 11) + '" width="14" height="14" rx="3"/><text class="dg-tiny" x="40" y="' + ly + '">usuarios esperando el valor (número)</text>';
      s += '<rect class="st-inst st-inst--q" x="262" y="' + (ly - 11) + '" width="14" height="14" rx="3"/><text class="dg-tiny" x="282" y="' + ly + '">consulta en curso</text>';
      s += '<path class="st-line" d="M402 ' + (ly - 4) + ' h26" style="stroke-width:3"/><text class="dg-tiny" x="434" y="' + ly + '">consultas a la base: más gruesa, más consultas</text>';
      scene.innerHTML = s + '</svg>';
    }

    function drawChart(tNow) {
      var from = FROM / r.bucket, to = TO / r.bucket;
      var data = r.started.slice(from, to);
      var W = 770, H = 200, l = 50, b = 30, t = 22, pw = W - l - 14, ph = H - b - t;
      var max = Math.max(10, Math.max.apply(null, data));
      var nice = Math.pow(10, Math.floor(Math.log10(max)));
      var top = Math.ceil(max / nice) * nice;
      var bw = pw / data.length;
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Consultas a la base por intervalo de 50 ms">';
      s += '<text class="sim-label" x="' + l + '" y="12">Consultas que empiezan cada 50 ms</text>';
      for (var g = 0; g <= 4; g++) {
        var gy = t + ph - ph * g / 4;
        s += '<line class="sim-grid" x1="' + l + '" x2="' + (W - 14) + '" y1="' + gy + '" y2="' + gy + '"/>';
        s += '<text class="sim-axis" x="' + (l - 6) + '" y="' + (gy + 4) + '" text-anchor="end">' + F.num(top * g / 4, 0) + '</text>';
      }
      data.forEach(function (v, i) {
        if ((from + i) * r.bucket > tNow) return;
        var bh = v / top * ph, x = l + i * bw + 1;
        if (v > 0) s += '<rect x="' + x.toFixed(1) + '" y="' + (t + ph - bh).toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="2" fill="var(--l-db)"><title>' + ((from + i) * r.bucket) + '–' + ((from + i + 1) * r.bucket) + ' ms: ' + v + ' consultas</title></rect>';
      });
      var ex = l + (EXP / r.bucket - from) * bw;
      s += '<line x1="' + ex + '" x2="' + ex + '" y1="' + t + '" y2="' + (t + ph) + '" stroke="var(--fail)" stroke-dasharray="4 3"/>';
      s += '<text class="sim-axis" x="' + (ex + 5) + '" y="' + (t + 10) + '" style="fill:var(--fail)">vence la clave</text>';
      var cx = l + (tNow / r.bucket - from) * bw;
      s += '<line class="sim-grid" x1="' + cx.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y1="' + t + '" y2="' + (t + ph) + '" style="stroke:var(--label-3)"/>';
      for (var ms = 800; ms <= 2400; ms += 400) {
        var x2 = l + (ms / r.bucket - from) * bw;
        s += '<text class="sim-axis" x="' + x2 + '" y="' + (H - 10) + '" text-anchor="' + (ms === 2400 ? 'end' : 'middle') + '">' + F.num(ms) + ' ms</text>';
      }
      chart.innerHTML = s + '</svg>';
    }

    function draw() {
      var fr = frameAt(now);
      drawScene(fr);
      drawChart(now);
      clock.textContent = 't = ' + F.num(Math.round(now / 10) * 10) + ' ms · ' + LABELS[sp];
    }

    function setCtrl() {
      var s = SPEEDS[sp];
      ctrl.textContent = s === 0 ? 'Reanudar' : (s === 1 ? 'Acelerar' : 'Pausar');
      ctrl.setAttribute('aria-label', 'Velocidad actual: ' + LABELS[sp].toLowerCase() + '. ' + (s === 0 ? 'Toca para reanudar despacio.' : s === 1 ? 'Toca para acelerar.' : 'Toca para pausar.'));
    }
    ctrl.addEventListener('click', function () {
      sp = (sp + 1) % SPEEDS.length;
      if (SPEEDS[sp] && now >= TO) { now = FROM; hold = 0; }
      setCtrl(); draw(); kick();
    });

    function tick(ts) {
      raf = 0;
      var s = SPEEDS[sp];
      if (!s || !visible) { last = 0; return; }
      if (last) {
        var dt = Math.min(100, ts - last) * s;
        if (now >= TO) { hold += dt; if (hold > 3500) { now = FROM; hold = 0; } }
        else now = Math.min(TO, now + dt / SLOW);
      }
      last = ts;
      draw();
      raf = requestAnimationFrame(tick);
    }
    function kick() { if (!raf && SPEEDS[sp] && visible) { last = 0; raf = requestAnimationFrame(tick); } }

    [rps, base].forEach(function (el) { el.addEventListener('change', function () { run(true); }); });
    host.classList.add('sim', 'st-sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Simulador de estampida: vence una clave caliente' }), clock]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'btn-row', role: 'group', 'aria-label': 'Estrategia' }, chips),
      info,
      h('div', { class: 'cp-narr' }, [verdict, ctrl]),
      scene, chart, stats,
      h('div', { class: 'sim-controls st-settings' }, [
        h('div', { class: 'field' }, [h('label', { text: 'Tráfico de la clave' }), rps]),
        h('div', { class: 'field' }, [h('label', { text: 'Costo de recalcular' }), base])
      ])
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Modelo: 20 instancias; la clave vence a los 1 000 ms; la escena corre diez veces más lenta que la realidad. Cada consulta tarda su costo base multiplicado por (1 + consultas en curso / 40), como una base que se satura. El botón alterna lento, rápido y pausa.' }));
    setCtrl();
    run(true);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) kick();
      }, { threshold: 0.2 }).observe(host);
    } else { visible = true; kick(); }
  }

  SD.ready(function () { document.querySelectorAll('[data-sim="stampede"]').forEach(init); });
  SD.simStampede = simulate;
})();
