SD.defineQuiz('m01', {
  title: 'Quiz: el viaje de una request',
  pass: 0.7,
  questions: [
    {
      id: 'puerto', type: 'single',
      prompt: 'Tu navegador abre seis conexiones TCP al mismo servidor, <code>104.16.132.229:443</code>. ¿Qué distingue a cada conexión de las otras cinco?',
      options: [
        'La IP de destino: el servidor publica seis IPs detrás del mismo nombre y asigna una a cada conexión.',
        'El puerto de origen: el sistema operativo elige uno efímero distinto para cada una.',
        'El puerto de destino: el servidor asigna uno distinto entre 443 y 448 a cada conexión que acepta.',
        'El número de secuencia inicial del handshake, que el kernel usa como identificador de la conexión.'
      ],
      answer: 1,
      explain: 'Una conexión se identifica por la 4-tupla: IP y puerto de origen, IP y puerto de destino. Las seis comparten tres valores y se diferencian por el puerto efímero del cliente. Repasa "Puertos: a qué programa va cada paquete" (1.2).'
    },
    {
      id: 'ancho', type: 'single',
      prompt: 'Una API responde 10 kB desde un servidor a 80 ms de ida y vuelta, por una conexión ya abierta. Cambias tu plan de internet de 100 Mbps a 1 Gbps. ¿Cuánto más rápido llega la respuesta?',
      options: [
        'Diez veces más rápido: el plan es 10 veces mayor, así que la respuesta pasa de ~81 ms a ~8 ms.',
        'Casi nada: mandan los 80 ms de ida y vuelta, y 10 kB tardan menos de 1 ms con ambos planes.',
        'La mitad: los paquetes salen más rápido de la placa de red y la respuesta baja de ~81 ms a ~40 ms.',
        'Más lento: con 1 Gbps la ventana de TCP se llena antes y la conexión vuelve a slow start.'
      ],
      answer: 1,
      explain: '10 kB × 8 / 100 Mbps = 0.8 ms; con 1 Gbps, 0.08 ms. La respuesta tarda lo mismo, ~81 ms, porque manda la latencia: el ancho de banda agrega carriles, no acorta la autopista. Repasa "Latencia, RTT y ancho de banda" (1.2).'
    },
    {
      id: 'udp', type: 'single',
      prompt: '¿Por qué las consultas DNS clásicas viajan por UDP y no por TCP?',
      options: [
        'Porque UDP cifra la consulta, y por TCP viajaría en claro, visible para cualquiera en la red.',
        'Porque pregunta y respuesta caben en un paquete, y un handshake TCP costaría otra ida y vuelta.',
        'Porque UDP confirma cada paquete recibido, así que la respuesta llega garantizada sin reintentos.',
        'Porque los routers y firewalls bloquean TCP hacia el puerto 53 en la mayoría de las redes.'
      ],
      answer: 1,
      explain: 'UDP no tiene handshake: la pregunta sale en el primer paquete. Si se pierde, el cliente simplemente vuelve a preguntar. UDP no cifra ni garantiza nada; para cifrar DNS están DoH y DoT. Repasa 1.2 y 1.4.'
    },
    {
      id: 'refused', type: 'single',
      prompt: 'Tu servicio de Spring Boot no arrancó. Un cliente intenta conectarse al puerto 8080 de esa máquina, que sí está encendida. ¿Qué ve el cliente?',
      options: [
        '<code>connection timed out</code> tras unos 2 minutos, porque nadie contesta el SYN del cliente.',
        '<code>connection refused</code> al instante: el sistema operativo contesta el SYN con un RST.',
        'Un <code>404 Not Found</code> del sistema operativo, porque ninguna aplicación atiende esa ruta.',
        'Un <code>503</code> que devuelve el kernel mientras el proceso arranca.'
      ],
      answer: 1,
      explain: 'La máquina existe y su sistema operativo contesta: no hay ningún programa escuchando en el puerto, así que responde con RST. El timeout de ~2 minutos aparece cuando nadie responde, por ejemplo si un firewall descarta los paquetes. Repasa "Abrir la conexión: el handshake" (1.5).'
    },
    {
      id: 'cert', type: 'single',
      prompt: 'Alguien en el wifi de una cafetería descarga el certificado de tu banco (es público) y lo presenta haciéndose pasar por el banco. ¿Por qué falla el engaño?',
      options: [
        'Porque cada certificado se emite para una sola IP, y en el wifi de la cafetería el impostor tiene otra.',
        'Porque el handshake exige una firma (<code>CertificateVerify</code>) con la clave privada del banco.',
        'Porque el navegador le pregunta al banco si el certificado es suyo.',
        'No falla: el certificado es lo que prueba la identidad, así que con él alcanza para suplantar el sitio.'
      ],
      answer: 1,
      explain: 'El certificado une un nombre con una clave pública, pero copiarlo no da la clave privada. Sin ella, el impostor no puede firmar el handshake y el navegador corta la conexión. Repasa "Certificados" y "El handshake de TLS 1.3" (1.6).'
    },
    {
      id: 'sni', type: 'multi',
      prompt: 'Visitas <code>https://www.ejemplo.com/perfil</code> sin ECH. ¿Qué puede ver tu proveedor de internet?',
      options: [
        'La IP del servidor.',
        'El nombre <code>www.ejemplo.com</code>, que viaja en el SNI.',
        'La ruta <code>/perfil</code>, que va en la primera línea de la request HTTP.',
        'Tus cookies de sesión, que el navegador manda en los headers.',
        'El contenido de la página, aunque no pueda modificarlo.'
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
        'Porque el PoP comprime y minifica el HTML del origen antes de mandarlo, y eso ahorra bytes.',
        'Porque los handshakes se hacen con un PoP cercano, que ya tiene una conexión abierta al origen.',
        'Porque la CDN sirve mientras tanto una versión vieja de la página y revalida contra el origen después.',
        'No la hace más rápida: en un MISS la CDN solo agrega un salto, así que suma latencia en vez de restarla.'
      ],
      answer: 1,
      explain: 'Los handshakes cuestan idas y vueltas, y una ida y vuelta al PoP (20 ms) es mucho más barata que una al origen (80 ms o más). Después, el PoP reenvía por un túnel caliente: la distancia larga se paga una sola vez por request.'
    },
    {
      id: 'ttl', type: 'single',
      prompt: 'Vas a mover tu servicio a otra IP el sábado. El registro DNS tiene TTL de 1 día. ¿Qué haces?',
      options: [
        'Cambias la IP el sábado: los resolvers modernos propagan el cambio en segundos sin importar el TTL.',
        'El miércoles bajas el TTL a 60 s; el sábado cambias la IP y mantienes la vieja un tiempo.',
        'Pones TTL 0 para siempre: así ningún resolver guarda la IP vieja.',
        'El sábado cambias la IP y bajas el TTL a 60 s en el mismo momento, para que el cambio llegue rápido.'
      ],
      answer: 1,
      explain: 'Los resolvers pueden guardar la respuesta vieja hasta que venza su TTL (un día). Bajando el TTL con anticipación, el sábado nadie tiene guardada la IP vieja por más de un minuto. Y la IP vieja sigue sirviendo mientras tanto, por los clientes que ignoran el TTL.'
    },
    {
      id: 'hol', type: 'single',
      prompt: 'En una red con pérdida de paquetes, una página con 30 recursos va más lenta con HTTP/2 que con HTTP/3. ¿Por qué?',
      options: [
        'HTTP/3 comprime los headers con QPACK, que ocupa bastante menos que el HPACK de HTTP/2.',
        'En HTTP/2 los streams comparten un TCP y un paquete perdido frena a todos; QUIC recupera cada stream por separado.',
        'HTTP/2 abre 6 conexiones por dominio y las reparte mal, mientras HTTP/3 multiplexa todo en una sola.',
        'HTTP/3 no retransmite los paquetes perdidos: los descarta y el navegador tolera los huecos.'
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
        'Nada grave: el balanceador ignora los timeouts del health check y solo saca instancias ante un 500.',
        'Todas fallan el check a la vez, el balanceador queda sin backends sanos y el sitio da 503.',
        'Solo salen de rotación las instancias más lentas, y las demás absorben su tráfico sin problema.',
        'La base se recupera sola porque recibe menos tráfico, y las instancias vuelven a rotación en segundos.'
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
        'Porque el navegador no empieza a parsear el HTML hasta tener los primeros 14 kB completos.',
        'Porque TCP arranca con una ventana de 10 segmentos (~14 kB) y el resto llega en idas y vueltas extra.',
        'Porque las CDNs solo guardan en el borde los archivos menores a 14 kB comprimidos.',
        'Porque TLS cifra en registros de 14 kB, y cada registro adicional exige otro handshake.'
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
        'Subir el TTL del DNS de 5 minutos a 1 día para que los resolvers guarden la respuesta.',
        'Comprar servidores de origen con CPUs más rápidas para responder antes.',
        'Agrupar las llamadas secuenciales a la API en un solo endpoint (BFF).'
      ],
      answer: [0, 1, 4],
      explain: 'La primera visita la domina la red: menos idas y vueltas (HTTP/3, menos llamadas secuenciales) y más cortas (CDN). Un TTL alto solo ayuda a visitas posteriores, y una CPU más rápida ahorra milisegundos de los cientos que cuesta la red.'
    }
  ]
});
