/* Widgets del M30 (Twitter/X): data-calc="fanout" compara fan-out en escritura, en lectura e híbrido;
   data-calc="snowflake" arma y desarma un id Snowflake. */
(function () {
  'use strict';
  var h = SD.h, F = SD.fmt;
  // F.words dice "1.16 millón"; en español solo 1 lleva singular.
  function words(n) { var t = F.words(n); return /^1 millón/.test(t) ? t : t.replace(' millón', ' millones'); }

  function field(prefix) {
    var uid = 0;
    return function (label, value, step, hint) {
      var id = prefix + (++uid);
      var i = h('input', { id: id, type: 'number', min: 0, step: step, value: value, inputmode: 'decimal' });
      var kids = [h('label', { for: id, text: label }), i];
      if (hint) kids.push(h('p', { class: 'field-hint', text: hint }));
      return { el: h('div', { class: 'field' }, kids), input: i };
    };
  }
  function out(label, formula) {
    var v = h('output', { class: 'out-value' });
    return { el: h('div', { class: 'out-row' }, [h('span', { class: 'out-label', text: label }), v, h('span', { class: 'out-formula', text: formula })]), v: v };
  }
  function mount(host, title, f, o, foot, run) {
    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    Object.keys(f).forEach(function (k) { inCol.appendChild(f[k].el); f[k].input.addEventListener('input', run); });
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: title })]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('p', { class: 'calc-foot', text: foot }));
    run();
  }

  function initFanout(host) {
    var num = field('fo');
    var f = {
      tps: num('Tweets por segundo', 5787, 100, '500 millones por día. El pico de 2013 fue de 143 199.'),
      avg: num('Seguidores promedio de una cuenta común', 200, 10),
      famShare: num('Tweets que publican cuentas famosas (%)', 0.2, 0.1, 'Cuentas sobre el umbral de seguidores.'),
      famAvg: num('Seguidores promedio de una cuenta famosa', 5000000, 100000),
      reads: num('Lecturas de timeline por segundo', 300000, 10000),
      follows: num('Cuentas que sigue un usuario', 400, 10),
      famFollows: num('Cuentas famosas que sigue un usuario', 5, 1)
    };
    var o = {
      pushW: out('Escrituras por segundo, todo en escritura', 'tweets × (comunes × seguidores + famosos × seguidores famosos)'),
      pullR: out('Lecturas por segundo, todo en lectura', 'lecturas de timeline × cuentas seguidas'),
      hybW: out('Escrituras por segundo, híbrido', 'solo las cuentas comunes hacen fan-out'),
      hybR: out('Lecturas por segundo, híbrido', 'lecturas × (1 + famosos seguidos)'),
      famTweet: out('Escrituras de un solo tweet famoso', 'seguidores de la cuenta famosa'),
      saved: out('Escrituras que ahorra el híbrido', '1 − híbrido ÷ todo en escritura')
    };
    function v(k) { var x = parseFloat(f[k].input.value); return isFinite(x) && x >= 0 ? x : 0; }
    function run() {
      var share = Math.min(100, v('famShare')) / 100;
      var common = v('tps') * (1 - share) * v('avg'), famous = v('tps') * share * v('famAvg');
      var push = common + famous;
      o.pushW.v.textContent = words(push);
      o.pullR.v.textContent = words(v('reads') * v('follows'));
      o.hybW.v.textContent = words(common);
      o.hybR.v.textContent = words(v('reads') * (1 + v('famFollows')));
      o.famTweet.v.textContent = words(v('famAvg'));
      o.saved.v.textContent = push > 0 ? F.pct(1 - common / push, 1) : '—';
    }
    mount(host, 'Cuánto cuesta cada forma de fan-out', f, o,
      'Diseño de referencia: valores ilustrativos salvo los tweets y las lecturas por segundo, que son los publicados por Twitter en 2012 y 2013. Cada escritura es un LPUSH en una timeline; cada lectura, una lista de Redis o de un caché.', run);
  }

  var EPOCH = 1288834974657;
  function initSnowflake(host) {
    var num = field('sf');
    var f = {
      ms: num('Milisegundos Unix', 1790812800000, 1, '1790812800000 es el 1 de octubre de 2026 a las 00:00 UTC.'),
      dc: num('Datacenter (0 a 31)', 3, 1),
      wk: num('Worker (0 a 31)', 7, 1),
      seq: num('Secuencia (0 a 4 095)', 42, 1)
    };
    var o = {
      id: out('Id', '(ms − época) << 22 | datacenter << 17 | worker << 12 | secuencia'),
      bin: out('En binario (64 bits)', 'signo | tiempo | datacenter | worker | secuencia'),
      back: out('Fecha que se lee del id', 'id >> 22, más la época de Twitter'),
      end: out('Hasta cuándo alcanza el formato', 'época + 2^41 ms')
    };
    function v(k, max) { var x = Math.floor(parseFloat(f[k].input.value)); return isFinite(x) && x >= 0 ? Math.min(max, x) : 0; }
    function run() {
      if (typeof BigInt === 'undefined') { o.id.v.textContent = 'Este navegador no tiene BigInt.'; return; }
      var ms = Math.max(EPOCH, v('ms', EPOCH + Math.pow(2, 41) - 1));
      var id = (BigInt(ms - EPOCH) << 22n) | (BigInt(v('dc', 31)) << 17n) | (BigInt(v('wk', 31)) << 12n) | BigInt(v('seq', 4095));
      var b = id.toString(2).padStart(64, '0');
      o.id.v.textContent = id.toString();
      o.bin.v.textContent = [b.slice(0, 1), b.slice(1, 42), b.slice(42, 47), b.slice(47, 52), b.slice(52)].join(' ');
      o.back.v.textContent = new Date(Number(id >> 22n) + EPOCH).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
      o.end.v.textContent = new Date(EPOCH + Math.pow(2, 41)).toISOString().slice(0, 10);
    }
    mount(host, 'Armar un id Snowflake', f, o,
      'La época de Twitter es 1288834974657 (4 de noviembre de 2010). Dos ids del mismo milisegundo y el mismo worker se distinguen por la secuencia; de workers distintos, por los bits de nodo.', run);
    host.classList.add('snowflake-calc');
  }

  SD.ready(function () {
    document.querySelectorAll('[data-calc="fanout"]').forEach(initFanout);
    document.querySelectorAll('[data-calc="snowflake"]').forEach(initSnowflake);
  });
})();
