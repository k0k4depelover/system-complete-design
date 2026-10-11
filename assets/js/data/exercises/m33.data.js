/* Ejercicio guiado del M33 (hardening de Linux). Formato en core/exercise.js. */

SD.defineExercise('m33-hardening', {
  title: 'endurecer un VPS recién creado',
  scenario: '<p>Acabas de crear un VPS con Ubuntu Server y una IP pública, <code>203.0.113.10</code>. Va a correr una API en Java en el puerto 8080, con nginx delante en el 443, un PostgreSQL y un Redis en la misma máquina. Tu equipo administra desde la oficina (<code>203.0.113.0/24</code>). Por ahora entras como <code>root</code> con la contraseña que te mandó el proveedor por correo. Decide, paso a paso, cómo dejarlo listo para producción.</p>',
  steps: [
    {
      id: 'orden', type: 'order',
      prompt: 'Ordena los primeros pasos, del primero al último.',
      items: [
        'Actualizar todos los paquetes y activar las actualizaciones automáticas de seguridad',
        'Crear tu usuario con sudo y copiarle tu clave pública',
        'Comprobar desde otra terminal que entras con la clave',
        'Desactivar contraseñas y root en SSH, con sshd -t y una sesión abierta',
        'Activar el firewall con drop de entrada, SSH desde la oficina y 80 y 443',
        'Instalar los servicios, cada uno en localhost y con su usuario',
        'Tomar la base de AIDE y guardarla fuera del servidor'
      ],
      explain: 'Primero se cierra lo que atacan los bots (software viejo y contraseñas). La clave se prueba antes de apagar las contraseñas, para no quedarte afuera. AIDE va al final: una foto tomada antes de instalar los servicios se llenaría de cambios legítimos (33.2, 33.4, 33.8 y 33.11).'
    },
    {
      id: 'ssh', type: 'single',
      prompt: 'Escribes <code>PasswordAuthentication no</code> al final de <code>/etc/ssh/sshd_config</code> y recargas, pero el servidor sigue aceptando contraseñas. ¿Qué miras primero?',
      options: [
        'Que el cambio se aplicó: <code>sshd -T</code> y los archivos de <code>sshd_config.d/</code>, que se leen antes.',
        'El firewall, porque UFW puede reescribir las opciones de autenticación de SSH al recargar.',
        'PAM, porque <code>pam_faillock</code> reactiva las contraseñas cuando hay intentos fallidos.',
        'La clave del servidor, porque las de tipo RSA obligan a aceptar contraseñas como respaldo.'
      ],
      answer: 0,
      explain: 'En sshd vale el primer valor leído. Los archivos de <code>sshd_config.d/</code> se incluyen al principio, y algunas imágenes de nube traen uno que activa las contraseñas. <code>sshd -T</code> muestra lo que quedó en efecto (33.2).'
    },
    {
      id: 'redis', type: 'single',
      prompt: '<code>ss -tulpen</code> muestra <code>redis-server</code> en <code>0.0.0.0:6379</code>. El firewall bloquea el 6379. ¿Qué haces?',
      options: [
        'Nada: con el firewall bloqueando el puerto, cambiar la configuración de Redis no aporta más seguridad.',
        'Cambiar Redis a otro puerto alto, para que los escaneos automáticos no lo encuentren.',
        'Atarlo a <code>127.0.0.1</code> y <code>::1</code>, con <code>protected-mode</code> y contraseña o ACL.',
        'Agregar una regla de Fail2Ban para Redis, que bloquee a quien intente conectarse sin permiso.'
      ],
      answer: 2,
      explain: 'Es la idea de 33.10: cada servicio tiene que ser seguro aunque el firewall falle. Una regla mal puesta, una IPv6 sin filtrar o un cambio de Docker bastan para exponerlo. Cambiar de puerto no protege: un escaneo lo encuentra igual.'
    },
    {
      id: 'api', type: 'single',
      prompt: 'La API escucha en <code>*:8080</code> y nginx le hace de proxy desde el 443. ¿Cómo queda?',
      options: [
        'Abrir el 8080 en el firewall también, para que los clientes puedan elegir con o sin nginx.',
        'Que la API escuche en <code>127.0.0.1:8080</code>; solo nginx llega a ella.',
        'Dejarla en <code>*:8080</code>: el firewall con drop de entrada ya la protege por IPv4 y por IPv6.',
        'Pasar la API al puerto 443 y quitar nginx, para tener un servicio menos expuesto.'
      ],
      answer: 1,
      explain: 'Si el único cliente es nginx en la misma máquina, no hay motivo para escuchar en todas las interfaces. Así nadie salta los límites de tasa, el TLS ni los encabezados que pone nginx, aunque el firewall falle (33.10).'
    },
    {
      id: 'contener', type: 'multi',
      prompt: 'Una vulnerabilidad en la API permite ejecutar comandos como el usuario del servicio. ¿Qué medidas acotan el daño? Marca todas las que correspondan.',
      options: [
        'La unidad de systemd con <code>ProtectSystem=strict</code>, <code>ProtectHome=yes</code> y <code>NoNewPrivileges=yes</code>.',
        'La salida filtrada: el servidor solo puede conectarse a los destinos de la lista.',
        'Que SSH solo acepte claves y tenga <code>AllowGroups</code> configurado para el equipo.',
        'Un usuario propio para la API, sin shell y sin sudo.',
        'La contraseña de GRUB, que evita que se modifique la línea de arranque del kernel.'
      ],
      answer: [0, 1, 3],
      explain: 'El atacante ya está adentro por la aplicación, no por SSH ni por la consola. Lo que lo frena es lo que acota a ese proceso: su usuario, el sandbox y la salida cerrada, que le impide recibir órdenes y sacar datos (33.7 y 32.5).'
    },
    {
      id: 'aide', type: 'single',
      prompt: 'Una noche, el reporte de AIDE dice <code>changed: /root/.ssh/authorized_keys</code>. Nadie del equipo tocó ese archivo. ¿Qué haces?',
      options: [
        'Correr <code>aide --update</code> para aceptar el cambio y que el reporte de mañana venga limpio.',
        'Borrar la clave nueva, cambiar la contraseña de root y seguir operando con normalidad.',
        'Correr rkhunter: si no encuentra un rootkit, el cambio es seguro y se puede aceptar.',
        'Tratarlo como incidente: aislar sin apagar, guardar evidencia, rotar credenciales y reconstruir.'
      ],
      answer: 3,
      explain: 'Una clave que nadie agregó es la huella típica de un intruso que se quiere quedar. No se sabe qué más cambió, así que el servidor no se limpia: se reemplaza desde la imagen base, después de guardar evidencia y rotar todo lo que conocía (33.10).'
    }
  ],
  solution: '<ul>' +
    '<li><b>Orden:</b> parches y actualizaciones automáticas; tu usuario con sudo y clave ed25519 probada desde otra terminal; SSH sin contraseñas ni root, con <code>AllowGroups</code>, comprobado con <code>sshd -t</code> y <code>sshd -T</code>; firewall con política <code>drop</code> (SSH desde 203.0.113.0/24, 80 y 443, IPv6 incluido) y la salida filtrada.</li>' +
    '<li><b>Servicios:</b> PostgreSQL con <code>listen_addresses = \'localhost\'</code>, Redis con <code>bind 127.0.0.1 ::1</code>, <code>protected-mode yes</code> y ACL, la API en <code>127.0.0.1:8080</code>. Cada uno con su usuario sin shell y una unidad de systemd con sandbox.</li>' +
    '<li><b>Contención:</b> AppArmor activo (viene con Ubuntu), perfiles en <code>enforce</code> para nginx; la API sin acceso a <code>/home</code> ni escritura fuera de su directorio.</li>' +
    '<li><b>Detección:</b> logs enviados fuera del servidor con alertas para logins, sudo y cambios de cuentas; Fail2Ban o CrowdSec para el login de la API; AIDE con la base guardada fuera, tomada después de instalar todo; Lynis una vez al mes.</li>' +
    '<li><b>Respuesta:</b> un plan escrito para aislar, conservar evidencia, rotar credenciales y reconstruir desde la imagen base.</li>' +
    '</ul>'
});
