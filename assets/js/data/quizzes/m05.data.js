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
    },
    {
      id: 'clustered', type: 'single',
      prompt: 'En InnoDB, la tabla <code>usuarios</code> tiene PK <code>id</code> y un índice secundario en <code>email</code>. ¿Qué pasa al buscar <code>WHERE email = $1</code> y pedir todas las columnas?',
      options: [
        'Se baja por el índice de email, que da la PK, y después se baja por el árbol de la PK, cuyas hojas tienen la fila completa.',
        'El índice de email guarda la fila completa, así que basta un árbol.',
        'El índice de email guarda un puntero físico (página, posición) a un heap.',
        'Se lee la tabla entera porque la fila no está en ningún índice.'
      ],
      answer: 0,
      explain: 'En InnoDB la tabla es el índice clusterizado de la PK: las filas viven en sus hojas. Un índice secundario guarda la PK, no un puntero físico, así que la búsqueda recorre dos árboles. El puntero físico (ctid) es de PostgreSQL. Repasa 5.3, "Clusterizado o no".'
    },
    {
      id: 'sarg', type: 'single',
      prompt: 'Hay un índice B-tree en <code>created_at</code>. ¿Cuál de estas condiciones puede usarlo para traer los pedidos del 4 de octubre?',
      options: [
        '<code>WHERE date(created_at) = \'2026-10-04\'</code>',
        '<code>WHERE created_at &gt;= \'2026-10-04\' AND created_at &lt; \'2026-10-05\'</code>',
        '<code>WHERE to_char(created_at, \'YYYY-MM-DD\') = \'2026-10-04\'</code>',
        '<code>WHERE extract(day FROM created_at) = 4</code>'
      ],
      answer: 1,
      explain: 'Solo el rango compara la columna tal cual: es sargable y lee un tramo contiguo del índice. Las otras envuelven la columna en una función y el índice, ordenado por la columna, no sirve. Repasa 5.3, "Escribir consultas que usen el índice".'
    },
    {
      id: 'joinorden', type: 'single',
      prompt: 'Pedidos de hoy (100 000 de 50 millones) de clientes de Uruguay (10 000 de 1 millón). ¿Qué índice habilita el plan que hace menos búsquedas con nested loop?',
      options: [
        '<code>pedidos (created_at)</code>, para empezar por los pedidos de hoy.',
        '<code>pedidos (cliente_id, created_at)</code>, para empezar por los 10 000 clientes y buscar los pedidos de hoy de cada uno.',
        '<code>clientes (nombre)</code>.',
        'Ninguno: basta con escribir <code>clientes</code> primero en el <code>FROM</code>.'
      ],
      answer: 1,
      explain: 'Empezar por el filtro más selectivo (10 000 clientes) y buscar con un índice compuesto en la tabla de adentro da 10 000 búsquedas, contra 100 000 empezando por los pedidos. El orden escrito en un INNER JOIN no decide: el planner reordena. Repasa 5.4, "El orden de las tablas en un join".'
    },
    {
      id: 'normal', type: 'multi',
      prompt: 'Una tabla guarda en cada fila el pedido, el nombre, el email y la ciudad del cliente. ¿Qué problemas tiene?',
      options: [
        'Cambiar el email de un cliente obliga a cambiar todas sus filas.',
        'No se puede registrar un cliente que todavía no compró.',
        'Borrar el único pedido de un cliente borra al cliente.',
        'Las lecturas de un pedido son más lentas que en el modelo normalizado.'
      ],
      answer: [0, 1, 2],
      explain: 'Son las anomalías de actualización, inserción y borrado que la normalización elimina. Leer un pedido es justamente lo que esa tabla hace barato: por eso se desnormaliza a propósito para leer, derivando la copia de una fuente normalizada. Repasa 5.5.'
    },
    {
      id: 'txestados', type: 'order',
      prompt: 'Ordena los estados por los que pasa una transacción que termina bien.',
      items: ['Activa', 'Parcialmente confirmada', 'Confirmada'],
      explain: 'Activa mientras ejecuta sentencias; parcialmente confirmada cuando terminó la última pero sus cambios siguen en memoria; confirmada cuando el registro de commit llega al disco. Si algo falla antes, pasa a fallida y después a abortada. Repasa 5.6, "El ciclo de vida de una transacción".'
    },
    {
      id: 'mvccq', type: 'single',
      prompt: 'Con MVCC en repeatable read de PostgreSQL, T1 lee el saldo (100). T2 lo cambia a 50 y confirma. T1 vuelve a leer el saldo. ¿Qué ve?',
      options: ['50', '100', 'Un error 40001', 'Espera a que T2 termine'],
      answer: 1,
      explain: 'Con snapshot isolation, T1 lee siempre del snapshot tomado al empezar: ve la versión cuyo xmin estaba confirmado entonces, 100. Fallaría con 40001 solo si T1 intentara escribir esa fila. Repasa 5.6, "Cómo se aíslan".'
    },
    {
      id: 'pool', type: 'single',
      prompt: 'Una API hace 2 000 transacciones por segundo y cada una retiene la conexión 5 ms. ¿Cuántas conexiones están ocupadas en promedio?',
      options: ['4', '10', '100', '2 000'],
      fixed: true,
      answer: 1,
      explain: 'Ley de Little: 2 000 × 0.005 = 10. Un pool de 15 a 20 alcanza. Si el pool se agota, casi siempre es porque cada transacción retiene la conexión más tiempo (por ejemplo, esperando una llamada HTTP), no porque falten conexiones. Repasa 5.7, "Pools de conexiones".'
    },
    {
      id: 'vista', type: 'single',
      prompt: '¿Qué diferencia hay entre una vista y una vista materializada en PostgreSQL?',
      options: [
        'La vista guarda una consulta y la ejecuta en cada lectura; la materializada guarda el resultado y lo recalcula con REFRESH.',
        'Las dos guardan el resultado; la materializada además tiene índices.',
        'La vista es más rápida de leer porque está en memoria.',
        'La materializada siempre está al día porque se actualiza con cada escritura.'
      ],
      answer: 0,
      explain: 'Una vista no acelera nada: es una consulta con nombre. La materializada se lee rápido y admite índices, pero muestra los datos del último REFRESH; con CONCURRENTLY necesita un índice único. Repasa 5.8.'
    },
    {
      id: 'synccommit', type: 'single',
      prompt: 'Con replicación asíncrona, el líder confirma un pago y se cae antes de enviar el WAL. Se promueve la réplica. ¿Qué pasa con el pago?',
      options: [
        'Se pierde: la réplica promovida no lo tiene, aunque el cliente recibió OK.',
        'La réplica lo pide al líder cuando vuelve.',
        'No pasa nada: el WAL se envía antes de responder.',
        'El cliente recibe un error, así que no hay inconsistencia.'
      ],
      answer: 0,
      explain: 'En la asíncrona el OK sale cuando el WAL está en el disco del líder, antes de viajar. Con una réplica síncrona (synchronous_commit = on) el commit espera su fsync y el failover no pierde nada. Repasa 5.9.'
    },
    {
      id: 'saga', type: 'single',
      prompt: 'Una saga reserva stock, cobra y despacha. El cobro falla. ¿Qué debe pasar?',
      options: [
        'Ejecutar la compensación de la reserva: liberar el stock.',
        'Hacer rollback de las dos transacciones locales.',
        'Esperar a que el coordinador vuelva, con los locks tomados.',
        'Despachar igual y cobrar después.'
      ],
      answer: 0,
      explain: 'Cada paso de una saga es una transacción local ya confirmada: no hay rollback común. Se deshace con su compensación, en orden inverso. Esperar con locks es el problema de 2PC. Repasa 5.12.'
    },
    {
      id: 'instagram', type: 'single',
      prompt: 'Instagram hace sharding con <code>user_id mod 2000</code> hacia shards lógicos (esquemas) y un mapa de shards lógicos a servidores. ¿Qué pasa al agregar un servidor?',
      options: [
        'Se mueven esquemas enteros de un servidor lleno al nuevo y se actualiza el mapa; ninguna fila cambia de shard lógico.',
        'Se pasa a <code>user_id mod 2001</code> y se redistribuyen casi todas las filas.',
        'Los usuarios nuevos van al servidor nuevo y los viejos se quedan.',
        'Hay que cambiar el id de cada foto, porque lleva el servidor adentro.'
      ],
      answer: 0,
      explain: 'Hay dos niveles: la clave al shard lógico nunca cambia, y el shard lógico al servidor es un mapa chico que sí cambia. El id lleva el shard lógico, no el servidor, así que sigue siendo válido. Repasa 5.14, "El esquema de Instagram".'
    }
  ]
});
