/* Widgets del M26 (entrenamiento y fine-tuning):
   <div data-calc="trainmem">  memoria de un entrenamiento (16 B/param de Adam) y cuántas GPUs con data parallel vs ZeRO-3
   <div data-calc="ckpt">       intervalo óptimo de checkpoint con la fórmula de Young/Daly */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt, LLM = SD.data.llm;
  var RESERVE = 8e9;          /* GB por GPU para activaciones, buffers de comunicación y el framework */
  var uid = 0;

  function select(label, opts, value) {
    var id = 't' + (++uid);
    var s = h('select', { id: id });
    opts.forEach(function (o) { s.appendChild(h('option', { value: o[0], text: o[1] })); });
    s.value = value;
    return { el: h('div', { class: 'field' }, [h('label', { for: id, text: label }), s]), input: s };
  }
  function number(label, value, step, hint) {
    var id = 't' + (++uid);
    var i = h('input', { id: id, type: 'number', inputmode: 'decimal', min: 0, step: step || 'any', value: value });
    var kids = [h('label', { for: id, text: label }), i];
    if (hint) kids.push(h('p', { class: 'field-hint', text: hint }));
    return { el: h('div', { class: 'field' }, kids), input: i };
  }
  function outRow(label, formula) {
    var value = h('output', { class: 'out-value' });
    return { el: h('div', { class: 'out-row' }, [h('span', { class: 'out-label', text: label }), value, h('span', { class: 'out-formula', text: formula })]), value: value };
  }

  var MODEL_OPTS = ['llama8b', 'llama70b', 'llama405b', 'gpt3'].map(function (k) { return [k, LLM.models[k].name]; });
  var GPU_OPTS = ['a100', 'h100', 'h200', 'b200'].map(function (k) { return [k, LLM.gpus[k].name + ' (' + F.bytes(LLM.gpus[k].mem) + ')']; });

  /* ======================= Memoria de entrenamiento ======================= */

  function trainmem(host) {
    var f = {
      model: select('Modelo', MODEL_OPTS, 'llama70b'),
      gpu: select('GPU', GPU_OPTS, 'h100')
    };
    var o = {
      states: outRow('Estados del modelo', '16 bytes × parámetros (precisión mixta con Adam)'),
      detail: outRow('De esos 16 bytes', '2 peso fp16 + 2 grad fp16 + 4 copia fp32 + 4 momento + 4 varianza'),
      dp: outRow('Data parallel: por GPU', 'cada GPU guarda el modelo entero'),
      dpfit: outRow('¿Entra en una GPU?', 'estados + 8 GB de reserva ≤ memoria de la GPU'),
      zero: outRow('ZeRO-3 / FSDP: GPUs mínimas', 'reparte los estados: ⌈estados ÷ (memoria − 8 GB)⌉'),
      zeroper: outRow('ZeRO-3: por GPU en esas GPUs', 'estados ÷ GPUs')
    };
    var note = h('p', { class: 'calc-note', 'aria-live': 'polite' });

    function compute() {
      var m = LLM.models[f.model.input.value], g = LLM.gpus[f.gpu.input.value];
      var P = m.params, S = 16 * P, usable = g.mem - RESERVE;
      o.states.value.textContent = F.bytes(S);
      o.detail.value.textContent = '16 B/param';
      o.dp.value.textContent = F.bytes(S);
      o.dpfit.value.textContent = (S + RESERVE <= g.mem) ? 'sí' : 'no';
      if (usable <= 0) { ['zero', 'zeroper'].forEach(function (k) { o[k].value.textContent = '—'; }); note.textContent = 'La reserva no deja memoria libre en esta GPU.'; return; }
      var n = Math.ceil(S / usable);
      o.zero.value.textContent = F.num(n, 0) + (n > 8 ? ' (' + Math.ceil(n / 8) + ' servidores de 8)' : '');
      o.zeroper.value.textContent = F.bytes(S / n);
      var msgs = [];
      if (S + RESERVE > g.mem) msgs.push('El modelo entero no entra en una sola GPU: data parallel por sí solo no alcanza, hay que repartir los estados (ZeRO-3/FSDP) o el modelo (tensor y pipeline, M15).');
      msgs.push('Faltan las activaciones, que dependen del batch y del largo de secuencia y se recortan con recomputación; aquí solo se cuentan los estados.');
      note.textContent = msgs.join(' ');
    }

    f.model.input.addEventListener('change', compute);
    f.gpu.input.addEventListener('change', compute);
    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    [f.model, f.gpu].forEach(function (x) { inCol.appendChild(x.el); });
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });
    outCol.appendChild(note);
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'La memoria de un entrenamiento' })]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Entrenar con Adam en precisión mixta cuesta unos 16 bytes por parámetro, ocho veces los 2 bytes que ocupa el modelo para servir (M13). El optimizador, no los pesos, es lo que llena la GPU.' }));
    compute();
  }

  /* ======================= Intervalo óptimo de checkpoint (Young/Daly) ======================= */

  function ckpt(host) {
    var f = {
      size: number('Tamaño del checkpoint (GB)', 1130, 10, 'Los estados del entrenamiento: 16 B/param. Un modelo de 70B son ~1130 GB.'),
      bw: number('Velocidad de escritura (GB/s)', 20, 1, 'Al almacenamiento donde se guarda, sumando todas las GPUs.'),
      mtbf: number('MTBF del clúster (horas)', 3, 0.5, 'Tiempo medio entre fallas. Llama 3: una interrupción cada 3 h sobre 16 384 H100.')
    };
    var o = {
      c: outRow('Costo de un checkpoint (C)', 'tamaño ÷ velocidad de escritura'),
      topt: outRow('Intervalo óptimo (Young/Daly)', 'T ≈ √(2 × MTBF × C)'),
      waste: outRow('Tiempo perdido en el óptimo', 'escribir (C ÷ T) + rehacer trabajo (T ÷ 2·MTBF)'),
      hourly: outRow('Si guardaras cada hora', 'tiempo perdido con T = 1 h, para comparar')
    };
    var note = h('p', { class: 'calc-note', 'aria-live': 'polite' });

    function v(k) { var x = parseFloat(f[k].input.value); return isFinite(x) && x > 0 ? x : 0; }
    function wasteAt(T, C, mu) { return C / T + T / (2 * mu); }     /* fracción de tiempo no productivo */

    function compute() {
      var size = v('size'), bw = v('bw'), mu = v('mtbf');
      if (!size || !bw || !mu) { Object.keys(o).forEach(function (k) { o[k].value.textContent = '—'; }); note.textContent = 'Completa los tres valores.'; return; }
      var C = size / bw / 3600;                                     /* horas */
      var T = Math.sqrt(2 * mu * C);                                /* horas */
      o.c.value.textContent = F.num(C * 3600, 0) + ' s (' + F.num(C * 60, 1) + ' min)';
      o.topt.value.textContent = F.num(T * 60, 0) + ' min (cada ' + F.num(T, 2) + ' h)';
      o.waste.value.textContent = F.pct(wasteAt(T, C, mu), 1);
      o.hourly.value.textContent = F.pct(wasteAt(1, C, mu), 1);
      var msgs = [];
      msgs.push('Más fallas (MTBF menor) o checkpoints más baratos (C menor) ⇒ conviene guardar más seguido.');
      if (wasteAt(1, C, mu) > wasteAt(T, C, mu) * 1.3) msgs.push('Guardar cada hora acá desperdicia bastante más que el óptimo.');
      note.textContent = msgs.join(' ');
    }

    Object.keys(f).forEach(function (k) { f[k].input.addEventListener('input', compute); });
    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    Object.keys(f).forEach(function (k) { inCol.appendChild(f[k].el); });
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });
    outCol.appendChild(note);
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Cada cuánto guardar un checkpoint' })]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Fórmula de Young/Daly, una aproximación de primer orden válida cuando el checkpoint es corto frente al MTBF. Un checkpoint asíncrono baja C: copia a memoria rápido y escribe al disco en segundo plano.' }));
    compute();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-calc="trainmem"]').forEach(trainmem);
    document.querySelectorAll('[data-calc="ckpt"]').forEach(ckpt);
  });
})();
