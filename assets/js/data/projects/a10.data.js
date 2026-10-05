/* Decisiones guiadas de A10 (Cuando Redis se cae). Formato en core/exercise.js. */

SD.defineExercise('a10-circuit-breaker', {
  title: 'un catálogo que sigue atendiendo sin Redis',
  scenario: '<p>El catálogo corre como en esta guía: dos pods de Spring Boot, cada uno con un pool de 2 conexiones a PostgreSQL, y cada lectura de la base tarda 200&#8239;ms. La base atiende entonces 2 pods × 2 conexiones / 0.2&#8239;s = 20 lecturas por segundo. k6 manda 30 requests por segundo con 30 VUs: 28.5 lecturas y 1.5 cambios de precio. Con Redis sano, entre 3 y 4.5 lecturas por segundo llegan a la base. A los 30&#8239;s se apaga el nodo de Redis durante 60&#8239;s. Tienes que tomar ocho decisiones.</p>',
  steps: [
    {
      id: 'sin-timeout', type: 'single',
      prompt: 'Sin tocar nada, Lettuce espera 60&#8239;s la respuesta de un comando. Se apaga el nodo de Redis. ¿Qué ve k6?',
      options: [
        'Las lecturas van a la base y tardan 200&#8239;ms: la caché era solo una optimización.',
        'Cada lectura espera hasta su timeout de 10&#8239;s; 30 VUs / 10&#8239;s = 3 requests por segundo, y las otras 27 por segundo terminan en <code>dropped_iterations</code>.',
        'Spring detecta que Redis cayó y deja de usarlo en el acto.',
        'Kubernetes saca a Redis del Service al instante y las conexiones fallan rápido.'
      ],
      answer: 1,
      explain: 'Nadie le avisa a la app que Redis no está: cada comando espera su timeout. Por la ley de Little, 30 VUs que tardan 10&#8239;s cada uno dan 3 requests por segundo. Kubernetes tarda 50&#8239;s en marcar el nodo NotReady, y aun así una conexión abierta no se entera. Vuelve al paso 4 y a la E1.'
    },
    {
      id: 'timeout-corto', type: 'single',
      prompt: 'El p95 objetivo es 300&#8239;ms y la base tarda 200&#8239;ms. ¿Qué timeout de comando le das a Redis?',
      options: [
        '1&#8239;ms: un Redis sano contesta en menos de eso.',
        '100&#8239;ms: lo que queda del presupuesto, y cien veces lo que tarda un Redis sano en la misma red.',
        '5&#8239;s: así no hay falsos positivos.',
        'Ninguno: el breaker ya corta las llamadas lentas.'
      ],
      answer: 1,
      explain: 'El timeout sale del presupuesto de la request, de afuera hacia adentro. 1&#8239;ms convierte cualquier pausa normal en una falla; 5&#8239;s deja a cada request colgada mucho más que el objetivo. El breaker cuenta las llamadas, pero necesita que alguna termine: sin timeout, la primera llamada no termina nunca. Paso 4.'
    },
    {
      id: 'reintentar', type: 'single',
      prompt: 'Un <code>GET</code> a Redis falla por timeout. ¿Reintentas?',
      options: [
        'Sí, tres veces con backoff exponencial y jitter.',
        'Sí, una vez, en el acto.',
        'No: el plan B de un miss ya existe, que es leer la base. Un reintento a un Redis caído dobla la espera y no trae nada.',
        'No, y se devuelve un 503 para que reintente el cliente.'
      ],
      answer: 2,
      explain: 'Para una caché, fallar es lo mismo que no encontrar la clave: se va a la base. Reintentar contra un Redis caído suma 100&#8239;ms por intento, y contra uno lento le suma carga justo cuando menos puede. Un 503 por un miss de caché le echa al cliente un problema que el servicio sabe resolver. Paso 4.'
    },
    {
      id: 'breaker-abierto', type: 'single',
      prompt: 'Con timeouts de 100&#8239;ms, cada lectura sigue pagando 100&#8239;ms en el <code>GET</code> y otros 100 en el <code>SET</code>. ¿Qué hace el breaker cuando la mitad de las últimas 20 llamadas falló?',
      options: [
        'Durante 5&#8239;s, ninguna llamada sale: la lectura se trata como un miss en microsegundos, y el <code>DEL</code> que no salió se anota para reponerlo.',
        'Reintenta cada llamada hasta que Redis conteste.',
        'Devuelve un 503 a cada lectura mientras esté abierto.',
        'Le pide a Kubernetes que reinicie el pod de Redis.'
      ],
      answer: 0,
      explain: 'El breaker abierto saltea la llamada y usa el plan B de cada operación: la lectura va a la base, el <code>SET</code> se pierde sin daño y el <code>DEL</code> va a <code>pending</code>. Al abrirse, además, tira la conexión compartida: la llamada de prueba, 5&#8239;s después, abre una nueva, aunque la vieja haya quedado colgada. Paso 5 y E3.'
    },
    {
      id: 'base-saturada', type: 'single',
      prompt: 'Con el breaker abierto, todas las lecturas van a la base: 28.5 por segundo contra 20. ¿Qué pasa sin otra defensa?',
      options: [
        'Nada: PostgreSQL atiende lo que llegue, solo que un poco más lento.',
        'Las que no caben esperan en HikariCP hasta 1&#8239;s por una conexión, con un hilo ocupado, y fallan con un 500: al menos 8.5 por segundo, y la latencia sube para todas.',
        'El breaker de Redis también protege a la base.',
        'PgBouncer encola las lecturas sin límite y todas terminan bien.'
      ],
      answer: 1,
      explain: 'El breaker protege a la request de Redis, no a la base de la carga. Lo que sobra espera en la fila del pool y falla igual, y mientras espera sube la latencia de las que entran. Es lo que muestran E2 y E3.'
    },
    {
      id: 'compuerta', type: 'single',
      prompt: '¿Cómo limitas lo que entra a la base?',
      options: [
        'Un rate limiter de 20 lecturas por segundo en total.',
        'Un semáforo por pod con tantos lugares como conexiones, 2, que rechaza en el acto con 503 y <code>Retry-After: 1</code> la lectura que no entra.',
        'Subir el pool a 20 conexiones por pod.',
        'Dejar que HikariCP sea el límite, con su espera de 1&#8239;s.'
      ],
      answer: 1,
      explain: 'Limitar por concurrencia se ajusta solo: si la base se pone lenta, la misma concurrencia deja pasar menos por segundo. Un rate limiter deja entrar 20 aunque la base atienda 5. Más conexiones no hacen más rápida a la base, y la espera de HikariCP rechaza igual, pero 1&#8239;s más tarde. Paso 6 y E4.'
    },
    {
      id: 'erlang', type: 'single',
      prompt: 'La cuenta pareja dice que la compuerta rechaza 8.5 de 28.5 lecturas, el 30&#8239;%. En la E4 ves bastante más. ¿Por qué?',
      options: [
        'Hay un error en la compuerta: deja un lugar sin usar.',
        'Las lecturas no llegan parejas a cada pod: a veces se juntan tres y la tercera se rechaza aunque un instante después hubiera lugar. Con llegadas al azar, Erlang B da cerca del 51&#8239;%.',
        'k6 manda más requests de las que dice.',
        'Los cambios de precio también pasan por la compuerta.'
      ],
      answer: 1,
      explain: 'Una compuerta sin espera rechaza los amontonamientos, no solo el exceso promedio. Con c = 2 y A = 2.85 por pod, B = (A² / 2) / (1 + A + A² / 2) ≈ 0.51. Una espera corta, <code>GATE_WAIT=100ms</code>, absorbe los amontonamientos a cambio de un p95 más alto. Los cambios de precio no pasan por la compuerta: comparten el pool. E4.'
    },
    {
      id: 'congelado', type: 'single',
      prompt: 'Parte 2: congelas el nodo del master con <code>docker compose pause</code>. Sentinel promueve a la réplica. Con timeouts cortos y sin breaker (<code>e2</code>), ¿qué hace la app?',
      options: [
        'Pasa a la réplica promovida apenas Sentinel la anuncia.',
        'Sigue hablando con el master congelado: la conexión no se corta, porque el kernel del nodo sigue confirmando los paquetes, y Lettuce no la cambia por timeouts. Recién al descongelar, Sentinel le corta los clientes.',
        'Devuelve 503 en todas las lecturas.',
        'Se reinicia, porque la liveness probe mira a Redis.'
      ],
      answer: 1,
      explain: 'Lettuce les pregunta a los Sentinels al conectarse, no en cada comando. Una conexión a un nodo congelado sigue abierta: cada comando falla por timeout, y la réplica promovida, llena, queda a un costado. Con el breaker (<code>e5</code>), abrirse tira la conexión, y la llamada de prueba pregunta otra vez y encuentra al nuevo master. La liveness no mira a Redis a propósito. Paso 10 y "El nodo congelado".'
    }
  ],
  solution: '<ul>' +
    '<li>Cada timeout sale del presupuesto de la request: 100&#8239;ms por comando a Redis, 500&#8239;ms para conectar y 1&#8239;s de espera en HikariCP. Sin ellos, una caché caída cuelga al servicio entero.</li>' +
    '<li>Contra una caché no se reintenta: el plan B de un miss es la base.</li>' +
    '<li>El breaker delante de Redis convierte cada falla en un miss inmediato, tira la conexión al abrirse y repone después los <code>DEL</code> que no salieron.</li>' +
    '<li>La compuerta delante de la base limita por concurrencia y rechaza en el acto con 503 y <code>Retry-After</code>. Rechaza más que la cuenta pareja: entre el 30 y el 51&#8239;% de lo que llega a la base.</li>' +
    '<li>La copia local vieja convierte la mayoría de esos rechazos en respuestas, donde un dato de hasta 10 minutos es aceptable.</li>' +
    '<li>Con Sentinel, la réplica promovida solo sirve si la app vuelve a preguntar quién es el master. Un nodo congelado no corta las conexiones: el breaker sí.</li>' +
    '</ul>'
});
