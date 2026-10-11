/* Checkpoint B: examen integrador de la Parte II (M12 a M26). Cada explicación dice qué módulo repasar. */
SD.defineQuiz('cpb', {
  title: 'Examen del Checkpoint B',
  pass: 0.7,
  questions: [
    {
      id: 'tpot-streams', type: 'single',
      prompt: 'Una réplica sirve un 70B en FP8 en 4 H100. Al pasar de 100 a 200 streams, el TPOT sube de 18 a 30 ms. ¿Qué explica la subida?',
      options: [
        'La atención de cada paso crece con el cuadrado de la cantidad de streams del batch.',
        'Cada paso de decode lee el KV cache de todos los streams, además de los pesos.',
        'El tensor parallelism sincroniza por NVLink una copia de los pesos por cada stream.',
        'El motor hace entero el prefill de cada stream nuevo antes de seguir con el decode.'
      ],
      answer: 1,
      explain: 'El decode está limitado por memoria: cada paso lee los pesos una vez y el KV cache de cada stream. Con más streams, más bytes por paso y más TPOT. La atención no compara streams entre sí, y el chunked prefill existe justamente para no frenar el decode. Repasa M12, la memoria, y M13, roofline.'
    },
    {
      id: 'sizing', type: 'single',
      prompt: '¿Cómo dimensiona el M13 cuántas GPUs necesita una réplica?',
      options: [
        'Dividiendo los FLOPs del modelo por los TFLOPS de una GPU y redondeando al tamaño del nodo.',
        'Tomando la memoria de los pesos en BF16 y multiplicándola por cuatro, para gradientes y activaciones.',
        'Sumando pesos, KV cache del pico y una reserva, y comprobando el TPOT con bytes ÷ ancho de banda.',
        'Midiendo la utilización de nvidia-smi con una GPU y sumando GPUs hasta que baje del 75&#8239;%.'
      ],
      answer: 2,
      explain: 'Primero la memoria (pesos, KV cache de los usuarios en el pico y unos 5 GB de reserva por GPU), redondeada a una cantidad de GPUs posible, y después la velocidad: el TPOT teórico es lo que se lee por paso dividido por el ancho de banda. Los gradientes son de entrenamiento (M26), y la utilización de nvidia-smi no mide cuánto de la GPU se usa (M19). Repasa M13, sizing.'
    },
    {
      id: 'fp8-streams', type: 'single',
      prompt: 'Con 4 H100 y un TPOT teórico de 15 ms, una réplica de 70B en BF16 (pesos y KV cache) atiende 57 streams de 3200 tokens. Si pasas pesos y KV cache a FP8, ¿qué pasa con los streams?',
      options: [
        'Se duplican justo, porque cada parámetro y cada token ocupan la mitad de bytes.',
        'Casi no cambian, porque la cantidad de streams la limita el cómputo de cada paso.',
        'Bajan a la mitad, porque FP8 obliga a repartir los pesos en la mitad de las GPUs.',
        'Se multiplican por cuatro o más, porque los pesos dejan de llevarse casi todo el paso.'
      ],
      answer: 3,
      explain: 'En cada paso entran 13.4 TB/s × 15 ms = 201 GB. En BF16, los pesos se llevan 141 y quedan 60 para el KV cache: 57 streams de 1.05 GB. En FP8, los pesos se llevan 70.6 y quedan 130 para streams de 0.52 GB: unos 248, más de cuatro veces. Los pesos se leen una vez por paso, y bajarlos libera todo el resto. Repasa M14, impacto, y la sección "La réplica" de la solución.'
    },
    {
      id: 'fp8-evals', type: 'single',
      prompt: 'Antes de pasar toda la flota a FP8, ¿qué se mide?',
      options: [
        'Evals de tus tareas por categoría contra la versión BF16, con contextos largos, y después un canary.',
        'La perplejidad global: si no se mueve más de un punto, ninguna tarea del producto puede empeorar.',
        'El TTFT y el TPOT del canary, que suben cuando el modelo cuantizado contesta peor que el original.',
        'Nada: en modelos de más de 30B, FP8 es una conversión exacta que no cambia ninguna respuesta.'
      ],
      answer: 0,
      explain: 'FP8 casi no pierde en un 70B, pero las tareas no degradan igual: los contextos largos, el código y el JSON fallan antes que una charla. La perplejidad engaña, y la latencia no dice nada de la calidad. Se mide con evals por categoría y después en producción. Repasa M14, cuánto se pierde, y M22, evals.'
    },
    {
      id: 'chunked', type: 'single',
      prompt: 'Un prompt de 30&#8239;000 tokens entra entero en una iteración, y todos los streams en decode ven un salto de medio segundo entre dos tokens. ¿Qué opción de vLLM controla eso?',
      options: [
        '<code>--max-num-seqs</code>, el techo de requests que entran juntas en el batch.',
        '<code>--max-num-batched-tokens</code>, el presupuesto de tokens de cada iteración.',
        '<code>--gpu-memory-utilization</code>, la fracción de memoria para el KV cache.',
        '<code>--max-model-len</code>, el contexto más largo que el motor acepta.'
      ],
      answer: 1,
      explain: 'Con chunked prefill, el prompt se parte en trozos y cada iteración mezcla un trozo con los pasos de decode de los demás, sin pasar del presupuesto de tokens. Trozos chicos protegen el TPOT de todos; trozos grandes terminan antes el prefill. Repasa M15, chunked prefill.'
    },
    {
      id: 'desagregar', type: 'single',
      prompt: '¿Cuándo conviene desagregar el prefill y el decode en grupos de GPUs distintos?',
      options: [
        'Cuando los prompts son cortos, porque el KV cache que hay que mover entre grupos pesa poco.',
        'Siempre que la flota pase de 100 réplicas, para que cada grupo escale con su propia métrica.',
        'Cuando los prompts son largos y los SLOs de TTFT y de TPOT son exigentes a la vez.',
        'Cuando el modelo no entra en una sola GPU y hay que repartirlo con tensor parallelism.'
      ],
      answer: 2,
      explain: 'La desagregación cambia la interferencia entre fases por transferencia de datos: cada request mueve su KV cache una vez por una red muy rápida. Se paga con prompts largos y SLOs exigentes; con prompts cortos, o con el historial en caché, mover el cache y operar dos grupos no compensa. Repasa M15, prefill y decode en máquinas distintas.'
    },
    {
      id: 'speculative', type: 'single',
      prompt: '¿Por qué muchos motores activan el speculative decoding solo cuando la carga es baja?',
      options: [
        'Porque con carga alta el modelo chico propone tokens con otra distribución que el grande.',
        'Porque con batches grandes ya no sobra cómputo, y cada token rechazado frena a todos.',
        'Porque el modelo chico ocupa KV cache que, con carga alta, necesitan los streams.',
        'Porque con carga alta los prompts son más variados y la aceptación cae casi a cero.'
      ],
      answer: 1,
      explain: 'El speculative decoding gasta cómputo para ganar latencia, y el resultado tiene la misma distribución que el modelo grande solo. Con pocos usuarios sobra cómputo en el decode; con batches grandes ya no, y el trabajo perdido en los tokens rechazados frena a todo el batch. Repasa M15, speculative decoding.'
    },
    {
      id: 'fecha-prompt', type: 'single',
      prompt: 'Un equipo agrega la fecha y la hora al principio del prompt de sistema. La calidad no cambia, pero la factura sube. ¿Por qué?',
      options: [
        'Porque el modelo tiene que procesar la fecha en cada paso de decode, no solo en el prefill.',
        'Porque el proveedor cobra aparte los tokens de sistema que cambian entre dos requests.',
        'Porque el prefijo cambia en cada request y el prompt caching deja de acertar.',
        'Porque la fecha obliga al motor a desactivar el batching para esas requests.'
      ],
      answer: 2,
      explain: 'El caché reutiliza el prefijo idéntico más largo. Lo estable va primero y lo que cambia, al final: una fecha al principio invalida todo lo que viene después, y cada request paga el prompt entero al precio sin descuento. Se detecta con la tasa de tokens en caché. Repasa M16, prompt caching.'
    },
    {
      id: 'reanudar', type: 'single',
      prompt: 'En el chat, el usuario entra a un ascensor y se corta la conexión a mitad de una respuesta larga. ¿Qué diseño hace que la vea completa al volver?',
      options: [
        'Un worker escribe cada evento numerado en un buffer, y el cliente reconecta con <code>Last-Event-ID</code>.',
        'El servidor de la API guarda el stream en su memoria y el balanceador devuelve al cliente a esa instancia.',
        'El cliente reintenta con la misma clave de idempotencia, y el motor regenera exactamente la misma respuesta.',
        'El proxy acumula la respuesta entera y se la entrega de una sola vez cuando el cliente se vuelve a conectar.'
      ],
      answer: 0,
      explain: 'Un stream reanudable separa la generación de la conexión: el worker genera una sola vez, escribe en un buffer como un stream de Redis, y cualquier instancia de la API atiende la reconexión desde el número que pide el cliente. Regenerar da otra respuesta y la paga de nuevo, y una instancia puede caerse. Repasa M17, streams que sobreviven a un corte.'
    },
    {
      id: 'cancelar', type: 'single',
      prompt: 'Con streams reanudables, ¿qué tiene que pasar cuando el usuario pulsa Detener?',
      options: [
        'Nada especial: al cerrar la pestaña, la conexión se corta y el motor deja de generar solo.',
        'El cliente llama a un endpoint de cancelación y el motor saca la request del batch.',
        'El servidor deja de mandar eventos y el motor termina la respuesta para guardarla completa.',
        'El cliente deja de leer el stream y el buffer descarta los eventos que llegan después.'
      ],
      answer: 1,
      explain: 'Si el producto permite reanudar, una conexión cerrada ya no puede significar "cancelar": el usuario del túnel quiere la respuesta terminada al salir. Por eso Detener tiene su propio endpoint, idempotente, que llega hasta el motor y libera los bloques del KV cache. Repasa M17, cuando el cliente se va.'
    },
    {
      id: 'codigos', type: 'single',
      prompt: 'Un cliente de la API recibe un 503 con <code>Retry-After</code>. ¿Qué le dice el sistema que no le diría un 429?',
      options: [
        'Que superó su cuota de tokens por minuto y tiene que frenar antes de reintentar.',
        'Que pidió un <code>max_tokens</code> tan grande que su reserva no entraba en el balde.',
        'Que está dentro de su cuota y el que no da abasto en este momento es el proveedor.',
        'Que el modelo pedido no está en esa región y tiene que cambiar de endpoint.'
      ],
      answer: 2,
      explain: 'El 429 dice que el cliente superó su cuota y tiene que frenar. El 503 (o el 529) dice que el problema es la flota: reintentar después, en otra región o con otro modelo, es lo correcto. Si todo sale como 429, los clientes bien hechos se frenan por un problema que no es suyo. Repasa M18, admission control.'
    },
    {
      id: 'reserva', type: 'single',
      prompt: 'Al admitir una request, el limitador reserva la entrada más una estimación de la salida. ¿Qué estimación conviene?',
      options: [
        'Siempre <code>max_tokens</code>: nunca se pasa del límite y así no hace falta reconciliar después.',
        'Cero: la salida se descuenta a medida que sale, y reservarla solo frena a los clientes.',
        'El promedio de salida de toda la flota, que es más estable que el de un solo cliente.',
        'El p95 reciente de ese cliente con ese modelo, y <code>max_tokens</code> con tope si es nuevo.'
      ],
      answer: 3,
      explain: 'El p95 casi nunca se queda corto, y cuando se queda corto la deuda es chica. Reservar <code>max_tokens</code> rechaza a clientes que tenían cuota; contar solo al final deja que una ráfaga pase del límite. Al terminar se reconcilia con lo real, y si la request muere, la reserva vence sola como un lease. Repasa M18, reservar, consumir y reconciliar.'
    },
    {
      id: 'round-robin', type: 'single',
      prompt: 'Una flota de 125 réplicas reparte con round robin. ¿Qué parte del prompt reutiliza del KV cache cada turno de una conversación?',
      options: [
        'Todo el historial, porque el índice de prefijos copia los bloques a la réplica elegida.',
        'Casi solo el prompt de sistema: el turno cae en la réplica anterior una vez cada 125.',
        'Nada, porque el motor borra el prefix cache al terminar cada request para liberar memoria.',
        'Todo, porque las réplicas de la misma región comparten el KV cache por la red rápida.'
      ],
      answer: 1,
      explain: 'El prefix caching solo funciona si la request llega a la réplica que tiene el prefijo. Con round robin, el prompt de sistema está en todas, pero el historial solo en la réplica del turno anterior. Por eso el routing consciente del prefijo, con un techo de carga, reutilizó el 89&#8239;% del prompt contra el 34&#8239;% de round robin. Repasa M19, routing consciente del prefijo.'
    },
    {
      id: 'hpa', type: 'single', fixed: true,
      prompt: 'Una región tiene 7 réplicas con un uso de KV cache del 92&#8239;%, y el objetivo es del 75&#8239;%. ¿Cuántas réplicas pide el Horizontal Pod Autoscaler?',
      options: ['7', '8', '9', '11'],
      answer: 2,
      explain: 'deseadas = ceil(actuales × métrica ÷ objetivo) = ceil(7 × 0.92 ÷ 0.75) = ceil(8.59) = 9. La fórmula dice cuántas, no cuándo llegan: el colchón cubre lo que crece la demanda mientras arrancan. Repasa M19, autoscaling.'
    },
    {
      id: 'colchon', type: 'single',
      prompt: 'La demanda crece un 3&#8239;% por minuto en la subida de la mañana. ¿Qué reduce más el colchón de réplicas que hay que tener corriendo?',
      options: [
        'Medir la utilización de GPU de nvidia-smi, que reacciona antes que el uso del KV cache.',
        'Bajar a cero la ventana de estabilización del HPA, para que reaccione en cada lectura.',
        'Pasar a instancias spot, que la nube entrega más rápido porque las tiene ociosas.',
        'No depender de conseguir un nodo en el pico: pesos en NVMe o un pool precalentado.'
      ],
      answer: 3,
      explain: 'El colchón cubre lo que crece la demanda durante un arranque. Con un nodo nuevo, el arranque tarda casi nueve minutos y pide 30 réplicas de colchón por cada 100; con los pesos en NVMe, 84 s y 5; con un pool precalentado, 27 s y 2. Lo que más pesa es conseguir el nodo. Repasa M19, cold start y carga de pesos.'
    },
    {
      id: 'detener-arbol', type: 'single',
      prompt: 'El usuario pulsa Detener cuando la respuesta va por la mitad. ¿Qué queda en la tabla de mensajes?',
      options: [
        'La respuesta parcial, guardada en su misma rama con el estado <code>interrupted</code>.',
        'Nada: la respuesta incompleta se descarta y el usuario la vuelve a pedir.',
        'La respuesta parcial, en una tabla aparte para no ensuciar el árbol de la conversación.',
        'La respuesta completa, que el motor terminó de generar después del clic.'
      ],
      answer: 0,
      explain: 'Cada mensaje guarda su padre y su estado: <code>in_progress</code>, <code>complete</code> o <code>interrupted</code>. Una respuesta cortada queda guardada como tal, en su rama, y el turno siguiente la incluye en el contexto. Repasa M20, los mensajes son un árbol.'
    },
    {
      id: 'evento-uso', type: 'single',
      prompt: '¿Quién emite el evento de uso que se cobra, y con qué <code>event_id</code>?',
      options: [
        'El motor, al terminar cada request, con un UUID nuevo en cada envío.',
        'El gateway, al cerrar el stream, con un id derivado de la propia request.',
        'El cliente, al recibir el último token, firmado con su propia API key.',
        'El metering, al leer los logs del motor, con la hora de la request como id.'
      ],
      answer: 1,
      explain: 'El gateway sabe a quién cobrar y qué recibió el cliente, y el último evento del stream le trae el uso que contó el motor. Un id derivado de la request hace que el mismo evento, reenviado por el outbox después de un reinicio, se descarte; un UUID nuevo por envío lo cobraría dos veces. El registro del motor sirve para conciliar. Repasa M21, emitir sin perder.'
    },
    {
      id: 'calidad', type: 'single',
      prompt: 'Después de desplegar una versión nueva, la tasa de errores, el TTFT y el TPOT siguen iguales. ¿Dónde se ve si contesta peor?',
      options: [
        'En la tasa de 5xx de la versión nueva, que sube cuando el modelo responde mal.',
        'En el uso del KV cache, que crece cuando las respuestas se alargan por errores.',
        'En la latencia de la moderación, que tarda más cuando el modelo se equivoca.',
        'En la tasa de regeneración y los evals por versión, comparadas con la estable.'
      ],
      answer: 3,
      explain: 'Las fallas típicas de un modelo responden con un 200: respuestas peores, más cortas o fuera de tema. Hay que medir la calidad aparte, con señales del producto como la tasa de regeneración (los hermanos de una respuesta en el árbol del M20) y con evals, por versión. Repasa M22, evals y canary.'
    },
    {
      id: 'imagen', type: 'single',
      prompt: 'Una app de chat sin estado reenvía en cada turno una foto de 4 MB codificada en base64. ¿Qué cambia el diseño?',
      options: [
        'Mandarla solo en el primer turno, porque el modelo la recuerda en los turnos siguientes.',
        'Subirla una sola vez a un almacenamiento de objetos y mandar en cada turno su id.',
        'Convertirla a texto con OCR en el cliente y reenviar ese texto en cada turno.',
        'Recomprimirla en cada turno con una calidad menor, para que cueste menos tokens.'
      ],
      answer: 1,
      explain: 'El modelo no guarda estado entre requests: la foto tiene que estar en cada turno. Lo que se evita es reenviar los bytes: con 4 MB por turno, la request pasa los límites de tamaño en pocos turnos. Además, los tokens de una imagen dependen de sus píxeles, no de la compresión. Repasa M23, imágenes de entrada.'
    },
    {
      id: 'lora', type: 'single',
      prompt: 'Un equipo quiere afinar el 70B para su dominio, con poco presupuesto y sin agregar latencia al servirlo. ¿Qué elige?',
      options: [
        'LoRA, y al terminar suma las matrices del adaptador a los pesos originales.',
        'Un fine-tuning completo con ZeRO-3, que reparte los estados y sale igual de barato.',
        'RLHF con un modelo de recompensa, que cambia el estilo sin tocar los pesos.',
        'Un prompt de sistema más largo, que afina el modelo sin entrenar y sin costo.'
      ],
      answer: 0,
      explain: 'LoRA congela el modelo y entrena dos matrices chicas de rango bajo por capa: mucha menos memoria que un fine-tuning completo, que necesita unas ocho veces la memoria de servir. Al terminar, el adaptador se suma a los pesos y no agrega latencia. RLHF sí cambia los pesos, y un prompt más largo cuesta en cada request. Repasa M26, LoRA.'
    }
  ]
});
