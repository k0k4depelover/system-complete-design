SD.defineExercise('m34-servidor-lento', {
  title: 'diagnosticar un servidor lento, paso a paso',
  scenario: '<p>Tu API de facturas empezó a dar <em>timeouts</em> a las 02:10. Los clientes se quejan y tienes acceso por SSH. ' +
    'No sabes la causa todavía. Sigue el método —síntoma, hipótesis, medición, arreglo— y una cosa a la vez. ' +
    'Cada decisión te da lo que verías en la pantalla antes de la siguiente.</p>',
  steps: [
    {
      id: 'empezar',
      type: 'single',
      prompt: 'Entras por SSH. ¿Cuál es el primer paso?',
      options: [
        'Mirar <code>uptime</code>, <code>top</code> y <code>df -h</code> para ubicar el recurso afectado antes de tocar nada',
        'Reiniciar el servidor de inmediato, que así se arreglan la mayoría de los problemas',
        'Subir el <code>swap</code> por si acaso fuera un problema de memoria del sistema',
        'Reiniciar la API varias veces hasta que alguna vez vuelva a responder bien'
      ],
      answer: 0,
      explain: 'Primero se ubica el recurso con una mirada general (load, CPU, disco), sin cambiar nada. Reiniciar a ciegas borra la evidencia y puede que no arregle la causa.'
    },
    {
      id: 'leer-top',
      type: 'single',
      prompt: '<code>uptime</code> da load 9.0 en 4 núcleos; <code>top</code> muestra <code>%Cpu: 5 us, 3 sy, 22 id, 70 wa</code>. ¿Qué recurso sospechas?',
      options: [
        'El disco: el <code>wa</code> de 70 con la CPU casi ociosa es espera de I/O, no falta de CPU',
        'La CPU, porque un load de 9 siempre quiere decir que los núcleos están saturados',
        'La red, porque el load average sube cuando hay muchas conexiones entrantes',
        'La memoria, ya que el load alto es el primer síntoma de una fuga de memoria'
      ],
      answer: 0,
      explain: 'El load incluye los procesos esperando disco (estado D). Con <code>wa</code> 70 y la CPU ociosa, la hipótesis es I/O. Ahora toca confirmarlo.'
    },
    {
      id: 'confirmar',
      type: 'single',
      prompt: 'Para confirmar la hipótesis de disco, ¿qué mides?',
      options: [
        '<code>iostat -x 1</code> y <code>df -h</code>: la saturación del disco y el espacio libre que queda',
        '<code>strace</code> sobre todos los procesos del sistema a la vez, para no perder nada',
        '<code>ss -s</code>, porque el resumen de conexiones revela cualquier cuello del servidor',
        '<code>free -m</code>, que es el único comando que confirma un problema de disco real'
      ],
      answer: 0,
      explain: '<code>iostat</code> da <code>%util</code> y <code>await</code> del disco; <code>df</code> comprueba si además está lleno. <code>ss</code> y <code>free</code> miran otros recursos; <code>strace</code> global solo haría más daño.'
    },
    {
      id: 'causa',
      type: 'single',
      prompt: '<code>iostat</code> da <code>%util</code> 99 y <code>await</code> 210&#8239;ms; <code>df -h</code> muestra <code>/</code> al 100&#8239;%. ¿Cómo encuentras al culpable?',
      options: [
        '<code>du -sh /var/* | sort -h</code> para ver qué carpeta creció; sospechas <code>/var/log</code>',
        'Borrar archivos al azar en <code>/</code> hasta que <code>df</code> baje del 100&#8239;%',
        'Formatear <code>/</code> y restaurar el sistema entero desde el último backup completo',
        'Ampliar el disco con <code>lvextend</code> sin mirar antes qué fue lo que lo llenó'
      ],
      answer: 0,
      explain: '<code>du</code> ordena las carpetas por tamaño y señala la que se desbordó (casi siempre logs). Primero entiendes la causa; ampliar o borrar a ciegas repite el problema.'
    },
    {
      id: 'mitigar',
      type: 'single',
      prompt: 'Es <code>/var/log</code>, lleno por un servicio que loguea en bucle. Para devolver espacio <em>ya</em>, ¿qué haces?',
      options: [
        'Rotar y comprimir los logs, y vaciar el archivo activo con <code>truncate</code> o <code>logrotate</code>',
        'Borrar con <code>rm</code> el archivo que el servicio tiene abierto, que libera al instante',
        'Apagar la API de facturas hasta que alguien revise los logs con calma por la mañana',
        'Mover <code>/var/log</code> a otra partición en caliente mientras el servicio escribe'
      ],
      answer: 0,
      explain: 'Borrar con <code>rm</code> un archivo que un proceso tiene abierto no libera el espacio hasta que el proceso cierra o reinicia (el inode sigue vivo). Rotar o <code>truncate</code> sí lo liberan sin cortar el servicio.'
    },
    {
      id: 'fondo',
      type: 'multi',
      prompt: 'Espacio recuperado y la API responde. ¿Qué cierras para que no vuelva a pasar? (elige todas)',
      options: [
        'Configurar rotación de logs y un tope de tamaño en <code>journald</code> (<code>SystemMaxUse</code>)',
        'Poner una alerta de disco al 80&#8239;% para enterarte antes del 100&#8239;%',
        'Dejar un <code>cron</code> que reinicie el servidor cada noche por si acaso',
        'Subir el límite de <code>df</code> para que no avise cuando el disco se llene'
      ],
      answer: [0, 1],
      explain: 'La rotación y el tope atacan la causa; la alerta temprana te da margen. Reiniciar cada noche esconde el problema y silenciar la alerta es apagar el único aviso que tenías. Escribe además el runbook "disco lleno" para la próxima.'
    }
  ],
  solution: '<p>El método, aplicado: <b>síntoma</b> (timeouts desde las 02:10), <b>hipótesis</b> (I/O, por el <code>wa</code> alto con CPU ociosa), ' +
    '<b>medición</b> (<code>iostat</code> con <code>%util</code> 99 y <code>df</code> al 100&#8239;%), <b>causa</b> (<code>/var/log</code> ' +
    'desbordado por un servicio en bucle), <b>mitigación</b> (rotar y <code>truncate</code>, nunca <code>rm</code> sobre un archivo abierto) ' +
    'y <b>arreglo de fondo</b> (rotación, <code>SystemMaxUse</code>, alerta al 80&#8239;% y un runbook).</p>' +
    '<p>Lo que no se hace: reiniciar a ciegas, borrar al azar, ampliar el disco sin entender la causa o silenciar la alerta. ' +
    'Y se cambia una cosa a la vez, verificando con <code>df</code> y <code>iostat</code> tras cada paso.</p>'
});
