/* Widgets del M36 (criptografía desde cero). Todos didácticos y defensivos.
   data-calc="hash"     efecto avalancha de SHA-256 (usa SD.crypto.sha256)
   data-calc="hmac"     HMAC-SHA256 y la construcción casera que no se usa (SD.crypto)
   data-sim="nonce"     por qué un nonce no se repite, con un flujo de juguete
   data-sim="sign"      firmar y verificar con un RSA de juguete (badge--ref)
   data-calc="dh"       Diffie-Hellman con números elegibles
   data-calc="kdfcost"  el coste por intento de cada forma de guardar contraseñas
   Necesita widgets/sim-signurl.js antes (define SD.crypto). */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt, C = SD.crypto;
  var uid = 0;

  function field(label, node, hint) {
    var kids = [h('label', { text: label }), node];
    if (hint) kids.push(h('p', { class: 'field-hint', text: hint }));
    return h('div', { class: 'field' }, kids);
  }
  function textInput(value, attrs) {
    var a = { type: 'text', value: value, autocomplete: 'off', spellcheck: 'false' };
    if (attrs) Object.keys(attrs).forEach(function (k) { a[k] = attrs[k]; });
    return h('input', a);
  }
  function numInput(value, min, max, step) {
    return h('input', { type: 'number', inputmode: 'numeric', value: value, min: min, max: max, step: step || 1 });
  }
  function select(opts, value) {
    var s = h('select', {});
    opts.forEach(function (o) { s.appendChild(h('option', { value: o[0], text: o[1] })); });
    s.value = value;
    return s;
  }
  function outRow(label, formula, mono) {
    var value = h('output', { class: mono ? 'out-value mono' : 'out-value' });
    var kids = [h('span', { class: 'out-label', text: label }), value];
    if (formula) kids.push(h('span', { class: 'out-formula', text: formula }));
    return { el: h('div', { class: mono ? 'out-row out-row--stack' : 'out-row' }, kids), value: value };
  }
  function calcShell(host, title, foot, inEls, outRows) {
    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    inEls.forEach(function (e) { inCol.appendChild(e); });
    outRows.forEach(function (r) { outCol.appendChild(r.el || r); });
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: title })]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    if (foot) host.appendChild(h('p', { class: 'calc-foot', text: foot }));
  }
  function chips(names, current, onPick) {
    var row = h('div', { class: 'sim-controls' });
    var btns = {};
    Object.keys(names).forEach(function (k) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': k === current ? 'true' : 'false', text: names[k] });
      b.addEventListener('click', function () {
        Object.keys(btns).forEach(function (j) { btns[j].setAttribute('aria-pressed', j === k ? 'true' : 'false'); });
        onPick(k);
      });
      btns[k] = b; row.appendChild(b);
    });
    return row;
  }
  function bits(hexStr) { return hexStr.split('').map(function (c) { return parseInt(c, 16).toString(2).padStart(4, '0'); }).join(''); }
  function bitDiff(a, b) { var x = bits(a), y = bits(b), n = 0; for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) n++; return n; }
  function utf8(s) { return unescape(encodeURIComponent(s)); }
  function xorHex(aHex, bHex) { var o = ''; for (var i = 0; i < aHex.length && i < bHex.length; i += 2) { var v = parseInt(aHex.substr(i, 2), 16) ^ parseInt(bHex.substr(i, 2), 16); o += v.toString(16).padStart(2, '0'); } return o; }
  function strHex(s) { var b = utf8(s), o = ''; for (var i = 0; i < b.length; i++) o += b.charCodeAt(i).toString(16).padStart(2, '0'); return o; }

  /* ========================= 1. Avalancha de SHA-256 ========================= */

  function hashCalc(host) {
    var a = textInput('transferir 100 USD'), b = textInput('transferir 100 USd');
    var o = {
      ha: outRow('SHA-256 de A', null, true),
      hb: outRow('SHA-256 de B', null, true),
      diff: outRow('Bits distintos de 256', 'efecto avalancha')
    };
    function run() {
      var x = C.sha256(a.value), y = C.sha256(b.value);
      o.ha.value.textContent = x;
      o.hb.value.textContent = y;
      var d = bitDiff(x, y);
      o.diff.value.textContent = F.num(d, 0) + ' de 256 (' + F.pct(d / 256, 0) + ')';
    }
    a.addEventListener('input', run); b.addEventListener('input', run);
    calcShell(host, 'Cambia un carácter y mira la huella',
      'Dos entradas que difieren en un bit (una «d» mayúscula) dan huellas sin parecido: cerca de la mitad de los 256 bits cambian. Así una huella delata el cambio más chico.',
      [field('Mensaje A', a), field('Mensaje B', b)], [o.ha, o.hb, o.diff]);
    run();
  }

  /* ========================= 2. HMAC contra lo casero ========================= */

  function hmacCalc(host) {
    var key = textInput('clave-del-webhook'), msg = textInput('{"evento":"pago","monto":100}');
    var o = {
      hmac: outRow('HMAC-SHA256(clave, mensaje)', 'lo correcto', true),
      home: outRow('SHA-256(clave ‖ mensaje)', 'casero: no se usa', true)
    };
    function run() {
      o.hmac.value.textContent = C.hmacHex(key.value, msg.value);
      o.home.value.textContent = C.sha256(key.value + msg.value);
    }
    key.addEventListener('input', run); msg.addEventListener('input', run);
    calcShell(host, 'La etiqueta de un webhook',
      'Las dos cadenas cambian por completo con la clave, pero solo HMAC tiene pruebas de seguridad. El receptor compara la etiqueta recibida con la calculada en tiempo constante (hmac.compare_digest), nunca con ==.',
      [field('Clave compartida', key), field('Mensaje', msg)], [o.hmac, o.home]);
    run();
  }

  /* ========================= 3. Por qué el nonce no se repite ========================= */

  function nonceSim(host) {
    var KEY = 'clave-de-sesion';
    var M1 = 'ATACAR AL AMANECER', M2 = 'RETIRAR LAS TROPAS!';
    var mode = 'distinto';
    function ks(nonce, len) {
      var out = '', ctr = 0;
      while (out.length < len * 2) { out += C.sha256(KEY + '|' + nonce + '|' + (ctr++)); }
      return out.slice(0, len * 2);
    }
    var body = h('div', { class: 'sim-body' });
    var note = h('p', { class: 'sim-note', 'aria-live': 'polite' });
    function render() {
      body.textContent = '';
      var n1 = 'A1B2C3D4E5F60718';
      var n2 = (mode === 'mismo') ? n1 : '0918273645F6E5D4';
      var L = Math.max(M1.length, M2.length);
      var k1 = ks(n1, L), k2 = ks(n2, L);
      var c1 = xorHex(strHex(M1), k1), c2 = xorHex(strHex(M2), k2);
      function line(lbl, val, cls) {
        return h('div', { class: 'out-row out-row--stack' }, [h('span', { class: 'out-label', text: lbl }), h('output', { class: 'out-value mono' + (cls ? ' ' + cls : ''), text: val })]);
      }
      var box = h('div', { class: 'calc-outputs' }, [
        line('nonce del mensaje 1', n1),
        line('nonce del mensaje 2', n2, mode === 'mismo' ? 'wv-bad' : ''),
        line('flujo que cifra 1', k1),
        line('flujo que cifra 2', k2, mode === 'mismo' ? 'wv-bad' : ''),
        line('cifrado 1', c1),
        line('cifrado 2', c2)
      ]);
      body.appendChild(box);
      if (mode === 'mismo') {
        var lhs = xorHex(c1, c2), rhs = xorHex(strHex(M1), strHex(M2));
        body.appendChild(h('div', { class: 'calc-outputs' }, [
          line('cifrado 1 ⊕ cifrado 2', lhs, 'wv-bad'),
          line('texto 1 ⊕ texto 2', rhs, 'wv-bad')
        ]));
        note.textContent = 'Mismo nonce ⇒ mismo flujo. Entonces (cifrado 1 ⊕ cifrado 2) es igual a (texto 1 ⊕ texto 2): la clave desaparece de la ecuación y los dos cifrados se filtran uno al otro. Por eso el nonce nunca se repite con la misma clave.';
      } else {
        note.textContent = 'Nonces distintos ⇒ flujos sin relación. El mismo texto cifrado dos veces se ve distinto, y no hay ecuación que relacione los cifrados.';
      }
    }
    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'El nonce que no se repite (flujo de juguete)' }),
      chips({ distinto: 'Nonce distinto', mismo: 'Mismo nonce' }, mode, function (k) { mode = k; render(); })]));
    host.appendChild(body);
    host.appendChild(note);
    host.appendChild(h('p', { class: 'sim-foot', text: 'Modelo de juguete: el flujo es SHA-256(clave|nonce|contador), no AES-GCM. Sirve para ver el principio, no para cifrar nada real.' }));
    render();
  }

  /* ========================= 4. Firma con RSA de juguete ========================= */

  function modpow(base, exp, mod) {
    base %= mod; var r = 1n;
    while (exp > 0n) { if (exp & 1n) r = r * base % mod; exp >>= 1n; base = base * base % mod; }
    return r;
  }
  function signSim(host) {
    var N = 3233n, E = 17n, D = 2753n, NB = 3233n, EB = 7n;  // par del emisor y par de un impostor
    var msg = textInput('role=user;exp=1700');
    var scenario = 'ok';
    var o = {
      h: outRow('h = hash(mensaje) mod n'),
      sig: outRow('firma = h^d mod n', 'el emisor, con su privada'),
      chk: outRow('verificar: firma^e mod n'),
      verdict: outRow('¿Coincide con h\'?')
    };
    o.verdict.value.classList.add('mono');
    function digest(s) { return BigInt(parseInt(C.sha256(s).slice(0, 8), 16)) % N; }
    var note = h('p', { class: 'sim-note', 'aria-live': 'polite' });
    function run() {
      var mSent = msg.value, mCheck = msg.value, useN = N, useE = E;
      var hh = digest(mSent);
      var sig = modpow(hh, D, N);
      if (scenario === 'msg') mCheck = msg.value + ' admin';
      if (scenario === 'sig') sig = (sig + 1n) % N;
      if (scenario === 'key') { useN = NB; useE = EB; }
      var hCheck = digest(mCheck) % useN;
      var rec = modpow(sig % useN, useE, useN);
      var ok = rec === hCheck;
      o.h.value.textContent = hh.toString();
      o.sig.value.textContent = sig.toString();
      o.chk.value.textContent = rec.toString() + '  (h\' = ' + hCheck.toString() + ')';
      o.verdict.value.textContent = ok ? '✓ firma válida' : '✗ firma inválida';
      o.verdict.value.classList.toggle('wv-bad', !ok);
      o.verdict.value.classList.toggle('wv-ok', ok);
      var msgs = {
        ok: 'El mensaje no cambió y lo firmó la clave privada del emisor: válido.',
        msg: 'Alguien añadió « admin» al mensaje. El hash h\' ya no es el firmado, así que la firma no verifica: no se puede cambiar el mensaje sin la privada.',
        sig: 'Se alteró la firma. No corresponde a ningún hash de este mensaje: inválida.',
        key: 'Se verifica con la clave pública de un impostor. Solo la pública que hace pareja con la privada que firmó verifica.'
      };
      note.textContent = msgs[scenario];
    }
    msg.addEventListener('input', run);
    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Firmar y verificar (RSA de juguete)' }),
      chips({ ok: 'Original', msg: 'Mensaje cambiado', sig: 'Firma cambiada', key: 'Clave impostora' }, scenario, function (k) { scenario = k; run(); })]));
    host.appendChild(h('div', { class: 'calc-body' }, [h('div', { class: 'calc-inputs' }, [field('Mensaje a firmar', msg)]),
      h('div', { class: 'calc-outputs', 'aria-live': 'polite' }, [o.h.el, o.sig.el, o.chk.el, o.verdict.el])]));
    host.appendChild(note);
    host.appendChild(h('p', { class: 'sim-foot', text: 'n = 3233, e = 17, d = 2753: números de juguete para ver el mecanismo. Una clave real tiene cientos de dígitos y el hash es SHA-256 completo. Diseño de referencia.' }));
    run();
  }

  /* ========================= 5. Diffie-Hellman ========================= */

  function dhCalc(host) {
    var p = numInput(23, 5, 2147483647), g = numInput(5, 2, 1000);
    var a = numInput(6, 1, 1e9), b = numInput(15, 1, 1e9);
    var o = {
      A: outRow('Ana envía  A = g^a mod p'),
      B: outRow('Beto envía  B = g^b mod p'),
      sa: outRow('Ana calcula  B^a mod p'),
      sb: outRow('Beto calcula  A^b mod p'),
      ok: outRow('Secreto compartido')
    };
    var note = h('p', { class: 'calc-note', 'aria-live': 'polite' });
    function iv(el) { var x = parseInt(el.value, 10); return (isFinite(x) && x > 0) ? BigInt(x) : 0n; }
    function run() {
      var P = iv(p), G = iv(g), AA = iv(a), BB = iv(b);
      if (P < 2n || G < 2n || AA < 1n || BB < 1n) { Object.keys(o).forEach(function (k) { o[k].value.textContent = '—'; }); note.textContent = 'Completa p, g y los dos secretos.'; return; }
      var Apub = modpow(G, AA, P), Bpub = modpow(G, BB, P);
      var s1 = modpow(Bpub, AA, P), s2 = modpow(Apub, BB, P);
      o.A.value.textContent = Apub.toString();
      o.B.value.textContent = Bpub.toString();
      o.sa.value.textContent = s1.toString();
      o.sb.value.textContent = s2.toString();
      o.ok.value.textContent = (s1 === s2) ? s1.toString() + '  ✓ los dos coinciden' : 'no coinciden';
      var pubNote = 'Quien escucha ve p, g, A = ' + Apub + ' y B = ' + Bpub + ', pero no a = ' + AA + ' ni b = ' + BB + '.';
      if (P <= 100n) note.textContent = pubNote + ' Con p tan chico se prueban todos los exponentes a mano: por eso p real tiene cientos de dígitos.';
      else note.textContent = pubNote + ' Para hallar el secreto tendría que resolver el logaritmo discreto, inviable a esta escala.';
    }
    [p, g, a, b].forEach(function (el) { el.addEventListener('input', run); });
    var preset = chips({ chico: 'p = 23 (a mano)', grande: 'p = 2 147 483 647' }, 'chico', function (k) {
      if (k === 'chico') { p.value = 23; g.value = 5; a.value = 6; b.value = 15; }
      else { p.value = 2147483647; g.value = 7; a.value = 123456; b.value = 987654; }
      run();
    });
    calcShell(host, 'Diffie-Hellman con números elegibles',
      'Los dos secretos nunca viajan; lo que viaja son A y B. El secreto compartido sale igual de los dos lados. En la realidad se usa sobre curva elíptica (X25519) y con claves efímeras por conexión.',
      [preset, field('Primo p (público)', p), field('Base g (pública)', g), field('Secreto de Ana (a)', a), field('Secreto de Beto (b)', b)],
      [o.A, o.B, o.sa, o.sb, o.ok]);
    note.classList.add('calc-note');
    host.querySelector('.calc-outputs').appendChild(note);
    run();
  }

  /* ========================= 6. Coste de guardar una contraseña ========================= */

  var KDF = {
    sha256: { name: 'SHA-256 a secas', lever: null },
    pbkdf2: { name: 'PBKDF2-HMAC-SHA256', lever: 'iter', def: 600000, owasp: 600000, unit: 'iteraciones' },
    bcrypt: { name: 'bcrypt', lever: 'cost', def: 10, owasp: 10, unit: 'factor de costo' },
    scrypt: { name: 'scrypt', lever: 'npow', def: 17, owasp: 17, unit: 'N = 2^?' },
    argon2id: { name: 'Argon2id', lever: 'mem', def: 19, owasp: 19, unit: 'memoria (MiB)' }
  };
  function kdfCalc(host) {
    var algo = select(Object.keys(KDF).map(function (k) { return [k, KDF[k].name]; }), 'argon2id');
    var lever = numInput(19, 1, 2000000);
    var leverField = field('Parámetro de costo', lever);
    var o = {
      work: outRow('Trabajo por intento'),
      mem: outRow('Memoria por intento'),
      verdict: outRow('¿Alcanza la guía de OWASP?')
    };
    o.verdict.value.classList.add('mono');
    var note = h('p', { class: 'calc-note', 'aria-live': 'polite' });
    function syncLever() {
      var k = algo.value, d = KDF[k];
      if (!d.lever) { leverField.style.display = 'none'; return; }
      leverField.style.display = '';
      leverField.querySelector('label').textContent = d.unit;
      lever.value = d.def;
    }
    function run() {
      var k = algo.value, d = KDF[k], L = parseInt(lever.value, 10) || 0;
      o.mem.value.textContent = 'desde unos pocos KiB';
      if (k === 'sha256') {
        o.work.value.textContent = '1 hash: rapidísimo';
        o.verdict.value.textContent = '✗ no, jamás para contraseñas';
        note.textContent = 'Un hash de propósito general se prueba en masa fuera de línea: el atacante recorre enormes listas de candidatas por cada hash robado. Nunca para contraseñas.';
      } else if (k === 'pbkdf2') {
        o.work.value.textContent = F.num(L, 0) + ' iteraciones de HMAC-SHA-256';
        o.verdict.value.textContent = L >= d.owasp ? '✓ sí (≥ 600 000)' : '✗ sube a 600 000';
        note.textContent = 'PBKDF2 solo encarece por iteraciones; no usa memoria, así que el hardware de ataque lo acelera mucho. Úsalo solo si una certificación lo exige.';
      } else if (k === 'bcrypt') {
        o.work.value.textContent = '2^' + L + ' = ' + F.num(Math.pow(2, Math.min(L, 30)), 0) + ' rondas internas';
        o.verdict.value.textContent = L >= d.owasp ? '✓ sí (costo ≥ 10)' : '✗ sube el costo a 10';
        note.textContent = 'bcrypt duplica el trabajo por cada +1 de costo. Límite de 72 bytes de entrada. Preferible Argon2id en sistemas nuevos.';
      } else if (k === 'scrypt') {
        var blocks = Math.pow(2, Math.min(L, 30));
        o.work.value.textContent = 'N = 2^' + L + ' = ' + F.num(blocks, 0) + ' bloques';
        o.mem.value.textContent = F.bytes(128 * 8 * blocks);
        o.verdict.value.textContent = L >= d.owasp ? '✓ sí (N ≥ 2^17)' : '✗ sube N a 2^17';
        note.textContent = 'scrypt obliga a usar memoria (N·r·128 bytes), lo que encarece el hardware dedicado. Buena opción si no hay Argon2.';
      } else {
        o.work.value.textContent = '2 pasadas sobre ' + L + ' MiB';
        o.mem.value.textContent = L + ' MiB por intento en paralelo';
        o.verdict.value.textContent = L >= d.owasp ? '✓ sí (≥ 19 MiB)' : '✗ sube a 19 MiB';
        note.textContent = 'Argon2id es el preferido: la memoria es lo que más encarece el ataque con GPU o hardware a medida, porque no se puede multiplicar barato. OWASP: m = 19 MiB, t = 2, p = 1.';
      }
    }
    algo.addEventListener('change', function () { syncLever(); run(); });
    lever.addEventListener('input', run);
    calcShell(host, 'Cuánto cuesta cada intento del atacante',
      'La defensa de una contraseña es hacer cada intento caro en tiempo y en memoria. Un hash rápido no sirve; un KDF con memoria, como Argon2id, es lo que recomienda OWASP hoy.',
      [field('Algoritmo', algo), leverField], [o.work, o.mem, o.verdict]);
    host.querySelector('.calc-outputs').appendChild(note);
    syncLever(); run();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-calc="hash"]').forEach(hashCalc);
    document.querySelectorAll('[data-calc="hmac"]').forEach(hmacCalc);
    document.querySelectorAll('[data-sim="nonce"]').forEach(nonceSim);
    document.querySelectorAll('[data-sim="sign"]').forEach(signSim);
    document.querySelectorAll('[data-calc="dh"]').forEach(dhCalc);
    document.querySelectorAll('[data-calc="kdfcost"]').forEach(kdfCalc);
  });
})();
