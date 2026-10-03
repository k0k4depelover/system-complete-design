/* Aplicación de conocimiento: índice de mini-proyectos (proyectos.html) y ruta de las guías (proyectos/).
   tier: 'core' (núcleo) | 'extra' (ampliación).
   status: 'proposed' (sin guía) | 'ready' (guía publicada en href).
   repo: el enlace a tu repositorio del proyecto, una vez publicado. Si está vacío, la guía acepta el enlace
     guardado en el navegador. Un proyecto se marca como terminado con el enlace y su lista de comprobación completa.
   repoName: el nombre sugerido para el repositorio. mods: ids de course.data.js.
   Cada proyecto se construye solo, sin código de otro; "Cómo conectar", al final de cada guía, solo nombra
   proyectos anteriores en esta lista. */
window.SD = window.SD || {};
SD.data = SD.data || {};
SD.data.projects = {
  blocks: [
    { id: 'b1', name: 'Bloque 1', items: ['a00', 'a01', 'a02', 'a03', 'a04'], note: 'El laboratorio, Nginx, la API, la caché y las réplicas.' },
    { id: 'b2', name: 'Bloque 2', items: ['a05', 'a06', 'a07'], note: 'Dos primarios, sharding y Kubernetes con k3s.' },
    { id: 'b3', name: 'Bloque 3', items: ['a08', 'a09', 'a10', 'a11', 'a12'], note: 'Líder, colas, resiliencia, archivos y sesiones.' },
    { id: 'b4', name: 'Bloque 4', items: ['a13', 'a14', 'a15', 'a16', 'a17'], note: 'OAuth, observabilidad, idempotencia, búsqueda y geografía.' },
    { id: 'b5', name: 'Bloque 5', items: ['a18', 'a19', 'a20', 'a21', 'a22'], note: 'Kafka, entrega continua y el ChatGPT en una CPU.' },
    { id: 'b6', name: 'Bloque 6', items: ['c1', 'c2'], note: 'Los dos sistemas completos, cada uno en su repositorio.' }
  ],

  tracks: [
    {
      id: 'base', label: 'Base', title: 'El laboratorio', line: '--label-3',
      intro: 'Las piezas y convenciones que repite cada proyecto. No explica cómo crear un proyecto de Spring: fija las versiones, la base de datos y la forma de medir.',
      items: [
        { id: 'a00', num: 'A00', title: 'El laboratorio común', tier: 'core', status: 'ready', href: 'proyectos/a00-laboratorio.html', repo: '', repoName: 'a00-laboratorio', mods: ['m00', 'm05'], front: false,
          excuse: 'Una API de notas, la más chica posible, para fijar lo que repiten todos los proyectos.',
          learn: 'Versiones fijas de Java 25 y Spring Boot 4; PostgreSQL 18 detrás de PgBouncer en un compose; qué rompe el modo transacción de PgBouncer (SET que se filtran, advisory locks de sesión y prepared statements), medido; Flyway directo a PostgreSQL; pruebas con Testcontainers; un workflow de GitHub Actions; y Gatling con una assertion sobre el p99.',
          stack: ['Docker Compose', 'PostgreSQL 18', 'PgBouncer', 'Testcontainers', 'GitHub Actions', 'Gatling'] }
      ]
    },
    {
      id: 'f', label: 'Parte I', title: 'Fundamentos, construidos', line: '--line-p1',
      intro: 'Un proyecto por concepto clave de M01 a M11. Empiezan en Docker Compose y pasan a Kubernetes con k3s cuando el concepto lo pide.',
      items: [
        { id: 'a01', num: 'A01', title: 'Detrás de Nginx', tier: 'core', status: 'ready', href: 'proyectos/a01-nginx.html', repo: '', repoName: 'a01-nginx', mods: ['m01', 'm03'], front: false,
          excuse: 'Un acortador de enlaces con tres réplicas, una de ellas lenta a propósito.',
          learn: 'Reverse proxy con TLS local y HTTP/2, keepalive y timeouts hacia el upstream, cabeceras X-Forwarded-*, round robin contra least_conn con una réplica lenta, fallas pasivas con max_fails y una zona compartida entre workers, reintento en otra réplica y límite de tasa con limit_req. Mides el p99 de cada algoritmo con Gatling.',
          stack: ['Nginx', 'Spring Boot × 3', 'PostgreSQL + PgBouncer', 'Gatling'] },
        { id: 'a02', num: 'A02', title: 'Una API que no se rompe', tier: 'core', status: 'ready', href: 'proyectos/a02-api.html', repo: '', repoName: 'a02-api', mods: ['m02'], front: false,
          excuse: 'El catálogo de una librería con un millón de libros.',
          learn: 'Paginación por cursor contra OFFSET, medida con EXPLAIN ANALYZE; ETag e If-None-Match (304); If-Match para concurrencia optimista (428 y 412); errores con ProblemDetail (RFC 9457); versionado por cabecera con Spring 7, con Deprecation y Sunset; y el contrato en OpenAPI.',
          stack: ['PostgreSQL + PgBouncer', 'springdoc-openapi'] },
        { id: 'a03', num: 'A03', title: 'Caché que aguanta un pico', tier: 'core', status: 'ready', href: 'proyectos/a03-cache.html', repo: '', repoName: 'a03-cache', mods: ['m04'], front: false,
          excuse: 'Una tienda en su día de ofertas: diez productos se llevan ocho de cada diez visitas.',
          learn: 'Cache-aside en dos niveles escrito a mano (Caffeine en cada réplica y Redis compartido), TTL con jitter, cache stampede con un lock SET NX y servir lo vencido, invalidación por Redis Pub/Sub, write-through del precio, y write-behind del contador de visitas, que llega a PostgreSQL en lotes idempotentes aunque la app se caiga a mitad.',
          stack: ['Redis', 'Caffeine', 'PostgreSQL + PgBouncer', 'Gatling'] },
        { id: 'a04', num: 'A04', title: 'Primario y réplicas', tier: 'core', status: 'ready', href: 'proyectos/a04-replicas.html', repo: '', repoName: 'a04-replicas', mods: ['m05'], front: false,
          excuse: 'Una red de bibliotecas: muchas consultas y pocos préstamos.',
          learn: 'Replicación por streaming del WAL con slots, un PgBouncer para escribir y otro para leer, LazyConnectionDataSourceProxy con @Transactional(readOnly = true), el lag que te muestra datos viejos y cómo leer lo que escribiste con el LSN, réplica síncrona contra asíncrona (FIRST contra ANY), la promoción manual con pg_promote() y cómo volver a sumar al viejo primario como réplica con pg_rewind.',
          stack: ['PostgreSQL × 3', 'PgBouncer × 2', 'Docker Compose', 'Gatling'] },
        { id: 'a05', num: 'A05', title: 'Dos primarios', tier: 'core', status: 'ready', href: 'proyectos/a05-dos-primarios.html', repo: '', repoName: 'a05-dos-primarios', mods: ['m05', 'm06'], front: false,
          excuse: 'El inventario de dos sucursales que venden cada una por su lado.',
          learn: 'Replicación lógica en las dos direcciones con origin = none (multi-master), los conflictos que provocas a propósito y cómo los cuenta pg_stat_subscription_stats, la replicación trabada por un choque de clave y ALTER SUBSCRIPTION SKIP, y cómo evitarlos por diseño: cada fila con una sucursal dueña, UUIDv7, transferencias con recibo idempotente y un solo dueño del catálogo.',
          stack: ['PostgreSQL × 2', 'Replicación lógica', 'Testcontainers'] },
        { id: 'a06', num: 'A06', title: 'Repartir los datos', tier: 'core', status: 'ready', href: 'proyectos/a06-sharding.html', repo: '', repoName: 'a06-sharding', mods: ['m05', 'm06'], front: false,
          excuse: 'Los pedidos de una tienda en línea, repartidos por cliente.',
          learn: 'Particiones mensuales con poda por id gracias a UUIDv7, borrar un mes con DETACH en vez de DELETE, sharding en la aplicación con hashing consistente y nodos virtuales, un pool por shard, pasar de dos a tres shards en vivo con doble escritura, backfill y verificación, y consultas que cruzan shards con un plazo y resultados parciales.',
          stack: ['PostgreSQL × 3', 'Hashing consistente', 'Gatling'] },
        { id: 'a07', num: 'A07', title: 'Kubernetes para sistemas distribuidos', tier: 'core', status: 'ready', href: 'proyectos/a07-kubernetes.html', repo: '', repoName: 'a07-kubernetes', mods: ['m03', 'm05', 'm08'], front: false,
          excuse: 'Un servicio de cuentas y sesiones que no puede cortarse cuando lo despliegas.',
          learn: 'Un clúster k3s de tres nodos dentro de Docker con registro local, Deployments y Services, la entrada con Gateway API sobre Traefik, probes y apagado ordenado para desplegar sin errores, HPA, PodDisruptionBudget, y PostgreSQL con CloudNativePG: primario, réplica, failover automático y PgBouncer como Pooler, con los timeouts que acortan el corte.',
          stack: ['k3s', 'Gateway API (Traefik)', 'CloudNativePG', 'PgBouncer', 'Gatling'] },
        { id: 'a08', num: 'A08', title: 'Un solo líder', tier: 'core', status: 'proposed', repo: '', mods: ['m06'], front: false,
          excuse: 'Recordatorios que nunca salen dos veces y nunca se pierden.',
          learn: 'Elección de líder con un Lease de Kubernetes, por qué el lease solo no alcanza (un líder congelado con kill -STOP que despierta creyéndose líder), fencing tokens comprobados en PostgreSQL, trabajos idempotentes, y ShedLock como alternativa simple con su límite.',
          stack: ['k3s', 'Spring Cloud Kubernetes', 'PostgreSQL + PgBouncer'] },
        { id: 'a09', num: 'A09', title: 'Colas y pub/sub', tier: 'core', status: 'proposed', repo: '', mods: ['m07'], front: false,
          excuse: 'Procesar pedidos y avisar por correo.',
          learn: 'Redis Pub/Sub, que pierde lo que nadie escucha, contra Redis Streams con consumer groups: entrega al menos una vez, XACK, XAUTOCLAIM para lo que quedó colgado y una cola de mensajes muertos. Outbox transaccional en PostgreSQL, consumidor idempotente, lag y backpressure. Los correos llegan a Mailpit.',
          stack: ['Redis Streams', 'PostgreSQL + PgBouncer', 'Mailpit'] },
        { id: 'a10', num: 'A10', title: 'Un sistema distribuido con circuit breaker', tier: 'core', status: 'proposed', repo: '', mods: ['m08'], front: false,
          excuse: 'Un comparador de precios que consulta a tres proveedores lentos y poco confiables.',
          learn: 'Timeouts, reintentos con backoff exponencial y jitter, circuit breaker, bulkhead y fallback con Resilience4j, token bucket en Spring Cloud Gateway con Redis, y la tormenta de reintentos. Las fallas se inyectan con Toxiproxy.',
          stack: ['Spring Cloud Gateway', 'Resilience4j', 'Redis', 'Toxiproxy'] },
        { id: 'a11', num: 'A11', title: 'Archivos y URLs firmadas', tier: 'core', status: 'proposed', repo: '', mods: ['m09'], front: true,
          excuse: 'Un álbum de fotos compartido.',
          learn: 'URLs firmadas con HMAC propias para el disco local (vencimiento, método y comparación en tiempo constante), URLs prefirmadas de R2 con el S3Presigner del AWS SDK, subida directa desde el navegador con CORS, multipart para archivos grandes, y miniaturas en segundo plano.',
          stack: ['Cloudflare R2', 'Disco local', 'PostgreSQL + PgBouncer'] },
        { id: 'a12', num: 'A12', title: 'Sesiones, cookies y CSRF', tier: 'core', status: 'proposed', repo: '', mods: ['m10'], front: true,
          excuse: 'El panel de administración de una tienda.',
          learn: 'Qué manda el navegador en cada request (cookies, Origin y cabeceras), sesión en el servidor con Spring Session y Redis contra JWT, los atributos HttpOnly, Secure y SameSite, CSRF y CORS con Spring Security, y cerrar la sesión en todos los dispositivos.',
          stack: ['Spring Security', 'Spring Session', 'Redis', 'Nginx'] },
        { id: 'a13', num: 'A13', title: 'OAuth 2 y OIDC con un servidor en Workers', tier: 'core', status: 'proposed', repo: '', mods: ['m10'], front: true,
          excuse: 'Un inicio de sesión único para varias aplicaciones.',
          learn: 'El servidor de autorización en TypeScript sobre Cloudflare Workers: Authorization Code con PKCE, login con GitHub, access tokens JWT firmados con ES256, refresh tokens que rotan guardados en D1, JWKS y rotación de claves. Del lado de Java, Spring Boot como resource server con scopes y Spring Cloud Gateway como BFF: el token nunca llega al JavaScript del navegador.',
          stack: ['Cloudflare Workers (TypeScript)', 'D1', 'Spring Cloud Gateway', 'Spring Security'] },
        { id: 'a14', num: 'A14', title: 'Observabilidad de un backend y su base', tier: 'core', status: 'proposed', repo: '', mods: ['m11'], front: false,
          excuse: 'Encontrar por qué una API se volvió lenta un martes a las once.',
          learn: 'Traces con OpenTelemetry de la API a PgBouncer, PostgreSQL y Redis, métricas RED y USE, logs con trace_id, los exporters de PostgreSQL, PgBouncer y Redis, la consulta lenta en pg_stat_statements, y un SLO con alertas por burn rate.',
          stack: ['OpenTelemetry', 'Prometheus', 'Grafana', 'Tempo', 'Loki'] },
        { id: 'a15', num: 'A15', title: 'Idempotencia de punta a punta', tier: 'core', status: 'proposed', repo: '', mods: ['m02', 'm27'], front: true,
          excuse: 'Un botón de pagar.',
          learn: 'El doble clic y los reintentos del navegador, una Idempotency-Key que genera el navegador y conserva para reintentar, la tabla de claves con restricción única y la huella del body (422 si cambia, 409 si sigue en curso), guardar y repetir la respuesta, vencer las claves a las 24 h, y por qué un advisory lock de sesión no sirve detrás de PgBouncer en modo transacción.',
          stack: ['PostgreSQL + PgBouncer', 'Redis'] },
        { id: 'a16', num: 'A16', title: 'Búsqueda', tier: 'core', status: 'proposed', repo: '', mods: ['m05', 'm30'], front: false,
          excuse: 'Un buscador de recetas.',
          learn: 'Primero lo que alcanza con PostgreSQL (tsvector, GIN y pg_trgm); después Elasticsearch alimentado por un outbox, un analizador para español, autocompletado, ajuste de relevancia y reindexar sin cortes con alias.',
          stack: ['Elasticsearch', 'PostgreSQL + PgBouncer'] },
        { id: 'a17', num: 'A17', title: 'Lo que está cerca', tier: 'core', status: 'proposed', repo: '', mods: ['m04', 'm05'], front: false,
          excuse: 'Repartidores cerca de ti.',
          learn: 'PostGIS con geography e índice GiST, los k más cercanos con el operador <->, ST_DWithin para radios y geocercas con ST_Contains. Las posiciones que cambian cada pocos segundos van a Redis GEO; las que hay que guardar llegan a PostgreSQL en lotes.',
          stack: ['PostGIS', 'PgBouncer', 'Redis GEO'] },
        { id: 'a18', num: 'A18', title: 'Kafka con reintentos y DLQ', tier: 'core', status: 'proposed', repo: '', mods: ['m07'], front: false,
          excuse: 'Los cobros mensuales de un servicio de suscripción, sobre un log.',
          learn: 'Particiones y orden por clave, consumer groups y rebalanceo, lag, retención y reprocesar desde un offset, el productor idempotente, reintentos con backoff en topics de reintento, una DLQ para los mensajes que no se pueden procesar y cómo reinyectarlos, y un consumidor idempotente con una tabla de procesados.',
          stack: ['Kafka (KRaft)', 'Spring for Apache Kafka', 'PostgreSQL + PgBouncer'] },
        { id: 'a19', num: 'A19', title: 'Del commit al clúster', tier: 'core', status: 'proposed', repo: '', mods: [], front: false,
          excuse: 'Que cada push llegue solo al clúster.',
          learn: 'GitHub Actions con pruebas en Testcontainers, una imagen por capas publicada en GHCR, escaneo con Trivy, y despliegue GitOps con Argo CD dentro de un clúster k3s local, sin abrirlo a internet.',
          stack: ['GitHub Actions', 'GHCR', 'Trivy', 'Argo CD', 'k3s'] }
      ]
    },
    {
      id: 'ia', label: 'Parte II', title: 'Un ChatGPT en una sola CPU', line: '--line-p2',
      intro: 'Un modelo chico servido con Ollama en una CPU. Va a ser lento, y eso es parte de la lección: los mismos cuellos de botella que M12 a M20 miden en GPUs, a escala de una computadora.',
      items: [
        { id: 'a20', num: 'A20', title: 'Banco de inferencia en una CPU', tier: 'core', status: 'proposed', repo: '', mods: ['m12', 'm13', 'm14', 'm15'], front: false,
          excuse: '¿Cuánto aguanta tu computadora?',
          learn: 'Ollama en Docker y Spring AI; tiempo al primer token y tokens por segundo; prefill contra decode con prompts largos; el mismo modelo en q4_K_M y q8_0; concurrencia con OLLAMA_NUM_PARALLEL (throughput contra latencia); y el cold start al cargar un modelo. Con modelos de 0.5 a 3 mil millones de parámetros; la tabla de resultados la llenas con tu hardware.',
          stack: ['Ollama', 'Spring AI', 'Gatling'] },
        { id: 'a21', num: 'A21', title: 'Conversación y streaming', tier: 'core', status: 'proposed', repo: '', mods: ['m16', 'm17', 'm20'], front: true,
          excuse: 'Un chat propio con un modelo chico.',
          learn: 'Conversaciones y mensajes en PostgreSQL, SSE de punta a punta a través de Spring Cloud Gateway y Nginx sin buffering, cancelar la generación cuando el cliente se va, una ventana deslizante con resumen para el contexto, y títulos generados en segundo plano.',
          stack: ['Ollama', 'Spring AI', 'PostgreSQL + PgBouncer', 'Spring Cloud Gateway', 'Nginx'] },
        { id: 'a22', num: 'A22', title: 'Cuotas, cola y router', tier: 'core', status: 'proposed', repo: '', mods: ['m18', 'm19', 'm20'], front: true,
          excuse: 'Diez personas comparten la misma CPU.',
          learn: 'Cuotas por tokens que se reservan y se reconcilian en Redis con Lua, una generación a la vez con una cola que muestra tu posición, 429 con Retry-After, y un router entre un modelo chico y uno mediano según el largo del prompt.',
          stack: ['Ollama', 'Redis', 'Spring Cloud Gateway', 'Prometheus'] }
      ]
    },
    {
      id: 'casos', label: 'Parte III', title: 'Casos de estudio, en chico', line: '--line-p3',
      intro: 'Versiones reducidas de los casos del curso. Son ampliaciones: se escriben después de los sistemas completos, si quieres más.',
      items: [
        { id: 'a23', num: 'A23', title: 'Mini WhatsApp', tier: 'extra', status: 'proposed', repo: '', mods: ['m29'], front: true,
          excuse: 'Un chat entre amigos con confirmaciones de entrega.',
          learn: 'WebSocket en varios pods, un registro de sesiones en Redis para saber en qué pod está cada persona, buzón para quien no está conectado, confirmaciones de enviado, entregado y leído, presencia con TTL y la tormenta de reconexión al reiniciar un pod.',
          stack: ['Spring WebSocket', 'Redis', 'PostgreSQL + PgBouncer', 'k3s'] },
        { id: 'a24', num: 'A24', title: 'Mini Twitter', tier: 'extra', status: 'proposed', repo: '', mods: ['m30'], front: false,
          excuse: 'Un timeline para cien cuentas y una famosa.',
          learn: 'Ids Snowflake, fan-out en escritura a timelines en Redis, el caso híbrido para la cuenta famosa y contadores con write-behind.',
          stack: ['Redis', 'Redis Streams', 'PostgreSQL + PgBouncer'] },
        { id: 'a25', num: 'A25', title: 'Mini Docs', tier: 'extra', status: 'proposed', repo: '', mods: ['m31'], front: true,
          excuse: 'Un editor de texto para dos personas a la vez.',
          learn: 'La función transform de OT llevada a Java, un dueño por documento con lease y época, el log de revisiones con escritura condicional, snapshots en R2 y los cursores de los demás por WebSocket.',
          stack: ['Spring WebSocket', 'PostgreSQL + PgBouncer', 'Redis', 'Cloudflare R2', 'k3s'] },
        { id: 'a26', num: 'A26', title: 'CDN casero', tier: 'extra', status: 'proposed', repo: '', mods: ['m28'], front: false,
          excuse: 'Servir las imágenes de una galería desde cerca.',
          learn: 'proxy_cache de Nginx con claves, stale-while-revalidate y purga, Cache-Control y ETag bien puestos, y un Worker con la Cache API delante de tu origen.',
          stack: ['Nginx', 'Cloudflare Workers', 'Cloudflare R2'] }
      ]
    }
  ],

  capstones: [
    { id: 'c1', num: 'C1', title: 'Pagos distribuidos', status: 'proposed', repo: '', mods: ['m27', 'cpa'],
      excuse: 'Una pasarela de pagos para tiendas, en chico.',
      learn: 'Cada pago como máquina de estados, un ledger de doble entrada que siempre suma cero, webhooks firmados con HMAC y reintentos, conciliación diaria, y lecturas desde réplicas sin romper leer lo que escribiste. Es el sistema que junta las bases de datos distribuidas con la idempotencia.',
      uses: ['a04', 'a07', 'a15', 'a18', 'a10', 'a13', 'a14', 'a19'] },
    { id: 'c2', num: 'C2', title: 'Pedidos a domicilio', status: 'proposed', repo: '', mods: ['m04', 'm07', 'm29'],
      excuse: 'Una app de comida para un barrio.',
      learn: 'Catálogo con búsqueda y caché, fotos con URLs firmadas, pago idempotente, asignar el repartidor libre más cercano sin asignarlo dos veces, seguimiento en vivo por WebSocket con Pub/Sub entre pods, y avisos por cola.',
      uses: ['a03', 'a11', 'a15', 'a16', 'a17', 'a09', 'a07', 'a14'] }
  ]
};
