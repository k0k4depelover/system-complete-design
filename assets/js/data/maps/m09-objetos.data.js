/* Mapa del M09: adjuntos de un chat con almacenamiento de objetos, URLs firmadas, CDN y procesamiento por eventos. */
SD.defineMap('m09-objetos', {
  title: 'Adjuntos con almacenamiento de objetos',
  intro: 'Una app de chat que permite enviar fotos y videos. Los bytes nunca pasan por tus servidores de API: van directo del cliente al almacenamiento de objetos y de la CDN al cliente.',
  start: 'app',
  groups: [
    { id: 'g-api', label: 'Tu backend', x: 300, y: 60, w: 560, h: 200 },
    { id: 'g-s3', label: 'Almacenamiento de objetos (una región, 3 zonas)', x: 300, y: 380, w: 620, h: 320 },
    { id: 'g-edge', label: 'Borde', x: 950, y: 60, w: 270, h: 200 }
  ],
  nodes: [
    { id: 'app', layer: 'client', label: 'App del chat', sub: 'iOS, Android, web', x: 130, y: 330,
      info: {
        resp: '<p>Pide permiso al backend para subir, sube el archivo directo al almacenamiento con la URL firmada y avisa cuando terminó. Para ver un adjunto, pide una URL de descarga y lo baja de la CDN.</p>',
        api: '<pre data-lang="http"><code>POST /v1/uploads\n\n{"conversation_id": "conv_42", "filename": "foto.jpg", "content_type": "image/jpeg", "size": 2480113}\n\n// 201\n{"upload_id": "up_77", "url": "https://chat-adjuntos.s3.us-east-1.amazonaws.com/…", "method": "PUT", "expires_in": 300}</code></pre>',
        data: '<p>Guarda localmente el archivo y el <code>upload_id</code> hasta confirmar, para poder reintentar si la app se cierra.</p>',
        fail: '<ul><li><b>La red se corta a mitad de la subida:</b> con multipart, reintenta solo las partes que faltaban.</li><li><b>La URL venció:</b> pide una nueva al backend (el <code>upload_id</code> sigue vigente).</li></ul>',
        nums: '<ul><li>Una foto: 1 a 4 MB. Un video: decenas de MB.</li><li>Tu API solo mueve unos cientos de bytes de metadatos por archivo.</li></ul>'
      } },
    { id: 'api', layer: 'service', label: 'API de adjuntos', sub: 'emite URLs, guarda metadatos', x: 460, y: 160,
      info: {
        resp: '<p>Decide quién puede subir o ver qué, registra el adjunto como <code>pending</code> y firma URLs con credenciales temporales de un rol que solo puede operar sobre ese bucket. Firmar es un cálculo local (HMAC): no llama a S3.</p>',
        api: '<pre><code>POST /v1/uploads                  → URL de subida (PUT, 5 min)\nPOST /v1/uploads/{id}/complete    → verifica y publica el mensaje\nGET  /v1/attachments/{id}/url     → URL de descarga (CDN, 10 min)</code></pre>',
        data: '<p>Tabla <code>attachments</code> en PostgreSQL (mira el nodo de la base).</p>',
        fail: '<ul><li><b>Firmar con credenciales de larga duración:</b> si se filtran, sirven para todo el bucket durante meses. Mejor credenciales temporales con permisos mínimos.</li><li><b>Confiar en lo que declara el cliente:</b> el tamaño y el tipo se verifican después con el objeto real, no con lo que dijo la app.</li></ul>',
        nums: '<ul><li>Firmar una URL: microsegundos de CPU; miles por segundo por instancia.</li></ul>'
      } },
    { id: 'meta', layer: 'db', label: 'PostgreSQL', sub: 'tabla attachments', x: 730, y: 160,
      info: {
        resp: '<p>Tus metadatos: de quién es cada archivo, dónde está, en qué estado y cuánto pesa. El almacenamiento de objetos no sabe nada de usuarios ni de conversaciones.</p>',
        api: '<pre data-lang="sql"><code>INSERT INTO attachments (id, conversation_id, owner_id, object_key, content_type, status)\nVALUES ($1, $2, $3, $4, $5, \'pending\');\n\nUPDATE attachments SET status = \'available\', size = $2\nWHERE id = $1 AND status = \'pending\';</code></pre>',
        data: '<pre data-lang="sql"><code>CREATE TABLE attachments (\n  id               uuid PRIMARY KEY,\n  conversation_id  uuid NOT NULL,\n  owner_id         uuid NOT NULL,\n  object_key       text NOT NULL UNIQUE,   -- conv_42/up_77/original.jpg\n  content_type     text NOT NULL,\n  size             bigint,\n  sha256           bytea,\n  status           text NOT NULL CHECK (status IN (\'pending\', \'available\', \'failed\', \'deleted\')),\n  created_at       timestamptz NOT NULL DEFAULT now()\n);</code></pre>',
        fail: '<p><b>Huérfanos:</b> adjuntos que quedaron en <code>pending</code> o sin mensaje porque la app nunca confirmó. Un job diario los borra de la base y del almacenamiento (escenario "Subida abandonada").</p>',
        nums: '<ul><li>~200 bytes por fila; miles de millones de filas en un chat grande, particionadas por conversación.</li></ul>'
      } },
    { id: 'front', layer: 'edge', label: 'Front-end de S3', sub: 'autentica y enruta', x: 460, y: 470,
      info: {
        resp: '<p>Recibe cada request HTTP al bucket, verifica la firma recalculándola con su copia del secreto, aplica las políticas del bucket y enruta hacia el índice de objetos y el almacenamiento.</p>',
        api: '<pre data-lang="http"><code>PUT /conv_42/up_77/original.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&amp;X-Amz-Signature=…\nContent-Type: image/jpeg\nContent-Length: 2480113\n\nHTTP/1.1 200 OK\nETag: "6b1f0c9e2a…"</code></pre>',
        data: '<p>No guarda datos propios: es una flota sin estado detrás de balanceadores.</p>',
        fail: '<ul><li><b>Firma inválida o vencida:</b> 403 <code>SignatureDoesNotMatch</code> o <code>Request has expired</code>.</li><li><b>Demasiadas requests en un prefijo:</b> 503 <code>SlowDown</code>. S3 escala por prefijo automáticamente, pero de forma gradual.</li></ul>',
        nums: '<ul><li>S3 documenta al menos 3 500 PUT y 5 500 GET por segundo por prefijo, y los prefijos escalan en paralelo. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 's3meta', layer: 'db', label: 'Índice de objetos', sub: 'clave → ubicación y versión', x: 760, y: 470,
      info: {
        resp: '<p>Sabe dónde está cada objeto: mapea bucket y clave a sus fragmentos y nodos. Es un índice distribuido y fuertemente consistente: desde diciembre de 2020, S3 garantiza leer lo recién escrito inmediatamente. <span class="badge badge--doc">Documentado</span></p>',
        api: '<p>Interno. Lecturas por clave y listados por prefijo (<code>ListObjectsV2</code> con paginación por token).</p>',
        data: '<div class="table-wrap"><table class="t"><thead><tr><th>Clave</th><th>Valor</th></tr></thead><tbody><tr><td><code>chat-adjuntos/conv_42/up_77/original.jpg</code></td><td>versión, tamaño, ETag, fragmentos y nodos, clase de almacenamiento</td></tr></tbody></table></div>',
        fail: '<p>Si esta pieza falla, los datos quedan inaccesibles aunque los bytes estén intactos; por eso está replicada entre zonas. Listar prefijos enormes es lento: no uses <code>LIST</code> como consulta de tu aplicación, para eso está tu tabla de metadatos.</p>',
        nums: '<ul><li>S3 guarda cientos de billones de objetos en total.</li></ul>'
      } },
    { id: 'storage', layer: 'db', label: 'Nodos de almacenamiento', sub: 'fragmentos con erasure coding en 3 zonas', x: 760, y: 620,
      info: {
        resp: '<p>Guardan los bytes. Cada objeto se divide en fragmentos de datos más fragmentos de paridad (<span data-term="erasure-coding">erasure coding</span>) repartidos entre zonas: sobrevive a la pérdida de discos, máquinas y una zona entera, ocupando mucho menos que 3 copias completas.</p>',
        api: '<p>Interno: leer y escribir fragmentos con checksum.</p>',
        data: '<p>Un esquema ilustrativo: 6 fragmentos de datos + 3 de paridad, 3 por zona. Se reconstruye con cualquier 6 de los 9, así que tolera perder una zona entera. Espacio: 9 / 6 = 1.5 veces el original. <span class="badge badge--ref">Diseño de referencia</span></p>',
        fail: '<ul><li><b>Disco muerto:</b> sus fragmentos se reconstruyen en otro disco a partir de los demás. A esta escala pasa todo el tiempo.</li><li><b>Corrupción silenciosa:</b> se detecta con checksums al leer y en barridos periódicos.</li></ul>',
        nums: '<ul><li>S3 Standard está diseñado para 99.999999999 % (11 nueves) de durabilidad anual. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'cdn', layer: 'edge', label: 'CDN', sub: 'caché cerca del usuario', x: 1085, y: 160,
      info: {
        resp: '<p>Sirve las descargas desde un PoP cercano. El bucket no es público: la CDN lo lee con su propia identidad (origin access control) y los usuarios presentan URLs o cookies firmadas por la CDN.</p>',
        api: '<pre><code>GET https://media.chat.example/conv_42/up_77/thumb_480.jpg?Expires=1790547000&amp;Signature=…&amp;Key-Pair-Id=K2EJEMPLO\n→ 200 (HIT desde el PoP)</code></pre>',
        data: '<p>Caché por URL <em>sin</em> los parámetros de firma, para que dos usuarios con firmas distintas compartan la misma copia.</p>',
        fail: '<ul><li><b>Firma incluida en la clave de caché:</b> cada usuario crea su propia copia y la tasa de acierto se desploma.</li><li><b>No se puede revocar una URL firmada</b> antes de que venza, salvo rotando la clave de firma: por eso los vencimientos son cortos.</li></ul>',
        nums: '<ul><li>Una foto en un grupo grande: miles de descargas del mismo objeto, casi todas aciertos de CDN.</li></ul>'
      } },
    { id: 'events', layer: 'queue', label: 'Eventos de objeto', sub: 'ObjectCreated → cola SQS', x: 460, y: 620,
      info: {
        resp: '<p>El almacenamiento publica un evento cada vez que se crea un objeto. Así el procesamiento (miniaturas, antivirus) no depende de que la app avise.</p>',
        api: '<pre data-lang="json"><code>{\n  "eventName": "ObjectCreated:Put",\n  "s3": { "bucket": { "name": "chat-adjuntos" },\n          "object": { "key": "conv_42/up_77/original.jpg", "size": 2480113 } }\n}</code></pre>',
        data: '<p>Cola SQS con retención de 4 días y DLQ tras 5 intentos.</p>',
        fail: '<p>La entrega es al menos una vez: el worker puede recibir el mismo evento dos veces y debe ser idempotente.</p>',
        nums: '<ul><li>Uno o dos segundos entre la subida y el evento.</li></ul>'
      } },
    { id: 'worker', layer: 'service', label: 'Worker de medios', sub: 'miniaturas y antivirus', x: 1085, y: 470,
      info: {
        resp: '<p>Descarga el original, verifica el tipo real por su contenido (no el declarado), lo escanea, genera miniaturas de varios tamaños, las sube y marca el adjunto como <code>available</code>.</p>',
        api: '<pre><code>on ObjectCreated(key):\n  obj = s3.get(key)\n  if not es_imagen_valida(obj) or antivirus(obj) == infectado:\n      marcar failed; return\n  for w in [160, 480, 1080]:\n      s3.put(thumb_key(key, w), redimensionar(obj, w))   # clave determinística\n  db.update(attachments, status = available WHERE object_key = key AND status = pending)</code></pre>',
        data: '<p>Sin estado: todo lo que necesita está en el evento, el objeto y la base.</p>',
        fail: '<p><b>Imagen maliciosa que tumba la librería de imágenes:</b> se procesa en un sandbox con límites de memoria y tiempo; tras varios fallos va a la DLQ.</p>',
        nums: '<ul><li>Cientos de milisegundos por imagen; escala con la profundidad de la cola.</li></ul>'
      } }
  ],
  edges: [
    { id: 'e1', from: 'app', to: 'api', both: true, label: 'POST /uploads' },
    { id: 'e2', from: 'api', to: 'meta', both: true },
    { id: 'e3', from: 'app', to: 'front', both: true, label: 'PUT firmado (bytes)' },
    { id: 'e4', from: 'front', to: 's3meta', both: true },
    { id: 'e5', from: 's3meta', to: 'storage', both: true },
    { id: 'e6', from: 'front', to: 'events', async: true, label: 'ObjectCreated' },
    { id: 'e7', from: 'events', to: 'worker', async: true, bend: 90 },
    { id: 'e8', from: 'worker', to: 's3meta', both: true, label: 'GET / PUT' },
    { id: 'e9', from: 'worker', to: 'meta', label: 'available', bend: 30 },
    { id: 'e10', from: 'app', to: 'cdn', both: true, bend: -160, label: 'GET firmado' },
    { id: 'e11', from: 'cdn', to: 'front', both: true, label: 'origen privado' }
  ],
  scenarios: [
    {
      id: 'subida', title: 'Subida directa con URL firmada',
      desc: 'La app sube una foto de 2.4 MB sin que un solo byte de la imagen pase por tus servidores de API.',
      steps: [
        { from: 'app', to: 'api', kind: 'req', tag: 'POST /uploads', ms: 40, title: 'Pide permiso para subir', text: 'Envía nombre, tipo y tamaño, no el archivo.' },
        { from: 'api', to: 'meta', kind: 'req', tag: 'INSERT pending', ms: 2, title: 'Registra el adjunto como pendiente', text: 'Con la clave del objeto decidida por el servidor: <code>conv_42/up_77/original.jpg</code>. El cliente nunca elige dónde escribe.' },
        { at: 'api', kind: 'info', ms: 0.01, title: 'Firma una URL de subida', text: 'HMAC local. Vale 5 minutos, solo para PUT y solo para esa clave. Puedes ver cada paso del cálculo en el generador de la sección 9.3.' },
        { from: 'api', to: 'app', kind: 'res', tag: '201 + URL', ms: 40, title: 'La app recibe la URL', text: '' },
        { from: 'app', to: 'front', kind: 'req', tag: 'PUT 2.4 MB', ms: 900, title: 'Sube directo al almacenamiento', text: 'Lo que tarde depende de la conexión del usuario. Tus servidores no reciben esta carga.' },
        { at: 'front', kind: 'info', ms: 0.2, title: 'Verifica la firma', text: 'Recalcula la firma con su copia del secreto, la compara y comprueba que no haya vencido.' },
        { from: 'front', to: 's3meta', kind: 'req', tag: 'registrar', ms: 5, title: 'Registra el objeto', text: '' },
        { from: 's3meta', to: 'storage', kind: 'req', tag: 'fragmentos', ms: 30, title: 'Escribe los fragmentos en 3 zonas', text: 'S3 confirma recién cuando el objeto es durable.' },
        { from: 'front', to: 'app', kind: 'res', tag: '200 + ETag', ms: 40, title: 'Subida confirmada', text: '' },
        { from: 'app', to: 'api', kind: 'req', tag: 'POST complete', ms: 40, title: 'La app avisa que terminó', text: 'El backend verifica con un HEAD que el objeto existe y tiene el tamaño declarado, y publica el mensaje con el adjunto "procesando".' }
      ]
    },
    {
      id: 'procesamiento', title: 'Evento y miniaturas',
      desc: 'El almacenamiento avisa que se creó un objeto y un worker genera las miniaturas.',
      steps: [
        { from: 'front', to: 'events', kind: 'async', tag: 'ObjectCreated', ms: 800, title: 'Evento de objeto creado', text: 'Llega a la cola en uno o dos segundos.' },
        { from: 'events', to: 'worker', kind: 'async', tag: 'mensaje', ms: 20, title: 'El worker toma el evento', text: 'Con un timeout de visibilidad de 60 s: si el worker muere, el mensaje vuelve a la cola.' },
        { from: 'worker', to: 's3meta', kind: 'req', tag: 'GET original', ms: 60, title: 'Descarga el original', text: 'Dentro de la región: rápido y sin costo de transferencia.' },
        { at: 'worker', kind: 'info', ms: 400, title: 'Verifica, escanea y redimensiona', text: 'Comprueba el tipo real por su contenido (una "foto" que en realidad es un ejecutable se rechaza) y genera 3 tamaños.' },
        { from: 'worker', to: 's3meta', kind: 'req', tag: 'PUT ×3', ms: 80, title: 'Sube las miniaturas', text: 'Con claves determinísticas (<code>…/thumb_480.jpg</code>): si el evento llega dos veces, se sobrescriben igual. Idempotente por diseño.' },
        { from: 'worker', to: 'meta', kind: 'req', tag: 'UPDATE available', ms: 3, title: 'Marca el adjunto como disponible', text: 'Con <code>AND status = \'pending\'</code>: un segundo procesamiento no cambia nada.' }
      ]
    },
    {
      id: 'descarga', title: 'Descarga por la CDN',
      desc: 'Otro miembro del grupo abre la foto. La descarga sale del PoP más cercano con una URL firmada por la CDN.',
      steps: [
        { from: 'app', to: 'api', kind: 'req', tag: 'GET …/url', ms: 40, title: 'Pide una URL de descarga', text: 'El backend verifica que el usuario pertenece a la conversación.' },
        { from: 'api', to: 'app', kind: 'res', tag: 'URL firmada', ms: 40, title: 'URL de la CDN, válida 10 minutos', text: 'Firmada con la clave de la CDN, no con la del almacenamiento.' },
        { from: 'app', to: 'cdn', kind: 'req', tag: 'GET thumb_480', ms: 15, title: 'Pide la miniatura al PoP', text: 'La CDN valida la firma y el vencimiento en el borde.' },
        { at: 'cdn', kind: 'info', ms: 0.5, title: 'MISS: primera vez en este PoP', text: 'La clave de caché ignora los parámetros de firma: el siguiente miembro del grupo tendrá un HIT aunque su URL sea distinta.' },
        { from: 'cdn', to: 'front', kind: 'req', tag: 'GET (origen privado)', ms: 60, title: 'La CDN pide al almacenamiento', text: 'Con su propia identidad: el bucket solo acepta a la CDN y al backend.' },
        { from: 'front', to: 'cdn', kind: 'res', tag: '200', ms: 60, title: 'La CDN guarda una copia', text: '' },
        { from: 'cdn', to: 'app', kind: 'res', tag: '200 · 40 kB', ms: 15, title: 'La foto llega', text: 'Las siguientes descargas del grupo salen del PoP en ~15 ms.' }
      ]
    },
    {
      id: 'huerfano', title: 'Subida abandonada',
      desc: 'La app sube el archivo pero se cierra antes de confirmar. ¿Qué queda y quién lo limpia?',
      steps: [
        { from: 'app', to: 'api', kind: 'req', tag: 'POST /uploads', ms: 40, title: 'Pide la URL', text: '' },
        { from: 'api', to: 'meta', kind: 'req', tag: 'INSERT pending', ms: 2, title: 'Adjunto pendiente', text: '' },
        { from: 'app', to: 'front', kind: 'req', tag: 'PUT', ms: 900, title: 'Sube el archivo', text: '' },
        { at: 'app', kind: 'fail', ms: 0, down: ['app'], title: 'La app se cierra antes de confirmar', text: 'El objeto existe, pero ningún mensaje lo referencia. Si nadie lo limpia, pagas por almacenarlo para siempre.' },
        { from: 'front', to: 'events', kind: 'async', tag: 'ObjectCreated', ms: 800, title: 'El worker igual lo procesa', text: 'Lo marca como disponible, pero sigue sin mensaje asociado.' },
        { at: 'meta', kind: 'info', ms: 0, title: 'Job de limpieza diario', text: 'Borra los adjuntos sin mensaje de más de 24 h, en la base y en el almacenamiento. Para subidas multipart nunca completadas, una regla de ciclo de vida del bucket las aborta a los 7 días: sus partes se cobran aunque el objeto nunca exista.' }
      ]
    }
  ]
});
