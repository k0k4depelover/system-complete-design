/* Mapa del M19: una flota de inferencia con su plano de control y su plano de datos. Todo es un diseño de referencia
   para un 70B servido con vLLM en réplicas de 4 H100; lo documentado por terceros va marcado en el texto del módulo. */
SD.defineMap('m19-flota', {
  title: 'Router y flota GPU',
  intro: 'Una región que sirve un modelo de 70B en 60 réplicas de 4 H100, más un pool de un modelo de 8B como respaldo. Arriba, el plano de control decide qué versiones corren, cuántas réplicas hay y en qué nodos. Abajo, el plano de datos atiende cada request: el router elige la réplica mirando su carga y lo que ya tiene en su KV cache.',
  start: 'router',
  groups: [
    { id: 'g-ctl', label: 'Plano de control: qué corre, cuánto y dónde', x: 340, y: 60, w: 1270, h: 140 },
    { id: 'g-data', label: 'Plano de datos: cada request, en milisegundos', x: 20, y: 240, w: 1590, h: 620 }
  ],
  nodes: [
    { id: 'apps', layer: 'client', label: 'Apps y API', sub: 'chat, clientes de la API', x: 130, y: 470,
      info: {
        resp: '<p>Quien manda las requests: la app de chat y los clientes de la API. No sabe nada de réplicas ni de regiones; ve un endpoint, un stream de tokens y, a veces, un 429 o un 503 con <code>Retry-After</code>.</p>',
        api: '<pre data-lang="http"><code>POST /v1/chat/completions\nAuthorization: Bearer sk-…\n\n{"model": "llama-3.1-70b", "stream": true,\n "messages": [ … 12 turnos … ]}</code></pre>',
        data: '<p>Nada en el servidor. En una conversación, cada turno manda todo el historial: por eso dos turnos seguidos comparten casi todo el prompt, y por eso importa a qué réplica va cada uno.</p>',
        fail: '<ul><li><b>Corte a mitad del stream:</b> la API pública no garantiza que se pueda retomar; el cliente reintenta la request completa. Dentro de la flota, el router sí puede continuar en otra réplica (escenario "Muere una réplica a mitad del decode").</li><li><b>503 o 529:</b> la flota está llena; reintentar con backoff y jitter (M08).</li></ul>',
        nums: '<ul><li>Pico de la región: 2 400 streams abiertos a la vez y unas 80 requests nuevas por segundo.</li><li>Prompt promedio de un turno de chat: 6 000 tokens, de los cuales 5 700 ya se vieron en el turno anterior.</li></ul>'
      } },
    { id: 'gateway', layer: 'edge', label: 'Gateway', sub: 'auth, cuotas, admission', x: 470, y: 470,
      info: {
        resp: '<p>La puerta de la región (M17 y M18): termina TLS, autentica, aplica las cuotas por tokens y el admission control, y mantiene el stream SSE con el cliente. Le pasa al router la request ya validada, con el plan del cliente como prioridad.</p>',
        api: '<pre data-lang="http"><code>POST /internal/v1/generate        (hacia el router)\nX-Org: org_51\nX-Tier: pago\nX-Conversation: conv_8f2\nX-Request-Id: req_77a1</code></pre>',
        data: '<p>Sin estado propio de la flota. Lee los límites del cliente y su prioridad, y reserva tokens en el limitador (M18).</p>',
        fail: '<ul><li><b>La flota no da abasto:</b> rechaza primero el tráfico de menor prioridad (gratuito, batch) con 503 y <code>Retry-After</code>, o lo manda al modelo de respaldo si el producto lo permite.</li><li><b>Se cae un gateway:</b> los streams abiertos en él se cortan; los clientes reconectan a otro.</li></ul>',
        nums: '<ul><li>Decenas de gateways por región, sin GPU: cada uno sostiene miles de streams (M17).</li></ul>'
      } },
    { id: 'router', layer: 'service', label: 'Router', sub: 'elige pool y réplica', x: 810, y: 470,
      info: {
        resp: '<p>Decide en cada request a qué réplica va. Primero el pool, por modelo y versión, según la tabla de rutas que publica el plano de control. Después la réplica, con dos señales: cuánto del prompt tiene cada una en su KV cache y cuánta carga tiene. Además sostiene el stream con la réplica y puede continuarlo en otra si la primera muere.</p>',
        api: '<pre><code>pick(request):\n  pool  = routes[model][version_por_hash(usuario)]\n  hits  = prefix_index.match(pool, bloques(prompt))   # tokens ya cacheados por réplica\n  carga = {r: r.en_curso + r.en_cola for r in pool}\n  techo = 1.25 * promedio(carga) + 1\n  candidatas = [r for r in pool if r.lista and carga[r] &lt; techo]\n  return max(candidatas, key=(hits[r], -carga[r])) or min(pool, key=carga)</code></pre>',
        data: '<p>En memoria: la tabla de rutas (versión, pesos del canary, réplicas listas), la carga de cada réplica según sus propias métricas, que llegan cada 100 a 500 ms, y una consulta al índice de prefijos por request.</p>',
        fail: '<ul><li><b>Información vieja:</b> la carga que ve el router tiene cientos de ms; si muchos routers eligen a la vez la misma réplica "vacía", la saturan. Por eso se suma la carga que el propio router ya mandó y se elige entre dos al azar cuando los puntajes empatan (power of two choices, M03).</li><li><b>El router cae:</b> es sin estado durable; hay varios detrás del gateway y los streams que sostenía se reintentan.</li></ul>',
        nums: '<ul><li>Decidir: menos de 1 ms.</li><li>Ahorro de un acierto de prefijo de 8 200 tokens: unos 0.57 s de prefill en 4 H100.</li><li>Techo de carga: 1.25 veces el promedio del pool.</li></ul>'
      } },
    { id: 'prefixidx', layer: 'cache', label: 'Índice de prefijos', sub: 'qué bloques tiene cada réplica', x: 810, y: 720,
      info: {
        resp: '<p>Sabe, aproximadamente, qué bloques de KV cache tiene cada réplica. Las réplicas publican un evento cuando guardan o expulsan un bloque, y el índice responde, para un prompt, cuántos tokens iniciales tiene cada réplica.</p>',
        api: '<pre><code>match(pool, [h1, h2, …, h531])  →  {r1: 187, r2: 512, r7: 187}   # bloques iniciales en caché\nevent(réplica, guardado | expulsado, [h…])</code></pre>',
        data: '<p>Bloques de 16 tokens, cada uno identificado por un hash encadenado: el hash del bloque <i>n</i> incluye el del bloque <i>n − 1</i>, así que dos prompts comparten un hash solo si comparten todo lo anterior.</p><pre><code>h1 = hash(tokens[0:16])\nh2 = hash(h1, tokens[16:32])\n…\nmapa: hash → {réplicas que lo tienen}</code></pre>',
        fail: '<ul><li><b>Desactualizado:</b> si el índice cree que una réplica tiene un prefijo que ya expulsó, la request paga el prefill entero, pero la respuesta es correcta. El índice es una pista, nunca una fuente de verdad.</li><li><b>Cae:</b> el router sigue eligiendo por carga sola; se pierde eficiencia, no disponibilidad.</li></ul>',
        nums: '<ul><li>418 000 tokens de KV cache por réplica: unos 26 000 bloques.</li><li>60 réplicas: 1.6 millones de entradas, unos 50 MB en memoria.</li></ul>'
      } },
    { id: 'r1', layer: 'gpu', label: 'Réplica 1', sub: '4 H100, vLLM', x: 1150, y: 290,
      info: {
        resp: '<p>Una copia completa del modelo repartida en 4 GPUs con tensor parallelism (M13), corriendo un motor como vLLM (M15) con continuous batching y prefix caching.</p>',
        api: '<pre><code>POST /generate        prompt, parámetros, stream\nGET  /metrics         num_requests_running, num_requests_waiting,\n                      kv_cache_usage, ttft, tpot  (Prometheus)\nGET  /health</code></pre>',
        data: '<p>141 GB de pesos en BF16 y unos 137 GB de KV cache: 418 000 tokens a 320 kB por token.</p>',
        fail: '<ul><li><b>Se llena el KV cache:</b> el motor pausa requests (preemption, M15) y el TTFT de las que esperan sube.</li><li><b>Falla una GPU:</b> con tensor parallelism, la réplica entera deja de funcionar.</li></ul>',
        nums: '<ul><li>Hasta 64 streams a la vez con un TPOT de unos 30 ms.</li><li>Prefill de 8 000 tokens: unos 0.57 s.</li></ul>'
      } },
    { id: 'r2', layer: 'gpu', label: 'Réplica 2', sub: '4 H100, vLLM', x: 1150, y: 410,
      info: {
        resp: '<p>Otra réplica del mismo pool. En los escenarios, es la que atendió los turnos anteriores de la conversación y todavía tiene su historial en el KV cache.</p>',
        api: '<p>La misma que la réplica 1. Además publica eventos de KV cache: qué bloques guardó y cuáles expulsó.</p>',
        data: '<p>El KV cache se gestiona en bloques (PagedAttention, M15). Cuando no hay lugar, expulsa los bloques que nadie usa, del menos usado recientemente al más.</p>',
        fail: '<p>Si muere, se pierde su KV cache: las conversaciones que tenía vuelven a pagar el prefill en otra réplica.</p>',
        nums: '<ul><li>El historial de una conversación de 12 turnos: unos 8 000 tokens, 2.6 GB de KV cache.</li></ul>'
      } },
    { id: 'rspot', layer: 'gpu', label: 'Réplica spot', sub: 'puede irse con aviso', x: 1150, y: 530,
      info: {
        resp: '<p>Una réplica en capacidad spot: GPUs que la nube vende con descuento a cambio de poder recuperarlas con poco aviso. Sirven para la parte de la flota que puede perderse sin dañar el servicio.</p>',
        api: '<p>La misma que las demás. Un agente del nodo consulta el servicio de metadatos de la nube y, ante un aviso, marca la réplica como no lista y empieza a drenarla.</p>',
        data: '<p>Lo mismo que las otras réplicas. Su KV cache se pierde al irse: hay que avisar al índice de prefijos.</p>',
        fail: '<ul><li>AWS avisa 2 minutos antes; Google Cloud y Azure, 30 segundos.</li><li>Una respuesta larga puede durar más que el aviso: hay que continuarla en otra réplica.</li></ul>',
        nums: '<ul><li>Descuento típico: 60 a 90&#8239;% sobre el precio por demanda, variable.</li><li>Este diseño limita el spot al 30&#8239;% del pool y nunca lo usa para el tráfico de mayor prioridad.</li></ul>'
      } },
    { id: 'rnew', layer: 'gpu', label: 'Réplica nueva', sub: 'arrancando', x: 1150, y: 650,
      info: {
        resp: '<p>Una réplica que el autoscaler pidió o que trae una versión nueva del modelo. No recibe tráfico hasta que su readiness probe responde bien: pesos cargados, KV cache reservado y una generación de prueba.</p>',
        api: '<pre><code>GET /health   → 503 mientras carga, 200 cuando está lista\n                (readiness: el router solo usa réplicas listas)</code></pre>',
        data: '<p>Arranca vacía: sin nada en su KV cache. Las primeras requests pagan el prefill completo.</p>',
        fail: '<ul><li><b>Falla la carga de pesos:</b> el checksum no coincide con el del registry y la réplica no se declara lista.</li><li><b>Arranque lento:</b> si tarda más que el pico, el pico se atiende con lo que ya había.</li></ul>',
        nums: '<ul><li>Arranque en un nodo nuevo: unos 520 s. En un pool precalentado: unos 27 s.</li></ul>'
      } },
    { id: 'small', layer: 'gpu', label: 'Pool de 8B', sub: 'modelo de respaldo', x: 1150, y: 790,
      info: {
        resp: '<p>Un modelo más chico y más barato. Recibe tráfico cuando el pool principal está saturado o caído, si el producto acepta degradar la calidad: el plan gratuito, tareas simples, o un fallback declarado.</p>',
        api: '<p>La misma API. La respuesta indica qué modelo contestó, para que el cliente y la facturación lo sepan.</p><pre data-lang="json"><code>{"model": "llama-3.1-8b", "system_fingerprint": "fp_fallback", …}</code></pre>',
        data: '<p>16 GB de pesos: entra en una sola GPU y deja casi toda la memoria para KV cache.</p>',
        fail: '<p>El fallback nunca es silencioso para quien paga por un modelo: o se informa en la respuesta, o se devuelve un error y decide el cliente.</p>',
        nums: '<ul><li>Del orden de 10 veces más barato por token que el 70B.</li></ul>'
      } },
    { id: 'regionb', layer: 'service', label: 'Región B', sub: 'otra flota completa', x: 470, y: 720,
      info: {
        resp: '<p>Otra región con su propia flota, su propio router y su propio plano de control. Comparte el model registry replicado y nada más: si una región cae, la otra sigue sola.</p>',
        api: '<p>El router puede desbordar requests a otra región cuando la propia no tiene capacidad y la latencia extra es aceptable. El DNS global manda allí el tráfico de una región caída.</p>',
        data: '<p>No comparte KV cache: una conversación que se muda de región paga su prefill entero.</p>',
        fail: '<ul><li><b>Cae la región A:</b> B recibe su tráfico. Si las dos estaban al 70&#8239;%, B queda al 140&#8239;%: no alcanza sin recortar.</li><li><b>Residencia de datos:</b> el tráfico de clientes con datos en la UE no puede desbordarse a una región fuera de la UE.</li></ul>',
        nums: '<ul><li>Uso máximo para sobrevivir a la caída de una región entre R: (R − 1) / R. Con 2 regiones, 50&#8239;%; con 3, 67&#8239;%.</li></ul>'
      } },
    { id: 'registry', layer: 'db', label: 'Model registry', sub: 'modelos, versiones, pesos', x: 470, y: 130,
      info: {
        resp: '<p>La fuente de verdad de qué modelos existen: cada versión con sus pesos, su checksum, su configuración de serving y su estado. Un nombre público como <code>gpt-x</code> es un alias que apunta a un snapshot fijo.</p>',
        api: '<pre data-lang="http"><code>GET  /internal/v1/models/llama-3.1-70b/versions\nPOST /internal/v1/models/llama-3.1-70b/versions      registrar\nPUT  /internal/v1/aliases/llama-3.1-70b              {"version": "2025-10-07"}</code></pre>',
        data: '<pre data-lang="sql"><code>CREATE TABLE model_versions (\n  model        text,\n  version      text,\n  weights_uri  text NOT NULL,       -- s3://pesos/llama70b/2025-10-07/\n  sha256       text NOT NULL,\n  dtype        text NOT NULL,       -- bf16, fp8\n  tp_size      int  NOT NULL,       -- 4\n  engine       text NOT NULL,       -- vllm==0.x.y\n  max_context  int  NOT NULL,\n  state        text NOT NULL,       -- staged, canary, ga, deprecated\n  PRIMARY KEY (model, version)\n);</code></pre>',
        fail: '<p>Si cae, no se puede desplegar ni escalar con versiones nuevas, pero la flota sigue sirviendo: el plano de datos no lo consulta por request.</p>',
        nums: '<ul><li>Decenas de modelos, cientos de versiones: una base chica, replicada entre regiones.</li></ul>'
      } },
    { id: 'deploy', layer: 'service', label: 'Despliegues', sub: 'canary y tabla de rutas', x: 810, y: 130,
      info: {
        resp: '<p>Decide qué versión recibe cuánto tráfico y publica la tabla de rutas a los routers. Maneja el canary: una versión nueva empieza con un porcentaje chico y sube si sus métricas no empeoran.</p>',
        api: '<pre data-lang="json"><code>{"model": "llama-3.1-70b",\n "routes": [{"version": "2025-07-23", "weight": 95},\n            {"version": "2025-10-07", "weight": 5}],\n "pools": {"2025-07-23": ["r1", "r2", "rspot"], "2025-10-07": ["rnew"]}}</code></pre>',
        data: '<p>Cada cambio de la tabla es una versión numerada: los routers aplican la más nueva que reciben y la siguen usando si el servicio de despliegues cae.</p>',
        fail: '<ul><li><b>La versión nueva empeora:</b> rollback al 0&#8239;%, sin redeploy, porque la versión anterior nunca se apagó.</li><li><b>Tabla mala publicada:</b> los routers validan la tabla (pesos que suman 100, pools con réplicas listas) antes de aplicarla.</li></ul>',
        nums: '<ul><li>Escalones típicos de un canary: 1, 5, 25, 50 y 100&#8239;%, con horas entre cada uno.</li></ul>'
      } },
    { id: 'autoscaler', layer: 'service', label: 'Autoscaler', sub: 'cuántas réplicas', x: 1150, y: 130,
      info: {
        resp: '<p>Cada 15 a 30 segundos lee las métricas de las réplicas y calcula cuántas tiene que haber. No usa la utilización de la GPU, que está alta aunque sobre capacidad: usa la cola, el uso de KV cache o el TTFT.</p>',
        api: '<pre><code>deseadas = ceil(actuales × métrica / objetivo)\n         = ceil(60 × 0.92 / 0.75) = 74</code></pre>',
        data: '<p>Historial de decisiones. Para bajar, usa el máximo de las recomendaciones de los últimos 5 minutos: así una caída momentánea de la demanda no apaga réplicas que se van a necesitar enseguida.</p>',
        fail: '<ul><li><b>Métrica equivocada:</b> escalar por CPU o por utilización de GPU no reacciona o reacciona tarde.</li><li><b>Sin GPUs disponibles:</b> pide nodos y la nube no los tiene. Por eso se reserva capacidad y se mantiene un colchón.</li></ul>',
        nums: '<ul><li>Objetivo de este diseño: 75&#8239;% del KV cache en uso.</li><li>Estabilización para bajar: 300 s.</li></ul>'
      } },
    { id: 'k8s', layer: 'service', label: 'Placement', sub: 'Kubernetes con nodos GPU', x: 1490, y: 130,
      info: {
        resp: '<p>Convierte "quiero 74 réplicas" en pods corriendo sobre nodos con 4 GPUs libres. Si no hay nodos, le pide más a la nube con un autoscaler de nodos.</p>',
        api: '<pre><code>spec:\n  replicas: 74\n  template:\n    spec:\n      terminationGracePeriodSeconds: 600   # el valor por defecto, 30 s, corta streams largos\n      containers:\n      - resources: {limits: {nvidia.com/gpu: 4}}</code></pre>',
        data: '<p>El estado deseado y el real de cada pod, en etcd (M06).</p>',
        fail: '<ul><li><b>Fragmentación:</b> hay 6 GPUs libres en total, pero repartidas de a 2 en tres nodos: no entra ninguna réplica de 4.</li><li><b>Apagado brusco:</b> con el periodo de gracia por defecto, un pod que se apaga tiene 30 s para terminar sus streams.</li></ul>',
        nums: '<ul><li>Conseguir y arrancar un nodo GPU nuevo: unos 5 minutos en este diseño.</li></ul>'
      } },
    { id: 'cloud', layer: 'external', label: 'Proveedor de nube', sub: 'nodos GPU, spot', x: 1830, y: 130,
      info: {
        resp: '<p>Alquila los nodos con GPU: por demanda, reservados por un plazo o spot. Avisa antes de recuperar un nodo spot.</p>',
        api: '<pre><code>GET http://169.254.169.254/…   servicio de metadatos del nodo:\n                                 aviso de interrupción spot</code></pre>',
        data: '<p>Ninguno del sistema.</p>',
        fail: '<p>Las GPUs grandes escasean: pedir 20 nodos de 8 H100 en un pico puede devolver 0. La capacidad base se reserva.</p>',
        nums: '<ul><li>Aviso spot: 2 minutos en AWS; 30 segundos en Google Cloud y Azure.</li></ul>'
      } },
    { id: 'weights', layer: 'db', label: 'Pesos', sub: 'S3 y caché NVMe', x: 1490, y: 650,
      info: {
        resp: '<p>Donde viven los pesos de cada versión: almacenamiento de objetos como fuente de verdad, con copias en los discos NVMe locales de los nodos para arrancar rápido.</p>',
        api: '<pre><code>s3://pesos/llama70b/2025-10-07/model-00001-of-00030.safetensors\n                              …\n                              SHA256SUMS</code></pre>',
        data: '<p>Archivos safetensors: los tensores se pueden mapear en memoria y copiar a la GPU sin deserializar.</p>',
        fail: '<ul><li><b>Lectura lenta:</b> muchos nodos arrancando a la vez saturan el ancho de banda; por eso hay caché local y lectura en paralelo.</li><li><b>Pesos corruptos:</b> el checksum del registry lo detecta antes de servir.</li></ul>',
        nums: '<ul><li>141 GB por versión del 70B en BF16.</li><li>A 2 GB/s desde objetos: 70 s. A 6 GB/s desde NVMe: 24 s.</li></ul>'
      } }
  ],
  edges: [
    { id: 'e1', from: 'apps', to: 'gateway', both: true, label: 'HTTPS y SSE' },
    { id: 'e2', from: 'gateway', to: 'router', both: true, label: 'request validada' },
    { id: 'e3', from: 'router', to: 'r1', both: true },
    { id: 'e4', from: 'router', to: 'r2', both: true, label: 'prompt y tokens', labelAt: 0.62 },
    { id: 'e5', from: 'router', to: 'rspot', both: true },
    { id: 'e6', from: 'router', to: 'rnew', both: true },
    { id: 'e7', from: 'router', to: 'small', both: true, label: 'respaldo', labelAt: 0.7 },
    { id: 'e8', from: 'router', to: 'prefixidx', both: true, label: '¿quién tiene el prefijo?' },
    { id: 'e9', from: 'r2', to: 'prefixidx', async: true, label: 'bloques guardados', labelAt: 0.62 },
    { id: 'e10', from: 'router', to: 'regionb', both: true, label: 'desborde', labelAt: 0.55 },
    { id: 'e11', from: 'registry', to: 'deploy', both: true, label: 'versiones' },
    { id: 'e12', from: 'deploy', to: 'router', async: true, label: 'tabla de rutas', labelAt: 0.4 },
    { id: 'e13', from: 'r1', to: 'autoscaler', async: true, label: 'métricas', labelAt: 0.45 },
    { id: 'e14', from: 'autoscaler', to: 'k8s', both: true, label: 'réplicas' },
    { id: 'e15', from: 'k8s', to: 'cloud', both: true, label: 'nodos' },
    { id: 'e16', from: 'k8s', to: 'rnew', both: true, bend: -150, label: 'crear pod', labelAt: 0.45 },
    { id: 'e17', from: 'rnew', to: 'weights', both: true, label: 'cargar 141 GB' },
    { id: 'e18', from: 'cloud', to: 'rspot', async: true, label: 'aviso spot', labelAt: 0.3 }
  ],
  scenarios: [
    {
      id: 'prefijo', title: 'Turno nuevo: acierto de prefijo',
      desc: 'El turno 6 de una conversación. La réplica 2 atendió los cinco anteriores y todavía tiene su historial. ¿La elige el router?',
      steps: [
        { from: 'apps', to: 'gateway', kind: 'req', tag: 'POST, 8 500 tokens', ms: 30, title: 'Llega el turno 6', text: '3 000 tokens de prompt de sistema, 5 200 de historial y 300 del mensaje nuevo.' },
        { from: 'gateway', to: 'router', kind: 'req', tag: 'conv_8f2', ms: 1, title: 'El gateway valida y reserva cuota', text: 'Autenticación, cuota por tokens (M18) y admission control. Le pasa la request al router.' },
        { from: 'router', to: 'prefixidx', kind: 'req', tag: 'match(531 bloques)', ms: 0.3, title: 'Pregunta quién tiene el prefijo', text: 'Divide el prompt en bloques de 16 tokens con hashes encadenados y pregunta qué réplicas tienen los primeros.' },
        { from: 'prefixidx', to: 'router', kind: 'res', tag: 'r2: 512, r1: 187', ms: 0.3, title: 'Respuesta', text: 'La réplica 2 tiene 512 bloques (8 192 tokens): el prompt de sistema y casi todo el historial. La réplica 1 solo el prompt de sistema.' },
        { at: 'router', kind: 'info', ms: 0.1, title: 'Comprueba la carga', text: 'La réplica 2 tiene 41 requests en curso; el promedio del pool es 38 y el techo, 1.25 × 38 + 1 = 48.5. Está por debajo: la elige.' },
        { from: 'router', to: 'r2', kind: 'req', tag: 'generate', ms: 0.5, title: 'Manda la request a la réplica 2', text: '' },
        { at: 'r2', kind: 'info', ms: 25, title: 'Prefill de 308 tokens', text: 'El motor encuentra los bloques en su KV cache y calcula solo lo que falta: unos 25 ms en lugar de 0.6 s.' },
        { from: 'r2', to: 'router', kind: 'res', tag: 'primer token', ms: 0.5, title: 'Sale el primer token', text: 'Y después uno cada unos 30 ms.' },
        { from: 'router', to: 'gateway', kind: 'res', tag: 'tokens', ms: 0.5, title: 'El stream vuelve por el router', text: '' },
        { from: 'gateway', to: 'apps', kind: 'res', tag: 'SSE', ms: 30, title: 'El usuario ve la respuesta', text: 'TTFT total de unos 90 ms, casi todo red.' },
        { from: 'r2', to: 'prefixidx', kind: 'async', tag: 'guardados: 20 bloques', ms: 50, title: 'La réplica publica los bloques nuevos', text: 'El mensaje nuevo y la respuesta quedan en su KV cache: el turno 7 también puede acertar.' }
      ]
    },
    {
      id: 'nueva', title: 'Conversación nueva',
      desc: 'El primer turno de una conversación: no hay historial, pero el prompt de sistema de la app es el mismo para todos.',
      steps: [
        { from: 'apps', to: 'gateway', kind: 'req', tag: 'POST, 3 300 tokens', ms: 30, title: 'Primer mensaje', text: '3 000 tokens de prompt de sistema y 300 del usuario.' },
        { from: 'gateway', to: 'router', kind: 'req', tag: '', ms: 1, title: 'Al router', text: '' },
        { from: 'router', to: 'prefixidx', kind: 'req', tag: 'match(207 bloques)', ms: 0.3, title: '¿Quién tiene el prompt de sistema?', text: '' },
        { from: 'prefixidx', to: 'router', kind: 'res', tag: '58 de 60 réplicas', ms: 0.3, title: 'Casi todas', text: 'Un prompt de sistema muy usado termina en el KV cache de casi todas las réplicas. Ese acierto no distingue a nadie.' },
        { at: 'router', kind: 'info', ms: 0.1, title: 'Desempata por carga', text: 'Entre las que tienen los 3 000 tokens, elige la menos cargada. Si dos empatan, una al azar entre dos (power of two choices).' },
        { from: 'router', to: 'r1', kind: 'req', tag: 'generate', ms: 0.5, title: 'Va a la réplica 1', text: '' },
        { at: 'r1', kind: 'info', ms: 25, title: 'Prefill de 300 tokens', text: 'Desde ahora, la réplica 1 es la que tiene el historial de esta conversación: el próximo turno debería volver acá.' },
        { from: 'r1', to: 'router', kind: 'res', tag: 'tokens', ms: 0.5, title: 'Primer token', text: '' },
        { from: 'router', to: 'gateway', kind: 'res', tag: 'tokens', ms: 0.5, title: 'Stream', text: '' },
        { from: 'gateway', to: 'apps', kind: 'res', tag: 'SSE', ms: 30, title: 'Respuesta', text: '' }
      ]
    },
    {
      id: 'caliente', title: 'Un prefijo caliente desborda',
      desc: 'Un cliente de la API manda 40 requests por segundo con el mismo documento de 20 000 tokens. Si todas fueran a la réplica que lo tiene, la saturarían.',
      steps: [
        { from: 'apps', to: 'gateway', kind: 'req', tag: '40 por segundo', ms: 30, title: 'Ráfaga con el mismo prefijo', text: 'Un pipeline que hace preguntas distintas sobre el mismo contrato de 20 000 tokens.' },
        { from: 'gateway', to: 'router', kind: 'req', tag: '', ms: 1, title: 'Al router', text: '' },
        { from: 'router', to: 'prefixidx', kind: 'req', tag: 'match', ms: 0.3, title: '¿Quién tiene el documento?', text: '' },
        { from: 'prefixidx', to: 'router', kind: 'res', tag: 'solo r1', ms: 0.3, title: 'Solo la réplica 1', text: '' },
        { from: 'router', to: 'r1', kind: 'req', tag: 'las primeras', ms: 0.5, title: 'Las primeras van a la réplica 1', text: 'Cada una ahorra 1.4 s de prefill. Pero la carga de la réplica 1 sube de 38 a 49 en dos segundos.' },
        { at: 'router', kind: 'info', ms: 0.1, title: 'La réplica 1 pasa el techo', text: 'Con 49 requests y un techo de 48.5, deja de ser candidata, aunque tenga el prefijo. Sin ese techo, el router la saturaría: es el error del hash por prefijo en el simulador.' },
        { from: 'router', to: 'r2', kind: 'req', tag: 'la siguiente', ms: 0.5, title: 'La siguiente va a la réplica 2', text: 'Paga 1.4 s de prefill una vez y queda con el documento en su KV cache.' },
        { from: 'r2', to: 'prefixidx', kind: 'async', tag: 'guardados: 1 250 bloques', ms: 50, title: 'Ahora hay dos réplicas con el documento', text: 'Las requests siguientes se reparten entre la 1 y la 2. Si la tasa sigue subiendo, se suma una tercera: el prefijo se replica en tantas réplicas como su tráfico pida.' }
      ]
    },
    {
      id: 'pico', title: 'Pico de tráfico y autoscaling',
      desc: 'El tráfico sube un 3 % por minuto. El autoscaler lo ve en las métricas, pero las réplicas nuevas tardan minutos en estar listas.',
      steps: [
        { from: 'r1', to: 'autoscaler', kind: 'async', tag: 'kv_cache_usage: 0.92', ms: 15000, title: 'Las métricas suben', text: 'El uso de KV cache promedio llega al 92&#8239;%, con 6 requests en cola por réplica. La utilización de la GPU estaba alta desde antes: no avisaba nada.' },
        { at: 'autoscaler', kind: 'info', ms: 1, title: 'Calcula cuántas réplicas', text: 'ceil(60 × 0.92 / 0.75) = 74. Pide 14 más.' },
        { from: 'autoscaler', to: 'k8s', kind: 'req', tag: 'replicas: 74', ms: 50, title: 'Pide 14 réplicas', text: '' },
        { at: 'k8s', kind: 'info', ms: 1000, title: 'No hay nodos libres', text: 'Las réplicas nuevas quedan pendientes. El autoscaler de nodos pide 14 nodos de 4 GPUs.' },
        { from: 'k8s', to: 'cloud', kind: 'req', tag: '14 nodos GPU', ms: 1000, title: 'Pide nodos a la nube', text: '' },
        { from: 'cloud', to: 'k8s', kind: 'res', tag: 'nodos listos', ms: 300000, title: 'Cinco minutos después', text: 'Si hay capacidad. En un pico de toda la región, puede no haberla.' },
        { from: 'k8s', to: 'rnew', kind: 'req', tag: 'crear pod', ms: 90000, title: 'Arranca el pod', text: 'Baja la imagen del contenedor: unos 90 s si no estaba en el nodo.' },
        { from: 'rnew', to: 'weights', kind: 'req', tag: 'leer 141 GB', ms: 500, title: 'Carga los pesos', text: '' },
        { from: 'weights', to: 'rnew', kind: 'res', tag: '2 GB/s', ms: 70000, title: '70 segundos de pesos', text: 'Con el model streamer, la lectura y la copia a la GPU se solapan.' },
        { at: 'rnew', kind: 'info', ms: 60000, title: 'Inicializa el motor', text: 'Perfila la memoria, reserva el KV cache y captura los CUDA graphs. Recién entonces la readiness probe responde 200.' },
        { from: 'router', to: 'rnew', kind: 'req', tag: 'primeras requests', ms: 0.5, title: 'Unos 8.7 minutos después del pedido', text: 'Con un 3&#8239;% por minuto, mientras tanto la demanda creció un 29&#8239;%. Lo que no cubrió el colchón se pagó con cola, TTFT alto y 503 para el tráfico de menor prioridad.' }
      ]
    },
    {
      id: 'cae-replica', title: 'Muere una réplica a mitad del decode',
      desc: 'La réplica 2 lleva 212 tokens de una respuesta y una GPU falla. El usuario no debería ver un error.',
      steps: [
        { at: 'r2', kind: 'fail', ms: 0, down: ['r2'], title: 'Falla una GPU de la réplica 2', text: 'Con tensor parallelism, la réplica entera se detiene. Tenía 44 streams abiertos.' },
        { from: 'r2', to: 'router', kind: 'fail', tag: 'stream cortado', ms: 1, title: 'El router ve 44 streams cortados', text: 'De cada uno conoce el prompt y los tokens que ya mandó al cliente: los fue reenviando él.' },
        { from: 'router', to: 'prefixidx', kind: 'req', tag: 'olvidar r2', ms: 0.3, title: 'Saca la réplica 2 del índice', text: 'Su KV cache se perdió: ningún prompt tiene que ir a buscarlo ahí.' },
        { from: 'router', to: 'r1', kind: 'req', tag: 'prompt + 212 tokens', ms: 0.5, title: 'Continúa en otra réplica', text: 'Manda el prompt original más los 212 tokens ya generados, como si fueran el comienzo de la respuesta, con <code>max_tokens</code> reducido en 212.' },
        { at: 'r1', kind: 'info', ms: 600, title: 'Prefill de todo', text: '8 700 tokens: unos 0.6 s. Los 44 streams se reparten entre varias réplicas para no cargar a una sola.' },
        { from: 'r1', to: 'router', kind: 'res', tag: 'token 213…', ms: 0.5, title: 'Sigue generando', text: 'Con temperatura mayor que 0, el resto de la respuesta no es el que habría salido en la réplica 2, pero es coherente con lo ya enviado.' },
        { from: 'router', to: 'gateway', kind: 'res', tag: 'tokens', ms: 0.5, title: 'El mismo stream', text: '' },
        { from: 'gateway', to: 'apps', kind: 'res', tag: 'SSE', ms: 30, title: 'El usuario ve una pausa de un segundo', text: 'No un error. La facturación cuenta los tokens que el cliente recibió, no los que se recalcularon.' },
        { at: 'k8s', kind: 'info', ms: 5000, title: 'Kubernetes reemplaza el pod', text: 'En otro nodo; la réplica nueva arranca vacía.' }
      ]
    },
    {
      id: 'spot', title: 'Aviso de interrupción spot',
      desc: 'La nube va a recuperar el nodo de la réplica spot en dos minutos. Hay que drenarla sin cortar respuestas.',
      steps: [
        { from: 'cloud', to: 'rspot', kind: 'async', tag: 'aviso: 2 min', ms: 1000, title: 'Llega el aviso', text: 'El agente del nodo consulta el servicio de metadatos cada pocos segundos y lo ve.' },
        { at: 'rspot', kind: 'info', ms: 100, title: 'Se marca como drenando', text: 'La readiness probe pasa a fallar a propósito.' },
        { from: 'rspot', to: 'router', kind: 'res', tag: 'drenando', ms: 500, title: 'El router deja de mandarle requests', text: 'Las que están en curso siguen.' },
        { from: 'router', to: 'prefixidx', kind: 'req', tag: 'olvidar rspot', ms: 0.3, title: 'La saca del índice de prefijos', text: 'Para que ninguna request la elija por lo que tiene en su KV cache.' },
        { at: 'rspot', kind: 'info', ms: 90000, title: 'Terminan las respuestas cortas', text: 'La mayoría dura menos de 30 s. A los 110 segundos quedan 3 streams largos, de agentes que generan código.' },
        { from: 'router', to: 'r1', kind: 'req', tag: 'prompt + generados', ms: 0.5, title: 'Continúa los 3 en otra réplica', text: 'Igual que cuando una réplica muere, pero con tiempo: sin pausa visible si se hace antes del corte.' },
        { from: 'r1', to: 'router', kind: 'res', tag: 'tokens', ms: 600, title: 'Siguen en la réplica 1', text: '' },
        { at: 'rspot', kind: 'fail', ms: 10000, down: ['rspot'], title: 'La nube apaga el nodo', text: 'Nada se cortó. Sin drenaje, con el periodo de gracia por defecto de Kubernetes (30 s), esos 3 streams se habrían perdido.' },
        { from: 'autoscaler', to: 'k8s', kind: 'req', tag: 'reponer', ms: 50, title: 'Se repone la capacidad', text: 'Con otro nodo spot si hay, o por demanda si no.' }
      ]
    },
    {
      id: 'region', title: 'Cae la región B',
      desc: 'Todo su tráfico llega a esta región, que estaba al 70 %. No alcanza para todos: se protege al tráfico pago.',
      steps: [
        { at: 'regionb', kind: 'fail', ms: 0, down: ['regionb'], title: 'La región B no responde', text: 'El DNS global la saca y su tráfico llega a la región A.' },
        { from: 'apps', to: 'gateway', kind: 'req', tag: '+100 %', ms: 30, title: 'El doble de requests', text: 'La región A estaba al 70&#8239;%: ahora le llega el 140&#8239;% de su capacidad.' },
        { at: 'gateway', kind: 'info', ms: 1, title: 'Admission control por prioridad', text: 'El tráfico pago (60&#8239;% del total, el 84&#8239;% de la capacidad) entra siempre. El gratuito se manda al modelo de respaldo, y lo que no entra ni ahí recibe 503 con <code>Retry-After</code>.' },
        { from: 'gateway', to: 'router', kind: 'req', tag: 'pago', ms: 1, title: 'Las requests pagas siguen su camino', text: '' },
        { from: 'router', to: 'r1', kind: 'req', tag: 'generate', ms: 0.5, title: 'Al pool del 70B', text: 'Sin su KV cache: las conversaciones que venían de B pagan el prefill completo en su primer turno aquí.' },
        { from: 'router', to: 'small', kind: 'req', tag: 'gratuito', ms: 0.5, title: 'El gratuito, al 8B', text: 'Más rápido y más barato. La respuesta dice qué modelo contestó.' },
        { from: 'small', to: 'router', kind: 'res', tag: 'tokens', ms: 0.5, title: 'Respuesta degradada, no error', text: '' },
        { from: 'autoscaler', to: 'k8s', kind: 'req', tag: 'replicas: 112', ms: 50, title: 'El autoscaler pide más', text: 'Llegarán en minutos, si la nube tiene GPUs. Mientras tanto, el recorte sostiene el servicio pago.' }
      ]
    },
    {
      id: 'canary', title: 'Canary de una versión nueva',
      desc: 'Una versión nueva de los pesos entra al registry. Empieza con el 5 % del tráfico y solo sube si sus métricas no empeoran.',
      steps: [
        { from: 'registry', to: 'deploy', kind: 'req', tag: 'v2025-10-07: staged', ms: 100, title: 'Se registra la versión nueva', text: 'Con su URI de pesos, su sha256, su configuración de serving y los resultados de las evaluaciones offline.' },
        { at: 'deploy', kind: 'info', ms: 1, title: 'Arranca réplicas con la versión nueva', text: 'La versión anterior sigue corriendo entera: el rollback no necesita redeploy.' },
        { from: 'rnew', to: 'weights', kind: 'req', tag: 'pesos v2025-10-07', ms: 70000, title: 'La réplica nueva carga los pesos', text: 'Y verifica el checksum contra el registry antes de declararse lista.' },
        { from: 'deploy', to: 'router', kind: 'async', tag: 'rutas: 95 / 5', ms: 200, title: 'Publica la tabla de rutas', text: '' },
        { from: 'apps', to: 'gateway', kind: 'req', tag: 'POST', ms: 30, title: 'Llega una request', text: '' },
        { from: 'gateway', to: 'router', kind: 'req', tag: 'org_51', ms: 1, title: 'Al router', text: '' },
        { at: 'router', kind: 'info', ms: 0.1, title: '¿Qué versión le toca?', text: 'hash(organización) mod 100 &lt; 5: la versión nueva. Por organización y no por request, para que una conversación no cambie de modelo entre turnos.' },
        { from: 'router', to: 'rnew', kind: 'req', tag: 'v2025-10-07', ms: 0.5, title: 'A la réplica nueva', text: '' },
        { from: 'rnew', to: 'router', kind: 'res', tag: 'tokens', ms: 30, title: 'Respuesta', text: '' },
        { at: 'deploy', kind: 'info', ms: 3600000, title: 'Compara antes de subir', text: 'Errores, TTFT, TPOT, largo de las respuestas y evaluaciones online de calidad, contra la versión estable. Si algo empeora, la tabla vuelve a 100 / 0 en segundos.' }
      ]
    }
  ]
});
