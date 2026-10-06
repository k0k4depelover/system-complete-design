SD.defineQuiz('m07', {
  title: 'Quiz: mensajería asíncrona',
  pass: 0.7,
  questions: [
    {
      id: 'orden', type: 'single',
      prompt: 'Necesitas que los eventos de un mismo pedido (creado, pagado, enviado) se procesen en orden, con mucho paralelismo entre pedidos distintos. ¿Qué haces en Kafka?',
      options: [
        'Un tópico con una sola partición, para que todos los eventos queden en un único orden global.',
        'Usar el id del pedido como clave: todos sus eventos van a la misma partición.',
        'Ordenar por timestamp en el consumidor, con una ventana que espere a los eventos atrasados.',
        'Activar el productor idempotente, que garantiza el orden de los eventos entre particiones.'
      ],
      answer: 1,
      explain: 'Kafka garantiza orden dentro de una partición. La clave decide la partición, así que el orden es por clave, y el paralelismo viene de tener muchas particiones.'
    },
    {
      id: 'consumidores', type: 'single',
      prompt: 'Un tópico tiene 6 particiones y el consumer group tiene 10 consumidores. ¿Cuántos procesan eventos?',
      options: ['10', '6', '1', '60'],
      answer: 1,
      explain: 'Cada partición la lee un solo miembro del grupo. Los 4 consumidores de más quedan ociosos. El número de particiones es el techo de paralelismo de un grupo, y conviene decidirlo con margen desde el principio.'
    },
    {
      id: 'dual', type: 'single',
      prompt: 'Un servicio hace <code>COMMIT</code> del pedido en la base y después publica el evento en Kafka. ¿Qué puede salir mal?',
      options: [
        'Nada, si Kafka tiene acks=all y el productor reintenta hasta lograr publicar.',
        'Si el proceso muere entre ambas operaciones, el pedido queda sin evento publicado.',
        'Kafka rechaza los eventos de pedidos que ya están confirmados en otra base.',
        'Que el evento llegue a los consumidores antes de que el pedido sea visible en la base.'
      ],
      answer: 1,
      explain: 'Son dos sistemas sin transacción común (la doble escritura). La solución es el patrón outbox: escribir el evento en una tabla dentro de la misma transacción del pedido y publicarlo después desde ahí.'
    },
    {
      id: 'exacto', type: 'single',
      prompt: 'Tu consumidor procesa un pago y luego guarda el offset. Si muere entre ambas cosas, al reiniciar vuelve a procesar el mensaje. ¿Cómo evitas cobrar dos veces?',
      options: [
        'Guardando el offset antes de procesar, así nunca se vuelve a leer el mismo mensaje.',
        'Registrando el id del mensaje con clave única, en la misma transacción que el cobro.',
        'Activando exactly-once en el productor de Kafka, que evita que el consumidor repita mensajes.',
        'Con una sola partición y un solo consumidor, para que nada se procese dos veces.'
      ],
      answer: 1,
      explain: 'Guardar el offset antes da "como mucho una vez" (se puede perder el pago). Lo robusto es al menos una vez + deduplicación: si el id ya está en la tabla, el mensaje ya se procesó.'
    },
    {
      id: 'veneno', type: 'single',
      prompt: 'Un mensaje con un JSON mal formado hace fallar al consumidor cada vez. El consumidor reintenta sin límite. ¿Qué pasa con la partición?',
      options: [
        'Nada: los demás mensajes de la partición se procesan en paralelo mientras tanto.',
        'Queda bloqueada: nada posterior de esa partición se procesa y el lag crece.',
        'Kafka detecta el mensaje envenenado y lo borra solo después de varios intentos.',
        'El mensaje se reordena al final de la partición y el consumidor sigue con el próximo.'
      ],
      answer: 1,
      explain: 'Como la partición se consume en orden, un mensaje envenenado frena todo lo que viene detrás. Hay que limitar los reintentos y mover el mensaje a una DLQ (o a un tópico de reintentos) para seguir.'
    },
    {
      id: 'cola-log', type: 'multi',
      prompt: '¿Qué ventajas tiene un log (Kafka) frente a una cola clásica (SQS, RabbitMQ)?',
      options: [
        'Varios grupos de consumidores leen los mismos eventos de forma independiente.',
        'Se pueden reprocesar eventos pasados volviendo a un offset anterior.',
        'Reintentar un mensaje individual sin frenar a los demás es más simple.',
        'Garantiza orden por clave.',
        'No necesita que el consumidor sea idempotente.'
      ],
      answer: [0, 1, 3],
      explain: 'El log retiene los eventos y cada grupo lleva su posición: permite reprocesar y tener muchos consumidores. La cola clásica es mejor para trabajos independientes con reintentos por mensaje. En ambos, el consumidor debe ser idempotente.'
    },
    {
      id: 'backpressure', type: 'single',
      prompt: 'El lag de un consumidor crece de forma sostenida durante horas. ¿Qué indica y qué haces primero?',
      options: [
        'Que el broker de Kafka está saturado; reiniciarlo para liberar a los consumidores.',
        'Se produce más rápido de lo que se consume: sumar consumidores o acelerar el procesamiento.',
        'Nada grave: el lag crece durante el día y se recupera solo durante la noche.',
        'Que hay que bajar la retención del tópico para que el consumidor tenga menos que leer.'
      ],
      answer: 1,
      explain: 'Un lag que crece sin bajar significa capacidad insuficiente. Si ya hay un consumidor por partición, hay que aumentar particiones (con cuidado: cambia a qué partición va cada clave) o hacer más eficiente el consumidor. Y ojo con la retención: si el lag supera la retención, se pierden eventos sin procesar.'
    },
    {
      id: 'retencion', type: 'single',
      prompt: 'Un tópico retiene 7 días. Un consumidor estuvo caído 9 días. ¿Qué pasa al volver?',
      options: [
        'Procesa todo lo que se perdió, porque el offset del grupo apunta al último leído.',
        'Los eventos de los 2 primeros días ya se borraron y los pierde.',
        'Kafka retiene los eventos no leídos hasta que el grupo de consumidores los confirma.',
        'Se duplican los eventos de la última semana.'
      ],
      answer: 1,
      explain: 'Un log no espera a sus consumidores: borra por tiempo o tamaño. Alertar sobre el lag en relación con la retención es obligatorio.'
    }
  ]
});
