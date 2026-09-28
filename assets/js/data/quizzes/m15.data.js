SD.defineQuiz('m15', {
  title: 'Quiz: motores de inferencia',
  pass: 0.7,
  questions: [
    {
      id: 'continuous', type: 'single',
      prompt: '¿Qué cambia el continuous batching respecto del static batching?',
      options: [
        'Usa GPUs más rápidas.',
        'Decide el batch en cada paso de decode: la request que termina libera su lugar y una que esperaba entra en ese mismo paso.',
        'Procesa las requests de a una.',
        'Junta requests del mismo usuario.'
      ],
      answer: 1,
      explain: 'Con static batching, cada lugar queda ocupado hasta que termina la respuesta más larga del grupo. Con largos variables, eso deja la mayor parte de la GPU esperando.'
    },
    {
      id: 'paged', type: 'single',
      prompt: 'Con PagedAttention y bloques de 16 tokens, ¿cuánta memoria del KV cache puede desperdiciar una request, como máximo?',
      options: [
        'La diferencia entre su contexto real y el contexto máximo del modelo.',
        'Lo que falta para llenar su último bloque: menos de 16 tokens.',
        'La mitad de su cache.',
        'Nada, nunca.'
      ],
      answer: 1,
      explain: 'Los bloques se piden de a uno a medida que se llenan, y no tienen que ser contiguos. Antes, reservar el contexto máximo por adelantado desperdiciaba entre el 60 y el 80 % de la memoria.'
    },
    {
      id: 'prefix', type: 'single',
      prompt: 'Todas las requests de tu producto empiezan con el mismo prompt de sistema de 3000 tokens. ¿Qué ahorra el prefix caching?',
      options: [
        'Tokens de salida.',
        'El prefill de esos 3000 tokens en cada request que cae en una réplica que ya los tiene: baja el TTFT y el cómputo.',
        'Memoria de los pesos.',
        'Ancho de banda de red con el cliente.'
      ],
      answer: 1,
      explain: 'El KV cache del prefijo se calcula una vez y se reutiliza. Por eso importa que el router mande las requests a la réplica que ya tiene el prefijo en memoria.'
    },
    {
      id: 'chunked', type: 'single',
      prompt: 'Con chunked prefill, subes el presupuesto de tokens por iteración de 2048 a 8192. ¿Qué esperas?',
      options: [
        'Mejor TTFT para los prompts largos y peor TPOT para los usuarios que están generando.',
        'Mejor TPOT para todos.',
        'Nada cambia.',
        'Menos memoria usada.'
      ],
      answer: 0,
      explain: 'Trozos más grandes terminan antes cada prefill, pero cada iteración que los incluye tarda más, y los que están en decode ven saltos más grandes entre tokens.'
    },
    {
      id: 'desagregado', type: 'single',
      prompt: '¿Cuál es el costo principal de separar prefill y decode en grupos de GPUs distintos?',
      options: [
        'Que el modelo pierde calidad.',
        'Mover el KV cache de cada request de un grupo al otro: gigabytes por request, que exigen una red muy rápida, más la complejidad de operar dos grupos.',
        'Que no se puede usar continuous batching.',
        'Que el prefill se vuelve limitado por memoria.'
      ],
      answer: 1,
      explain: '8192 tokens de un 70B son 2.7 GB de KV cache: unos 54 ms a 50 GB/s. Con prompts cortos o SLOs relajados, la desagregación no se paga.'
    },
    {
      id: 'spec', type: 'single',
      prompt: 'En speculative decoding, cada token propuesto se acepta con probabilidad 0.8 y el draft propone 4 por paso. ¿Cuántos tokens produce en promedio cada pasada del modelo grande?',
      options: ['Unos 1.8', 'Unos 3.4', 'Exactamente 4', 'Unos 5'],
      answer: 1,
      fixed: true,
      explain: '(1 − 0.8⁵) ÷ (1 − 0.8) ≈ 3.36. Nunca menos de 1: aunque rechace el primero, la pasada produce el token corregido.'
    },
    {
      id: 'spec-batch', type: 'single',
      prompt: '¿Por qué el speculative decoding rinde menos con batches grandes?',
      options: [
        'Porque el draft deja de funcionar.',
        'Porque con muchos usuarios el modelo grande ya no tiene cómputo ocioso, y cada token rechazado es trabajo perdido que frena a todos.',
        'Porque la calidad baja.',
        'Porque ocupa más KV cache.'
      ],
      answer: 1,
      explain: 'La técnica aprovecha el cómputo que sobra cuando el decode está limitado por memoria. Con el batch lleno, esa sobra desaparece.'
    },
    {
      id: 'paralelismo', type: 'single',
      prompt: 'Tienes que servir un modelo denso que no entra en un servidor de 8 GPUs y necesitas 2 servidores. ¿Cómo lo repartes?',
      options: [
        'Tensor parallelism entre las 16 GPUs.',
        'Tensor parallelism dentro de cada servidor y pipeline parallelism entre los dos: cada servidor tiene la mitad de las capas.',
        'Expert parallelism.',
        'Dos réplicas independientes.'
      ],
      answer: 1,
      explain: 'El tensor parallelism necesita NVLink y se queda en el servidor. Entre servidores se usa pipeline, que solo pasa activaciones entre tramos. Dos réplicas no sirven: el modelo no entra en ninguna.'
    },
    {
      id: 'preemption', type: 'single',
      prompt: 'Tus métricas muestran muchas preemptions por minuto en el motor. ¿Qué significa?',
      options: [
        'Que todo funciona bien.',
        'Que la memoria del KV cache se llena en mitad de las generaciones y el motor saca requests del batch para rehacerlas después: el servicio está sobrecargado o mal dimensionado.',
        'Que hay requests maliciosas.',
        'Que el prefix cache está funcionando.'
      ],
      answer: 1,
      explain: 'Cada preemption vuelve lenta a una request, que después repite su prefill o recupera su cache. Se corrige con más memoria (réplicas, KV en FP8), menos secuencias por batch o admission control antes de aceptar trabajo (M18).'
    }
  ]
});
