/* Ejercicio guiado del M36 (criptografía desde cero). Formato en core/exercise.js. */

SD.defineExercise('m36-cripto', {
  title: 'elegir la criptografía de una API con datos sensibles',
  scenario: '<p>Construyes una API para una clínica. Guarda las contraseñas de los usuarios, almacena notas clínicas que son datos sensibles, manda webhooks a laboratorios asociados cuando hay un resultado, y emite tokens de sesión. Tienes un KMS disponible. Para cada pieza, elige la herramienta correcta y cómo usarla. No vas a implementar criptografía: vas a combinar primitivas estándar desde la biblioteca.</p>',
  steps: [
    {
      id: 'passwords', type: 'single',
      prompt: '¿Cómo guardas las contraseñas de los usuarios?',
      options: [
        'Con SHA-256 y una sal por usuario, rápido y sin hashes repetidos',
        'Cifradas con AES-GCM y una clave del KMS, para poder recuperarlas el día que alguien necesite verlas',
        'Con Argon2id y una sal por usuario, guardando su formato',
        'Con MD5 y una sal larga'
      ],
      answer: 2,
      explain: 'Las contraseñas no se cifran (no hace falta recuperarlas) ni se guardan con un hash rápido. Se usa un KDF lento y con memoria, Argon2id, con sal por usuario; el propio texto guarda algoritmo, parámetros y sal. MD5 está roto. Ver 36.9.'
    },
    {
      id: 'notas', type: 'single',
      prompt: 'Las notas clínicas hay que poder leerlas de nuevo. ¿Cómo las proteges en la base?',
      options: [
        'Con AES-256-GCM, un nonce por registro y la clave en el KMS',
        'Con un hash SHA-256 de la nota',
        'Con AES en modo ECB, que es el más simple de implementar y no obliga a manejar ningún nonce aparte',
        'Confiando en el cifrado de disco de la base, que ya protege el archivo entero del servidor por completo'
      ],
      answer: 0,
      explain: 'Un hash no sirve: hay que volver a leer la nota. ECB filtra la forma de los datos. El cifrado de disco protege contra el robo del disco apagado, no contra una consulta con credenciales robadas. Cifrado a nivel de campo con AEAD y clave en el KMS. Ver 36.4 y M10.'
    },
    {
      id: 'nonce', type: 'single',
      prompt: 'Para ese cifrado con AES-GCM, ¿cómo manejas el nonce de cada nota?',
      options: [
        'Uno fijo en la configuración, igual para todas',
        'Uno nuevo por registro, generado por la biblioteca y guardado junto al cifrado',
        'El identificador de la nota',
        'Ninguno, porque AES-GCM genera y esconde el nonce por dentro sin que tengas que ocuparte de él'
      ],
      answer: 1,
      explain: 'El nonce no se repite con la misma clave; uno fijo repite el peor caso en toda la tabla. No es secreto, así que se guarda junto al cifrado. Usar el id de la nota lo ata a un valor que podría reaparecer; mejor que lo genere la biblioteca. Ver 36.4.'
    },
    {
      id: 'webhooks', type: 'single',
      prompt: 'Mandas un webhook al laboratorio con el resultado. ¿Cómo lo proteges para que confíe en él?',
      options: [
        'Mandas la API key del laboratorio dentro del cuerpo del webhook',
        'No agregas nada: ya viaja por HTTPS',
        'Firmas el cuerpo y una marca de tiempo con HMAC y un secreto por laboratorio',
        'Firmas el cuerpo con MD5, que es rápido y el laboratorio igual lo da por bueno al verificarlo después'
      ],
      answer: 2,
      explain: 'HTTPS protege el transporte, pero el laboratorio quiere verificar el mensaje en sí. Se firma con HMAC y un secreto por laboratorio, con una marca de tiempo para que no se reenvíe. La API key en el cuerpo se filtra en los logs; MD5 está roto. Ver 36.3, M02 y M27.'
    },
    {
      id: 'tokens', type: 'single',
      prompt: '¿Cómo generas los tokens de sesión?',
      options: [
        'Con el CSPRNG del sistema (secrets.token_urlsafe), guardando su hash',
        'Con un id que aumenta de uno en uno',
        'Con la hora en microsegundos, que entre dos usuarios distintos casi nunca termina repitiéndose igual',
        'Con el generador rápido del lenguaje, que para un simple token de sesión ya alcanza de sobra'
      ],
      answer: 0,
      explain: 'Un token de sesión es un secreto: sale del CSPRNG del sistema, nunca del generador común ni de la hora ni de un contador, todos predecibles. Guardar su hash evita que una fuga de la base entregue los tokens vivos. Ver 36.10.'
    },
    {
      id: 'claves', type: 'multi',
      prompt: '¿Qué prácticas sobre las claves y los secretos de esta API son correctas? Marca todas las que apliquen.',
      options: [
        'Las claves viven en el KMS o un gestor de secretos, nunca en el código',
        'Se rotan las claves y se descifra lo viejo mientras se cifra lo nuevo',
        'Las etiquetas y firmas se comparan en tiempo constante, no con ==',
        'La clave de cifrado va incrustada dentro de la imagen del contenedor'
      ],
      answer: [0, 1, 2],
      explain: 'Las claves van al KMS o al gestor de secretos, se rotan con un plan que convive con los datos viejos, y las comparaciones de etiquetas son de tiempo constante. Incrustar la clave en la imagen la deja en un registro que muchos pueden leer y hace imposible rotarla. Ver 36.3, 36.11 y M10.'
    }
  ],
  solution: '<ul>' +
    '<li><b>Contraseñas:</b> Argon2id con sal por usuario (OWASP: m = 19 MiB, t = 2, p = 1); el texto guardado trae algoritmo, parámetros y sal, y se rehace en el login cuando subes el costo.</li>' +
    '<li><b>Notas clínicas:</b> cifrado a nivel de campo con AES-256-GCM, un nonce nuevo por registro guardado junto al cifrado, y la clave de datos protegida por el KMS (envelope encryption de M10).</li>' +
    '<li><b>Webhooks:</b> HMAC-SHA256 sobre el cuerpo y una marca de tiempo, con un secreto por laboratorio y una tolerancia corta contra reenvíos; comparación en tiempo constante.</li>' +
    '<li><b>Tokens:</b> del CSPRNG del sistema (<code>secrets.token_urlsafe(32)</code>), guardando solo su hash; nada de contadores ni de la hora.</li>' +
    '<li><b>Claves:</b> todas en el KMS o el gestor de secretos, nunca en el código ni en la imagen; con plan de rotación. Y la regla que atraviesa todo: no inventes criptografía, combina primitivas estándar desde una biblioteca revisada.</li>' +
    '</ul>'
});
