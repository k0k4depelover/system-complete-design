/* Decisiones guiadas de A08 (Un solo líder). Formato en core/exercise.js. */

SD.defineExercise('a08-lider', {
  title: 'un solo despachador de recordatorios',
  scenario: '<p>El servicio de recordatorios corre como en esta guía: tres réplicas en k3s, un Lease con 15, 10 y 2&#8239;s, un despachador que lee hasta 50 vencidos de una vez y los manda a 200&#8239;ms cada uno, y un proveedor que acepta <code>Idempotency-Key</code> y <code>Fencing-Token</code>. Tienes que tomar ocho decisiones.</p>',
  steps: [
    {
      id: 'scheduled', type: 'single',
      prompt: 'La primera versión no tiene líder: cada réplica tiene un <code>@Scheduled(fixedDelay = 1000)</code> que lee los vencidos, los manda y los anota con <code>UPDATE … WHERE delivered_at IS NULL</code>. ¿Qué pasa con un recordatorio?',
      options: [
        'Sale una vez: el <code>UPDATE</code> condicional deja que lo anote una sola réplica.',
        'Puede salir hasta tres veces: cada réplica que lo leyó antes de que otra lo anotara lo manda. Y la base dice que salió una vez, porque el <code>UPDATE</code> solo protege la marca, no el envío.',
        'Spring coordina los <code>@Scheduled</code> entre réplicas del mismo Deployment, así que solo una lo manda.',
        'Solo despacha la réplica que arrancó primero, porque las otras encuentran la tabla bloqueada.'
      ],
      answer: 1,
      explain: 'El compare-and-set decide quién anota, pero el SMS ya salió antes de anotar. Con tres réplicas que leen dentro del mismo segundo, cada una manda lo que leyó desde la memoria: es lo que mide la falla "sin líder", con 50 a 60 duplicados para 30 recordatorios. <code>@Scheduled</code> no sabe nada de otras réplicas: cada proceso tiene su propio reloj.'
    },
    {
      id: 'plazos', type: 'single',
      prompt: 'Con <code>leaseDuration</code> 15&#8239;s, <code>renewDeadline</code> 10&#8239;s y <code>retryPeriod</code> 2&#8239;s, la JVM del líder muere con <code>kill -KILL</code> y no suelta el Lease. ¿Cuánto tarda otra réplica en tomar el turno?',
      options: [
        'Unos 2&#8239;s: lo que tarda una candidata en volver a preguntar.',
        'Exactamente 10&#8239;s, el <code>renewDeadline</code>.',
        'Entre 13 y 19.4&#8239;s: la última renovación fue hasta 2&#8239;s antes del kill, el Lease vence 15&#8239;s después de ella, y una candidata lo nota en su próxima pregunta, hasta 4.4&#8239;s más tarde.',
        'Exactamente 15&#8239;s, el <code>leaseDuration</code>, medidos desde el kill.'
      ],
      answer: 2,
      explain: 'El vencimiento se cuenta desde la última renovación, no desde la muerte, y las candidatas preguntan cada 2&#8239;s más hasta un 120&#8239;% al azar. El <code>renewDeadline</code> es otra cosa: el plazo que tiene el propio líder para renovar antes de rendirse. Con un relevo ordenado, el Lease queda en 1&#8239;s y la espera baja a unos 1 + 4.4&#8239;s: es lo que vale soltarlo al apagarse.'
    },
    {
      id: 'chequeo', type: 'single',
      prompt: 'Para que el líder congelado no mande nada al despertar, ¿qué comprobación lo frena de verdad?',
      options: [
        'Preguntar <code>isLeader()</code> antes de cada entrega, no solo antes del lote.',
        'Leer el Lease del API antes de cada entrega y mandar solo si el dueño sigue siendo uno mismo.',
        'Que el proveedor compare el token de cada pedido con el más alto que ya vio, en la misma transacción en que anota el mensaje, y rechace los más bajos.',
        'Bajar <code>leaseDuration</code> a 3&#8239;s, para que el zombi dure menos.'
      ],
      answer: 2,
      explain: 'Las dos primeras son comprobar y después actuar: el proceso se puede congelar entre la comprobación y el envío, y al despertar manda sin volver a mirar. <code>isLeader()</code> es además una bandera local, que cambia cuando corre el hilo de renovación, congelado también. La comprobación tiene que estar donde ocurre el efecto, en el que recibe la escritura, y ser atómica con ella. Un Lease más corto achica la ventana, no la cierra, y suma relevos falsos con cada pausa del recolector de basura.'
    },
    {
      id: 'token', type: 'single',
      prompt: '¿Qué usas como fencing token?',
      options: [
        '<code>leaseTransitions</code>: sube en 1 cada vez que el Lease cambia de dueño y nunca baja, mientras nadie borre el Lease.',
        '<code>renewTime</code>: es más reciente en cada renovación.',
        'El nombre del pod que tiene el Lease.',
        'Un contador que cada réplica sube en memoria cada vez que gana.'
      ],
      answer: 0,
      explain: 'El token tiene que ordenar los turnos: el de un líder nuevo, siempre mayor que el de cualquier líder anterior. <code>leaseTransitions</code> lo escribe el que toma el Lease, con una escritura que el API rechaza con 409 si otro escribió en medio, así que dos líderes no pueden quedar con el mismo número. <code>renewTime</code> cambia con cada renovación del mismo líder y sale del reloj de quien lo escribe: un reloj atrasado da un token más bajo. El nombre de un pod no tiene orden, y un contador en memoria es de cada réplica, sin acuerdo entre ellas. Si borras el Lease, <code>leaseTransitions</code> vuelve a 0, y la valla también tiene que volver.'
    },
    {
      id: 'proveedor-real', type: 'single',
      prompt: 'El proveedor de SMS de verdad acepta <code>Idempotency-Key</code>, pero no sabe nada de fencing tokens. ¿Qué haces?',
      options: [
        'Mandas el token igual: aunque el proveedor lo ignore, deja rastro.',
        'Solo la clave: frena los repetidos, y con eso alcanza.',
        'Pones la valla en algo tuyo, antes del proveedor: el despachador reclama cada envío en tu base con su token, y la base rechaza los tokens viejos. La clave cubre lo que queda, el envío que estaba en vuelo cuando el líder se congeló.',
        'Bajas el lote a un recordatorio, para que el zombi tenga menos en memoria.'
      ],
      answer: 2,
      explain: 'La valla solo puede vivir en algo que controlas y que ve todas las escrituras. Si el despachador tiene que reclamar cada envío en tu base con su token antes de llamar al proveedor, un líder viejo que despierta rebota en el reclamo, igual que aquí rebota en el proveedor de mentira. La clave sola no frena los cancelados: para el proveedor son claves nuevas. Un lote de uno achica el daño, pero el que estaba congelado igual manda ese uno.'
    },
    {
      id: 'shedlock', type: 'single',
      prompt: 'Con ShedLock, alguien baja <code>lockAtMostFor</code> de 20 a 5&#8239;s para que el turno cambie más rápido si una réplica se cae. Un lote de 50 tarda 50 × 200&#8239;ms = 10&#8239;s. ¿Qué pasa en un día normal, sin caídas?',
      options: [
        'Nada malo: el candado se suelta al terminar cada lote, y el plazo solo importa si una réplica se cae.',
        'El candado vence a mitad de cada lote largo: otra réplica lo toma y manda los pendientes que la primera todavía no anotó, sin que nadie esté congelado.',
        'ShedLock extiende el candado mientras la tarea corre, así que da igual.',
        'La segunda réplica espera en fila a que la primera termine.'
      ],
      answer: 1,
      explain: '<code>lockAtMostFor</code> es lo que dura el candado si nadie lo suelta, y nadie lo extiende: tiene que ser bastante más largo que la tarea. Con 5&#8239;s, cualquier lote de más de 25 recordatorios convive con otro. Extenderlo es lo que hace <code>KeepAliveLockProvider</code>, que hay que configurar aparte, y un proceso congelado no extiende nada. Y una réplica que no consigue el candado se salta la vuelta: no espera en fila.'
    },
    {
      id: 'skip-locked', type: 'single',
      prompt: 'Otra forma, sin líder: cada réplica abre una transacción, toma hasta 50 vencidos con <code>SELECT … FOR UPDATE SKIP LOCKED</code>, los manda, los anota y hace commit. ¿Qué cambia?',
      options: [
        'Nada: cada recordatorio sale tres veces, porque las tres réplicas leen lo mismo.',
        'No funciona detrás de PgBouncer en modo transaction.',
        'Las tres despachan a la vez sin pisarse, porque cada una se salta las filas que otra tiene bloqueadas. El costo: filas bloqueadas y una conexión tomada mientras esperas al proveedor, y un <code>DELETE</code> que espera al commit. Y no elimina al zombi: si PostgreSQL corta la transacción de la réplica congelada, otra toma sus filas, y la congelada manda igual al despertar.',
        'Elimina al zombi: mientras la réplica congelada tenga la transacción abierta, nadie más manda sus filas.'
      ],
      answer: 2,
      explain: 'SKIP LOCKED reparte el trabajo sin Lease, y funciona en modo transaction porque todo pasa dentro de una transacción. Pero el envío sigue fuera de la base. Mientras la congelada tenga la transacción abierta, sus filas quedan quietas. Si esa transacción se corta, por ejemplo con <code>idle_in_transaction_session_timeout</code>, otra réplica toma las filas, y la congelada, al despertar, manda lo que tenía en memoria antes de enterarse de que su commit falla. Sigue haciendo falta la clave, y para los cancelados, un reclamo con token.'
    },
    {
      id: 'corto', type: 'single',
      prompt: 'Con la clave y la valla encendidas, un congelamiento de 5&#8239;s manda igual los 25 recordatorios cancelados. ¿Por qué, y qué lo arregla?',
      options: [
        'La valla tiene un error: tiene que rechazar también los tokens iguales.',
        'Nadie tomó el turno, así que no hubo un token más alto: el líder seguía siendo legítimo, y mandó entero un lote leído antes de las cancelaciones. Lo arregla reclamar cada recordatorio en la base justo antes de mandarlo, y que cancelar uno reclamado responda 409.',
        'Hay que bajar <code>renewDeadline</code> a 3&#8239;s, para que un congelamiento de 5&#8239;s también cambie de líder.',
        'La clave de idempotencia tendría que haberlos frenado: está mal configurada.'
      ],
      answer: 1,
      explain: 'La valla frena a un líder viejo, no a un líder lento. Aquí el problema no es de liderazgo: la decisión de mandar se tomó con una lectura vieja. La carrera entre mandar y cancelar tiene que decidirse en la fila: el despachador la reclama con un <code>UPDATE</code> condicional, y la cancelación solo gana si llega antes. Rechazar tokens iguales frenaría al propio líder en cada entrega, y la clave solo deduplica: un cancelado que sale una vez no es un repetido.'
    }
  ],
  solution: '<ul>' +
    '<li>Sin líder, un <code>@Scheduled</code> en cada réplica manda lo mismo varias veces, y la base no se entera.</li>' +
    '<li>Un Lease da un líder la mayor parte del tiempo, con relevos de segundos: de 13 a 19.4&#8239;s si el líder muere, hasta unos 6.6&#8239;s si suelta el Lease al apagarse.</li>' +
    '<li>Ninguna comprobación del lado del líder frena a un líder congelado. Lo frena el que recibe la escritura, comparando un token que solo sube: aquí, <code>leaseTransitions</code>.</li>' +
    '<li>La clave de idempotencia absorbe los repetidos, pero no los cancelados. Si el proveedor no acepta tokens, la valla va en tu base, en un reclamo antes de cada envío.</li>' +
    '<li>ShedLock y SKIP LOCKED reparten el trabajo sin Lease, pero no dan token: con ellos, la clave es la única defensa contra el zombi.</li>' +
    '<li>Lo que la valla no cubre, una lectura vieja de un líder que sigue siéndolo, lo cubre reclamar cada fila justo antes de mandarla.</li>' +
    '</ul>'
});
