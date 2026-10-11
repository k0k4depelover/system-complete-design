/* Ejercicio guiado del M12.1 (prefill y decode a fondo). Formato en core/exercise.js. */

SD.defineExercise('m121-diagnostico', {
  title: 'diagnosticar una réplica lenta',
  scenario: '<p>Un equipo sirve Llama 3.1 70B en FP8 sobre réplicas de 4 H100, con continuous batching y unos 64 usuarios por réplica. El SLO dice TTFT p95 menor que 2 s y TPOT p95 menor que 50 ms. Esta semana se sumó un cliente que manda prompts de 30&#8239;000 tokens (documentos enteros), y desde entonces llegan tres quejas: el TTFT de ese cliente está en 2.5 s, los demás usuarios ven trabas de más de 1.5 s en medio de sus respuestas, y en las conversaciones largas el texto sale cada vez más lento.</p><p>Usa los números del módulo para separar las causas y decidir qué hacer con cada una.</p>',
  steps: [
    {
      id: 'ttft', type: 'single',
      prompt: 'El TTFT del cliente nuevo es de 2.5 s con la cola casi vacía. ¿De dónde sale?',
      options: [
        'De la red: un prompt de 30&#8239;000 tokens tarda segundos en subir al servidor.',
        'Del prefill: unos 1.7 s de cómputo, con la atención cerca de un cuarto del total.',
        'Del tokenizer, que procesa el texto en la CPU de a un token por vez.',
        'Del decode del primer token, que tiene que leer 10 GB de KV cache recién escrito.'
      ],
      answer: 1,
      explain: 'Con el modelo de 12.1.5, 32&#8239;000 tokens son 1.81 s de prefill, y la atención ya es el 23&#8239;% porque crece con el cuadrado. Subir 120 kB de texto o tokenizarlo son milisegundos. El resto hasta 2.5 s son los pasos de decode de los demás que comparten la GPU.'
    },
    {
      id: 'trabas', type: 'single',
      prompt: 'Los demás usuarios ven trabas de más de 1.5 s en medio de sus respuestas. ¿Qué las causa?',
      options: [
        'El KV cache del cliente nuevo desaloja los de los demás, que se recalculan desde cero.',
        'El prefill de 30&#8239;000 tokens entra entero en un paso, y nadie recibe tokens hasta que termina.',
        'El autoscaler apaga réplicas cuando ve la GPU llena de cómputo durante el prefill.',
        'La red entre las 4 GPUs se satura con los all-reduce de los prompts largos.'
      ],
      answer: 1,
      explain: 'Sin chunked prefill, el paso que incluye el prefill dura lo mismo que el prefill, y los 64 usuarios reciben su token al final: es el hueco de 96 ms de 12.1.8, ahora de 1.7 s. Los all-reduce mueven poco, y el desalojo del cache se ve como preempciones, no como trabas sincronizadas.'
    },
    {
      id: 'chunk', type: 'single',
      prompt: 'Activan chunked prefill con trozos de 512 tokens. ¿Qué esperas ver?',
      options: [
        'Las trabas bajan a pasos de 31 a 38 ms, y el TTFT del cliente nuevo sube.',
        'Las trabas desaparecen y el TTFT del cliente nuevo baja, porque los trozos son más eficientes.',
        'Nada cambia: el prefill hace los mismos FLOPs, troceado o entero.',
        'Las trabas bajan, pero el KV cache del prompt ocupa el doble por guardar cada trozo.'
      ],
      answer: 0,
      explain: 'Cada paso mezcla un trozo y los 64 decodes: 31 ms el primero y 38 ms el último, que atiende a casi todo el prompt; todos por debajo del SLO de 50 ms. El prefill se reparte en 59 pasos, y cada uno carga además el decode y la lectura de los 64 caches, así que el TTFT sube de 1.7 a casi 2 s, al borde del SLO. El KV escrito es el mismo. Si eso rompe el SLO de TTFT, la siguiente perilla es separar prefill y decode (12.1.8).'
    },
    {
      id: 'lento', type: 'single',
      prompt: 'En las conversaciones largas el texto sale cada vez más lento, aun de noche, con poco tráfico. ¿Por qué?',
      options: [
        'Porque el muestreo tarda más cuando el vocabulario usado en la conversación crece.',
        'Porque RoPE pierde precisión en posiciones altas y el modelo duda más entre tokens.',
        'Porque cada paso lee el KV de todo el contexto, y ese contexto crece con cada turno.',
        'Porque el scheduler baja la prioridad de las conversaciones que ya consumieron más tokens.'
      ],
      answer: 2,
      explain: 'El paso de decode lee los pesos y además 328 kB por token de contexto, por usuario. Con 30&#8239;000 tokens son 9.8 GB por usuario y por paso, más que los pesos del MLP. El muestreo no depende de la conversación. Si crece con el contexto y no con el tráfico, es el KV (12.1.6).'
    },
    {
      id: 'medir', type: 'multi',
      prompt: 'Para que el próximo incidente se diagnostique solo, ¿qué conviene medir? Elige todas las que sirven.',
      options: [
        'Spans separados de cola, prefill y decode en cada request.',
        'El TPOT p95 junto con el largo de los prompts que entraron en cada paso.',
        'La utilización de GPU de nvidia-smi como única señal de saturación.',
        'El TPOT por usuario agrupado por largo de contexto.'
      ],
      answer: [0, 1, 3],
      explain: 'La cola contra el prefill separa capacidad de largo de prompt; el TPOT junto con los prefills del paso muestra las trabas; el TPOT por contexto muestra el costo del KV. La utilización de nvidia-smi marca casi lo mismo con un usuario que con 64, y no separa ninguna de las tres causas.'
    }
  ],
  solution: '<ul><li><b>TTFT del cliente nuevo:</b> es el prefill de 30&#8239;000 tokens, 1.7 s de cómputo, con la atención creciendo con el cuadrado. Se ataca con prefix caching si los documentos se repiten, recortando el contexto o con un grupo de prefill dedicado.</li><li><b>Trabas de los demás:</b> el prefill entero en un paso. Chunked prefill con trozos de 512 tokens las baja a pasos de 31 a 38 ms; si el TTFT del cliente nuevo se pasa del SLO, desagregación (M15.6).</li><li><b>Lentitud en conversaciones largas:</b> el KV que se lee en cada paso crece con el contexto. KV en FP8, menos usuarios por réplica para contextos largos o una réplica aparte para ellos.</li><li><b>Medición:</b> spans de cola, prefill y decode; TPOT junto con los prefills de cada paso; TPOT agrupado por largo de contexto.</li></ul>'
});
