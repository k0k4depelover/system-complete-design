/* Decisiones guiadas de A00 (el laboratorio común). Formato en core/exercise.js. */

SD.defineExercise('a00-laboratorio', {
  title: 'el pool de la API de notas',
  scenario: '<p>La API de notas pasa a producción con 4 réplicas, cada una con un pool de Hikari de 10 conexiones, detrás de un PgBouncer en modo transacción con <code>default_pool_size</code> de 20. PostgreSQL acepta 100 conexiones. Una consulta típica dura 3&#8239;ms y el pico es de 1&#8239;200 requests por segundo, una consulta por request.</p><p>Un compañero quiere agregar un trabajo nocturno que no debe correr dos veces a la vez y propone un advisory lock. Otro quiere que un reporte lento tenga un <code>statement_timeout</code> de 30&#8239;s, distinto del resto.</p>',
  steps: [
    {
      id: 'conexiones', type: 'single',
      prompt: 'Por la ley de Little, ¿cuántas conexiones reales con PostgreSQL están ocupadas, en promedio, en el pico?',
      options: ['Unas 4', 'Unas 40', 'Unas 400', 'Las 100'],
      fixed: true,
      answer: 0,
      explain: 'Conexiones ocupadas = llegadas × tiempo de servicio = 1&#8239;200 por segundo × 0.003&#8239;s = 3.6. Con 20 conexiones reales sobra margen para los picos y las consultas más lentas. Más conexiones no harían más rápida a la base.'
    },
    {
      id: 'clientes', type: 'single',
      prompt: 'Las 4 réplicas suman 40 conexiones hacia PgBouncer, y PgBouncer tiene 20 hacia PostgreSQL. ¿Qué pasa?',
      options: [
        'Nada grave: en modo transacción, los 40 clientes comparten las 20 conexiones.',
        'La mitad de las réplicas no puede conectarse hasta que se libere una sesión.',
        'PgBouncer rechaza las conexiones que pasan de 20 con un error de pool lleno.',
        'Hay que subir default_pool_size a 40 para que cada cliente tenga la suya.'
      ],
      answer: 0,
      explain: 'Ese es el punto del modo transacción. En modo sesión sí habría 20 clientes esperando, porque cada uno se queda con su conexión real mientras está conectado. max_client_conn, que en el compose es 500, limita a los clientes; default_pool_size, a las conexiones reales.'
    },
    {
      id: 'lock', type: 'single',
      prompt: 'Para que el trabajo nocturno no corra dos veces a la vez a través de PgBouncer, ¿qué usas?',
      options: [
        'pg_advisory_lock(42) al empezar y pg_advisory_unlock(42) al terminar.',
        'pg_try_advisory_xact_lock(42) dentro de la transacción del trabajo.',
        'Un SET application_name = \'nocturno\' y revisar pg_stat_activity antes de empezar.',
        'Nada: PgBouncer serializa las transacciones del mismo usuario y la misma base.'
      ],
      answer: 1,
      explain: 'Un lock de sesión queda en la conexión real, que PgBouncer le presta después a otro cliente: lo mediste en la falla 2, donde el segundo cliente recibió t. La versión de transacción se libera en el commit y no se filtra. Si el trabajo dura más que una transacción, conéctalo directo a PostgreSQL.'
    },
    {
      id: 'timeout', type: 'single',
      prompt: '¿Cómo le das 30&#8239;s de statement_timeout solo al reporte lento?',
      options: [
        'SET statement_timeout = \'30s\' en la misma conexión, justo antes de la consulta.',
        'SET LOCAL statement_timeout = \'30s\' dentro de la transacción del reporte.',
        'ALTER DATABASE app SET statement_timeout = \'30s\'.',
        'Subir el connection-timeout de Hikari a 30&#8239;s solo para ese repositorio.'
      ],
      answer: 1,
      explain: 'SET LOCAL dura hasta el commit de esa transacción, que en modo transacción es justo lo que el pooler te presta. Un SET suelto se queda en la conexión real y le llega al cliente siguiente, como en la falla 1. ALTER DATABASE se lo cambia a todos, y el connection-timeout de Hikari es otra cosa: cuánto espera una request por una conexión del pool.'
    }
  ],
  solution: '<ul><li>En el pico hay unas 3.6 conexiones reales ocupadas en promedio (1&#8239;200 × 0.003&#8239;s). Las 20 de PgBouncer alcanzan con margen, y las 100 de PostgreSQL quedan para conexiones directas y para el mantenimiento.</li><li>40 clientes para 20 conexiones reales está bien en modo transacción. Mira <code>cl_waiting</code> en <code>SHOW POOLS</code>: si deja de ser 0, faltan conexiones reales o alguna transacción dura demasiado.</li><li>Nada que viva en la sesión pasa por el pooler: ni <code>SET</code>, ni advisory locks de sesión, ni <code>LISTEN</code>. Para el trabajo nocturno, <code>pg_try_advisory_xact_lock</code> o una conexión directa; para el reporte, <code>SET LOCAL</code>.</li></ul>'
});
