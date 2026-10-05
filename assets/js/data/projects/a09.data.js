/* Decisiones guiadas de A09 (Colas y pub/sub). Formato en core/exercise.js. */

SD.defineExercise('a09-colas', {
  title: 'un correo por pedido, ni cero ni dos',
  scenario: '<p>La tienda corre como en esta guía: la API guarda cada pedido con su evento en una outbox, y un relay lo publica cada 500&#8239;ms en el stream <code>orders</code>. Los workers del grupo <code>correos</code> leen de a una entrada, con <code>BLOCK</code> de 2&#8239;s, anotan el evento en <code>emails</code>, mandan el correo y confirman. Cada worker tiene un reaper que mira cada 5&#8239;s y reclama lo que lleva 15&#8239;s sin confirmar; a la tercera entrega fallida, la entrada va a la DLQ. Un correo le toma a un worker unos 250&#8239;ms. Tienes que tomar ocho decisiones.</p>',
  steps: [
    {
      id: 'doble-escritura', type: 'single',
      prompt: 'La primera versión no tiene outbox: guarda el pedido, hace commit y después publica el evento con <code>XADD</code>. El proceso muere entre el commit y el <code>XADD</code>. ¿Qué pasa?',
      options: [
        'PostgreSQL deshace el pedido, porque el proceso murió antes de terminar la request.',
        'El pedido queda guardado y su evento no existe en ninguna parte: nadie va a mandar el correo. El cliente recibió un error, y si reintenta crea un segundo pedido.',
        'Spring vuelve a mandar el <code>XADD</code> al arrancar, porque lo tenía en su cola interna.',
        'Redis guarda el <code>XADD</code> pendiente hasta que el proceso vuelva.'
      ],
      answer: 1,
      explain: 'El commit ya ocurrió, y Redis nunca recibió nada: no hay transacción que una a los dos. Es lo que mide la falla "la API muere después del commit": un pedido, cero correos, y ningún registro de que faltaba uno. La outbox mete el evento en la misma transacción que el pedido, y el relay lo publica cuando la API vuelve. La clave de idempotencia de A02 cubre la otra mitad: el reintento del cliente.'
    },
    {
      id: 'xack', type: 'single',
      prompt: '¿En qué momento confirma el worker la entrada con <code>XACK</code>?',
      options: [
        'Apenas la lee, antes de mandar el correo, para que nadie más la tome.',
        'Nunca: lee con <code>NOACK</code>, que es más rápido y no llena la lista de pendientes.',
        'Después de mandar el correo y de hacer commit de su anotación en <code>emails</code>.',
        'En un <code>finally</code>, salga o no salga el correo, para que una falla no quede pendiente para siempre.'
      ],
      answer: 2,
      explain: 'Con <code>XACK</code> al leer o con <code>NOACK</code>, la entrada deja de estar pendiente antes del efecto: si el worker muere, el reaper no la ve y el correo se pierde. En un <code>finally</code>, un 451 del servidor de correo también se pierde, porque nadie lo reintenta. Confirmar al final convierte cada caída en una nueva entrega, al menos una vez, y la anotación en <code>emails</code> se encarga de que esa entrega no se note.'
    },
    {
      id: 'claim-idle', type: 'single',
      prompt: 'Para que los reintentos sean más rápidos, alguien baja <code>claim-idle</code> de 15 a 1&#8239;s. El plazo de lectura de JavaMail es de 5&#8239;s, y a veces el servidor de correo tarda 3. ¿Qué pasa?',
      options: [
        'El reaper se lleva entradas que su worker todavía está mandando. Con dedupe, el segundo <code>INSERT</code> espera al primero y no sale un correo de más; sin dedupe, sale dos veces. Y cada reclamo suma una entrega: un correo lento pero sano puede llegar a la DLQ sin haber fallado nunca.',
        'Nada: <code>XCLAIM</code> no le quita una entrada a un consumidor que sigue conectado.',
        'Los reintentos salen antes y no hay ningún costo, porque el dedupe lo absorbe todo.',
        'Redis rechaza un tiempo mínimo menor que el <code>BLOCK</code> de los workers.'
      ],
      answer: 0,
      explain: 'Redis no sabe si un consumidor está trabajando o muerto: solo sabe cuánto lleva la entrada sin confirmar. <code>claim-idle</code> tiene que ser más largo que el procesamiento más lento que consideras normal, con los plazos de JavaMail incluidos. El contador de entregas lo lleva Redis y lo sube cada <code>XCLAIM</code>, así que cuenta reclamos, no fallas.'
    },
    {
      id: 'ventana', type: 'single',
      prompt: 'Con el dedupe encendido, ¿cuál de estas caídas todavía produce un correo duplicado?',
      options: [
        'El worker muere después del commit en <code>emails</code> y antes del <code>XACK</code>.',
        'El relay muere después de publicar el lote y antes de marcarlo en la outbox.',
        'Redis se reinicia y pierde el último segundo del AOF.',
        'El worker muere después de mandar el correo y antes del commit en <code>emails</code>.'
      ],
      answer: 3,
      explain: 'Si la anotación tiene commit, cualquier entrega repetida la encuentra y no manda: así se absorben el relay que publica dos veces y el worker que muere antes del <code>XACK</code>. Si el worker muere después de mandar y antes del commit, la fila se deshace con la conexión y el reaper ve el evento como nuevo. Esa ventana no la cierra ninguna transacción, porque el servidor SMTP no participa de ella; la cerraría un proveedor que aceptara el <code>eventId</code> como clave de idempotencia. El AOF perdido produce lo contrario: un evento que nunca llega.'
    },
    {
      id: 'pubsub', type: 'single',
      prompt: 'Un compañero propone cambiar el stream por Redis Pub/Sub, con tres workers suscritos al canal, porque "es más simple y más rápido". ¿Qué le contestas?',
      options: [
        'Que está bien, siempre que el dedupe esté encendido.',
        'Que cada evento les llegaría a los tres, así que con dedupe hacen tres veces el trabajo de uno, y sin dedupe mandan tres correos. Y que lo que se publique mientras no hay nadie suscrito, por ejemplo durante un despliegue, se pierde, porque Pub/Sub no guarda nada.',
        'Que Pub/Sub reparte los mensajes entre los suscriptores en turnos, como un grupo de consumo, pero sin <code>XACK</code>.',
        'Que Pub/Sub guarda los mensajes hasta que se conecta el primer suscriptor.'
      ],
      answer: 1,
      explain: 'Pub/Sub entrega cada mensaje a todos los suscritos en ese momento, y a nadie más. Es lo que miden los dos experimentos de Pub/Sub: 0 correos sin nadie escuchando y 60 para 20 pedidos con tres workers sin dedupe. Sirve para avisos que pueden perderse y tienen un respaldo, como la invalidación de caché de A03 con su TTL. Para repartir trabajo hace falta un grupo de consumo.'
    },
    {
      id: 'veneno', type: 'single',
      prompt: 'Llega al stream una entrada sin <code>eventId</code>, escrita a mano por otro equipo. ¿Qué hace el worker con ella?',
      options: [
        'La trata como un 451: queda pendiente y se reintenta hasta la tercera entrega.',
        'La confirma con <code>XACK</code> y la descarta en silencio, porque no tiene arreglo.',
        'La manda a la DLQ en la primera entrega, con el error, y la confirma en el stream principal.',
        'La deja pendiente para siempre, para que alguien la vea en <code>XPENDING</code>.'
      ],
      answer: 2,
      explain: 'Un mensaje que no se puede leer no se arregla reintentando: tres entregas solo agregan 45&#8239;s de espera y ruido en el log. Descartarlo borra el registro de qué falló. Dejarlo pendiente lo devuelve al reaper cada 15&#8239;s, para siempre. La DLQ guarda los campos originales con el error, y alguien lo devuelve al stream cuando la causa está resuelta.'
    },
    {
      id: 'recorte', type: 'single',
      prompt: 'El stream tiene <code>MAXLEN = 50</code> con la política por defecto. Durante un despliegue, los workers están detenidos y entran 300 pedidos. ¿Qué pasa, y cómo te enteras?',
      options: [
        'Se pierden 250 eventos sin un error. El lag del grupo dice 50, que es el largo del stream, así que tampoco lo muestra. Lo descubres comparando la outbox con <code>emails</code>, o con <code>entries-read</code> antes de que los workers vuelvan.',
        'Redis rechaza los <code>XADD</code> que pasan de 50, y el relay los reintenta.',
        'Se pierden 250 eventos, y el lag del grupo queda vacío porque Redis no puede calcularlo.',
        'Nada se pierde: el recorte nunca borra entradas que un grupo no leyó.'
      ],
      answer: 0,
      explain: 'Con la política por defecto, el recorte borra las entradas más viejas aunque nadie las haya leído. Redis calcula el lag como el largo del stream cuando el grupo quedó detrás de la primera entrada, así que sigue diciendo 50. Solo un recuento de punta a punta lo encuentra. <code>ACKED</code>, de Redis 8.2, recorta solo lo que todos los grupos confirmaron, a cambio de que un grupo abandonado haga crecer el stream sin límite.'
    },
    {
      id: 'capacidad', type: 'single',
      prompt: 'Para una oferta esperas 12 pedidos por segundo durante 10 minutos. Un correo le toma 0.25&#8239;s a un worker. ¿Cuántos workers pones?',
      options: [
        'Dos: con backpressure, el relay frena y el lag nunca crece.',
        'Tres es el mínimo, porque 12 × 0.25 = 3 workers ocupados todo el tiempo. Con tres exactos, cualquier variación deja un lag que no baja durante la oferta, así que pones cuatro o cinco. Con dos, el lag crece 12 − 2 / 0.25 = 4 entradas por segundo: 2&#8239;400 a los 10 minutos.',
        'Doce, uno por cada pedido de cada segundo.',
        'Da lo mismo: el cuello de botella es <code>XREADGROUP</code>, no los workers.'
      ],
      answer: 1,
      explain: 'Es la ley de Little: los workers ocupados son la tasa de llegada por el tiempo de cada correo. El backpressure no agrega capacidad: mueve la espera a la outbox, y los correos llegan igual de tarde. Un stream de Redis atiende muchísimas más lecturas por segundo que 12, así que aquí el límite son los correos, no Redis.'
    }
  ],
  solution: '<ul>' +
    '<li>La outbox mete el evento en la misma transacción que el pedido, y el relay lo publica después: una caída entre los dos ya no pierde el correo.</li>' +
    '<li>El worker confirma con <code>XACK</code> después del correo y de su anotación. Cada caída se convierte en otra entrega, y el reaper la reclama con <code>XPENDING</code> y <code>XCLAIM</code> cuando lleva más de 15&#8239;s sin confirmar.</li>' +
    '<li>El dedupe por <code>eventId</code>, en la misma transacción que el envío, absorbe los repetidos del relay y del reaper. Queda abierta una ventana: el correo salió y el commit no llegó.</li>' +
    '<li>Lo que falla tres veces, o no se puede leer, va a la DLQ con su error, y vuelve al stream cuando una persona arregla la causa.</li>' +
    '<li>Pub/Sub entrega a todos los que escuchan o a nadie: sirve para avisos con respaldo, no para repartir correos.</li>' +
    '<li>El lag no ve un recorte que borró lo que nadie leyó. Recorta con <code>ACKED</code> o con un margen amplio, y compara de punta a punta.</li>' +
    '<li>La capacidad se calcula con la ley de Little, con margen; el backpressure solo decide dónde espera lo que no cabe.</li>' +
    '</ul>'
});
