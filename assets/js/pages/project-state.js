/* Estado de los mini-proyectos: el enlace a tu repositorio y la lista de comprobación de cada guía.
   Lo usan proyectos.html (índice) y cada guía de proyectos/.
   Se guarda en localStorage dentro de try/catch: en modo privado el estado vive en memoria.
   Un proyecto está terminado cuando tiene enlace a su repositorio y todas las comprobaciones marcadas.
   El campo repo de projects.data.js, si está, cuenta como el enlace publicado. */
(function () {
  'use strict';

  var SD = window.SD;
  var KEY = 'sd-projects-v1';
  var mem = null;

  function load() {
    if (mem) return mem;
    try { mem = JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; } catch (e) { mem = {}; }
    return mem;
  }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* sin almacenamiento: queda en memoria */ }
    try { window.dispatchEvent(new CustomEvent('sd:projects')); } catch (e) { /* navegador sin CustomEvent */ }
  }

  function entry(id) {
    var all = load();
    return all[id] || (all[id] = { repo: '', checks: {}, total: 0 });
  }

  /* ---------- Modelo: proyectos y sistemas completos en orden ---------- */

  /* series: 'a' para los proyectos en Java y los sistemas completos; 'ia' para los tutoriales de AI Engineering. */
  SD.projectItems = function () {
    var d = SD.data.projects, out = [];
    if (!d) return out;
    d.tracks.forEach(function (t) {
      t.items.forEach(function (p) { out.push(Object.assign({ track: t, series: 'a' }, p)); });
    });
    d.capstones.forEach(function (c) { out.push(Object.assign({ track: null, capstone: true, series: 'a' }, c)); });
    (d.aiTracks || []).forEach(function (t) {
      t.items.forEach(function (p) { out.push(Object.assign({ track: t, series: 'ia' }, p)); });
    });
    return out;
  };

  SD.projectItem = function (id) {
    var items = SD.projectItems();
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  };

  /* Un enlace aceptable: https y con un host. */
  SD.validRepo = function (url) {
    try {
      var u = new URL(String(url).trim());
      return u.protocol === 'https:' && u.hostname.indexOf('.') > 0;
    } catch (e) { return false; }
  };

  SD.projectState = {
    get: function (id) {
      var s = load()[id] || {};
      return { repo: s.repo || '', checks: s.checks || {}, total: s.total || 0 };
    },
    /* El enlace que cuenta: el publicado en projects.data.js o el que guardaste en este navegador. */
    repoOf: function (id) {
      var p = SD.projectItem(id);
      return (p && p.repo) || this.get(id).repo;
    },
    setRepo: function (id, url) { entry(id).repo = url; save(); },
    setCheck: function (id, key, on, total) {
      var e = entry(id);
      if (on) e.checks[key] = true; else delete e.checks[key];
      if (total) e.total = total;
      save();
    },
    setTotal: function (id, total) {
      var e = entry(id);
      if (e.total !== total) { e.total = total; save(); }
    },
    /* soon (sin guía) | new | started | done */
    status: function (id) {
      var p = SD.projectItem(id);
      if (!p || p.status !== 'ready') return 'soon';
      var s = this.get(id), repo = this.repoOf(id);
      var n = Object.keys(s.checks).length;
      if (repo && s.total && n >= s.total) return 'done';
      return repo || n ? 'started' : 'new';
    }
  };

  SD.projectStatusText = { soon: 'Guía en preparación', new: 'Sin empezar', started: 'En curso', done: 'Terminado' };
})();
