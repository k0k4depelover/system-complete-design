/* Ejercicios guiados del M22 (operar modelos en producción): cinco incidentes. Formato en core/exercise.js. */

SD.defineExercise('m22-corto', {
  title: 'la versión nueva responde más corto y el juez dice que mejoró',
  scenario: '<p>La versión FP8 con el prompt v41 está en el escalón del 5&#8239;% del canary. Las respuestas son un 22&#8239;% más cortas que las de la estable. El juez, que compara pares sobre una muestra, la prefiere en el 54&#8239;% de los casos. Las regeneraciones subieron de 8.0 a 8.4&#8239;%, sin significancia todavía. El equipo de producto quiere avanzar al 25&#8239;%.</p>',
  steps: [
    {
      id: 'largo', type: 'single',
      prompt: 'Un 22&#8239;% menos de largo, ¿es una falla?',
      options: [
        'Sí: cualquier cambio de más del 10&#8239;% en el largo obliga a volver atrás.',
        'No necesariamente, pero pasa el umbral de 15&#8239;% y obliga a mirar.',
        'No: las respuestas cortas son más baratas y los usuarios las prefieren.',
        'Solo si además suben la latencia o la tasa de errores del canary.'
      ],
      answer: 1,
      explain: 'El largo no dice si el cambio es bueno o malo; dice que hubo un cambio real. Por eso su criterio es "detener y mirar", no "volver atrás".'
    },
    {
      id: 'origen', type: 'single',
      prompt: 'El cambio tocó dos piezas: los pesos y el prompt del sistema. ¿Cómo averiguas cuál acortó las respuestas?',
      options: [
        'Mirando el canary con más atención, separando el tráfico por categoría.',
        'Con el eval offline, cruzando pesos y prompts viejos y nuevos.',
        'Preguntándole al juez cuál de las dos piezas explica mejor las respuestas cortas.',
        'No se puede saber sin revertir los dos y volver a desplegarlos de a uno.'
      ],
      answer: 1,
      explain: 'Separar las dos piezas en el eval cuesta minutos y responde la pregunta. Juntar dos cambios en una versión ahorra un canary, a cambio de esta ambigüedad.'
    },
    {
      id: 'juez', type: 'single',
      prompt: 'El juez prefiere las respuestas más cortas en el 54&#8239;% de los pares. ¿Qué tan confiable es eso?',
      options: [
        'Muy confiable: el juez coincide con personas más del 80&#8239;% de las veces.',
        'Hay que revisar los dos órdenes, cuántos pares hay y la rúbrica.',
        'No sirve: los jueces nunca evalúan bien el largo, porque prefieren lo corto.',
        'Basta con que sea más del 50&#8239;% para decir que las cortas son mejores.'
      ],
      answer: 1,
      explain: 'Un 54&#8239;% sobre pocos pares puede ser ruido, y un juez con sesgo de posición puede dar cualquier número. La calibración contra personas es la que dice cuánto creerle.'
    },
    {
      id: 'senal', type: 'single',
      prompt: 'Las regeneraciones subieron de 8.0 a 8.4&#8239;% sin significancia. ¿Qué se hace con esa señal?',
      options: [
        'Ignorarla: no es significativa, así que no hay diferencia real.',
        'Ver si el escalón tiene muestra para detectarla; si no, alargarlo.',
        'Volver atrás: cualquier subida de regeneraciones es una regresión.',
        'Pasar al 100&#8239;% para juntar más datos y decidir con toda la muestra.'
      ],
      answer: 1,
      explain: 'Ver 0.4 puntos sobre una base del 8&#8239;% necesita decenas de miles de requests por brazo. Ausencia de evidencia no es evidencia de ausencia.'
    },
    {
      id: 'decision', type: 'single',
      prompt: '¿Qué decides?',
      options: [
        'Avanzar al 25&#8239;% como pide producto, y vigilar las regeneraciones ahí.',
        'Quedarse en el 5&#8239;% hasta tener muestra, mientras el eval separa las piezas.',
        'Volver atrás y descartar la versión, porque el largo pasó el umbral.',
        'Pasar directo a un A/B de seis semanas con el 50&#8239;% del tráfico.'
      ],
      answer: 1,
      explain: 'Ninguna señal dice "falla", y dos dicen "no sabemos". Quedarse en el escalón cuesta horas; avanzar expone a cinco veces más usuarios a una posible regresión.'
    }
  ],
  solution: '<ul><li>El largo es una señal de cambio, no de calidad: obliga a detenerse y mirar.</li><li>El eval offline separa las dos piezas del cambio: pesos y prompt por separado.</li><li>El juez se lee con su calibración y con los dos órdenes; un 54&#8239;% sobre pocos pares no decide nada.</li><li>Una diferencia sin significancia en un escalón chico no es una diferencia nula: se alarga el escalón.</li><li>Decisión: quedarse en el 5&#8239;% hasta tener respuestas a las tres preguntas.</li></ul>'
});

SD.defineExercise('m22-regenera', {
  title: 'los usuarios regeneran un 30&#8239;% más después de cambiar el prompt',
  scenario: '<p>El lunes a las 10:00 se publicó el prompt del sistema v42 desde el panel de administración, sin canary: "era solo un cambio de tono". El miércoles, el tablero muestra que las regeneraciones pasaron del 8 al 10.4&#8239;%, en todas las regiones y en todas las réplicas. Nadie más tocó nada esa semana.</p>',
  steps: [
    {
      id: 'sev', type: 'single',
      prompt: '¿Qué severidad tiene?',
      options: [
        'SEV1: afecta a todos los usuarios, así que hay que despertar a todos.',
        'SEV2: calidad degradada en general, sin daño ni fuga de datos.',
        'SEV3: es una sola señal, sin errores ni latencia alta.',
        'No es un incidente: los usuarios se acostumbrarán.'
      ],
      answer: 1,
      explain: 'Un 30&#8239;% más de regeneraciones en todo el tráfico es una degradación general. SEV1 queda para salida dañina, fugas o injections explotadas.'
    },
    {
      id: 'donde', type: 'single',
      prompt: 'El problema aparece en todas las regiones y en todas las réplicas. ¿Qué te dice eso?',
      options: [
        'Que es un problema de hardware repetido en toda la flota.',
        'Que es algo que comparten todas: la versión o una de sus piezas.',
        'Que es un problema del router, que manda a todos al mismo modelo.',
        'Nada: los problemas de calidad nunca dependen de la ubicación.'
      ],
      answer: 1,
      explain: 'Cortar la señal por réplica, región y versión es el segundo paso del runbook: la forma del problema señala la capa. Una sola réplica apuntaría al hardware; una región, a la configuración; todas, a algo que comparten, como la versión o el prompt.'
    },
    {
      id: 'contener', type: 'single',
      prompt: '¿Cuándo vuelves al prompt v41?',
      options: [
        'Después de confirmar con un eval offline que el v42 es peor.',
        'Ya: es el único cambio de la semana y volver atrás cuesta segundos.',
        'Después de un A/B test que compare el v41 y el v42 con usuarios.',
        'Nunca: el cambio de tono lo pidió producto y es intencional.'
      ],
      answer: 1,
      explain: 'Contener primero, investigar después. Si después del rollback la señal no vuelve a su línea base, el sospechoso era otro.'
    },
    {
      id: 'confirmar', type: 'single',
      prompt: 'Una hora después del rollback, las regeneraciones están en 8.1&#8239;%. ¿Qué falta?',
      options: [
        'Nada: el incidente terminó y las métricas volvieron a lo normal.',
        'El postmortem y un caso en el golden set que lo habría detectado.',
        'Volver a publicar el v42 para confirmar que el problema era el prompt.',
        'Un postmortem que identifique quién publicó el prompt sin aprobación.'
      ],
      answer: 1,
      explain: 'El postmortem es sin culpas (M11): la falla es del proceso que permitía publicar un prompt sin pasar por el camino de una versión.'
    },
    {
      id: 'proceso', type: 'single',
      prompt: '¿Qué cambia en el proceso?',
      options: [
        'Prohibir los cambios de prompt fuera de una ventana mensual.',
        'El prompt vive en el paquete versionado y pasa por evals y canary.',
        'Revisar los prompts una vez por mes con el equipo de producto.',
        'Pedir que producto apruebe cada cambio de prompt por escrito.'
      ],
      answer: 1,
      explain: 'Todo lo que cambia el comportamiento es parte de la versión. El panel de administración puede seguir existiendo, pero lo que publica es una versión candidata, no un cambio en caliente.'
    }
  ],
  solution: '<ul><li>SEV2: degradación general sin daño.</li><li>Todas las regiones y réplicas: la causa es algo compartido, y el único cambio fue el prompt.</li><li>Rollback inmediato y confirmación con la señal.</li><li>Postmortem sin culpas: el problema es que el prompt se publicaba fuera del camino de una versión.</li><li>El prompt pasa al paquete versionado, con evals, shadow y canary.</li></ul>'
});

SD.defineExercise('m22-pdf', {
  title: 'un PDF hace que el asistente mande un correo',
  scenario: '<p>Un cliente empresarial reporta que su asistente, que tiene acceso al correo de cada empleado, envió a una dirección externa un resumen de los últimos correos de un gerente. El gerente había pedido resumir un PDF de un proveedor nuevo. Los logs de herramientas muestran la llamada a <code>send_email</code> con destino externo, 40 segundos después de leer el PDF.</p>',
  steps: [
    {
      id: 'sev', type: 'single',
      prompt: '¿Qué severidad tiene y qué haces primero?',
      options: [
        'SEV3: es un solo cliente y un solo correo.',
        'SEV1, y primero se contiene: se quita <code>send_email</code> externo a esas sesiones.',
        'SEV2: se revisa en la próxima reunión con el cliente afectado.',
        'SEV1, y lo primero es escribir el postmortem para el cliente.'
      ],
      answer: 1,
      explain: 'Si funcionó una vez, el mismo PDF o uno parecido funciona en otros clientes. Contener es cortar la pata de comunicación hacia afuera mientras se investiga.'
    },
    {
      id: 'tipo', type: 'single',
      prompt: '¿Qué tipo de ataque es?',
      options: [
        'Un jailbreak: el gerente le pidió al modelo que ignorara sus reglas.',
        'Una prompt injection indirecta: la instrucción venía en el PDF.',
        'Una clave de API robada que alguien usó para mandar el correo.',
        'Un bug del modelo que aparece con ciertos prompts.'
      ],
      answer: 1,
      explain: 'El gerente no atacó a nadie: un tercero lo atacó a él a través del modelo. Eso es lo que distingue una injection indirecta de un jailbreak.'
    },
    {
      id: 'trifecta', type: 'single',
      prompt: '¿Qué hizo posible el ataque?',
      options: [
        'Que el modelo es demasiado obediente con cualquier instrucción.',
        'Datos privados, contenido no confiable y salida hacia afuera en una sesión.',
        'Que el PDF era muy largo y la instrucción quedó en el medio del contexto.',
        'Que el prompt del sistema no decía "no obedezcas a los documentos".'
      ],
      answer: 1,
      explain: 'Mientras las tres estén juntas, alguna injection va a funcionar. Una frase en el prompt baja la probabilidad, pero no la lleva a cero.'
    },
    {
      id: 'arreglo', type: 'multi',
      prompt: 'Marca los cambios que conviene dejar de forma permanente.',
      options: [
        'Las sesiones con contenido externo no envían afuera sin confirmación.',
        'El servicio de correo valida cada envío sin confiar en el modelo.',
        'El contenido externo entra al prompt marcado como datos (spotlighting).',
        'Prohibir los PDFs de proveedores hasta que haya un clasificador de injection.'
      ],
      answer: [0, 1, 2],
      explain: 'Las dos primeras viven fuera del modelo y no se pueden convencer con texto; el spotlighting baja mucho la tasa de éxito. Prohibir PDFs le quita al producto su razón de ser.'
    },
    {
      id: 'despues', type: 'single',
      prompt: '¿Qué queda después del incidente?',
      options: [
        'Nada más: con el rollback y las defensas nuevas alcanza.',
        'El PDF entra al golden set de seguridad y el cliente recibe el informe.',
        'Un aviso en la documentación sobre los riesgos de leer PDFs externos.',
        'Bloquear al proveedor del PDF y a su dominio en todos los clientes.'
      ],
      answer: 1,
      explain: 'Cada ataque que funciona se convierte en un caso que bloquea regresiones. Y con datos de un cliente afuera, comunicarle qué salió es una obligación.'
    }
  ],
  solution: '<ul><li>SEV1: contener cortando la comunicación hacia afuera en las sesiones contaminadas.</li><li>Es una injection indirecta: el atacante es el autor del PDF.</li><li>La causa de fondo es la trifecta en una misma sesión.</li><li>Defensas permanentes fuera del modelo: confirmación, validación en el servicio y spotlighting.</li><li>El ataque entra al golden set de seguridad; el cliente recibe el informe.</li></ul>'
});

SD.defineExercise('m22-gpu', {
  title: 'una réplica devuelve texto sin sentido sin dar errores',
  scenario: '<p>Algunos usuarios reportan respuestas que empiezan bien y de golpe mezclan caracteres de otros alfabetos. El tablero general no muestra nada: errores, TTFT y regeneraciones están en su línea base. La flota tiene 125 réplicas de 4 H100 y nadie desplegó nada en diez días.</p>',
  steps: [
    {
      id: 'cortar', type: 'single',
      prompt: '¿Cómo buscas el origen?',
      options: [
        'Revirtiendo la última versión, porque casi siempre es la causa.',
        'Cortando por réplica la tasa de respuestas en otro idioma.',
        'Reiniciando todas las réplicas de a una y viendo cuándo desaparece.',
        'Cortando por idioma del usuario, para ver qué idioma falla más.'
      ],
      answer: 1,
      explain: 'Una réplica entre 125 es menos del 1&#8239;% del tráfico: no mueve ningún promedio. La señal por réplica la hace visible.'
    },
    {
      id: 'sospecha', type: 'single',
      prompt: 'La réplica 87 tiene un 3&#8239;% de respuestas en otro alfabeto; las demás, un 0.02&#8239;%. Nada cambió en diez días. ¿Qué sospechas?',
      options: [
        'Una alucinación: el modelo inventó el destinatario.',
        'Hardware: una GPU con corrupción silenciosa, que calcula mal sin errores.',
        'Un ataque de prompt injection dirigido a esa réplica.',
        'Un tokenizer distinto en esa réplica, cargado de otra versión del paquete del modelo.'
      ],
      answer: 1,
      explain: 'Google y Meta encuentran procesadores así en una fracción pequeña y constante de sus flotas (M06). Un bug de software afectaría a todas las réplicas con la misma versión.'
    },
    {
      id: 'accion', type: 'single',
      prompt: '¿Qué haces con la réplica 87?',
      options: [
        'Reiniciarla y devolverla al tráfico si el health check pasa.',
        'Sacarla del router y correr las pruebas de diagnóstico del fabricante.',
        'Dejarla: es solo un 3&#8239;% de sus respuestas y el 0.8&#8239;% del total.',
        'Bajarle el peso en el router hasta que su tasa vuelva al 0.02&#8239;% de las demás.'
      ],
      answer: 1,
      explain: 'Reiniciar esconde el problema hasta la próxima vez. La cuarentena saca la réplica del tráfico y conserva la evidencia.'
    },
    {
      id: 'deteccion', type: 'single',
      prompt: '¿Cómo lo detectas antes que los usuarios la próxima vez?',
      options: [
        'Con un eval offline semanal sobre el modelo, corrido en una réplica de pruebas.',
        'Con sondas: cada réplica responde prompts verificables cada pocos minutos.',
        'Comparando el texto exacto de una respuesta con temperatura 0.',
        'Con alertas de latencia por réplica, porque una GPU mala es más lenta.'
      ],
      answer: 1,
      explain: 'El texto exacto no sirve, porque la inferencia no es determinista aun con temperatura 0. Lo que se compara es si la respuesta es correcta y si la réplica se aleja de sus hermanas.'
    },
    {
      id: 'usuarios', type: 'single',
      prompt: 'La réplica 87 atendió el 0.8&#8239;% del tráfico durante días. ¿Qué haces con esas respuestas?',
      options: [
        'Nada: ya pasó y las respuestas son solo un 3&#8239;% de esa réplica.',
        'Identificarlas por los ids del trace y avisar a los clientes afectados.',
        'Borrar todas las conversaciones que atendió esa réplica en esos días.',
        'Reprocesar todas las respuestas con otra réplica y reemplazarlas.'
      ],
      answer: 1,
      explain: 'Los traces llevan la réplica y los ids, no el texto (22.12), y con eso alcanza para saber a quién afectó. Un JSON corrupto en un flujo automático puede haber propagado el error.'
    }
  ],
  solution: '<ul><li>Una falla de una réplica se diluye en el promedio: hacen falta señales por réplica.</li><li>Una sola réplica sin cambios recientes apunta a hardware: corrupción silenciosa.</li><li>Cuarentena y diagnóstico, no reinicio.</li><li>Sondas con respuestas verificables y comparación entre réplicas, no texto exacto.</li><li>Los ids del trace permiten encontrar a los clientes afectados.</li></ul>'
});

SD.defineExercise('m22-borrar', {
  title: 'un cliente pide borrar sus datos y aparecen en los traces',
  scenario: '<p>Una organización cliente cancela su contrato y pide el borrado de todas sus conversaciones. El job de borrado en cascada del M20 termina sin errores. Una semana después, su equipo de seguridad encuentra fragmentos de sus prompts en el sistema de traces de la plataforma, al que tenía acceso de solo lectura para depurar sus integraciones.</p>',
  steps: [
    {
      id: 'por-que', type: 'single',
      prompt: '¿Por qué el borrado en cascada no los encontró?',
      options: [
        'Porque el job tiene un bug y se saltea las tablas con muchas filas.',
        'Porque los traces no están en el esquema: nadie los inventarió.',
        'Porque los traces se borran solos al día siguiente.',
        'Porque el cliente no pidió borrar los traces, solo las conversaciones.'
      ],
      answer: 1,
      explain: 'El riesgo más grande casi nunca está en el proveedor del modelo sino en las copias propias: logs, traces, data warehouse, golden sets.'
    },
    {
      id: 'inmediato', type: 'single',
      prompt: '¿Qué haces primero?',
      options: [
        'Borrar los traces de esa organización y buscar otras copias.',
        'Esperar a que venzan con la retención normal de 30 días.',
        'Avisar al cliente y esperar su instrucción antes de tocar nada.',
        'Apagar el sistema de traces hasta rediseñarlo.'
      ],
      answer: 0,
      explain: 'El borrado se le debe al cliente ya. Y si los traces tienen contenido de una organización, lo tienen de todas: el inventario es de todo el sistema.'
    },
    {
      id: 'diseno', type: 'single',
      prompt: '¿Qué cambia en el diseño de los traces?',
      options: [
        'Nada: con incluir los traces en el job de borrado alcanza.',
        'Los spans no llevan el texto, solo ids, tokens, versión y un hash.',
        'Cifrar los traces con una clave por organización.',
        'Guardar los traces solo un día, para que el borrado no haga falta.'
      ],
      answer: 1,
      explain: 'Lo que no se escribe no hay que borrarlo. Cifrar no resuelve el borrado y un plazo corto lo reduce sin resolverlo.'
    },
    {
      id: 'depurar', type: 'single',
      prompt: 'El equipo de soporte dice que sin el texto en los traces no puede depurar integraciones. ¿Qué ofreces?',
      options: [
        'Volver a poner el texto, pero solo para clientes que lo autoricen.',
        'Un almacén aparte de muestras, con retención corta y acceso registrado.',
        'Que depuren con los hashes del prompt, que identifican cada request.',
        'Que le pidan el texto al cliente por correo cuando lo necesiten.'
      ],
      answer: 1,
      explain: 'Es la misma tensión que describió el postmortem de Anthropic: la privacidad hace más lenta la depuración. La respuesta es un camino controlado para ver contenido, no prohibirlo ni dejarlo en todos lados.'
    },
    {
      id: 'inventario', type: 'multi',
      prompt: 'Marca los lugares que el inventario de copias tiene que incluir.',
      options: [
        'Las respuestas del shadow traffic y los juicios del eval.',
        'Los backups de la base, con su plazo de vencimiento.',
        'Los golden sets que salieron de tráfico real.',
        'Los dashboards de métricas agregadas por organización.'
      ],
      answer: [0, 1, 2],
      explain: 'Todo lo que contiene texto de los usuarios entra en el inventario, con una de tres respuestas: el job lo borra, vence solo con un plazo conocido, o se diseña para no tener el texto.'
    }
  ],
  solution: '<ul><li>El job de borrado solo conoce el esquema; los traces eran una copia sin inventariar.</li><li>Borrar ya y revisar todos los sistemas de observabilidad.</li><li>Traces sin texto, con un redactor en el colector como última defensa.</li><li>Un almacén aparte para muestras de contenido, con retención corta y acceso registrado.</li><li>Un inventario de copias donde cada una se borra, vence o no tiene el texto.</li></ul>'
});
