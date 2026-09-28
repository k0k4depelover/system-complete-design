/* Laboratorio de JWT: <div data-sim="jwt"></div>
   Genera un token HS256 con un secreto de prueba, lo decodifica y lo verifica como lo haría una API:
   firma, algoritmo permitido, expiración, emisor y audiencia. Requiere SD.crypto (sim-signurl.js). */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;
  var SECRET = 'secreto-de-prueba-para-hs256';
  var ISS = 'https://auth.ejemplo.com', AUD = 'api.ejemplo.com';

  function b64url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlStr(str) { return b64url(new TextEncoder().encode(str)); }
  function fromB64url(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(out);
  }

  function sign(header, payload, secret) {
    var h64 = b64urlStr(JSON.stringify(header)), p64 = b64urlStr(JSON.stringify(payload));
    var sig = header.alg === 'none' ? '' : b64url(SD.crypto.hmacBytes(secret, h64 + '.' + p64));
    return h64 + '.' + p64 + '.' + sig;
  }

  /* Verificación como la haría una API bien escrita */
  function verify(token, now) {
    var checks = [];
    var parts = token.split('.');
    if (parts.length !== 3) return [{ ok: false, text: 'El token no tiene tres partes separadas por puntos.' }];
    var header, payload;
    try { header = JSON.parse(fromB64url(parts[0])); payload = JSON.parse(fromB64url(parts[1])); }
    catch (e) { return [{ ok: false, text: 'El header o el payload no son JSON válido en base64url.' }]; }
    var algOk = header.alg === 'HS256';
    checks.push({ ok: algOk, text: algOk ? 'Algoritmo HS256: es el único que la API acepta (fijado en el servidor, no leído del token).' : 'Algoritmo "' + header.alg + '" rechazado: la API solo acepta HS256. Si confiara en el campo alg del token, un atacante podría pedir "none" y saltarse la firma.' });
    if (algOk) {
      var expected = b64url(SD.crypto.hmacBytes(SECRET, parts[0] + '.' + parts[1]));
      var sigOk = expected === parts[2];
      checks.push({ ok: sigOk, text: sigOk ? 'Firma válida: el header y el payload son exactamente los que firmó el servidor de autenticación.' : 'Firma inválida: alguien modificó el header o el payload después de firmarlos (o se firmó con otro secreto).' });
    }
    var expOk = typeof payload.exp === 'number' && now < payload.exp;
    checks.push({ ok: expOk, text: expOk ? 'No venció: faltan ' + Math.round(payload.exp - now) + ' s.' : 'Vencido: exp ya pasó. El cliente debe obtener un token nuevo con su refresh token.' });
    checks.push({ ok: payload.iss === ISS, text: payload.iss === ISS ? 'Emisor esperado (' + ISS + ').' : 'Emisor desconocido: "' + payload.iss + '".' });
    checks.push({ ok: payload.aud === AUD, text: payload.aud === AUD ? 'Audiencia correcta: el token es para esta API.' : 'Audiencia incorrecta: el token era para "' + payload.aud + '", no para esta API.' });
    return checks;
  }

  function init(host) {
    if (!SD.crypto || !SD.crypto.hmacBytes) { host.textContent = 'El laboratorio de JWT necesita sim-signurl.js.'; return; }
    var clock = Math.floor(Date.now() / 1000);
    var header = { alg: 'HS256', typ: 'JWT', kid: 'k-2026-09' };
    var payload = { iss: ISS, aud: AUD, sub: 'user_8812', org: 'org_77', role: 'member', scope: 'chat:read chat:write', iat: clock, exp: clock + 900 };
    var token = sign(header, payload, SECRET);

    var tokenEl = h('p', { class: 'jwt-token', 'aria-label': 'Token codificado' });
    var headEl = h('pre', { 'data-lang': 'json' }, [h('code')]);
    var payEl = h('textarea', { class: 'jwt-edit', rows: 11, spellcheck: 'false', 'aria-label': 'Payload del token (editable)' });
    var checksEl = h('ul', { class: 'jwt-checks', 'aria-live': 'polite' });
    var note = h('p', { class: 'sim-note', 'aria-live': 'polite' });

    function render(msg) {
      var parts = token.split('.');
      tokenEl.innerHTML = '';
      tokenEl.appendChild(h('span', { class: 'jwt-h', text: parts[0] }));
      tokenEl.appendChild(document.createTextNode('.'));
      tokenEl.appendChild(h('span', { class: 'jwt-p', text: parts[1] }));
      tokenEl.appendChild(document.createTextNode('.'));
      tokenEl.appendChild(h('span', { class: 'jwt-s', text: parts[2] || '(vacía)' }));
      var hdr = {}, pl = {};
      try { hdr = JSON.parse(fromB64url(parts[0])); pl = JSON.parse(fromB64url(parts[1])); } catch (e) { /* se reporta en la verificación */ }
      headEl.removeAttribute('data-hl');
      headEl.firstChild.textContent = JSON.stringify(hdr, null, 2);
      SD.highlight(headEl.parentNode);
      if (document.activeElement !== payEl) payEl.value = JSON.stringify(pl, null, 2);
      checksEl.innerHTML = '';
      verify(token, clock).forEach(function (c) {
        checksEl.appendChild(h('li', { class: c.ok ? 'ok' : 'bad' }, [h('span', { class: 'jwt-mark', 'aria-hidden': 'true', text: c.ok ? '✓' : '✕' }), h('span', { class: 'visually-hidden', text: c.ok ? 'Correcto: ' : 'Falla: ' }), c.text]));
      });
      var allOk = verify(token, clock).every(function (c) { return c.ok; });
      checksEl.appendChild(h('li', { class: 'jwt-verdict ' + (allOk ? 'ok' : 'bad') }, [allOk ? 'La API acepta el token: 200 OK.' : 'La API rechaza el token: 401 Unauthorized.']));
      note.textContent = msg || '';
    }

    function payloadNow() {
      try { return JSON.parse(fromB64url(token.split('.')[1])); } catch (e) { return payload; }
    }

    var actions = [
      ['Emitir un token válido', function () { clock = Math.floor(Date.now() / 1000); payload = Object.assign({}, payload, { role: 'member', iat: clock, exp: clock + 900 }); header = { alg: 'HS256', typ: 'JWT', kid: 'k-2026-09' }; token = sign(header, payload, SECRET); render('Token recién emitido por el servidor de autenticación: vale 15 minutos.'); }],
      ['Cambiar role a admin sin firmar', function () {
        var p = payloadNow(); p.role = 'admin';
        var parts = token.split('.');
        token = parts[0] + '.' + b64urlStr(JSON.stringify(p)) + '.' + parts[2];
        render('El payload solo está codificado, no cifrado: cualquiera puede leerlo y editarlo. Lo que no puede es producir una firma válida sin el secreto.');
      }],
      ['Usar "alg": "none"', function () {
        var p = payloadNow(); p.role = 'admin';
        token = sign({ alg: 'none', typ: 'JWT' }, p, '');
        render('Un ataque clásico: si la librería creyera en el campo alg del token, aceptaría un token sin firma. Por eso el algoritmo lo fija la API.');
      }],
      ['Adelantar el reloj 20 minutos', function () { clock += 1200; render('Pasaron 20 minutos. Un access token corto limita el daño si se roba: el ladrón tiene minutos, no meses.'); }],
      ['Token de otra API', function () { var p = payloadNow(); p.aud = 'billing.ejemplo.com'; token = sign({ alg: 'HS256', typ: 'JWT', kid: 'k-2026-09' }, p, SECRET); render('Firma válida, pero emitido para otra API. Sin verificar aud, un token robado a un servicio poco importante serviría contra uno crítico.'); }]
    ];
    var bar = h('div', { class: 'sim-controls' }, actions.map(function (a, i) {
      var b = h('button', { type: 'button', class: i === 0 ? 'btn btn--primary' : 'btn', text: a[0] });
      b.addEventListener('click', a[1]);
      return b;
    }));

    payEl.addEventListener('input', function () {
      try {
        var p = JSON.parse(payEl.value);
        var parts = token.split('.');
        token = parts[0] + '.' + b64urlStr(JSON.stringify(p)) + '.' + parts[2];
        render('Editaste el payload a mano y la firma quedó igual.');
      } catch (e) { note.textContent = 'El payload no es JSON válido todavía.'; }
    });

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Laboratorio de JWT: emitir, manipular y verificar' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      bar,
      h('p', { class: 'raft-log-title', text: 'Token (header, payload y firma en base64url)' }), tokenEl,
      h('div', { class: 'jwt-grid' }, [
        h('div', {}, [h('p', { class: 'raft-log-title', text: 'Header' }), headEl]),
        h('div', {}, [h('p', { class: 'raft-log-title', text: 'Payload (puedes editarlo)' }), payEl])
      ]),
      h('p', { class: 'raft-log-title', text: 'Lo que verifica la API en cada request' }), checksEl, note
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'HS256 con un secreto de prueba compartido entre el emisor y la API, calculado en tu navegador. En producción, con muchos servicios, se prefiere RS256 o ES256: el emisor firma con una clave privada y las APIs verifican con la pública, publicada en un JWKS.' }));
    render('');
  }

  SD.ready(function () { document.querySelectorAll('[data-sim="jwt"]').forEach(init); });
})();
