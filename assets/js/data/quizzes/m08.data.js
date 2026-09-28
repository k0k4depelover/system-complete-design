SD.defineQuiz('m08', {
  title: 'Quiz: resiliencia',
  pass: 0.7,
  questions: [
    {
      id: 'timeout', type: 'single',
      prompt: 'Tu servicio llama a una dependencia cuyo p99.9 es 300 ms. El cliente HTTP no tiene timeout configurado. Un día la dependencia se cuelga. ¿Qué le pasa a tu servicio?',
      options: [
        'Nada: los errores se devuelven rápido.',
        'Cada request queda esperando indefinidamente con un hilo y una conexión tomados; en segundos se agotan y tu servicio deja de responder también.',
        'El sistema operativo corta la conexión en 300 ms.',
        'La dependencia se reinicia sola.'
      ],
      answer: 1,
      explain: 'Ley de Little: si W se vuelve infinito, L también. Un timeout algo por encima del p99.9 (por ejemplo 500 ms) acota el daño: la falla de la dependencia se vuelve un error rápido en lugar de un contagio.'
    },
    {
      id: 'jitter', type: 'single',
      prompt: '¿Para qué sirve agregar jitter (aleatoriedad) al backoff exponencial?',
      options: [
        'Para reintentar más rápido.',
        'Para que miles de clientes que fallaron a la vez no reintenten todos en el mismo instante y generen olas sincronizadas.',
        'Para cifrar los reintentos.',
        'Para que el servidor sepa que es un reintento.'
      ],
      answer: 1,
      explain: 'Sin jitter, todos los que fallaron en el mismo segundo reintentan juntos a los 0.5 s, luego a 1 s, luego a 2 s: picos exactamente cuando el servicio intenta recuperarse. El jitter los reparte en el tiempo.'
    },
    {
      id: 'metaestable', type: 'single',
      prompt: 'Tras un incidente de 5 minutos, la causa se arregló, pero el servicio sigue sobrecargado una hora después con la misma carga de siempre. ¿Qué es lo más probable?',
      options: [
        'Un bug nuevo.',
        'Una falla metaestable: el servidor atiende requests viejas cuyos clientes ya se fueron, esos clientes reintentan, y el ciclo de reintentos y trabajo desperdiciado se sostiene solo.',
        'Que la base de datos está llena.',
        'Que los usuarios cambiaron de comportamiento.'
      ],
      answer: 1,
      explain: 'Se rompe desde afuera: cortar tráfico (load shedding), descartar requests vencidas, limitar reintentos con un presupuesto. Y se previene no atendiendo trabajo cuyo deadline ya pasó.'
    },
    {
      id: 'breaker', type: 'single',
      prompt: '¿Qué hace un circuit breaker en estado abierto?',
      options: [
        'Reintenta más rápido.',
        'Falla de inmediato sin llamar a la dependencia, durante un tiempo; después deja pasar unas pocas requests de prueba.',
        'Cambia de región.',
        'Encola las requests hasta que la dependencia vuelva.'
      ],
      answer: 1,
      explain: 'Protege a los dos lados: tu servicio no gasta hilos esperando algo que sabe que falla, y la dependencia recibe menos carga para poder recuperarse.'
    },
    {
      id: 'bulkhead', type: 'single',
      prompt: 'Tu servicio llama a 3 dependencias con un único pool de 200 hilos. Una se pone lenta. ¿Qué patrón evita que las otras dos dejen de funcionar?',
      options: ['Bulkhead: un pool separado (o un límite de concurrencia) por dependencia.', 'Un pool más grande.', 'Sticky sessions.', 'Un TTL más corto.'],
      answer: 0,
      explain: 'Con un pool compartido, la dependencia lenta acapara los 200 hilos. Con límites separados, solo se agota su compartimento y las demás llamadas siguen funcionando.'
    },
    {
      id: 'ventana', type: 'single',
      prompt: 'Un rate limiter de ventana fija permite 100 requests por minuto. ¿Cuántas puede hacer un cliente en unos pocos segundos?',
      options: ['100', 'Hasta 200: 100 al final de un minuto y 100 al principio del siguiente.', '50', 'Ilimitadas.'],
      answer: 1,
      explain: 'El contador se reinicia en el borde de la ventana. Ventana deslizante o token bucket evitan ese doble pico.'
    },
    {
      id: 'utilizacion', type: 'single',
      prompt: 'Un servicio tiene un tiempo de servicio de 10 ms. Según el modelo de colas M/M/1, ¿cuánto tarda en promedio una request al 90 % de utilización?',
      options: ['11 ms', '19 ms', '100 ms', '900 ms'],
      answer: 2,
      explain: 'Tiempo en el sistema = servicio / (1 − ρ) = 10 / 0.1 = 100 ms. Por eso los sistemas se dimensionan para trabajar al 60–70 %: cerca del 100 %, pequeñas variaciones de carga producen grandes saltos de latencia.'
    },
    {
      id: 'multiregion', type: 'multi',
      prompt: '¿Qué es necesario para que un failover a otra región funcione de verdad el día que lo necesites?',
      options: [
        'Capacidad reservada (o que escale a tiempo) en la región de destino.',
        'Datos replicados con un RPO conocido.',
        'Haberlo probado regularmente con tráfico real.',
        'Que las dos regiones compartan la misma base de datos primaria.',
        'Que el failover dependa del plano de control de la región caída.'
      ],
      answer: [0, 1, 2],
      explain: 'Un failover que nunca se probó casi nunca funciona. Y no puede depender de nada que viva en la región caída: ni la base primaria, ni el plano de control, ni el DNS administrado desde ahí.'
    }
  ]
});
