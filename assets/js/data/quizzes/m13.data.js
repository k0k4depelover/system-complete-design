SD.defineQuiz('m13', {
  title: 'Quiz: hardware GPU',
  pass: 0.7,
  questions: [
    {
      id: 'quiebre', type: 'single',
      prompt: 'Una H100 hace 1979 TFLOPS en FP8 y lee su memoria a 3.35 TB/s. ¿Desde qué intensidad aritmética una carga deja de estar limitada por memoria?',
      options: ['Unas 30 operaciones por byte', 'Unas 590 operaciones por byte', 'Unas 5900 operaciones por byte', 'Unas 1979 operaciones por byte'],
      answer: 1,
      fixed: true,
      explain: '1979 × 10¹² ÷ 3.35 × 10¹² ≈ 590. Por debajo, la GPU termina las cuentas antes de que lleguen los datos; por encima, los datos esperan al cómputo.'
    },
    {
      id: 'h200', type: 'single',
      prompt: 'Cambias las H100 de un servicio de chat por H200. ¿Qué mejora?',
      options: [
        'Solo el prefill, por el cómputo extra que trae la H200 sobre la H100.',
        'El decode, por el 43 % más de ancho de banda, y los usuarios que caben, por la memoria.',
        'Todo por igual: la H200 es una generación nueva, con más cómputo y más memoria.',
        'Nada: tienen el mismo cómputo, y eso es lo que limita a un servicio de chat.'
      ],
      answer: 1,
      explain: 'La H200 tiene el mismo cómputo que la H100 con más y más rápida memoria. El prefill vive del cómputo; el decode, del ancho de banda y de la memoria para el KV cache.'
    },
    {
      id: 'sparsity', type: 'single',
      prompt: 'Una hoja de datos anuncia 3958 TFLOPS FP8 para la H100, con una nota al pie sobre sparsity. ¿Qué cifra usas para dimensionar un LLM?',
      options: ['3958 TFLOPS', '1979 TFLOPS', '989 TFLOPS', '7916 TFLOPS'],
      answer: 1,
      fixed: true,
      explain: 'La cifra con sparsity supone que la mitad de los pesos de cada grupo de cuatro es cero, algo que casi ningún LLM usa. La cifra densa es la mitad, y encima ninguna carga llega al pico.'
    },
    {
      id: 'tp', type: 'single',
      prompt: '¿Por qué el tensor parallelism se usa dentro de un servidor y no entre servidores?',
      options: [
        'Porque los servidores no comparten memoria y cada GPU necesita el modelo entero.',
        'Porque sincroniza las GPUs dos veces por capa, y solo NVLink aguanta ese ritmo.',
        'Porque las licencias de los modelos abiertos prohíben repartirlos entre servidores.',
        'Porque InfiniBand no puede transportar tensores, solo paquetes de red comunes.'
      ],
      answer: 1,
      explain: 'Entre servidores se usan formas de paralelismo que se comunican mucho menos, como pipeline o réplicas independientes. Los racks con NVLink de 72 GPUs amplían el dominio donde el tensor parallelism es viable.'
    },
    {
      id: 'sizing', type: 'single',
      prompt: 'Llama 3.1 70B en BF16 ocupa 141 GB y necesitas 50 GB de KV cache, con 5 GB de reserva por GPU. ¿Cuántas H100 de 80 GB como mínimo?',
      options: ['2', '3', '4', '8'],
      answer: 2,
      fixed: true,
      explain: 'Con 2 quedan 160 − 10 − 141 = 9 GB, menos que 50. El tensor parallelism reparte en potencias de 2, así que el siguiente paso es 4: 320 − 20 − 141 = 159 GB libres.'
    },
    {
      id: 'kv', type: 'single',
      prompt: '¿Por qué el decode con contextos largos sigue limitado por memoria aunque juntes cientos de usuarios en el batch?',
      options: [
        'Porque los pesos no se pueden compartir entre usuarios y cada uno lee su copia.',
        'Porque cada usuario suma su KV cache a lo que se lee en cada paso.',
        'Porque la GPU baja su frecuencia por temperatura cuando el batch es grande.',
        'Porque el prefill de los usuarios nuevos ocupa todo el cómputo disponible.'
      ],
      answer: 1,
      explain: 'Los pesos sí se comparten, pero el KV de cada usuario no. Con 64 usuarios y 4000 tokens de contexto, el 70B hace unas 58 operaciones por byte, diez veces por debajo del quiebre de la H100.'
    },
    {
      id: 'mfu', type: 'single',
      prompt: 'Un entrenamiento reporta un MFU del 40 %. ¿Qué significa?',
      options: [
        'Que usa el 40 % de la memoria de las GPUs y el resto queda libre para el batch.',
        'Que el 40 % del pico de FLOPS se dedica a cómputo útil del modelo.',
        'Que el 40 % de las GPUs del clúster está activo y el resto espera turno.',
        'Que el entrenamiento tarda un 40 % más de lo que predice el cálculo teórico.'
      ],
      answer: 1,
      explain: 'Entre un 35 y un 45 % es un MFU muy bueno para entrenamientos grandes: Llama 3 405B reportó entre 38 y 43 % en BF16.'
    },
    {
      id: 'falla', type: 'single',
      prompt: 'En una réplica que reparte el modelo en 8 GPUs con tensor parallelism, una GPU empieza a dar errores de HBM. ¿Qué pasa?',
      options: [
        'Las otras 7 siguen sirviendo con un poco menos de velocidad hasta el reemplazo.',
        'Se cae toda la réplica, porque cada capa necesita a las 8 GPUs.',
        'El modelo se reparte solo entre las 7 restantes.',
        'No pasa nada: la HBM tiene ECC y corrige los errores sin afectar la réplica.'
      ],
      answer: 1,
      explain: 'Cada GPU tiene una parte de cada capa: sin ella, ningún token puede calcularse. Por eso hacen falta varias réplicas y health checks de GPU (DCGM, errores Xid) que saquen la réplica rápido.'
    },
    {
      id: 'cifras', type: 'multi',
      prompt: '¿Qué necesitas saber de una GPU para dimensionar el decode de un LLM?',
      options: [
        'Cuánta memoria tiene.',
        'El ancho de banda de esa memoria.',
        'La frecuencia del reloj.',
        'Si tiene NVLink, y a qué velocidad.',
        'Cuántos núcleos CUDA tiene.'
      ],
      answer: [0, 1, 3],
      explain: 'La memoria decide cuánto cabe; el ancho de banda, la velocidad de cada paso; NVLink, si se puede repartir el modelo entre varias. El reloj y los núcleos importan poco para una carga limitada por memoria.'
    }
  ]
});
