/* Animaciones de CQRS y de transacciones distribuidas (M05), sobre SD.flowAnim de sim-dbflow.js.
   <div data-sim="cqrs">    comandos y consultas separados, proyección, retraso y read-your-writes
   <div data-sim="twopc">   two-phase commit: todos dicen sí, uno dice no, el coordinador se cae
   <div data-sim="saga">    saga coreografiada y orquestada, con y sin compensación
   <div data-calc="igid">   id de 64 bits al estilo de Instagram: tiempo, shard lógico y secuencia */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h;
  function M(f, t, k, l) { return [f, t, k, l]; }
  function S(m, say, set) { return { m: m, say: say, set: set || null }; }

  /* ======================= CQRS ======================= */

  var CQ = {
    U: { x: 8, y: 128, w: 120, h: 76, name: 'Cliente', c: '--l-client' },
    CMD: { x: 186, y: 12, w: 160, h: 86, name: 'Comandos', sub: 'POST, PUT, DELETE', c: '--l-service' },
    QRY: { x: 186, y: 236, w: 160, h: 86, name: 'Consultas', sub: 'GET', c: '--l-service' },
    W: { x: 404, y: 12, w: 170, h: 96, name: 'Modelo de escritura', sub: 'normalizado', c: '--l-db' },
    R: { x: 404, y: 226, w: 170, h: 96, name: 'Modelo de lectura', sub: 'desnormalizado', c: '--l-cache' },
    P: { x: 606, y: 120, w: 120, h: 92, name: 'Proyector', sub: 'lee cambios', c: '--l-queue' }
  };
  var CQE = [['U', 'CMD'], ['U', 'QRY'], ['CMD', 'W'], ['QRY', 'R'], ['W', 'P'], ['P', 'R']];
  var CQRS = {
    title: 'CQRS: un modelo para escribir y otro para leer', aria: 'Cliente, API de comandos y de consultas, modelo de escritura, proyector y modelo de lectura', vbw: 734, vbh: 330,
    scenes: [
      { id: 'flujo', name: 'Un comando y una consulta', nodes: CQ, edges: CQE,
        init: { W: { v: ['pedidos: 41'] }, R: { v: ['resumen: 41 filas'] } },
        def: 'Command Query Responsibility Segregation: las escrituras y las lecturas usan modelos de datos distintos. El de escritura protege las reglas; el de lectura tiene la forma exacta de cada pantalla.',
        rows: [['Ganas', 'Cada lado se optimiza y escala por separado: escrituras con restricciones y sin duplicados, lecturas sin JOIN.'], ['Pagas', 'Dos modelos que mantener, y el de lectura va atrasado unos milisegundos o segundos.'], ['Úsalo para', 'Lecturas mucho más frecuentes o más complejas que las escrituras: feeds, tableros, búsquedas, historiales.']],
        steps: [
          S([M('U', 'CMD', 'write', 'POST /pedidos')], 'El cliente crea un pedido. Los comandos cambian el estado y no devuelven datos para mostrar, solo si salió bien.', {}),
          S([M('CMD', 'W', 'write', 'INSERT pedido + líneas')], 'El modelo de escritura está normalizado: <code>pedidos</code>, <code>lineas_pedido</code>, <code>productos</code>, con claves foráneas y <code>CHECK</code>. Inserta el pedido y sus líneas en una transacción.', { W: { st: 'ok', v: ['pedidos: 42', 'cambio en el log'] } }),
          S([M('W', 'CMD', 'ok', 'COMMIT'), M('CMD', 'U', 'ok', '201 Created')], 'Confirmado. El comando responde.', {}),
          S([M('W', 'P', 'async', 'PedidoCreado')], 'El proyector lee el cambio en segundo plano: desde el log de cambios (CDC) o desde una tabla outbox que se escribió en la misma transacción (M07).', { W: { st: '', v: ['pedidos: 42'] }, P: { st: 'on', v: ['evento 42'] } }),
          S([M('P', 'R', 'write', 'UPSERT resumen')], 'Calcula la fila que necesita la pantalla "mis pedidos" (cliente, total, cantidad de productos, estado y la foto del primero) y la guarda ya armada.', { P: { st: '', v: [] }, R: { st: 'ok', v: ['resumen: 42 filas'] } }),
          S([M('U', 'QRY', 'req', 'GET /mis-pedidos')], 'El cliente abre su lista de pedidos.', { R: { st: '' } }),
          S([M('QRY', 'R', 'req', 'SELECT … WHERE cliente')], 'La consulta lee el modelo de lectura: una tabla, un índice, sin JOIN ni <code>GROUP BY</code>.', {}),
          S([M('R', 'QRY', 'res', 'filas listas'), M('QRY', 'U', 'ok', '200')], 'Lectura de un milisegundo. El trabajo de armar la fila se hizo una vez, al escribir, y no en cada una de las miles de lecturas.', {})
        ] },
      { id: 'lag', name: 'Leer antes de la proyección', nodes: CQ, edges: CQE,
        init: { W: { v: ['pedidos: 41'] }, R: { v: ['resumen: 41 filas'] } },
        def: 'El modelo de lectura se actualiza después del commit. Si el cliente lee en ese hueco, no ve lo que acaba de escribir.',
        rows: [['La clave', 'Es el mismo problema que leer de una réplica atrasada: falta read-your-writes. 5.10 trae las soluciones.']],
        steps: [
          S([M('U', 'CMD', 'write', 'POST /pedidos')], 'El cliente crea un pedido.', {}),
          S([M('CMD', 'W', 'write', 'INSERT'), M('CMD', 'U', 'ok', '201 Created')], 'Confirmado en el modelo de escritura.', { W: { st: 'ok', v: ['pedidos: 42'] } }),
          S([M('U', 'QRY', 'req', 'GET /mis-pedidos')], 'La app redirige enseguida a "mis pedidos".', { W: { st: '' } }),
          S([M('QRY', 'R', 'req', 'SELECT')], 'El proyector todavía no procesó el evento: el resumen tiene 41 filas.', { R: { st: 'warn', v: ['resumen: 41 filas', 'falta el 42'] } }),
          S([M('R', 'QRY', 'fail', '41 pedidos'), M('QRY', 'U', 'fail', 'falta el nuevo')], 'El usuario no ve su pedido y piensa que falló. Algunos lo vuelven a crear.', {}),
          S([M('W', 'P', 'async', 'PedidoCreado'), M('P', 'R', 'write', 'UPSERT')], 'Cien milisegundos después llega la proyección. El dato nunca se perdió; se leyó demasiado pronto.', { R: { st: 'ok', v: ['resumen: 42 filas'] } })
        ] },
      { id: 'ryw', name: 'Read-your-writes con versión', nodes: CQ, edges: CQE.concat([['QRY', 'W']]),
        init: { W: { v: ['versión: 41'] }, R: { v: ['proyectado hasta: 41'] } },
        def: 'El comando devuelve la versión que escribió. La consulta exige al menos esa versión: si el modelo de lectura no llegó, espera un poco o lee del modelo de escritura.',
        rows: [['La clave', 'Solo quien escribió paga la espera o la lectura cara. Los demás leen el modelo de lectura como siempre.']],
        steps: [
          S([M('U', 'CMD', 'write', 'POST /pedidos')], 'El cliente crea un pedido.', {}),
          S([M('CMD', 'W', 'write', 'INSERT'), M('CMD', 'U', 'ok', '201 · versión 42')], 'El comando responde con la versión que produjo (un número de secuencia, un LSN o un <code>updated_at</code>). El cliente la guarda.', { W: { st: 'ok', v: ['versión: 42'] } }),
          S([M('U', 'QRY', 'req', 'GET ?min_version=42')], 'La consulta lleva la versión mínima que el cliente necesita ver.', { W: { st: '' } }),
          S([M('QRY', 'R', 'req', '¿llegaste a 42?')], 'El modelo de lectura anota hasta qué versión proyectó: 41.', { R: { st: 'warn', v: ['proyectado hasta: 41'] } }),
          S([M('QRY', 'W', 'req', 'SELECT del pedido 42')], 'No llegó. Para este usuario, y solo para él, la consulta lee el pedido del modelo de escritura y lo agrega a la lista. Otra opción es esperar unos milisegundos y volver a preguntar.', {}),
          S([M('QRY', 'U', 'ok', '200 · 42 pedidos')], 'El usuario ve su pedido. Los demás usuarios siguen leyendo el modelo de lectura, barato.', {}),
          S([M('W', 'P', 'async', 'PedidoCreado'), M('P', 'R', 'write', 'UPSERT')], 'La proyección llega y la próxima lectura ya no necesita el desvío.', { R: { st: 'ok', v: ['proyectado hasta: 42'] } })
        ] },
      { id: 'rebuild', name: 'Reconstruir la vista', nodes: CQ, edges: CQE,
        init: { W: { v: ['10 M pedidos', 'log desde el inicio'] }, R: { st: 'fail', v: ['tabla con errores'] } },
        def: 'El modelo de lectura es derivado: si tiene un error, o si una pantalla nueva necesita otra forma, se borra y se vuelve a calcular desde la fuente.',
        rows: [['La clave', 'Nunca escribas a mano en el modelo de lectura. Si solo se llena desde la fuente, siempre se puede reconstruir.']],
        steps: [
          S([], 'Un error en el proyector calculó mal los totales durante una semana.', {}),
          S([M('P', 'R', 'write', 'crear resumen_v2')], 'Se despliega el proyector corregido, que escribe en una tabla nueva mientras la vieja sigue respondiendo.', { R: { st: 'warn', v: ['v1 responde', 'v2 vacía'] } }),
          S([M('W', 'P', 'async', 'repetir desde el inicio')], 'El proyector relee todos los cambios desde el principio (o recorre la tabla fuente en lotes) y llena la v2.', { P: { st: 'on', v: ['procesando…'] } }),
          S([M('P', 'R', 'write', '10 M filas')], 'Cuando la v2 alcanza el presente, las consultas pasan a leerla y la v1 se borra.', { P: { st: '', v: [] }, R: { st: 'ok', v: ['v2 al día'] } })
        ] }
    ]
  };

  /* ======================= Two-phase commit ======================= */

  var TP = {
    A: { x: 8, y: 124, w: 134, h: 82, name: 'Aplicación', c: '--l-client' },
    K: { x: 226, y: 104, w: 200, h: 122, name: 'Coordinador', sub: 'con su propio log', c: '--l-service' },
    P1: { x: 526, y: 10, w: 200, h: 112, name: 'Base de pagos', c: '--l-db' },
    P2: { x: 526, y: 210, w: 200, h: 112, name: 'Base de inventario', c: '--l-db' }
  };
  var TWOPC = {
    title: 'Two-phase commit', aria: 'Una aplicación, un coordinador y dos bases participantes', vbw: 734, vbh: 330,
    scenes: [
      { id: 'ok', name: 'Todos dicen sí', nodes: TP,
        def: 'Una transacción que cobra en una base y descuenta stock en otra. Fase 1: el coordinador pregunta a cada participante si puede confirmar. Fase 2: si todos dijeron sí, ordena confirmar.',
        rows: [['La clave', 'Un participante que vota sí se compromete a poder confirmar pase lo que pase, incluso si se reinicia. Por eso escribe todo en disco antes de votar.']],
        steps: [
          S([M('A', 'K', 'req', 'confirmar todo')], 'La aplicación ya hizo su trabajo en las dos bases y pide confirmar.', { K: { st: 'on', v: ['fase 1: preparar'] }, P1: { v: ['cobro de 100'] }, P2: { v: ['stock − 1'] } }),
          S([M('K', 'P1', 'req', 'PREPARE'), M('K', 'P2', 'req', 'PREPARE')], 'Fase 1. En PostgreSQL es <code>PREPARE TRANSACTION \'tx-77\'</code>: la base guarda la transacción en disco, con sus locks, lista para confirmar o deshacer.', {}),
          S([M('P1', 'K', 'ok', 'SÍ'), M('P2', 'K', 'ok', 'SÍ')], 'Las dos votan sí. Desde ahora no pueden echarse atrás por su cuenta.', { P1: { st: 'warn', v: ['preparada', 'locks retenidos'] }, P2: { st: 'warn', v: ['preparada', 'locks retenidos'] } }),
          S([], 'El coordinador escribe la decisión <b>COMMIT</b> en su log. Ese registro es el instante en que la transacción global queda confirmada.', { K: { st: 'ok', v: ['decisión: COMMIT', 'en su log'] } }),
          S([M('K', 'P1', 'ok', 'COMMIT PREPARED'), M('K', 'P2', 'ok', 'COMMIT PREPARED')], 'Fase 2: ordena confirmar a cada participante.', { P1: { st: 'ok', v: ['confirmada'] }, P2: { st: 'ok', v: ['confirmada'] } }),
          S([M('K', 'A', 'ok', 'OK')], 'Dos idas y vueltas a cada participante y dos escrituras a disco en cada uno, más la del coordinador. Y los locks estuvieron tomados durante todo el protocolo.', {})
        ] },
      { id: 'no', name: 'Uno dice no', nodes: TP,
        def: 'Si un participante no puede confirmar, vota no y la transacción global se deshace en todos.',
        rows: [['La clave', 'Basta un no, o un participante que no contesta a tiempo, para abortar todo.']],
        steps: [
          S([M('A', 'K', 'req', 'confirmar todo')], 'Mismo comienzo.', { K: { st: 'on', v: ['fase 1: preparar'] }, P1: { v: ['cobro de 100'] }, P2: { v: ['stock − 1'] } }),
          S([M('K', 'P1', 'req', 'PREPARE'), M('K', 'P2', 'req', 'PREPARE')], 'Fase 1.', {}),
          S([M('P1', 'K', 'ok', 'SÍ'), M('P2', 'K', 'fail', 'NO')], 'Pagos vota sí. Inventario no puede: el <code>CHECK (stock &gt;= 0)</code> falló.', { P1: { st: 'warn', v: ['preparada'] }, P2: { st: 'fail', v: ['CHECK falló'] } }),
          S([], 'El coordinador escribe <b>ABORT</b> en su log.', { K: { st: 'fail', v: ['decisión: ABORT'] } }),
          S([M('K', 'P1', 'fail', 'ROLLBACK PREPARED')], 'Pagos, que estaba preparada, deshace el cobro. Inventario ya se deshizo sola al votar no.', { P1: { st: '', v: ['cobro deshecho'] }, P2: { st: '', v: ['sin cambios'] } }),
          S([M('K', 'A', 'fail', 'ERROR')], 'Atomicidad entre dos bases: o las dos, o ninguna.', {})
        ] },
      { id: 'block', name: 'El coordinador se cae', nodes: TP,
        def: 'El problema de fondo del 2PC: si el coordinador se cae después de que todos votaron sí, los participantes no pueden decidir solos.',
        rows: [['La clave', '2PC es un protocolo bloqueante. Un participante preparado no puede confirmar (quizá otro votó no) ni deshacer (quizá el coordinador ya decidió confirmar). Espera, con los locks tomados.']],
        steps: [
          S([M('A', 'K', 'req', 'confirmar todo')], 'Mismo comienzo.', { K: { st: 'on', v: ['fase 1: preparar'] } }),
          S([M('K', 'P1', 'req', 'PREPARE'), M('K', 'P2', 'req', 'PREPARE')], 'Fase 1.', {}),
          S([M('P1', 'K', 'ok', 'SÍ'), M('P2', 'K', 'ok', 'SÍ')], 'Las dos votan sí.', { P1: { st: 'warn', v: ['preparada', 'locks retenidos'] }, P2: { st: 'warn', v: ['preparada', 'locks retenidos'] } }),
          S([], 'El coordinador se cae justo antes de enviar la decisión.', { K: { st: 'down', v: [] } }),
          S([], 'Los participantes quedan <b>en duda</b>. En PostgreSQL aparecen en <code>pg_prepared_xacts</code> y siguen reteniendo sus locks: toda transacción que quiera tocar esas filas espera. Pueden pasar minutos u horas.', { P1: { st: 'fail', v: ['en duda', 'filas bloqueadas'] }, P2: { st: 'fail', v: ['en duda', 'filas bloqueadas'] } }),
          S([], 'El coordinador vuelve, lee su log y encuentra la decisión. Si no alcanzó a escribirla, la decisión es ABORT.', { K: { st: 'on', v: ['lee su log'] } }),
          S([M('K', 'P1', 'ok', 'COMMIT PREPARED'), M('K', 'P2', 'ok', 'COMMIT PREPARED')], 'Recién ahora se liberan los locks. Por esto PostgreSQL trae <code>max_prepared_transactions = 0</code> por defecto, y 2PC entre servicios se evita: se usa dentro de un sistema que controla a coordinador y participantes, como una base distribuida.', { K: { st: 'ok', v: ['decisión: COMMIT'] }, P1: { st: 'ok', v: ['confirmada'] }, P2: { st: 'ok', v: ['confirmada'] } })
        ] }
    ]
  };

  /* ======================= Sagas ======================= */

  var CH = {
    O: { x: 8, y: 116, w: 150, h: 100, name: 'Pedidos', c: '--l-service' },
    B: { x: 252, y: 116, w: 170, h: 100, name: 'Broker', sub: 'Kafka', c: '--l-queue' },
    PG: { x: 540, y: 8, w: 186, h: 96, name: 'Pagos', c: '--l-service' },
    IN: { x: 540, y: 120, w: 186, h: 96, name: 'Inventario', c: '--l-service' },
    EN: { x: 540, y: 232, w: 186, h: 96, name: 'Envíos', c: '--l-service' }
  };
  var OR = {
    O: { x: 8, y: 116, w: 150, h: 100, name: 'Pedidos', c: '--l-service' },
    X: { x: 252, y: 104, w: 190, h: 124, name: 'Orquestador', sub: 'estado de la saga', c: '--l-queue' },
    PG: { x: 540, y: 8, w: 186, h: 96, name: 'Pagos', c: '--l-service' },
    IN: { x: 540, y: 120, w: 186, h: 96, name: 'Inventario', c: '--l-service' },
    EN: { x: 540, y: 232, w: 186, h: 96, name: 'Envíos', c: '--l-service' }
  };
  var SAGA = {
    title: 'Sagas: coreografía y orquestación', aria: 'Servicios de pedidos, pagos, inventario y envíos, conectados por un broker o por un orquestador', vbw: 734, vbh: 336,
    scenes: [
      { id: 'coreo', name: 'Coreografía', nodes: CH,
        def: 'Cada servicio hace su transacción local y publica un evento. Los demás reaccionan a los eventos que les interesan. Nadie dirige: la saga es la suma de las reacciones.',
        rows: [['Ganas', 'Servicios desacoplados, sin un punto central.'], ['Pagas', 'Nadie ve la saga completa: para saber en qué paso va un pedido hay que reconstruirlo desde los eventos, y los ciclos entre servicios aparecen sin que nadie los diseñe.'], ['Úsalo para', 'Sagas cortas, de dos a cuatro pasos, con pocos caminos de error.']],
        steps: [
          S([], 'Pedidos crea el pedido en estado <code>PENDIENTE</code> en su base, y en la misma transacción escribe el evento en su outbox.', { O: { st: 'on', v: ['pedido 7: PENDIENTE'] } }),
          S([M('O', 'B', 'async', 'PedidoCreado')], 'Publica <code>PedidoCreado</code>.', {}),
          S([M('B', 'PG', 'async', 'PedidoCreado')], 'Pagos está suscrito a ese evento: cobra en su propia transacción local.', { PG: { st: 'ok', v: ['cobro 7: OK'] } }),
          S([M('PG', 'B', 'async', 'PagoAprobado')], 'Y publica <code>PagoAprobado</code>.', {}),
          S([M('B', 'IN', 'async', 'PagoAprobado')], 'Inventario reacciona y reserva el stock.', { IN: { st: 'ok', v: ['reserva 7: OK'] } }),
          S([M('IN', 'B', 'async', 'StockReservado')], 'Publica <code>StockReservado</code>.', {}),
          S([M('B', 'EN', 'async', 'StockReservado'), M('B', 'O', 'async', 'StockReservado')], 'Envíos programa el despacho, y Pedidos, que también escucha, marca el pedido como confirmado.', { EN: { st: 'ok', v: ['envío 7: programado'] }, O: { st: 'ok', v: ['pedido 7: CONFIRMADO'] } }),
          S([], 'Cuatro transacciones locales, cada una en su base, encadenadas por eventos. No hubo ningún lock compartido entre servicios.', {})
        ] },
      { id: 'coreo-fail', name: 'Coreografía con compensación', nodes: CH,
        def: 'Si un paso falla, los pasos anteriores no se deshacen solos: cada servicio escucha el evento de fallo y ejecuta su compensación, una transacción nueva que revierte el efecto.',
        rows: [['La clave', 'Una compensación no borra el pasado: el cliente vio el cobro y después el reembolso. Durante ese rato, otros leyeron el pedido como pagado. Las sagas no tienen aislamiento.']],
        steps: [
          S([M('O', 'B', 'async', 'PedidoCreado')], 'Pedidos crea el pedido y publica el evento.', { O: { st: 'on', v: ['pedido 7: PENDIENTE'] } }),
          S([M('B', 'PG', 'async', 'PedidoCreado')], 'Pagos cobra.', { PG: { st: 'ok', v: ['cobro 7: OK'] } }),
          S([M('PG', 'B', 'async', 'PagoAprobado'), M('B', 'IN', 'async', 'PagoAprobado')], 'Inventario recibe el pago aprobado…', {}),
          S([M('IN', 'B', 'fail', 'StockAgotado')], '…pero no hay stock. Su transacción local no hace nada y publica <code>StockAgotado</code>.', { IN: { st: 'fail', v: ['sin stock'] } }),
          S([M('B', 'PG', 'fail', 'StockAgotado')], 'Pagos escucha <code>StockAgotado</code> y ejecuta su <b>compensación</b>: reembolsa el cobro.', { PG: { st: 'warn', v: ['reembolso 7: OK'] } }),
          S([M('PG', 'B', 'async', 'PagoReembolsado'), M('B', 'O', 'async', 'PagoReembolsado')], 'Publica <code>PagoReembolsado</code>, y Pedidos cancela el pedido.', { O: { st: 'fail', v: ['pedido 7: CANCELADO'] } }),
          S([], 'Para entender por qué se canceló el pedido 7 hay que juntar eventos de tres servicios. Por eso las sagas coreografiadas necesitan trazas (M11) y un id de saga en cada evento.', {})
        ] },
      { id: 'orq', name: 'Orquestación', nodes: OR,
        def: 'Un orquestador conoce todos los pasos: llama a cada servicio, guarda en su base en qué paso va cada saga y decide qué sigue.',
        rows: [['Ganas', 'La saga se lee en un solo lugar, el estado de cada pedido es una fila consultable y los timeouts y reintentos están centralizados.'], ['Pagas', 'Un componente más, que concentra lógica de negocio. Si se cae, retoma desde su estado guardado.'], ['Úsalo para', 'Sagas largas o con muchos caminos: pagos (M27), reservas, aprobaciones. Herramientas: Temporal, AWS Step Functions.']],
        steps: [
          S([M('O', 'X', 'req', 'iniciar saga del pedido 7')], 'Pedidos crea el pedido y le pide al orquestador que ejecute la saga.', { O: { st: 'on', v: ['pedido 7: PENDIENTE'] }, X: { st: 'on', v: ['paso 1: cobrar'] } }),
          S([M('X', 'PG', 'req', 'Cobrar 7')], 'El orquestador guarda "paso 1" en su base y llama a Pagos.', {}),
          S([M('PG', 'X', 'ok', 'OK')], 'Pagos confirma.', { PG: { st: 'ok', v: ['cobro 7: OK'] }, X: { v: ['paso 2: reservar'] } }),
          S([M('X', 'IN', 'req', 'Reservar 7')], 'Anota el avance y llama a Inventario.', {}),
          S([M('IN', 'X', 'ok', 'OK')], 'Reservado.', { IN: { st: 'ok', v: ['reserva 7: OK'] }, X: { v: ['paso 3: enviar'] } }),
          S([M('X', 'EN', 'req', 'Programar envío 7'), M('EN', 'X', 'ok', 'OK')], 'Envíos.', { EN: { st: 'ok', v: ['envío 7: programado'] } }),
          S([M('X', 'O', 'ok', 'saga completa')], 'El orquestador cierra la saga y avisa a Pedidos.', { X: { st: 'ok', v: ['saga 7: completa'] }, O: { st: 'ok', v: ['pedido 7: CONFIRMADO'] } })
        ] },
      { id: 'orq-fail', name: 'Orquestación con compensación', nodes: OR,
        def: 'Cuando un paso falla, el orquestador recorre hacia atrás los pasos ya hechos y llama a la compensación de cada uno.',
        rows: [['La clave', 'Las compensaciones también fallan. Tienen que ser idempotentes y reintentarse hasta que salgan, y cada paso necesita una clave de idempotencia para que un reintento no cobre dos veces.']],
        steps: [
          S([M('O', 'X', 'req', 'iniciar saga del pedido 7')], 'Mismo comienzo.', { O: { st: 'on', v: ['pedido 7: PENDIENTE'] }, X: { st: 'on', v: ['paso 1: cobrar'] } }),
          S([M('X', 'PG', 'req', 'Cobrar 7'), M('PG', 'X', 'ok', 'OK')], 'El cobro sale bien.', { PG: { st: 'ok', v: ['cobro 7: OK'] }, X: { v: ['paso 2: reservar'] } }),
          S([M('X', 'IN', 'req', 'Reservar 7')], 'Llama a Inventario.', {}),
          S([M('IN', 'X', 'fail', 'sin stock')], 'Falla: no hay stock.', { IN: { st: 'fail', v: ['sin stock'] }, X: { st: 'warn', v: ['compensando', 'paso 1 hacia atrás'] } }),
          S([M('X', 'PG', 'warn', 'Reembolsar 7')], 'El orquestador recorre la lista de pasos hechos al revés: el único fue el cobro, así que llama a su compensación.', {}),
          S([M('PG', 'X', 'ok', 'OK')], 'Reembolsado.', { PG: { st: 'warn', v: ['reembolso 7: OK'] } }),
          S([M('X', 'O', 'fail', 'saga cancelada')], 'La saga termina cancelada, y queda escrito en un solo lugar qué pasó y por qué.', { X: { st: 'fail', v: ['saga 7: cancelada', 'motivo: sin stock'] }, O: { st: 'fail', v: ['pedido 7: CANCELADO'] } })
        ] }
    ]
  };

  /* ======================= Id al estilo de Instagram ======================= */

  function initIgId(host) {
    var EPOCH = Date.UTC(2011, 0, 1);
    var st = { user: 31341, shards: 2000, servers: 4, when: '2011-09-09T17:00', seq: 5001 };
    var out = h('div', { 'aria-live': 'polite' });
    function field(key, label, type, attrs) {
      var id = 'ig' + key + Math.random().toString(36).slice(2, 6);
      var a = { id: id, type: type, value: st[key] };
      Object.keys(attrs || {}).forEach(function (k) { a[k] = attrs[k]; });
      var inp = h('input', a);
      inp.addEventListener('input', function () { st[key] = type === 'number' ? Math.max(0, parseInt(inp.value, 10) || 0) : inp.value; render(); });
      return h('div', { class: 'field' }, [h('label', { for: id, text: label }), inp]);
    }
    function bits(v, n) { var s = v.toString(2); while (s.length < n) s = '0' + s; return s; }

    function render() {
      out.innerHTML = '';
      var shards = Math.max(1, Math.min(8192, st.shards)), servers = Math.max(1, Math.min(shards, st.servers));
      var t = Date.parse(st.when + ':00Z');
      if (isNaN(t)) t = EPOCH;
      var ms = Math.max(0, t - EPOCH);
      var shard = st.user % shards, seq = st.seq % 1024;
      var id = (BigInt(ms) << 23n) | (BigInt(shard) << 10n) | BigInt(seq);
      var per = Math.ceil(shards / servers), server = Math.floor(shard / per) + 1;
      var tb = bits(BigInt(ms), 41), sb = bits(BigInt(shard), 13), qb = bits(BigInt(seq), 10);
      var row = h('div', { class: 'ig-bits', role: 'img', 'aria-label': 'Los 64 bits del id: 41 de tiempo, 13 de shard y 10 de secuencia' }, [
        h('span', { class: 'ig-seg ig-t' }, [h('b', { text: '41 bits · milisegundos' }), h('code', { text: tb })]),
        h('span', { class: 'ig-seg ig-s' }, [h('b', { text: '13 · shard' }), h('code', { text: sb })]),
        h('span', { class: 'ig-seg ig-q' }, [h('b', { text: '10 · secuencia' }), h('code', { text: qb })])
      ]);
      out.appendChild(h('div', { class: 'sim-scroll' }, [row]));
      var stats = h('div', { class: 'sim-stats' });
      function stat(l, v, cls) { stats.appendChild(h('div', { class: 'sim-stat' + (cls ? ' ' + cls : '') }, [h('span', { text: l }), h('b', { text: v })])); }
      stat('Milisegundos desde la época', SD.fmt.num(ms));
      stat('Shard lógico = ' + SD.fmt.num(st.user) + ' mod ' + SD.fmt.num(shards), String(shard));
      stat('Secuencia = ' + SD.fmt.num(st.seq) + ' mod ' + SD.fmt.num(1024), String(seq));
      stat('Id resultante', id.toString(), 'ig-id');
      stat('Servidor físico (' + per + ' shards por servidor)', 'pg-' + (server < 10 ? '0' : '') + server + ', esquema shard' + shard);
      out.appendChild(stats);
      out.appendChild(h('p', { class: 'sim-note', html: 'Para leer un objeto, la aplicación no consulta ningún índice: hace <code>(id &gt;&gt; 10) &amp; 8191</code> y obtiene ' + shard + ', busca en su mapa qué servidor tiene ese shard y va directo. Los ids salen ordenados por tiempo, y cada shard genera hasta 1&#8239;024 por milisegundo sin coordinarse con nadie.' }));
    }

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Un id de 64 bits que dice dónde vive el dato' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [
        field('user', 'Id del usuario dueño', 'number', { min: 0 }),
        field('shards', 'Shards lógicos', 'number', { min: 1, max: 8192 }),
        field('servers', 'Servidores físicos', 'number', { min: 1, max: 64 }),
        field('when', 'Momento (UTC)', 'datetime-local', {}),
        field('seq', 'Valor de la secuencia del shard', 'number', { min: 0 })
      ]),
      out
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Época propia: 1 de enero de 2011, como en el ejemplo del artículo de Instagram. El reparto de shards lógicos entre servidores es ilustrativo: rangos contiguos del mismo tamaño.' }));
    render();
  }

  SD.ready(function () {
    function each(sel, cfg) { document.querySelectorAll(sel).forEach(function (el) { SD.flowAnim(el, cfg); }); }
    each('[data-sim="cqrs"]', CQRS);
    each('[data-sim="twopc"]', TWOPC);
    each('[data-sim="saga"]', SAGA);
    document.querySelectorAll('[data-calc="igid"]').forEach(initIgId);
  });
})();
