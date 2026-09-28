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
    }
  ]
});
