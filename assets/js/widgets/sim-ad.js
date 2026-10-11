/* Rutas de ataque y defensas en AD (M38): <div data-sim="adpaths"></div>
   Modelo puramente defensivo. Un grafo fijo de relaciones de confianza entre identidades y máquinas, con las
   rutas que llegan hasta Domain Admins (tier 0). El lector activa controles (chips) y ve qué aristas desaparecen
   y cuántas rutas quedan. No hay pasos de ataque: cada arista es una relación de confianza, y cada control la
   elimina. Lógica: enumerar rutas simples sobre las aristas que ningún control activo corta. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;

  var NODES = {
    usuario: 'Usuario (phishing)',
    estacion: 'Estación de trabajo',
    svc: 'Cuenta de servicio (SPN)',
    credadmin: 'Credencial de admin en memoria',
    servidor: 'Servidor',
    grupo: 'Grupo con permiso de más',
    da: 'Domain Admins (tier 0)'
  };
  // Cada arista es una confianza que un control defensivo elimina.
  var EDGES = [
    { from: 'usuario', to: 'estacion', cut: 'mfa' },
    { from: 'usuario', to: 'svc', cut: 'aes' },
    { from: 'estacion', to: 'credadmin', cut: 'credguard' },
    { from: 'credadmin', to: 'servidor', cut: 'laps' },
    { from: 'credadmin', to: 'da', cut: 'tiering' },
    { from: 'svc', to: 'grupo', cut: 'tiering' },
    { from: 'servidor', to: 'grupo', cut: 'acl' },
    { from: 'grupo', to: 'da', cut: 'minpriv' }
  ];
  var CONTROLS = [
    { id: 'mfa', label: 'MFA' },
    { id: 'aes', label: 'AES / gMSA (sin RC4)' },
    { id: 'credguard', label: 'Credential Guard + Protected Users' },
    { id: 'laps', label: 'LAPS' },
    { id: 'tiering', label: 'Tiering' },
    { id: 'acl', label: 'Limpiar ACL' },
    { id: 'minpriv', label: 'Mínimo privilegio' }
  ];

  function paths(active) {
    var out = [];
    (function dfs(node, seen, acc) {
      if (node === 'da') { out.push(acc.slice()); return; }
      EDGES.forEach(function (e) {
        if (e.from !== node || active[e.cut] || seen[e.to]) { return; }
        seen[e.to] = true; acc.push(e.to);
        dfs(e.to, seen, acc);
        acc.pop(); seen[e.to] = false;
      });
    })('usuario', { usuario: true }, ['usuario']);
    return out;
  }

  function build(root) {
    var active = {};
    var out = h('div', { 'class': 'rbac-out', 'aria-live': 'polite' });

    function render() {
      var ps = paths(active);
      var shortest = ps.slice().sort(function (a, b) { return a.length - b.length; })[0];
      out.textContent = '';
      var ok = ps.length === 0;
      out.appendChild(h('div', { 'class': ok ? 'rbac-final is-ok' : 'rbac-final is-bad' }, [
        h('b', { text: ok ? '✓ Sin rutas a Domain Admins' : '✗ Rutas restantes: ' + ps.length }),
        h('span', { text: ok
          ? ' Ningún camino de confianza llega a tier 0 con los controles activos. Eso es defensa en profundidad: no bastó un control, bastó la combinación.'
          : ' Todavía hay por dónde llegar a tier 0. Activa más controles hasta cerrar el último camino.' })
      ]));
      if (!ok) {
        out.appendChild(h('div', { 'class': 'rbac-query', text: 'Ruta más corta que sigue abierta:' }));
        out.appendChild(h('div', { 'class': 'ad-path' },
          shortest.map(function (n, i) {
            var parts = [h('span', { 'class': 'ad-node', text: NODES[n] })];
            if (i < shortest.length - 1) { parts.push(h('span', { 'class': 'ad-arrow', text: '→' })); }
            return h('span', { 'class': 'ad-step' }, parts);
          })
        ));
      }
    }

    var chips = h('div', { 'class': 'rbac-chips' }, CONTROLS.map(function (c) {
      return h('button', {
        'class': 'chip-btn', type: 'button', 'aria-pressed': 'false',
        onclick: function () {
          active[c.id] = !active[c.id];
          this.setAttribute('aria-pressed', active[c.id] ? 'true' : 'false');
          render();
        }
      }, [c.label]);
    }));

    root.appendChild(h('div', { 'class': 'sim' }, [
      h('div', { 'class': 'sim-head' }, [
        h('span', { 'class': 'sim-title', text: 'Rutas hasta tier 0: qué control corta cada camino' })
      ]),
      h('div', { 'class': 'sim-body' }, [
        h('div', { 'class': 'field' }, [
          h('label', { text: 'Controles defensivos (actívalos)' }),
          chips
        ]),
        out,
        h('p', { 'class': 'sim-note', text: 'Cada arista es una relación de confianza que un control elimina, no un paso de ataque. Ningún control solo cierra todas las rutas: hace falta combinarlos (por ejemplo, MFA y AES cortan las dos entradas; o tiering y limpiar las ACL cortan la convergencia).' })
      ])
    ]));
    render();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="adpaths"]').forEach(build);
  });
})();
