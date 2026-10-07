/* Row-level security en PostgreSQL (M05): <div data-sim="rls"></div>
   Una tabla de facturas con dos tenants. El lector elige el rol de la conexión, el tenant de la sesión y la
   consulta, y ve qué filas devuelve la base, qué responde y por qué. Reproduce las reglas de PostgreSQL:
   USING filtra las filas existentes, WITH CHECK valida las nuevas, el dueño se salta las políticas salvo con
   FORCE ROW LEVEL SECURITY, y los superusuarios y los roles con BYPASSRLS las ignoran siempre. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;

  var ROWS = [
    { id: 101, tenant: 'acme', cliente: 'Ana Pérez', monto: 1200 },
    { id: 102, tenant: 'acme', cliente: 'Luis Gómez', monto: 340 },
    { id: 201, tenant: 'globex', cliente: 'Initech', monto: 5000 },
    { id: 202, tenant: 'globex', cliente: 'Hooli', monto: 780 },
    { id: 203, tenant: 'globex', cliente: 'Umbrella', monto: 1500 }
  ];
  var ROLES = [
    { id: 'app', label: 'app_rw: rol de la aplicación', set: 'SET ROLE app_rw;', applies: true },
    { id: 'owner', label: 'Dueño de la tabla, sin FORCE', set: 'SET ROLE migraciones;   -- creó la tabla', applies: false },
    { id: 'force', label: 'Dueño, con FORCE', set: 'ALTER TABLE facturas FORCE ROW LEVEL SECURITY;\nSET ROLE migraciones;', applies: true },
    { id: 'super', label: 'Superusuario o BYPASSRLS', set: 'SET ROLE postgres;', applies: false }
  ];
  var TENANTS = [{ id: 'acme', label: 'acme' }, { id: 'globex', label: 'globex' }, { id: '', label: 'Sin fijar' }];
  var QUERIES = [
    { id: 'all', label: 'Listar todas', sql: 'SELECT * FROM facturas;' },
    { id: 'one', label: 'Pedir la 201', sql: 'SELECT * FROM facturas WHERE id = 201;' },
    { id: 'upd', label: 'Modificar la 201', sql: 'UPDATE facturas SET monto = 0 WHERE id = 201;' },
    { id: 'ins', label: 'Insertar en globex', sql: "INSERT INTO facturas (id, tenant_id, cliente, monto)\nVALUES (301, 'globex', 'Stark', 900);" }
  ];
  var POLICY = "ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY por_tenant ON facturas\n  USING      (tenant_id = current_setting('app.tenant_id', true))\n  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));\n\nGRANT SELECT, INSERT, UPDATE ON facturas TO app_rw;";

  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return list[0]; }

  /* Lo que haría PostgreSQL */
  function run(roleId, tenant, qid) {
    var role = find(ROLES, roleId), applies = role.applies;
    function visible(r) { return !applies || (tenant !== '' && r.tenant === tenant); }
    var marks = {}, result = '', ok = true, extra = null, why = '';
    ROWS.forEach(function (r) { marks[r.id] = visible(r) ? 'seen' : 'hidden'; });

    if (qid === 'all') {
      var n = ROWS.filter(visible).length;
      result = '(' + n + (n === 1 ? ' fila)' : ' filas)');
    } else if (qid === 'one') {
      var v = visible(ROWS[2]);
      ROWS.forEach(function (r) { if (r.id !== 201) marks[r.id] = 'skip'; });
      result = v ? '(1 fila)' : '(0 filas)';
    } else if (qid === 'upd') {
      var vu = visible(ROWS[2]);
      ROWS.forEach(function (r) { if (r.id !== 201) marks[r.id] = 'skip'; });
      if (vu) marks[201] = 'changed';
      result = vu ? 'UPDATE 1' : 'UPDATE 0';
    } else {
      ROWS.forEach(function (r) { marks[r.id] = 'skip'; });
      var pass = !applies || tenant === 'globex';
      extra = { id: 301, tenant: 'globex', cliente: 'Stark', monto: 900, mark: pass ? 'new' : 'rejected' };
      ok = pass;
      result = pass ? 'INSERT 0 1' : 'ERROR:  new row violates row-level security policy for table "facturas"';
    }

    if (!applies && roleId === 'owner') {
      why = 'El dueño de la tabla se salta las políticas, salvo que la tabla tenga FORCE ROW LEVEL SECURITY. Si tu aplicación se conecta con el mismo rol que corre las migraciones (lo más común en un proyecto que empieza), RLS no filtra nada y no avisa. Prueba "Dueño, con FORCE" o "app_rw".';
    } else if (!applies) {
      why = 'Los superusuarios y los roles con BYPASSRLS ignoran siempre las políticas, incluso con FORCE. Sirven para migraciones y para pg_dump, que tiene que ver todas las filas. La aplicación nunca debe conectarse así.';
    } else if (tenant === '') {
      why = qid === 'ins'
        ? 'Sin tenant fijado, current_setting(\'app.tenant_id\', true) devuelve NULL. WITH CHECK compara \'globex\' = NULL, que no es verdadero, y la fila nueva se rechaza.'
        : 'Sin tenant fijado, current_setting(\'app.tenant_id\', true) devuelve NULL, y tenant_id = NULL nunca es verdadero: no se ve ninguna fila. Falla cerrada, que es lo que quieres si el código olvida fijar el tenant. (Sin el segundo argumento, true, la consulta daría error en lugar de cero filas.)';
    } else if (qid === 'all') {
      why = 'La base agrega la condición de la política a tu consulta, como si hubieras escrito WHERE tenant_id = \'' + tenant + '\'. Las filas del otro tenant no aparecen, aunque el código no filtró nada.';
    } else if (qid === 'one') {
      why = tenant === 'globex'
        ? 'La 201 es de globex: se ve.'
        : 'La 201 es de globex. Para esta sesión no existe: cero filas, sin error. Desde afuera no se distingue "no existe" de "no es tuya", así que un atacante tampoco puede usar la API para averiguar qué ids existen.';
    } else if (qid === 'upd') {
      why = tenant === 'globex'
        ? 'USING deja ver la fila y WITH CHECK confirma que la versión nueva sigue siendo de globex: UPDATE 1.'
        : 'UPDATE 0: USING también filtra las filas que un UPDATE o un DELETE puede tocar. Es la defensa contra BOLA en la última capa: aunque la API olvide comprobar el dueño, la base no modifica facturas ajenas.';
    } else {
      why = tenant === 'globex'
        ? 'WITH CHECK valida la fila nueva: es de globex, igual que la sesión.'
        : 'WITH CHECK valida la fila nueva: dice tenant_id = \'globex\', pero la sesión es de ' + tenant + '. Sin esta cláusula, un tenant podría escribir filas en otro.';
    }
    return { marks: marks, extra: extra, result: result, ok: ok, why: why, role: role };
  }

  function init(host) {
    var st = { role: 'app', tenant: 'acme', q: 'all' };

    function chips(list, key, label) {
      var btns = list.map(function (o) {
        var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': st[key] === o.id ? 'true' : 'false', text: o.label });
        b.addEventListener('click', function () { st[key] = o.id; btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); render(); });
        return b;
      });
      return h('div', { class: 'rls-ctl' }, [h('p', { class: 'raft-log-title', text: label }), h('div', { class: 'sim-controls', role: 'group', 'aria-label': label }, btns)]);
    }

    var sqlEl = h('pre', { 'data-lang': 'sql' }, [h('code')]);
    var tbody = h('tbody');
    var resEl = h('p', { class: 'rls-result', 'aria-live': 'polite' });
    var whyEl = h('p', { class: 'sim-note' });
    var MARK = { seen: 'la devuelve', hidden: 'oculta por la política', skip: '', changed: 'modificada', 'new': 'insertada', rejected: 'rechazada' };

    function render() {
      var out = run(st.role, st.tenant, st.q), q = find(QUERIES, st.q);
      var prelude = out.role.set + '\nBEGIN;\n' + (st.tenant ? "SET LOCAL app.tenant_id = '" + st.tenant + "';\n" : '-- (nadie fijó el tenant)\n');
      sqlEl.removeAttribute('data-hl');
      sqlEl.firstChild.textContent = prelude + q.sql;
      SD.highlight(sqlEl.parentNode);
      tbody.innerHTML = '';
      var rows = ROWS.map(function (r) { return { r: r, m: out.marks[r.id] }; });
      if (out.extra) rows.push({ r: out.extra, m: out.extra.mark });
      rows.forEach(function (x) {
        var r = x.r, m = x.m;
        var monto = (m === 'changed') ? '0' : SD.fmt.num(r.monto);
        tbody.appendChild(h('tr', { class: 'rls-row is-' + m }, [
          h('td', { class: 'r', text: String(r.id) }), h('td', {}, [h('code', { text: r.tenant })]), h('td', { text: r.cliente }), h('td', { class: 'r', text: monto }),
          h('td', {}, MARK[m] ? [h('span', { class: 'rls-tag', text: MARK[m] })] : [])
        ]));
      });
      resEl.className = 'rls-result ' + (out.ok ? 'is-ok' : 'is-bad');
      resEl.textContent = out.result;
      whyEl.textContent = out.why;
    }

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Row-level security: qué filas ve cada conexión' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('details', { class: 'rls-policy' }, [h('summary', { text: 'La política de la tabla' }), h('pre', { 'data-lang': 'sql' }, [h('code', { text: POLICY })])]),
      chips(ROLES, 'role', 'Rol de la conexión'),
      chips(TENANTS, 'tenant', 'Tenant de la sesión'),
      chips(QUERIES, 'q', 'Consulta'),
      sqlEl,
      h('div', { class: 'table-wrap' }, [h('table', { class: 't rls-table' }, [
        h('thead', {}, [h('tr', {}, [h('th', { class: 'r', text: 'id' }), h('th', { text: 'tenant_id' }), h('th', { text: 'cliente' }), h('th', { class: 'r', text: 'monto' }), h('th', { text: 'Para esta consulta' })])]),
        tbody
      ])]),
      resEl, whyEl
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Reglas de PostgreSQL 15 o posterior, simuladas en tu navegador. La tabla tiene las cinco filas siempre; lo que cambia es qué deja ver o tocar la política a cada conexión.' }));
    SD.highlight(host);
    render();
  }

  SD.ready(function () { document.querySelectorAll('[data-sim="rls"]').forEach(init); });
})();
