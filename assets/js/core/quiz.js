/* Quizzes y checkpoints.
   <div data-quiz="m00"></div>        renderiza el quiz registrado con SD.defineQuiz
   <div data-checkpoint="m00"></div>  botón "Marcar como completado", habilitado al aprobar
   Tipos de pregunta: single (una correcta), multi (varias correctas), order (ordenar pasos). */
(function () {
  'use strict';

  var SD = window.SD;
  var h = SD.h;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function html(tag, cls, markup) {
    var el = h(tag, { class: cls });
    el.innerHTML = markup;
    return el;
  }

  function feedbackBox(q, ok, extra) {
    var fb = h('div', { class: 'q-feedback ' + (ok ? 'ok' : 'bad'), tabindex: '-1' });
    fb.appendChild(h('p', { class: 'q-feedback-title' }, [
      h('span', { class: 'q-feedback-icon', 'aria-hidden': 'true', text: ok ? '✓' : '✕' }),
      ok ? 'Correcto' : 'No es correcto'
    ]));
    if (extra) fb.appendChild(extra);
    fb.appendChild(html('p', 'q-explain', q.explain));
    return fb;
  }

  /* ---------- Opción única / múltiple ---------- */

  function choiceQuestion(q, li, done) {
    var multi = q.type === 'multi';
    var answer = multi ? q.answer.slice() : [q.answer];
    var order = q.fixed ? q.options.map(function (_, i) { return i; }) : SD.shuffle(q.options.map(function (_, i) { return i; }));
    var wrap = h('div', { class: 'q-opts', role: 'group', 'aria-label': 'Opciones de respuesta' });
    var btns = [];
    var fbHost = h('div', { 'aria-live': 'polite' });
    var locked = false;

    order.forEach(function (idx) {
      var b = h('button', { type: 'button', class: 'opt', 'aria-pressed': 'false', 'data-idx': idx }, [
        h('span', { class: 'opt-mark', 'aria-hidden': 'true' }),
        html('span', 'opt-text', q.options[idx])
      ]);
      btns.push(b);
      wrap.appendChild(b);
    });
    li.appendChild(wrap);

    function lockAndMark(selected) {
      locked = true;
      var ok = selected.length === answer.length && selected.every(function (i) { return answer.indexOf(i) >= 0; });
      btns.forEach(function (b) {
        var idx = +b.getAttribute('data-idx');
        var isAns = answer.indexOf(idx) >= 0, isSel = selected.indexOf(idx) >= 0;
        b.setAttribute('aria-disabled', 'true');
        var mark = b.querySelector('.opt-mark');
        if (isSel && isAns) { b.classList.add('is-correct'); mark.textContent = '✓'; }
        else if (isSel && !isAns) { b.classList.add('is-wrong'); mark.textContent = '✕'; }
        else if (!isSel && isAns) { b.classList.add('is-missed'); mark.textContent = '✓'; }
        if (isAns) b.appendChild(h('span', { class: 'visually-hidden', text: ' (respuesta correcta)' }));
      });
      fbHost.appendChild(feedbackBox(q, ok));
      done(ok);
    }

    if (!multi) {
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          if (locked) return;
          b.setAttribute('aria-pressed', 'true');
          lockAndMark([+b.getAttribute('data-idx')]);
        });
      });
    } else {
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          if (locked) return;
          b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
          check.disabled = !btns.some(function (x) { return x.getAttribute('aria-pressed') === 'true'; });
        });
      });
      var check = h('button', { type: 'button', class: 'btn q-check', disabled: true, text: 'Comprobar respuesta' });
      check.addEventListener('click', function () {
        var sel = btns.filter(function (x) { return x.getAttribute('aria-pressed') === 'true'; })
          .map(function (x) { return +x.getAttribute('data-idx'); });
        check.remove();
        lockAndMark(sel);
        fbHost.lastChild.focus({ preventScroll: true });
      });
      li.appendChild(check);
    }
    li.appendChild(fbHost);
  }

  /* ---------- Ordenar pasos ---------- */

  function orderQuestion(q, li, done) {
    var correct = q.items.map(function (_, i) { return i; });
    var cur = SD.shuffle(correct);
    var guard = 0;
    while (cur.length > 1 && cur.every(function (v, i) { return v === i; }) && guard++ < 10) cur = SD.shuffle(correct);

    var list = h('ol', { class: 'order-list' });
    var check = h('button', { type: 'button', class: 'btn q-check', text: 'Comprobar orden' });
    var fbHost = h('div', { 'aria-live': 'polite' });
    var locked = false;

    function move(pos, delta, focusDir) {
      var to = pos + delta;
      if (to < 0 || to >= cur.length) return;
      var t = cur[pos]; cur[pos] = cur[to]; cur[to] = t;
      render();
      var btn = list.children[to] && list.children[to].querySelector('[data-dir="' + focusDir + '"]');
      if (btn && !btn.disabled) btn.focus();
      else if (list.children[to]) list.children[to].querySelector('button:not([disabled])').focus();
    }

    function render() {
      list.innerHTML = '';
      cur.forEach(function (itemIdx, pos) {
        var row = h('li', { class: 'order-item' }, [
          h('span', { class: 'ord-n', text: String(pos + 1) }),
          html('span', 'ord-text', q.items[itemIdx])
        ]);
        if (!locked) {
          var up = h('button', { type: 'button', class: 'icon-btn', 'data-dir': 'up', 'aria-label': 'Subir: ' + q.items[itemIdx].replace(/<[^>]+>/g, ''), disabled: pos === 0 }, ['↑']);
          var down = h('button', { type: 'button', class: 'icon-btn', 'data-dir': 'down', 'aria-label': 'Bajar: ' + q.items[itemIdx].replace(/<[^>]+>/g, ''), disabled: pos === cur.length - 1 }, ['↓']);
          up.addEventListener('click', function () { move(pos, -1, 'up'); });
          down.addEventListener('click', function () { move(pos, 1, 'down'); });
          row.appendChild(h('span', { class: 'ord-btns' }, [up, down]));
        } else {
          var good = itemIdx === pos;
          row.classList.add(good ? 'is-correct' : 'is-wrong');
          row.appendChild(h('span', { class: 'ord-mark', 'aria-label': good ? 'posición correcta' : 'posición incorrecta', text: good ? '✓' : '✕' }));
        }
        list.appendChild(row);
      });
    }

    check.addEventListener('click', function () {
      locked = true;
      var ok = cur.every(function (v, i) { return v === i; });
      render();
      check.remove();
      var extra = null;
      if (!ok) {
        extra = h('ol', { class: 'order-solution' });
        q.items.forEach(function (it) { extra.appendChild(html('li', '', it)); });
        extra = h('div', {}, [h('p', { class: 'q-sub', text: 'Orden correcto:' }), extra]);
      }
      fbHost.appendChild(feedbackBox(q, ok, extra));
      fbHost.lastChild.focus({ preventScroll: true });
      done(ok);
    });

    render();
    li.appendChild(list);
    li.appendChild(check);
    li.appendChild(fbHost);
  }

  /* ---------- Quiz completo ---------- */

  function renderQuiz(host, id) {
    var quiz = SD.data.quizzes[id];
    host.innerHTML = '';
    if (!quiz) {
      console.warn('[SD quiz] no existe el quiz', id);
      host.appendChild(h('p', { text: 'Este quiz todavía no está disponible.' }));
      return;
    }
    host.classList.add('quiz');
    var pass = quiz.pass || 0.7;
    var qs = quiz.questions;
    var needed = Math.ceil(pass * qs.length - 1e-9);
    var results = {};
    var prev = SD.progress.get(id);
    var best = prev && prev.quiz ? prev.quiz.best : null;

    var meter = h('div', { class: 'quiz-meter', 'aria-hidden': 'true' });
    qs.forEach(function (q) { meter.appendChild(h('span', { class: 'qm-seg', 'data-q': q.id })); });
    var status = h('p', { class: 'quiz-status', 'aria-live': 'polite' });

    var sub = qs.length + ' preguntas. Apruebas con ' + needed + ' correctas al primer intento.';
    if (best != null) sub += ' Tu mejor resultado hasta ahora: ' + Math.round(best * 100) + ' %.';
    host.appendChild(h('div', { class: 'quiz-head' }, [
      h('div', { class: 'quiz-head-text' }, [
        h('p', { class: 'quiz-title', text: quiz.title || 'Quiz del módulo' }),
        h('p', { class: 'quiz-sub', text: sub })
      ]),
      h('div', { class: 'quiz-progress' }, [meter, status])
    ]));

    var list = h('ol', { class: 'quiz-list' });
    qs.forEach(function (q, i) {
      var type = q.type || 'single';
      var li = h('li', { class: 'q', 'data-type': type });
      var hint = type === 'multi' ? ' Elige todas las correctas.' : type === 'order' ? ' Ordena de primero a último.' : '';
      li.appendChild(h('p', { class: 'q-num', text: 'Pregunta ' + (i + 1) + ' de ' + qs.length + '.' + hint }));
      li.appendChild(html('p', 'q-prompt', q.prompt));
      var cb = function (ok) { onAnswer(q, ok); };
      if (type === 'order') orderQuestion(q, li, cb); else choiceQuestion(q, li, cb);
      list.appendChild(li);
    });
    host.appendChild(list);

    var result = h('div', { class: 'quiz-result', hidden: true });
    host.appendChild(result);
    updateStatus();

    function count() { return Object.keys(results).filter(function (k) { return results[k]; }).length; }

    function updateStatus() {
      var n = Object.keys(results).length;
      status.textContent = 'Respondidas ' + n + ' de ' + qs.length + ', ' + count() + (count() === 1 ? ' correcta' : ' correctas');
    }

    function onAnswer(q, ok) {
      results[q.id] = ok;
      meter.querySelector('[data-q="' + q.id + '"]').classList.add(ok ? 'is-ok' : 'is-bad');
      updateStatus();
      if (Object.keys(results).length === qs.length) finish();
    }

    function finish() {
      var correct = count();
      var score = correct / qs.length;
      var passed = score >= pass - 1e-9;
      SD.progress.recordQuiz(id, score);
      result.hidden = false;
      result.className = 'quiz-result ' + (passed ? 'is-pass' : 'is-fail');
      result.innerHTML = '';
      result.setAttribute('role', 'status');
      result.appendChild(h('p', { class: 'quiz-score', text: correct + ' de ' + qs.length + ' correctas' }));
      result.appendChild(h('p', {
        class: 'quiz-verdict',
        text: passed
          ? 'Aprobaste. Ya puedes marcar el módulo como completado aquí abajo.'
          : 'Te faltaron ' + (needed - correct) + ' para aprobar. Repasa las explicaciones y vuelve a intentarlo: las opciones cambian de orden.'
      }));
      result.appendChild(h('button', {
        type: 'button', class: 'btn', text: 'Reintentar el quiz',
        onclick: function () {
          renderQuiz(host, id);
          host.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
          var first = host.querySelector('.opt, .icon-btn');
          if (first) first.focus({ preventScroll: true });
        }
      }));
    }
  }

  /* ---------- Checkpoint ---------- */

  function renderCheckpoint(host) {
    var id = host.getAttribute('data-checkpoint');
    var quiz = SD.data.quizzes[id];
    var pass = quiz ? (quiz.pass || 0.7) : 0.7;

    function render() {
      var hadFocus = host.contains(document.activeElement);
      var done = SD.progress.isComplete(id);
      var passed = !quiz || SD.progress.quizPassed(id, pass);
      host.innerHTML = '';
      host.className = 'checkpoint' + (done ? ' is-done' : passed ? ' is-ready' : '');

      var sub;
      if (done) {
        var at = new Date(SD.progress.get(id).completedAt);
        sub = 'Lo marcaste el ' + at.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) + '. La ruta del curso ya lo muestra como completado.';
      } else if (passed) {
        sub = 'Aprobaste el quiz. Márcalo para registrarlo en tu ruta.';
      } else {
        sub = 'Se habilita cuando apruebes el quiz con al menos ' + Math.round(pass * 100) + ' %.';
      }

      host.appendChild(h('span', { class: 'cp-marker', 'aria-hidden': 'true' }));
      host.appendChild(h('div', { class: 'cp-text' }, [
        h('p', { class: 'cp-title', text: done ? 'Módulo completado' : 'Checkpoint del módulo' }),
        h('p', { class: 'cp-sub', text: sub })
      ]));
      var btn = done
        ? h('button', { type: 'button', class: 'btn btn--ghost', text: 'Desmarcar', onclick: function () { SD.progress.uncomplete(id); } })
        : h('button', { type: 'button', class: 'btn btn--primary', text: 'Marcar como completado', disabled: !passed, onclick: function () { SD.progress.complete(id); } });
      host.appendChild(btn);
      if (hadFocus) btn.focus();
    }

    render();
    window.addEventListener('sd:progress', render);
  }

  /* Las preguntas sueltas también las usan los ejercicios guiados (core/exercise.js) */
  SD.quizKit = { choice: choiceQuestion, order: orderQuestion, html: html };

  SD.ready(function () {
    document.querySelectorAll('[data-quiz]').forEach(function (el) { renderQuiz(el, el.getAttribute('data-quiz')); });
    document.querySelectorAll('[data-checkpoint]').forEach(renderCheckpoint);
  });
})();
