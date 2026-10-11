SD.defineQuiz('m11', {
  title: 'Quiz: observabilidad y operación',
  pass: 0.7,
  questions: [
    {
      id: 'cardinalidad', type: 'single',
      prompt: 'Alguien agrega la etiqueta <code>user_id</code> a la métrica de latencia de todos los endpoints. Hay 20 millones de usuarios. ¿Qué pasa?',
      options: [
        'Nada grave: el sistema agrupa los user_id en buckets, como hace con los valores de un histograma.',
        'Explota la cardinalidad: millones de series nuevas que no se pueden guardar ni consultar.',
        'Mejora la precisión del p99, porque cada usuario tiene su propia distribución.',
        'Se borran las métricas anteriores, porque cambió el esquema de etiquetas.'
      ],
      answer: 1,
      explain: 'Cada combinación de etiquetas es una serie distinta. Los identificadores de alta cardinalidad van en logs y traces, que están hechos para eso; las métricas usan etiquetas de pocas opciones (endpoint, código de estado, región).'
    },
    {
      id: 'traces', type: 'single',
      prompt: 'El p99 de un endpoint subió de 300 ms a 2 s. Las métricas de cada servicio se ven normales. ¿Qué herramienta encuentra la causa más rápido?',
      options: ['Un dashboard de CPU y memoria de cada servicio, buscando el que esté saturado.', 'Traces distribuidos de requests lentas: muestran qué span se alarga.', 'Los logs del gateway, que registran la latencia total de cada request.', 'Un profiler de CPU en el servicio de entrada, que mide dónde gasta el tiempo.'],
      answer: 1,
      explain: 'Las métricas dicen que algo está lento; los traces dicen dónde. Con muestreo por cola (tail sampling) se guardan precisamente los traces lentos o con errores.'
    },
    {
      id: 'alertas', type: 'single',
      prompt: '¿Por qué conviene alertar por síntomas (error budget quemándose) y no por causas (CPU al 90 %)?',
      options: [
        'Porque la CPU no se puede medir con precisión en contenedores compartidos.',
        'Porque una CPU al 90 % puede no afectar a nadie, y los usuarios pueden sufrir con 20 %.',
        'Porque las alertas por causas generan demasiados datos y saturan el sistema de métricas.',
        'No hay diferencia de fondo: las dos detectan los mismos problemas con distinta demora.'
      ],
      answer: 1,
      explain: 'Las alertas que no requieren acción entrenan al equipo a ignorarlas. Las causas sirven como contexto en los dashboards y para diagnosticar, no para despertar a nadie.'
    },
    {
      id: 'burn', type: 'single',
      prompt: 'SLO de 99.9 % en 30 días. Durante la última hora, el 1.5 % de las requests falló. ¿Qué debería pasar?',
      options: [
        'Nada: 1.5 % de errores durante una sola hora está dentro de lo normal para un SLO de 99.9 %.',
        'Una alerta de página: la quema es 15× y el presupuesto del mes se agota en unos 2 días.',
        'Un ticket para la semana siguiente, porque el SLO se mide sobre 30 días.',
        'Congelar todos los deploys durante un mes para recuperar el presupuesto.'
      ],
      answer: 1,
      explain: 'Burn rate = tasa de errores / (1 − SLO) = 0.015 / 0.001 = 15. La regla de "2 % del presupuesto en 1 hora" equivale a 14.4×. Pruébalo en la calculadora.'
    },
    {
      id: 'canary', type: 'single',
      prompt: '¿Qué hace que un canary sea útil de verdad?',
      options: [
        'Desplegar a todos los servidores y vigilar los dashboards durante la primera hora.',
        'Mandar un poco de tráfico a la versión nueva y compararla automáticamente con la estable.',
        'Desplegar primero en staging, con datos copiados de producción.',
        'Desplegar en un servidor de pruebas con tráfico sintético generado por Gatling.'
      ],
      answer: 1,
      explain: 'El valor está en la comparación automática y el rollback sin intervención humana: el mal deploy toca al 1 % durante minutos en lugar de al 100 % hasta que alguien lo note.'
    },
    {
      id: 'expand', type: 'order',
      prompt: 'Ordena los pasos para renombrar la columna <code>nombre</code> a <code>nombre_completo</code> sin downtime:',
      items: [
        'Agregar la columna nueva (nullable)',
        'Desplegar código que escribe en ambas columnas',
        'Copiar los datos viejos a la columna nueva en lotes',
        'Desplegar código que lee de la columna nueva',
        'Dejar de escribir en la columna vieja',
        'Borrar la columna vieja'
      ],
      explain: 'Expand/contract: cada paso es compatible con la versión de código anterior, así cualquier deploy se puede revertir. Renombrar la columna de golpe rompería a las instancias que todavía corren el código viejo.'
    },
    {
      id: 'flags', type: 'single',
      prompt: '¿Qué ventaja operativa da separar el deploy del código de la activación de la funcionalidad con un feature flag?',
      options: [
        'Ninguna operativa: solo ordena el código, porque el deploy sigue siendo el que activa.',
        'Se puede apagar una funcionalidad en segundos sin desplegar y activarla de a poco.',
        'Hace el código más rápido, porque las ramas apagadas no se compilan.',
        'Elimina la necesidad de pruebas, porque lo nuevo se prueba directo en producción.'
      ],
      answer: 1,
      explain: 'Un rollback de código tarda minutos y arrastra otros cambios; apagar un flag tarda segundos. El costo: flags viejos que nadie limpia se vuelven deuda, y el propio servicio de flags es una dependencia crítica.'
    },
    {
      id: 'config', type: 'single',
      prompt: 'Varias de las mayores caídas de internet fueron causadas por cambios de configuración u operativos, no de código. ¿Qué lección de diseño se saca?',
      options: [
        'Prohibir los cambios de configuración fuera de una ventana de mantenimiento semanal.',
        'La configuración es código: revisión, validación y despliegue gradual, no a toda la flota.',
        'Guardar la configuración en variables de entorno, que no cambian sin reiniciar.',
        'Cambiar la configuración solo de noche, cuando hay menos usuarios afectados.'
      ],
      answer: 1,
      explain: 'Un cambio de configuración que llega a todos los servidores en segundos tiene el radio de impacto máximo. La caída de Cloudflare de julio de 2019 (una regla del WAF) y la de Facebook de octubre de 2021 (un comando de mantenimiento desconectó toda su red troncal y, en reacción, sus servidores DNS retiraron sus rutas BGP) son ejemplos documentados de cambios operativos que llegaron a todo a la vez.'
    },
    {
      id: 'churn', type: 'single',
      prompt: 'Un servicio con la etiqueta <code>pod</code> en sus histogramas pasa de 2 a 12 deploys por día. El tráfico no cambia. ¿Qué le pasa al sistema de métricas?',
      options: [
        'Nada: el costo depende del tráfico, y cada pod nuevo hereda las series del anterior.',
        'Más churn: cada deploy deja series viejas y crea otras tantas, y la memoria sube.',
        'Pierde las muestras de los pods viejos en cuanto termina el deploy, sin costo extra.',
        'Sube el disco pero no la memoria, porque las series viejas se escriben a disco al instante.'
      ],
      answer: 1,
      explain: 'Cada pod nuevo tiene otro nombre, así que sus series son filas nuevas. Las viejas siguen en el head block hasta que se compacta, y durante un rolling update conviven las dos. Por eso <code>pod</code> no va en las métricas de negocio (11.3, churn).'
    },
    {
      id: 'exemplar', type: 'single',
      prompt: '¿Por qué un exemplar no dispara la cardinalidad, aunque guarde un <code>trace_id</code> distinto en cada muestra?',
      options: [
        'Porque Prometheus lo convierte en una etiqueta solo en los buckets más lentos, que son pocos.',
        'Porque el trace_id se guarda resumido con un hash de 8 bytes que se repite entre requests.',
        'Porque no es una etiqueta: viaja al costado de la muestra en un buffer de tamaño fijo.',
        'Porque se descarta al calcular el percentil y nunca llega al almacenamiento.'
      ],
      answer: 2,
      explain: 'Una etiqueta define la identidad de la serie; el exemplar no. Prometheus guarda los exemplars en un buffer circular fijo, de unos 100 bytes cada uno, así que su costo no crece con los usuarios (11.5, exemplars).'
    },
    {
      id: 'propagacion', type: 'single',
      prompt: 'En los traces aparecen muchos traces <b>raíz</b> que empiezan en <code>moderation</code>, un servicio interno que no recibe tráfico de internet. ¿Qué indica?',
      options: [
        'Que moderation está muestreando por cola y guarda solo sus propios spans.',
        'Que alguien llama a moderation sin propagar el header traceparent.',
        'Que moderation es el servicio más lento y por eso el backend lo pone primero.',
        'Que el Collector reparte los spans por servicio y no por trace_id.'
      ],
      answer: 1,
      explain: 'Un servicio que no recibe contexto empieza un trace nuevo. Si un servicio interno aparece como raíz, quien lo llama usa un cliente sin instrumentar: el trace de la request original queda con un hueco sin explicar (11.5, la escena "Un servicio no propaga").'
    },
    {
      id: 'sinrunbook', type: 'single',
      prompt: 'Startup de cinco personas, 3 de la mañana, fallan los pagos y no hay ningún runbook. Hubo un deploy hace 40 minutos. ¿Qué haces primero, después de declarar el incidente?',
      options: [
        'Revertir el deploy y medir si vuelve a funcionar, antes de buscar la causa.',
        'Leer el diff del deploy hasta encontrar la línea que rompe los pagos.',
        'Reiniciar todos los servicios a la vez para descartar un estado corrupto.',
        'Escribir el runbook de pagos antes de tocar nada, para no improvisar.'
      ],
      answer: 0,
      explain: 'Primero se mitiga con la palanca más reversible, y el deploy reciente es el sospechoso número uno. Entender viene después, con el sistema estable. Reiniciar todo a la vez cambia muchas cosas juntas y borra pistas; el runbook se escribe esa misma semana (11.9).'
    },
    {
      id: 'dora', type: 'multi',
      prompt: '¿Cuáles de estas son métricas DORA del modelo actual?',
      options: [
        'Tiempo de recuperación de un deploy fallido',
        'Porcentaje de cobertura de pruebas del repositorio',
        'Tasa de cambios fallidos',
        'Cantidad de líneas de código cambiadas por semana',
        'Lead time desde el commit hasta producción'
      ],
      answer: [0, 2, 4],
      explain: 'Las cinco son lead time del cambio, frecuencia de deploys, tiempo de recuperación de un deploy fallido, tasa de cambios fallidos y tasa de retrabajo. Cobertura y líneas de código no miden la entrega: se inflan sin que el sistema mejore (11.10).'
    }
  ]
});
