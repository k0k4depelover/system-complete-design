SD.defineQuiz('m06', {
  title: 'Quiz: teoría distribuida, lo esencial',
  pass: 0.7,
  questions: [
    {
      id: 'e-paradigma', type: 'single',
      prompt: 'En sistemas distribuidos, ¿qué distingue a un modelo síncrono de uno asíncrono?',
      options: [
        'Si el cliente se bloquea esperando la respuesta o sigue trabajando y recibe un callback.',
        'Si hay un límite conocido para lo que tarda un mensaje: con límite, un silencio prueba una falla.',
        'Si las réplicas confirman la escritura antes de responder al cliente o después.',
        'Si los mensajes viajan por TCP, que garantiza la entrega en orden, o por UDP, que no.'
      ],
      answer: 1,
      explain: 'En programación, síncrono es bloquear. En teoría distribuida, es que haya una cota de tiempo conocida. El mundo real es parcialmente síncrono: caótico por momentos, pero en algún momento se calma. Repasa 6.2.'
    },
    {
      id: 'e-timeout', type: 'single',
      prompt: 'Un nodo deja de responder durante 10 segundos. ¿Qué puede concluir el resto del clúster?',
      options: [
        'Que el nodo murió con certeza: 10 s es mucho más que cualquier pausa normal.',
        'Que el nodo está vivo pero lento, porque una caída real cortaría las conexiones TCP.',
        'Nada con certeza: puede estar muerto, lento, en una pausa de GC o aislado.',
        'Que la red está partida, porque un nodo caído responde con un RST.'
      ],
      answer: 2,
      explain: 'Sin una cota de tiempo en la que confiar, un silencio no distingue entre caído y lento. Por eso la safety nunca depende de un timeout. Repasa 6.1 y 6.2.'
    },
    {
      id: 'e-cap', type: 'single',
      prompt: 'Durante una partición, una réplica aislada recibe una lectura. Según CAP, ¿qué opciones tiene?',
      options: [
        'Responder con el valor más reciente del clúster, que conoce por el último heartbeat.',
        'Responder con lo que tiene, quizá viejo (elige A), o no responder (elige C).',
        'Ninguna: según CAP, ningún sistema distribuido puede atender lecturas durante una partición.',
        'Elegir CA: seguir respondiendo con consistencia y renunciar a la tolerancia a particiones.'
      ],
      answer: 1,
      explain: 'La réplica aislada no puede enterarse de lo que se escribió del otro lado. La P no se elige, así que no existe "CA": se elige entre C y A, y la elección puede ser distinta para cada operación. Repasa 6.3.'
    },
    {
      id: 'e-quorumlat', type: 'single',
      prompt: 'Un primario en Virginia replica a Ohio (~11 ms) y a Irlanda (~75 ms). Cada escritura espera a 2 de 3, contando al primario. Irlanda se congela 2 segundos. ¿Qué pasa con las escrituras?',
      options: [
        'Tardan unos 2 segundos, porque cada escritura espera a que Irlanda despierte.',
        'Siguen en unos 11 ms: el quórum espera a la respuesta de Ohio.',
        'Fallan hasta que Irlanda vuelva, porque el quórum necesita a las tres réplicas.',
        'Tardan unos 75 ms, como siempre.'
      ],
      answer: 1,
      explain: 'Un quórum espera a la W-ésima respuesta más rápida, no a la más lenta. Solo esperar a todas las réplicas ataría cada escritura a la peor. Repasa 6.4.'
    },
    {
      id: 'e-el', type: 'single',
      prompt: 'Un sistema EL (latencia sobre consistencia) responde las escrituras en cuanto las confirma el nodo que las recibió. ¿Qué gana y qué arriesga?',
      options: [
        'Gana latencia baja; arriesga lecturas viejas en otras réplicas y perder lo que no se replicó.',
        'Gana consistencia fuerte, porque un solo nodo decide; arriesga latencia alta en las lecturas.',
        'Gana tolerancia a particiones; no arriesga nada, porque la réplica termina llegando.',
        'Gana latencia baja sin arriesgar nada, porque replicar en segundo plano nunca pierde datos.'
      ],
      answer: 0,
      explain: 'Responder con lo que sabe el nodo al que le preguntaste evita cargar con la latencia de las réplicas lejanas, pero lo confirmado todavía no está en ninguna otra parte. Repasa 6.4.'
    },
    {
      id: 'e-escalera', type: 'order',
      prompt: 'Ordena de más fuerte a más débil:',
      items: ['Linealizable', 'Secuencial', 'Causal', 'De sesión', 'Eventual'],
      explain: 'Cada escalón conserva menos de la ilusión de "una sola copia" y necesita menos coordinación. Repasa 6.5.'
    },
    {
      id: 'e-sesion', type: 'single',
      prompt: 'Un usuario cambia su foto de perfil, recarga y ve la foto vieja, porque la lectura fue a una réplica atrasada. ¿Qué garantía mínima falta?',
      options: [
        'Linealizabilidad: todo el sistema tiene que comportarse como una sola copia.',
        'Read-your-writes: cada cliente ve sus propias escrituras.',
        'Serializabilidad: las transacciones tienen que parecer ejecutadas una detrás de otra.',
        'Ninguna: es lo esperado con réplicas, y no se arregla sin replicación síncrona.'
      ],
      answer: 1,
      explain: 'No hace falta que todo el sistema sea linealizable; basta con que cada usuario vea lo suyo, con un token de versión o leyendo del líder un rato después de escribir. Repasa 6.5.'
    },
    {
      id: 'e-palomar', type: 'single',
      prompt: 'Con N = 5 réplicas, ¿qué combinación garantiza que una lectura vea la última escritura confirmada?',
      options: [
        'W = 2, R = 2.',
        'W = 2, R = 3.',
        'W = 3, R = 3.',
        'W = 1, R = 1.'
      ],
      answer: 2,
      fixed: true,
      explain: '3 + 3 = 6 visitas no caben en 5 nodos sin repetir alguno: al menos un nodo está en los dos grupos y lleva el valor nuevo. Con 2 + 3 = 5, los grupos pueden quedar disjuntos. Repasa 6.6.'
    },
    {
      id: 'e-2pc', type: 'single',
      prompt: 'En two-phase commit, el coordinador cae justo después de que todos los participantes votaron que sí. ¿Qué pasa?',
      options: [
        'Los participantes confirman solos, porque cada uno sabe que votó que sí.',
        'Los participantes abortan solos tras un timeout y liberan los locks.',
        'Quedan bloqueados con los locks tomados: no pueden decidir sin el coordinador.',
        'Nada grave: un participante asume el rol de coordinador y termina el commit.'
      ],
      answer: 2,
      explain: 'Ningún participante sabe si los demás votaron que sí, ni si el coordinador ya decidió. Por eso se replica al coordinador con consenso o se usan sagas. Repasa 6.8.'
    }
  ]
});
