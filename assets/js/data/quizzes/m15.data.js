SD.defineQuiz('m15', {
  title: 'Quiz: motores de inferencia',
  pass: 0.7,
  questions: [
    {
      id: 'continuous', type: 'single',
      prompt: '¿Qué cambia el continuous batching respecto del static batching?',
      options: [
        'Usa GPUs más rápidas y deja correr el batch sin pausas entre requests.',
        'Arma el batch en cada paso: la request que termina deja su lugar a una que espera.',
        'Procesa las requests de a una, pero sin esperar a que termine la anterior.',
        'Junta en el mismo batch las requests del mismo usuario para reutilizar su KV cache entre turnos.'
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
        'Tokens de salida, porque el modelo reutiliza respuestas a prompts iguales.',
        'El prefill de esos 3000 tokens en cada réplica que ya los tiene: baja el TTFT.',
        'Memoria de los pesos, porque el prompt de sistema queda incorporado dentro del modelo cargado.',
        'Ancho de banda con el cliente, que ya no manda el prompt de sistema.'
      ],
      answer: 1,
      explain: 'El KV cache del prefijo se calcula una vez y se reutiliza. Por eso importa que el router mande las requests a la réplica que ya tiene el prefijo en memoria.'
    },
    {
      id: 'chunked', type: 'single',
      prompt: 'Con chunked prefill, subes el presupuesto de tokens por iteración de 2048 a 8192. ¿Qué esperas?',
      options: [
        'Mejor TTFT para los prompts largos y peor TPOT para los que están generando.',
        'Mejor TPOT para todos, porque cada iteración avanza más tokens.',
        'Mejor TTFT y mejor TPOT, porque la GPU queda mejor aprovechada en cada paso.',
        'Menos memoria usada, porque los chunks más grandes fragmentan menos el KV cache.'
      ],
      answer: 0,
      explain: 'Trozos más grandes terminan antes cada prefill, pero cada iteración que los incluye tarda más, y los que están en decode ven saltos más grandes entre tokens.'
    },
    {
      id: 'desagregado', type: 'single',
      prompt: '¿Cuál es el costo principal de separar prefill y decode en grupos de GPUs distintos?',
      options: [
        'Que el modelo pierde calidad al dividir sus capas entre dos grupos.',
        'Mover el KV cache de cada request de un grupo a otro, gigabytes que exigen una red rápida.',
        'Que ya no se puede usar continuous batching en el grupo de decode.',
        'Que el prefill se vuelve limitado por memoria al quedar solo en su grupo, sin batch de decode.'
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
        'Porque el draft deja de funcionar cuando hay más de un usuario en el batch.',
        'Porque el modelo grande ya no tiene cómputo ocioso y cada rechazo es trabajo perdido.',
        'Porque la calidad de las respuestas baja cuando el modelo grande verifica muchos tokens a la vez.',
        'Porque cada usuario necesita su propio modelo draft cargado en memoria.'
      ],
      answer: 1,
      explain: 'La técnica aprovecha el cómputo que sobra cuando el decode está limitado por memoria. Con el batch lleno, esa sobra desaparece.'
    },
    {
      id: 'paralelismo', type: 'single',
      prompt: 'Tienes que servir un modelo denso que no entra en un servidor de 8 GPUs y necesitas 2 servidores. ¿Cómo lo repartes?',
      options: [
        'Tensor parallelism entre las 16 GPUs, para que todas trabajen en cada capa.',
        'Tensor parallelism dentro de cada servidor y pipeline parallelism entre los dos.',
        'Expert parallelism, repartiendo las capas como si fueran expertos.',
        'Dos réplicas independientes, cada una con la mitad del tráfico.'
      ],
      answer: 1,
      explain: 'El tensor parallelism necesita NVLink y se queda en el servidor. Entre servidores se usa pipeline, que solo pasa activaciones entre tramos. Dos réplicas no sirven: el modelo no entra en ninguna.'
    },
    {
      id: 'preemption', type: 'single',
      prompt: 'Tus métricas muestran muchas preemptions por minuto en el motor. ¿Qué significa?',
      options: [
        'Que todo funciona bien: el motor reordena el batch para priorizar a los cortos.',
        'Que el KV cache se llena a mitad de generación: el servicio está sobrecargado.',
        'Que llegan requests maliciosas que el motor saca del batch por seguridad.',
        'Que el prefix cache está funcionando y libera bloques compartidos.'
      ],
      answer: 1,
      explain: 'Cada preemption vuelve lenta a una request, que después repite su prefill o recupera su cache. Se corrige con más memoria (réplicas, KV en FP8), menos secuencias por batch o admission control antes de aceptar trabajo (M18).'
    }
  ]
});
