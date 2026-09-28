SD.defineQuiz('m11', {
  title: 'Quiz: observabilidad y operación',
  pass: 0.7,
  questions: [
    {
      id: 'cardinalidad', type: 'single',
      prompt: 'Alguien agrega la etiqueta <code>user_id</code> a la métrica de latencia de todos los endpoints. Hay 20 millones de usuarios. ¿Qué pasa?',
      options: [
        'Nada: las métricas son baratas.',
        'Explota la cardinalidad: millones de series temporales nuevas que el sistema de métricas no puede almacenar ni consultar, con costos enormes o una caída.',
        'Mejora la precisión del p99.',
        'Se borran las métricas anteriores.'
      ],
      answer: 1,
      explain: 'Cada combinación de etiquetas es una serie distinta. Los identificadores de alta cardinalidad van en logs y traces, que están hechos para eso; las métricas usan etiquetas de pocas opciones (endpoint, código de estado, región).'
    },
    {
      id: 'traces', type: 'single',
      prompt: 'El p99 de un endpoint subió de 300 ms a 2 s. Las métricas de cada servicio se ven normales. ¿Qué herramienta encuentra la causa más rápido?',
      options: ['Un dashboard de CPU.', 'Traces distribuidos de requests lentas: muestran qué span se alarga y en qué servicio.', 'Reiniciar todo.', 'Revisar el código a mano.'],
      answer: 1,
      explain: 'Las métricas dicen que algo está lento; los traces dicen dónde. Con muestreo por cola (tail sampling) se guardan precisamente los traces lentos o con errores.'
    },
    {
      id: 'alertas', type: 'single',
      prompt: '¿Por qué conviene alertar por síntomas (error budget quemándose) y no por causas (CPU al 90 %)?',
      options: [
        'Porque la CPU no se puede medir.',
        'Porque una CPU al 90 % puede no afectar a nadie y un problema de usuarios puede ocurrir con la CPU al 20 %. Las alertas por síntomas despiertan a alguien solo cuando los usuarios sufren.',
        'Porque las alertas por causas son ilegales.',
        'No hay diferencia.'
      ],
      answer: 1,
      explain: 'Las alertas que no requieren acción entrenan al equipo a ignorarlas. Las causas sirven como contexto en los dashboards y para diagnosticar, no para despertar a nadie.'
    },
    {
      id: 'burn', type: 'single',
      prompt: 'SLO de 99.9 % en 30 días. Durante la última hora, el 1.5 % de las requests falló. ¿Qué debería pasar?',
      options: [
        'Nada: 1.5 % es poco.',
        'Una alerta de página: la tasa de quema es 15× (1.5 % / 0.1 %), por encima del umbral de 14.4× de la regla de 1 hora; a ese ritmo el presupuesto del mes se agota en unos 2 días.',
        'Un ticket para la semana siguiente.',
        'Congelar todos los deploys durante un mes.'
      ],
      answer: 1,
      explain: 'Burn rate = tasa de errores / (1 − SLO) = 0.015 / 0.001 = 15. La regla de "2 % del presupuesto en 1 hora" equivale a 14.4×. Pruébalo en la calculadora.'
    },
    {
      id: 'canary', type: 'single',
      prompt: '¿Qué hace que un canary sea útil de verdad?',
      options: [
        'Desplegar a todos y esperar.',
        'Enviar un pequeño porcentaje del tráfico a la versión nueva, comparar automáticamente sus métricas (errores, latencia) con la estable y revertir solo si empeora.',
        'Desplegar los viernes a la tarde.',
        'Desplegar en un servidor de pruebas.'
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
        'Ninguna.',
        'Se puede apagar una funcionalidad problemática en segundos sin desplegar, activarla gradualmente por porcentaje o cliente, y desplegar código a medio terminar sin exponerlo.',
        'Hace el código más rápido.',
        'Elimina la necesidad de pruebas.'
      ],
      answer: 1,
      explain: 'Un rollback de código tarda minutos y arrastra otros cambios; apagar un flag tarda segundos. El costo: flags viejos que nadie limpia se vuelven deuda, y el propio servicio de flags es una dependencia crítica.'
    },
    {
      id: 'config', type: 'single',
      prompt: 'Varias de las mayores caídas de internet fueron causadas por cambios de configuración u operativos, no de código. ¿Qué lección de diseño se saca?',
      options: [
        'Prohibir los cambios de configuración.',
        'La configuración es código: debe pasar por revisión, validación y despliegue gradual (canary) igual que el código, en lugar de aplicarse a toda la flota a la vez.',
        'Guardar la configuración en variables de entorno.',
        'Cambiar la configuración solo de noche.'
      ],
      answer: 1,
      explain: 'Un cambio de configuración que llega a todos los servidores en segundos tiene el radio de impacto máximo. La caída de Cloudflare de julio de 2019 (una regla del WAF) y la de Facebook de octubre de 2021 (un comando de mantenimiento desconectó toda su red troncal y, en reacción, sus servidores DNS retiraron sus rutas BGP) son ejemplos documentados de cambios operativos que llegaron a todo a la vez.'
    }
  ]
});
