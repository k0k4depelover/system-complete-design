SD.defineQuiz('m061', {
  title: 'Quiz: teoría distribuida a fondo',
  pass: 0.7,
  questions: [
    {
      id: 'safety', type: 'multi',
      prompt: '¿Cuáles de estas son propiedades de safety?',
      options: [
        'Nunca hay dos líderes que confirmen en el mismo término.',
        'Toda escritura termina recibiendo una respuesta.',
        'Una lectura nunca devuelve un valor que nadie escribió.',
        'Si la red se estabiliza, se termina eligiendo un líder.',
        'Nunca se emiten dos facturas para el mismo cliente y período.'
      ],
      answer: [0, 2, 4],
      explain: 'Safety: nunca pasa nada malo, y su violación ocurre en un instante que se puede señalar. Liveness: algo bueno termina pasando. Los algoritmos reales garantizan safety siempre y liveness solo cuando la red se estabiliza. Repasa 6.1.'
    },
    {
      id: 'swim', type: 'single',
      prompt: 'En SWIM, el nodo A no recibe respuesta a su ping al nodo B. ¿Qué hace antes de sospechar de B?',
      options: [
        'Lo declara muerto de inmediato, para detectar rápido.',
        'Les pide a k nodos que le manden un ping a B por él: si alguno recibe respuesta, el problema era el enlace entre A y B, no B.',
        'Le manda 100 pings seguidos.',
        'Espera a que B aparezca en el próximo mensaje de gossip.'
      ],
      answer: 1,
      explain: 'La prueba indirecta separa dos fallas que un ping solo no distingue: un nodo caído y un enlace roto entre dos nodos sanos. Después, el nodo queda sospechado un tiempo antes de declararlo muerto, y puede desmentirlo. Repasa 6.2.'
    },
    {
      id: 'cap', type: 'single',
      prompt: 'Según CAP, ¿cuándo está obligado un sistema distribuido a elegir entre consistencia y disponibilidad?',
      options: ['Siempre, en cada operación.', 'Solo cuando hay una partición de red.', 'Solo cuando se cae un nodo.', 'Nunca, si usa SSD.'],
      answer: 1,
      explain: 'CAP habla del caso de partición: si dos partes no se ven, o una rechaza operaciones (elige C) o ambas siguen aceptándolas y divergen (elige A). En funcionamiento normal, la elección es otra: la que describe PACELC. Repasa 6.3.'
    },
    {
      id: 'pacelc', type: 'single',
      prompt: 'Una base replica de forma síncrona a otra región para no perder nada. Sin ninguna partición, ¿qué paga cada escritura?',
      options: ['Nada.', 'Latencia: esperar la ida y vuelta a la otra región. Es la "E, L/C" de PACELC.', 'Disponibilidad.', 'Durabilidad.'],
      answer: 1,
      explain: 'Else (sin partición) hay que elegir entre latencia y consistencia. La réplica síncrona elige consistencia, y lo paga en cada escritura, todos los días, no solo durante fallas. Repasa 6.4.'
    },
    {
      id: 'linealizable', type: 'single',
      prompt: 'La escritura x = 1 del cliente A termina a las 10:00:00.100. La lectura del cliente B empieza a las 10:00:00.200 y devuelve 0. ¿Es linealizable esta historia?',
      options: [
        'Sí, si la escritura y la lectura fueron a réplicas distintas.',
        'No: la lectura empezó después de que la escritura terminó, así que tiene que ubicarse después y ver el 1. Sí sería secuencial, porque ese modelo no respeta el tiempo real entre clientes.',
        'Sí: la linealizabilidad solo exige respetar el orden de cada cliente.',
        'No se puede saber sin comparar los relojes de las réplicas.'
      ],
      answer: 1,
      explain: 'Cada operación ocurre en un instante dentro de su intervalo, y una que terminó antes de que otra empezara va antes. Es la historia "Una réplica atrasada" del verificador. Repasa 6.5.'
    },
    {
      id: 'modelos', type: 'multi',
      prompt: '¿Para cuáles de estos casos alcanza la consistencia eventual?',
      options: [
        'El contador de "me gusta" de un post.',
        'El saldo de una cuenta bancaria al autorizar un retiro.',
        'Los resultados de búsqueda de productos.',
        'La elección de qué nodo es el líder de un clúster.',
        'El número de vistas de un video.'
      ],
      answer: [0, 2, 4],
      explain: 'Si un valor desactualizado unos segundos no rompe ninguna regla, lo eventual es más barato y disponible. El saldo al autorizar y la elección de líder exigen linealizabilidad: dos respuestas distintas causan dinero duplicado o split brain. Repasa 6.5.'
    },
    {
      id: 'quorum', type: 'single',
      prompt: 'Con N = 3, W = 2 y R = 2, una escritura de x = 1 sigue en curso y solo llegó a una réplica. El lector A ve el 1 y termina; después, el lector B ve el 0. ¿Qué pasó?',
      options: [
        'Es un bug de la base: W + R > N garantiza linealizabilidad.',
        'W + R > N solo garantiza ver la última escritura confirmada. Con una escritura en curso, dos lecturas pueden caer en quórums distintos y retroceder. ABD lo evita: el lector escribe en un quórum el valor más nuevo antes de responder.',
        'Un reloj desfasado en la réplica de B.',
        'B leyó de una caché.'
      ],
      answer: 1,
      explain: 'La intersección de quórums protege lo confirmado, no lo que está en curso. ABD paga una ida y vuelta más por lectura para que, una vez que alguien vio un valor, todo quórum lo tenga. Repasa 6.6 y la figura 6.10.'
    },
    {
      id: 'mayoria', type: 'single',
      prompt: 'Un clúster Raft de 5 nodos pierde 2. ¿Puede seguir aceptando y confirmando escrituras?',
      options: ['No: necesita los 5.', 'Sí: 3 de 5 es mayoría.', 'Solo lecturas.', 'Solo si el líder fue uno de los que sobrevivió.'],
      answer: 1,
      explain: 'Raft confirma con mayoría. Con 5 nodos tolera 2 caídas; con 3, solo 1. Por eso los clústeres de consenso tienen tamaño impar: 4 nodos toleran lo mismo que 3 (una falla) con un nodo más. Repasa 6.6.'
    },
    {
      id: 'vector', type: 'single', fixed: true,
      prompt: 'Dos eventos tienen los relojes vectoriales [3, 0, 0] y [2, 3, 2]. ¿Qué relación tienen?',
      options: [
        'El primero ocurrió antes que el segundo.',
        'El segundo ocurrió antes que el primero.',
        'Son concurrentes: ninguno es menor o igual que el otro en todas las posiciones.',
        'Son el mismo evento visto desde dos procesos.'
      ],
      answer: 2,
      explain: '[3, 0, 0] es mayor en la primera posición y menor en las otras dos, así que ninguno pudo enterarse del otro. Un reloj de Lamport les daría números distintos y un orden, pero no permitiría detectar la concurrencia. Repasa 6.7 y la figura 6.11.'
    },
    {
      id: 'relojes', type: 'single',
      prompt: 'Dos servidores escriben la misma clave y la resolución es "gana el timestamp más alto" usando la hora del sistema. ¿Qué riesgo hay?',
      options: [
        'Ninguno con NTP.',
        'Si el reloj de un servidor va adelantado, sus escrituras "ganan" aunque hayan ocurrido antes, y se pierden escrituras más nuevas en silencio.',
        'Que la base se cuelgue.',
        'Que los timestamps se repitan siempre.'
      ],
      answer: 1,
      explain: 'Los relojes físicos se desfasan (milisegundos o más, y a veces saltan). Last-write-wins con relojes físicos pierde datos sin ningún error. Para detectar escrituras concurrentes se usan relojes vectoriales, y para combinarlas sin perder nada, CRDTs. Repasa 6.7 y 6.12.'
    },
    {
      id: 'minoria', type: 'single',
      prompt: 'Una partición deja al líder de Raft con un solo seguidor (2 de 5). ¿Qué pasa con las escrituras que recibe?',
      options: [
        'Se confirman normalmente.',
        'Las acepta en su log pero nunca puede confirmarlas; mientras tanto, los otros 3 eligen un líder nuevo. Al repararse la red, esas entradas se descartan.',
        'Se pierden los datos confirmados antes.',
        'El clúster queda con dos líderes que confirman escrituras distintas.'
      ],
      answer: 1,
      explain: 'Sin mayoría no hay confirmación: el líder viejo no puede dañar nada. Lo que un cliente de ese líder debe entender es que "aceptada" no es "confirmada": solo la confirmación es una promesa. Repasa 6.8.'
    },
    {
      id: 'commit', type: 'single',
      prompt: 'El líder de Raft del término 4 acaba de copiar a una mayoría una entrada del término 2. ¿Puede darla por confirmada?',
      options: [
        'Sí: está en una mayoría.',
        'No contando copias: un líder solo confirma así las entradas de su propio término. La del término 2 queda confirmada cuando se confirme una entrada posterior del término 4.',
        'Solo si el líder anterior ya la había confirmado.',
        'No: las entradas de términos anteriores siempre se descartan.'
      ],
      answer: 1,
      explain: 'Un nodo cuya última entrada es de un término mayor podría ganar una elección y sobrescribirla, aunque esté en una mayoría. Por eso un líder nuevo agrega enseguida una entrada vacía de su término. Repasa 6.8 y la figura 6.12.'
    },
    {
      id: 'readindex', type: 'order',
      prompt: 'Ordena los pasos de una lectura linealizable con ReadIndex:',
      items: [
        'El cliente le pide leer x al líder',
        'El líder anota su índice de commit actual como readIndex',
        'El líder manda heartbeats y una mayoría responde',
        'El líder espera a aplicar su log hasta readIndex',
        'El líder responde con el valor de x'
      ],
      explain: 'El heartbeat confirmado demuestra que nadie depuso al líder antes de la lectura, y esperar a aplicar hasta readIndex garantiza que la respuesta incluye todo lo confirmado hasta ese momento. Responder desde la memoria, sin el heartbeat, no es linealizable. Repasa 6.8 y la figura 6.13.'
    },
    {
      id: 'flp', type: 'single',
      prompt: 'Si FLP dice que el consenso es imposible en un sistema asíncrono con una sola falla, ¿cómo funcionan Raft y Paxos en la práctica?',
      options: [
        'No funcionan: pierden datos a veces.',
        'Siempre son seguros (nunca deciden dos valores distintos), pero solo garantizan avanzar cuando la red se comporta de forma razonablemente sincrónica; usan timeouts y aleatoriedad.',
        'Porque usan relojes atómicos.',
        'Porque FLP solo aplica a fallas bizantinas.'
      ],
      answer: 1,
      explain: 'Separan seguridad de progreso: nunca se equivocan, y si la red se porta mal pueden quedarse sin líder un rato. Es el modelo de sincronía parcial: en la práctica, los períodos de estabilidad alcanzan para avanzar. Repasa 6.10.'
    },
    {
      id: 'dosfases', type: 'single',
      prompt: 'En two-phase commit, los dos participantes votaron sí y el coordinador cae antes de comunicar la decisión. ¿Qué hacen los participantes?',
      options: [
        'Abortan después de un timeout.',
        'Confirman después de un timeout.',
        'Esperan con los locks tomados: no saben qué decidió el coordinador, y abortar podría contradecir un commit que otro ya aplicó.',
        'Eligen entre ellos un coordinador nuevo, que decide abortar.'
      ],
      answer: 2,
      explain: 'Es la debilidad conocida de 2PC. Se resuelve haciendo que el coordinador no pueda desaparecer: replicándolo con consenso, como Spanner y CockroachDB, que corren 2PC sobre grupos de Paxos o de Raft. Repasa 6.11.'
    },
    {
      id: 'crdt', type: 'multi',
      prompt: '¿Qué propiedades necesita el merge de un CRDT basado en estado para que las réplicas converjan sin importar el orden ni las repeticiones?',
      options: ['Conmutativa', 'Asociativa', 'Idempotente', 'Invertible', 'Ordenada por la hora del sistema'],
      answer: [0, 1, 2],
      explain: 'Conmutativa y asociativa: el orden de los merges no cambia el resultado. Idempotente: recibir el mismo estado dos veces no cambia nada. El máximo por casillero de un G-Counter cumple las tres. Repasa 6.12.'
    },
    {
      id: 'byz', type: 'single', fixed: true,
      prompt: '¿Cuántos nodos necesita un algoritmo de consenso para tolerar 1 nodo bizantino (que miente)?',
      options: ['2', '3', '4', '5'],
      answer: 2,
      explain: '3f + 1 con f = 1: cuatro. Con tres, un leal que recibe versiones contradictorias no puede saber quién miente. Para fallas por caída (nodos que se detienen pero no mienten), basta 2f + 1. Repasa 6.13.'
    },
    {
      id: 'fencing', type: 'single',
      prompt: 'Un worker obtiene un lock con lease de 10 s, sufre una pausa de GC de 15 s y, al despertar, escribe en el almacenamiento creyendo que sigue teniendo el lock. ¿Qué lo evita?',
      options: [
        'Un lease más largo.',
        'Un fencing token: el lock entrega un número creciente, cada escritura lo incluye y el almacenamiento rechaza números menores al último visto.',
        'Chequear el reloj antes de escribir.',
        'Nada: es imposible.'
      ],
      answer: 1,
      explain: 'Chequear antes de escribir no alcanza: la pausa puede ocurrir justo entre el chequeo y la escritura. La protección tiene que estar en el recurso: rechazar al que trae un token viejo. Repasa 6.14.'
    },
    {
      id: 'paradigma', type: 'single',
      prompt: 'En teoría distribuida, ¿qué distingue a un modelo síncrono de uno asíncrono?',
      options: [
        'Si el cliente se bloquea esperando la respuesta o recibe un callback.',
        'Si existen cotas conocidas para la demora de los mensajes, la velocidad de los procesos y el desvío de los relojes.',
        'Si las réplicas confirman antes o después de responder al cliente.',
        'Si los mensajes viajan por TCP o por UDP.'
      ],
      answer: 1,
      explain: 'En programación, síncrono es bloquear; en teoría distribuida, es que haya cotas de tiempo conocidas, de modo que un silencio largo pruebe una falla. Sin cotas (asíncrono), un silencio no prueba nada. Repasa 6.1, "Antes de empezar".'
    },
    {
      id: 'replsync', type: 'single',
      prompt: 'La tabla de PACELC dice "PostgreSQL con réplica síncrona". ¿A qué se refiere "síncrona" ahí?',
      options: [
        'A que el sistema supone el modelo síncrono, con cotas de tiempo conocidas.',
        'A que el primario espera la confirmación de la réplica antes de responderle al cliente.',
        'A que las réplicas comparten el mismo reloj.',
        'A que el cliente usa una API bloqueante.'
      ],
      answer: 1,
      explain: 'Es replicación con espera: el primario no confirma hasta que la réplica tiene el cambio. No tiene nada que ver con el modelo de tiempo; esa base sigue corriendo en un mundo parcialmente síncrono. Repasa la convención de 6.1 y la tabla de 6.4.'
    },
    {
      id: 'wlat', type: 'single',
      prompt: 'Un primario en Virginia replica a Ohio (~11 ms de ida y vuelta) y a Irlanda (~75 ms). Cada escritura espera a un quórum de 2 de 3, contando al primario. Irlanda entra en una pausa de GC de 2 segundos. ¿Qué les pasa a las escrituras?',
      options: [
        'Tardan unos 2 segundos, hasta que Irlanda responda.',
        'Siguen tardando unos 11 ms: el quórum espera a la segunda respuesta más rápida, la de Ohio.',
        'Fallan, porque una réplica no responde.',
        'Tardan unos 75 ms, la ida y vuelta a Irlanda.'
      ],
      answer: 1,
      explain: 'Un quórum espera a la W-ésima respuesta más rápida, no a la más lenta. Solo esperar a todas las réplicas ataría cada escritura al p99 de la peor. Repasa "De dónde sale la latencia", en 6.4.'
    },
    {
      id: 'palomar', type: 'single',
      prompt: '¿Por qué W + R &gt; N garantiza que una lectura encuentre la última escritura confirmada?',
      options: [
        'Porque las réplicas se sincronizan antes de cada lectura.',
        'Porque el nodo que responde primero siempre es el más actualizado.',
        'Porque W + R visitas no caben en N nodos distintos: al menos un nodo está en los dos grupos, y su versión es la más alta entre las respuestas.',
        'Porque el lector espera a todas las réplicas.'
      ],
      answer: 2,
      explain: 'Es el principio del palomar: si los dos grupos suman más nodos de los que hay, comparten alguno. La versión de cada valor permite reconocer cuál de las R respuestas es la más nueva. Repasa "Por qué funciona", en 6.6.'
    },
    {
      id: 'afloja', type: 'order',
      prompt: 'Ordena de más fuerte a más débil. Cada nivel afloja una regla del anterior:',
      items: [
        'Linealizable: un orden único que respeta el tiempo real',
        'Secuencial: un orden único, sin tiempo real entre clientes',
        'Causal: solo se ordena lo relacionado',
        'De sesión: solo se promete lo de cada cliente',
        'Eventual: solo que al final todos coinciden'
      ],
      explain: 'Cada escalón conserva menos de la ilusión de "una sola copia" y, a cambio, necesita menos coordinación. Repasa la tabla del principio de 6.5.'
    },
    {
      id: 'causalseq', type: 'single',
      prompt: 'Ana escribe x = 1 y Dani escribe y = 1 a la vez, sin haberse leído. Beto ve x = 1, y = 0; Carla ve x = 0, y = 1. ¿Qué modelos permiten esa historia?',
      options: [
        'Linealizable y secuencial.',
        'Secuencial, pero no causal.',
        'Causal, pero no secuencial.',
        'Ninguno.'
      ],
      answer: 2,
      explain: 'Las dos escrituras son concurrentes, así que lo causal deja que cada lector las vea en su propio orden. Lo secuencial exige un único orden para todos, y Beto y Carla ordenaron distinto. Repasa la figura 6.7.'
    }
  ]
});
