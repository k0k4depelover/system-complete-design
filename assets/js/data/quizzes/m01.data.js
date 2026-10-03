SD.defineQuiz('m01', {
  title: 'Quiz: el viaje de una request',
  pass: 0.7,
  questions: [
    {
      id: 'puerto', type: 'single',
      prompt: 'Tu navegador abre seis conexiones TCP al mismo servidor, <code>104.16.132.229:443</code>. ¿Qué distingue a cada conexión de las otras cinco?',
      options: [
        'La IP de destino: el servidor tiene seis IPs.',
        'El puerto de origen: el sistema operativo elige un puerto efímero distinto para cada una.',
        'El puerto de destino: cada conexión usa uno entre 443 y 448.',
        'Nada: las seis son en realidad la misma conexión.'
      ],
      answer: 1,
      explain: 'Una conexión se identifica por la 4-tupla: IP y puerto de origen, IP y puerto de destino. Las seis comparten tres valores y se diferencian por el puerto efímero del cliente. Repasa "Puertos: a qué programa va cada paquete" (1.2).'
    },
    {
      id: 'ancho', type: 'single',
      prompt: 'Una API responde 10 kB desde un servidor a 80 ms de ida y vuelta, por una conexión ya abierta. Cambias tu plan de internet de 100 Mbps a 1 Gbps. ¿Cuánto más rápido llega la respuesta?',
      options: [
        'Diez veces más rápido: de ~81 ms a ~8 ms.',
        'Casi nada: transmitir 10 kB tarda menos de 1 ms con cualquiera de los dos planes, y los 80 ms de ida y vuelta no cambian.',
        'La mitad: de ~81 ms a ~40 ms.',
        'Más lento, porque 1 Gbps satura los routers.'
      ],
      answer: 1,
      explain: '10 kB × 8 / 100 Mbps = 0.8 ms; con 1 Gbps, 0.08 ms. La respuesta tarda lo mismo, ~81 ms, porque manda la latencia: el ancho de banda agrega carriles, no acorta la autopista. Repasa "Latencia, RTT y ancho de banda" (1.2).'
    },
    {
      id: 'udp', type: 'single',
      prompt: '¿Por qué las consultas DNS clásicas viajan por UDP y no por TCP?',
      options: [
        'Porque UDP está cifrado y TCP no.',
        'Porque la pregunta y la respuesta caben en un paquete, y abrir una conexión TCP costaría una ida y vuelta más que la consulta misma.',
        'Porque UDP garantiza que la respuesta llegue.',
        'Porque los routers no dejan pasar TCP al puerto 53.'
      ],
      answer: 1,
      explain: 'UDP no tiene handshake: la pregunta sale en el primer paquete. Si se pierde, el cliente simplemente vuelve a preguntar. UDP no cifra ni garantiza nada; para cifrar DNS están DoH y DoT. Repasa 1.2 y 1.4.'
    },
    {
      id: 'refused', type: 'single',
      prompt: 'Tu servicio de Spring Boot no arrancó. Un cliente intenta conectarse al puerto 8080 de esa máquina, que sí está encendida. ¿Qué ve el cliente?',
      options: [
        '<code>connection timed out</code> después de unos 2 minutos.',
        '<code>connection refused</code> al instante: el sistema operativo responde al SYN con un RST porque nadie escucha en ese puerto.',
        'Un <code>404 Not Found</code>.',
        'Un error de certificado.'
      ],
      answer: 1,
      explain: 'La máquina existe y su sistema operativo contesta: no hay ningún programa escuchando en el puerto, así que responde con RST. El timeout de ~2 minutos aparece cuando nadie responde, por ejemplo si un firewall descarta los paquetes. Repasa "Abrir la conexión: el handshake" (1.5).'
    },
    {
      id: 'cert', type: 'single',
      prompt: 'Alguien en el wifi de una cafetería descarga el certificado de tu banco (es público) y lo presenta haciéndose pasar por el banco. ¿Por qué falla el engaño?',
      options: [
        'Porque los certificados solo se pueden descargar una vez.',
        'Porque el handshake exige una firma (<code>CertificateVerify</code>) hecha con la clave privada del banco, y el impostor no la tiene.',
        'Porque el navegador llama al banco para preguntar.',
        'No falla: con el certificado alcanza para hacerse pasar por el sitio.'
      ],
      answer: 1,
      explain: 'El certificado une un nombre con una clave pública, pero copiarlo no da la clave privada. Sin ella, el impostor no puede firmar el handshake y el navegador corta la conexión. Repasa "Certificados" y "El handshake de TLS 1.3" (1.6).'
    },
    {
      id: 'sni', type: 'multi',
      prompt: 'Visitas <code>https://www.ejemplo.com/perfil</code> sin ECH. ¿Qué puede ver tu proveedor de internet?',
      options: [
        'La IP del servidor.',
        'El nombre <code>www.ejemplo.com</code>, que viaja en el SNI del ClientHello.',
        'La ruta <code>/perfil</code>.',
        'Tus cookies.',
        'El contenido de la página.'
      ],
      answer: [0, 1],
      explain: 'La IP va en cada paquete y el SNI viaja sin cifrar porque el servidor lo necesita para elegir el certificado. La request HTTP (ruta, headers, cookies) y la respuesta van dentro de TLS, cifradas. ECH cifra también el SNI. Repasa "SNI: una IP, miles de sitios" (1.6).'
    },
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
