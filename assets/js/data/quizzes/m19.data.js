SD.defineQuiz('m19', {
  title: 'Quiz: router y flota GPU',
  pass: 0.7,
  questions: [
    {
      id: 'estabilidad', type: 'single',
      prompt: 'El servicio de despliegues, que publica la tabla de rutas, se cae durante una hora. ¿Qué tendría que pasar con las requests?',
      options: [
        'Fallan con 503 hasta que vuelva, porque el router no sabe a dónde mandarlas.',
        'Se atienden con la última tabla que el router tiene en memoria.',
        'El router consulta el registry directamente en cada request mientras tanto.',
        'Se mandan todas a otra región mientras tanto.'
      ],
      answer: 1,
      explain: 'El plano de datos no depende del plano de control para atender una request: es la estabilidad estática. Si dependiera, una caída del plano de control sería una caída de toda la API. Repasa 19.2.'
    },
    {
      id: 'senales', type: 'single',
      prompt: 'Dos réplicas tienen 20 requests en curso cada una. La A tiene en cola tres prompts de 40 000 tokens sin procesar; la B, tres de 500. ¿Qué señal distingue cuál está más cargada?',
      options: [
        'Las requests en curso: son iguales, así que da lo mismo a cuál mandar la siguiente.',
        'Los tokens de prefill pendientes: la A tiene unos 120 000 y la B unos 1 500.',
        'La utilización de GPU que reporta nvidia-smi, que sube con el prefill pendiente.',
        'El uso de KV cache, que ya incluye los prompts que esperan en la cola.'
      ],
      answer: 1,
      explain: 'Contar requests no ve su tamaño. A unos 14 000 tokens por segundo, la A tiene más de 8 s de prefill por delante y la B unos 0.1 s. Repasa la tabla de señales en 19.5.'
    },
    {
      id: 'hash-prefijo', type: 'single',
      prompt: 'Un router hashea los primeros 256 tokens del prompt para elegir réplica. Una app con el 40&#8239;% del tráfico usa siempre el mismo prompt de sistema. ¿Qué pasa?',
      options: [
        'Todas sus requests van a la misma réplica, que se satura.',
        'El tráfico se reparte parejo, porque el hash es uniforme sobre todas las réplicas.',
        'Las requests se rechazan por prompt duplicado.',
        'La réplica copia su KV cache a las demás cuando detecta que el prefijo es popular.'
      ],
      answer: 0,
      explain: 'El hash es uniforme sobre claves distintas, pero aquí casi todo el tráfico tiene la misma clave. En el simulador, esa política deja una réplica con 6.6 veces la carga promedio. Hace falta acotar la carga. Repasa 19.6.'
    },
    {
      id: 'carga-acotada', type: 'multi',
      prompt: '¿Qué hace el routing por prefijo con carga acotada? Marca todo lo que corresponde.',
      options: [
        'Entre las réplicas bajo un techo de carga, elige la que tiene el prefijo más largo.',
        'Si ninguna réplica está por debajo del techo, elige la menos cargada.',
        'Garantiza que cada conversación siempre vaya a la misma réplica mientras esa réplica siga viva.',
        'Un prefijo muy pedido termina en varias réplicas, por el desborde.',
        'Necesita consenso entre routers para mantener el índice de prefijos idéntico en todos.'
      ],
      answer: [0, 1, 3],
      explain: 'Es la idea del hashing consistente con carga acotada aplicada al prefijo. No garantiza afinidad (el techo la rompe cuando hace falta) y el índice es una pista que puede estar desactualizada, sin consenso. Repasa 19.6.'
    },
    {
      id: 'metrica', type: 'single',
      prompt: '¿Por qué la utilización de GPU es una mala métrica para el autoscaling de inferencia?',
      options: [
        'Porque Kubernetes no puede leer métricas de GPU sin un operador especial.',
        'Porque una réplica con una request y otra con 64 marcan casi lo mismo.',
        'Porque en las H100 la reporta el driver solo cada varios minutos.',
        'Porque cambia demasiado rápido y el HPA escalaría y desescalaría todo el tiempo.'
      ],
      answer: 1,
      explain: 'Hay que medir lo que se agota: el uso de KV cache, la cola o el TTFT contra su SLO. Repasa 19.7.'
    },
    {
      id: 'hpa', type: 'single',
      prompt: 'Hay 60 réplicas con un uso promedio de KV cache del 90&#8239;% y el objetivo es 75&#8239;%. Según la fórmula del HPA, ¿cuántas réplicas pide?',
      options: ['66', '72', '75', '90'],
      fixed: true,
      answer: 1,
      explain: 'ceil(60 × 0.90 / 0.75) = ceil(72) = 72. La diferencia (20&#8239;%) supera la tolerancia del 10&#8239;%, así que escala. Repasa 19.7.'
    },
    {
      id: 'colchon', type: 'single',
      prompt: 'Una réplica tarda 520 s en arrancar en un nodo nuevo y el tráfico del pico crece un 3&#8239;% por minuto. Con 100 réplicas en el pico, ¿qué colchón necesitas para no quedarte corto mientras llegan las nuevas?',
      options: ['Unas 3 réplicas', 'Unas 10 réplicas', 'Unas 30 réplicas', 'Unas 100 réplicas'],
      fixed: true,
      answer: 2,
      explain: '520 s son 8.7 minutos: 1.03 elevado a 8.7 da 1.29, un 29&#8239;% más de tráfico, unas 30 réplicas. Con los pesos en NVMe y un nodo listo, el arranque baja a 84 s y alcanzan 5. Repasa 19.8 y la calculadora.'
    },
    {
      id: 'drenar', type: 'order',
      prompt: 'Llega un aviso de interrupción spot de 2 minutos. Ordena los pasos del drenaje.',
      items: [
        'La readiness probe falla a propósito y el router deja de mandarle requests nuevas.',
        'Las respuestas cortas terminan en la réplica.',
        'Antes del corte, el router continúa los streams largos en otra réplica con el prompt y los tokens ya generados.',
        'La nube apaga el nodo, sin streams abiertos.'
      ],
      explain: 'Primero se corta la entrada, después se deja terminar lo corto y lo largo se mueve antes del corte, no después. Repasa 19.9 y la figura 19.5.'
    },
    {
      id: 'regiones', type: 'single',
      prompt: 'Tres regiones trabajan al 70&#8239;% de su capacidad. Cae una. ¿Qué pasa con las otras dos, y qué uso máximo permitiría absorber la caída sin recortar?',
      options: [
        'Quedan al 70&#8239;%, porque el tráfico de la caída se pierde; el uso máximo es 100&#8239;%.',
        'Quedan al 105&#8239;%; el uso máximo es (3 − 1) / 3, un 67&#8239;%.',
        'Quedan al 140&#8239;%; el uso máximo es 50&#8239;%.',
        'Quedan al 90&#8239;%, porque reparten el 70&#8239;% entre más; el uso máximo es 75&#8239;%.'
      ],
      answer: 1,
      explain: '0.70 × 3 / 2 = 1.05. Para absorber la caída de una región entre R sin recortar, u ≤ (R − 1) / R. Si no, hay que decidir de antemano a quién se recorta. Repasa 19.10.'
    }
  ]
});
