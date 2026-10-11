SD.defineQuiz('m121', {
  title: 'Quiz: prefill y decode a fondo',
  pass: 0.7,
  questions: [
    {
      id: 'pesos', type: 'single',
      prompt: 'En Llama 3.1 70B, ¿dónde está la mayor parte de los pesos de cada bloque decoder?',
      options: [
        'En la atención, porque Q, K, V y O son cuatro matrices de 8192 de lado.',
        'En el MLP: tres matrices de 8192 por 28 672, el 82&#8239;% del bloque.',
        'En las dos RMSNorm, que tienen un peso por cada token del vocabulario.',
        'Repartida casi por igual entre la atención y el MLP, como en el paper original.'
      ],
      answer: 1,
      explain: 'Gate, up y down suman 3 × 8192 × 28 672 = 704.6 millones de pesos por bloque; Q, K, V y O, 151 millones porque K y V son de 1024 con GQA. Por eso en el decode el MLP se lleva la mayor parte del tiempo de leer pesos. Vuelve a 12.1.2.'
    },
    {
      id: 'intensidad', type: 'single',
      prompt: 'Una proyección de 8192 por 8192 con pesos en FP8 multiplica una matriz de T filas. ¿Cuál es su intensidad aritmética aproximada cuando T es chico frente a 8192?',
      options: ['T ÷ 2 FLOP por byte', '2 × T FLOP por byte', '2 FLOP por byte, sin importar T', 'T² FLOP por byte'],
      fixed: true,
      answer: 1,
      explain: 'FLOPs = 2 × T × 8192², y los bytes son casi solo los pesos, 8192² × 1 byte. La división da 2 × T: cada fila extra reusa los pesos ya leídos. Con T = 1 son 2 FLOP por byte; con 345, los 590 del quiebre de la H100. Vuelve a 12.1.3.'
    },
    {
      id: 'mascara', type: 'single',
      prompt: '¿Qué hace la máscara causal en la atención?',
      options: [
        'Pone −∞ en los puntajes de las claves posteriores a cada consulta, antes del softmax.',
        'Borra del KV cache los tokens del prompt que ya no influyen en la respuesta.',
        'Reduce a 8 las 64 cabezas de consulta para que compartan sus claves y valores.',
        'Divide los puntajes por √128 para que el softmax no se concentre en una clave.'
      ],
      answer: 0,
      explain: 'Con −∞, el softmax les da peso 0: ningún token mira a uno posterior. Por eso lo calculado para un token no cambia cuando llegan otros, y el KV cache es exacto. Compartir K y V es GQA, y dividir por √128 es la escala. Vuelve a 12.1.4.'
    },
    {
      id: 'cache-exacto', type: 'single',
      prompt: 'En el programa de NumPy de 12.1.4, la fila que sale del paso de decode con cache es igual a la última fila de recalcular todo. ¿Por qué?',
      options: [
        'Porque NumPy redondea los dos resultados a la misma precisión antes de compararlos.',
        'Porque K y V de un token no dependen de los tokens que vienen después de él.',
        'Porque el paso de decode también recalcula Q, K y V de los tokens anteriores.',
        'Porque el cache guarda la matriz de puntajes completa del prefill, no solo K y V.'
      ],
      answer: 1,
      explain: 'Con la máscara causal, cada posición solo ve lo anterior, así que su K y su V quedan fijos una vez calculados. Guardarlos no aproxima nada: solo evita repetir cuentas. El cache no guarda puntajes, y el decode no recalcula los tokens anteriores. Vuelve a 12.1.4.'
    },
    {
      id: 'flash', type: 'single',
      prompt: '¿Qué cambia FlashAttention respecto de la atención escrita de la manera directa?',
      options: [
        'Aproxima el softmax con menos cabezas, y pierde algo de calidad a cambio de velocidad.',
        'Guarda la matriz de puntajes en FP8 en la HBM, para que ocupe la mitad de memoria.',
        'Calcula por bloques en la SRAM con un softmax en línea, sin escribir la matriz de T × T.',
        'Saltea la atención en las capas donde los puntajes de un bloque anterior fueron bajos.'
      ],
      answer: 2,
      explain: 'El resultado es exacto: guarda el máximo y la suma parciales de cada consulta y reescala al ver un bloque nuevo. La memoria extra crece con T y no con T², y se ahorran las idas y vueltas de la matriz por la HBM. Vuelve a 12.1.4.'
    },
    {
      id: 'decode-atn', type: 'single',
      prompt: 'Con 64 usuarios y 4000 tokens de contexto cada uno, ¿por qué la atención pasa a ser la pieza más lenta del paso de decode?',
      options: [
        'Porque su cómputo crece con el cuadrado del contexto y llena los tensor cores.',
        'Porque cada usuario lee su propio KV cache: 84 GB por paso, más que el MLP.',
        'Porque FlashAttention no funciona en el decode y se vuelve a la versión ingenua.',
        'Porque la máscara causal obliga a procesar a los 64 usuarios de a uno por vez.'
      ],
      answer: 1,
      explain: 'Los pesos se comparten entre los 64, pero los caches no: 64 × 4000 × 328 kB ≈ 84 GB por paso, 6.3 ms, contra 4.3 ms de leer el MLP. La intensidad de la atención del decode se queda en 8 FLOP por byte con cualquier batch. Vuelve a 12.1.6 y 12.1.7.'
    },
    {
      id: 'mixto', type: 'single',
      prompt: 'Llega un prompt de 2000 tokens a una réplica con 64 usuarios en decode, sin chunked prefill. ¿Qué ven esos 64 usuarios?',
      options: [
        'Nada: el prefill corre en otras unidades de la GPU, en paralelo con el decode.',
        'Un hueco de unos 96 ms entre dos tokens, porque el paso incluye el prefill entero.',
        'Que su stream se corta y el cliente tiene que reintentar con el contexto completo.',
        'Tokens más rápidos, porque el batch más grande mejora la intensidad del paso.'
      ],
      answer: 1,
      explain: 'El paso con el prefill entero tarda 96 ms contra 11.6 ms de un paso solo de decode, y los 64 tokens salen al final. Con trozos de 512 tokens son cuatro pasos de 31 ms: saltos más chicos, y el prefill termina a los 126 ms. Vuelve a 12.1.8.'
    },
    {
      id: 'lmhead', type: 'single',
      prompt: '¿Por qué en el prefill el LM head se aplica a una sola posición?',
      options: [
        'Porque el siguiente token sale de la última posición, y los otros logits se descartarían.',
        'Porque el LM head no entra en la memoria de la GPU con más de una fila a la vez.',
        'Porque las otras posiciones ya tienen sus logits guardados en el KV cache.',
        'Porque aplicarlo a todas cambiaría el resultado de la última por la máscara causal.'
      ],
      answer: 0,
      explain: 'Aplicarlo a las 2000 posiciones costaría unos 4.2 billones de FLOPs, el 1.5&#8239;% del prefill, para tirar el resultado. El KV cache guarda K y V, no logits. Vuelve a 12.1.5.'
    },
    {
      id: 'topp', type: 'single',
      prompt: 'Las probabilidades de cuatro tokens son 0.657, 0.242, 0.089 y 0.012. ¿Cuáles quedan con top-p 0.9?',
      options: ['Solo el primero', 'Los dos primeros', 'Los tres primeros', 'Los cuatro'],
      fixed: true,
      answer: 2,
      explain: 'Top-p se queda con el grupo más chico cuya suma llega a 0.9. Los dos primeros suman 0.899, apenas menos; con el tercero, 0.988. Después se vuelven a normalizar: 0.665, 0.245 y 0.090. Vuelve a 12.1.9.'
    },
    {
      id: 'orden', type: 'order',
      prompt: 'Ordena lo que pasa dentro de la rama de atención de un bloque en un paso de decode.',
      items: [
        'RMSNorm del vector del token nuevo',
        'Proyecciones Q, K y V',
        'RoPE sobre Q y K con la posición del token',
        'Agregar K y V al cache y leer los anteriores',
        'Softmax de QKᵀ ÷ √128 y suma de los V',
        'Proyección O y suma al flujo residual'
      ],
      explain: 'La norma va antes de la rama (pre-norm), RoPE se aplica antes de guardar K, la atención usa el cache con el token nuevo incluido, y la proyección O junta las cabezas antes de sumar al flujo. Vuelve a 12.1.4 y a la lámina.'
    }
  ]
});
