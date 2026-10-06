SD.defineQuiz('m27', {
  title: 'Quiz: pagos tipo Stripe',
  pass: 0.7,
  questions: [
    {
      id: 'dinero', type: 'single',
      prompt: '¿Cómo se guarda un importe de 49.90 EUR en un sistema de pagos?',
      options: [
        'Como número de punto flotante con dos decimales: 49.90.',
        'Como el entero 4990 en céntimos, junto a la moneda EUR.',
        'Como el texto "49,90 €", tal como lo ve el cliente en el recibo.',
        'Como el entero 49 y los decimales aparte, sin moneda.'
      ],
      answer: 1,
      explain: 'Enteros en unidades menores, siempre con su moneda. El punto flotante acumula errores (0.1 + 0.2 no da 0.3), y la cantidad de decimales cambia de una moneda a otra: el yen no tiene.'
    },
    {
      id: 'clave', type: 'single',
      prompt: 'El backend del comercio genera la idempotency key con un UUID nuevo en cada intento de llamada. ¿Qué protege?',
      options: [
        'Todo: la clave es única y el procesador nunca ve dos pagos con la misma.',
        'Nada contra reintentos: cada uno llega con clave nueva y cuenta como otro pago.',
        'Solo los reintentos del mismo segundo, porque el UUID incluye la hora.',
        'Solo los reintentos tras un 500, que el procesador asocia por el número de tarjeta.'
      ],
      answer: 1,
      explain: 'La clave identifica la intención ("cobrar el pedido ord_8812"), no la llamada. Se genera una vez, se guarda y se reutiliza en cada reintento.'
    },
    {
      id: 'contrato', type: 'multi',
      prompt: '¿Qué garantiza el contrato de idempotency keys de Stripe?',
      options: [
        'Repetir con la misma clave devuelve la respuesta guardada, aunque fuera un 500.',
        'La misma clave con parámetros distintos se ejecuta como un pago nuevo.',
        'Una request con una clave que otra request está usando en ese momento recibe un conflicto.',
        'Las claves se guardan para siempre, para detectar duplicados de cualquier fecha.',
        'Las claves se pueden borrar pasadas al menos 24 horas.'
      ],
      answer: [0, 2, 4],
      explain: 'Con parámetros distintos la respuesta es un error, porque reutilizar una clave para otra cosa es un bug del cliente. Y las claves vencen: un reintento de días después es una operación nueva.'
    },
    {
      id: 'timeout', type: 'single',
      prompt: 'El conector pide una autorización a la red y la respuesta nunca llega. ¿Qué debe hacer?',
      options: [
        'Reintentar la autorización enseguida con el mismo número de intento.',
        'Enviar una reversa por ese intento y darlo por fallido.',
        'Marcar el pago como pendiente y esperar el webhook del banco emisor.',
        'Esperar a la conciliación del día siguiente para saber si se aprobó.'
      ],
      answer: 1,
      explain: 'Si el emisor aprobó y la respuesta se perdió, reintentar retendría el dinero dos veces. La reversa deshace lo que pudo haber pasado; la conciliación queda como red de seguridad.'
    },
    {
      id: 'ledger', type: 'single',
      prompt: '¿Qué invariante define a un ledger de doble entrada?',
      options: [
        'Que ninguna cuenta puede quedar con saldo negativo después de un asiento.',
        'Que los asientos de cada transacción, por moneda, suman cero.',
        'Que se guarda el saldo de cada cuenta en una columna y se actualiza en cada pago.',
        'Que cada asiento se escribe dos veces, en dos bases distintas.'
      ],
      answer: 1,
      explain: 'Los saldos se derivan de los asientos, y nada se edita: un error se corrige con asientos nuevos. Así cada centavo tiene historia y una cuenta transitoria que no vuelve a cero delata un problema.'
    },
    {
      id: 'webhook-orden', type: 'single',
      prompt: 'Un comercio recibe charge.refunded y después, por un reintento, payment_intent.succeeded del mismo pago. ¿Cómo evita marcar como pagado un pedido reembolsado?',
      options: [
        'Procesando los eventos en el orden en que llegan, que es el orden en que ocurrieron.',
        'Haciendo que el estado del pedido solo avance, o consultando el pago a la API.',
        'Rechazando con 400 los eventos con fecha anterior al último procesado.',
        'Respondiendo 200 sin procesar, para que el procesador no reintente.'
      ],
      answer: 1,
      explain: 'El orden de entrega no está garantizado. Un UPDATE condicionado al estado anterior (WHERE status = \'pending\') no puede hacer retroceder un pedido, y el id del evento evita procesarlo dos veces.'
    },
    {
      id: 'webhook-firma', type: 'single',
      prompt: 'Un receptor verifica la firma del webhook después de parsear el JSON y volver a serializarlo. Las firmas fallan de vez en cuando. ¿Por qué?',
      options: [
        'Porque el secreto está mal configurado en algunas instancias del receptor.',
        'Porque la firma cubre los bytes exactos y re-serializar los cambia.',
        'Porque solo algunos tipos de webhook vienen firmados y el resto no.',
        'Porque la hora del servidor está adelantada y el timestamp queda fuera de tolerancia.'
      ],
      answer: 1,
      explain: 'Se verifica sobre el cuerpo crudo, antes de parsear. La tolerancia de tiempo (unos 5 minutos) frena repeticiones viejas, pero un minuto de diferencia de reloj no la supera.'
    },
    {
      id: 'saga', type: 'single',
      prompt: 'En una saga de marketplace (cobrar, transferir al vendedor, reservar el envío), falla la reserva del envío. ¿Qué pasa?',
      options: [
        'Se hace rollback de la transacción distribuida que abarca los tres servicios.',
        'Se compensan los pasos anteriores en orden inverso, cada uno con su clave.',
        'Se reintenta la reserva hasta que funcione, porque los pasos anteriores ya están hechos.',
        'Se reembolsa al comprador y el vendedor conserva la transferencia.'
      ],
      answer: 1,
      explain: 'No hay transacción que abarque sistemas distintos. La saga guarda su estado y compensa con acciones nuevas, que quedan registradas en el ledger: el comprador ve el cobro y el reembolso.'
    },
    {
      id: 'conciliacion', type: 'single',
      prompt: 'La conciliación encuentra un cobro en el archivo del adquirente que no está en el ledger. ¿Qué indica?',
      options: [
        'Nada grave: pasa por diferencias de horario y aparece en el ledger al día siguiente.',
        'Que se movió dinero sin registrarlo, por ejemplo tras un timeout.',
        'Que el archivo del adquirente está duplicado y hay que pedirlo de nuevo.',
        'Que el comercio canceló el pedido después de que el pago se capturó.'
      ],
      answer: 1,
      explain: 'Lo contrario (en el ledger y no en el archivo) suele ser horario y se resuelve solo en un día. Un cobro sin registro significa que alguna garantía falló, y hay que encontrar cuál.'
    },
    {
      id: 'pci', type: 'single',
      prompt: '¿Por qué los campos de tarjeta de Stripe Elements viven en un iframe del procesador?',
      options: [
        'Para que el formulario se vea igual en todos los comercios y genere confianza.',
        'Para que el número de tarjeta nunca toque los servidores del comercio.',
        'Para que carguen más rápido desde la CDN del procesador.',
        'Para que el procesador pueda saltarse el 3D Secure en pagos de confianza.'
      ],
      answer: 1,
      explain: 'El costo de PCI DSS depende de cuántos sistemas tocan tarjetas. Con el iframe, el comercio solo maneja tokens, y del lado del procesador una sola bóveda guarda los números.'
    },
    {
      id: 'sca-exencion', type: 'single',
      prompt: 'Un cliente europeo paga 25 EUR con tarjeta. ¿Qué pasa con la autenticación reforzada (3D Secure)?',
      options: [
        'Es obligatoria siempre en Europa, sin excepciones, desde la entrada de PSD2.',
        'Puede pedirse la exención de bajo valor, pero el banco puede exigir la autenticación igual.',
        'Nunca se necesita en pagos menores de 100 EUR, que es el umbral de PSD2.',
        'Solo aplica si el comercio la activa; si no, el banco aprueba sin autenticar.'
      ],
      answer: 1,
      explain: 'Las exenciones reducen la fricción pero no eliminan la decisión del emisor. Un buen procesador reconoce el rechazo suave y vuelve a pedir el pago con autenticación en lugar de dar el pago por perdido.'
    },
    {
      id: 'liability', type: 'single',
      prompt: 'Un pago se autenticó con 3D Secure y semanas después el titular lo disputa diciendo que no lo autorizó. ¿Qué cambia respecto de un pago sin autenticar?',
      options: [
        'Nada: el comercio siempre pierde las disputas de fraude, autenticadas o no.',
        'La responsabilidad por el fraude pasó al banco emisor.',
        'El contracargo se cancela automáticamente, porque la red no admite disputar pagos autenticados.',
        'El procesador cubre el monto con su seguro de fraude.'
      ],
      answer: 1,
      explain: 'El valor de autenticación (CAVV) y el indicador ECI 05 en la autorización son la prueba de que el emisor autenticó al titular. Por eso 3D Secure también es una herramienta contra el fraude, no solo contra la regulación.'
    },
    {
      id: 'limitador', type: 'multi',
      prompt: 'Diseñas el limitador de tasa por cuenta de una API de pagos con un token bucket en Redis. ¿Qué decisiones son correctas?',
      options: [
        'Leer y actualizar el balde en un solo script atómico.',
        'Usar el reloj de Redis y no el de cada servidor de la API.',
        'Si Redis no responde, dejar pasar la request (fail-open).',
        'Si Redis no responde, rechazar todas las requests, porque un pago sin límite es un riesgo de fraude.',
        'Activarlo de golpe en producción con el umbral que parezca razonable según el tráfico promedio.'
      ],
      answer: [0, 1, 2],
      explain: 'Un limitador se lanza primero a oscuras (dark launch): registra qué bloquearía sin bloquear, se ajustan los umbrales y recién entonces se activa, con un interruptor para apagarlo. Rechazar todos los pagos porque falló el limitador sería peor que no limitar unos minutos.'
    },
    {
      id: 'prioridad', type: 'single',
      prompt: 'Durante un incidente, el load shedder por utilización de workers tiene que descartar tráfico. ¿En qué orden?',
      options: [
        'Al azar, para que ningún cliente pierda más que otro durante el incidente.',
        'Primero el tráfico de prueba, luego los GET, los POST y por último los críticos.',
        'Primero los métodos críticos, porque son los que más workers ocupan.',
        'Primero los clientes más grandes, porque generan la mayor parte de la carga.'
      ],
      answer: 1,
      explain: 'Se descarta por prioridad de negocio, desde lo que menos duele perder. Crear un pago es lo último que se sacrifica. Y la gradualidad importa: un descarte brusco y una recuperación brusca hacen que el sistema oscile entre saturado y vacío.'
    },
    {
      id: 'cuenta-caliente', type: 'single',
      prompt: 'En tu ledger, la cuenta "ingresos por comisiones" recibe un asiento por cada pago y las transacciones se bloquean entre sí. ¿Qué haces?',
      options: [
        'Quitas las restricciones de integridad de la tabla para que los bloqueos duren menos.',
        'La repartes en N subcuentas, escribes en hash(pago) % N y las sumas al leer.',
        'Guardas el saldo en un campo y lo actualizas con un UPDATE en cada pago.',
        'Bajas el aislamiento a READ COMMITTED para que las transacciones no se esperen.'
      ],
      answer: 1,
      explain: 'Una cuenta compartida por todos es una fila que todos quieren bloquear a la vez. Repartirla quita la contención y deja el saldo total intacto; el costo es una suma al leer, que se resuelve con snapshots.'
    },
    {
      id: 'payout-dos-fases', type: 'single',
      prompt: '¿Por qué un payout se modela en dos fases (reservar, y después confirmar o anular)?',
      options: [
        'Porque la norma contable exige registrar cada payout en dos asientos separados.',
        'Porque el banco puede rechazar o demorar días, y el monto no puede gastarse dos veces.',
        'Para cobrar la comisión del payout en la primera fase y el monto en la segunda.',
        'Porque la base de datos no admite una transacción que dure lo que tarda el banco.'
      ],
      answer: 1,
      explain: 'Es el mismo patrón que autorizar y capturar. Un payout que sale y falla días después se revierte con asientos nuevos: el saldo vuelve a disponible y nunca se pierde ni se gasta dos veces.'
    },
    {
      id: 'stan-rrn', type: 'single',
      prompt: '¿Para qué sirven el STAN (campo 11) y el RRN (campo 37) de un mensaje ISO 8583?',
      options: [
        'Son dos nombres del mismo dato: uno lo usa la red y otro el banco emisor.',
        'El STAN identifica el intento contra la red; el RRN, la transacción para siempre.',
        'El STAN identifica la transacción para siempre; el RRN, cada reintento contra la red.',
        'El STAN es el número de terminal del comercio y el RRN, el lote de liquidación.'
      ],
      answer: 1,
      explain: 'Por eso se guarda el STAN antes de salir: si la respuesta se pierde, la recuperación sabe por cuál número preguntar o revertir. Y por eso el RRN es la clave de unión de la conciliación.'
    },
    {
      id: 'disputa-ledger', type: 'single',
      prompt: 'Llega hoy un contracargo de 49.90 EUR y la disputa se resolverá en semanas. ¿Cuándo registra el ledger el movimiento?',
      options: [
        'Cuando se resuelva la disputa, porque antes no se sabe quién pierde el dinero.',
        'Hoy, con asientos que sacan el monto y la tarifa del saldo del comercio.',
        'Nunca: las disputas las maneja la red y no pasan por el ledger del procesador.',
        'Hoy, editando el asiento del cobro original para dejarlo en cero.'
      ],
      answer: 1,
      explain: 'El ledger registra lo que ya ocurrió con el dinero, no lo que podría ocurrir. La red retiró el monto ese día; si después el comercio gana, eso es otro movimiento. Nada se edita.'
    },
    {
      id: 'migracion-orden', type: 'order',
      prompt: 'Ordena las cuatro fases para cambiar el modelo de datos sin apagar el sistema:',
      items: [
        'Escribir en el modelo viejo y en el nuevo, y rellenar los datos antiguos',
        'Pasar las lecturas al modelo nuevo',
        'Pasar las escrituras para que solo vayan al modelo nuevo',
        'Borrar los datos y el código del modelo viejo'
      ],
      explain: 'El modelo viejo sigue siendo la fuente de verdad hasta que el nuevo está completo y probado con lecturas reales. Mientras se escribe en ambos, se puede volver atrás; lo irreversible, borrar, queda para el final.'
    },
    {
      id: 'pci-cuenta', type: 'single',
      prompt: 'Armas un procesador en AWS. ¿Por qué la bóveda de tarjetas y el conector del adquirente van en una cuenta aparte?',
      options: [
        'Porque AWS exige una cuenta separada para cualquier carga de trabajo con tarjetas.',
        'Para limitar el alcance de PCI DSS a la única cuenta que ve números de tarjeta.',
        'Para pagar menos: los servicios con certificación PCI se cobran por cuenta.',
        'Porque Aurora no puede cifrar columnas con claves de KMS en la misma cuenta.'
      ],
      answer: 1,
      explain: 'El costo de PCI DSS crece con la cantidad de sistemas que tocan tarjetas. Una cuenta aislada, sin internet y con un solo canal hacia el core, reduce lo que hay que auditar y lo que puede filtrarse.'
    }
  ]
});
