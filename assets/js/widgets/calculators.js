/* Calculadoras interactivas.
   <div data-calc="envelope">      estimación back-of-envelope (QPS, almacenamiento, red, concurrencia)
   <div data-calc="availability">  disponibilidad compuesta en serie y con redundancia
   <div data-calc="tail">          latencia de cola con fan-out */
(function () {
  'use strict';

  var SD = window.SD;
  var h = SD.h;
  var F = SD.fmt;
  var DAY = 86400;
  var uid = 0;

  function field(def, onInput) {
    var id = 'f' + (++uid);
    var input = h('input', {
      id: id, type: 'number', inputmode: 'decimal', min: def.min != null ? def.min : 0,
      step: def.step || 'any', value: def.value
    });
    input.addEventListener('input', onInput);
    var kids = [h('label', { for: id, text: def.label }), input];
    if (def.hint) kids.push(h('p', { class: 'field-hint', text: def.hint }));
    return { el: h('div', { class: 'field' }, kids), input: input };
  }

  function outRow(label, formula) {
    var value = h('output', { class: 'out-value' });
    var row = h('div', { class: 'out-row' }, [
      h('span', { class: 'out-label', text: label }),
      value,
      h('span', { class: 'out-formula', text: formula })
    ]);
    return { el: row, value: value };
  }

  function presetBar(presets, apply) {
    var bar = h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Ejemplos precargados' });
    presets.forEach(function (p, i) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': i === 0 ? 'true' : 'false', text: p.name });
      b.addEventListener('click', function () {
        bar.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        apply(p);
      });
      bar.appendChild(b);
    });
    return bar;
  }

  /* ---------- Back-of-envelope ---------- */

  var ENVELOPE_FIELDS = [
    { key: 'dau', label: 'Usuarios activos diarios (DAU)', value: 10000000, step: 1000 },
    { key: 'writes', label: 'Escrituras por usuario al día', value: 20, step: 1, hint: 'Mensajes enviados, posts, pagos…' },
    { key: 'reads', label: 'Lecturas por cada escritura', value: 2, step: 0.5 },
    { key: 'peak', label: 'Factor de pico', value: 3, step: 0.5, min: 1, hint: 'Hora más cargada ÷ promedio del día. Típico: 2 a 10.' },
    { key: 'size', label: 'Tamaño de cada escritura (bytes)', value: 2000, step: 100 },
    { key: 'retention', label: 'Retención (días)', value: 365, step: 1 },
    { key: 'copies', label: 'Copias de cada dato', value: 3, step: 1, min: 1, hint: 'Réplicas. Con erasure coding equivale a ~1.4–1.5.' },
    { key: 'duration', label: 'Duración de cada escritura (s)', value: 6, step: 0.1, hint: 'Cuánto tiempo ocupa recursos cada request. En un chat con streaming, lo que dura la respuesta.' }
  ];

  var ENVELOPE_PRESETS = [
    { name: 'Chat con LLM', v: { dau: 10000000, writes: 20, reads: 2, peak: 3, size: 2000, retention: 365, copies: 3, duration: 6 } },
    { name: 'Red social', v: { dau: 250000000, writes: 2, reads: 100, peak: 2.5, size: 1000, retention: 3650, copies: 3, duration: 0.2 } },
    { name: 'Mensajería', v: { dau: 500000000, writes: 40, reads: 1, peak: 2, size: 300, retention: 30, copies: 3, duration: 0.1 } }
  ];

  function envelope(host) {
    var inputs = {};
    var body = h('div', { class: 'calc-body' });
    var inCol = h('div', { class: 'calc-inputs' });
    var outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });

    ENVELOPE_FIELDS.forEach(function (def) {
      var f = field(def, compute);
      inputs[def.key] = f.input;
      inCol.appendChild(f.el);
    });

    var o = {
      perDay: outRow('Escrituras por día', 'DAU × escrituras por usuario'),
      avg: outRow('Escrituras por segundo, promedio', 'escrituras por día ÷ 86 400 s'),
      peak: outRow('Escrituras por segundo, pico', 'promedio × factor de pico'),
      readsPeak: outRow('Lecturas por segundo, pico', 'escrituras en pico × lecturas por escritura'),
      ingest: outRow('Datos que entran en pico', 'escrituras en pico × tamaño × 8 bits'),
      storeDay: outRow('Datos nuevos por día', 'escrituras por día × tamaño'),
      storeTotal: outRow('Almacenamiento total', 'por día × retención × copias'),
      inflight: outRow('Escrituras en vuelo en pico', 'Ley de Little: escrituras/s en pico × duración')
    };
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });

    function v(k) { var x = parseFloat(inputs[k].value); return isFinite(x) && x >= 0 ? x : 0; }

    function compute() {
      var perDay = v('dau') * v('writes');
      var avg = perDay / DAY;
      var peak = avg * Math.max(1, v('peak'));
      o.perDay.value.textContent = F.words(perDay);
      o.avg.value.textContent = F.words(avg) + ' /s';
      o.peak.value.textContent = F.words(peak) + ' /s';
      o.readsPeak.value.textContent = F.words(peak * v('reads')) + ' /s';
      o.ingest.value.textContent = F.bitrate(peak * v('size'));
      o.storeDay.value.textContent = F.bytes(perDay * v('size'));
      o.storeTotal.value.textContent = F.bytes(perDay * v('size') * v('retention') * Math.max(1, v('copies')));
      o.inflight.value.textContent = F.words(peak * v('duration'));
    }

    function apply(p) {
      Object.keys(p.v).forEach(function (k) { inputs[k].value = p.v[k]; });
      compute();
    }

    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [
      h('p', { class: 'calc-title', text: 'Calculadora de estimaciones' }),
      presetBar(ENVELOPE_PRESETS, apply)
    ]));
    body.appendChild(inCol);
    body.appendChild(outCol);
    host.appendChild(body);
    host.appendChild(h('p', { class: 'calc-foot', text: 'Los ejemplos precargados son ilustrativos, no cifras reales de ninguna empresa. Unidades decimales: 1 kB = 1000 bytes.' }));
    compute();
  }

  /* ---------- Disponibilidad compuesta ---------- */

  var AVAIL_DEFAULT = [
    { name: 'DNS y CDN', a: 99.99, n: 1 },
    { name: 'Balanceador de carga', a: 99.99, n: 1 },
    { name: 'Servicio de chat (por instancia)', a: 99.5, n: 3 },
    { name: 'Base de datos con failover', a: 99.95, n: 1 },
    { name: 'Clúster de inferencia (por región)', a: 99.5, n: 2 }
  ];

  function availability(host) {
    var rows = AVAIL_DEFAULT.map(function (r) { return { name: r.name, a: r.a, n: r.n }; });
    var table = h('div', { class: 'av-rows' });
    var total = h('output', { class: 'av-total' });
    var detail = h('p', { class: 'av-detail' });
    var weakest = h('p', { class: 'av-weakest' });

    function rowAvail(r) {
      var a = Math.min(100, Math.max(0, r.a)) / 100;
      var n = Math.max(1, Math.round(r.n));
      return 1 - Math.pow(1 - a, n);
    }

    function compute() {
      var t = 1, worst = null;
      rows.forEach(function (r) {
        var ra = rowAvail(r);
        t *= ra;
        if (!worst || ra < worst.ra) worst = { r: r, ra: ra };
      });
      total.textContent = F.nines(t);
      detail.textContent = 'Caída esperada: ' + F.duration((1 - t) * 30 * DAY) + ' al mes, ' + F.duration((1 - t) * 365 * DAY) + ' al año.';
      weakest.textContent = worst ? 'Eslabón más débil: ' + worst.r.name + ' (' + F.nines(worst.ra) + '). Mejorar cualquier otro componente apenas mueve el total.' : '';
      table.querySelectorAll('[data-row-out]').forEach(function (el, i) { el.textContent = F.nines(rowAvail(rows[i])); });
    }

    function render() {
      table.innerHTML = '';
      table.appendChild(h('div', { class: 'av-row av-row--head', 'aria-hidden': 'true' }, [
        h('span', { text: 'Dependencia' }), h('span', { text: 'Disponibilidad de una' }),
        h('span', { text: 'Redundantes' }), h('span', { text: 'Resultado' }), h('span')
      ]));
      rows.forEach(function (r, i) {
        var nameId = 'av' + (++uid);
        var name = h('input', { id: nameId, type: 'text', value: r.name, 'aria-label': 'Nombre de la dependencia ' + (i + 1) });
        var a = h('input', { type: 'number', min: 0, max: 100, step: 0.01, value: r.a, 'aria-label': 'Disponibilidad de una instancia, en porcentaje' });
        var n = h('input', { type: 'number', min: 1, max: 9, step: 1, value: r.n, 'aria-label': 'Instancias redundantes' });
        var del = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Quitar ' + r.name, text: '✕' });
        name.addEventListener('input', function () { r.name = name.value; compute(); });
        a.addEventListener('input', function () { r.a = parseFloat(a.value) || 0; compute(); });
        n.addEventListener('input', function () { r.n = parseInt(n.value, 10) || 1; compute(); });
        del.addEventListener('click', function () { rows.splice(i, 1); render(); });
        table.appendChild(h('div', { class: 'av-row' }, [
          name, h('span', { class: 'av-pct' }, [a, h('span', { text: '%', 'aria-hidden': 'true' })]),
          n, h('output', { class: 'av-row-out', 'data-row-out': '' }), del
        ]));
      });
      compute();
    }

    var add = h('button', { type: 'button', class: 'btn', text: 'Añadir dependencia' });
    add.addEventListener('click', function () {
      rows.push({ name: 'Nueva dependencia', a: 99.9, n: 1 });
      render();
      var inputs = table.querySelectorAll('input[type="text"]');
      inputs[inputs.length - 1].focus();
      inputs[inputs.length - 1].select();
    });

    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Disponibilidad de una cadena de dependencias' })]));
    host.appendChild(h('div', { class: 'calc-pad' }, [
      table,
      h('div', { class: 'av-actions' }, [add]),
      h('div', { class: 'av-summary', 'aria-live': 'polite' }, [
        h('p', { class: 'av-total-label', text: 'Disponibilidad del sistema completo' }),
        total, detail, weakest
      ])
    ]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Supone fallas independientes: en serie se multiplica, y con n redundantes cada fila vale 1 − (1 − a)ⁿ. Las fallas correlacionadas (mismo deploy, misma región) lo empeoran en la práctica.' }));
    render();
  }

  /* ---------- Latencia de cola con fan-out ---------- */

  function tail(host) {
    var nId = 'tn' + (++uid), pId = 'tp' + (++uid);
    var n = h('input', { id: nId, type: 'range', min: 1, max: 200, step: 1, value: 100 });
    var nOut = h('output', { for: nId, class: 'tail-n' });
    var p = h('select', { id: pId }, [
      h('option', { value: '0.05', text: '5 % (lo que queda por encima del p95)' }),
      h('option', { value: '0.01', selected: true, text: '1 % (por encima del p99)' }),
      h('option', { value: '0.001', text: '0.1 % (por encima del p99.9)' })
    ]);
    var grid = h('div', { class: 'tail-grid', 'aria-hidden': 'true' });
    var prob = h('output', { class: 'tail-prob' });
    var sim = h('p', { class: 'tail-sim', 'aria-live': 'polite' });

    function compute() {
      var N = +n.value, P = +p.value;
      nOut.textContent = N + (N === 1 ? ' llamada' : ' llamadas');
      prob.textContent = F.pct(1 - Math.pow(1 - P, N), 1);
      grid.innerHTML = '';
      for (var i = 0; i < N; i++) grid.appendChild(h('span', { class: 'tail-cell' }));
      sim.textContent = '';
    }

    function simulate(times) {
      var N = +n.value, P = +p.value;
      if (times === 1) {
        var slow = 0;
        grid.querySelectorAll('.tail-cell').forEach(function (c) {
          var s = Math.random() < P;
          c.classList.toggle('is-slow', s);
          if (s) slow++;
        });
        sim.textContent = slow
          ? 'Esta request esperó a ' + slow + (slow === 1 ? ' llamada lenta' : ' llamadas lentas') + ' de ' + N + ': el usuario la vio lenta.'
          : 'Esta vez ninguna de las ' + N + ' llamadas fue lenta: la request fue rápida.';
      } else {
        var slowReqs = 0;
        for (var r = 0; r < times; r++) {
          for (var i = 0; i < N; i++) { if (Math.random() < P) { slowReqs++; break; } }
        }
        sim.textContent = 'De ' + F.num(times) + ' requests simuladas, ' + F.num(slowReqs) + ' fueron lentas (' + F.pct(slowReqs / times, 1) + ').';
      }
    }

    n.addEventListener('input', compute);
    p.addEventListener('change', compute);

    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Una request que llama a N servidores en paralelo' })]));
    host.appendChild(h('div', { class: 'calc-pad tail-layout' }, [
      h('div', { class: 'tail-controls' }, [
        h('div', { class: 'field' }, [h('label', { for: nId }, ['Fan-out: ', nOut]), n]),
        h('div', { class: 'field' }, [h('label', { for: pId, text: 'Probabilidad de que una llamada sea lenta' }), p]),
        h('div', { class: 'tail-result' }, [
          h('p', { class: 'out-label', text: 'Requests que terminan siendo lentas' }),
          prob,
          h('p', { class: 'out-formula', text: '1 − (1 − p)^N' })
        ]),
        h('div', { class: 'tail-buttons' }, [
          h('button', { type: 'button', class: 'btn', text: 'Simular una request', onclick: function () { simulate(1); } }),
          h('button', { type: 'button', class: 'btn btn--ghost', text: 'Simular 10 000', onclick: function () { simulate(10000); } })
        ]),
        sim
      ]),
      grid
    ]));
    compute();
  }

  var CALCS = { envelope: envelope, availability: availability, tail: tail };

  SD.ready(function () {
    document.querySelectorAll('[data-calc]').forEach(function (el) {
      var fn = CALCS[el.getAttribute('data-calc')];
      if (fn) fn(el); else console.warn('[SD calc] calculadora desconocida:', el.getAttribute('data-calc'));
    });
  });
})();
