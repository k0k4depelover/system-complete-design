/* Aplicación de conocimiento: arma el índice de mini-proyectos a partir de SD.data.projects.
   El estado de cada proyecto (sin empezar, en curso, terminado) sale de project-state.js. */
(function () {
  var h = SD.h;
  var TIER = { core: 'Núcleo', extra: 'Ampliación' };

  function modChips(mods) {
    if (!mods.length) return [h('span', { class: 'pj-chip', text: 'Transversal' })];
    return mods.map(function (id) {
      var it = SD.courseItem(id);
      if (!it) return null;
      var label = it.num + ' ' + (it.short || it.title);
      return it.status === 'ready'
        ? h('a', { class: 'pj-chip pj-chip--mod', href: it.href, text: label })
        : h('span', { class: 'pj-chip pj-chip--mod is-soon', title: 'Módulo en construcción', text: label });
    });
  }

  function stackChips(list) {
    return list.map(function (s) { return h('li', { class: 'pj-chip', text: s }); });
  }

  function stateChip(p) {
    var st = SD.projectState ? SD.projectState.status(p.id) : 'soon';
    return h('span', { class: 'pj-state', 'data-state': st, 'data-state-of': p.id, text: SD.projectStatusText[st] });
  }

  function title(p, tag, cls, id) {
    var ready = p.status === 'ready' && p.href;
    return h(tag, { class: cls, id: id || null }, [ready ? h('a', { href: p.href, text: p.title }) : p.title]);
  }

  function row(p) {
    var meta = [h('span', { class: 'pj-meta-label', text: 'Módulos' })].concat(modChips(p.mods));
    return h('li', { class: 'pj-row', id: p.id, 'data-tier': p.tier }, [
      h('span', { class: 'pj-num', text: p.num }),
      h('div', { class: 'pj-main' }, [
        title(p, 'h4', 'pj-title'),
        stateChip(p),
        h('p', { class: 'pj-excuse' }, [h('span', { class: 'pj-k', text: 'La excusa: ' }), p.excuse]),
        h('p', { class: 'pj-learn', text: p.learn }),
        h('div', { class: 'pj-meta' }, meta),
        h('ul', { class: 'pj-stack', 'aria-label': 'Stack de ' + p.num }, stackChips(p.stack).concat(
          p.front ? [h('li', { class: 'pj-chip pj-chip--front', text: 'Con frontend mínimo' })] : [])),
        p.status === 'ready' && p.href ? h('a', { class: 'pj-guide-link', href: p.href, text: 'Abrir la guía de ' + p.num }) : null
      ]),
      h('span', { class: 'pj-tier', text: TIER[p.tier] })
    ]);
  }

  function renderTracks(host, data) {
    data.tracks.forEach(function (t) {
      var core = t.items.filter(function (p) { return p.tier === 'core'; }).length;
      var extra = t.items.length - core;
      var parts = [];
      if (core) parts.push(core + (core === 1 ? ' proyecto de núcleo' : ' proyectos de núcleo'));
      if (extra) parts.push(extra + (core ? ' de ampliación' : (extra === 1 ? ' proyecto de ampliación' : ' proyectos de ampliación')));
      var meta = parts.join(' y ');
      var block = h('section', { class: 'part-block pj-track', style: '--line: var(' + t.line + ')', 'aria-labelledby': 'tr-' + t.id });
      block.appendChild(h('header', { class: 'part-head' }, [
        h('p', { class: 'part-label', text: t.label }),
        h('h3', { class: 'part-title', id: 'tr-' + t.id, text: t.title }),
        h('p', { class: 'part-intro', text: t.intro }),
        h('p', { class: 'part-meta', text: meta })
      ]));
      block.appendChild(h('ol', { class: 'pj-list' }, t.items.map(row)));
      host.appendChild(block);
    });
  }

  function renderCapstones(host, data) {
    var byId = {};
    data.tracks.forEach(function (t) { t.items.forEach(function (p) { byId[p.id] = p; }); });
    data.capstones.forEach(function (c) {
      var uses = c.uses.map(function (id) {
        var p = byId[id];
        return h('li', {}, [h('a', { class: 'pj-chip pj-chip--mod', href: '#' + id, text: p.num + ' ' + p.title })]);
      });
      host.appendChild(h('article', { class: 'pj-cap', id: c.id, 'aria-labelledby': c.id + '-t' }, [
        h('p', { class: 'pj-cap-num', text: c.num }),
        title(c, 'h3', 'pj-cap-title', c.id + '-t'),
        stateChip(c),
        h('p', { class: 'pj-excuse' }, [h('span', { class: 'pj-k', text: 'La excusa: ' }), c.excuse]),
        h('p', { class: 'pj-learn', text: c.learn }),
        h('p', { class: 'pj-meta-label', text: 'Junta lo que construiste en' }),
        h('ul', { class: 'pj-stack' }, uses)
      ]));
    });
  }

  function renderCount(host, data) {
    var core = 0, extra = 0, ready = 0, done = 0;
    data.tracks.forEach(function (t) {
      t.items.forEach(function (p) {
        if (p.tier === 'core') core++; else extra++;
        if (p.status === 'ready') ready++;
        if (SD.projectState && SD.projectState.status(p.id) === 'done') done++;
      });
    });
    host.textContent = core + ' proyectos de núcleo, ' + extra + ' de ampliación y ' + data.capstones.length +
      ' sistemas completos. ' + ready + (ready === 1 ? ' guía publicada' : ' guías publicadas') +
      (done ? '; ' + done + (done === 1 ? ' proyecto terminado.' : ' proyectos terminados.') : '.');
  }

  /* El plan por bloques: qué proyectos entran en cada uno y si sus guías están publicadas. */
  function renderBlocks(host, data) {
    var byId = {};
    SD.projectItems().forEach(function (p) { byId[p.id] = p; });
    data.blocks.forEach(function (b) {
      var items = b.items.map(function (id) { return byId[id]; }).filter(Boolean);
      var ready = items.filter(function (p) { return p.status === 'ready'; }).length;
      var stateText = ready === items.length ? 'Guías publicadas' : ready ? ready + ' de ' + items.length + ' guías publicadas' : 'Por escribir';
      host.appendChild(h('li', {}, [
        h('p', { class: 'pj-block-name', text: b.name }),
        h('p', { class: 'pj-block-items', text: items.map(function (p) { return p.num; }).join(', ') }),
        h('p', { class: 'pj-learn', text: b.note }),
        h('p', { class: 'pj-block-state' + (ready === items.length ? ' is-ready' : ''), text: stateText })
      ]));
    });
  }

  SD.ready(function () {
    var data = SD.data.projects;
    if (!data) return;
    var tracks = document.querySelector('[data-projects]');
    var caps = document.querySelector('[data-capstones]');
    var count = document.querySelector('[data-projects-count]');
    var blocks = document.querySelector('[data-project-blocks]');
    if (tracks) renderTracks(tracks, data);
    if (caps) renderCapstones(caps, data);
    if (count) renderCount(count, data);
    if (blocks) renderBlocks(blocks, data);
  });
})();
