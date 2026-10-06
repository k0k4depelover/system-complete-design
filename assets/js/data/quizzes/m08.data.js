SD.defineQuiz('m08', {
  title: 'Quiz: resiliencia',
  pass: 0.7,
  questions: [
    {
      id: 'timeout', type: 'single',
      prompt: 'Tu servicio llama a una dependencia cuyo p99.9 es 300 ms. El cliente HTTP no tiene timeout configurado. Un día la dependencia se cuelga. ¿Qué le pasa a tu servicio?',
      options: [
        'Nada grave: sin timeout, el cliente HTTP aplica uno por defecto de pocos segundos.',
        'Cada request queda esperando con un hilo tomado, y en segundos tu servicio deja de responder.',
        'El sistema operativo corta la conexión al pasar el p99.9 de la dependencia, a los 300 ms.',
        'La dependencia detecta las conexiones colgadas y las cierra con un RST.'
      ],
      answer: 1,
      explain: 'Ley de Little: si W se vuelve infinito, L también. Un timeout algo por encima del p99.9 (por ejemplo 500 ms) acota el daño: la falla de la dependencia se vuelve un error rápido en lugar de un contagio.'
    },
    {
      id: 'jitter', type: 'single',
      prompt: '¿Para qué sirve agregar jitter (aleatoriedad) al backoff exponencial?',
      options: [
        'Para reintentar más rápido, adelantando algunos reintentos respecto del backoff.',
        'Para que los clientes que fallaron a la vez no reintenten todos en el mismo instante.',
        'Para que el servidor reconozca que es un reintento y lo atienda antes que el tráfico nuevo.',
        'Para que cada reintento vaya a una réplica distinta del servicio.'
      ],
      answer: 1,
      explain: 'Sin jitter, todos los que fallaron en el mismo segundo reintentan juntos a los 0.5 s, luego a 1 s, luego a 2 s: picos exactamente cuando el servicio intenta recuperarse. El jitter los reparte en el tiempo.'
    },
    {
      id: 'metaestable', type: 'single',
      prompt: 'Tras un incidente de 5 minutos, la causa se arregló, pero el servicio sigue sobrecargado una hora después con la misma carga de siempre. ¿Qué es lo más probable?',
      options: [
        'Un bug nuevo que entró con el arreglo y que consume más CPU que el código anterior.',
        'Una falla metaestable: reintentos y trabajo desperdiciado sostienen la sobrecarga.',
        'Que la base de datos quedó con las cachés frías y tarda una hora en calentarse.',
        'Que los usuarios cambiaron de comportamiento tras el incidente y ahora piden más.'
      ],
      answer: 1,
      explain: 'Se rompe desde afuera: cortar tráfico (load shedding), descartar requests vencidas, limitar reintentos con un presupuesto. Y se previene no atendiendo trabajo cuyo deadline ya pasó.'
    },
    {
      id: 'breaker', type: 'single',
      prompt: '¿Qué hace un circuit breaker en estado abierto?',
      options: [
        'Reintenta más rápido, para que la dependencia vuelva a responder cuanto antes.',
        'Falla de inmediato sin llamar a la dependencia; después deja pasar unas pocas de prueba.',
        'Desvía las llamadas a una réplica de la dependencia en otra región hasta que la original se recupere.',
        'Encola las requests hasta que la dependencia vuelva y las manda todas juntas.'
      ],
      answer: 1,
      explain: 'Protege a los dos lados: tu servicio no gasta hilos esperando algo que sabe que falla, y la dependencia recibe menos carga para poder recuperarse.'
    },
    {
      id: 'bulkhead', type: 'single',
      prompt: 'Tu servicio llama a 3 dependencias con un único pool de 200 hilos. Una se pone lenta. ¿Qué patrón evita que las otras dos dejen de funcionar?',
      options: ['Bulkhead: un pool separado o un límite de concurrencia por dependencia.', 'Un pool más grande, de 1 000 hilos, para que la lenta no alcance a acapararlos.', 'Un circuit breaker compartido para las tres dependencias, que las corte a la vez.', 'Load shedding en la entrada, rechazando el 30&#8239;% de las requests.'],
      answer: 0,
      explain: 'Con un pool compartido, la dependencia lenta acapara los 200 hilos. Con límites separados, solo se agota su compartimento y las demás llamadas siguen funcionando.'
    },
    {
      id: 'ventana', type: 'single',
      prompt: 'Un rate limiter de ventana fija permite 100 requests por minuto. ¿Cuántas puede hacer un cliente en unos pocos segundos?',
      options: ['Solo 100, porque el límite cuenta las requests de cualquier minuto.', 'Hasta 200: 100 al final de un minuto y 100 al principio del siguiente.', '50, porque la ventana fija reparte el límite en dos mitades.', 'Ilimitadas, mientras no pasen de 100 en el mismo segundo.'],
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
