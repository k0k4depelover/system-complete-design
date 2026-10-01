/* Ejercicios guiados del M06 (teoría distribuida). Formato en core/exercise.js. */

SD.defineExercise('m06-detector', {
  title: 'un detector de fallas que no dispare en falso',
  scenario: '<p>Un clúster de 40 nodos elige un líder y reparte trabajo. Cada nodo manda un heartbeat por segundo. Varias veces por día, algún nodo sufre una pausa de GC de hasta 3 segundos. Declarar muerto a un nodo vivo cuesta caro: dispara una elección y unos 20 segundos de trabajo redistribuido. Un nodo muerto de verdad tiene que detectarse en menos de 10 segundos.</p>',
  steps: [
    {
      id: 'corto', type: 'single',
      prompt: 'Primera idea: declarar muerto a un nodo después de 2 segundos sin heartbeats. ¿Qué pasa?',
      options: [
        'Funciona: 2 segundos es mucho para una red de datacenter.',
        'Cada pausa de GC de 3 segundos se convierte en una falsa alarma, con su elección y sus 20 segundos de trabajo redistribuido.',
        'Detecta los nodos muertos demasiado tarde.',
        'El detector no puede equivocarse, porque un nodo sin heartbeats está muerto.'
      ],
      answer: 1,
      explain: 'En un sistema asíncrono no se puede distinguir un nodo muerto de uno lento: el timeout es una apuesta. Si es más corto que las pausas normales del sistema, pierde la apuesta varias veces por día.'
    },
    {
      id: 'largo', type: 'single',
      prompt: 'Segunda idea: subir el timeout a 30 segundos. ¿Qué problema tiene?',
      options: [
        'Ninguno: nunca va a haber falsas alarmas.',
        'Un nodo muerto de verdad tarda 30 segundos en detectarse, el triple de lo permitido. El timeout cambia falsas alarmas por lentitud.',
        'Aumenta el tráfico de heartbeats.',
        'Rompe el consenso.'
      ],
      answer: 1,
      explain: 'Todo detector basado en timeouts tiene esta perilla: más corto detecta rápido y se equivoca más; más largo se equivoca menos y detecta tarde. La mejora no está en el número sino en usar más información.'
    },
    {
      id: 'mejor', type: 'multi',
      prompt: '¿Qué técnicas mejoran el compromiso entre detectar rápido y no equivocarse?',
      options: [
        'Un detector phi accrual: en lugar de un sí o no, calcula qué tan improbable es el silencio actual según la historia de llegadas de ese nodo, y el umbral se fija sobre esa probabilidad.',
        'Pruebas indirectas, como en SWIM: antes de sospechar, pedirle a otros nodos que prueben al silencioso, para no confundir un enlace malo con un nodo caído.',
        'Mandar heartbeats cada 10 ms en lugar de cada segundo.',
        'Confirmar la sospecha con varios nodos antes de actuar sobre ella.'
      ],
      answer: [0, 1, 3],
      explain: 'Heartbeats más frecuentes no acortan una pausa de GC: solo agregan carga. Lo que ayuda es adaptar el umbral a la variabilidad real (phi accrual, que usan Cassandra y Akka) y no depender de un solo observador (SWIM, que usan Consul y Serf). Repasa 6.2.'
    },
    {
      id: 'zombi', type: 'single',
      prompt: 'Aun así, un día un nodo que era líder queda pausado 25 segundos, lo declaran muerto y eligen otro. Al despertar, el viejo sigue creyéndose líder y manda órdenes. ¿Qué evita el daño?',
      options: [
        'Nada: hay que evitar las pausas.',
        'Que cada orden lleve el número de término o época del líder, y que los receptores rechacen las de un término menor al último que vieron: un fencing token.',
        'Que el viejo líder consulte su reloj antes de actuar.',
        'Que los demás nodos lo bloqueen en el firewall.'
      ],
      answer: 1,
      explain: 'Un detector de fallas nunca va a ser perfecto, así que la corrección no puede depender de él. Raft y los fencing tokens aseguran que un líder viejo no pueda hacer daño aunque se crea vivo. El detector decide cuándo elegir; los términos garantizan que no importa si se equivocó.'
    }
  ],
  solution: '<ul><li><b>El timeout es una apuesta:</b> con pausas de 3 s, cualquier timeout menor dispara falsas alarmas; uno de 30 s incumple los 10 s pedidos.</li><li><b>Detector adaptativo:</b> phi accrual sobre los tiempos entre heartbeats, con un umbral que en la práctica declara la sospecha a los 5 a 8 segundos de silencio anómalo, y no a los 2 fijos.</li><li><b>Más de un observador:</b> antes de declarar muerto a un nodo, otros nodos lo prueban (ping-req de SWIM). Un enlace malo entre dos nodos no tumba a ninguno.</li><li><b>Seguridad aparte de la detección:</b> términos o épocas en cada orden del líder, y fencing en los recursos. El detector afecta cuán rápido se recupera el sistema, nunca si hace algo incorrecto.</li><li><b>Medir:</b> falsas sospechas por día, tiempo de detección de las caídas reales y duración de las pausas de GC, para ajustar el umbral con datos.</li></ul>'
});

SD.defineExercise('m06-contador', {
  title: 'un contador de "me gusta" en tres regiones',
  scenario: '<p>Una red social guarda el contador de "me gusta" de cada publicación en tres regiones (América, Europa y Asia), con réplicas que se sincronizan de forma asíncrona. Una publicación viral recibe miles de "me gusta" por segundo desde las tres. Los usuarios tienen que ver subir el número, y ver su propio "me gusta" apenas lo dan.</p>',
  steps: [
    {
      id: 'garantia', type: 'single',
      prompt: '¿Qué garantía de consistencia necesita el número que se muestra?',
      options: [
        'Linealizable: todos tienen que ver el mismo número exacto en el mismo instante.',
        'Eventual: puede atrasarse unos segundos, siempre que no pierda "me gusta" y termine convergiendo.',
        'Serializable, porque es una transacción.',
        'Ninguna: puede mostrar cualquier número.'
      ],
      answer: 1,
      explain: 'Nadie toma decisiones con el número exacto de "me gusta" en un instante. Pedir linealizabilidad entre continentes costaría una ida y vuelta intercontinental por cada "me gusta" (PACELC). Lo que no se puede aceptar es perder incrementos.'
    },
    {
      id: 'lww', type: 'single',
      prompt: 'La primera versión guarda el contador como un número: cada región lee el valor, le suma 1 y escribe el resultado, y entre regiones gana la escritura con el timestamp más alto (last-write-wins). ¿Qué pasa?',
      options: [
        'Funciona, porque los timestamps ordenan las escrituras.',
        'Se pierden incrementos: si América y Europa leen 100 a la vez y escriben 101, last-write-wins descarta una de las dos y el contador sube 1 en lugar de 2.',
        'El contador puede bajar a cero.',
        'Las regiones dejan de responder.'
      ],
      answer: 1,
      explain: 'Last-write-wins resuelve conflictos descartando escrituras concurrentes. Para un contador, cada escritura descartada es un "me gusta" perdido, y con miles por segundo se pierden muchos. Además, depende de relojes que pueden estar desfasados.'
    },
    {
      id: 'crdt', type: 'single',
      prompt: '¿Qué estructura converge sin perder incrementos y sin coordinar entre regiones?',
      options: [
        'Un lock global por publicación.',
        'Un contador CRDT: cada región incrementa solo su propio casillero, al combinar se toma el máximo de cada casillero y el valor es la suma.',
        'Last-write-wins con relojes atómicos.',
        'Un contador en una sola región, con 150 ms extra para las demás.'
      ],
      answer: 1,
      explain: 'Como cada región solo toca su casillero, no hay escrituras en conflicto. El máximo es conmutativo, asociativo e idempotente: las réplicas convergen aunque los estados lleguen desordenados o repetidos. La opción de una sola región también funciona, pero coordina y paga latencia. Repasa 6.12.'
    },
    {
      id: 'propio', type: 'single',
      prompt: 'Un usuario da "me gusta", recarga la página y no lo ve: la recarga leyó una réplica que todavía no tenía su incremento. ¿Qué garantía falta y cómo se da sin coordinar entre regiones?',
      options: [
        'Linealizabilidad global: todas las lecturas deben ir a un líder único.',
        'Read-your-writes: el usuario lee de la región donde escribió durante unos segundos, o su cliente guarda la versión que escribió y la lectura espera a una réplica que ya la tenga.',
        'Serializabilidad.',
        'Ninguna: es un bug de la caché del navegador.'
      ],
      answer: 1,
      explain: 'Es una garantía de sesión: solo le importa a ese usuario sobre sus propias escrituras, y se consigue con enrutamiento o con versiones, sin coordinación global. Resuelve la queja más visible con un costo mínimo. Repasa 6.5.'
    },
    {
      id: 'unico', type: 'single',
      prompt: 'El producto agrega una regla: cada usuario puede dar como máximo un "me gusta" por publicación, y puede quitarlo. ¿Sigue alcanzando la replicación sin coordinar?',
      options: [
        'No: cualquier regla exige consenso global.',
        'Sí, si el estado es el conjunto de usuarios que dieron "me gusta" (un CRDT de conjunto) y el número es su tamaño: dar dos veces desde dos regiones agrega el mismo elemento, y el conjunto no lo cuenta dos veces.',
        'Sí, con el mismo contador por región.',
        'No: hay que prohibir que se quite el "me gusta".'
      ],
      answer: 1,
      explain: 'Con un contador por región, el mismo usuario sumaría dos veces. Modelado como conjunto, "a lo sumo uno por usuario" se mantiene sin coordinar, porque agregar un elemento es idempotente. Distinto es "como máximo 5 000 me gusta en total": ese invariante sí necesita coordinar (M18).'
    }
  ],
  solution: '<ul><li><b>Garantía:</b> eventual para el número visible, más read-your-writes para el propio "me gusta" de cada usuario.</li><li><b>Estructura:</b> por publicación, un conjunto CRDT de usuarios (se puede partir por región para que cada una solo agregue y quite sus elementos) y un contador derivado, que puede ser un contador CRDT por región para leerlo barato.</li><li><b>Replicación:</b> asíncrona entre regiones, combinando estados con el merge del CRDT; el orden y los duplicados no importan.</li><li><b>Lo que no se hace:</b> last-write-wins sobre un número, ni coordinación entre continentes por cada "me gusta".</li><li><b>Dónde sí coordinar:</b> en invariantes globales, como un límite total, que no son confluentes y necesitan un dueño único o escrow (M18).</li></ul>'
});

SD.defineExercise('m06-raft', {
  title: 'Raft durante un corte de red',
  scenario: '<p>Un clúster de etcd de 5 nodos reparte sus nodos en tres zonas: dos en la zona A (entre ellos el líder, S1), dos en la B y uno en la C. Un corte de red aísla la zona A durante 10 minutos: S1 y S2 se ven entre sí, pero no ven a S3, S4 ni S5.</p>',
  steps: [
    {
      id: 'minoria', type: 'single',
      prompt: '¿Qué pasa con las escrituras que llegan a S1 durante el corte?',
      options: [
        'Se confirman, porque S1 sigue siendo el líder.',
        'S1 las agrega a su log pero no puede confirmarlas: solo llega a 2 de 5 nodos. Los clientes esperan hasta su timeout.',
        'S1 las rechaza al instante con un error.',
        'Se confirman en A y se reconcilian después con las de B y C.'
      ],
      answer: 1,
      explain: 'Confirmar exige una mayoría, y 2 de 5 no lo es. S1 no sabe que está aislado, así que acepta en su log y espera. Aceptada no es confirmada: solo la confirmación es una promesa al cliente. Repasa 6.8.'
    },
    {
      id: 'mayoria', type: 'single',
      prompt: '¿Y en las zonas B y C?',
      options: [
        'Esperan a que vuelva S1: no pueden hacer nada sin el líder.',
        'Dejan de recibir heartbeats, uno de los tres nodos se vuelve candidato con un término mayor, gana con 3 de 5 votos y el clúster sigue confirmando escrituras.',
        'Eligen dos líderes, uno por zona.',
        'Pasan a solo lectura.'
      ],
      answer: 1,
      explain: 'Tres nodos son mayoría, así que pueden elegir y confirmar. Puede haber dos nodos que se crean líderes a la vez (S1 y el nuevo), pero nunca dos que confirmen: el de la minoría no llega a ninguna mayoría.'
    },
    {
      id: 'timeout', type: 'single',
      prompt: 'Un cliente que escribía en S1 recibió un timeout y reintenta contra el líder nuevo. ¿Qué tiene que tener en cuenta?',
      options: [
        'Nada: su primera escritura seguro se perdió.',
        'Que no sabe si la primera escritura se confirmó: si el corte llegó justo después de confirmarla, reintentar la duplica. La escritura necesita ser idempotente o llevar una clave que se pueda verificar.',
        'Que tiene que esperar a que vuelva S1.',
        'Que el líder nuevo va a rechazar el reintento.'
      ],
      answer: 1,
      explain: 'Es el problema de los dos generales dentro de un clúster de consenso: un timeout no dice si la operación ocurrió. Por eso las APIs sobre etcd usan transacciones condicionales (comparar la revisión y después escribir) o claves idempotentes. Repasa 6.10.'
    },
    {
      id: 'vuelta', type: 'single',
      prompt: 'Vuelve la red. ¿Qué hace S1?',
      options: [
        'Sigue como líder y el clúster queda con dos.',
        'Ve un término mayor en los mensajes del líder nuevo, pasa a seguidor, y las entradas de su log que nunca se confirmaron se reemplazan por las del líder.',
        'Fusiona su log con el del líder nuevo.',
        'Se apaga hasta que un operador lo revise.'
      ],
      answer: 1,
      explain: 'En Raft, ver un término mayor degrada a cualquiera a seguidor. Las entradas de S1 que no se confirmaron se descartan sin daño, porque nadie recibió la promesa de que estaban confirmadas.'
    },
    {
      id: 'lectura', type: 'single',
      prompt: 'Durante el corte, un cliente le pide una lectura a S1, que todavía se cree líder y responde con un valor viejo. ¿Cómo evita etcd esas lecturas sin escribirlas en el log?',
      options: [
        'No las evita: las lecturas en Raft siempre pueden ser viejas.',
        'Con ReadIndex: antes de responder, el líder confirma con una mayoría que sigue siéndolo. S1, aislado, no lo logra y no responde.',
        'Leyendo de dos seguidores y quedándose con el valor más nuevo.',
        'Con el reloj del sistema.'
      ],
      answer: 1,
      explain: 'Una lectura local del líder no es linealizable, porque el líder puede estar depuesto sin saberlo. ReadIndex cuesta una ronda de heartbeats; la alternativa, las lecturas con lease, ahorra esa ronda a cambio de confiar en que los relojes no se desvían más de lo previsto. Repasa 6.8.'
    },
    {
      id: 'orden', type: 'order',
      prompt: 'Ordena lo que pasa en las zonas B y C desde que dejan de recibir heartbeats:',
      items: [
        'Vence el timeout de elección, aleatorio, de uno de los seguidores',
        'Se vuelve candidato, incrementa el término y se vota a sí mismo',
        'Pide votos a los demás nodos',
        'Recibe 3 votos de 5 y se vuelve líder',
        'Manda heartbeats y empieza a replicar'
      ],
      explain: 'El timeout aleatorio evita que dos seguidores se postulen a la vez y se repartan los votos para siempre, que es la forma en que Raft esquiva el resultado de FLP en la práctica.'
    }
  ],
  solution: '<ul><li><b>Durante el corte:</b> la zona A (2 de 5) no confirma nada; B y C (3 de 5) eligen un líder nuevo y siguen. Nunca hay dos líderes que confirmen.</li><li><b>Clientes:</b> un timeout no dice si la escritura ocurrió. Se reintenta contra el líder nuevo con una operación idempotente o condicional.</li><li><b>Lecturas:</b> linealizables con ReadIndex, que exige hablar con una mayoría; S1 aislado no puede responder.</li><li><b>Al volver:</b> S1 ve el término mayor, pasa a seguidor y su log se alinea con el del líder.</li><li><b>Por qué 2, 2 y 1:</b> con cinco nodos en tres zonas, perder cualquier zona deja al menos tres nodos, una mayoría. Con dos zonas, perder la que tiene tres nodos detiene el clúster.</li></ul>'
});

SD.defineExercise('m06-transferencia', {
  title: 'una transferencia entre dos shards',
  scenario: '<p>Una billetera guarda los saldos en una base particionada por usuario: el usuario 17 vive en el shard 1 y el 42, en el shard 3. Hay que transferir 50 del 17 al 42 sin que el dinero se pierda ni se duplique, aunque se caiga cualquier máquina en cualquier momento.</p>',
  steps: [
    {
      id: 'dos-commits', type: 'single',
      prompt: '¿Por qué no alcanza con descontar en el shard 1, confirmar, y después acreditar en el shard 3 y confirmar?',
      options: [
        'Porque es lento.',
        'Porque si algo falla entre los dos commits, el débito quedó hecho y el crédito no: el dinero desaparece hasta que alguien lo note.',
        'Porque los shards no pueden hacer commits.',
        'Porque el orden de los commits no importa.'
      ],
      answer: 1,
      explain: 'Son dos commits independientes: la atomicidad de cada uno no se extiende al par. El problema de fondo se llama compromiso atómico: que todos confirmen o ninguno.'
    },
    {
      id: 'bloqueo', type: 'single',
      prompt: 'Con two-phase commit, los dos shards votaron "sí" y el coordinador cae antes de comunicar la decisión. ¿Qué pasa?',
      options: [
        'Los shards abortan por su cuenta después de un timeout.',
        'Los shards quedan en duda: votaron sí, así que no pueden abortar solos, y no saben si la decisión fue commit. Las filas de los dos usuarios quedan bloqueadas hasta que vuelva el coordinador.',
        'Los shards confirman por su cuenta.',
        'Se pierde el dinero.'
      ],
      answer: 1,
      explain: 'Es la debilidad conocida de 2PC: bloquea si cae el coordinador después de la votación. Un participante que votó sí prometió poder confirmar, y abortar solo podría contradecir un commit que el otro ya aplicó. Repasa 6.11.'
    },
    {
      id: 'no-bloquear', type: 'single',
      prompt: '¿Cómo se evita que la caída del coordinador bloquee las cuentas?',
      options: [
        'Con three-phase commit, que nunca bloquea.',
        'Haciendo que el coordinador sea tolerante a fallas: su decisión se replica con consenso, así otra réplica la conoce y la termina. Spanner corre 2PC entre grupos de Paxos.',
        'Con timeouts más cortos en los participantes.',
        'Guardando la decisión en la memoria del coordinador.'
      ],
      answer: 1,
      explain: 'Three-phase commit evita el bloqueo solo si los mensajes tienen demoras acotadas; con particiones reales puede terminar inconsistente, y casi no se usa. Lo que se hace es replicar al coordinador y a cada participante con consenso: 2PC sobre grupos de Paxos o de Raft.'
    },
    {
      id: 'saga', type: 'single',
      prompt: 'Sin transacción distribuida, con una saga (debitar, después acreditar, y compensar si el crédito falla), ¿qué hay que aceptar?',
      options: [
        'Nada: una saga da las mismas garantías que una transacción.',
        'Que los estados intermedios son visibles: por un momento, el 17 ya no tiene los 50 y el 42 todavía no los tiene. Y cada paso y cada compensación tienen que ser idempotentes.',
        'Que el dinero se puede duplicar.',
        'Que no se puede deshacer nada.'
      ],
      answer: 1,
      explain: 'La saga cambia aislamiento por disponibilidad: cada paso confirma en su propio shard. Funciona si el negocio tolera ver la transferencia "en curso", y si los pasos se reintentan sin duplicarse (M27).'
    },
    {
      id: 'evitarla', type: 'single',
      prompt: 'La mejor transacción distribuida es la que no hace falta. ¿Cómo se diseña una billetera para que una transferencia sea una sola escritura?',
      options: [
        'Poniendo todas las cuentas en una sola máquina.',
        'Registrando cada transferencia como un único asiento en un ledger o log (una escritura atómica en un solo lugar), y derivando los saldos de ese log con consumidores idempotentes.',
        'Guardando los saldos en caché.',
        'Haciendo los dos commits en paralelo.'
      ],
      answer: 1,
      explain: 'Si la fuente de verdad es el asiento de la transferencia, el commit es uno solo y los saldos son una vista derivada. Es el diseño de los ledgers de doble entrada del M27: débito y crédito viajan juntos en el mismo asiento.'
    }
  ],
  solution: '<ul><li><b>El problema:</b> compromiso atómico entre dos shards. Dos commits sueltos pueden dejar el débito sin el crédito.</li><li><b>2PC:</b> resuelve la atomicidad, pero bloquea si el coordinador cae después de la votación. En producción, coordinador y participantes se replican con consenso (Spanner sobre Paxos, CockroachDB y TiKV sobre Raft).</li><li><b>Saga:</b> sin bloqueo entre shards, con estados intermedios visibles y compensaciones idempotentes.</li><li><b>Mejor diseño:</b> la transferencia como un único asiento en un ledger, que es la fuente de verdad, y saldos derivados. El commit es uno solo.</li><li><b>Siempre:</b> una clave idempotente por transferencia, para que un reintento del cliente no mueva el dinero dos veces.</li></ul>'
});

SD.defineExercise('m06-relojes', {
  title: 'qué reloj usar en cada caso',
  scenario: '<p>En cada caso hay que ordenar eventos o medir tiempo en un sistema con muchas máquinas, cuyos relojes se sincronizan con NTP y pueden desviarse. Elige el reloj adecuado.</p>',
  steps: [
    {
      id: 'logs', type: 'single',
      prompt: 'Juntas los logs de 50 servicios y los ordenas por la hora de cada máquina para reconstruir un incidente. ¿Qué puede salir mal?',
      options: [
        'Nada: NTP deja los relojes perfectos.',
        'Con relojes desfasados, un efecto puede aparecer antes que su causa. Para seguir una request entre servicios se usan los ids de trace y la relación padre e hijo de los spans, no la hora.',
        'Los logs se duplican.',
        'Los logs no tienen hora.'
      ],
      answer: 1,
      explain: 'La hora de cada máquina sirve para ubicarse, no para ordenar causas y efectos entre máquinas con diferencias de milisegundos. El trace (M11) lleva la causalidad explícita.'
    },
    {
      id: 'conflictos', type: 'single',
      prompt: 'Dos réplicas de un carrito aceptan escrituras mientras están separadas. Al reconectarse, hay que saber si una versión reemplaza a la otra o si son concurrentes y hay que combinarlas. ¿Qué usas?',
      options: [
        'La hora del sistema de cada escritura.',
        'Relojes vectoriales (vectores de versión): comparándolos se sabe si una versión es anterior a la otra o si son concurrentes.',
        'Un reloj de Lamport.',
        'El número de artículos del carrito.'
      ],
      answer: 1,
      explain: 'Un reloj de Lamport da un orden total compatible con la causalidad, pero no distingue "anterior" de "concurrente". Detectar la concurrencia es justamente lo que agrega el vector. Dynamo y Riak lo usaban para esto. Repasa 6.7.'
    },
    {
      id: 'hlc', type: 'single',
      prompt: 'Una base distribuida necesita timestamps parecidos a la hora real, para consultar los datos "tal como estaban a las 15:00", y que además respeten la causalidad, sin hardware especial. ¿Qué usa?',
      options: [
        'TrueTime.',
        'Un reloj híbrido (HLC): la hora física más un contador lógico que se ajusta con cada mensaje.',
        'Relojes vectoriales.',
        'Un contador global en un solo servidor.'
      ],
      answer: 1,
      explain: 'El HLC se mantiene cerca de la hora física, así que sirve para consultas por tiempo, y el contador lógico garantiza que un evento causado por otro tenga un timestamp mayor. CockroachDB lo usa y acota el desfasaje máximo que tolera entre nodos.'
    },
    {
      id: 'externa', type: 'single',
      prompt: 'Necesitas que, si una transacción confirmó antes de que empiece otra en cualquier lugar del mundo, la segunda la vea siempre, con timestamps que lo reflejen. ¿Qué lo logra y cuánto cuesta?',
      options: [
        'NTP: no cuesta nada.',
        'TrueTime con commit wait, como Spanner: el commit espera a que pase la incertidumbre del reloj, unos pocos milisegundos por transacción.',
        'Un reloj de Lamport por región.',
        'Es imposible.'
      ],
      answer: 1,
      explain: 'TrueTime acota el error del reloj con GPS y relojes atómicos, y el commit wait convierte esa cota en un orden real garantizado. El costo es esperar la incertidumbre en cada commit. Repasa 6.7.'
    },
    {
      id: 'duracion', type: 'single',
      prompt: 'Un proceso mide cuánto tarda cada request para ajustar el balanceo. ¿Con qué reloj?',
      options: [
        'Con la hora del sistema, que es la más precisa.',
        'Con un reloj monotónico, que nunca retrocede. Con la hora del sistema, un ajuste de NTP o un segundo intercalar pueden dar duraciones negativas.',
        'Con un reloj de Lamport.',
        'Con TrueTime.'
      ],
      answer: 1,
      explain: 'El 1 de enero de 2017, un segundo intercalar hizo que el DNS de Cloudflare midiera una duración negativa con la hora del sistema, y un algoritmo de selección que no esperaba números negativos entró en pánico. Las duraciones se miden con un reloj monotónico.'
    }
  ],
  solution: '<ul><li><b>Ordenar causa y efecto entre servicios:</b> ids de trace y spans, no la hora.</li><li><b>Detectar escrituras concurrentes:</b> relojes o vectores de versión.</li><li><b>Timestamps cercanos a la hora real y causales:</b> HLC.</li><li><b>Orden real global garantizado:</b> TrueTime con commit wait, pagando milisegundos por commit.</li><li><b>Medir duraciones:</b> reloj monotónico, siempre.</li><li><b>Nunca:</b> "gana el timestamp más alto" con la hora del sistema para resolver conflictos, salvo que perder escrituras sea aceptable.</li></ul>'
});

SD.defineExercise('m06-lock', {
  title: '¿es seguro este lock?',
  scenario: '<p>Un servicio procesa archivos de un bucket, y dos workers no deberían procesar el mismo archivo a la vez: cada procesamiento escribe un resultado en una base y cobra el archivo al cliente.</p>',
  steps: [
    {
      id: 'replica', type: 'single',
      prompt: 'Primera versión: <code>SET lock:archivo NX PX 30000</code> en un Redis con una réplica asíncrona. El primario cae justo después de dar el lock, antes de replicarlo, y la réplica promovida no lo tiene. ¿Qué pasa?',
      options: [
        'Nada: el lock se recupera del disco.',
        'Otro worker pide el mismo lock a la réplica promovida y lo obtiene: dos workers creen tener el lock.',
        'Redis rechaza el SET.',
        'Los dos workers esperan.'
      ],
      answer: 1,
      explain: 'Con replicación asíncrona, una escritura confirmada puede perderse en un failover (M18). Para un lock eso significa dos dueños.'
    },
    {
      id: 'redlock', type: 'single',
      prompt: 'Segunda versión: Redlock, que toma el lock en la mayoría de 5 Redis independientes. ¿Resuelve el caso de un worker que queda pausado 40 segundos por GC mientras cree tener el lock?',
      options: [
        'Sí: la mayoría garantiza un solo dueño en todo momento.',
        'No: el lock vence durante la pausa, otro worker lo toma, y el primero despierta y sigue escribiendo como si nada. Ningún lock con vencimiento lo evita del lado del cliente.',
        'Sí, si el lease es de 60 segundos.',
        'No, porque Redis no tiene mayorías.'
      ],
      answer: 1,
      explain: 'Es el argumento de Martin Kleppmann de 2016: un lock basado en tiempo no puede proteger de pausas del proceso, demoras de red o relojes que saltan. Alargar el lease solo cambia qué pausa lo rompe.'
    },
    {
      id: 'fencing', type: 'single',
      prompt: '¿Qué hace seguro al recurso compartido?',
      options: [
        'Que el worker verifique que sigue teniendo el lock antes de escribir.',
        'Un fencing token: el servicio de locks entrega un número creciente con cada lock, cada escritura lo lleva y la base rechaza los números menores al último que vio. etcd y ZooKeeper lo dan (la revisión o el zxid); Redlock no.',
        'Usar dos locks en lugar de uno.',
        'Reducir el tiempo de GC.'
      ],
      answer: 1,
      explain: 'La protección tiene que estar en el recurso, porque la pausa puede ocurrir entre la verificación y la escritura. Un número creciente convierte "creo que tengo el lock" en algo que el recurso puede comprobar. Repasa 6.14.'
    },
    {
      id: 'eficiencia', type: 'single',
      prompt: '¿Cuándo alcanza un lock sin fencing token?',
      options: [
        'Nunca.',
        'Cuando el lock es por eficiencia y no por corrección: si dos workers procesan lo mismo, se desperdicia trabajo pero el resultado sigue siendo correcto, como al recalcular una entrada de caché.',
        'Cuando hay pocos workers.',
        'Cuando el lease es corto.'
      ],
      answer: 1,
      explain: 'Kleppmann propuso esta distinción: un lock de eficiencia puede fallar de vez en cuando sin daño; uno de corrección no. Antes de elegir el lock, hay que preguntarse qué pasa si falla.'
    },
    {
      id: 'idempotente', type: 'single',
      prompt: 'Otra forma de lograr que procesar dos veces un archivo sea inofensivo:',
      options: [
        'Procesar más rápido.',
        'Hacer idempotente el efecto: el resultado se escribe con una clave única por archivo y el cobro lleva una idempotency key derivada del archivo. Así, el lock pasa a ser solo de eficiencia.',
        'Borrar el archivo antes de procesarlo.',
        'Usar un solo worker.'
      ],
      answer: 1,
      explain: 'Con efectos idempotentes, la corrección ya no depende del lock: un procesamiento duplicado no escribe dos resultados ni cobra dos veces (M02, M27).'
    }
  ],
  solution: '<ul><li><b>Redis con réplica asíncrona:</b> un failover puede perder el lock y dar dos dueños.</li><li><b>Redlock:</b> no protege de pausas del proceso ni de relojes que saltan, y no entrega tokens crecientes.</li><li><b>Seguro para corrección:</b> un servicio de coordinación con consenso (etcd, ZooKeeper) que entregue un número creciente, y un recurso que rechace números viejos.</li><li><b>Mejor todavía:</b> efectos idempotentes (clave única por archivo, idempotency key en el cobro), así el lock solo evita trabajo repetido.</li><li><b>La pregunta de diseño:</b> ¿el lock es de eficiencia o de corrección? La respuesta decide cuánta infraestructura hace falta.</li></ul>'
});

SD.defineExercise('m06-planificador', {
  title: 'un planificador de tareas sin duplicados',
  scenario: '<p>Tienes 6 instancias de un servicio que debe ejecutar un job de facturación cada hora, exactamente una vez. Si la instancia que lo ejecuta se cae, otra debe tomar el relevo en menos de un minuto. El job escribe en una base PostgreSQL y envía correos.</p><p>Diseña la elección del ejecutor, cómo evitas que dos instancias corran el job a la vez y qué pasa con los correos si una instancia muere a mitad del job.</p>',
  steps: [
    {
      id: 'eleccion', type: 'single',
      prompt: '¿Cómo se elige qué instancia ejecuta el job de cada hora?',
      options: [
        'Cada instancia lo corre si su hostname es el menor de una lista fija en su configuración.',
        'Un lock con lease en un servicio de coordinación (etcd, o un advisory lock de PostgreSQL), de 30 segundos y renovado cada 10 mientras el job corre.',
        'Cron en las 6 instancias, y que la base rechace el segundo INSERT.',
        'La instancia que recibió la última request HTTP.'
      ],
      answer: 1,
      explain: 'El lease resuelve dos cosas a la vez: una sola instancia ejecuta, y si muere, el lease vence y otra toma el relevo en menos de 30 segundos. Una lista fija no tiene relevo; cron en todas duplica el trabajo y los correos.'
    },
    {
      id: 'pausa', type: 'single',
      prompt: 'La instancia A queda congelada 45 segundos por una pausa de GC a mitad del job; su lease vence y B lo toma. ¿Qué evita que A, al despertar, siga escribiendo facturas?',
      options: [
        'Que A pregunte si sigue teniendo el lock antes de cada escritura.',
        'Un fencing token: el lock entrega un número creciente, cada escritura lo lleva y la base rechaza los números menores al último que vio.',
        'Acortar el lease a 5 segundos.',
        'Sincronizar los relojes con NTP.'
      ],
      answer: 1,
      explain: 'La pausa puede ocurrir justo entre la verificación y la escritura, así que preguntar no alcanza. Con un token, la base misma rechaza al dueño viejo. Acortar el lease solo cambia qué pausa lo rompe.'
    },
    {
      id: 'retomar', type: 'single',
      prompt: 'El job muere después de crear 500 de 2 000 facturas, y otra instancia lo retoma. ¿Cómo evitas facturas duplicadas?',
      options: [
        'Borrando las 500 y empezando de cero.',
        'Con una clave única (cliente, período) en la tabla de facturas y un INSERT … ON CONFLICT DO NOTHING: rehacer una factura que ya existe no hace nada.',
        'Guardando en memoria cuántas facturas se crearon.',
        'No retomando: se espera a la hora siguiente.'
      ],
      answer: 1,
      explain: 'El job entero tiene que ser idempotente: cada unidad de trabajo tiene una clave natural, y repetirla no cambia el resultado. Así, retomar es simplemente volver a correr.'
    },
    {
      id: 'correos', type: 'single',
      prompt: 'El job envía cada correo y después confirma la factura. En un reintento, el commit falla después de enviar. ¿Qué pasa y cómo se corrige?',
      options: [
        'Nada grave: el correo salió y la factura se crea en el reintento.',
        'El correo anunció una factura que no existe, y el reintento lo manda otra vez. Se usa un outbox: la factura y el pedido de correo se guardan en la misma transacción, y un proceso aparte envía los pendientes.',
        'Se mete el envío del correo dentro de la transacción de la base.',
        'Se desactivan los reintentos.'
      ],
      answer: 1,
      explain: 'Un correo no se puede deshacer con un rollback. El outbox (M07) hace que "la factura existe" y "hay que avisar" se confirmen juntos, y el envío queda como un paso aparte, reintentable.'
    },
    {
      id: 'limite', type: 'single',
      prompt: 'Con todo esto, ¿qué sigue sin poder garantizarse?',
      options: [
        'Que dos instancias no escriban facturas a la vez.',
        'Que cada correo llegue exactamente una vez: si el proveedor lo envía y su confirmación se pierde, se reenvía. Se consigue "al menos una vez" con un id de mensaje que el proveedor deduplica.',
        'Que el job corra cada hora.',
        'Que las facturas no se dupliquen.'
      ],
      answer: 1,
      explain: 'Es el problema de los dos generales: ningún intercambio de mensajes sobre una red que puede perderlos da certeza de entrega. Lo que se construye es "al menos una vez" más deduplicación en cada paso.'
    }
  ],
  solution: '<ul><li><b>Elección:</b> un lock con lease en etcd (o en PostgreSQL con <code>pg_try_advisory_lock</code>, si ya tienes la base). Lease de 30 s renovado cada 10 s; si la instancia muere, otra lo obtiene en menos de 30 s.</li><li><b>Fencing:</b> el lock entrega una revisión creciente. El job escribe una fila <code>ejecuciones(periodo, token)</code> con <code>UNIQUE(periodo)</code> y cada escritura posterior verifica que el token de la ejecución siga siendo el vigente. Una instancia pausada que despierta con un token viejo no puede escribir.</li><li><b>Idempotencia del job:</b> el trabajo se divide por cliente y cada factura tiene una clave única <code>(cliente, periodo)</code>. Si el job muere a mitad y otro lo retoma, las facturas ya creadas no se duplican.</li><li><b>Correos:</b> no se envían dentro del job. El job registra "factura creada" en una tabla outbox en la misma transacción, y un proceso aparte envía los correos con su propia deduplicación (M07). Si el correo se envía dos veces por un reintento, el proveedor de correo deduplica por un id de mensaje.</li><li><b>Lo que no se puede garantizar:</b> que el correo llegue exactamente una vez al usuario (dos generales). Se acepta "al menos una vez" con deduplicación en cada paso.</li></ul>'
});
