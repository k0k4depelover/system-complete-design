/* Decisiones guiadas de A06 (repartir los datos). Formato en core/exercise.js. */

SD.defineExercise('a06-pedidos', {
  title: 'los pedidos de la tienda en línea',
  scenario: '<p>Los pedidos corren como en esta guía: particiones por mes, un anillo con 128 nodos virtuales por shard, un pool por shard, los recientes con un plazo de 300&#8239;ms y la migración por fases. La tienda crece, y tienes que tomar cuatro decisiones.</p>',
  steps: [
    {
      id: 'clave', type: 'single',
      prompt: 'Antes de repartir nada: ¿por qué campo decides en qué shard vive cada pedido?',
      options: [
        'Por <code>customer_id</code>: los pedidos de un cliente quedan juntos.',
        'Por el <code>id</code> del pedido: es lo más parejo y ningún shard se calienta.',
        'Por <code>created_at</code>: un rango de fechas por shard, fácil de archivar.',
        'Por país: cada país en su shard, cerca de sus clientes.'
      ],
      answer: 0,
      explain: 'Casi todo lo que hace la tienda es por cliente: crear, listar, ver y cancelar. Con <code>customer_id</code>, esas consultas tocan un solo shard, y solo los recientes de toda la tienda preguntan a todos. Por <code>id</code>, la carga queda pareja, pero listar los pedidos de un cliente pregunta a todos los shards. Por fecha, todos los pedidos nuevos caen en el último shard. Por país, el país más grande decide el tamaño de su shard.'
    },
    {
      id: 'gigante', type: 'single',
      prompt: 'Un cliente mayorista empieza a hacer el 15&#8239;% de todos los pedidos. Su shard va mucho más cargado que los otros dos. ¿Qué haces?',
      options: [
        'Subir los nodos virtuales de 128 a 512 para repartir mejor sus pedidos.',
        'Sumar un cuarto shard y migrar parte del anillo hacia él.',
        'Una tabla de excepciones que lo manda a un shard propio.',
        'Repartir por <code>id</code> del pedido a todos los clientes.'
      ],
      answer: 2,
      explain: 'Los nodos virtuales emparejan cuántos clientes le tocan a cada shard, pero un cliente vive entero en un punto del anillo: con más nodos virtuales o más shards, sus pedidos siguen todos juntos. La tabla de excepciones es la estrategia por directorio de M05, usada solo para los clientes gigantes. Repartir a todos por <code>id</code> arregla al mayorista y rompe las consultas por cliente de todos los demás.'
    },
    {
      id: 'reinicio', type: 'single',
      prompt: 'A mitad de la migración, después del backfill y de verify, en <code>DUAL_WRITE</code>, la app se reinicia. ¿Qué pasa?',
      options: [
        'Se pierden los pedidos creados desde que empezó la migración.',
        'La app vuelve al anillo con s1 y s2, y repites la migración.',
        'La app empieza a leer de s3, que no tiene todo.',
        '<code>cleanup</code> corre al arrancar y borra lo que se había copiado a s3.'
      ],
      answer: 1,
      explain: 'La topología vive en memoria. Al reiniciar, la app vuelve a <code>STABLE</code> con s1 y s2, que tenían la verdad durante toda la doble escritura: no se pierde nada. Las copias de s3 se quedan viejas, pero el backfill con <code>UPSERT</code> se puede repetir y las pone al día. <code>cleanup</code> se niega, porque la migración no terminó en esta instancia. Con varias instancias, la topología tiene que estar en un lugar compartido, con versión.'
    },
    {
      id: 'congelado', type: 'single',
      prompt: 'En hora pico, s2 se congela 15&#8239;s: acepta conexiones, pero no contesta. ¿Qué debería ver cada cliente?',
      options: [
        'Toda la tienda responde 503 hasta que s2 vuelva.',
        'Los clientes de s2 reciben 503 rápido; el resto compra normalmente.',
        'Los recientes esperan a s2, para no mostrar una lista incompleta.',
        'Los pedidos de los clientes de s2 se escriben en s1 mientras tanto.'
      ],
      answer: 1,
      explain: 'Un shard caído solo debería afectar a sus clientes: cada shard tiene su pool, así que las conexiones atrapadas en s2 no son las de s1 ni las de s3. Los hilos de Tomcat sí son de todos, y por eso importan los plazos: el <code>connectionTimeout</code> de 1&#8239;s suelta a los que esperan una conexión de s2, y el <code>socketTimeout</code> de 5&#8239;s, a los que ya tenían una. Los recientes no esperan: a los 300&#8239;ms responden 200 con lo que llegó, sin los pedidos de s2, y con <code>partial: true</code>. Escribir en s1 los pedidos de un cliente de s2 parte sus datos en dos shards, y nadie sabría después dónde buscar.'
    }
  ],
  solution: '<ul><li>La clave de partición sale de las consultas frecuentes: aquí, <code>customer_id</code>. Lo que cruza todos los shards, como los recientes, se resuelve aparte.</li><li>Los nodos virtuales emparejan la cantidad de clientes, no el tamaño de cada uno. Un cliente gigante necesita una excepción explícita.</li><li>La migración es segura mientras la verdad está siempre en un lado conocido, el backfill se puede repetir y la limpieza, lo único irreversible, va al final.</li><li>Un shard caído afecta a sus clientes y a nadie más: un pool por shard, timeouts cortos y resultados parciales en las consultas que cruzan shards.</li></ul>'
});
