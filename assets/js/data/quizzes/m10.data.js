SD.defineQuiz('m10', {
  title: 'Quiz: seguridad e identidad',
  pass: 0.7,
  questions: [
    {
      id: 'jwt-leer', type: 'single',
      prompt: 'Un JWT firmado con HS256 viaja en el header Authorization. ¿Quién puede leer su payload?',
      options: [
        'Solo quien tenga el secreto.',
        'Cualquiera que tenga el token: el payload está codificado en base64url, no cifrado. La firma impide modificarlo, no leerlo.',
        'Nadie: está cifrado con AES.',
        'Solo el navegador.'
      ],
      answer: 1,
      explain: 'Por eso nunca se ponen datos sensibles en un JWT. Si hace falta confidencialidad, se usa JWE (cifrado) o un token opaco.'
    },
    {
      id: 'revocar', type: 'single',
      prompt: 'Un empleado es despedido y su JWT de acceso vence en 12 horas. ¿Cuál es el problema de diseño?',
      options: [
        'Ninguno.',
        'Un JWT se verifica sin consultar a nadie, así que no se puede revocar antes de que venza. Se usan access tokens cortos (minutos) más refresh tokens que sí se revocan, o una lista de revocación para casos críticos.',
        'Que el JWT es muy largo.',
        'Que HS256 es inseguro.'
      ],
      answer: 1,
      explain: 'La ventaja del JWT (no consultar al emisor) es también su límite. Con access tokens de 5 a 15 minutos, revocar el refresh token corta el acceso en minutos.'
    },
    {
      id: 'alg', type: 'single',
      prompt: '¿Por qué la API debe fijar el algoritmo de verificación en lugar de leerlo del header del JWT?',
      options: [
        'Por rendimiento.',
        'Porque un atacante podría enviar alg "none" (sin firma) o cambiar de algoritmo para que la verificación use la clave equivocada.',
        'Porque el header no se puede leer.',
        'Por compatibilidad con navegadores viejos.'
      ],
      answer: 1,
      explain: 'El header lo controla quien envía el token. Confiar en él para decidir cómo verificarlo es dejar que el atacante elija las reglas. Pruébalo en el laboratorio con "alg: none".'
    },
    {
      id: 'pkce', type: 'single',
      prompt: 'En OAuth con authorization code, ¿qué problema resuelve PKCE?',
      options: [
        'Que el usuario olvide su contraseña.',
        'Que un código de autorización interceptado (por otra app en el mismo dispositivo, por ejemplo) pueda canjearse por tokens: sin el verificador original, el canje falla.',
        'Que los tokens venzan.',
        'Que el servidor de autorización se caiga.'
      ],
      answer: 1,
      explain: 'Las apps móviles y las SPA no pueden guardar un client secret. PKCE reemplaza ese secreto por uno de un solo uso, generado en cada login. Hoy se recomienda para todos los clientes.'
    },
    {
      id: 'apikey', type: 'single',
      prompt: '¿Cómo se deben guardar las API keys que emites a tus clientes?',
      options: [
        'En texto plano, para poder mostrarlas cuando el cliente las pida.',
        'Solo un hash (por ejemplo SHA-256) más un prefijo visible para identificarlas; la clave completa se muestra una única vez al crearla.',
        'Cifradas con una clave que está en el mismo servidor.',
        'En el frontend.'
      ],
      answer: 1,
      explain: 'Si se filtra tu base, los hashes no sirven para autenticarse. Como las API keys son largas y aleatorias, un hash rápido es suficiente (no hace falta bcrypt). El prefijo (por ejemplo <code>sk_live_</code>) permite reconocerlas en logs y en escáneres de secretos.'
    },
    {
      id: 'bola', type: 'single',
      prompt: '<code>GET /v1/facturas/9912</code> devuelve la factura a cualquier usuario autenticado, sea o no su dueño. ¿Qué vulnerabilidad es?',
      options: ['SSRF', 'BOLA (IDOR): falta verificar que el objeto pertenece a quien lo pide.', 'CSRF', 'XSS'],
      answer: 1,
      explain: 'Es la vulnerabilidad más común de las APIs. Cada acceso a un objeto verifica su dueño o tenant, idealmente de forma que no se pueda olvidar: filtros obligatorios en la capa de datos o row-level security.'
    },
    {
      id: 'envelope', type: 'single',
      prompt: '¿Por qué se usa envelope encryption en lugar de cifrar cada dato directamente con la clave del KMS?',
      options: [
        'Porque el KMS no sabe cifrar.',
        'Porque así los datos (que pueden ser enormes) se cifran localmente con una clave de datos, y al KMS solo va esa clave pequeña; además permite borrar un dato para siempre destruyendo su clave.',
        'Porque es más seguro guardar la clave maestra en la base.',
        'Para comprimir los datos.'
      ],
      answer: 1,
      explain: 'Mandar terabytes al KMS sería lento y caro. Con envelope encryption, la clave maestra nunca sale del KMS y cada uso queda auditado. Destruir la DEK de un usuario vuelve ilegibles todas sus copias, incluidas las de backups (crypto-shredding).'
    },
    {
      id: 'ssrf', type: 'single',
      prompt: 'Tu servicio descarga una imagen desde una URL que envía el usuario. ¿Qué riesgo hay si no validas el destino?',
      options: [
        'Ninguno: es solo una imagen.',
        'SSRF: el usuario puede apuntar a direcciones internas, como el endpoint de metadatos de la nube (169.254.169.254), y obtener credenciales o datos internos.',
        'Que la imagen sea muy grande.',
        'CSRF.'
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
    }
  ]
});
