SD.defineQuiz('m01', {
  title: 'Quiz: el viaje de una request',
  pass: 0.7,
  questions: [
    {
      id: 'rtt3', type: 'single',
      prompt: 'Un usuario abre una conexión nueva, con TCP y TLS 1.3, a un servidor que está a 80 ms de ida y vuelta. Sin contar DNS ni el tiempo del servidor, ¿cuándo recibe el primer byte de la respuesta?',
      options: ['80 ms', '160 ms', '240 ms', '320 ms'],
      answer: 2,
      explain: 'Tres idas y vueltas: una para el handshake TCP, una para TLS 1.3 y una para la request y su respuesta. Con TLS 1.2 serían cuatro (320 ms) y con QUIC, dos (160 ms).'
    },
    {
      id: 'cdnmiss', type: 'single',
      prompt: 'La página no está en la caché de la CDN (MISS) y hay que ir al origen igual. ¿Por qué la CDN sigue haciendo más rápida esa request?',
      options: [
        'Porque comprime el HTML mejor que el origen.',
        'Porque los handshakes TCP y TLS se hacen contra un PoP cercano, y el PoP llega al origen por una conexión que ya tenía abierta.',
        'Porque la CDN responde con una versión vieja de la página.',
        'No la hace más rápida: en un MISS la CDN solo agrega latencia.'
      ],
      answer: 1,
      explain: 'Los handshakes cuestan idas y vueltas, y una ida y vuelta al PoP (20 ms) es mucho más barata que una al origen (80 ms o más). Después, el PoP reenvía por un túnel caliente: la distancia larga se paga una sola vez por request.'
    },
    {
      id: 'ttl', type: 'single',
      prompt: 'Vas a mover tu servicio a otra IP el sábado. El registro DNS tiene TTL de 1 día. ¿Qué haces?',
      options: [
        'Cambias la IP el sábado: el DNS propaga en segundos.',
        'El miércoles bajas el TTL a 60 s; el sábado cambias la IP y mantienes la vieja funcionando un tiempo.',
        'Pones TTL 0 para siempre.',
        'Le pides a los usuarios que borren su caché DNS.'
      ],
      answer: 1,
      explain: 'Los resolvers pueden guardar la respuesta vieja hasta que venza su TTL (un día). Bajando el TTL con anticipación, el sábado nadie tiene guardada la IP vieja por más de un minuto. Y la IP vieja sigue sirviendo mientras tanto, por los clientes que ignoran el TTL.'
    },
    {
      id: 'hol', type: 'single',
      prompt: 'En una red con pérdida de paquetes, una página con 30 recursos va más lenta con HTTP/2 que con HTTP/3. ¿Por qué?',
      options: [
        'HTTP/3 comprime mejor los headers.',
        'En HTTP/2 todos los streams comparten una conexión TCP, y un paquete perdido frena a todos hasta que se retransmite. En QUIC cada stream se recupera por separado.',
        'HTTP/2 abre 6 conexiones y HTTP/3 una sola.',
        'HTTP/3 no retransmite los paquetes perdidos.'
      ],
      answer: 1,
      explain: 'TCP entrega bytes en orden: si falta uno, todo lo que viene detrás espera (head-of-line blocking de transporte). QUIC conoce los streams y solo bloquea al que perdió datos.'
    },
    {
      id: 'zerortt', type: 'single',
      prompt: '¿Cuál de estas requests es seguro enviar como datos 0-RTT?',
      options: ['POST /pagos', 'GET /productos?page=2', 'DELETE /cuenta', 'POST /mensajes'],
      answer: 1,
      explain: 'Los datos 0-RTT pueden ser capturados y reenviados (replay). Solo deben usarse para requests idempotentes y sin efectos: repetir un GET no cambia nada; repetir un POST de pago cobra dos veces.'
    },
    {
      id: 'readyz', type: 'single',
      prompt: 'Tu <code>/readyz</code> hace un <code>SELECT 1</code> a la base de datos. Un día la base se pone lenta y el SELECT tarda más que el timeout del health check. ¿Qué pasa?',
      options: [
        'Nada: el balanceador ignora los timeouts.',
        'Todas las instancias fallan el health check a la vez, el balanceador se queda sin backends sanos y el sitio entero responde 503.',
        'Solo se sacan de rotación las instancias más lentas.',
        'La base de datos se recupera sola porque recibe menos tráfico.'
      ],
      answer: 1,
      explain: 'Un health check que depende de una dependencia compartida convierte un problema parcial en una caída total. El readiness debe medir la instancia (¿arrancó?, ¿tiene hilos libres?), y la degradación por dependencias se maneja con timeouts y circuit breakers.'
    },
    {
      id: 'orden', type: 'order',
      prompt: 'Ordena lo que ocurre en la primera visita a un sitio HTTPS:',
      items: ['Resolución DNS del nombre', 'Handshake TCP', 'Handshake TLS', 'Envío de la request HTTP', 'Procesamiento en el servidor', 'Primer byte de la respuesta'],
      explain: 'Sin IP no hay a quién conectarse; sin conexión TCP no hay canal para TLS; sin TLS no hay dónde enviar la request cifrada. Con QUIC, los pasos 2 y 3 se fusionan en uno.'
    },
    {
      id: 'slowstart', type: 'single',
      prompt: '¿Por qué conviene que el HTML crítico de la primera respuesta ocupe menos de ~14 kB comprimido?',
      options: [
        'Porque los navegadores no leen más de 14 kB por respuesta.',
        'Porque en una conexión nueva TCP arranca con una ventana de 10 segmentos (~14 kB): lo que exceda llega en idas y vueltas adicionales.',
        'Porque las CDNs no cachean archivos más grandes.',
        'Porque TLS cifra solo los primeros 14 kB.'
      ],
      answer: 1,
      explain: 'Slow start: la ventana inicial es de 10 segmentos (RFC 6928) y se duplica en cada ida y vuelta. Si la respuesta cabe en la primera ventana, llega completa en un solo RTT.'
    },
    {
      id: 'multi', type: 'multi',
      prompt: '¿Cuáles de estas medidas reducen la latencia de la <b>primera</b> visita de un usuario lejano?',
      options: [
        'Poner una CDN que termine TCP y TLS cerca del usuario.',
        'Habilitar HTTP/3.',
        'Subir el TTL del DNS de 5 minutos a 1 día.',
        'Comprar servidores de origen con CPUs más rápidas.',
        'Agrupar varias llamadas secuenciales a la API en una sola (un endpoint agregador o BFF).'
      ],
      answer: [0, 1, 4],
      explain: 'La primera visita la domina la red: menos idas y vueltas (HTTP/3, menos llamadas secuenciales) y más cortas (CDN). Un TTL alto solo ayuda a visitas posteriores, y una CPU más rápida ahorra milisegundos de los cientos que cuesta la red.'
    }
  ]
});
