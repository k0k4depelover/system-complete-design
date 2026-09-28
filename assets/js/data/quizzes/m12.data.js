SD.defineQuiz('m12', {
  title: 'Quiz: un LLM visto por un ingeniero de sistemas',
  pass: 0.7,
  questions: [
    {
      id: 'fases', type: 'single',
      prompt: '¿Qué fase de una request está limitada por el cómputo de la GPU y cuál por el ancho de banda de su memoria?',
      options: [
        'El prefill, por memoria; el decode, por cómputo.',
        'El prefill, por cómputo, porque procesa todo el prompt a la vez; el decode, por memoria, porque lee todos los pesos por cada token.',
        'Las dos, por cómputo.',
        'Las dos, por la red entre GPUs.'
      ],
      answer: 1,
      explain: 'El prefill hace multiplicaciones de matrices grandes con muchos tokens a la vez. El decode produce un token por request y por paso, y para eso relee los pesos y el KV cache: unas 2 operaciones por byte, cuando una H100 podría hacer cientos.'
    },
    {
      id: 'kv', type: 'single',
      prompt: 'Un modelo tiene 32 capas, 8 KV heads y head_dim de 128, con el KV cache en BF16. ¿Cuánto ocupa el cache de una conversación de 4096 tokens?',
      options: ['Unos 134 MB', 'Unos 537 MB', 'Unos 2.1 GB', 'Unos 17 GB'],
      answer: 1,
      fixed: true,
      explain: '2 × 32 × 8 × 128 × 2 bytes = 131 072 bytes por token; por 4096 tokens, unos 537 MB. Es el caso de Llama 3.1 8B.'
    },
    {
      id: 'precio', type: 'single',
      prompt: '¿Por qué las APIs cobran bastante más por un token de salida que por uno de entrada?',
      options: [
        'Porque la salida pasa por la moderación.',
        'Porque cada token de salida necesita su propio paso de decode, limitado por memoria, mientras el prefill procesa miles de tokens de entrada en una pasada.',
        'Porque la salida se guarda en la base de datos.',
        'Porque los tokens de salida son más largos.'
      ],
      answer: 1,
      explain: 'Una GPU produce muchos más tokens de entrada por segundo (prefill, que aprovecha el cómputo) que de salida (decode, que espera a la memoria). El precio refleja el tiempo de GPU de cada uno.'
    },
    {
      id: 'ttft', type: 'multi',
      prompt: '¿Qué hace subir el TTFT de una request?',
      options: [
        'Un prompt más largo.',
        'Más requests esperando en la cola del servidor.',
        'Una respuesta más larga.',
        'Un modelo más grande en el mismo hardware.',
        'Un TPOT más alto.'
      ],
      answer: [0, 1, 3],
      explain: 'El TTFT es la espera en cola más el prefill, que crece con el prompt y con el tamaño del modelo. El largo de la respuesta y el TPOT afectan cuándo termina, no cuándo empieza.'
    },
    {
      id: 'batch', type: 'single',
      prompt: 'En el mismo despliegue, pasas de 8 a 64 usuarios por batch. ¿Qué pasa, típicamente?',
      options: [
        'Los tokens por segundo totales suben mucho y los de cada usuario bajan.',
        'Todo se vuelve 8 veces más lento.',
        'Nada cambia.',
        'Sube la velocidad de cada usuario.'
      ],
      answer: 0,
      explain: 'Los pesos se leen una vez por paso para todos, así que el total crece casi en proporción. Pero cada usuario suma su KV cache a lo que hay que leer en cada paso, y el paso se alarga. En el ejemplo del módulo: de 1322 a 5551 tokens por segundo en total, y de 165 a 87 por usuario.'
    },
    {
      id: 'gqa', type: 'single',
      prompt: 'Llama 3.1 70B tiene 64 cabezas de atención y 8 KV heads. Comparado con el mismo modelo sin GQA (64 KV heads), su KV cache ocupa…',
      options: ['Lo mismo.', 'La mitad.', '8 veces menos.', '64 veces menos.'],
      answer: 2,
      fixed: true,
      explain: 'El cache es proporcional a la cantidad de KV heads: 64 ÷ 8 = 8 veces menos. Por eso GPT-3, sin GQA, necesita 4.7 MB por token y Llama 3.1 70B, 328 kB.'
    },
    {
      id: 'determinismo', type: 'single',
      prompt: 'Con temperatura 0, ¿la respuesta es siempre idéntica para el mismo prompt?',
      options: [
        'Sí, siempre.',
        'No necesariamente: puede cambiar según con qué otras requests compartió el batch, porque cambia el orden de las sumas en punto flotante.',
        'Solo si el prompt es corto.',
        'No, porque con temperatura 0 se elige al azar.'
      ],
      answer: 1,
      explain: 'Temperatura 0 elige siempre el token más probable, pero los logits pueden variar en los últimos decimales según el batch, y un empate cercano se resuelve distinto. Si necesitas reproducibilidad exacta, el motor tiene que diseñarse para eso.'
    },
    {
      id: 'total', type: 'single',
      prompt: 'Con TTFT de 400 ms y TPOT de 25 ms, ¿cuánto tarda en completarse una respuesta de 500 tokens?',
      options: ['0.4 s', 'Unos 4.6 s', 'Unos 12.9 s', 'Unos 25 s'],
      answer: 2,
      fixed: true,
      explain: '0.4 + 0.025 × 499 ≈ 12.9 s. Con streaming, el usuario empieza a leer a los 0.4 s y lee más lento de lo que llegan los tokens.'
    },
    {
      id: 'paso', type: 'single',
      prompt: 'Un 70B con pesos en FP8 ocupa 70 GB y se sirve en una sola H100, con 3.35 TB/s de ancho de banda. Con un único usuario, ¿cuánto dura como mínimo cada paso de decode?',
      options: ['Unos 2 ms', 'Unos 21 ms', 'Unos 70 ms', 'Alrededor de 1 s'],
      answer: 1,
      fixed: true,
      explain: 'Cada paso lee todos los pesos: 70 GB ÷ 3.35 TB/s ≈ 21 ms, o sea, como mucho unos 48 tokens por segundo, por más cómputo que tenga la GPU.'
    }
  ]
});
