SD.defineQuiz('m32', {
  title: 'Quiz: firewalls a fondo',
  pass: 0.7,
  questions: [
    {
      id: 'sin-estado', type: 'single',
      prompt: 'Un filtro sin estado permite la entrada al puerto 443 y tiene política <code>drop</code> en la salida, sin más reglas. ¿Qué pasa cuando un navegador visita la web?',
      options: [
        'Funciona: la regla del 443 cubre la conexión completa en los dos sentidos, como en cualquier firewall.',
        'El SYN entra, pero la respuesta sale hacia el puerto efímero del navegador y se descarta.',
        'El SYN se descarta, porque un filtro sin estado no puede aceptar conexiones nuevas de afuera.',
        'Funciona solo con HTTP/3, porque UDP no necesita respuesta y el filtro sin estado no lo frena.'
      ],
      answer: 1,
      explain: 'Sin estado, cada paquete se evalúa aislado: la respuesta va del 443 a un puerto alto del cliente y ninguna regla de salida la permite. Con conntrack, una regla <code>ct state established,related accept</code> lo resuelve (32.2).'
    },
    {
      id: 'capas', type: 'single',
      prompt: 'Una inyección SQL llega en el cuerpo de un POST a tu API por HTTPS. ¿Qué capa puede verla?',
      options: [
        'El firewall del host, porque conntrack inspecciona cada paquete de la conexión ya establecida.',
        'La NACL de la subred, que evalúa en orden cada paquete que entra y que sale de la red.',
        'El WAF, donde termina TLS, y sobre todo la aplicación, que usa consultas parametrizadas.',
        'Ninguna: si el puerto 443 está permitido, todo lo que viaje por él llega intacto a la base.'
      ],
      answer: 2,
      explain: 'Un firewall de puertos ve IPs, puertos y estado, no el contenido, que además viaja cifrado. El WAF necesita la request en claro y vive donde termina TLS; la defensa definitiva está en la aplicación (32.1 y 32.8).'
    },
    {
      id: 'orden', type: 'single',
      prompt: 'La cadena <code>input</code> tiene, en este orden, <code>tcp dport 22 accept</code> y después <code>ip saddr 203.0.113.0/24 tcp dport 22 accept</code>. ¿Desde dónde se puede entrar por SSH?',
      options: [
        'Solo desde 203.0.113.0/24, porque la regla más específica tiene prioridad sobre la general.',
        'Desde ninguna parte: dos reglas para el mismo puerto se anulan y se aplica la política.',
        'Desde 203.0.113.0/24 por IPv4 y desde cualquier lugar por IPv6, porque la segunda es solo de IPv4.',
        'Desde cualquier IP: la primera regla coincide antes y la segunda nunca se evalúa.'
      ],
      answer: 3,
      explain: 'En nftables gana la primera regla con veredicto; no hay "más específica gana". Una regla amplia arriba anula a las de abajo sin aviso (32.3).'
    },
    {
      id: 'sg-nacl', type: 'single',
      prompt: 'Tu NACL permite la entrada TCP 443 y no tiene más reglas propias; el security group de la instancia también permite el 443. Los clientes no pueden cargar la web. ¿Por qué?',
      options: [
        'La NACL no tiene estado: falta una regla de salida hacia los puertos efímeros de los clientes.',
        'El security group no tiene estado: falta una regla de salida para la respuesta a los clientes.',
        'Las NACL evalúan todas las reglas y una de las reglas por defecto bloquea el 443 de entrada.',
        'Un security group y una NACL no pueden permitir el mismo puerto: el segundo anula al primero.'
      ],
      answer: 0,
      explain: 'El security group tiene estado y deja salir la respuesta sola; la NACL no, y su regla <code>*</code> final niega todo lo que no coincidió, incluida la respuesta. Hace falta permitir la salida de 1 024 a 65 535 (32.7).'
    },
    {
      id: 'egress', type: 'single',
      prompt: '¿Para qué sirve filtrar la salida de un servidor, si los ataques vienen de afuera?',
      options: [
        'Para ahorrar ancho de banda de salida, que en la nube es más caro que el de entrada.',
        'Para cortar lo que sigue a una intrusión: recibir órdenes, bajar herramientas y sacar datos.',
        'Para que el servidor no pueda contestar a los escaneos de puertos que llegan de internet.',
        'Para reemplazar al firewall de entrada, que deja de ser necesario si la salida está cerrada.'
      ],
      answer: 1,
      explain: 'Quien ejecuta código en un servidor necesita conectarse hacia afuera. Con la salida limitada a DNS de tu resolver, NTP y una lista de destinos, ese canal no existe y cada intento queda en el log (32.5).'
    },
    {
      id: 'docker', type: 'single',
      prompt: 'Con UFW en <code>deny incoming</code>, levantas <code>docker run -p 5432:5432 postgres</code> sin abrir el 5432 en UFW. ¿Qué pasa?',
      options: [
        'El puerto queda cerrado: UFW evalúa todo lo que entra antes de que Docker lo vea.',
        'El contenedor no arranca, porque Docker detecta que UFW bloquea el puerto publicado.',
        'Queda abierto a internet: Docker redirige el paquete en prerouting y va por forward, no por input.',
        'Queda abierto solo desde localhost, porque Docker publica por defecto en 127.0.0.1.'
      ],
      answer: 2,
      explain: 'Docker hace NAT hacia la IP del contenedor antes de la decisión de ruteo; el paquete ya no es para el host y nunca pasa por la cadena <code>input</code> de UFW. Docker publica por defecto en <code>0.0.0.0</code> y <code>[::]</code> (32.9).'
    },
    {
      id: 'ipv6', type: 'single',
      prompt: 'Las reglas de un servidor se escribieron con iptables y el servidor tiene una IPv6 pública. ¿Cuál es el riesgo?',
      options: [
        'Ninguno: iptables aplica las mismas reglas a IPv6 desde que el kernel usa nftables por debajo.',
        'Que los servicios queden cerrados por IPv6, porque ip6tables empieza con política drop.',
        'Que IPv6 sea más lento, porque cada paquete pasa dos veces por las reglas de IPv4 y de IPv6.',
        'Que todo esté abierto por IPv6: ip6tables es otra tabla, con otras reglas, y empieza vacía.'
      ],
      answer: 3,
      explain: 'iptables solo filtra IPv4. La familia <code>inet</code> de nftables, <code>IPV6=yes</code> en UFW y las reglas con <code>::/0</code> en la nube cierran el hueco; y se prueba contra las dos direcciones (32.9).'
    },
    {
      id: 'icmp', type: 'single',
      prompt: 'Para "endurecer" un servidor, alguien descarta todo el ICMP y el ICMPv6. ¿Qué es lo más probable que se rompa?',
      options: [
        'Las conexiones con paquetes grandes se cuelgan y, en IPv6, deja de funcionar la red.',
        'Nada importante: ICMP solo sirve para el ping y es mejor que nadie lo use desde afuera.',
        'Solo el ping, porque los errores de red llegan por TCP dentro de cada conexión abierta.',
        'Solo el DNS, que usa ICMP para descubrir el resolver más cercano de la red.'
      ],
      answer: 0,
      explain: 'Sin los mensajes de "paquete demasiado grande" se rompe la detección de MTU, y en IPv6 el descubrimiento de vecinos va por ICMPv6. Se permite el ICMP de error; si molesta el ping, se limita su tasa (32.3).'
    },
    {
      id: 'segmentar', type: 'single',
      prompt: '¿Qué regla del security group de la base expresa mejor la microsegmentación?',
      options: [
        'TCP 5432 desde el rango de toda la VPC, que solo contiene servidores de la empresa.',
        'TCP 5432 desde las IPs actuales de los dos servidores de aplicación, una por una.',
        'TCP 5432 desde <code>sg-app</code>, el security group de los servidores de la aplicación.',
        'Todo el tráfico desde la subred de aplicaciones, para no romper herramientas internas.'
      ],
      answer: 2,
      explain: 'La regla por identidad sigue siendo correcta cuando el autoscaling agrega o reemplaza instancias, y no deja entrar a nada que no sea la aplicación. El rango de la VPC es una red plana con otro nombre (32.6 y 32.7).'
    },
    {
      id: 'deteccion', type: 'single',
      prompt: 'Un atacante ya ejecuta código en un servidor y tu firewall de entrada no registró nada raro. ¿Qué señal tiene más probabilidad de delatarlo?',
      options: [
        'Conexiones de salida a un destino nuevo, repetidas a intervalos regulares, aunque parezcan HTTPS.',
        'El firewall de entrada, que registra el paquete con el que el atacante entró y lo marca como sospechoso de forma automática.',
        'El WAF, que vuelve a inspeccionar cada respuesta que el servidor manda de vuelta hacia los clientes.',
        'La NACL de la subred, que niega los puertos efímeros de la respuesta que sale hacia los clientes.'
      ],
      answer: 0,
      explain: 'Quien ya está dentro casi siempre necesita hablar hacia afuera para recibir órdenes y sacar datos, y suele hacerlo a intervalos regulares (beaconing) dentro de tráfico permitido. El registro de salida es el detector más barato y delator; el firewall de entrada ya no ve este tramo (32.5 y 32.10).'
    }
  ]
});
