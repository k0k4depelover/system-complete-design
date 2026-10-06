SD.defineQuiz('m18', {
  title: 'Quiz: rate limiting y cuotas por tokens',
  pass: 0.7,
  questions: [
    {
      id: 'dimensiones', type: 'multi',
      prompt: '¿Por qué una API de LLM limita varias dimensiones además de las requests por minuto?',
      options: [
        'Porque dos requests pueden diferir mil veces en tokens, y el trabajo de la GPU crece con los tokens.',
        'Porque la entrada y la salida gastan recursos distintos: el prefill es cómputo; el decode, tiempo y memoria.',
        'Porque un stream largo ocupa KV cache mientras dura, aunque genere pocos tokens.',
        'Porque HTTP/2 multiplexa streams y el gateway no puede contar requests sueltas, solo conexiones abiertas.',
        'Porque el gasto se acumula durante el mes y necesita su propio tope.'
      ],
      answer: [0, 1, 2, 4],
      explain: 'Requests, tokens de entrada y de salida, concurrencia y gasto miden cosas distintas, y un cliente puede agotar cualquiera de ellas sin tocar las otras. Repasa 18.1.'
    },
    {
      id: 'max-tokens', type: 'single',
      prompt: 'Un cliente de OpenAI manda requests de 2 000 tokens de entrada con <code>max_tokens: 16384</code>, aunque sus respuestas nunca pasan de 500 tokens. Recibe 429 con su uso real muy por debajo del límite. ¿Por qué?',
      options: [
        'Porque los tokens de salida cuentan el doble contra el límite, igual que en la factura.',
        'Porque al entrar cada request reserva unos 18 000 tokens, aunque use 2 500.',
        'Porque la entrada se cuenta dos veces: al admitirla y otra vez al reconciliar.',
        'Porque el límite se aplica por día y ya consumió el de hoy en la mañana.'
      ],
      answer: 1,
      explain: 'Es la estrategia pesimista: cobrar el peor caso al entrar. Por eso OpenAI aconseja fijar max_tokens cerca del largo esperado. Repasa 18.2 y el simulador.'
    },
    {
      id: 'vencer', type: 'single',
      prompt: 'En el esquema de reservar y reconciliar, el gateway que atendía una request muere antes de reconciliar. ¿Qué evita que esa reserva quede tomada para siempre?',
      options: [
        'Nada automático: un operador la borra a mano cuando la alerta de saldo avisa.',
        'La reserva tiene un vencimiento, como un lease, y desaparece sola sin su dueño.',
        'El cliente la devuelve cuando reintenta, porque manda la misma idempotency key.',
        'Redis detecta que el gateway cerró su conexión y devuelve los tokens de sus reservas.'
      ],
      answer: 1,
      explain: 'Es el mismo principio de los leases del M06: un permiso con fecha de vencimiento. En el diseño de 18.3, los tokens de una reserva vencida no vuelven: el error queda a favor de la flota.'
    },
    {
      id: 'invariante', type: 'single',
      prompt: 'Dos gateways leen el mismo saldo de 5 000 tokens, cada uno desde su réplica, y cada uno admite una request de 4 000. Ninguno se equivocó según lo que veía. ¿Qué muestra esto?',
      options: [
        'Que hay un bug en los gateways: tendrían que haber leído el saldo del primario.',
        'Que "el saldo no queda negativo" no se mantiene si cada réplica decide sola.',
        'Que hace falta un reloj más preciso para ordenar las dos admisiones.',
        'Que hay que usar un token bucket en lugar de una ventana deslizante, que no ve el saldo.'
      ],
      answer: 1,
      explain: 'Las dos operaciones son válidas por separado y juntas rompen el invariante: el saldo combinado queda en −3 000. Es el resultado de Bailis y otros sobre coordinación. Repasa 18.8.'
    },
    {
      id: 'escrow', type: 'single',
      prompt: 'Con escrow, un coordinador presta a cada gateway un pedazo del límite y cada gateway lo gasta sin preguntar. ¿Qué se gana y qué se paga?',
      options: [
        'Se gana latencia, y se paga con un exceso sobre el límite del tamaño de cada préstamo.',
        'Se gana no coordinar por request sin exceso; se paga con cuota varada.',
        'No se gana nada: cada gasto sigue pasando por el coordinador, igual que un contador central.',
        'Se gana consistencia fuerte entre regiones, sin ningún costo de latencia.'
      ],
      answer: 1,
      explain: 'Mientras nadie gaste más que lo prestado, la suma no pasa del límite. El costo es la cuota prestada que no se usa, que crece con la cantidad de gateways y el tamaño del préstamo. Repasa la calculadora de 18.8.'
    },
    {
      id: 'particion', type: 'single',
      prompt: 'Un gateway pierde contacto con el Redis de cuotas. Con escrow, ¿qué puede hacer sin arriesgar exceso?',
      options: [
        'Nada: tiene que rechazar todo, porque no puede saber si el préstamo sigue valiendo.',
        'Seguir gastando el préstamo que ya tiene, hasta que venza, sin preguntar a Redis.',
        'Admitir todo sin límite hasta que Redis vuelva y reconciliar el exceso después.',
        'Pedirle a otro gateway que le preste parte de su saldo mientras Redis no responde.'
      ],
      answer: 1,
      explain: 'CAP obliga a elegir cuando una operación necesita el estado global. El escrow logra que, dentro de lo prestado, no lo necesite. Después del vencimiento vuelve la decisión: nada, todo o una capacidad "segura", como en Doorman. Repasa 18.8, CAP y PACELC.'
    },
    {
      id: 'redis', type: 'multi',
      prompt: '¿Qué es cierto sobre usar Redis Cluster para las cuotas?',
      options: [
        'Un script con varias claves exige que estén en el mismo slot; {org:42} lo fuerza.',
        'Si el primario muere, un descuento confirmado puede perderse y el saldo retrocede.',
        'El comando WAIT vuelve a Redis fuertemente consistente, porque espera a que las réplicas confirmen.',
        'Un cliente enorme bajo un mismo hash tag puede calentar un shard.',
        'Leer la hora con TIME dentro del script evita depender de los relojes de los gateways.'
      ],
      answer: [0, 1, 3, 4],
      explain: 'La documentación de Redis aclara que WAIT mejora la seguridad de los datos pero no vuelve fuertemente consistente al almacén. Para un limitador, el exceso acotado es aceptable; para dinero no, y por eso la factura sale del metering. Repasa 18.8.'
    },
    {
      id: 'codigos', type: 'single',
      prompt: 'Un cliente está dentro de su cuota, pero la flota está saturada y la request no va a llegar a tiempo. ¿Qué le responde el admission control?',
      options: [
        '429 con Retry-After, para que el cliente frene igual que con su cuota.',
        '503 (o 529) con Retry-After: falta capacidad, no es culpa del cliente.',
        '400, porque la request es demasiado grande para la capacidad que queda.',
        'La acepta y la deja en la cola, porque el cliente pagó y está dentro de su cuota.'
      ],
      answer: 1,
      explain: 'Un 429 le pide al cliente que frene; un 503 dice que el que no da abasto es el proveedor. Aceptar y dejar vencer en la cola ocupa lugar para nada. Repasa 18.7.'
    },
    {
      id: 'justo', type: 'single',
      prompt: 'Todos los clientes están dentro de su cuota, pero las cuotas suman el triple de la flota y hoy coinciden los picos. ¿Qué protege al cliente pro de un vecino ruidoso?',
      options: [
        'Bajar las cuotas de todos hasta que sumen lo mismo que la flota.',
        'Una cola por cliente y un reparto por peso de cada lugar libre del batch.',
        'Una cola única más grande, para que nadie reciba 503 durante el pico.',
        'Una prioridad estricta: el pro siempre entra primero, aunque los demás nunca avancen.'
      ],
      answer: 1,
      explain: 'Con sobresuscripción, las cuotas no alcanzan cuando los picos coinciden. El fair queuing reparte la flota según pesos y deja la espera en quien pide más de lo que le toca. Repasa 18.6 y el simulador.'
    }
  ]
});
