SD.defineQuiz('m16', {
  title: 'Quiz: context windows',
  pass: 0.7,
  questions: [
    {
      id: 'limites', type: 'multi',
      prompt: '¿Qué limita cuánto contexto conviene enviarle a un modelo?',
      options: [
        'El largo con el que se entrenó o se extendió el modelo.',
        'La memoria del KV cache, que crece con cada token de cada conversación.',
        'El cómputo de la atención en el prefill, que crece con el cuadrado del largo.',
        'La cantidad de piezas del vocabulario del tokenizer.',
        'Que el modelo aprovecha peor la información del medio de un contexto largo.'
      ],
      answer: [0, 1, 2, 4],
      explain: 'El vocabulario no limita el largo. Los otros cuatro sí: el entrenamiento fija el máximo, la memoria y el cómputo lo encarecen, y la atención despareja hace que llenar la ventana "por las dudas" empeore las respuestas.'
    },
    {
      id: 'cuadratico', type: 'single',
      prompt: 'Un prompt pasa de 64 000 a 128 000 tokens. ¿Qué le pasa a la parte de atención del prefill?',
      options: ['Se duplica.', 'Se cuadruplica.', 'Queda igual.', 'Se reduce a la mitad.'],
      answer: 1,
      fixed: true,
      explain: 'Cada token se compara con todos los anteriores: el doble de tokens son el cuádruple de comparaciones. Con la parte lineal duplicada, el prefill total del 70B pasa de unos 4.7 s a unos 13 s.'
    },
    {
      id: 'conversacion', type: 'single',
      prompt: 'Cada turno de una conversación agrega unos 500 tokens. ¿Cómo crecen los tokens de entrada que pagas en toda la conversación?',
      options: [
        'En proporción a la cantidad de turnos.',
        'Con el cuadrado de la cantidad de turnos, porque cada turno reenvía todo lo anterior.',
        'No crecen: el modelo recuerda la conversación.',
        'Solo se paga el último turno.'
      ],
      answer: 1,
      explain: 'El turno i envía unos i × 500 tokens; la suma de 20 turnos son unos 95 000 tokens de historial, para 10 000 de contenido. El prompt caching abarata la parte repetida, pero no la elimina.'
    },
    {
      id: 'truncar', type: 'single',
      prompt: '¿Cuál es el riesgo típico de truncar los mensajes más viejos cuando la conversación no entra?',
      options: [
        'Que la respuesta sea más larga.',
        'Que se pierda lo primero que se dijo, que suele ser lo más importante: el documento o la tarea original.',
        'Que el modelo responda en otro idioma.',
        'Que aumente el TTFT.'
      ],
      answer: 1,
      explain: 'Truncar es simple y predecible, pero no distingue importancia. Por eso se combina con resúmenes, recuperación de lo relevante o memoria de hechos estables.'
    },
    {
      id: 'rag', type: 'single',
      prompt: 'Tienes 80 millones de tokens de manuales y el modelo acepta 128 000. ¿Qué haces?',
      options: [
        'Meter todo en el contexto.',
        'RAG: indexar los manuales y agregar al prompt solo las secciones relevantes para cada pregunta.',
        'Entrenar un modelo nuevo por cada manual.',
        'Truncar los manuales.'
      ],
      answer: 1,
      explain: 'Un corpus que no entra en ninguna ventana necesita recuperación. Dentro del presupuesto, conviene enviar secciones completas y no fragmentos minúsculos, para que el modelo tenga contexto suficiente.'
    },
    {
      id: 'cache', type: 'single',
      prompt: 'El costo de tu API no baja aunque activaste el prompt caching, y la tasa de tokens en caché es casi cero. ¿Qué es lo más probable?',
      options: [
        'Que el proveedor no cobra con descuento.',
        'Que algo cambia al principio del prompt en cada request, como la fecha u hora en el prompt de sistema, y el prefijo nunca coincide.',
        'Que los prompts son demasiado cortos para tokenizarse.',
        'Que el modelo es demasiado grande.'
      ],
      answer: 1,
      explain: 'El caché reutiliza el prefijo idéntico más largo. Cualquier cosa que varíe al principio (fecha, ID de request, herramientas en otro orden) invalida todo lo que viene después.'
    },
    {
      id: 'medio', type: 'single',
      prompt: 'Según "Lost in the Middle", ¿dónde conviene poner la información clave dentro de un contexto largo?',
      options: ['En el medio.', 'Al principio o al final.', 'Da igual.', 'Repetida en cada párrafo.'],
      answer: 1,
      fixed: true,
      explain: 'Los modelos encuentran mejor lo que está en los extremos del contexto. Por eso las instrucciones van en el prompt de sistema y la pregunta al final, cerca de lo recuperado para ella.'
    },
    {
      id: 'memoria', type: 'single',
      prompt: 'La función de "memoria" de un asistente, ¿qué es desde el punto de vista del modelo?',
      options: [
        'Pesos del modelo que se actualizan con cada usuario.',
        'Hechos guardados por el producto, como preferencias del usuario, que se agregan al contexto de cada conversación.',
        'El KV cache guardado para siempre.',
        'Un segundo modelo que responde por el primero.'
      ],
      answer: 1,
      explain: 'El modelo no cambia ni recuerda nada entre requests: el producto extrae hechos, los guarda en su base y los vuelve a enviar como parte del prompt.'
    }
  ]
});
