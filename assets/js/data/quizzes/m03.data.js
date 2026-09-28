SD.defineQuiz('m03', {
  title: 'Quiz: balanceadores, gateways y proxies',
  pass: 0.7,
  questions: [
    {
      id: 'slow', type: 'single',
      prompt: 'Uno de cinco servidores sufre pausas largas de GC y atiende 6 veces más lento. ¿Con qué algoritmo el p99 del sistema se mantiene razonable?',
      options: ['Round robin', 'Aleatorio', 'Power of two choices', 'Hash por usuario'],
      answer: 2,
      explain: 'Round robin, aleatorio y hash le siguen mandando un 20 % del tráfico al lento, cuya cola crece sin límite. Los algoritmos que miran el trabajo en curso (menos conexiones, P2C) lo esquivan solos: le llega mucho menos tráfico mientras esté lento.'
    },
    {
      id: 'grpcl4', type: 'single',
      prompt: 'Tus clientes gRPC abren una conexión HTTP/2 larga y la reutilizan. Pones un balanceador L4 delante de 10 instancias. ¿Qué pasa?',
      options: [
        'Las requests se reparten parejo entre las 10.',
        'Cada conexión queda pegada a una instancia, así que todas las requests de un cliente van al mismo backend y la carga queda desbalanceada.',
        'El balanceador L4 rechaza HTTP/2.',
        'gRPC abre una conexión nueva por request.'
      ],
      answer: 1,
      explain: 'L4 balancea conexiones, no requests. Con conexiones largas y multiplexadas, necesitas un balanceador L7 que entienda HTTP/2 y reparta cada request, o balanceo del lado del cliente.'
    },
    {
      id: 'readiness', type: 'single',
      prompt: 'Una instancia nueva arranca y el balanceador le manda tráfico enseguida, aunque todavía está cargando cachés y compilando código en caliente. ¿Qué la protege?',
      options: [
        'Un liveness check más frecuente.',
        'Un readiness check que solo responda OK cuando esté lista, y un slow start que le suba el tráfico de a poco.',
        'Sticky sessions.',
        'Un TTL de DNS más largo.'
      ],
      answer: 1,
      explain: 'Liveness dice "reiníciame si fallo"; readiness dice "no me mandes tráfico todavía". Y el slow start evita que una instancia recién llegada, con menos conexiones que el resto, se lleve de golpe todo el tráfico de un algoritmo de menos conexiones.'
    },
    {
      id: 'retries', type: 'single',
      prompt: 'El gateway, el servicio A y el servicio B reintentan 3 veces cada uno ante un error del servicio C. Si C está caído, ¿cuántas requests recibe C por cada request del usuario?',
      options: ['3', '9', 'Hasta 27', '1'],
      answer: 2,
      explain: 'Los reintentos se multiplican en cada capa: 3 × 3 × 3 = 27. Justo cuando C necesita alivio, recibe 27 veces más carga. Se reintenta en una sola capa (idealmente la más cercana al cliente), con presupuesto de reintentos y backoff (M08).'
    },
    {
      id: 'gateway', type: 'multi',
      prompt: '¿Qué responsabilidades corresponden a un API gateway?',
      options: [
        'Validar tokens y API keys.',
        'Aplicar rate limiting por cliente.',
        'Calcular el precio de un pedido con descuentos.',
        'Enrutar por path y versión.',
        'Registrar métricas y request IDs.'
      ],
      answer: [0, 1, 3, 4],
      explain: 'El gateway resuelve lo transversal, igual para todas las APIs. La lógica de negocio (precios, descuentos) vive en los servicios: si entra al gateway, cada cambio de negocio exige desplegar la pieza más crítica del sistema.'
    },
    {
      id: 'sticky', type: 'single',
      prompt: 'Tu app guarda la sesión del usuario en la memoria del servidor y usas sticky sessions. ¿Qué problema aparece cuando una instancia se cae?',
      options: [
        'Ninguno: el balanceador copia la memoria a otra instancia.',
        'Todos los usuarios de esa instancia pierden su sesión, y la carga no se reparte bien porque cada usuario queda atado a un servidor.',
        'Las sesiones se duplican.',
        'El DNS deja de resolver.'
      ],
      answer: 1,
      explain: 'El estado en memoria convierte a cada instancia en irremplazable. La solución es sacar la sesión a un almacén compartido (Redis) o a un token firmado, y dejar las instancias stateless.'
    },
    {
      id: 'hash', type: 'single',
      prompt: '¿Cuándo tiene sentido balancear con hash consistente por una clave (por ejemplo, el id del usuario o del documento)?',
      options: [
        'Siempre: es el algoritmo más justo.',
        'Cuando cada backend mantiene una caché o un estado por clave y quieres que la misma clave caiga siempre en el mismo lugar, con pocos movimientos al agregar o quitar nodos.',
        'Cuando un servidor está lento.',
        'Nunca en producción.'
      ],
      answer: 1,
      explain: 'Es lo que se usa para cachés distribuidas y servidores con estado por documento (Google Docs, M31). El costo: las claves populares desbalancean la carga, y no esquiva servidores lentos.'
    },
    {
      id: 'mesh', type: 'single',
      prompt: '¿Cuál es el costo principal de introducir un service mesh con sidecars?',
      options: [
        'Obliga a reescribir todos los servicios en otro lenguaje.',
        'Cada llamada entre servicios atraviesa dos proxies más (latencia y CPU extra) y se suma un plano de control complejo que operar.',
        'Impide usar TLS.',
        'No tiene costo.'
      ],
      answer: 1,
      explain: 'A cambio de mTLS, reintentos, métricas y políticas uniformes sin tocar código, pagas un salto extra en cada extremo, más memoria por instancia y una pieza de infraestructura crítica. Vale la pena con muchos servicios y equipos; con cinco servicios, rara vez.'
    }
  ]
});
