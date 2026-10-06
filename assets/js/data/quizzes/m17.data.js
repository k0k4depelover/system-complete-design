SD.defineQuiz('m17', {
  title: 'Quiz: diseño de la API del LLM',
  pass: 0.7,
  questions: [
    {
      id: 'doscientos', type: 'single',
      prompt: 'Un servidor de streaming manda el <code>200</code> y los headers antes de generar el primer token. ¿Qué consecuencia tiene para el diseño?',
      options: [
        'Ninguna: si algo falla, el servidor cambia el código de estado a 500 en los trailers.',
        'Un fallo posterior tiene que avisarse dentro del stream, porque el 200 ya salió.',
        'El cliente tiene que reintentar cada respuesta que empieza con 200 hasta ver el final.',
        'El servidor tiene que generar la respuesta completa antes de mandar los headers.'
      ],
      answer: 1,
      explain: 'Con los headers enviados, el código de estado quedó fijo. Por eso existen los eventos de error (event: error, response.failed) y por eso el éxito es [DONE], response.completed o message_stop, no el 200. Repasa 17.3 y 17.8.'
    },
    {
      id: 'buffering', type: 'single',
      prompt: 'En tu máquina el streaming funciona. En producción, detrás de un Nginx nuevo, los usuarios ven la respuesta entera de golpe después de 20 segundos, y el TTFT del servidor sigue perfecto. ¿Qué es lo más probable?',
      options: [
        'El modelo es más lento en producción porque comparte las GPUs con más usuarios.',
        'El proxy acumula la respuesta antes de reenviarla: hay que desactivar el buffering.',
        'Falta el header Content-Length, y sin él el navegador espera a que se cierre la conexión.',
        'Los usuarios tienen conexiones lentas que no alcanzan a recibir los tokens a tiempo.'
      ],
      answer: 1,
      explain: 'El TTFT del servidor se mide donde sale el primer token, no donde se lo ve: por eso el dashboard no muestra el problema. Hay que medir también en el cliente. Repasa 17.3, la infraestructura entre medio.'
    },
    {
      id: 'cancelar', type: 'multi',
      prompt: 'El usuario cierra la pestaña a mitad de una respuesta. ¿Qué es cierto?',
      options: [
        'La señal de cancelación es que la conexión se cerró.',
        'Cada salto tiene que notar el cierre y cerrar su propia llamada hacia adentro.',
        'Si nadie avisa al motor, la GPU sigue generando tokens que nadie lee.',
        'SSE manda automáticamente un evento de cancelación al servidor cuando el navegador cierra la pestaña.',
        'vLLM aborta la request y libera su KV cache cuando se cierra la conexión.'
      ],
      answer: [0, 1, 2, 4],
      explain: 'SSE va en un solo sentido: el cliente no manda eventos. La cancelación viaja como cierres de conexión, salto por salto, hasta el motor. Repasa 17.4.'
    },
    {
      id: 'little', type: 'single',
      prompt: 'Tu API recibe 1000 requests por segundo con streaming, y cada stream dura en promedio 20 segundos. ¿Cuántos streams abiertos sostienen los gateways?',
      options: ['1000', '20 000', '50', '200 000'],
      answer: 1,
      fixed: true,
      explain: 'Por la ley de Little, los elementos dentro del sistema son la tasa de llegada por el tiempo que permanecen: 1000 × 20 = 20 000 conexiones abiertas a la vez. Lo que dimensiona un gateway de streaming son las conexiones, no las requests por segundo. Repasa la calculadora de 17.3.'
    },
    {
      id: 'reanudar', type: 'single',
      prompt: 'Quieres que una respuesta siga cuando el teléfono cambia de red a mitad del stream, sin generar nada dos veces. ¿Qué hace falta?',
      options: [
        'Subir el timeout del balanceador para que la conexión sobreviva al cambio de red.',
        'Guardar cada evento con un número de secuencia y reconectar desde el último recibido.',
        'Que el cliente repita la request con la misma idempotency key y reciba la respuesta de nuevo.',
        'Usar WebSockets en lugar de SSE, que mantienen la conexión al cambiar de red.'
      ],
      answer: 1,
      explain: 'Si la generación vive en la conexión, se muere con ella. Con los eventos guardados por respuesta y numerados, cualquier instancia puede reenviar desde Last-Event-ID o starting_after. Repasa 17.5.'
    },
    {
      id: 'herramienta', type: 'single',
      prompt: 'Con tool calling, el modelo pide <code>buscar_pedido</code> con <code>pedido_id: "8812"</code>. ¿Quién ejecuta la función y qué verifica?',
      options: [
        'La ejecuta el modelo, que ya comprobó los permisos del usuario al leer la sesión.',
        'La ejecuta tu aplicación, que valida los argumentos y que el pedido sea del usuario.',
        'La ejecuta el proveedor de la API con tus credenciales, y verifica el esquema de argumentos.',
        'Nadie: los argumentos se devuelven al usuario para que él busque el pedido.'
      ],
      answer: 1,
      explain: 'El modelo solo propone la llamada, y puede equivocarse o ser manipulado por un texto que leyó. Los argumentos no son una autorización. Repasa 17.6.'
    },
    {
      id: 'restringida', type: 'single',
      prompt: '¿Cómo garantiza el motor que una salida estructurada cumpla el JSON Schema?',
      options: [
        'Le agrega al prompt una instrucción que pide respetar el esquema, con un ejemplo válido.',
        'Genera varias respuestas en paralelo y se queda con la primera que valida.',
        'En cada paso de decode enmascara los tokens que dejarían el JSON fuera del esquema.',
        'Corrige el JSON después de generarlo, agregando o quitando campos según el esquema.'
      ],
      answer: 2,
      explain: 'Es decodificación restringida: el modelo sigue eligiendo, pero solo entre los tokens válidos. Por eso la primera request con un esquema nuevo tarda más: la gramática se compila y se guarda en caché. Repasa 17.7.'
    },
    {
      id: 'gasto', type: 'single',
      prompt: 'Recibes un 429 sin <code>Retry-After</code> y con <code>error_code: enforced_spend_limit_reached</code>. ¿Qué haces?',
      options: [
        'Reintentas con backoff exponencial y jitter hasta que el límite se libere.',
        'No reintentas: es el tope de gasto del mes y no se libera esperando.',
        'Reintentas contra otra región, que tiene su propio tope de gasto independiente.',
        'Bajas max_tokens y reintentas con una request más chica.'
      ],
      answer: 1,
      explain: 'Un 429 por límite de tasa trae Retry-After y se resuelve frenando. El tope de gasto no: reintentar solo agrega requests que fallan. Repasa 17.8.'
    },
    {
      id: 'orden-cancelacion', type: 'order',
      prompt: 'Ordena lo que pasa desde que el usuario pulsa "Detener" hasta que la GPU queda libre:',
      items: [
        'El cliente llama a AbortController.abort() y cierra la conexión',
        'El balanceador cierra la conexión con el servidor de la API',
        'El servidor de la API detecta la desconexión y cancela su llamada al motor',
        'El motor saca la request del batch y libera sus bloques del KV cache',
        'Se registra el uso parcial para facturar'
      ],
      explain: 'Cada salto solo ve su propia conexión: la cancelación avanza cierre por cierre. El uso parcial se registra igual, porque esos tokens ya gastaron GPU. Repasa 17.4.'
    }
  ]
});
