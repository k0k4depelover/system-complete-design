/* RBAC + ABAC en la base (M35): <div data-sim="rbac"></div>
   Un sujeto, una acción, un recurso. El widget evalúa la petición en dos pasos, como PostgreSQL:
   primero RBAC (¿el rol tiene el privilegio sobre la tabla?) y luego ABAC/RLS (¿la política de fila deja
   pasar esta fila?). La decisión final solo permite si los dos permiten. El dueño de la tabla no pasa por
   la RLS. Sin tokens, sin red: la misma tabla de GRANT y la misma política de M05, resueltas a mano. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;

  var SUBJECTS = [
    { id: 'ana', label: 'ana — analista', rol: 'analistas', tenant: 'acme', owner: false },
    { id: 'app', label: 'app_rw — servicio', rol: 'app_rw', tenant: 'acme', owner: false },
    { id: 'mig', label: 'migraciones — dueño', rol: 'migraciones', tenant: '—', owner: true }
  ];
  var ACTIONS = [
    { id: 'select', label: 'Leer (SELECT)', priv: 'SELECT' },
    { id: 'update', label: 'Modificar (UPDATE)', priv: 'UPDATE' },
    { id: 'ddl', label: 'Alterar la tabla (ALTER)', priv: 'DDL' }
  ];
  var RESOURCES = [
    { id: 'acme', label: 'Una factura de acme', tenant: 'acme' },
    { id: 'globex', label: 'Una factura de globex', tenant: 'globex' }
  ];
  var GRANTS = {
    analistas: ['SELECT'],
    app_rw: ['SELECT', 'UPDATE'],
    migraciones: ['SELECT', 'UPDATE', 'DDL']
  };

  function evalRbac(sub, act) {
    var ok = GRANTS[sub.rol].indexOf(act.priv) !== -1;
    var why = ok
      ? 'El rol ' + sub.rol + ' tiene ' + act.priv + ' sobre facturas (GRANT).'
      : 'El rol ' + sub.rol + ' no tiene ' + act.priv + ' sobre facturas. GRANT lo niega.';
    return { ok: ok, why: why };
  }

  function evalAbac(sub, res) {
    if (sub.owner) {
      return { ok: true, why: 'El dueño de la tabla no pasa por la RLS: ve todas las filas (sin FORCE).' };
    }
    var ok = sub.tenant === res.tenant;
    var why = ok
      ? 'La política por_tenant deja pasar: la fila es de ' + res.tenant + ' y la sesión fijó ' + sub.tenant + '.'
      : 'La política por_tenant filtra la fila: es de ' + res.tenant + ' y la sesión es de ' + sub.tenant + '. No la ve.';
    return { ok: ok, why: why };
  }

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

  function verdictLine(tag, v) {
    return h('div', { 'class': 'rbac-sub' }, [
      h('span', { 'class': 'rbac-tag', text: tag }),
      h('span', { 'class': v.ok ? 'rbac-mark wv-ok' : 'rbac-mark wv-bad', text: v.ok ? 'permite' : 'niega' }),
      h('span', { 'class': 'rbac-why', text: v.why })
    ]);
  }

  function build(root) {
    var state = { subj: 'ana', act: 'select', res: 'globex' };
    var out = h('div', { 'class': 'rbac-out', 'aria-live': 'polite' });

    function render() {
      var sub = SUBJECTS.find(function (s) { return s.id === state.subj; });
      var act = ACTIONS.find(function (a) { return a.id === state.act; });
      var res = RESOURCES.find(function (r) { return r.id === state.res; });
      var rb = evalRbac(sub, act);
      var ab = evalAbac(sub, res);
      var finalOk = rb.ok && ab.ok;
      out.textContent = '';
      out.appendChild(h('div', { 'class': 'rbac-query', text:
        sub.label.split(' — ')[0] + ' quiere ' + act.label.toLowerCase() + ' sobre ' + res.label.toLowerCase() + '.' }));
      out.appendChild(verdictLine('RBAC (rol)', rb));
      out.appendChild(verdictLine('ABAC / RLS (fila)', ab));
      out.appendChild(h('div', { 'class': finalOk ? 'rbac-final is-ok' : 'rbac-final is-bad' }, [
        h('b', { text: finalOk ? '✓ Permitido' : '✗ Denegado' }),
        h('span', { text: finalOk
          ? ' Los dos pasos permiten: el rol entra y la política deja ver la fila.'
          : (rb.ok ? ' El rol entra, pero la política de fila la bloquea. RBAC no basta sin ABAC.'
                   : ' El rol no tiene el privilegio; ni se evalúa la fila.') })
      ]));
    }

    var controls = h('div', { 'class': 'sim-controls' }, [
      chipRow('Sujeto', SUBJECTS, function () { return state.subj; }, function (id) { state.subj = id; sync(); render(); }),
      chipRow('Acción', ACTIONS, function () { return state.act; }, function (id) { state.act = id; sync(); render(); }),
      chipRow('Recurso', RESOURCES, function () { return state.res; }, function (id) { state.res = id; sync(); render(); })
    ]);

    function sync() {
      controls.querySelectorAll('.rbac-chips').forEach(function (row, i) {
        var sel = [state.subj, state.act, state.res][i];
        var opts = [SUBJECTS, ACTIONS, RESOURCES][i];
        row.querySelectorAll('.chip-btn').forEach(function (b, j) {
          b.setAttribute('aria-pressed', opts[j].id === sel ? 'true' : 'false');
        });
      });
    }

    root.appendChild(h('div', { 'class': 'sim' }, [
      h('div', { 'class': 'sim-head' }, [
        h('span', { 'class': 'sim-title', text: 'Una petición, dos controles: RBAC y luego RLS' })
      ]),
      h('div', { 'class': 'sim-body' }, [
        controls,
        out,
        h('p', { 'class': 'sim-note', text: 'El rol decide si entras a la tabla; la política de fila (RLS, que es ABAC) decide qué filas ves. La petición pasa solo si los dos permiten. El dueño de la tabla se salta la RLS.' })
      ])
    ]));
    render();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="rbac"]').forEach(build);
  });
})();
