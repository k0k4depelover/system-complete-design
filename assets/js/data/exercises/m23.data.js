/* Ejercicio guiado del M23 (imágenes y multimodal). Formato en core/exercise.js. */

SD.defineExercise('m23-imagenes', {
  title: 'generación de imágenes para 2 millones de usuarios diarios',
  scenario: '<p>Un asistente tiene 2 millones de usuarios activos por día: 1.8 millones en el plan gratuito y 200&#8239;000 en un plan pago de 20 USD al mes. El equipo quiere sumar generación de imágenes. Las estimaciones: un 30&#8239;% de los usuarios gratuitos genera unas 2.5 imágenes por día (1.35 millones) y los pagos, unas 8 (1.6 millones). El pico es el doble del promedio.</p><p>El modelo propio es un DiT de 12 B que tarda 7 s de H100 por imagen en 50 pasos; existe una versión destilada de 4 pasos que tarda 0.56 s, con algo menos de calidad. La H100 cuesta 4 USD por hora con capacidad reservada. Diseña el servicio decisión por decisión.</p>',
  steps: [
    {
      id: 'forma', type: 'single',
      prompt: '¿Qué forma tiene la API de generación?',
      options: [
        'Un POST que espera abierto hasta devolver la imagen, con un timeout de 2 minutos.',
        'Un job asíncrono: el POST responde 202 con el id; la app sigue el progreso por SSE, los clientes de la API reciben un webhook y todos pueden consultar el estado.',
        'Un WebSocket por usuario que queda abierto mientras la app está en pantalla.',
        'Un POST que encola y no devuelve nada; la imagen aparece en la galería del usuario cuando esté.'
      ],
      answer: 1,
      explain: 'Una generación de segundos o minutos no cabe en una request: las conexiones se cortan, los reintentos generan dos veces y no hay cómo cancelar. El job tiene id, estado en una tabla e Idempotency-Key (23.6).'
    },
    {
      id: 'modelo', type: 'single',
      prompt: '¿Qué modelo usa cada plan?',
      options: [
        'El de 50 pasos para todos: la calidad es la misma marca.',
        'El destilado para todos: es 12 veces más barato.',
        'El destilado por defecto en el plan gratuito; el de 50 pasos en el pago.',
        'El de 50 pasos para el gratuito, para convencerlo de pagar, y el destilado para el pago, que ya pagó.'
      ],
      answer: 2,
      explain: 'Con el modelo grande, un usuario gratuito que genera 3 por día cuesta 2 USD al mes y no paga nada. El destilado lo baja a 0.16 USD. El plan pago justifica el modelo grande (23.12).'
    },
    {
      id: 'gpus', type: 'single',
      prompt: 'Con esa decisión, ¿cuántas H100 hacen falta para el plan pago, al 70&#8239;% de uso en el pico?',
      options: ['259', '371', '683', '130'],
      fixed: true,
      answer: 1,
      explain: '1.6 M ÷ 86&#8239;400 × 2 = 37 imágenes por segundo en el pico; × 7 s = 259 GPUs ocupadas; ÷ 0.7 = 371. El plan gratuito con el destilado suma 25. Con el modelo grande para todos serían 683 (23.7).'
    },
    {
      id: 'colas', type: 'single',
      prompt: '¿Cómo se ordena la cola?',
      options: [
        'Una sola cola FIFO para todos.',
        'Prioridad estricta entre clases (interactiva paga, estándar gratuita, batch) y reparto justo por organización dentro de cada clase, con admisión por plazo.',
        'Una cola por usuario, atendida en round robin.',
        'Prioridad por cuántas imágenes generó cada usuario en el día: el que menos generó, primero.'
      ],
      answer: 1,
      explain: 'Las clases separan plazos distintos; el fair queuing del M18 evita que un cliente con miles de jobs se lleve la flota; la admisión rechaza enseguida lo que no se va a cumplir (23.7).'
    },
    {
      id: 'moderar', type: 'multi',
      prompt: '¿Dónde va la moderación? Marca todas las correctas.',
      options: [
        'Sobre el prompt, antes de encolar: un rechazo ahí no gasta GPU.',
        'Sobre la imagen generada, antes de guardarla y entregarla.',
        'Solo sobre el prompt: si el prompt pasó, la imagen está bien.',
        'Si el moderador cae, los jobs esperan en moderating: falla cerrada.'
      ],
      answer: [0, 1, 3],
      explain: 'Un prompt inocente puede producir una imagen que viola la política, y una imagen entregada no se puede retirar. Por eso la salida siempre se modera y la falla es cerrada (23.10).'
    },
    {
      id: 'entrega', type: 'single',
      prompt: '¿Cómo se entregan las imágenes?',
      options: [
        'Bucket público con nombres aleatorios: nadie los adivina.',
        'Bucket privado detrás de una CDN, URLs de la CDN firmadas que vencen en minutos y vistas en WebP; los PNG originales se borran a los 30 días si el usuario no los guardó.',
        'La API devuelve la imagen en base64 dentro del JSON del job.',
        'Signed URLs de S3 directas, sin CDN, con vencimiento de un año.'
      ],
      answer: 1,
      explain: 'Los nombres aleatorios en un bucket público se filtran y se listan. La firma en la URL de la CDN permite cachear, el WebP mueve cinco veces menos bytes y la retención baja el almacenamiento (23.9).'
    },
    {
      id: 'cobro', type: 'single',
      prompt: 'Un usuario pago genera 50 imágenes por día con el modelo grande. ¿Qué haces?',
      options: [
        'Nada: pagó el plan.',
        'Cerrarle la cuenta por abuso.',
        'Un tope diario por plan, medido con el evento de uso del job (con el id como clave), y el modelo grande como opción de calidad alta dentro del tope.',
        'Cobrarle aparte cada imagen sin avisarle.'
      ],
      answer: 2,
      explain: '50 por día a 0.022 USD son 33 USD al mes, más que el plan de 20. Los topes del M21 y un evento de uso idempotente por job resuelven el margen sin sorpresas (23.12).'
    },
    {
      id: 'viral', type: 'order',
      prompt: 'Una función nueva se vuelve viral y la demanda se multiplica por diez en dos días. Ordena las palancas, de la primera a la última.',
      items: [
        'Pausar los trabajos batch',
        'Pasar el plan gratuito a menos calidad o al modelo destilado',
        'Rechazar en la admisión lo que no se puede cumplir, diciendo cuándo volver',
        'Topes diarios por usuario, anunciados como temporales',
        'Sumar capacidad moviendo GPUs de otros usos o consiguiendo más'
      ],
      explain: 'De la más barata e invisible a la más lenta. Es la degradación del M08: el producto sigue funcionando para todos, peor para algunos (23.13).'
    }
  ],
  solution: '<ul>' +
    '<li><b>API:</b> jobs asíncronos con 202, estado en una tabla, Idempotency-Key, SSE con vistas previas, webhook firmado y polling de respaldo.</li>' +
    '<li><b>Modelo:</b> destilado de 4 pasos para el plan gratuito (25 H100) y DiT de 50 pasos para el pago (371 H100), contra 683 con el modelo grande para todos.</li>' +
    '<li><b>Colas:</b> interactiva, estándar y batch con prioridad estricta; fair queuing por organización; admisión con plazo; batch en el valle, interrumpible entre pasos.</li>' +
    '<li><b>Moderación:</b> prompt antes de encolar, salida antes de guardar, hashes de material conocido en las ediciones, falla cerrada.</li>' +
    '<li><b>Entrega:</b> S3 privado, CloudFront con URLs firmadas de minutos, WebP para mostrar, C2PA firmado con clave en KMS, 30 días de retención y borrado en cascada.</li>' +
    '<li><b>Costo:</b> evento de uso por job con imágenes, calidad y segundos de GPU; topes diarios por plan; 3 por día en el gratuito.</li>' +
    '<li><b>Pico viral:</b> pausar batch, bajar calidad del gratuito, admisión, topes y, por último, más GPUs.</li>' +
    '</ul>'
});
