/* Mapa del M28: una red de borde al estilo de Cloudflare. Lo que la empresa publicó en su blog y su documentación
   va marcado como documentado; el resto es un diseño de referencia. */
SD.defineMap('m28-cloudflare', {
  title: 'Una red de borde por dentro',
  intro: 'Un usuario en Lisboa visita una tienda cuyo origen está en Virginia. Todo lo que ve pasa primero por el PoP de Cloudflare más cercano, donde cada servidor corre todos los servicios: DNS, filtro de paquetes, TLS, WAF, caché y Workers.',
  start: 'proxy',
  groups: [
    { id: 'g-users', label: 'Internet', x: 20, y: 40, w: 230, h: 560 },
    { id: 'g-pop', label: 'PoP de Lisboa: cada servidor corre todos los servicios', x: 280, y: 40, w: 840, h: 560 },
    { id: 'g-far', label: 'Otros PoPs', x: 1150, y: 40, w: 290, h: 560 },
    { id: 'g-origin', label: 'Origen del cliente (Virginia)', x: 1470, y: 40, w: 260, h: 560 },
    { id: 'g-ctrl', label: 'Plano de control', x: 280, y: 630, w: 840, h: 170 }
  ],
  nodes: [
    { id: 'user', layer: 'client', label: 'Usuario en Lisboa', sub: 'navegador', x: 135, y: 200,
      info: {
        resp: '<p>Abre <code>tienda.example</code>. No sabe que hay una red de borde en el medio: resuelve el nombre, recibe una IP y se conecta a ella como a cualquier servidor.</p>',
        api: '<pre data-lang="http"><code>GET /catalogo.js HTTP/2\nHost: tienda.example\n\nHTTP/2 200\ncf-cache-status: HIT\ncf-ray: 8c3f2a1b9d0e4f5a-LIS\nage: 1843</code></pre>',
        data: '<p>El header <code>cf-ray</code> identifica la request y termina con el código del PoP que la atendió (LIS, Lisboa); <code>cf-cache-status</code> dice si salió de la caché. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<p>Si el PoP de Lisboa cae, la conexión abierta se corta y la siguiente llega sola a otro PoP (escenario "Un PoP deja de responder").</p>',
        nums: '<ul><li>Hasta el PoP: unos 8 ms de ida y vuelta. Hasta el origen en Virginia: más de 80 ms.</li></ul>'
      } },
    { id: 'botnet', layer: 'external', label: 'Botnet', sub: 'miles de máquinas infectadas', x: 135, y: 440,
      info: {
        resp: '<p>Dispositivos comprometidos (cámaras, routers, servidores mal configurados) que mandan tráfico al mismo destino a la vez: paquetes SYN falsos, UDP amplificado o requests HTTP que parecen legítimas.</p>',
        api: '<p>No pide nada útil: busca agotar el ancho de banda, las tablas de conexiones o la CPU del destino.</p>',
        data: '<p>Direcciones de origen falsificadas en los ataques de capa 3 y 4; direcciones reales, rotando, en los de capa 7.</p>',
        fail: '<p>El peligro es la concentración: contra un solo datacenter, un ataque de varios Tbps satura sus enlaces antes de llegar a los servidores.</p>',
        nums: '<ul><li>Cloudflare ha reportado ataques récord de más de 7 Tbps en 2025. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'dns', layer: 'edge', label: 'DNS autoritativo', sub: 'responde una IP anycast', x: 420, y: 120,
      info: {
        resp: '<p>Responde las consultas DNS de los dominios de los clientes. Para un sitio protegido no devuelve la IP del origen sino una IP de Cloudflare, que es anycast: existe en todos los PoPs a la vez. El propio servicio DNS también es anycast.</p>',
        api: '<pre><code>$ dig +short tienda.example\n104.16.132.229\n104.16.133.229</code></pre>',
        data: '<p>Las zonas de los clientes, replicadas en cada PoP con el mismo sistema que la configuración (Quicksilver).</p>',
        fail: '<p>Esconder la IP del origen es parte de la protección: si se filtra, un atacante puede saltarse la red y atacarlo directo. Por eso el origen solo acepta tráfico de Cloudflare, o se conecta con un túnel saliente.</p>',
        nums: '<ul><li>TTL corto en las respuestas; responder desde el PoP más cercano tarda unos pocos milisegundos.</li></ul>'
      } },
    { id: 'router', layer: 'edge', label: 'Router de borde', sub: 'anuncia el prefijo por BGP', x: 420, y: 300,
      info: {
        resp: '<p>Anuncia por BGP los mismos prefijos IP que todos los demás PoPs. Cada red de internet manda los paquetes a la ruta que considera más corta, así que cada usuario llega a un PoP cercano sin que nadie elija por él. Cloudflare opera en más de 330 ciudades. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>anuncio BGP:  104.16.0.0/13  origen AS13335\n(el mismo anuncio sale de Lisboa, Madrid, Fráncfort, Ashburn…)</code></pre>',
        data: '<p>Tablas de rutas y sesiones BGP con los proveedores de tránsito y las redes con las que intercambia tráfico directo.</p>',
        fail: '<p>Si el PoP tiene problemas, deja de anunciar el prefijo (BGP withdraw) y el tráfico converge hacia otro PoP en segundos. El reverso: un anuncio equivocado puede atraer tráfico que no debería, o hacerlo desaparecer.</p>',
        nums: '<ul><li>La convergencia de BGP tras un withdraw tarda de segundos a unos pocos minutos según la red.</li></ul>'
      } },
    { id: 'l4', layer: 'edge', label: 'Balanceo L4 y filtro', sub: 'XDP: descarta en el driver', x: 420, y: 480,
      info: {
        resp: '<p>Reparte las conexiones entre los servidores del PoP y descarta el tráfico de ataque. El balanceador L4 de Cloudflare, Unimog, corre en XDP (eBPF en el driver de red) en los mismos servidores que atienden requests, y usa hashing consistente para que todos los paquetes de una conexión lleguen al mismo servidor. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>programa XDP por paquete:\n  si coincide con una huella de ataque  → XDP_DROP\n  si es parte de una conexión           → servidor = tabla[hash(5-tupla)]\n  si no                                 → pila de red normal (SYN cookies bajo ataque)</code></pre>',
        data: '<p>La tabla de servidores sanos del PoP y las reglas de descarte vigentes, publicadas por la detección de DDoS.</p>',
        fail: '<p>Si un servidor sale de servicio, el hashing consistente solo mueve las conexiones de ese servidor: las demás siguen donde estaban.</p>',
        nums: '<ul><li>XDP procesa millones de paquetes por segundo por núcleo: descartar en el driver cuesta mucho menos que dejar que el kernel arme la conexión.</li></ul>'
      } },
    { id: 'proxy', layer: 'service', label: 'Proxy HTTP', sub: 'TLS, WAF, caché, Workers', x: 700, y: 300,
      info: {
        resp: '<p>Termina TLS, parsea la request HTTP y la hace pasar por la cadena de productos: WAF y bots, reglas del cliente, caché y Workers, y si hace falta la reenvía al nivel superior o al origen. Cloudflare reemplazó su proxy basado en NGINX por Pingora, un framework propio escrito en Rust. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>cadena de una request:\n  TLS → reglas de seguridad (WAF, rate limiting, bots) → reglas del cliente\n      → Worker de la ruta (si hay) → caché → nivel superior → origen</code></pre>',
        data: '<p>La configuración de todas las zonas, leída de la réplica local de Quicksilver: ninguna request consulta un servicio central.</p>',
        fail: '<p>Un error en la configuración o el código del proxy llega a todos los servidores del mundo a la vez: es el componente con mayor radio de impacto (escenario "Un cambio de configuración global").</p>',
        nums: '<ul><li>Cloudflare atiende del orden de decenas de millones de requests HTTP por segundo en promedio.</li></ul>'
      } },
    { id: 'waf', layer: 'service', label: 'WAF y bots', sub: 'reglas y puntaje de bots', x: 700, y: 120,
      info: {
        resp: '<p>Evalúa cada request contra reglas administradas (inyección SQL, XSS, vulnerabilidades conocidas), reglas del cliente y un puntaje de bot. Decide si deja pasar, bloquea, pide un desafío o limita la tasa.</p>',
        api: '<pre><code>regla del cliente (lenguaje de expresiones):\n  (http.request.uri.path eq "/login" and cf.bot_management.score lt 30)\n  → acción: managed_challenge</code></pre>',
        data: '<p>Reglas compiladas por zona, distribuidas con el resto de la configuración.</p>',
        fail: '<p>El 2 de julio de 2019, una regla nueva del WAF con una expresión regular de backtracking catastrófico se publicó en todo el mundo en segundos y agotó la CPU de los servidores durante 27 minutos. <span class="badge badge--doc">Documentado</span> Desde entonces, el motor de expresiones regulares limita el costo y las reglas se despliegan por etapas.</p>',
        nums: '<ul><li>La evaluación completa tiene que costar microsegundos: se hace en cada request.</li></ul>'
      } },
    { id: 'cache', layer: 'cache', label: 'Caché del PoP', sub: 'SSD en cada servidor', x: 700, y: 480,
      info: {
        resp: '<p>Guarda las respuestas cacheables por su clave (host, ruta y los parámetros que el cliente elija) en los discos de los servidores del PoP. Si varias requests piden a la vez un objeto que no está, se hace un solo pedido hacia arriba y las demás esperan esa respuesta (request coalescing, M04).</p>',
        api: '<pre data-lang="http"><code>HTTP/2 200\ncache-control: public, max-age=3600, stale-while-revalidate=60\ncf-cache-status: MISS</code></pre>',
        data: '<p>Objetos en SSD, repartidos entre los servidores del PoP con hashing consistente sobre la clave.</p>',
        fail: '<p>Una purga global vacía la caché de un objeto en todo el mundo en segundos; una purga de todo el sitio manda todo el tráfico al origen a la vez. Por eso se purga por URL o por etiqueta, no todo.</p>',
        nums: '<ul><li>Un HIT se sirve en milisegundos desde el PoP; un MISS suma el viaje al nivel superior o al origen.</li></ul>'
      } },
    { id: 'worker', layer: 'service', label: 'Workers', sub: 'V8 isolates', x: 980, y: 300,
      info: {
        resp: '<p>Ejecuta el código JavaScript o WebAssembly del cliente en cada request de las rutas que elija. Cada Worker corre en un isolate de V8, el mismo mecanismo que aísla pestañas en Chrome: miles de isolates comparten un proceso, y arrancar uno cuesta milisegundos, no los cientos de milisegundos de un contenedor. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>export default {\n  async fetch(request, env) {\n    const sala = env.SALAS.get(env.SALAS.idFromName("sala-42"));\n    return sala.fetch(request);        // al Durable Object de esa sala\n  },\n};</code></pre>',
        data: '<p>Sin estado propio entre requests: usa KV, Durable Objects, R2 u otros servicios a través de <code>env</code>.</p>',
        fail: '<p>Límites de CPU y memoria por request: un Worker que se pasa se corta, sin afectar a los demás isolates del proceso.</p>',
        nums: '<ul><li>Cloudflare precalienta el isolate durante el handshake TLS, así el arranque en frío no se nota. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'kv', layer: 'db', label: 'Workers KV', sub: 'lecturas locales, eventual', x: 980, y: 480,
      info: {
        resp: '<p>Almacenamiento clave-valor pensado para muchas lecturas y pocas escrituras: configuración, feature flags, redirecciones. Las lecturas se sirven desde el PoP; las escrituras van a un almacén central y se propagan. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>const flags = await env.CONFIG.get("flags", "json");\nawait env.CONFIG.put("flags", JSON.stringify(nuevos));</code></pre>',
        data: '<p>Copias en caché en cada PoP que las usa; la fuente de verdad, centralizada.</p>',
        fail: '<p>Consistencia eventual: un cambio puede tardar un minuto o más en verse en otros lugares del mundo. <span class="badge badge--doc">Documentado</span> No sirve para contadores ni para nada que exija leer lo último que se escribió: para eso existen los Durable Objects.</p>',
        nums: '<ul><li>En PACELC es un sistema PA/EL: disponible y rápido, a costa de consistencia (M06).</li></ul>'
      } },
    { id: 'madrid', layer: 'edge', label: 'PoP de Madrid', sub: 'toma el tráfico si Lisboa cae', x: 1295, y: 120,
      info: {
        resp: '<p>Otro PoP completo, con los mismos servicios y los mismos prefijos anycast. Para un usuario de Lisboa es la segunda opción: cuando Lisboa deja de anunciar sus rutas, sus paquetes llegan acá.</p>',
        api: '<p>La misma interfaz que cualquier PoP: nada que configurar para que tome el tráfico.</p>',
        data: '<p>Su propia caché, más fría para el contenido que se pedía sobre todo en Lisboa.</p>',
        fail: '<p>Si los dos PoPs cercanos caen, el tráfico sigue viajando al siguiente: la red degrada latencia, no disponibilidad.</p>',
        nums: '<ul><li>De Lisboa a Madrid, unos 10 ms más de ida y vuelta.</li></ul>'
      } },
    { id: 'tier', layer: 'cache', label: 'Caché de nivel superior', sub: 'cerca del origen (Ashburn)', x: 1295, y: 300,
      info: {
        resp: '<p>Con tiered cache, los PoPs no le piden al origen directamente: le piden a un PoP de nivel superior, elegido cerca del origen. Muchos PoPs comparten así una misma copia, la tasa de aciertos sube y al origen llega una fracción de las requests. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>PoP de Lisboa (MISS) → nivel superior en Ashburn (HIT o MISS) → origen en Virginia</code></pre>',
        data: '<p>Una caché más grande y concentrada; puede respaldarse en almacenamiento persistente (Cache Reserve, sobre R2).</p>',
        fail: '<p>Si el nivel superior no responde, el PoP va directo al origen: la caché por niveles es una optimización, no una dependencia dura.</p>',
        nums: '<ul><li>Para contenido de cola larga, pasar de cientos de PoPs pidiendo al origen a unos pocos niveles superiores reduce las requests al origen en órdenes de magnitud.</li></ul>'
      } },
    { id: 'dobj', layer: 'db', label: 'Durable Object', sub: 'un solo escritor, Fráncfort', x: 1295, y: 480,
      info: {
        resp: '<p>Una instancia única en el mundo por cada ID, con su propio almacenamiento transaccional. Todas las requests para "sala-42" llegan al mismo objeto, que las procesa de a una. Sirve para lo que KV no puede: contadores, salas de chat, sesiones colaborativas, rate limiting exacto. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>export class Sala {\n  async fetch(request) {\n    const n = (await this.ctx.storage.get("mensajes")) ?? 0;\n    await this.ctx.storage.put("mensajes", n + 1);    // sin carreras: un solo hilo\n    return new Response(String(n + 1));\n  }\n}</code></pre>',
        data: '<p>Almacenamiento propio del objeto, fuertemente consistente, persistido en el lugar donde vive.</p>',
        fail: '<p>Vive en un solo lugar, cerca de donde se creó: un usuario lejano paga la distancia en cada request. Y un objeto muy cargado es un cuello de botella: se diseña con muchos objetos chicos (uno por sala), no uno global.</p>',
        nums: '<ul><li>En PACELC es PC/EC: consistente siempre, a costa de latencia para quien está lejos (M06).</li></ul>'
      } },
    { id: 'origin', layer: 'external', label: 'Origen', sub: 'servidores de la tienda', x: 1600, y: 300,
      info: {
        resp: '<p>Los servidores del cliente, donde vive la aplicación. Con la red delante, recibe solo lo que la caché no resolvió y lo que el WAF dejó pasar.</p>',
        api: '<p>HTTP normal. Recomendado: aceptar solo conexiones desde Cloudflare (listas de IPs o certificados de origen), o conectarse con Cloudflare Tunnel, que abre una conexión saliente y deja al origen sin ninguna IP pública. <span class="badge badge--doc">Documentado</span></p>',
        data: '<p>Lo de siempre: base de datos, sesiones, archivos.</p>',
        fail: '<p>Si el origen cae, la red puede seguir sirviendo contenido vencido de la caché (<code>stale-if-error</code>) mientras se recupera.</p>',
        nums: '<ul><li>Con buena caché, el origen recibe una fracción mínima del tráfico total del sitio.</li></ul>'
      } },
    { id: 'r2', layer: 'db', label: 'R2', sub: 'objetos, sin costo de salida', x: 1600, y: 480,
      info: {
        resp: '<p>Almacenamiento de objetos con API compatible con S3 y sin cargos por transferencia de salida. Se usa como origen de archivos grandes o como respaldo persistente de la caché. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>PUT https://&lt;cuenta&gt;.r2.cloudflarestorage.com/medios/video.mp4   (firmado con SigV4, M09)</code></pre>',
        data: '<p>Objetos con metadatos, como en cualquier almacenamiento de objetos (M09).</p>',
        fail: '<p>Las mismas prácticas del M09: URLs firmadas, claves con prefijos repartidos, ciclo de vida.</p>',
        nums: '<ul><li>Sin costo de salida, servir un archivo muy descargado cuesta lo mismo que guardarlo.</li></ul>'
      } },
    { id: 'api', layer: 'service', label: 'API y panel', sub: 'cambios de configuración', x: 420, y: 715,
      info: {
        resp: '<p>Donde los clientes cambian su configuración: registros DNS, reglas del WAF, rutas de Workers, purgas de caché. Valida cada cambio y lo escribe en el almacén de configuración.</p>',
        api: '<pre data-lang="http"><code>POST /client/v4/zones/{zone_id}/rulesets/{ruleset_id}/rules HTTP/1.1\nHost: api.cloudflare.com\nAuthorization: Bearer …\n\n{"expression": "http.request.uri.path eq \\"/login\\"", "action": "managed_challenge"}</code></pre>',
        data: '<p>La fuente de verdad de la configuración de todas las cuentas, en bases de datos centrales.</p>',
        fail: '<p>Si el plano de control cae, los clientes no pueden cambiar nada, pero el tráfico sigue funcionando con la última configuración: el plano de datos no depende de él en cada request.</p>',
        nums: '<ul><li>Millones de zonas y una cantidad enorme de cambios de configuración por día.</li></ul>'
      } },
    { id: 'qs', layer: 'db', label: 'Quicksilver', sub: 'config en cada servidor', x: 700, y: 715,
      info: {
        resp: '<p>El sistema de Cloudflare que distribuye la configuración: un almacén clave-valor replicado en cada servidor de cada PoP, que recibe los cambios en segundos. Cada servidor lee su copia local, sin consultar a nadie en cada request. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>escritura: plano de control → raíz de replicación → PoPs → cada servidor\nlectura:   el proxy lee la clave de la zona en su réplica local (microsegundos)</code></pre>',
        data: '<p>Toda la configuración de todas las zonas, en cada servidor.</p>',
        fail: '<p>Su virtud es su riesgo: un cambio malo también llega a todo el mundo en segundos. La defensa está antes (validación, despliegue por etapas) y después (rollback rápido y un interruptor para apagar la función nueva).</p>',
        nums: '<ul><li>Segundos para que un cambio llegue a todos los servidores del mundo.</li></ul>'
      } },
    { id: 'dosd', layer: 'service', label: 'Detección de DDoS', sub: 'muestras y reglas automáticas', x: 980, y: 715,
      info: {
        resp: '<p>Muestrea el tráfico que llega a cada servidor, busca patrones comunes en los paquetes de ataque (puertos, flags, tamaños, campos de cabecera) y genera una huella que se convierte en una regla de descarte en XDP, sin intervención humana. En Cloudflare corre en cada servidor, con una vista global además. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>muestra de paquetes → huella: tcp.flags == SYN &amp;&amp; ip.ttl in [52..58] &amp;&amp; pkt.len == 60\n                    → regla XDP_DROP publicada al PoP (o a todo el mundo)</code></pre>',
        data: '<p>Muestras recientes de paquetes y el historial de huellas por destino.</p>',
        fail: '<p>Una huella demasiado amplia descarta tráfico legítimo: las reglas se prueban contra el tráfico reciente y se ajustan antes de endurecerse.</p>',
        nums: '<ul><li>De la detección a la mitigación, segundos.</li></ul>'
      } }
  ],
  edges: [
    { id: 'e1', from: 'user', to: 'dns', both: true, label: '¿tienda.example?' },
    { id: 'e2', from: 'user', to: 'router', both: true, label: 'IP anycast' },
    { id: 'e3', from: 'botnet', to: 'router', label: 'SYN flood' },
    { id: 'e4', from: 'router', to: 'l4', both: true },
    { id: 'e5', from: 'l4', to: 'proxy', both: true },
    { id: 'e6', from: 'proxy', to: 'waf', both: true },
    { id: 'e7', from: 'proxy', to: 'cache', both: true },
    { id: 'e8', from: 'proxy', to: 'worker', both: true },
    { id: 'e9', from: 'worker', to: 'kv', both: true },
    { id: 'e10', from: 'worker', to: 'dobj', both: true, label: 'al objeto sala-42' },
    { id: 'e11', from: 'cache', to: 'tier', both: true, label: 'MISS' },
    { id: 'e12', from: 'tier', to: 'origin', both: true },
    { id: 'e13', from: 'user', to: 'madrid', both: true, bend: -120, label: 'tras el withdraw' },
    { id: 'e14', from: 'api', to: 'qs', async: true, label: 'cambio' },
    { id: 'e15', from: 'qs', to: 'proxy', async: true, bend: -150, label: 'réplica en segundos' },
    { id: 'e16', from: 'l4', to: 'dosd', both: true, async: true, label: 'muestras y reglas' },
    { id: 'e17', from: 'tier', to: 'r2', both: true, bend: 30 }
  ],
  scenarios: [
    {
      id: 'hit', title: 'Cache hit en el PoP',
      desc: 'El usuario pide un archivo estático que ya está en la caché del PoP de Lisboa. El origen en Virginia ni se entera.',
      steps: [
        { from: 'user', to: 'dns', kind: 'req', tag: '¿tienda.example?', ms: 10, title: 'Resuelve el nombre', text: 'Responde el DNS autoritativo de Cloudflare desde el PoP más cercano.' },
        { from: 'dns', to: 'user', kind: 'res', tag: '104.16.132.229', ms: 10, title: 'Una IP anycast', text: 'La misma IP existe en todos los PoPs del mundo.' },
        { from: 'user', to: 'router', kind: 'req', tag: 'SYN', ms: 4, title: 'El paquete llega a Lisboa', text: 'Nadie eligió el PoP: BGP llevó el paquete por la ruta más corta hacia ese prefijo.' },
        { from: 'router', to: 'l4', kind: 'req', tag: 'ECMP', ms: 0.05, title: 'El router reparte entre servidores', text: '' },
        { at: 'l4', kind: 'info', ms: 0.01, title: 'Un servidor por conexión', text: 'El balanceo L4 en XDP elige el servidor con un hash de la conexión: todos sus paquetes irán al mismo, aunque cambie la cantidad de servidores sanos.' },
        { from: 'l4', to: 'proxy', kind: 'req', tag: 'TCP + TLS 1.3', ms: 8, title: 'Handshakes a 8 ms, no a 80', text: 'TCP y TLS se hacen contra el PoP: los viajes de ida y vuelta son cortos (M01).' },
        { from: 'proxy', to: 'waf', kind: 'req', tag: '¿reglas?', ms: 0.2, title: 'WAF y bots', text: 'Nada sospechoso: pasa.' },
        { from: 'proxy', to: 'cache', kind: 'req', tag: 'GET /catalogo.js', ms: 0.5, title: 'Busca en la caché', text: '' },
        { from: 'cache', to: 'proxy', kind: 'res', tag: 'HIT', ms: 0.5, title: 'Está en el SSD del PoP', text: 'Lo guardó una request de otro usuario hace media hora.' },
        { from: 'proxy', to: 'l4', kind: 'res', tag: '200', ms: 0.05, title: 'La respuesta sale', text: '' },
        { from: 'router', to: 'user', kind: 'res', tag: '200 · HIT', ms: 4, title: 'El usuario la recibe', text: 'Menos de 40 ms en total desde que pidió el nombre, sin tocar el origen.' }
      ]
    },
    {
      id: 'miss', title: 'Miss: nivel superior y origen',
      desc: 'El archivo no está en Lisboa. En lugar de ir al origen, el PoP le pregunta al nivel superior cerca de Virginia.',
      steps: [
        { from: 'proxy', to: 'cache', kind: 'req', tag: 'GET /producto/88.jpg', ms: 0.5, title: 'Busca en la caché', text: '' },
        { from: 'cache', to: 'proxy', kind: 'fail', tag: 'MISS', ms: 0.5, title: 'No está en Lisboa', text: 'Si llegan otras requests por el mismo objeto mientras tanto, esperan esta misma búsqueda: un solo pedido hacia arriba.' },
        { from: 'cache', to: 'tier', kind: 'req', tag: '¿lo tenés?', ms: 40, title: 'Pregunta al nivel superior', text: 'Un PoP en Ashburn, elegido por su cercanía al origen. La conexión entre PoPs ya está abierta: no hay handshakes que pagar.' },
        { at: 'tier', kind: 'fail', ms: 0.5, title: 'MISS también arriba', text: 'Es la primera request por este objeto en toda la región.' },
        { from: 'tier', to: 'origin', kind: 'req', tag: 'GET', ms: 2, title: 'El nivel superior pide al origen', text: 'Desde Ashburn, el origen en Virginia está a un par de milisegundos.' },
        { from: 'origin', to: 'tier', kind: 'res', tag: '200 · 180 kB', ms: 30, title: 'El origen responde', text: 'El nivel superior guarda una copia.' },
        { from: 'tier', to: 'cache', kind: 'res', tag: '200', ms: 40, title: 'Vuelve a Lisboa', text: 'Lisboa también guarda una copia. Cuando un usuario de Madrid pida el mismo objeto, su PoP lo encontrará en el nivel superior: el origen no recibe otra request.' },
        { from: 'cache', to: 'proxy', kind: 'res', tag: '200', ms: 0.5, title: 'El proxy lo entrega', text: '' },
        { from: 'router', to: 'user', kind: 'res', tag: '200 · MISS', ms: 4, title: 'El usuario lo recibe', text: 'Unos 120 ms esta vez; la próxima, desde la caché de Lisboa.' }
      ]
    },
    {
      id: 'syn-flood', title: 'SYN flood',
      desc: 'Una botnet manda cientos de millones de paquetes SYN falsos por segundo contra la tienda. El usuario de Lisboa sigue comprando.',
      steps: [
        { from: 'botnet', to: 'router', kind: 'fail', tag: 'SYN × millones/s', ms: 2, title: 'Empieza el ataque', text: 'Con anycast, cada PoP recibe solo la parte del ataque que viene de su región: el ataque se reparte entre cientos de PoPs en lugar de concentrarse en uno.' },
        { from: 'router', to: 'l4', kind: 'fail', tag: 'paquetes de ataque', ms: 0.05, title: 'Los paquetes llegan a los servidores', text: '' },
        { at: 'l4', kind: 'info', ms: 0.01, title: 'SYN cookies mientras tanto', text: 'Bajo ataque, el kernel responde con SYN cookies: no reserva memoria por cada SYN hasta que el cliente complete el handshake, cosa que un paquete falso nunca hace.' },
        { from: 'l4', to: 'dosd', kind: 'async', tag: 'muestras', ms: 500, title: 'La detección toma muestras', text: '' },
        { at: 'dosd', kind: 'info', ms: 1500, title: 'Encuentra la huella del ataque', text: 'Todos los paquetes comparten rasgos: flag SYN, puerto 443, un rango de TTL y tamaño fijo. Con eso genera una regla que no toca al tráfico legítimo.' },
        { from: 'dosd', to: 'l4', kind: 'async', tag: 'regla XDP', ms: 200, title: 'Publica la regla', text: 'Primero en el PoP; si el ataque es global, en todos.' },
        { at: 'l4', kind: 'info', ms: 0.01, title: 'Descarte en el driver', text: 'XDP descarta los paquetes que coinciden con la huella antes de que el kernel los procese: el costo por paquete de ataque es mínimo.' },
        { from: 'user', to: 'router', kind: 'req', tag: 'SYN legítimo', ms: 4, title: 'El usuario sigue llegando', text: '' },
        { from: 'router', to: 'l4', kind: 'req', tag: 'no coincide', ms: 0.05, title: 'Su paquete no coincide con la huella', text: '' },
        { from: 'l4', to: 'proxy', kind: 'req', tag: 'TCP + TLS', ms: 8, title: 'Llega al proxy como siempre', text: 'Para él, el ataque no existió.' }
      ]
    },
    {
      id: 'pop-cae', title: 'Un PoP deja de responder',
      desc: 'Una falla deja fuera de servicio a los servidores del PoP de Lisboa. Sus usuarios pasan a Madrid sin configurar nada.',
      steps: [
        { at: 'proxy', kind: 'fail', ms: 1, down: ['proxy', 'l4', 'cache', 'worker'], title: 'Los servidores de Lisboa fallan', text: 'Una falla de energía en una parte del datacenter.' },
        { from: 'user', to: 'router', kind: 'fail', tag: 'conexión cortada', ms: 4, title: 'La conexión abierta se corta', text: 'Las conexiones TCP en curso con Lisboa se pierden: el navegador verá un error de red y reintentará.' },
        { at: 'router', kind: 'fail', ms: 3000, down: ['router'], title: 'BGP withdraw', text: 'Los health checks detectan el problema y los routers de Lisboa retiran el anuncio de los prefijos anycast.' },
        { at: 'user', kind: 'info', ms: 5000, title: 'Internet converge', text: 'En segundos, las redes de la región dejan de tener una ruta a Lisboa y usan la siguiente más corta.' },
        { from: 'user', to: 'madrid', kind: 'req', tag: 'SYN', ms: 9, title: 'El reintento llega a Madrid', text: 'La misma IP, otro PoP. Handshakes nuevos: unos milisegundos más que antes.' },
        { at: 'madrid', kind: 'info', ms: 1, title: 'Caché de Madrid', text: 'Lo más pedido también está en Madrid; lo que era muy local de Lisboa se buscará en el nivel superior.' },
        { from: 'madrid', to: 'user', kind: 'res', tag: '200', ms: 9, title: 'La tienda sigue funcionando', text: 'Lo que el usuario notó: un error de red y un reintento. Cuando Lisboa vuelva a anunciar sus rutas, el tráfico regresa solo.' }
      ]
    },
    {
      id: 'config', title: 'Un cambio de configuración global',
      desc: 'Un cliente publica una regla nueva del WAF. En segundos, está en cada servidor del mundo, y por eso se despliega con cuidado.',
      steps: [
        { at: 'api', kind: 'info', ms: 80, title: 'Valida la regla', text: 'Sintaxis, pruebas contra tráfico de muestra y límites de costo: una expresión sin límite de backtracking se rechaza antes de publicarse.' },
        { from: 'api', to: 'qs', kind: 'async', tag: 'escribir', ms: 50, title: 'Escribe el cambio', text: '' },
        { from: 'qs', to: 'proxy', kind: 'async', tag: 'réplica', ms: 3000, title: 'Llega a cada servidor en segundos', text: 'Quicksilver replica la configuración a todos los servidores de todos los PoPs.' },
        { at: 'proxy', kind: 'info', ms: 1, title: 'Cada request usa la regla nueva', text: 'El proxy lee la configuración de su réplica local.' },
        { at: 'proxy', kind: 'fail', ms: 1, title: 'Qué pasó en 2019', text: 'Una regla administrada del WAF con una expresión regular de backtracking catastrófico llegó así a todo el mundo y llevó la CPU al 100 % durante 27 minutos. La lección fue desplegar por etapas también la configuración.' },
        { at: 'qs', kind: 'info', ms: 1, title: 'Por etapas', text: 'Los cambios de riesgo se publican primero en un grupo chico de servidores o PoPs, con la CPU y los errores vigilados; si empeoran, se revierten antes de llegar al resto, y hay un interruptor para apagar la función nueva al instante (M11).' }
      ]
    },
    {
      id: 'worker-do', title: 'Worker y Durable Object',
      desc: 'Un usuario de Lisboa manda un mensaje a una sala de chat. El Worker corre en Lisboa; el estado de la sala vive en un solo lugar del mundo.',
      steps: [
        { from: 'user', to: 'router', kind: 'req', tag: 'POST /sala/42', ms: 4, title: 'El mensaje llega a Lisboa', text: '' },
        { from: 'router', to: 'l4', kind: 'req', tag: '', ms: 0.05, title: 'Al servidor de la conexión', text: '' },
        { from: 'l4', to: 'proxy', kind: 'req', tag: 'HTTP', ms: 0.2, title: 'El proxy ve una ruta con Worker', text: '' },
        { from: 'proxy', to: 'worker', kind: 'req', tag: 'fetch', ms: 0.5, title: 'Corre el Worker', text: 'En un isolate de V8 que, si no estaba caliente, arranca en milisegundos.' },
        { from: 'worker', to: 'kv', kind: 'req', tag: 'get config', ms: 0.5, title: 'Lee la configuración de la sala en KV', text: 'Lectura local y rápida. Si alguien cambió la configuración hace segundos, puede leer la versión anterior: está bien para esto.' },
        { from: 'worker', to: 'dobj', kind: 'req', tag: 'sala-42', ms: 25, title: 'Va al Durable Object de la sala', text: 'Vive en Fráncfort, donde se creó. Todos los usuarios de la sala, estén donde estén, llegan al mismo objeto.' },
        { at: 'dobj', kind: 'info', ms: 2, title: 'Un solo hilo, en orden', text: 'Procesa los mensajes de la sala de a uno: numerarlos no tiene carreras, y el almacenamiento es transaccional y fuertemente consistente.' },
        { from: 'dobj', to: 'worker', kind: 'res', tag: 'mensaje 1337', ms: 25, title: 'Responde con el número del mensaje', text: 'Y avisa a los demás miembros conectados por WebSocket, que también están conectados a este objeto.' },
        { from: 'worker', to: 'proxy', kind: 'res', tag: '201', ms: 0.2, title: 'El Worker responde', text: '' },
        { from: 'router', to: 'user', kind: 'res', tag: '201', ms: 4, title: 'Mensaje enviado', text: 'Unos 60 ms: la mayoría es el viaje a Fráncfort. El precio de un solo escritor es la distancia.' }
      ]
    }
  ]
});
