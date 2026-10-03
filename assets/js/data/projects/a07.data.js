/* Decisiones guiadas de A07 (Kubernetes para sistemas distribuidos). Formato en core/exercise.js. */

SD.defineExercise('a07-cuentas', {
  title: 'el servicio de cuentas en Kubernetes',
  scenario: '<p>El servicio de cuentas corre como en esta guía: dos pods o más detrás del Gateway, un HPA de 2 a 8 pods al 60&#8239;% de CPU, y PostgreSQL con CloudNativePG, un primario y una réplica detrás de PgBouncer. Tienes que tomar cuatro decisiones.</p>',
  steps: [
    {
      id: 'readiness', type: 'single',
      prompt: 'Alguien propone sumar la base a la readiness, con <code>management.endpoint.health.group.readiness.include=readinessState,db</code>, para que un pod sin base deje de recibir tráfico. ¿Qué pasa cuando se cae el primario?',
      options: [
        'Nada grave: los pods salen del Service unos segundos y vuelven solos cuando la base responde.',
        'Todos los pods fallan la readiness a la vez, porque dependen del mismo primario: el Gateway se queda sin pods y responde 503 a todo, y el corte dura lo mismo, porque la base sigue caída.',
        'Kubernetes reinicia los pods hasta que la base vuelva.',
        'El HPA suma pods para compensar los que salieron.'
      ],
      answer: 1,
      explain: 'La readiness dice si este pod puede atender, no si todo el sistema está sano. Una dependencia que comparten todos los pods convierte una falla de la base en una falla de todos los pods a la vez: el Gateway no tiene a quién mandar nada y responde 503. Sin la base en la readiness, cada pod sigue recibiendo requests y responde su propio error a los 5&#8239;s de Hikari. Reiniciar es cosa de la liveness, no de la readiness, y el HPA mira la CPU, no la readiness.'
    },
    {
      id: 'prestop', type: 'single',
      prompt: 'Para que los rollouts tarden menos, alguien quita el <code>preStop</code> y deja todo lo demás: readiness, apagado ordenado y <code>maxUnavailable: 0</code>. ¿Qué esperas ver en la próxima medición con carga?',
      options: [
        'Nada: el apagado ordenado ya espera a que terminen los requests en curso.',
        'Algunos 502 por cada pod que se baja: el SIGTERM llega mientras Traefik todavía le manda requests, y Tomcat ya no los acepta.',
        'Que el rollout no termine, porque los pods viejos no se pueden bajar.',
        'Errores solo en los pods nuevos, porque reciben tráfico antes de estar listos.'
      ],
      answer: 1,
      explain: 'Sacar el pod de los Endpoints y mandarle el SIGTERM pasan a la vez, y Traefik se entera del cambio un poco después. El apagado ordenado cuida los requests que ya entraron, no los que siguen llegando: con <code>server.shutdown: graceful</code>, Tomcat deja de aceptar requests nuevos apenas recibe la señal. El <code>preStop</code> retrasa el SIGTERM 5&#8239;s, y en ese tiempo Traefik deja de mandarle tráfico. Los pods nuevos siguen protegidos por la readiness. Esta guía no midió este caso por separado: si quieres el número, repite la medición del rollout con solo ese cambio.'
    },
    {
      id: 'maximo', type: 'single',
      prompt: 'En la rampa, el HPA llegó a su máximo de 8 pods con el uso entre 148 y 182&#8239;% de lo pedido, y la fórmula pedía entre 20 y 25. ¿Qué haces antes de subir <code>maxReplicas</code>?',
      options: [
        'Nada: lo subo a 25, que es lo que dio la fórmula.',
        'Bajo el costo de bcrypt a 4, como en las pruebas.',
        'Reviso de dónde sale la CPU: cuántos núcleos gasta la carga, y si los nodos los tienen libres. En un clúster real, sumo nodos con un autoscaler de nodos.',
        'Subo el objetivo del HPA de 60 a 90&#8239;% para que pida menos pods.'
      ],
      answer: 2,
      explain: 'El HPA suma pods, no CPU. Un pod nuevo en un nodo sin núcleos libres reparte la misma CPU entre más procesos, y el uso por pod sigue alto: por eso la fórmula pedía cada vez más. En este laboratorio, además, los tres nodos comparten los núcleos de tu máquina. La cuenta de la guía: si cada inicio de sesión gasta unos 100&#8239;ms de CPU, 40 por segundo son 4 núcleos, y a 300m por pod son 14 pods, siempre que esos núcleos existan. El costo 4 de las pruebas hace cada hash unas 64 veces más barato, 2<sup>10</sup> contra 2<sup>4</sup>, y también para quien intenta adivinar contraseñas. Subir el objetivo no crea CPU: deja menos margen para el próximo pico.'
    },
    {
      id: 'plazos', type: 'single',
      prompt: 'Con los valores por defecto, cuando se muere el primario, las escrituras siguen fallando unos 14&#8239;s después de la promoción. ¿Qué cambias?',
      options: [
        'El <code>failoverDelay</code> del operador, para que promueva antes.',
        'Los plazos de los que esperan al primario muerto: el <code>server_connect_timeout</code> y el <code>server_login_retry</code> de PgBouncer, y el <code>connection-timeout</code> de Hikari.',
        'El tamaño del pool de Hikari, para tener conexiones de repuesto.',
        'Reintentos en la app para cada escritura, sin límite, hasta que la base vuelva.'
      ],
      answer: 1,
      explain: 'El <code>failoverDelay</code> ya vale 0, y esos 14&#8239;s pasan después de la promoción, cuando la base nueva ya acepta escrituras. Lo que falta es que PgBouncer deje de insistir con el primario muerto, y el número se parece a los 15&#8239;s de su <code>server_connect_timeout</code>. Con 3&#8239;s, un reintento de login a 1&#8239;s y Hikari en 5&#8239;s, la última falla quedó unos 2&#8239;s después de promover; como cambiaron juntos, la medición no dice cuánto pone cada uno. Un pool más grande espera lo mismo. Y reintentar sin límite multiplica la carga justo cuando la base vuelve: es la tormenta de reintentos de M08.'
    }
  ],
  solution: '<ul><li>La readiness dice si este pod puede atender, no si todo el sistema está sano: una dependencia compartida en la readiness saca a todos los pods a la vez.</li><li>Un despliegue sin errores necesita las cuatro piezas: readiness para los pods nuevos, <code>preStop</code> y apagado ordenado para los viejos, y <code>maxUnavailable: 0</code> para no perder capacidad mientras tanto.</li><li>El HPA suma pods, no CPU: antes de subir el máximo, haz la cuenta de núcleos y confirma que existen.</li><li>Un failover tiene dos partes: la del operador, que tus timeouts no tocan, y la de los clientes, que sí. Mídelas por separado, y cambia un plazo por vez.</li></ul>'
});
