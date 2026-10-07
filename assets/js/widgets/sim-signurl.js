/* Generador didáctico de URLs prefirmadas con el esquema SigV4 de S3: <div data-sim="signurl"></div>
   SHA-256 y HMAC implementados en JS puro (síncronos, sin depender de crypto.subtle, que puede no existir en file://).
   Solo se usan credenciales de prueba. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;

  /* ---------- SHA-256 ---------- */
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];

  function utf8(str) { return new TextEncoder().encode(str); }

  function sha256(bytes) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var l = bytes.length, withPad = ((l + 9 + 63) >> 6) << 6;
    var m = new Uint8Array(withPad);
    m.set(bytes); m[l] = 0x80;
    var bits = l * 8;
    m[withPad - 4] = (bits >>> 24) & 255; m[withPad - 3] = (bits >>> 16) & 255; m[withPad - 2] = (bits >>> 8) & 255; m[withPad - 1] = bits & 255;
    m[withPad - 5] = Math.floor(bits / 4294967296) & 255;
    var w = new Uint32Array(64);
    for (var off = 0; off < withPad; off += 64) {
      for (var i = 0; i < 16; i++) w[i] = (m[off + 4 * i] << 24) | (m[off + 4 * i + 1] << 16) | (m[off + 4 * i + 2] << 8) | m[off + 4 * i + 3];
      for (i = 16; i < 64; i++) {
        var a0 = w[i - 15], a1 = w[i - 2];
        var s0 = ((a0 >>> 7) | (a0 << 25)) ^ ((a0 >>> 18) | (a0 << 14)) ^ (a0 >>> 3);
        var s1 = ((a1 >>> 17) | (a1 << 15)) ^ ((a1 >>> 19) | (a1 << 13)) ^ (a1 >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], hh = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + hh) | 0;
    }
    var out = new Uint8Array(32);
    for (i = 0; i < 8; i++) { out[4 * i] = H[i] >>> 24; out[4 * i + 1] = (H[i] >>> 16) & 255; out[4 * i + 2] = (H[i] >>> 8) & 255; out[4 * i + 3] = H[i] & 255; }
    return out;
  }

  function hmac(key, msg) {
    if (key.length > 64) key = sha256(key);
    var k = new Uint8Array(64); k.set(key);
    var ip = new Uint8Array(64 + msg.length), op = new Uint8Array(64 + 32);
    for (var i = 0; i < 64; i++) { ip[i] = k[i] ^ 0x36; op[i] = k[i] ^ 0x5c; }
    ip.set(msg, 64);
    op.set(sha256(ip), 64);
    return sha256(op);
  }

  function hex(b) { return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }

  function enc(s) { return encodeURIComponent(s).replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); }); }
  function encPath(p) { return p.split('/').map(enc).join('/'); }

  /* SigV4 con firma en la query string (presigned URL).
     o.headers: headers extra que entran en la firma ({ 'content-type': 'image/jpeg' }); o.token: credencial temporal. */
  function presign(o) {
    var d = o.date;
    var amzDate = d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    var day = amzDate.slice(0, 8);
    var host = o.host || (o.bucket + '.s3.' + o.region + '.amazonaws.com');
    var scope = day + '/' + o.region + '/s3/aws4_request';
    var hdrs = { host: host };
    Object.keys(o.headers || {}).forEach(function (k) { hdrs[k.toLowerCase()] = String(o.headers[k]).trim(); });
    var names = Object.keys(hdrs).sort();
    var signedHeaders = names.join(';');
    var q = [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', o.accessKey + '/' + scope],
      ['X-Amz-Date', amzDate],
      ['X-Amz-Expires', String(o.expires)],
      ['X-Amz-SignedHeaders', signedHeaders]
    ];
    if (o.token) q.push(['X-Amz-Security-Token', o.token]);
    var canonicalQuery = q.map(function (p) { return enc(p[0]) + '=' + enc(p[1]); }).sort().join('&');
    var canonicalRequest = [o.method, '/' + encPath(o.key), canonicalQuery]
      .concat(names.map(function (n) { return n + ':' + hdrs[n]; }))
      .concat(['', signedHeaders, 'UNSIGNED-PAYLOAD']).join('\n');
    var stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, hex(sha256(utf8(canonicalRequest)))].join('\n');
    var kDate = hmac(utf8('AWS4' + o.secret), utf8(day));
    var kRegion = hmac(kDate, utf8(o.region));
    var kService = hmac(kRegion, utf8('s3'));
    var kSigning = hmac(kService, utf8('aws4_request'));
    var signature = hex(hmac(kSigning, utf8(stringToSign)));
    return {
      canonicalRequest: canonicalRequest, stringToSign: stringToSign, signature: signature,
      kSigning: hex(kSigning), amzDate: amzDate, scope: scope, signedHeaders: signedHeaders,
      url: 'https://' + host + '/' + encPath(o.key) + '?' + canonicalQuery + '&X-Amz-Signature=' + signature
    };
  }

  function b64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }

  SD.crypto = {
    sha256: function (s) { return hex(sha256(utf8(s))); },
    sha256b64: function (s) { return b64(sha256(utf8(s))); },
    hmacHex: function (k, m) { return hex(hmac(utf8(k), utf8(m))); },
    hmacBytes: function (k, m) { return hmac(utf8(k), utf8(m)); },
    presign: presign
  };

  /* ---------- Vista: generador y verificador ---------- */

  var ACCESS = 'ASIAEJEMPLOPRUEBA', SECRET = 'secreto-de-prueba-no-es-real', TOKEN = 'FwoGZXIvYXdzEJr…ejemplo';
  var SKEW = 600;          /* el reloj del backend atrasado 10 minutos */
  var TOKEN_SHORT = 60;    /* credencial temporal que vence a los 60 s */
  var TOKEN_NORMAL = 3600;

  var CASES = [
    { id: 'ok', label: 'Usarla tal cual', note: 'La URL llega intacta.',
      lesson: 'Firmar no guarda nada ni llama a S3: es un HMAC calculado en tu backend. S3 no sabe que la URL existe hasta que llega, y la acepta solo si al recalcular obtiene la misma firma. Por eso firmar tampoco comprueba que el objeto exista: una URL de descarga de un objeto borrado es válida y responde 404.' },
    { id: 'key', label: 'Cambiar el objeto', note: 'Alguien cambia el nombre del objeto en la URL para descargar otro archivo.',
      lesson: 'La ruta exacta entra en la firma, codificada byte a byte. Esto también rompe URLs legítimas: si tu backend firma <code>mi foto.jpg</code> codificado como <code>mi%20foto.jpg</code> y un proxy o tu código lo vuelve a codificar como <code>mi%2520foto.jpg</code>, S3 recibe otra ruta y responde 403. Usa claves sin espacios ni acentos, decididas por el servidor.' },
    { id: 'expires', label: 'Alargar la expiración', note: 'Alguien cambia X-Amz-Expires en la URL para que no venza.',
      lesson: 'La vigencia parece bien (el atacante la alargó), pero la firma no coincide: el vencimiento está firmado. No hay forma de extender una URL sin el secreto. El máximo que acepta S3 son 7 días (604 800 s), y con credenciales temporales vale lo que dure la credencial.' },
    { id: 'method', label: 'Cambiar el método', note: 'Alguien usa una URL de descarga para subir, o al revés.',
      lesson: 'El método es la primera línea de la request canónica. Una URL de GET no sirve para PUT ni para DELETE: firma una URL por operación, nunca una "para todo".' },
    { id: 'ctype', label: 'Otro Content-Type', putOnly: true, note: 'La app sube con Content-Type: video/mp4 una URL firmada para image/jpeg.',
      lesson: 'Cuando firmas <code>content-type</code>, el cliente tiene que mandar exactamente ese valor. Es el 403 más común en desarrollo: el navegador o la librería HTTP agrega <code>; charset=utf-8</code> o no manda el header, y la firma ya no coincide. A cambio, nadie usa tu URL de avatares para subir un video o un ejecutable.' },
    { id: 'skew', label: 'Reloj del backend atrasado', note: 'El servidor que firmó tiene el reloj 10 minutos atrasado.',
      lesson: 'La firma es correcta, pero <code>X-Amz-Date</code> dice que se firmó hace 10 minutos: con 300 s de vigencia, la URL nace vencida. Pasa en contenedores o máquinas sin NTP. Síntoma típico: "Request has expired" en URLs recién creadas. Sincroniza el reloj y no uses vigencias tan cortas que un desfase normal las mate.' },
    { id: 'token', label: 'Credencial que vence antes', note: 'El backend firmó con una credencial temporal (STS) a la que le quedaban 60 s.',
      lesson: 'Una URL firmada con credenciales temporales vale hasta lo que ocurra primero: <code>X-Amz-Expires</code> o el vencimiento de la credencial. Si tu backend corre con un rol que renueva credenciales cada hora, una URL firmada a los 59 minutos dura un minuto, aunque diga 300 s. Firma justo antes de responder y renueva credenciales con margen.' }
  ];

  function init(host) {
    var f = {
      method: h('select', {}, [h('option', { value: 'GET', text: 'GET (descargar)' }), h('option', { value: 'PUT', text: 'PUT (subir)' })]),
      bucket: h('input', { type: 'text', value: 'chat-adjuntos' }),
      key: h('input', { type: 'text', value: 'conv_42/up_77/original.jpg' }),
      expires: h('input', { type: 'number', min: 1, max: 604800, value: 300 }),
      region: h('input', { type: 'text', value: 'us-east-1' }),
      ctype: h('input', { type: 'text', value: 'image/jpeg' })
    };
    var out = h('div', { 'aria-live': 'polite' });
    var verifyOut = h('div', { class: 'sign-verify', 'aria-live': 'polite' });
    var signedAt = null, current = null, chosen = 'ok';
    var useAt = h('input', { type: 'range', min: 0, max: 900, step: 5, value: 10 });
    var useAtLabel = h('output', { class: 'sign-useat' });

    function fld(label, input, cls) {
      var id = 'su' + Math.random().toString(36).slice(2, 7); input.id = id;
      return h('div', { class: 'field' + (cls ? ' ' + cls : '') }, [h('label', { for: id, text: label }), input]);
    }

    function step(n, title, body, code) {
      var d = h('div', { class: 'sign-step' }, [h('p', { class: 'sign-step-title' }, [h('span', { class: 'sign-n', text: String(n) }), title]), h('p', { class: 'sign-step-body', html: body })]);
      if (code != null) d.appendChild(h('pre', {}, [h('code', { text: code })]));
      return d;
    }

    function expiresVal() { return Math.max(1, Math.min(604800, parseInt(f.expires.value, 10) || 300)); }

    function params(caseId) {
      var put = f.method.value === 'PUT';
      return {
        method: f.method.value, bucket: f.bucket.value.trim() || 'bucket', key: f.key.value.trim() || 'objeto',
        expires: expiresVal(), region: f.region.value.trim() || 'us-east-1',
        headers: put ? { 'content-type': f.ctype.value.trim() || 'application/octet-stream' } : null,
        accessKey: ACCESS, secret: SECRET, token: TOKEN,
        date: new Date(signedAt.getTime() - (caseId === 'skew' ? SKEW * 1000 : 0))
      };
    }

    /* Firma: usa el reloj real una sola vez; desde ahí todo corre en tiempo simulado, así nada depende de cuánto tardes en leer */
    function sign(resetClock) {
      if (resetClock || !signedAt) signedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
      var p = params('ok'), r = presign(p), put = p.method === 'PUT';
      current = { p: p, r: r };
      f.ctype.disabled = !put;
      out.innerHTML = '';
      out.appendChild(step(1, 'Request canónica', 'Se normaliza exactamente la operación que se autoriza: método, ruta codificada, parámetros ordenados, los headers firmados (' + (put ? '<code>content-type</code> y <code>host</code>: el cliente tendrá que mandar ese mismo <code>Content-Type</code>' : 'aquí solo <code>host</code>') + ') y el hash del cuerpo (<code>UNSIGNED-PAYLOAD</code>, porque al firmar todavía no hay bytes). Todo lo que está aquí queda protegido; lo que no está, no.', r.canonicalRequest));
      out.appendChild(step(2, 'Texto a firmar', 'Algoritmo, fecha y hora de firma, alcance (día, región, servicio) y el SHA-256 de la request canónica. La fecha viene del reloj del servidor que firma, no del cliente.', r.stringToSign));
      out.appendChild(step(3, 'Clave derivada', 'El secreto nunca se usa directo: se deriva una clave válida solo para ese día, región y servicio con HMAC encadenados. Si esta clave se filtrara, no sirve para otro día ni otro servicio.', 'kDate    = HMAC("AWS4" + secreto, "' + r.amzDate.slice(0, 8) + '")\nkRegion  = HMAC(kDate, "' + p.region + '")\nkService = HMAC(kRegion, "s3")\nkSigning = HMAC(kService, "aws4_request")\n         = ' + r.kSigning));
      out.appendChild(step(4, 'Firma', 'HMAC-SHA256 del texto a firmar con la clave derivada, en hexadecimal. Cambiar un solo carácter de la request canónica produce una firma completamente distinta.', r.signature));
      out.appendChild(step(5, 'URL prefirmada', 'Todo lo necesario para verificarla viaja en la URL, incluida la credencial temporal (<code>X-Amz-Security-Token</code>). Quien la tenga puede hacer <b>exactamente</b> esa operación sobre <b>exactamente</b> ese objeto durante ' + SD.fmt.num(p.expires) + ' s, sin credenciales propias. Por eso no se guarda en logs.', r.url));
      useAt.max = String(Math.max(120, Math.min(7200, p.expires * 2)));
      if (+useAt.value > +useAt.max) useAt.value = useAt.max;
      caseBtns.forEach(function (b) {
        var c = CASES.filter(function (x) { return x.id === b.dataset.case; })[0];
        b.disabled = !!(c.putOnly && !put);
        if (b.disabled && chosen === c.id) chosen = 'ok';
      });
      verify();
    }

    function diffLines(a, b) {
      var A = a.split('\n'), B = b.split('\n'), outL = [], n = Math.max(A.length, B.length);
      for (var i = 0; i < n; i++) {
        if (A[i] === B[i]) outL.push('  ' + (A[i] || ''));
        else { outL.push('- firmado:  ' + (A[i] || '')); outL.push('+ recibido: ' + (B[i] || '')); }
      }
      return outL.join('\n');
    }

    function check(ok, title, detail) {
      return h('li', { class: ok ? 'is-ok' : 'is-bad' }, [
        h('span', { class: 'sign-ck-icon', 'aria-hidden': 'true', text: ok ? '✓' : '✗' }),
        h('div', {}, [h('p', { class: 'sign-ck-title', text: (ok ? 'Pasa: ' : 'Falla: ') + title }), h('p', { class: 'sign-ck-detail', html: detail })])
      ]);
    }

    function verify() {
      if (!current) return;
      caseBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.case === chosen ? 'true' : 'false'); });
      var c = CASES.filter(function (x) { return x.id === chosen; })[0];
      var t = +useAt.value;
      useAtLabel.textContent = SD.fmt.num(t) + ' s después de firmar';

      /* Lo que el backend firmó */
      var signedP = params(chosen), signed = presign(signedP);
      /* Lo que S3 recibe, con la manipulación del caso */
      var recvP = Object.assign({}, signedP, { headers: signedP.headers ? Object.assign({}, signedP.headers) : null });
      if (chosen === 'key') recvP.key = signedP.key.replace(/[^/]+$/, 'otro-archivo.jpg');
      else if (chosen === 'expires') recvP.expires = Math.min(604800, signedP.expires * 100);
      else if (chosen === 'method') recvP.method = signedP.method === 'GET' ? 'PUT' : 'GET';
      else if (chosen === 'ctype' && recvP.headers) recvP.headers['content-type'] = 'video/mp4';
      var recv = presign(recvP);

      var now = signedAt.getTime() + t * 1000;
      var age = Math.round((now - signedP.date.getTime()) / 1000);
      var sigOk = recv.signature === signed.signature;
      var fresh = age <= recvP.expires;
      var tokenLife = chosen === 'token' ? TOKEN_SHORT : TOKEN_NORMAL;
      var tokenOk = t < tokenLife;

      var status, xml;
      if (!sigOk) {
        status = '403 Forbidden: SignatureDoesNotMatch';
        xml = '<Error>\n  <Code>SignatureDoesNotMatch</Code>\n  <Message>The request signature we calculated does not match the signature you provided. Check your key and signing method.</Message>\n  <StringToSign>' + recv.stringToSign.replace(/\n/g, '\\n') + '</StringToSign>\n  <CanonicalRequest>…la request canónica que calculó S3…</CanonicalRequest>\n</Error>';
      } else if (!fresh) {
        status = '403 Forbidden: Request has expired';
        xml = '<Error>\n  <Code>AccessDenied</Code>\n  <Message>Request has expired</Message>\n  <X-Amz-Expires>' + recvP.expires + '</X-Amz-Expires>\n  <Expires>' + new Date(signedP.date.getTime() + recvP.expires * 1000).toISOString().replace(/\.\d{3}/, '') + '</Expires>\n  <ServerTime>' + new Date(now).toISOString().replace(/\.\d{3}/, '') + '</ServerTime>\n</Error>';
      } else if (!tokenOk) {
        status = '400 Bad Request: ExpiredToken';
        xml = '<Error>\n  <Code>ExpiredToken</Code>\n  <Message>The provided token has expired.</Message>\n</Error>';
      } else {
        status = signedP.method === 'PUT' ? '200 OK: objeto guardado' : '200 OK: S3 entrega el objeto';
        xml = null;
      }
      var ok = !xml;

      verifyOut.innerHTML = '';
      verifyOut.appendChild(h('p', { class: 'sign-step-body', html: '<b>Caso:</b> ' + c.note }));
      var list = h('ol', { class: 'sign-checks' }, [
        check(fresh, '¿Sigue vigente?', 'Firmada a las ' + signedP.date.toISOString().slice(11, 19) + ' (<code>X-Amz-Date</code>), S3 la recibe a las ' + new Date(now).toISOString().slice(11, 19) + ': edad ' + SD.fmt.num(age) + ' s, límite ' + SD.fmt.num(recvP.expires) + ' s' + (chosen === 'expires' ? ' (el límite que trae la URL manipulada)' : '') + '.'),
        check(tokenOk, '¿La credencial temporal sigue viva?', 'Le quedaban ' + SD.fmt.num(tokenLife) + ' s al firmar; se usa a los ' + SD.fmt.num(t) + ' s.'),
        check(sigOk, '¿La firma coincide?', sigOk
          ? 'S3 recalculó la request canónica con lo que recibió y obtuvo la misma firma: <code>' + signed.signature.slice(0, 16) + '…</code>'
          : 'Firma en la URL <code>' + signed.signature.slice(0, 16) + '…</code>, firma que calcula S3 <code>' + recv.signature.slice(0, 16) + '…</code>. La diferencia está en la request canónica:')
      ]);
      verifyOut.appendChild(list);
      if (!sigOk) verifyOut.appendChild(h('pre', { class: 'sign-diff' }, [h('code', { text: diffLines(signed.canonicalRequest, recv.canonicalRequest) })]));
      verifyOut.appendChild(h('p', { class: ok ? 'iso-good' : 'iso-bad', text: (ok ? '✓ ' : '✗ ') + status }));
      if (xml) verifyOut.appendChild(h('pre', {}, [h('code', { text: xml })]));
      verifyOut.appendChild(h('div', { class: 'sign-lesson' }, [h('p', { class: 'sign-lesson-title', text: 'Lo que importa al programarlo' }), h('p', { html: c.lesson })]));
    }

    Object.keys(f).forEach(function (k) { f[k].addEventListener('input', function () { sign(false); }); f[k].addEventListener('change', function () { sign(false); }); });
    useAt.addEventListener('input', verify);

    var caseBtns = CASES.map(function (c) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'false', 'data-case': c.id, text: c.label });
      b.addEventListener('click', function () { chosen = c.id; verify(); });
      return b;
    });
    var resign = h('button', { type: 'button', class: 'btn', text: 'Firmar de nuevo' });
    resign.addEventListener('click', function () { sign(true); });

    var uaId = 'su' + Math.random().toString(36).slice(2, 7); useAt.id = uaId;

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Generador de URLs prefirmadas (SigV4 de S3)' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [fld('Operación', f.method), fld('Bucket', f.bucket), fld('Clave del objeto', f.key), fld('Expira en (s)', f.expires), fld('Región', f.region), fld('Content-Type (solo PUT)', f.ctype)]),
      out,
      h('p', { class: 'raft-log-title', text: 'Así la verifica S3: recalcula la firma con lo que recibe y revisa el tiempo' }),
      h('div', { class: 'sim-controls sign-cases', role: 'group', 'aria-label': 'Qué le pasa a la URL' }, caseBtns),
      h('div', { class: 'sim-controls sign-time' }, [
        h('div', { class: 'field sign-range' }, [h('label', { for: uaId, text: 'Momento de uso' }), useAt, useAtLabel]),
        resign
      ]),
      verifyOut
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Credenciales de prueba (' + ACCESS + ' y un secreto inventado): la URL no funciona contra AWS real, pero el algoritmo es el mismo. Todo se calcula en tu navegador, con un reloj simulado que arranca al firmar.' }));
    sign(true);
  }

  /* ---------- Vista: clave calculada con el hash del contenido ---------- */

  function initHashKey(host) {
    var input = h('textarea', { rows: 3, spellcheck: 'false' });
    input.value = 'foto de prueba del gato';
    var id = 'hk' + Math.random().toString(36).slice(2, 7); input.id = id;
    var outEl = h('div', { 'aria-live': 'polite' });
    function row(label, val, note) {
      return h('div', { class: 'out-row' }, [h('span', { text: label }), h('code', { class: 'sign-hk-val', text: val }), note ? h('small', { class: 'muted', text: note }) : null]);
    }
    function run() {
      var hx = SD.crypto.sha256(input.value), bb = SD.crypto.sha256b64(input.value);
      var key = 'blobs/sha256/' + hx.slice(0, 2) + '/' + hx.slice(2, 4) + '/' + hx;
      outEl.innerHTML = '';
      outEl.appendChild(row('SHA-256 (hex)', hx, 'Lo calcula el cliente antes de subir y lo vuelve a calcular S3 al recibir.'));
      outEl.appendChild(row('x-amz-checksum-sha256', bb, 'El mismo hash en base64: el header que se firma en la URL de subida.'));
      outEl.appendChild(row('Clave del objeto', key, 'Los dos primeros bytes como prefijos reparten la carga y evitan carpetas gigantes.'));
      outEl.appendChild(row('URL de la CDN', 'https://media.chat.example/b/' + hx.slice(0, 2) + '/' + hx.slice(2, 4) + '/' + hx + '.jpg', 'Inmutable: Cache-Control: max-age=31536000, immutable.'));
    }
    input.addEventListener('input', run);
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'De contenido a clave: direccionamiento por hash' })]));
    host.appendChild(h('div', { class: 'calc-body' }, [
      h('div', { class: 'field' }, [h('label', { for: id, text: 'Contenido del archivo (escribe cualquier cosa; cambia una letra y mira la clave)' }), input]),
      outEl
    ]));
    run();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="signurl"]').forEach(init);
    document.querySelectorAll('[data-calc="hashkey"]').forEach(initHashKey);
  });
})();
