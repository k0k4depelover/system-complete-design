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

  /* SigV4 con firma en la query string (presigned URL) */
  function presign(o) {
    var d = o.date;
    var amzDate = d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    var day = amzDate.slice(0, 8);
    var host = o.host || (o.bucket + '.s3.' + o.region + '.amazonaws.com');
    var scope = day + '/' + o.region + '/s3/aws4_request';
    var q = [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', o.accessKey + '/' + scope],
      ['X-Amz-Date', amzDate],
      ['X-Amz-Expires', String(o.expires)],
      ['X-Amz-SignedHeaders', 'host']
    ];
    var canonicalQuery = q.map(function (p) { return enc(p[0]) + '=' + enc(p[1]); }).sort().join('&');
    var canonicalRequest = [o.method, '/' + encPath(o.key), canonicalQuery, 'host:' + host, '', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
    var stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, hex(sha256(utf8(canonicalRequest)))].join('\n');
    var kDate = hmac(utf8('AWS4' + o.secret), utf8(day));
    var kRegion = hmac(kDate, utf8(o.region));
    var kService = hmac(kRegion, utf8('s3'));
    var kSigning = hmac(kService, utf8('aws4_request'));
    var signature = hex(hmac(kSigning, utf8(stringToSign)));
    return {
      canonicalRequest: canonicalRequest, stringToSign: stringToSign, signature: signature,
      kSigning: hex(kSigning), amzDate: amzDate, scope: scope,
      url: 'https://' + host + '/' + encPath(o.key) + '?' + canonicalQuery + '&X-Amz-Signature=' + signature
    };
  }

  SD.crypto = {
    sha256: function (s) { return hex(sha256(utf8(s))); },
    hmacHex: function (k, m) { return hex(hmac(utf8(k), utf8(m))); },
    hmacBytes: function (k, m) { return hmac(utf8(k), utf8(m)); },
    presign: presign
  };

  /* ---------- Vista ---------- */

  function init(host) {
    var f = {
      method: h('select', {}, [h('option', { value: 'GET', text: 'GET (descargar)' }), h('option', { value: 'PUT', text: 'PUT (subir)' })]),
      bucket: h('input', { type: 'text', value: 'chat-adjuntos' }),
      key: h('input', { type: 'text', value: 'conv_42/msg_18/foto.jpg' }),
      expires: h('input', { type: 'number', min: 1, max: 604800, value: 300 }),
      region: h('input', { type: 'text', value: 'us-east-1' })
    };
    var ACCESS = 'AKIAEJEMPLOPRUEBA', SECRET = 'secreto-de-prueba-no-es-real';
    var out = h('div', { 'aria-live': 'polite' });
    var verifyOut = h('div', { class: 'sign-verify', 'aria-live': 'polite' });
    var current = null, currentDate = null;

    function fld(label, input) {
      var id = 'su' + Math.random().toString(36).slice(2, 7); input.id = id;
      return h('div', { class: 'field' }, [h('label', { for: id, text: label }), input]);
    }

    function step(n, title, body, code) {
      var d = h('div', { class: 'sign-step' }, [h('p', { class: 'sign-step-title' }, [h('span', { class: 'sign-n', text: String(n) }), title]), h('p', { class: 'sign-step-body', html: body })]);
      if (code != null) d.appendChild(h('pre', {}, [h('code', { text: code })]));
      return d;
    }

    function params(date) {
      return { method: f.method.value, bucket: f.bucket.value.trim() || 'bucket', key: f.key.value.trim() || 'objeto', expires: Math.max(1, Math.min(604800, parseInt(f.expires.value, 10) || 300)), region: f.region.value.trim() || 'us-east-1', accessKey: ACCESS, secret: SECRET, date: date };
    }

    function run() {
      currentDate = new Date(Math.floor(Date.now() / 1000) * 1000);
      var p = params(currentDate);
      var r = presign(p);
      current = { p: p, r: r };
      out.innerHTML = '';
      out.appendChild(step(1, 'Request canónica', 'Se normaliza la request que se va a autorizar: método, path, parámetros ordenados, headers firmados y el hash del cuerpo (aquí <code>UNSIGNED-PAYLOAD</code>, porque el cliente todavía no subió nada). Cualquier cambio en estos campos cambia la firma.', r.canonicalRequest));
      out.appendChild(step(2, 'Texto a firmar', 'Algoritmo, fecha, alcance (día, región, servicio) y el SHA-256 de la request canónica.', r.stringToSign));
      out.appendChild(step(3, 'Clave derivada', 'El secreto nunca se usa directo: se deriva una clave válida solo para ese día, región y servicio con HMAC encadenados. Si esta clave se filtrara, no sirve para otro día ni otro servicio.', 'kDate    = HMAC("AWS4" + secreto, "' + r.amzDate.slice(0, 8) + '")\nkRegion  = HMAC(kDate, "' + p.region + '")\nkService = HMAC(kRegion, "s3")\nkSigning = HMAC(kService, "aws4_request")\n         = ' + r.kSigning));
      out.appendChild(step(4, 'Firma', 'HMAC-SHA256 del texto a firmar con la clave derivada, en hexadecimal.', r.signature));
      out.appendChild(step(5, 'URL prefirmada', 'Todo lo necesario para verificarla viaja en la URL. Quien la tenga puede hacer <b>exactamente</b> esa operación sobre <b>exactamente</b> ese objeto durante ' + p.expires + ' s, sin credenciales propias.', r.url));
      verifyOut.innerHTML = '';
    }

    function verify(kind) {
      if (!current) return;
      var p = current.p, sig = current.r.signature, note, ok;
      var serverP = Object.assign({}, p);
      var now = new Date();
      if (kind === 'key') { serverP.key = p.key.replace(/[^/]+$/, 'otro-archivo.jpg'); note = 'Alguien cambia el nombre del objeto en la URL para descargar otro archivo.'; }
      else if (kind === 'expires') { serverP.expires = p.expires * 100; note = 'Alguien sube X-Amz-Expires en la URL para que no venza.'; }
      else if (kind === 'method') { serverP.method = p.method === 'GET' ? 'PUT' : 'GET'; note = 'Alguien usa la URL con otro método (' + serverP.method + ').'; }
      else if (kind === 'late') { now = new Date(currentDate.getTime() + (p.expires + 60) * 1000); note = 'Alguien usa la URL ' + (p.expires + 60) + ' s después de firmada.'; }
      else { note = 'La URL llega intacta y a tiempo.'; }
      var recomputed = presign(serverP).signature;
      var expired = (now - currentDate) / 1000 > p.expires;
      ok = recomputed === sig && !expired;
      verifyOut.innerHTML = '';
      verifyOut.appendChild(h('p', { class: 'sign-step-body', text: note }));
      verifyOut.appendChild(h('pre', {}, [h('code', { text: 'firma en la URL:       ' + sig + '\nfirma que calcula S3:  ' + recomputed + '\n¿vencida?             ' + (expired ? 'sí' : 'no') })]));
      verifyOut.appendChild(h('p', { class: ok ? 'iso-good' : 'iso-bad', text: ok ? '200 OK: la firma coincide y está vigente.' : '403 Forbidden: ' + (expired ? 'la URL venció (Request has expired).' : 'la firma no coincide (SignatureDoesNotMatch). Cambiar cualquier campo firmado invalida la URL.') }));
    }

    Object.keys(f).forEach(function (k) { f[k].addEventListener('input', run); f[k].addEventListener('change', run); });
    var vbtns = h('div', { class: 'sim-controls' }, [
      ['ok', 'Usarla tal cual'], ['key', 'Cambiar el objeto'], ['expires', 'Alargar la expiración'], ['method', 'Cambiar el método'], ['late', 'Usarla vencida']
    ].map(function (x) { var b = h('button', { type: 'button', class: x[0] === 'ok' ? 'btn btn--primary' : 'btn', text: x[1] }); b.addEventListener('click', function () { verify(x[0]); }); return b; }));

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Generador de URLs prefirmadas (SigV4 de S3)' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [fld('Operación', f.method), fld('Bucket', f.bucket), fld('Clave del objeto', f.key), fld('Expira en (s)', f.expires), fld('Región', f.region)]),
      out,
      h('p', { class: 'raft-log-title', text: 'Así verifica S3 la URL: recalcula la firma con su copia del secreto' }),
      vbtns, verifyOut
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Credenciales de prueba (' + ACCESS + ' y un secreto inventado): la URL no funciona contra AWS real, pero el algoritmo es el mismo. Todo se calcula en tu navegador.' }));
    run();
  }

  SD.ready(function () { document.querySelectorAll('[data-sim="signurl"]').forEach(init); });
})();
