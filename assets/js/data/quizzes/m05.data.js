SD.defineQuiz('m05', {
  title: 'Quiz: bases de datos',
  pass: 0.7,
  questions: [
    {
      id: 'lsm', type: 'single',
      prompt: 'Un sistema de telemetría recibe 500 000 escrituras por segundo de métricas y casi nunca actualiza lo escrito. ¿Qué motor de almacenamiento encaja mejor?',
      options: ['B-tree', 'LSM-tree', 'Una tabla sin índices', 'Cualquiera: da igual'],
      answer: 1,
      explain: 'LSM convierte las escrituras en secuenciales (WAL + memtable) y agrupa el trabajo caro en compactaciones de fondo. Un B-tree haría escrituras aleatorias en páginas por cada inserción.'
    },
    {
      id: 'indice', type: 'single',
      prompt: 'Tienes el índice <code>(tenant_id, created_at)</code>. ¿Cuál de estas consultas NO puede usarlo de forma eficiente?',
      options: [
        '<code>WHERE tenant_id = 7</code>',
        '<code>WHERE tenant_id = 7 AND created_at &gt; now() - interval \'1 day\'</code>',
        '<code>WHERE created_at &gt; now() - interval \'1 day\'</code>',
        '<code>WHERE tenant_id = 7 ORDER BY created_at DESC LIMIT 20</code>'
      ],
      answer: 2,
      explain: 'Un índice compuesto se usa por su prefijo izquierdo. Sin condición sobre tenant_id, las fechas están repartidas dentro de cada tenant y la base tendría que recorrer todo el índice.'
    },
    {
      id: 'skew', type: 'single',
      prompt: 'Dos médicos de guardia se dan de baja a la vez; cada transacción verificó que había 2 de guardia. Quedaron 0. La base usa snapshot isolation. ¿Por qué no lo impidió?',
      options: [
        'Porque snapshot isolation no garantiza durabilidad.',
        'Porque es write skew: cada transacción escribió una fila distinta, así que no hubo conflicto de escritura que detectar. Hace falta serializable o bloquear las filas leídas.',
        'Porque faltaba un índice.',
        'Porque las transacciones no hicieron COMMIT.'
      ],
      answer: 1,
      explain: 'Snapshot isolation detecta dos escrituras sobre la misma fila, pero no una decisión basada en un conjunto leído. Serializable (SSI en PostgreSQL) o un SELECT … FOR UPDATE sobre las filas de guardia lo evitan.'
    },
    {
      id: 'lag', type: 'single',
      prompt: 'Un usuario edita su perfil, la app recarga la página y ve los datos viejos. Las lecturas van a réplicas asíncronas. ¿Qué garantía falta y cómo se da?',
      options: [
        'Durabilidad; con fsync.',
        'Read-your-writes; leyendo del líder durante unos segundos después de una escritura del usuario, o esperando a que la réplica alcance la posición del log de esa escritura.',
        'Atomicidad; con transacciones.',
        'Ninguna: es un bug del navegador.'
      ],
      answer: 1,
      explain: 'El retraso de replicación es normal. La solución es enrutar al líder las lecturas del propio usuario justo después de escribir, o recordar la posición del log (LSN) de su última escritura y leer de una réplica que ya la haya aplicado.'
    },
    {
      id: 'quorum', type: 'single',
      prompt: 'Con N = 3 réplicas, W = 1 y R = 1, ¿qué obtienes?',
      options: [
        'Consistencia fuerte.',
        'Máxima disponibilidad y mínima latencia, pero una lectura puede no ver la última escritura.',
        'Ninguna tolerancia a fallas.',
        'Lecturas imposibles si cae una réplica.'
      ],
      answer: 1,
      explain: 'W + R = 2, que no supera N = 3: los conjuntos de escritura y lectura pueden no solaparse. A cambio, cada operación espera una sola respuesta y tolera dos réplicas caídas.'
    },
    {
      id: 'modn', type: 'single',
      prompt: 'Repartes claves con <code>hash(clave) mod N</code> entre 4 nodos de caché y agregas un quinto. ¿Qué pasa?',
      options: [
        'Se mueve ~20 % de las claves.',
        'Se mueve la gran mayoría de las claves (~80 %), y la caché queda casi vacía de golpe.',
        'No se mueve ninguna.',
        'Se duplican todas las claves.'
      ],
      answer: 1,
      explain: 'Al cambiar N cambia el resultado del módulo para casi todas las claves: una estampida global. Con hashing consistente solo se mueve la parte que le toca al nodo nuevo (~1/5).'
    },
    {
      id: 'pk', type: 'single',
      prompt: 'Una tabla de eventos de IoT se particiona por <code>fecha</code>. ¿Qué problema aparece?',
      options: [
        'Ninguno: es la clave natural.',
        'Todas las escrituras de hoy caen en la misma partición (hot partition), mientras las demás están ociosas.',
        'No se pueden hacer consultas por rango.',
        'Se pierden datos.'
      ],
      answer: 1,
      explain: 'Las claves monótonas concentran las escrituras. Se combina: partición por <code>(device_id, día)</code> o por hash del dispositivo, y orden por tiempo dentro de la partición.'
    },
    {
      id: 'split', type: 'single',
      prompt: 'Tras una partición de red, el líder viejo cree que sigue siéndolo y escribe, mientras ya hay un líder nuevo. ¿Qué mecanismo evita que corrompa datos?',
      options: [
        'Un TTL más largo.',
        'Fencing tokens: cada líder tiene un número de época creciente y el almacenamiento rechaza escrituras con una época menor.',
        'Réplicas asíncronas.',
        'Aumentar el timeout.'
      ],
      answer: 1,
      explain: 'El líder viejo no puede saber que ya no lo es. Por eso la protección tiene que estar en el recurso compartido: rechazar escrituras de épocas anteriores (M06).'
    },
    {
      id: 'elegir', type: 'multi',
      prompt: 'Una tienda online necesita: pedidos con pagos (transaccional), búsqueda de productos por texto con filtros, y carritos que se leen y escriben muchísimo y pueden vencer. ¿Qué combinación es razonable?',
      options: [
        'Pedidos y pagos en una base relacional (PostgreSQL).',
        'Búsqueda en un motor de búsqueda (Elasticsearch u OpenSearch) alimentado por CDC.',
        'Carritos en un almacén clave-valor (Redis o DynamoDB) con TTL.',
        'Todo en Elasticsearch, incluidos los pagos.',
        'Todo en Redis sin persistencia.'
      ],
      answer: [0, 1, 2],
      explain: 'Cada patrón de acceso tiene su herramienta. Lo que no se negocia es que el dinero viva en un almacén transaccional y durable; la búsqueda es una vista derivada que se puede reconstruir.'
    }
  ]
});
