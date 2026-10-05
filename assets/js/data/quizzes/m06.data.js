SD.defineQuiz('m06', {
  title: 'Quiz: teoría distribuida, lo esencial',
  pass: 0.7,
  questions: [
    {
      id: 'e-paradigma', type: 'single',
      prompt: 'En sistemas distribuidos, ¿qué distingue a un modelo síncrono de uno asíncrono?',
      options: [
        'Si el cliente se bloquea esperando la respuesta o recibe un callback.',
        'Si existe un límite conocido para cuánto puede tardar un mensaje: con límite, un silencio largo prueba una falla; sin límite, no prueba nada.',
        'Si las réplicas confirman antes o después de responder.',
        'Si los mensajes viajan por TCP o por UDP.'
      ],
      answer: 1,
      explain: 'En programación, síncrono es bloquear. En teoría distribuida, es que haya una cota de tiempo conocida. El mundo real es parcialmente síncrono: caótico por momentos, pero en algún momento se calma. Repasa 6.2.'
    },
    {
      id: 'e-timeout', type: 'single',
      prompt: 'Un nodo deja de responder durante 10 segundos. ¿Qué puede concluir el resto del clúster?',
      options: [
        'Que el nodo murió, con certeza.',
        'Que el nodo está vivo pero lento, con certeza.',
        'Nada con certeza: puede estar muerto, lento, en una pausa de GC o aislado por la red. El timeout es una apuesta.',
        'Que la red está partida.'
      ],
      answer: 2,
      explain: 'Sin una cota de tiempo en la que confiar, un silencio no distingue entre caído y lento. Por eso la safety nunca depende de un timeout. Repasa 6.1 y 6.2.'
    },
    {
      id: 'e-cap', type: 'single',
      prompt: 'Durante una partición, una réplica aislada recibe una lectura. Según CAP, ¿qué opciones tiene?',
      options: [
        'Responder con el valor más reciente del clúster, que siempre conoce.',
        'Responder con lo que tiene, que puede estar viejo (elige A), o no responder (elige C).',
        'Ninguna: CAP dice que los sistemas distribuidos no pueden leer durante una partición.',
        'Elegir CA y evitar la partición.'
      ],
      answer: 1,
      explain: 'La réplica aislada no puede enterarse de lo que se escribió del otro lado. La P no se elige, así que no existe "CA": se elige entre C y A, y la elección puede ser distinta para cada operación. Repasa 6.3.'
    },
    {
      id: 'e-quorumlat', type: 'single',
      prompt: 'Un primario en Virginia replica a Ohio (~11 ms) y a Irlanda (~75 ms). Cada escritura espera a 2 de 3, contando al primario. Irlanda se congela 2 segundos. ¿Qué pasa con las escrituras?',
      options: [
        'Tardan unos 2 segundos.',
        'Siguen tardando unos 11 ms: el quórum espera a la segunda respuesta más rápida, la de Ohio.',
        'Fallan hasta que Irlanda vuelva.',
        'Tardan unos 75 ms.'
      ],
      answer: 1,
      explain: 'Un quórum espera a la W-ésima respuesta más rápida, no a la más lenta. Solo esperar a todas las réplicas ataría cada escritura a la peor. Repasa 6.4.'
    },
    {
      id: 'e-el', type: 'single',
      prompt: 'Un sistema EL (latencia sobre consistencia) responde las escrituras en cuanto las confirma el nodo que las recibió. ¿Qué gana y qué arriesga?',
      options: [
        'Gana latencia baja, porque no espera a ninguna réplica; arriesga que otra réplica lea el valor viejo y perder escrituras si el nodo cae antes de replicar.',
        'Gana consistencia fuerte; arriesga latencia alta.',
        'Gana tolerancia a particiones; no arriesga nada.',
        'Gana latencia baja sin arriesgar nada, porque replica después.'
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
        'Linealizabilidad.',
        'Read-your-writes, una garantía de sesión: cada cliente ve sus propias escrituras.',
        'Serializabilidad.',
        'Ninguna: es el comportamiento esperado de cualquier sistema.'
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
        'Los participantes confirman solos, porque todos votaron que sí.',
        'Los participantes abortan solos después de un timeout.',
        'Los participantes quedan bloqueados con los locks tomados: no saben qué decidió el coordinador y no pueden decidir por su cuenta.',
        'Nada: 2PC tolera la caída del coordinador.'
      ],
      answer: 2,
      explain: 'Ningún participante sabe si los demás votaron que sí, ni si el coordinador ya decidió. Por eso se replica al coordinador con consenso o se usan sagas. Repasa 6.8.'
    }
  ]
});
