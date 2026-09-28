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
    }
  ]
});
