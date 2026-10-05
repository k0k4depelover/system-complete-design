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
        'Exactamente los posts 41 a 60 que había al empezar.',
        'Repite 3 posts que ya vio en la página 2, porque todo se corrió 3 lugares.',
        'Un error 409 por conflicto.',
        'Se saltea 3 posts.'
      ],
      answer: 1,
      explain: 'Con inserciones al principio, todo se desplaza y el OFFSET cae 3 posiciones antes: se repiten elementos (y con borrados, se saltean). La paginación por cursor ("después del post X") no tiene ese problema y además no se vuelve lenta con la profundidad.'
    },
    {
      id: 'idem', type: 'single',
      prompt: 'Un cliente reintenta un <code>POST /pagos</code> con la misma Idempotency-Key, pero con un monto distinto. ¿Qué debería responder el servidor?',
      options: [
        'Procesar el nuevo monto: la clave solo evita duplicados exactos.',
        'Devolver la respuesta guardada del primer intento sin mirar el cuerpo.',
        'Un error (409 o 422): la clave ya se usó con otra request, lo que indica un bug del cliente.',
        '200 vacío.'
      ],
      answer: 2,
      explain: 'El servidor guarda un hash del cuerpo junto con la clave. Si llega la misma clave con otro cuerpo, no es un reintento sino un error del cliente, y aplicar cualquiera de las dos opciones silenciosamente sería peligroso.'
    },
    {
      id: 'concur', type: 'single',
      prompt: 'Dos personas editan el mismo documento y guardan con PUT casi a la vez. ¿Cómo evitas que la segunda pise los cambios de la primera sin enterarse?',
      options: [
        'Con un lock exclusivo de 10 minutos al abrir el editor.',
        'Con control de concurrencia optimista: GET devuelve un ETag y el PUT envía If-Match; si el recurso cambió, el servidor responde 412.',
        'Guardando siempre la versión más larga.',
        'No se puede evitar con HTTP.'
      ],
      answer: 1,
      explain: 'If-Match convierte el PUT en "guardar solo si nadie cambió esto desde que lo leí". El segundo recibe 412 Precondition Failed, recarga y decide. Es barato y no bloquea a nadie.'
    },
    {
      id: 'grpc', type: 'single',
      prompt: '¿Dónde encaja mejor gRPC?',
      options: [
        'En la API pública que consumen navegadores de terceros.',
        'Entre servicios internos, con contratos tipados, alto volumen y streaming.',
        'Para webhooks hacia clientes.',
        'Para servir imágenes a través de una CDN.'
      ],
      answer: 1,
      explain: 'gRPC brilla adentro: binario, tipado, HTTP/2, deadlines y streaming. Hacia afuera, los navegadores no lo hablan de forma nativa (necesita gRPC-Web y un proxy) y las cachés HTTP no lo entienden.'
    },
    {
      id: 'n1', type: 'single',
      prompt: 'Una query GraphQL pide 50 posts y el autor de cada uno. El servidor hace 1 consulta para los posts y 50 para los autores. ¿Cómo se llama el problema y cómo se resuelve?',
      options: [
        'Over-fetching; se resuelve con REST.',
        'Problema N+1; se resuelve agrupando las cargas de autores en una sola consulta por lote (DataLoader).',
        'Head-of-line blocking; se resuelve con HTTP/3.',
        'Cache stampede; se resuelve con TTL.'
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
        'Procesar todo el pedido antes de responder, aunque tarde 40 segundos.',
        'Deduplicar por el id del evento, porque puede llegar más de una vez.',
        'Responder 2xx rápido y procesar en segundo plano.',
        'Suponer que los eventos llegan en orden.'
      ],
      answer: [0, 2, 3],
      explain: 'La entrega es al menos una vez y sin orden garantizado. Si tardas, el proveedor asume falla y reintenta; si no deduplicas, procesas dos veces. La firma evita que cualquiera invente eventos, y el timestamp evita que reenvíen uno viejo.'
    },
    {
      id: 'breaking', type: 'single',
      prompt: '¿Cuál de estos cambios en una API pública rompe clientes existentes?',
      options: [
        'Agregar un campo opcional nuevo en la respuesta.',
        'Agregar un endpoint nuevo.',
        'Renombrar el campo <code>amount</code> a <code>total</code>.',
        'Aceptar un parámetro opcional nuevo.'
      ],
      answer: 2,
      explain: 'Renombrar o quitar un campo rompe a quien lo lee. Agregar cosas opcionales es compatible siempre que los clientes ignoren lo que no conocen (tolerant reader). Los cambios que rompen van en una versión nueva.'
    },
    {
      id: 'keyset-costo', type: 'single',
      prompt: 'Un índice B-tree tiene 100 millones de entradas. ¿Cuánto cuesta pedir la página 5&#8239;000 (de a 20) con un cursor <code>(created_at, id) &lt; marca</code>?',
      options: [
        'O(1): el cursor apunta directo a la fila.',
        'O(log n + k): bajar unos 4 niveles del árbol y leer las 20 entradas que siguen.',
        'O(offset + k): igual que OFFSET, pero sin repetir filas.',
        'O(n): hay que recorrer todo el índice.'
      ],
      answer: 1,
      explain: 'El cursor es una búsqueda por valor: el árbol baja de la raíz a la hoja donde está la marca y lee k entradas seguidas. Con unas 200 entradas por página, 100 millones caben en 4 niveles, y los niveles altos suelen estar en memoria: en la práctica parece constante, pero es logarítmico. OFFSET, en cambio, es O(offset + k): el árbol no sabe buscar por posición. Repasa 2.3, "Cuánto cuesta cada una".'
    },
    {
      id: 'commit-tardio', type: 'single',
      prompt: 'Un cliente contable sincroniza cada 5 minutos con <code>created_at &gt; última_marca</code>. Las filas se insertan con <code>created_at = now()</code> en transacciones que a veces tardan 3 s. De vez en cuando, un movimiento nunca llega al cliente. ¿Por qué, y qué lo arregla?',
      options: [
        'Porque el cursor está mal firmado; se arregla con HMAC.',
        'Porque now() es la hora de inicio de la transacción: la fila aparece después con una hora que el cliente ya pasó. Se arregla con una ventana de solape y deduplicando por id, o con un orden asignado al confirmar.',
        'Porque hace falta OFFSET en lugar de cursor.',
        'Porque el índice no tiene la columna id.'
      ],
      answer: 1,
      explain: 'La fila se vuelve visible al confirmar, pero lleva la hora en que empezó la transacción. Si el cliente sincronizó en el medio, su marca ya está por delante de esa fila, y nunca vuelve a pedir ese rango. Pedir lo posterior a "marca − 10 s" y descartar por id lo repetido la atrapa; un log con posición de commit (Kafka, outbox numerada) lo resuelve de raíz. OFFSET no ayuda. Repasa 2.3, "Qué pasa cuando llegan inserts".'
    },
    {
      id: 'cursor-borrado', type: 'single',
      prompt: 'El cliente tiene un cursor que apunta al post_88. Antes de pedir la página siguiente, alguien borra el post_88. ¿Qué pasa?',
      options: [
        'La API responde 404 porque el cursor ya no existe.',
        'La página siguiente sale bien: el cursor guarda valores (created_at, id) y la condición compara contra ellos, exista o no la fila.',
        'Se repite la página anterior.',
        'Hay que volver a la página 1.'
      ],
      answer: 1,
      explain: 'Un cursor no es una referencia a una fila sino un punto en el orden. <code>(created_at, id) &lt; (t, post_88)</code> funciona aunque post_88 ya no esté.'
    },
    {
      id: 'soap-seguridad', type: 'multi',
      prompt: 'Un banco exige WS-Security con firma X.509 aunque la conexión ya usa TLS. ¿Qué le da WS-Security que TLS solo no le da?',
      options: [
        'Integridad del mensaje a través de intermediarios (ESB, colas) que descifran el TLS.',
        'No repudio: un mensaje firmado guardado prueba quién lo envió.',
        'Menor latencia.',
        'Cifrar solo partes del mensaje, para que un intermediario lea el ruteo pero no los datos.',
        'Inmunidad a los ataques sobre XML.'
      ],
      answer: [0, 1, 3],
      explain: 'TLS protege cada salto y termina en cada intermediario; WS-Security protege el mensaje de punta a punta, con firma por partes, cifrado selectivo y una prueba criptográfica que sobrevive al mensaje. Agrega latencia y tamaño, y trae ataques propios, como el XML Signature Wrapping. Repasa 2.7.'
    },
    {
      id: 'wrapping', type: 'single',
      prompt: 'En un ataque de XML Signature Wrapping, la firma del mensaje manipulado verifica bien. ¿Cuál es la causa de fondo?',
      options: [
        'SHA-1 está roto.',
        'El verificador y la aplicación miran elementos distintos: la firma valida el Body original movido a otro lugar y la aplicación ejecuta el Body nuevo.',
        'La clave privada del certificado se filtró.',
        'El Timestamp venció.'
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
        'Nada: si HTTP da 200, la llamada salió bien.',
        'gRPC envía <code>:status 200</code> al principio y el resultado real en el trailer <code>grpc-status</code>; hay que medir ese código.',
        'gRPC no usa HTTP.',
        'Los errores de gRPC se registran solo en el cliente.'
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
        'Todos, para cifrar el contenido.',
        'Solo los del cliente al servidor, para que una página maliciosa no pueda elegir los bytes exactos del cable y engañar a un proxy intermedio.',
        'Solo los del servidor, para autenticarlo.',
        'Ninguno desde TLS 1.3.'
      ],
      answer: 1,
      explain: 'La máscara no cifra (la clave viaja en el mismo frame): evita ataques de envenenamiento de caché contra proxies que no entienden WebSocket. El cifrado lo da TLS (wss://). Repasa 2.9.'
    }
  ]
});
