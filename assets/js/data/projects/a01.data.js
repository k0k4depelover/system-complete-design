/* Decisiones guiadas de A01 (detrás de Nginx). Formato en core/exercise.js. */

SD.defineExercise('a01-nginx', {
  title: 'el acortador en su primer mes',
  scenario: '<p>El acortador ya está en producción con tres réplicas detrás de Nginx, con <code>least_conn</code>, <code>max_fails=3</code> y <code>limit_req</code> de 10 escrituras por segundo por IP. En el primer mes pasan cuatro cosas: una réplica se pone lenta sin fallar, un <code>POST</code> se queda colgado en una pausa del recolector de basura, el host de Nginx se llena de conexiones en <code>TIME_WAIT</code>, y el equipo pone una CDN delante.</p>',
  steps: [
    {
      id: 'lenta', type: 'single',
      prompt: 'app3 responde todo bien, pero en 250&#8239;ms en vez de 10&#8239;ms, y su <code>/actuator/health</code> da 200. ¿Qué la saca del tráfico?',
      options: [
        'max_fails: después de 3 requests lentas, Nginx la marca como caída.',
        'least_conn: como tarda más, acumula conexiones y deja de recibir requests.',
        'Una alerta sobre el p99 por réplica, o detección de outliers por latencia.',
        'Un health check activo contra /actuator/health cada 5&#8239;s.'
      ],
      answer: 2,
      explain: 'max_fails cuenta errores y timeouts, y una respuesta de 250&#8239;ms no es ninguna de las dos. least_conn le manda menos, pero le sigue mandando: con la réplica lenta medida en la guía, una de cada ocho requests. El health check pasa, porque la réplica está viva. Hace falta mirar la latencia por réplica.'
    },
    {
      id: 'post', type: 'single',
      prompt: 'Un <code>POST /api/links</code> llega a app1, que se congela 6&#8239;s en una pausa del recolector. Con <code>proxy_read_timeout 5s</code> y <code>proxy_next_upstream error timeout</code>, ¿qué recibe el cliente?',
      options: [
        'Un 201: Nginx lo reintenta en app2, porque el timeout cuenta como error.',
        'Un 504, y el enlace puede haberse creado igual en app1.',
        'Un 429, porque el límite de tasa cuenta la request dos veces.',
        'Un 502: Nginx corta la conexión con app1 y no reintenta.'
      ],
      answer: 1,
      explain: 'Nginx no pasa a otra réplica una request con método no idempotente que ya llegó al upstream, salvo que agregues non_idempotent. Es lo correcto: app1 puede terminar el insert después del timeout. Si el cliente reintenta, puede crear un segundo enlace; eso se resuelve con una clave de idempotencia, como explica M02.'
    },
    {
      id: 'timewait', type: 'single',
      prompt: 'El host de Nginx tiene 28&#8239;000 conexiones en <code>TIME_WAIT</code> hacia las réplicas y empiezan a faltar puertos. El upstream tiene <code>keepalive 32</code>. ¿Qué falta?',
      options: [
        'Subir keepalive a 1&#8239;024, para que haya conexiones libres de sobra.',
        'proxy_http_version 1.1 y proxy_set_header Connection "" en el server o el location.',
        'Bajar worker_connections para que Nginx abra menos conexiones a la vez.',
        'Activar http2 on en el upstream, que multiplexa en una sola conexión.'
      ],
      answer: 1,
      explain: 'Por defecto Nginx habla HTTP/1.0 con el upstream y manda Connection: close, así que cierra la conexión después de cada request y keepalive 32 no tiene nada que guardar. Cada cierre deja un socket en TIME_WAIT unos 60&#8239;s: a 500 requests por segundo son 30&#8239;000.'
    },
    {
      id: 'cdn', type: 'single',
      prompt: 'Ponen una CDN delante de Nginx, y desde ese día casi todas las escrituras reciben 429. ¿Por qué, y qué cambias?',
      options: [
        'La CDN reintenta cada POST; hay que desactivar los reintentos de la CDN.',
        'Todas llegan desde las IPs de la CDN; hay que usar real_ip_header.',
        'El límite es por worker; hay que agregar zone al upstream.',
        'La CDN no manda X-Forwarded-For; hay que pedírselo y limitar con esa cabecera.'
      ],
      answer: 1,
      explain: '$binary_remote_addr es la IP de quien abrió la conexión con Nginx, que ahora es la CDN. Con real_ip_header, Nginx reemplaza esa IP por la que dice la cabecera, pero solo si la conexión viene de un rango de set_real_ip_from: si confías en la cabecera venga de donde venga, cualquiera puede mandar una IP falsa y saltarse el límite.'
    }
  ],
  solution: '<ul><li>Una réplica lenta no la detectan ni <code>max_fails</code> ni el health check. Se mira la latencia por réplica, con una alerta o con detección de outliers, y se la saca con draining.</li><li>Los <code>POST</code> no se reintentan en el proxy. El cliente reintenta con una clave de idempotencia y el servidor devuelve el mismo resultado.</li><li>El keepalive hacia el upstream necesita <code>proxy_http_version 1.1</code> y <code>Connection ""</code>, además de <code>keepalive</code> en el upstream.</li><li>Detrás de una CDN, la IP real sale de su cabecera, con <code>real_ip_header</code> y <code>set_real_ip_from</code> limitado a los rangos de la CDN.</li></ul>'
});
