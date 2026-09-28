/* Mapa del M01: el viaje completo de una request HTTPS. Latencias de ejemplo:
   usuario ↔ resolver y usuario ↔ PoP de la CDN: 20 ms de ida y vuelta; PoP ↔ región de origen: 60 ms. */
SD.defineMap('m01-request', {
  title: 'El viaje de una request',
  intro: 'Qué pasa entre que escribes <code>www.ejemplo.com</code> y ves la página: DNS, TCP, TLS, CDN, balanceador, aplicación, caché y base de datos.',
  groups: [
    { id: 'g-pc', label: 'Tu computadora', x: 32, y: 78, w: 276, h: 302 },
    { id: 'g-isp', label: 'Red de tu ISP', x: 424, y: 262, w: 272, h: 110 },
    { id: 'g-dns', label: 'Jerarquía DNS de internet', x: 780, y: 42, w: 240, h: 398 },
    { id: 'g-pop', label: 'PoP de la CDN, cerca de ti', x: 440, y: 570, w: 240, h: 112 },
    { id: 'g-origin', label: 'Región de origen (us-east-1)', x: 1126, y: 440, w: 876, h: 400 }
  ],
  nodes: [
    { id: 'browser', layer: 'client', label: 'Navegador', sub: 'Chrome, pestaña nueva', x: 170, y: 150,
      info: {
        resp: '<p>Convierte lo que escribiste en requests: interpreta la URL, revisa la lista <b>HSTS</b> (si el dominio está ahí, fuerza HTTPS sin intentar HTTP), resuelve el nombre, abre la conexión, negocia TLS y HTTP, y después reutiliza esas conexiones para todo lo que la página pida.</p><p>Mantiene un pool de conexiones por origen: con HTTP/1.1 abre hasta 6 en paralelo; con HTTP/2 o HTTP/3 le basta una, porque multiplexa muchas requests sobre ella.</p>',
        api: '<p>La request que envía, en HTTP/2 (los campos que empiezan con <code>:</code> son pseudo-headers):</p><pre><code>:method: GET\n:scheme: https\n:authority: www.ejemplo.com\n:path: /\naccept: text/html,application/xhtml+xml\naccept-encoding: gzip, br, zstd\naccept-language: es-419,es;q=0.9\ncookie: sid=8f2c…</code></pre><p>HTTP/2 comprime estos headers con HPACK y HTTP/3 con QPACK: los que se repiten entre requests viajan como un índice de pocos bytes.</p>',
        data: '<p>Estado que guarda el navegador y que cambia el recorrido de la siguiente request:</p><div class="table-wrap"><table class="t"><thead><tr><th>Qué</th><th>Clave</th><th>Efecto</th></tr></thead><tbody><tr><td>Caché HTTP</td><td>URL + headers de <code>Vary</code></td><td>Evita la request entera o la vuelve condicional (<code>If-None-Match</code>)</td></tr><tr><td>Caché DNS</td><td>Nombre</td><td>Evita consultar al resolver</td></tr><tr><td>Tickets de sesión TLS</td><td>Servidor</td><td>Permite reanudar TLS, incluso con 0-RTT</td></tr><tr><td>Alt-Svc / registro HTTPS</td><td>Origen</td><td>Sabe que puede usar HTTP/3</td></tr><tr><td>Lista HSTS</td><td>Dominio</td><td>Fuerza HTTPS sin redirección</td></tr></tbody></table></div>',
        fail: '<ul><li><b>El nombre no resuelve</b>: <code>ERR_NAME_NOT_RESOLVED</code>. No hay nada que reintentar hasta que el DNS responda.</li><li><b>Certificado inválido o vencido</b>: el navegador bloquea la página. Un certificado vencido tira todo el sitio a la vez, para todos.</li><li><b>IPv6 roto en la red del usuario</b>: con <i>Happy Eyeballs</i> (RFC 8305) el navegador intenta IPv6 y, si no conecta en ~250 ms, prueba IPv4 en paralelo, así el usuario no espera un timeout largo.</li><li><b>Conexión cortada a mitad de la respuesta</b>: el navegador solo reintenta solo si la request era idempotente.</li></ul>',
        nums: '<ul><li>Hasta 6 conexiones HTTP/1.1 por host; con HTTP/2, una sola conexión con cientos de streams.</li><li>Una página típica hace decenas de requests (HTML, CSS, JS, imágenes, fuentes, APIs).</li><li>El navegador mide cada fase de la request con la Navigation Timing API: DNS, conexión, TLS, primer byte y descarga.</li></ul>'
      } },
    { id: 'oscache', layer: 'client', label: 'Caché DNS local', sub: 'navegador y sistema operativo', x: 170, y: 322,
      info: {
        resp: '<p>Antes de salir a la red, la resolución pasa por varias cachés locales: la del navegador, la del sistema operativo (el <i>stub resolver</i>: el servicio DNS Client en Windows, <code>systemd-resolved</code> en Linux, <code>mDNSResponder</code> en macOS) y el archivo <code>hosts</code>.</p><p>El stub no resuelve nada por sí mismo: si no tiene la respuesta en caché, le pregunta al resolver recursivo configurado en la red.</p>',
        api: '<p>La aplicación pide una IP con una llamada al sistema:</p><pre><code>getaddrinfo("www.ejemplo.com", "443", …)\n  → [2606:4700::6810:84e5, 104.16.132.229]</code></pre><p>Hacia afuera, el stub envía una consulta DNS clásica (UDP al puerto 53) o cifrada: DNS over HTTPS (DoH, puerto 443) o DNS over TLS (DoT, puerto 853).</p>',
        data: '<div class="table-wrap"><table class="t"><thead><tr><th>Nombre</th><th>Tipo</th><th>Valor</th><th>TTL restante</th></tr></thead><tbody><tr><td><code>www.ejemplo.com</code></td><td>CNAME</td><td><code>ejemplo.cdn.net</code></td><td>212 s</td></tr><tr><td><code>ejemplo.cdn.net</code></td><td>A</td><td><code>104.16.132.229</code></td><td>212 s</td></tr><tr><td><code>ejemplo.cdn.net</code></td><td>AAAA</td><td><code>2606:4700::6810:84e5</code></td><td>212 s</td></tr></tbody></table></div><p>Cada registro vence cuando se le acaba su TTL, que viene fijado por el servidor autoritativo.</p>',
        fail: '<ul><li><b>Respuesta vieja en caché</b>: si cambiaste la IP del servicio, los clientes siguen yendo a la anterior hasta que venza el TTL. Por eso, antes de una migración se baja el TTL con días de anticipación.</li><li><b>Clientes que ignoran el TTL</b>: algunas JVM antiguas cacheaban para siempre; un failover por DNS no les llega nunca.</li></ul>',
        nums: '<ul><li>Un acierto en caché local cuesta microsegundos.</li><li>Chrome guarda sus propias entradas DNS durante un tiempo corto (del orden de un minuto) aunque el TTL sea mayor.</li></ul>'
      } },
    { id: 'resolver', layer: 'edge', label: 'Resolver recursivo', sub: '1.1.1.1, 8.8.8.8 o el del ISP', x: 560, y: 322,
      info: {
        resp: '<p>Hace el trabajo pesado: si no tiene la respuesta en caché, recorre la jerarquía DNS preguntando al servidor raíz, luego al del TLD y por último al autoritativo del dominio, y guarda cada respuesta durante su TTL.</p><p>Como lo comparten millones de usuarios, casi siempre tiene en caché los TLD y los dominios populares: una resolución "en frío" completa es rara.</p>',
        api: '<p>Una consulta y su respuesta, en formato <code>dig</code>:</p><pre><code>;; QUESTION\nwww.ejemplo.com.        IN  A\n\n;; ANSWER\nwww.ejemplo.com.   300  IN  CNAME  ejemplo.cdn.net.\nejemplo.cdn.net.   300  IN  A      104.16.132.229</code></pre><p>Los resolvers públicos grandes se anuncian con <b>anycast</b>: la misma IP (1.1.1.1) existe en cientos de ciudades y BGP lleva tu consulta a la más cercana.</p>',
        data: '<p>Caché con dos tipos de entradas:</p><ul><li><b>Positivas</b>: el registro con su TTL.</li><li><b>Negativas</b>: "este nombre no existe" (NXDOMAIN) también se cachea, según el valor mínimo del registro SOA de la zona (RFC 2308). Crear un subdominio y consultarlo antes de tiempo puede dejar un NXDOMAIN cacheado varios minutos.</li></ul>',
        fail: '<ul><li><b>El resolver se cae</b>: nadie que dependa de él resuelve nombres, aunque todos los servidores de destino estén bien. Por eso las redes configuran dos resolvers.</li><li><b>Serve-stale (RFC 8767)</b>: si el autoritativo no responde, el resolver puede servir la respuesta vencida durante un rato en vez de fallar.</li><li><b>Envenenamiento de caché</b>: un atacante intenta colar respuestas falsas; se mitiga con puertos e IDs aleatorios y con DNSSEC.</li></ul>',
        nums: '<ul><li>Acierto en caché: una ida y vuelta al resolver (decenas de ms, menos si está en tu red).</li><li>Resolución completa en frío: 3 a 4 idas y vueltas adicionales, típicamente de 50 a 300 ms en total.</li></ul>'
      } },
    { id: 'root', layer: 'external', label: 'Servidor raíz', sub: 'a.root-servers.net … m', x: 900, y: 112,
      info: {
        resp: '<p>No sabe dónde está <code>www.ejemplo.com</code>; solo sabe quién administra <code>.com</code>. Responde con una <i>referencia</i>: la lista de servidores del TLD.</p><p>Hay 13 identidades de servidor raíz (de la <i>a</i> a la <i>m</i>), operadas por 12 organizaciones distintas y replicadas con anycast en cientos de ubicaciones.</p>',
        api: '<pre><code>;; AUTHORITY (referencia)\ncom.   172800  IN  NS  a.gtld-servers.net.\ncom.   172800  IN  NS  b.gtld-servers.net.\n;; ADDITIONAL (glue)\na.gtld-servers.net.  172800 IN A 192.5.6.30</code></pre><p>El TTL de 172 800 s (2 días) hace que los resolvers casi nunca necesiten volver a preguntar.</p>',
        data: '<p>La zona raíz es un archivo pequeño: los registros NS (y sus direcciones) de cada TLD, firmados con DNSSEC. La publica IANA y se distribuye a todas las instancias.</p>',
        fail: '<p>Tirar la raíz es casi imposible: son cientos de instancias anycast y los resolvers cachean las referencias durante días. Ataques DDoS masivos contra la raíz (2015, por ejemplo) no se notaron para los usuarios finales. <span class="badge badge--doc">Documentado</span></p>',
        nums: '<ul><li>13 identidades, más de mil instancias físicas con anycast.</li><li>TTL de las referencias a TLDs: 2 días.</li></ul>'
      } },
    { id: 'tld', layer: 'external', label: 'Servidor TLD .com', sub: 'x.gtld-servers.net', x: 900, y: 250,
      info: {
        resp: '<p>Administra la zona <code>.com</code>: sabe qué servidores son autoritativos para cada dominio registrado bajo ella. Responde con otra referencia: los NS de <code>ejemplo.com</code>.</p>',
        api: '<pre><code>;; AUTHORITY (referencia)\nejemplo.com.  172800  IN  NS  ns1.cdn.net.\nejemplo.com.  172800  IN  NS  ns2.cdn.net.</code></pre>',
        data: '<p>Una zona enorme (más de 150 millones de dominios <code>.com</code>) con un registro NS por dominio. Cuando cambias de proveedor DNS en tu registrador, lo que cambia es esta entrada.</p>',
        fail: '<p>Cambiar los NS de un dominio tarda en propagarse porque los resolvers cachearon la referencia anterior hasta 2 días. Se planifica: se deja funcionando el proveedor viejo y el nuevo en paralelo durante ese tiempo.</p>',
        nums: '<ul><li>La operación de <code>.com</code> atiende cientos de miles de millones de consultas al día.</li></ul>'
      } },
    { id: 'auth', layer: 'edge', label: 'DNS autoritativo', sub: 'ns1.cdn.net (del dominio)', x: 900, y: 392,
      info: {
        resp: '<p>Es la fuente de verdad de la zona <code>ejemplo.com</code>: tiene los registros reales y decide el TTL. Aquí es donde un proveedor DNS o una CDN aplica inteligencia: devolver la IP anycast de la CDN, o IPs distintas según la región, la salud del origen o pesos de tráfico.</p>',
        api: '<pre><code>;; ANSWER\nwww.ejemplo.com.   300  IN  CNAME  ejemplo.cdn.net.\nejemplo.cdn.net.   300  IN  A      104.16.132.229\nejemplo.cdn.net.   300  IN  HTTPS  1 . alpn="h3,h2"</code></pre><p>El registro <code>HTTPS</code> (RFC 9460) le avisa al navegador, antes de conectar, que el servidor habla HTTP/3.</p>',
        data: '<div class="table-wrap"><table class="t"><thead><tr><th>Registro</th><th>Para qué</th></tr></thead><tbody><tr><td><code>A</code> / <code>AAAA</code></td><td>IPv4 / IPv6 del servicio</td></tr><tr><td><code>CNAME</code></td><td>Alias hacia otro nombre (la CDN)</td></tr><tr><td><code>HTTPS</code></td><td>Protocolos soportados (h3), sugerencias de IP</td></tr><tr><td><code>MX</code>, <code>TXT</code></td><td>Correo, verificaciones, SPF</td></tr><tr><td><code>NS</code>, <code>SOA</code></td><td>Quién es autoritativo, parámetros de la zona</td></tr></tbody></table></div>',
        fail: '<ul><li><b>El proveedor DNS cae</b>: cuando vencen los TTL, nadie puede resolver tu dominio. En octubre de 2016 un DDoS contra el proveedor Dyn dejó inaccesibles a Twitter, GitHub, Netflix y otros durante horas. <span class="badge badge--doc">Documentado</span></li><li><b>Mitigación</b>: dos proveedores DNS independientes listados como NS, y TTLs que equilibren velocidad de cambio y resistencia.</li></ul>',
        nums: '<div class="table-wrap"><table class="t"><thead><tr><th>TTL</th><th>Ganas</th><th>Pagas</th></tr></thead><tbody><tr><td>30–60 s</td><td>Failover por DNS rápido</td><td>Más consultas; menos resistencia si el DNS cae</td></tr><tr><td>300 s</td><td>Equilibrio habitual</td><td>Cambios visibles en ~5 min</td></tr><tr><td>1 día</td><td>Casi sin consultas</td><td>Un error tarda un día en corregirse</td></tr></tbody></table></div>'
      } },
    { id: 'cdn', layer: 'edge', label: 'PoP de la CDN', sub: 'termina TCP y TLS, cachea', x: 560, y: 630,
      info: {
        resp: '<p>El punto de presencia (PoP) más cercano al usuario, al que llega gracias al anycast. Hace tres trabajos que acortan el viaje:</p><ul><li><b>Termina TCP y TLS cerca del usuario</b>: los handshakes cuestan idas y vueltas de 20 ms en lugar de 80 ms o más.</li><li><b>Cachea</b> las respuestas públicas: en un acierto, la request nunca llega al origen.</li><li><b>Reutiliza conexiones calientes hacia el origen</b>: un solo túnel HTTP/2 o HTTP/3 ya abierto en lugar de un handshake por usuario.</li></ul>',
        api: '<p>Headers que controlan la caché (los define el origen):</p><pre><code>HTTP/1.1 200 OK\nCache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=30\nETag: "v42-9f3a"\nVary: Accept-Encoding\nAge: 12\ncf-cache-status: HIT</code></pre><p><code>s-maxage</code> aplica solo a cachés compartidas (la CDN); <code>max-age</code>, al navegador. Una respuesta con cookies de sesión debe ser <code>private</code> y la CDN no la guarda.</p>',
        data: '<p>La caché es un almacén clave-valor distribuido en el PoP:</p><div class="table-wrap"><table class="t"><thead><tr><th>Clave</th><th>Valor</th></tr></thead><tbody><tr><td><code>host + path + query + (Vary)</code></td><td>Cuerpo, headers, fecha de expiración, ETag</td></tr></tbody></table></div><p>Una query string con parámetros aleatorios (<code>?utm=…</code>) fragmenta la caché: cada variante es una clave distinta. Por eso las CDNs permiten normalizar la clave.</p>',
        fail: '<ul><li><b>El PoP cae</b>: la CDN deja de anunciar su prefijo por BGP en esa ciudad y el tráfico llega al siguiente PoP más cercano (M28).</li><li><b>El origen cae</b>: con <code>stale-if-error</code> (RFC 5861) la CDN sigue sirviendo la copia vencida en lugar de un error.</li><li><b>Purga masiva</b>: vaciar la caché de golpe manda todo el tráfico al origen a la vez (cache stampede a escala global, M04).</li></ul>',
        nums: '<ul><li>Acierto de caché: el usuario recibe el primer byte en ~1 ida y vuelta al PoP (10–30 ms).</li><li>Una buena CDN absorbe el 90–99 % de las requests de contenido estático.</li></ul>'
      } },
    { id: 'lb', layer: 'edge', label: 'Balanceador L7', sub: 'ALB, Envoy o nginx', x: 1256, y: 640,
      info: {
        resp: '<p>La puerta de entrada de la región: recibe HTTP ya descifrado (o lo descifra él), elige una instancia sana de la aplicación y le reenvía la request. Al ser de capa 7 entiende HTTP, así que puede enrutar por path o header, reintentar, limitar y registrar cada request.</p><p>Solo manda tráfico a instancias que pasan sus <b>health checks</b>, y al sacar una instancia de rotación espera a que terminen sus requests en curso (<i>connection draining</i>).</p>',
        api: '<p>Headers que agrega para que la aplicación sepa de dónde vino la request:</p><pre><code>X-Forwarded-For: 181.54.12.9, 172.70.4.18\nX-Forwarded-Proto: https\nX-Request-Id: 01J9ZB7M3K8X2T5Q\ntraceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01</code></pre><p>Health check hacia cada instancia: <code>GET /readyz</code> cada 5 s; 3 fallos seguidos la sacan de rotación y 2 éxitos la devuelven.</p>',
        data: '<p>Guarda poco estado: la lista de backends con su salud y, según el algoritmo, contadores de requests activas por backend (para <i>least-request</i>). No guarda sesiones: la aplicación es stateless y la sesión vive en Redis.</p>',
        fail: '<ul><li><b>Una instancia muere</b>: el balanceador lo detecta por error de conexión inmediato o por health check, y reintenta en otra instancia <em>solo si la request es idempotente</em> (GET). Reintentar un POST podría duplicar un pago.</li><li><b>Health checks demasiado profundos</b>: si <code>/readyz</code> consulta la base de datos y la base se pone lenta, todas las instancias "fallan" a la vez y el balanceador se queda sin backends. Los health checks miden la instancia, no sus dependencias.</li></ul>',
        nums: '<ul><li>Latencia agregada: menos de 1 ms.</li><li>Detección de una instancia caída por health check: intervalo × umbral, por ejemplo 5 s × 3 = 15 s.</li></ul>'
      } },
    { id: 'app1', layer: 'service', label: 'Servidor de app 1', sub: 'API y render de páginas', x: 1560, y: 560,
      info: {
        resp: '<p>Ejecuta la lógica: autentica la sesión, consulta datos, arma la respuesta. Es <b>stateless</b>: no guarda nada en memoria que otra instancia necesite, así que cualquier instancia puede atender cualquier request y se pueden agregar o quitar instancias sin coordinación.</p>',
        api: '<div class="table-wrap"><table class="t"><thead><tr><th>Endpoint</th><th>Qué hace</th><th>Caché</th></tr></thead><tbody><tr><td><code>GET /</code></td><td>Página de inicio</td><td><code>public, s-maxage=300</code></td></tr><tr><td><code>GET /api/perfil</code></td><td>Datos del usuario de la sesión</td><td><code>private, no-store</code></td></tr><tr><td><code>GET /healthz</code></td><td>Liveness: el proceso responde</td><td>—</td></tr><tr><td><code>GET /readyz</code></td><td>Readiness: listo para recibir tráfico</td><td>—</td></tr></tbody></table></div>',
        data: '<p>Solo estado efímero: pools de conexiones a Redis y a PostgreSQL, y cachés en memoria de corta duración. Todo lo que debe sobrevivir a un reinicio vive afuera.</p>',
        fail: '<ul><li><b>El proceso muere</b>: las requests en curso fallan; el balanceador reintenta las idempotentes en otra instancia.</li><li><b>Se pone lento</b> (pausas de GC, CPU saturada): peor que morir, porque sigue pasando health checks y acumula requests. Se mitiga con timeouts y con balanceo por requests activas.</li><li><b>Agotamiento del pool de conexiones a la base</b>: si la base se pone lenta, cada request retiene su conexión más tiempo (Ley de Little) y el pool se vacía.</li></ul>',
        nums: '<ul><li>Render de una página: unos pocos ms de CPU.</li><li>Pool típico: 10–50 conexiones a PostgreSQL por instancia; con 100 instancias ya son miles de conexiones, y por eso se usa PgBouncer.</li></ul>'
      } },
    { id: 'app2', layer: 'service', label: 'Servidor de app 2', sub: 'misma imagen, otra zona', x: 1560, y: 752,
      info: {
        resp: '<p>Una réplica idéntica de la aplicación, desplegada en otra zona de disponibilidad. Existe para que la caída de una instancia (o de una zona entera) no se note: el balanceador simplemente deja de enviarle tráfico a la caída.</p>',
        api: '<p>Los mismos endpoints que el servidor 1: las instancias son intercambiables.</p>',
        data: '<p>Ninguno persistente, igual que el servidor 1.</p>',
        fail: '<p>Si las dos instancias comparten el mismo bug, el mismo deploy o la misma zona, caen juntas: la redundancia solo sirve si las fallas son independientes (M00).</p>',
        nums: '<p>Con N instancias, perder una reduce la capacidad en 1/N: se dimensiona para que las N − 1 restantes aguanten el pico.</p>'
      } },
    { id: 'redis', layer: 'cache', label: 'Redis', sub: 'sesiones y fragmentos de página', x: 1848, y: 520,
      info: {
        resp: '<p>Guarda en memoria lo que se lee mucho y es caro de calcular: sesiones de usuario y fragmentos de página. La aplicación usa el patrón <b>cache-aside</b>: busca en Redis, y si no está, va a la base y guarda el resultado con un TTL (M04).</p>',
        api: '<pre><code>GET session:8f2c…                 → hash con user_id y permisos\nGET page:/home:v42                → HTML renderizado\nSET page:/home:v42 &lt;html&gt; EX 60 NX</code></pre>',
        data: '<div class="table-wrap"><table class="t"><thead><tr><th>Clave</th><th>Tipo</th><th>TTL</th></tr></thead><tbody><tr><td><code>session:{id}</code></td><td>hash</td><td>30 min, renovado en cada uso</td></tr><tr><td><code>page:{path}:{versión}</code></td><td>string</td><td>60 s</td></tr></tbody></table></div><p>Poner la versión del contenido en la clave evita tener que invalidar: una versión nueva es simplemente otra clave.</p>',
        fail: '<ul><li><b>Redis cae</b>: todas las lecturas van a la base de datos. Si la base estaba dimensionada contando con el 95 % de aciertos de caché, recibe de golpe 20 veces más carga y también cae. Es el escenario "Redis cae" de este mapa.</li><li><b>Sin timeout en el cliente</b>: cada request espera a que Redis responda hasta agotar el timeout del sistema operativo (segundos). Con un timeout de 50 ms, la aplicación degrada rápido y sigue.</li></ul>',
        nums: '<ul><li>Latencia dentro de la misma zona: 0.2–0.5 ms.</li><li>Un proceso de Redis: ~100 000 operaciones simples por segundo.</li></ul>'
      } },
    { id: 'db', layer: 'db', label: 'PostgreSQL', sub: 'primaria con réplica síncrona', x: 1848, y: 760,
      info: {
        resp: '<p>La fuente de verdad: lo que está aquí es lo que existe. Garantiza durabilidad (un <code>COMMIT</code> confirmado sobrevive a un corte de luz) y consistencia transaccional. Es el componente más difícil de escalar, y por eso todo lo demás del mapa existe para protegerlo de lecturas innecesarias.</p>',
        api: '<pre data-lang="sql"><code>SELECT u.id, u.name, u.plan\nFROM users u\nWHERE u.id = $1;   -- por clave primaria: una lectura de índice</code></pre>',
        data: '<pre data-lang="sql"><code>CREATE TABLE users (\n  id          uuid PRIMARY KEY,\n  email       text NOT NULL UNIQUE,\n  name        text NOT NULL,\n  plan        text NOT NULL DEFAULT \'free\',\n  created_at  timestamptz NOT NULL DEFAULT now()\n);</code></pre>',
        fail: '<ul><li><b>La primaria cae</b>: la réplica se promueve (failover). Mientras dura, las escrituras fallan: de decenas de segundos a un par de minutos en servicios administrados.</li><li><b>Réplica asíncrona</b>: el failover puede perder las últimas transacciones confirmadas. Con réplica síncrona no se pierde nada, a cambio de más latencia en cada escritura (PACELC en acción, M06).</li></ul>',
        nums: '<ul><li>Lectura por clave primaria con datos en memoria: ~0.1–1 ms dentro del servidor, más la ida y vuelta de red.</li><li>Un servidor grande: decenas de miles de lecturas simples por segundo.</li></ul>'
      } }
  ],
  edges: [
    { id: 'e1', from: 'browser', to: 'oscache', label: 'getaddrinfo()', both: true },
    { id: 'e2', from: 'oscache', to: 'resolver', label: 'DNS · UDP 53 o DoH', both: true },
    { id: 'e3', from: 'resolver', to: 'root', both: true },
    { id: 'e4', from: 'resolver', to: 'tld', both: true },
    { id: 'e5', from: 'resolver', to: 'auth', both: true },
    { id: 'e6', from: 'browser', to: 'cdn', label: 'TCP o QUIC · 443', both: true },
    { id: 'e7', from: 'cdn', to: 'lb', label: 'HTTP/2 ya abierta · 30 ms', both: true },
    { id: 'e8', from: 'lb', to: 'app1', both: true },
    { id: 'e9', from: 'lb', to: 'app2', both: true },
    { id: 'e10', from: 'app1', to: 'redis', both: true },
    { id: 'e11', from: 'app1', to: 'db', both: true },
    { id: 'e12', from: 'app2', to: 'redis', both: true },
    { id: 'e13', from: 'app2', to: 'db', both: true }
  ],
  scenarios: [
    {
      id: 'primera', title: 'Primera visita (todo en frío)',
      desc: 'Nada en caché: ni el DNS, ni la conexión, ni la CDN. Es el peor caso realista y muestra de dónde sale cada milisegundo. Supuestos: 20 ms de ida y vuelta hasta el resolver y hasta el PoP, 60 ms entre el PoP y el origen.',
      steps: [
        { at: 'browser', kind: 'info', ms: 1, title: 'Escribes la URL y pulsas Enter', text: 'El navegador interpreta <code>www.ejemplo.com</code>, ve que el dominio está en la lista HSTS y decide usar HTTPS directamente, sin pasar por una redirección desde HTTP.' },
        { from: 'browser', to: 'oscache', kind: 'req', tag: '¿IP?', ms: 0.1, title: 'Busca el nombre en las cachés locales', text: 'Primero la caché del navegador, después la del sistema operativo. Ninguna tiene la respuesta: es la primera visita.' },
        { from: 'oscache', to: 'resolver', kind: 'req', tag: 'A? AAAA?', ms: 10, title: 'Consulta al resolver recursivo', text: 'El stub resolver pregunta por los registros A (IPv4) y AAAA (IPv6). Es un solo paquete UDP en cada dirección; con DoH viajaría cifrado dentro de HTTPS.', code: ';; QUESTION\nwww.ejemplo.com.  IN  A\nwww.ejemplo.com.  IN  AAAA', lang: 'text' },
        { from: 'resolver', to: 'root', kind: 'req', tag: '.com?', ms: 12, title: 'El resolver pregunta a la raíz', text: 'En la práctica el resolver casi siempre tiene esto en caché (TTL de 2 días). Lo mostramos para ver el recorrido completo.' },
        { from: 'root', to: 'resolver', kind: 'res', tag: 'NS .com', ms: 12, title: 'La raíz responde con una referencia', text: 'No sabe la IP; sabe quién administra <code>.com</code> y devuelve sus servidores.' },
        { from: 'resolver', to: 'tld', kind: 'req', tag: 'ejemplo.com?', ms: 12, title: 'Pregunta al TLD .com', text: 'Otra referencia: el TLD sabe qué servidores son autoritativos para <code>ejemplo.com</code>.' },
        { from: 'tld', to: 'resolver', kind: 'res', tag: 'NS', ms: 12, title: 'El TLD devuelve los NS del dominio', text: 'Los servidores autoritativos resultan ser los de la CDN, porque el dominio delegó su DNS en ella.' },
        { from: 'resolver', to: 'auth', kind: 'req', tag: 'www?', ms: 15, title: 'Pregunta al autoritativo', text: 'Esta es la única respuesta que el dueño del dominio controla de verdad.' },
        { from: 'auth', to: 'resolver', kind: 'res', tag: 'CNAME + A', ms: 15, title: 'El autoritativo responde con la IP anycast de la CDN', text: 'Devuelve un CNAME hacia la CDN, la IP anycast, y un registro HTTPS que anuncia HTTP/3. TTL de 300 s: el resolver lo guardará 5 minutos.', code: 'www.ejemplo.com.   300 IN CNAME ejemplo.cdn.net.\nejemplo.cdn.net.   300 IN A     104.16.132.229\nejemplo.cdn.net.   300 IN HTTPS 1 . alpn="h3,h2"', lang: 'text' },
        { from: 'resolver', to: 'oscache', kind: 'res', tag: 'IP', ms: 10, title: 'El resolver contesta y guarda en caché', text: 'A partir de ahora, cualquier usuario de este resolver obtiene la respuesta en una sola ida y vuelta, sin recorrer la jerarquía.' },
        { from: 'oscache', to: 'browser', kind: 'res', tag: 'IP', ms: 0.1, title: 'El navegador tiene la IP', text: 'Van ~110 ms solo de DNS. Con el resolver caliente habrían sido ~20 ms, y con la caché local, cero.' },
        { from: 'browser', to: 'cdn', kind: 'req', tag: 'SYN', ms: 10, title: 'Handshake TCP: SYN', text: 'Abre una conexión TCP con la IP anycast. BGP la lleva al PoP más cercano de la CDN, no a la región de origen.' },
        { from: 'cdn', to: 'browser', kind: 'res', tag: 'SYN-ACK', ms: 10, title: 'Handshake TCP: SYN-ACK', text: 'Una ida y vuelta completa solo para acordar que hay conexión. Todavía no viajó ni un byte útil.' },
        { from: 'browser', to: 'cdn', kind: 'req', tag: 'ACK + ClientHello', ms: 10, title: 'TLS 1.3: ClientHello', text: 'Junto con el ACK, el navegador envía el ClientHello: versiones y cifrados que soporta, su parte del intercambio de claves (key share) y el nombre del sitio (SNI).' },
        { from: 'cdn', to: 'browser', kind: 'res', tag: 'ServerHello', ms: 10, title: 'TLS 1.3: ServerHello, certificado y Finished', text: 'El PoP responde con su key share, el certificado del sitio y la firma. Con esto ambos lados derivan las claves: TLS 1.3 completa el handshake en una sola ida y vuelta (TLS 1.2 necesitaba dos).' },
        { from: 'browser', to: 'cdn', kind: 'req', tag: 'GET /', ms: 10, title: 'Finished y la primera request HTTP', text: 'El navegador verifica el certificado, envía su Finished y en el mismo vuelo la request <code>GET /</code> sobre HTTP/2.', code: ':method: GET\n:authority: www.ejemplo.com\n:path: /\naccept: text/html', lang: 'http' },
        { at: 'cdn', kind: 'info', ms: 0.5, title: 'La CDN busca en su caché: MISS', text: 'La clave es host + path. Nadie pidió esta página en este PoP durante los últimos 5 minutos, así que hay que ir al origen.' },
        { from: 'cdn', to: 'lb', kind: 'req', tag: 'GET /', ms: 30, title: 'El PoP reenvía al origen', text: 'Por una conexión HTTP/2 que el PoP ya tenía abierta con el origen: no paga handshakes. Estos 30 ms son la distancia física entre la ciudad del usuario y la región.' },
        { from: 'lb', to: 'app1', kind: 'req', tag: 'GET /', ms: 0.5, title: 'El balanceador elige una instancia sana', text: 'Con <i>least-request</i> elige la instancia con menos requests en curso. Agrega <code>X-Forwarded-For</code> y un <code>X-Request-Id</code> para trazar la request.' },
        { from: 'app1', to: 'redis', kind: 'req', tag: 'GET page:/home', ms: 0.3, title: 'La aplicación busca la página en Redis', text: 'Cache-aside: primero la caché.' },
        { from: 'redis', to: 'app1', kind: 'res', tag: 'nil', ms: 0.3, title: 'Miss en Redis', text: 'La clave no existe (venció o nunca se calculó).' },
        { from: 'app1', to: 'db', kind: 'req', tag: 'SELECT', ms: 0.5, title: 'Consulta a PostgreSQL', text: 'Lee lo necesario para armar la página.', code: 'SELECT id, title, summary FROM articles\nWHERE published = true\nORDER BY published_at DESC\nLIMIT 20;', lang: 'sql' },
        { from: 'db', to: 'app1', kind: 'res', tag: '20 filas', ms: 2, title: 'La base responde', text: 'Con un índice sobre <code>(published, published_at)</code> es una lectura rápida de pocas páginas del índice.' },
        { from: 'app1', to: 'redis', kind: 'req', tag: 'SET … EX 60', ms: 0.3, title: 'Guarda el resultado en Redis', text: 'Con un TTL de 60 s. Las próximas requests de cualquier instancia lo encuentran en caché.' },
        { at: 'app1', kind: 'info', ms: 8, title: 'Renderiza el HTML', text: 'Unos milisegundos de CPU para armar la página.' },
        { from: 'app1', to: 'lb', kind: 'res', tag: '200 OK', ms: 0.5, title: 'Respuesta al balanceador', text: 'Con <code>Cache-Control: public, s-maxage=300</code> para que la CDN pueda guardarla.' },
        { from: 'lb', to: 'cdn', kind: 'res', tag: '200 OK', ms: 30, title: 'Vuelve al PoP', text: 'La CDN guarda una copia en su caché con la clave de esta URL.' },
        { from: 'cdn', to: 'browser', kind: 'res', tag: '200 · HTML', ms: 10, title: 'Primer byte en el navegador (TTFB)', text: 'Unos 230 ms en total, y menos de 15 ms fueron trabajo de servidores (CDN, balanceador, aplicación, Redis y base). El resto fue red: DNS, handshakes y la distancia hasta el origen. Por eso el M01 importa: la mayor parte de la latencia se gana o se pierde fuera de tu código.' },
        { at: 'browser', kind: 'info', ms: 5, title: 'El navegador descubre CSS, JS e imágenes', text: 'Parsea el HTML y lanza decenas de requests más, todas multiplexadas en la misma conexión HTTP/2: sin DNS ni handshakes nuevos.' }
      ]
    },
    {
      id: 'segunda', title: 'Segunda visita (todo caliente)',
      desc: 'Mismo usuario un minuto después: la IP está en caché, la conexión HTTP/2 sigue abierta y la CDN tiene la página. Compara el tiempo total con el de la primera visita.',
      steps: [
        { from: 'browser', to: 'oscache', kind: 'req', tag: '¿IP?', ms: 0.1, title: 'La IP está en la caché local', text: 'Acierto inmediato: cero red.' },
        { from: 'oscache', to: 'browser', kind: 'res', tag: 'IP', ms: 0.1, title: 'Respuesta local', text: 'Sin consultar al resolver.' },
        { from: 'browser', to: 'cdn', kind: 'req', tag: 'GET /', ms: 10, title: 'Request sobre la conexión ya abierta', text: 'La conexión HTTP/2 con el PoP sigue viva (keep-alive), así que no hay handshake TCP ni TLS: la request sale directo.' },
        { at: 'cdn', kind: 'info', ms: 0.5, title: 'HIT en la CDN', text: 'La copia guardada hace un minuto sigue vigente (<code>s-maxage=300</code>).' },
        { from: 'cdn', to: 'browser', kind: 'res', tag: '200 · HIT', ms: 10, title: 'Respuesta desde el PoP', text: '~21 ms contra ~230 ms: 11 veces más rápido, y el origen ni se enteró. Así se ve el 95 % de las requests de un sitio con buena caché.', code: 'HTTP/2 200\ncache-control: public, s-maxage=300\nage: 64\ncf-cache-status: HIT', lang: 'http' }
      ]
    },
    {
      id: 'h3', title: 'HTTP/3 con 0-RTT',
      desc: 'El navegador ya visitó el sitio: sabe por el registro HTTPS que habla HTTP/3 y guardó un ticket de sesión. QUIC combina transporte y TLS en un solo handshake, y con 0-RTT la request viaja en el primer paquete.',
      steps: [
        { at: 'browser', kind: 'info', ms: 0.1, title: 'Usa lo que ya sabe', text: 'IP en caché, soporte de HTTP/3 anunciado (<code>alpn="h3"</code>) y un ticket de reanudación TLS de la visita anterior.' },
        { from: 'browser', to: 'cdn', kind: 'req', tag: 'Initial + 0-RTT GET', ms: 10, title: 'Un solo vuelo: handshake y request', text: 'QUIC corre sobre UDP y lleva TLS 1.3 adentro. Con el ticket, el navegador cifra la request con claves derivadas de la sesión anterior y la manda en el primer paquete (0-RTT).' },
        { at: 'cdn', kind: 'info', ms: 0.5, title: 'El PoP acepta los datos 0-RTT', text: 'Solo para requests seguras de repetir. Los datos 0-RTT pueden ser capturados y reenviados por un atacante (<i>replay</i>), así que un POST que crea un pedido nunca debe ir en 0-RTT.' },
        { from: 'cdn', to: 'browser', kind: 'res', tag: 'Handshake + 200', ms: 10, title: 'Respuesta en la primera ida y vuelta', text: 'Con TCP + TLS 1.3 nuevos habrían sido 3 idas y vueltas antes del primer byte; con QUIC y 0-RTT, una. Además, QUIC no sufre head-of-line blocking entre streams: un paquete perdido solo frena su propio stream.' }
      ]
    },
    {
      id: 'app-cae', title: 'Cae un servidor de aplicación',
      desc: 'Una request dinámica (no cacheable) llega justo cuando el proceso del servidor 1 muere. Mira qué hace el balanceador y por qué el usuario ni se entera.',
      steps: [
        { from: 'browser', to: 'cdn', kind: 'req', tag: 'GET /api/perfil', ms: 10, title: 'Request privada', text: 'Datos del usuario: <code>Cache-Control: private</code>, la CDN no puede responderla desde caché.' },
        { from: 'cdn', to: 'lb', kind: 'req', tag: 'GET', ms: 30, title: 'Pasa directo al origen', text: 'La CDN solo hace de túnel optimizado.' },
        { from: 'lb', to: 'app1', kind: 'req', tag: 'GET', ms: 0.5, title: 'El balanceador elige el servidor 1', text: 'Todavía pasa los health checks: murió hace un instante.' },
        { at: 'app1', kind: 'fail', ms: 1, down: ['app1'], title: 'El proceso muere', text: 'Un bug de memoria mata el proceso. La conexión se cierra con un reset.' },
        { from: 'app1', to: 'lb', kind: 'fail', tag: 'RST', ms: 0.5, title: 'El balanceador recibe un reset', text: 'Sabe que la request no se completó.' },
        { at: 'lb', kind: 'info', ms: 0.2, title: 'Reintenta en otra instancia porque es un GET', text: 'Un GET es idempotente: repetirlo no cambia nada. Si fuera un <code>POST /pagos</code>, el balanceador no podría saber si el servidor alcanzó a cobrar antes de morir, y reintentar podría cobrar dos veces. Para eso existen las idempotency keys (M02, M27).' },
        { from: 'lb', to: 'app2', kind: 'req', tag: 'GET (reintento)', ms: 0.5, title: 'Reintento en el servidor 2', text: 'Mismo <code>X-Request-Id</code>, para que los logs muestren que es la misma request.' },
        { from: 'app2', to: 'redis', kind: 'req', tag: 'GET session', ms: 0.3, title: 'Lee la sesión en Redis', text: 'Como las instancias son stateless, el servidor 2 puede atender a este usuario sin haberlo visto nunca.' },
        { from: 'redis', to: 'app2', kind: 'res', tag: 'hash', ms: 0.3, title: 'Sesión encontrada', text: 'Usuario autenticado.' },
        { from: 'app2', to: 'lb', kind: 'res', tag: '200', ms: 3, title: 'Respuesta', text: 'El usuario tardó ~2 ms más de lo normal. No vio ningún error.' },
        { from: 'lb', to: 'cdn', kind: 'res', tag: '200', ms: 30, title: 'Vuelve por la CDN', text: '' },
        { from: 'cdn', to: 'browser', kind: 'res', tag: '200', ms: 10, title: 'El usuario recibe su perfil', text: '' },
        { from: 'lb', to: 'app1', kind: 'fail', tag: 'GET /readyz ✕', ms: 0, title: 'Los health checks confirman la falla', text: 'En los siguientes ~15 s (3 checks fallidos cada 5 s) el balanceador saca al servidor 1 de rotación. Mientras tanto, los errores de conexión inmediatos ya desviaban el tráfico. Cuando el orquestador lo reinicie y pase 2 checks, vuelve a recibir tráfico.' }
      ]
    },
    {
      id: 'redis-cae', title: 'Redis cae',
      desc: 'La caché desaparece. La aplicación está bien programada: tiene un timeout corto hacia Redis y sabe seguir sin él. Aun así, mira qué le pasa a la base de datos.',
      down: ['redis'],
      steps: [
        { from: 'browser', to: 'cdn', kind: 'req', tag: 'GET /api/perfil', ms: 10, title: 'Request normal', text: 'El usuario no sabe nada de Redis.' },
        { from: 'cdn', to: 'lb', kind: 'req', tag: 'GET', ms: 30, title: 'Hacia el origen', text: '' },
        { from: 'lb', to: 'app1', kind: 'req', tag: 'GET', ms: 0.5, title: 'Al servidor 1', text: '' },
        { from: 'app1', to: 'redis', kind: 'fail', tag: 'GET session ✕', ms: 50, title: 'Redis no responde: timeout de 50 ms', text: 'Sin timeout configurado, este paso tardaría lo que diga el sistema operativo (segundos) y cada request retendría un hilo: la aplicación entera se colgaría. Con 50 ms, falla rápido.' },
        { at: 'app1', kind: 'info', ms: 0.1, title: 'Circuit breaker abierto', text: 'Tras varios timeouts seguidos, el cliente deja de intentar con Redis durante unos segundos (M08) y va directo a la base: las siguientes requests ya no pagan los 50 ms.' },
        { from: 'app1', to: 'db', kind: 'req', tag: 'SELECT sesión y perfil', ms: 0.5, title: 'Lee todo de PostgreSQL', text: 'La sesión también se guarda en la base (o en un token firmado), así que el usuario sigue autenticado.' },
        { from: 'db', to: 'app1', kind: 'res', tag: 'filas (lento)', ms: 15, title: 'La base responde, pero más lento', text: 'Antes recibía el 5 % de las lecturas; ahora recibe el 100 %. Su latencia sube de 2 a 15 ms y sigue subiendo. Si llega a su límite, la caída de la caché se convierte en la caída de la base: el clásico fallo en cascada que se estudia en M04 y M08.' },
        { from: 'app1', to: 'lb', kind: 'res', tag: '200', ms: 3, title: 'Respuesta degradada pero correcta', text: 'El usuario ve su perfil, un poco más lento.' },
        { from: 'lb', to: 'cdn', kind: 'res', tag: '200', ms: 30, title: 'De vuelta', text: '' },
        { from: 'cdn', to: 'browser', kind: 'res', tag: '200', ms: 10, title: 'Servido sin caché', text: 'Mitigaciones reales: Redis con réplicas y failover automático, load shedding en la aplicación para no saturar la base, y caché en memoria local como segunda línea.' }
      ]
    }
  ]
});
