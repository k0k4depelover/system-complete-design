SD.defineQuiz('m10', {
  title: 'Quiz: seguridad e identidad',
  pass: 0.7,
  questions: [
    {
      id: 'jwt-leer', type: 'single',
      prompt: 'Un JWT firmado con HS256 viaja en el header Authorization. ¿Quién puede leer su payload?',
      options: [
        'Solo quien tenga el secreto HS256, que sirve tanto para firmar como para descifrar.',
        'Cualquiera que tenga el token: el payload va en base64url, no cifrado.',
        'Nadie fuera del servidor: el payload va cifrado con AES y la firma lo protege.',
        'Solo el navegador que lo recibió, porque el token queda atado a su origen.'
      ],
      answer: 1,
      explain: 'Por eso nunca se ponen datos sensibles en un JWT. Si hace falta confidencialidad, se usa JWE (cifrado) o un token opaco.'
    },
    {
      id: 'revocar', type: 'single',
      prompt: 'Un empleado es despedido y su JWT de acceso vence en 12 horas. ¿Cuál es el problema de diseño?',
      options: [
        'Ninguno: al borrar al usuario de la base, sus tokens dejan de validar enseguida.',
        'Un JWT se verifica sin consultar a nadie, así que sigue valiendo hasta que vence.',
        'Que el JWT es muy largo y no entra en el header si se le agregan más permisos.',
        'Que HS256 es inseguro y debería usarse RS256, que sí permite revocar tokens antes de que venzan.'
      ],
      answer: 1,
      explain: 'La ventaja del JWT (no consultar al emisor) es también su límite. Con access tokens de 5 a 15 minutos, revocar el refresh token corta el acceso en minutos.'
    },
    {
      id: 'alg', type: 'single',
      prompt: '¿Por qué la API debe fijar el algoritmo de verificación en lugar de leerlo del header del JWT?',
      options: [
        'Por rendimiento: leer el algoritmo del header obliga a parsear el token dos veces.',
        'Porque un atacante podría mandar alg "none" o cambiar de algoritmo y engañar la verificación.',
        'Porque el header va cifrado y la API no puede leerlo antes de verificar la firma.',
        'Por compatibilidad con navegadores viejos que no soportan todos los algoritmos.'
      ],
      answer: 1,
      explain: 'El header lo controla quien envía el token. Confiar en él para decidir cómo verificarlo es dejar que el atacante elija las reglas. Pruébalo en el laboratorio con "alg: none".'
    },
    {
      id: 'pkce', type: 'single',
      prompt: 'En OAuth con authorization code, ¿qué problema resuelve PKCE?',
      options: [
        'Que un usuario use una contraseña débil al iniciar sesión en el servidor de autorización.',
        'Que un código de autorización interceptado se pueda canjear por tokens.',
        'Que los tokens venzan mientras el usuario está en medio de una operación larga.',
        'Que un atacante robe el refresh token guardado en el almacenamiento del navegador.'
      ],
      answer: 1,
      explain: 'Las apps móviles y las SPA no pueden guardar un client secret. PKCE reemplaza ese secreto por uno de un solo uso, generado en cada login. Hoy se recomienda para todos los clientes.'
    },
    {
      id: 'apikey', type: 'single',
      prompt: '¿Cómo se deben guardar las API keys que emites a tus clientes?',
      options: [
        'En texto plano, para poder mostrarlas de nuevo cuando el cliente las pida desde el panel.',
        'Solo su hash y un prefijo visible; la clave completa se muestra una sola vez.',
        'Cifradas con AES, con la clave de cifrado en el mismo servidor de la API.',
        'En un JWT firmado que guarda el cliente, sin copia del lado del servidor.'
      ],
      answer: 1,
      explain: 'Si se filtra tu base, los hashes no sirven para autenticarse. Como las API keys son largas y aleatorias, un hash rápido es suficiente (no hace falta bcrypt). El prefijo (por ejemplo <code>sk_live_</code>) permite reconocerlas en logs y en escáneres de secretos.'
    },
    {
      id: 'bola', type: 'single',
      prompt: '<code>GET /v1/facturas/9912</code> devuelve la factura a cualquier usuario autenticado, sea o no su dueño. ¿Qué vulnerabilidad es?',
      options: ['SSRF: el servidor hace requests a destinos que elige el usuario.', 'BOLA (IDOR): no se verifica que el objeto sea de quien lo pide.', 'CSRF: otra página dispara la request con la cookie del usuario.', 'Broken authentication: el token del usuario no se valida bien.'],
      answer: 1,
      explain: 'Es la vulnerabilidad más común de las APIs. Cada acceso a un objeto verifica su dueño o tenant, idealmente de forma que no se pueda olvidar: filtros obligatorios en la capa de datos o row-level security.'
    },
    {
      id: 'envelope', type: 'single',
      prompt: '¿Por qué se usa envelope encryption en lugar de cifrar cada dato directamente con la clave del KMS?',
      options: [
        'Porque el KMS no sabe cifrar datos, solo guardar claves maestras.',
        'Porque los datos se cifran localmente con una clave de datos y al KMS solo viaja esa clave.',
        'Porque es más seguro guardar la clave maestra en la base, junto a los datos cifrados.',
        'Porque el KMS comprime los datos antes de cifrarlos y eso ahorra almacenamiento.'
      ],
      answer: 1,
      explain: 'Mandar terabytes al KMS sería lento y caro. Con envelope encryption, la clave maestra nunca sale del KMS y cada uso queda auditado. Destruir la DEK de un usuario vuelve ilegibles todas sus copias, incluidas las de backups (crypto-shredding).'
    },
    {
      id: 'ssrf', type: 'single',
      prompt: 'Tu servicio descarga una imagen desde una URL que envía el usuario. ¿Qué riesgo hay si no validas el destino?',
      options: [
        'Ninguno: es solo una imagen y el servidor la descarga como cualquier navegador.',
        'SSRF: el usuario puede apuntar a direcciones internas, como el endpoint de metadatos.',
        'Que la imagen sea muy grande y llene el disco: es el único riesgo real de descargar archivos ajenos.',
        'CSRF: la URL puede hacer que el navegador del usuario envíe su cookie.'
      ],
      answer: 1,
      explain: 'Se valida la URL después de resolver el DNS (bloqueando rangos privados y de metadatos), se usa la versión del servicio de metadatos que exige un token de sesión, y estas descargas se hacen desde un entorno aislado sin credenciales.'
    },
    {
      id: 'tenant', type: 'multi',
      prompt: '¿Qué medidas ayudan a aislar tenants en un SaaS que comparte base de datos?',
      options: [
        'Un tenant_id en cada tabla y en cada consulta.',
        'Row-level security en la base, para que un olvido en el código no filtre datos.',
        'Confiar en que el frontend solo muestra los datos del tenant.',
        'Claves de cifrado por tenant para datos sensibles.',
        'Límites de uso por tenant para evitar el vecino ruidoso.'
      ],
      answer: [0, 1, 3, 4],
      explain: 'El aislamiento se aplica en el servidor, en capas. El frontend no es una barrera de seguridad: cualquiera puede llamar a la API directamente.'
    },
    {
      id: 'stateful', type: 'single',
      prompt: 'Despides a un empleado y quieres que su sesión deje de funcionar en segundos, no cuando venza el access token. ¿Qué diseño lo permite?',
      options: [
        'Alargar el access token a varias horas para controlarlo mejor desde el servidor.',
        'Guardar el estado de cada sesión en una caché y comprobarlo en el gateway en cada request.',
        'Cifrar el access token con una clave que solo conoce el gateway, para que nadie más pueda leer su contenido ni modificar sus claims en tránsito.',
        'Poner toda la información del usuario dentro del JWT para no depender de la base.'
      ],
      answer: 1,
      explain: 'Un JWT puro no se puede revocar antes de su <code>exp</code>. Dándole estado (un <code>sid</code> que el gateway comprueba en Redis), revocar la sesión la corta en la siguiente request, sin renunciar a la verificación local de la firma.'
    },
    {
      id: 'refresh-reuse', type: 'single',
      prompt: 'Un refresh token ya rotado (marcado como usado) vuelve a aparecer en una petición de refresh. ¿Qué debe hacer el servidor?',
      options: [
        'Aceptarlo: puede ser la app legítima reintentando tras un corte de red, así que lo mejor es no molestar al usuario con un cierre de sesión inesperado.',
        'Emitir tokens nuevos solo si viene de la misma IP que la primera vez.',
        'Revocar toda la familia de la sesión, porque hay dos copias del token en circulación.',
        'Ignorar la petición en silencio y dejar que el access token actual siga vivo.'
      ],
      answer: 2,
      explain: 'Un token usado que reaparece significa que hay una copia: una es del atacante y el servidor no sabe cuál. Revoca la sesión entera. La víctima vuelve a entrar con su contraseña y su segundo factor; el atacante no.'
    },
    {
      id: 'pkce-confirm', type: 'single',
      prompt: '¿En qué se diferencia PKCE del número que confirmas en la app del teléfono al aprobar un inicio de sesión?',
      options: [
        'En nada: PKCE es justamente ese número de confirmación con otro nombre.',
        'PKCE es automático entre máquinas; el número lo confirma el usuario a mano.',
        'PKCE lo escribe el usuario en otra pantalla, como al activar YouTube en un televisor que no tiene un teclado cómodo para la contraseña.',
        'PKCE solo se usa en aplicaciones de banca; el número, en cualquier app.'
      ],
      answer: 1,
      explain: 'PKCE (RFC 7636) ocurre entre máquinas y el usuario no lo ve. El number matching del MFA push y el Device Authorization Grant (el código del televisor) sí involucran al usuario, y son mecanismos distintos.'
    },
    {
      id: 'shred-backup', type: 'single',
      prompt: 'Un usuario ejerce su derecho al borrado, pero sus datos también están en backups inmutables de 30 días. ¿Cómo los vuelves ilegibles?',
      options: [
        'Editando cada backup para quitar las filas del usuario.',
        'Esperando 30 días a que los backups caduquen por sí solos; mientras tanto no hay absolutamente nada más que se pueda hacer al respecto.',
        'Cifrando los datos con una clave propia del usuario y destruyendo esa clave.',
        'Comprimiendo los backups para que las filas antiguas se sobrescriban.'
      ],
      answer: 2,
      explain: 'Es el borrado criptográfico. Si cada usuario tiene su clave y esta vive fuera de los backups (en el KMS), destruirla vuelve ilegibles todas sus copias a la vez, aunque no puedas tocar los backups.'
    },
    {
      id: 'audit-log', type: 'single',
      prompt: '¿Qué distingue a un log de auditoría de los logs normales de la aplicación?',
      options: [
        'Registra el contenido completo de cada request y de cada respuesta para poder depurar los problemas mucho más rápido cuando algo falla en producción.',
        'Es append-only, va aparte y guarda poca información sensible, para investigar, no para depurar.',
        'Es el mismo log de aplicación, solo que con el nivel subido a DEBUG.',
        'Guarda las contraseñas de los usuarios por si hay que verificar un acceso después.'
      ],
      answer: 1,
      explain: 'El log de auditoría anota acciones sensibles (quién, qué, cuándo, desde dónde), es append-only y a prueba de manipulación, y no guarda secretos ni datos personales de más. Los logs de aplicación son para depurar y se rotan en días.'
    }
  ]
});
