SD.defineQuiz('m14', {
  title: 'Quiz: cuantización',
  pass: 0.7,
  questions: [
    {
      id: 'bf16', type: 'single',
      prompt: '¿Por qué BF16 reemplazó a FP16 para entrenar y servir LLMs?',
      options: [
        'Porque tiene más precisión que FP16.',
        'Porque conserva los 8 bits de exponente de FP32: el mismo rango, sin desbordes, a cambio de menos precisión.',
        'Porque ocupa menos memoria que FP16.',
        'Porque lo exige PyTorch.'
      ],
      answer: 1,
      explain: 'FP16 llega hasta 65 504 y las activaciones grandes lo desbordan. BF16 ocupa lo mismo (16 bits) y tiene el rango de FP32; la precisión perdida casi no importa para redes neuronales.'
    },
    {
      id: 'escala', type: 'single',
      prompt: 'Un grupo de pesos se cuantiza a INT4 (niveles de −7 a 7) y su peso más grande es 0.21, así que la escala es 0.03. ¿En qué valor queda un peso de 0.02?',
      options: ['0', '0.02', '0.03', '0.21'],
      answer: 2,
      fixed: true,
      explain: '0.02 ÷ 0.03 ≈ 0.67, que se redondea a 1; 1 × 0.03 = 0.03, un error del 50 %. Un peso de 0.014 quedaría en 0. Un solo outlier arruina la precisión de todo su grupo.'
    },
    {
      id: 'grupos', type: 'single',
      prompt: '¿Para qué sirve usar una escala por cada grupo de 128 pesos en lugar de una para toda la matriz?',
      options: [
        'Para que el modelo ocupe menos memoria.',
        'Para que un outlier solo infle la escala de su propio grupo y no la de toda la matriz.',
        'Para calcular más rápido.',
        'Para no necesitar datos de calibración.'
      ],
      answer: 1,
      explain: 'Las escalas por grupo cuestan un poco de memoria (4.125 bits por peso en INT4 con escalas de 16 bits) y protegen al resto de los pesos de los extremos de cada zona.'
    },
    {
      id: 'w4a16', type: 'single',
      prompt: 'Cuantizas los pesos a INT4 (W4A16) en un servicio de chat. ¿Qué mejora sobre todo?',
      options: [
        'El prefill, porque calcula en 4 bits.',
        'El decode y la memoria: se leen 4 veces menos bytes de pesos por paso, aunque el cálculo siga en 16 bits.',
        'La calidad de las respuestas.',
        'Nada: solo cambia el tamaño del archivo.'
      ],
      answer: 1,
      explain: 'El decode está limitado por la memoria: leer menos bytes lo acelera casi en proporción. El prefill, limitado por cómputo, no gana, porque los pesos se desempaquetan a 16 bits para calcular.'
    },
    {
      id: 'smoothquant', type: 'single',
      prompt: '¿Qué hace SmoothQuant?',
      options: [
        'Entrena el modelo de nuevo en 8 bits.',
        'Divide los canales de activación con outliers por un factor y multiplica los pesos por el mismo factor: el resultado no cambia, pero activaciones y pesos quedan fáciles de cuantizar a 8 bits.',
        'Borra los outliers de las activaciones.',
        'Cuantiza solo el KV cache.'
      ],
      answer: 1,
      explain: 'Las activaciones tienen outliers enormes en pocos canales; los pesos son más parejos. SmoothQuant reparte la dificultad entre los dos con una transformación que no altera la cuenta.'
    },
    {
      id: 'awq', type: 'single',
      prompt: '¿Qué idea usa AWQ para cuantizar pesos a 4 bits con poca pérdida?',
      options: [
        'Reentrenar cada capa.',
        'Proteger el ~1 % de canales de pesos más importantes, que reconoce por el tamaño de sus activaciones, agrandándolos antes de cuantizar.',
        'Guardar los pesos importantes en FP32.',
        'Usar escalas de 32 bits.'
      ],
      answer: 1,
      explain: 'AWQ mira las activaciones de la calibración para saber qué canales de pesos más influyen en la salida, y los escala para que el redondeo les haga menos daño.'
    },
    {
      id: 'kv', type: 'single',
      prompt: 'Tu servicio se queda sin memoria para el KV cache cuando las conversaciones son largas, y los pesos ya están en FP8. ¿Qué cuantización ataca directamente el problema?',
      options: ['Pasar los pesos a INT4.', 'Guardar el KV cache en FP8.', 'Pasar las activaciones a INT8.', 'Usar FP16 en lugar de BF16.'],
      answer: 1,
      explain: 'El KV cache en FP8 ocupa la mitad: duplica los usuarios o el contexto que caben, y además acelera el decode con contextos largos porque se lee la mitad de bytes en cada paso.'
    },
    {
      id: 'calib', type: 'single',
      prompt: 'Cuantizaste con AWQ calibrando con chat en inglés, y tu tráfico real es generación de código en español. ¿Cuál es el riesgo?',
      options: [
        'Ninguno: la calibración no importa.',
        'Que los canales importantes para tu tráfico sean otros y la calidad caiga justo en las tareas que no mediste.',
        'Que el modelo responda en inglés.',
        'Que ocupe más memoria.'
      ],
      answer: 1,
      explain: 'La calibración decide escalas y qué se protege. Hay que calibrar con muestras parecidas al tráfico real y medir con evals de esas mismas tareas.'
    },
    {
      id: 'medir', type: 'multi',
      prompt: '¿Qué deberías medir antes de desplegar un modelo cuantizado?',
      options: [
        'Tus evals de tareas reales: código que compila, JSON válido, tool calls correctas.',
        'Solo la perplejidad global.',
        'Esas mismas tareas con contextos largos.',
        'Una comparación contra la versión BF16 con los mismos prompts.',
        'El tamaño del archivo en disco.'
      ],
      answer: [0, 2, 3],
      explain: 'La perplejidad puede casi no moverse mientras una tarea concreta se rompe. Lo que decide es la comparación contra la referencia en tus tareas, incluidos los contextos largos, que suelen degradar primero.'
    }
  ]
});
