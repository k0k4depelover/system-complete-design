SD.defineQuiz('m02', {
  title: 'Quiz: protocolos y diseño de APIs',
  pass: 0.7,
  questions: [
    {
      id: 'metodos', type: 'multi',
      prompt: '¿Qué métodos HTTP son idempotentes según la especificación?',
      options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      answer: [0, 2, 3],
      explain: 'GET, PUT y DELETE dejan el mismo estado aunque se repitan: poner el mismo recurso dos veces, o borrarlo dos veces, termina igual. POST crea algo nuevo cada vez, y PATCH puede o no ser idempotente según la operación ("sumar 1" no lo es).'
    },
    {
      id: 'offset', type: 'single',
      prompt: 'Un feed usa <code>?offset=40&amp;limit=20</code>. Mientras el usuario lee la página 2, se publican 3 posts nuevos. ¿Qué ve al pedir la página 3?',
      options: [
        'Exactamente los posts 41 a 60 que había al empezar, porque el offset es fijo.',
        'Repite 3 posts que ya vio en la página 2, porque todo se corrió 3 lugares.',
        'Un error 409 Conflict, porque la colección cambió desde la primera página.',
        'Se saltea 3 posts, porque los nuevos empujan a los viejos hacia la página siguiente.'
      ],
      answer: 1,
      explain: 'Con inserciones al principio, todo se desplaza y el OFFSET cae 3 posiciones antes: se repiten elementos (y con borrados, se saltean). La paginación por cursor ("después del post X") no tiene ese problema y además no se vuelve lenta con la profundidad.'
    },
    {
      id: 'idem', type: 'single',
      prompt: 'Un cliente reintenta un <code>POST /pagos</code> con la misma Idempotency-Key, pero con un monto distinto. ¿Qué debería responder el servidor?',
      options: [
        'Procesar el nuevo monto: la clave solo evita duplicados exactos de la misma request.',
        'Devolver la respuesta guardada del primer intento, sin mirar el cuerpo nuevo.',
        'Un error 409 o 422: la misma clave con otro cuerpo es un bug del cliente.',
        'Un 200 con el monto nuevo y una advertencia en un header, para no romper al cliente.'
      ],
      answer: 2,
      explain: 'El servidor guarda un hash del cuerpo junto con la clave. Si llega la misma clave con otro cuerpo, no es un reintento sino un error del cliente, y aplicar cualquiera de las dos opciones silenciosamente sería peligroso.'
    },
    {
      id: 'concur', type: 'single',
      prompt: 'Dos personas editan el mismo documento y guardan con PUT casi a la vez. ¿Cómo evitas que la segunda pise los cambios de la primera sin enterarse?',
      options: [
        'Con un lock exclusivo de 10 minutos al abrir el editor, que el servidor libera al guardar.',
        'Con concurrencia optimista: el PUT manda If-Match con el ETag leído y, si cambió, recibe 412.',
        'Con last-write-wins y la hora del cliente: gana el PUT con el timestamp más reciente.',
        'Con PUT idempotente: si llega una segunda escritura, el servidor la descarta.'
      ],
      answer: 1,
      explain: 'If-Match convierte el PUT en "guardar solo si nadie cambió esto desde que lo leí". El segundo recibe 412 Precondition Failed, recarga y decide. Es barato y no bloquea a nadie.'
    },
    {
      id: 'grpc', type: 'single',
      prompt: '¿Dónde encaja mejor gRPC?',
      options: [
        'En la API pública para navegadores de terceros, porque el binario pesa menos que JSON.',
        'Entre servicios internos, con contratos tipados, alto volumen y streaming.',
        'En los webhooks hacia clientes, porque el contrato .proto les evita validar la firma.',
        'Para servir imágenes por una CDN, porque HTTP/2 multiplexa las descargas.'
      ],
      answer: 1,
      explain: 'gRPC brilla adentro: binario, tipado, HTTP/2, deadlines y streaming. Hacia afuera, los navegadores no lo hablan de forma nativa (necesita gRPC-Web y un proxy) y las cachés HTTP no lo entienden.'
    },
    {
      id: 'n1', type: 'single',
      prompt: 'Una query GraphQL pide 50 posts y el autor de cada uno. El servidor hace 1 consulta para los posts y 50 para los autores. ¿Cómo se llama el problema y cómo se resuelve?',
      options: [
        'Over-fetching; se resuelve pidiendo solo los campos necesarios en la query.',
        'Problema N+1; se resuelve cargando los autores por lote (DataLoader).',
        'Head-of-line blocking; se resuelve paralelizando los 50 resolvers con HTTP/3.',
        'Cache stampede; se resuelve cacheando cada autor con un TTL con jitter.'
      ],
      answer: 1,
      explain: 'Cada resolver pide su autor por separado. Un DataLoader junta todas las claves pedidas en el mismo ciclo y hace un único <code>WHERE id IN (…)</code>.'
    },
    {
      id: 'tiempo-real', type: 'single',
      prompt: 'Un tablero muestra precios que cambian varias veces por segundo; el cliente nunca envía datos al servidor por ese canal. ¿Qué eliges?',
      options: ['Polling cada 100 ms', 'SSE', 'Webhooks', 'GraphQL sobre POST'],
      answer: 1,
      explain: 'El flujo es solo del servidor al cliente: SSE es HTTP normal, atraviesa proxies, reconecta solo y reanuda con Last-Event-ID. WebSocket también sirve, pero agrega un canal bidireccional que no necesitas. El polling agresivo desperdicia requests.'
    },
    {
      id: 'webhook', type: 'multi',
      prompt: '¿Qué debe hacer el endpoint que <b>recibe</b> webhooks de un proveedor de pagos?',
      options: [
        'Verificar la firma HMAC y que el timestamp sea reciente.',
        'Procesar todo el pedido antes de responder, para confirmar solo lo que de verdad se guardó.',
        'Deduplicar por el id del evento.',
        'Responder 2xx rápido y procesar en segundo plano.',
        'Rechazar con 409 los eventos que llegan fuera de orden, para que el proveedor los reenvíe.'
      ],
      answer: [0, 2, 3],
      explain: 'La entrega es al menos una vez y sin orden garantizado. Si tardas, el proveedor asume falla y reintenta; si no deduplicas, procesas dos veces. La firma evita que cualquiera invente eventos, y el timestamp evita que reenvíen uno viejo.'
    },
    {
      id: 'breaking', type: 'single',
      prompt: '¿Cuál de estos cambios en una API pública rompe clientes existentes?',
      options: [
        'Agregar un campo opcional nuevo en la respuesta, como <code>currency</code>.',
        'Agregar un endpoint nuevo.',
        'Renombrar el campo <code>amount</code> a <code>total</code>.',
        'Aceptar un parámetro opcional nuevo en la query, con un valor por defecto.'
      ],
      answer: 2,
      explain: 'Renombrar o quitar un campo rompe a quien lo lee. Agregar cosas opcionales es compatible siempre que los clientes ignoren lo que no conocen (tolerant reader). Los cambios que rompen van en una versión nueva.'
    },
    {
      id: 'keyset-costo', type: 'single',
      prompt: 'Un índice B-tree tiene 100 millones de entradas. ¿Cuánto cuesta pedir la página 5&#8239;000 (de a 20) con un cursor <code>(created_at, id) &lt; marca</code>?',
      options: [
        'O(1): el cursor guarda la dirección física de la fila y salta directo a ella.',
        'O(log n + k): bajar unos 4 niveles del árbol y leer las 20 entradas que siguen.',
        'O(offset + k): igual que OFFSET, aunque sin repetir filas cuando hay inserts.',
        'O(n): la condición sobre dos columnas impide usar el índice y obliga a recorrerlo.'
      ],
      answer: 1,
      explain: 'El cursor es una búsqueda por valor: el árbol baja de la raíz a la hoja donde está la marca y lee k entradas seguidas. Con unas 200 entradas por página, 100 millones caben en 4 niveles, y los niveles altos suelen estar en memoria: en la práctica parece constante, pero es logarítmico. OFFSET, en cambio, es O(offset + k): el árbol no sabe buscar por posición. Repasa 2.3, "Cuánto cuesta cada una".'
    },
    {
      id: 'commit-tardio', type: 'single',
      prompt: 'Un cliente contable sincroniza cada 5 minutos con <code>created_at &gt; última_marca</code>. Las filas se insertan con <code>created_at = now()</code> en transacciones que a veces tardan 3 s. De vez en cuando, un movimiento nunca llega al cliente. ¿Por qué, y qué lo arregla?',
      options: [
        'Porque los relojes del cliente y del servidor no coinciden; se arregla sincronizando ambos con NTP.',
        'Porque now() es la hora de inicio de la transacción; se arregla con una ventana de solape y deduplicando por id.',
        'Porque un cursor por timestamp no es estable; se arregla volviendo a OFFSET ordenado por id.',
        'Porque falta un índice en created_at y la consulta corta por timeout; se arregla creándolo.'
      ],
      answer: 1,
      explain: 'La fila se vuelve visible al confirmar, pero lleva la hora en que empezó la transacción. Si el cliente sincronizó en el medio, su marca ya está por delante de esa fila, y nunca vuelve a pedir ese rango. Pedir lo posterior a "marca − 10 s" y descartar por id lo repetido la atrapa; un log con posición de commit (Kafka, outbox numerada) lo resuelve de raíz. OFFSET no ayuda. Repasa 2.3, "Qué pasa cuando llegan inserts".'
    },
    {
      id: 'cursor-borrado', type: 'single',
      prompt: 'El cliente tiene un cursor que apunta al post_88. Antes de pedir la página siguiente, alguien borra el post_88. ¿Qué pasa?',
      options: [
        'La API responde 404, porque el cursor apunta a una fila que ya no existe.',
        'Sale bien: el cursor guarda valores (created_at, id) y compara contra ellos.',
        'Se repite la página anterior, porque el índice vuelve a la última posición válida.',
        'El cliente tiene que volver a la página 1, porque el cursor queda inválido.'
      ],
      answer: 1,
      explain: 'Un cursor no es una referencia a una fila sino un punto en el orden. <code>(created_at, id) &lt; (t, post_88)</code> funciona aunque post_88 ya no esté.'
    },
    {
      id: 'soap-seguridad', type: 'multi',
      prompt: 'Un banco exige WS-Security con firma X.509 aunque la conexión ya usa TLS. ¿Qué le da WS-Security que TLS solo no le da?',
      options: [
        'Integridad del mensaje a través de intermediarios que descifran el TLS.',
        'No repudio: un mensaje firmado guardado prueba quién lo envió.',
        'Menor latencia, porque la firma reemplaza al handshake de TLS en cada llamada.',
        'Cifrar solo partes del mensaje.',
        'Inmunidad a los ataques sobre XML, porque la firma cubre todo el documento.'
      ],
      answer: [0, 1, 3],
      explain: 'TLS protege cada salto y termina en cada intermediario; WS-Security protege el mensaje de punta a punta, con firma por partes, cifrado selectivo y una prueba criptográfica que sobrevive al mensaje. Agrega latencia y tamaño, y trae ataques propios, como el XML Signature Wrapping. Repasa 2.7.'
    },
    {
      id: 'wrapping', type: 'single',
      prompt: 'En un ataque de XML Signature Wrapping, la firma del mensaje manipulado verifica bien. ¿Cuál es la causa de fondo?',
      options: [
        'SHA-1 está roto y permite fabricar un Body distinto con el mismo digest que el original.',
        'El verificador y la aplicación miran elementos distintos del mismo mensaje.',
        'La clave privada del certificado se filtró y el atacante firmó el Body nuevo.',
        'El Timestamp venció y el verificador dejó de comprobar la firma del Body.'
      ],
      answer: 1,
      explain: 'No hay que romper ninguna criptografía: basta con que la aplicación vuelva a buscar el Body en lugar de procesar exactamente el nodo verificado. Así se atacó la interfaz SOAP de Amazon EC2 en 2011. Repasa la figura 2.11.'
    },
    {
      id: 'proto-tag', type: 'single',
      prompt: 'En Protobuf, ¿qué byte de tag lleva el campo 2, de tipo <code>string</code>?',
      options: ['02', '10', '12', '16'],
      fixed: true,
      answer: 2,
      explain: 'tag = (número &lt;&lt; 3) | tipo. Un string es LEN, tipo 2: (2 &lt;&lt; 3) | 2 = 16 + 2 = 18, que en hexadecimal es 12. Por eso "testing" en el campo 2 empieza con <code>12 07</code>. Prueba otros en el simulador de 2.6.'
    },
    {
      id: 'grpc-status', type: 'single',
      prompt: 'Tu tablero muestra 0&#8239;% de errores HTTP en un servicio gRPC, pero los usuarios ven fallas. ¿Qué está pasando?',
      options: [
        'Nada: si HTTP responde 200 la llamada salió bien, y los usuarios ven fallas de su red.',
        'El resultado real va en el trailer <code>grpc-status</code>, no en el <code>:status 200</code> inicial.',
        'gRPC no usa códigos HTTP, así que el tablero no puede ver nada.',
        'Los errores de gRPC se registran solo en el cliente, y el servidor nunca se entera.'
      ],
      answer: 1,
      explain: 'En una llamada con streaming, el servidor responde los headers antes de saber cómo termina. El resultado (0 OK, 14 UNAVAILABLE, 4 DEADLINE_EXCEEDED…) va en los trailers. Un monitor que mira el código HTTP ve todo verde. Repasa la figura 2.8.'
    },
    {
      id: 'dataloader', type: 'single',
      prompt: 'Una consulta GraphQL pide 50 posts y el autor de cada uno; los 50 posts son de 12 autores distintos. Con DataLoader, ¿cuántas consultas llegan a la base?',
      options: ['51', '13', '2', '1'],
      fixed: true,
      answer: 2,
      explain: 'Una para los posts y una para los autores: DataLoader junta las 50 llamadas a <code>load(id)</code> del mismo turno, elimina los repetidos y hace un solo <code>WHERE id IN (…)</code> con 12 ids. Repasa 2.8.'
    },
    {
      id: 'ws-mask', type: 'single',
      prompt: 'En WebSocket, ¿qué frames van enmascarados y para qué?',
      options: [
        'Todos los frames, para cifrar el contenido cuando la conexión no usa wss://.',
        'Solo los del cliente, para que una página no elija los bytes del cable y engañe a un proxy.',
        'Solo los del servidor, para que el navegador autentique quién envía cada frame.',
        'Ninguno desde TLS 1.3, porque el cifrado vuelve innecesaria la máscara.'
      ],
      answer: 1,
      explain: 'La máscara no cifra (la clave viaja en el mismo frame): evita ataques de envenenamiento de caché contra proxies que no entienden WebSocket. El cifrado lo da TLS (wss://). Repasa 2.9.'
    }
  ]
});
