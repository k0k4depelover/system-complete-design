/* Decisiones guiadas de IA01 (Un agente de guardia). Formato en core/exercise.js. */

SD.defineExercise('ia01-guardia', {
  title: 'un agente que investiga antes de despertarte',
  scenario: '<p>El agente corre como en esta guía: un grafo de LangGraph con triage, un bucle de investigación con cuatro herramientas de solo lectura (métricas, logs, runbooks y SQL), dos acciones con efecto (cambiar un flag y cancelar consultas) que pasan por una aprobación, y un informe. Los checkpoints van a PostgreSQL con <code>durability="sync"</code>. El tope es de 12 pasos y 200&#8239;000 tokens por investigación. Tienes que tomar ocho decisiones.</p>',
  steps: [
    {
      id: 'solo-lectura', type: 'single',
      prompt: '¿Dónde pones la garantía de que <code>consultar_sql</code> nunca escribe en la base de la tienda?',
      options: [
        'En el prompt del sistema, con una regla clara que prohíba cualquier escritura.',
        'En un rol de PostgreSQL con solo <code>SELECT</code>, que la base hace cumplir aunque el modelo insista.',
        'En una expresión regular que rechace <code>UPDATE</code>, <code>DELETE</code> e <code>INSERT</code> antes de mandar la consulta.',
        'En el modelo más capaz, porque respeta mejor las instrucciones de seguridad.'
      ],
      answer: 1,
      explain: 'El prompt y el modelo son pedidos, no barreras: una nota envenenada o un error del modelo los saltan. Una expresión regular se equivoca con un <code>WITH … UPDATE</code> o con una función que escribe. El <code>GRANT</code> no depende de nada de eso: si el rol no tiene <code>UPDATE</code>, la base dice que no. Es el privilegio mínimo de M25, y la prueba del paso 4 lo muestra con un <code>UPDATE</code> que falla.'
    },
    {
      id: 'donde-se-detiene', type: 'single',
      prompt: 'El modelo propone <code>CambiarFlag</code>. ¿Dónde se detiene el grafo para pedir permiso?',
      options: [
        'En un <code>input()</code> dentro de la herramienta, que espera la respuesta.',
        'Después del efecto, para que la persona lo revise y lo revierta si no está de acuerdo.',
        'En un nodo con <code>interrupt</code>, antes del efecto, con el estado guardado en el checkpoint.',
        'En ninguna parte: la descripción de la herramienta ya le pide al modelo que confirme.'
      ],
      answer: 2,
      explain: '<code>interrupt</code> pausa el grafo y guarda el estado; la decisión llega días después con <code>Command(resume=…)</code>, aunque el proceso se haya apagado. Un <code>input()</code> bloquea un proceso que tiene que seguir vivo y no sobrevive a una caída. Revisar después del efecto no sirve para lo que no se deshace, como una consulta cancelada. Y el modelo no puede aprobarse a sí mismo.'
    },
    {
      id: 'antes-del-interrupt', type: 'single',
      prompt: 'Alguien agrega en el nodo <code>aprobar</code>, antes del <code>interrupt</code>, un aviso a Slack: "hay una acción esperando". ¿Qué pasa?',
      options: [
        'El aviso sale una sola vez, porque LangGraph guarda en el checkpoint lo que hizo cada línea.',
        'El aviso no sale nunca, porque <code>interrupt</code> descarta lo que el nodo hizo antes de pausarse.',
        'El aviso sale una sola vez, porque el grafo reanuda justo en la línea del <code>interrupt</code>.',
        'El aviso se repite en cada reanudación, porque el nodo vuelve a correr desde el principio.'
      ],
      answer: 3,
      explain: 'Al reanudar, LangGraph corre otra vez el nodo del <code>interrupt</code> desde su primera línea; esta vez <code>interrupt()</code> devuelve la decisión en lugar de pausar. Lo que había antes se ejecuta de nuevo. Por eso <code>aprobar</code> solo arma el pedido, y todo efecto vive en otro nodo, <code>actuar</code>, que corre una vez por decisión.'
    },
    {
      id: 'clave', type: 'single',
      prompt: 'La acción se anota en la tabla <code>acciones</code> con una clave, antes del efecto. ¿De dónde sale la clave?',
      options: [
        'Del id del hilo y del id de la llamada del modelo, que ya quedaron guardados en el checkpoint.',
        'De un <code>uuid4()</code> generado en <code>actuar</code>, para que cada ejecución tenga una clave distinta.',
        'Del nombre de la acción y sus argumentos, para que dos acciones iguales cuenten como una.',
        'De la hora de la aprobación redondeada al segundo, que es la misma en cada intento.'
      ],
      answer: 0,
      explain: 'La clave tiene que ser la misma si <code>actuar</code> se repite después de una caída, y distinta para dos acciones distintas. Un <code>uuid4()</code> nuevo en cada ejecución no reconoce la repetición. El nombre y los argumentos confunden dos acciones legítimas iguales, como apagar el mismo flag en dos incidentes. La hora no es estable. El id de la llamada ya quedó escrito en el checkpoint junto con el mensaje del modelo: es la idempotency key de M27, derivada de quien origina la operación.'
    },
    {
      id: 'quien-corta', type: 'single',
      prompt: '¿Quién decide que una investigación se terminó porque se acabó el presupuesto?',
      options: [
        'El modelo, porque el prompt le pide que pare cuando lleve doce llamadas.',
        'La arista después de <code>investigar</code>, con los pasos y tokens del estado.',
        'El proveedor del modelo, que corta con un error cuando la conversación es demasiado larga.',
        'El checkpointer, que deja de guardar pasos cuando el hilo pasa de cierto tamaño.'
      ],
      answer: 1,
      explain: 'El tope tiene que estar fuera del modelo: un modelo en un bucle no cuenta bien sus propias llamadas, y es justo el caso que el tope existe para cortar. El límite del proveedor llega tarde y con un error en lugar de un informe. La arista lee <code>pasos</code>, <code>tokens_entrada</code> y <code>tokens_salida</code>, que cada nodo suma desde <code>usage_metadata</code>, y manda al informe. Son los topes de M25.'
    },
    {
      id: 'salida-larga', type: 'single',
      prompt: '<code>buscar_logs</code> encuentra 4&#8239;000 líneas que coinciden. ¿Qué le devuelve al modelo?',
      options: [
        'Las 4&#8239;000 líneas, porque el modelo necesita verlas todas para no perderse la causa.',
        'Solo la primera línea, porque la más vieja suele señalar la causa.',
        'Un resumen de las 4&#8239;000 líneas hecho por otra llamada al modelo, sin perder ninguna.',
        'El conteo y las 30 líneas más recientes, recortadas, con un aviso de que hay más.'
      ],
      answer: 3,
      explain: 'Todo lo que devuelve una herramienta entra al contexto y se vuelve a leer, y a pagar, en cada paso siguiente. 4&#8239;000 líneas llenan la ventana de qwen3 y le cuestan a Claude en cada llamada. Un resumen con otra llamada es caro y puede esconder justo la línea rara. El conteo dice cuánto hay, la muestra dice cómo es, y el aviso le dice al modelo que puede afinar el <code>texto</code> o los <code>minutos</code>.'
    },
    {
      id: 'metodo', type: 'single',
      prompt: 'El triage usa <code>with_structured_output</code> con Claude Sonnet 5.5. ¿Con qué <code>method</code>?',
      options: [
        '<code>function_calling</code>, que fuerza la herramienta del esquema con <code>tool_choice</code>.',
        '<code>json_schema</code>, la salida estructurada nativa, sin forzar ninguna herramienta.',
        '<code>json_mode</code>, que pide JSON libre y valida el esquema del lado de LangChain.',
        'Ninguno: se pide JSON en el prompt del sistema y se parsea con <code>json.loads</code>.'
      ],
      answer: 1,
      explain: 'El método por defecto de Claude en LangChain es forzar una herramienta, y Sonnet 5.5 responde 400 a un <code>tool_choice</code> forzado. <code>json_schema</code> usa la salida estructurada nativa: la respuesta cumple el esquema. Para Ollama es además el método por defecto. Pedir JSON en el prompt funciona hasta que el modelo agrega una frase antes de la llave.'
    },
    {
      id: 'veneno', type: 'single',
      prompt: 'Una nota de cliente que aparece en los logs le pide al agente cerrar la tienda. ¿Qué barrera no depende de que el modelo obedezca?',
      options: [
        'El spotlighting: con los resultados dentro de <code>&lt;resultado&gt;</code>, el modelo los ignora.',
        'Un prompt del sistema que diga que los datos de las herramientas nunca son instrucciones.',
        'Que la acción solo se proponga y una persona la lea antes de aplicarla.',
        'Correr el agente con Claude en lugar del modelo local, porque resiste mejor la injection.'
      ],
      answer: 2,
      explain: 'El spotlighting y el prompt bajan la probabilidad de que el modelo obedezca, pero no la llevan a cero: los dos dependen del modelo, sea cual sea. La aprobación no: aunque el modelo proponga cerrar la tienda, nada pasa hasta que alguien lo lee. Junto con el rol del actor, que solo toca tres columnas, son las defensas de arquitectura de la trifecta en M25.'
    }
  ],
  solution: '<ul><li>Los permisos de solo lectura van en un rol de PostgreSQL, no en el prompt.</li><li>Las acciones son esquemas que solo se proponen; el grafo se detiene con <code>interrupt</code> antes del efecto.</li><li>Nada con efectos antes del <code>interrupt</code>: el nodo se repite al reanudar.</li><li>La clave de cada acción sale del hilo y del id de la llamada, guardados en el checkpoint.</li><li>El presupuesto lo corta la arista, con contadores en el estado.</li><li>Las herramientas devuelven poco, con tope y aviso.</li><li>Salida estructurada con <code>json_schema</code>.</li><li>Contra la injection, barreras que no dependen del modelo: aprobación y privilegio mínimo.</li></ul>'
});
