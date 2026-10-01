/* Mapa del M29: mensajería al estilo de WhatsApp. Lo que WhatsApp publicó (el cifrado, los dispositivos, los límites,
   la escala y parte de su infraestructura histórica) va marcado como documentado; el resto es un diseño de referencia. */
SD.defineMap('m29-whatsapp', {
  title: 'Un mensaje de punta a punta',
  intro: 'Ana le escribe a Beto. Los teléfonos mantienen una conexión persistente con un gateway; un registro de sesiones sabe en qué gateway está cada dispositivo; y los mensajes esperan en un buzón hasta que el destinatario confirma que los recibió. El cifrado, los dispositivos vinculados, los límites y la escala están documentados; la arquitectura interna de este mapa es un diseño de referencia.',
  start: 'msg',
  groups: [
    { id: 'g-tel', label: 'Teléfonos y computadoras', x: 20, y: 40, w: 300, h: 640 },
    { id: 'g-in', label: 'Entrada: conexiones persistentes', x: 470, y: 40, w: 320, h: 640 },
    { id: 'g-srv', label: 'Servicios de una celda (diseño de referencia)', x: 920, y: 40, w: 1060, h: 640 },
    { id: 'g-push', label: 'Notificaciones del sistema operativo', x: 20, y: 760, w: 300, h: 150 },
    { id: 'g-media', label: 'Almacén', x: 1040, y: 760, w: 340, h: 160 }
  ],
  nodes: [
    { id: 'phoneA', layer: 'client', label: 'Teléfono de Ana', sub: 'app con una conexión abierta', x: 170, y: 180,
      info: {
        resp: '<p>La app es la mitad del sistema. Mantiene una conexión persistente con el servidor, cifra y descifra todo en el dispositivo y guarda el historial en una base local: el servidor no conserva los mensajes una vez entregados. Si no hay red, los mensajes esperan en una cola local y se reenvían con el mismo <code>msg_id</code> cuando vuelve la conexión.</p>',
        api: '<pre><code>Hello     { version, device_id, last_seq }       al conectar\nSend      { msg_id, to, ciphertext, kind }       mensaje cifrado, uno por dispositivo destino\nServerAck { msg_id }                              primer tilde: el servidor lo tiene\nDeliver   { seq, msg_id, from, ciphertext }       mensaje entrante\nDeviceAck { seq }                                 "recibí todo hasta aquí"\nReceipt   { msg_id, kind: delivered | read }\nPing / Pong</code></pre>',
        data: '<p>Base local (SQLite): mensajes, contactos, sesiones de cifrado y las claves privadas, que nunca salen del dispositivo. Por eso cambiar de teléfono sin una copia de seguridad cifrada pierde el historial: el servidor no lo tiene.</p>',
        fail: '<ul><li><b>Sin red:</b> cola local y reintento con el mismo <code>msg_id</code>.</li><li><b>App en segundo plano:</b> el sistema operativo corta la conexión; los mensajes llegan por push (escenario "Beto sin conexión").</li><li><b>Red que cambia</b> (de wifi a datos): la conexión TCP muere y se abre otra; el <code>last_seq</code> del Hello evita perder o repetir mensajes.</li></ul>',
        nums: '<ul><li>El intervalo del ping es un compromiso entre batería y detectar cortes: de 30 segundos a unos minutos, según la red, porque los NAT de las operadoras cierran las conexiones que callan demasiado.</li></ul>'
      } },
    { id: 'devB2', layer: 'client', label: 'Computadora de Beto', sub: 'dispositivo vinculado', x: 170, y: 370,
      info: {
        resp: '<p>Un dispositivo vinculado (la versión web o de escritorio). Desde 2021 funciona sin depender del teléfono: tiene su propia identidad criptográfica, su propia conexión y su propio buzón en el servidor. Se pueden vincular hasta cuatro dispositivos además del teléfono. <span class="badge badge--doc">Documentado</span></p>',
        api: '<p>El mismo protocolo de frames que el teléfono, con un <code>device_id</code> propio.</p>',
        data: '<p>Sus propias claves: identidad, prekey firmada y prekeys de un solo uso. El teléfono firma la identidad del dispositivo al vincularlo, y al hacerlo le copia un paquete cifrado con los mensajes de los chats recientes. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<p>Si se desvincula, el servidor lo quita de la lista de dispositivos de la cuenta y los demás dejan de cifrarle mensajes. Si el teléfono reinstala la app, regenera su clave de identidad y eso revoca todos los dispositivos vinculados. <span class="badge badge--doc">Documentado</span></p>',
        nums: '<ul><li>Cada mensaje se cifra una vez por dispositivo destino: con teléfono y computadora, dos veces (escenario "Teléfono y computadora").</li></ul>'
      } },
    { id: 'phoneB', layer: 'client', label: 'Teléfono de Beto', sub: 'a veces sin conexión', x: 170, y: 560,
      info: {
        resp: '<p>El destinatario. Puede estar conectado, con la app cerrada o con el teléfono apagado. El sistema no puede asumir nada: todo mensaje espera en su buzón hasta que este teléfono confirma que lo recibió.</p>',
        api: '<pre><code>Hello     { device_id, last_seq: 40 }         "tengo todo hasta el 40"\nDeliver   { seq: 41, … }                       el servidor manda lo que falta, en orden\nDeviceAck { seq: 43 }                          tras guardarlo en la base local</code></pre>',
        data: '<p>El <code>last_seq</code> que manda al conectarse es lo único que el servidor necesita para saber qué reenviar.</p>',
        fail: '<ul><li><b>Se apaga con mensajes pendientes:</b> se acumulan en su buzón hasta 30 días y después se borran. <span class="badge badge--doc">Documentado</span></li><li><b>Duplicados:</b> si el ack se perdió, el servidor reenvía; la app descarta por <code>msg_id</code>.</li></ul>',
        nums: '<ul><li>Al reconectar tras horas sin conexión, el teléfono puede recibir cientos de mensajes: el servidor los manda en lotes con control de flujo para no ahogar la conexión.</li></ul>'
      } },
    { id: 'lb', layer: 'edge', label: 'Entrada', sub: 'NLB (TCP) y ALB (HTTPS)', x: 630, y: 370,
      info: {
        resp: '<p>Recibe las conexiones TCP de los teléfonos y las reparte entre los gateways, y recibe el tráfico HTTPS (registro, medios) y lo reparte entre los servicios. Para la conexión persistente es un balanceador L4 (M03): no mira el contenido, solo reenvía paquetes, y mantiene cada conexión en el mismo gateway durante toda su vida.</p>',
        api: '<pre><code>listener TCP 443 → grupo de destinos "gateways"\nhealth check TCP al puerto del gateway\nidle timeout de TCP: 350 s por defecto (configurable de 60 a 6000 s)</code></pre>',
        data: '<p>La lista de gateways sanos y la tabla de conexiones en vuelo, que mantiene el propio balanceador.</p>',
        fail: '<ul><li><b>Un gateway falla su health check:</b> deja de recibir conexiones nuevas; las que tenía se cortan.</li><li><b>Keepalive más largo que el idle timeout:</b> el balanceador cierra las conexiones silenciosas. El ping de la app tiene que ser más corto que 350 s. <span class="badge badge--doc">Documentado</span></li><li><b>Tormenta de reconexión:</b> si cae un gateway, cientos de miles de teléfonos llegan a la vez (escenario "Se cae un gateway").</li></ul>',
        nums: '<ul><li>Una unidad de capacidad de NLB admite 100 000 conexiones TCP activas o 800 nuevas por segundo. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'gwA', layer: 'edge', label: 'Gateway de Ana', sub: 'miles de conexiones abiertas', x: 630, y: 180,
      info: {
        resp: '<p>Un proceso que mantiene abiertas cientos de miles de conexiones y hace lo mínimo: autentica la conexión, anota en el registro en qué gateway está cada dispositivo, traduce los frames a llamadas internas y escribe en la conexión lo que le mandan. No guarda mensajes ni sabe de grupos. En WhatsApp original, cada conexión era un proceso ligero de Erlang. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>al abrir la conexión:  autenticar → registro.registrar(usuario, dispositivo, este_gateway, epoch)\ncada ~30 s:            Ping; renueva el TTL de todas sus sesiones, en un lote\nframe Send:            → servicio de mensajes\nllamada Deliver:       → escribir en la conexión y esperar el DeviceAck\nal cerrarse:           registro.borrar_si(epoch == el mío)     (compare-and-delete)</code></pre>',
        data: '<p>Solo memoria: una tabla <code>conexión → {usuario, dispositivo, epoch, último seq enviado, cola de salida acotada}</code>. Nada en disco.</p>',
        fail: '<ul><li><b>Si el proceso muere</b> pierde todas sus conexiones: los teléfonos reconectan y las entradas del registro vencen solas por TTL.</li><li><b>Un cliente lento</b> no frena al resto: la cola de salida de cada conexión tiene un tope, y si se llena se cierra esa conexión.</li></ul>',
        nums: '<ul><li>En 2012, WhatsApp superó los 2 millones de conexiones en un solo servidor; en 2014 operaba alrededor de 1 millón por servidor de chat, con más lógica por conexión. <span class="badge badge--doc">Documentado</span></li><li>Un clon en Go, Java o Elixir: 200 000 a 500 000 conexiones por instancia de 8 vCPU y 32 GB es un objetivo prudente, con 10 a 50 KB por conexión.</li></ul>'
      } },
    { id: 'gwB', layer: 'edge', label: 'Gateway de Beto', sub: 'miles de conexiones abiertas', x: 630, y: 560,
      info: {
        resp: '<p>Otro gateway de la misma flota. Ana y Beto están conectados a gateways distintos, y nada en el diseño lo evita: cualquier conexión puede caer en cualquier gateway. Los gateways no se hablan entre sí; para saber dónde está alguien preguntan al registro o dejan que lo haga el servicio de mensajes.</p>',
        api: '<p>El mismo contrato que el gateway de Ana. La llamada <code>Deliver(dispositivo, seq, blob)</code> le llega desde el servicio de mensajes.</p>',
        data: '<p>Solo memoria, como todos los gateways.</p>',
        fail: '<p>Si este gateway cae con 400 000 conexiones, el registro conserva sus entradas hasta que vence el TTL y el servicio de mensajes debe tolerar esas entradas viejas (escenario "Se cae un gateway").</p>',
        nums: '<ul><li>Con 3 millones de conexiones simultáneas y 400 000 por gateway se necesitan 8; con la capacidad para perder una zona de tres, 12.</li></ul>'
      } },
    { id: 'registry', layer: 'cache', label: 'Registro de sesiones', sub: 'dispositivo → gateway', x: 1070, y: 370,
      info: {
        resp: '<p>Responde una sola pregunta: ¿en qué gateway está conectado este dispositivo ahora? Es un almacén clave-valor en memoria con expiración. Cada gateway escribe una entrada cuando alguien se conecta y la renueva con su heartbeat; el servicio de mensajes la lee para saber adónde mandar cada mensaje. Es el "dónde está cada usuario": los gateways no se comunican entre sí, consultan el registro.</p>',
        api: '<pre><code>SET  sess:{usuario}:{dispositivo} = {gateway, epoch, desde}   EX 90\nGET  sess:{usuario}:{dispositivo}\nDEL  solo si el epoch coincide            (script Lua: compare-and-delete)</code></pre>',
        data: '<p>Una clave por dispositivo conectado, de unos 100 bytes. Para 30 millones de conexiones simultáneas son del orden de 5 a 10 GB con la sobrecarga de la base en memoria, repartidos por hash del usuario entre varios shards con réplica.</p>',
        fail: '<ul><li><b>Entradas viejas:</b> un gateway murió y su entrada sigue hasta que vence. El servicio de mensajes la intenta y, si el gateway no responde, cae a "sin conexión": buzón y push.</li><li><b>Carreras:</b> el teléfono reconecta en otro gateway antes de que el viejo borre su entrada. El <code>epoch</code> lo resuelve: el borrado del viejo falla porque el epoch ya no es el suyo.</li><li><b>Si el registro cae,</b> no se sabe dónde están los usuarios: todo se trata como sin conexión. No se pierde ningún mensaje; hay más pushes y más latencia.</li></ul>',
        nums: '<ul><li>TTL de 90 s con heartbeat cada 30 s: tolera dos heartbeats perdidos.</li><li>Cada mensaje hace al menos una lectura. Un shard de Valkey atiende del orden de 100 000 lecturas simples por segundo; para 500 000 por segundo se reparten entre 6 a 10 shards.</li></ul>'
      } },
    { id: 'msg', layer: 'service', label: 'Servicio de mensajes', sub: 'guarda, busca y reenvía', x: 1430, y: 370,
      info: {
        resp: '<p>El centro del envío. Recibe cada mensaje cifrado, lo guarda en el buzón de cada dispositivo destino y <b>recién entonces</b> confirma al emisor. Después busca dónde está conectado cada destinatario y se lo manda; si no está conectado, pide un push. No puede leer el contenido.</p>',
        api: '<pre data-lang="python"><code>def enviar(emisor, msg_id, cifrados_por_dispositivo):\n    for disp, blob in cifrados_por_dispositivo.items():\n        # PutItem condicional: la clave (disp, msg_id) hace de deduplicación\n        nuevo = buzon.poner_si_no_existe(disp, msg_id, blob)\n    server_ack(emisor, msg_id)                # primer tilde, solo con todo guardado\n    for disp in cifrados_por_dispositivo:\n        entregar(disp)                        # registro.get → gateway.deliver, o push</code></pre>',
        data: '<p>Sin estado propio: usa el buzón y el registro. La deduplicación sale gratis del buzón, porque la clave (dispositivo destino, msg_id) no admite dos veces el mismo mensaje.</p>',
        fail: '<ul><li><b>Muere después de guardar y antes de confirmar:</b> el cliente reintenta con el mismo <code>msg_id</code>; el PutItem condicional detecta el duplicado y se devuelve el ack.</li><li><b>Muere después de confirmar y antes de entregar:</b> el mensaje está en el buzón y se entrega cuando el destinatario se conecte.</li><li><b>Orden:</b> se conserva por dispositivo destino con un <code>seq</code> creciente. No hay un orden global, ni hace falta.</li></ul>',
        nums: '<ul><li>Un mensaje de grupo a 256 miembros son cientos de escrituras de buzón y lecturas del registro: el servicio agrupa por gateway para no hacer una llamada por dispositivo.</li></ul>'
      } },
    { id: 'mailbox', layer: 'db', label: 'Buzones', sub: 'mensajes pendientes, hasta 30 días', x: 1780, y: 370,
      info: {
        resp: '<p>La cola durable de cada dispositivo: lo que el servidor guardó y el teléfono todavía no confirmó. Es store-and-forward: se escribe antes de confirmar al emisor, se lee cuando el destinatario se conecta y se borra cuando confirma. Si un mensaje no se puede entregar, WhatsApp lo retiene cifrado hasta 30 días y después lo borra. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>PutItem    (dispositivo, seq, msg_id, blob, ttl)   condición: no existe (dispositivo, msg_id)\nQuery      dispositivo  WHERE seq &gt; :ultimo  LIMIT 100     para sincronizar al conectar\nDeleteItem (dispositivo, seq)                          tras el DeviceAck</code></pre>',
        data: '<pre data-lang="json"><code>{\n  "dispositivo_id": "beto:1",            // clave de partición\n  "seq": 41,                             // clave de orden, creciente por dispositivo\n  "msg_id": "m_7f3a",\n  "emisor": "ana:1",\n  "ciphertext": "…",                     // opaco para el servidor\n  "tipo": "texto",\n  "ttl": 1793184000                      // 30 días\n}</code></pre>',
        fail: '<p>Si el buzón no responde, el servicio de mensajes no confirma el envío: el primer tilde no aparece y el teléfono de Ana reintenta. Es fail-closed a propósito: confirmar sin haber guardado rompería la promesa de entrega.</p>',
        nums: '<ul><li>Con 500 000 mensajes por segundo en el pico y 1.5 dispositivos por destino son unas 750 000 escrituras y otros tantos borrados por segundo.</li><li>En 2014, WhatsApp reportó una caché de escritura diferida con el 98 % de aciertos para los mensajes transitorios: casi todos se entregan antes de llegar a disco. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'groups', layer: 'service', label: 'Grupos', sub: 'miembros, roles y reparto', x: 1780, y: 180,
      info: {
        resp: '<p>Guarda quién está en cada grupo, sus roles y su configuración. Para un mensaje de grupo devuelve la lista de dispositivos destino. El emisor cifra una sola vez con su Sender Key y el servidor reparte ese mismo ciphertext a todos (fan-out en el servidor). <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>POST  /v1/grupos                       crear, con los miembros iniciales\nPATCH /v1/grupos/{id}/miembros         agregar o quitar (quitar obliga a rotar las Sender Keys)\ninterno:  dispositivos_de(grupo) → lista de (usuario, dispositivo)</code></pre>',
        data: '<pre data-lang="sql"><code>CREATE TABLE grupos   (id uuid PRIMARY KEY, nombre text, version int NOT NULL, creado_por text);\nCREATE TABLE miembros (grupo_id uuid, usuario_id text, rol text, desde timestamptz,\n                       PRIMARY KEY (grupo_id, usuario_id));</code></pre>',
        fail: '<p>Cambios de miembros y mensajes concurrentes: cada mensaje lleva la versión del grupo con que fue cifrado, y si el receptor tiene otra pide los cambios que le faltan. Cuando un miembro sale, todos los participantes descartan su Sender Key y empiezan de nuevo. <span class="badge badge--doc">Documentado</span></p>',
        nums: '<ul><li>El límite es de 1 024 participantes por grupo (eran 256 en 2021 y 512 en 2022). Un mensaje a un grupo lleno son hasta 1 024 entradas de buzón y otras tantas lecturas del registro. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'keys', layer: 'db', label: 'Directorio de claves', sub: 'claves públicas y prekeys', x: 1070, y: 180,
      info: {
        resp: '<p>Guarda solo claves públicas. Al registrarse, cada dispositivo sube su clave de identidad, una prekey firmada y un lote de prekeys de un solo uso. Quien quiere escribirle por primera vez pide un bundle (identidad, prekey firmada y una prekey única), y el servidor borra esa prekey única al entregarla. Así se puede iniciar una conversación cifrada con alguien desconectado. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>PUT /v1/claves                        subir identidad, prekey firmada y un lote de prekeys únicas\nGET /v1/claves/{usuario}/{dispositivo} → bundle; consume UNA prekey única, de forma atómica\nGET /v1/claves/{usuario}               → dispositivos autorizados, con sus firmas</code></pre>',
        data: '<pre data-lang="sql"><code>CREATE TABLE prekeys_unicas (dispositivo_id text, id int, clave bytea, PRIMARY KEY (dispositivo_id, id));\n\n-- consumir una sin que dos pedidos simultáneos reciban la misma:\nDELETE FROM prekeys_unicas\n WHERE (dispositivo_id, id) = (SELECT dispositivo_id, id FROM prekeys_unicas\n                                WHERE dispositivo_id = $1 LIMIT 1 FOR UPDATE SKIP LOCKED)\nRETURNING clave;</code></pre>',
        fail: '<p>Si se agotan las prekeys únicas de un dispositivo, el servidor devuelve el bundle sin ellas y el protocolo omite la última operación Diffie-Hellman: la conversación sigue cifrada, con una garantía algo menor. El teléfono repone prekeys cuando le avisan que quedan pocas. <span class="badge badge--doc">Documentado</span></p>',
        nums: '<ul><li>Un lote de cien prekeys únicas por dispositivo es un valor habitual. Un bundle pesa unos cientos de bytes.</li></ul>'
      } },
    { id: 'push', layer: 'service', label: 'Notificaciones push', sub: 'despierta a teléfonos dormidos', x: 1780, y: 560,
      info: {
        resp: '<p>Cuando el destinatario no tiene sesión, el servicio de mensajes deja una tarea en una cola y este servicio pide un push a Apple (APNs) o a Google (FCM). Como el contenido está cifrado de extremo a extremo, el servidor no puede escribir el texto de la notificación: el push despierta a la app, que se conecta, descarga el mensaje cifrado y lo muestra.</p>',
        api: '<pre><code>APNs:  POST /3/device/{token}     apns-priority, apns-expiration, apns-collapse-id\nFCM:   POST /v1/projects/{id}/messages:send     mensaje de datos, prioridad alta, collapse_key</code></pre>',
        data: '<p>Una tabla <code>dispositivo → token de push, plataforma, último uso</code>. Los tokens caducan: APNs responde 410 cuando un token ya no es válido y hay que borrarlo.</p>',
        fail: '<ul><li>Apple y Google pueden demorar o descartar pushes (ahorro de batería, ráfagas): nunca son la garantía de entrega. La garantía es el buzón.</li><li>Si llegan 50 mensajes a un teléfono apagado se manda un solo push, con una clave de colapso.</li></ul>',
        nums: '<ul><li>El payload de un push llega a 4 KB en APNs y FCM. <span class="badge badge--doc">Documentado</span></li><li>Un push por teléfono sin conexión y por ráfaga, no por mensaje.</li></ul>'
      } },
    { id: 'apns', layer: 'external', label: 'APNs y FCM', sub: 'servicios de Apple y Google', x: 170, y: 835,
      info: {
        resp: '<p>Los servicios de notificaciones de los sistemas operativos: el único canal que el sistema permite para avisar a una app suspendida. Cada uno mantiene su propia conexión persistente con todos los teléfonos de su plataforma.</p>',
        api: '<p>HTTP/2 desde el servicio de push, con el token del dispositivo y un payload chico.</p>',
        data: '<p>Tokens de dispositivo y colas de entrega temporales.</p>',
        fail: '<p>Si el teléfono está apagado, el sistema guarda el último push y lo entrega al reconectarse, hasta un vencimiento. Si está en modo ahorro, puede retrasarlo. Por eso la app también se conecta por su cuenta al abrirse.</p>',
        nums: '<ul><li>Del envío al teléfono, de cientos de milisegundos a unos segundos.</li></ul>'
      } },
    { id: 'media', layer: 'db', label: 'Medios', sub: 'blobs cifrados en S3', x: 1250, y: 845,
      info: {
        resp: '<p>Guarda los adjuntos (fotos, audios, videos, documentos) que el emisor cifró: para el servidor son blobs opacos. El teléfono sube el blob directo al almacenamiento con una URL firmada de corta duración (M09); el mensaje solo lleva la dirección, la clave y el hash. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre data-lang="http"><code>POST /v1/medios/url-subida      → { "url": "https://…s3…?X-Amz-Signature=…", "blob_id": "b_91c" }\nPUT  {url}                      ← el blob cifrado (AES-256-CBC + MAC)\nGET  /v1/medios/b_91c           → URL firmada de descarga, vía CDN</code></pre>',
        data: '<p>Un objeto por blob, con metadatos mínimos (tamaño, fecha, cuenta). El servidor no conoce el nombre del archivo ni su tipo real. La clave de cifrado, el hash SHA-256 y la dirección viajan dentro del mensaje cifrado.</p>',
        fail: '<ul><li><b>Subida interrumpida:</b> multipart y reanudación (M09).</li><li><b>Un blob que nadie descarga</b> se borra por ciclo de vida.</li><li><b>Reenviar un archivo</b> reutiliza el mismo blob y su clave: no se vuelve a subir.</li></ul>',
        nums: '<ul><li>En 2014 pasaban unos 600 millones de fotos y 200 millones de mensajes de voz por día. <span class="badge badge--doc">Documentado</span></li><li>Los medios son la mayor parte del almacenamiento y del ancho de banda: los mensajes de texto pesan cientos de bytes; una foto, cientos de kB.</li></ul>'
      } }
  ],
  edges: [
    { id: 'e1', from: 'phoneA', to: 'lb', both: true, label: 'conexión' },
    { id: 'e2', from: 'devB2', to: 'lb', both: true },
    { id: 'e3', from: 'phoneB', to: 'lb', both: true },
    { id: 'e4', from: 'lb', to: 'gwA', both: true },
    { id: 'e5', from: 'lb', to: 'gwB', both: true },
    { id: 'e6', from: 'gwA', to: 'registry', both: true, label: 'sesiones' },
    { id: 'e7', from: 'gwB', to: 'registry', both: true },
    { id: 'e8', from: 'gwA', to: 'msg', both: true, label: 'mensaje cifrado' },
    { id: 'e9', from: 'gwB', to: 'msg', both: true, label: 'entregar' },
    { id: 'e10', from: 'msg', to: 'registry', both: true, label: '¿dónde está?' },
    { id: 'e11', from: 'msg', to: 'mailbox', both: true, label: 'guardar' },
    { id: 'e12', from: 'msg', to: 'groups', both: true, label: 'miembros' },
    { id: 'e13', from: 'msg', to: 'keys', both: true, label: 'claves' },
    { id: 'e14', from: 'msg', to: 'push', async: true, label: 'despertar' },
    { id: 'e15', from: 'push', to: 'apns', async: true, label: 'enviar push', labelAt: 0.78 },
    { id: 'e16', from: 'apns', to: 'phoneB', async: true, label: 'notificación', labelAt: 0.4 },
    { id: 'e17', from: 'lb', to: 'media', both: true, label: 'HTTPS', labelAt: 0.34 }
  ],
  scenarios: [
    {
      id: 'mensaje-online', title: 'Ana escribe y Beto está conectado',
      desc: 'Ana le manda "hola" a Beto. Los dos tienen la app abierta, en gateways distintos. Se ve cuándo aparece cada tilde y dónde se guarda el mensaje.',
      steps: [
        { at: 'phoneA', kind: 'info', ms: 5, title: 'Cifra en el teléfono', text: 'La app cifra "hola" con la sesión que tiene con Beto. El servidor nunca verá el texto. El mensaje lleva un <code>msg_id</code> que genera el teléfono: es la clave de toda la idempotencia que sigue.' },
        { from: 'phoneA', to: 'lb', kind: 'req', tag: 'Send · msg_id m_7f3a', ms: 30, title: 'Viaja por la conexión que ya está abierta', text: 'No hay handshake nuevo: la conexión persistente es lo que hace que el mensaje tarde decenas de ms y no cientos.' },
        { from: 'lb', to: 'gwA', kind: 'req', tag: '', ms: 0.3, title: 'El balanceador L4 lo reenvía a su gateway', text: 'Sin mirar el contenido: paquetes que van siempre al mismo gateway mientras dure la conexión.' },
        { from: 'gwA', to: 'msg', kind: 'req', tag: 'Send(para Beto)', ms: 2, title: 'El gateway lo entrega al servicio de mensajes', text: 'No sabe quién es Beto ni dónde está. Su trabajo es la conexión.', code: 'Send { msg_id: "m_7f3a", to: "beto", ciphertexts: { "beto:1": "…" } }', lang: 'text' },
        { from: 'msg', to: 'mailbox', kind: 'req', tag: 'PutItem(beto:1, m_7f3a)', ms: 4, title: 'Se guarda en el buzón de Beto, antes de confirmar nada', text: 'Escritura durable y condicional. Si el servicio muere ahora, el mensaje no se pierde; si Ana reintenta, la condición detecta el duplicado.' },
        { from: 'mailbox', to: 'msg', kind: 'res', tag: 'ok · seq 41', ms: 4, title: 'Guardado', text: 'El mensaje recibe el número 41 en el buzón de ese dispositivo: el orden de entrega.' },
        { from: 'msg', to: 'gwA', kind: 'res', tag: 'ServerAck', ms: 2, title: 'Se confirma al emisor', text: '' },
        { from: 'gwA', to: 'lb', kind: 'res', tag: 'ServerAck', ms: 0.3, title: 'Sale por la conexión abierta', text: '' },
        { from: 'lb', to: 'phoneA', kind: 'res', tag: '✓', ms: 30, title: 'Ana ve una tilde', text: 'Significa "el servidor lo tiene", nada más. Si este ack se pierde, la app reintenta con el mismo msg_id y el servidor responde con el mismo ack.' },
        { from: 'msg', to: 'registry', kind: 'req', tag: '¿dónde está beto:1?', ms: 1, title: 'Busca dónde está conectado Beto', text: 'Una lectura de <code>sess:beto:1</code>.' },
        { from: 'registry', to: 'msg', kind: 'res', tag: 'gwB · epoch 12', ms: 1, title: 'Está en el gateway de Beto', text: 'Con el epoch de esa conexión. Este dato puede estar desactualizado unos segundos; el diseño lo tolera.' },
        { from: 'msg', to: 'gwB', kind: 'req', tag: 'Deliver(beto:1, seq 41)', ms: 2, title: 'Se lo manda a ese gateway', text: '' },
        { from: 'gwB', to: 'lb', kind: 'req', tag: 'Deliver', ms: 0.3, title: 'Sale por la conexión abierta', text: '' },
        { from: 'lb', to: 'phoneB', kind: 'req', tag: 'Deliver 41', ms: 30, title: 'Llega al teléfono de Beto', text: '' },
        { at: 'phoneB', kind: 'info', ms: 5, title: 'Descifra y guarda', text: 'La app descifra con su sesión, guarda el mensaje en su base local y recién entonces confirma. Descarta por msg_id si ya lo tenía.' },
        { from: 'phoneB', to: 'lb', kind: 'res', tag: 'DeviceAck 41', ms: 30, title: 'Confirma la recepción', text: '' },
        { from: 'lb', to: 'gwB', kind: 'res', tag: '', ms: 0.3, title: 'Al gateway que tiene la conexión', text: '' },
        { from: 'gwB', to: 'msg', kind: 'res', tag: 'DeviceAck 41', ms: 2, title: 'El servicio sabe que Beto lo tiene', text: '' },
        { from: 'msg', to: 'mailbox', kind: 'req', tag: 'DeleteItem(seq 41)', ms: 4, title: 'Sale del buzón', text: 'Entregado: el servidor ya no guarda nada. El mensaje vive en los dos teléfonos.' },
        { from: 'msg', to: 'gwA', kind: 'res', tag: 'Receipt delivered', ms: 2, title: 'Avisa a Ana que se entregó', text: 'El recibo es otro mensaje, que viaja por el mismo camino en sentido contrario.' },
        { from: 'gwA', to: 'lb', kind: 'res', tag: '', ms: 0.3, title: 'Sale por la conexión abierta', text: '' },
        { from: 'lb', to: 'phoneA', kind: 'res', tag: '✓✓', ms: 30, title: 'Ana ve dos tildes', text: 'Unos 150 ms en total desde que Ana apretó enviar. Cuando Beto lea la conversación, sale un recibo "leído" por el mismo camino: los tildes azules.' }
      ]
    },
    {
      id: 'mensaje-offline', title: 'Beto sin conexión',
      desc: 'Beto tiene el teléfono sin red. El mensaje espera en su buzón, se avisa por push y se entrega cuando la app se conecta.',
      steps: [
        { from: 'phoneA', to: 'lb', kind: 'req', tag: 'Send · m_7f4b', ms: 30, title: 'Ana envía otro mensaje', text: '' },
        { from: 'lb', to: 'gwA', kind: 'req', tag: '', ms: 0.3, title: 'Al gateway que tiene la conexión', text: '' },
        { from: 'gwA', to: 'msg', kind: 'req', tag: 'Send', ms: 2, title: 'Al servicio de mensajes', text: '' },
        { from: 'msg', to: 'mailbox', kind: 'req', tag: 'PutItem(beto:1)', ms: 4, title: 'Se guarda en el buzón de Beto', text: 'Igual que si estuviera conectado: el buzón es el camino de todos los mensajes, no solo de los que esperan.' },
        { from: 'mailbox', to: 'msg', kind: 'res', tag: 'ok · seq 42', ms: 4, title: 'Guardado en el buzón', text: '' },
        { from: 'msg', to: 'gwA', kind: 'res', tag: 'ServerAck', ms: 2, title: 'Ana ve una tilde', text: 'El servidor tiene el mensaje. Que Beto no esté conectado no cambia la promesa del primer tilde.' },
        { from: 'msg', to: 'registry', kind: 'req', tag: '¿dónde está beto:1?', ms: 1, title: 'Busca a Beto', text: '' },
        { from: 'registry', to: 'msg', kind: 'fail', tag: 'sin sesión', ms: 1, title: 'No hay entrada', text: 'La clave no existe o venció su TTL: ningún gateway la renueva porque Beto no está conectado.' },
        { from: 'msg', to: 'push', kind: 'async', tag: 'despertar beto:1', ms: 5, title: 'Deja una tarea para el servicio de push', text: 'En una cola: el servicio de mensajes no espera a Apple ni a Google.' },
        { from: 'push', to: 'apns', kind: 'async', tag: 'push sin contenido', ms: 20, title: 'Pide un push', text: 'Sin texto: el servidor no puede leer el mensaje. Solo dice "hay algo nuevo". Si se acumulan varios, se colapsan en un solo aviso.' },
        { from: 'apns', to: 'phoneB', kind: 'async', tag: 'notificación', ms: 600, title: 'El sistema operativo despierta la app', text: 'El teléfono recibe el aviso aunque la app esté cerrada.' },
        { at: 'phoneB', kind: 'info', ms: 1500, title: 'La app abre su conexión', text: 'Horas después, o al recuperar la red. Hace el handshake con el servidor, se autentica con su clave y dice hasta qué mensaje recibió.' },
        { from: 'phoneB', to: 'lb', kind: 'req', tag: 'Hello · last_seq 40', ms: 40, title: 'Hello: "tengo todo hasta el 40"', text: '' },
        { from: 'lb', to: 'gwB', kind: 'req', tag: '', ms: 0.3, title: 'Al gateway que tiene la conexión', text: '' },
        { from: 'gwB', to: 'registry', kind: 'req', tag: 'registrar · epoch 13', ms: 1, title: 'El gateway registra la sesión', text: 'Desde este momento, el registro sabe que Beto está aquí. Una entrada con TTL, renovada por el heartbeat.' },
        { from: 'gwB', to: 'msg', kind: 'req', tag: 'Sync(desde 40)', ms: 2, title: 'Pide lo que falta', text: '' },
        { from: 'msg', to: 'mailbox', kind: 'req', tag: 'Query(seq &gt; 40)', ms: 4, title: 'Lee el buzón, en orden', text: '' },
        { from: 'mailbox', to: 'msg', kind: 'res', tag: '2 mensajes: 41, 42', ms: 4, title: 'Los mensajes que esperaban', text: 'Quizá cientos, si fueron horas. Se mandan en lotes, con control de flujo.' },
        { from: 'msg', to: 'gwB', kind: 'res', tag: 'Deliver ×2', ms: 2, title: 'Se los manda al gateway de Beto', text: '' },
        { from: 'gwB', to: 'lb', kind: 'res', tag: '', ms: 0.3, title: 'Sale por la conexión abierta', text: '' },
        { from: 'lb', to: 'phoneB', kind: 'res', tag: 'Deliver 41, 42', ms: 30, title: 'Llegan al teléfono', text: 'El mismo camino que si hubiera estado conectado, con unas horas de demora.' },
        { from: 'phoneB', to: 'lb', kind: 'res', tag: 'DeviceAck 42', ms: 30, title: 'Confirma hasta el 42', text: 'Un solo ack acumulativo cubre los dos.' },
        { from: 'lb', to: 'gwB', kind: 'res', tag: '', ms: 0.3, title: 'Al gateway que tiene la conexión', text: '' },
        { from: 'gwB', to: 'msg', kind: 'res', tag: 'DeviceAck 42', ms: 2, title: 'Al servicio de mensajes', text: '' },
        { from: 'msg', to: 'mailbox', kind: 'req', tag: 'DeleteRange(≤ 42)', ms: 4, title: 'Se vacía el buzón', text: '' },
        { from: 'msg', to: 'gwA', kind: 'res', tag: 'Receipt delivered', ms: 2, title: 'Ana verá dos tildes', text: 'Horas después de haber enviado. Si Beto hubiera tardado más de 30 días, el mensaje se habría borrado del buzón sin entregarse.' }
      ]
    },
    {
      id: 'grupo', title: 'Mensaje a un grupo de 256',
      desc: 'Ana escribe en un grupo de 256 personas. El servidor reparte un mismo mensaje cifrado a todos: es el caso que multiplica todo por 300.',
      steps: [
        { at: 'phoneA', kind: 'info', ms: 5, title: 'Cifra una sola vez', text: 'Ana ya repartió su Sender Key a cada miembro, cifrada por separado para cada uno, la primera vez que escribió en el grupo. Ahora cifra el mensaje una sola vez con esa clave, sin importar cuántos sean.' },
        { from: 'phoneA', to: 'lb', kind: 'req', tag: 'Send(para grupo G)', ms: 30, title: 'Un solo mensaje sale del teléfono', text: 'Un ciphertext, no 256.' },
        { from: 'lb', to: 'gwA', kind: 'req', tag: '', ms: 0.3, title: 'Al gateway que tiene la conexión', text: '' },
        { from: 'gwA', to: 'msg', kind: 'req', tag: 'Send(G)', ms: 2, title: 'Al servicio de mensajes', text: '' },
        { from: 'msg', to: 'groups', kind: 'req', tag: '¿dispositivos de G?', ms: 2, title: 'Consulta quién está en el grupo', text: '' },
        { from: 'groups', to: 'msg', kind: 'res', tag: '256 miembros · 312 dispositivos', ms: 2, title: 'La lista de destinos', text: 'Con dispositivos vinculados hay más destinos que personas: 312 dispositivos de 256 miembros, sin contar los de Ana.' },
        { from: 'msg', to: 'mailbox', kind: 'req', tag: 'BatchPut ×311', ms: 25, title: 'Una entrada en el buzón de cada dispositivo', text: 'El mismo ciphertext copiado 311 veces. Es el costo del fan-out en el servidor: una escritura por destino. Se hace en lotes.' },
        { from: 'mailbox', to: 'msg', kind: 'res', tag: 'ok', ms: 8, title: 'Guardado en el buzón', text: '' },
        { from: 'msg', to: 'gwA', kind: 'res', tag: 'ServerAck', ms: 2, title: 'Ana ve una tilde', text: 'Cuando las 311 entradas están guardadas.' },
        { from: 'msg', to: 'registry', kind: 'req', tag: 'BatchGet ×311', ms: 3, title: 'Busca a los 311 dispositivos', text: 'Una lectura por lote, repartida entre los shards del registro.' },
        { from: 'registry', to: 'msg', kind: 'res', tag: '240 conectados', ms: 3, title: 'Unos 240 están conectados', text: 'Los otros 71 irán por push.' },
        { from: 'msg', to: 'gwB', kind: 'req', tag: 'Deliver ×N (agrupado)', ms: 5, title: 'Agrupa por gateway', text: 'Para cada gateway, una sola llamada con todos los dispositivos que tiene. Si no, serían 240 llamadas.' },
        { from: 'gwB', to: 'lb', kind: 'req', tag: '', ms: 0.3, title: 'Sale por la conexión abierta', text: '' },
        { from: 'lb', to: 'phoneB', kind: 'req', tag: 'Deliver', ms: 30, title: 'Cada miembro conectado lo recibe', text: 'Todos descifran con la Sender Key de Ana.' },
        { from: 'msg', to: 'push', kind: 'async', tag: 'despertar ×71', ms: 5, title: 'Los demás, por push', text: 'Un aviso por dispositivo sin conexión.' },
        { at: 'mailbox', kind: 'info', ms: 1, title: 'El costo real de un grupo', text: 'Un mensaje se convierte en 311 escrituras de buzón, 311 lecturas del registro, hasta 311 entregas y hasta 311 borrados. Un grupo de 1 024 lo multiplica por cuatro. Por eso el límite es un número y no "ilimitado".' },
        { from: 'phoneB', to: 'lb', kind: 'res', tag: 'DeviceAck', ms: 30, title: 'Cada uno confirma', text: '' },
        { from: 'lb', to: 'gwB', kind: 'res', tag: '', ms: 0.3, title: 'Al gateway que tiene la conexión', text: '' },
        { from: 'gwB', to: 'msg', kind: 'res', tag: 'DeviceAck ×N', ms: 2, title: 'Al servicio de mensajes', text: '' },
        { from: 'msg', to: 'mailbox', kind: 'req', tag: 'DeleteItem ×N', ms: 10, title: 'Se vacían esos buzones', text: '' },
        { at: 'msg', kind: 'info', ms: 1, title: 'Un recibo por grupo, no 256', text: 'El estado "entregado" y "leído" de un mensaje de grupo se agrega: a Ana le llega un resumen, no un recibo de cada persona. Si no, cada mensaje generaría otros 256.' }
      ]
    },
    {
      id: 'primer-mensaje', title: 'Primer mensaje a alguien nuevo',
      desc: 'Ana nunca habló con Carla. Antes de poder cifrar el primer mensaje necesita las claves públicas de Carla, aunque Carla esté desconectada.',
      steps: [
        { at: 'phoneA', kind: 'info', ms: 1, title: 'No hay una sesión con Carla', text: 'Sin sesión de cifrado no se puede enviar nada. Hace falta un secreto compartido, y Carla no está para negociarlo.' },
        { from: 'phoneA', to: 'lb', kind: 'req', tag: 'GET /claves/carla/1', ms: 30, title: 'Pide el bundle de claves de Carla', text: '' },
        { from: 'lb', to: 'gwA', kind: 'req', tag: '', ms: 0.3, title: 'Al gateway que tiene la conexión', text: '' },
        { from: 'gwA', to: 'msg', kind: 'req', tag: 'pedir bundle', ms: 2, title: 'Al servicio de mensajes', text: '' },
        { from: 'msg', to: 'keys', kind: 'req', tag: 'bundle de carla:1', ms: 3, title: 'Consulta el directorio de claves', text: '' },
        { at: 'keys', kind: 'info', ms: 3, title: 'Consume una prekey de un solo uso', text: 'Entrega la identidad de Carla, su prekey firmada y una prekey única, y borra esa prekey única en la misma operación atómica: así cada conversación nueva usa una distinta.' },
        { from: 'keys', to: 'msg', kind: 'res', tag: 'identidad + prekey firmada + única #17', ms: 3, title: 'El bundle', text: 'Son claves públicas: no sirven para leer nada.' },
        { from: 'msg', to: 'gwA', kind: 'res', tag: 'bundle', ms: 2, title: 'De vuelta al gateway de Ana', text: '' },
        { from: 'gwA', to: 'lb', kind: 'res', tag: '', ms: 0.3, title: 'Sale por la conexión abierta', text: '' },
        { from: 'lb', to: 'phoneA', kind: 'res', tag: 'bundle', ms: 30, title: 'Llega al teléfono de Ana', text: '' },
        { at: 'phoneA', kind: 'info', ms: 4, title: 'Calcula el secreto compartido', text: 'Con cuatro operaciones Diffie-Hellman entre sus claves y las de Carla (X3DH) obtiene una clave raíz que Carla podrá reconstruir después, sin que el servidor intervenga. De ahí salen las claves de cada mensaje (Double Ratchet).' },
        { from: 'phoneA', to: 'lb', kind: 'req', tag: 'Send(PreKeyMessage)', ms: 30, title: 'Envía el primer mensaje', text: 'Cifrado, y con el encabezado que Carla necesita para reconstruir la sesión: la clave efímera de Ana y cuál prekey única usó.' },
        { from: 'lb', to: 'gwA', kind: 'req', tag: '', ms: 0.3, title: 'Al gateway que tiene la conexión', text: '' },
        { from: 'gwA', to: 'msg', kind: 'req', tag: 'Send', ms: 2, title: 'Al servicio de mensajes', text: '' },
        { from: 'msg', to: 'mailbox', kind: 'req', tag: 'PutItem(carla:1)', ms: 4, title: 'Espera en el buzón de Carla', text: 'Carla puede estar apagada. Ana ya puede seguir escribiendo: hasta que Carla responda, cada mensaje lleva el mismo encabezado de inicio.' },
        { at: 'keys', kind: 'fail', ms: 1, title: 'Y si se agotaron las prekeys únicas', text: 'El servidor entrega el bundle sin ellas, y el protocolo omite la última operación Diffie-Hellman. La conversación sigue cifrada, con una garantía algo menor. Carla repone prekeys cuando su teléfono se conecta y le avisan que quedan pocas.' }
      ]
    },
    {
      id: 'foto', title: 'Ana envía una foto',
      desc: 'Una foto de 2 MB no viaja por la conexión de mensajes. Se cifra en el teléfono, se sube a un almacén de objetos y el mensaje solo lleva la clave y la dirección.',
      steps: [
        { at: 'phoneA', kind: 'info', ms: 40, title: 'Cifra la foto', text: 'Genera una clave AES-256 y una clave HMAC de 32 bytes cada una, cifra la foto con AES en modo CBC con un IV aleatorio y agrega un MAC al final. Para el servidor será un blob opaco.' },
        { from: 'phoneA', to: 'lb', kind: 'req', tag: 'POST /medios/url-subida', ms: 30, title: 'Pide dónde subirla', text: 'Una llamada HTTPS, no el protocolo de mensajes.' },
        { from: 'lb', to: 'media', kind: 'req', tag: '', ms: 1, title: 'Al servicio de medios', text: '' },
        { at: 'media', kind: 'info', ms: 3, title: 'Firma una URL de subida', text: 'Una URL de corta duración para un objeto concreto (SigV4, M09): el servicio no ve la foto, y el teléfono sube directo al almacén.' },
        { from: 'media', to: 'lb', kind: 'res', tag: 'URL firmada', ms: 1, title: 'De vuelta al teléfono', text: '' },
        { from: 'lb', to: 'phoneA', kind: 'res', tag: 'url + blob_id', ms: 30, title: 'Llega al teléfono de Ana', text: '' },
        { from: 'phoneA', to: 'lb', kind: 'req', tag: 'PUT blob cifrado · 2 MB', ms: 800, title: 'Sube el blob cifrado', text: 'Con subida por partes y reanudación si la conexión se corta. Es lo más lento de todo el envío.' },
        { from: 'lb', to: 'media', kind: 'req', tag: 'PUT', ms: 5, title: 'Al servicio de medios', text: '' },
        { from: 'media', to: 'lb', kind: 'res', tag: '200', ms: 5, title: 'El objeto queda guardado', text: '' },
        { from: 'lb', to: 'phoneA', kind: 'res', tag: '200', ms: 30, title: 'Llega al teléfono de Ana', text: '' },
        { from: 'phoneA', to: 'lb', kind: 'req', tag: 'Send(imagen, clave, hash, blob_id)', ms: 30, title: 'Envía el mensaje, que es chico', text: 'Lleva la clave de cifrado, la clave HMAC, el hash SHA-256 del blob y su dirección, cifrados extremo a extremo como cualquier otro mensaje. Pesa unos cientos de bytes.' },
        { from: 'lb', to: 'gwA', kind: 'req', tag: '', ms: 0.3, title: 'Al gateway que tiene la conexión', text: '' },
        { from: 'gwA', to: 'msg', kind: 'req', tag: 'Send', ms: 2, title: 'Al servicio de mensajes', text: '' },
        { from: 'msg', to: 'mailbox', kind: 'req', tag: 'PutItem(beto:1)', ms: 4, title: 'Entra por el camino de siempre', text: 'Para el servicio de mensajes, una foto es un mensaje como otro.' },
        { from: 'msg', to: 'gwB', kind: 'req', tag: 'Deliver', ms: 4, title: 'Se entrega a Beto', text: 'Por el registro y su gateway, como en el escenario del mensaje de texto.' },
        { from: 'gwB', to: 'lb', kind: 'req', tag: '', ms: 0.3, title: 'Sale por la conexión abierta', text: '' },
        { from: 'lb', to: 'phoneB', kind: 'req', tag: 'Deliver (imagen)', ms: 30, title: 'El teléfono de Beto recibe el mensaje', text: 'Todavía no tiene la foto, solo cómo encontrarla y cómo abrirla.' },
        { from: 'phoneB', to: 'lb', kind: 'req', tag: 'GET blob', ms: 30, title: 'Descarga el blob', text: 'Directo del almacén, por una URL firmada y a través de una CDN (M28), sin pasar por los gateways.' },
        { from: 'lb', to: 'media', kind: 'req', tag: 'GET', ms: 5, title: 'Al servicio de medios', text: '' },
        { from: 'media', to: 'lb', kind: 'res', tag: 'blob · 2 MB', ms: 300, title: 'De vuelta al teléfono', text: '' },
        { from: 'lb', to: 'phoneB', kind: 'res', tag: 'blob', ms: 200, title: 'Llega el blob', text: '' },
        { at: 'phoneB', kind: 'info', ms: 40, title: 'Verifica y descifra', text: 'Comprueba el SHA-256 del blob y su MAC con las claves del mensaje; si algo no coincide, lo descarta. Después descifra la foto.' },
        { at: 'media', kind: 'info', ms: 1, title: 'Reenviar no vuelve a subir', text: 'Si Beto reenvía la foto a un amigo, el mensaje nuevo apunta al mismo blob con la misma clave: no se sube otra copia. Un blob que nadie descarga se borra por ciclo de vida.' }
      ]
    },
    {
      id: 'multidispositivo', title: 'Teléfono y computadora de Beto',
      desc: 'Beto tiene la app en el teléfono y en la computadora, y cada uno es un dispositivo con sus propias claves. Ana cifra el mensaje una vez por dispositivo.',
      steps: [
        { at: 'phoneA', kind: 'info', ms: 5, title: 'Cifra una vez por dispositivo', text: 'Ana pide la lista de dispositivos de Beto y cifra el mensaje con la sesión de cada uno: dos ciphertexts distintos. También cifra una copia para su propia computadora, si tiene una. Es el fan-out en el cliente. <span class="badge badge--doc">Documentado</span>' },
        { from: 'phoneA', to: 'lb', kind: 'req', tag: 'Send: beto:1, beto:2', ms: 30, title: 'Un Send con dos ciphertexts', text: '' },
        { from: 'lb', to: 'gwA', kind: 'req', tag: '', ms: 0.3, title: 'Al gateway que tiene la conexión', text: '' },
        { from: 'gwA', to: 'msg', kind: 'req', tag: 'Send', ms: 2, title: 'Al servicio de mensajes', text: '' },
        { from: 'msg', to: 'mailbox', kind: 'req', tag: 'PutItem ×2', ms: 5, title: 'Un buzón por dispositivo', text: 'Cada dispositivo tiene su propia cola y su propio número de secuencia: sincronizan por separado.' },
        { from: 'msg', to: 'gwA', kind: 'res', tag: 'ServerAck', ms: 2, title: 'Primer tilde', text: '' },
        { from: 'msg', to: 'registry', kind: 'req', tag: 'BatchGet(beto:1, beto:2)', ms: 1, title: 'Busca los dos dispositivos', text: 'Hay una entrada de sesión por dispositivo: <code>sess:beto:1</code> y <code>sess:beto:2</code>.' },
        { from: 'registry', to: 'msg', kind: 'res', tag: 'beto:1 → gwB · beto:2 → gwB', ms: 1, title: 'Los dos están conectados', text: 'No tienen por qué estar en el mismo gateway.' },
        { from: 'msg', to: 'gwB', kind: 'req', tag: 'Deliver ×2', ms: 2, title: 'Se entrega a cada uno', text: '' },
        { from: 'gwB', to: 'lb', kind: 'req', tag: '', ms: 0.3, title: 'Sale por la conexión abierta', text: '' },
        { from: 'lb', to: 'phoneB', kind: 'req', tag: 'Deliver (beto:1)', ms: 30, title: 'Llega al teléfono', text: '' },
        { from: 'lb', to: 'devB2', kind: 'req', tag: 'Deliver (beto:2)', ms: 30, title: 'Y a la computadora', text: 'Cada uno descifra con su propia sesión. La computadora no le pide nada al teléfono: funciona aunque esté apagado.' },
        { from: 'phoneB', to: 'lb', kind: 'res', tag: 'DeviceAck', ms: 30, title: 'Cada dispositivo confirma por separado', text: '' },
        { from: 'devB2', to: 'lb', kind: 'res', tag: 'DeviceAck', ms: 30, title: 'DeviceAck', text: '' },
        { at: 'msg', kind: 'info', ms: 1, title: 'El recibo sale con el primero', text: 'El "entregado" a Ana se manda cuando llegó a un dispositivo de Beto, sin esperar a los demás: si no, una computadora olvidada en un cajón bloquearía los dos tildes. Es una decisión de diseño de referencia.' },
        { at: 'devB2', kind: 'info', ms: 1, title: 'Un dispositivo nuevo', text: 'Al vincular una computadora, el teléfono le firma su identidad y le copia, cifrado, el historial de los chats recientes. Hasta cuatro dispositivos además del teléfono. <span class="badge badge--doc">Documentado</span>' }
      ]
    },
    {
      id: 'gateway-cae', title: 'Se cae un gateway',
      desc: 'Un gateway con 400 000 conexiones muere de golpe. Los teléfonos reconectan, el registro queda con entradas viejas y nadie pierde un mensaje.',
      down: ['gwB'],
      steps: [
        { at: 'gwB', kind: 'fail', ms: 1, down: ['gwB'], title: 'El gateway muere', text: 'Un bug, una falla de hardware o una zona que se corta. Las 400 000 conexiones desaparecen a la vez, y el proceso no alcanza a borrar sus entradas del registro.' },
        { from: 'phoneB', to: 'lb', kind: 'fail', tag: 'conexión cortada', ms: 5000, title: 'Los teléfonos lo notan', text: 'Unos al instante, si el servidor alcanza a mandar un reset; otros recién cuando falla su ping, unos segundos después.' },
        { at: 'lb', kind: 'info', ms: 10000, title: 'El balanceador lo saca de rotación', text: 'Después de varios health checks fallidos (del orden de 10 a 30 segundos) el gateway deja de recibir conexiones nuevas. Mientras tanto, algunos teléfonos pueden intentar conectarse a él y fallar.' },
        { from: 'msg', to: 'registry', kind: 'req', tag: '¿dónde está beto:1?', ms: 1, title: 'Llega un mensaje para Beto', text: 'Dentro de la ventana en que el registro todavía no dio por vencida la sesión.' },
        { from: 'registry', to: 'msg', kind: 'res', tag: 'gwB · epoch 12 (vieja)', ms: 1, title: 'Devuelve una entrada vieja', text: 'El TTL de 90 s todavía no venció. El registro no sabe que gwB murió: solo sabe lo que los gateways le dijeron.' },
        { from: 'msg', to: 'gwB', kind: 'fail', tag: 'Deliver ✕', ms: 200, title: 'El gateway no responde', text: 'Timeout corto de 200 ms. El mensaje no se perdió: ya está en el buzón de Beto.' },
        { at: 'msg', kind: 'info', ms: 2, title: 'Trata la sesión como inexistente', text: 'Borra la entrada con compare-and-delete (solo si sigue siendo el epoch 12) y pide un push. No reintenta en bucle: la entrega se completa cuando Beto reconecte.' },
        { at: 'phoneB', kind: 'info', ms: 30000, title: 'Reconecta con backoff y jitter', text: 'Cada teléfono espera un tiempo aleatorio antes de reintentar, y la ventana se duplica en cada fallo. Con 400 000 teléfonos repartidos en 60 segundos llegan unas 6 700 conexiones por segundo, no 400 000 de golpe.' },
        { from: 'phoneB', to: 'lb', kind: 'req', tag: 'Hello · last_seq 41', ms: 40, title: 'Uno de los teléfonos vuelve', text: '' },
        { from: 'lb', to: 'gwA', kind: 'req', tag: '', ms: 0.3, title: 'Cae en un gateway sano', text: 'El balanceador ya no ofrece a gwB. Este teléfono termina en el gateway de Ana.' },
        { at: 'gwA', kind: 'info', ms: 1, title: 'Control de admisión', text: 'Cada gateway acepta un máximo de conexiones nuevas por segundo. Las que sobran reciben un rechazo con un "reintenta en N segundos" aleatorio, en lugar de dejar que el servidor se ahogue con los handshakes.' },
        { from: 'gwA', to: 'registry', kind: 'req', tag: 'registrar · epoch 14', ms: 1, title: 'Registra la sesión nueva', text: 'Con un epoch mayor. Si el gateway muerto reapareciera y tratara de borrar la entrada, su compare-and-delete fallaría.' },
        { from: 'gwA', to: 'msg', kind: 'req', tag: 'Sync(desde 41)', ms: 2, title: 'Pide lo que quedó en el buzón', text: '' },
        { from: 'msg', to: 'gwA', kind: 'res', tag: 'Deliver (pendientes)', ms: 4, title: 'Se entrega lo pendiente', text: 'Nadie perdió nada: los mensajes estaban en el buzón, no en el gateway.' }
      ]
    },
    {
      id: 'despliegue', title: 'Desplegar una versión nueva',
      desc: 'Actualizar un gateway corta todas sus conexiones. Se hace con draining: se pide a los clientes que se vayan de a poco, repartidos en el tiempo.',
      steps: [
        { at: 'gwA', kind: 'info', ms: 1, title: 'Cada reinicio corta 400 000 conexiones', text: 'Si se reiniciaran todos los gateways a la vez, se desconectaría todo el mundo y volvería en una tormenta de reconexión. Desplegar gateways es una operación delicada.' },
        { at: 'lb', kind: 'info', ms: 1, title: 'Se saca a gwA de la rotación', text: 'Deja de recibir conexiones nuevas (draining, M03). Las existentes siguen funcionando.' },
        { from: 'gwA', to: 'lb', kind: 'req', tag: 'Reconnect(en 37 s)', ms: 0.3, title: 'Pide a los clientes que se vayan', text: 'Con un retraso aleatorio distinto para cada uno, repartido en unos minutos: del 1 al 2 % de las conexiones por segundo.' },
        { from: 'lb', to: 'phoneA', kind: 'req', tag: 'Reconnect(en 37 s)', ms: 30, title: 'El teléfono recibe la orden', text: 'No corta la conexión: espera su turno y abre una nueva antes de cerrar la vieja, para no perder mensajes.' },
        { from: 'phoneA', to: 'lb', kind: 'req', tag: 'Hello · conexión nueva', ms: 40, title: 'Se conecta a otro gateway', text: '' },
        { from: 'lb', to: 'gwB', kind: 'req', tag: '', ms: 0.3, title: 'Cae en gwB', text: 'El balanceador solo ofrece gateways que no están en draining.' },
        { from: 'gwB', to: 'registry', kind: 'req', tag: 'registrar · epoch 15', ms: 1, title: 'Registra la sesión nueva', text: 'El epoch mayor reemplaza la entrada del gateway viejo.' },
        { from: 'gwA', to: 'registry', kind: 'req', tag: 'borrar_si(epoch 14)', ms: 1, title: 'El gateway viejo cierra su conexión', text: 'Y trata de borrar su entrada, pero el epoch ya no es 14: el compare-and-delete no borra la entrada nueva. Sin esta protección, el cierre borraría la sesión recién creada y el usuario quedaría "sin conexión" aunque esté conectado.' },
        { at: 'gwA', kind: 'info', ms: 1, title: 'Cuando queda casi vacío, se reinicia', text: 'Después de unos 10 minutos de draining, el gateway tiene pocas conexiones. Se cierra el proceso, arranca la versión nueva y vuelve a la rotación.' },
        { at: 'lb', kind: 'info', ms: 1, title: 'Se repite con el siguiente, por celdas', text: 'Con 114 gateways, de a uno y 10 minutos cada uno serían 19 horas. Por eso se despliega de a varios a la vez, dentro del margen de capacidad (al menos dos gateways de sobra), empezando por la celda más chica y vigilando errores, conexiones y latencia (M11).' }
      ]
    }
  ]
});
