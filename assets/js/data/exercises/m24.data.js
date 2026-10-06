/* Ejercicio guiado del M24 (voz y tiempo real). Formato en core/exercise.js. */

SD.defineExercise('m24-telefonico', {
  title: 'un agente telefónico para un banco',
  scenario: '<p>Un banco quiere atender por teléfono con un agente de voz. En la hora pico hay <b>5&#8239;000 llamadas simultáneas</b>, que entran por un troncal SIP con G.711. El agente consulta saldos y movimientos, bloquea tarjetas y agenda citas; dos de esas herramientas tardan a veces más de un segundo. Regulación: cada respuesta tiene que poder auditarse y nada que el agente diga puede salir sin pasar por las reglas del banco.</p><p>Usa los números de la flota de referencia: un intercambio de 18 segundos (6 del usuario, 9 del agente), 30 tokens por respuesta a 25 ms por token, 64 generaciones por réplica del LLM, 80 sesiones por worker y los precios de 24.11. Diseña el sistema decisión por decisión.</p>',
  steps: [
    {
      id: 'arquitectura', type: 'single',
      prompt: '¿Cascada o speech-to-speech?',
      options: [
        'Speech-to-speech: es 80 ms más rápido, entiende el tono y modera el audio igual.',
        'Cascada: el texto se modera y se audita antes de sonar, y cuesta menos.',
        'Speech-to-speech para todo, y una transcripción posterior para auditar.',
        'Cascada para los saludos y speech-to-speech para las consultas de saldo.'
      ],
      answer: 1,
      explain: 'Speech-to-speech solo da la transcripción después de que el audio sonó: para el banco eso llega tarde. Con la cascada, cada frase pasa por las reglas antes del TTS. En la hora pico son 300&#8239;000 minutos: unos 15&#8239;580 USD por hora con gpt-realtime y caché, contra unos 3&#8239;690 con la cascada por APIs (24.2 y 24.11).'
    },
    {
      id: 'transporte', type: 'single',
      prompt: 'Las llamadas entran por SIP. ¿Cómo llega el audio al agente?',
      options: [
        'Un gateway SIP convierte cada llamada en un participante de una sala del SFU.',
        'Cada worker atiende el SIP directo y abre un puerto por llamada en internet.',
        'El troncal graba la llamada y sube tramos a S3 cada 10 segundos para el worker.',
        'El troncal transcribe la llamada y le manda el texto al worker por HTTP.'
      ],
      answer: 0,
      explain: 'Con el gateway, el agente es el mismo para la app y el teléfono. En el cable, G.711 son 80 kbps por llamada: 5&#8239;000 × 80 kbps = 0.40 Gbps por sentido. El troncal cuesta 300&#8239;000 × 0.002216 = unos 665 USD por hora pico (24.4 y 24.14).'
    },
    {
      id: 'region', type: 'single',
      prompt: '¿Dónde van el gateway SIP, el SFU y los workers?',
      options: [
        'En la región más barata, porque el audio tolera 200 ms más de red.',
        'En la región del país del banco, junto al troncal y los modelos, con otra de respaldo.',
        'El SFU cerca del troncal y los modelos en la región con más GPUs libres.',
        'Repartidos entre regiones por round robin, para balancear la carga de GPUs.'
      ],
      answer: 1,
      explain: 'Cada 100 ms de ida y vuelta hasta el SFU se pagan en cada turno, y la red telefónica ya suma su demora. Las llamadas en curso no migran de región: se cortan, así que la segunda región es para las nuevas (24.5 y 24.13).'
    },
    {
      id: 'finturno', type: 'single',
      prompt: 'Los clientes dictan números de cuenta y de tarjeta, con pausas entre grupos de dígitos. ¿Cómo se detecta el fin de turno?',
      options: [
        'Un umbral fijo de 300 ms de silencio, para que el agente responda rápido.',
        'Un umbral fijo de 2 segundos de silencio, para no cortar nunca al cliente.',
        'Un detector que lee la transcripción parcial y espera más si la frase está incompleta.',
        'Que el cliente apriete numeral al terminar cada frase, como en un IVR.'
      ],
      answer: 2,
      explain: 'Un umbral fijo corto corta los números a la mitad; uno largo suma segundos a cada turno: 33 turnos × 100 ms son 3.3 s por llamada de 10 minutos. El detector semántico hace corto lo completo y largo lo incompleto (24.6).'
    },
    {
      id: 'herramientas', type: 'single',
      prompt: 'Consultar los movimientos tarda a veces 1.5 segundos. ¿Qué oye el cliente?',
      options: [
        'Silencio hasta que llegue la respuesta, que nunca pasa de 2 segundos.',
        'Música de espera durante cada consulta, como en un call center.',
        'A los 700 ms, una frase de relleno ya sintetizada, y un deadline de 8 s.',
        'El agente adelanta una respuesta probable y la corrige si la real es distinta.'
      ],
      answer: 2,
      explain: 'Más de un segundo de silencio suena a llamada cortada. La frase de relleno está sintetizada de antemano, así que no suma TTS. El deadline evita esperar para siempre (24.7 y el escenario de la herramienta lenta).'
    },
    {
      id: 'interrupcion', type: 'multi',
      prompt: 'El cliente interrumpe al agente a mitad de una lista de movimientos. ¿Qué tiene que pasar? Elige todas las que correspondan.',
      options: [
        'El worker deja de publicar audio en menos de 400 ms.',
        'Se cancelan la generación del LLM y las frases que esperaban en el TTS.',
        'El contexto guarda solo lo que el cliente oyó.',
        'El agente termina la frase en curso antes de callar, para no cortar un número a la mitad.',
        'El registro del turno guarda también lo generado que no sonó.'
      ],
      answer: [0, 1, 2, 4],
      explain: 'Callar, cancelar y truncar son las partes del barge-in. Guardar lo que no sonó, en su propia columna, sirve para auditar y para ver cuánto se interrumpe. Terminar la frase es hablar encima del cliente (24.9 y 24.10).'
    },
    {
      id: 'capacidad', type: 'single',
      prompt: '¿Cuántas réplicas del LLM hacen falta en la hora pico, al 75&#8239;% de uso?',
      options: ['2', '5', '27', '79'],
      fixed: true,
      answer: 1,
      explain: '5&#8239;000 ÷ 18 s = 278 turnos por segundo; × 30 tokens × 25 ms = 208 generaciones en curso (ley de Little); ÷ 64 por réplica ÷ 0.75 = 4.3, o sea 5 réplicas. Los workers son 5&#8239;000 ÷ 80 ÷ 0.75 = 84: la voz es sobre todo CPU (24.1 y 24.11).'
    },
    {
      id: 'registro', type: 'single',
      prompt: '¿Qué se guarda de cada llamada?',
      options: [
        'Todo el audio de cada llamada, cifrado, para resolver reclamos después.',
        'Nada: la voz es un dato biométrico y no se puede guardar sin auditoría.',
        'La transcripción de cada turno, y el audio solo si el cliente acepta grabarlo.',
        'Solo el audio, sin transcripción, para no procesar datos personales con un modelo.'
      ],
      answer: 2,
      explain: 'La transcripción alcanza para auditar y para evaluar con llamadas reales. El audio es la voz de una persona: con consentimiento, con retención y con borrado, como los datos del M22 (24.10).'
    }
  ],
  solution: '<ul><li><b>Arquitectura:</b> cascada con STT, LLM y TTS, porque el banco necesita moderar y auditar cada frase antes de que suene. Unos 3&#8239;690 USD por hora pico con APIs, contra 15&#8239;580 con speech-to-speech.</li><li><b>Transporte:</b> troncal SIP con G.711 (0.40 Gbps por sentido, unos 665 USD por hora pico) hacia un gateway SIP que mete cada llamada en una sala del SFU.</li><li><b>Ubicación:</b> gateway, SFU, workers y modelos en la región del banco, con una segunda región para las llamadas nuevas.</li><li><b>Fin de turno:</b> detector semántico que espera cuando el número o la frase está incompleta.</li><li><b>Herramientas lentas:</b> frase de relleno a los 700 ms y deadline de 8 s.</li><li><b>Interrupciones:</b> callar en menos de 400 ms, cancelar LLM y TTS, truncar el contexto a lo oído y registrar lo no oído aparte.</li><li><b>Capacidad:</b> 208 generaciones en curso, 5 réplicas del LLM, 84 workers, 1&#8239;667 streams de STT y 2&#8239;500 de TTS en el pico.</li><li><b>Registro:</b> transcripción por turno siempre; audio solo con consentimiento, con retención y borrado en cascada.</li></ul>'
});
