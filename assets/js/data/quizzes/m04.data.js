SD.defineQuiz('m04', {
  title: 'Quiz: caché',
  pass: 0.7,
  questions: [
    {
      id: 'hit', type: 'single',
      prompt: 'Tu base recibe 1 000 lecturas/s con una tasa de acierto de caché del 99 %. Un cambio de código baja el acierto a 95 %. ¿Cuántas lecturas por segundo llegan ahora a la base?',
      options: ['1 040', '1 400', '5 000', '95 000'],
      answer: 2,
      explain: 'Con 99 % de acierto, el 1 % del tráfico total llega a la base: el total es 100 000/s. Con 95 %, llega el 5 %: 5 000/s. Un cambio "pequeño" en la tasa de acierto multiplicó por 5 la carga de la base.'
    },
    {
      id: 'patron', type: 'single',
      prompt: 'Un contador de "me gusta" recibe miles de incrementos por segundo y puede perder unos pocos si un servidor muere. ¿Qué patrón encaja?',
      options: ['Cache-aside', 'Write-through', 'Write-behind (acumular en caché y volcar en lote)', 'Sin caché'],
      answer: 2,
      explain: 'Write-behind agrupa miles de incrementos en una escritura cada pocos segundos. El costo es la posible pérdida de lo no volcado, que aquí es aceptable. Para saldos de dinero, nunca.'
    },
    {
      id: 'race', type: 'single',
      prompt: 'Un lector tiene un miss, lee el precio viejo de la base y se demora. Mientras tanto, un escritor actualiza la base y borra la caché. Después el lector guarda en la caché lo que leyó. ¿Qué queda?',
      options: [
        'El precio nuevo, porque el escritor borró la caché.',
        'El precio viejo, hasta que venza el TTL.',
        'Nada: Redis rechaza el SET.',
        'Un error de concurrencia.'
      ],
      answer: 1,
      explain: 'El SET del lector llegó después del DEL del escritor. Se mitiga con leases (el DEL invalida el permiso del lector para escribir, como hizo Facebook con memcache), con el número de versión en el valor, o al menos con un TTL corto que acote cuánto dura el error.'
    },
    {
      id: 'stampede', type: 'multi',
      prompt: '¿Qué técnicas previenen una estampida cuando vence una clave muy leída?',
      options: [
        'Single-flight: una sola consulta por clave dentro de cada proceso.',
        'Un lease o lock distribuido para que solo un proceso recalcule.',
        'Bajar el TTL de todas las claves a 1 segundo.',
        'Expiración anticipada probabilística.',
        'Servir el valor vencido mientras se recalcula en segundo plano.'
      ],
      answer: [0, 1, 3, 4],
      explain: 'Todas apuntan a que la clave se recalcule una vez y no miles. Bajar el TTL hace lo contrario: más vencimientos, más estampidas.'
    },
    {
      id: 'jitter', type: 'single',
      prompt: 'Al arrancar, un job llena la caché con 2 millones de claves con TTL de exactamente 1 hora. ¿Qué pasa una hora después y cómo se evita?',
      options: [
        'Nada especial.',
        'Vencen todas juntas y la base recibe la avalancha de misses. Se evita agregando jitter aleatorio al TTL.',
        'Redis se reinicia.',
        'Se duplican las claves.'
      ],
      answer: 1,
      explain: 'Claves creadas juntas con el mismo TTL vencen juntas. Un TTL de 3 600 s más un aleatorio de 0 a 600 s reparte los vencimientos en 10 minutos.'
    },
    {
      id: 'hotkey', type: 'single',
      prompt: 'Una clave de Redis recibe 300 000 lecturas por segundo y su shard está al 100 % de CPU, mientras los otros shards están ociosos. ¿Qué haces primero?',
      options: [
        'Agregar más shards.',
        'Una caché local en proceso con TTL corto para esa clave (o réplicas de la clave con sufijos).',
        'Subir la memoria del shard.',
        'Bajar el TTL.'
      ],
      answer: 1,
      explain: 'Más shards no ayudan: la clave sigue viviendo en uno solo. Hay que repartir las lecturas de esa clave: copias en la memoria de cada instancia, o varias copias en Redis (clave:1 … clave:8) y leer una al azar.'
    },
    {
      id: 'caida', type: 'single',
      prompt: 'Tu base está dimensionada para el 2 % de misses de caché. El clúster de Redis cae entero. ¿Cuál es la defensa más importante para que la base no caiga también?',
      options: [
        'Reintentar las lecturas a Redis sin límite.',
        'Limitar la concurrencia hacia la base y rechazar rápido el excedente (load shedding), con timeouts cortos y circuit breaker hacia Redis.',
        'Apagar la aplicación.',
        'Aumentar el TTL.'
      ],
      answer: 1,
      explain: 'La base no puede absorber 50 veces su carga. Mejor servir bien al 20 % del tráfico y rechazar el resto con un 503 rápido que dejar que todo se encole y la base colapse para el 100 %.'
    },
    {
      id: 'cdc', type: 'single',
      prompt: '¿Qué ventaja tiene invalidar la caché leyendo el log de cambios de la base (CDC) en lugar de hacerlo en el código que escribe?',
      options: [
        'Es más rápido que un DEL directo.',
        'Captura todos los cambios, incluidos los de otros servicios, jobs o correcciones manuales, sin depender de que cada escritor se acuerde de invalidar.',
        'Elimina la necesidad de TTL.',
        'Hace la caché fuertemente consistente.'
      ],
      answer: 1,
      explain: 'El log es la única fuente que ve todas las escrituras. Sigue siendo eventual (llega con retraso) y conviene mantener el TTL como red de seguridad por si se pierde un evento.'
    },
    {
      id: 'readthrough', type: 'single',
      prompt: '¿Qué diferencia a read-through de cache-aside en una lectura con miss?',
      options: [
        'En read-through, la caché misma lee la base y se llena; en cache-aside, lo hace la aplicación.',
        'Read-through no tiene misses.',
        'En read-through, la escritura va primero a la caché.',
        'Cache-aside no usa TTL.'
      ],
      answer: 0,
      explain: 'El costo del miss es el mismo; cambia quién lo maneja. En read-through la app solo habla con la caché, que tiene un cargador configurado para leer la base. Repasa la animación de 4.2.'
    },
    {
      id: 'writearound', type: 'single',
      prompt: 'Un servicio guarda el historial de cada chat: se escribe todo el tiempo y casi nadie lo vuelve a leer. ¿Qué patrón de escritura evita llenar la caché de datos inútiles?',
      options: ['Write-through', 'Write-around', 'Refresh-ahead', 'Write-behind'],
      answer: 1,
      explain: 'Con write-around, las escrituras van solo a la base y la caché se llena únicamente con lo que alguien lee. Write-through cachearía cada mensaje aunque nadie lo pida. Repasa la tabla de 4.2.'
    },
    {
      id: 'ventana', type: 'single',
      prompt: 'Usas "borrar al escribir" con un TTL de 300 s. ¿Cuánto puede durar un valor viejo en la caché en el peor caso, y por qué?',
      options: [
        'Unos milisegundos: lo que tarda el DEL.',
        'Hasta 300 s: si un lector lento pierde la carrera y guarda el valor viejo después del DEL, o si el DEL se pierde, solo el TTL lo saca.',
        'Nunca hay valores viejos con borrado.',
        'Hasta que se reinicie Redis.'
      ],
      answer: 1,
      explain: 'El caso normal dura milisegundos, pero el diseño se define por el caso malo. Por eso el TTL es la red de seguridad, y el doble borrado o un lease acortan o cierran esa cola. Repasa la figura 4.2.'
    },
    {
      id: 'lease-del', type: 'single',
      prompt: 'Con leases, el lector A recibe el token 7 en un miss y va a la base. Un escritor actualiza el precio y hace DEL de la clave. ¿Qué pasa cuando A intenta guardar lo que leyó con el token 7?',
      options: [
        'La caché lo acepta, porque A fue el primero.',
        'La caché lo rechaza: el DEL anuló el token 7, y el valor viejo no entra.',
        'La caché lo acepta, pero con un TTL corto.',
        'A espera a que el escritor termine y vuelve a intentar con el mismo token.'
      ],
      answer: 1,
      explain: 'El DEL invalida el token vigente, porque quien lo tenía leyó la base antes del cambio. El SET exige un token vigente. Así se cierra la carrera de la figura 4.1. Repasa 4.4, "Cómo funciona".'
    },
    {
      id: 'lease-herd', type: 'single',
      prompt: 'Vence una clave caliente y llegan mil lecturas casi a la vez. Con leases, ¿cuántas consultas llegan a la base y qué hacen las demás lecturas?',
      options: [
        'Mil: cada lectura recibe su propio token.',
        'Una: solo la primera recibe el token; las demás reciben un aviso, esperan unos milisegundos y vuelven a leer la caché.',
        'Ninguna: la caché devuelve un error.',
        'Veinte, una por instancia.'
      ],
      answer: 1,
      explain: 'Hay como mucho un token vigente por clave. Las demás no van a la base: esperan y releen, y encuentran el valor que dejó el dueño del lease. Veinte sería single-flight por instancia. Repasa la animación de 4.4.'
    },
    {
      id: 'lease-vence', type: 'multi',
      prompt: 'El dueño de un lease se congela 3 s por una pausa de GC, y el lease dura 2 s. ¿Qué es cierto?',
      options: [
        'El lease vence solo, y el próximo miss recibe un token nuevo: la clave no queda bloqueada.',
        'Cuando el dueño despierta, su SET con el token viejo se rechaza.',
        'El dueño puede escribir sin problema porque sigue teniendo el token.',
        'Para que esto sea seguro, la verificación del token tiene que hacerla la caché, no el cliente.'
      ],
      answer: [0, 1, 3],
      explain: 'El vencimiento resuelve que nadie espere para siempre, y el token resuelve que el dueño no escriba tarde. Si el cliente verificara solo, la pausa podría ocurrir entre su chequeo y su escritura: por eso la caché compara el token, como un fencing token. Repasa 4.4 y M06, 6.14.'
    },
    {
      id: 'lease-script', type: 'single',
      prompt: 'En la implementación de un lease en Redis, ¿por qué el SET del valor va dentro de un script de Lua que primero compara el token?',
      options: [
        'Porque Lua es más rápido que los comandos normales.',
        'Porque Redis ejecuta el script de forma atómica: entre comparar el token y escribir no puede colarse un DEL ni un lease nuevo.',
        'Porque Redis no permite SET con TTL fuera de Lua.',
        'Porque el script cifra el valor.'
      ],
      answer: 1,
      explain: 'Con un GET del lease y un SET por separado, el lease podría anularse entre los dos comandos, que es justo la carrera que se quiere evitar. Repasa 4.4, "Un lease en Redis".'
    },
    {
      id: 'l1', type: 'single',
      prompt: 'Cada una de tus 50 instancias tiene una caché L1 en memoria, y avisas los cambios con PUBLISH en Redis. ¿Por qué sigues necesitando un TTL corto en L1?',
      options: [
        'Porque el pub/sub de Redis no guarda mensajes: una instancia desconectada en ese momento se pierde el aviso y se queda con el valor viejo.',
        'Porque PUBLISH es lento.',
        'Porque las cachés L1 no aceptan borrados.',
        'No hace falta: el aviso siempre llega.'
      ],
      answer: 0,
      explain: 'Pub/sub entrega a quien está conectado y nada más. El TTL corto acota cuánto dura un aviso perdido. Con CLIENT TRACKING pasa algo parecido: si se corta la conexión, hay que vaciar la caché local. Repasa 4.3, "Dos niveles".'
    }
  ]
});
