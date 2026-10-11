/* Evaluador de políticas de IAM (M37): <div data-sim="iam"></div>
   Una acción, un recurso y una política. El widget resuelve la petición con las reglas reales de IAM:
   deny por defecto, un allow debe cubrir la acción y el recurso, y un deny explícito gana sobre cualquier
   allow. Muestra qué sentencia decidió y por qué. Sin red ni tokens: la lógica de evaluación, a mano. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;

  var ACTIONS = [
    { id: 's3:GetObject', label: 'Leer objeto (s3:GetObject)' },
    { id: 's3:DeleteObject', label: 'Borrar objeto (s3:DeleteObject)' },
    { id: 'kms:Decrypt', label: 'Descifrar clave (kms:Decrypt)' }
  ];
  var RESOURCES = [
    { id: 'acme', label: 'Bucket propio (acme)' },
    { id: 'globex', label: 'Bucket de otro tenant (globex)' },
    { id: '*', label: 'Todos los recursos (*)' }
  ];
  var POLICIES = [
    { id: 'minpriv', label: 'Mínimo privilegio' },
    { id: 'wildcard', label: 'Comodín * (antipatrón)' },
    { id: 'guardrail', label: 'Amplia + deny explícito' }
  ];
  // Cada política es una lista de sentencias {e: Allow|Deny, a: [acciones|*], r: [recursos|*]}
  var DEFS = {
    minpriv: [{ e: 'Allow', a: ['s3:GetObject', 's3:PutObject'], r: ['acme'] }],
    wildcard: [{ e: 'Allow', a: ['*'], r: ['*'] }],
    guardrail: [
      { e: 'Allow', a: ['*'], r: ['*'] },
      { e: 'Deny', a: ['s3:DeleteObject'], r: ['*'] },
      { e: 'Deny', a: ['*'], r: ['globex'] }
    ]
  };

  function matchA(st, act) { return st.a.indexOf('*') !== -1 || st.a.indexOf(act) !== -1; }
  function matchR(st, res) { return st.r.indexOf('*') !== -1 || st.r.indexOf(res) !== -1; }

  function evalPolicy(pol, act, res) {
    var allow = null, deny = null;
    DEFS[pol].forEach(function (st) {
      if (matchA(st, act) && matchR(st, res)) { if (st.e === 'Deny') { deny = st; } else { allow = st; } }
    });
    if (deny) { return { ok: false, why: 'explicit' }; }
    if (allow) { return { ok: true, why: (allow.a.indexOf('*') !== -1 || allow.r.indexOf('*') !== -1) ? 'wildcard' : 'match' }; }
    return { ok: false, why: 'implicit' };
  }

  var REASON = {
    match: 'Permitido. Una sentencia Allow cubre justo esta acción sobre este recurso. Mínimo privilegio.',
    wildcard: 'Permitido, pero por un comodín * en la acción o el recurso, no por necesidad real. Antipatrón: una credencial filtrada hace cualquier cosa.',
    explicit: 'Denegado. Una sentencia Deny cubre esta petición, y el deny explícito gana sobre cualquier Allow. Es un guardarraíl.',
    implicit: 'Denegado. Ninguna sentencia Allow cubre esta acción sobre este recurso: en IAM, lo que no se permite queda negado (deny por defecto).'
  };

  function chipRow(label, options, getSel, onPick) {
    var btns = options.map(function (o) {
      return h('button', {
        'class': 'chip-btn', type: 'button', 'aria-pressed': getSel() === o.id ? 'true' : 'false',
        onclick: function () { onPick(o.id); }
      }, [o.label]);
    });
    return h('div', { 'class': 'field' }, [
      h('label', { text: label }),
      h('div', { 'class': 'rbac-chips' }, btns)
    ]);
  }

  function build(root) {
    var state = { act: 's3:GetObject', res: 'acme', pol: 'minpriv' };
    var out = h('div', { 'class': 'rbac-out', 'aria-live': 'polite' });

    function render() {
      var act = ACTIONS.find(function (a) { return a.id === state.act; });
      var res = RESOURCES.find(function (r) { return r.id === state.res; });
      var pol = POLICIES.find(function (p) { return p.id === state.pol; });
      var v = evalPolicy(state.pol, state.act, state.res);
      out.textContent = '';
      out.appendChild(h('div', { 'class': 'rbac-query', text:
        'Política "' + pol.label + '": ¿puede ' + state.act + ' sobre ' + res.label.toLowerCase() + '?' }));
      out.appendChild(h('div', { 'class': v.ok ? 'rbac-final is-ok' : 'rbac-final is-bad' }, [
        h('b', { text: v.ok ? '✓ Permitido' : '✗ Denegado' }),
        h('span', { text: ' ' + REASON[v.why] })
      ]));
    }

    var controls = h('div', { 'class': 'sim-controls' }, [
      chipRow('Acción', ACTIONS, function () { return state.act; }, function (id) { state.act = id; sync(); render(); }),
      chipRow('Recurso', RESOURCES, function () { return state.res; }, function (id) { state.res = id; sync(); render(); }),
      chipRow('Política', POLICIES, function () { return state.pol; }, function (id) { state.pol = id; sync(); render(); })
    ]);

    function sync() {
      var sels = [state.act, state.res, state.pol];
      var opts = [ACTIONS, RESOURCES, POLICIES];
      controls.querySelectorAll('.rbac-chips').forEach(function (row, i) {
        row.querySelectorAll('.chip-btn').forEach(function (b, j) {
          b.setAttribute('aria-pressed', opts[i][j].id === sels[i] ? 'true' : 'false');
        });
      });
    }

    root.appendChild(h('div', { 'class': 'sim' }, [
      h('div', { 'class': 'sim-head' }, [
        h('span', { 'class': 'sim-title', text: 'Evaluador de políticas de IAM' })
      ]),
      h('div', { 'class': 'sim-body' }, [
        controls,
        out,
        h('p', { 'class': 'sim-note', text: 'IAM niega por defecto: un Allow debe cubrir la acción y el recurso para permitir, y un Deny explícito gana siempre. Compara el mínimo privilegio con el comodín * y con una baranda que recorta una política amplia.' })
      ])
    ]));
    render();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="iam"]').forEach(build);
  });
})();
