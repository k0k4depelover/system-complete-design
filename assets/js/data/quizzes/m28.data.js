SD.defineQuiz('m28', {
  title: 'Quiz: Cloudflare',
  pass: 0.7,
  questions: [
    {
      id: 'withdraw', type: 'single',
      prompt: 'El PoP de Lisboa deja de anunciar el prefijo anycast. ¿Qué pasa con sus usuarios?',
      options: [
        'Quedan sin servicio hasta que Lisboa vuelva a anunciar el prefijo.',
        'Sus paquetes llegan al siguiente PoP más cercano según BGP, con la misma IP.',
        'El DNS de Cloudflare les devuelve la IP de otro PoP en la próxima consulta.',
        'Sus paquetes se reparten entre todos los PoPs de Europa en partes iguales, según su carga.'
      ],
      answer: 1,
      explain: 'Con anycast, salir de un PoP es retirar su anuncio. No hay DNS que cambiar ni TTL que esperar: la red converge en segundos hacia la siguiente ruta.'
    },
    {
      id: 'anycast-ddos', type: 'single',
      prompt: '¿Por qué anycast ayuda contra un ataque DDoS de una botnet repartida por el mundo?',
      options: [
        'Porque oculta la IP real del origen detrás de la del PoP.',
        'Porque cada parte del ataque llega al PoP de su región y ninguno lo recibe entero.',
        'Porque los routers bloquean las IPs de los atacantes antes de anunciar la ruta.',
        'Porque todo el ataque se concentra en un PoP y los demás quedan libres.'
      ],
      answer: 1,
      explain: 'Contra un solo datacenter, un ataque de varios Tbps satura sus enlaces. Repartido entre cientos de PoPs, cada uno recibe una fracción que puede filtrar.'
    },
    {
      id: 'xdp', type: 'single',
      prompt: '¿Por qué conviene descartar los paquetes de ataque con XDP, en el driver de red?',
      options: [
        'Porque XDP descarta el paquete en el switch, antes de que llegue al servidor.',
        'Porque descarta el paquete antes de que el kernel le dedique memoria o CPU.',
        'Porque XDP corre en otro servidor y así el ataque no consume CPU local.',
        'Porque XDP reconoce el ataque por la firma TLS y lo bloquea sin descifrar.'
      ],
      answer: 1,
      explain: 'Cuanto antes se descarta un paquete, menos cuesta. Con descarte en el driver, un mismo servidor puede filtrar millones de paquetes por segundo y seguir sirviendo requests.'
    },
    {
      id: 'syn', type: 'single',
      prompt: '¿Qué resuelven las SYN cookies en un SYN flood?',
      options: [
        'Identifican al atacante por su IP de origen y la bloquean.',
        'Permiten responder a cada SYN sin guardar estado hasta que termine el handshake.',
        'Guardan cada SYN en una cookie del navegador para no usar memoria del lado del servidor.',
        'Limitan cuántos SYN por segundo acepta cada IP de origen.'
      ],
      answer: 1,
      explain: 'El SYN flood busca llenar la tabla de conexiones a medio abrir. Con las SYN cookies, el estado viaja codificado en la respuesta y solo se reconstruye si el cliente contesta.'
    },
    {
      id: 'tiered', type: 'single',
      prompt: '¿Qué gana un sitio al activar la caché por niveles?',
      options: [
        'Nada: cada PoP ya cachea lo que pide su región, y los niveles solo agregan saltos de latencia.',
        'Que los PoPs piden a unos pocos PoPs superiores y el origen recibe muchas menos requests.',
        'Que cada PoP guarda una copia completa del sitio y nunca pide al origen.',
        'Que el TTL de cada objeto se alarga en proporción a cuántos PoPs lo piden.'
      ],
      answer: 1,
      explain: 'Sin niveles, cada uno de cientos de PoPs que no tiene un objeto lo pide al origen. Con niveles, esos pedidos se juntan arriba.'
    },
    {
      id: 'isolates', type: 'single',
      prompt: '¿Por qué los Workers corren en isolates de V8 y no en contenedores?',
      options: [
        'Porque los contenedores no aíslan bien el código de clientes distintos.',
        'Porque un isolate arranca en milisegundos y caben miles por máquina.',
        'Porque los isolates no tienen límites de CPU y cada Worker usa lo que necesita.',
        'Porque así el código puede ser de cualquier lenguaje sin compilar.'
      ],
      answer: 1,
      explain: 'Un contenedor tarda cientos de milisegundos o más en arrancar en frío y ocupa mucha más memoria. El precio de los isolates es correr en ese entorno, JavaScript o WebAssembly, con límites por request.'
    },
    {
      id: 'contador', type: 'single',
      prompt: 'Necesitas un contador global de "me gusta" exacto, actualizado desde todo el mundo. ¿Qué usas?',
      options: [
        'Workers KV, que replica cada escritura en todos los PoPs.',
        'Un Durable Object por publicación, que procesa los incrementos en orden.',
        'La caché de cada PoP, con un Worker que suma los contadores de todos.',
        'Una variable global del Worker, que comparten todas sus instancias del mundo.'
      ],
      answer: 1,
      explain: 'KV es eventual: dos escrituras concurrentes desde lugares distintos pierden incrementos. Un objeto por publicación reparte la carga; uno solo para todas las publicaciones sería un cuello de botella.'
    },
    {
      id: 'kv', type: 'single',
      prompt: 'Cambias un feature flag en Workers KV. ¿Cuándo lo ven todos los PoPs?',
      options: [
        'Al instante en todo el mundo, porque KV replica cada escritura de forma sincrónica.',
        'Puede tardar un minuto o más: la consistencia es eventual.',
        'Nunca, hasta que se reinicien los Workers que ya lo tienen en memoria.',
        'Solo en el PoP donde se escribió, hasta que otro PoP lo pida al origen.'
      ],
      answer: 1,
      explain: 'Para un flag, un minuto de diferencia suele ser aceptable. Para algo que debe cortarse al instante, como una API key robada, hace falta otro mecanismo.'
    },
    {
      id: 'config', type: 'multi',
      prompt: 'La configuración llega a todos los servidores del mundo en segundos. ¿Qué medidas evitan que un error llegue a todos a la vez?',
      options: [
        'Validar el costo de cada regla antes de publicarla.',
        'Desplegar por etapas, con rollback automático.',
        'Tener un interruptor para apagar una función al instante.',
        'Publicar los cambios solo de noche, cuando el tráfico mundial es más bajo.',
        'Desactivar los health checks durante el cambio, para que no saquen servidores de rotación.'
      ],
      answer: [0, 1, 2],
      explain: 'Es lo que se aprendió de la caída de julio de 2019: una regla con una expresión regular de backtracking catastrófico llegó a todo el mundo en segundos. Publicar de noche no reduce el radio de impacto.'
    },
    {
      id: 'tunnel', type: 'single',
      prompt: '¿Qué logra conectar el origen con Cloudflare Tunnel?',
      options: [
        'Que el tráfico entre el borde y el origen viaje cifrado.',
        'Que el origen funcione sin IP pública ni puertos abiertos.',
        'Que el origen se replique en todos los PoPs y responda desde el más cercano.',
        'Que no haga falta TLS entre el usuario y el borde, porque el túnel ya cifra.'
      ],
      answer: 1,
      explain: 'Si la IP del origen se filtra, un atacante puede ir directo contra él. Con un túnel saliente, el origen no acepta conexiones de nadie.'
    },
    {
      id: 'unimog', type: 'single',
      prompt: 'Un servidor del PoP sale de rotación. ¿Cómo evita Unimog cortar sus conexiones abiertas?',
      options: [
        'No lo evita: las conexiones se cortan y los clientes reconectan.',
        'Lo pasa a la segunda ranura de sus buckets: solo le llegan sus conexiones abiertas.',
        'Copia el estado de cada conexión a otro servidor antes de sacarlo.',
        'El router deja de mandarle paquetes y el PoP entero sale de rotación un rato.'
      ],
      answer: 1,
      explain: 'Cada bucket guarda el servidor actual y el anterior. El primer salto atiende los SYN y las conexiones que tiene; si no tiene el socket, pasa el paquete al segundo. Así se drena un servidor sin mover estado.'
    },
    {
      id: 'k8s-workers', type: 'single',
      prompt: '¿Qué diferencia hay entre desplegar un Deployment de Kubernetes con 6 réplicas y desplegar un Worker?',
      options: [
        'Ninguna de fondo: un Worker es un pod que Cloudflare escala solo según el tráfico.',
        'En Kubernetes eliges las réplicas; un Worker está en todos los servidores de todos los PoPs.',
        'Los Workers corren solo en una región elegida por el cliente, como un Deployment.',
        'Los Workers usan una máquina virtual por cliente, con 6 réplicas por defecto.'
      ],
      answer: 1,
      explain: 'La decisión de dónde corre el código, que en Kubernetes toma el scheduler al desplegar, en Workers la toma anycast request por request. A cambio, el código corre en un isolate con límites de memoria y CPU, sin estado local.'
    },
    {
      id: 'cold-start', type: 'single',
      prompt: '¿Cómo evitan los Workers que el arranque en frío se note?',
      options: [
        'Mantienen todos los Workers cargados siempre en todos los servidores.',
        'Empiezan a cargar el Worker con el primer mensaje del handshake TLS.',
        'Cachean las respuestas del Worker en el navegador del usuario por unos minutos.',
        'Reservan CPU para cada Worker aunque no reciba tráfico.'
      ],
      answer: 1,
      explain: 'El isolate se prepara mientras el handshake termina, escondido detrás de un viaje de ida y vuelta que igual había que hacer. Cuando los Workers crecieron y perdían esa carrera, se sumó el reenvío al servidor de casa con hashing consistente, que cuesta menos de 1 ms.'
    },
    {
      id: 'nov2025', type: 'multi',
      prompt: 'El 18 de noviembre de 2025, un archivo generado automáticamente (características de bots) duplicó su tamaño, superó un límite del proxy y provocó errores 5xx. ¿Qué medidas evitarían algo parecido en tu sistema?',
      options: [
        'Validar los archivos generados antes de distribuirlos, igual que una entrada de usuario.',
        'Que un módulo que no puede leer su configuración siga con la última buena.',
        'Interruptores globales para apagar una función y despliegue por etapas.',
        'Regenerar el archivo con más frecuencia, para que un error dure menos minutos.',
        'Quitar los límites de tamaño del proxy, que fueron los que causaron los 5xx.'
      ],
      answer: [0, 1, 2],
      explain: 'La configuración generada por una máquina es una entrada no confiable. Un error de datos no debería tumbar el proceso, y una función debería poder apagarse rápido. Regenerar más seguido o quitar límites solo habría propagado o empeorado el problema.'
    },
    {
      id: 'containers', type: 'single',
      prompt: 'Tu Worker necesita convertir video con FFmpeg. ¿Qué haces?',
      options: [
        'Compilas FFmpeg a WebAssembly y lo corres dentro del Worker, con el plan de más CPU por request.',
        'Derivas el trabajo a un contenedor que el Worker pide por ID y arranca bajo demanda.',
        'Partes el video en trozos y cada Worker convierte uno en paralelo.',
        'Mantienes un clúster de Kubernetes con réplicas fijas en cada PoP.'
      ],
      answer: 1,
      explain: 'Lo que no entra en un isolate (binarios nativos, más memoria) va a un contenedor, controlado desde el Worker. El costo es el arranque de segundos, así que el diseño natural es que el Worker responda rápido a lo que puede y derive solo lo que necesita.'
    },
    {
      id: 'do-quorum', type: 'single',
      prompt: 'Un Durable Object con almacenamiento SQLite confirma una escritura cuando...',
      options: [
        'La escribió en el disco de su máquina, con fsync.',
        'Al menos tres de cinco seguidores en otros centros de datos guardaron el log.',
        'Todos los PoPs del mundo la recibieron y la aplicaron a su copia local.',
        'Su réplica en el PoP más cercano al usuario confirmó la escritura.'
      ],
      answer: 1,
      explain: 'Es el mismo principio de Raft (M06): con una mayoría que lo guardó, el dato sobrevive a la pérdida de una máquina o de un centro de datos. Las output gates impiden que alguien vea una respuesta antes de que la escritura sea durable.'
    },
    {
      id: 'aws-anycast', type: 'single',
      prompt: 'Quieres IPs anycast para tu clon en AWS sin operar BGP ni tener tu propio número de sistema autónomo. ¿Qué usas?',
      options: [
        'Route 53 con registros de latencia, que devuelven IPs anycast distintas por región.',
        'Global Accelerator: dos IPs anycast estáticas hacia el endpoint sano más cercano.',
        'Una Elastic IP por región, que AWS anuncia desde todas sus zonas.',
        'Un Network Load Balancer en cada región con la misma IP elástica.'
      ],
      answer: 1,
      explain: 'Route 53 responde con la IP de una región (DNS, con TTL); una Elastic IP vive en una región. Global Accelerator anuncia sus IPs desde los bordes de AWS y hace el failover sin depender de TTL de DNS.'
    }
  ]
});
