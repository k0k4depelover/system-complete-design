/* Mapa del M30: la arquitectura de X hoy. Las piezas y sus nombres salen de lo que X y Twitter publicaron: el repositorio
   x-algorithm (2026), the-algorithm (2023), el blog de infraestructura de 2017 y las charlas de 2010 a 2014. Lo que no
   está publicado (cómo se conectan hoy algunas piezas, los números de cada salto) va marcado como diseño de referencia.
   Se lee de arriba abajo: clientes, borde, API, servicios de producto, núcleo y datos, consumidores del log y el log. */
SD.defineMap('m30-twitter', {
  title: 'X por dentro',
  intro: 'La arquitectura completa de X, de arriba abajo: las apps, el borde, la API GraphQL, los servicios de cada producto (Para ti, búsqueda, publicar, likes, notas, DMs), el núcleo con sus datos y, abajo de todo, el log de Kafka con los consumidores que mantienen al día todo lo derivado. Cada caja dice qué está documentado y qué es diseño de referencia. Los escenarios recorren las requests más importantes salto por salto.',
  start: 'home',
  groups: [
    { id: 'g-cli', label: 'Clientes', x: 20, y: 54, w: 3880, h: 110 },
    { id: 'g-edge', label: 'Borde', x: 20, y: 264, w: 3880, h: 110 },
    { id: 'g-api', label: 'API, medios y mensajes', x: 20, y: 474, w: 3880, h: 110 },
    { id: 'g-prod', label: 'Servicios de producto', x: 20, y: 714, w: 3880, h: 110 },
    { id: 'g-core', label: 'Núcleo: ranking, timelines y datos', x: 20, y: 954, w: 3880, h: 110 },
    { id: 'g-cons', label: 'Consumidores del log', x: 20, y: 1194, w: 3880, h: 110 }
  ],
  nodes: [
    /* ---------- Clientes ---------- */
    { id: 'ana', layer: 'client', label: 'Ana', sub: '200 seguidores', x: 1110, y: 120,
      info: {
        resp: '<p>Una cuenta común que publica desde la app. Su post llega a sus seguidores por dos caminos que no se esperan: el fan-out lo copia a la timeline Siguiendo de cada seguidor activo, y Thunder lo guarda en memoria para que Para ti lo encuentre al leer.</p>',
        api: '<pre><code>POST /i/api/graphql/{queryId}/CreateTweet\n{ "variables": { "tweet_text": "Empieza la final",\n                 "media": { "media_entities": [ { "media_id": "1840…" } ] } } }\n\n200 { "data": { "create_tweet": { "tweet_results": { "result": { "rest_id": "2105447601003728896", … } } } } }</code></pre><p>Es lo que se ve en el tráfico del cliente web. <span class="badge badge--doc">Documentado</span> La API pública equivalente es <code>POST /2/tweets</code>.</p>',
        data: '<p>La app guarda cada post pendiente hasta recibir el id, y el cursor de cada timeline para pedir solo lo nuevo al volver.</p>',
        fail: '<ul><li><b>Se corta la red después de publicar:</b> la app no sabe si el post se creó. Reintentar a ciegas lo duplicaría; por eso el servidor detecta el mismo texto repetido en poco tiempo. <span class="badge badge--ref">Diseño de referencia</span></li><li><b>Límite:</b> 2 400 posts por día por cuenta. <span class="badge badge--doc">Documentado</span></li></ul>',
        nums: '<ul><li>200 seguidores; si la mitad entró en los últimos 30 días, el fan-out hace 100 escrituras.</li><li>A Thunder le cuesta una sola: el post entra en la lista de Ana, no en la de cada seguidor.</li></ul>'
      } },
    { id: 'famosa', layer: 'client', label: 'Cuenta famosa', sub: '30 millones de seguidores', x: 1830, y: 120,
      info: {
        resp: '<p>Una cuenta con millones de seguidores. Copiar cada post a 30 millones de timelines es el problema que obligó a Twitter a inventar la timeline híbrida: los posts de estas cuentas no se reparten, se mezclan al leer. <span class="badge badge--doc">Documentado</span> En Para ti el problema desaparece: Thunder guarda una lista por autor y cada lectura la consulta.</p>',
        api: '<p>La misma <code>CreateTweet</code> que cualquier cuenta. La diferencia está del lado del servidor: el fan-out no la reparte.</p>',
        data: '<p>Una marca por cuenta que dice si su fan-out es en escritura o en lectura, recalculada con histéresis para que una cuenta en el borde no cambie de modo cada día. <span class="badge badge--ref">Diseño de referencia</span></p>',
        fail: '<p>En 2012, los posts de las cuentas con 28 a 31 millones de seguidores podían tardar hasta 5 minutos en llegar a todos, y había seguidores que veían respuestas a un post que todavía no les había llegado. <span class="badge badge--doc">Documentado</span></p>',
        nums: '<ul><li>Con fan-out en escritura, 10 posts por día serían 300 millones de escrituras.</li><li>Con lectura, cero escrituras y una lista más por lectura, que sale de memoria.</li></ul>'
      } },
    { id: 'beto', layer: 'client', label: 'Beto', sub: 'sigue a 400 cuentas', x: 2190, y: 120,
      info: {
        resp: '<p>Un lector. Abre la app, que muestra Para ti; a veces cambia a Siguiendo, busca, da likes o abre una notificación. Las imágenes y los videos no pasan por la API: los baja de la CDN.</p>',
        api: '<pre><code>POST /i/api/graphql/{id}/HomeTimeline         Para ti\nPOST /i/api/graphql/{id}/HomeLatestTimeline   Siguiendo\nGET  /i/api/graphql/{id}/SearchTimeline       buscar\nPOST /i/api/graphql/{id}/FavoriteTweet        like\nGET  https://pbs.twimg.com/media/…?format=jpg&amp;name=small</code></pre><p>Nombres de las operaciones del cliente web. <span class="badge badge--doc">Documentado</span></p>',
        data: '<p>La app conserva la última página de cada pestaña y la muestra si la red falla, con un aviso.</p>',
        fail: '<ul><li><b>Para ti tarda:</b> se ve la copia local y la nueva la reemplaza al llegar.</li><li><b>Volvió tras dos meses:</b> su timeline Siguiendo ya no está en memoria y hay que reconstruirla (escenario "Reconstruir una timeline perdida").</li></ul>',
        nums: '<ul><li>Una página de Para ti trae unas 20 entradas en unos 30 a 60 KB de JSON comprimido, más las imágenes. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    { id: 'apns', layer: 'external', label: 'APNs y FCM', sub: 'push de Apple y Google', x: 2550, y: 120,
      info: {
        resp: '<p>Los servicios de notificaciones push de Apple (APNs) y de Google (Firebase Cloud Messaging). X no puede despertar una app dormida por su cuenta: le entrega el aviso a Apple o a Google, que lo hacen llegar al teléfono.</p>',
        api: '<pre><code>POST https://api.push.apple.com/3/device/{token}\napns-push-type: alert\n{ "aps": { "alert": { "title": "Ana te mencionó", "body": "…" } } }</code></pre>',
        data: '<p>Nada de X. El servicio de notificaciones guarda el token de cada dispositivo y lo renueva cuando la app lo informa.</p>',
        fail: '<ul><li><b>Token vencido:</b> APNs responde 410 y el token se borra.</li><li><b>APNs lento:</b> los avisos esperan en la cola de envío; una notificación que llega una hora tarde ya no sirve, así que vencen.</li></ul>',
        nums: '<ul><li>Un aviso de APNs admite hasta 4 KB de carga útil. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    /* ---------- Borde ---------- */
    { id: 'cdn', layer: 'edge', label: 'CDN de medios', sub: 'pbs.twimg.com, video.twimg.com', x: 2190, y: 330,
      info: {
        resp: '<p>Sirve las fotos, los avatares y los videos desde cerca del usuario. Las fotos salen de <code>pbs.twimg.com</code> y los videos de <code>video.twimg.com</code>, en varias resoluciones. <span class="badge badge--doc">Documentado</span> Si una variante no está en la CDN, la pide al origen, que la saca del Blobstore.</p>',
        api: '<pre><code>GET https://pbs.twimg.com/media/GZx…?format=jpg&amp;name=small     ancho pequeño\nGET https://pbs.twimg.com/media/GZx…?format=webp&amp;name=large\nGET https://video.twimg.com/amplify_video/…/vid/avc1/720x1280/….mp4</code></pre>',
        data: '<p>Copias en caché por variante. Un archivo publicado no cambia nunca: si se edita, tiene otra URL. Por eso el caché puede durar meses sin invalidaciones.</p>',
        fail: '<ul><li><b>Un PoP cae:</b> el tráfico va al siguiente más cercano.</li><li><b>Un post viral con video:</b> millones de pedidos de los mismos archivos; la CDN los absorbe y al origen llega uno por PoP.</li></ul>',
        nums: '<ul><li>Los medios son la mayor parte de los bytes que salen hacia los usuarios; el JSON de la API es poco al lado de un video. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    { id: 'tfe', layer: 'edge', label: 'TFE', sub: 'TLS, sesión y límites', x: 1590, y: 330,
      info: {
        resp: '<p>Twitter Front End: el proxy inverso que recibe todo el tráfico HTTP público. Termina TLS, valida la sesión o el token, aplica los límites y enruta cada pedido a su servicio por Finagle, el framework de RPC de Twitter. Está escrito para la JVM sobre Netty. <span class="badge badge--doc">Documentado</span> Los PoPs propios de X, en cinco continentes, acercan la conexión al usuario. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>x.com/i/api/graphql/*       API GraphQL (apps y web)\napi.x.com/2/*               API pública v2\nupload.x.com/*              subida de medios\nchat                        XChat</code></pre>',
        data: '<p>Sin estado propio. Los contadores de los límites viven en un almacén compartido con ventanas de tiempo (M08). <span class="badge badge--ref">Diseño de referencia</span></p>',
        fail: '<ul><li><b>Un servicio no responde:</b> TFE corta por timeout y devuelve un error; la app reintenta con backoff.</li><li><b>Sobrecarga:</b> se recorta primero lo prescindible, como Explorar, antes que publicar o leer.</li><li><b>Un ataque de volumen:</b> se frena en el borde, antes de llegar a los servicios.</li></ul>',
        nums: '<ul><li>Pocos milisegundos por pedido, entre TLS reutilizado, autenticación y límites. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    /* ---------- API, medios y mensajes ---------- */
    { id: 'gql', layer: 'service', label: 'API GraphQL', sub: 'HomeTimeline, CreateTweet…', x: 2550, y: 540,
      info: {
        resp: '<p>La API de las apps. Cada pantalla es una operación con nombre (<code>HomeTimeline</code>, <code>CreateTweet</code>, <code>FavoriteTweet</code>…) que esta capa resuelve llamando a los servicios de producto y completando cada objeto: un post trae su autor, sus medios y sus contadores. Lee los datos a través de Strato, la capa que unifica el acceso a los almacenes y que el código de 2023 usa en todas partes. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>POST /i/api/graphql/{queryId}/HomeTimeline\n{ "variables": { "count": 20, "cursor": "DAABCgAB…", "includePromotedContent": true },\n  "features": { … } }\n\n200 { "data": { "home": { "home_timeline_urt": { "instructions": [\n  { "type": "TimelineAddEntries", "entries": [ … ] } ] } } } }</code></pre><p>URT es el formato de timeline unificado: la respuesta no es una lista de posts sino instrucciones que la app aplica (agregar entradas, reemplazar el cursor). <span class="badge badge--doc">Documentado</span></p>',
        data: '<p>Sin estado. El <code>queryId</code> identifica una consulta guardada: el cliente no manda GraphQL libre, manda el id de una consulta que el servidor ya conoce.</p>',
        fail: '<ul><li><b>Un servicio de producto falla:</b> la operación devuelve lo que pudo con una lista <code>errors</code>; GraphQL admite respuestas parciales.</li><li><b>Una consulta cara:</b> como solo se aceptan consultas guardadas, nadie puede mandar una que recorra medio grafo.</li></ul>',
        nums: '<ul><li>Una página de Para ti completa unas 20 entradas, cada una con su post, su autor y sus contadores. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    { id: 'media', layer: 'service', label: 'Subida de medios', sub: 'INIT, APPEND, FINALIZE', x: 1710, y: 540,
      info: {
        resp: '<p>Recibe fotos y videos por trozos, los valida, genera las variantes (tamaños, formatos y, para video, varias calidades) y devuelve un <code>media_id</code> que el post usa después. El protocolo es INIT, APPEND, FINALIZE y STATUS. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>POST /media/upload  command=INIT      total_bytes=8302112  media_type=video/mp4\n                                       200 { "media_id_string": "1840…" }\nPOST /media/upload  command=APPEND    media_id=1840…  segment_index=0  &lt;bytes&gt;\nPOST /media/upload  command=FINALIZE  media_id=1840…\n                                       200 { "processing_info": { "state": "pending" } }\nGET  /media/upload  command=STATUS    media_id=1840…   "succeeded"</code></pre>',
        data: '<p>Cada <code>media_id</code> con su estado (subiendo, procesando, listo), el dueño y las claves de sus variantes en el Blobstore. Un medio que no se usa en un post en unas horas se borra. <span class="badge badge--ref">Diseño de referencia</span></p>',
        fail: '<ul><li><b>Se corta la subida:</b> se reanuda desde el último trozo, no desde el principio.</li><li><b>El video tarda en procesarse:</b> STATUS dice cuánto falta y la app espera antes de publicar.</li></ul>',
        nums: '<ul><li>Por la API: imágenes de hasta 5 MB y videos de hasta 512 MB. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'blobstore', layer: 'db', label: 'Blobstore', sub: 'fotos y videos', x: 2070, y: 540,
      info: {
        resp: '<p>El almacén de objetos que Twitter construyó para las fotos en 2012 y que hoy guarda los archivos de medios. <span class="badge badge--doc">Documentado</span> Es el origen de la CDN: guarda cada variante una vez y la CDN la reparte.</p>',
        api: '<pre><code>PUT  /blob/{key}      escribir una variante\nGET  /blob/{key}      leer (lo pide el origen de la CDN)\nDEL  /blob/{key}      al borrar el post o el medio sin usar</code></pre>',
        data: '<p>Objetos inmutables con su clave; los metadatos (a qué post pertenecen, qué variantes tienen) están aparte. Como nunca se modifican, replicar es copiar.</p>',
        fail: '<ul><li><b>Se pierde un disco:</b> las réplicas en otras máquinas y centros de datos lo cubren.</li><li><b>Cae el origen:</b> la CDN sigue sirviendo lo que tiene en caché; solo falla lo que nadie había pedido.</li></ul>',
        nums: '<ul><li>Cientos de miles de millones de objetos, según el blog de infraestructura de 2017. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'xchat', layer: 'service', label: 'XChat', sub: 'DMs cifrados, en Rust', x: 1350, y: 540,
      info: {
        resp: '<p>Los mensajes directos nuevos, cifrados de punta a punta y escritos en Rust. Las claves privadas de cada usuario se guardan con el protocolo Juicebox, repartidas en tres "realms" que opera X, y se recuperan con un PIN de 4 dígitos. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>enviar(conversación, ciphertext, ids de dispositivos)\nrecibir(desde_cursor)           o una conexión abierta\nrecuperar_clave(PIN)            Juicebox: cada realm da una parte</code></pre>',
        data: '<p>El servidor guarda el texto cifrado; no puede leerlo. Sí ve los metadatos: quién escribe a quién y cuándo. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<ul><li><b>Un realm no responde:</b> la recuperación de la clave espera; los mensajes siguen llegando a los dispositivos que ya tienen la clave.</li><li><b>Se compromete una clave:</b> el diseño no tiene forward secrecy, así que los mensajes viejos también quedan expuestos. <span class="badge badge--doc">Documentado</span></li></ul>',
        nums: '<ul><li>Un PIN de 4 dígitos son 10 000 combinaciones: la protección viene de que cada realm limita los intentos, no del PIN. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    /* ---------- Servicios de producto ---------- */
    { id: 'home', layer: 'service', label: 'Home Mixer', sub: 'arma Para ti y Siguiendo', x: 1230, y: 780,
      info: {
        resp: '<p>Arma la timeline. Para ti es un pipeline de siete etapas: hidrata el contexto del usuario, busca candidatos, los hidrata, los filtra, los puntúa, elige los mejores y vuelve a filtrar. Después mezcla anuncios, sugerencias de a quién seguir y avisos, y guarda lo servido. Está escrito en Rust y el código se publicó en enero de 2026. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>for_you(viewer_id, cursor, count=20, seen_ids)   → [ { post_id, author_id, score, source } ]\nfollowing(viewer_id, cursor, count=20)            → la cronológica\n\nEtapas: hidratar consulta → fuentes → hidratar candidatos → filtros\n        → puntuar → seleccionar → filtros finales → efectos (Redis, Kafka)</code></pre>',
        data: '<p>Sin estado durable. Unos 28 hidratadores de la consulta corren en paralelo: secuencia de acciones, a quién sigues, bloqueos y silenciados, palabras silenciadas, posts vistos y servidos, temas. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<ul><li><b>Una fuente de candidatos no llega a tiempo:</b> se sigue sin ella; mejor menos candidatos que una pantalla tarde.</li><li><b>Thunder rechaza por carga:</b> responde <code>RESOURCE_EXHAUSTED</code> y Para ti sale con candidatos de fuera de tu red. <span class="badge badge--doc">Documentado</span></li><li><b>Phoenix no responde:</b> se ordena por recencia y fuente. <span class="badge badge--ref">Diseño de referencia</span></li></ul>',
        nums: '<ul><li>En 2023: unos 5 000 millones de ejecuciones por día, menos de 1.5 s en promedio y unos 220 s de CPU por ejecución. <span class="badge badge--doc">Documentado</span></li><li>14 filtros antes de puntuar y 3 después. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'search', layer: 'service', label: 'Búsqueda', sub: 'Blender reparte la consulta', x: 750, y: 780,
      info: {
        resp: '<p>Blender recibe la consulta, la reparte a todas las particiones de Earlybird, junta los resultados y los ordena. Devuelve ids; la API completa cada post. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>GET /i/api/graphql/{id}/SearchTimeline?variables={"rawQuery":"#Final","product":"Latest","count":20}\n\nsearch(query, product = Top | Latest | Media, cursor)  → [ post_id ]</code></pre>',
        data: '<p>Sin estado durable. Guarda unos segundos las consultas más repetidas: en un evento, millones de personas buscan lo mismo.</p>',
        fail: '<ul><li><b>Una partición tarda:</b> se responde sin ella, con menos resultados.</li><li><b>El indexado se atrasa:</b> los posts tardan más en aparecer; publicar y leer no se enteran.</li></ul>',
        nums: '<ul><li>En 2011, Earlybird atendía más de 2 000 millones de consultas por día con 50 ms de latencia promedio. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'tweetypie', layer: 'service', label: 'Tweetypie', sub: 'posts: escribir y leer', x: 1830, y: 780,
      info: {
        resp: '<p>El servicio central de los posts: crea, lee, edita y borra. Valida el texto, asigna el id Snowflake, guarda en Manhattan, actualiza el caché y anuncia el post en Kafka. Todos los que necesitan el contenido de un post (la API, Home Mixer, la búsqueda) lo hidratan aquí. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>post_tweet(user_id, text, media_ids, reply_to?, quote_of?)  → Tweet\nget_tweets(ids[], fields)                                   → hasta cientos por llamada\ndelete_tweet(id)                                            → marca y anuncia el borrado</code></pre>',
        data: '<pre><code>id                64 bits: 41 de ms desde 2010-11-04 | 10 de nodo | 12 de secuencia\ntext, author_id, conversation_id, reply_to, quote_of, media[], created_at</code></pre><p>El formato de Snowflake está documentado; el esquema del post es un resumen. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<ul><li><b>Manhattan no confirma:</b> error y nada a medias; la app reintenta.</li><li><b>Guardó pero Kafka no confirmó:</b> un proceso de reparación vuelve a anunciar los posts recientes sin marca de publicado: el outbox del M07. <span class="badge badge--ref">Diseño de referencia</span></li><li><b>Un post borrado:</b> el evento de borrado llega a Thunder, Earlybird y Haplo, y la hidratación lo descarta aunque una copia del id siga en alguna lista.</li></ul>',
        nums: '<ul><li>4 096 ids por milisegundo por generador, sin coordinación. <span class="badge badge--doc">Documentado</span></li><li>Un récord de 143 199 posts por segundo, en 2013. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'engage', layer: 'service', label: 'Interacciones', sub: 'likes, reposts, guardados', x: 3270, y: 780,
      info: {
        resp: '<p>Registra likes, reposts, guardados y respuestas. Cada uno es una fila (quién, qué, cuándo) y un evento en Kafka; los contadores que ves debajo de cada post se derivan de esas filas y pueden atrasarse un poco. <span class="badge badge--ref">Diseño de referencia</span></p>',
        api: '<pre><code>POST /i/api/graphql/{id}/FavoriteTweet    { "tweet_id": "2105447601003728896" }\nPOST /i/api/graphql/{id}/UnfavoriteTweet\nPOST /i/api/graphql/{id}/CreateRetweet\nPOST /i/api/graphql/{id}/CreateBookmark</code></pre>',
        data: '<pre><code>likes   (user_id, post_id) → ts        "¿ya le di like?" en una sola lectura\ncnt:{post}   { likes, reposts, replies, quotes, bookmarks, views }</code></pre><p><span class="badge badge--ref">Diseño de referencia</span></p>',
        fail: '<ul><li><b>Doble toque:</b> la segunda escritura encuentra la fila y no suma.</li><li><b>Un post viral:</b> decenas de miles de likes por segundo sobre el mismo contador; se suman en memoria y se vuelcan cada segundo (30.11).</li></ul>',
        nums: '<ul><li>Cada like es además una señal para el ranking: entra en tu secuencia de acciones en segundos.</li></ul>'
      } },
    { id: 'notes', layer: 'service', label: 'Community Notes', sub: 'notas y calificaciones', x: 2670, y: 780,
      info: {
        resp: '<p>Guarda las notas que escriben los colaboradores y las calificaciones que reciben, y muestra bajo cada post la nota que el algoritmo marcó como útil. El algoritmo es público: una nota se muestra solo si la califican como útil personas que suelen estar en desacuerdo entre sí. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>crear_nota(post_id, texto, fuentes)\ncalificar(nota_id, útil | algo útil | no útil, motivos)\nnotas_de(post_id)                     → la que tiene estado "Útil", si hay</code></pre>',
        data: '<p>Notas, calificaciones e historial de estado. X publica estos datos para que cualquiera pueda rehacer el cálculo. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<ul><li><b>Una campaña califica en bloque:</b> si todos piensan parecido, el factor de punto de vista absorbe su acuerdo y la nota no sube.</li><li><b>El cálculo se atrasa:</b> las notas cambian de estado más tarde; los posts se siguen mostrando.</li></ul>',
        nums: '<ul><li>Una nota pasa a "Útil" cuando su intercepto en la factorización de matrices llega a 0.40. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'users', layer: 'service', label: 'Cuentas y Premium', sub: 'perfiles y verificación', x: 2310, y: 780,
      info: {
        resp: '<p>Perfiles, configuración, verificación y suscripciones Premium. También recibe "seguir" y "dejar de seguir" y los escribe en el grafo. Ser Premium cambia el ranking: las respuestas de los suscriptores se priorizan. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>get_users(ids[])                  → nombre, avatar, verificación, Premium\nfollow(viewer, target)            → arista en el grafo y evento\nPOST /i/api/graphql/{id}/UserByScreenName</code></pre>',
        data: '<p>Las cuentas viven en Manhattan, como los posts y los DMs anteriores a XChat. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<ul><li><b>Seguir y no ver los posts:</b> si la arista se escribe en un sentido y el otro llega tarde, por unos segundos los posts nuevos de esa cuenta no te llegan.</li></ul>',
        nums: '<ul><li>Cada post que se muestra lleva su autor: los perfiles son de lo más leído del sistema, casi siempre desde el caché.</li></ul>'
      } },
    { id: 'grok', layer: 'external', label: 'Grok', sub: 'xAI: resúmenes y respuestas', x: 3750, y: 780,
      info: {
        resp: '<p>El modelo de xAI. En X resume las noticias del momento en Explorar, responde "Explicar este post" y conversa. Además, el modelo de ranking de Para ti, Phoenix, es un transformer derivado de Grok-1. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>resumir(tema, posts_representativos[])     → título y resumen\nexplicar(post_id, contexto)               → respuesta en streaming</code></pre>',
        data: '<p>Para resumir una tendencia recibe los posts más representativos que eligió el detector de tendencias, no todos.</p>',
        fail: '<ul><li><b>Grok tarda:</b> la tendencia se muestra sin resumen.</li><li><b>Un resumen equivocado:</b> se reemplaza con el próximo cálculo; los resúmenes llevan un aviso de que pueden tener errores.</li></ul>',
        nums: '<ul><li>Un resumen por tendencia y por región, cada algunos minutos: unos pocos miles por hora, no uno por lector. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    /* ---------- Núcleo ---------- */
    { id: 'tls', layer: 'service', label: 'Timeline Service', sub: 'la cronológica', x: 1110, y: 1020,
      info: {
        resp: '<p>Mantiene la timeline Siguiendo de cada usuario activo: una lista de ids en Haplo, la caché de timelines. Escribe en ella junto con el fan-out y es el único que la lee. <span class="badge badge--doc">Documentado</span> Cómo se arma Siguiendo en 2026 no está publicado. <span class="badge badge--ref">Diseño de referencia</span></p>',
        api: '<pre><code>get_timeline(user_id, max_id?, count=20)   → [ (post_id, author_id, bits) ]\nrebuild(user_id)                           cuando la lista no existe</code></pre>',
        data: '<p>Hasta 800 entradas por usuario, solo para quienes entraron en los últimos 30 días. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<ul><li><b>La lista no existe:</b> se reconstruye una vez, con un lock corto por usuario.</li><li><b>Haplo pierde un shard:</b> millones de timelines a reconstruir; se hace a medida que los usuarios llegan, con un límite por segundo.</li></ul>',
        nums: '<ul><li>En 2013, 300 000 lecturas de timeline por segundo. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'haplo', layer: 'cache', label: 'Haplo', sub: 'timelines en Redis', x: 1590, y: 1020,
      info: {
        resp: '<p>La caché principal de las timelines: una versión de Redis modificada por Twitter, con estructuras propias (HybridList y BTree). <span class="badge badge--doc">Documentado</span> Cada usuario activo tiene una lista de ids que crece por la cabeza y se recorta por la cola.</p>',
        api: '<pre><code>LPUSH tl:{user} &lt;entrada&gt;     el fan-out agrega un post\nLTRIM tl:{user} 0 799         quedarse con 800\nLRANGE tl:{user} 0 19         la primera página</code></pre>',
        data: '<p>Cada entrada guarda el id del post (8 bytes), el del autor (8) y unos bits de tipo: unos 20 bytes. Nunca el texto: un post está en millones de listas. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<ul><li><b>Cae una réplica:</b> se lee de otra; había tres por lista en 2013. <span class="badge badge--doc">Documentado</span></li><li><b>Se pierde un shard:</b> no se pierden datos, porque todo se puede rehacer desde el grafo y los posts; se pierde tiempo.</li></ul>',
        nums: '<ul><li>En 2014, las timelines ocupaban unos 40 TB de RAM en más de 6 000 instancias, con unos 30 millones de consultas por segundo. Todo Redis en Twitter: 105 TB, 39 millones de consultas por segundo y más de 10 000 instancias. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'phoenix', layer: 'gpu', label: 'Phoenix ranking', sub: 'transformer basado en Grok', x: 2310, y: 1020,
      info: {
        resp: '<p>El modelo que ordena Para ti. Es un transformer derivado de Grok-1 que mira tu secuencia de acciones recientes y cada candidato, y predice la probabilidad de cada reacción. Con "aislamiento de candidatos", cada candidato solo atiende a tu contexto, no a los otros: el puntaje de un post no depende de con quién compite, así que se puede cachear y calcular en lotes. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>score(user_context, candidates[])  →  por candidato:\n  P(like), P(responder), P(repost), P(citar), P(clic), P(ver perfil), P(compartir),\n  P(seguir al autor), P(no me interesa), P(silenciar), P(bloquear), P(denunciar), …\n  y valores continuos, como el tiempo de permanencia</code></pre><p>19 acciones binarias y hasta 8 continuas. <span class="badge badge--doc">Documentado</span></p>',
        data: '<p>Los pesos del modelo, entrenados offline en JAX. El puntaje final lo arma Home Mixer: la suma de cada probabilidad por su peso, con las negativas restando, una penalización por repetir autor y un descuento para lo que viene de fuera de tu red. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<ul><li><b>Las GPUs se saturan:</b> se puntúan menos candidatos o se reutilizan puntajes cacheados.</li><li><b>Un modelo nuevo sale mal:</b> se despliega a una fracción del tráfico y se compara antes de pasarlo a todos (M24).</li></ul>',
        nums: '<ul><li>El modelo de 2023 tenía unos 48 millones de parámetros; el de 2026 es mucho más grande y corre en GPUs. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'vf', layer: 'service', label: 'Visibility filtering', sub: 'ALLOW, INTERSTITIAL, DROP', x: 270, y: 1020,
      info: {
        resp: '<p>Decide qué puede ver cada usuario de cada post: mostrarlo (ALLOW), mostrarlo detrás de un aviso (INTERSTITIAL) o quitarlo (DROP). Aplica reglas legales por país, de seguridad y de spam, con las etiquetas que ponen los clasificadores y los motores de reglas. Se publicó en agosto de 2026. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>visibility(viewer, posts[], surface = home | search | replies)\n  → [ { post_id, action: ALLOW | INTERSTITIAL | DROP, reason } ]</code></pre>',
        data: '<p>Etiquetas por post y por cuenta (spam, contenido sensible, retención legal), reglas por superficie y por país.</p>',
        fail: '<ul><li><b>Falla la consulta de etiquetas:</b> se falla cerrado para lo que es obligatorio por ley y abierto para el resto. <span class="badge badge--ref">Diseño de referencia</span></li><li><b>Una etiqueta llega tarde:</b> un post visto antes del etiquetado sale de las timelines en la siguiente lectura.</li></ul>',
        nums: '<ul><li>Se aplica dos veces en Para ti: antes de puntuar, para no gastar GPU en lo que no se puede mostrar, y después, sobre los elegidos.</li></ul>'
      } },
    { id: 'ads', layer: 'service', label: 'Anuncios', sub: 'subasta y brand safety', x: 630, y: 1020,
      info: {
        resp: '<p>Elige los anuncios de cada página con una subasta y los entrega a Home Mixer, que los mezcla con los posts cuidando que un anuncio no quede junto a contenido que la marca no quiere (brand safety). La mezcla se publicó en mayo de 2026. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>get_ads(viewer, surface, slots=3, context_posts[])\n  → [ { ad_id, post_id, bid, slot_min } ]</code></pre>',
        data: '<p>Campañas, presupuestos, segmentos y el ritmo de gasto de cada campaña a lo largo del día. <span class="badge badge--ref">Diseño de referencia</span></p>',
        fail: '<ul><li><b>La subasta no responde a tiempo:</b> la página sale sin anuncios; perder un ingreso es mejor que demorar a todos.</li></ul>',
        nums: '<ul><li>Unos pocos anuncios por página, en posiciones que no quedan pegadas entre sí. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    { id: 'cache', layer: 'cache', label: 'Twemcache y Nighthawk', sub: 'posts y usuarios en memoria', x: 3510, y: 1020,
      info: {
        resp: '<p>La memoria que evita ir a Manhattan. Twemcache, la versión de memcached de Twitter, sirve la mayor parte del tráfico de caché; Nighthawk es Redis particionado. <span class="badge badge--doc">Documentado</span> Guarda posts, perfiles y contadores.</p>',
        api: '<pre><code>get_multi(["t:2105447601003728896", "u:1001", …])\nset("t:…", post, ttl)\nincrby("cnt:…:likes", 250)</code></pre>',
        data: '<p>Claves por objeto con TTL. Un post que se edita o se borra se invalida al instante; si la invalidación se pierde, el TTL acota el daño.</p>',
        fail: '<ul><li><b>Cae un nodo:</b> sus claves van al almacén hasta que se recalientan; con single-flight, mil lecturas del mismo post son una sola consulta (M04).</li><li><b>Clave caliente:</b> un post viral; cada servidor lo guarda además en su propia memoria unos segundos.</li></ul>',
        nums: '<ul><li>Más del 90&#8239;% de las lecturas de posts deberían salir de aquí; si baja, Manhattan recibe varias veces su carga normal. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    { id: 'manhattan', layer: 'db', label: 'Manhattan', sub: 'clave-valor multi-región', x: 2790, y: 1020,
      info: {
        resp: '<p>La base de datos clave-valor de Twitter, multi-tenant y replicada en varios centros de datos. Guarda los posts, las cuentas y los DMs. <span class="badge badge--doc">Documentado</span> Tiene motores distintos según el uso: uno de solo lectura que se carga desde Hadoop, uno para mucha escritura y uno para mucha lectura. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>put(dataset, key, value)               réplica local, el resto en segundo plano\nget(dataset, key) · multi_get(keys[])\ncheck_and_set(key, expected, value)    cuando hace falta consistencia fuerte</code></pre>',
        data: '<pre><code>dataset tweets      key post_id                 value Tweet (Thrift)\ndataset user_posts  key (author_id, post_id)    perfil y listas por autor\ndataset accounts    key user_id</code></pre><p><span class="badge badge--ref">Diseño de referencia</span></p>',
        fail: '<ul><li><b>Cae un centro de datos:</b> las réplicas de los otros siguen; lo escrito allí hace un instante puede tardar en verse (consistencia eventual).</li><li><b>Una partición caliente:</b> la clave por id reparte las escrituras de posts; el riesgo está en las listas de las cuentas que más publican.</li></ul>',
        nums: '<ul><li>El almacenamiento y la mensajería son el 45&#8239;% de la infraestructura de Twitter, según el blog de 2017. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'graph', layer: 'db', label: 'Grafo social', sub: 'quién sigue a quién', x: 1950, y: 1020,
      info: {
        resp: '<p>Quién sigue, bloquea y silencia a quién, guardado en las dos direcciones: el fan-out necesita los seguidores de quien publica, y Home Mixer necesita a quién sigue quien lee. FlockDB, el de Twitter, guardaba cada arista en los dos sentidos. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>followers(user, cursor, n)     el fan-out, por páginas\nfollowing(user)                Home Mixer, en cada lectura\nfollow(a, b) · block(a, b) · mute(a, b)</code></pre>',
        data: '<pre><code>forward   (source_id, dest_id) → { state, ts }     a quién sigo\nbackward  (dest_id, source_id) → { state, ts }     quién me sigue</code></pre>',
        fail: '<ul><li><b>Una cuenta con 100 millones de seguidores:</b> una partición enorme que se recorre por páginas, nunca entera.</li><li><b>Lento:</b> Home Mixer guarda a quién sigues unos minutos; seguir a alguien se nota en la próxima carga.</li></ul>',
        nums: '<ul><li>En 2010, FlockDB tenía más de 13 000 millones de aristas, con picos de 20 000 escrituras y 100 000 lecturas por segundo. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    /* ---------- Consumidores del log ---------- */
    { id: 'thunder', layer: 'cache', label: 'Thunder', sub: 'posts recientes por autor', x: 570, y: 1260,
      info: {
        resp: '<p>La fuente de los candidatos de tu red en Para ti. Consume los posts nuevos de Kafka y guarda en memoria, por autor, tres listas: originales, respuestas y reposts, y videos. Home Mixer le pasa a quién sigues y Thunder devuelve lo reciente de esas cuentas en menos de un milisegundo. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>consume posts (topics particionados por autor)\nget_in_network(following[], since, max)   → [ TinyPost ]\n  RESOURCE_EXHAUSTED si el semáforo de carga está lleno</code></pre>',
        data: '<p>Cada post ocupa 16 bytes (TinyPost): lo justo para encontrarlo y ordenarlo. El contenido se hidrata después. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<ul><li><b>Sobrecarga:</b> rechaza en lugar de encolar; Home Mixer sigue con las otras fuentes. <span class="badge badge--doc">Documentado</span></li><li><b>Una réplica reinicia:</b> se recarga releyendo Kafka desde unas horas atrás; mientras tanto, las demás atienden.</li></ul>',
        nums: '<ul><li>Con 500 millones de posts por día, la cifra de 2013, dos días son 1 000 millones × 16 B = 16 GB: cabe en la memoria de una máquina, replicado las veces que haga falta. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    { id: 'retrieval', layer: 'gpu', label: 'Phoenix retrieval', sub: 'two-tower y vecinos', x: 1230, y: 1260,
      info: {
        resp: '<p>Los candidatos de fuera de tu red. Un modelo de dos torres convierte a cada usuario y a cada post en un vector; los posts cercanos a tu vector son los que probablemente te interesen. Los posts nuevos entran al índice de vecinos cercanos a medida que llegan por Kafka. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>user_tower(acciones recientes)      → u ∈ R^d\npost_tower(post, autor)             → p ∈ R^d      al publicarse\nnearest(u, k=…)                     → [ post_id ]  por producto interno</code></pre>',
        data: '<p>Embeddings con tablas de hash, para no tener una fila por cada id posible, y el índice de vecinos cercanos de los posts recientes. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<ul><li><b>El índice se atrasa:</b> los posts nuevos tardan más en llegar a quien no sigue al autor; la red propia no se entera.</li><li><b>No responde:</b> Para ti sale solo con tu red, con menos descubrimiento.</li></ul>',
        nums: '<ul><li>En 2023, la mitad de los candidatos venía de fuera de tu red. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'signals', layer: 'cache', label: 'Señales del usuario', sub: 'secuencia de acciones', x: 1590, y: 1260,
      info: {
        resp: '<p>Lo que acabas de hacer: likes, respuestas, clics, perfiles visitados, posts que dejaste pasar. Se alimenta del flujo unificado de acciones (Unified User Actions) y Home Mixer lo lee en cada pedido: es la entrada principal de Phoenix. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>consume acciones (like, reply, click, dwell, follow, not_interested…)\naction_sequence(user_id, n)   → las últimas n acciones, con tiempo y post</code></pre>',
        data: '<p>Una lista por usuario de las acciones más recientes, con su tipo, el post y el autor.</p>',
        fail: '<ul><li><b>Se atrasa:</b> Para ti no refleja tu último like hasta que el consumidor se pone al día.</li></ul>',
        nums: '<ul><li>En 2021, el procesamiento en tiempo real de Twitter manejaba unos 400 000 millones de eventos por día. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'earlybird', layer: 'db', label: 'Earlybird', sub: 'índice invertido', x: 870, y: 1260,
      info: {
        resp: '<p>El índice de búsqueda en tiempo real: para cada término, la lista de posts que lo contienen. Guarda en memoria segmentos de 2<sup>23</sup> posts con un solo hilo escritor, y los lectores no se bloquean. <span class="badge badge--doc">Documentado</span> Hasta 2023 también era la fuente de los candidatos de tu red en Para ti.</p>',
        api: '<pre><code>consume posts (grupo search)\nsearch(term, since_id?, max)  → ids, recorriendo cada lista desde el final</code></pre>',
        data: '<p>Las listas están ordenadas por id Snowflake: recorrerlas desde el final da lo más nuevo primero.</p>',
        fail: '<ul><li><b>Una partición cae:</b> Blender responde sin ella.</li><li><b>El indexado se atrasa:</b> los posts tardan más en ser buscables.</li></ul>',
        nums: '<ul><li>Un post era buscable en unos 10 s en 2012 y en 1 s desde 2020. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'fanout', layer: 'service', label: 'Fan-out', sub: 'copia ids a Haplo', x: 1950, y: 1260,
      info: {
        resp: '<p>Consume los posts nuevos, pide los seguidores del autor y agrega el id a la timeline Siguiendo de cada seguidor activo. Si el autor tiene millones de seguidores, no hace nada: sus posts se mezclan al leer. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>consume posts (grupo fanout)\nfollowers(author_id, cursor, 5 000)\npipeline por shard: LPUSH tl:{s} &lt;entrada&gt; ; LTRIM tl:{s} 0 799\ncommit offset</code></pre>',
        data: '<p>Sin estado propio. Las tareas grandes se parten en páginas; las chicas van por una cola de mayor prioridad. <span class="badge badge--ref">Diseño de referencia</span></p>',
        fail: '<ul><li><b>Un worker muere a mitad de página:</b> otro la repite; alguna lista recibe el id dos veces y la lectura deduplica.</li><li><b>Pico:</b> crece el lag; publicar y Para ti siguen igual, porque no dependen de él.</li></ul>',
        nums: '<ul><li>En 2013 entraban 400 millones de posts por día, unos 4 600 por segundo, y el reparto de un post de una cuenta con 31 millones de seguidores podía tardar 5 minutos. <span class="badge badge--doc">Documentado</span></li><li>Con 75 seguidores activos por post, 4 600 posts por segundo son unas 345 000 escrituras por segundo en Haplo. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    { id: 'trends', layer: 'service', label: 'Tendencias', sub: 'lo que crece por región', x: 3630, y: 1260,
      info: {
        resp: '<p>Detecta lo que crece, no lo que más se menciona: Twitter define sus tendencias como lo que es popular ahora. <span class="badge badge--doc">Documentado</span> Cuenta frases y hashtags por región en memoria fija (un count-min sketch), compara con lo esperado a esa hora y le pide a Grok un resumen de cada historia. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>consume posts (grupo trends)\ntrends(region)        → [ { frase, puntaje, resumen } ]    lo lee Explorar</code></pre>',
        data: '<p>Por región y por ventana de un minuto, un sketch de unos 54 KB y las mil frases más frecuentes; la línea base de cada frase sale de las semanas anteriores. <span class="badge badge--ref">Diseño de referencia</span></p>',
        fail: '<ul><li><b>Se cae:</b> Explorar muestra el último ranking publicado.</li><li><b>Manipulación:</b> las cuentas marcadas por Grox como spam no cuentan.</li></ul>',
        nums: '<ul><li>"final" con 42 000 menciones contra 300 esperadas puntúa (42 000 − 300) / √301 ≈ 2 404; "Buenos días" con 90 000 contra 85 000, ≈ 17. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    { id: 'grox', layer: 'gpu', label: 'Grox', sub: 'spam, seguridad y calidad', x: 270, y: 1260,
      info: {
        resp: '<p>Clasificadores que leen cada post nuevo: spam, seguridad, calidad (los posts que "explotan") y el orden de las respuestas, además de embeddings. Sus etiquetas las usa Visibility filtering y sus puntajes, el ranking. Se publicó en mayo de 2026. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>consume posts (grupo grox)\nclassify(post) → { spam: 0.02, nsfw: 0.00, banger: 0.71, … }\nescribe etiquetas para Visibility filtering</code></pre>',
        data: '<p>Etiquetas y puntajes por post, con la versión del modelo que los calculó.</p>',
        fail: '<ul><li><b>Se atrasa:</b> un post de spam se ve unos segundos más antes de que lo filtren.</li></ul>',
        nums: '<ul><li>Corre una vez por post, no una vez por lectura: miles por segundo, no millones. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    { id: 'push', layer: 'service', label: 'Notificaciones', sub: 'pushservice', x: 3030, y: 1260,
      info: {
        resp: '<p>Decide qué avisos mandar. Consume menciones, respuestas, likes y posts de cuentas que activaste; un ranker liviano descarta y uno pesado ordena lo que queda, con límites para no cansar al usuario. Después entrega cada aviso a APNs o FCM. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>consume menciones, likes, follows, posts de cuentas con campana\ncandidate → light ranker → heavy ranker → límites por usuario → enviar</code></pre>',
        data: '<p>Tokens de dispositivo, preferencias, avisos enviados hace poco (para no repetir) y agrupaciones como "A Beto y a 12 más les gustó tu post". <span class="badge badge--ref">Diseño de referencia</span></p>',
        fail: '<ul><li><b>Se atrasa:</b> los avisos vencidos se descartan; una mención de hace una hora ya no se manda como urgente.</li><li><b>Doble envío:</b> la clave del aviso (usuario, evento) evita repetirlo.</li></ul>',
        nums: '<ul><li>Un post viral genera miles de likes por minuto para un solo autor: se agrupan en un aviso cada tanto, no uno por like.</li></ul>'
      } },
    { id: 'offline', layer: 'db', label: 'Datos offline', sub: 'Hadoop y BigQuery', x: 2670, y: 1260,
      info: {
        resp: '<p>Todo el log termina aquí: Hadoop y, desde 2021, Google Cloud (Pub/Sub, Dataflow, BigQuery). De estos datos se entrenan Phoenix y los clasificadores, y se calculan los puntajes de Community Notes. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>consume todo (grupo warehouse)\ntraining jobs → pesos nuevos → despliegue gradual\nnotes scoring → estado de cada nota</code></pre>',
        data: '<p>Tablas por día de posts, acciones e impresiones. Las impresiones (qué se mostró y qué se hizo con eso) son la materia prima del ranking.</p>',
        fail: '<ul><li><b>Un trabajo se atrasa:</b> los pesos y los puntajes llegan tarde; nada en línea se detiene.</li></ul>',
        nums: '<ul><li>En 2017, más de 500 PB en Hadoop y el clúster más grande con más de 10 000 nodos. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    /* ---------- El log ---------- */
    { id: 'kafka', layer: 'queue', label: 'Kafka', sub: 'el log de eventos: posts, interacciones, follows e impresiones', x: 1950, y: 1470, w: 3760, h: 56, bus: true,
      info: {
        resp: '<p>El log que conecta la escritura con todo lo derivado. Cada post, like o follow se escribe una vez y lo leen muchos consumidores, cada uno a su ritmo: Thunder, el índice de Phoenix, las señales, Earlybird, el fan-out, las tendencias, Grox, las notificaciones y el almacén offline. Si uno se atrasa, los demás no se enteran. Twitter migró de su EventBus a Kafka en 2018. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>topic posts         clave author_id    Thunder, retrieval, Earlybird, fan-out, tendencias, Grox, push, offline\ntopic engagements   clave post_id      señales, push, offline\ntopic follows       clave user_id      señales, offline\ntopic impressions   clave user_id      señales, offline</code></pre><p>Los posts van particionados por autor, como los consume Thunder. <span class="badge badge--doc">Documentado</span> El resto es un resumen. <span class="badge badge--ref">Diseño de referencia</span></p>',
        data: '<pre><code>{ "type": "post_created", "post_id": "2105447601003728896", "author_id": "1001",\n  "media": ["1840…"], "reply_to": null, "ts": 1790812800061 }</code></pre>',
        fail: '<ul><li><b>Cae un broker:</b> las réplicas siguen; con <code>acks=all</code>, nada confirmado se pierde.</li><li><b>Un consumidor se atrasa:</b> crece su lag y solo su función se atrasa; el lag de cada grupo es la métrica que dispara alertas y escalado (M11).</li><li><b>Hay que reprocesar:</b> la retención deja volver a leer desde un offset viejo.</li></ul>',
        nums: '<ul><li>En 2021, unos 400 000 millones de eventos por día en tiempo real, con petabytes por día. <span class="badge badge--doc">Documentado</span></li><li>En 2012, el firehose de posts movía 22 MB/s. <span class="badge badge--doc">Documentado</span></li></ul>'
      } }
  ],
  edges: [
    { id: 'e1', from: 'ana', to: 'tfe', both: true },
    { id: 'e2', from: 'famosa', to: 'tfe', both: true },
    { id: 'e3', from: 'beto', to: 'tfe', both: true },
    { id: 'e4', from: 'beto', to: 'cdn', both: true, label: 'fotos y video' },
    { id: 'e5', from: 'cdn', to: 'blobstore', both: true, label: 'origen' },
    { id: 'e6', from: 'tfe', to: 'gql', both: true, label: 'GraphQL' },
    { id: 'e7', from: 'tfe', to: 'media', both: true, label: 'subir' },
    { id: 'e8', from: 'tfe', to: 'xchat', both: true, label: 'DMs' },
    { id: 'e9', from: 'media', to: 'blobstore', label: 'variantes' },
    { id: 'e10', from: 'gql', to: 'home', both: true, label: 'HomeTimeline' },
    { id: 'e11', from: 'gql', to: 'search', both: true, label: 'SearchTimeline' },
    { id: 'e12', from: 'gql', to: 'tweetypie', both: true, label: 'CreateTweet' },
    { id: 'e13', from: 'gql', to: 'engage', both: true, label: 'FavoriteTweet' },
    { id: 'e14', from: 'gql', to: 'notes', both: true },
    { id: 'e15', from: 'gql', to: 'users', both: true },
    { id: 'e16', from: 'gql', to: 'trends', both: true, label: 'Explorar' },
    { id: 'e17', from: 'gql', to: 'grok', both: true },
    { id: 'e18', from: 'home', to: 'thunder', both: true, label: 'en tu red' },
    { id: 'e19', from: 'home', to: 'retrieval', both: true, label: 'fuera de tu red', labelAt: 0.3 },
    { id: 'e20', from: 'home', to: 'phoenix', both: true, label: 'puntuar' },
    { id: 'e21', from: 'home', to: 'signals', both: true, label: 'tus acciones', labelAt: 0.72 },
    { id: 'e22', from: 'home', to: 'vf', both: true, label: 'visibilidad', labelAt: 0.3 },
    { id: 'e23', from: 'home', to: 'ads', both: true, label: 'anuncios' },
    { id: 'e24', from: 'home', to: 'tls', both: true, label: 'Siguiendo' },
    { id: 'e25', from: 'home', to: 'graph', both: true, label: 'a quién sigues' },
    { id: 'e26', from: 'home', to: 'tweetypie', both: true, label: 'hidratar' },
    { id: 'e27', from: 'tls', to: 'haplo', both: true },
    { id: 'e28', from: 'search', to: 'earlybird', both: true },
    { id: 'e29', from: 'tweetypie', to: 'manhattan', both: true },
    { id: 'e30', from: 'tweetypie', to: 'cache', both: true },
    { id: 'e31', from: 'tweetypie', to: 'kafka', label: 'post creado', labelAt: 0.45 },
    { id: 'e32', from: 'engage', to: 'manhattan', both: true },
    { id: 'e33', from: 'engage', to: 'cache', both: true },
    { id: 'e34', from: 'engage', to: 'kafka', label: 'like' },
    { id: 'e35', from: 'notes', to: 'manhattan', both: true },
    { id: 'e36', from: 'users', to: 'manhattan', both: true },
    { id: 'e37', from: 'users', to: 'graph', both: true, label: 'seguir' },
    { id: 'e38', from: 'kafka', to: 'thunder', async: true },
    { id: 'e39', from: 'kafka', to: 'retrieval', async: true },
    { id: 'e40', from: 'kafka', to: 'signals', async: true },
    { id: 'e41', from: 'kafka', to: 'earlybird', async: true },
    { id: 'e42', from: 'kafka', to: 'fanout', async: true },
    { id: 'e43', from: 'kafka', to: 'trends', async: true },
    { id: 'e44', from: 'kafka', to: 'push', async: true },
    { id: 'e45', from: 'kafka', to: 'grox', async: true },
    { id: 'e46', from: 'kafka', to: 'offline', async: true },
    { id: 'e47', from: 'fanout', to: 'graph', both: true, label: 'seguidores' },
    { id: 'e48', from: 'fanout', to: 'haplo', label: 'LPUSH', labelAt: 0.65 },
    { id: 'e49', from: 'trends', to: 'grok', both: true, label: 'resumir' },
    { id: 'e50', from: 'push', to: 'apns', label: 'enviar', labelAt: 0.8 },
    { id: 'e51', from: 'apns', to: 'beto', label: 'push' },
    { id: 'e52', from: 'offline', to: 'phoenix', async: true, label: 'pesos' },
    { id: 'e53', from: 'offline', to: 'notes', async: true, label: 'puntajes', labelAt: 0.2 },
    { id: 'e54', from: 'grox', to: 'vf', label: 'etiquetas' }
  ],
  scenarios: [
    {
      id: 'for-you', title: 'Abrir Para ti: el viaje completo',
      desc: 'Beto abre la app y pide Para ti. La request cruza el borde, la API y Home Mixer, que en unos cientos de milisegundos junta el contexto de Beto, busca candidatos dentro y fuera de su red, los filtra, los puntúa con Phoenix y mezcla anuncios. Las etapas y las piezas son las del código publicado en 2026; los milisegundos de cada salto son un diseño de referencia.',
      steps: [
        { from: 'beto', to: 'tfe', kind: 'req', tag: 'POST HomeTimeline', ms: 40, title: 'La app pide la timeline', text: 'Por una conexión HTTP/2 que ya estaba abierta con el PoP más cercano: no hay handshake de TLS. Manda el cursor de la última página y los ids que ya vio.', code: 'POST /i/api/graphql/{queryId}/HomeTimeline HTTP/2\nAuthorization: Bearer …\n\n{ "variables": { "count": 20, "includePromotedContent": true,\n                 "seenTweetIds": ["2105447601003728896", "…"] } }', lang: 'http' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'sesión ok · dentro del límite', ms: 2, title: 'TFE valida y enruta', text: 'Valida la sesión, descuenta del límite de Beto y reenvía por Finagle a la API GraphQL. <span class="badge badge--doc">Documentado</span>' },
        { from: 'gql', to: 'home', kind: 'req', tag: 'for_you(beto, 20)', ms: 1, title: 'La API delega en Home Mixer', text: 'La operación <code>HomeTimeline</code> se resuelve en Home Mixer, que devuelve ids con metadatos; la API completa cada objeto al final.' },
        { at: 'home', kind: 'info', tag: '28 hidratadores en paralelo', ms: 1, title: 'Etapa 1: hidratar la consulta', text: 'Antes de buscar nada, Home Mixer junta todo lo que sabe de Beto. Los hidratadores corren a la vez y la etapa dura lo que tarda el más lento. <span class="badge badge--doc">Documentado</span>' },
        { from: 'home', to: 'signals', kind: 'req', tag: 'action_sequence(beto)', ms: 0.5, title: 'Sus últimas acciones', text: 'Likes, respuestas, clics y lo que dejó pasar: la entrada principal de Phoenix.' },
        { from: 'home', to: 'graph', kind: 'req', tag: 'following · blocks · mutes', ms: 0.5, title: 'A quién sigue y a quién no quiere ver', text: 'Las 400 cuentas que sigue, más sus bloqueos y silenciados.' },
        { from: 'signals', to: 'home', kind: 'res', tag: 'últimas acciones', ms: 8, title: '', text: '' },
        { from: 'graph', to: 'home', kind: 'res', tag: '400 cuentas', ms: 2, title: 'Contexto listo', text: 'También están las palabras silenciadas, los posts vistos y servidos hace poco y los temas que sigue.' },
        { at: 'home', kind: 'info', tag: 'etapa 2: fuentes', ms: 0.5, title: 'Etapa 2: buscar candidatos', text: 'Varias fuentes a la vez: Thunder para su red, Phoenix retrieval para fuera de su red y otras menores, como posts cacheados de la sesión anterior. <span class="badge badge--doc">Documentado</span>' },
        { from: 'home', to: 'thunder', kind: 'req', tag: 'get_in_network(400 cuentas)', ms: 0.5, title: 'En su red: Thunder', text: 'Lo reciente de las 400 cuentas que sigue, desde memoria. No importa si alguna es famosa: Thunder guarda una lista por autor, así que una cuenta de 30 millones cuesta lo mismo que la de Ana.' },
        { from: 'home', to: 'retrieval', kind: 'req', tag: 'nearest(u)', ms: 0.5, title: 'Fuera de su red: Phoenix retrieval', text: 'La torre del usuario convierte sus acciones en un vector, y el índice devuelve los posts recientes más cercanos.' },
        { from: 'thunder', to: 'home', kind: 'res', tag: 'TinyPosts', ms: 1, title: 'Menos de un milisegundo', text: 'Ids, autores y tiempos, 16 bytes por post. <span class="badge badge--doc">Documentado</span>' },
        { from: 'retrieval', to: 'home', kind: 'res', tag: 'vecinos cercanos', ms: 25, title: 'Los candidatos de fuera', text: 'Junto con los de su red, unos 1 500, la cifra publicada en 2023. <span class="badge badge--doc">Documentado</span> La de 2026 no está publicada.' },
        { from: 'home', to: 'tweetypie', kind: 'req', tag: 'get_tweets(1 500)', ms: 1, title: 'Etapa 3: hidratar candidatos', text: 'El contenido de cada post, su autor, si es un video y cuánto dura, si es solo para suscriptores. Por lotes y en paralelo.' },
        { from: 'tweetypie', to: 'cache', kind: 'req', tag: 'get_multi', ms: 2, title: 'Casi todo sale de memoria', text: 'Los posts de las últimas horas están en Twemcache; los pocos que faltan van a Manhattan con single-flight.' },
        { from: 'cache', to: 'tweetypie', kind: 'res', tag: 'aciertos', ms: 2, title: '', text: '' },
        { from: 'tweetypie', to: 'home', kind: 'res', tag: '1 500 posts', ms: 6, title: '', text: '' },
        { at: 'home', kind: 'info', tag: '14 filtros', ms: 3, title: 'Etapa 4: filtrar antes de puntuar', text: 'Quita duplicados, posts de más de 48 horas, los propios, reposts de algo que ya está, lo que ya vio, palabras silenciadas, autores bloqueados y posts para suscriptores que no puede ver. Puntuar cuesta GPU: lo que no se puede mostrar sale antes. <span class="badge badge--doc">Documentado</span>' },
        { from: 'home', to: 'phoenix', kind: 'req', tag: 'score(contexto, ~1 000)', ms: 2, title: 'Etapa 5: puntuar con Phoenix', text: 'Un solo pedido con el contexto de Beto y todos los candidatos. Con aislamiento de candidatos, cada uno se puntúa como si estuviera solo: el resultado no cambia con el tamaño del lote. <span class="badge badge--doc">Documentado</span>' },
        { from: 'phoenix', to: 'home', kind: 'res', tag: 'P(acción) × candidato', ms: 90, title: 'Probabilidades de cada reacción', text: '19 acciones binarias y hasta 8 continuas por candidato, de "le da like" a "lo denuncia". <span class="badge badge--doc">Documentado</span>' },
        { at: 'home', kind: 'info', tag: 'Σ peso × P · diversidad', ms: 2, title: 'Etapa 6: combinar y elegir', text: 'Suma cada probabilidad por su peso, con las negativas restando; penaliza al mismo autor repetido y descuenta lo que viene de fuera de su red; un último ranker reparte la variedad. Se quedan los mejores. <span class="badge badge--doc">Documentado</span>', code: 'score = sum(w[a] * p[a] for a in acciones)       # "no me interesa" y "bloquear" pesan en negativo\nscore *= decay ** veces_que_ya_aparece(autor)\nif fuera_de_red: score *= descuento\nelegidos = top_k(candidatos, k=20)', lang: 'python' },
        { from: 'home', to: 'vf', kind: 'req', tag: 'visibility(20)', ms: 1, title: 'Etapa 7: filtros finales', text: 'Solo sobre los elegidos: visibilidad, reglas por país y conversaciones repetidas.' },
        { from: 'vf', to: 'home', kind: 'res', tag: '18 ALLOW · 1 INTERSTITIAL · 1 DROP', ms: 8, title: 'Uno sale y otro va con aviso', text: 'El que sale deja un hueco; la página sale con 19.' },
        { from: 'home', to: 'ads', kind: 'req', tag: 'get_ads(3 lugares)', ms: 1, title: 'Anuncios y sugerencias', text: 'La subasta corre mientras se puntuaba; aquí solo se recoge el resultado.' },
        { from: 'ads', to: 'home', kind: 'res', tag: '3 anuncios', ms: 4, title: 'Mezclar con cuidado', text: 'Anuncios separados entre sí y lejos de contenido sensible, una sugerencia de a quién seguir y, si hace falta, un aviso. <span class="badge badge--doc">Documentado</span>' },
        { at: 'home', kind: 'info', tag: 'efectos: Redis y Kafka', ms: 0.5, title: 'Guardar lo servido, sin esperar', text: 'Los ids servidos van a Redis, para no repetirlos en la próxima página, y a Kafka, para el entrenamiento. No demoran la respuesta. <span class="badge badge--doc">Documentado</span>' },
        { from: 'home', to: 'gql', kind: 'res', tag: '22 entradas', ms: 1, title: 'Home Mixer responde', text: 'Ids, tipos de entrada y el cursor de la página siguiente.' },
        { from: 'gql', to: 'tweetypie', kind: 'req', tag: 'get_tweets + autores + contadores', ms: 1, title: 'La API completa cada objeto', text: 'Texto, medios, autor, contadores y si Beto ya le dio like: lo que la app necesita para dibujar.' },
        { from: 'tweetypie', to: 'gql', kind: 'res', tag: '22 objetos', ms: 6, title: '', text: '' },
        { from: 'gql', to: 'tfe', kind: 'res', tag: 'TimelineAddEntries', ms: 2, title: 'URT', text: 'Instrucciones para la app: agregar estas entradas y reemplazar el cursor.', code: '{ "data": { "home": { "home_timeline_urt": { "instructions": [\n  { "type": "TimelineAddEntries", "entries": [\n    { "entryId": "tweet-2105447601003728896", "content": { … } },\n    { "entryId": "promoted-tweet-…", … },\n    { "entryId": "cursor-bottom-…", "content": { "value": "DAABCgAB…" } } ] } ] } } } }', lang: 'json' },
        { from: 'tfe', to: 'beto', kind: 'res', tag: '200 · 40 KB', ms: 40, title: 'La pantalla', text: 'Unos 175 ms del lado del servidor en este recorrido. <span class="badge badge--ref">Diseño de referencia</span> En 2023, el pipeline completo tardaba menos de 1.5 s en promedio y usaba unos 220 s de CPU repartidos en muchas máquinas. <span class="badge badge--doc">Documentado</span>' },
        { from: 'beto', to: 'cdn', kind: 'req', tag: 'GET pbs.twimg.com ×12', ms: 20, title: 'Las imágenes, aparte', text: 'En la variante que cabe en su pantalla. La API nunca toca un byte de imagen.' },
        { from: 'cdn', to: 'beto', kind: 'res', tag: 'desde el PoP', ms: 20, title: 'Listo para hacer scroll', text: 'Mientras Beto mira, la app ya pide la página siguiente con el cursor.' }
      ]
    },
    {
      id: 'publicar', title: 'Ana publica una foto',
      desc: 'Ana sube una foto y publica "Empieza la final". La respuesta llega en unos 100 ms; todo lo demás (Thunder, el fan-out, la búsqueda, Phoenix, Grox y las notificaciones) lo hacen los consumidores del log, cada uno a su ritmo.',
      steps: [
        { from: 'ana', to: 'tfe', kind: 'req', tag: 'INIT · APPEND · FINALIZE', ms: 40, title: 'Primero, la foto', text: 'La app la sube por trozos antes de publicar. <span class="badge badge--doc">Documentado</span>' },
        { from: 'tfe', to: 'media', kind: 'req', tag: 'upload 2.1 MB', ms: 60, title: 'Al servicio de medios', text: 'Valida el formato y el tamaño, y genera las variantes: miniatura, pequeña, mediana, grande, en JPEG y WebP.' },
        { from: 'media', to: 'blobstore', kind: 'req', tag: 'PUT ×8 variantes', ms: 30, title: 'Variantes inmutables', text: 'Cada una con su clave. Nunca se modifican: si Ana cambia la foto, es otro medio.' },
        { from: 'media', to: 'tfe', kind: 'res', tag: 'media_id 1840…', ms: 1, title: '', text: '' },
        { from: 'tfe', to: 'ana', kind: 'res', tag: 'media_id', ms: 40, title: 'La foto ya tiene id', text: '' },
        { from: 'ana', to: 'tfe', kind: 'req', tag: 'POST CreateTweet', ms: 40, title: 'Ahora, el post', text: '', code: '{ "variables": { "tweet_text": "Empieza la final",\n                 "media": { "media_entities": [ { "media_id": "1840…" } ] } } }', lang: 'json' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'CreateTweet', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'tweetypie', kind: 'req', tag: 'post_tweet', ms: 1, title: 'A Tweetypie', text: 'Valida el texto, que el medio sea de Ana y que no sea un duplicado reciente.' },
        { at: 'tweetypie', kind: 'info', tag: 'Snowflake', ms: 0.001, title: 'El id, sin red', text: '41 bits de milisegundos, 10 de nodo y 12 de secuencia: 2105447601003728896 dice que se creó el 1 de octubre de 2026 a las 00:00:00.061 UTC. <span class="badge badge--doc">Documentado</span>' },
        { from: 'tweetypie', to: 'manhattan', kind: 'req', tag: 'put(tweets, id)', ms: 2, title: 'Guardar', text: 'El post por id y la entrada en la lista de Ana.' },
        { from: 'manhattan', to: 'tweetypie', kind: 'res', tag: 'ok', ms: 6, title: 'Desde aquí no se pierde', text: '' },
        { from: 'tweetypie', to: 'cache', kind: 'req', tag: 'set t:…', ms: 1, title: 'Calentar el caché', text: 'Sus seguidores lo van a pedir en segundos.' },
        { from: 'tweetypie', to: 'kafka', kind: 'req', tag: 'post_created', ms: 4, title: 'Anunciar', text: 'Con el <code>author_id</code> como clave: los posts de Ana quedan en orden en una partición.', code: '{ "type": "post_created", "post_id": "2105447601003728896", "author_id": "1001",\n  "media": ["1840…"], "ts": 1790812800061 }', lang: 'json' },
        { from: 'tweetypie', to: 'gql', kind: 'res', tag: 'Tweet', ms: 1, title: '', text: '' },
        { from: 'gql', to: 'tfe', kind: 'res', tag: '200 · rest_id', ms: 1, title: '', text: '' },
        { from: 'tfe', to: 'ana', kind: 'res', tag: '200', ms: 40, title: 'Ana ve su post', text: 'Todo lo que sigue es asíncrono.' },
        { from: 'kafka', to: 'thunder', kind: 'async', tag: 'append(ana)', ms: 5, title: 'Thunder: listo para Para ti', text: 'Una sola escritura en memoria, en la lista de originales de Ana. Desde ahora aparece en Para ti de sus seguidores, sin copiarlo a ninguna timeline.' },
        { from: 'kafka', to: 'fanout', kind: 'async', tag: 'consumir', ms: 5, title: 'El fan-out, para Siguiendo', text: 'Ana tiene 200 seguidores: modo push.' },
        { from: 'fanout', to: 'graph', kind: 'req', tag: 'followers(ana)', ms: 3, title: 'Sus seguidores', text: 'Se queda con los que entraron en los últimos 30 días: 100.' },
        { from: 'graph', to: 'fanout', kind: 'res', tag: '200 ids', ms: 3, title: '', text: '' },
        { from: 'fanout', to: 'haplo', kind: 'req', tag: 'LPUSH + LTRIM ×100', ms: 4, title: '100 timelines', text: 'Un pipeline por shard, en paralelo.' },
        { from: 'kafka', to: 'earlybird', kind: 'async', tag: 'indexar', ms: 1000, title: 'Buscable en un segundo', text: '<span class="badge badge--doc">Documentado</span>' },
        { from: 'kafka', to: 'retrieval', kind: 'async', tag: 'post_tower', ms: 50, title: 'Al índice de Phoenix', text: 'El post recibe su vector y entra al índice: ya puede aparecer en Para ti de quien no sigue a Ana.' },
        { from: 'kafka', to: 'grox', kind: 'async', tag: 'classify', ms: 80, title: 'Grox lo clasifica', text: 'Spam, seguridad, calidad.' },
        { from: 'grox', to: 'vf', kind: 'req', tag: 'etiquetas', ms: 2, title: 'Etiquetas para la visibilidad', text: 'Si fuera spam, desde ahora se filtra en todas las superficies.' },
        { from: 'kafka', to: 'push', kind: 'async', tag: 'campana activada', ms: 20, title: 'Notificaciones', text: 'Solo para quienes activaron la campana de Ana o fueron mencionados.' },
        { from: 'push', to: 'apns', kind: 'req', tag: 'aviso', ms: 30, title: '', text: '' },
        { from: 'apns', to: 'beto', kind: 'async', tag: 'Ana publicó', ms: 300, title: 'Beto recibe el aviso', text: 'Unos segundos después de publicar, por la plataforma de Apple.' }
      ]
    },
    {
      id: 'leer', title: 'Siguiendo: la cronológica',
      desc: 'Beto cambia a la pestaña Siguiendo. La lista ya está armada en Haplo por el fan-out; falta mezclar las cuentas famosas, hidratar y filtrar. Es el camino que Twitter documentó hasta 2017; cómo se arma hoy no está publicado.',
      steps: [
        { from: 'beto', to: 'tfe', kind: 'req', tag: 'POST HomeLatestTimeline', ms: 40, title: 'Pide Siguiendo', text: '' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'HomeLatestTimeline', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'home', kind: 'req', tag: 'following(beto, 20)', ms: 1, title: 'Home Mixer, otra pestaña', text: 'El código de 2023 incluía la pestaña Siguiendo en Home Mixer. <span class="badge badge--doc">Documentado</span>' },
        { from: 'home', to: 'tls', kind: 'req', tag: 'get_timeline(beto)', ms: 1, title: 'Al Timeline Service', text: '' },
        { from: 'tls', to: 'haplo', kind: 'req', tag: 'LRANGE tl:beto 0 19', ms: 1, title: 'Una clave, un shard', text: 'Lo que se pagó al escribir se cobra aquí.' },
        { from: 'haplo', to: 'tls', kind: 'res', tag: '20 entradas', ms: 1, title: 'Ids de post y de autor', text: 'Sin texto.' },
        { from: 'tls', to: 'home', kind: 'res', tag: '20 ids', ms: 1, title: '', text: '' },
        { from: 'home', to: 'thunder', kind: 'req', tag: 'cuentas famosas ×3', ms: 1, title: 'Las famosas, al leer', text: 'Sus posts no se repartieron. Thunder tiene la lista de cada autora en memoria. <span class="badge badge--ref">Diseño de referencia</span>' },
        { from: 'thunder', to: 'home', kind: 'res', tag: '3 listas', ms: 1, title: 'Mezclar por id', text: 'Ordenar por id es ordenar por tiempo, gracias a Snowflake.', code: 'ids = sorted(set(propios + famosos), reverse=True)[:20]', lang: 'python' },
        { from: 'home', to: 'tweetypie', kind: 'req', tag: 'get_tweets(20)', ms: 1, title: 'Hidratar', text: '' },
        { from: 'tweetypie', to: 'cache', kind: 'req', tag: 'get_multi', ms: 2, title: '', text: '' },
        { from: 'cache', to: 'tweetypie', kind: 'res', tag: '19 aciertos', ms: 2, title: 'Uno estaba borrado', text: 'Se descarta aquí. Las copias de su id en millones de listas no se persiguen.' },
        { from: 'tweetypie', to: 'home', kind: 'res', tag: '19 posts', ms: 1, title: '', text: '' },
        { from: 'home', to: 'vf', kind: 'req', tag: 'visibility(19)', ms: 1, title: 'Visibilidad, también aquí', text: 'Cronológica no quiere decir sin filtros.' },
        { from: 'vf', to: 'home', kind: 'res', tag: '19 ALLOW', ms: 5, title: '', text: '' },
        { from: 'home', to: 'gql', kind: 'res', tag: '19 entradas', ms: 1, title: '', text: '' },
        { from: 'gql', to: 'tfe', kind: 'res', tag: 'URT', ms: 6, title: '', text: '' },
        { from: 'tfe', to: 'beto', kind: 'res', tag: '200', ms: 40, title: 'Siguiendo', text: 'Unos 30 ms del lado del servidor, casi todo en memoria. <span class="badge badge--ref">Diseño de referencia</span>' }
      ]
    },
    {
      id: 'famosa', title: 'Publica una cuenta famosa',
      desc: 'La cuenta famosa publica. El fan-out no la reparte; Thunder la guarda una vez, y un segundo después el post aparece en Para ti de Beto sin que nadie haya escrito en su timeline.',
      steps: [
        { from: 'famosa', to: 'tfe', kind: 'req', tag: 'POST CreateTweet', ms: 40, title: 'Publica', text: 'La misma llamada que cualquier cuenta.' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'CreateTweet', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'tweetypie', kind: 'req', tag: 'post_tweet', ms: 1, title: '', text: '' },
        { from: 'tweetypie', to: 'manhattan', kind: 'req', tag: 'put', ms: 2, title: 'Guardar', text: 'Igual que el de Ana.' },
        { from: 'manhattan', to: 'tweetypie', kind: 'res', tag: 'ok', ms: 6, title: '', text: '' },
        { from: 'tweetypie', to: 'kafka', kind: 'req', tag: 'post_created', ms: 4, title: 'Anunciar', text: '' },
        { from: 'tweetypie', to: 'gql', kind: 'res', tag: 'Tweet', ms: 1, title: '', text: '' },
        { from: 'gql', to: 'tfe', kind: 'res', tag: '200', ms: 1, title: '', text: '' },
        { from: 'tfe', to: 'famosa', kind: 'res', tag: '200', ms: 40, title: 'Publicado', text: '' },
        { from: 'kafka', to: 'fanout', kind: 'async', tag: 'descartar', ms: 5, title: 'El fan-out no hace nada', text: 'Con push serían 30 millones de escrituras. En 2012, eso tardaba hasta 5 minutos. <span class="badge badge--doc">Documentado</span>' },
        { from: 'kafka', to: 'thunder', kind: 'async', tag: 'append(famosa)', ms: 5, title: 'Thunder: una escritura', text: 'En la lista de la autora. Es lo único que hace falta.' },
        { from: 'beto', to: 'tfe', kind: 'req', tag: 'POST HomeTimeline', ms: 40, title: 'Un segundo después, Beto abre Para ti', text: '' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'HomeTimeline', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'home', kind: 'req', tag: 'for_you(beto)', ms: 1, title: '', text: '' },
        { from: 'home', to: 'thunder', kind: 'req', tag: 'get_in_network(400)', ms: 0.5, title: 'Thunder busca en las 400 listas', text: 'Entre ellas, la de la cuenta famosa.' },
        { from: 'thunder', to: 'home', kind: 'res', tag: 'incluye el post nuevo', ms: 1, title: 'Ahí está', text: 'Pull al leer, desde memoria. Con 30 millones de lectores pidiendo la misma lista, cada réplica de Thunder la tiene a mano.' },
        { at: 'home', kind: 'info', tag: 'puntuar, filtrar', ms: 120, title: 'El resto del pipeline', text: 'Como en "Abrir Para ti". Un post reciente de una cuenta que Beto lee mucho puntúa alto.' },
        { from: 'home', to: 'gql', kind: 'res', tag: '22 entradas', ms: 1, title: '', text: '' },
        { from: 'gql', to: 'tfe', kind: 'res', tag: 'URT', ms: 6, title: '', text: '' },
        { from: 'tfe', to: 'beto', kind: 'res', tag: '200', ms: 40, title: 'Beto lo ve arriba', text: 'Thunder hace que Para ti no necesite el fan-out: el problema de las cuentas famosas, que obligó a inventar la timeline híbrida, desaparece en esta pestaña.' }
      ]
    },
    {
      id: 'like-viral', title: 'Un like a un post viral',
      desc: 'Un post recibe decenas de miles de likes por segundo y Beto le da uno. La fila se guarda al instante; el número se suma en memoria y se vuelca cada segundo; el evento cambia lo próximo que verá Beto.',
      steps: [
        { from: 'beto', to: 'tfe', kind: 'req', tag: 'POST FavoriteTweet', ms: 40, title: 'Beto da like', text: 'La app pinta el corazón y suma uno sin esperar.', code: '{ "variables": { "tweet_id": "2105447601003728896" } }', lang: 'json' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'FavoriteTweet', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'engage', kind: 'req', tag: 'like(beto, post)', ms: 1, title: '', text: '' },
        { from: 'engage', to: 'manhattan', kind: 'req', tag: 'put si no existe', ms: 3, title: 'La fila es la verdad', text: 'Clave <code>(user_id, post_id)</code>. Un doble toque falla aquí y no suma dos.' },
        { from: 'manhattan', to: 'engage', kind: 'res', tag: 'nueva', ms: 3, title: '', text: '' },
        { at: 'engage', kind: 'info', tag: 'pendientes[post] += 1', ms: 0.01, title: 'Sumar en memoria', text: 'Con 200 servidores y 50 000 likes por segundo, cada uno recibe unos 250 por segundo de este post. <span class="badge badge--ref">Diseño de referencia</span>' },
        { from: 'engage', to: 'kafka', kind: 'req', tag: 'like', ms: 3, title: 'El evento', text: '' },
        { from: 'engage', to: 'gql', kind: 'res', tag: 'ok', ms: 1, title: '', text: '' },
        { from: 'gql', to: 'tfe', kind: 'res', tag: '200', ms: 1, title: '', text: '' },
        { from: 'tfe', to: 'beto', kind: 'res', tag: '200', ms: 40, title: 'Confirmado', text: '' },
        { at: 'engage', kind: 'info', tag: 'cada segundo', ms: 1000, title: 'Volcar', text: 'Cada servidor cambia sus pendientes por un contador vacío y escribe lo acumulado.' },
        { from: 'engage', to: 'cache', kind: 'req', tag: 'incrby cnt:… 250', ms: 1, title: '200 escrituras por segundo, no 50 000', text: 'Y si aún es mucho, el contador se parte en subclaves en shards distintos (30.11).' },
        { from: 'kafka', to: 'signals', kind: 'async', tag: 'like de Beto', ms: 50, title: 'Cambia lo que verá Beto', text: 'Su secuencia de acciones suma este like: la próxima carga de Para ti ya lo tiene en cuenta.' },
        { from: 'kafka', to: 'push', kind: 'async', tag: 'agrupar', ms: 20, title: 'El autor no recibe 50 000 avisos', text: 'Se agrupan: "A Beto y a 12 000 más les gustó tu post".' },
        { from: 'kafka', to: 'offline', kind: 'async', tag: 'impresión + like', ms: 100, title: 'Un ejemplo de entrenamiento', text: 'Lo que se mostró y lo que Beto hizo: así aprende Phoenix qué predice un like.' }
      ]
    },
    {
      id: 'buscar', title: 'Beto busca #Final',
      desc: 'Beto busca "#Final" y ve posts de hace un segundo. Blender reparte la consulta a todas las particiones de Earlybird; la API completa los resultados.',
      steps: [
        { from: 'beto', to: 'tfe', kind: 'req', tag: 'GET SearchTimeline', ms: 40, title: 'Busca', text: '', code: 'GET /i/api/graphql/{id}/SearchTimeline?variables={"rawQuery":"#Final","product":"Latest","count":20} HTTP/2', lang: 'http' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'SearchTimeline', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'search', kind: 'req', tag: 'search(#final, Latest)', ms: 1, title: 'A Blender', text: '' },
        { from: 'search', to: 'earlybird', kind: 'req', tag: 'a todas las particiones', ms: 2, title: 'Repartir', text: 'Las particiones dividen los posts, no los términos: cualquiera puede tener "#final". <span class="badge badge--doc">Documentado</span>' },
        { at: 'earlybird', kind: 'info', tag: 'desde el final', ms: 15, title: 'Recorrer la lista desde el final', text: 'Ordenada por id Snowflake: lo más nuevo primero. El post de Ana de hace un segundo ya está.' },
        { from: 'earlybird', to: 'search', kind: 'res', tag: 'ids por partición', ms: 2, title: 'Juntar', text: 'Blender mezcla, ordena y corta en 20.' },
        { from: 'search', to: 'gql', kind: 'res', tag: '20 ids', ms: 1, title: '', text: '' },
        { from: 'gql', to: 'tweetypie', kind: 'req', tag: 'get_tweets(20)', ms: 1, title: 'Completar', text: 'El mismo camino que una timeline.' },
        { from: 'tweetypie', to: 'gql', kind: 'res', tag: '20 objetos', ms: 5, title: '', text: '' },
        { from: 'gql', to: 'tfe', kind: 'res', tag: 'URT', ms: 2, title: '', text: '' },
        { from: 'tfe', to: 'beto', kind: 'res', tag: '200', ms: 40, title: 'Resultados', text: 'En 2011, Earlybird respondía en 50 ms de promedio con más de 2 000 millones de consultas por día. <span class="badge badge--doc">Documentado</span>' }
      ]
    },
    {
      id: 'tendencia', title: '#Final se vuelve tendencia',
      desc: 'Termina la final y miles de posts dicen "#Final". Tendencias los cuenta en memoria fija, compara con lo esperado, pide a Grok un resumen y Explorar lo muestra.',
      steps: [
        { from: 'ana', to: 'tfe', kind: 'req', tag: 'CreateTweet "Golazo #Final"', ms: 40, title: 'Ana publica', text: 'Como otros 42 000 en cinco minutos.' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'CreateTweet', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'tweetypie', kind: 'req', tag: 'post_tweet', ms: 10, title: '', text: '' },
        { from: 'tweetypie', to: 'kafka', kind: 'req', tag: 'post_created', ms: 4, title: '', text: '' },
        { from: 'kafka', to: 'trends', kind: 'async', tag: 'consumir', ms: 10, title: 'Otro grupo de consumidores', text: '' },
        { at: 'trends', kind: 'info', tag: '#Final → final', ms: 0.01, title: 'Normalizar y descartar spam', text: '"#Final", "#FINAL" y "#final" son la misma. Las cuentas que Grox marcó como spam no cuentan.' },
        { at: 'trends', kind: 'info', tag: 'sketch.sumar("final")', ms: 0.01, title: 'Contar en memoria fija', text: 'Cinco hashes, una celda por fila; el mínimo es la estimación y nunca cuenta de menos.' },
        { at: 'trends', kind: 'info', tag: '≈ 2 404 contra ≈ 17', ms: 1, title: 'Lo que crece, no lo que más se dice', text: '"final": (42 000 − 300) / √301 ≈ 2 404. "Buenos días": (90 000 − 85 000) / √85 001 ≈ 17.' },
        { from: 'trends', to: 'grok', kind: 'req', tag: 'resumir(final, 50 posts)', ms: 3000, title: 'Grok escribe el resumen', text: 'Con los posts más representativos. Uno por tendencia y región, no uno por lector. <span class="badge badge--doc">Documentado</span>' },
        { from: 'grok', to: 'trends', kind: 'res', tag: 'título y resumen', ms: 10, title: '', text: '' },
        { from: 'beto', to: 'tfe', kind: 'req', tag: 'Explorar', ms: 40, title: 'Beto abre Explorar', text: '' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'ExplorePage', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'trends', kind: 'req', tag: 'trends(ar)', ms: 1, title: 'Lee el ranking publicado', text: 'Nunca espera al cálculo.' },
        { from: 'trends', to: 'gql', kind: 'res', tag: 'ranking', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'tfe', kind: 'res', tag: '200', ms: 2, title: '', text: '' },
        { from: 'tfe', to: 'beto', kind: 'res', tag: '200', ms: 40, title: '#Final, primero', text: 'Con el resumen de Grok.' }
      ]
    },
    {
      id: 'notificacion', title: 'Una mención llega al teléfono',
      desc: 'Ana responde a Beto y lo menciona. El servicio de notificaciones decide si vale un aviso, APNs lo entrega y Beto lo toca.',
      steps: [
        { from: 'ana', to: 'tfe', kind: 'req', tag: 'CreateTweet "@beto mira esto"', ms: 40, title: 'Ana menciona a Beto', text: '' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'CreateTweet', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'tweetypie', kind: 'req', tag: 'post_tweet', ms: 10, title: '', text: '' },
        { from: 'tweetypie', to: 'kafka', kind: 'req', tag: 'post_created · menciones', ms: 4, title: '', text: '' },
        { from: 'kafka', to: 'push', kind: 'async', tag: 'mención a beto', ms: 20, title: 'Un candidato a aviso', text: '' },
        { at: 'push', kind: 'info', tag: 'light → heavy ranker', ms: 15, title: '¿Vale la pena interrumpir a Beto?', text: 'Un ranker liviano descarta lo obvio y uno pesado predice si Beto lo va a abrir. Una mención directa de alguien con quien habla casi siempre pasa. <span class="badge badge--doc">Documentado</span>' },
        { at: 'push', kind: 'info', tag: 'límites y duplicados', ms: 1, title: 'Sin cansar', text: 'Cuántos avisos recibió hoy, si ya avisó por este mismo hilo, si está en horario de silencio.' },
        { from: 'push', to: 'apns', kind: 'req', tag: 'POST /3/device/…', ms: 40, title: 'A Apple', text: '', code: '{ "aps": { "alert": { "title": "Ana", "body": "@beto mira esto" }, "thread-id": "conv-2105…" },\n  "post_id": "2105447601003728904" }', lang: 'json' },
        { from: 'apns', to: 'beto', kind: 'async', tag: 'aviso', ms: 500, title: 'Suena el teléfono', text: '' },
        { from: 'beto', to: 'tfe', kind: 'req', tag: 'TweetDetail', ms: 40, title: 'Beto lo toca', text: 'La app abre la conversación.' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'TweetDetail', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'tweetypie', kind: 'req', tag: 'conversación', ms: 1, title: '', text: '' },
        { from: 'tweetypie', to: 'gql', kind: 'res', tag: 'post y respuestas', ms: 8, title: '', text: '' },
        { from: 'gql', to: 'tfe', kind: 'res', tag: '200', ms: 2, title: '', text: '' },
        { from: 'tfe', to: 'beto', kind: 'res', tag: '200', ms: 40, title: 'La respuesta de Ana', text: 'Y el toque vuelve como señal: los avisos que se abren entrenan al ranker pesado.' }
      ]
    },
    {
      id: 'dm', title: 'Un mensaje cifrado',
      desc: 'Ana le escribe a Beto por XChat. El mensaje sale cifrado del teléfono de Ana y el servidor solo lo guarda y lo entrega.',
      steps: [
        { at: 'ana', kind: 'info', tag: 'cifrar', ms: 1, title: 'Cifra en el teléfono', text: 'Con las claves de los dispositivos de Beto. El servidor nunca ve el texto. <span class="badge badge--doc">Documentado</span>' },
        { from: 'ana', to: 'tfe', kind: 'req', tag: 'ciphertext', ms: 40, title: 'Envía', text: '' },
        { from: 'tfe', to: 'xchat', kind: 'req', tag: 'enviar(conv, ciphertext)', ms: 2, title: 'A XChat', text: 'Guarda el mensaje cifrado y quién lo manda a quién: los metadatos no van cifrados. <span class="badge badge--doc">Documentado</span>' },
        { from: 'xchat', to: 'tfe', kind: 'res', tag: 'guardado', ms: 5, title: '', text: '' },
        { from: 'tfe', to: 'ana', kind: 'res', tag: 'enviado', ms: 40, title: 'Enviado', text: '' },
        { from: 'xchat', to: 'tfe', kind: 'async', tag: 'nuevo mensaje', ms: 5, title: 'A Beto, por su conexión abierta', text: 'Si no tiene la app abierta, le llega un push y la app baja el mensaje al abrirse.' },
        { from: 'tfe', to: 'beto', kind: 'async', tag: 'ciphertext', ms: 40, title: 'Beto lo descifra', text: 'Con su clave privada, que está en el teléfono.' },
        { at: 'beto', kind: 'info', tag: 'teléfono nuevo', ms: 1, title: '¿Y si Beto cambia de teléfono?', text: 'Recupera su clave con el PIN: Juicebox reparte la clave en tres realms, cada uno limita los intentos y ninguno la tiene completa. <span class="badge badge--doc">Documentado</span>' },
        { from: 'beto', to: 'tfe', kind: 'req', tag: 'recuperar_clave(PIN)', ms: 40, title: 'Recuperar', text: '' },
        { from: 'tfe', to: 'xchat', kind: 'req', tag: 'Juicebox ×3 realms', ms: 30, title: 'Tres partes', text: 'Los tres realms los opera X. Por eso varios investigadores señalaron que no es lo mismo que repartirlos entre organizaciones independientes. <span class="badge badge--doc">Documentado</span>' },
        { from: 'xchat', to: 'tfe', kind: 'res', tag: 'partes', ms: 5, title: '', text: '' },
        { from: 'tfe', to: 'beto', kind: 'res', tag: 'clave', ms: 40, title: 'Historial legible otra vez', text: 'Sin forward secrecy, la misma clave abre los mensajes viejos: cómodo para recuperar, malo si la clave se filtra. <span class="badge badge--doc">Documentado</span>' }
      ]
    },
    {
      id: 'nota', title: 'Una Community Note aparece',
      desc: 'Ana escribe una nota sobre un post engañoso de la cuenta famosa. Calificadores con puntos de vista distintos la marcan como útil, el cálculo offline le da el estado "Útil" y Beto la ve debajo del post.',
      steps: [
        { from: 'ana', to: 'tfe', kind: 'req', tag: 'crear_nota', ms: 40, title: 'Ana escribe una nota', text: 'Con una fuente.' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'CreateNote', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'notes', kind: 'req', tag: 'crear_nota(post, texto)', ms: 1, title: '', text: '' },
        { from: 'notes', to: 'manhattan', kind: 'req', tag: 'put(nota)', ms: 3, title: 'Guardar', text: 'Estado inicial: necesita más calificaciones.' },
        { from: 'manhattan', to: 'notes', kind: 'res', tag: 'ok', ms: 3, title: '', text: '' },
        { from: 'notes', to: 'gql', kind: 'res', tag: 'nota creada', ms: 1, title: '', text: '' },
        { at: 'notes', kind: 'info', tag: 'calificaciones', ms: 3600000, title: 'Llegan las calificaciones', text: 'Colaboradores la califican como útil, algo útil o no útil, por el mismo camino.' },
        { at: 'offline', kind: 'info', tag: 'factorización de matrices', ms: 600000, title: 'El cálculo, offline', text: 'Cada calificación se modela como μ + i<sub>usuario</sub> + i<sub>nota</sub> + f<sub>usuario</sub>·f<sub>nota</sub>. El factor f captura el punto de vista; el intercepto de la nota, i<sub>nota</sub>, lo que queda: que gente que suele discrepar coincida en que es útil. <span class="badge badge--doc">Documentado</span>' },
        { from: 'offline', to: 'notes', kind: 'async', tag: 'i_nota = 0.43 ≥ 0.40', ms: 100, title: 'Estado: Útil', text: 'Con un intercepto de 0.40 o más. <span class="badge badge--doc">Documentado</span>' },
        { from: 'beto', to: 'tfe', kind: 'req', tag: 'TweetDetail', ms: 40, title: 'Beto abre el post', text: '' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'TweetDetail', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'notes', kind: 'req', tag: 'notas_de(post)', ms: 1, title: 'La API pide la nota', text: 'En paralelo con el post.' },
        { from: 'notes', to: 'gql', kind: 'res', tag: 'nota útil', ms: 3, title: '', text: '' },
        { from: 'gql', to: 'tfe', kind: 'res', tag: '200', ms: 2, title: '', text: '' },
        { from: 'tfe', to: 'beto', kind: 'res', tag: 'post + nota', ms: 40, title: 'La nota, debajo del post', text: 'Para todos, incluida la cuenta famosa, que no puede quitarla.' }
      ]
    },
    {
      id: 'reconstruir', title: 'Reconstruir una timeline perdida',
      desc: 'Beto vuelve tras dos meses y abre Siguiendo. Haplo solo guarda las timelines de quienes entraron en los últimos 30 días, así que la suya no está y hay que armarla una vez. Cómo lo hace X hoy no está publicado: el recorrido es un diseño de referencia con las piezas del mapa.',
      steps: [
        { from: 'beto', to: 'tfe', kind: 'req', tag: 'HomeLatestTimeline', ms: 40, title: 'Beto vuelve', text: '' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'HomeLatestTimeline', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'home', kind: 'req', tag: 'following(beto)', ms: 1, title: '', text: '' },
        { from: 'home', to: 'tls', kind: 'req', tag: 'get_timeline(beto)', ms: 1, title: '', text: '' },
        { from: 'tls', to: 'haplo', kind: 'req', tag: 'LRANGE tl:beto', ms: 1, title: '', text: '' },
        { from: 'haplo', to: 'tls', kind: 'fail', tag: 'vacía', ms: 1, title: 'No hay timeline', text: 'Se borró a los 30 días sin actividad. <span class="badge badge--doc">Documentado</span>' },
        { from: 'tls', to: 'home', kind: 'fail', tag: 'reconstruir', ms: 1, title: 'Un solo reconstructor', text: 'Un lock corto por usuario: si Beto abre la app en dos dispositivos, la timeline se arma una vez (el single-flight del M04). <span class="badge badge--ref">Diseño de referencia</span>' },
        { from: 'home', to: 'graph', kind: 'req', tag: 'following(beto)', ms: 3, title: 'A quién sigue', text: '' },
        { from: 'graph', to: 'home', kind: 'res', tag: '400 cuentas', ms: 3, title: '', text: '' },
        { from: 'home', to: 'thunder', kind: 'req', tag: 'get_in_network(400)', ms: 1, title: 'Lo reciente de cada una', text: 'Thunder tiene las últimas horas; para las cuentas poco activas hace falta ir más atrás, al índice por autor de Manhattan.' },
        { from: 'thunder', to: 'home', kind: 'res', tag: '~6 000 entradas', ms: 2, title: '', text: '' },
        { at: 'home', kind: 'info', tag: 'ordenar y cortar en 800', ms: 3, title: 'Mezclar por id', text: 'Ordenados por tiempo gracias a Snowflake.' },
        { from: 'home', to: 'tls', kind: 'req', tag: 'rebuild(800)', ms: 1, title: 'Escribir la lista', text: '' },
        { from: 'tls', to: 'haplo', kind: 'req', tag: 'RPUSH ×800', ms: 3, title: 'En un pipeline', text: 'Desde ahora el fan-out vuelve a agregarle posts nuevos.' },
        { at: 'home', kind: 'info', tag: 'hidratar 20', ms: 15, title: 'La primera página, como siempre', text: '' },
        { from: 'home', to: 'gql', kind: 'res', tag: '20 entradas', ms: 1, title: '', text: '' },
        { from: 'gql', to: 'tfe', kind: 'res', tag: 'URT', ms: 6, title: '', text: '' },
        { from: 'tfe', to: 'beto', kind: 'res', tag: '200', ms: 40, title: 'Unos 20 ms más que una lectura normal', text: 'Aceptable para quien vuelve tras dos meses. El peligro es que pase a la vez: si Haplo pierde un shard, millones de usuarios necesitan esto. Por eso se reconstruye al llegar cada uno y con un límite por segundo (30.14).' }
      ]
    },
    {
      id: 'pico', title: 'Un pico de 25 veces',
      desc: 'Termina la final y los posts por segundo se multiplican por 25. Publicar sigue igual de rápido, Para ti también, y lo que se atrasa es el reparto a Siguiendo.',
      steps: [
        { from: 'ana', to: 'tfe', kind: 'req', tag: '×25 posts por segundo', ms: 40, title: 'Llega la ola', text: 'Como en 2013 en Japón: 143 199 posts por segundo, 25 veces el promedio. <span class="badge badge--doc">Documentado</span>' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'CreateTweet', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'tweetypie', kind: 'req', tag: 'post_tweet', ms: 1, title: 'La escritura es la parte chica', text: 'Dimensionada para el pico, con margen.' },
        { from: 'tweetypie', to: 'manhattan', kind: 'req', tag: 'put', ms: 3, title: '', text: '' },
        { from: 'manhattan', to: 'tweetypie', kind: 'res', tag: 'ok', ms: 8, title: '', text: '' },
        { from: 'tweetypie', to: 'kafka', kind: 'req', tag: 'post_created', ms: 5, title: 'Al log', text: '' },
        { from: 'tweetypie', to: 'gql', kind: 'res', tag: 'Tweet', ms: 1, title: '', text: '' },
        { from: 'gql', to: 'tfe', kind: 'res', tag: '200', ms: 1, title: '', text: '' },
        { from: 'tfe', to: 'ana', kind: 'res', tag: '200', ms: 40, title: 'Ana publica igual de rápido', text: '' },
        { from: 'kafka', to: 'thunder', kind: 'async', tag: 'append ×143 000/s', ms: 5, title: 'Thunder no se atrasa', text: 'Una escritura de 16 bytes por post, en memoria: 143 000 por segundo son unos 2.3 MB/s.' },
        { from: 'kafka', to: 'fanout', kind: 'async', tag: 'lag creciendo', ms: 3000, title: 'El fan-out sí', text: 'Cada post son decenas o cientos de escrituras en Haplo: el trabajo crece 25 veces de golpe. Los eventos esperan en el log; nada se pierde.' },
        { at: 'fanout', kind: 'info', tag: 'escalar con el lag', ms: 60000, title: 'Más workers y prioridad a lo chico', text: 'La alarma sobre el lag agrega workers. Las cuentas chicas pasan primero; las grandes esperan.' },
        { from: 'fanout', to: 'haplo', kind: 'req', tag: 'LPUSH al máximo', ms: 5, title: 'Siguiendo, con segundos de atraso', text: '' },
        { from: 'beto', to: 'tfe', kind: 'req', tag: 'HomeTimeline', ms: 40, title: 'Mientras tanto, Beto abre Para ti', text: '' },
        { from: 'tfe', to: 'gql', kind: 'req', tag: 'HomeTimeline', ms: 2, title: '', text: '' },
        { from: 'gql', to: 'home', kind: 'req', tag: 'for_you(beto)', ms: 1, title: '', text: '' },
        { from: 'home', to: 'thunder', kind: 'req', tag: 'get_in_network', ms: 0.5, title: 'Para ti lee de Thunder', text: 'Que está al día: los goles de hace un segundo ya están.' },
        { from: 'thunder', to: 'home', kind: 'res', tag: 'al día', ms: 1, title: '', text: '' },
        { at: 'home', kind: 'info', tag: 'el resto del pipeline', ms: 150, title: 'El costo está en la lectura', text: 'Phoenix puntúa lo mismo que cualquier otro día: el pico de escrituras no le llega. Lo que sube es la cantidad de gente abriendo la app, y eso se cubre con capacidad de lectura.' },
        { from: 'home', to: 'gql', kind: 'res', tag: '22 entradas', ms: 1, title: '', text: '' },
        { from: 'gql', to: 'tfe', kind: 'res', tag: 'URT', ms: 6, title: '', text: '' },
        { from: 'tfe', to: 'beto', kind: 'res', tag: '200', ms: 40, title: 'Beto ve la final en vivo', text: 'Cada etapa tiene su margen: la escritura, dimensionada para el pico; el fan-out, absorbido por el log; Para ti, independiente del fan-out.' }
      ]
    }
  ]
});
