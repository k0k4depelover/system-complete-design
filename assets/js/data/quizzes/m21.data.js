SD.defineQuiz('m21', {
  title: 'Quiz: metering y facturación por uso',
  pass: 0.7,
  questions: [
    {
      id: 'dos-niveles', type: 'single',
      prompt: 'El limitador de Redis dice que org_7 gastó 1&#8239;980 USD en el mes y el metering dice 2&#8239;004 USD. ¿Qué número vale y qué se hace con el otro?',
      options: [
        'Vale el del limitador, porque es el que se actualiza en tiempo real; el metering se ajusta a él.',
        'Vale el del metering; la conciliación corrige el contador del limitador.',
        'Se promedian los dos.',
        'Vale el más bajo, para no cobrar de más.'
      ],
      answer: 1,
      explain: 'El limitador es aproximado a propósito; el metering es la fuente de verdad. La corrección va siempre del metering al limitador, nunca al revés: si fuera al revés, un failover de Redis podría borrar uso de una factura. Repasa 21.1 y 21.11.'
    },
    {
      id: 'volumen', type: 'single',
      prompt: 'Con 400 requests por segundo en el pico, el promedio en la mitad del pico y 1.3 eventos por request, ¿cuántos eventos de uso hay por día?',
      options: ['Unos 2.2 millones', 'Unos 22.5 millones', 'Unos 45 millones', 'Unos 225 millones'],
      fixed: true,
      answer: 1,
      explain: '200 requests por segundo × 86&#8239;400 s = 17.3 millones de requests; × 1.3 = 22.5 millones de eventos. Para Kafka es poco: lo difícil del metering es la exactitud, no el volumen. Repasa 21.1.'
    },
    {
      id: 'sin-precio', type: 'single',
      prompt: '¿Por qué el evento de uso no lleva el precio?',
      options: [
        'Para que el evento pese menos bytes.',
        'Porque los precios cambian y hay contratos por cliente: si el precio estuviera en millones de eventos inmutables, un error de precio no se podría corregir volviendo a tarifar.',
        'Porque el gateway no tiene permiso para leer precios.',
        'Porque Stripe calcula los precios.'
      ],
      answer: 1,
      explain: 'El evento describe qué se consumió. El rating aplica el precio después, con un catálogo versionado, y se puede repetir si el catálogo estaba mal. Repasa 21.3.'
    },
    {
      id: 'event-id', type: 'single',
      prompt: '¿Qué <code>event_id</code> permite descartar las copias de un evento que el gateway reenvía después de reiniciarse?',
      options: [
        'Un UUID aleatorio generado al emitir.',
        'El offset de Kafka.',
        'Uno derivado del request: <code>req_9f2c41:final</code>.',
        'La hora del evento en milisegundos.'
      ],
      answer: 2,
      explain: 'Un id determinista sale igual en cada copia, y también en el evento que la conciliación reconstruye. Un UUID aleatorio cambia en cada reenvío; el offset es distinto para cada copia; la hora puede repetirse entre requests distintas. Repasa 21.3.'
    },
    {
      id: 'quien-emite', type: 'single',
      prompt: 'En el diseño del módulo, ¿quién emite el evento de uso que se cobra y qué papel tiene el otro?',
      options: [
        'El motor, porque cuenta los tokens; el gateway no participa.',
        'El gateway, al cerrar el stream, con los números del motor; el motor deja su propio registro, que se usa para conciliar.',
        'El cliente, con el usage que recibe en la respuesta.',
        'El limitador, al reconciliar la reserva.'
      ],
      answer: 1,
      explain: 'El gateway sabe a quién cobrar y qué recibió el cliente; el motor sabe qué consumió la GPU. Usar los dos como fuentes independientes permite detectar los eventos que se perdieron. Repasa 21.4.'
    },
    {
      id: 'cancelado', type: 'single',
      prompt: 'El cliente cierra la pestaña cuando el modelo lleva 300 tokens de salida. ¿Qué se registra?',
      options: [
        'Nada: la request no terminó.',
        'Un evento final con status cancelled y el uso que el motor informó al abortar.',
        'El costo máximo de la request, por las dudas.',
        'Solo los tokens de entrada.'
      ],
      answer: 1,
      explain: 'Esos tokens gastaron GPU. El M17 dejó pendiente registrarlos; el gateway emite el evento con el uso parcial en el bloque finally. Repasa 21.4.'
    },
    {
      id: 'capas-dedupe', type: 'multi',
      prompt: 'Un gateway reinicia y su spool republica eventos ya enviados. ¿Qué capas evitan que se cobren dos veces? Marca todas las que correspondan.',
      options: [
        'El productor idempotente de Kafka.',
        'La deduplicación por event_id en el procesador.',
        'Escribir en el almacén el valor de la fila con su versión, no un incremento.',
        'La conciliación de tres vías, si el estado de dedupe se perdió.'
      ],
      answer: [1, 2, 3],
      explain: 'El productor idempotente solo reconoce reintentos de la misma sesión de productor; un gateway reiniciado es un productor nuevo. Lo cubren el dedupe por id, las escrituras repetibles y, como red de seguridad, la conciliación. Repasa 21.5.'
    },
    {
      id: 'dedupe-memoria', type: 'single',
      prompt: 'Con 22.5 millones de eventos por día, una ventana de dedupe de 48 horas y unos 64 bytes por id, ¿cuánto estado hace falta?',
      options: ['Unos 290 MB', 'Unos 2.9 GB', 'Unos 29 GB', 'Unos 290 GB'],
      fixed: true,
      answer: 1,
      explain: '22.5 millones × 2 días = 45 millones de ids; × 64 bytes ≈ 2.9 GB, repartidos entre las particiones. Repasa 21.5.'
    },
    {
      id: 'replacing', type: 'single',
      prompt: 'Una tabla de ClickHouse con <code>ReplacingMergeTree(version)</code> recibe dos versiones de la misma fila horaria. ¿Qué devuelve un <code>SELECT sum(quantity)</code> sin <code>FINAL</code> un minuto después?',
      options: [
        'Siempre la versión nueva: el reemplazo es inmediato.',
        'Puede sumar las dos, porque las filas viejas se descartan recién cuando ClickHouse fusiona partes, en un momento que no se puede predecir.',
        'Un error por clave duplicada.',
        'Siempre la versión vieja.'
      ],
      answer: 1,
      explain: 'La deduplicación de ReplacingMergeTree ocurre en las fusiones en segundo plano y no está garantizada en un momento dado. Las consultas de facturación usan FINAL. Repasa 21.5.'
    },
    {
      id: 'event-time', type: 'single',
      prompt: '¿Por qué el uso se agrupa por la hora del evento y no por la hora en que lo procesó el sistema?',
      options: [
        'Porque es más rápido de calcular.',
        'Porque por hora de procesamiento el resultado depende del lag de Kafka: reprocesar el mismo log otro día daría otra distribución por hora, y otro precio si el precio cambió.',
        'Porque Kafka ordena los mensajes por hora del evento.',
        'Porque los clientes no ven la hora de procesamiento.'
      ],
      answer: 1,
      explain: 'Facturar exige reproducibilidad: el mismo log tiene que dar el mismo resultado siempre. Repasa 21.6 y 21.7.'
    },
    {
      id: 'tardio', type: 'single',
      prompt: 'En Flink, con la configuración por defecto, ¿qué pasa con un evento que llega después de que la marca de agua pasó el fin de su ventana?',
      options: [
        'Se agrega a la ventana siguiente.',
        'Se descarta: la tolerancia vale 0 por defecto. Para facturar hay que configurar una tolerancia y mandar lo que llegue después a una salida de tardíos.',
        'Se reintenta hasta que la ventana vuelve a abrir.',
        'Detiene el job con un error.'
      ],
      answer: 1,
      explain: 'Descartar es la opción por defecto e inaceptable cuando cada evento es dinero. Con allowedLateness y sideOutputLateData, nada se pierde. Repasa 21.6.'
    },
    {
      id: 'redondeo', type: 'single',
      prompt: 'Una request cuesta 0.008 USD y hay 3 millones de requests en el mes. ¿Qué pasa si cada una se redondea al centavo antes de sumar?',
      options: [
        'Nada: los errores de redondeo se compensan.',
        'La factura sale 30&#8239;000 USD en lugar de 24&#8239;000: un 25&#8239;% de más.',
        'La factura sale 0 USD.',
        'La factura sale 24&#8239;000.01 USD.'
      ],
      fixed: true,
      answer: 1,
      explain: '0.008 se redondea a 0.01 en todas: 3 millones × 0.01 = 30&#8239;000. Se suman las cantidades por línea y se redondea una sola vez. Repasa 21.7.'
    },
    {
      id: 'multiplicadores', type: 'single',
      prompt: 'Con los precios documentados de Claude Sonnet 5.5, ¿cuánto cuesta la request de 1&#8239;200 tokens de entrada, 8&#8239;000 leídos del caché y 400 de salida en batch?',
      options: ['0.0024 USD', '0.0040 USD', '0.0080 USD', '0.0112 USD'],
      fixed: true,
      answer: 1,
      explain: 'Síncrona: 1&#8239;200 × 2 + 8&#8239;000 × 0.20 + 400 × 10 = 8&#8239;000 millonésimas, 0.008 USD. Batch descuenta el 50&#8239;% y se combina con el precio del caché: 0.004 USD. Repasa 21.7.'
    },
    {
      id: 'ingreso-diferido', type: 'single',
      prompt: 'Un cliente compra 500 USD de créditos y todavía no usó nada. ¿Cómo se registra?',
      options: [
        'Como ingreso de 500 USD.',
        'Como ingreso diferido: una deuda en servicio con el cliente, que se vuelve ingreso a medida que consume.',
        'No se registra hasta que haya uso.',
        'Como gasto promocional.'
      ],
      answer: 1,
      explain: 'Las normas contables reconocen el ingreso al entregar el servicio. Cada consumo es un asiento que mueve dinero de los créditos del cliente a ingresos por uso. Repasa 21.8.'
    },
    {
      id: 'politicas-saldo', type: 'single',
      prompt: 'Con 20 USD de saldo, 20 streams a la vez y un costo máximo de 0.50 USD por request, la política "reservar el máximo" empieza a rechazar con unos 10 USD todavía en la cuenta. ¿Por qué?',
      options: [
        'Por un bug del simulador.',
        'Porque 20 reservas de 0.50 USD bloquean 10 USD que en promedio no se van a gastar.',
        'Porque el saldo se descuenta dos veces.',
        'Porque Stripe tarda en confirmar el saldo.'
      ],
      answer: 1,
      explain: 'Reservar el máximo nunca deja el saldo negativo, pero inmoviliza dinero. Reservar por tramos rechaza menos y, a cambio, puede cortar streams. Repasa 21.8.'
    },
    {
      id: 'exceso-tope', type: 'single',
      prompt: 'Gasto de 2 USD por segundo, 2 s de retraso del metering y 50 streams en vuelo con un costo máximo de 0.48 USD. ¿Cuánto puede pasar el tope?',
      options: ['4 USD', '24 USD', '28 USD', '144 USD'],
      fixed: true,
      answer: 2,
      explain: '2 × 2 = 4 USD por el retraso, más 50 × 0.48 = 24 USD de requests en vuelo: 28 USD. Si Kafka se atrasa 60 s, 144 USD; por eso el lag del consumidor de topes es una alerta de prioridad alta. Repasa 21.9.'
    },
    {
      id: 'stripe-agregado', type: 'single',
      prompt: '¿Por qué conviene mandar a Stripe el uso agregado por hora y no cada evento?',
      options: [
        'Porque Stripe no acepta meter events individuales.',
        'Porque cada evento son 520 llamadas por segundo en el pico, la mitad del límite de la cuenta, y Stripe acepta una sola llamada a la vez por cliente y meter; por hora son unas 7 por segundo, con un identifier que hace seguro el reenvío.',
        'Porque es más barato por evento.',
        'Porque así Stripe no necesita deduplicar.'
      ],
      answer: 1,
      explain: '3&#8239;000 organizaciones × 8 meters × 24 horas son 576&#8239;000 eventos por día. El identifier org:meter:hora es único al menos 24 horas. Repasa 21.10.'
    },
    {
      id: 'reproceso', type: 'order',
      prompt: 'Ordena los pasos de un reproceso seguro de una hora.',
      items: [
        'Leer la hora del log crudo inmutable, con todas las copias.',
        'Deduplicar desde cero y recalcular las filas con una versión mayor.',
        'Escribir en una tabla aparte y revisar el informe de diferencias.',
        'Publicar el resultado; si la hora ya se facturó, la diferencia va como ajuste en la factura siguiente.'
      ],
      explain: 'Leer de la fuente inmutable, escribir valores repetibles, comparar antes de publicar y no tocar lo facturado: así un reproceso no se convierte en un doble cobro. Repasa 21.12.'
    }
  ]
});
