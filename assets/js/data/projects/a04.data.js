/* Decisiones guiadas de A04 (primario y réplicas). Formato en core/exercise.js. */

SD.defineExercise('a04-replicas', {
  title: 'la biblioteca con dos réplicas',
  scenario: '<p>La biblioteca corre como en esta guía: un primario, dos réplicas asíncronas detrás de un PgBouncer de lectura, y <code>X-Min-LSN</code> para que quien pide un libro lo vea en su lista. En producción pasan cuatro cosas.</p>',
  steps: [
    {
      id: 'monotonas', type: 'single',
      prompt: 'Un bibliotecario abre la lista de préstamos de un socio y la recarga. En la primera aparece un préstamo de hace un segundo; en la segunda, no está. El bibliotecario no escribió nada, así que no tiene <code>X-Min-LSN</code>. ¿Qué haces?',
      options: [
        'Mandar todas las lecturas al primario.',
        'Devolver en cada lectura la posición que tenía la réplica que respondió, y que el cliente mande siempre la mayor que vio: ninguna lectura sale de una réplica más atrasada que la anterior.',
        'Activar <code>server_round_robin</code> también en el PgBouncer de escritura.',
        'Hacer síncrona a replica1.'
      ],
      answer: 1,
      explain: 'La primera lectura salió de una réplica al día y la segunda de una más atrasada: faltan lecturas monótonas, no read-your-writes. El mismo mecanismo del LSN sirve: si cada respuesta trae <code>pg_last_wal_replay_lsn()</code> de quien respondió y el cliente la devuelve, ninguna réplica más atrasada lo atiende. Fijar al bibliotecario a una réplica también funcionaría, pero en modo transacción PgBouncer no te da eso. Mandar todo al primario resuelve el síntoma y tira las réplicas, y una réplica síncrona no arregla a la otra.'
    },
    {
      id: 'sincrona', type: 'single',
      prompt: 'Negocio pide dos cosas: que un préstamo confirmado no se pierda aunque muera el primario, y que la biblioteca siga prestando si se cae una réplica. ¿Qué configuras?',
      options: [
        'Las dos réplicas asíncronas, como ahora.',
        '<code>FIRST 1 (replica1)</code> con <code>remote_apply</code>.',
        '<code>ANY 1 (replica1, replica2)</code> con <code>synchronous_commit = on</code>.',
        '<code>ANY 2 (replica1, replica2)</code>.'
      ],
      answer: 2,
      explain: 'Con réplicas asíncronas, un failover puede perder los últimos préstamos. <code>FIRST 1 (replica1)</code> frena todos los commits si cae replica1, como mediste, y <code>ANY 2</code> los frena si cae cualquiera. <code>ANY 1</code> deja cada préstamo en el disco de al menos una réplica y tolera la caída de la otra; <code>on</code> alcanza para no perderlo, sin esperar a que se aplique. El precio: en el failover tienes que promover la réplica más adelantada, porque no sabes cuál de las dos confirmó cada commit.'
    },
    {
      id: 'reintento', type: 'single',
      prompt: 'Durante una caída de la réplica síncrona, la app del socio recibe un timeout al pedir un libro y reintenta sola. ¿Qué pasa?',
      options: [
        'Nada: el primer préstamo falló y el reintento es el único.',
        'El primer préstamo puede quedar guardado cuando la réplica vuelve, y el reintento crea otro. Una clave de idempotencia por préstamo, con una restricción <code>UNIQUE</code> en la misma tabla, hace que el reintento devuelva el primero.',
        'Se evita subiendo el timeout del cliente a 60&#8239;s.',
        'Se evita con <code>synchronous_commit = off</code>.'
      ],
      answer: 1,
      explain: 'Lo mediste con zoe y leo: los dos vieron un error a los 5&#8239;s y los dos préstamos quedaron guardados cuando las transacciones terminaron. Un timeout no dice si la escritura pasó. Un timeout más largo solo hace que el problema aparezca más tarde, y <code>off</code> cambia el problema por otro peor: confirmar préstamos que una caída del primario puede borrar.'
    },
    {
      id: 'fencing', type: 'single',
      prompt: 'Un switch deja al primario aislado de la red durante 30&#8239;s. A los 10&#8239;s, el equipo promueve replica1. A los 30&#8239;s, la red vuelve. ¿Qué tendría que haber pasado antes de promover?',
      options: [
        'Nada: PostgreSQL ve que hay otro primario y se degrada solo.',
        'Cerrarle el paso al viejo primario, apagándolo o sacándolo de todo pool y de la red, antes de promover a replica1.',
        'Promover también a replica2, para tener mayoría.',
        'Bajar <code>server_login_retry</code> a 0.'
      ],
      answer: 1,
      explain: 'PostgreSQL no sabe que hay otro primario: el viejo vuelve aceptando escrituras, como el préstamo de "fantasma", y todo lo que escriba se pierde al rebobinarlo con <code>pg_rewind</code>. Por eso se cierra el paso al viejo antes de promover al nuevo, lo que se llama fencing. Patroni lo hace con una clave de líder con TTL en etcd: el primario que no puede renovarla se degrada solo.'
    }
  ],
  solution: '<ul><li>Read-your-writes y lecturas monótonas se resuelven con el mismo dato: una posición del WAL que viaja con el cliente y que ninguna réplica más atrasada puede atender.</li><li><code>ANY 1</code> entre dos réplicas no pierde commits confirmados y aguanta la caída de una; <code>FIRST 1</code> frena todo si cae la elegida.</li><li>Un timeout no es un rollback: los préstamos llevan una clave de idempotencia.</li><li>Antes de promover, se cierra el paso al viejo primario. Al sumarlo de nuevo, con <code>pg_rewind</code>, se pierde lo que haya escrito por su cuenta.</li></ul>'
});
