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
    }
  ]
});
