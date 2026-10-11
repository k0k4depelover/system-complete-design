SD.defineQuiz('m34', {
  title: 'Quiz: operación y troubleshooting',
  pass: 0.7,
  questions: [
    {
      id: 'load',
      type: 'single',
      prompt: 'Un servidor de 4 núcleos marca load average 8.0, pero <code>top</code> dice 85&#8239;% idle y <code>wa</code> 60. ¿Qué está pasando?',
      options: [
        'La CPU está ociosa; el cuello es el disco y el load cuenta la espera de I/O',
        'Falta CPU, porque un load de 8 siempre significa que los núcleos están al tope',
        'Es una fuga de memoria, que es lo único capaz de disparar el load average así',
        'El load average se calculó mal y la solución es reiniciar el servidor'
      ],
      answer: 0,
      explain: 'El load average incluye los procesos en estado D (esperando disco), no solo la CPU. Con la CPU ociosa (85&#8239;% idle) y <code>wa</code> alto, el cuello es el I/O. Repasa 34.6.'
    },
    {
      id: 'journalctl',
      type: 'single',
      prompt: '¿Qué hace <code>journalctl -u mi-api -b</code>?',
      options: [
        'Muestra los logs de <code>mi-api</code> solo desde el último arranque del sistema',
        'Borra los logs de <code>mi-api</code> anteriores al último arranque para ahorrar disco',
        'Reinicia el servicio <code>mi-api</code> y luego abre sus logs en vivo',
        'Muestra los logs de todos los servicios, no solo los de <code>mi-api</code>'
      ],
      answer: 0,
      explain: '<code>-u</code> filtra por unidad y <code>-b</code> limita al boot actual. No borra ni reinicia nada; <code>journalctl</code> solo lee. Ver 34.2.'
    },
    {
      id: 'lvextend',
      type: 'single',
      prompt: 'Queda espacio libre en el VG y quieres dar 100&#8239;GB más a <code>lv_data</code> sin desmontar ni perder datos. ¿Qué haces?',
      options: [
        '<code>lvextend -r -L +100G /dev/vg0/lv_data</code>, que crece el LV y el FS a la vez',
        'Formatear una partición nueva y copiar los datos a mano con <code>rsync</code>',
        'Reducir <code>lv_root</code> en frío para pasarle a <code>lv_data</code> ese espacio',
        'Usar <code>fdisk</code> para crear una partición nueva más grande y migrar a ella todo el sistema'
      ],
      answer: 0,
      explain: 'El <code>-r</code> extiende el volumen lógico y redimensiona el sistema de archivos de encima en un solo paso, en caliente. Ver 34.3.'
    },
    {
      id: 'restore',
      type: 'single',
      prompt: '¿Por qué se dice que "un backup sin prueba de restauración no es un backup"?',
      options: [
        'Porque solo sabes que la copia sirve cuando la restauras y verificas los datos',
        'Porque los backups caducan solos si no se abren y se vuelven a escribir cada semana',
        'Porque sin restaurarlo ocupa el doble de espacio en el disco de destino',
        'Porque la regla 3-2-1 obliga a hacer exactamente tres restauraciones al mes'
      ],
      answer: 0,
      explain: 'Un backup que nunca restauraste es un archivo del que supones cosas. La restauración confirma que abre y cuadra, y mide tu RTO real. Ver 34.4.'
    },
    {
      id: 'metodo',
      type: 'multi',
      prompt: '¿Qué hábitos forman parte del método de diagnóstico? (elige todas)',
      options: [
        'Medir con la herramienta que confirma la hipótesis antes de tocar nada',
        'Cambiar una sola cosa a la vez y volver a medir para comprobar',
        'Reiniciar el servidor primero y esperar a ver si el problema vuelve',
        'Aplicar varios arreglos juntos para resolver cuanto antes el incidente'
      ],
      answer: [0, 1],
      explain: 'El método es síntoma, hipótesis, medición y arreglo, una cosa a la vez. Reiniciar a ciegas o cambiar varias juntas te deja sin saber cuál era la causa. Ver 34.5.'
    },
    {
      id: 'synsent',
      type: 'single',
      prompt: 'En <code>ss -tn</code> ves muchas conexiones en estado <code>SYN-SENT</code> hacia la base. ¿Qué sugiere?',
      options: [
        'El SYN sale y no vuelve respuesta: la red o el destino tienen un problema',
        'La base devuelve demasiados datos y está saturando el enlace de salida',
        'Hay un ataque de fuerza bruta en curso contra el puerto en el que escucha la base',
        'Son conexiones que se cerraron bien y están en su espera normal'
      ],
      answer: 0,
      explain: '<code>SYN-SENT</code> es "mandé el SYN y sigo esperando el ACK". Apunta a red, ruta o destino caído, no a exceso de datos ni a cierre normal. Ver 34.7.'
    },
    {
      id: 'strace',
      type: 'single',
      prompt: '¿Cuándo conviene usar <code>strace</code>?',
      options: [
        'Como lupa final sobre un proceso ya acotado, sabiendo que lo frena un poco',
        'Como primer comando en producción caliente, para verlo absolutamente todo',
        'Para medir el uso de CPU y de memoria de la máquina entera de un vistazo',
        'Siempre sobre la base de datos, que es donde más llamadas al sistema ocurren'
      ],
      answer: 0,
      explain: '<code>strace</code> intercepta cada syscall y frena el proceso; es la herramienta de último recurso, cuando top, vmstat, iostat y ss ya acotaron el problema. Ver 34.7.'
    },
    {
      id: 'oom',
      type: 'single',
      prompt: 'Un servicio "desaparece" de madrugada sin que nadie lo detenga. ¿Primera hipótesis y dónde la confirmas?',
      options: [
        'El OOM killer lo mató al agotarse la RAM; se ve en <code>journalctl -k</code>',
        'Alguien entró por SSH y lo paró a mano, así que revisas el log de acceso',
        'El disco se llenó y <code>systemd</code> desinstaló el servicio esa noche',
        'El load average subió y el kernel pausó el servicio hasta que bajara'
      ],
      answer: 0,
      explain: 'Un proceso que se va solo cuando la memoria aprieta es el patrón del OOM killer; deja "Out of memory: Killed process" en el log del kernel. systemd no desinstala nada ni el kernel "pausa" por load. Ver 34.6.'
    },
    {
      id: 'memorymax',
      type: 'single',
      prompt: '¿Para qué sirve <code>MemoryMax</code> en una unidad de <code>systemd</code>?',
      options: [
        'Para que, si el servicio se pasa, el kernel lo mate a él y no a un vecino',
        'Para reservarle de antemano esa memoria fija aunque el servicio no la use',
        'Para enviar un correo de aviso cuando el servicio consuma mucha memoria',
        'Para impedir que el servicio toque el swap bajo cualquier circunstancia'
      ],
      answer: 0,
      explain: 'Acota la memoria del servicio: si la supera, el kernel actúa sobre ese cgroup en vez de dejar que el OOM killer elija a cualquiera. No reserva memoria ni manda correos. Ver 34.2 y 34.6.'
    }
  ]
});
