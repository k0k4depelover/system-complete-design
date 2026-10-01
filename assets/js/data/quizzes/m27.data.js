SD.defineQuiz('m27', {
  title: 'Quiz: pagos tipo Stripe',
  pass: 0.7,
  questions: [
    {
      id: 'dinero', type: 'single',
      prompt: '¿Cómo se guarda un importe de 49.90 EUR en un sistema de pagos?',
      options: [
        'Como número de punto flotante: 49.9.',
        'Como el entero 4990 en céntimos, junto a la moneda EUR.',
        'Como el texto "49,90 €".',
        'Como el entero 49 y los decimales aparte, sin moneda.'
      ],
      answer: 1,
      explain: 'Enteros en unidades menores, siempre con su moneda. El punto flotante acumula errores (0.1 + 0.2 no da 0.3), y la cantidad de decimales cambia de una moneda a otra: el yen no tiene.'
    },
    {
      id: 'clave', type: 'single',
      prompt: 'El backend del comercio genera la idempotency key con un UUID nuevo en cada intento de llamada. ¿Qué protege?',
      options: [
        'Todo: la clave es única.',
        'Nada contra reintentos: cada reintento lleva una clave nueva y el procesador lo trata como un pago nuevo. La clave tiene que derivar de la operación, por ejemplo del pedido.',
        'Solo los reintentos del mismo segundo.',
        'Solo los errores 500.'
      ],
      answer: 1,
      explain: 'La clave identifica la intención ("cobrar el pedido ord_8812"), no la llamada. Se genera una vez, se guarda y se reutiliza en cada reintento.'
    },
    {
      id: 'contrato', type: 'multi',
      prompt: '¿Qué garantiza el contrato de idempotency keys de Stripe?',
      options: [
        'Repetir una request con la misma clave devuelve la respuesta guardada de la primera, incluso si fue un error 500.',
        'La misma clave con parámetros distintos se ejecuta como un pago nuevo.',
        'Una request con una clave que otra request está usando en ese momento recibe un conflicto.',
        'Las claves se guardan para siempre.',
        'Las claves se pueden borrar pasadas al menos 24 horas.'
      ],
      answer: [0, 2, 4],
      explain: 'Con parámetros distintos la respuesta es un error, porque reutilizar una clave para otra cosa es un bug del cliente. Y las claves vencen: un reintento de días después es una operación nueva.'
    },
    {
      id: 'timeout', type: 'single',
      prompt: 'El conector pide una autorización a la red y la respuesta nunca llega. ¿Qué debe hacer?',
      options: [
        'Reintentar la autorización enseguida.',
        'Enviar una reversa por ese número de intento, para anular una posible aprobación, y dar el intento por fallido.',
        'Marcar el pago como exitoso por las dudas.',
        'Esperar a la conciliación del día siguiente sin hacer nada.'
      ],
      answer: 1,
      explain: 'Si el emisor aprobó y la respuesta se perdió, reintentar retendría el dinero dos veces. La reversa deshace lo que pudo haber pasado; la conciliación queda como red de seguridad.'
    },
    {
      id: 'ledger', type: 'single',
      prompt: '¿Qué invariante define a un ledger de doble entrada?',
      options: [
        'Que cada cuenta tiene saldo positivo.',
        'Que los asientos de cada transacción, por moneda, suman cero: el dinero solo se mueve entre cuentas.',
        'Que se guarda el saldo de cada cuenta en una columna.',
        'Que cada asiento tiene dos copias.'
      ],
      answer: 1,
      explain: 'Los saldos se derivan de los asientos, y nada se edita: un error se corrige con asientos nuevos. Así cada centavo tiene historia y una cuenta transitoria que no vuelve a cero delata un problema.'
    },
    {
      id: 'webhook-orden', type: 'single',
      prompt: 'Un comercio recibe charge.refunded y después, por un reintento, payment_intent.succeeded del mismo pago. ¿Cómo evita marcar como pagado un pedido reembolsado?',
      options: [
        'Procesando los eventos en el orden en que llegan.',
        'Deduplicando por id del evento y haciendo que el estado del pedido solo avance (o consultando el estado actual del pago a la API).',
        'Rechazando con 400 los eventos viejos.',
        'Pidiendo al procesador que no reintente.'
      ],
      answer: 1,
      explain: 'El orden de entrega no está garantizado. Un UPDATE condicionado al estado anterior (WHERE status = \'pending\') no puede hacer retroceder un pedido, y el id del evento evita procesarlo dos veces.'
    },
    {
      id: 'webhook-firma', type: 'single',
      prompt: 'Un receptor verifica la firma del webhook después de parsear el JSON y volver a serializarlo. Las firmas fallan de vez en cuando. ¿Por qué?',
      options: [
        'Porque el secreto está mal.',
        'Porque la firma se calcula sobre los bytes exactos del cuerpo; re-serializar cambia espacios u orden y el HMAC deja de coincidir.',
        'Porque los webhooks no vienen firmados.',
        'Porque la hora del servidor está adelantada un minuto.'
      ],
      answer: 1,
      explain: 'Se verifica sobre el cuerpo crudo, antes de parsear. La tolerancia de tiempo (unos 5 minutos) frena repeticiones viejas, pero un minuto de diferencia de reloj no la supera.'
    },
    {
      id: 'saga', type: 'single',
      prompt: 'En una saga de marketplace (cobrar, transferir al vendedor, reservar el envío), falla la reserva del envío. ¿Qué pasa?',
      options: [
        'Se hace rollback de la base de datos y listo.',
        'Se ejecutan las compensaciones de los pasos anteriores en orden inverso: revertir la transferencia y reembolsar al comprador, cada una con su idempotency key.',
        'Se reintenta la reserva para siempre.',
        'Se deja el dinero en el vendedor.'
      ],
      answer: 1,
      explain: 'No hay transacción que abarque sistemas distintos. La saga guarda su estado y compensa con acciones nuevas, que quedan registradas en el ledger: el comprador ve el cobro y el reembolso.'
    },
    {
      id: 'conciliacion', type: 'single',
      prompt: 'La conciliación encuentra un cobro en el archivo del adquirente que no está en el ledger. ¿Qué indica?',
      options: [
        'Nada: pasa por diferencias de horario.',
        'Que se movió dinero sin que el sistema lo registrara, típicamente por un timeout mal resuelto: es la excepción más grave.',
        'Que el archivo está duplicado.',
        'Que el comercio canceló el pedido.'
      ],
      answer: 1,
      explain: 'Lo contrario (en el ledger y no en el archivo) suele ser horario y se resuelve solo en un día. Un cobro sin registro significa que alguna garantía falló, y hay que encontrar cuál.'
    },
    {
      id: 'pci', type: 'single',
      prompt: '¿Por qué los campos de tarjeta de Stripe Elements viven en un iframe del procesador?',
      options: [
        'Por diseño visual.',
        'Para que el número de tarjeta vaya directo del navegador al procesador y nunca toque los servidores del comercio, que así queda en el alcance más simple de PCI DSS.',
        'Para que carguen más rápido.',
        'Para evitar el 3D Secure.'
      ],
      answer: 1,
      explain: 'El costo de PCI DSS depende de cuántos sistemas tocan tarjetas. Con el iframe, el comercio solo maneja tokens, y del lado del procesador una sola bóveda guarda los números.'
    },
    {
      id: 'sca-exencion', type: 'single',
      prompt: 'Un cliente europeo paga 25 EUR con tarjeta. ¿Qué pasa con la autenticación reforzada (3D Secure)?',
      options: [
        'Es obligatoria siempre, sin excepciones.',
        'Puede aplicarse la exención de bajo valor (menos de 30 EUR, con tope de 5 pagos seguidos o 100 EUR acumulados), pero es una petición: el banco puede exigir la autenticación de todos modos con un rechazo suave, y entonces se reintenta el mismo pago autenticado.',
        'Nunca se necesita en pagos menores de 100 EUR.',
        'Solo aplica si el comercio la activa.'
      ],
      answer: 1,
      explain: 'Las exenciones reducen la fricción pero no eliminan la decisión del emisor. Un buen procesador reconoce el rechazo suave y vuelve a pedir el pago con autenticación en lugar de dar el pago por perdido.'
    },
    {
      id: 'liability', type: 'single',
      prompt: 'Un pago se autenticó con 3D Secure y semanas después el titular lo disputa diciendo que no lo autorizó. ¿Qué cambia respecto de un pago sin autenticar?',
      options: [
        'Nada: el comercio siempre pierde las disputas.',
        'La responsabilidad por el fraude pasó al banco emisor (liability shift), y el comercio tiene una defensa fuerte porque el banco autenticó al titular.',
        'El contracargo se cancela automáticamente y sin costo.',
        'El procesador devuelve el dinero sin preguntar.'
      ],
      answer: 1,
      explain: 'El valor de autenticación (CAVV) y el indicador ECI 05 en la autorización son la prueba de que el emisor autenticó al titular. Por eso 3D Secure también es una herramienta contra el fraude, no solo contra la regulación.'
    },
    {
      id: 'limitador', type: 'multi',
      prompt: 'Diseñas el limitador de tasa por cuenta de una API de pagos con un token bucket en Redis. ¿Qué decisiones son correctas?',
      options: [
        'Hacer la lectura y la actualización del balde en un solo script atómico.',
        'Usar el reloj de Redis y no el de cada servidor de la API, para que todos midan igual.',
        'Si Redis no responde, dejar pasar la request (fail-open): el limitador protege, no decide si el pago es correcto.',
        'Si Redis no responde, rechazar todas las requests.',
        'Activarlo de golpe en producción con el umbral que parezca razonable.'
      ],
      answer: [0, 1, 2],
      explain: 'Un limitador se lanza primero a oscuras (dark launch): registra qué bloquearía sin bloquear, se ajustan los umbrales y recién entonces se activa, con un interruptor para apagarlo. Rechazar todos los pagos porque falló el limitador sería peor que no limitar unos minutos.'
    },
    {
      id: 'prioridad', type: 'single',
      prompt: 'Durante un incidente, el load shedder por utilización de workers tiene que descartar tráfico. ¿En qué orden?',
      options: [
        'Al azar, para ser justos.',
        'Primero el tráfico de prueba, luego los GET, luego los POST y por último los métodos críticos, como crear un cargo, y de forma gradual para no oscilar.',
        'Primero los métodos críticos, porque son los más costosos.',
        'Primero los clientes más grandes.'
      ],
      answer: 1,
      explain: 'Se descarta por prioridad de negocio, desde lo que menos duele perder. Crear un pago es lo último que se sacrifica. Y la gradualidad importa: un descarte brusco y una recuperación brusca hacen que el sistema oscile entre saturado y vacío.'
    },
    {
      id: 'cuenta-caliente', type: 'single',
      prompt: 'En tu ledger, la cuenta "ingresos por comisiones" recibe un asiento por cada pago y las transacciones se bloquean entre sí. ¿Qué haces?',
      options: [
        'Quitas las restricciones de integridad de la tabla.',
        'La repartes en N subcuentas (comisiones:0 a comisiones:31), escribes en la que dice hash(pago) % N y las sumas al leer.',
        'Guardas el saldo en un campo y lo actualizas con un UPDATE en cada pago.',
        'Procesas los pagos de a uno.'
      ],
      answer: 1,
      explain: 'Una cuenta compartida por todos es una fila que todos quieren bloquear a la vez. Repartirla quita la contención y deja el saldo total intacto; el costo es una suma al leer, que se resuelve con snapshots.'
    },
    {
      id: 'payout-dos-fases', type: 'single',
      prompt: '¿Por qué un payout se modela en dos fases (reservar, y después confirmar o anular)?',
      options: [
        'Por cumplir una norma contable.',
        'Porque el banco puede rechazar o demorar días: se reserva el monto para que no se gaste dos veces, se llama al banco con una idempotency key y se confirma o se anula según el resultado.',
        'Para cobrar una comisión extra.',
        'Porque las bases de datos no admiten una sola transacción.'
      ],
      answer: 1,
      explain: 'Es el mismo patrón que autorizar y capturar. Un payout que sale y falla días después se revierte con asientos nuevos: el saldo vuelve a disponible y nunca se pierde ni se gasta dos veces.'
    },
    {
      id: 'stan-rrn', type: 'single',
      prompt: '¿Para qué sirven el STAN (campo 11) y el RRN (campo 37) de un mensaje ISO 8583?',
      options: [
        'Son dos nombres del mismo dato.',
        'El STAN identifica el intento contra la red (detecta duplicados y permite revertirlo); el RRN identifica la transacción para siempre: la liquidación, las disputas y la conciliación la llaman por él.',
        'El STAN es la clave de cifrado y el RRN, el saldo.',
        'El STAN es el número de tarjeta y el RRN, el del comercio.'
      ],
      answer: 1,
      explain: 'Por eso se guarda el STAN antes de salir: si la respuesta se pierde, la recuperación sabe por cuál número preguntar o revertir. Y por eso el RRN es la clave de unión de la conciliación.'
    },
    {
      id: 'disputa-ledger', type: 'single',
      prompt: 'Llega hoy un contracargo de 49.90 EUR y la disputa se resolverá en semanas. ¿Cuándo registra el ledger el movimiento?',
      options: [
        'Cuando se resuelva la disputa.',
        'Hoy, con asientos que sacan el monto (y la tarifa) del saldo del comercio; si el comercio gana, una reversión con asientos nuevos.',
        'Nunca: las disputas no pasan por el ledger.',
        'Editando el asiento del cobro original.'
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
        'Porque AWS lo exige para cualquier carga de trabajo.',
        'Para limitar el alcance de PCI DSS a esa cuenta: es la única que ve números de tarjeta, y se conecta con el core por PrivateLink, de modo que el resto del sistema solo maneja tokens.',
        'Para pagar menos por los servicios.',
        'Porque Aurora no puede guardar tokens.'
      ],
      answer: 1,
      explain: 'El costo de PCI DSS crece con la cantidad de sistemas que tocan tarjetas. Una cuenta aislada, sin internet y con un solo canal hacia el core, reduce lo que hay que auditar y lo que puede filtrarse.'
    }
  ]
});
