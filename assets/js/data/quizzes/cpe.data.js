/* Checkpoint E: examen integrador de la Parte IV (M32 a M38). Cada explicación dice qué módulo repasar.
   Todo defensivo: patrón vulnerable y su arreglo, detección y respuesta; nada de procedimiento ofensivo. */
SD.defineQuiz('cpe', {
  title: 'Examen del Checkpoint E',
  pass: 0.7,
  questions: [
    {
      id: 'conntrack', type: 'single',
      prompt: 'Un firewall <b>con estado</b> (stateful) se diferencia de uno sin estado en que:',
      options: [
        'Cifra el tráfico que deja pasar, mientras que el sin estado lo deja en claro',
        'Recuerda las conexiones ya aceptadas y deja volver sus respuestas sin una regla explícita',
        'Solo filtra por dirección IP, mientras que el sin estado también mira los puertos de origen'
      ],
      answer: 1,
      explain: 'Con conntrack, la respuesta de una conexión establecida vuelve sin abrir el puerto a mano; el sin estado necesita una regla para cada sentido. Ninguno de los dos cifra. Repasa M32.'
    },
    {
      id: 'egress', type: 'single',
      prompt: '¿Por qué filtrar también el tráfico de <b>salida</b> (egress), si el peligro parece venir de fuera?',
      options: [
        'Para ahorrar ancho de banda cerrando las descargas más grandes de los usuarios internos en horas de oficina',
        'Porque es obligatorio para cumplir con el estándar PCI-DSS en cualquier red corporativa',
        'Porque si una máquina ya está comprometida, el egress acotado le impide llamar a casa y sacar datos'
      ],
      answer: 2,
      explain: 'El egress limitado convierte la salida en el mejor detector de una brecha: el malware necesita contactar su C2 o exfiltrar, y una regla de salida estrecha lo delata o lo frena. Repasa M32 (#entrada-salida).'
    },
    {
      id: 'sgnacl', type: 'single',
      prompt: 'En AWS, un <b>security group</b> y una <b>NACL</b> se diferencian en que:',
      options: [
        'El security group tiene estado y va por recurso; la NACL no tiene estado y va por subred',
        'El security group va por subred; la NACL va por recurso y además cifra el tráfico entre ellos',
        'El security group solo permite reglas de entrada; la NACL solo permite reglas de salida'
      ],
      answer: 0,
      explain: 'El SG recuerda la conexión (stateful) y se aplica a la interfaz del recurso; la NACL es sin estado y filtra en el borde de la subred, así que necesita reglas de ida y de vuelta. Repasa M32 (#nube).'
    },
    {
      id: 'ssh', type: 'single',
      prompt: 'El primer paso para endurecer SSH en un servidor expuesto es:',
      options: [
        'Cambiar el puerto 22 por uno alto, que es lo que de verdad frena los ataques automáticos',
        'Autenticar con claves y desactivar el login de root y por contraseña en <code>sshd_config</code>',
        'Instalar Fail2Ban, que por sí solo basta para bloquear cualquier intento de acceso no deseado'
      ],
      answer: 1,
      explain: 'Las claves quitan el adivinado de contraseñas y desactivar root por contraseña cierra el blanco preferido de los bots. Cambiar el puerto solo reduce ruido; Fail2Ban ayuda, pero es complementario. Repasa M33 (#ssh).'
    },
    {
      id: 'mac', type: 'single',
      prompt: 'AppArmor y SELinux aportan una capa de defensa que los permisos clásicos de Unix no dan:',
      options: [
        'Cifran el sistema de archivos para que un disco robado no se pueda leer si alguien lo conecta en otra máquina distinta',
        'Acotan qué puede hacer cada proceso aunque corra como root, por una política obligatoria',
        'Reemplazan al firewall filtrando las conexiones de red de cada aplicación del sistema'
      ],
      answer: 1,
      explain: 'El control de acceso obligatorio (MAC) confina cada programa a lo que su política permite, así que un servicio comprometido no puede salirse de su caja aunque sea root. No cifran ni filtran red. Repasa M33 (#mac).'
    },
    {
      id: 'assumebreach', type: 'multi',
      prompt: 'Asumes que el perímetro ya cayó y el atacante está dentro de la red. ¿Qué sigue protegiendo al servidor por sí mismo? (varias)',
      options: [
        'El inventario de lo que está expuesto, con <code>ss -tulpen</code>, para cerrar lo que no hace falta',
        'El mínimo privilegio y el MAC, que acotan el daño de un servicio comprometido',
        'Confiar en que la IP de origen es interna y por eso saltarse la autenticación entre servicios',
        'La detección: logs centralizados y alertas por conexiones de salida inesperadas'
      ],
      answer: [0, 1, 3],
      explain: 'Asumir la brecha significa inventariar la exposición, acotar privilegios y vigilar la salida; justamente lo contrario es confiar en la IP interna, que es el error que el zero trust elimina. Repasa M33 (#sin-firewall) y M37 (#zero-trust).'
    },
    {
      id: 'triage', type: 'single',
      prompt: 'Un servidor va lento. <code>top</code> muestra un load average alto pero poca CPU de usuario, y <code>iostat</code> marca el disco al 100&#8239;% de utilización. El cuello de botella es:',
      options: [
        'La CPU, porque el load average alto siempre significa que faltan núcleos para el trabajo',
        'La red, porque el disco lleno obliga a bajar los datos otra vez desde otros servidores',
        'El disco (I/O): el load incluye los procesos en espera de disco, y la utilización lo confirma'
      ],
      answer: 2,
      explain: 'El load average cuenta también los procesos bloqueados en espera de I/O, no solo los que piden CPU; con el disco al 100&#8239;%, el cuello es I/O. El método es síntoma-hipótesis-medición. Repasa M34 (#troubleshooting).'
    },
    {
      id: 'backups', type: 'single',
      prompt: 'La regla de backups 3-2-1 y el par RPO/RTO sirven para:',
      options: [
        'Garantizar que ninguna copia de seguridad se pueda cifrar nunca por un ransomware que haya entrado a la red corporativa',
        'Tener copias que sobrevivan a un desastre y saber cuántos datos y cuánto tiempo puedes perder',
        'Acelerar las consultas de la base replicando los datos en tres servidores distintos'
      ],
      answer: 1,
      explain: '3-2-1 (tres copias, dos medios, una fuera) asegura que una copia sobreviva; RPO es cuántos datos aceptas perder y RTO cuánto tardas en volver. Una copia fuera de línea es la que salva ante ransomware. Repasa M34 (#backups).'
    },
    {
      id: 'leastpriv', type: 'single',
      prompt: 'El rol con el que tu aplicación se conecta a la base de datos debería:',
      options: [
        'Ser superusuario, para que ningún cambio futuro del esquema rompa la aplicación en producción',
        'Tener solo los permisos que usa de verdad (leer y escribir sus tablas), nada de DDL ni otras tablas',
        'Compartirse entre todos los microservicios, para simplificar la rotación de credenciales'
      ],
      answer: 1,
      explain: 'El mínimo privilegio acota el daño de una inyección o una credencial filtrada: si el rol no puede borrar tablas ni leer las de otro tenant, el atacante tampoco. Repasa M35 (#rbac).'
    },
    {
      id: 'auditlog', type: 'single',
      prompt: 'Una tabla de bitácora (audit log) de la base de datos debe ser <b>append-only</b> porque:',
      options: [
        'Así ocupa menos espacio en disco al no permitir actualizar las filas ya escritas',
        'Si se pudiera modificar o borrar, un atacante con acceso borraría la evidencia de lo que hizo',
        'PostgreSQL solo permite triggers de auditoría sobre tablas que nunca se actualizan después de su creación inicial'
      ],
      answer: 1,
      explain: 'Una bitácora que se puede editar no sirve de evidencia: lo primero que hace un intruso es borrar su rastro. Solo-añadir (y, mejor, fuera de la base) la protege. Repasa M35 (#bitacora).'
    },
    {
      id: 'tde', type: 'single',
      prompt: 'Sobre el cifrado en reposo de una base PostgreSQL, lo honesto es decir que:',
      options: [
        'PostgreSQL cifra todas las columnas por defecto desde la versión 12, sin configurar nada',
        'De base no trae TDE; se cifra el volumen, o columnas concretas con pgcrypto, con su coste',
        'El cifrado en reposo protege los datos incluso de un usuario con el rol correcto de la base'
      ],
      answer: 1,
      explain: 'PostgreSQL no trae cifrado transparente de serie: se cifra el disco (protege ante robo físico) o columnas con pgcrypto (y pierdes indexar bien). Ninguno protege de una consulta autorizada. Repasa M35 (#cifrado-datos).'
    },
    {
      id: 'hmac', type: 'single',
      prompt: '¿Por qué se usa HMAC y no un <code>hash(clave + mensaje)</code> hecho a mano para autenticar un mensaje?',
      options: [
        'Porque HMAC es bastante más rápido de calcular que una sola pasada de la función hash sobre el mensaje completo de entrada',
        'Porque la construcción casera es vulnerable a extensión de longitud; HMAC está diseñado para evitarlo',
        'Porque HMAC además cifra el mensaje, mientras que el hash casero lo deja legible'
      ],
      answer: 1,
      explain: 'Con hashes tipo Merkle-Damgård, pegar la clave delante permite un ataque de extensión de longitud; HMAC (dos pasadas con padding) lo cierra. No cifra ni es más rápido. Repasa M36 (#hmac).'
    },
    {
      id: 'nonce', type: 'single',
      prompt: 'En un cifrado autenticado (AEAD) como AES-GCM, repetir el <b>nonce</b> con la misma clave es grave porque:',
      options: [
        'Hace que el cifrado tarde el doble, al tener que reprocesar el bloque repetido dos veces',
        'Rompe la confidencialidad y la autenticación de esos mensajes; el nonce debe ser único por clave',
        'Obliga a volver a pedir el certificado TLS al servidor antes de seguir cifrando'
      ],
      answer: 1,
      explain: 'Reusar el nonce con la misma clave filtra relación entre los textos y puede permitir falsificar; por eso el nonce es único por clave (contador o aleatorio con margen). Repasa M36 (#simetrico).'
    },
    {
      id: 'pwstore', type: 'single',
      prompt: 'La forma correcta de guardar contraseñas de usuarios es:',
      options: [
        'Cifrarlas con AES y guardar la clave en la misma base, para poder recuperarlas y enviárselas al usuario si alguna vez las olvida',
        'Un hash lento y con sal por usuario (Argon2id, bcrypt o scrypt), pensado para resistir el adivinado',
        'Un hash rápido como SHA-256, que al ser irreversible ya es suficiente para protegerlas'
      ],
      answer: 1,
      explain: 'Se guarda un hash de contraseña lento y salado (Argon2id), no cifrado (reversible) ni un hash rápido (se fuerza en masa). La sal evita las tablas precalculadas. Repasa M36 (#contrasenas).'
    },
    {
      id: 'iam', type: 'single',
      prompt: 'Una política de IAM con <code>"Action": "*"</code> y <code>"Resource": "*"</code> es peligrosa porque:',
      options: [
        'Concede todo sobre todo; si esa credencial se filtra, el atacante hace cualquier cosa en la cuenta',
        'Hace que las llamadas a la API sean más lentas, al tener que evaluar muchos más permisos en cada petición que llega',
        'Solo funciona con llaves de acceso de larga duración y nunca con roles temporales'
      ],
      answer: 0,
      explain: 'El comodín es lo contrario del mínimo privilegio: una sola credencial filtrada se vuelve acceso total. Se conceden acciones y recursos concretos, y un deny explícito siempre gana. Repasa M37 (#iam).'
    },
    {
      id: 'mtls', type: 'single',
      prompt: 'Entre dos microservicios se usa mTLS (TLS mutuo) porque:',
      options: [
        'Estar en la misma red privada ya garantiza por sí solo que quien llama es un servicio interno de confianza',
        'La red no autentica: cada servicio prueba su identidad con un certificado, y así nadie suplanta a otro',
        'Es más rápido que TLS normal al no tener que validar el certificado del servidor'
      ],
      answer: 1,
      explain: 'En zero trust, la confianza no viene de la red sino de la identidad probada: con mTLS cada extremo presenta su certificado (SPIFFE/SPIRE lo automatiza). Estar "dentro" no basta. Repasa M37 (#mtls) y (#zero-trust).'
    },
    {
      id: 'imds', type: 'single',
      prompt: 'El salto de IMDSv1 a IMDSv2 en la metadata de una instancia (169.254.169.254) importa porque:',
      options: [
        'IMDSv2 cifra las credenciales temporales que entrega la instancia, y IMDSv1 las daba en claro',
        'IMDSv2 exige un token por sesión, lo que corta que una petición de tipo SSRF robe las credenciales del rol',
        'IMDSv2 permite políticas con comodín, mientras que IMDSv1 obligaba a listar cada recurso'
      ],
      answer: 1,
      explain: 'IMDSv2 obliga a pedir un token antes de leer la metadata, lo que frena que una petición forzada contra el endpoint (como en el caso Capital One) saque las credenciales del rol. La defensa en profundidad suma el mínimo privilegio. Repasa M37 (#incidentes).'
    },
    {
      id: 'krbtgt', type: 'single',
      prompt: 'En Active Directory, la cuenta <code>krbtgt</code> es crítica porque:',
      options: [
        'Es la cuenta de servicio de la base de datos del dominio y guarda el audit log de Kerberos',
        'Su clave firma todos los TGT; con ella se fabrican tickets válidos (Golden Ticket)',
        'Es la única cuenta que puede iniciar sesión en todos los equipos del dominio a la vez'
      ],
      answer: 1,
      explain: 'La clave de krbtgt firma cada TGT del dominio; quien la roba crea tickets indistinguibles de los legítimos. Por eso el DC es tier 0 y, tras un compromiso, se rota dos veces. Repasa M38 (#kerberos) y (#recuperar).'
    },
    {
      id: 'tiering', type: 'single',
      prompt: 'La regla central del modelo de niveles (tiering) de Active Directory es:',
      options: [
        'Repartir los controladores de dominio entre los tres niveles para equilibrar la carga',
        'Una credencial de un nivel alto nunca se expone en una máquina de un nivel más bajo',
        'Que todas las cuentas de administración vivan en un único grupo fácil de auditar'
      ],
      answer: 1,
      explain: 'El tiering impide que una credencial potente (tier 0) quede en una estación expuesta (tier 2), que es de lo que vive casi todo ataque de AD; se apoya en cuentas separadas y PAW. Repasa M38 (#tiering).'
    },
    {
      id: 'respuesta', type: 'order',
      prompt: 'Confirmas un compromiso que llegó hasta el dominio. Ordena la respuesta, del primer paso al último:',
      items: [
        'Contener y aislar lo comprometido, siguiendo el runbook preparado de antemano',
        'Rotar las credenciales que pudieron verse (incluida <code>krbtgt</code>, dos veces)',
        'Reconstruir desde backups fuera de línea y cerrar el camino que usó el atacante',
        'Escribir el postmortem sin culpables y convertir lo aprendido en controles nuevos'
      ],
      explain: 'Contener, rotar lo expuesto, reconstruir desde copias que el atacante no pudo tocar y cerrar con el postmortem que mejora la defensa. Cruza M38 (#recuperar), M37 (#incidentes) y M11.'
    }
  ]
});
