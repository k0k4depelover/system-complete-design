SD.defineQuiz('m09', {
  title: 'Quiz: almacenamiento de objetos y signed URLs',
  pass: 0.7,
  questions: [
    {
      id: 'directo', type: 'single',
      prompt: '¿Por qué los clientes suben archivos directo al almacenamiento con una URL firmada en lugar de enviarlos a tu API?',
      options: [
        'Porque S3 no acepta archivos de servidores.',
        'Para que los bytes no consuman el ancho de banda, la memoria ni las conexiones de tus servidores de API, que solo manejan metadatos.',
        'Porque es más seguro dar las credenciales al cliente.',
        'Porque así el archivo se comprime.'
      ],
      answer: 1,
      explain: 'Un video de 200 MB a través de tu API retiene una conexión y memoria durante minutos. Con una URL firmada, tu backend solo decide y firma; el almacenamiento, que está hecho para eso, recibe los bytes.'
    },
    {
      id: 'firma', type: 'single',
      prompt: 'Alguien recibe una URL firmada para descargar <code>fotos/123.jpg</code> y cambia la ruta a <code>fotos/124.jpg</code>. ¿Qué pasa?',
      options: [
        'Descarga 124.jpg.',
        '403: la ruta forma parte de lo firmado, y la firma recalculada por el servidor no coincide.',
        'Descarga 123.jpg igual.',
        'El servidor pide credenciales.'
      ],
      answer: 1,
      explain: 'La firma cubre método, ruta, parámetros y expiración. Cambiar cualquiera de ellos invalida la URL. Pruébalo en el generador con "Cambiar el objeto".'
    },
    {
      id: 'revocar', type: 'single',
      prompt: 'Una URL firmada válida por 7 días se filtró en un foro público. ¿Cómo la invalidas antes de que venza?',
      options: [
        'Borrando la URL de tu base de datos.',
        'No hay una forma directa: hay que rotar (o revocar) las credenciales con las que se firmó, lo que invalida todas las URLs firmadas con ellas. Por eso las expiraciones son cortas.',
        'Cambiando el TTL del DNS.',
        'Pidiéndole al CDN que no la cachee.'
      ],
      answer: 1,
      explain: 'La URL es autocontenida: el servidor solo verifica la firma y la fecha. Firmar con credenciales temporales de corta duración acota el daño de una filtración.'
    },
    {
      id: 'multipart', type: 'single',
      prompt: 'Una app sube videos de 2 GB por redes móviles inestables. ¿Qué técnica evita empezar de cero cuando se corta la conexión?',
      options: ['Subir en un solo PUT con timeout largo.', 'Subida multipart: partes independientes que se reintentan por separado y se unen al final.', 'Comprimir el video.', 'Usar GET en lugar de PUT.'],
      answer: 1,
      explain: 'Cada parte (por ejemplo de 8 MB) se sube, se confirma y se reintenta sola. Además se pueden subir varias en paralelo. Y conviene una regla de ciclo de vida que aborte las multipart incompletas, que cuestan aunque nunca se terminen.'
    },
    {
      id: 'huerfanos', type: 'single',
      prompt: 'Los usuarios suben archivos pero a veces cierran la app antes de enviar el mensaje. Meses después, el bucket tiene terabytes que nadie usa. ¿Cómo se diseña para evitarlo?',
      options: [
        'Nunca borrar nada: el almacenamiento es barato.',
        'Registrar cada subida como pendiente en tu base y un job que borre las que no se confirmaron en 24 h, más reglas de ciclo de vida para multipart incompletas.',
        'Borrar todo el bucket cada mes.',
        'Pedir al usuario que borre sus archivos.'
      ],
      answer: 1,
      explain: 'La fuente de verdad de "qué archivos existen para el producto" es tu base de metadatos, no el bucket. Todo lo que el bucket tenga y la base no referencie, es basura a recolectar.'
    },
    {
      id: 'cdn-cache', type: 'single',
      prompt: 'Sirves imágenes por CDN con URLs firmadas distintas para cada usuario, y la tasa de acierto de la CDN es del 3 %. ¿Qué pasa?',
      options: [
        'Las imágenes son muy grandes.',
        'La clave de caché incluye los parámetros de firma, así que cada URL es una entrada distinta. Hay que excluirlos de la clave de caché.',
        'La CDN no cachea imágenes.',
        'El TTL es muy largo.'
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
      options: ['Con RAID 0.', 'Con erasure coding: fragmentos de datos más fragmentos de paridad repartidos entre zonas, reconstruibles con un subconjunto.', 'Con caché en memoria.', 'Guardando todo en una sola zona muy confiable.'],
      answer: 1,
      explain: 'Con, por ejemplo, 6 fragmentos de datos y 3 de paridad, el objeto sobrevive a la pérdida de cualquier 3 fragmentos (una zona entera) ocupando 1.5 veces su tamaño, frente a 3 veces con réplicas.'
    }
  ]
});
