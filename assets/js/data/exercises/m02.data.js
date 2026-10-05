/* Ejercicios guiados del M02 (protocolos y APIs). Formato en core/exercise.js. */

SD.defineExercise('m02-feed', {
  title: 'los movimientos de una billetera digital',
  scenario: '<p>Una billetera digital muestra los movimientos de cada cuenta, del más nuevo al más viejo. La tabla <code>movements</code> tiene 400 millones de filas; una cuenta activa, unas 30&#8239;000. Cada movimiento se inserta con <code>posted_at = now()</code> dentro de una transacción que valida saldos y a veces tarda hasta 2 s.</p><p>Hay dos consumidores: la app, que muestra 20 movimientos por pantalla, baja scrolleando y refresca tirando hacia abajo; y un sistema contable de cada comercio, que cada 5 minutos descarga "todo lo nuevo desde la última vez" y no puede perder ni un movimiento.</p>',
  steps: [
    {
      id: 'tipo', type: 'single',
      prompt: 'La primera versión usa <code>?page=N</code> con <code>OFFSET (N − 1) × 20</code>. ¿Qué problema aparece primero en las cuentas grandes?',
      options: [
        'Ninguno: el índice hace que OFFSET sea barato.',
        'La página 1&#8239;000 lee 20&#8239;000 entradas para devolver 20, y los movimientos nuevos que llegan mientras el usuario scrollea hacen que vea repetidos.',
        'Que no se puede ordenar por fecha.',
        'Que los clientes no saben cuántas páginas hay.'
      ],
      answer: 1,
      explain: 'OFFSET cuenta posiciones desde el principio: el costo crece con la página. Y como es una posición, un insert arriba corre todo un lugar y la página siguiente repite. Las dos cosas se resuelven con un cursor.'
    },
    {
      id: 'indice', type: 'single',
      prompt: 'Pasas a cursor sobre <code>(posted_at, id)</code>. ¿Qué índice necesita la consulta <code>WHERE account_id = $1 AND (posted_at, id) &lt; ($2, $3) ORDER BY posted_at DESC, id DESC LIMIT 21</code>?',
      options: [
        '<code>(posted_at)</code>',
        '<code>(account_id)</code>',
        '<code>(account_id, posted_at DESC, id DESC)</code>',
        '<code>(id, account_id)</code>'
      ],
      answer: 2,
      explain: 'Primero la igualdad (la cuenta), después las columnas de orden en el mismo orden y dirección que el ORDER BY. Así el árbol baja directo a la marca dentro de esa cuenta y lee 21 entradas seguidas: O(log n + k). Con solo <code>(account_id)</code>, la base tendría que ordenar las 30&#8239;000 filas de la cuenta en cada página.'
    },
    {
      id: 'perdidos', type: 'single',
      prompt: 'Con el cursor andando, un comercio reclama: a su sistema contable le faltan movimientos que sí aparecen en la app. Sincroniza con <code>posted_at &gt; marca</code>. ¿Qué pasa?',
      options: [
        'El sistema contable tiene un bug de deduplicación.',
        'now() devuelve la hora de inicio de la transacción. Un movimiento que tardó 2 s en confirmar aparece con una hora anterior a la marca que el sistema contable ya guardó, y nunca lo vuelve a pedir.',
        'El índice está corrupto.',
        'La réplica de lectura borra filas.'
      ],
      answer: 1,
      explain: 'Es el commit tardío de la figura 2.5. La fila no existía para nadie cuando el sistema contable sincronizó, y cuando aparece, lo hace detrás de su marca. La app no lo nota porque el usuario vuelve a cargar la lista entera; la sincronización incremental, sí.'
    },
    {
      id: 'arreglo', type: 'multi',
      prompt: '¿Qué cambios arreglan la sincronización sin perder movimientos?',
      options: [
        'Pedir <code>posted_at &gt; marca − 10 s</code> y descartar por id lo que ya se tiene.',
        'Volver a OFFSET.',
        'Devolver solo movimientos con <code>posted_at &lt; now() − 5 s</code>, para no entregar lo que todavía puede estar en vuelo.',
        'Publicar cada movimiento confirmado en un log con posición de commit (outbox numerada o Kafka) y sincronizar por esa posición.',
        'Subir el LIMIT a 1&#8239;000.'
      ],
      answer: [0, 2, 3],
      explain: 'La ventana de solape y la marca de agua funcionan si las transacciones están acotadas (aquí, 2 s, con un statement_timeout que lo garantice). El log con posición de commit lo resuelve de raíz: el orden es el de confirmación, no el de inicio. OFFSET y un LIMIT más grande no cambian nada.'
    },
    {
      id: 'refrescar', type: 'single',
      prompt: 'Un comerciante abre la app después de un fin de semana con 900 movimientos nuevos. ¿Cómo carga "lo nuevo" sin dejar un hueco?',
      options: [
        'Pide los 20 más nuevos con <code>ORDER BY posted_at DESC</code>.',
        'Pide lo posterior a su marca de arriba con <code>ORDER BY posted_at ASC</code>, de a páginas, hasta alcanzar el presente; o trae los 20 más nuevos y marca el hueco con un "cargar más".',
        'Recarga todo desde cero cada vez.',
        'Usa OFFSET negativo.'
      ],
      answer: 1,
      explain: 'Los 20 más nuevos dejan 880 movimientos sin cargar entre esos y la lista vieja. En orden ascendente desde la marca no hay hueco; la alternativa es mostrarlo y llenarlo paginando hacia abajo. Repasa "Bajar y subir: before y after".'
    }
  ],
  solution: '<ul><li><b>Lista de la app:</b> cursor opaco y firmado sobre <code>(posted_at, id)</code>, índice <code>(account_id, posted_at DESC, id DESC)</code>, <code>LIMIT 21</code> para <code>has_more</code>. Dos marcas: abajo (<code>&lt;</code>, descendente) y arriba (<code>&gt;</code>, ascendente).</li><li><b>Sincronización contable:</b> por una posición que crece en orden de commit (tabla outbox numerada por un solo escritor, o Kafka). Si eso no es posible todavía, ventana de solape de 10 s más deduplicación por id, con un <code>statement_timeout</code> de 5 s que garantice que ninguna transacción supera la ventana.</li><li><b>Total y saltos:</b> sin "página 37" ni total exacto; un <code>has_more</code> y, si el producto lo pide, una estimación.</li></ul>'
});

SD.defineExercise('m02-protocolos', {
  title: 'un protocolo para cada integración de una fintech',
  scenario: '<p>Una fintech tiene una app móvil y una web, 40 microservicios propios que se llaman unas 200&#8239;000 veces por segundo, un banco corresponsal que exige mensajes firmados con certificado y que pasan por su ESB, comercios que necesitan enterarse de cada pago confirmado, y una pantalla que muestra en vivo el estado de una transferencia.</p><p>Elige el protocolo de cada integración.</p>',
  steps: [
    {
      id: 'internos', type: 'single',
      prompt: 'Las llamadas entre los 40 microservicios, con contratos que cambian cada semana:',
      options: ['REST con JSON', 'gRPC con Protobuf y deadlines', 'SOAP', 'Webhooks'],
      answer: 1,
      explain: 'Contratos tipados que fallan al compilar, mensajes binarios chicos, HTTP/2 multiplexado y deadlines que se propagan. Hay que balancear por llamada (L7, cliente o edad máxima de conexión), no por conexión.'
    },
    {
      id: 'banco', type: 'single',
      prompt: 'La integración con el banco corresponsal:',
      options: [
        'REST con un API key en un header.',
        'SOAP con WS-Security: firma X.509 sobre Body y Timestamp, porque el mensaje atraviesa su ESB y necesitan no repudio.',
        'GraphQL.',
        'WebSocket.'
      ],
      answer: 1,
      explain: 'El requisito es seguridad de mensaje, no solo de transporte: integridad a través de intermediarios y una prueba de quién envió. Es el caso de manual para WS-Security, con una biblioteca mantenida y el parser de XML endurecido (sin DTD).'
    },
    {
      id: 'pantalla', type: 'single',
      prompt: 'El panel web que combina saldo, últimos movimientos, tarjetas y alertas en una sola pantalla, que el equipo de frontend cambia seguido:',
      options: [
        'Cinco endpoints REST llamados en paralelo, o GraphQL con persisted queries registradas en el build.',
        'SOAP.',
        'gRPC directo desde el navegador.',
        'Polling cada segundo.'
      ],
      answer: 0,
      explain: 'Las dos opciones valen. GraphQL evita endpoints a medida, pero exige DataLoader, límites de costo y, en una API propia, aceptar solo las consultas registradas. Si las pantallas son pocas y estables, REST en paralelo (o un BFF, M03) es más simple.'
    },
    {
      id: 'comercios', type: 'single',
      prompt: 'Avisar a los comercios de cada pago confirmado:',
      options: [
        'Webhooks firmados con HMAC, con id de evento, reintentos con backoff y un endpoint para consultar el estado.',
        'Que los comercios hagan polling cada segundo.',
        'Un WebSocket abierto con cada comercio.',
        'SOAP.'
      ],
      answer: 0,
      explain: 'Es la integración de evento a sistema ajeno por excelencia. La firma HMAC es seguridad de mensaje, igual que WS-Security pero liviana. El receptor deduplica por id de evento y no confía en el orden (2.10).'
    },
    {
      id: 'vivo', type: 'single',
      prompt: 'Mostrar en vivo el estado de una transferencia (enviada, en el banco, acreditada):',
      options: [
        'SSE: el flujo es solo del servidor al cliente, reconecta solo y retoma con Last-Event-ID.',
        'WebSocket con un protocolo de mensajes propio.',
        'Webhooks hacia el navegador.',
        'gRPC bidireccional.'
      ],
      answer: 0,
      explain: 'Son pocos eventos y en un solo sentido: SSE es HTTP normal, atraviesa proxies y trae reconexión. WebSocket también funciona, pero obliga a reinventar correlación, reintentos y control de flujo para algo que no lo necesita.'
    }
  ],
  solution: '<div class="table-wrap"><table class="t"><thead><tr><th>Integración</th><th>Protocolo</th><th>Lo que no puede faltar</th></tr></thead><tbody><tr><td>Microservicios</td><td>gRPC</td><td>Deadlines, balanceo por llamada, códigos gRPC medidos</td></tr><tr><td>Banco corresponsal</td><td>SOAP con WS-Security</td><td>Firma de Body y Timestamp, parser sin DTD, procesar el nodo verificado</td></tr><tr><td>Panel web</td><td>REST o GraphQL</td><td>Con GraphQL: DataLoader, costo y persisted queries</td></tr><tr><td>Comercios</td><td>Webhooks</td><td>HMAC, id de evento, reintentos, consulta de estado</td></tr><tr><td>Estado en vivo</td><td>SSE</td><td>Ids de evento, latidos, buffering desactivado</td></tr></tbody></table></div>'
});
