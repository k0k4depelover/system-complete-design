SD.defineQuiz('m20', {
  title: 'Quiz: el producto ChatGPT',
  pass: 0.7,
  questions: [
    {
      id: 'regenerar', type: 'single',
      prompt: 'El usuario pide "regenerar" la última respuesta. ¿Qué hace el sistema con los mensajes?',
      options: [
        'Agrega una respuesta nueva con el mismo padre que la anterior y mueve current_node a la nueva; la anterior queda como hermana.',
        'Borra la respuesta anterior y guarda la nueva en su lugar.',
        'Actualiza el contenido de la respuesta anterior.',
        'Crea una conversación nueva copiando los mensajes.'
      ],
      answer: 0,
      explain: 'Cada mensaje apunta a su padre: regenerar agrega un hermano y editar también. Nada se pisa, por eso se puede volver a la versión anterior y el feedback conserva el contexto exacto. Repasa 20.3.'
    },
    {
      id: 'contexto', type: 'single',
      prompt: '¿Qué mensajes se mandan al modelo en un turno?',
      options: [
        'Todos los mensajes de la conversación, en orden de creación.',
        'El camino desde la raíz hasta el padre del mensaje nuevo, recortado si no entra en la ventana.',
        'Solo los últimos diez mensajes creados.',
        'Los mensajes de todas las ramas que tienen feedback positivo.'
      ],
      answer: 1,
      explain: 'Las otras ramas son versiones que el usuario no está viendo. Se camina por parent_id hasta la raíz, se da vuelta la lista y se recorta como en el M16. Repasa 20.3.'
    },
    {
      id: 'particion', type: 'single',
      prompt: '¿Por qué conviene particionar los mensajes por conversation_id?',
      options: [
        'Porque reparte cada conversación entre muchos nodos y acelera las lecturas.',
        'Porque casi toda lectura y escritura toca una sola conversación: armar el contexto trae todos sus mensajes de una partición.',
        'Porque así el historial lateral del usuario se lee de una sola partición.',
        'Porque PostgreSQL no permite otra clave.'
      ],
      answer: 1,
      explain: 'El historial por usuario es justo lo que esta clave no resuelve: necesita su propia tabla particionada por usuario. Repasa 20.2.'
    },
    {
      id: 'idempotencia', type: 'single',
      prompt: 'El navegador manda un mensaje, la red falla antes de la respuesta y reintenta. ¿Cómo se evita generar dos respuestas?',
      options: [
        'Con un lock distribuido por usuario.',
        'El cliente genera el id del mensaje; el reintento choca con la PK y la API devuelve el turno que ya está en curso.',
        'Comparando el texto del mensaje con el anterior.',
        'Esperando 30 segundos antes de aceptar otro mensaje.'
      ],
      answer: 1,
      explain: 'Es la idempotency key del M02 sin tabla aparte: la PK de messages hace el trabajo. Comparar textos falla cuando el usuario manda dos veces lo mismo a propósito. Repasa 20.4.'
    },
    {
      id: 'reanudar', type: 'multi',
      prompt: 'El SSE se corta a mitad de una respuesta larga. ¿Qué permite que el cliente la reciba completa? Marca todo lo que corresponde.',
      options: [
        'Cada evento lleva un id creciente.',
        'La API copia los eventos a un buffer (un stream de Redis) con la clave del mensaje.',
        'La generación sigue aunque se vaya el cliente, y solo se corta si el usuario cancela.',
        'El modelo vuelve a generar la respuesta desde cero al reconectar.',
        'El cliente reconecta con Last-Event-ID y recibe los eventos que se perdió.'
      ],
      answer: [0, 1, 2, 4],
      explain: 'Volver a generar cobra los tokens dos veces y puede dar otra respuesta. El buffer desacopla la generación de la conexión. Repasa 20.4 y la figura 20.2.'
    },
    {
      id: 'chunks', type: 'single',
      prompt: 'Un documento tiene 100&#8239;000 tokens. Con fragmentos de 800 tokens que avanzan de a 400, ¿cuántos fragmentos salen, aproximadamente?',
      options: ['125', '250', '400', '800'],
      fixed: true,
      answer: 1,
      explain: 'Con 400 de solapamiento, cada fragmento nuevo avanza 400 tokens: 100&#8239;000 / 400 = 250. Se embeben 250 × 800 = 200&#8239;000 tokens. Repasa 20.5.'
    },
    {
      id: 'hibrida', type: 'single',
      prompt: 'El usuario pregunta por "la cláusula 14.3" y la búsqueda por embeddings no la encuentra. ¿Qué agregarías?',
      options: [
        'Fragmentos más grandes.',
        'Búsqueda por palabras (BM25) combinada con la vectorial, y un reranking de los candidatos.',
        'Más dimensiones en los embeddings.',
        'Mandar el documento entero en cada turno.'
      ],
      answer: 1,
      explain: 'Los embeddings capturan significado y fallan con códigos, números y nombres propios. La búsqueda híbrida con reranking es lo que usan los sistemas reales. Repasa 20.5.'
    },
    {
      id: 'sandbox', type: 'multi',
      prompt: '¿Qué condiciones pones al sandbox que corre el código que escribe el modelo? Marca todo lo que corresponde.',
      options: [
        'Una microVM o gVisor, no un contenedor que comparte el kernel con el host.',
        'Sin red, o con una lista cerrada de destinos.',
        'Límites de CPU, memoria, disco y tiempo.',
        'Acceso de lectura a los archivos de todos los usuarios, para no copiar.',
        'Un pool de sandboxes precalentados con las librerías instaladas.'
      ],
      answer: [0, 1, 2, 4],
      explain: 'El código del modelo no es confiable: aislamiento fuerte, sin salida de datos y con límites. Cada sesión ve solo los archivos de su conversación. Repasa 20.6.'
    },
    {
      id: 'moderacion', type: 'single',
      prompt: '¿Cómo se modera la salida sin perder el streaming?',
      options: [
        'Se espera la respuesta completa, se clasifica y recién después se manda.',
        'Se clasifica por tramos mientras se genera; si un tramo se marca, se corta el stream y se reemplaza lo mostrado.',
        'No se modera la salida, solo la entrada.',
        'Se clasifica cada token por separado antes de mandarlo.'
      ],
      answer: 1,
      explain: 'Esperar la respuesta completa elimina el streaming; clasificar token por token no tiene contexto y es carísimo. Por tramos es el trade-off entre latencia y lo que alcanza a verse. Repasa 20.8.'
    }
  ]
});
