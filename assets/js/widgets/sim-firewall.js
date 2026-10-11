/* Un paquete contra una cadena de reglas (M32): <div data-sim="firewall"></div>
   El lector elige un juego de reglas de nftables y un paquete. El widget recorre la cadena que corresponde
   (input para lo que entra, output para lo que sale) regla por regla, en orden, hasta la primera que hace
   match, y si ninguna coincide aplica la política de la cadena. Muestra el veredicto, si es el que querías y
   por qué. Reproduce las reglas de nftables: la primera regla con veredicto (accept o drop) termina la
   evaluación de la cadena; el estado sale del seguimiento de conexiones (conntrack). */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;

  var OFICINA = '203.0.113.0/24';
  function inOficina(ip) { return ip.indexOf('203.0.113.') === 0; }

  /* Reglas: txt (lo que se ve), test(p) (si coincide), v (veredicto) y why (por qué coincide o no) */
  var R = {
    est: { txt: 'ct state established,related accept', v: 'accept',
      test: function (p) { return p.state === 'established'; },
      no: 'el paquete no pertenece a una conexión conocida' },
    inv: { txt: 'ct state invalid drop', v: 'drop',
      test: function (p) { return p.state === 'invalid'; },
      no: 'no es un paquete inválido' },
    lo: { txt: 'iif "lo" accept', v: 'accept',
      test: function (p) { return p.iface === 'lo'; },
      no: 'no llega por la interfaz de loopback' },
    web: { txt: 'tcp dport { 80, 443 } accept', v: 'accept',
      test: function (p) { return p.dir === 'in' && p.proto === 'tcp' && (p.dport === 80 || p.dport === 443); },
      no: 'el puerto de destino no es 80 ni 443' },
    sshAny: { txt: 'tcp dport 22 accept   # "temporal"', v: 'accept',
      test: function (p) { return p.proto === 'tcp' && p.dport === 22; },
      no: 'el puerto de destino no es 22' },
    sshOf: { txt: 'ip saddr ' + OFICINA + ' tcp dport 22 accept', v: 'accept',
      test: function (p) { return p.proto === 'tcp' && p.dport === 22 && inOficina(p.src); },
      no: function (p) { return p.dport === 22 ? 'el 22 coincide, pero el origen no es la red de la oficina' : 'el puerto de destino no es 22'; } },
    outWeb: { txt: 'tcp dport { 80, 443 } accept   # repos, APIs', v: 'accept',
      test: function (p) { return p.proto === 'tcp' && (p.dport === 80 || p.dport === 443); },
      no: 'el puerto de destino no es 80 ni 443' },
    outDns: { txt: 'ip daddr 10.0.0.2 udp dport 53 accept   # tu resolver', v: 'accept',
      test: function (p) { return p.proto === 'udp' && p.dport === 53 && p.dst === '10.0.0.2'; },
      no: function (p) { return p.dport === 53 ? 'es DNS, pero no va a tu resolver 10.0.0.2' : 'no es DNS hacia tu resolver'; } },
    outNtp: { txt: 'udp dport 123 accept   # NTP', v: 'accept',
      test: function (p) { return p.proto === 'udp' && p.dport === 123; },
      no: 'no es NTP' }
  };

  var SETS = [
    { id: 'ok', label: 'Con estado (recomendado)',
      input: { policy: 'drop', rules: ['est', 'inv', 'lo', 'web', 'sshOf'] },
      output: { policy: 'drop', rules: ['est', 'outWeb', 'outDns', 'outNtp'] },
      note: 'Política drop en las dos direcciones, conntrack primero y después solo lo que este servidor necesita.' },
    { id: 'sin', label: 'Sin estado (sin conntrack)',
      input: { policy: 'drop', rules: ['lo', 'web', 'sshOf'] },
      output: { policy: 'drop', rules: ['outWeb', 'outDns', 'outNtp'] },
      note: 'Las mismas reglas de puertos, sin las dos de conntrack. Así razona un filtro sin estado, como una NACL.' },
    { id: 'orden', label: 'Una regla de más, antes',
      input: { policy: 'drop', rules: ['est', 'inv', 'lo', 'web', 'sshAny', 'sshOf'] },
      output: { policy: 'drop', rules: ['est', 'outWeb', 'outDns', 'outNtp'] },
      note: 'Alguien agregó "tcp dport 22 accept" para una prueba y quedó antes de la regla de la oficina.' },
    { id: 'abierta', label: 'Salida sin filtrar',
      input: { policy: 'drop', rules: ['est', 'inv', 'lo', 'web', 'sshOf'] },
      output: { policy: 'accept', rules: [] },
      note: 'La entrada está bien, pero la cadena output tiene política accept y ninguna regla: lo más común en un servidor.' }
  ];

  /* want: lo que debería pasar. why: la explicación según el veredicto. */
  var PKTS = [
    { id: 'web', label: 'Visita nueva a :443', dir: 'in', proto: 'tcp', src: '198.51.100.7', dst: 'tu servidor', sport: 50122, dport: 443, state: 'new', want: 'accept',
      desc: 'Un navegador abre una conexión a tu web.' },
    { id: 'resp', label: 'Tu respuesta a esa visita', dir: 'out', proto: 'tcp', src: 'tu servidor', dst: '198.51.100.7', sport: 443, dport: 50122, state: 'established', want: 'accept',
      desc: 'El SYN-ACK y los datos que nginx devuelve al navegador, hacia su puerto efímero.' },
    { id: 'apt', label: 'Respuesta del repositorio', dir: 'in', proto: 'tcp', src: '198.51.100.80', dst: 'tu servidor', sport: 443, dport: 41712, state: 'established', want: 'accept',
      desc: 'Corriste apt update: esto es lo que vuelve del repositorio de paquetes.' },
    { id: 'sshof', label: 'SSH desde la oficina', dir: 'in', proto: 'tcp', src: '203.0.113.25', dst: 'tu servidor', sport: 53001, dport: 22, state: 'new', want: 'accept',
      desc: 'Tú, entrando a administrar desde la red de la oficina.' },
    { id: 'sshnet', label: 'SSH desde internet', dir: 'in', proto: 'tcp', src: '192.0.2.66', dst: 'tu servidor', sport: 40500, dport: 22, state: 'new', want: 'drop',
      desc: 'Un bot que recorre internet probando contraseñas en el 22.' },
    { id: 'pg', label: 'Postgres desde internet', dir: 'in', proto: 'tcp', src: '192.0.2.66', dst: 'tu servidor', sport: 40501, dport: 5432, state: 'new', want: 'drop',
      desc: 'Alguien intenta conectarse a la base, que por error escucha en todas las interfaces.' },
    { id: 'inv', label: 'Un ACK que no es de nadie', dir: 'in', proto: 'tcp', src: '192.0.2.66', dst: 'tu servidor', sport: 40502, dport: 443, state: 'invalid', want: 'drop',
      desc: 'Un paquete con el flag ACK que no pertenece a ninguna conexión abierta, típico de un escaneo.' },
    { id: 'c2', label: 'Salida a un puerto raro', dir: 'out', proto: 'tcp', src: 'tu servidor', dst: '192.0.2.200', sport: 39811, dport: 4444, state: 'new', want: 'drop',
      desc: 'Un proceso del servidor abre una conexión hacia afuera, a un puerto que nada legítimo usa.' },
    { id: 'dns', label: 'DNS a un resolver externo', dir: 'out', proto: 'udp', src: 'tu servidor', dst: '192.0.2.53', sport: 51515, dport: 53, state: 'new', want: 'drop',
      desc: 'Una consulta DNS que no va a tu resolver sino a uno de afuera.' }
  ];

  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return list[0]; }
  function txtNo(rule, p) { return typeof rule.no === 'function' ? rule.no(p) : rule.no; }

  /* Lo que haría nftables */
  function evaluate(set, p) {
    var chainName = p.dir === 'in' ? 'input' : 'output', chain = set[chainName];
    var rows = [], hit = -1;
    chain.rules.forEach(function (rid, i) {
      var r = R[rid];
      if (hit >= 0) { rows.push({ txt: r.txt, mark: 'skip', why: 'no se evalúa: ya decidió una regla anterior' }); return; }
      if (r.test(p)) { hit = i; rows.push({ txt: r.txt, mark: 'match', v: r.v, why: 'coincide: ' + r.v }); }
      else rows.push({ txt: r.txt, mark: 'miss', why: txtNo(r, p) });
    });
    var verdict = hit >= 0 ? R[chain.rules[hit]].v : chain.policy;
    var byPolicy = hit < 0;
    return { chain: chainName, policy: chain.policy, rows: rows, verdict: verdict, byPolicy: byPolicy, rule: hit >= 0 ? chain.rules[hit] : null };
  }

  function explain(setId, p, out) {
    var good = out.verdict === p.want;
    if (p.id === 'web') return good ? 'La regla del 80 y el 443 deja entrar la visita. Si hay conntrack, la conexión queda anotada como NEW y todo lo que siga de ella pasa por la primera regla.' : '';
    if (p.id === 'resp') {
      if (good && out.rule === 'est') return 'La respuesta pertenece a una conexión que la cadena input aceptó: conntrack la reconoce y pasa sin regla propia.';
      if (good) return 'Pasa, pero porque la cadena output no filtra nada.';
      return 'La respuesta va al puerto efímero del navegador (50122), y ninguna regla de salida lo permite. Sin conntrack, la visita entra pero la respuesta no sale: la web parece caída. Para arreglarlo sin estado tendrías que permitir la salida desde el 443 hacia cualquier puerto alto, una regla mucho más amplia de lo que parece.';
    }
    if (p.id === 'apt') {
      if (good) return 'Es la respuesta a una conexión que abriste tú: conntrack la reconoce. No hace falta abrir ningún puerto de entrada para recibir actualizaciones.';
      return 'El repositorio contesta a tu puerto efímero (41712). Sin estado, la regla de entrada solo mira el puerto de destino, y para recibir respuestas tendrías que abrir de 1024 a 65535 hacia adentro: justo lo que el firewall debía cerrar. Por eso las NACL necesitan reglas de puertos efímeros.';
    }
    if (p.id === 'sshof') return good ? 'La regla de la oficina coincide en puerto y origen.' : '';
    if (p.id === 'sshnet') {
      if (good) return 'Ninguna regla coincide (la del 22 exige el origen de la oficina) y la política drop lo descarta en silencio.';
      return 'La regla "temporal" del 22 está antes que la de la oficina y coincide primero: el SSH queda abierto a internet aunque la regla correcta exista más abajo. En nftables gana la primera regla que decide; las de después no se leen. Revisa el orden con nft list ruleset cada vez que agregues algo.';
    }
    if (p.id === 'pg') return good ? 'Nada abre el 5432 y la política drop lo descarta. El firewall te salva de un error de configuración de la base, pero no debería ser lo único: en M33 la base se ata a 127.0.0.1 o a la red privada, y así no depende de esta regla.' : '';
    if (p.id === 'inv') {
      if (good) return 'conntrack no tiene ninguna conexión a la que pertenezca este ACK y lo marca INVALID: se descarta antes de llegar a las reglas de puertos.';
      return 'Sin conntrack, la regla del 443 solo ve "TCP al 443" y lo deja pasar. El kernel del servidor contestará con un RST, que le confirma al que escanea que el puerto existe. Un filtro sin estado no distingue un paquete suelto de uno que pertenece a una conexión.';
    }
    if (p.id === 'c2') {
      if (good) return 'La cadena output solo permite lo que el servidor necesita (web, DNS a tu resolver, NTP). Un proceso comprometido que quiere llamar a su servidor de control o subir datos a un puerto cualquiera se encuentra con la política drop.';
      return 'Con la salida abierta, cualquier proceso del servidor puede conectarse a cualquier lugar. Si alguien logra ejecutar código en él, ese es el canal para recibir órdenes y sacar los datos. El filtrado de salida no evita la intrusión, pero corta lo que viene después.';
    }
    if (p.id === 'dns') {
      if (good) return 'Solo se permite DNS hacia tu resolver. Así todas las consultas quedan en un lugar que puedes registrar y vigilar, y DNS no se convierte en un canal de salida que nadie mira.';
      return 'Con la salida abierta, el servidor puede consultar a cualquier resolver de afuera. Las consultas a tu resolver son las únicas que registras; DNS es un canal de salida que los firewalls suelen dejar libre.';
    }
    return '';
  }

  function init(host) {
    var st = { set: 'ok', pkt: 'web' };

    function chips(list, key, label) {
      var btns = list.map(function (o) {
        var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': st[key] === o.id ? 'true' : 'false', text: o.label });
        b.addEventListener('click', function () { st[key] = o.id; btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); render(); });
        return b;
      });
      return h('div', { class: 'rls-ctl' }, [h('p', { class: 'raft-log-title', text: label }), h('div', { class: 'sim-controls', role: 'group', 'aria-label': label }, btns)]);
    }

    var setNote = h('p', { class: 'sim-note' });
    var pktEl = h('div', { class: 'fw-pkt' });
    var chainTitle = h('p', { class: 'raft-log-title' });
    var list = h('ol', { class: 'fw-rules' });
    var resEl = h('p', { class: 'rls-result', 'aria-live': 'polite' });
    var whyEl = h('p', { class: 'sim-note' });
    var MARK = { match: 'decide', miss: 'no coincide', skip: 'no se lee', policy: 'política' };

    function field(k, v) { return h('span', { class: 'fw-f' }, [h('span', { class: 'fw-k', text: k }), h('code', { text: v })]); }

    function render() {
      var set = find(SETS, st.set), p = find(PKTS, st.pkt), out = evaluate(set, p);
      setNote.textContent = set.note;
      pktEl.innerHTML = '';
      pktEl.appendChild(h('p', { class: 'fw-desc', text: p.desc }));
      pktEl.appendChild(h('div', { class: 'fw-fields' }, [
        field('sentido', p.dir === 'in' ? 'entra' : 'sale'), field('proto', p.proto),
        field('origen', p.src + ':' + p.sport), field('destino', p.dst + ':' + p.dport),
        field('conntrack', p.state.toUpperCase())
      ]));
      chainTitle.textContent = 'Cadena ' + out.chain + ' (policy ' + out.policy + '), de arriba hacia abajo';
      list.innerHTML = '';
      out.rows.forEach(function (r) {
        list.appendChild(h('li', { class: 'fw-rule is-' + r.mark + (r.v ? ' v-' + r.v : '') }, [
          h('code', { text: r.txt }), h('span', { class: 'fw-why' }, [h('span', { class: 'rls-tag', text: MARK[r.mark] }), document.createTextNode(' ' + r.why)])
        ]));
      });
      if (!out.rows.length) list.appendChild(h('li', { class: 'fw-rule is-miss' }, [h('code', { text: '(sin reglas)' }), h('span', { class: 'fw-why', text: 'la cadena está vacía' })]));
      list.appendChild(h('li', { class: 'fw-rule fw-policy' + (out.byPolicy ? ' is-match v-' + out.policy : ' is-skip') }, [
        h('code', { text: 'policy ' + out.policy + ';' }),
        h('span', { class: 'fw-why' }, [h('span', { class: 'rls-tag', text: MARK.policy }), document.createTextNode(out.byPolicy ? ' ninguna regla decidió: se aplica la política' : ' no hace falta: ya decidió una regla')])
      ]));
      var good = out.verdict === p.want;
      resEl.className = 'rls-result ' + (good ? 'is-ok' : 'is-bad');
      resEl.textContent = out.verdict.toUpperCase() + (good ? ': es lo que querías' : ': querías ' + p.want.toUpperCase());
      whyEl.textContent = explain(st.set, p, out);
    }

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Un paquete contra la cadena de reglas' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      chips(SETS, 'set', 'Reglas del servidor'), setNote,
      chips(PKTS, 'pkt', 'Paquete'), pktEl,
      chainTitle, list, resEl, whyEl
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Reglas de nftables simuladas en tu navegador, sobre un servidor web con SSH solo desde la oficina (' + OFICINA + '). Las IPs son de los rangos reservados para documentación.' }));
    render();
  }

  SD.ready(function () { document.querySelectorAll('[data-sim="firewall"]').forEach(init); });
})();
