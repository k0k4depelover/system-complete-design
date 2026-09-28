SD.defineQuiz('m04', {
  title: 'Quiz: caché',
  pass: 0.7,
  questions: [
    {
      id: 'hit', type: 'single',
      prompt: 'Tu base recibe 1 000 lecturas/s con una tasa de acierto de caché del 99 %. Un cambio de código baja el acierto a 95 %. ¿Cuántas lecturas por segundo llegan ahora a la base?',
      options: ['1 040', '1 400', '5 000', '95 000'],
      answer: 2,
      explain: 'Con 99 % de acierto, el 1 % del tráfico total llega a la base: el total es 100 000/s. Con 95 %, llega el 5 %: 5 000/s. Un cambio "pequeño" en la tasa de acierto multiplicó por 5 la carga de la base.'
    },
    {
      id: 'patron', type: 'single',
      prompt: 'Un contador de "me gusta" recibe miles de incrementos por segundo y puede perder unos pocos si un servidor muere. ¿Qué patrón encaja?',
      options: ['Cache-aside', 'Write-through', 'Write-behind (acumular en caché y volcar en lote)', 'Sin caché'],
      answer: 2,
      explain: 'Write-behind agrupa miles de incrementos en una escritura cada pocos segundos. El costo es la posible pérdida de lo no volcado, que aquí es aceptable. Para saldos de dinero, nunca.'
    },
    {
      id: 'race', type: 'single',
      prompt: 'Un lector tiene un miss, lee el precio viejo de la base y se demora. Mientras tanto, un escritor actualiza la base y borra la caché. Después el lector guarda en la caché lo que leyó. ¿Qué queda?',
      options: [
        'El precio nuevo, porque el escritor borró la caché.',
        'El precio viejo, hasta que venza el TTL.',
        'Nada: Redis rechaza el SET.',
        'Un error de concurrencia.'
      ],
      answer: 1,
      explain: 'El SET del lector llegó después del DEL del escritor. Se mitiga con leases (el DEL invalida el permiso del lector para escribir, como hizo Facebook con memcache), con el número de versión en el valor, o al menos con un TTL corto que acote cuánto dura el error.'
    },
    {
      id: 'stampede', type: 'multi',
      prompt: '¿Qué técnicas previenen una estampida cuando vence una clave muy leída?',
      options: [
        'Single-flight: una sola consulta por clave dentro de cada proceso.',
        'Un lease o lock distribuido para que solo un proceso recalcule.',
        'Bajar el TTL de todas las claves a 1 segundo.',
        'Expiración anticipada probabilística.',
        'Servir el valor vencido mientras se recalcula en segundo plano.'
      ],
      answer: [0, 1, 3, 4],
      explain: 'Todas apuntan a que la clave se recalcule una vez y no miles. Bajar el TTL hace lo contrario: más vencimientos, más estampidas.'
    },
    {
      id: 'jitter', type: 'single',
      prompt: 'Al arrancar, un job llena la caché con 2 millones de claves con TTL de exactamente 1 hora. ¿Qué pasa una hora después y cómo se evita?',
      options: [
        'Nada especial.',
        'Vencen todas juntas y la base recibe la avalancha de misses. Se evita agregando jitter aleatorio al TTL.',
        'Redis se reinicia.',
        'Se duplican las claves.'
      ],
      answer: 1,
      explain: 'Claves creadas juntas con el mismo TTL vencen juntas. Un TTL de 3 600 s más un aleatorio de 0 a 600 s reparte los vencimientos en 10 minutos.'
    },
    {
      id: 'hotkey', type: 'single',
      prompt: 'Una clave de Redis recibe 300 000 lecturas por segundo y su shard está al 100 % de CPU, mientras los otros shards están ociosos. ¿Qué haces primero?',
      options: [
        'Agregar más shards.',
        'Una caché local en proceso con TTL corto para esa clave (o réplicas de la clave con sufijos).',
        'Subir la memoria del shard.',
        'Bajar el TTL.'
      ],
      answer: 1,
      explain: 'Más shards no ayudan: la clave sigue viviendo en uno solo. Hay que repartir las lecturas de esa clave: copias en la memoria de cada instancia, o varias copias en Redis (clave:1 … clave:8) y leer una al azar.'
    },
    {
      id: 'caida', type: 'single',
      prompt: 'Tu base está dimensionada para el 2 % de misses de caché. El clúster de Redis cae entero. ¿Cuál es la defensa más importante para que la base no caiga también?',
      options: [
        'Reintentar las lecturas a Redis sin límite.',
        'Limitar la concurrencia hacia la base y rechazar rápido el excedente (load shedding), con timeouts cortos y circuit breaker hacia Redis.',
        'Apagar la aplicación.',
        'Aumentar el TTL.'
      ],
      answer: 1,
      explain: 'La base no puede absorber 50 veces su carga. Mejor servir bien al 20 % del tráfico y rechazar el resto con un 503 rápido que dejar que todo se encole y la base colapse para el 100 %.'
    },
    {
      id: 'cdc', type: 'single',
      prompt: '¿Qué ventaja tiene invalidar la caché leyendo el log de cambios de la base (CDC) en lugar de hacerlo en el código que escribe?',
      options: [
        'Es más rápido que un DEL directo.',
        'Captura todos los cambios, incluidos los de otros servicios, jobs o correcciones manuales, sin depender de que cada escritor se acuerde de invalidar.',
        'Elimina la necesidad de TTL.',
        'Hace la caché fuertemente consistente.'
      ],
      answer: 1,
      explain: 'El log es la única fuente que ve todas las escrituras. Sigue siendo eventual (llega con retraso) y conviene mantener el TTL como red de seguridad por si se pierde un evento.'
    }
  ]
});
