/* Progreso del curso en localStorage.
   Todo acceso va en try/catch: en modo privado, con el almacenamiento bloqueado
   o en una vista previa, el curso funciona igual con un estado en memoria. */
(function () {
  'use strict';

  var SD = window.SD;
  var KEY = 'sd-course-v1';
  var state = null;

  function blank() { return { v: 1, modules: {}, last: null }; }

  function valid(d) { return d && d.v === 1 && d.modules && typeof d.modules === 'object'; }

  function load() {
    if (state) return state;
    var data = null;
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) { data = null; }
    state = valid(data) ? data : blank();
    return state;
  }

  function persist() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* sin almacenamiento: queda en memoria */ }
  }

  function save() {
    persist();
    window.dispatchEvent(new CustomEvent('sd:progress', { detail: state }));
  }

  function mod(id) {
    var d = load();
    return d.modules[id] || (d.modules[id] = {});
  }

  /* Otra pestaña cambió el progreso: recargar y avisar */
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    state = null;
    load();
    window.dispatchEvent(new CustomEvent('sd:progress', { detail: state }));
  });

  SD.progress = {
    get: function (id) { return load().modules[id] || null; },

    all: function () { return load(); },

    visit: function (id) {
      var m = mod(id), now = Date.now();
      if (!m.firstVisit) m.firstVisit = now;
      m.lastVisit = now;
      save();
    },

    recordQuiz: function (id, score) {
      var m = mod(id);
      var q = m.quiz || (m.quiz = { best: 0, attempts: 0 });
      q.attempts += 1;
      q.last = score;
      if (score > q.best) q.best = score;
      save();
      return q;
    },

    quizPassed: function (id, pass) {
      var m = load().modules[id];
      return !!(m && m.quiz && m.quiz.best >= pass);
    },

    complete: function (id) { mod(id).completedAt = Date.now(); save(); },

    uncomplete: function (id) { delete mod(id).completedAt; save(); },

    isComplete: function (id) {
      var m = load().modules[id];
      return !!(m && m.completedAt);
    },

    /* Posición de lectura: se guarda sin emitir evento (cambia con el scroll) */
    setLast: function (last) { load().last = last; persist(); },

    last: function () { return load().last; },

    exportJSON: function () { return JSON.stringify(load(), null, 2); },

    importJSON: function (text) {
      var data = JSON.parse(text);
      if (!valid(data)) throw new Error('El archivo no tiene el formato de progreso del curso.');
      state = data;
      save();
    },

    reset: function () { state = blank(); save(); }
  };
})();
