/* Envelope encryption animado (M10): <div data-sim="envelope"></div>
   Cuatro escenas sobre SD.flowAnim (sim-dbflow.js): cifrar, leer, rotar la clave maestra y borrado criptográfico. */
(function () {
  'use strict';
  var SD = window.SD;

  function M(f, t, k, l) { return [f, t, k, l]; }
  function S(m, say, set) { return { m: m, say: say, set: set || null }; }

  var N = {
    APP: { x: 14, y: 112, w: 200, h: 104, name: 'Tu servicio', sub: 'cifra y descifra', c: '--l-service' },
    KMS: { x: 520, y: 10, w: 200, h: 104, name: 'KMS', sub: 'la KEK nunca sale', c: '--l-edge' },
    DB: { x: 520, y: 214, w: 200, h: 104, name: 'Base o bucket', sub: 'lo que se guarda', c: '--l-db' }
  };
  var NB = {
    APP: N.APP, KMS: N.KMS, DB: N.DB,
    BK: { x: 262, y: 254, w: 200, h: 92, name: 'Backups', sub: '30 días, no se editan', c: '--l-external' }
  };
  var E = [['APP', 'KMS'], ['APP', 'DB']];
  var STORED = { DB: { v: ['texto cifrado + nonce', 'DEK cifrada'] } };

  var CFG = {
    title: 'Envelope encryption paso a paso',
    aria: 'Tu servicio, el KMS y la base; mensajes que muestran cómo viajan la clave de datos y la clave cifrada',
    vbw: 734, vbh: 352,
    foot: 'Las llamadas son las de AWS KMS (GenerateDataKey, Decrypt, ReEncrypt, ScheduleKeyDeletion); Google Cloud KMS y Azure Key Vault tienen equivalentes. El botón alterna lento, rápido y pausa; las flechas avanzan de a un paso.',
    scenes: [
      { id: 'cifrar', name: 'Cifrar', nodes: N, edges: E,
        init: { APP: { v: ['mensaje en claro'] }, KMS: { v: ['KEK alias/chat'] } },
        def: 'Tu servicio va a guardar un mensaje de chat. El KMS nunca ve el mensaje: solo genera y envuelve una clave de 32 bytes.',
        rows: [['La clave', 'El dato no viaja al KMS. Viaja la DEK, que mide 32 bytes aunque el dato mida un gigabyte.']],
        steps: [
          S([M('APP', 'KMS', 'req', 'GenerateDataKey')], 'Tu servicio pide una clave de datos nueva: <code>GenerateDataKey(KeyId="alias/chat", KeySpec="AES_256")</code>. Antes de responder, el KMS revisa que la identidad de este servicio tenga permiso para usar esa KEK y deja el pedido registrado.', { APP: { st: 'on', v: ['mensaje en claro', 'pidió una DEK'] } }),
          S([M('KMS', 'APP', 'res', 'DEK + DEK cifrada')], 'El KMS genera 32 bytes aleatorios (la DEK) y devuelve dos copias: una en claro y otra cifrada con la KEK. La KEK no sale nunca de su hardware.', { APP: { v: ['mensaje en claro', 'DEK en claro (memoria)', 'DEK cifrada'] } }),
          S([], 'Tu servicio cifra el mensaje <b>en su propia CPU</b> con AES-256-GCM, la DEK y un nonce aleatorio de 12 bytes. GCM también calcula una etiqueta que delata cualquier cambio posterior.', { APP: { v: ['texto cifrado + nonce', 'DEK en claro (memoria)', 'DEK cifrada'] } }),
          S([], 'Borra la DEK en claro de la memoria. Desde ahora, ni tu propio servicio puede leer el mensaje sin volver a pedirle permiso al KMS.', { APP: { st: 'ok', v: ['texto cifrado + nonce', 'DEK cifrada'] } }),
          S([M('APP', 'DB', 'write', 'INSERT')], 'Guarda juntos el texto cifrado, el nonce y la DEK cifrada. Quien robe la base se lleva dos cosas ilegibles: el dato sin la DEK, y la DEK sin la KEK.', { APP: { st: '', v: [] }, DB: { st: 'ok', v: ['texto cifrado + nonce', 'DEK cifrada'] } })
        ] },
      { id: 'leer', name: 'Leer', nodes: N, edges: E,
        init: { KMS: { v: ['KEK alias/chat'] }, DB: STORED.DB },
        def: 'Un usuario abre la conversación y tu servicio tiene que mostrar el mensaje.',
        rows: [['La clave', 'Cada lectura es una llamada al KMS, y cada llamada queda auditada. Para no pagar una por fila, los SDK de cifrado cachean la DEK en memoria unos minutos, a cambio de que viva más tiempo en claro.']],
        steps: [
          S([M('APP', 'DB', 'req', 'SELECT')], 'Tu servicio lee la fila: texto cifrado, nonce y DEK cifrada.', { APP: { st: 'on', v: ['texto cifrado + nonce', 'DEK cifrada'] } }),
          S([M('APP', 'KMS', 'req', 'Decrypt(DEK cifrada)')], 'Manda al KMS <b>solo la DEK cifrada</b>. El KMS comprueba el permiso y registra quién la pidió, cuándo y con qué contexto (en AWS, en CloudTrail).', {}),
          S([M('KMS', 'APP', 'res', 'DEK en claro')], 'El KMS desenvuelve la DEK dentro de su hardware y la devuelve en claro, por TLS.', { APP: { v: ['texto cifrado + nonce', 'DEK en claro (memoria)'] } }),
          S([], 'Tu servicio descifra el mensaje localmente con AES-GCM. Si alguien cambió un solo bit del texto cifrado, la etiqueta no coincide y el descifrado falla en lugar de devolver basura.', { APP: { st: 'ok', v: ['mensaje en claro', 'DEK descartada'] } })
        ] },
      { id: 'rotar', name: 'Rotar la KEK', nodes: N, edges: E,
        init: { KMS: { v: ['KEK v1'] }, DB: { v: ['mensaje de 2024', 'DEK cifrada con v1'] } },
        def: 'La clave maestra se rota con el tiempo. ¿Hay que recifrar todos los datos?',
        rows: [['La clave', 'Rotar la KEK no toca los datos. Lo nuevo se envuelve con la versión nueva y lo viejo se sigue abriendo con la vieja. Si hace falta retirar una versión, se recifran claves de 32 bytes, nunca los datos.']],
        steps: [
          S([], 'Llega la fecha de rotación (en AWS KMS, la rotación automática es anual por defecto). El KMS crea material nuevo (v2) y <b>conserva</b> el viejo (v1) para descifrar.', { KMS: { st: 'on', v: ['v2: envuelve lo nuevo', 'v1: solo desenvuelve'] } }),
          S([M('APP', 'DB', 'req', 'SELECT')], 'Tu servicio lee un mensaje de 2024. Su DEK la envolvió la v1, y la DEK cifrada lleva el identificador de la versión que la cifró.', { APP: { st: 'on', v: ['mensaje de 2024', 'DEK cifrada con v1'] } }),
          S([M('APP', 'KMS', 'req', 'Decrypt')], 'Pide desenvolver la DEK, igual que siempre. El KMS ve que corresponde a la v1 y usa ese material.', {}),
          S([M('KMS', 'APP', 'res', 'DEK')], 'Devuelve la DEK y tu servicio descifra el mensaje. Para tu código no cambió nada.', { APP: { st: 'ok', v: ['mensaje en claro'] } }),
          S([M('APP', 'KMS', 'req', 'ReEncrypt')], 'Opcional: para retirar la v1, cada DEK vieja se recifra con <code>ReEncrypt</code>, que desenvuelve y vuelve a envolver dentro del KMS sin que la DEK en claro salga. Son unos cientos de bytes por fila, no el mensaje.', { APP: { st: '', v: [] }, DB: { st: 'ok', v: ['mensaje de 2024 (igual)', 'DEK cifrada con v2'] } })
        ] },
      { id: 'shred', name: 'Borrado criptográfico', nodes: NB, edges: E.concat([['DB', 'BK'], ['BK', 'APP']]),
        init: { KMS: { v: ['KEK de Acme'] }, DB: { v: ['datos de Acme: cifrados', 'DEK de Acme: cifrada'] }, BK: { v: ['copia de hace 20 días', 'con la DEK cifrada'] } },
        def: 'La empresa Acme deja de ser cliente y exige que borres todos sus datos. Cada empresa tiene su propia KEK en el KMS.',
        rows: [['La clave', 'Se destruye lo que <b>no</b> está en los backups. Si la DEK de Acme estuviera envuelta con una KEK compartida, borrar las filas no alcanzaría: la copia del backup se seguiría abriendo.']],
        steps: [
          S([], 'Los datos de Acme están en la base y en 30 días de backups que no se pueden editar. Borrar fila por fila dentro de cada backup no es posible.', { BK: { st: 'warn' } }),
          S([M('APP', 'DB', 'write', 'DELETE')], 'Borras las filas de la base. Los backups siguen teniendo los datos cifrados y la DEK cifrada de Acme.', { DB: { v: ['filas de Acme: borradas'] } }),
          S([M('APP', 'KMS', 'req', 'ScheduleKeyDeletion')], 'Programas el borrado de la KEK de Acme. AWS KMS obliga a esperar entre 7 y 30 días antes de destruirla, por si fue un error; mientras tanto la clave queda deshabilitada.', { KMS: { st: 'warn', v: ['KEK de Acme: deshabilitada', 'se destruye en 7 a 30 días'] } }),
          S([], 'Pasa la espera y el KMS destruye la KEK. No hay copia: nunca salió de su hardware.', { KMS: { st: 'fail', v: ['KEK de Acme: destruida'] } }),
          S([M('BK', 'APP', 'res', 'restaurar')], 'Alguien restaura el backup de hace 20 días. Aparecen los datos cifrados y la DEK cifrada, pero desenvolver la DEK exige la KEK, y ya no existe. Los datos quedaron ilegibles en todas las copias a la vez.', { BK: { st: 'fail', v: ['copia de hace 20 días', 'ilegible para siempre'] }, APP: { st: 'fail', v: ['Decrypt: la KEK no existe'] } })
        ] }
    ]
  };

  SD.ready(function () {
    if (!SD.flowAnim) return;
    document.querySelectorAll('[data-sim="envelope"]').forEach(function (el) { SD.flowAnim(el, CFG); });
  });
})();
