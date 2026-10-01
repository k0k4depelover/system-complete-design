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
        'Porque un stream largo ocupa KV cache todo el tiempo que dura, aunque genere pocos tokens: hace falta un límite de concurrencia.',
        'Porque HTTP no permite contar requests.',
        'Porque el gasto se acumula durante el mes y necesita su propio tope.'
      ],
      answer: [0, 1, 2, 4],
      explain: 'Requests, tokens de entrada y de salida, concurrencia y gasto miden cosas distintas, y un cliente puede agotar cualquiera de ellas sin tocar las otras. Repasa 18.1.'
    },
    {
      id: 'max-tokens', type: 'single',
      prompt: 'Un cliente de OpenAI manda requests de 2 000 tokens de entrada con <code>max_tokens: 16384</code>, aunque sus respuestas nunca pasan de 500 tokens. Recibe 429 con su uso real muy por debajo del límite. ¿Por qué?',
      options: [
        'Porque OpenAI cobra el doble de los tokens de salida.',
        'Porque la request cuenta, al entrar, como el máximo entre max_tokens y la estimación de su tamaño: cada una reserva unos 18 000 tokens aunque use 2 500.',
        'Porque la entrada se cuenta dos veces.',
        'Porque el límite se aplica por día y no por minuto.'
      ],
      answer: 1,
      explain: 'Es la estrategia pesimista: cobrar el peor caso al entrar. Por eso OpenAI aconseja fijar max_tokens cerca del largo esperado. Repasa 18.2 y el simulador.'
    },
    {
      id: 'vencer', type: 'single',
      prompt: 'En el esquema de reservar y reconciliar, el gateway que atendía una request muere antes de reconciliar. ¿Qué evita que esa reserva quede tomada para siempre?',
      options: [
        'Nada: hay que borrarla a mano.',
        'La reserva tiene un vencimiento, como un lease: pasado ese tiempo desaparece sola, sin depender de que su dueño siga vivo.',
        'El cliente la devuelve cuando reintenta.',
        'Redis detecta que el gateway murió y devuelve los tokens.'
      ],
      answer: 1,
      explain: 'Es el mismo principio de los leases del M06: un permiso con fecha de vencimiento. En el diseño de 18.3, los tokens de una reserva vencida no vuelven: el error queda a favor de la flota.'
    },
    {
      id: 'invariante', type: 'single',
      prompt: 'Dos gateways leen el mismo saldo de 5 000 tokens, cada uno desde su réplica, y cada uno admite una request de 4 000. Ninguno se equivocó según lo que veía. ¿Qué muestra esto?',
      options: [
        'Que hay un bug en el código de los gateways.',
        'Que "el saldo no puede quedar negativo" no es un invariante confluente: no se puede mantener si cada réplica decide sola. Un límite global exige coordinar, tolerar un exceso acotado o repartir el saldo por adelantado.',
        'Que hace falta un reloj más preciso.',
        'Que hay que usar un token bucket en lugar de una ventana deslizante.'
      ],
      answer: 1,
      explain: 'Las dos operaciones son válidas por separado y juntas rompen el invariante: el saldo combinado queda en −3 000. Es el resultado de Bailis y otros sobre coordinación. Repasa 18.8.'
    },
    {
      id: 'escrow', type: 'single',
      prompt: 'Con escrow, un coordinador presta a cada gateway un pedazo del límite y cada gateway lo gasta sin preguntar. ¿Qué se gana y qué se paga?',
      options: [
        'Se gana latencia y se paga con exceso sobre el límite.',
        'Se gana que no hay exceso ni coordinación por request; se paga con cuota que puede quedar varada en gateways que no la usan.',
        'No se gana nada: es igual a un contador central.',
        'Se gana consistencia fuerte entre regiones sin costo.'
      ],
      answer: 1,
      explain: 'Mientras nadie gaste más que lo prestado, la suma no pasa del límite. El costo es la cuota prestada que no se usa, que crece con la cantidad de gateways y el tamaño del préstamo. Repasa la calculadora de 18.8.'
    },
    {
      id: 'particion', type: 'single',
      prompt: 'Un gateway pierde contacto con el Redis de cuotas. Con escrow, ¿qué puede hacer sin arriesgar exceso?',
      options: [
        'Nada: tiene que rechazar todo.',
        'Seguir gastando el préstamo que ya tiene hasta que venza: sigue disponible y la suma no supera el límite.',
        'Admitir todo sin límite hasta que Redis vuelva.',
        'Pedirle el saldo a otro gateway.'
      ],
      answer: 1,
      explain: 'CAP obliga a elegir cuando una operación necesita el estado global. El escrow logra que, dentro de lo prestado, no lo necesite. Después del vencimiento vuelve la decisión: nada, todo o una capacidad "segura", como en Doorman. Repasa 18.8, CAP y PACELC.'
    },
    {
      id: 'redis', type: 'multi',
      prompt: '¿Qué es cierto sobre usar Redis Cluster para las cuotas?',
      options: [
        'Un script que toca varias claves solo funciona si todas están en el mismo slot; los hash tags como {org:42} lo fuerzan.',
        'Con la replicación asincrónica, un descuento confirmado puede perderse si el primario muere: el saldo retrocede y el cliente puede gastar de más, en una cantidad acotada.',
        'El comando WAIT vuelve a Redis fuertemente consistente.',
        'Un cliente enorme con todos sus baldes bajo un mismo hash tag puede calentar un shard; se parte su balde en sub-baldes.',
        'Leer la hora con TIME dentro del script evita depender de los relojes de los gateways.'
      ],
      answer: [0, 1, 3, 4],
      explain: 'La documentación de Redis aclara que WAIT mejora la seguridad de los datos pero no vuelve fuertemente consistente al almacén. Para un limitador, el exceso acotado es aceptable; para dinero no, y por eso la factura sale del metering. Repasa 18.8.'
    },
    {
      id: 'codigos', type: 'single',
      prompt: 'Un cliente está dentro de su cuota, pero la flota está saturada y la request no va a llegar a tiempo. ¿Qué le responde el admission control?',
      options: [
        '429, para que frene.',
        '503 (o 529) con Retry-After: el problema es de capacidad, no del cliente, y le conviene reintentar después o en otra región.',
        '400, porque la request es demasiado grande.',
        'La acepta y deja que venza su timeout en la cola.'
      ],
      answer: 1,
      explain: 'Un 429 le pide al cliente que frene; un 503 dice que el que no da abasto es el proveedor. Aceptar y dejar vencer en la cola ocupa lugar para nada. Repasa 18.7.'
    },
    {
      id: 'justo', type: 'single',
      prompt: 'Todos los clientes están dentro de su cuota, pero las cuotas suman el triple de la flota y hoy coinciden los picos. ¿Qué protege al cliente pro de un vecino ruidoso?',
      options: [
        'Bajar las cuotas de todos.',
        'Una cola por cliente y un reparto por peso: cada lugar libre del batch va al que menos recibió en proporción a su peso, y lo que uno no usa lo aprovechan los demás.',
        'Una cola única más grande.',
        'Aumentar el timeout de los clientes.'
      ],
      answer: 1,
      explain: 'Con sobresuscripción, las cuotas no alcanzan cuando los picos coinciden. El fair queuing reparte la flota según pesos y deja la espera en quien pide más de lo que le toca. Repasa 18.6 y el simulador.'
    }
  ]
});
