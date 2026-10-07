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
        'Porque snapshot isolation no garantiza durabilidad, y uno de los commits se perdió.',
        'Porque es write skew: cada una escribió una fila distinta y no hubo conflicto que detectar.',
        'Porque las dos leyeron el mismo snapshot y la segunda pisó la escritura de la primera.',
        'Porque faltaba un índice en la tabla de guardias y la verificación leyó filas viejas.'
      ],
      answer: 1,
      explain: 'Snapshot isolation detecta dos escrituras sobre la misma fila, pero no una decisión basada en un conjunto leído. Serializable (SSI en PostgreSQL) o un SELECT … FOR UPDATE sobre las filas de guardia lo evitan.'
    },
    {
      id: 'lag', type: 'single',
      prompt: 'Un usuario edita su perfil, la app recarga la página y ve los datos viejos. Las lecturas van a réplicas asíncronas. ¿Qué garantía falta y cómo se da?',
      options: [
        'Durabilidad; se da con fsync en cada réplica antes de confirmar.',
        'Read-your-writes; se da leyendo del líder justo después de que el usuario escribe.',
        'Atomicidad; se da envolviendo la edición y la recarga en una sola transacción.',
        'Aislamiento serializable; se da subiendo el nivel de aislamiento de la sesión.'
      ],
      answer: 1,
      explain: 'El retraso de replicación es normal. La solución es enrutar al líder las lecturas del propio usuario justo después de escribir, o recordar la posición del log (LSN) de su última escritura y leer de una réplica que ya la haya aplicado.'
    },
    {
      id: 'quorum', type: 'single',
      prompt: 'Con N = 3 réplicas, W = 1 y R = 1, ¿qué obtienes?',
      options: [
        'Consistencia fuerte, porque cada escritura termina llegando a las tres réplicas y toda lectura la encuentra.',
        'Baja latencia y alta disponibilidad, pero una lectura puede no ver la última escritura.',
        'Ninguna tolerancia a fallas: si cae una réplica, se rechazan las escrituras.',
        'Lecturas siempre al día, porque R + W supera la mitad de N.'
      ],
      answer: 1,
      explain: 'W + R = 2, que no supera N = 3: los conjuntos de escritura y lectura pueden no solaparse. A cambio, cada operación espera una sola respuesta y tolera dos réplicas caídas.'
    },
    {
      id: 'modn', type: 'single',
      prompt: 'Repartes claves con <code>hash(clave) mod N</code> entre 4 nodos de caché y agregas un quinto. ¿Qué pasa?',
      options: [
        'Se mueve ~20 % de las claves, la parte que le corresponde al nodo nuevo.',
        'Se mueve ~80 % de las claves y la caché queda casi vacía de golpe.',
        'No se mueve ninguna: las claves viejas siguen en su nodo y solo las nuevas usan el quinto.',
        'Se duplican todas las claves mientras se copian del nodo viejo al nuevo.'
      ],
      answer: 1,
      explain: 'Al cambiar N cambia el resultado del módulo para casi todas las claves: una estampida global. Con hashing consistente solo se mueve la parte que le toca al nodo nuevo (~1/5).'
    },
    {
      id: 'pk', type: 'single',
      prompt: 'Una tabla de eventos de IoT se particiona por <code>fecha</code>. ¿Qué problema aparece?',
      options: [
        'Ninguno: la fecha es la clave natural y reparte los eventos de forma pareja entre días.',
        'Todas las escrituras de hoy caen en la misma partición, y las demás quedan ociosas.',
        'No se pueden hacer consultas por rango de fechas, porque cada día queda en un nodo distinto.',
        'Se pierden datos cuando la partición del día se llena.'
      ],
      answer: 1,
      explain: 'Las claves monótonas concentran las escrituras. Se combina: partición por <code>(device_id, día)</code> o por hash del dispositivo, y orden por tiempo dentro de la partición.'
    },
    {
      id: 'split', type: 'single',
      prompt: 'Tras una partición de red, el líder viejo cree que sigue siéndolo y escribe, mientras ya hay un líder nuevo. ¿Qué mecanismo evita que corrompa datos?',
      options: [
        'Un TTL más largo en el lease del líder, para que el viejo no lo pierda durante la partición.',
        'Fencing tokens: el almacenamiento rechaza escrituras con una época menor.',
        'Réplicas asíncronas, que descartan las escrituras del viejo al recibir las del nuevo.',
        'Aumentar el timeout de detección, para que nunca se elija un líder nuevo por error.'
      ],
      answer: 1,
      explain: 'El líder viejo no puede saber que ya no lo es. Por eso la protección tiene que estar en el recurso compartido: rechazar escrituras de épocas anteriores (M06).'
    },
    {
      id: 'elegir', type: 'multi',
      prompt: 'Una tienda online necesita: pedidos con pagos (transaccional), búsqueda de productos por texto con filtros, y carritos que se leen y escriben muchísimo y pueden vencer. ¿Qué combinación es razonable?',
      options: [
        'Pedidos y pagos en PostgreSQL.',
        'Búsqueda en OpenSearch, alimentado por CDC.',
        'Carritos en Redis o DynamoDB con TTL.',
        'Todo en Elasticsearch, incluidos los pagos, para tener una sola fuente que también sirva la búsqueda.',
        'Todo en Redis sin persistencia, porque carritos y búsqueda necesitan latencia de memoria.'
      ],
      answer: [0, 1, 2],
      explain: 'Cada patrón de acceso tiene su herramienta. Lo que no se negocia es que el dinero viva en un almacén transaccional y durable; la búsqueda es una vista derivada que se puede reconstruir.'
    },
    {
      id: 'clustered', type: 'single',
      prompt: 'En InnoDB, la tabla <code>usuarios</code> tiene PK <code>id</code> y un índice secundario en <code>email</code>. ¿Qué pasa al buscar <code>WHERE email = $1</code> y pedir todas las columnas?',
      options: [
        'Se baja por el índice de email, que da la PK, y después por el árbol de la PK, que tiene la fila.',
        'El índice de email guarda una copia de la fila completa en sus hojas, así que basta con un árbol.',
        'El índice de email guarda un puntero físico (página, posición) a la fila en un heap aparte.',
        'Se lee la tabla entera, porque un índice secundario solo sirve para filtrar y no devuelve filas.'
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
        '<code>WHERE extract(day FROM created_at) = 4 AND extract(month FROM created_at) = 10</code>'
      ],
      answer: 1,
      explain: 'Solo el rango compara la columna tal cual: es sargable y lee un tramo contiguo del índice. Las otras envuelven la columna en una función y el índice, ordenado por la columna, no sirve. Repasa 5.3, "Escribir consultas que usen el índice".'
    },
    {
      id: 'joinorden', type: 'single',
      prompt: 'Pedidos de hoy (100 000 de 50 millones) de clientes de Uruguay (10 000 de 1 millón). ¿Qué índice habilita el plan que hace menos búsquedas con nested loop?',
      options: [
        '<code>pedidos (created_at)</code>, para empezar por los 100 000 pedidos de hoy y buscar su cliente.',
        '<code>pedidos (cliente_id, created_at)</code>, para empezar por los 10 000 clientes.',
        '<code>clientes (pais)</code> solo, porque el filtro de Uruguay es el más selectivo de los dos.',
        'Ninguno: basta con escribir <code>clientes</code> primero en el <code>FROM</code> para fijar el orden.'
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
        'La vista corre su consulta en cada lectura; la materializada guarda el resultado hasta un REFRESH.',
        'Las dos guardan el resultado en disco; la materializada además admite índices sobre él.',
        'La vista se lee más rápido porque PostgreSQL mantiene su resultado en memoria compartida entre sesiones.',
        'La materializada siempre está al día, porque un trigger la actualiza con cada escritura.'
      ],
      answer: 0,
      explain: 'Una vista no acelera nada: es una consulta con nombre. La materializada se lee rápido y admite índices, pero muestra los datos del último REFRESH; con CONCURRENTLY necesita un índice único. Repasa 5.8.'
    },
    {
      id: 'synccommit', type: 'single',
      prompt: 'Con replicación asíncrona, el líder confirma un pago y se cae antes de enviar el WAL. Se promueve la réplica. ¿Qué pasa con el pago?',
      options: [
        'Se pierde: la réplica promovida no lo tiene, aunque el cliente recibió OK.',
        'La réplica promovida se lo pide al líder viejo cuando vuelve, y el pago aparece minutos después.',
        'No pasa nada: en PostgreSQL el WAL siempre llega a la réplica antes de responder.',
        'El cliente recibe un error, porque el commit no se completó en la réplica.'
      ],
      answer: 0,
      explain: 'En la asíncrona el OK sale cuando el WAL está en el disco del líder, antes de viajar. Con una réplica síncrona (synchronous_commit = on) el commit espera su fsync y el failover no pierde nada. Repasa 5.10.'
    },
    {
      id: 'saga', type: 'single',
      prompt: 'Una saga reserva stock, cobra y despacha. El cobro falla. ¿Qué debe pasar?',
      options: [
        'Ejecutar la compensación de la reserva: liberar el stock.',
        'Hacer rollback de la reserva y del cobro, como en una transacción distribuida.',
        'Esperar a que el coordinador vuelva, manteniendo tomados los locks del stock.',
        'Despachar igual y reintentar el cobro después.'
      ],
      answer: 0,
      explain: 'Cada paso de una saga es una transacción local ya confirmada: no hay rollback común. Se deshace con su compensación, en orden inverso. Esperar con locks es el problema de 2PC. Repasa 5.13.'
    },
    {
      id: 'instagram', type: 'single',
      prompt: 'Instagram hace sharding con <code>user_id mod 2000</code> hacia shards lógicos (esquemas) y un mapa de shards lógicos a servidores. ¿Qué pasa al agregar un servidor?',
      options: [
        'Se mueven esquemas enteros al servidor nuevo y cambia solo el mapa; ninguna fila cambia de shard.',
        'Se pasa a <code>user_id mod 2001</code> y se redistribuyen casi todas las filas entre los servidores.',
        'Los usuarios nuevos van al servidor nuevo y los existentes se quedan donde estaban para siempre.',
        'Hay que reescribir el id de cada foto, porque lleva adentro el número del servidor físico.'
      ],
      answer: 0,
      explain: 'Hay dos niveles: la clave al shard lógico nunca cambia, y el shard lógico al servidor es un mapa chico que sí cambia. El id lleva el shard lógico, no el servidor, así que sigue siendo válido. Repasa 5.15, "El esquema de Instagram".'
    },
    {
      id: 'rls-owner', type: 'single',
      prompt: 'Activas row-level security en <code>facturas</code>, pruebas desde la consola como superusuario y ves solo tus filas. En producción, con el rol que creó la tabla, se filtran datos de otros tenants. ¿Por qué?',
      options: [
        'El superusuario y el dueño de la tabla se saltan las políticas salvo que se use FORCE ROW LEVEL SECURITY.',
        'La política se escribió con USING en lugar de WITH CHECK, que es la que filtra los SELECT.',
        'RLS solo filtra INSERT y UPDATE; para el SELECT hace falta una vista aparte.',
        'Faltó un índice en tenant_id y sin él PostgreSQL desactiva la política por rendimiento.'
      ],
      answer: 0,
      explain: 'El dueño de la tabla ignora sus propias políticas por defecto, y el superusuario siempre. La app debe conectarse con un rol que no sea dueño (app_rw); si no, hace falta FORCE. Repasa 5.9, "La trampa: el dueño se salta RLS".'
    },
    {
      id: 'rls-setlocal', type: 'single',
      prompt: 'Fijas el tenant con <code>SET app.tenant_id = …</code> (sin LOCAL) y usas un pool en modo transacción (PgBouncer). ¿Qué puede pasar?',
      options: [
        'Nada: la variable se limpia sola al terminar cada consulta.',
        'La base rechaza el SET porque fuera de una transacción no se permite.',
        'El valor queda pegado a la conexión y lo hereda el siguiente usuario que la reutilice.',
        'El pool abre una conexión nueva por cada SET, agotando el límite de la base.'
      ],
      answer: 2,
      explain: 'Sin LOCAL, la variable dura toda la sesión de la conexión, y el pool reparte esa conexión entre clientes distintos. SET LOCAL la limita a la transacción y se limpia al COMMIT. Repasa 5.9, "Fijar el tenant", y 5.7 sobre pools.'
    }
  ]
});
