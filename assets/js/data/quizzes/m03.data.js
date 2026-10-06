SD.defineQuiz('m03', {
  title: 'Quiz: balanceadores, gateways y proxies',
  pass: 0.7,
  questions: [
    {
      id: 'slow', type: 'single',
      prompt: 'Uno de cinco servidores sufre pausas largas de GC y atiende 6 veces más lento. ¿Con qué algoritmo el p99 del sistema se mantiene razonable?',
      options: ['Round robin', 'Aleatorio', 'Power of two choices', 'Hash por usuario'],
      answer: 2,
      explain: 'Round robin, aleatorio y hash le siguen mandando un 20 % del tráfico al lento, cuya cola crece sin límite. Los algoritmos que miran el trabajo en curso (menos conexiones, P2C) lo esquivan solos: le llega mucho menos tráfico mientras esté lento.'
    },
    {
      id: 'grpcl4', type: 'single',
      prompt: 'Tus clientes gRPC abren una conexión HTTP/2 larga y la reutilizan. Pones un balanceador L4 delante de 10 instancias. ¿Qué pasa?',
      options: [
        'Las requests se reparten parejo entre las 10, porque HTTP/2 multiplexa cada una por separado.',
        'Cada conexión queda pegada a una instancia y la carga se desbalancea.',
        'El L4 rechaza HTTP/2 porque no lee frames binarios.',
        'gRPC detecta el balanceador y abre una conexión nueva por request para repartirse.'
      ],
      answer: 1,
      explain: 'L4 balancea conexiones, no requests. Con conexiones largas y multiplexadas, necesitas un balanceador L7 que entienda HTTP/2 y reparta cada request, o balanceo del lado del cliente.'
    },
    {
      id: 'readiness', type: 'single',
      prompt: 'Una instancia nueva arranca y el balanceador le manda tráfico enseguida, aunque todavía está cargando cachés y compilando código en caliente. ¿Qué la protege?',
      options: [
        'Un liveness check más frecuente, que la reinicie si tarda demasiado en responder.',
        'Un readiness check que solo dé OK cuando esté lista, más un slow start.',
        'Sticky sessions, para que solo le lleguen usuarios nuevos y no los que ya están en otras.',
        'Un TTL de DNS más largo, para que los clientes tarden en descubrirla.'
      ],
      answer: 1,
      explain: 'Liveness dice "reiníciame si fallo"; readiness dice "no me mandes tráfico todavía". Y el slow start evita que una instancia recién llegada, con menos conexiones que el resto, se lleve de golpe todo el tráfico de un algoritmo de menos conexiones.'
    },
    {
      id: 'retries', type: 'single',
      prompt: 'El gateway, el servicio A y el servicio B reintentan 3 veces cada uno ante un error del servicio C. Si C está caído, ¿cuántas requests recibe C por cada request del usuario?',
      options: ['3', '9', 'Hasta 27', '1'],
      answer: 2,
      explain: 'Los reintentos se multiplican en cada capa: 3 × 3 × 3 = 27. Justo cuando C necesita alivio, recibe 27 veces más carga. Se reintenta en una sola capa (idealmente la más cercana al cliente), con presupuesto de reintentos y backoff (M08).'
    },
    {
      id: 'gateway', type: 'multi',
      prompt: '¿Qué responsabilidades corresponden a un API gateway?',
      options: [
        'Validar tokens y API keys.',
        'Aplicar rate limiting por cliente.',
        'Calcular el precio de un pedido con descuentos.',
        'Enrutar por path y versión.',
        'Registrar métricas y request IDs.'
      ],
      answer: [0, 1, 3, 4],
      explain: 'El gateway resuelve lo transversal, igual para todas las APIs. La lógica de negocio (precios, descuentos) vive en los servicios: si entra al gateway, cada cambio de negocio exige desplegar la pieza más crítica del sistema.'
    },
    {
      id: 'sticky', type: 'single',
      prompt: 'Tu app guarda la sesión del usuario en la memoria del servidor y usas sticky sessions. ¿Qué problema aparece cuando una instancia se cae?',
      options: [
        'Ninguno: el balanceador replica la memoria de cada instancia en otra y reasigna a sus usuarios.',
        'Los usuarios de esa instancia pierden la sesión, y la carga ya se repartía mal.',
        'Las sesiones se duplican, porque el balanceador las recrea en todas las instancias restantes.',
        'Nada grave: los usuarios pasan a otra instancia, que lee la sesión de la cookie.'
      ],
      answer: 1,
      explain: 'El estado en memoria convierte a cada instancia en irremplazable. La solución es sacar la sesión a un almacén compartido (Redis) o a un token firmado, y dejar las instancias stateless.'
    },
    {
      id: 'hash', type: 'single',
      prompt: '¿Cuándo tiene sentido balancear con hash consistente por una clave (por ejemplo, el id del usuario o del documento)?',
      options: [
        'Siempre: reparte la carga de forma más pareja que cualquier otro algoritmo.',
        'Cuando cada backend guarda caché o estado por clave y la misma clave tiene que caer en el mismo lugar.',
        'Cuando un servidor está lento, porque el hash mueve sus claves a los demás automáticamente.',
        'Cuando unas pocas claves concentran el tráfico, porque el hash reparte cada una entre varios nodos.'
      ],
      answer: 1,
      explain: 'Es lo que se usa para cachés distribuidas y servidores con estado por documento (Google Docs, M31). El costo: las claves populares desbalancean la carga, y no esquiva servidores lentos.'
    },
    {
      id: 'mesh', type: 'single',
      prompt: '¿Cuál es el costo principal de introducir un service mesh con sidecars?',
      options: [
        'Obliga a reescribir los servicios para que hablen con el plano de control mediante una SDK.',
        'Dos proxies más en cada llamada (latencia y CPU) y un plano de control que operar.',
        'Impide usar TLS entre servicios, porque el sidecar necesita leer el tráfico en claro.',
        'Duplica las réplicas de cada servicio, porque el sidecar corre como un pod aparte.'
      ],
      answer: 1,
      explain: 'A cambio de mTLS, reintentos, métricas y políticas uniformes sin tocar código, pagas un salto extra en cada extremo, más memoria por instancia y una pieza de infraestructura crítica. Vale la pena con muchos servicios y equipos; con cinco servicios, rara vez.'
    },
    {
      id: 'l4-flota', type: 'multi',
      prompt: '¿Por qué los sistemas grandes ponen una flota L4 separada delante de la flota de proxies L7?',
      options: [
        'El L4 no termina TCP ni TLS: mueve millones de paquetes con poca CPU.',
        'Con hashing consistente, el L4 deja cambiar proxies L7 sin cambiar la IP que ve el cliente.',
        'El L4 puede enrutar por path y por header antes de que la request llegue al L7, y así descarga a los proxies.',
        'Con DSR, las respuestas vuelven directo del L7 al cliente sin cargar al L4.'
      ],
      answer: [0, 1, 3],
      explain: 'El L4 no ve el path ni los headers: solo IPs, puertos y protocolo. Su valor es ser barato, casi sin estado y estable, para que la flota cara (L7) pueda cambiar detrás. Repasa 3.2, "Dos flotas separadas".'
    },
    {
      id: 'bff-device', type: 'single',
      prompt: 'Un BFF tiene que devolver una respuesta distinta a la TV y al teléfono. ¿Cómo debería saber qué cliente tiene enfrente?',
      options: [
        'Analizando el User-Agent con expresiones regulares, que trae el modelo de cada dispositivo.',
        'Por la ruta o el host de su BFF, y por headers propios como la versión de la app.',
        'Por la IP de origen, que el BFF cruza con la red del proveedor para distinguir TV y teléfono.',
        'Preguntándole al servicio de perfil qué dispositivo registró el usuario.'
      ],
      answer: 1,
      explain: 'El cliente lo dice de forma explícita: cada app llama a su propio BFF, y dentro de él las variaciones viajan en headers que la app manda a propósito. El User-Agent se falsifica, cambia con cada versión y Chrome lo viene recortando. Repasa 3.5, "BFF: un backend por experiencia".'
    },
    {
      id: 'waf-score', type: 'single',
      prompt: 'Con el OWASP CRS en su configuración por defecto (umbral de entrada 5), una request coincide con dos reglas de severidad nota (2 puntos cada una). ¿Qué pasa?',
      options: ['Se bloquea: coincidió con dos reglas.', 'Pasa: suma 4, por debajo del umbral de 5.', 'Se bloquea solo si el nivel de paranoia es 1.', 'Pasa siempre: las notas nunca cuentan.'],
      answer: 1,
      explain: 'Las reglas del CRS no bloquean solas: suman puntos según su severidad (crítica 5, error 4, aviso 3, nota 2) y se bloquea si la suma llega al umbral. 2 + 2 = 4 no alcanza; una sola regla crítica, sí. Repasa la figura 3.4.'
    },
    {
      id: 'waf-rollout', type: 'order',
      prompt: 'Ordena los pasos para poner un WAF en producción sin bloquear a usuarios legítimos.',
      items: [
        'Activar las reglas en modo Count (detección) y registrar cada coincidencia',
        'Revisar las coincidencias y encontrar los falsos positivos',
        'Escribir excepciones angostas, por path y por campo',
        'Pasar a Block y medir la tasa de 403 por regla con alertas'
      ],
      explain: 'Primero se observa sin bloquear, después se ajusta lo que bloquearía tráfico legítimo, y solo entonces se bloquea, vigilando la tasa de 403 como una métrica más. Repasa 3.5, "WAF: cómo decide cuándo bloquear".'
    },
    {
      id: 'sticky-redis', type: 'single',
      prompt: 'Sacaste las sesiones de la memoria de cada servidor y las pusiste en un único Redis, sin réplicas. ¿Qué cambió en el riesgo?',
      options: [
        'Nada: Redis guarda todo en memoria y es más estable que los servidores de aplicación.',
        'La caída de Redis ahora afecta a todos los usuarios a la vez: es un SPOF.',
        'El riesgo desapareció, porque los servidores quedaron sin estado y cualquiera atiende a cualquiera.',
        'Ahora hacen falta sticky sessions para llegar a Redis.'
      ],
      answer: 1,
      explain: 'Sacar el estado del servidor es correcto, pero concentra el riesgo en el almacén: cada request depende de él. Se mitiga con réplicas y failover automático (Sentinel, Cluster, Multi-AZ), timeouts cortos y degradación, o con tokens firmados. Repasa la figura 3.7.'
    },
    {
      id: 'mesh-mtls', type: 'single',
      prompt: 'En un mesh con sidecars, la app de orders llama a <code>http://payments</code> en texto plano. ¿Dónde se cifra la llamada y cómo sabe payments que viene de orders?',
      options: [
        'La app de orders cifra con TLS y payments verifica la IP de origen contra una lista permitida.',
        'El sidecar de orders abre mTLS con el de payments, que lee la identidad SPIFFE del certificado.',
        'No se cifra dentro del clúster: payments confía en un header <code>X-Service</code> que agrega orders.',
        'El plano de control recibe cada request, la cifra y la reenvía con la identidad de orders.'
      ],
      answer: 1,
      explain: 'La app no sabe de TLS. Los dos sidecars presentan certificado (eso es mTLS), y la identidad va dentro del certificado como una URI SPIFFE. El plano de control nunca toca una request: solo firma certificados y reparte configuración. Repasa la figura 3.9.'
    },
    {
      id: 'slowstart-quien', type: 'single',
      prompt: 'Con slow start activado, ¿quién limita cuánto tráfico recibe una instancia recién agregada?',
      options: [
        'La instancia, que le avisa al balanceador cuántas requests puede recibir en cada momento.',
        'El balanceador, con un peso que crece durante la ventana (de 10&#8239;% a 100&#8239;% en 30 s).',
        'El autoescalador, hasta que la CPU de la instancia se estabiliza.',
        'El health check, que la marca como sana de a poco y le sube el tráfico en cada chequeo.'
      ],
      answer: 1,
      explain: 'Solo el balanceador decide adónde va cada request. La instancia puede defenderse (precalentar antes del readiness, limitar su concurrencia y responder 503), pero no puede pedir menos tráfico. Repasa 3.4, "Slow start: quién limita y cómo".'
    },
    {
      id: 'retry-27', type: 'single',
      prompt: 'Cuatro capas (gateway, A, B, base de datos). El gateway, A y B hacen hasta 3 intentos cada uno. La base no responde. ¿Cuántas llamadas recibe la base por cada request del usuario, y cuántas si las tres capas usan un presupuesto de reintentos del 10&#8239;%?',
      options: ['9 y 1.1 veces la carga', '27 y 1.33 veces la carga', '9 y 1.33 veces la carga', '27 y 1.1 veces la carga'],
      fixed: true,
      answer: 1,
      explain: 'Los intentos se multiplican por capa: 3 × 3 × 3 = 27. Con un presupuesto del 10&#8239;% en cada capa, cada una agrega como máximo un 10&#8239;%: 1.1 × 1.1 × 1.1 ≈ 1.33. Repasa la figura 3.10.'
    }
  ]
});
