SD.defineQuiz('m33', {
  title: 'Quiz: hardening de servidores Linux',
  pass: 0.7,
  questions: [
    {
      id: 'amenaza', type: 'single',
      prompt: '¿Quién ataca, en la gran mayoría de los casos, a un VPS recién creado con IP pública?',
      options: [
        'Programas que recorren internet probando contraseñas, servicios expuestos y fallas conocidas.',
        'Nadie, hasta que el dominio aparece en un buscador y alguien lo elige como objetivo concreto.',
        'Solo el proveedor de la nube, que escanea sus propias IPs para avisarte de lo que está abierto.',
        'Atacantes dirigidos que estudian tu empresa durante semanas antes de intentar entrar.'
      ],
      answer: 0,
      explain: 'Los bots atacan lo masivo, desde el primer minuto: contraseñas débiles, servicios de más y software sin parchar. Por eso esas tres cosas se cierran primero (33.1).'
    },
    {
      id: 'claves', type: 'single',
      prompt: '¿Por qué SSH con claves resiste a los bots mejor que con contraseñas fuertes y Fail2Ban?',
      options: [
        'Porque la clave cifra la sesión con un algoritmo más fuerte que el que se usa con contraseña.',
        'Porque el bot no tiene nada que adivinar: la clave privada nunca viaja y no se puede probar.',
        'Porque con claves SSH cambia de puerto solo y los bots no encuentran el servicio.',
        'Porque Fail2Ban no puede leer los logs de SSH cuando se usan contraseñas largas.'
      ],
      answer: 1,
      explain: 'Con claves, el servidor pide una firma que solo produce quien tiene la privada; con <code>PasswordAuthentication no</code> ni siquiera ofrece el método de contraseña. Fail2Ban limita por IP, y el siguiente bot llega desde otra (33.2).'
    },
    {
      id: 'primer-valor', type: 'single',
      prompt: 'Pusiste <code>PasswordAuthentication no</code> en <code>sshd_config</code> y sigue aceptando contraseñas. ¿Qué comando te dice lo que sshd aplica de verdad?',
      options: [
        '<code>sshd -t</code>, que valida la sintaxis y recarga la configuración nueva sin cortar sesiones.',
        '<code>systemctl status ssh</code>, que lista cada opción activa del servicio en el estado.',
        '<code>sshd -T</code>, que imprime la configuración efectiva, ya combinada con <code>sshd_config.d/</code>.',
        '<code>ss -tulpen</code>, que muestra con qué métodos de autenticación escucha cada puerto.'
      ],
      answer: 2,
      explain: 'En sshd vale el primer valor leído, y los archivos de <code>sshd_config.d/</code> se incluyen antes. <code>-t</code> solo valida la sintaxis; <code>-T</code> muestra el resultado final (33.2).'
    },
    {
      id: 'reinicio', type: 'single',
      prompt: '<code>unattended-upgrades</code> instaló un OpenSSL corregido, y nadie reinició nada. ¿Está protegido el servidor?',
      options: [
        'Sí: el paquete reemplaza la librería en disco y los procesos la toman en la siguiente request.',
        'Sí, porque unattended-upgrades reinicia el servidor después de cada parche de seguridad.',
        'Solo si además se reinstala el kernel, porque OpenSSL corre dentro del espacio del kernel.',
        'No del todo: los procesos que ya corrían siguen con la librería vieja hasta reiniciarse.'
      ],
      answer: 3,
      explain: 'Un proceso carga la librería al arrancar. Hay que reiniciar los servicios afectados (<code>needrestart</code>), programar reinicios o reemplazar el servidor. Por defecto, Ubuntu no reinicia solo (33.4).'
    },
    {
      id: 'mac', type: 'single',
      prompt: 'Un servicio en RHEL falla con "permission denied" aunque los permisos del archivo son correctos. ¿Qué haces?',
      options: [
        'Leer el rechazo de SELinux y corregir la etiqueta o activar el booleano que corresponde.',
        'Pasar SELinux a <code>permissive</code> en forma permanente, porque es la causa del error.',
        'Dar permisos <code>777</code> al archivo, porque SELinux respeta los permisos más abiertos.',
        'Correr el servicio como root, para que SELinux no le aplique la política del sistema.'
      ],
      answer: 0,
      explain: '<code>ausearch -m avc</code> muestra qué bloqueó SELinux; casi siempre se resuelve con <code>restorecon</code> o <code>setsebool</code>. Apagarlo quita la capa que contiene a un servicio comprometido (33.7).'
    },
    {
      id: 'aide-base', type: 'single',
      prompt: '¿Por qué la base de datos de AIDE se guarda fuera del servidor?',
      options: [
        'Porque ocupa demasiado espacio para guardarla en el mismo disco que los archivos que vigila.',
        'Porque un intruso con root podría modificarla para que sus cambios no aparezcan en el reporte.',
        'Porque AIDE solo puede comparar archivos contra una base que esté en otro servidor de la red.',
        'Porque la licencia de AIDE exige guardar las bases en un sistema de backup certificado.'
      ],
      answer: 1,
      explain: 'Si la foto buena vive en el disco que el atacante controla, la puede reemplazar por una que incluya sus cambios. Por la misma razón, los logs se mandan a otro sistema (33.8).'
    },
    {
      id: 'localhost', type: 'single',
      prompt: '<code>ss -tulpen</code> muestra <code>postgres</code> en <code>127.0.0.1:5432</code> y <code>redis-server</code> en <code>0.0.0.0:6379</code>. ¿Cuál queda expuesto si el firewall falla?',
      options: [
        'Los dos, porque cualquier puerto que escucha es alcanzable desde internet sin el firewall.',
        'Ninguno, porque los dos usan puertos que los proveedores de nube bloquean por defecto.',
        'Redis, que escucha en todas las interfaces; PostgreSQL solo se alcanza desde la máquina.',
        'PostgreSQL, porque 127.0.0.1 es la dirección pública que el proveedor asigna al servidor.'
      ],
      answer: 2,
      explain: '<code>127.0.0.1</code> y <code>[::1]</code> solo se alcanzan desde la propia máquina; <code>0.0.0.0</code>, <code>[::]</code> y <code>*</code> escuchan en todas. Redis se ata con <code>bind 127.0.0.1 ::1</code> y <code>protected-mode</code> (33.10).'
    },
    {
      id: 'sysctl', type: 'single',
      prompt: 'Copias una lista de sysctl "endurecidos" que incluye <code>net.ipv4.ip_forward = 0</code> en un host con Docker. ¿Qué pasa?',
      options: [
        'Nada visible: Docker usa su propia pila de red y no depende de ese valor del kernel.',
        'Mejora la seguridad sin efectos, porque Docker publica los puertos con NAT y no con ruteo.',
        'El host deja de aceptar conexiones por SSH, porque ese valor también controla la entrada.',
        'Los contenedores pierden la red, porque el host necesita rutear su tráfico.'
      ],
      answer: 3,
      explain: 'Docker activa el forwarding porque el tráfico de los contenedores pasa por la cadena <code>forward</code> del host (M32). Cada línea de sysctl se aplica entendiendo qué rompe (33.9).'
    },
    {
      id: 'incidente', type: 'single',
      prompt: 'Confirmas que alguien obtuvo root en un servidor. ¿Cuál es la respuesta correcta?',
      options: [
        'Correr rkhunter y ClamAV, borrar lo que encuentren y seguir operando el mismo servidor.',
        'Aislarlo sin apagarlo, guardar evidencia, rotar sus credenciales y reconstruir desde la imagen.',
        'Apagarlo de inmediato, para cortar al atacante, y volver a encenderlo con otra IP pública.',
        'Restaurar el último backup del disco sobre el mismo servidor y cambiar la contraseña de root.'
      ],
      answer: 1,
      explain: 'Apagar pierde la evidencia en memoria; limpiar no garantiza nada, porque no se sabe todo lo que cambió. Se rota todo lo que el servidor conocía y se reemplaza, con la falla de entrada corregida (33.10).'
    }
  ]
});
