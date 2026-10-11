/* Checklist de endurecimiento (M33): <div data-sim="hardening"></div>
   El lector marca las medidas que tiene un servidor. El widget calcula un índice de 0 a 100 con pesos
   didácticos (no es el índice de Lynis) y lista, de la más grave a la menos, lo que puede hacer un atacante
   con cada medida que falta. Tres atajos cargan un punto de partida. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;

  /* w: peso didáctico; sec: sección del módulo que la explica */
  var M = [
    { id: 'keys', w: 12, sec: 'ssh', label: 'SSH solo con claves (PasswordAuthentication no)',
      miss: 'Los bots prueban contraseñas en el puerto 22 todo el día. Una sola cuenta con una contraseña débil o reutilizada alcanza para entrar.' },
    { id: 'root', w: 8, sec: 'ssh', label: 'Sin login de root por SSH',
      miss: 'El usuario root existe en todos los servidores: el atacante solo tiene que adivinar la credencial, y si acierta ya es dueño de todo, sin dejar un nombre de usuario en el log.' },
    { id: 'groups', w: 4, sec: 'ssh', label: 'AllowGroups: solo un grupo entra por SSH',
      miss: 'Cualquier cuenta del sistema con una credencial válida puede abrir una sesión, incluidas las de servicio que alguien olvidó.' },
    { id: 'mfa', w: 5, sec: 'ssh-mfa', label: 'Segundo factor o llave FIDO2 para SSH',
      miss: 'Una clave privada robada de una laptop (o de un backup) basta para entrar.' },
    { id: 'updates', w: 12, sec: 'actualizaciones', label: 'Actualizaciones de seguridad automáticas',
      miss: 'Las vulnerabilidades corregidas se publican con su descripción. El atacante explota la versión vieja que sigue corriendo, días o meses después del parche.' },
    { id: 'sudo', w: 6, sec: 'cuentas', label: 'sudo acotado a un grupo, sin contraseña de root compartida',
      miss: 'Cualquier cuenta comprometida está a un paso de root, y en el log no queda quién hizo qué.' },
    { id: 'fw', w: 10, sec: 'red', label: 'Firewall con política drop de entrada',
      miss: 'Llega directo a cada servicio que escucha, incluidos los que nadie sabía que estaban abiertos.' },
    { id: 'egress', w: 6, sec: 'sin-firewall', label: 'Salida filtrada',
      miss: 'Si logra ejecutar algo, recibe órdenes, baja herramientas y saca los datos por cualquier puerto.' },
    { id: 'local', w: 9, sec: 'sin-firewall', label: 'Bases y servicios internos atados a localhost o a la red privada',
      miss: 'Una base o una caché que escucha en todas las interfaces depende de una sola regla de firewall, o de Docker, para no quedar expuesta.' },
    { id: 'f2b', w: 5, sec: 'red', label: 'Fail2Ban o CrowdSec',
      miss: 'Puede intentar sin límite: miles de contraseñas por hora contra SSH o contra el login de tu aplicación.' },
    { id: 'mac', w: 7, sec: 'mac', label: 'AppArmor o SELinux en modo enforcing',
      miss: 'Desde un servicio comprometido lee todo lo que el usuario del servicio puede leer: claves, configuraciones, datos de otros servicios.' },
    { id: 'sandbox', w: 4, sec: 'mac', label: 'Servicios con sandbox de systemd y usuario propio',
      miss: 'El servicio corre con más permisos de los que necesita: puede escribir en el sistema y ver el /home de todos.' },
    { id: 'aide', w: 5, sec: 'auditoria', label: 'AIDE con la base de datos fuera del servidor',
      miss: 'Cambia un binario o deja una clave en authorized_keys y nada compara el sistema con cómo estaba.' },
    { id: 'logs', w: 7, sec: 'auditoria', label: 'Logs enviados a otro lugar, con alertas',
      miss: 'Borra su rastro del log local y nadie mira: la intrusión dura meses.' },
    { id: 'sysctl', w: 3, sec: 'sysctl', label: 'sysctl endurecido',
      miss: 'El kernel acepta redirecciones ICMP y rutas de origen, y le muestra a cualquier usuario direcciones de memoria que facilitan explotar un fallo.' },
    { id: 'ntp', w: 2, sec: 'actualizaciones', label: 'Hora sincronizada',
      miss: 'Los logs de distintas máquinas no se pueden ordenar para reconstruir lo que pasó, y fallan la validación de certificados y los códigos TOTP.' }
  ];
  var SEC = { ssh: '33.2', 'ssh-mfa': '33.2', cuentas: '33.3', actualizaciones: '33.4', red: '33.6', mac: '33.7',
    auditoria: '33.8', sysctl: '33.9', 'sin-firewall': '33.10' };
  var TOTAL = M.reduce(function (s, m) { return s + m.w; }, 0);

  var PRESETS = [
    { id: 'ubuntu', label: 'Ubuntu recién instalado', on: ['updates', 'mac', 'ntp'],
      note: 'Lo que trae una instalación típica de Ubuntu Server: AppArmor activo, hora sincronizada y actualizaciones de seguridad automáticas. SSH acepta contraseñas y nada filtra la red.' },
    { id: 'basico', label: 'Solo SSH y firewall', on: ['keys', 'root', 'fw', 'updates', 'mac', 'ntp'],
      note: 'Lo que hace la mayoría después de leer un tutorial: claves, sin root, firewall. Falta todo lo que actúa cuando algo de eso falla.' },
    { id: 'todo', label: 'Todo el módulo', on: M.map(function (m) { return m.id; }),
      note: 'Todas las medidas. No vuelve invulnerable al servidor: cada capa reduce lo que puede hacer el atacante y aumenta la probabilidad de que lo veas.' }
  ];

  function init(host) {
    var on = {};
    var boxes = {};
    var noteEl = h('p', { class: 'sim-note' });
    var scoreNum = h('span', { class: 'hd-num' });
    var bar = h('span', { class: 'hd-fill' });
    var scoreTxt = h('span', { class: 'hd-txt' });
    var risks = h('ol', { class: 'hd-risks' });

    function presetBtns() {
      var btns = PRESETS.map(function (p) {
        var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'false', text: p.label });
        b.addEventListener('click', function () {
          on = {}; p.on.forEach(function (id) { on[id] = true; });
          btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          noteEl.textContent = p.note;
          sync();
        });
        return b;
      });
      btns[0].setAttribute('aria-pressed', 'true');
      return btns;
    }

    var list = h('ul', { class: 'hd-list' }, M.map(function (m) {
      var cb = h('input', { type: 'checkbox' });
      boxes[m.id] = cb;
      cb.addEventListener('change', function () { on[m.id] = cb.checked; render(); });
      return h('li', {}, [h('label', { class: 'hd-item' }, [cb, h('span', { text: m.label })])]);
    }));

    function sync() { M.forEach(function (m) { boxes[m.id].checked = !!on[m.id]; }); render(); }

    function render() {
      var got = M.reduce(function (s, m) { return s + (on[m.id] ? m.w : 0); }, 0);
      var pct = Math.round(100 * got / TOTAL);
      scoreNum.textContent = String(pct);
      bar.style.width = pct + '%';
      /* Lo que buscan los bots (contraseñas, puertos de más, software viejo) decide el estado antes que el número */
      var base = on.keys && on.updates && on.fw;
      var state = !base ? 'is-bad' : pct >= 85 ? 'is-ok' : 'is-warn';
      bar.className = 'hd-fill ' + state;
      scoreTxt.textContent = state === 'is-ok' ? 'Bien endurecido: quedan detalles'
        : state === 'is-warn' ? 'Cierra lo que buscan los bots, pero faltan capas para el día en que algo falle'
        : 'Expuesto: falta alguna de las tres básicas (claves, parches o firewall) y la encuentra cualquier bot';
      risks.innerHTML = '';
      var missing = M.filter(function (m) { return !on[m.id]; }).sort(function (a, b) { return b.w - a.w; });
      if (!missing.length) risks.appendChild(h('li', { class: 'hd-none', text: 'No falta ninguna medida de la lista. Ahora toca mantenerlas: parches, revisión de logs y una auditoría con Lynis cada tanto.' }));
      missing.forEach(function (m) {
        risks.appendChild(h('li', {}, [
          h('p', { class: 'hd-risk-t' }, [h('b', { text: m.label }), h('a', { href: '#' + m.sec, class: 'hd-sec', text: 'Sección ' + SEC[m.sec] })]),
          h('p', { class: 'hd-risk-d', text: 'Si falta: ' + m.miss })
        ]));
      });
    }

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Checklist de endurecimiento' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'rls-ctl' }, [h('p', { class: 'raft-log-title', text: 'Punto de partida' }), h('div', { class: 'sim-controls', role: 'group', 'aria-label': 'Punto de partida' }, presetBtns())]),
      noteEl,
      h('div', { class: 'hd-grid' }, [
        h('div', {}, [h('p', { class: 'raft-log-title', text: 'Lo que tiene el servidor' }), list]),
        h('div', { 'aria-live': 'polite' }, [
          h('p', { class: 'raft-log-title', text: 'Índice de endurecimiento (didáctico)' }),
          h('p', { class: 'hd-score' }, [scoreNum, h('span', { class: 'hd-of', text: ' / 100' })]),
          h('span', { class: 'hd-bar' }, [bar]), scoreTxt,
          h('p', { class: 'raft-log-title hd-risks-title', text: 'Lo que puede hacer el atacante, de lo más grave a lo menos' }),
          risks
        ])
      ])
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Los pesos son una estimación didáctica de este curso, no el índice de Lynis ni un puntaje de CIS. Sirven para ordenar prioridades, no para certificar un servidor.' }));
    on = {}; PRESETS[0].on.forEach(function (id) { on[id] = true; });
    noteEl.textContent = PRESETS[0].note;
    sync();
  }

  SD.ready(function () { document.querySelectorAll('[data-sim="hardening"]').forEach(init); });
})();
