SD.defineExercise('m37-nube', {
  title: 'endurecer la arquitectura de un SaaS en la nube',
  scenario: '<p>Un SaaS procesa facturas de varios clientes en la nube. Tiene un <b>servicio de facturas</b>, un '
    + '<b>servicio de PDF</b> que genera los documentos, una <b>base de datos</b> y un <b>bucket</b> por tenant. '
    + 'Lo vas a endurecer decisión por decisión, con el mínimo privilegio como guía. Cada paso muestra por qué, '
    + 'y el siguiente aparece cuando quieras seguir.</p>',
  steps: [
    {
      id: 'red', type: 'single',
      prompt: '¿Dónde pones la base de datos y cómo la expones?',
      options: [
        'En la subred privada, sin IP pública, accesible solo desde la VPC',
        'En la subred pública, con una IP fija y una contraseña larga y robusta',
        'En la subred pública detrás del balanceador, para que responda con menos latencia a las consultas'
      ],
      answer: 0,
      explain: 'La base nunca tiene IP pública. Vive en la subred privada y se llega a ella solo desde dentro de la VPC. Exponerla a internet, aunque sea con contraseña, agranda la superficie sin necesidad. Ver 37.3.'
    },
    {
      id: 'iam', type: 'single',
      prompt: 'El servicio de facturas necesita leer y escribir en el bucket de cada tenant. ¿Qué política de IAM le das?',
      options: [
        'Una con Action y Resource en comodín, así nunca falta un permiso cuando crezca',
        'Allow de GetObject y PutObject, limitado al bucket, con una condición por tenant',
        'Permiso de administrador sobre todo el almacén de objetos de la cuenta completa'
      ],
      answer: 1,
      explain: 'Mínimo privilegio: solo leer y escribir, solo en el bucket que le toca, y una condición que ata el acceso al tenant. El comodín o el admin convierten una credencial filtrada en acceso total. Ver 37.2.'
    },
    {
      id: 'secreto', type: 'single',
      prompt: '¿Cómo recibe el servicio la contraseña de la base de datos?',
      options: [
        'En una variable de entorno fijada en la imagen del contenedor que se versiona',
        'En un archivo de configuración cifrado que viaja junto al código en el repositorio',
        'La pide al gestor de secretos en el arranque; su rol autoriza y el gestor la rota'
      ],
      answer: 2,
      explain: 'El secreto se pide en tiempo de ejecución al gestor, que lo cifra con el KMS, lo entrega solo al rol autorizado y lo rota. Nunca viaja en el repositorio ni en la imagen. Ver 37.5.'
    },
    {
      id: 'mtls', type: 'single',
      prompt: 'El servicio de facturas llama al de PDF dentro de la VPC. ¿Cómo se autentican entre ellos?',
      options: [
        'Confían el uno en el otro porque los dos corren en la misma subred privada',
        'Cada uno presenta y verifica un certificado de identidad de corta vida con mTLS',
        'El de PDF acepta cualquier llamada que traiga la IP interna del de facturas'
      ],
      answer: 1,
      explain: 'La red no autentica: una IP interna no prueba identidad. Con mTLS y un SVID de SPIFFE, cada servicio prueba quién es en cada conexión. Es zero trust aplicado entre servicios. Ver 37.4 y 37.6.'
    },
    {
      id: 'guardrail', type: 'multi',
      prompt: '¿Qué guardarraíles de organización (SCP) pones para que ni un administrador los pueda saltar?',
      options: [
        'Prohibir desactivar CloudTrail en cualquier cuenta',
        'Prohibir que los buckets se hagan públicos',
        'Exigir IMDSv2 en las instancias nuevas',
        'Dar permiso de administrador a todos los desarrolladores para que no se bloqueen',
        'Abrir el acceso SSH desde cualquier IP para poder depurar rápido'
      ],
      answer: [0, 1, 2],
      explain: 'Los guardarraíles son el deny explícito a escala de organización: nadie desactiva la auditoría, nadie expone buckets, todas las instancias usan IMDSv2. Dar admin a todos o abrir SSH al mundo es lo contrario del mínimo privilegio. Ver 37.7 y 37.8.'
    }
  ],
  solution: '<p>La arquitectura endurecida, capa por capa:</p>'
    + '<ul>'
    + '<li><b>Red:</b> base y servicios en la subred privada, sin IP pública; balanceador y WAF en la pública; endpoints privados para hablar con el almacén y el gestor de secretos sin salir a internet.</li>'
    + '<li><b>IAM:</b> un rol por servicio, con una política de mínimo privilegio y una condición por tenant; nada de comodines ni de admin; el deny explícito protege lo crítico.</li>'
    + '<li><b>Secretos y claves:</b> contraseñas en el gestor de secretos con rotación, cifradas por el KMS; la clave raíz nunca sale del HSM; credenciales temporales por rol, no llaves largas.</li>'
    + '<li><b>Identidad entre servicios:</b> mTLS con SPIFFE/SPIRE; la confianza viene de la identidad probada, no de la red (zero trust).</li>'
    + '<li><b>Auditoría y barandas:</b> CloudTrail append-only en una cuenta aparte; guardarraíles que prohíben desactivar la auditoría, exponer buckets y omitir IMDSv2.</li>'
    + '<li><b>Incidentes:</b> un plan de detectar, contener, erradicar, recuperar y aprender, con rotación de toda credencial que pudo verse y un postmortem sin culpables.</li>'
    + '</ul>'
});
