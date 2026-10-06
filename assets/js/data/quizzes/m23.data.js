SD.defineQuiz('m23', {
  title: 'Quiz: imágenes y multimodal',
  pass: 0.7,
  questions: [
    {
      id: 'depende', type: 'single',
      prompt: 'Dos imágenes de 2000 × 1500 píxeles: un cielo azul liso y una planilla llena de números. ¿Cuál cuesta más tokens de entrada?',
      options: [
        'La planilla, porque tiene más detalle y el encoder genera más tokens para ella.',
        'El cielo, porque el JPEG comprime peor los degradados y el archivo pesa más.',
        'Cuestan lo mismo: los tokens dependen del tamaño en píxeles.',
        'Depende de cuánto texto lea el modelo en la imagen, que se cobra como tokens.'
      ],
      answer: 2,
      explain: 'La imagen se corta en una grilla de parches o de bloques, y cada uno es un token. Dos imágenes del mismo tamaño dan la misma grilla. Repasa 23.2.'
    },
    {
      id: 'anth', type: 'single',
      prompt: 'Con las reglas de Anthropic, una página A4 de 1075 × 1520 píxeles entra sin achicarse en alta resolución. ¿Cuántos tokens cuesta?',
      options: ['1 568', '2 145', '2 179', '4 784'],
      fixed: true,
      answer: 1,
      explain: '⌈1075 ÷ 28⌉ × ⌈1520 ÷ 28⌉ = 39 × 55 = 2&#8239;145. Los bloques de 28 px se redondean hacia arriba en cada lado. Repasa 23.2 y 23.4.'
    },
    {
      id: 'calidad', type: 'single',
      prompt: 'Un proveedor cuenta la foto de 4032 × 3024 como 765 tokens y otro como 4&#8239;740. ¿Qué es lo más importante de esa diferencia?',
      options: [
        'Que el primero es seis veces más barato por imagen con la misma calidad.',
        'Que ven imágenes distintas: a 1024 × 768 el texto chico ya no se lee.',
        'Que el segundo cuenta mal, porque suma los tokens del encoder y los del texto.',
        'Ninguna: el modelo ve la imagen original en los dos casos, solo cambia la factura.'
      ],
      answer: 1,
      explain: 'Los dos achican la foto antes de verla, a tamaños muy distintos. El precio por token también cambia, así que tampoco se puede concluir cuál es más barato. Repasa 23.2.'
    },
    {
      id: 'reescalar', type: 'multi',
      prompt: 'Una app reescala las fotos a 1568 × 1176 antes de subirlas. ¿Qué gana? Marca todas las correctas.',
      options: [
        'Unos 3.5 MB menos de base64 por foto: casi 3 s menos de subida a 10 Mbps.',
        'La mitad de los tokens en alta resolución de Anthropic.',
        'Menos tokens en el nivel estándar de Anthropic, que cobra por píxel subido.',
        'Más turnos antes del límite de 32 MB si la conversación reenvía las imágenes en base64.'
      ],
      answer: [0, 1, 3],
      explain: 'En el nivel estándar, el servidor ya achica la foto a 1270 × 952: la versión reescalada cuesta los mismos 1&#8239;564 tokens y solo ahorra bytes. Repasa 23.2 y 23.4.'
    },
    {
      id: 'encoder', type: 'single',
      prompt: 'En un modelo de 70 B, ¿qué fracción del cómputo de una foto de 4&#8239;740 tokens hace el encoder de visión de unos 300 M de parámetros?',
      options: ['Menos del 1&#8239;%', 'Cerca del 15&#8239;%', 'La mitad', 'Casi todo: el encoder es lo caro'],
      fixed: true,
      answer: 0,
      explain: '2 × 0.3 × 10⁹ × 4&#8239;740 ≈ 2.8 TFLOP contra 2 × 70 × 10⁹ × 4&#8239;740 ≈ 664 TFLOP: un 0.43&#8239;%. Con un LLM de 4 B la proporción sube al 15&#8239;%. Repasa 23.3.'
    },
    {
      id: 'epd', type: 'multi',
      prompt: '¿Por qué conviene servir el encoder de visión como una etapa separada? Marca todas las correctas.',
      options: [
        'Porque corre una vez por imagen, es compute-bound y se paraleliza bien.',
        'Porque se puede dimensionar aparte del prefill y del decode.',
        'Porque con un caché por hash, una imagen repetida no vuelve al encoder.',
        'Porque así el LLM ya no necesita hacer el prefill de los tokens de imagen en la GPU.'
      ],
      answer: [0, 1, 2],
      explain: 'Es el mismo argumento con el que el M15 separó prefill y decode. El LLM igual hace el prefill de los tokens de imagen; para saltarlo hace falta el prefix caching. Repasa 23.3.'
    },
    {
      id: 'base64', type: 'single',
      prompt: 'Una conversación sin estado manda una foto de 4.06 MB en base64 en cada turno. ¿Qué pasa en el turno 8?',
      options: [
        'Nada: el proveedor recuerda las imágenes anteriores por su hash y no las vuelve a leer.',
        'La request pasa de 32 MB y falla; hay que subirla una vez y usar su id.',
        'El modelo deja de ver las imágenes viejas porque la ventana de contexto se llena.',
        'Se cobran solo los tokens de la imagen nueva, porque las demás están en caché.'
      ],
      answer: 1,
      explain: 'La API es sin estado: en cada turno se reenvía la conversación entera, con todos los bytes. 8 × 4.06 MB son 32.5 MB. Repasa 23.4.'
    },
    {
      id: 'validar', type: 'order',
      prompt: 'Ordena los pasos para validar una imagen subida por un usuario.',
      items: [
        'Mirar los magic bytes para saber el tipo real',
        'Leer ancho y alto de la cabecera y rechazar lo que pasa el límite',
        'Decodificar en un proceso aislado con tope de memoria',
        'Quitar los metadatos EXIF',
        'Reescalar al tamaño del modelo y calcular el SHA-256'
      ],
      explain: 'Lo barato y lo que no ejecuta código va primero. Las dimensiones se miran antes de decodificar por las bombas de descompresión. Repasa 23.4.'
    },
    {
      id: 'bomba', type: 'single',
      prompt: 'Un PNG de 1.55 MB declara 20&#8239;000 × 20&#8239;000 píxeles en RGBA. ¿Qué pasa si el servidor lo decodifica sin mirar la cabecera?',
      options: [
        'Nada grave: el archivo pesa poco y entra en el límite de subida.',
        'Ocupa 1.6 GB en memoria; mil en paralelo tiran la flota de workers.',
        'El modelo lo achica automáticamente a 1568 píxeles antes de decodificarlo.',
        'Falla el SHA-256 del archivo, porque la cabecera no coincide con los datos.'
      ],
      answer: 1,
      explain: '20&#8239;000 × 20&#8239;000 × 4 bytes = 1.6 GB. Es una bomba de descompresión: el tamaño del archivo no dice nada sobre el tamaño decodificado. Repasa 23.4.'
    },
    {
      id: 'pdf', type: 'single',
      prompt: 'Para preguntas puntuales sobre el texto de un PDF de 200 páginas, ¿qué estrategia conviene y por qué?',
      options: [
        'Mandar el PDF completo como imágenes, porque el modelo lee mejor las páginas así.',
        'RAG con 10 fragmentos: unas 66 veces menos tokens que el PDF completo.',
        'El PDF completo desde el caché de prompts, que cuesta igual que RAG.',
        'Pasar el PDF a texto plano y mandarlo entero, porque el texto es más barato.'
      ],
      answer: 1,
      explain: '529&#8239;000 tokens contra 8&#8239;000. Con caché, el PDF completo sigue siendo casi siete veces más caro. Repasa 23.4.'
    },
    {
      id: 'difusion', type: 'single',
      prompt: 'Un DiT de 12 B hace unos 110 TFLOP por paso a 1024 × 1024. ¿Qué cambia más el costo por imagen?',
      options: [
        'Pasar de PNG a WebP, que pesa menos y ahorra transferencia por imagen.',
        'Pasar de 50 pasos a un modelo destilado de 4: unas 12 veces menos GPU.',
        'Subir el tamaño del batch de la cola, como en el decode de un LLM.',
        'Guardar el latente en lugar de la imagen final en S3.'
      ],
      answer: 1,
      explain: 'El costo es el modelo completo por cada paso: 50 pasos son 7 s de H100 en FP8 y 4 pasos, 0.56 s. Repasa 23.5.'
    },
    {
      id: 'resolucion', type: 'single',
      prompt: '¿Por qué generar a 2048 × 2048 cuesta más de cuatro veces que a 1024 × 1024?',
      options: [
        'Porque se necesitan más pasos de difusión para llenar el detalle extra.',
        'Porque los tokens se multiplican por 4 y la atención es cuadrática en ellos.',
        'Porque el VAE es más lento y decodifica de a un píxel por vez.',
        'No cuesta más de cuatro veces: el costo crece exactamente con los píxeles.'
      ],
      answer: 1,
      explain: 'De 4&#8239;608 a 16&#8239;896 tokens: la parte lineal crece 3.67 veces y la atención 13.4. Por eso se genera chico y se agranda después. Repasa 23.5.'
    },
    {
      id: 'jobs', type: 'multi',
      prompt: '¿Qué hace falta para que la generación de imágenes funcione como job asíncrono? Marca todas las correctas.',
      options: [
        'Un POST que responde 202 con el id del job y un Location.',
        'Un GET que dice el estado y un Retry-After mientras no termina.',
        'Una Idempotency-Key, para que un reintento del POST no cree dos jobs.',
        'Mantener la conexión HTTP abierta hasta que termine la generación.'
      ],
      answer: [0, 1, 2],
      explain: 'La request solo crea el job; el estado vive en una tabla y se consulta, se avisa por webhook o se sigue por SSE. Repasa 23.6.'
    },
    {
      id: 'fencing', type: 'single',
      prompt: 'Un worker se cuelga, su lease vence y otro worker genera la misma imagen. El primero se despierta e intenta cerrar el job. ¿Qué lo impide?',
      options: [
        'Nada: gana el último que escribe, y las dos imágenes son equivalentes.',
        'El UPDATE incluye WHERE lease_owner = :yo y no afecta ninguna fila.',
        'S3 rechaza el segundo PUT porque la clave del objeto ya existe.',
        'La cola borra el mensaje duplicado cuando el segundo worker lo confirma.'
      ],
      answer: 1,
      explain: 'Es un fencing token como el del M06: solo el dueño actual del lease puede cerrar el job. Repasa 23.8.'
    },
    {
      id: 'erlang', type: 'single',
      prompt: 'Con 2.31 imágenes por segundo en el pico y 7 s por imagen, ¿por qué no conviene operar 17 GPUs al 95&#8239;% de uso?',
      options: [
        'Porque las GPUs al 95&#8239;% se calientan y bajan su frecuencia.',
        'Porque, según Erlang C, el p95 de la espera pasa los 20 segundos.',
        'Porque el autoscaler de Kubernetes no deja pasar del 90&#8239;% de uso.',
        'Sí conviene: la espera crece de forma lineal con el uso y al 95&#8239;% es poca.'
      ],
      answer: 1,
      explain: 'Cerca del 100&#8239;% la espera crece muy rápido, sobre todo en flotas chicas. Con 24 GPUs, al 67&#8239;%, casi nadie espera. Repasa 23.7.'
    },
    {
      id: 'outbox', type: 'single',
      prompt: '¿Por qué el aviso al cliente y el evento de uso salen del outbox y no los manda el worker después de cerrar el job?',
      options: [
        'Porque el worker corre en una red privada sin acceso a internet.',
        'Porque si el worker muere después del UPDATE, el job queda sin aviso ni cobro.',
        'Porque el outbox agrupa los envíos y es más rápido que mandarlos de a uno.',
        'Porque los webhooks necesitan una firma HMAC que el worker no puede calcular.'
      ],
      answer: 1,
      explain: 'Es el patrón outbox del M07: el efecto y el aviso se escriben juntos, y un proceso aparte publica. Repasa 23.8.'
    },
    {
      id: 'moderacion', type: 'multi',
      prompt: '¿Qué es cierto sobre la moderación de imágenes generadas? Marca todas las correctas.',
      options: [
        'La capa de salida no se salta aunque el prompt haya pasado.',
        'Si el moderador cae, se falla cerrado: nada se entrega sin revisar.',
        'Moderar el prompt antes de generar ahorra GPU.',
        'Con un clasificador que detecta el 95&#8239;%, casi todo lo que se bloquea es realmente dañino.'
      ],
      answer: [0, 1, 2],
      explain: 'Con un 0.1&#8239;% de pedidos dañinos y un 0.5&#8239;% de falsos positivos, la precisión es del 16&#8239;%: es el problema de la tasa base del M22. Repasa 23.10.'
    },
    {
      id: 'c2pa', type: 'single',
      prompt: 'Alguien saca una captura de pantalla de una imagen generada con manifiesto C2PA y la publica. ¿Qué queda?',
      options: [
        'El manifiesto completo, porque C2PA lo incrusta en los píxeles.',
        'Nada del manifiesto; solo una marca invisible en los píxeles, si la tenía.',
        'Solo la firma, sin las aserciones, porque va en el borde de la imagen.',
        'El manifiesto, siempre que la captura se guarde como PNG sin pérdida.'
      ],
      answer: 1,
      explain: 'C2PA viaja con el archivo y se pierde con él; por eso se complementa con marcas invisibles como SynthID. Repasa 23.11.'
    }
  ]
});
