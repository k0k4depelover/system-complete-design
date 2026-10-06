SD.defineQuiz('m09', {
  title: 'Quiz: almacenamiento de objetos y signed URLs',
  pass: 0.7,
  questions: [
    {
      id: 'directo', type: 'single',
      prompt: '¿Por qué los clientes suben archivos directo al almacenamiento con una URL firmada en lugar de enviarlos a tu API?',
      options: [
        'Porque S3 no acepta archivos subidos desde servidores, solo desde navegadores.',
        'Para que los bytes no consuman ancho de banda, memoria ni conexiones de tus servidores.',
        'Porque es más seguro dar al cliente las credenciales del bucket con permiso de escritura.',
        'Porque el almacenamiento comprime el archivo al recibirlo directo del cliente.'
      ],
      answer: 1,
      explain: 'Un video de 200 MB a través de tu API retiene una conexión y memoria durante minutos. Con una URL firmada, tu backend solo decide y firma; el almacenamiento, que está hecho para eso, recibe los bytes.'
    },
    {
      id: 'firma', type: 'single',
      prompt: 'Alguien recibe una URL firmada para descargar <code>fotos/123.jpg</code> y cambia la ruta a <code>fotos/124.jpg</code>. ¿Qué pasa?',
      options: [
        'Descarga 124.jpg, porque la firma solo protege la fecha de expiración.',
        '403: la ruta forma parte de lo firmado y la firma ya no coincide.',
        'Descarga 123.jpg igual, porque la firma fija el objeto sin importar la ruta.',
        'El servidor pide credenciales de IAM, porque la URL quedó sin firma válida.'
      ],
      answer: 1,
      explain: 'La firma cubre método, ruta, parámetros y expiración. Cambiar cualquiera de ellos invalida la URL. Pruébalo en el generador con "Cambiar el objeto".'
    },
    {
      id: 'revocar', type: 'single',
      prompt: 'Una URL firmada válida por 7 días se filtró en un foro público. ¿Cómo la invalidas antes de que venza?',
      options: [
        'Borrando la URL de tu base de datos, que el almacenamiento consulta en cada acceso.',
        'Rotando las credenciales con que se firmó, lo que invalida todas sus URLs.',
        'Cambiando el TTL del DNS del bucket, para que la URL deje de resolver.',
        'Pidiéndole a la CDN que no la cachee más, con lo que el almacenamiento la rechaza.'
      ],
      answer: 1,
      explain: 'La URL es autocontenida: el servidor solo verifica la firma y la fecha. Firmar con credenciales temporales de corta duración acota el daño de una filtración.'
    },
    {
      id: 'multipart', type: 'single',
      prompt: 'Una app sube videos de 2 GB por redes móviles inestables. ¿Qué técnica evita empezar de cero cuando se corta la conexión?',
      options: ['Un solo PUT con timeout largo y reintentos desde el principio.', 'Subida multipart: partes que se reintentan por separado y se unen al final.', 'Comprimir el video en el teléfono para que el PUT dure menos.', 'Una URL firmada que venza en 24 h, para que el reintento no expire.'],
      answer: 1,
      explain: 'Cada parte (por ejemplo de 8 MB) se sube, se confirma y se reintenta sola. Además se pueden subir varias en paralelo. Y conviene una regla de ciclo de vida que aborte las multipart incompletas, que cuestan aunque nunca se terminen.'
    },
    {
      id: 'huerfanos', type: 'single',
      prompt: 'Los usuarios suben archivos pero a veces cierran la app antes de enviar el mensaje. Meses después, el bucket tiene terabytes que nadie usa. ¿Cómo se diseña para evitarlo?',
      options: [
        'Nunca borrar nada: el almacenamiento es barato y los archivos pueden servir después.',
        'Registrar cada subida como pendiente y borrar con un job las no confirmadas en 24 h.',
        'Una regla de ciclo de vida que borre todo objeto con más de 30 días en el bucket.',
        'Pedir al usuario que borre sus archivos desde una pantalla de almacenamiento.'
      ],
      answer: 1,
      explain: 'La fuente de verdad de "qué archivos existen para el producto" es tu base de metadatos, no el bucket. Todo lo que el bucket tenga y la base no referencie, es basura a recolectar.'
    },
    {
      id: 'cdn-cache', type: 'single',
      prompt: 'Sirves imágenes por CDN con URLs firmadas distintas para cada usuario, y la tasa de acierto de la CDN es del 3 %. ¿Qué pasa?',
      options: [
        'Las imágenes son demasiado grandes y la CDN no las guarda en el borde.',
        'La clave de caché incluye la firma: hay que excluirla de la clave.',
        'La CDN no cachea respuestas a URLs firmadas, por seguridad.',
        'El TTL de las imágenes es muy largo y la CDN las expulsa por falta de espacio.'
      ],
      answer: 1,
      explain: 'La firma es para autorizar, no para identificar el contenido. La CDN debe validar la firma y cachear por la ruta limpia.'
    },
    {
      id: 'claves', type: 'multi',
      prompt: '¿Qué es buena práctica al diseñar las claves de los objetos?',
      options: [
        'Que las decida el servidor, no el cliente.',
        'Incluir información que no debería ser pública (como el email del usuario).',
        'Usar el hash del contenido cuando quieres deduplicar archivos idénticos.',
        'Guardar en tu base de datos la clave y los metadatos de cada objeto.',
        'Depender de listar el bucket por prefijo para las consultas de la aplicación.'
      ],
      answer: [0, 2, 3],
      explain: 'Las claves terminan en URLs, logs y cachés: nada sensible en ellas. Tu base es el índice consultable; <code>LIST</code> es lento, paginado y no sirve como consulta de aplicación.'
    },
    {
      id: 'durabilidad', type: 'single',
      prompt: '¿Cómo logra un almacenamiento de objetos una durabilidad altísima sin guardar 3 copias completas de todo?',
      options: ['Con RAID 0 en cada servidor, que reparte los bloques entre varios discos.', 'Con erasure coding: fragmentos de datos y de paridad repartidos entre zonas.', 'Con una caché en memoria replicada que reconstruye el disco si falla.', 'Guardando todo en una sola zona con discos de grado empresarial.'],
      answer: 1,
      explain: 'Con, por ejemplo, 6 fragmentos de datos y 3 de paridad, el objeto sobrevive a la pérdida de cualquier 3 fragmentos (una zona entera) ocupando 1.5 veces su tamaño, frente a 3 veces con réplicas.'
    }
  ]
});
