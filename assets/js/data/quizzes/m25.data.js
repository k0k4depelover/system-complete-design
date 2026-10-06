SD.defineQuiz('m25', {
  title: 'Quiz: agentes y herramientas',
  pass: 0.7,
  questions: [
    {
      id: 'definicion', type: 'single',
      prompt: '¿Qué separa a un agente de un workflow?',
      options: [
        'El agente usa herramientas; el workflow solo genera texto.',
        'Quién decide el camino: en el workflow, el código; en el agente, el modelo en cada paso.',
        'El agente usa un modelo más grande, que razona antes de contestar.',
        'El workflow corre en un servidor; el agente, en varios workers.'
      ],
      answer: 1,
      explain: 'Un workflow también puede usar herramientas y varios modelos. La diferencia es quién decide el camino: el código o el modelo. Por eso en un agente no sabes de antemano cuántas llamadas va a hacer una tarea. Repasa 25.1.'
    },
    {
      id: 'tokens', type: 'single',
      prompt: 'Una tarea de 30 pasos con un prefijo de 5&#8239;500 tokens, y cada paso suma 1&#8239;000 al contexto. ¿Cuántos tokens de entrada lee la tarea en total?',
      options: ['34&#8239;500', '165&#8239;000', '600&#8239;000', '1&#8239;035&#8239;000'],
      fixed: true,
      answer: 2,
      explain: 'Cada paso relee todo: 30 × 5&#8239;500 + 1&#8239;000 × (0 + 1 + … + 29) = 165&#8239;000 + 435&#8239;000 = 600&#8239;000. 34&#8239;500 es solo lo que lee el último paso. Repasa 25.1.'
    },
    {
      id: 'cache', type: 'single',
      prompt: 'Esa misma tarea cuesta 1.29 USD sin caché y 0.29 con prompt caching. ¿De dónde sale casi todo el ahorro?',
      options: [
        'La salida del modelo se cobra más barata cuando el prefijo viene del caché, y la tarea genera mucha.',
        'El caché guarda las respuestas y evita llamar al modelo en los pasos que ya se habían hecho.',
        'Lo ya mandado en el paso anterior se lee del caché a 0.20 por millón, no a 2.',
        'El caché comprime el contexto y manda menos tokens.'
      ],
      answer: 2,
      explain: 'De los 600&#8239;000 tokens de entrada, 565&#8239;500 son la entrada del paso anterior: se leen del caché. Solo se escriben los 34&#8239;500 nuevos, a 2.50. La salida cuesta lo mismo. Repasa 25.1.'
    },
    {
      id: 'little', type: 'single',
      prompt: 'Llegan 3.47 tareas por segundo en el pico y cada una dura 2 minutos. ¿Cuántas hay en curso?',
      options: ['29', '104', '208', '417'],
      fixed: true,
      answer: 3,
      explain: 'Ley de Little: 3.47 × 120 s ≈ 417. Por eso un deploy siempre encuentra tareas a mitad, y la ejecución durable no es opcional. Repasa 25.1 y 25.8.'
    },
    {
      id: 'patron', type: 'single',
      prompt: 'Un reembolso siempre sigue el mismo camino: buscar el pedido, buscar los pagos y decidir. ¿Qué conviene?',
      options: [
        'Un workflow de tres llamadas: más barato y con latencia predecible.',
        'Un agente autónomo, porque se adapta solo si el camino cambia algún día y no hay que tocar el código.',
        'Un sistema de varios agentes, uno por cada paso del reembolso, que trabajan en paralelo.',
        'Un agente con 100 herramientas, para que tenga todo a mano.'
      ],
      answer: 0,
      explain: 'Si el camino es fijo, el agente paga flexibilidad que no usa. Un workflow de tres llamadas cuesta unos 0.05 USD sin caché, contra 0.29 del agente de 30 pasos con caché. Repasa 25.3.'
    },
    {
      id: 'multiagente', type: 'single',
      prompt: '¿Para qué tipo de tarea tiene sentido un sistema de varios agentes en paralelo?',
      options: [
        'Una tarea secuencial donde cada paso depende del anterior, porque cada agente revisa el trabajo del otro.',
        'Una tarea que se parte en piezas independientes y vale mucho, como una investigación.',
        'Cualquier tarea, porque varios agentes en paralelo terminan antes y gastan menos tokens que uno solo.',
        'Las tareas cortas, porque los subagentes arrancan más rápido.'
      ],
      answer: 1,
      explain: 'Varios agentes gastan unas 15 veces los tokens de un chat y son difíciles de coordinar. Se ganan su costo cuando las piezas son independientes y el resultado vale mucho. Repasa 25.3.'
    },
    {
      id: 'error', type: 'single',
      prompt: 'El servicio de pagos no responde. ¿Qué recibe el modelo?',
      options: [
        'Nada: el orquestador reintenta en silencio hasta que el servicio vuelva, y el modelo nunca se entera.',
        'Una excepción que termina la tarea con un error 500, porque seguir sin pagos daría una respuesta incompleta.',
        'Un resultado de error con una pista sobre qué hacer, como reintentar una vez.',
        'Un resultado con los datos más probables, para que la tarea siga.'
      ],
      answer: 2,
      explain: 'El error vuelve como resultado, con una pista, para que el modelo decida. Un error sin pista produce reintentos iguales; reintentar en silencio deja la tarea colgada. Repasa 25.4.'
    },
    {
      id: 'identidad', type: 'single',
      prompt: '¿Con qué identidad se ejecutan las herramientas de un agente que atiende a un usuario?',
      options: [
        'Con una cuenta de servicio con acceso a todo, para que el agente nunca se trabe por permisos.',
        'Con la identidad del usuario: el agente no puede ver ni hacer más que la persona.',
        'Con la identidad del modelo, que el proveedor firma en cada llamada a la API de mensajes.',
        'Con la que pida el modelo en los argumentos de la llamada, validada por el JSON Schema.'
      ],
      answer: 1,
      explain: 'Que el modelo pida el pedido 8812 no prueba que el usuario pueda verlo (BOLA). Con la identidad del usuario, una injection no le da al agente más permisos de los que la persona ya tenía. Repasa 25.2 y 25.4.'
    },
    {
      id: 'mcp', type: 'single',
      prompt: '¿Qué resuelve MCP?',
      options: [
        'Que el modelo no pueda ser manipulado por el texto que devuelven las herramientas, porque el protocolo lo marca.',
        'Que un sistema exponga sus herramientas una vez y cualquier aplicación compatible las use.',
        'Que las herramientas corran dentro del modelo, sin llamadas de red.',
        'Que el proveedor del modelo revise y apruebe cada herramienta antes de que un agente la pueda usar.'
      ],
      answer: 1,
      explain: 'MCP estandariza el enchufe: JSON-RPC por stdio o Streamable HTTP, con OAuth en los remotos. No resuelve la confianza: un servidor de MCP es código de un tercero que le habla a tu modelo. Repasa 25.5.'
    },
    {
      id: 'mcp-token', type: 'single',
      prompt: 'Un servidor de MCP remoto recibe un token de OAuth. ¿Qué tiene que verificar?',
      options: [
        'Que el token sea un JWT bien firmado, emitido por quien sea.',
        'Que fue emitido para él (parámetro resource), y no reenviarlo nunca a otro servicio.',
        'Nada: el host ya verificó al usuario antes de llamar.',
        'Que el token tenga permisos de administrador.'
      ],
      answer: 1,
      explain: 'El cliente pide el token con PKCE y con resource (RFC 8707), que lo ata a ese servidor. El servidor valida la audiencia y tiene prohibido reenviarlo. Repasa 25.5.'
    },
    {
      id: 'repetida', type: 'single',
      prompt: 'El modelo pide <code>buscar_pedido({"id": 8812})</code> por tercera vez en la misma tarea. ¿Qué hace el orquestador del diseño de referencia?',
      options: [
        'La ejecuta otra vez: el modelo sabe por qué la necesita, y el resultado pudo haber cambiado.',
        'Termina la tarea en seco, sin respuesta para el usuario.',
        'No la ejecuta y pide una llamada final de resumen, sin herramientas.',
        'Cambia a un modelo más grande y reinicia la tarea desde cero, con el mismo contexto.'
      ],
      answer: 2,
      explain: 'La misma firma tres veces es casi siempre un bucle. Cortar en seco deja al usuario sin nada; el resumen convierte el corte en una respuesta parcial. Sin ese corte, el bucle sigue hasta que el contexto no entra: 195 llamadas y 5.04 USD con caché. Repasa 25.6.'
    },
    {
      id: 'reserva', type: 'single',
      prompt: 'El tope de una tarea es de 1 USD. ¿Cuándo se revisa?',
      options: [
        'Al final de la tarea, cuando se conoce el uso real y se puede facturar al cliente sin estimar.',
        'Antes de cada llamada: lo gastado, más esa llamada, más una de resumen.',
        'Una vez por hora, en un proceso batch que corta las tareas que ya pasaron el tope.',
        'Solo cuando el proveedor devuelve un error de límite.'
      ],
      answer: 1,
      explain: 'Es la reserva del M18: estimar antes, reconciliar después con el uso real. Revisar después de llamar ya es tarde. Repasa 25.6.'
    },
    {
      id: 'compactar', type: 'single',
      prompt: 'Al compactar el contexto, ¿dónde tiene que estar el id de la llamada que ya hizo un reembolso?',
      options: [
        'En el resumen del modelo, que conserva lo importante.',
        'En el estado de la tarea, que maneja el orquestador y la compactación no toca.',
        'En ningún lado: después de compactar ya no hace falta.',
        'En el system prompt, que se repite en cada paso.'
      ],
      answer: 1,
      explain: 'Un resumen puede perder justo eso. Lo que tiene efectos o compromisos vive en el estado de la tarea. Repasa 25.7.'
    },
    {
      id: 'durable', type: 'multi',
      prompt: 'Un worker muere justo después de que la API de pagos hizo un reembolso, antes de guardar el resultado. ¿Qué hace que el cliente reciba un solo reembolso? Elige todas las que correspondan.',
      options: [
        'El checkpoint guardó la respuesta del modelo, con el id de la llamada, antes de ejecutarla.',
        'La llamada lleva una idempotency key hecha con el id de la tarea y el de la llamada.',
        'Al reanudar, se vuelve a llamar al modelo para que decida otra vez con el contexto completo y actualizado.',
        'La API de pagos reconoce la clave y devuelve el mismo reembolso.',
        'El worker nuevo espera 24 horas antes de reintentar.'
      ],
      answer: [0, 1, 3],
      explain: 'El checkpoint guarda la llamada pendiente, el worker nuevo la ejecuta con la misma clave y la API la reconoce. Si se volviera a llamar al modelo, podría pedir otra llamada con otro id, y otra clave. Repasa 25.8.'
    },
    {
      id: 'interrupt', type: 'single',
      prompt: 'En LangGraph, un nodo llama a <code>interrupt()</code> para pedir una aprobación. ¿Dónde va la llamada a la API de pagos?',
      options: [
        'Antes de <code>interrupt()</code>, para que el reembolso ya esté hecho y la persona solo confirme el resultado.',
        'Después de <code>interrupt()</code>, porque al reanudar el nodo corre otra vez desde el principio.',
        'En un hilo aparte que espera la aprobación con un sleep.',
        'Da igual: LangGraph guarda el estado y no repite nada del nodo al reanudar la ejecución.'
      ],
      answer: 1,
      explain: 'Al reanudar, el nodo corre desde arriba: lo que hay antes de interrupt() se repite. El efecto va después, y con una idempotency key. Repasa 25.9.'
    },
    {
      id: 'regla', type: 'single',
      prompt: 'Un asistente lee tu correo, ve tu calendario y puede buscar en la web. ¿Qué dice la regla de dos?',
      options: [
        'Está bien: no tiene ninguna herramienta para mandar correos, así que no puede sacar datos de ningún lado.',
        'Tiene las tres: correo no confiable, datos privados, y la web puede sacar datos en la URL.',
        'Solo tiene una: leer correo.',
        'La regla de dos no aplica a asistentes personales, solo a agentes que corren sin un usuario presente.'
      ],
      answer: 1,
      explain: 'Una petición a una URL es comunicarse hacia afuera: la URL puede llevar tus datos. Con las tres juntas, el agente no puede operar sin supervisión. Quitar la búsqueda o limitarla a una lista de destinos corta la pata C. Repasa 25.11.'
    },
    {
      id: 'passk', type: 'single',
      prompt: 'Un agente resuelve un caso en el 90&#8239;% de las corridas, y las corridas son independientes. ¿Cuál es pass^8?',
      options: ['0.90', '0.72', '0.43', '0.10'],
      fixed: true,
      answer: 2,
      explain: '0.9<sup>8</sup> ≈ 0.43: la probabilidad de que acierte las 8 veces. Un agente que "anda el 90&#8239;% de las veces" falla para algún cliente todos los días. Repasa 25.12.'
    },
    {
      id: 'orden', type: 'order',
      prompt: 'Ordena lo que hace el orquestador en un paso del bucle.',
      items: [
        'Revisar el presupuesto de la tarea',
        'Llamar al modelo con el contexto',
        'Sumar el uso real de tokens y su costo',
        'Verificar los permisos de cada llamada pedida',
        'Ejecutar las llamadas permitidas',
        'Guardar el checkpoint del paso'
      ],
      explain: 'El presupuesto se revisa antes de llamar, no después; los permisos, antes de ejecutar; y el checkpoint cierra el paso. Repasa 25.2 y 25.6.'
    }
  ]
});
