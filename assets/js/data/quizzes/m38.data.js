SD.defineQuiz('m38', {
  title: 'Quiz: Active Directory, ataque y defensa',
  pass: 0.7,
  questions: [
    {
      id: 'krbtgt',
      type: 'single',
      prompt: '¿Por qué la cuenta <code>krbtgt</code> es tan crítica?',
      options: [
        'Es la cuenta del administrador del dominio, con la que se hacen todas las tareas de gestión diaria',
        'Su clave firma todos los TGT del dominio, así que quien la tenga fabrica tickets válidos',
        'Guarda una copia en texto plano de las contraseñas de todos los usuarios para poder validarlas',
        'Es la cuenta que corre el servicio de replicación entre los distintos controladores de dominio'
      ],
      answer: 1,
      explain: 'La clave de krbtgt cifra y firma cada TGT. Si se filtra, el atacante crea Golden Tickets indistinguibles de los legítimos. Nadie inicia sesión con ella; por eso el DC es tier 0 y tras un compromiso se rota dos veces. Ver 38.2.'
    },
    {
      id: 'tiering',
      type: 'single',
      prompt: '¿Cuál es la regla central del modelo de niveles (tiering)?',
      options: [
        'Cada nivel debe tener al menos un controlador de dominio propio para repartir la carga',
        'Los usuarios de tier 2 no pueden iniciar sesión en los servidores de tier 1 bajo ningún concepto',
        'Una credencial de un nivel alto nunca se expone en una máquina de un nivel más bajo',
        'Todas las cuentas privilegiadas se concentran en un único grupo para auditarlas mejor'
      ],
      answer: 2,
      explain: 'El tiering evita de raíz que una credencial potente quede en una máquina poco protegida, que es de lo que vive casi todo ataque de 38.3. Se administra de arriba hacia abajo, pero la credencial de tier 0 jamás baja. Ver 38.4.'
    },
    {
      id: 'dcsync',
      type: 'single',
      prompt: 'En los logs ves el evento 4662 con los GUID de replicación, pero generado desde una máquina que no es un controlador de dominio. ¿Qué sugiere?',
      options: [
        'Un controlador de dominio recién instalado que se une al dominio y empieza a replicar toda la base de datos desde los demás',
        'Una tarea de copia de seguridad del DC que lee la base de datos durante la noche',
        'DCSync: una cuenta con permiso de replicación pide los secretos haciéndose pasar por un DC',
        'Un error de reloj que hace que un cliente repita su autenticación varias veces seguidas'
      ],
      answer: 2,
      explain: 'Solo los DC deberían pedir replicación. Ese evento desde una no-DC es la firma de DCSync. La defensa es auditar quién tiene esos permisos de replicación y por qué. Ver 38.3 y 38.6.'
    },
    {
      id: 'kerberoast',
      type: 'single',
      prompt: '¿Qué corta de raíz el Kerberoasting?',
      options: [
        'Bloquear el puerto 88 de Kerberos en el firewall para que nadie pida tickets de servicio',
        'Usar gMSA y forzar AES, porque desaparece la contraseña débil que se adivina fuera de línea',
        'Desactivar la preautenticación de Kerberos en todas las cuentas de servicio del dominio',
        'Obligar a que los tickets de servicio caduquen cada cinco minutos en vez de cada diez horas'
      ],
      answer: 1,
      explain: 'El Kerberoasting adivina fuera de línea la contraseña de una cuenta de servicio a partir de un ticket en RC4. Con gMSA la contraseña la gestiona AD (larga y aleatoria) y con AES se va la señal. Desactivar la preautenticación habilita otro ataque (AS-REP roasting), no lo arregla. Ver 38.3 y 38.5.'
    },
    {
      id: 'pth',
      type: 'multi',
      prompt: 'El robo de credenciales (pass-the-hash y variantes) se apoya en que NTLM acepta el hash y en que un admin deja material en una máquina comprometida. ¿Qué controles lo mitigan? (varias)',
      options: [
        'LAPS, para que cada máquina tenga una contraseña de administrador local única',
        'Protected Users y Credential Guard, para que esas credenciales no queden robables en memoria',
        'Subir el tamaño de la papelera de reciclaje de AD para guardar más objetos borrados',
        'Tiering, para que un admin potente nunca inicie sesión en una estación de bajo nivel'
      ],
      answer: [0, 1, 3],
      explain: 'LAPS evita la contraseña local compartida; Protected Users y Credential Guard protegen la credencial en memoria; el tiering impide que una credencial potente llegue a una máquina expuesta. La papelera de AD ayuda a recuperar objetos, no frena el robo de credenciales. Ver 38.5.'
    },
    {
      id: 'rotar',
      type: 'single',
      prompt: '¿Por qué se rota la clave de <code>krbtgt</code> dos veces (y no una) tras un compromiso del dominio?',
      options: [
        'Porque AD exige dos cambios seguidos antes de aceptar una contraseña nueva en esa cuenta',
        'Porque la primera rotación sirve para probar el procedimiento en un entorno aislado y la segunda lo aplica ya sobre el dominio en producción',
        'Porque se guardan la clave actual y la anterior; dos rotaciones invalidan los tickets ya emitidos',
        'Porque cada controlador de dominio necesita su propia clave de krbtgt independiente de los demás'
      ],
      answer: 2,
      explain: 'Kerberos acepta la clave actual y la inmediatamente anterior para no romper los tickets en vuelo. Una sola rotación dejaría válidos los Golden Tickets con la clave previa; dos rotaciones (esperando la replicación entre ambas) los invalidan sin tirar el dominio. Ver 38.8.'
    },
    {
      id: 'honeytoken',
      type: 'single',
      prompt: '¿Para qué sirve una cuenta señuelo (honeytoken) en AD?',
      options: [
        'Para repartir la carga de autenticación entre varias cuentas de servicio idénticas',
        'Para dar acceso temporal a un proveedor externo sin crearle una cuenta real en el dominio',
        'Es una cuenta jugosa que nadie usa; cualquier intento de abusarla es, por definición, una alerta',
        'Para guardar de forma cifrada las contraseñas de emergencia de los administradores del dominio'
      ],
      answer: 2,
      explain: 'La señuelo (un falso admin con SPN, por ejemplo) no la usa nadie legítimo, así que no genera falsos positivos: cualquier intento de pedir su ticket es malicioso y produce una alerta limpia. Ver 38.6.'
    },
    {
      id: 'entra',
      type: 'single',
      prompt: 'En un AD híbrido sincronizado con Entra ID mediante Entra Connect, ¿cómo se clasifica el servidor de Entra Connect?',
      options: [
        'Tier 2, porque es un servidor de borde que mira hacia internet y hacia los usuarios',
        'Tier 0, porque tiene credenciales potentes en los dos mundos y une la nube con el dominio',
        'Tier 1, como cualquier otro servidor de aplicaciones que no toca el plano de control',
        'Fuera del modelo de niveles, porque vive en la nube y no en el dominio local'
      ],
      answer: 1,
      explain: 'Entra Connect maneja la sincronización con credenciales fuertes a ambos lados: comprometerlo alcanza los dos directorios. Es tier 0 aunque no sea un DC, y se protege con el mismo celo. Ver 38.7.'
    },
    {
      id: 'relay',
      type: 'single',
      prompt: '¿Qué corta el relay de NTLM?',
      options: [
        'Alargar la contraseña de todas las cuentas de usuario a un mínimo de dieciséis caracteres',
        'La firma SMB y LDAP, porque un mensaje reenviado ya no lleva la firma que el servidor espera',
        'Cerrar el puerto 445 en todas las estaciones de trabajo del dominio para bloquear SMB',
        'Activar la auditoría avanzada para registrar cada autenticación NTLM que ocurre en la red'
      ],
      answer: 1,
      explain: 'El relay reenvía una autenticación NTLM a un servidor que no verifica el origen. La firma (y el channel binding) ata el mensaje a su sesión, así que el reenviado se rechaza. Auditar NTLM ayuda a verlo, pero no lo corta. Desde Windows 11 24H2 y Server 2025 la firma SMB es obligatoria por defecto. Ver 38.5.'
    },
    {
      id: 'orden',
      type: 'order',
      prompt: 'Ordena los intercambios de Kerberos, del primero al último:',
      items: [
        'El usuario prueba quién es y recibe un TGT (cifrado con la clave de krbtgt)',
        'El usuario presenta el TGT y pide un ticket para un servicio concreto',
        'El usuario presenta el ticket de servicio y el servicio lo valida sin llamar al DC'
      ],
      explain: 'AS (autenticación, entrega el TGT), TGS (entrega el ticket de servicio) y AP (el usuario lo presenta al servicio, que valida solo). Ver la lámina 38.A en 38.2.'
    }
  ]
});
