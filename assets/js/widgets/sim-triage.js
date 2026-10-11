/* data-sim="triage" — lectura guiada de métricas de un servidor lento (M34).
   Cuatro casos; el lector elige el cuello de botella y el widget explica cómo
   se lee cada número. Sin animación, sin red. */
(function () {
  'use strict';

  var RESOURCES = [
    { id: 'cpu', label: 'CPU' },
    { id: 'mem', label: 'Memoria' },
    { id: 'disco', label: 'Disco' },
    { id: 'red', label: 'Red' }
  ];

  var CASES = [
    {
      label: 'Caso 1',
      sintoma: 'La API responde lenta. El load average es alto, pero la CPU se ve ociosa.',
      readings: [
        ['top', 'load average: 8.10, 7.90, 6.40   (4 núcleos)'],
        ['top', '%Cpu(s): 6.0 us, 3.1 sy, 0.0 ni, 30.4 id, 60.5 wa'],
        ['vmstat 1', 'r  b   si  so    bi     bo   us sy id wa'],
        ['vmstat 1', '1  6    0   0  2048  51200    6  3 30 61'],
        ['iostat -x 1', 'nvme0n1  %util 99.2  await 182.4ms  aqu-sz 7.1']
      ],
      answer: 'disco',
      tell: 'wa (I/O wait) = 60 %, %util del disco ≈ 100 % y await de 182 ms.',
      explain: 'El load alto con CPU ociosa (id 30 %, us+sy < 10 %) casi siempre es espera de disco: ' +
        'el load cuenta también los procesos en estado D (esperando I/O sin poder parar). Lo confirman wa 61 ' +
        'en vmstat, la columna b=6 (procesos bloqueados) y, sobre todo, iostat: %util 99 % y await de 182 ms ' +
        'dicen que el disco está saturado. La CPU no es el problema; buscar quién escribe tanto (logs, un backup, ' +
        'una consulta sin índice) con iotop o pidstat -d.'
    },
    {
      label: 'Caso 2',
      sintoma: 'Un endpoint de cálculo tarda. El ventilador suena y el servidor va caliente.',
      readings: [
        ['top', 'load average: 3.90, 3.80, 2.10   (4 núcleos)'],
        ['top', '%Cpu(s): 92.3 us, 5.1 sy, 0.0 ni, 2.4 id, 0.0 wa'],
        ['top', 'PID  %CPU  COMMAND'],
        ['top', '9123 388.0  python report.py'],
        ['vmstat 1', 'r  b   si  so   bi  bo   us sy id wa'],
        ['vmstat 1', '5  0    0   0    0  12   92  5  3  0']
      ],
      answer: 'cpu',
      tell: '%us = 92 %, wa = 0 % y un proceso al 388 % (usa casi los 4 núcleos).',
      explain: 'La CPU está al tope en espacio de usuario (us 92 %), nada de I/O wait (wa 0 %) y la cola de ' +
        'ejecutables r=5 supera a los 4 núcleos: hay más trabajo listo que CPU. El proceso report.py al 388 % ' +
        'confirma que el cuello es cómputo. Aquí se perfila el código, se reparte en más núcleos o se mueve a ' +
        'una máquina más grande; añadir disco o memoria no cambia nada.'
    },
    {
      label: 'Caso 3',
      sintoma: 'Un servicio "desaparece" cada noche sin que nadie lo pare, y todo se vuelve lento antes.',
      readings: [
        ['free -m', '             total    used    free   avail'],
        ['free -m', 'Mem:         7976     7720     101     118'],
        ['free -m', 'Swap:        2047     1980      67'],
        ['vmstat 1', 'r  b   si   so   bi  bo  us sy id wa'],
        ['vmstat 1', '2  1  420  880    0  60  18 20 55  7'],
        ['journalctl -k', 'Out of memory: Killed process 7420 (worker)']
      ],
      answer: 'mem',
      tell: 'avail ≈ 118 MB, swap casi lleno con si/so > 0 y un "Killed process" del kernel.',
      explain: 'La memoria disponible está al límite (avail 118 MB) y el swap casi lleno. Las columnas si/so de ' +
        'vmstat > 0 significan que el sistema está paginando a disco (swap in/out): de ahí la lentitud general. ' +
        'La línea "Out of memory: Killed process" es el OOM killer liberando memoria a la fuerza. La defensa es ' +
        'arreglar la fuga y poner un MemoryMax por servicio en la unidad de systemd; subir el swap solo tapa el ' +
        'síntoma y vuelve todo más lento.'
    },
    {
      label: 'Caso 4',
      sintoma: 'Las llamadas a un servicio externo dan timeout a ratos. CPU, memoria y disco se ven bien.',
      readings: [
        ['top', '%Cpu(s): 8.0 us, 2.0 sy, 89.0 id, 0.0 wa    mem avail: 4.2G'],
        ['ss -s', 'TCP: 812 (estab 90, closed 0, timewait 410), synsent 180'],
        ['ss -tn', 'State       Recv-Q Send-Q   Peer'],
        ['ss -tn', 'SYN-SENT    0      1        10.2.0.9:5432'],
        ['dig api.proveedor.com', ';; Query time: 2033 msec'],
        ['ping 10.2.0.9', '20 packets transmitted, 16 received, 20% packet loss']
      ],
      answer: 'red',
      tell: 'CPU 89 % idle y memoria sobrada, pero DNS a 2 s, 20 % de pérdida y conexiones en SYN-SENT.',
      explain: 'La máquina no está cargada (idle 89 %, 4.2 GB libres, wa 0 %): el problema está fuera. ss muestra ' +
        'muchas conexiones en SYN-SENT (el SYN salió y no vuelve el ACK) y una cola de timewait grande; ping da ' +
        '20 % de pérdida de paquetes y dig tarda 2 s en resolver. El cuello es la red o el DNS, no el servidor. ' +
        'Se revisa la ruta, el resolver y la salud del destino; retoma M11 para seguir la request entre servicios.'
    }
  ];

  function labelOf(id) {
    for (var i = 0; i < RESOURCES.length; i++) if (RESOURCES[i].id === id) return RESOURCES[i].label;
    return id;
  }

  function render(host) {
    host.classList.add('sim');
    var state = { c: 0, picked: null };

    var title = SD.h('div', { class: 'sim-head' }, [
      SD.h('span', { class: 'sim-title', text: 'Diagnóstico: ¿dónde está el cuello de botella?' })
    ]);

    var tabs = SD.h('div', { class: 'sim-controls', role: 'group', 'aria-label': 'Casos' });
    var sintoma = SD.h('p', { class: 'tr-sintoma' });
    var readingsBox = SD.h('div', { class: 'tr-readings', 'aria-label': 'Lo que muestran las herramientas' });
    var qLabel = SD.h('p', { class: 'tr-q', text: '¿Qué recurso es el cuello de botella?' });
    var answers = SD.h('div', { class: 'sim-controls', role: 'group', 'aria-label': 'Recursos' });
    var result = SD.h('div', { class: 'tr-result', 'aria-live': 'polite' });

    function paintTabs() {
      tabs.textContent = '';
      CASES.forEach(function (cs, i) {
        var b = SD.h('button', {
          class: 'chip-btn' + (i === state.c ? ' is-on' : ''),
          type: 'button', 'aria-pressed': i === state.c ? 'true' : 'false', text: cs.label
        });
        b.addEventListener('click', function () { state.c = i; state.picked = null; paint(); });
        tabs.appendChild(b);
      });
    }

    function paint() {
      var cs = CASES[state.c];
      paintTabs();
      sintoma.innerHTML = '<b>Síntoma.</b> ' + SD.escape(cs.sintoma);
      readingsBox.textContent = '';
      cs.readings.forEach(function (row) {
        readingsBox.appendChild(SD.h('div', { class: 'tr-row' }, [
          SD.h('span', { class: 'tr-tool', text: row[0] }),
          SD.h('code', { class: 'tr-line', text: row[1] })
        ]));
      });
      answers.textContent = '';
      RESOURCES.forEach(function (r) {
        var cls = 'chip-btn';
        if (state.picked) {
          if (r.id === cs.answer) cls += ' is-ok';
          else if (r.id === state.picked) cls += ' is-bad';
        }
        var b = SD.h('button', { class: cls, type: 'button', text: r.label });
        b.addEventListener('click', function () {
          if (state.picked) return;
          state.picked = r.id; paint();
        });
        answers.appendChild(b);
      });
      result.textContent = '';
      if (state.picked) {
        var ok = state.picked === cs.answer;
        result.appendChild(SD.h('p', { class: 'tr-verdict ' + (ok ? 'wv-ok' : 'wv-bad'),
          text: ok ? '✓ Correcto: ' + labelOf(cs.answer) : '✗ Era ' + labelOf(cs.answer) + ', no ' + labelOf(state.picked) }));
        result.appendChild(SD.h('p', { class: 'tr-tell' }, [SD.h('b', { text: 'La pista. ' }), cs.tell]));
        result.appendChild(SD.h('p', { text: cs.explain }));
      }
    }

    var body = SD.h('div', { class: 'sim-body' }, [tabs, sintoma, readingsBox, qLabel, answers, result]);
    host.appendChild(title);
    host.appendChild(body);
    host.appendChild(SD.h('p', { class: 'sim-foot',
      text: 'Los números son de ejemplo, elegidos para que cada caso tenga una sola lectura correcta.' }));
    paint();
  }

  SD.ready(function () {
    var nodes = document.querySelectorAll('[data-sim="triage"]');
    for (var i = 0; i < nodes.length; i++) render(nodes[i]);
  });
})();
