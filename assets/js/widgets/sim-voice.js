/* Widgets del M24 (voz y tiempo real):
   <div data-calc="voicebudget">  presupuesto de latencia voz a voz, etapa por etapa, en una cascada ingenua, una cascada en streaming y speech-to-speech
   <div data-sim="bargein">       una interrupción en la línea de tiempo: qué oyó el usuario y qué guarda el contexto, en cuatro casos
   <div data-sim="jitterbuf">     paquetes de audio cada 20 ms con jitter y pérdida, y lo que hace el jitter buffer con cada tamaño
   La lógica pura está en SD.voiceCore, sin DOM, para probarla en Node. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  /* ======================= Lógica pura ======================= */

  /* Etapas del camino voz a voz; group: cliente, red, turno o modelo */
  var STAGES = [
    { k: 'cap', name: 'Captura y codec', g: 'cliente' },
    { k: 'up', name: 'Red de ida', g: 'red' },
    { k: 'jb', name: 'Jitter buffer de ida', g: 'red' },
    { k: 'eot', name: 'Fin de turno', g: 'turno' },
    { k: 'stt', name: 'STT: resultado final', g: 'modelo' },
    { k: 'ttft', name: 'Modelo: primer token o primer audio', g: 'modelo' },
    { k: 'phrase', name: 'Hasta la primera frase que se puede decir', g: 'modelo' },
    { k: 'tts', name: 'TTS: primer audio', g: 'modelo' },
    { k: 'down', name: 'Red de vuelta', g: 'red' },
    { k: 'play', name: 'Jitter buffer y reproducción', g: 'cliente' }
  ];

  /* Los tres repartos de 24.8 (calc_m24.py) */
  var BUDGETS = {
    naive: { name: 'Cascada ingenua', v: { cap: 40, up: 60, jb: 60, eot: 500, stt: 300, ttft: 500, phrase: 1500, tts: 400, down: 60, play: 60 } },
    cascade: { name: 'Cascada en streaming', v: { cap: 30, up: 25, jb: 30, eot: 250, stt: 50, ttft: 150, phrase: 100, tts: 80, down: 25, play: 40 } },
    s2s: { name: 'Speech-to-speech', v: { cap: 30, up: 25, jb: 30, eot: 250, stt: 0, ttft: 300, phrase: 0, tts: 0, down: 25, play: 40 } }
  };

  function budget(v, target) {
    var total = 0, groups = { cliente: 0, red: 0, turno: 0, modelo: 0 }, top = null;
    STAGES.forEach(function (s) {
      var x = Math.max(0, +v[s.k] || 0);
      total += x; groups[s.g] += x;
      if (!top || x > top.ms) top = { k: s.k, name: s.name, ms: x };
    });
    return { total: total, groups: groups, top: top, share: total ? top.ms / total : 0,
      margin: target - total, human: total / 200 };
  }

  /* ----- Barge-in ----- */

  var REPLY = 'Tu vuelo sale mañana a las 7:40 desde la terminal 2. Si prefieres, puedo cambiarlo al de las 10:15, que tiene asientos libres, pero cuesta 40 dólares más.';

  /* Tiempos por palabra que devolvería el TTS: 90 ms más 45 por letra, y una pausa tras la coma o el punto.
     Las palabras con cifras se leen más largas ("siete cuarenta"). */
  function wordTimes(text) {
    var t = 0;
    return text.split(' ').map(function (w) {
      var letters = /\d/.test(w) ? 12 : w.replace(/[^\wáéíóúñ]/gi, '').length;
      var d = 90 + 45 * letters, o = { w: w, start: t, end: t + d };
      t += d + (/[.]$/.test(w) ? 300 : /,$/.test(w) ? 150 : 0);
      return o;
    });
  }

  /* El camino de la interrupción: captura y codec 30, red de ida 25, jitter buffer 30, el VAD necesita 200 ms de voz
     y la orden de vaciar el buffer tarda 25 ms en volver. */
  var LAT = { reach: 85, vad: 200, back: 25 };

  var CASES = {
    good: { name: 'Truncar bien' },
    bad: { name: 'Sin truncar' },
    backchannel: { name: 'Un "ajá"' },
    echo: { name: 'Eco sin AEC' }
  };

  function bargein(caseId) {
    var words = wordTimes(REPLY), end = words[words.length - 1].end;
    var at = function (w) { for (var i = 0; i < words.length; i++) if (words[i].w.indexOf(w) === 0) return words[i]; return null; };
    var ev = [], user = null, cut = null, truncate = false;
    ev.push({ ms: 0, who: 'cliente', text: 'Empieza a sonar la respuesta del agente.' });
    if (caseId === 'good' || caseId === 'bad') {
      var u = at('cambiarlo').start + 100;
      user = { start: u, dur: 1100, text: 'No, no, déjalo así.' };
      ev.push({ ms: u, who: 'usuario', text: 'El usuario empieza a hablar encima del agente.' });
      ev.push({ ms: u + LAT.reach, who: 'servidor', text: 'Su audio llega al servidor (captura, red y jitter buffer).' });
      ev.push({ ms: u + LAT.reach + LAT.vad, who: 'servidor', text: 'El VAD confirma voz tras 200 ms de habla: input_audio_buffer.speech_started.' });
      ev.push({ ms: u + LAT.reach + LAT.vad, who: 'servidor', text: 'response.cancel: el modelo deja de generar y el TTS descarta lo que no salió.' });
      cut = u + LAT.reach + LAT.vad + LAT.back;
      ev.push({ ms: cut, who: 'cliente', text: 'El cliente vacía su buffer y deja de reproducir.' });
      if (caseId === 'good') {
        truncate = true;
        ev.push({ ms: cut, who: 'servidor', text: 'conversation.item.truncate con audio_end_ms = ' + cut + ': el contexto se queda con lo que sonó.' });
      } else {
        ev.push({ ms: cut, who: 'servidor', text: 'Nadie trunca: el contexto conserva la respuesta entera, también lo que nunca sonó.' });
      }
    } else if (caseId === 'backchannel') {
      var b = at('terminal').start;
      user = { start: b, dur: 300, text: 'Ajá.' };
      ev.push({ ms: b, who: 'usuario', text: 'El usuario dice "ajá" para mostrar que sigue ahí.' });
      ev.push({ ms: b + LAT.reach + LAT.vad, who: 'servidor', text: 'El VAD ve voz: con un umbral de silencio solo, el agente se callaría acá.' });
      ev.push({ ms: b + LAT.reach + 300, who: 'servidor', text: 'Termina en 300 ms y una palabra: por debajo del mínimo de 500 ms o dos palabras. No es una interrupción.' });
      ev.push({ ms: end, who: 'cliente', text: 'La respuesta termina completa.' });
    } else {
      user = null;
      ev.push({ ms: 50, who: 'micrófono', text: 'La voz del agente sale por el parlante y vuelve a entrar por el micrófono. Sin AEC nadie la resta.' });
      ev.push({ ms: 50 + LAT.reach + LAT.vad, who: 'servidor', text: 'El VAD confirma voz: es la del propio agente.' });
      cut = 50 + LAT.reach + LAT.vad + LAT.back;
      truncate = true;
      ev.push({ ms: cut, who: 'cliente', text: 'El agente se interrumpe a sí mismo y espera un turno que nadie empezó.' });
    }
    var heard = [], unheard = [];
    words.forEach(function (w) { (cut === null || w.start < cut ? heard : unheard).push(w); });
    var partial = cut !== null && heard.length && heard[heard.length - 1].end > cut;
    return { words: words, end: end, user: user, cut: cut, truncate: truncate, events: ev.sort(function (a, b) { return a.ms - b.ms; }),
      heard: heard.map(function (w) { return w.w; }).join(' ') + (partial ? '…' : ''),
      unheard: unheard.map(function (w) { return w.w; }).join(' '), talkOver: user && cut !== null ? cut - user.start : 0 };
  }

  /* ----- Jitter buffer ----- */

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var NETS = {
    wifi: { name: 'Wifi en casa', base: 30, jitter: 4, spike: 0.005, spikeMs: 60, loss: 0.005 },
    lte: { name: '4G en movimiento', base: 45, jitter: 18, spike: 0.03, spikeMs: 150, loss: 0.02 },
    bad: { name: 'Red congestionada', base: 60, jitter: 40, spike: 0.06, spikeMs: 250, loss: 0.05 }
  };

  /* Llegada de cada paquete: base + jitter exponencial + picos ocasionales; pérdidas en ráfagas cortas */
  function packets(net, n, seed) {
    var r = rng(seed), out = [], burst = 0;
    for (var i = 0; i < n; i++) {
      var lost = false;
      if (burst > 0) { lost = true; burst--; }
      else if (r() < net.loss) { lost = true; burst = r() < 0.3 ? 1 : 0; }
      var j = -Math.log(1 - r()) * net.jitter;
      if (r() < net.spike) j += net.spikeMs * (0.5 + r());
      out.push({ i: i, send: i * 20, delay: net.base + j, lost: lost });
    }
    return out;
  }

  /* buffer en ms, o 'auto': el p95 del jitter de los últimos 50 paquetes más un margen de 10 ms, entre 20 y 200 */
  function jitterbuf(net, buffer, fec, n, seed) {
    var ps = packets(net, n || 250, seed || 7), seen = [], bufs = [];
    var res = ps.map(function (p, idx) {
      var B = buffer;
      if (buffer === 'auto') {
        var w = seen.slice(-50).sort(function (a, b) { return a - b; });
        B = w.length < 10 ? 60 : Math.max(20, Math.min(200, w[Math.floor(w.length * 0.95)] - net.base + 10));
      }
      bufs.push(B);
      var deadline = p.delay <= net.base + B;
      var state = p.lost ? 'lost' : deadline ? 'ok' : 'late';
      if (state !== 'ok' && fec) {
        var nx = ps[idx + 1];
        /* FEC en banda de Opus: el paquete siguiente lleva una copia de menor calidad de este */
        if (nx && !nx.lost && nx.delay + 20 <= net.base + B) state = 'fec';
      }
      if (!p.lost) seen.push(p.delay);
      return { i: p.i, delay: p.delay, lost: p.lost, buffer: B, state: state };
    });
    var c = { ok: 0, late: 0, lost: 0, fec: 0 };
    res.forEach(function (p) { c[p.state]++; });
    var avgB = bufs.reduce(function (a, b) { return a + b; }, 0) / bufs.length;
    return { packets: res, counts: c, n: res.length, avgBuffer: avgB, concealed: (c.late + c.lost) / res.length, net: net };
  }

  SD.voiceCore = { STAGES: STAGES, BUDGETS: BUDGETS, budget: budget, REPLY: REPLY, wordTimes: wordTimes, LAT: LAT,
    CASES: CASES, bargein: bargein, rng: rng, NETS: NETS, packets: packets, jitterbuf: jitterbuf };

  if (typeof document === 'undefined') return;   /* en Node solo se usa la lógica */

  /* ======================= Piezas comunes ======================= */

  var uid = 0;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function num(label, value, step) {
    var id = 'vo' + (++uid);
    var i = h('input', { id: id, type: 'number', min: 0, step: step, value: value, inputmode: 'decimal' });
    return { el: h('div', { class: 'field' }, [h('label', { for: id, text: label }), i]), input: i };
  }
  function out(label, formula) {
    var v = h('output', { class: 'out-value' });
    return { el: h('div', { class: 'out-row' }, [h('span', { class: 'out-label', text: label }), v, h('span', { class: 'out-formula', text: formula })]), v: v };
  }
  function chipRow(list, def, onPick, aria) {
    var box = h('div', { class: 'calc-presets', role: 'group', 'aria-label': aria });
    Object.keys(list).forEach(function (k) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': k === def ? 'true' : 'false', text: list[k].name });
      b.addEventListener('click', function () {
        box.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        onPick(k);
      });
      box.appendChild(b);
    });
    box.clear = function () { box.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); };
    return box;
  }
  var GC = { cliente: 'var(--l-client)', red: 'var(--l-edge)', turno: 'var(--l-service)', modelo: 'var(--l-gpu)' };
  var GN = { cliente: 'Cliente', red: 'Red y buffers', turno: 'Fin de turno', modelo: 'Modelos' };
  function ms(x) { return F.num(x, 0) + ' ms'; }

  /* ======================= Presupuesto voz a voz ======================= */

  function initBudget(host) {
    var f = {};
    STAGES.forEach(function (s) { f[s.k] = num(s.name + ' (ms)', BUDGETS.cascade.v[s.k], 5); });
    var tgt = num('Objetivo voz a voz (ms)', 800, 50);
    var o = {
      total: out('Voz a voz', 'desde que el usuario calla hasta que oye al agente'),
      margin: out('Contra el objetivo', ''),
      top: out('La etapa más grande', ''),
      groups: out('Por tipo', ''),
      human: out('Contra una persona', 'un silencio típico entre turnos es de unos 200 ms')
    };
    var chart = h('div', { class: 'sim-scroll vo-chart' });
    var chips = chipRow(BUDGETS, 'cascade', function (k) {
      STAGES.forEach(function (s) { f[s.k].input.value = BUDGETS[k].v[s.k]; });
      run();
    }, 'Repartos de ejemplo');

    function draw(v, r, target) {
      var W = 680, H = 150, l = 12, rr = 12, pw = W - l - rr, y0 = 46, bh = 36;
      var max = Math.max(r.total, target, 400) * 1.06, X = function (t) { return l + t / max * pw; };
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Las etapas del camino voz a voz como una barra apilada, contra 200 ms de una persona y el objetivo">';
      var t = 0;
      STAGES.forEach(function (st) {
        var x = +v[st.k] || 0;
        if (x <= 0) return;
        var a = X(t), b = X(t + x);
        s += '<rect x="' + a.toFixed(1) + '" y="' + y0 + '" width="' + Math.max(1, b - a - 1).toFixed(1) + '" height="' + bh + '" style="fill: ' + GC[st.g] + '" opacity="0.30"/>';
        s += '<rect x="' + a.toFixed(1) + '" y="' + y0 + '" width="' + Math.max(1, b - a - 1).toFixed(1) + '" height="4" style="fill: ' + GC[st.g] + '"/>';
        if (b - a > 34) s += '<text class="sim-val" x="' + ((a + b) / 2).toFixed(1) + '" y="' + (y0 + 25) + '" text-anchor="middle">' + F.num(x, 0) + '</text>';
        t += x;
      });
      [[200, 'una persona: 200 ms', '4 3'], [target, 'objetivo: ' + F.num(target, 0) + ' ms', '']].forEach(function (m, i) {
        var x = X(m[0]);
        s += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (y0 - 14) + '" y2="' + (y0 + bh + 8) + '" stroke="var(--label)" stroke-width="1.5"' + (m[2] ? ' stroke-dasharray="' + m[2] + '"' : '') + '/>';
        s += '<text class="sim-label" x="' + (x + (i ? -4 : 4)).toFixed(1) + '" y="' + (y0 - 20) + '" text-anchor="' + (i ? 'end' : 'start') + '">' + m[1] + '</text>';
      });
      var lx = l;
      Object.keys(GN).forEach(function (g) {
        s += '<rect x="' + lx + '" y="' + (H - 28) + '" width="12" height="12" style="fill: ' + GC[g] + '" opacity="0.6"/>';
        s += '<text class="sim-axis" x="' + (lx + 17) + '" y="' + (H - 18) + '">' + GN[g] + ': ' + ms(r.groups[g]) + '</text>';
        lx += 165;
      });
      chart.innerHTML = s + '</svg>';
    }

    function run() {
      var v = {};
      STAGES.forEach(function (s) { var n = parseFloat(f[s.k].input.value); v[s.k] = isFinite(n) && n > 0 ? n : 0; });
      var target = parseFloat(tgt.input.value); if (!(target > 0)) target = 800;
      var r = budget(v, target);
      o.total.v.textContent = ms(r.total);
      o.margin.v.textContent = r.margin >= 0 ? '✓ sobran ' + ms(r.margin) : '✗ te pasas ' + ms(-r.margin);
      o.margin.v.nextSibling.textContent = 'objetivo de ' + ms(target);
      o.top.v.textContent = ms(r.top.ms);
      o.top.v.nextSibling.textContent = r.top.name + ': el ' + F.num(r.share * 100, 0) + ' % del total';
      o.groups.v.textContent = ms(r.groups.red + r.groups.cliente) + ' de red';
      o.groups.v.nextSibling.textContent = 'cliente, red y buffers; fin de turno ' + ms(r.groups.turno) + '; modelos ' + ms(r.groups.modelo);
      o.human.v.textContent = F.num(r.human, 1) + ' veces';
      draw(v, r, target);
    }

    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    STAGES.forEach(function (s) { inCol.appendChild(f[s.k].el); f[s.k].input.addEventListener('input', function () { chips.clear(); run(); }); });
    inCol.appendChild(tgt.el); tgt.input.addEventListener('input', run);
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Presupuesto de latencia voz a voz' }), chips]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('div', { class: 'vis-chart-wrap' }, [chart]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Los tres repartos son diseños de referencia de 24.8. En speech-to-speech, el STT, la primera frase y el TTS valen cero: el modelo entrega audio directamente, y su tiempo hasta el primer audio va en la fila del modelo. El silencio humano de 200 ms viene de Stivers y otros (2009).' }));
    run();
  }

  /* ======================= Barge-in ======================= */

  function initBargein(host) {
    var caseId = 'good', timer = null;
    var chips = chipRow(CASES, caseId, function (k) { caseId = k; stop(); run(false); }, 'Caso');
    var play = h('button', { type: 'button', class: 'btn btn--primary', text: 'Reproducir' });
    var chart = h('div', { class: 'sim-scroll vo-chart' });
    var log = h('ol', { class: 'vo-log', 'aria-live': 'polite' });
    var ctx = h('div', { class: 'vo-ctx' });
    var r = null;

    function draw(now) {
      var W = 700, H = 170, l = 74, rr = 14, pw = W - l - rr, T = Math.ceil(r.end / 1000) * 1000;
      var X = function (t) { return l + t / T * pw; };
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Línea de tiempo: la voz del agente palabra por palabra, la del usuario y el punto de corte">';
      for (var t = 0; t <= T; t += 1000) {
        s += '<line class="sim-grid" x1="' + X(t).toFixed(1) + '" x2="' + X(t).toFixed(1) + '" y1="22" y2="128"/>';
        s += '<text class="sim-axis" x="' + X(t).toFixed(1) + '" y="146" text-anchor="middle">' + (t / 1000) + ' s</text>';
      }
      s += '<text class="sim-label" x="' + (l - 8) + '" y="54" text-anchor="end">Agente</text>';
      s += '<text class="sim-label" x="' + (l - 8) + '" y="106" text-anchor="end">Usuario</text>';
      r.words.forEach(function (w) {
        var shown = now === null || w.start < now;
        if (!shown) return;
        var cutHere = r.cut !== null && w.start >= r.cut;
        var e = r.cut !== null && w.start < r.cut && w.end > r.cut ? r.cut : w.end;
        if (now !== null) e = Math.min(e, now);
        var a = X(w.start), b = X(e);
        var style = cutHere ? 'fill: none; stroke: var(--label-3)' : 'fill: var(--l-gpu)';
        s += '<rect x="' + a.toFixed(1) + '" y="36" width="' + Math.max(1, b - a - 1).toFixed(1) + '" height="26" rx="3" style="' + style + '"' + (cutHere ? ' stroke-dasharray="3 3"' : ' opacity="0.45"') + '/>';
      });
      if (r.user && (now === null || now > r.user.start)) {
        var ue = r.user.start + r.user.dur; if (now !== null) ue = Math.min(ue, now);
        s += '<rect x="' + X(r.user.start).toFixed(1) + '" y="90" width="' + Math.max(1, X(ue) - X(r.user.start)).toFixed(1) + '" height="26" rx="3" style="fill: var(--l-client)" opacity="0.5"/>';
        s += '<text class="sim-val" x="' + (X(r.user.start) + 6).toFixed(1) + '" y="108">' + SD.escape(r.user.text) + '</text>';
      }
      if (r.cut !== null && (now === null || now >= r.cut)) {
        var cx = X(r.cut);
        s += '<line x1="' + cx.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y1="18" y2="128" stroke="var(--fail)" stroke-width="2"/>';
        s += '<text class="sim-val" x="' + (cx + 5).toFixed(1) + '" y="28">corte: ' + F.num(r.cut, 0) + ' ms</text>';
      }
      if (now !== null) s += '<line x1="' + X(now).toFixed(1) + '" x2="' + X(now).toFixed(1) + '" y1="18" y2="128" stroke="var(--accent)" stroke-width="1.5"/>';
      chart.innerHTML = s + '</svg>';
    }

    function renderLog(now) {
      log.innerHTML = '';
      r.events.forEach(function (e) {
        if (now !== null && e.ms > now) return;
        log.appendChild(h('li', {}, [h('b', { text: F.num(e.ms, 0) + ' ms' }), h('span', { class: 'vo-who', text: e.who }), h('span', { text: e.text })]));
      });
    }

    function renderCtx() {
      ctx.innerHTML = '';
      var heard = r.cut === null ? SD.voiceCore.REPLY : r.heard;
      ctx.appendChild(h('p', {}, [h('b', { text: 'Lo que oyó el usuario: ' }), h('span', { text: heard })]));
      var p = h('p', {}, [h('b', { text: 'Lo que guarda el contexto: ' })]);
      if (r.cut === null || r.truncate) p.appendChild(h('span', { text: heard }));
      else {
        p.appendChild(h('span', { text: r.heard + ' ' }));
        p.appendChild(h('span', { class: 'vo-unheard', text: r.unheard }));
        p.appendChild(h('span', { class: 'vo-flag', text: ' ✗ esto nunca sonó' }));
      }
      ctx.appendChild(p);
      var msg = {
        good: '✓ El contexto coincide con lo que se oyó. En el turno siguiente, el modelo sabe que el usuario no escuchó el precio del cambio.',
        bad: '✗ El modelo cree que dijo el precio. Si el usuario pregunta "¿y cuánto cuesta?", el modelo puede contestar "como te dije, 40 dólares".',
        backchannel: '✓ El "ajá" no cortó al agente. Con un umbral de silencio solo, se habría callado en mitad de la frase.',
        echo: '✗ Sin cancelación de eco, el agente se oye a sí mismo y se corta en el primer cuarto de segundo, una y otra vez.'
      }[caseId];
      ctx.appendChild(h('p', { class: 'sim-note', text: msg + (r.talkOver ? ' El agente siguió hablando encima del usuario durante ' + ms(r.talkOver) + '.' : '') }));
    }

    function stop() { if (timer) { cancelAnimationFrame(timer); timer = null; } play.textContent = 'Reproducir'; }
    function run(animate) {
      r = bargein(caseId);
      if (!animate || reduce) { draw(null); renderLog(null); renderCtx(); return; }
      ctx.innerHTML = '';
      var t0 = null, speed = 1.5, last = Math.max(r.end, r.events[r.events.length - 1].ms) + 200;
      play.textContent = 'Detener';
      function frame(ts) {
        if (t0 === null) t0 = ts;
        var now = (ts - t0) * speed;
        if (now >= last) { stop(); draw(null); renderLog(null); renderCtx(); return; }
        draw(now); renderLog(now);
        timer = requestAnimationFrame(frame);
      }
      timer = requestAnimationFrame(frame);
    }
    play.addEventListener('click', function () { if (timer) { stop(); run(false); } else run(true); });

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Una interrupción, milisegundo a milisegundo' }), chips]));
    host.appendChild(h('div', { class: 'sim-body' }, [h('div', { class: 'sim-controls' }, [play]), chart, ctx, log]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Tiempos del TTS: 90 ms más 45 por letra, con pausas en comas y puntos. El audio del usuario llega al servidor en 85 ms (captura, red y jitter buffer), el VAD confirma la voz con 200 ms de habla y la orden de vaciar el buffer tarda 25 ms en volver. Diseño de referencia; los nombres de los eventos son los de la Realtime API de OpenAI.' }));
    run(false);
  }

  /* ======================= Jitter buffer ======================= */

  var BUFS = { b20: { name: '20 ms', v: 20 }, b60: { name: '60 ms', v: 60 }, b120: { name: '120 ms', v: 120 }, auto: { name: 'Adaptativo', v: 'auto' } };

  function initJitter(host) {
    var netK = 'lte', bufK = 'b60', fec = false, seed = 7;
    var netChips = chipRow(NETS, netK, function (k) { netK = k; run(); }, 'Red');
    var bufChips = chipRow(BUFS, bufK, function (k) { bufK = k; run(); }, 'Tamaño del jitter buffer');
    var fecBtn = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'false', text: 'FEC de Opus' });
    fecBtn.addEventListener('click', function () { fec = !fec; fecBtn.setAttribute('aria-pressed', fec ? 'true' : 'false'); run(); });
    var again = h('button', { type: 'button', class: 'btn', text: 'Otra corrida' });
    again.addEventListener('click', function () { seed += 11; run(); });
    var chart = h('div', { class: 'sim-scroll vo-chart' });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });
    var note = h('p', { class: 'sim-note' });

    function draw(r) {
      var W = 700, H = 260, l = 52, rr = 14, pw = W - l - rr, top = 26, bot = 210, ymax = 0;
      r.packets.forEach(function (p) { if (!p.lost) ymax = Math.max(ymax, p.delay); });
      ymax = Math.max(160, Math.ceil((ymax + 10) / 50) * 50);
      ymax = Math.min(ymax, 500);
      var X = function (i) { return l + i / r.n * pw; }, Y = function (d) { return bot - Math.min(d, ymax) / ymax * (bot - top); };
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Retraso de cada paquete de audio contra el momento en que el jitter buffer lo necesita">';
      for (var d = 0; d <= ymax; d += ymax > 300 ? 100 : 50) {
        s += '<line class="sim-grid" x1="' + l + '" x2="' + (W - rr) + '" y1="' + Y(d).toFixed(1) + '" y2="' + Y(d).toFixed(1) + '"/>';
        s += '<text class="sim-axis" x="' + (l - 6) + '" y="' + (Y(d) + 4).toFixed(1) + '" text-anchor="end">' + d + ' ms</text>';
      }
      var path = '';
      r.packets.forEach(function (p, i) { path += (i ? ' L' : 'M') + X(i).toFixed(1) + ' ' + Y(r.net.base + p.buffer).toFixed(1) + ' L' + X(i + 1).toFixed(1) + ' ' + Y(r.net.base + p.buffer).toFixed(1); });
      s += '<path d="' + path + '" fill="none" stroke="var(--label)" stroke-width="1.5" stroke-dasharray="5 3"/>';
      r.packets.forEach(function (p, i) {
        var x = X(i + 0.5);
        if (p.lost) {
          var y = top - 10, c = p.state === 'fec' ? 'var(--warn)' : 'var(--fail)';
          s += '<path d="M' + (x - 3).toFixed(1) + ' ' + (y - 3) + ' L' + (x + 3).toFixed(1) + ' ' + (y + 3) + ' M' + (x + 3).toFixed(1) + ' ' + (y - 3) + ' L' + (x - 3).toFixed(1) + ' ' + (y + 3) + '" stroke="' + c + '" stroke-width="1.6"/>';
          return;
        }
        var col = p.state === 'ok' ? 'var(--l-service)' : p.state === 'fec' ? 'var(--warn)' : 'var(--fail)';
        var yy = Y(p.delay);
        s += '<circle cx="' + x.toFixed(1) + '" cy="' + yy.toFixed(1) + '" r="' + (p.state === 'ok' ? 2.2 : 3.2) + '" style="fill: ' + col + '"' + (p.delay > ymax ? ' stroke="var(--label)"' : '') + '/>';
      });
      s += '<text class="sim-label" x="' + (W - rr) + '" y="' + (Y(r.net.base + r.packets[r.n - 1].buffer) - 7).toFixed(1) + '" text-anchor="end">el buffer lo necesita aquí</text>';
      s += '<text class="sim-axis" x="' + l + '" y="' + (bot + 18) + '">paquete 0</text>';
      s += '<text class="sim-axis" x="' + (W - rr) + '" y="' + (bot + 18) + '" text-anchor="end">paquete ' + r.n + ' (' + F.num(r.n * 20 / 1000, 0) + ' s de audio)</text>';
      var lg = [['var(--l-service)', 'a tiempo'], ['var(--fail)', 'tarde o perdido: se disimula (PLC)'], ['var(--warn)', 'recuperado con FEC']], lx = l;
      lg.forEach(function (g) {
        s += '<circle cx="' + (lx + 5) + '" cy="' + (H - 14) + '" r="4" style="fill: ' + g[0] + '"/>';
        s += '<text class="sim-axis" x="' + (lx + 14) + '" y="' + (H - 10) + '">' + g[1] + '</text>';
        lx += g[1].length * 6.4 + 34;
      });
      s += '<text class="sim-axis" x="' + l + '" y="' + (top - 16) + '">× = perdido en la red</text>';
      chart.innerHTML = s + '</svg>';
    }

    function stat(label, val) { stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: label }), h('b', { text: val })])); }
    function run() {
      var r = jitterbuf(NETS[netK], BUFS[bufK].v, fec, 250, seed);
      draw(r);
      stats.innerHTML = '';
      var pct = function (x) { return F.num(x / r.n * 100, 1) + ' %'; };
      stat('Latencia que agrega el buffer', ms(r.avgBuffer) + (bufK === 'auto' ? ' en promedio' : ''));
      stat('Llegan tarde', pct(r.counts.late));
      stat('Se pierden en la red', pct(r.counts.lost));
      if (fec) stat('Recuperados con FEC', pct(r.counts.fec));
      stat('Audio disimulado (PLC)', F.num(r.concealed * 100, 1) + ' %');
      var c = r.concealed;
      note.textContent = c > 0.05 ? '✗ Más del 5 % del audio se inventa con PLC: se oye entrecortado. Agranda el buffer, prueba el adaptativo o activa FEC.'
        : c > 0.01 ? 'Entre el 1 y el 5 % del audio se disimula: se nota en algunas sílabas. Cada 20 ms más de buffer son 20 ms más de latencia voz a voz.'
        : '✓ Menos del 1 % se disimula: no se nota. Mira cuánta latencia pagaste por eso.';
    }

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Jitter buffer: latencia contra audio cortado' }), netChips]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [bufChips, fecBtn, again]),
      chart, note, stats
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: '250 paquetes de Opus de 20 ms (5 s de audio). El retraso de cada paquete es la base de la red más un jitter exponencial y picos ocasionales; las pérdidas vienen a veces de a dos. Un paquete sirve si llega antes de que el buffer lo necesite. El adaptativo usa el p95 del jitter de los últimos 50 paquetes más 10 ms. Con FEC, un paquete perdido se recupera si el siguiente llega a tiempo. Diseño de referencia, con semilla fija por corrida.' }));
    run();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-calc="voicebudget"]').forEach(initBudget);
    document.querySelectorAll('[data-sim="bargein"]').forEach(initBargein);
    document.querySelectorAll('[data-sim="jitterbuf"]').forEach(initJitter);
  });
})();
