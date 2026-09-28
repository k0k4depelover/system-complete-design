/* Mapa del M04: arquitectura de caché de dos niveles con invalidación por CDC. */
SD.defineMap('m04-cache', {
  title: 'Caché de dos niveles con invalidación',
  intro: 'Un servicio de catálogo de productos con 20 instancias: caché local en cada proceso, Redis compartido con réplica, PostgreSQL como fuente de verdad e invalidación por eventos de cambio (CDC).',
  start: 'users',
  groups: [
    { id: 'g-app', label: 'Servicio de catálogo (20 instancias)', x: 280, y: 60, w: 520, h: 420 },
    { id: 'g-cache', label: 'Clúster de Redis', x: 880, y: 60, w: 300, h: 300 },
    { id: 'g-data', label: 'Datos', x: 880, y: 400, w: 640, h: 200 }
  ],
  nodes: [
    { id: 'users', layer: 'client', label: 'Usuarios', sub: 'app y web', x: 130, y: 250,
      info: {
        resp: '<p>Miles de usuarios consultando fichas de productos. El 1&#8239;% de los productos recibe más del 50&#8239;% de las visitas (una distribución de Zipf típica): eso hace que la caché funcione muy bien y también que existan claves calientes.</p>',
        api: '<pre data-lang="http"><code>GET /v1/productos/sku_4471\n→ 200 OK\nCache-Control: public, max-age=30\nETag: "p4471-v12"</code></pre>',
        data: '<p>La caché del navegador o de la app guarda la respuesta 30 s. Con el ETag, al vencer puede preguntar "¿cambió?" y recibir un 304 sin cuerpo.</p>',
        fail: '<p>Si el backend responde lento, la app muestra la versión en caché con un aviso ("actualizado hace 1 min") en lugar de una pantalla vacía: <code>stale-while-revalidate</code> aplicado en el cliente.</p>',
        nums: '<ul><li>80&#8239;000 requests/s en pico hacia el catálogo.</li><li>Un 30 a 50&#8239;% se resuelve antes de llegar al servicio (navegador y CDN).</li></ul>'
      } },
    { id: 'app', layer: 'service', label: 'Instancia de catálogo', sub: 'una de 20', x: 420, y: 170,
      info: {
        resp: '<p>Resuelve cada lectura en tres niveles, del más barato al más caro: caché local del proceso, Redis compartido y, por último, PostgreSQL. Aplica <b>cache-aside</b>: la aplicación decide cuándo leer y escribir en la caché.</p>',
        api: '<pre><code>function getProducto(sku):\n  v = l1.get(sku)                      # ~100 ns\n  if v: return v\n  v = redis.get("prod:" + sku)         # ~0.5 ms\n  if v: l1.set(sku, v, ttl=5s); return v\n  v = singleflight("prod:" + sku, () =&gt;  # una sola consulta por instancia\n        db.query(SELECT_PRODUCTO, sku))  # ~5 ms\n  redis.set("prod:" + sku, v, ex=300 + rand(0, 60))   # TTL con jitter\n  l1.set(sku, v, ttl=5s)\n  return v</code></pre>',
        data: '<p>No guarda estado propio más allá de la caché local, que es desechable: si la instancia se reinicia, arranca fría y se llena en segundos desde Redis.</p>',
        fail: '<ul><li><b>Redis lento o caído:</b> timeout de 20 ms y circuit breaker hacia Redis; las lecturas caen a la base con load shedding para no tumbarla.</li><li><b>Caché local desactualizada:</b> hasta 5 s de datos viejos en cada instancia. Es el precio de no ir a la red.</li></ul>',
        nums: '<ul><li>80&#8239;000 lecturas/s repartidas en 20 instancias: 4&#8239;000/s cada una.</li><li>Tasa de acierto combinada objetivo: 99&#8239;% (L1 ~70&#8239;%, Redis ~29&#8239;%, base ~1&#8239;%).</li></ul>'
      } },
    { id: 'l1', layer: 'cache', label: 'Caché local (L1)', sub: 'en memoria del proceso', x: 420, y: 380,
      info: {
        resp: '<p>Un mapa en memoria dentro del propio proceso (por ejemplo, Caffeine en Java), con capacidad limitada y TTL corto. Es la única caché sin ida y vuelta de red, y la mejor defensa contra las claves calientes: una clave pedida 100&#8239;000 veces por segundo se sirve desde 20 memorias locales en lugar de un solo shard de Redis.</p>',
        api: '<pre><code>l1 = Cache(max_entries=50_000, ttl=5s, policy=W-TinyLFU)\nl1.get(sku) / l1.set(sku, valor) / l1.invalidate(sku)</code></pre>',
        data: '<div class="table-wrap"><table class="t"><thead><tr><th>Clave</th><th>Valor</th><th>TTL</th></tr></thead><tbody><tr><td><code>sku_4471</code></td><td>objeto producto deserializado</td><td>5 s</td></tr></tbody></table></div><p>Guarda objetos ya deserializados: ahorra también la CPU de parsear JSON.</p>',
        fail: '<ul><li><b>Inconsistencia entre instancias:</b> cada una tiene su copia y pueden mostrar precios distintos durante unos segundos. Por eso el TTL es corto y la invalidación por evento también llega a la L1.</li><li><b>Presión de memoria:</b> una L1 demasiado grande provoca pausas de GC que hacen lenta a toda la instancia.</li></ul>',
        nums: '<ul><li>Lectura: ~100 ns.</li><li>50&#8239;000 entradas × 2 kB ≈ 100 MB por instancia.</li></ul>'
      } },
    { id: 'redis', layer: 'cache', label: 'Redis primario', sub: 'shard 1 de 6', x: 1030, y: 170,
      info: {
        resp: '<p>La caché compartida por todas las instancias. En Redis Cluster el espacio de claves se divide en 16&#8239;384 <em>hash slots</em> repartidos entre los shards; cada clave cae en un slot según el CRC16 de su nombre.</p>',
        api: '<pre><code>GET prod:sku_4471\nSET prod:sku_4471 &lt;json&gt; EX 342 NX\nDEL prod:sku_4471                 # invalidación\nMGET {user:77}:cart {user:77}:prefs   # las llaves {…} fuerzan el mismo slot</code></pre>',
        data: '<div class="table-wrap"><table class="t"><thead><tr><th>Clave</th><th>Tipo</th><th>TTL</th></tr></thead><tbody><tr><td><code>prod:{sku}</code></td><td>string (JSON)</td><td>300 s + jitter de 0 a 60 s</td></tr><tr><td><code>lock:prod:{sku}</code></td><td>string</td><td>2 s (lease para recalcular)</td></tr></tbody></table></div><p>Política de evicción <code>allkeys-lfu</code>: cuando se llena, expulsa lo que menos se usa.</p>',
        fail: '<ul><li><b>Shard caído:</b> la réplica se promueve en segundos, pero la replicación de Redis es asíncrona: las últimas escrituras pueden perderse. En una caché eso es aceptable; en una fuente de verdad, no.</li><li><b>Clave caliente:</b> todo su tráfico va a un solo shard, con un solo hilo de ejecución. Se mitiga con la L1 o replicando la clave con sufijos (<code>prod:sku:1</code> … <code>:8</code>).</li></ul>',
        nums: '<ul><li>~0.3–0.5 ms dentro de la zona.</li><li>~100&#8239;000 ops/s por shard; 6 shards.</li></ul>'
      } },
    { id: 'replica', layer: 'cache', label: 'Réplica de Redis', sub: 'otra zona', x: 1030, y: 300,
      info: {
        resp: '<p>Copia asíncrona del primario en otra zona de disponibilidad. Sirve para failover y, opcionalmente, para repartir lecturas.</p>',
        api: '<p>Replica el flujo de comandos del primario. Leer de la réplica (<code>READONLY</code> en Cluster) puede devolver datos un poco más viejos.</p>',
        data: '<p>Las mismas claves que el primario, con un pequeño retraso.</p>',
        fail: '<p>Si el primario cae, Redis Cluster (o Sentinel) la promueve. Durante esos segundos, las escrituras a ese shard fallan y las lecturas pueden fallar si el cliente solo lee del primario.</p>',
        nums: '<ul><li>Retraso de replicación: normalmente milisegundos.</li><li>Failover: del orden de segundos a decenas de segundos según la configuración.</li></ul>'
      } },
    { id: 'db', layer: 'db', label: 'PostgreSQL', sub: 'fuente de verdad', x: 1030, y: 520,
      info: {
        resp: '<p>Guarda el catálogo real. Está dimensionada para el ~1&#8239;% de lecturas que no resuelve la caché más todas las escrituras, no para el tráfico total. Esa es la suposición que convierte una caída de caché en una caída de la base.</p>',
        api: '<pre data-lang="sql"><code>SELECT sku, nombre, precio_centavos, moneda, stock, version\nFROM productos WHERE sku = $1;\n\nUPDATE productos SET precio_centavos = $2, version = version + 1\nWHERE sku = $1;</code></pre>',
        data: '<pre data-lang="sql"><code>CREATE TABLE productos (\n  sku              text PRIMARY KEY,\n  nombre           text NOT NULL,\n  precio_centavos  bigint NOT NULL,\n  moneda           char(3) NOT NULL,\n  stock            integer NOT NULL,\n  version          bigint NOT NULL DEFAULT 1,\n  actualizado_en   timestamptz NOT NULL DEFAULT now()\n);</code></pre>',
        fail: '<ul><li><b>Si la caché cae:</b> recibe 100 veces más lecturas. Sin protección, sus conexiones se agotan y cae también. Defensas: load shedding en la aplicación, límite de concurrencia hacia la base y réplicas de lectura con capacidad de reserva.</li></ul>',
        nums: '<ul><li>Capacidad cómoda: ~5&#8239;000 lecturas/s; tráfico normal: ~800/s.</li><li>Sin caché: 80&#8239;000/s. No hay base que aguante eso sin haberlo planeado.</li></ul>'
      } },
    { id: 'cdc', layer: 'queue', label: 'CDC + Kafka', sub: 'Debezium, tópico productos', x: 1360, y: 520,
      info: {
        resp: '<p>Lee el log de escritura de PostgreSQL (WAL) y publica cada cambio como un evento. Así la invalidación no depende de que cada servicio que escribe se acuerde de borrar la caché: cualquier cambio en la tabla genera su evento, incluso un <code>UPDATE</code> manual.</p>',
        api: '<pre data-lang="json"><code>{\n  "op": "u",\n  "table": "productos",\n  "key": { "sku": "sku_4471" },\n  "after": { "precio_centavos": 12900, "version": 13 },\n  "ts_ms": 1790546412000\n}</code></pre>',
        data: '<p>Tópico <code>db.productos</code> particionado por <code>sku</code>: los cambios de un mismo producto llegan en orden (M07).</p>',
        fail: '<ul><li><b>El consumidor se atrasa:</b> las invalidaciones llegan tarde y la caché sirve datos viejos más tiempo. El TTL es la red de seguridad: nada vive más de 6 minutos aunque se pierda un evento.</li></ul>',
        nums: '<ul><li>Retraso típico desde el commit hasta el evento: decenas a cientos de ms.</li></ul>'
      } },
    { id: 'invalidator', layer: 'service', label: 'Invalidador', sub: 'consumidor de eventos', x: 1360, y: 300,
      info: {
        resp: '<p>Consume los eventos de cambio y borra la clave en Redis. Además publica un mensaje en un canal pub/sub de Redis para que las 20 instancias borren su copia en la L1.</p>',
        api: '<pre><code>on event(productos, key.sku, after.version):\n  redis.DEL("prod:" + sku)\n  redis.PUBLISH("invalidar", sku)        # las instancias limpian su L1</code></pre>',
        data: '<p>Guarda el offset de Kafka procesado. Si se reinicia, reprocesa desde ahí: borrar una clave dos veces no hace daño (la invalidación es idempotente).</p>',
        fail: '<p>Borrar en lugar de escribir el valor nuevo evita una carrera: si dos eventos se procesan desordenados, un <code>SET</code> podría dejar el valor viejo; un <code>DEL</code> siempre obliga a releer la fuente de verdad.</p>',
        nums: '<ul><li>Miles de invalidaciones por segundo por consumidor.</li></ul>'
      } },
    { id: 'writer', layer: 'service', label: 'Admin de catálogo', sub: 'cambia precios', x: 420, y: 560,
      info: {
        resp: '<p>El sistema interno donde el equipo comercial cambia precios y stock. Escribe solo en PostgreSQL: no toca la caché.</p>',
        api: '<pre data-lang="http"><code>PATCH /v1/productos/sku_4471\nIf-Match: "p4471-v12"\n\n{"precio_centavos": 12900}</code></pre>',
        data: '<p>Ninguno propio.</p>',
        fail: '<p>Si también escribiera en la caché, dos admins guardando casi a la vez podrían dejar en caché el valor que perdió en la base. Por eso la escritura va solo a la fuente de verdad y la caché se invalida desde el log.</p>',
        nums: '<ul><li>Decenas de escrituras por segundo: el catálogo se lee 4&#8239;000 veces más de lo que se escribe.</li></ul>'
      } }
  ],
  edges: [
    { id: 'e1', from: 'users', to: 'app', both: true, label: 'GET /productos' },
    { id: 'e2', from: 'app', to: 'l1', both: true },
    { id: 'e3', from: 'app', to: 'redis', both: true },
    { id: 'e4', from: 'redis', to: 'replica', async: true, label: 'replicación' },
    { id: 'e5', from: 'app', to: 'db', both: true, bend: -60 },
    { id: 'e6', from: 'writer', to: 'db', both: true, label: 'UPDATE' },
    { id: 'e7', from: 'db', to: 'cdc', async: true, label: 'WAL' },
    { id: 'e8', from: 'cdc', to: 'invalidator', async: true },
    { id: 'e9', from: 'invalidator', to: 'redis', label: 'DEL + PUBLISH' },
    { id: 'e10', from: 'redis', to: 'l1', async: true, bend: 40, label: 'pub/sub' }
  ],
  scenarios: [
    {
      id: 'hit', title: 'Acierto en la caché local',
      desc: 'El caso del 70 % de las lecturas: la respuesta está en la memoria del propio proceso.',
      steps: [
        { from: 'users', to: 'app', kind: 'req', tag: 'GET sku_4471', ms: 20, title: 'Llega la request', text: 'El producto más visto del día.' },
        { from: 'app', to: 'l1', kind: 'req', tag: 'get', ms: 0.0001, title: 'Busca en la L1', text: 'Un acceso a un mapa en memoria: unos 100 ns.' },
        { from: 'l1', to: 'app', kind: 'res', tag: 'HIT', ms: 0.0001, title: 'Acierto', text: 'El objeto ya está deserializado. Ni red ni parseo.' },
        { from: 'app', to: 'users', kind: 'res', tag: '200', ms: 20, title: 'Respuesta', text: 'Todo el tiempo fue red hacia el usuario; el servidor trabajó microsegundos.' }
      ]
    },
    {
      id: 'miss', title: 'Miss y cache-aside',
      desc: 'El producto no está en ninguna caché: se lee de la base y se llenan los dos niveles.',
      steps: [
        { from: 'users', to: 'app', kind: 'req', tag: 'GET sku_9102', ms: 20, title: 'Producto poco visitado', text: 'Está en la cola larga de la distribución: nadie lo pidió en los últimos minutos.' },
        { from: 'app', to: 'l1', kind: 'req', tag: 'get', ms: 0.0001, title: 'L1: miss', text: '' },
        { from: 'app', to: 'redis', kind: 'req', tag: 'GET prod:sku_9102', ms: 0.3, title: 'Redis', text: '' },
        { from: 'redis', to: 'app', kind: 'res', tag: 'nil', ms: 0.3, title: 'Redis: miss', text: 'Tampoco está: venció o fue expulsada por la política LFU.' },
        { from: 'app', to: 'db', kind: 'req', tag: 'SELECT', ms: 0.5, title: 'Consulta la fuente de verdad', text: 'A través de single-flight: si otra request de esta instancia ya está consultando el mismo SKU, espera ese resultado en lugar de lanzar otra consulta.' },
        { from: 'db', to: 'app', kind: 'res', tag: 'fila', ms: 4, title: 'La base responde', text: '' },
        { from: 'app', to: 'redis', kind: 'req', tag: 'SET EX 342', ms: 0.3, title: 'Llena Redis con TTL y jitter', text: 'TTL base de 300 s más un valor aleatorio de 0 a 60 s, para que las claves que se llenaron juntas no venzan juntas.' },
        { from: 'app', to: 'l1', kind: 'req', tag: 'set 5 s', ms: 0.0001, title: 'Llena la L1', text: '' },
        { from: 'app', to: 'users', kind: 'res', tag: '200', ms: 20, title: 'Respuesta', text: 'Unos 5 ms más que un acierto. La siguiente request de cualquier instancia lo encontrará en Redis.' }
      ]
    },
    {
      id: 'invalidacion', title: 'Cambio de precio e invalidación',
      desc: 'Alguien cambia un precio. ¿Cómo se enteran Redis y las 20 cachés locales, sin que el que escribe tenga que acordarse?',
      steps: [
        { from: 'writer', to: 'db', kind: 'req', tag: 'UPDATE precio', ms: 3, title: 'Se actualiza el precio en la base', text: 'Con control optimista: <code>WHERE version = 12</code>. Solo se escribe en la fuente de verdad.' },
        { from: 'db', to: 'cdc', kind: 'async', tag: 'WAL', ms: 80, title: 'CDC lee el cambio del log', text: 'Debezium lee el WAL de PostgreSQL y publica el evento en Kafka. No hace falta tocar el código de quien escribe.' },
        { from: 'cdc', to: 'invalidator', kind: 'async', tag: 'evento', ms: 10, title: 'El invalidador consume el evento', text: '', code: '{"op": "u", "key": {"sku": "sku_4471"}, "after": {"precio_centavos": 12900, "version": 13}}', lang: 'json' },
        { from: 'invalidator', to: 'redis', kind: 'req', tag: 'DEL', ms: 0.5, title: 'Borra la clave en Redis', text: 'Borrar y no escribir el valor nuevo: si los eventos llegaran desordenados, un SET podría dejar el precio viejo.' },
        { from: 'redis', to: 'l1', kind: 'async', tag: 'PUBLISH invalidar', ms: 1, title: 'Aviso a las 20 instancias', text: 'Cada instancia está suscrita al canal y borra el SKU de su L1. Si alguna se pierde el mensaje (pub/sub de Redis no guarda nada), el TTL de 5 s la corrige.' },
        { from: 'users', to: 'app', kind: 'req', tag: 'GET sku_4471', ms: 20, title: 'La próxima lectura', text: '' },
        { from: 'app', to: 'db', kind: 'req', tag: 'SELECT', ms: 4, title: 'Miss en ambos niveles: relee la base', text: 'Ve el precio nuevo. En total, el cambio tardó ~100 ms en ser visible, sin coordinación entre quien escribe y quien cachea.' },
        { from: 'db', to: 'app', kind: 'res', tag: 'precio nuevo', ms: 1, title: 'Precio nuevo', text: '' },
        { from: 'app', to: 'users', kind: 'res', tag: '200', ms: 20, title: 'El usuario ve el precio correcto', text: '' }
      ]
    },
    {
      id: 'estampida', title: 'Estampida sobre una clave caliente',
      desc: 'La clave del producto más visto vence en Redis. 20 instancias con miles de requests por segundo la piden en el mismo instante.',
      steps: [
        { at: 'redis', kind: 'fail', ms: 0, title: 'Vence prod:sku_4471', text: 'Recibe 40 000 lecturas por segundo. Durante los 5 ms que tarda en recalcularse, llegan ~200 requests que no la encuentran.' },
        { from: 'app', to: 'redis', kind: 'req', tag: 'GET ×200', ms: 0.3, title: 'Todas fallan a la vez', text: '' },
        { from: 'redis', to: 'app', kind: 'res', tag: 'nil ×200', ms: 0.3, title: 'Miss masivo', text: 'Sin protección, cada una de las 200 iría a la base con la misma consulta.' },
        { at: 'app', kind: 'info', ms: 0.1, title: 'Single-flight en cada instancia', text: 'Dentro de cada proceso, solo la primera request consulta; las demás esperan ese resultado. Pasamos de 200 consultas a 20 (una por instancia).' },
        { from: 'app', to: 'redis', kind: 'req', tag: 'SET lock NX PX 2000', ms: 0.3, title: 'Lease distribuido', text: 'Además, cada instancia intenta tomar un lease en Redis. Solo una lo consigue; las otras 19 esperan unos ms y vuelven a leer (o sirven el valor viejo si lo guardaron con un margen extra).' },
        { from: 'app', to: 'db', kind: 'req', tag: '1 SELECT', ms: 0.5, title: 'Una sola consulta a la base', text: 'De 200 consultas posibles a 1.' },
        { from: 'db', to: 'app', kind: 'res', tag: 'fila', ms: 4, title: 'Resultado', text: '' },
        { from: 'app', to: 'redis', kind: 'req', tag: 'SET EX 342', ms: 0.3, title: 'Se repone la clave', text: 'Las instancias que esperaban la encuentran. La mejor defensa es que esto no ocurra: con expiración anticipada probabilística, alguna request recalcula la clave antes de que venza (sección 4.4).' }
      ]
    },
    {
      id: 'redis-cae', title: 'Cae el shard de Redis',
      desc: 'El primario del shard 1 muere. Mira el orden de las defensas: timeout, circuit breaker, L1 y load shedding.',
      down: [],
      steps: [
        { at: 'redis', kind: 'fail', ms: 0, down: ['redis'], title: 'El primario del shard 1 muere', text: 'Una sexta parte de las claves queda inaccesible hasta que se promueva la réplica.' },
        { from: 'app', to: 'redis', kind: 'fail', tag: 'GET ✕ 20 ms', ms: 20, title: 'Timeouts de 20 ms', text: 'Un timeout corto limita el daño: sin él, cada request quedaría colgada segundos y se agotarían los hilos.' },
        { at: 'app', kind: 'info', ms: 0.1, title: 'Se abre el circuit breaker', text: 'Tras varios timeouts seguidos, el cliente deja de llamar al shard durante 5 s y falla de inmediato: las requests ya no pagan los 20 ms.' },
        { from: 'app', to: 'l1', kind: 'req', tag: 'get', ms: 0.0001, title: 'La L1 absorbe lo caliente', text: 'Los productos más vistos siguen en las cachés locales: el 70 % del tráfico ni se entera.' },
        { from: 'app', to: 'db', kind: 'req', tag: 'SELECT ×N', ms: 0.5, title: 'El resto va a la base, con límite', text: 'La instancia permite como máximo 30 consultas concurrentes a la base. Lo que excede se rechaza rápido con 503 (load shedding) en lugar de hacer cola.' },
        { from: 'db', to: 'app', kind: 'res', tag: 'lento', ms: 12, title: 'La base sube de 800 a 4 000 lecturas/s', text: 'Está cerca de su límite pero no lo cruza, gracias al límite de concurrencia.' },
        { at: 'replica', kind: 'info', ms: 0, up: ['redis'], title: 'La réplica se promueve', text: 'Redis Cluster promueve la réplica en segundos. Como la replicación es asíncrona, pueden perderse las últimas escrituras: en una caché solo significa unos misses extra.' },
        { at: 'app', kind: 'info', ms: 0, title: 'El circuit breaker prueba y se cierra', text: 'Deja pasar unas pocas requests de prueba (half-open); al ver que funcionan, vuelve a enviar todo a Redis. Las claves de ese shard se rellenan con el tráfico normal.' }
      ]
    }
  ]
});
