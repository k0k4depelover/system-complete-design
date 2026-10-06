/* Decisiones guiadas de A03 (caché que aguanta un pico). Formato en core/exercise.js. */

SD.defineExercise('a03-cache', {
  title: 'la tienda en su día de ofertas',
  scenario: '<p>La tienda corre con la caché de esta guía: memoria de la réplica con un TTL de 2&#8239;s, Redis con 60&#8239;s y jitter, un lock de 3&#8239;s contra la estampida, una espera de hasta 500&#8239;ms para quien no consigue el lock, Pub/Sub para los precios y las visitas en lotes cada 2&#8239;s. El día de ofertas pasan cuatro cosas.</p>',
  steps: [
    {
      id: 'pubsub', type: 'single',
      prompt: 'Una réplica pierde su suscripción a <code>products:invalidate</code> durante 10&#8239;s, pero sigue leyendo Redis sin problemas. En ese tiempo cambia el precio de un producto rebajado. ¿Cuánto tiempo, como mucho, puede mostrar el precio viejo esa réplica?',
      options: ['Unos 2&#8239;s', 'Unos 10&#8239;s', 'Unos 60&#8239;s', 'Hasta que se reinicie'],
      fixed: true,
      answer: 0,
      explain: 'El aviso se perdió, porque Pub/Sub no guarda mensajes para quien no está escuchando. Pero el cambio de precio escribió la ficha nueva en Redis (write-through), así que cuando vence la memoria de la réplica, a los 2&#8239;s como mucho, la lectura siguiente trae el precio nuevo. El TTL local es el límite de lo viejo, con o sin Pub/Sub.'
    },
    {
      id: 'espera', type: 'single',
      prompt: 'En el pico, la base se pone lenta y cargar una ficha pasa de 50&#8239;ms a 2&#8239;s. Se vacía Redis por error. ¿Qué pasa con las 400 lecturas de un producto rebajado que llegan a la vez?',
      options: [
        'Una toma el lock y carga; las otras 399 esperan los 2&#8239;s y reciben la ficha de Redis.',
        'Una toma el lock; las otras esperan 500&#8239;ms y van todas a la base.',
        'Las 399 reciben un 503, porque el lock está tomado y no hay ficha vieja.',
        'El lock vence a los 3&#8239;s y todas van a la base.'
      ],
      answer: 1,
      explain: 'La espera es más corta que la carga, y waitForTheOneLoading termina en load(id) para no fallar. Con una base lenta, la protección se apaga justo cuando más falta. O la espera es mayor que la carga más lenta que aceptas, o las que se cansan responden un error rápido en lugar de ir a la base. Y precargar los productos rebajados antes de la oferta evita que la clave esté vacía.'
    },
    {
      id: 'version', type: 'single',
      prompt: 'Sin el script <code>PUT_IF_NOT_OLDER</code>, una lectura lenta lee la versión 4 de la base, y mientras tanto alguien cambia el precio a la versión 5. La lectura termina después y escribe su versión 4 en Redis. ¿Qué ve la gente?',
      options: [
        'El precio nuevo: la versión 5 ya estaba en la base.',
        'El precio viejo durante unos 60&#8239;s, en todas las réplicas.',
        'El precio viejo durante 2&#8239;s, hasta que vence la memoria de la réplica.',
        'Un error, porque Redis rechaza la escritura de una versión vieja.'
      ],
      answer: 1,
      explain: 'Las réplicas leen de Redis, no de la base, mientras la ficha esté fresca. Una escritura vieja que llega tarde deja el precio viejo por todo el TTL de Redis, y las memorias locales lo vuelven a copiar cada 2&#8239;s. Comparar versiones dentro de un script de Lua, que Redis ejecuta sin intercalar otros comandos, descarta esa escritura.'
    },
    {
      id: 'contador', type: 'single',
      prompt: 'Alguien propone usar el mismo write-behind para el stock: restar en Redis cada venta y pasar el stock a la base cada 2&#8239;s. ¿Qué le respondes?',
      options: [
        'Bien: es lo mismo que las visitas y saca escrituras de la base.',
        'No: si Redis se cae, se pierden ventas que la base nunca vio.',
        'Bien, si el lote es de 100&#8239;ms en vez de 2&#8239;s.',
        'No, porque HINCRBY no acepta números negativos para restar el stock.'
      ],
      answer: 1,
      explain: 'Write-behind cambia durabilidad por velocidad: lo que está en Redis y todavía no llegó a la base se puede perder, por mucho AOF que tengas. Para las visitas, perder un segundo es aceptable. Para el stock, es vender lo que no tienes. Un lote más chico achica la ventana, pero no la cierra. HINCRBY sí acepta negativos.'
    }
  ],
  solution: '<ul><li>El TTL de la memoria local es el máximo que una réplica puede mostrar un precio viejo; Pub/Sub lo acorta cuando funciona, y el write-through hace que la lectura siguiente sea correcta.</li><li>La espera de quien no consigue el lock tiene que ser mayor que la carga más lenta que aceptes; si no, la estampida vuelve con la base lenta. Precarga lo caliente antes del pico.</li><li>Toda escritura en la caché compara versiones de forma atómica, para que una lectura lenta no deje un dato viejo.</li><li>Write-behind solo para lo que puedes perder un poco, como visitas o métricas. Lo que es dinero o stock va a la base en la misma transacción.</li></ul>'
});
