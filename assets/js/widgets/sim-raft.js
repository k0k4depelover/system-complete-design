/* Simulador de Raft: <div data-sim="raft"></div>
   5 nodos, elecciones con timeouts aleatorios, replicación del log, commit por mayoría,
   caída de nodos y particiones de red. Tiempo simulado en ms, más lento que un Raft real para poder verlo. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;
  var NS = 'http://www.w3.org/2000/svg';

  var N = 5;
  var HEARTBEAT = 700, ELECT_MIN = 1800, ELECT_MAX = 3400, NET_MIN = 250, NET_MAX = 420;

  function Sim(onEvent) {
    this.onEvent = onEvent;
    this.reset();
  }

  Sim.prototype.reset = function () {
    this.t = 0;
    this.msgs = [];
    this.partition = null;          /* null o [grupoA, grupoB] */
    this.nodes = [];
    for (var i = 0; i < N; i++) {
      this.nodes.push({
        id: i, state: 'follower', term: 1, votedFor: null, log: [], commit: 0,
        alive: true, deadline: this.randDeadline(i === 0 ? 0 : 1), votes: {},
        nextIndex: [], matchIndex: [], hbAt: 0
      });
    }
    this.cmd = 0;
  };

  Sim.prototype.randDeadline = function (extra) {
    return this.t + ELECT_MIN + Math.random() * (ELECT_MAX - ELECT_MIN) + (extra || 0) * 400;
  };

  Sim.prototype.canTalk = function (a, b) {
    if (!this.nodes[a].alive || !this.nodes[b].alive) return false;
    if (!this.partition) return true;
    var inA = this.partition[0].indexOf(a) >= 0;
    return inA === (this.partition[0].indexOf(b) >= 0);
  };

  Sim.prototype.send = function (from, to, type, body) {
    this.msgs.push({ from: from, to: to, type: type, body: body, sent: this.t, arrive: this.t + NET_MIN + Math.random() * (NET_MAX - NET_MIN) });
  };

  Sim.prototype.lastIndex = function (n) { return n.log.length; };
  Sim.prototype.lastTerm = function (n) { return n.log.length ? n.log[n.log.length - 1].term : 0; };

  Sim.prototype.becomeFollower = function (n, term) {
    if (term > n.term) { n.term = term; n.votedFor = null; }
    if (n.state !== 'follower') n.state = 'follower';
    n.deadline = this.randDeadline();
  };

  Sim.prototype.startElection = function (n) {
    n.state = 'candidate'; n.term++; n.votedFor = n.id; n.votes = {}; n.votes[n.id] = true;
    n.deadline = this.randDeadline();
    this.onEvent('N' + (n.id + 1) + ' no escuchó al líder: inicia una elección en el término ' + n.term + '.');
    for (var i = 0; i < N; i++) if (i !== n.id) this.send(n.id, i, 'vote', { term: n.term, lastIndex: this.lastIndex(n), lastTerm: this.lastTerm(n) });
  };

  Sim.prototype.becomeLeader = function (n) {
    n.state = 'leader';
    for (var i = 0; i < N; i++) { n.nextIndex[i] = n.log.length + 1; n.matchIndex[i] = 0; }
    n.matchIndex[n.id] = n.log.length;
    this.onEvent('N' + (n.id + 1) + ' gana con los votos de ' + Object.keys(n.votes).map(function (k) { return 'N' + (+k + 1); }).join(', ') + ': es líder del término ' + n.term + '.');
    this.heartbeat(n);
  };

  Sim.prototype.heartbeat = function (n) {
    n.hbAt = this.t;
    for (var i = 0; i < N; i++) {
      if (i === n.id) continue;
      var prev = n.nextIndex[i] - 1;
      this.send(n.id, i, 'append', {
        term: n.term, prevIndex: prev, prevTerm: prev > 0 ? n.log[prev - 1].term : 0,
        entries: n.log.slice(prev), commit: n.commit
      });
    }
  };

  Sim.prototype.clientWrite = function () {
    var leader = this.nodes.filter(function (n) { return n.alive && n.state === 'leader'; });
    if (!leader.length) { this.onEvent('No hay líder: la escritura se rechaza. El cliente debe reintentar cuando haya uno.'); return false; }
    /* con partición puede haber dos "líderes": se escribe en el de término mayor… o en el viejo, para mostrar el problema */
    var target = leader.sort(function (a, b) { return a.term - b.term; })[0];
    this.cmd++;
    var letter = String.fromCharCode(64 + ((this.cmd - 1) % 26) + 1);
    target.log.push({ term: target.term, cmd: letter });
    target.matchIndex[target.id] = target.log.length;
    this.onEvent('El cliente escribe "' + letter + '" en N' + (target.id + 1) + ' (término ' + target.term + '). Queda sin confirmar hasta que la tenga una mayoría.');
    this.heartbeat(target);
    return true;
  };

  Sim.prototype.deliver = function (m) {
    var n = this.nodes[m.to], b = m.body;
    if (!n.alive) return;
    if (b.term > n.term) this.becomeFollower(n, b.term);

    if (m.type === 'vote') {
      var upToDate = b.lastTerm > this.lastTerm(n) || (b.lastTerm === this.lastTerm(n) && b.lastIndex >= this.lastIndex(n));
      var grant = b.term === n.term && (n.votedFor === null || n.votedFor === m.from) && upToDate;
      if (grant) { n.votedFor = m.from; n.deadline = this.randDeadline(); }
      this.send(n.id, m.from, 'voteReply', { term: n.term, granted: grant });
    } else if (m.type === 'voteReply') {
      if (n.state === 'candidate' && b.term === n.term && b.granted) {
        n.votes[m.from] = true;
        if (Object.keys(n.votes).length > N / 2) this.becomeLeader(n);
      }
    } else if (m.type === 'append') {
      if (b.term < n.term) { this.send(n.id, m.from, 'appendReply', { term: n.term, ok: false, match: 0 }); return; }
      if (n.state !== 'follower') n.state = 'follower';
      n.deadline = this.randDeadline();
      var ok = b.prevIndex === 0 || (n.log.length >= b.prevIndex && n.log[b.prevIndex - 1].term === b.prevTerm);
      if (ok) {
        var removed = n.log.length - b.prevIndex;
        var conflict = false;
        for (var i = 0; i < b.entries.length; i++) {
          var idx = b.prevIndex + i;
          if (n.log[idx] && n.log[idx].term !== b.entries[i].term) { n.log = n.log.slice(0, idx); conflict = true; }
          if (!n.log[idx]) n.log.push({ term: b.entries[i].term, cmd: b.entries[i].cmd });
        }
        if (conflict && removed > 0) this.onEvent('N' + (n.id + 1) + ' descarta entradas sin confirmar que no tiene el líder actual y copia las del líder.');
        var match = b.prevIndex + b.entries.length;
        if (b.commit > n.commit) n.commit = Math.min(b.commit, n.log.length);
        this.send(n.id, m.from, 'appendReply', { term: n.term, ok: true, match: match });
      } else {
        this.send(n.id, m.from, 'appendReply', { term: n.term, ok: false, match: 0 });
      }
    } else if (m.type === 'appendReply') {
      if (n.state !== 'leader' || b.term !== n.term) return;
      if (b.ok) {
        n.matchIndex[m.from] = Math.max(n.matchIndex[m.from] || 0, b.match);
        n.nextIndex[m.from] = n.matchIndex[m.from] + 1;
        this.advanceCommit(n);
      } else {
        n.nextIndex[m.from] = Math.max(1, (n.nextIndex[m.from] || 1) - 1);
      }
    }
  };

  Sim.prototype.advanceCommit = function (n) {
    for (var idx = n.log.length; idx > n.commit; idx--) {
      if (n.log[idx - 1].term !== n.term) continue;          /* solo entradas del término actual (regla de Raft) */
      var count = 0;
      for (var i = 0; i < N; i++) if ((i === n.id ? n.log.length : n.matchIndex[i] || 0) >= idx) count++;
      if (count > N / 2) {
        var prev = n.commit;
        n.commit = idx;
        var who = [];
        for (i = 0; i < N; i++) if ((i === n.id ? n.log.length : n.matchIndex[i] || 0) >= idx) who.push('N' + (i + 1));
        this.onEvent('Entrada ' + idx + ' ("' + n.log[idx - 1].cmd + '") confirmada: la tienen ' + who.join(', ') + ', una mayoría de 5.' + (idx - prev > 1 ? ' Las anteriores quedan confirmadas con ella.' : ''));
        break;
      }
    }
  };

  Sim.prototype.step = function (dt) {
    var end = this.t + dt;
    while (this.t < end) {
      this.t = Math.min(end, this.t + 10);
      var arrived = this.msgs.filter(function (m) { return m.arrive <= this.t; }, this);
      this.msgs = this.msgs.filter(function (m) { return m.arrive > this.t; }, this);
      for (var i = 0; i < arrived.length; i++) {
        var m = arrived[i];
        if (this.canTalk(m.from, m.to)) this.deliver(m);
      }
      for (i = 0; i < N; i++) {
        var n = this.nodes[i];
        if (!n.alive) continue;
        if (n.state === 'leader') { if (this.t - n.hbAt >= HEARTBEAT) this.heartbeat(n); }
        else if (this.t >= n.deadline) this.startElection(n);
      }
    }
  };

  /* ---------------- Vista ---------------- */

  function init(host) {
    var log = h('ol', { class: 'raft-log', 'aria-live': 'polite' });
    function event(text) {
      var li = h('li', {}, [h('span', { class: 'raft-t', text: (sim.t / 1000).toFixed(1) + ' s' }), text]);
      log.insertBefore(li, log.firstChild);
      while (log.children.length > 40) log.removeChild(log.lastChild);
    }
    var sim = new Sim(event);
    var W = 700, H = 380, cx = 190, cy = 190, R = 130;
    var pos = [];
    for (var i = 0; i < N; i++) { var a = -Math.PI / 2 + i * 2 * Math.PI / N; pos.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Cinco nodos Raft con su estado y su log');

    var speed = 1, running = true, last = null;
    var btnWrite = h('button', { type: 'button', class: 'btn btn--primary', text: 'Escritura del cliente' });
    var btnKill = h('button', { type: 'button', class: 'btn', text: 'Matar al líder' });
    var btnPart = h('button', { type: 'button', class: 'btn', text: 'Partir la red (2 | 3)' });
    var btnHeal = h('button', { type: 'button', class: 'btn btn--ghost', text: 'Reparar todo' });
    var btnPause = h('button', { type: 'button', class: 'btn btn--ghost', text: 'Pausa' });
    var spd = h('select', { class: 'sdm-speed', 'aria-label': 'Velocidad' }, [h('option', { value: '0.5', text: '0.5×' }), h('option', { value: '1', selected: true, text: '1×' }), h('option', { value: '2', text: '2×' })]);

    btnWrite.addEventListener('click', function () { sim.clientWrite(); });
    btnKill.addEventListener('click', function () {
      var l = sim.nodes.filter(function (n) { return n.alive && n.state === 'leader'; });
      if (!l.length) { event('No hay líder vivo que matar.'); return; }
      l.forEach(function (n) { n.alive = false; n.state = 'follower'; });
      event('N' + (l[0].id + 1) + ' muere. Los demás dejarán de recibir heartbeats y, al vencer su timeout, alguno iniciará una elección.');
    });
    btnPart.addEventListener('click', function () {
      var leader = sim.nodes.filter(function (n) { return n.alive && n.state === 'leader'; })[0];
      var li = leader ? leader.id : 0;
      var other = (li + 1) % N;
      var A = [li, other], B = [];
      for (var k = 0; k < N; k++) if (A.indexOf(k) < 0) B.push(k);
      sim.partition = [A, B];
      event('La red se parte: {' + A.map(function (x) { return 'N' + (x + 1); }).join(', ') + '} no ve a {' + B.map(function (x) { return 'N' + (x + 1); }).join(', ') + '}. El líder queda en la minoría: puede aceptar escrituras, pero nunca confirmarlas.');
    });
    btnHeal.addEventListener('click', function () {
      sim.partition = null;
      sim.nodes.forEach(function (n) { if (!n.alive) { n.alive = true; n.state = 'follower'; n.deadline = sim.randDeadline(); } });
      event('Red reparada y nodos revividos. Quien tenga un término menor se vuelve seguidor al ver uno mayor.');
    });
    btnPause.addEventListener('click', function () { running = !running; btnPause.textContent = running ? 'Pausa' : 'Continuar'; });
    spd.addEventListener('change', function () { speed = +spd.value; });

    function draw() {
      var s = '';
      if (sim.partition) {
        /* recta que separa los dos grupos: perpendicular a la dirección del grupo minoritario */
        var ax = 0, ay = 0;
        sim.partition[0].forEach(function (k) { ax += pos[k][0]; ay += pos[k][1]; });
        ax /= sim.partition[0].length; ay /= sim.partition[0].length;
        var th = Math.atan2(ay - cy, ax - cx), d = Math.hypot(ax - cx, ay - cy) * 0.55, L = R * 1.35;
        var mx = cx + Math.cos(th) * d, my = cy + Math.sin(th) * d;
        s += '<line x1="' + (mx - Math.sin(th) * L).toFixed(1) + '" y1="' + (my + Math.cos(th) * L).toFixed(1) + '" x2="' + (mx + Math.sin(th) * L).toFixed(1) + '" y2="' + (my - Math.cos(th) * L).toFixed(1) + '" stroke="var(--fail)" stroke-width="2" stroke-dasharray="7 6"/>';
        s += '<text class="sim-axis" x="' + (mx + Math.sin(th) * L).toFixed(1) + '" y="' + (my - Math.cos(th) * L - 6).toFixed(1) + '" text-anchor="middle" style="fill:var(--fail)">partición</text>';
      }
      sim.msgs.forEach(function (m) {
        var p = Math.min(1, (sim.t - m.sent) / (m.arrive - m.sent));
        var A = pos[m.from], B = pos[m.to];
        var x = A[0] + (B[0] - A[0]) * p, y = A[1] + (B[1] - A[1]) * p;
        var blocked = !sim.canTalk(m.from, m.to);
        var col = m.type === 'vote' || m.type === 'voteReply' ? 'var(--warn)' : m.type === 'append' ? 'var(--link)' : 'var(--ink-3)';
        s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (m.type === 'append' && m.body.entries.length ? 5 : 3.5) + '" fill="' + (blocked ? 'var(--fail)' : col) + '" opacity="' + (blocked ? 0.5 : 0.9) + '"/>';
      });
      sim.nodes.forEach(function (n, i) {
        var p = pos[i];
        var stroke = !n.alive ? 'var(--fail)' : n.state === 'leader' ? 'var(--ink)' : n.state === 'candidate' ? 'var(--warn)' : 'var(--l-service)';
        var fill = n.state === 'leader' && n.alive ? 'var(--accent-tint)' : 'var(--paper-2)';
        s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="34" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (n.state === 'leader' ? 3.5 : 2.2) + '"' + (!n.alive ? ' stroke-dasharray="5 4"' : '') + '/>';
        if (n.alive && n.state !== 'leader') {
          var left = Math.max(0, Math.min(1, (n.deadline - sim.t) / ELECT_MAX));
          var ang = left * 2 * Math.PI;
          var x1 = p[0], y1 = p[1] - 40, x2 = p[0] + Math.sin(ang) * 40, y2 = p[1] - Math.cos(ang) * 40;
          if (left > 0.01) s += '<path d="M' + x1 + ' ' + y1 + ' A40 40 0 ' + (ang > Math.PI ? 1 : 0) + ' 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + '" fill="none" stroke="var(--ink-3)" stroke-width="2"/>';
        }
        s += '<text class="sim-label" x="' + p[0] + '" y="' + (p[1] - 6) + '" text-anchor="middle" style="font-size:15px">N' + (i + 1) + '</text>';
        var role = !n.alive ? 'caído' : n.state === 'leader' ? 'líder' : n.state === 'candidate' ? 'candidato' : 'seguidor';
        s += '<text class="sim-axis" x="' + p[0] + '" y="' + (p[1] + 9) + '" text-anchor="middle">' + role + '</text>';
        s += '<text class="sim-axis" x="' + p[0] + '" y="' + (p[1] + 22) + '" text-anchor="middle">término ' + n.term + '</text>';
      });
      /* logs */
      var lx = 400;
      s += '<text class="sim-axis" x="' + lx + '" y="22">Log de cada nodo (relleno: confirmada; borde: sin confirmar)</text>';
      sim.nodes.forEach(function (n, i) {
        var y = 44 + i * 62;
        s += '<text class="sim-label" x="' + lx + '" y="' + (y + 20) + '">N' + (i + 1) + '</text>';
        n.log.slice(-10).forEach(function (e, j) {
          var offset = Math.max(0, n.log.length - 10);
          var idx = offset + j + 1;
          var committed = idx <= n.commit;
          var x = lx + 34 + j * 27;
          var hue = ['var(--l-service)', 'var(--l-gpu)', 'var(--l-queue)', 'var(--l-cache)', 'var(--l-db)', 'var(--l-edge)'][(e.term - 1) % 6];
          s += '<rect x="' + x + '" y="' + (y + 2) + '" width="23" height="26" rx="3" fill="' + (committed ? hue : 'var(--paper)') + '" stroke="' + hue + '" stroke-width="2"/>';
          s += '<text class="sim-val" x="' + (x + 11.5) + '" y="' + (y + 20) + '" text-anchor="middle" style="fill:' + (committed ? 'var(--paper)' : 'var(--ink)') + '">' + e.cmd + '</text>';
          s += '<text class="sim-axis" x="' + (x + 11.5) + '" y="' + (y + 42) + '" text-anchor="middle" style="font-size:9.5px">t' + e.term + '</text>';
        });
      });
      svg.innerHTML = s;
    }

    function frame(ts) {
      if (last == null) last = ts;
      var dt = Math.min(100, ts - last); last = ts;
      if (running && host.isConnected) sim.step(dt * speed);
      draw();
      requestAnimationFrame(frame);
    }

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Simulador de Raft: 5 nodos' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [btnWrite, btnKill, btnPart, btnHeal, btnPause, spd]),
      h('div', { class: 'sim-scroll' }, [svg]),
      h('p', { class: 'sim-note', text: 'Puntos amarillos: pedidos de voto. Azules: AppendEntries (heartbeats y entradas). Rojos: mensajes que la partición o una caída no dejan llegar. El arco sobre cada seguidor es el tiempo que le queda antes de iniciar una elección.' }),
      h('p', { class: 'raft-log-title', text: 'Qué está pasando' }),
      log
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Tiempos ralentizados para poder seguirlos: heartbeat cada 0.7 s, timeout de elección entre 1.8 y 3.4 s, 250 a 420 ms por mensaje. En un clúster real todo ocurre unas 10 a 100 veces más rápido.' }));
    event('Arranque: nadie es líder todavía. El primer nodo cuyo timeout venza pedirá votos.');
    requestAnimationFrame(frame);
  }

  SD.ready(function () { document.querySelectorAll('[data-sim="raft"]').forEach(init); });
})();
