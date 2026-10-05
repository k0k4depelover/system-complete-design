/* Mapa del M21: el metering de una API de LLM, del stream a la factura. Todo es un diseño de referencia para la flota
   del M19 (22.5 millones de eventos de uso por día); lo documentado por terceros (Kafka, Flink, ClickHouse, Stripe)
   va marcado en cada caja. Se lee de arriba abajo: clientes, medir y admitir, el log, procesar, dinero y cobro. */
SD.defineMap('m21-metering', {
  title: 'Metering y facturación',
  intro: 'El camino de cada token hasta la factura. Arriba, el cliente y el gateway que mide; en el medio, el log de Kafka; abajo, el procesador que deduplica y agrega, el rating, el saldo prepagado, los topes, la factura y la conciliación que corrige lo que falló. Los escenarios recorren una request normal, un duplicado, un evento tardío, un gateway que muere, un saldo que se acaba, un tope, el cierre del mes, un cobro fallido y la conciliación.',
  start: 'gateway',
  groups: [
    { id: 'g-cli', label: 'Clientes', x: 20, y: 54, w: 2140, h: 110 },
    { id: 'g-medir', label: 'Medir y admitir: milisegundos', x: 20, y: 264, w: 2140, h: 110 },
    { id: 'g-log', label: 'El log', x: 20, y: 474, w: 2140, h: 110 },
    { id: 'g-proc', label: 'Procesar y conciliar: segundos a horas', x: 20, y: 684, w: 2140, h: 110 },
    { id: 'g-dinero', label: 'Dinero: precio, saldo y ledger', x: 20, y: 894, w: 2140, h: 110 },
    { id: 'g-cobro', label: 'Facturar y cobrar: fin del ciclo', x: 20, y: 1104, w: 2140, h: 110 }
  ],
  nodes: [
    /* ---------- Clientes ---------- */
    { id: 'cliente', layer: 'client', label: 'org_7', sub: 'una empresa que usa la API', x: 640, y: 120,
      info: {
        resp: '<p>Una organización con dos proyectos y créditos prepagados. Manda requests de streaming con sus claves de API, recibe alertas cuando su gasto cruza los umbrales y, si llega al tope que fijó, recibe errores en lugar de respuestas.</p>',
        api: '<pre data-lang="http"><code>POST /v1/messages\nx-api-key: sk-…\n{"model": "modelo-m", "stream": true, "max_tokens": 8000, …}\n\nGET /v1/organizations/usage_report?starting_at=2026-10-01&amp;bucket_width=1h</code></pre><p>La API de uso devuelve los mismos agregados por hora que ve la consola y que usa la factura.</p>',
        data: '<p>Sus propios logs: muchos clientes grandes guardan el <code>usage</code> de cada respuesta y comparan la suma con la factura. Por eso cada línea tiene que poder bajar hasta los <code>request_id</code>.</p>',
        fail: '<ul><li><b>Se queda sin saldo a mitad de un stream:</b> recibe un evento de error y el uso hasta ahí se cobra (escenario "El saldo se acaba a mitad del stream").</li><li><b>Llega a su tope:</b> 400 si el tope lo fijó él, 429 si es el de su nivel (M18).</li></ul>',
        nums: '<ul><li>3 000 organizaciones como esta; las 20 más grandes generan más de la mitad del uso. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    { id: 'consola', layer: 'client', label: 'Consola de uso', sub: 'tablero y API de uso', x: 1520, y: 120,
      info: {
        resp: '<p>El tablero donde el cliente ve su uso por hora, por proyecto, por modelo y por clave, y la API que devuelve lo mismo. Lee las tablas de agregados, nunca un contador aparte: lo que muestra tiene que coincidir con la factura.</p>',
        api: '<pre data-lang="http"><code>GET /v1/organizations/usage_report?group_by=project_id&amp;bucket_width=1h\n\n200 {"data": [{"starting_at": "2026-10-04T14:00:00Z",\n  "results": [{"project_id": "proj_31", "output_tokens": 912400, …}]}],\n "complete_until": "2026-10-04T15:58:00Z"}</code></pre>',
        data: '<p>Nada propio. Muestra junto al gráfico hasta qué hora los datos están completos, para que una hora todavía abierta no parezca una caída de tráfico.</p>',
        fail: '<ul><li><b>El procesador se atrasa:</b> el tablero muestra datos viejos con el aviso de hasta cuándo están completos. Las facturas no se afectan.</li></ul>',
        nums: '<ul><li>Datos con 1 a 5 minutos de retraso en condiciones normales.</li></ul>'
      } },
    { id: 'finanzas', layer: 'client', label: 'Finanzas', sub: 'cierre contable y revisión', x: 1960, y: 120,
      info: {
        resp: '<p>El equipo que cierra el mes: revisa las diferencias que encontró la conciliación, aprueba los cambios del catálogo de precios y los reprocesos, y reconoce el ingreso a medida que los créditos se consumen.</p>',
        api: '<p>Informes, no APIs: diferencias por hora y organización, ingresos diferidos al cierre, créditos vencidos, facturas con ajustes.</p>',
        data: '<p>Lee el ledger y los informes de conciliación. No escribe en ninguna tabla del pipeline: sus correcciones entran como asientos nuevos o como cambios aprobados del catálogo.</p>',
        fail: '<ul><li><b>Un cambio de precio sin revisar:</b> cada cambio genera una factura simulada del mes anterior y requiere la aprobación de dos personas.</li></ul>',
        nums: '<ul><li>Diferencias aceptadas: cero en cantidades; menos de medio centavo por línea en dinero.</li></ul>'
      } },
    /* ---------- Medir y admitir ---------- */
    { id: 'limitador', layer: 'cache', label: 'Limitador', sub: 'Redis: cuotas, saldo y tope en caliente', x: 200, y: 330,
      info: {
        resp: '<p>El limitador del M18, que aquí guarda además el saldo disponible y el gasto aproximado del mes de cada organización. Responde en un milisegundo si una request puede empezar y presta tramos de saldo mientras el stream sigue. Es aproximado a propósito: la conciliación lo corrige.</p>',
        api: '<pre><code>EVALSHA reserve  spend:org_7:2026-10  saldo:org_7  0.04   → ok | sin_saldo | tope\nINCRBY spend:org_7:2026-10  -18200                        (corrección de la conciliación)</code></pre>',
        data: '<pre><code>saldo:org_7              disponible en nanodólares\nspend:org_7:2026-10      gasto aproximado del mes\nspend:org_7:2026-10:h    gasto por hora (para corregir por partes)\ncap:org_7                tope alcanzado: 1 | 0</code></pre>',
        fail: '<ul><li><b>Failover de Redis:</b> se pierden los últimos descuentos y el saldo sube un poco; la conciliación lo baja de nuevo.</li><li><b>Redis caído:</b> los gateways aplican la política de falla del M18; los clientes prepagos con saldo bajo se rechazan.</li></ul>',
        nums: '<ul><li>Lectura y reserva: ~1 ms.</li><li>Desvío típico contra el valor exacto: menos del 1&#8239;% del gasto de una hora. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    { id: 'gateway', layer: 'edge', label: 'Gateway', sub: 'mide al cerrar cada stream', x: 640, y: 330,
      info: {
        resp: '<p>Termina TLS, autentica, reserva en el limitador y mantiene el stream con el cliente. Cuando el stream termina, completado, cancelado o con error, emite el evento de uso con los números que le mandó el motor. Es quien sabe a quién cobrar.</p>',
        api: '<pre data-lang="json"><code>{"event_id": "req_9f2c41:final", "request_id": "req_9f2c41",\n "org_id": "org_7", "model_version": "modelo-m-2026-09-15",\n "event_time": "2026-10-04T14:05:09.412Z",\n "units": {"input_tokens": 1200, "cache_read_tokens": 8000, "output_tokens": 400}}</code></pre>',
        data: '<p>Un spool en disco con los eventos pendientes de publicar: es el outbox del gateway. Un hilo los publica en Kafka y los marca como enviados.</p>',
        fail: '<ul><li><b>Kafka no responde:</b> los eventos esperan en el spool; el cliente no lo nota.</li><li><b>El gateway muere:</b> se pierden los eventos de los streams abiertos, y la conciliación los reconstruye desde el registro del motor.</li><li><b>Reinicia con el spool lleno:</b> republica eventos ya enviados; el <code>event_id</code> permite descartarlos.</li></ul>',
        nums: '<ul><li>400 requests nuevas por segundo en el pico.</li><li>Evento confirmado en Kafka ~5 ms después del final del stream.</li></ul>'
      } },
    { id: 'motor', layer: 'gpu', label: 'Motor', sub: 'cuenta tokens y deja su registro', x: 1080, y: 330,
      info: {
        resp: '<p>El motor de inferencia (M15). Cuenta los tokens de cada request, los manda al gateway en el último evento del stream y, por su cuenta, publica en lotes un registro de qué requests procesó. Ese registro no se usa para cobrar: es la tercera fuente de la conciliación.</p>',
        api: '<pre data-lang="json"><code>{"request_id": "req_9f2c41", "replica": "r-041", "prompt_tokens": 9200,\n "cached_tokens": 8000, "completion_tokens": 400, "finish": "stop"}</code></pre>',
        data: '<p>Un lote cada 10 segundos por réplica, al tópico <code>engine-usage</code>, separado del de los gateways.</p>',
        fail: '<ul><li><b>Una réplica muere:</b> pierde su último lote; las requests de ese lote siguen teniendo el evento del gateway, así que la conciliación ve diferencias en una sola dirección y no corrige nada.</li><li><b>Abort tardío:</b> en una cancelación cuenta unos tokens más que lo que vio el cliente; se cobra lo que informó el motor.</li></ul>',
        nums: '<ul><li>125 réplicas; un lote cada 10 s de cada una: 12.5 mensajes por segundo.</li></ul>'
      } },
    { id: 'topes', layer: 'service', label: 'Topes y alertas', sub: 'umbrales del 50, 80 y 100 %', x: 1520, y: 330,
      info: {
        resp: '<p>Lleva el gasto exacto del mes de cada organización y proyecto, manda las alertas al cruzar cada umbral y, al llegar al tope, publica la marca en el limitador. También le pasa al limitador el saldo disponible de las organizaciones prepagas.</p>',
        api: '<pre data-lang="http"><code>POST https://cliente.example/webhooks/billing\n{"type": "spend.threshold_crossed", "org_id": "org_7",\n "threshold": 0.8, "month": "2026-10", "spend_usd": "1601.22"}</code></pre>',
        data: '<pre><code>alerts_sent(org_id, month, threshold)  PK   -- una alerta por umbral y por mes</code></pre>',
        fail: '<ul><li><b>El consumidor se atrasa:</b> el tope se aplica tarde; el exceso crece con el lag (21.9). El contador aproximado del limitador frena igual.</li><li><b>La marca no llega al limitador:</b> se reevalúa en cada conciliación.</li></ul>',
        nums: '<ul><li>Exceso normal sobre el tope: 28 USD (2 s de retraso y 50 streams en vuelo); con 60 s de lag, 144 USD.</li></ul>'
      } },
    /* ---------- El log ---------- */
    { id: 'kafka', layer: 'queue', label: 'Kafka', sub: 'tópicos usage y engine-usage, clave: organización, retención 7 días', x: 1080, y: 540, w: 1960, h: 56, bus: true,
      info: {
        resp: '<p>El log durable entre medir y procesar. La clave de cada mensaje es la organización: todos sus eventos van a la misma partición, en orden, y las copias de un evento caen juntas. El productor idempotente descarta los reintentos; lo demás lo deduplica el procesador.</p>',
        api: '<pre><code>producer: acks=all, enable.idempotence=true   (por defecto desde Kafka 3.0)\nconsumer: isolation.level=read_committed\ntopic usage: 64 particiones, replication.factor=3, min.insync.replicas=2</code></pre><p>Valores por defecto y semántica del productor idempotente: <span class="badge badge--doc">Documentado</span> (KIP-98 y KIP-679).</p>',
        data: '<p>7 días de retención: si el procesador se cae, puede retomar desde donde quedó. La copia completa y permanente está en S3.</p>',
        fail: '<ul><li><b>Un broker cae:</b> las particiones eligen otro líder; con <code>min.insync.replicas=2</code> no se pierde nada confirmado.</li><li><b>Lag:</b> el saldo y los topes se atrasan; las facturas no.</li></ul>',
        nums: '<ul><li>260 eventos por segundo en promedio, 520 en el pico, 600 bytes cada uno.</li><li>13.5 GB por día.</li></ul>'
      } },
    /* ---------- Procesar ---------- */
    { id: 's3', layer: 'db', label: 'Log crudo', sub: 'S3, inmutable, por día', x: 300, y: 750,
      info: {
        resp: '<p>La copia permanente de todo lo que llegó al tópico, sin filtrar: con duplicados, con tardíos, con los registros del motor. Es lo que permite reprocesar cualquier hora y responder cualquier disputa.</p>',
        api: '<pre><code>s3://usage-raw/topic=usage/date=2026-10-04/hour=14/part-00031.parquet\ns3://usage-raw/topic=engine-usage/date=2026-10-04/hour=14/…</code></pre>',
        data: '<p>Parquet particionado por día y hora. Object Lock en modo compliance impide borrar o sobrescribir durante el plazo de retención.</p>',
        fail: '<ul><li><b>El archivador se atrasa:</b> Kafka guarda 7 días, así que hay margen; una alerta salta a las 12 horas de lag.</li></ul>',
        nums: '<ul><li>13.5 GB por día sin comprimir, 4.9 TB por año.</li></ul>'
      } },
    { id: 'streaming', layer: 'service', label: 'Procesador de streaming', sub: 'dedupe por event_id y ventanas por hora', x: 640, y: 750,
      info: {
        resp: '<p>Una aplicación de Flink que lee el tópico, descarta los <code>event_id</code> ya vistos en las últimas 48 horas, suma el uso en ventanas por hora según la hora del evento y manda cada evento nuevo al rating para descontar el saldo.</p>',
        api: '<pre><code>WatermarkStrategy.forBoundedOutOfOrderness(Duration.ofMinutes(5))\nwindow(TumblingEventTimeWindows.of(Duration.ofHours(1)))\n  .allowedLateness(Duration.ofHours(1))\n  .sideOutputLateData(lateTag)</code></pre><p>La tolerancia vale 0 por defecto: sin configurarla, los tardíos se descartan. <span class="badge badge--doc">Documentado</span></p>',
        data: '<p>Estado por partición en RocksDB: los ids vistos (~2.9 GB en total) y las ventanas abiertas. Se guarda en checkpoints periódicos.</p>',
        fail: '<ul><li><b>Se pierde el estado:</b> doble conteo de las horas recientes; se reprocesan desde S3.</li><li><b>Un evento después de la tolerancia:</b> va a la salida de tardíos y entra como corrección.</li></ul>',
        nums: '<ul><li>45 millones de ids en la ventana de 48 horas.</li><li>Del evento al saldo: 1 a 2 s.</li></ul>'
      } },
    { id: 'agregados', layer: 'db', label: 'Agregados', sub: 'ClickHouse, uso por hora', x: 1080, y: 750,
      info: {
        resp: '<p>La tabla <code>usage_hourly</code> y sus derivadas por día y por mes. Es la única fuente del tablero, de la API de uso y de la factura.</p>',
        api: '<pre data-lang="sql"><code>SELECT model, unit, sum(quantity)\nFROM usage_hourly FINAL\nWHERE org_id = \'org_7\' AND hour &gt;= \'2026-10-01\' AND hour &lt; \'2026-11-01\'\nGROUP BY model, unit</code></pre>',
        data: '<p><code>ReplacingMergeTree(version)</code> ordenado por organización, hora, modelo y unidad: una fila reemitida con versión mayor reemplaza a la vieja, pero solo cuando ClickHouse fusiona partes, en un momento que no se puede predecir. Las consultas de facturación usan <code>FINAL</code>. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<ul><li><b>Una consulta sin FINAL:</b> puede sumar una fila y su reemplazo, y mostrar el doble. Por eso la facturación tiene su propia consulta revisada.</li></ul>',
        nums: '<ul><li>576 000 filas por día: 3 000 organizaciones × 8 líneas × 24 horas.</li></ul>'
      } },
    { id: 'conciliacion', layer: 'service', label: 'Conciliación', sub: 'cada hora, tres fuentes', x: 1520, y: 750,
      info: {
        resp: '<p>Cada hora, sobre la hora que terminó hace dos, compara el registro del motor con los eventos del gateway, los eventos con los agregados y los agregados con el limitador. Publica los eventos que faltan, pide reprocesos y corrige los contadores del limitador.</p>',
        api: '<pre><code>reconcile(hour="2026-10-04T14")\n  motor: 41 220 requests    log: 41 219 eventos final    → reconstruir req_c07\n  log vs agregados: 0 diferencias\n  limitador org_7: −18 200 nanodólares                       → INCRBY</code></pre>',
        data: '<pre><code>reconciliation_runs(hour, source_a, source_b, diffs, status)\nreconciliation_diffs(hour, org_id, request_id, kind, action)</code></pre>',
        fail: '<ul><li><b>No corre:</b> los errores no se ven, pero tampoco se pierden: la siguiente corrida revisa las horas pendientes.</li><li><b>Diferencias que crecen:</b> son la primera señal de un bug en el pipeline; alerta a la guardia.</li></ul>',
        nums: '<ul><li>~720 000 requests por hora para cruzar en el pico; una consulta sobre S3 y ClickHouse de un par de minutos. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    /* ---------- Dinero ---------- */
    { id: 'catalogo', layer: 'db', label: 'Catálogo de precios', sub: 'versionado, con vigencias', x: 260, y: 960,
      info: {
        resp: '<p>Los precios de cada modelo y unidad, con su vigencia, en tres niveles: lista pública, plan y contrato de cada organización. Una fila nunca se edita: se cierra su vigencia y se crea otra.</p>',
        api: '<pre data-lang="sql"><code>SELECT nanousd_per_unit FROM prices\nWHERE model = \'modelo-m\' AND unit = \'output_tokens\'\n  AND scope IN (\'org:org_7\', \'plan:scale\', \'list\')\n  AND valid_from &lt;= $event_time AND (valid_to IS NULL OR $event_time &lt; valid_to)\nORDER BY scope_priority LIMIT 1</code></pre>',
        data: '<p>PostgreSQL con una restricción de exclusión que impide dos precios con vigencias solapadas para la misma línea.</p>',
        fail: '<ul><li><b>Un precio mal cargado:</b> se corrige con otra versión y se vuelve a tarifar el período; los eventos no cambian.</li></ul>',
        nums: '<ul><li>Unos pocos miles de filas; el rating las tiene en memoria.</li></ul>'
      } },
    { id: 'rating', layer: 'service', label: 'Rating', sub: 'cantidad × precio de la hora del evento', x: 640, y: 960,
      info: {
        resp: '<p>Convierte uso en dinero. Para el saldo, tarifa cada evento en nanodólares sin redondear; para la factura, tarifa el total de cada línea del ciclo y redondea una sola vez.</p>',
        api: '<pre><code>rate(event) → 8 000 000 nanodólares     (1 200 × 2 000 + 8 000 × 200 + 400 × 10 000)\nrate_line(1 200 000 000 tokens, 10 000) → 1 200 000 centavos</code></pre>',
        data: '<p>Sin estado propio: el catálogo en memoria, recargado cuando cambia una versión.</p>',
        fail: '<ul><li><b>Redondear por evento:</b> 0.008 USD se vuelven 0.01 y el mes sale un 25&#8239;% más caro. Por eso solo redondea la factura.</li></ul>',
        nums: '<ul><li>La request del ejemplo: 0.0080 USD; sin caché, 0.0224; en batch, 0.0040.</li></ul>'
      } },
    { id: 'saldo', layer: 'service', label: 'Saldo', sub: 'créditos prepagados', x: 1080, y: 960,
      info: {
        resp: '<p>Descuenta el costo de cada evento de los lotes de crédito de la organización, empezando por el que vence antes, escribe los asientos en el ledger y mantiene el saldo materializado con su versión.</p>',
        api: '<pre data-lang="http"><code>POST /internal/balances/org_7/debit\nIdempotency-Key: req_9f2c41:final\n{"nanousd": 8000000, "event_time": "2026-10-04T14:05:09Z"}</code></pre><p>La idempotency key es el <code>event_id</code>: un reintento no descuenta dos veces.</p>',
        data: '<pre><code>credit_lots(lot_id, org_id, kind, granted, remaining, expires_at)\nbalances(org_id, available_nanousd, version)</code></pre>',
        fail: '<ul><li><b>Saldo negativo:</b> con la política de cobrar al terminar, los streams en vuelo lo llevan por debajo de cero; se acota con un sobregiro máximo por organización.</li></ul>',
        nums: '<ul><li>Con 20 USD, 20 streams y 0.50 USD de máximo: −1.51 USD cobrando al terminar, 0 o más con reservas (simulador de 21.8).</li></ul>'
      } },
    { id: 'ledger', layer: 'db', label: 'Ledger', sub: 'doble entrada, Aurora PostgreSQL', x: 1520, y: 960,
      info: {
        resp: '<p>El ledger de doble entrada del M27, con cuentas de créditos de clientes (ingreso diferido), créditos promocionales, ingresos por uso y gasto promocional. Cada compra, consumo, vencimiento, ajuste y crédito por SLA es un asiento que suma cero.</p>',
        api: '<pre data-lang="sql"><code>INSERT INTO entries (txn_id, account, amount_nanousd) VALUES\n  (\'use:req_9f2c41:final\', \'org_7:credits\', -8000000),\n  (\'use:req_9f2c41:final\', \'revenue:usage\',  8000000);</code></pre>',
        data: '<p>Asientos inmutables con <code>txn_id</code> único: insertar dos veces la misma transacción falla. El saldo de cualquier cuenta se puede recalcular sumando.</p>',
        fail: '<ul><li><b>Un asiento por cada evento:</b> 22.5 millones de transacciones por día. Se agrupan por organización y minuto en un solo asiento, con el detalle en los agregados. <span class="badge badge--ref">Diseño de referencia</span></li></ul>',
        nums: '<ul><li>Agrupando por minuto: 3 000 organizaciones × 1 440 minutos = 4.3 millones de asientos por día como máximo.</li></ul>'
      } },
    /* ---------- Facturar y cobrar ---------- */
    { id: 'facturas', layer: 'service', label: 'Job de facturas', sub: 'cierre del ciclo', x: 640, y: 1170,
      info: {
        resp: '<p>Al cerrar el ciclo de cada organización, lee los agregados del mes, pide al rating el total de cada línea, descuenta lo pagado con créditos, agrega los ajustes pendientes y manda el resultado a Stripe.</p>',
        api: '<pre data-lang="http"><code>POST /v1/billing/meter_events\nevent_name=output_tokens_modelo_m\n&amp;payload[stripe_customer_id]=cus_Q7x…\n&amp;payload[value]=9109600\n&amp;identifier=org_7:output_tokens_modelo_m:2026-10-04T14</code></pre><p>Uso horario a los meters de Stripe; el <code>identifier</code> hace seguro el reenvío. <span class="badge badge--doc">Documentado</span></p>',
        data: '<pre><code>invoices(invoice_id, org_id, period, status, stripe_invoice_id)\ninvoice_lines(invoice_id, model, unit, quantity, price_id, amount_cents)</code></pre>',
        fail: '<ul><li><b>Stripe no responde:</b> reintenta con el mismo <code>identifier</code>; hay 35 días de margen para el <code>timestamp</code>.</li><li><b>Se corrige una hora ya facturada:</b> la diferencia va como ajuste en la factura siguiente.</li></ul>',
        nums: '<ul><li>576 000 meter events por día, unos 7 por segundo: muy lejos de las 1 000 llamadas por segundo de la cuenta.</li></ul>'
      } },
    { id: 'stripe', layer: 'external', label: 'Stripe Billing', sub: 'facturas, impuestos y cobro', x: 1080, y: 1170,
      info: {
        resp: '<p>Suma los meter events del período, arma la factura, calcula impuestos, la finaliza, cobra la tarjeta o el débito guardado, reintenta si falla y avisa todo con webhooks. Es el procesador de pagos del M27, del otro lado.</p>',
        api: '<pre><code>invoice.finalized\ninvoice.paid\ninvoice.payment_failed\nv1.billing.meter.error_report_triggered</code></pre>',
        data: '<p>Una copia del uso por meter y del cliente. Los meter events se procesan de forma asíncrona y el <code>identifier</code> es único durante al menos 24 horas. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<ul><li><b>Un meter event con error:</b> no falla en la respuesta, llega después como evento de error; hay que consumirlo.</li><li><b>Corrección tarde:</b> un meter event solo se puede cancelar en las 24 horas siguientes a recibirlo. <span class="badge badge--doc">Documentado</span></li></ul>',
        nums: '<ul><li>Billing en pago por uso: 0.7&#8239;% del volumen facturado, con hasta 100 millones de meter events por mes incluidos. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'webhooks', layer: 'service', label: 'Webhooks de cobro', sub: 'SQS y un consumidor', x: 1520, y: 1170,
      info: {
        resp: '<p>Recibe los webhooks de Stripe, verifica la firma, los encola y los aplica: una compra de créditos pagada abre un lote nuevo; una factura pagada cierra la deuda; un cobro fallido empieza el dunning.</p>',
        api: '<pre data-lang="http"><code>POST /webhooks/stripe\nStripe-Signature: t=…,v1=…\n{"type": "invoice.payment_failed", "data": {"object": {"id": "in_1Q…", "attempt_count": 1}}}</code></pre>',
        data: '<pre><code>processed_webhooks(stripe_event_id)  PK   -- cada evento se aplica una vez</code></pre>',
        fail: '<ul><li><b>El mismo webhook dos veces:</b> la tabla de eventos procesados lo descarta (M27).</li><li><b>Llegan desordenados:</b> se compara el estado actual del objeto, no el orden de llegada.</li></ul>',
        nums: '<ul><li>Unos miles por día: facturas, compras de créditos y recargas.</li></ul>'
      } }
  ],
  edges: [
    { id: 'e1', from: 'cliente', to: 'gateway', both: true, label: 'stream' },
    { id: 'e2', from: 'gateway', to: 'limitador', both: true, label: 'reservar' },
    { id: 'e3', from: 'gateway', to: 'motor', both: true, label: 'generate' },
    { id: 'e4', from: 'gateway', to: 'kafka', async: true, label: 'evento de uso' },
    { id: 'e5', from: 'motor', to: 'kafka', async: true, label: 'registro del motor' },
    { id: 'e6', from: 'kafka', to: 's3', async: true, label: 'archivar' },
    { id: 'e7', from: 'kafka', to: 'streaming', label: 'consumir' },
    { id: 'e8', from: 'streaming', to: 'agregados', label: 'filas por hora' },
    { id: 'e9', from: 'streaming', to: 'rating', label: 'evento nuevo' },
    { id: 'e10', from: 'catalogo', to: 'rating', label: 'precio vigente' },
    { id: 'e11', from: 'rating', to: 'saldo', label: 'costo' },
    { id: 'e12', from: 'saldo', to: 'ledger', label: 'asientos' },
    { id: 'e13', from: 'saldo', to: 'topes', label: 'gasto del mes', labelAt: 0.58 },
    { id: 'e14', from: 'topes', to: 'limitador', label: 'tope y saldo disponible', bend: 220 },
    { id: 'e15', from: 'topes', to: 'cliente', async: true, label: 'alertas', labelAt: 0.35 },
    { id: 'e16', from: 'agregados', to: 'consola', label: 'uso por hora', labelAt: 0.2 },
    { id: 'e17', from: 'agregados', to: 'facturas', label: 'uso del ciclo', labelAt: 0.78 },
    { id: 'e18', from: 'rating', to: 'facturas', label: 'líneas tarifadas' },
    { id: 'e19', from: 'facturas', to: 'stripe', label: 'meter events' },
    { id: 'e20', from: 'stripe', to: 'webhooks', async: true, label: 'invoice.*' },
    { id: 'e21', from: 'webhooks', to: 'ledger', label: 'pagos y fallas' },
    { id: 'e22', from: 's3', to: 'conciliacion', label: 'eventos y registro del motor', bend: 220 },
    { id: 'e23', from: 'agregados', to: 'conciliacion', label: 'agregados' },
    { id: 'e24', from: 'conciliacion', to: 'kafka', label: 'evento reconstruido' },
    { id: 'e25', from: 'conciliacion', to: 'limitador', label: 'corrige contadores', labelAt: 0.4 },
    { id: 'e26', from: 'conciliacion', to: 'finanzas', label: 'diferencias', labelAt: 0.75 },
    { id: 'e27', from: 'conciliacion', to: 'ledger', label: 'ajustes' }
  ],
  scenarios: [
    {
      id: 'normal', title: 'Una request, del stream al saldo',
      desc: 'La request de 21.2: 1 200 tokens de entrada, 8 000 leídos del caché y 400 de salida. Se sigue el uso desde que el gateway reserva hasta que el saldo se descuenta y el evento queda archivado.',
      steps: [
        { from: 'cliente', to: 'gateway', kind: 'req', tag: 'POST /v1/messages', ms: 30, title: 'Llega la request', text: 'Con streaming y <code>max_tokens: 8000</code>.' },
        { from: 'gateway', to: 'limitador', kind: 'req', tag: 'reservar tramo 0.04 USD', ms: 1, title: 'Reserva de saldo', text: 'org_7 es prepaga: el gateway reserva un tramo del saldo disponible, como los préstamos del escrow del M18.' },
        { from: 'limitador', to: 'gateway', kind: 'res', tag: 'ok', ms: 1, title: 'Hay saldo', text: 'Quedan 182.40 USD disponibles.' },
        { from: 'gateway', to: 'motor', kind: 'req', tag: 'generate', ms: 2, title: 'Al motor', text: 'Por el router del M19.' },
        { from: 'motor', to: 'gateway', kind: 'res', tag: 'tokens… + usage', ms: 12000, title: 'Genera y cuenta', text: 'El último evento del stream trae el <code>usage</code>: 1 200 de entrada, 8 000 de caché y 400 de salida.' },
        { from: 'gateway', to: 'cliente', kind: 'res', tag: 'SSE · message_stop', ms: 30, title: 'El cliente recibe todo', text: 'El stream terminó bien.' },
        { from: 'gateway', to: 'kafka', kind: 'async', tag: 'req_9f2c41:final', ms: 5, title: 'Nace el evento de uso', text: 'Desde el spool, con <code>acks=all</code> y productor idempotente. La clave es <code>org_7</code>.', code: '{"event_id": "req_9f2c41:final", "org_id": "org_7",\n "event_time": "2026-10-04T14:05:09.412Z",\n "units": {"input_tokens": 1200, "cache_read_tokens": 8000, "output_tokens": 400}}', lang: 'json' },
        { from: 'kafka', to: 's3', kind: 'async', tag: 'archivar', ms: 60000, title: 'Copia permanente', text: 'El archivador escribe lotes de un minuto en Parquet.' },
        { from: 'kafka', to: 'streaming', kind: 'req', tag: 'consumir', ms: 50, title: 'El procesador lo lee', text: 'Partición 3, offset 88 120.' },
        { at: 'streaming', kind: 'info', tag: 'nuevo', ms: 1, title: 'Dedupe', text: '<code>req_9f2c41:final</code> no está en el estado de las últimas 48 horas: se anota y sigue.' },
        { from: 'streaming', to: 'agregados', kind: 'req', tag: 'hora 14:00', ms: 60000, title: 'Ventana de la hora del evento', text: 'Suma 9 600 tokens a la fila de org_7 de las 14:00. La fila se reemite con versión mayor cada minuto mientras la ventana sigue abierta.' },
        { from: 'streaming', to: 'rating', kind: 'req', tag: 'evento nuevo', ms: 5, title: 'A tarifar', text: 'El saldo no espera a la ventana: cada evento nuevo se tarifa enseguida.' },
        { from: 'catalogo', to: 'rating', kind: 'res', tag: 'precio vigente a las 14:05', ms: 0.01, title: 'Precio por hora del evento', text: 'Desde la copia en memoria del catálogo.' },
        { from: 'rating', to: 'saldo', kind: 'req', tag: '8 000 000 nanodólares', ms: 5, title: 'El costo', text: '1 200 × 2 000 + 8 000 × 200 + 400 × 10 000 nanodólares = 0.008 USD, sin redondear.' },
        { from: 'saldo', to: 'ledger', kind: 'req', tag: 'asiento', ms: 5, title: 'Al ledger', text: 'Débito a los créditos de org_7, crédito a ingresos por uso. El ingreso diferido se vuelve ingreso.' },
        { from: 'saldo', to: 'topes', kind: 'async', tag: 'gasto del mes', ms: 10, title: 'Gasto acumulado', text: 'El servicio de topes suma el costo al mes de octubre de org_7: lejos de cualquier umbral.' }
      ]
    },
    {
      id: 'duplicado', title: 'El mismo evento dos veces',
      desc: 'El gateway se reinicia y su spool republica un evento que ya había llegado a Kafka. Kafka no puede detectarlo; el procesador sí.',
      steps: [
        { from: 'gateway', to: 'kafka', kind: 'async', tag: 'req_a41:final', ms: 5, title: 'Primera copia', text: 'Publicado y confirmado. El gateway muere antes de marcarlo como enviado en su spool.' },
        { at: 'gateway', kind: 'info', tag: 'reinicio', ms: 8000, title: 'El gateway vuelve', text: 'Lee su spool y encuentra el evento sin marcar: lo publica de nuevo. Es un productor nuevo, con otro id, así que el productor idempotente no lo reconoce.' },
        { from: 'gateway', to: 'kafka', kind: 'async', tag: 'req_a41:final otra vez', ms: 5, title: 'Segunda copia', text: 'Kafka la guarda en otro offset.' },
        { from: 'kafka', to: 'streaming', kind: 'req', tag: 'copia 1', ms: 50, title: 'La primera pasa', text: 'Es nueva.' },
        { from: 'streaming', to: 'rating', kind: 'req', tag: 'se tarifa', ms: 5, title: 'Se descuenta una vez', text: '' },
        { from: 'kafka', to: 'streaming', kind: 'req', tag: 'copia 2', ms: 50, title: 'La segunda llega', text: 'Mismo <code>event_id</code>.' },
        { at: 'streaming', kind: 'info', tag: 'duplicado: se descarta', ms: 1, title: 'Dedupe', text: 'El id ya está en el estado. Se descarta y se cuenta en <code>usage_duplicates_total</code>. El saldo y los agregados cambiaron una sola vez.' },
        { from: 'kafka', to: 's3', kind: 'async', tag: 'las dos copias', ms: 60000, title: 'El log crudo guarda ambas', text: 'Si alguna vez se reprocesa esta hora, el reproceso las deduplica de nuevo.' }
      ]
    },
    {
      id: 'tardio', title: 'Un evento que llega dos horas tarde',
      desc: 'Una región estuvo aislada y sus gateways guardaron los eventos en disco. Al volver, llega un evento de las 14:05 cuando la ventana de las 14:00 ya cerró.',
      steps: [
        { at: 'gateway', kind: 'info', tag: '2 h sin red hacia Kafka', ms: 7200000, title: 'Región aislada', text: 'Los gateways siguen sirviendo y acumulan eventos en el spool. Los topes de esa región se aplican con el contador aproximado del limitador.' },
        { from: 'gateway', to: 'kafka', kind: 'async', tag: 'evento de las 14:05', ms: 5, title: 'Llega a las 16:10', text: 'Kafka lo acepta: el log no juzga la hora del evento.' },
        { from: 'kafka', to: 'streaming', kind: 'req', tag: 'consumir', ms: 50, title: 'El procesador lo ve', text: 'Marca de agua en 16:05, tolerancia de 1 hora: la ventana de las 14:00 cerró cuando la marca de agua pasó las 16:00.' },
        { at: 'streaming', kind: 'info', tag: 'salida de tardíos', ms: 1, title: 'No se descarta', text: 'Va a <code>sideOutputLateData</code>. Descartarlo, lo que hace Flink por defecto, sería regalar ese uso.' },
        { from: 'streaming', to: 'agregados', kind: 'req', tag: 'fila de corrección · 14:00', ms: 60000, title: 'Corrección', text: 'Una fila nueva con <code>is_correction = 1</code> en la hora 14:00. La fila original no se toca.' },
        { from: 'streaming', to: 'rating', kind: 'req', tag: 'se tarifa igual', ms: 5, title: 'Con el precio de las 14:05', text: 'Aunque sean las 16:10: el precio es el de la hora del evento.' },
        { from: 'rating', to: 'saldo', kind: 'req', tag: 'descuento tardío', ms: 5, title: 'El saldo baja', text: 'Si la factura del ciclo ya se hubiera emitido, este uso iría como ajuste en la siguiente.' }
      ]
    },
    {
      id: 'huerfano', title: 'El gateway muere a mitad del stream',
      desc: 'Un gateway se cae con 300 streams abiertos. Sus eventos nunca se emiten. El registro del motor y la conciliación los recuperan.',
      steps: [
        { from: 'gateway', to: 'motor', kind: 'req', tag: 'generate req_c07', ms: 2, title: 'Un stream más', text: '3 100 tokens de salida en camino.' },
        { at: 'gateway', kind: 'fail', tag: 'proceso muerto', ms: 1, title: 'El gateway muere', text: 'El cliente ve la conexión cortada. El evento de <code>req_c07</code> nunca se escribe en el spool.', down: ['gateway'] },
        { from: 'motor', to: 'kafka', kind: 'async', tag: 'lote: req_c07 · 3 100', ms: 10000, title: 'El motor sí lo anotó', text: 'Su lote de 10 segundos incluye la request, con los tokens que generó hasta que se cerró la conexión.' },
        { from: 'kafka', to: 's3', kind: 'async', tag: 'engine-usage', ms: 60000, title: 'Al log crudo', text: '' },
        { from: 's3', to: 'conciliacion', kind: 'req', tag: 'hora 14:00', ms: 120000, title: 'La conciliación de las 16:00', text: 'Cruza por <code>request_id</code>: 41 220 requests según el motor, 41 219 eventos <code>final</code>. Falta <code>req_c07</code>.', up: ['gateway'] },
        { from: 'conciliacion', to: 'kafka', kind: 'async', tag: 'req_c07:final reconstruido', ms: 5, title: 'Evento de reemplazo', text: 'Con el mismo <code>event_id</code> que habría usado el gateway y una marca de reconstruido. Si el original apareciera después, el dedupe lo descartaría.' },
        { from: 'kafka', to: 'streaming', kind: 'req', tag: 'tardío', ms: 50, title: 'Entra como tardío', text: 'Por el camino de corrección del escenario anterior.' },
        { from: 'streaming', to: 'rating', kind: 'req', tag: 'se tarifa', ms: 5, title: 'Se cobra', text: '' },
        { from: 'conciliacion', to: 'finanzas', kind: 'async', tag: '1 evento reconstruido', ms: 10, title: 'Queda registrado', text: 'Los eventos reconstruidos por hora son una métrica: si crecen, algo en los gateways está fallando.' }
      ]
    },
    {
      id: 'sin-saldo', title: 'El saldo se acaba a mitad del stream',
      desc: 'org_7 tiene 0.03 USD disponibles y un stream largo en curso. Con reservas por tramos, el stream se corta cuando no hay saldo para el siguiente.',
      steps: [
        { from: 'gateway', to: 'motor', kind: 'req', tag: 'generate', ms: 2, title: 'Un stream largo', text: 'Ya gastó su primer tramo de 0.04 USD.' },
        { from: 'gateway', to: 'limitador', kind: 'req', tag: 'tramo 2: 0.04 USD', ms: 1, title: 'Pide otro tramo', text: 'El tramo anterior se gastó y el stream sigue.' },
        { from: 'limitador', to: 'gateway', kind: 'fail', tag: 'sin saldo: 0.03 disponible', ms: 1, title: 'No alcanza', text: 'El saldo disponible es menor que un tramo.' },
        { from: 'gateway', to: 'motor', kind: 'fail', tag: 'abort', ms: 2, title: 'Se corta la generación', text: 'El motor saca la request del batch y libera su KV cache (M17).' },
        { from: 'gateway', to: 'cliente', kind: 'fail', tag: 'event: error · saldo agotado', ms: 30, title: 'El cliente se entera', text: 'Un evento de error dentro del stream: el status HTTP ya se mandó al principio (M17).' },
        { from: 'gateway', to: 'kafka', kind: 'async', tag: 'final · cancelled · uso parcial', ms: 5, title: 'Se cobra lo usado', text: 'El evento lleva <code>status: "cancelled"</code> y el uso que el motor informó al abortar.' },
        { at: 'saldo', kind: 'info', tag: 'saldo bajo el umbral', ms: 10, title: 'Recarga automática', text: 'Si org_7 la activó, el servicio de saldo pide a Stripe un cobro con una idempotency key derivada del cruce de umbral; cuando el webhook confirma el pago, se abre un lote de crédito nuevo.' }
      ]
    },
    {
      id: 'tope', title: 'Se alcanza el tope de gasto',
      desc: 'org_7 fijó un tope de 2 000 USD para octubre. Se cruzan el 80 y el 100 %.',
      steps: [
        { from: 'saldo', to: 'topes', kind: 'async', tag: 'gasto: 1 601.22 USD', ms: 10, title: 'Cruza el 80 %', text: '' },
        { from: 'topes', to: 'cliente', kind: 'async', tag: 'alerta 80 %', ms: 200, title: 'Alerta, una vez', text: 'Clave idempotente <code>org_7:2026-10:80</code>: si el servicio se reinicia, no la manda de nuevo.' },
        { from: 'saldo', to: 'topes', kind: 'async', tag: 'gasto: 2 000.40 USD', ms: 10, title: 'Cruza el 100 %', text: 'Tres días después.' },
        { from: 'topes', to: 'limitador', kind: 'req', tag: 'cap:org_7 = 1', ms: 2, title: 'Marca en el limitador', text: 'Desde aquí, cada gateway rechaza las requests nuevas de org_7.' },
        { from: 'cliente', to: 'gateway', kind: 'req', tag: 'POST /v1/messages', ms: 30, title: 'Una request más', text: '' },
        { from: 'gateway', to: 'limitador', kind: 'req', tag: 'reservar', ms: 1, title: '', text: '' },
        { from: 'limitador', to: 'gateway', kind: 'fail', tag: 'tope', ms: 1, title: 'Rechazada', text: '' },
        { from: 'gateway', to: 'cliente', kind: 'fail', tag: '400 · tope del cliente', ms: 30, title: 'El error del M18', text: 'Un tope fijado por el cliente responde 400, sin <code>retry-after</code>: reintentar no sirve hasta que cambie el mes o el tope. Los streams que ya estaban en vuelo terminan y se cobran: ese es el exceso de 21.9.' }
      ]
    },
    {
      id: 'cierre', title: 'El cierre del mes y la factura',
      desc: 'Una organización pospaga cierra su ciclo el 1 de noviembre. El job arma la factura desde los agregados y Stripe la cobra.',
      steps: [
        { at: 'facturas', kind: 'info', tag: '1 de noviembre, 02:00 UTC', ms: 1, title: 'Empieza el cierre', text: 'Se espera a que la última hora de octubre esté conciliada.' },
        { from: 'agregados', to: 'facturas', kind: 'res', tag: 'uso de octubre por línea', ms: 3000, title: 'El uso del ciclo', text: 'Una consulta con <code>FINAL</code>: una fila por modelo, unidad y nivel de servicio.' },
        { from: 'rating', to: 'facturas', kind: 'res', tag: 'totales redondeados una vez', ms: 10, title: 'Tarifar las líneas', text: 'Cantidad del mes × precio, redondeada una vez por línea.' },
        { from: 'facturas', to: 'stripe', kind: 'req', tag: 'meter events del último día', ms: 200, title: 'A Stripe', text: 'Las horas ya enviadas no se reenvían; si alguna falló, se reintenta con el mismo <code>identifier</code>.' },
        { from: 'stripe', to: 'webhooks', kind: 'async', tag: 'invoice.finalized', ms: 3600000, title: 'Factura finalizada', text: 'Con impuestos. A partir de aquí no cambia: cualquier corrección va en la siguiente.' },
        { from: 'stripe', to: 'webhooks', kind: 'async', tag: 'invoice.paid', ms: 60000, title: 'Cobrada', text: '' },
        { from: 'webhooks', to: 'ledger', kind: 'req', tag: 'deuda cerrada', ms: 10, title: 'Al ledger', text: 'El cobro cierra la cuenta por cobrar del cliente.' }
      ]
    },
    {
      id: 'dunning', title: 'Un cobro que falla',
      desc: 'La tarjeta de org_9 venció. La factura de octubre no se puede cobrar y empieza el dunning.',
      steps: [
        { from: 'stripe', to: 'webhooks', kind: 'fail', tag: 'invoice.payment_failed', ms: 1000, title: 'Falla el cobro', text: 'Stripe reintentará en los días siguientes.' },
        { from: 'webhooks', to: 'ledger', kind: 'req', tag: 'cuenta en mora', ms: 10, title: 'Estado de la cuenta', text: 'La deuda queda abierta y la cuenta pasa a "en mora".' },
        { from: 'saldo', to: 'topes', kind: 'async', tag: 'restringir', ms: 10, title: 'Restringir', text: 'La política pasa a org_9 a prepago, o le baja el tope, mientras la deuda siga abierta.' },
        { from: 'topes', to: 'limitador', kind: 'req', tag: 'prepago obligatorio', ms: 2, title: 'Llega a los gateways', text: 'Como cualquier cambio de configuración.' },
        { from: 'topes', to: 'cliente', kind: 'async', tag: 'actualiza tu tarjeta', ms: 200, title: 'Aviso', text: 'Con un enlace para cambiar el medio de pago.' },
        { from: 'stripe', to: 'webhooks', kind: 'async', tag: 'invoice.paid', ms: 259200000, title: 'Tres días después', text: 'El cliente actualizó la tarjeta y el reintento pasó.' },
        { from: 'webhooks', to: 'ledger', kind: 'req', tag: 'deuda cerrada', ms: 10, title: 'Vuelve a la normalidad', text: 'Se levanta la restricción por el mismo camino.' }
      ]
    },
    {
      id: 'conciliar', title: 'La conciliación corrige al limitador',
      desc: 'Un failover de Redis perdió descuentos de org_7. La conciliación de la hora 14:00 lo encuentra y corrige el contador.',
      steps: [
        { from: 's3', to: 'conciliacion', kind: 'req', tag: 'eventos de las 14:00', ms: 60000, title: 'Fuente 1', text: 'Eventos <code>final</code> deduplicados del log crudo.' },
        { from: 'agregados', to: 'conciliacion', kind: 'req', tag: 'agregados de las 14:00', ms: 2000, title: 'Fuente 2', text: 'Coinciden con el log: el pipeline está bien.' },
        { from: 'conciliacion', to: 'limitador', kind: 'req', tag: 'HGET spend:org_7:…:h 14', ms: 1, title: 'Fuente 3', text: 'El limitador cree que org_7 gastó 18 200 nanodólares menos de lo exacto: los descuentos que se perdieron en el failover.' },
        { from: 'conciliacion', to: 'limitador', kind: 'req', tag: 'INCRBY +18 200', ms: 1, title: 'Corregir, nunca al revés', text: 'Un incremento atómico que no pisa lo que los gateways suman en paralelo. Si el limitador corrigiera al metering, un failover podría borrar uso de una factura.' },
        { from: 'conciliacion', to: 'finanzas', kind: 'async', tag: 'informe de la hora', ms: 10, title: 'Registro', text: 'Cada corrección queda en <code>reconciliation_diffs</code> con su hora, su organización y su monto.' }
      ]
    }
  ]
});
