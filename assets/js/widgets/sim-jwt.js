/* Laboratorio de JWT: <div data-sim="jwt"></div>
   Genera un token HS256 con un secreto de prueba, lo decodifica y lo verifica como lo haría una API:
   firma, algoritmo permitido, expiración, emisor y audiencia.
   PKCE: <div data-calc="pkce"></div>, verifier, challenge y canje por la app o por un atacante.
   Los dos requieren SD.crypto (sim-signurl.js). */
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

  /* ---------- PKCE: <div data-calc="pkce"></div> ----------
     La app genera un code_verifier aleatorio, manda su hash (code_challenge) al pedir el código y el
     verifier original al canjearlo. El servidor recalcula el hash y compara. Vector de prueba del RFC 7636. */

  var RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

  function challengeOf(verifier) {
    return SD.crypto.sha256b64(verifier).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function randomVerifier() {
    var bytes = new Uint8Array(32);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return b64url(bytes);
  }

  function initPkce(host) {
    if (!SD.crypto || !SD.crypto.sha256b64) { host.textContent = 'La calculadora de PKCE necesita sim-signurl.js.'; return; }
    var id = 'pk' + Math.random().toString(36).slice(2, 7);
    var input = h('input', { id: id, type: 'text', spellcheck: 'false', autocomplete: 'off', value: RFC_VERIFIER });
    var regen = h('button', { type: 'button', class: 'btn', text: 'Generar otro' });
    var outEl = h('div', { class: 'pkce-out' });
    var who = 'app';
    var whoBtns = [
      ['app', 'La app, con su verifier'],
      ['thief', 'Un atacante que robó el código'],
      ['seen', 'Un atacante que vio el challenge']
    ].map(function (w) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': w[0] === who ? 'true' : 'false', 'data-who': w[0], text: w[1] });
      b.addEventListener('click', function () { who = w[0]; whoBtns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); run(); });
      return b;
    });
    var verdictEl = h('div', { 'aria-live': 'polite' });
    var thiefGuess = randomVerifier();

    function row(label, val, note) {
      return h('div', { class: 'out-row' }, [h('span', { text: label }), h('code', { class: 'sign-hk-val', text: val }), note ? h('small', { class: 'muted', text: note }) : null]);
    }
    function check(ok, title, detail) {
      return h('li', { class: ok ? 'is-ok' : 'is-bad' }, [
        h('span', { class: 'sign-ck-icon', 'aria-hidden': 'true', text: ok ? '✓' : '✗' }),
        h('div', {}, [h('p', { class: 'sign-ck-title', text: (ok ? 'Correcto: ' : 'Falla: ') + title }), detail ? h('p', { class: 'sign-ck-detail', text: detail }) : null])
      ]);
    }

    function run() {
      var verifier = input.value.trim();
      var lenOk = verifier.length >= 43 && verifier.length <= 128 && /^[A-Za-z0-9\-._~]+$/.test(verifier);
      var challenge = challengeOf(verifier);
      outEl.innerHTML = '';
      outEl.appendChild(row('code_challenge = BASE64URL(SHA256(code_verifier))', challenge,
        lenOk ? 'La app guarda el verifier en memoria y solo manda este hash. Del hash no se puede volver al verifier.' : 'El RFC 7636 pide entre 43 y 128 caracteres de A-Z, a-z, 0-9 y "-._~". Este verifier no cumple: un servidor estricto lo rechaza.'));
      outEl.appendChild(row('1. La app abre /authorize con el challenge',
        'https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=miapp-ia&redirect_uri=https%3A%2F%2Fmiapp.ia%2Fcallback&scope=openid%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.readonly&state=xyz&code_challenge=' + challenge + '&code_challenge_method=S256',
        'El servidor de autorización guarda el challenge junto al código que va a emitir.'));
      outEl.appendChild(row('2. Tras el login, el navegador vuelve con el código', 'https://miapp.ia/callback?code=c_91&state=xyz',
        'El código viaja por el navegador: puede quedar en el historial, en un log o en otra app que registró el mismo esquema de URL.'));

      var sent = who === 'app' ? verifier : who === 'thief' ? thiefGuess : challenge;
      var recomputed = challengeOf(sent);
      var match = recomputed === challenge;
      var req = 'POST /token HTTP/1.1\nHost: oauth2.googleapis.com\nContent-Type: application/x-www-form-urlencoded\n\ngrant_type=authorization_code&code=c_91\n&redirect_uri=https%3A%2F%2Fmiapp.ia%2Fcallback&client_id=miapp-ia\n&code_verifier=' + sent;
      var res = match
        ? 'HTTP/1.1 200 OK\n\n{"access_token": "ya29.a0…", "expires_in": 3599, "refresh_token": "1//0g…",\n "id_token": "eyJhbGciOiJSUzI1NiIs…", "token_type": "Bearer"}'
        : 'HTTP/1.1 400 Bad Request\n\n{"error": "invalid_grant", "error_description": "code_verifier no coincide"}';
      var pre1 = h('pre', { 'data-lang': 'http' }, [h('code', { text: req })]);
      var pre2 = h('pre', { 'data-lang': 'http' }, [h('code', { text: res })]);
      var why = who === 'app'
        ? 'La app tiene el verifier porque lo generó ella y nunca salió de su memoria. El servidor recalcula el hash y coincide.'
        : who === 'thief'
          ? 'El atacante tiene el código, pero no el verifier: nunca viajó por el navegador. Tiene que inventar uno, y la probabilidad de acertar 32 bytes aleatorios es nula.'
          : 'El atacante vio el challenge en la URL de /authorize y lo manda como si fuera el verifier. El servidor le aplica SHA-256 y obtiene otra cosa: el hash no se puede invertir.';
      verdictEl.innerHTML = '';
      verdictEl.appendChild(h('p', { class: 'raft-log-title', text: '3. Alguien canjea el código en /token' }));
      verdictEl.appendChild(pre1);
      verdictEl.appendChild(h('ul', { class: 'sign-checks' }, [
        check(true, 'El código c_91 existe, no venció y es para miapp-ia', 'Vale una sola vez y por pocos minutos.'),
        check(match, 'SHA256(code_verifier) = code_challenge guardado', 'Recalculado: ' + recomputed)
      ]));
      verdictEl.appendChild(pre2);
      verdictEl.appendChild(h('div', { class: 'sign-lesson' }, [h('p', { class: 'sign-lesson-title', text: match ? 'Entrega los tokens' : 'Rechaza el canje' }), h('p', { text: why })]));
      SD.highlight(verdictEl);
    }

    input.addEventListener('input', run);
    regen.addEventListener('click', function () { input.value = randomVerifier(); run(); });

    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'PKCE: el secreto que nunca viaja por el navegador' })]));
    host.appendChild(h('div', { class: 'calc-body' }, [
      h('div', { class: 'sim-controls pkce-in' }, [
        h('div', { class: 'field' }, [h('label', { for: id, text: 'code_verifier: 32 bytes aleatorios en base64url (empieza con el ejemplo del RFC 7636)' }), input]),
        regen
      ]),
      outEl,
      h('p', { class: 'raft-log-title', text: '¿Quién canjea el código?' }),
      h('div', { class: 'sim-controls', role: 'group', 'aria-label': 'Quién canjea el código' }, whoBtns),
      verdictEl
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'SHA-256 calculado en tu navegador. Con el verifier del RFC 7636, el challenge tiene que ser E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM. Las URLs imitan las de Google; el código y los tokens son de ejemplo.' }));
    run();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="jwt"]').forEach(init);
    document.querySelectorAll('[data-calc="pkce"]').forEach(initPkce);
  });
})();
