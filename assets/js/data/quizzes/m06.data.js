SD.defineQuiz('m06', {
  title: 'Quiz: teoría distribuida',
  pass: 0.7,
  questions: [
    {
      id: 'cap', type: 'single',
      prompt: 'Según CAP, ¿cuándo está obligado un sistema distribuido a elegir entre consistencia y disponibilidad?',
      options: ['Siempre, en cada operación.', 'Solo cuando hay una partición de red.', 'Solo cuando se cae un nodo.', 'Nunca, si usa SSD.'],
      answer: 1,
      explain: 'CAP habla del caso de partición: si dos partes no se ven, o una rechaza operaciones (elige C) o ambas siguen aceptándolas y divergen (elige A). En funcionamiento normal, la elección es otra: la que describe PACELC.'
    },
    {
      id: 'pacelc', type: 'single',
      prompt: 'Una base replica de forma síncrona a otra región para no perder nada. Sin ninguna partición, ¿qué paga cada escritura?',
      options: ['Nada.', 'Latencia: esperar la ida y vuelta a la otra región. Es la "E, L/C" de PACELC.', 'Disponibilidad.', 'Durabilidad.'],
      answer: 1,
      explain: 'Else (sin partición) hay que elegir entre latencia y consistencia. La réplica síncrona elige consistencia, y lo paga en cada escritura, todos los días, no solo durante fallas.'
    },
    {
      id: 'mayoria', type: 'single',
      prompt: 'Un clúster Raft de 5 nodos pierde 2. ¿Puede seguir aceptando y confirmando escrituras?',
      options: ['No: necesita los 5.', 'Sí: 3 de 5 es mayoría.', 'Solo lecturas.', 'Solo si el líder fue uno de los que sobrevivió.'],
      answer: 1,
      explain: 'Raft confirma con mayoría. Con 5 nodos tolera 2 caídas; con 3, solo 1. Por eso los clústeres de consenso tienen tamaño impar: 4 nodos toleran lo mismo que 3 (una falla) con un nodo más.'
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
      explain: 'Sin mayoría no hay confirmación: el líder viejo no puede dañar nada. Lo que un cliente de ese líder debe entender es que "aceptada" no es "confirmada": solo la confirmación es una promesa.'
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
      explain: 'Los relojes físicos se desfasan (milisegundos o más, y a veces saltan). Last-writer-wins con relojes físicos pierde datos sin ningún error. Para ordenar causalmente se usan relojes lógicos, vectoriales o híbridos.'
    },
    {
      id: 'byz', type: 'single',
      prompt: '¿Cuántos nodos necesita un algoritmo de consenso para tolerar 1 nodo bizantino (que miente)?',
      options: ['2', '3', '4', '5'],
      answer: 2,
      explain: '3f + 1 con f = 1: cuatro. Con tres, un leal que recibe versiones contradictorias no puede saber quién miente. Para fallas por caída (nodos que se detienen pero no mienten), basta 2f + 1.'
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
      explain: 'Separan seguridad de progreso: nunca se equivocan, y si la red se porta mal pueden quedarse sin líder un rato. En la práctica los períodos de estabilidad alcanzan para avanzar.'
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
      explain: 'Chequear antes de escribir no alcanza: la pausa puede ocurrir justo entre el chequeo y la escritura. La protección tiene que estar en el recurso: rechazar al que trae un token viejo.'
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
      explain: 'Si un valor desactualizado unos segundos no rompe ninguna regla, lo eventual es más barato y disponible. El saldo al autorizar y la elección de líder exigen linealizabilidad: dos respuestas distintas causan dinero duplicado o split brain.'
    }
  ]
});
