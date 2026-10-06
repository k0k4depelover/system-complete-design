/* Ejercicio guiado del M21 (metering y facturación por uso). Formato en core/exercise.js. */

SD.defineExercise('m21-metering', {
  title: 'facturar por uso a 3&#8239;000 empresas',
  scenario: '<p>Una API de modelos tiene 3&#8239;000 organizaciones clientes. Algunas prepagan créditos y otras reciben una factura mensual. En el pico hay 400 requests nuevas por segundo; un 5&#8239;% son agentes que mantienen el stream abierto hasta 20 minutos. Los gateways corren en tres regiones y, una o dos veces por año, una región queda aislada durante horas.</p><p>Finanzas pide tres cosas: ningún uso sin cobrar, ningún cobro duplicado y facturas que se puedan explicar request por request. Los clientes prepagos no pueden pasar de un sobregiro de 5 USD. Diseña el metering decisión por decisión.</p>',
  steps: [
    {
      id: 'origen', type: 'single',
      prompt: '¿Dónde nace el evento de uso que se cobra?',
      options: [
        'En el motor, al terminar cada request, porque es quien cuenta los tokens.',
        'En el gateway, al cerrar el stream, con el usage que le manda el motor.',
        'En el cliente, que manda el usage de vuelta y así confirma lo que recibió.',
        'En el limitador, al reconciliar cada reserva con el uso real.'
      ],
      answer: 1,
      explain: 'El gateway sabe a quién cobrar, qué recibió el cliente y qué herramientas cobró aparte. El registro del motor es una fuente independiente: si un gateway muere, la conciliación encuentra lo que falta.'
    },
    {
      id: 'id', type: 'single',
      prompt: '¿Cómo se construye el event_id?',
      options: [
        'Un UUID v4 generado al emitir, que nunca se repite entre eventos.',
        'request_id más el tipo de evento y el número de tramo.',
        'El hash del contenido del evento, incluida la hora de emisión.',
        'El offset de Kafka donde quedó escrito, único dentro de su partición.'
      ],
      answer: 1,
      explain: 'Tiene que salir igual en cada copia del mismo uso: en el reenvío del spool y en el evento que reconstruye la conciliación. Un UUID, una hora de emisión o un offset cambian entre copias.'
    },
    {
      id: 'largos', type: 'single',
      prompt: 'Un agente mantiene un stream abierto 20 minutos y gasta 6 USD. ¿Cómo se mide?',
      options: [
        'Con un solo evento al final, como cualquier request.',
        'Con eventos parciales cada 30 s o cada 4&#8239;000 tokens, y un final.',
        'Con un evento por token generado, para no perder nada si el stream se corta.',
        'No se mide hasta que el agente termina su tarea completa.'
      ],
      answer: 1,
      explain: 'Con un solo evento, el saldo y el tope no ven ese gasto durante 20 minutos, y si el gateway muere se pierde todo. Con tramos, el saldo baja mientras el stream sigue y una caída pierde a lo sumo un tramo.'
    },
    {
      id: 'ventanas', type: 'single',
      prompt: 'Una región aislada vuelve y publica eventos de hace tres horas. ¿Qué configuración del procesador conviene?',
      options: [
        'La de Flink por defecto: tolerancia 0, y los tardíos se descartan.',
        'Tolerancia de 1 hora con reemisión, y una salida de tardíos para lo posterior.',
        'Agrupar por hora de procesamiento, así no hay tardíos y el resultado es estable.',
        'Mantener todas las ventanas abiertas 35 días, hasta cerrar la factura del mes.'
      ],
      answer: 1,
      explain: 'Descartar es perder dinero. Agrupar por hora de procesamiento hace que el resultado dependa del lag y no se pueda reproducir. Mantener 35 días de ventanas abiertas es estado enorme para un caso raro: la salida de tardíos lo resuelve.'
    },
    {
      id: 'precio', type: 'single',
      prompt: 'El precio de un modelo baja el 1 de octubre a las 00:00 UTC. Un evento de las 23:59:58 del 30 de septiembre llega a las 00:00:03. ¿Qué precio se aplica?',
      options: [
        'El nuevo, porque es el vigente cuando se procesa y se factura.',
        'El viejo, porque el catálogo se consulta con la hora del evento.',
        'El más bajo de los dos, para no cobrar de más en el cambio.',
        'El nuevo, porque el evento llegó en octubre y la factura es de octubre.'
      ],
      answer: 1,
      explain: 'El precio de la hora del evento hace que reprocesar dé siempre el mismo resultado. Una política comercial distinta se modela en el catálogo, no se decide al procesar.'
    },
    {
      id: 'saldo', type: 'single',
      prompt: 'Los clientes prepagos no pueden pasar de 5 USD de sobregiro. ¿Qué política de autorización usas?',
      options: [
        'Cobrar al terminar y admitir mientras el saldo sea positivo.',
        'Reservar el costo máximo de cada request contra el saldo, sin sobregiro.',
        'Reservar por tramos contra el saldo más el sobregiro permitido.',
        'Consultar el ledger en PostgreSQL en cada request y en cada tramo del stream.'
      ],
      answer: 2,
      explain: 'Cobrar al terminar no acota el sobregiro: depende de cuántos streams haya en vuelo. Reservar el máximo bloquea dinero y rechaza requests pagables. Consultar el ledger en cada request pone una base transaccional en el camino de 400 requests por segundo. Los tramos acotan el sobregiro y desperdician poco.'
    },
    {
      id: 'redondeo', type: 'single',
      prompt: '¿Dónde se redondea al centavo?',
      options: [
        'En cada evento, al descontar el saldo, para que el saldo siempre sea exacto.',
        'En cada agregado horario, antes de mandarlo a Stripe.',
        'Una vez por línea de factura, sobre la cantidad del ciclo.',
        'En ningún lado: las facturas se emiten con decimales de centavo.'
      ],
      answer: 2,
      explain: 'Redondear cada evento de 0.008 USD lo vuelve 0.01: un 25&#8239;% de más. Redondear cada hora acumula hasta medio centavo por línea y por hora. Una vez por línea, el error total es menor que medio centavo por línea.'
    },
    {
      id: 'conciliar', type: 'multi',
      prompt: '¿Qué compara la conciliación horaria? Marca todas las que correspondan.',
      options: [
        'El registro del motor contra los eventos final, por request_id.',
        'El log crudo deduplicado contra los agregados, por organización y hora.',
        'Los contadores del limitador contra el uso exacto.',
        'Los agregados contra el limitador, para corregir los agregados con el número en tiempo real.'
      ],
      answer: [0, 1, 2],
      explain: 'Las tres primeras encuentran eventos perdidos, errores del pipeline y desvíos del limitador. La cuarta va en la dirección equivocada: el limitador es aproximado y nunca corrige al metering.'
    }
  ],
  solution: '<ul>' +
    '<li><b>Medir:</b> el gateway emite al cerrar cada stream, desde un spool en disco, con acks=all y productor idempotente. Los streams largos emiten tramos cada 30 s. Los cancelados se cobran con el uso que informó el motor. El motor publica su registro en otro tópico.</li>' +
    '<li><b>Evento:</b> sin precio, inmutable, con event_id determinista y la hora del evento en UTC. La organización es la clave del tópico.</li>' +
    '<li><b>Procesar:</b> dedupe por event_id con 48 horas de estado (~2.9 GB), ventanas por hora con 5 minutos de desorden y 1 hora de tolerancia, salida de tardíos como filas de corrección, y agregados escritos como valores versionados en ReplacingMergeTree, leídos con FINAL para facturar.</li>' +
    '<li><b>Tarifar:</b> catálogo versionado por hora del evento, con contrato, plan y lista. Dinero en nanodólares; redondeo una vez por línea.</li>' +
    '<li><b>Saldo:</b> ledger de doble entrada con lotes que vencen; reservas por tramos contra saldo más 5 USD de sobregiro; recarga automática idempotente.</li>' +
    '<li><b>Factura:</b> uso horario a Stripe con identifier org:meter:hora; las horas corregidas después del cierre van como ajuste en el ciclo siguiente; dunning con restricción a prepago.</li>' +
    '<li><b>Conciliar:</b> cada hora, motor contra log, log contra agregados y agregados contra limitador. Se reconstruyen eventos, se reprocesan horas y se corrige al limitador, nunca al revés.</li>' +
    '</ul>'
});
