SD.defineQuiz('m07', {
  title: 'Quiz: mensajería asíncrona',
  pass: 0.7,
  questions: [
    {
      id: 'orden', type: 'single',
      prompt: 'Necesitas que los eventos de un mismo pedido (creado, pagado, enviado) se procesen en orden, con mucho paralelismo entre pedidos distintos. ¿Qué haces en Kafka?',
      options: [
        'Un tópico con una sola partición.',
        'Usar el id del pedido como clave del mensaje: todos sus eventos van a la misma partición, que se consume en orden.',
        'Ordenar por timestamp en el consumidor.',
        'Es imposible con Kafka.'
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
        'Nada, si Kafka tiene acks=all.',
        'Si el proceso muere entre ambas operaciones, el pedido existe pero el evento nunca se publica; y si publica primero y la base falla, hay evento sin pedido.',
        'Kafka rechaza eventos de pedidos confirmados.',
        'Que el evento llegue antes que el pedido a la base.'
      ],
      answer: 1,
      explain: 'Son dos sistemas sin transacción común (la doble escritura). La solución es el patrón outbox: escribir el evento en una tabla dentro de la misma transacción del pedido y publicarlo después desde ahí.'
    },
    {
      id: 'exacto', type: 'single',
      prompt: 'Tu consumidor procesa un pago y luego guarda el offset. Si muere entre ambas cosas, al reiniciar vuelve a procesar el mensaje. ¿Cómo evitas cobrar dos veces?',
      options: [
        'Guardando el offset antes de procesar.',
        'Haciendo el procesamiento idempotente: registrar el id del mensaje en una tabla con clave única, en la misma transacción que el efecto.',
        'Aumentando el timeout.',
        'Con una sola partición.'
      ],
      answer: 1,
      explain: 'Guardar el offset antes da "como mucho una vez" (se puede perder el pago). Lo robusto es al menos una vez + deduplicación: si el id ya está en la tabla, el mensaje ya se procesó.'
    },
    {
      id: 'veneno', type: 'single',
      prompt: 'Un mensaje con un JSON mal formado hace fallar al consumidor cada vez. El consumidor reintenta sin límite. ¿Qué pasa con la partición?',
      options: [
        'Nada: los demás mensajes se procesan en paralelo.',
        'Queda bloqueada: ningún mensaje posterior de esa partición se procesa y el lag crece sin parar.',
        'Kafka borra el mensaje solo.',
        'El mensaje se reordena al final.'
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
        'Que Kafka está caído; reiniciarlo.',
        'Que se produce más rápido de lo que se consume: agregar consumidores (hasta el número de particiones), acelerar el procesamiento o limitar a los productores.',
        'Nada: el lag siempre crece.',
        'Que hay que borrar el tópico.'
      ],
      answer: 1,
      explain: 'Un lag que crece sin bajar significa capacidad insuficiente. Si ya hay un consumidor por partición, hay que aumentar particiones (con cuidado: cambia a qué partición va cada clave) o hacer más eficiente el consumidor. Y ojo con la retención: si el lag supera la retención, se pierden eventos sin procesar.'
    },
    {
      id: 'retencion', type: 'single',
      prompt: 'Un tópico retiene 7 días. Un consumidor estuvo caído 9 días. ¿Qué pasa al volver?',
      options: [
        'Procesa todo lo que se perdió.',
        'Los eventos de los 2 primeros días ya se borraron: los pierde para siempre, salvo que haya otra fuente.',
        'Kafka los guarda hasta que alguien los lea.',
        'Se duplican.'
      ],
      answer: 1,
      explain: 'Un log no espera a sus consumidores: borra por tiempo o tamaño. Alertar sobre el lag en relación con la retención es obligatorio.'
    }
  ]
});
