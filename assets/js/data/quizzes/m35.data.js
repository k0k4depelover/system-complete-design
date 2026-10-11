SD.defineQuiz('m35', {
  title: 'Quiz: seguridad en bases de datos', pass: 0.7,
  questions: [
    {
      id: 'minpriv', type: 'single',
      prompt: '¿Por qué la aplicación no debe conectarse a la base como dueño de las tablas o como superusuario?',
      options: [
        'Porque conectarse como superusuario consume más memoria en el servidor y obliga a PostgreSQL a mantener abiertas más conexiones simultáneas de las que la aplicación realmente necesita',
        'Porque si esa credencial se filtra, el atacante hereda todo lo que el rol podía hacer, y el dueño o el superusuario pueden hacerlo todo',
        'Porque el dueño de la tabla no puede ejecutar sentencias SELECT sobre sus propias filas',
        'Porque PostgreSQL prohíbe que un superusuario abra más de una conexión a la vez'
      ],
      answer: 1,
      explain: 'Mínimo privilegio: el rol de la app lee y escribe sus filas y nada más. Si lo roban, el daño queda acotado. Un rol dueño o superusuario convierte una fuga en acceso total. Ver 35.1.'
    },
    {
      id: 'rbac-abac', type: 'single',
      prompt: 'Las reglas de acceso dependen de la región del usuario, de a qué tenant es la fila y de la hora. ¿Qué modelo encaja mejor y por qué?',
      options: [
        'RBAC, creando y manteniendo a mano un rol distinto para cada combinación posible de región, tenant y franja horaria, y reasignándolos cada vez que algo cambia',
        'ACL, guardando en cada fila la lista completa de usuarios que pueden verla',
        'ABAC, porque una política evalúa atributos del sujeto, el recurso y el entorno sin multiplicar los roles',
        'Ninguno: esas reglas solo se pueden aplicar filtrando en el código de la aplicación'
      ],
      answer: 2,
      explain: 'Cuando la decisión depende de datos (región, propiedad, hora) y no solo de la función, RBAC explota en roles. ABAC lo expresa en una política. Ver 35.3.'
    },
    {
      id: 'rls-abac', type: 'single',
      prompt: 'Una política RLS compara el <code>tenant_id</code> de la fila con el tenant fijado en la sesión. ¿Por qué se dice que es "ABAC dentro de la base"?',
      options: [
        'Porque evalúa un atributo del recurso contra un atributo del entorno, que es justo lo que hace ABAC',
        'Porque RLS asigna un rol nuevo a cada fila de la tabla antes de devolverla',
        'Porque las políticas RLS solo funcionan si antes defines una ACL por cada fila',
        'Porque la base cifra el campo tenant_id con una clave por sesión y lo descifra solamente para el rol concreto que consulta la fila correspondiente'
      ],
      answer: 0,
      explain: 'La política mira el tenant de la fila (atributo del recurso) y el de la sesión (atributo del entorno): una regla ABAC que la base evalúa fila por fila. Ver 35.3.'
    },
    {
      id: 'bypass', type: 'single',
      prompt: '¿Quién puede ver filas que una política RLS normalmente ocultaría?',
      options: [
        'Cualquier rol que tenga el privilegio SELECT sobre la tabla, sin excepción alguna, porque la RLS solo limita las escrituras y nunca las consultas de lectura',
        'Solo el rol que creó la política con CREATE POLICY',
        'El dueño de la tabla (salvo que se use FORCE ROW LEVEL SECURITY) y los roles con BYPASSRLS',
        'Nadie: una vez activada, la RLS se aplica por igual a todas las conexiones'
      ],
      answer: 2,
      explain: 'El dueño se salta la RLS salvo con FORCE, y BYPASSRLS la ignora siempre. El backup los necesita; la app de producción, nunca. Ver 35.2 y M05.'
    },
    {
      id: 'pgaudit', type: 'multi',
      prompt: 'Comparado con un trigger de auditoría de fila, ¿qué cosas aporta pgAudit? (marca todas)',
      options: [
        'Puede registrar sentencias SELECT sobre tablas sensibles, que un trigger de fila no ve',
        'Registra a nivel de sentencia, no solo el cambio de cada fila',
        'Elimina por completo el costo de escribir la bitácora en cada operación',
        'Garantiza que la tabla de bitácora sea append-only sin necesidad de REVOKE'
      ],
      answer: [0, 1],
      explain: 'pgAudit anota sentencias (incluidos SELECT) en el log del servidor, cosa que un trigger AFTER no capta. No es gratis (genera volumen de log) ni gestiona el append-only de otra tabla. Ver 35.5.'
    },
    {
      id: 'appendonly', type: 'single',
      prompt: '¿Para qué sirve <code>REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC</code> en la tabla de bitácora?',
      options: [
        'Para que la tabla ocupe menos espacio en disco al no permitir borrados',
        'Para acelerar los INSERT, ya que la base no tiene que mantener índices de actualización',
        'Para cifrar automáticamente cada fila que se inserta en la bitácora',
        'Para que sea append-only: nadie pueda reescribir ni borrar la historia ya registrada'
      ],
      answer: 3,
      explain: 'Una bitácora que se puede editar no sirve como prueba. Quitando UPDATE y DELETE, solo se puede añadir. Ver 35.5.'
    },
    {
      id: 'colenc', type: 'single',
      prompt: 'Ciframos la columna del email con pgcrypto. ¿De quién NO protege ese cifrado?',
      options: [
        'De un analista que corre consultas SELECT sobre la tabla de clientes sin tener configurada en su sesión la clave de descifrado',
        'De la propia aplicación, que tiene la clave porque necesita leer el email en claro',
        'De alguien que se lleva un dump de la base sin la clave',
        'De quien lee los archivos de datos directamente del disco'
      ],
      answer: 1,
      explain: 'El cifrado de columna protege de quien lee la tabla sin la clave, pero la app tiene la clave: para ella es transparente. Cifrar no sustituye acotar el rol. Ver 35.6.'
    },
    {
      id: 'tde', type: 'single',
      prompt: '¿Contra qué amenaza protege el cifrado en reposo (TDE) de una base?',
      options: [
        'Contra una inyección SQL que lee filas de otro tenant a través de la aplicación',
        'Contra un analista autorizado que consulta columnas sensibles con su rol',
        'Contra un disco o un backup robado, pero no contra una sesión autorizada en la base en marcha',
        'Contra cualquier forma de acceso: con TDE activado, ni siquiera el superusuario de la base ve los datos en claro mientras el motor está en marcha'
      ],
      answer: 2,
      explain: 'TDE cifra los archivos en disco. Protege el medio robado; con la base montada, toda conexión autorizada ve el claro porque el motor descifra al leer. Ver 35.6.'
    },
    {
      id: 'rotacion', type: 'single',
      prompt: '¿Cómo se rota la contraseña del rol de la app sin cortar el servicio?',
      options: [
        'Se cambia la contraseña directamente en la base y se reinicia el servidor entero para forzar que todas las conexiones abiertas del pool tomen la credencial nueva de inmediato',
        'Se mantienen dos credenciales válidas a la vez: la app toma la nueva y recién entonces se revoca la vieja',
        'Se deja la misma contraseña para siempre, ya que rotarla siempre provoca downtime',
        'Se guarda la nueva contraseña en el código y se despliega una versión nueva de la app'
      ],
      answer: 1,
      explain: 'Cambiar y reiniciar tira el pool de conexiones. Con dos credenciales válidas a la vez, la app migra a la nueva y después se revoca la vieja, sin corte. Ver 35.7.'
    }
  ]
});
