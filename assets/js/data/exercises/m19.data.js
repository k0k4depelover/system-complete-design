/* Ejercicio guiado del M19 (router y flota GPU). Formato en core/exercise.js. */

SD.defineExercise('m19-flota', {
  title: 'la flota de un asistente de código',
  scenario: '<p>Un asistente de código sirve un modelo de 70B en réplicas de 4 H100 (64 streams por réplica, prefill de unos 14&#8239;000 tokens por segundo). Cada request lleva un prompt de sistema de 4&#8239;000 tokens, el contexto del repositorio, unos 30&#8239;000 tokens que cambian poco durante una sesión, y el historial de la sesión. En el pico hay 4&#8239;800 streams a la vez; el 60&#8239;% del tráfico es de clientes empresa y el 40&#8239;%, del plan gratuito.</p><p>El tráfico sube un 4&#8239;% por minuto cuando empieza la jornada en cada continente, hay dos regiones, y finanzas quiere usar capacidad spot para bajar costos. Diseña el routing, el autoscaling y qué pasa cuando se va capacidad.</p>',
  steps: [
    {
      id: 'replicas', type: 'single',
      prompt: '¿Cuántas réplicas necesita el pico si el objetivo de uso es el 75&#8239;%?',
      options: ['75', '100', '128', '150'],
      fixed: true,
      answer: 1,
      explain: '4&#8239;800 / 64 = 75 réplicas al 100&#8239;%; al 75&#8239;%, 4&#8239;800 / (64 × 0.75) = 100 réplicas, 400 GPUs.'
    },
    {
      id: 'routing', type: 'single',
      prompt: 'Las requests de una sesión comparten unos 34&#8239;000 tokens iniciales (prompt de sistema y repositorio). ¿Qué política de routing conviene?',
      options: [
        'Round robin: es la más pareja.',
        'La réplica con menos requests en curso.',
        'El prefijo más largo en caché entre las réplicas por debajo de 1.25 veces la carga promedio, con un índice de prefijos que alimentan las réplicas.',
        'Hash de los primeros 256 tokens del prompt.'
      ],
      answer: 2,
      explain: 'Recalcular 34&#8239;000 tokens cuesta unos 2.4 s de prefill por request. Round robin y la menos cargada los recalculan casi siempre; el hash de los primeros 256 tokens solo ve el prompt de sistema, que es igual para todos, y manda toda la app a una réplica. Lo que distingue a una sesión es el repositorio, y el índice lo ve.'
    },
    {
      id: 'metrica', type: 'single',
      prompt: '¿Con qué métrica escala el autoscaler?',
      options: [
        'La utilización de GPU de nvidia-smi, con objetivo del 75&#8239;%.',
        'El uso de KV cache con objetivo del 75&#8239;%, con las requests en cola como señal de respaldo.',
        'La CPU de los pods.',
        'La cantidad de requests por segundo del gateway.'
      ],
      answer: 1,
      explain: 'Con contextos de 34&#8239;000 tokens, lo que se agota primero es la memoria de KV cache. La utilización de GPU marca casi lo mismo con una request o con 64, y las requests por segundo no ven el tamaño.'
    },
    {
      id: 'colchon', type: 'single',
      prompt: 'Un nodo nuevo tarda unos 9 minutos en servir. Con los pesos en NVMe y nodos listos, 90 s. Si el tráfico sube un 4&#8239;% por minuto, ¿qué colchón hace falta sobre las 100 réplicas en cada caso?',
      options: [
        'Unas 43 réplicas con nodos nuevos, unas 7 con nodos listos.',
        'Unas 4 en los dos casos.',
        'Unas 100 en los dos casos.',
        'No hace falta colchón: el autoscaler reacciona solo.'
      ],
      answer: 0,
      explain: '1.04 elevado a 9 da 1.42: un 42&#8239;% más, unas 43 réplicas. 1.04 elevado a 1.5 da 1.06: unas 7. Un pool de nodos listos con los pesos en disco cuesta mucho menos que 43 réplicas sirviendo de más, y además escalar por calendario antes de cada jornada achica el salto.'
    },
    {
      id: 'spot', type: 'multi',
      prompt: 'Finanzas quiere que una parte de la flota sea spot. ¿Qué condiciones pones? Marca todo lo que corresponde.',
      options: [
        'Spot solo para una fracción acotada, por ejemplo el 30&#8239;%, y nunca para la capacidad que garantiza el tráfico empresa.',
        'Un agente en cada nodo que, ante el aviso, falla la readiness probe para que el router deje de mandarle requests.',
        'Continuar en otra réplica los streams que no terminan antes del corte, con el prompt y los tokens ya generados.',
        'Dejar terminationGracePeriodSeconds en 30 s, el valor por defecto.',
        'Mezclar varios tipos de instancia y zonas, para que una ola de interrupciones no se lleve todo el spot a la vez.'
      ],
      answer: [0, 1, 2, 4],
      explain: 'Un asistente de código genera respuestas largas que pueden durar más que un aviso de 30 s o de 2 min: hay que drenar y continuar. El periodo de gracia por defecto, 30 s, corta esos streams cuando el apagado lo decide Kubernetes; hay que subirlo.'
    },
    {
      id: 'region', type: 'single',
      prompt: 'Las dos regiones trabajan al 70&#8239;% y cae una. La otra recibe el 140&#8239;% de su capacidad. ¿Qué haces?',
      options: [
        'Nada: el autoscaler lo resuelve en segundos.',
        'Admitir todo el tráfico empresa (el 84&#8239;% de la capacidad), mandar el gratuito a un modelo más chico con un aviso en la respuesta, rechazar con 503 y Retry-After lo que no entra, y pedir réplicas.',
        'Rechazar el 30&#8239;% de las requests al azar.',
        'Mandar el tráfico excedente a la región caída.'
      ],
      answer: 1,
      explain: 'Con dos regiones, absorber la caída sin recortar exigiría trabajar al 50&#8239;%. Al 70&#8239;%, el recorte tiene que estar decidido antes: el tráfico pago entra, el gratuito se degrada o espera. Las réplicas nuevas tardan minutos, y en un pico regional la nube puede no tenerlas.'
    }
  ],
  solution: '<ul><li><b>Tamaño:</b> 100 réplicas de 4 H100 en el pico (400 GPUs), repartidas entre dos regiones.</li><li><b>Routing:</b> prefijo con carga acotada, con un índice alimentado por los eventos de KV cache de las réplicas. El contexto del repositorio, de 30&#8239;000 tokens, es lo que más ahorra: unos 2 s de prefill por request.</li><li><b>Autoscaling:</b> uso de KV cache con objetivo del 75&#8239;%, estabilización de 5 minutos para bajar, escalado por calendario antes de cada jornada y un pool de nodos listos con los pesos en NVMe, que deja el colchón en unas 7 réplicas en lugar de 43.</li><li><b>Spot:</b> hasta el 30&#8239;% de la flota, en varios tipos de instancia y zonas, nunca para la capacidad del tráfico empresa. Drenaje ante el aviso, continuación de los streams largos en otra réplica y un periodo de gracia que cubra las respuestas más largas.</li><li><b>Regiones:</b> al 70&#8239;% cada una, con el recorte decidido de antemano: empresa siempre, el gratuito a un modelo más chico o con 503 y Retry-After. Ensayar la caída de una región cada trimestre.</li></ul>'
});
