SD.defineQuiz('m26', {
  title: 'Quiz: entrenamiento y fine-tuning',
  pass: 0.7,
  questions: [
    {
      id: 'memoria', type: 'single',
      prompt: 'Servir un modelo de 70B en BF16 ocupa unos 141 GB. ¿Por qué entrenarlo necesita unas ocho veces más memoria?',
      options: [
        'Porque el entrenamiento usa fp32 para absolutamente todos los cálculos, y fp32 pesa el doble que BF16.',
        'Porque hay que cargar el dataset entero en la memoria de la GPU junto al modelo.',
        'Porque además de los pesos hay que guardar gradientes y los estados del optimizador.',
        'Porque se entrena con un batch enorme y cada ejemplo duplica una copia del modelo.'
      ],
      answer: 2,
      explain: 'Con Adam en precisión mixta son ~16 bytes por parámetro: peso fp16, gradiente, copia maestra fp32, momento y varianza. El optimizador, no los pesos, llena la GPU. Repasa 26.2.'
    },
    {
      id: 'dp', type: 'single',
      prompt: 'Un equipo pone un modelo de 70B en paralelismo de datos sobre 16 GPUs y no arranca: no entra en memoria. ¿Qué pasa?',
      options: [
        'El paralelismo de datos no ahorra memoria: cada GPU carga el modelo entero.',
        'Faltan GPUs: con 16 no alcanza, el paralelismo de datos pide al menos 32.',
        'El problema es la red; con InfiniBand más rápido entraría en memoria.',
        'Hay que bajar el batch: el paralelismo de datos ocupa memoria por cada ejemplo.'
      ],
      answer: 0,
      explain: 'El paralelismo de datos duplica el modelo completo en cada GPU; acelera, pero no reduce memoria. Para que entre hay que repartir los estados (ZeRO-3/FSDP) o el modelo (tensor, pipeline). Repasa 26.3.'
    },
    {
      id: 'zero', type: 'single',
      prompt: '¿Qué hace ZeRO-3 (o FSDP) que el paralelismo de datos simple no hace?',
      options: [
        'Entrena en fp8 en vez de fp16, con lo que cada parámetro ocupa la mitad.',
        'Reparte los estados entre las GPUs y junta las piezas justo antes de usarlas.',
        'Elimina el all-reduce de gradientes, así que la red deja de ser el cuello.',
        'Guarda las activaciones en disco para dejar libre la memoria de la GPU.'
      ],
      answer: 1,
      explain: 'ZeRO-3 y FSDP reparten optimizador, gradientes y pesos entre las GPUs; cada una guarda ≈ 16 B × params ÷ GPUs y hace un all-gather antes de cada capa. A cambio, más tráfico de red. Repasa 26.3.'
    },
    {
      id: 'red', type: 'single',
      prompt: 'En un entrenamiento, ¿por qué se dice que la red suele ser el cuello de botella?',
      options: [
        'Porque los datos de entrenamiento se descargan de internet durante el job.',
        'Porque el checkpoint se escribe por la red a un almacenamiento remoto.',
        'Porque cada GPU manda su respuesta a un servidor central que las ordena.',
        'Porque en cada paso las GPUs sincronizan gradientes y nadie sigue hasta terminar.'
      ],
      answer: 3,
      explain: 'El all-reduce de gradientes ocurre en cada paso y bloquea a todas hasta terminar; si la red es lenta, las GPUs caras esperan y el MFU cae. Por eso NVLink dentro del servidor e InfiniBand entre servidores. Repasa 26.5.'
    },
    {
      id: 'young', type: 'single',
      prompt: 'Un clúster empieza a fallar más seguido (el MTBF baja). Según Young y Daly, ¿qué conviene hacer con los checkpoints?',
      options: [
        'Guardarlos más seguido, porque el intervalo óptimo baja con el MTBF.',
        'Guardarlos más espaciados, para no pagar tanta escritura con tantas fallas.',
        'Dejar el intervalo igual: solo depende del tamaño del modelo, no de las fallas.',
        'Dejar de hacer checkpoints y reiniciar el job entero cuando algo se rompa.'
      ],
      answer: 0,
      explain: 'El intervalo óptimo es T ≈ √(2 · MTBF · C). Con menos MTBF, T baja: conviene guardar más seguido. Más fallas o checkpoints más baratos empujan en la misma dirección. Repasa 26.6.'
    },
    {
      id: 'chinchilla', type: 'single',
      prompt: 'La regla de Chinchilla dice que, para un presupuesto de cómputo dado, conviene entrenar con unos 20 tokens por parámetro. ¿Qué implica para un modelo de 70B?',
      options: [
        'Que necesita del orden de 1.4 billones de tokens de entrenamiento.',
        'Que basta con 70 mil millones de tokens, uno por parámetro.',
        'Que el límite son 20 tokens de contexto por request al servirlo.',
        'Que hay que repetir el dataset 20 veces para que el modelo lo memorice.'
      ],
      answer: 0,
      explain: '70 mil millones × 20 ≈ 1.4 billones de tokens. Son billones de palabras que hay que recolectar, deduplicar, filtrar y tokenizar sin que el cargador de datos frene al clúster. Repasa 26.7.'
    },
    {
      id: 'lora', type: 'single',
      prompt: '¿Qué hace LoRA para afinar un modelo mucho más barato que un fine-tuning completo?',
      options: [
        'Entrena solo las últimas capas del modelo y congela todas las anteriores.',
        'Congela el modelo y entrena dos matrices chicas de rango bajo por capa.',
        'Reduce el modelo a la mitad de capas y después lo vuelve a crecer.',
        'Comparte los gradientes entre varios clientes para no recalcularlos.'
      ],
      answer: 1,
      explain: 'LoRA no toca los pesos originales: les suma dos matrices flacas (d×r y r×d) y solo entrena esas. Son 10 000× menos parámetros entrenables y 3× menos memoria que afinar GPT-3 175B con Adam. Repasa 26.8.'
    },
    {
      id: 'lora-serv', type: 'single',
      prompt: '¿Por qué LoRA no agrega latencia cuando después se sirve el modelo?',
      options: [
        'Porque el adaptador corre en una GPU aparte, en paralelo al modelo base.',
        'Porque el adaptador es tan chico que su cómputo es despreciable.',
        'Porque las matrices del adaptador se suman a los pesos originales al terminar.',
        'Porque LoRA solo se usa durante el entrenamiento y se descarta al servir.'
      ],
      answer: 2,
      explain: 'Al terminar, A·B se suma a W y queda un solo juego de pesos; la inferencia es idéntica a la del modelo original. Y como el adaptador pesa pocos MB, se pueden servir muchos sobre una sola copia del base (multi-LoRA, M19). Repasa 26.8.'
    },
    {
      id: 'qlora', type: 'single',
      prompt: 'Un investigador tiene una sola GPU de 48 GB y quiere afinar un modelo de 65B. ¿Qué técnica se lo permite?',
      options: [
        'QLoRA: cuantiza el modelo base a 4 bits y entrena adaptadores LoRA encima.',
        'Full fine-tuning con checkpointing de activaciones para ahorrar bastante memoria durante el entrenamiento.',
        'Paralelismo de datos partiendo la GPU en varias instancias lógicas.',
        'RLHF, que entrena un modelo de recompensa pequeño en vez del grande.'
      ],
      answer: 0,
      explain: 'QLoRA congela el base en 4 bits (M14) y entrena solo los adaptadores: afina un 65B en una sola GPU de 48 GB sin perder calidad frente a 16 bits. Full fine-tuning pediría más de un terabyte. Repasa 26.8.'
    },
    {
      id: 'dpo', type: 'single',
      prompt: '¿Cuál es la diferencia principal entre RLHF y DPO para alinear un modelo con preferencias humanas?',
      options: [
        'RLHF usa datos humanos y DPO usa datos generados por otro modelo.',
        'RLHF alinea el tono y DPO solo corrige errores de formato del SFT.',
        'DPO necesita bastantes más GPUs que RLHF porque entrena dos modelos grandes a la vez.',
        'DPO se salta el modelo de recompensa y ajusta directo sobre los pares.'
      ],
      answer: 3,
      explain: 'RLHF entrena un modelo de recompensa y después optimiza con refuerzo (PPO); DPO ajusta el modelo directamente sobre pares "preferida contra rechazada", sin recompensa ni PPO. Más simple y estable. Repasa 26.9.'
    },
    {
      id: 'servil', type: 'single',
      prompt: '¿De dónde sale que un modelo se vuelva adulador (servil)?',
      options: [
        'De un bug en el código del bucle de entrenamiento que hay que parchear.',
        'De premiar en las preferencias las respuestas que le gustan a la gente.',
        'De cuantizar el modelo a 4 bits, que degrada su criterio.',
        'De un contexto demasiado largo que lo hace repetir al usuario.'
      ],
      answer: 1,
      explain: 'A la gente le gusta que le den la razón; si las preferencias premian eso, el modelo aprende a adular. No es un bug: es el objetivo mal puesto. Se cura curando los datos y midiendo el servilismo como una regresión (M22). Repasa 26.9.'
    }
  ]
});
