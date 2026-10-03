/* Decisiones guiadas de A05 (dos primarios). Formato en core/exercise.js. */

SD.defineExercise('a05-sucursales', {
  title: 'las dos sucursales un sábado',
  scenario: '<p>Las sucursales corren como en esta guía: cada una con su base, replicación lógica en las dos direcciones con <code>origin = none</code>, cada fila de stock con una dueña, traspasos con recibo y el catálogo editado solo en norte. Un sábado pasan cuatro cosas.</p>',
  steps: [
    {
      id: 'corte', type: 'single',
      prompt: 'El enlace entre las sucursales se corta dos horas. Las dos siguen vendiendo de su stock, y sur hace tres traspasos a norte. ¿Qué pasa cuando vuelve el enlace?',
      options: [
        'Cada suscripción se pone al día desde su slot. Las ventas llegan sin conflictos, porque son inserciones con UUIDv7 y cada fila de stock tiene una sola dueña, y norte suma los tres traspasos en cuanto le llegan.',
        'Las dos bases tienen que copiarse de nuevo, con <code>copy_data = true</code>.',
        'Las ventas de esas dos horas chocan entre sí, y hay que elegir cuáles quedan.',
        'Los traspasos se pierden, porque sur los mandó mientras norte no estaba.'
      ],
      answer: 0,
      explain: 'El slot de cada base guarda el WAL que la otra no recibió, y la suscripción lo pide al reconectarse. Como ninguna fila la escriben las dos, no hay nada que resolver. Durante el corte, las unidades de los tres traspasos no están en ningún stock: <code>cuadrar.sql</code> las muestra en <code>en_camino</code>. El costo del corte es el WAL que guarda cada slot, que crece mientras dura.'
    },
    {
      id: 'falta', type: 'single',
      prompt: 'A media mañana, norte se queda sin café y sur tiene 400. Un cliente de norte quiere dos. ¿Qué haces?',
      options: [
        'Que norte reste de la fila de sur: la replicación lleva el cambio.',
        'Responder 409 en norte y pedirle un traspaso a sur. Sur resta de su fila, y norte suma cuando recibe.',
        'Vender igual y corregir el stock negativo al final del día.',
        'Pausar la replicación mientras norte vende del stock de sur.'
      ],
      answer: 1,
      explain: 'Restar de la fila de sur desde norte es el experimento de las tazas: si sur vende a la vez, se venden unidades que no existen, como las 20 tazas de 10. Vender en negativo es lo mismo, con otro nombre. El traspaso deja la decisión en la dueña de las unidades. Cuesta un segundo de espera, el intervalo del receptor, y por eso conviene equilibrar el stock antes de que se acabe.'
    },
    {
      id: 'alta', type: 'single',
      prompt: 'Sur consigue un proveedor local de miel y quiere venderla hoy. ¿Cómo la das de alta?',
      options: [
        'Sur la da de alta en su base, con el SKU del proveedor.',
        'La da de alta norte, la dueña del catálogo. Si sur necesita hacerlo sola, sus SKU llevan un prefijo propio, como <code>SUR-</code>, que norte nunca usa.',
        'Quitar la restricción <code>UNIQUE</code> de <code>sku</code>.',
        'Darla de alta en las dos a la vez, con el mismo id.'
      ],
      answer: 1,
      explain: 'Si norte da de alta el mismo SKU por su lado, las dos chocan, y la replicación entera se detiene, como con MATE-500. Sin <code>UNIQUE</code>, el choque no se ve, pero quedan dos productos con el mismo SKU y nadie sabe cuál es cuál. El mismo id en las dos choca con la clave primaria, que también es única. Un prefijo por sucursal reparte el espacio de claves: cada una inventa solo en el suyo.'
    },
    {
      id: 'madrugada', type: 'single',
      prompt: 'A las 3 de la mañana, la alerta sobre <code>apply_error_count</code> de norte empieza a sonar. ¿Qué haces?',
      options: [
        '<code>ALTER SUBSCRIPTION … SKIP</code> con el LSN del log, apenas suena la alerta.',
        'Leer en el log qué fila choca y qué trae la transacción, reparar los datos para que la transacción entre entera, y usar <code>SKIP</code> solo si sabes qué descartas.',
        'Borrar la suscripción y crearla de nuevo.',
        'Esperar: el worker reintenta cada 5&#8239;s, y en algún momento entra.'
      ],
      answer: 1,
      explain: '<code>SKIP</code> descarta la transacción remota entera, con todo lo que traiga además de la fila que choca. Borrar la suscripción borra su slot, y la nueva empieza desde el WAL de ahora: pierdes todo lo que estaba esperando. Esperar no sirve: el worker reintenta con la misma transacción y falla igual, como mediste. Reparar, como con MIEL-250, deja que la transacción entre completa.'
    }
  ],
  solution: '<ul><li>Un corte entre sucursales no crea conflictos si ninguna fila la escriben las dos: los slots guardan lo pendiente y las suscripciones se ponen al día.</li><li>El stock de una sucursal solo lo cambia ella. Para vender lo de la otra, se pide un traspaso.</li><li>Las claves que inventa cada sucursal no pueden coincidir: UUIDv7 para los ids, y el catálogo con una sola dueña o con un prefijo por sucursal.</li><li>Una replicación trabada se arregla reparando los datos. <code>SKIP</code> descarta la transacción entera, y recrear la suscripción descarta todo lo pendiente.</li></ul>'
});
