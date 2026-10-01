SD.defineQuiz('m28', {
  title: 'Quiz: Cloudflare',
  pass: 0.7,
  questions: [
    {
      id: 'withdraw', type: 'single',
      prompt: 'El PoP de Lisboa deja de anunciar el prefijo anycast. ¿Qué pasa con sus usuarios?',
      options: [
        'Quedan sin servicio hasta que Lisboa vuelva.',
        'Sus paquetes pasan a llegar al siguiente PoP más cercano según BGP, con la misma IP; las conexiones abiertas se cortan y se reconectan.',
        'Hay que cambiar el registro DNS a la IP de otro PoP.',
        'Sus paquetes se reparten al azar entre todos los PoPs.'
      ],
      answer: 1,
      explain: 'Con anycast, salir de un PoP es retirar su anuncio. No hay DNS que cambiar ni TTL que esperar: la red converge en segundos hacia la siguiente ruta.'
    },
    {
      id: 'anycast-ddos', type: 'single',
      prompt: '¿Por qué anycast ayuda contra un ataque DDoS de una botnet repartida por el mundo?',
      options: [
        'Porque oculta la IP de la víctima.',
        'Porque cada parte del ataque llega al PoP de su región: ningún PoP recibe el ataque entero y la capacidad total de la red lo absorbe.',
        'Porque bloquea las IPs de los atacantes.',
        'Porque cifra el tráfico.'
      ],
      answer: 1,
      explain: 'Contra un solo datacenter, un ataque de varios Tbps satura sus enlaces. Repartido entre cientos de PoPs, cada uno recibe una fracción que puede filtrar.'
    },
    {
      id: 'xdp', type: 'single',
      prompt: '¿Por qué conviene descartar los paquetes de ataque con XDP, en el driver de red?',
      options: [
        'Porque XDP cifra los paquetes.',
        'Porque es el punto más temprano posible: el paquete se descarta antes de que el kernel le dedique memoria o CPU, y el servidor sigue atendiendo el tráfico legítimo.',
        'Porque XDP corre en otro servidor.',
        'Porque así el ataque vuelve al atacante.'
      ],
      answer: 1,
      explain: 'Cuanto antes se descarta un paquete, menos cuesta. Con descarte en el driver, un mismo servidor puede filtrar millones de paquetes por segundo y seguir sirviendo requests.'
    },
    {
      id: 'syn', type: 'single',
      prompt: '¿Qué resuelven las SYN cookies en un SYN flood?',
      options: [
        'Identifican al atacante.',
        'Permiten responder a cada SYN sin guardar estado hasta que el cliente complete el handshake, cosa que un paquete falso nunca hace: la tabla de conexiones no se llena.',
        'Aceleran el handshake de TLS.',
        'Cifran el SYN.'
      ],
      answer: 1,
      explain: 'El SYN flood busca llenar la tabla de conexiones a medio abrir. Con las SYN cookies, el estado viaja codificado en la respuesta y solo se reconstruye si el cliente contesta.'
    },
    {
      id: 'tiered', type: 'single',
      prompt: '¿Qué gana un sitio al activar la caché por niveles?',
      options: [
        'Nada: cada PoP ya cachea.',
        'Que los PoPs piden a unos pocos PoPs de nivel superior cerca del origen, que concentran las copias: más aciertos en total y muchas menos requests al origen, sobre todo para contenido poco pedido.',
        'Que el contenido se cifra en el borde.',
        'Que el origen puede estar apagado para siempre.'
      ],
      answer: 1,
      explain: 'Sin niveles, cada uno de cientos de PoPs que no tiene un objeto lo pide al origen. Con niveles, esos pedidos se juntan arriba.'
    },
    {
      id: 'isolates', type: 'single',
      prompt: '¿Por qué los Workers corren en isolates de V8 y no en contenedores?',
      options: [
        'Porque los contenedores no existen en Linux.',
        'Porque un isolate comparte el motor, no trae sistema operativo propio y arranca en milisegundos: caben miles por máquina, algo necesario para correr código de millones de clientes en cada PoP.',
        'Porque los isolates no tienen límites de CPU.',
        'Porque así el código puede ser de cualquier lenguaje sin compilar.'
      ],
      answer: 1,
      explain: 'Un contenedor tarda cientos de milisegundos o más en arrancar en frío y ocupa mucha más memoria. El precio de los isolates es correr en ese entorno, JavaScript o WebAssembly, con límites por request.'
    },
    {
      id: 'contador', type: 'single',
      prompt: 'Necesitas un contador global de "me gusta" exacto, actualizado desde todo el mundo. ¿Qué usas?',
      options: [
        'Workers KV.',
        'Un Durable Object por publicación: una sola instancia con un solo hilo procesa los incrementos en orden y los guarda de forma transaccional.',
        'La caché del PoP.',
        'Una variable global del Worker.'
      ],
      answer: 1,
      explain: 'KV es eventual: dos escrituras concurrentes desde lugares distintos pierden incrementos. Un objeto por publicación reparte la carga; uno solo para todas las publicaciones sería un cuello de botella.'
    },
    {
      id: 'kv', type: 'single',
      prompt: 'Cambias un feature flag en Workers KV. ¿Cuándo lo ven todos los PoPs?',
      options: [
        'Al instante, en todo el mundo.',
        'Puede tardar un minuto o más en verse en todos los lugares: la consistencia es eventual.',
        'Nunca, hasta reiniciar los Workers.',
        'Solo en el PoP donde se escribió.'
      ],
      answer: 1,
      explain: 'Para un flag, un minuto de diferencia suele ser aceptable. Para algo que debe cortarse al instante, como una API key robada, hace falta otro mecanismo.'
    },
    {
      id: 'config', type: 'multi',
      prompt: 'La configuración llega a todos los servidores del mundo en segundos. ¿Qué medidas evitan que un error llegue a todos a la vez?',
      options: [
        'Validar el costo de cada regla antes de publicarla, no solo su sintaxis.',
        'Desplegar por etapas, con CPU y errores vigilados y rollback automático.',
        'Tener un interruptor para apagar una función al instante.',
        'Publicar los cambios solo de noche.',
        'Desactivar los health checks durante el cambio.'
      ],
      answer: [0, 1, 2],
      explain: 'Es lo que se aprendió de la caída de julio de 2019: una regla con una expresión regular de backtracking catastrófico llegó a todo el mundo en segundos. Publicar de noche no reduce el radio de impacto.'
    },
    {
      id: 'tunnel', type: 'single',
      prompt: '¿Qué logra conectar el origen con Cloudflare Tunnel?',
      options: [
        'Cifrar la base de datos.',
        'Que el servidor abra una conexión saliente hacia la red, sin IP pública ni puertos abiertos: no hay dirección del origen que atacar saltándose el borde.',
        'Que el origen sirva desde todos los PoPs.',
        'Que no haga falta TLS.'
      ],
      answer: 1,
      explain: 'Si la IP del origen se filtra, un atacante puede ir directo contra él. Con un túnel saliente, el origen no acepta conexiones de nadie.'
    },
    {
      id: 'unimog', type: 'single',
      prompt: 'Un servidor del PoP sale de rotación. ¿Cómo evita Unimog cortar sus conexiones abiertas?',
      options: [
        'No lo evita: las conexiones se cortan y los clientes reconectan.',
        'El conductor lo pasa a la segunda ranura de sus buckets: no recibe conexiones nuevas, pero los paquetes de las que ya tenía siguen llegándole (segundo salto) hasta que terminan.',
        'Copia el estado de cada conexión a otro servidor antes de sacarlo.',
        'El router deja de repartir paquetes al PoP entero.'
      ],
      answer: 1,
      explain: 'Cada bucket guarda el servidor actual y el anterior. El primer salto atiende los SYN y las conexiones que tiene; si no tiene el socket, pasa el paquete al segundo. Así se drena un servidor sin mover estado.'
    },
    {
      id: 'k8s-workers', type: 'single',
      prompt: '¿Qué diferencia hay entre desplegar un Deployment de Kubernetes con 6 réplicas y desplegar un Worker?',
      options: [
        'Ninguna: un Worker es un pod que Cloudflare escala solo.',
        'En Kubernetes eliges cuántas réplicas hay y en qué nodos, y el scheduler las ubica antes de que llegue tráfico; en un Worker el código va a todos los servidores de todos los PoPs y el isolate se crea en el servidor al que llega cada request.',
        'Los Workers corren solo en una región elegida por el cliente.',
        'Los Workers usan una máquina virtual por cliente.'
      ],
      answer: 1,
      explain: 'La decisión de dónde corre el código, que en Kubernetes toma el scheduler al desplegar, en Workers la toma anycast request por request. A cambio, el código corre en un isolate con límites de memoria y CPU, sin estado local.'
    },
    {
      id: 'cold-start', type: 'single',
      prompt: '¿Cómo evitan los Workers que el arranque en frío se note?',
      options: [
        'Mantienen todos los Workers cargados siempre en todos los servidores.',
        'Empiezan a cargar el Worker cuando llega el primer mensaje del handshake TLS (que trae el nombre del sitio), y para los Workers pesados o poco usados dirigen las requests al servidor de casa del PoP, que ya los tiene calientes.',
        'Cachean las respuestas del Worker en el navegador.',
        'Reservan CPU para cada Worker aunque no reciba tráfico.'
      ],
      answer: 1,
      explain: 'El isolate se prepara mientras el handshake termina, escondido detrás de un viaje de ida y vuelta que igual había que hacer. Cuando los Workers crecieron y perdían esa carrera, se sumó el reenvío al servidor de casa con hashing consistente, que cuesta menos de 1 ms.'
    },
    {
      id: 'nov2025', type: 'multi',
      prompt: 'El 18 de noviembre de 2025, un archivo generado automáticamente (características de bots) duplicó su tamaño, superó un límite del proxy y provocó errores 5xx. ¿Qué medidas evitarían algo parecido en tu sistema?',
      options: [
        'Validar los archivos generados por otros sistemas (tamaño, forma, cantidad de entradas) antes de distribuirlos, igual que una entrada de usuario.',
        'Que un módulo que no puede leer su configuración nueva siga con la última versión buena en lugar de terminar el proceso.',
        'Interruptores globales para apagar una función al instante y despliegue por etapas también de lo generado.',
        'Regenerar el archivo con más frecuencia.',
        'Quitar los límites de tamaño del proxy.'
      ],
      answer: [0, 1, 2],
      explain: 'La configuración generada por una máquina es una entrada no confiable. Un error de datos no debería tumbar el proceso, y una función debería poder apagarse rápido. Regenerar más seguido o quitar límites solo habría propagado o empeorado el problema.'
    },
    {
      id: 'containers', type: 'single',
      prompt: 'Tu Worker necesita convertir video con FFmpeg. ¿Qué haces?',
      options: [
        'Compilas FFmpeg a JavaScript y lo corres dentro del Worker sin límites.',
        'Derivas el trabajo a un contenedor que el Worker pide por ID: arranca bajo demanda en unos segundos, se apaga tras un tiempo sin uso, y el Worker atiende lo liviano.',
        'Usas Workers KV para procesar el video.',
        'Mantienes un clúster de Kubernetes con réplicas fijas en cada PoP.'
      ],
      answer: 1,
      explain: 'Lo que no entra en un isolate (binarios nativos, más memoria) va a un contenedor, controlado desde el Worker. El costo es el arranque de segundos, así que el diseño natural es que el Worker responda rápido a lo que puede y derive solo lo que necesita.'
    },
    {
      id: 'do-quorum', type: 'single',
      prompt: 'Un Durable Object con almacenamiento SQLite confirma una escritura cuando...',
      options: [
        'La escribió en el disco de su máquina.',
        'Al menos tres de los cinco seguidores, en centros de datos distintos, confirmaron haber guardado el log de la transacción: un quórum.',
        'Todos los PoPs del mundo la recibieron.',
        'Pasó un segundo desde la escritura.'
      ],
      answer: 1,
      explain: 'Es el mismo principio de Raft (M06): con una mayoría que lo guardó, el dato sobrevive a la pérdida de una máquina o de un centro de datos. Las output gates impiden que alguien vea una respuesta antes de que la escritura sea durable.'
    },
    {
      id: 'aws-anycast', type: 'single',
      prompt: 'Quieres IPs anycast para tu clon en AWS sin operar BGP ni tener tu propio número de sistema autónomo. ¿Qué usas?',
      options: [
        'Route 53 con registros de latencia: son IPs anycast.',
        'Global Accelerator: dos IPs anycast estáticas que llevan al usuario por la red de AWS hasta el endpoint sano más cercano.',
        'Una Elastic IP por región.',
        'CloudFront con el origen en un solo servidor.'
      ],
      answer: 1,
      explain: 'Route 53 responde con la IP de una región (DNS, con TTL); una Elastic IP vive en una región. Global Accelerator anuncia sus IPs desde los bordes de AWS y hace el failover sin depender de TTL de DNS.'
    }
  ]
});
