/* Decisiones guiadas de A02 (una API que no se rompe). Formato en core/exercise.js. */

SD.defineExercise('a02-api', {
  title: 'el catálogo de la librería',
  scenario: '<p>El catálogo está publicado con la 1.0 y la 1.1 a la vez. La app pagina por título con el cursor, una CDN cachea los <code>GET /books/{id}</code> durante 60&#8239;s, y dos editores corrigen fichas desde oficinas distintas. El <code>Sunset</code> de la 1.0 es dentro de dos semanas.</p>',
  steps: [
    {
      id: 'insertos', type: 'single',
      prompt: 'Un cliente va por la página 10 del catálogo ordenado por título. Mientras tanto, un editor carga 50 libros que empiezan con "A". ¿Qué ve el cliente en la página 11?',
      options: [
        'Con OFFSET y con el cursor, lo mismo: la página 11 de siempre.',
        'Con OFFSET, 20 libros repetidos; con el cursor, la continuación exacta.',
        'Con OFFSET, la continuación exacta; con el cursor, los 50 libros nuevos.',
        'Con el cursor, un 400: el cursor ya no es válido después de un insert en la tabla.'
      ],
      answer: 1,
      explain: 'OFFSET cuenta posiciones, y 50 filas nuevas antes de la posición corren todo 50 lugares: el cliente vuelve a ver 20 que ya tenía, como en la página anterior. El cursor recuerda la última fila, no la posición, y sigue justo después de ella. Los libros nuevos van antes, así que este recorrido no los ve; el siguiente, sí.'
    },
    {
      id: 'vary', type: 'single',
      prompt: 'Un socio pide un libro sin cabecera, recibe la 1.0 y la CDN la guarda. Un segundo después, la app pide el mismo libro con <code>API-Version: 1.1</code>. ¿Qué recibe la app, y qué falta?',
      options: [
        'La 1.1: la CDN ve que la cabecera es distinta y va al origen.',
        'La 1.0 cacheada: falta Vary: API-Version en la respuesta.',
        'Un 304, porque el ETag de las dos versiones es el mismo.',
        'La 1.0 cacheada: falta un ETag distinto por versión en la respuesta.'
      ],
      answer: 1,
      explain: 'Una caché compartida arma la clave con la URL y solo agrega las cabeceras que nombra Vary. Las dos versiones tienen la misma URL, así que, sin Vary: API-Version, comparten la entrada. Con la versión en la URL, como /v1/books, el problema no existe: es una de las razones por las que ese esquema es tan común.'
    },
    {
      id: 'conflicto', type: 'single',
      prompt: 'El editor de la oficina 2 guarda una ficha y recibe un 412 con <code>currentVersion: 4</code>. ¿Qué hace el cliente?',
      options: [
        'Repite el PUT con If-Match: "4" y el mismo body.',
        'Repite el PUT con If-Match: *, que acepta cualquier versión.',
        'Vuelve a leer el libro y deja que el editor decida qué guardar.',
        'Espera unos segundos y repite el PUT con el If-Match de antes.'
      ],
      answer: 2,
      explain: 'Repetir el PUT con la versión nueva, o con If-Match: *, pisa el cambio de la oficina 1 sin que nadie lo vea: es exactamente lo que If-Match vino a evitar. El 412 no dice que algo falló, dice que hay que mirar de nuevo. Lo que se mezcla, y cómo, lo decide una persona o una regla del dominio.'
    },
    {
      id: 'sunset', type: 'single',
      prompt: 'Faltan dos semanas para el <code>Sunset</code> y el 8&#8239;% de las requests sigue llegando sin <code>API-Version</code>. ¿Qué haces?',
      options: [
        'Nada: el Sunset ya avisó, y el día llegado la 1.0 deja de responder.',
        'Cambiar la versión por defecto a 1.1 hoy, sin avisar.',
        'Medir quién manda ese 8&#8239;% por clave de API y avisarle.',
        'Mantener la 1.0 para siempre detrás de un flag, sin costo extra.'
      ],
      answer: 2,
      explain: 'Las cabeceras Deprecation y Sunset solo sirven si alguien las lee, y casi nadie lo hace. Los cortes cortos y anunciados, conocidos como brownouts, convierten el aviso en un error que se ve en los logs del cliente sin dejarlo caído un día entero. Para eso necesitas saber quién llama, y por eso cada request debería llevar una identidad.'
    }
  ],
  solution: '<ul><li>El cursor recuerda la última fila vista: no repite ni salta filas aunque haya inserts, y los libros nuevos aparecen en el recorrido siguiente.</li><li>Con la versión en una cabecera, toda respuesta cacheable lleva <code>Vary: API-Version</code>.</li><li>Un 412 se resuelve leyendo de nuevo y decidiendo, nunca repitiendo el PUT con la versión nueva.</li><li>Antes de retirar una versión, mide quién la usa, avísale, haz cortes cortos y anunciados, y solo entonces apágala.</li></ul>'
});
