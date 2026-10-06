SD.defineQuiz('m29', {
  title: 'Quiz: WhatsApp',
  pass: 0.7,
  questions: [
    {
      id: 'conexion', type: 'single',
      prompt: '¿Por qué una app de mensajería mantiene una conexión TCP abierta en lugar de consultar al servidor cada pocos segundos?',
      options: [
        'Porque HTTP no permite que el servidor responda más de una vez por request.',
        'Porque el servidor empuja el mensaje apenas lo tiene, sin consultas vacías.',
        'Porque así el cifrado de extremo a extremo se negocia una sola vez.',
        'Porque las conexiones abiertas no consumen recursos del servidor.'
      ],
      answer: 1,
      explain: 'La conexión persistente baja la latencia y el costo por mensaje. Su precio es que el servidor sostiene cientos de miles de conexiones por máquina, que consumen memoria aunque estén quietas.'
    },
    {
      id: 'memoria', type: 'single',
      prompt: 'Un gateway tiene 32 GB y cada conexión usa unos 30 KB. Quieres dedicar como máximo el 60 % de la memoria a las conexiones. ¿Cuántas conexiones admite, aproximadamente?',
      options: [
        'Unas 64 000.',
        'Unas 640 000.',
        'Unas 6.4 millones.',
        'Unas 6 400.'
      ],
      answer: 1,
      explain: '32 GB × 0.6 = 19.2 GB; 19.2 GB ÷ 30 KB ≈ 640 000. La memoria, no la CPU, suele ser el límite de un gateway, y por eso el objetivo de conexiones por instancia se elige por debajo del máximo.'
    },
    {
      id: 'keepalive', type: 'single',
      prompt: 'El ping de la app es cada 10 minutos y el Network Load Balancer tiene su timeout por inactividad de TCP en el valor por defecto (350 segundos). ¿Qué pasa?',
      options: [
        'Nada: el balanceador espera el ping sin importar cuánto tarde en llegar.',
        'El balanceador corta conexiones sanas por inactividad y los teléfonos reconectan sin parar.',
        'El balanceador cierra la conexión a los 350 s y avisa al teléfono para que mande el ping antes.',
        'El balanceador reenvía los pings por otra conexión al mismo gateway.'
      ],
      answer: 1,
      explain: 'Cada elemento intermedio (balanceadores, NAT de las operadoras) tiene su propio timeout por inactividad. El keepalive se elige menor que el más corto de todos.'
    },
    {
      id: 'registro', type: 'single',
      prompt: '¿Cuál es el papel del TTL de 90 segundos y del heartbeat de 30 segundos en el registro de sesiones?',
      options: [
        'Sirven para rotar la clave con la que se cifra cada entrada del registro.',
        'El gateway renueva cada 30 s; si muere, sus entradas vencen solas a los 90 s.',
        'Limitan cuántos mensajes puede recibir un usuario por cada ventana de 90 segundos.',
        'Garantizan que el mensaje se entregue en 90 segundos o se pase a push.'
      ],
      answer: 1,
      explain: 'Es el mecanismo para que el registro se repare solo. Aun así, durante hasta 90 s puede contener una entrada de un gateway muerto, y el diseño tiene que tolerarlo.'
    },
    {
      id: 'epoch', type: 'single',
      prompt: 'Un teléfono reconecta en el gateway B antes de que el gateway A, que tenía su conexión anterior, cierre y borre su entrada del registro. ¿Cómo se evita que A borre la entrada nueva?',
      options: [
        'Con un lock distribuido que A toma antes de borrar la entrada.',
        'Con un epoch creciente: A borra solo si la entrada todavía tiene el suyo.',
        'Haciendo que A espere 90 segundos antes de borrar, hasta que venza el TTL.',
        'Haciendo que B vuelva a escribir su entrada en cada heartbeat.'
      ],
      answer: 1,
      explain: 'Una comparación atómica en el registro resuelve la carrera sin locks ni relojes sincronizados: la conexión más nueva siempre gana, y nadie borra la entrada de otro.'
    },
    {
      id: 'guardar-antes', type: 'single',
      prompt: '¿Cuándo debe el servidor mandar el primer tilde (ServerAck) al emisor?',
      options: [
        'Apenas recibe el mensaje en el gateway, para que el emisor no espere.',
        'Cuando el mensaje está guardado en el buzón de cada dispositivo destino.',
        'Cuando el teléfono del destinatario confirmó que lo recibió y lo descifró.',
        'Cuando el gateway del destinatario lo recibió para entregarlo por su conexión.'
      ],
      answer: 1,
      explain: 'El primer tilde promete "el servidor lo tiene". Si se manda antes de guardar, una caída del servicio perdería un mensaje que el emisor cree enviado. Desde que está en el buzón, el resto del camino son optimizaciones.'
    },
    {
      id: 'una-vez', type: 'multi',
      prompt: '¿Qué piezas hacen que un mensaje tenga un efecto único para la persona aunque haya reintentos?',
      options: [
        'El msg_id que genera el teléfono y repite en cada reintento.',
        'Una escritura condicional en el buzón por msg_id.',
        'Que el cliente descarte los duplicados por msg_id al recibirlos.',
        'Que TCP garantice que ningún mensaje llegue dos veces a la misma conexión.',
        'Una transacción distribuida entre el teléfono del emisor y el del receptor.'
      ],
      answer: [0, 1, 2],
      explain: 'El servidor entrega al menos una vez y el cliente deduplica: la suma es un efecto único. No hace falta (ni es posible) una red perfecta ni una transacción entre dos teléfonos.'
    },
    {
      id: 'push', type: 'single',
      prompt: '¿Por qué un push de APNs o FCM no puede ser la garantía de entrega de un mensaje?',
      options: [
        'Porque cuesta por cada envío y no escala a miles de millones de mensajes.',
        'Porque Apple y Google pueden demorarlo o descartarlo sin avisar.',
        'Porque solo funciona mientras la app está abierta en primer plano.',
        'Porque los push no pueden llevar datos cifrados de extremo a extremo.'
      ],
      answer: 1,
      explain: 'Como el mensaje está en el buzón, el teléfono lo recibe cuando se conecta, con push o sin él. El push baja el tiempo de espera de horas a segundos en el caso típico.'
    },
    {
      id: 'grupo-costo', type: 'single',
      prompt: 'Ana escribe en un grupo de 256 personas, con 1.3 dispositivos por persona. ¿Cuántas escrituras de buzón genera el mensaje, aproximadamente?',
      options: [
        'Una: el grupo tiene un solo buzón compartido.',
        'Unas 256: una por persona del grupo.',
        'Unas 330: una por dispositivo destino.',
        'Unas 65 000: una por cada par de miembros.'
      ],
      answer: 2,
      explain: 'Cifrar una vez con la Sender Key ahorra trabajo en el teléfono, no en el servidor, que escribe una entrada por dispositivo. Por eso los grupos dominan la carga de escritura aunque sean una minoría de los mensajes.'
    },
    {
      id: 'sender-key', type: 'single',
      prompt: 'Un miembro sale de un grupo de 256. ¿Qué consecuencia tiene para el cifrado?',
      options: [
        'Ninguna: los mensajes viejos y nuevos usan la misma clave, porque el servidor ya no le entrega nada.',
        'Todos descartan su Sender Key y reparten una nueva al volver a escribir.',
        'El administrador genera una clave nueva para el grupo y la reparte a todos.',
        'El servidor vuelve a cifrar el historial con una clave que el que salió no tiene.'
      ],
      answer: 1,
      explain: 'Es un costo oculto de los grupos con mucha rotación: cada emisor paga 255 mensajes de distribución de claves cuando vuelve a hablar. Si 50 personas escriben después de la salida, son unos 12 750 mensajes de claves.'
    },
    {
      id: 'prekeys', type: 'single',
      prompt: '¿Para qué sirven las prekeys de un solo uso que cada dispositivo sube al servidor?',
      options: [
        'Para firmar cada mensaje y probar quién lo mandó.',
        'Para iniciar una conversación cifrada con un dispositivo desconectado.',
        'Para que el servidor pueda descifrar los mensajes si el dispositivo se pierde.',
        'Para cifrar el historial que se guarda en el respaldo de la nube.'
      ],
      answer: 1,
      explain: 'Es un intercambio de claves asincrónico. Si se agotan las prekeys únicas, el servidor entrega el bundle sin ellas y el protocolo omite la última operación Diffie-Hellman: sigue cifrado, con una garantía algo menor.'
    },
    {
      id: 'multidispositivo', type: 'single',
      prompt: 'Beto tiene teléfono y computadora vinculada. ¿Cómo cifra Ana un mensaje para él?',
      options: [
        'Con una sola clave que los dos dispositivos comparten al vincularse.',
        'Una vez por dispositivo, con la sesión de cada par (client fan-out).',
        'El servidor descifra y vuelve a cifrar para cada dispositivo.',
        'Solo para el teléfono; la computadora pide una copia al teléfono.'
      ],
      answer: 1,
      explain: 'Cada dispositivo tiene su propia identidad criptográfica. Así la computadora funciona aunque el teléfono esté apagado, y el servidor sigue sin poder leer nada.'
    },
    {
      id: 'medios', type: 'single',
      prompt: '¿Por qué las fotos no viajan por la conexión de mensajes sino por un camino aparte (URL firmada y almacén de objetos)?',
      options: [
        'Porque las tiendas de apps exigen que los adjuntos usen la CDN del sistema.',
        'Porque un adjunto ocuparía al gateway segundos y bloquearía los mensajes chicos.',
        'Porque las fotos no se pueden cifrar de extremo a extremo con Signal.',
        'Porque una conexión TCP no puede mandar más de 64 KB por mensaje.'
      ],
      answer: 1,
      explain: 'El mensaje solo lleva la clave, el hash y la dirección del blob. Los gateways siguen moviendo mensajes de cientos de bytes, que es lo que hacen bien.'
    },
    {
      id: 'tormenta', type: 'single',
      prompt: 'Cae un gateway con 400 000 conexiones. ¿Qué defiende a los gateways sanos de la tormenta de reconexión?',
      options: [
        'Que los teléfonos reintenten enseguida, para terminar cuanto antes.',
        'Backoff con jitter en los clientes y un control de admisión en el servidor.',
        'Que el balanceador mande todas las reconexiones al gateway menos cargado.',
        'Subir el timeout de los pings para que los teléfonos tarden más en notarlo.'
      ],
      answer: 1,
      explain: 'Sin aleatoriedad, el backoff exponencial produce oleadas sincronizadas que superan la capacidad una y otra vez. Con jitter, el mismo trabajo llega como un flujo parejo.'
    },
    {
      id: 'orden-envio', type: 'order',
      prompt: 'Ordena lo que pasa cuando Ana envía un mensaje y Beto está conectado:',
      items: [
        'El teléfono cifra y manda Send con un msg_id propio',
        'El servicio guarda el mensaje en el buzón de Beto',
        'El servidor confirma a Ana (primer tilde)',
        'El servicio busca en el registro el gateway de Beto y se lo entrega',
        'Beto guarda el mensaje y manda el DeviceAck',
        'El servicio borra la entrada del buzón y avisa a Ana (segundo tilde)'
      ],
      explain: 'La confirmación a Ana va después de guardar y antes de entregar. El borrado del buzón va después del ack de Beto: hasta entonces, el mensaje puede reenviarse.'
    },
    {
      id: 'desplegar', type: 'single',
      prompt: 'Vas a desplegar una versión nueva de los gateways. ¿Cómo evitas desconectar a todos a la vez?',
      options: [
        'Reiniciando todos los gateways de golpe en la madrugada, cuando hay menos usuarios.',
        'Con draining: se saca al gateway de rotación y sus clientes se mudan de a poco.',
        'Cerrando las conexiones con un reset para que reconecten de inmediato.',
        'Migrando cada conexión TCP abierta al gateway nuevo sin cortarla.'
      ],
      answer: 1,
      explain: 'Reiniciar un gateway corta todas sus conexiones. Hacerlo gradualmente es lo que separa un despliegue de una tormenta de reconexión provocada por uno mismo.'
    }
  ]
});
