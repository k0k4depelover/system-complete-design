SD.defineQuiz('m00', {
  title: 'Quiz: el método',
  pass: 0.7,
  questions: [
    {
      id: 'qps', type: 'single',
      prompt: 'Un servicio recibe 1 000 millones de requests al día. ¿Cuántas requests por segundo son en promedio, aproximadamente?',
      options: ['~1 200 por segundo', '~12 000 por segundo', '~120 000 por segundo', '~1 000 000 por segundo'],
      answer: 1,
      explain: '10⁹ ÷ 86 400 s ≈ 11 574/s. El atajo mental: un día tiene ~10⁵ segundos, así que 10⁹ / 10⁵ = 10⁴. Y recuerda que el pico puede ser 2 a 10 veces eso.'
    },
    {
      id: 'p99', type: 'single',
      prompt: 'Un endpoint tiene latencia promedio de 149 ms y p99 de 5 s. ¿Qué afirmación es correcta?',
      options: [
        'El promedio es lo que importa: con 149 ms la gran mayoría tiene buena experiencia y el p99 afecta a muy pocos.',
        'Al menos 1 de cada 100 requests tarda 5 s o más, y en una página con muchas llamadas casi todos lo notan.',
        'El p99 es ruido de unas pocas requests anómalas; conviene descartarlo y fijar el SLO sobre el p50.',
        'El p99 no puede ser 30 veces el promedio con 100 muestras, así que la medición está mal.'
      ],
      answer: 1,
      explain: 'Con 98 requests de 50 ms y 2 de 5 s, el promedio es 149 ms y el p99 es 5 s. El promedio esconde la cola, y con fan-out la cola se vuelve la experiencia normal: si una página hace 100 llamadas, 1 − 0.99¹⁰⁰ ≈ 63 % de las cargas incluye al menos una lenta.'
    },
    {
      id: 'budget', type: 'single',
      prompt: 'Tu SLO de disponibilidad es 99.9 % en una ventana de 30 días. ¿Cuánto error budget tienes, medido en tiempo?',
      options: ['4.32 minutos', '43.2 minutos', '7.2 horas', '8.76 horas'],
      answer: 1,
      explain: '30 días = 43 200 minutos, y el 0.1 % de eso son 43.2 minutos. 8.76 horas es el presupuesto de todo un año con 99.9 %, y 4.32 minutos corresponde a 99.99 % mensual.'
    },
    {
      id: 'serie', type: 'single',
      prompt: 'Una request atraviesa 4 dependencias en serie, cada una con 99.9 % de disponibilidad y fallas independientes. ¿Cuál es la disponibilidad total?',
      options: ['99.9 %', '≈ 99.6 %', '99.99 %', '≈ 96 %'],
      answer: 1,
      explain: '0.999⁴ ≈ 0.996. En serie las disponibilidades se multiplican, así que la cadena siempre es peor que su eslabón más débil. Por eso cada dependencia síncrona nueva cuesta confiabilidad.'
    },
    {
      id: 'little', type: 'single',
      prompt: 'Llegan 500 requests por segundo y cada una tarda en promedio 200 ms. ¿Cuántas hay en vuelo al mismo tiempo, en promedio?',
      options: ['2.5', '100', '500', '2 500'],
      answer: 1,
      explain: 'Ley de Little: L = λ × W = 500/s × 0.2 s = 100. Si la base de datos se pone lenta y W sube a 2 s, pasas a 1 000 requests en vuelo con el mismo tráfico, y ahí se agotan los pools de conexiones.'
    },
    {
      id: 'nf', type: 'multi',
      prompt: 'En un chat con LLM, ¿cuáles de estos son requisitos no funcionales?',
      options: [
        'El p95 del tiempo al primer token es menor a 1.5 s.',
        'El usuario puede regenerar una respuesta y elegir cuál de las versiones queda en el historial.',
        'Un mensaje confirmado sobrevive a la caída de una zona completa.',
        'El costo de GPU por millón de tokens no supera un tope.',
        'El usuario puede exportar todas sus conversaciones en JSON desde la configuración de la cuenta.'
      ],
      answer: [0, 2, 3],
      explain: 'Latencia, durabilidad y costo describen qué tan bien funciona el sistema: son no funcionales, y cada uno trae un número. Regenerar y exportar son funcionalidades (qué hace).'
    },
    {
      id: 'orden', type: 'order',
      prompt: 'Ordena los pasos del método tal como se aplican en un diseño:',
      items: ['Requisitos funcionales y no funcionales', 'Estimaciones de tráfico, datos y costo', 'Contratos de la API', 'Modelo de datos', 'Arquitectura y flujos', 'Modos de fallo y mitigaciones'],
      explain: 'Los números van antes de la arquitectura porque la condicionan, y los contratos antes que los datos porque las consultas que necesitas definen el esquema. Los fallos se analizan sobre una arquitectura concreta, y a menudo obligan a volver a cambiarla.'
    },
    {
      id: 'failopen', type: 'single',
      prompt: 'El Redis que guarda los contadores del rate limiter se cae. Tu gateway está configurado en <b>fail-open</b>. ¿Qué pasa?',
      options: [
        'Todas las requests reciben 429 hasta que Redis vuelve, para proteger las GPUs mientras no hay contadores.',
        'Las requests pasan sin límite: el producto sigue arriba, pero expuesto a abuso y a saturar las GPUs.',
        'El gateway pasa solo a fail-closed tras un minuto sin Redis y desde ahí rechaza con 503.',
        'Cada instancia del gateway cuenta en su memoria local y se mantiene el mismo límite global exacto.'
      ],
      answer: 1,
      explain: 'Fail-open prioriza la disponibilidad: sin contadores, deja pasar todo. Es razonable si hay otras defensas aguas abajo (colas con límite, admission control en las GPUs). Fail-closed protegería la capacidad a costa de tirar el producto.'
    },
    {
      id: 'correlacion', type: 'single',
      prompt: 'Con dos réplicas independientes de 99.9 % la fórmula da 99.9999 %. ¿Por qué en la práctica casi nunca se logra?',
      options: [
        'Porque la fórmula correcta suma las indisponibilidades en lugar de multiplicarlas, y eso da 99.8 %.',
        'Porque las fallas suelen estar correlacionadas: un mismo deploy o región tira las dos.',
        'Porque mantener dos réplicas sincronizadas duplica la latencia, y los timeouts cuentan como caídas.',
        'Porque el total queda topado por la réplica más débil, y ninguna pasa de 99.9 %.'
      ],
      answer: 1,
      explain: '1 − (1 − a)ⁿ supone independencia. Un deploy con un bug llega a todas las réplicas; una región caída se lleva todo lo que vive en ella. Por eso se despliega de forma escalonada (canary) y se reparte entre zonas y regiones.'
    }
  ]
});
