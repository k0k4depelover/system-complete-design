SD.defineQuiz('m24', {
  title: 'Quiz: voz y tiempo real',
  pass: 0.7,
  questions: [
    {
      id: 'humano', type: 'single',
      prompt: 'En una conversación entre personas, la mayoría de las respuestas llega dentro de unos 200 ms de silencio. ¿Qué significa eso para un agente de voz que tarda 2 segundos en contestar?',
      options: [
        'Nada: los usuarios saben que hablan con una máquina y esperan.',
        'Que suena como si no hubiera escuchado: el usuario repite, habla encima o cuelga. Por eso el objetivo es bajar de un segundo y cada salto tiene presupuesto.',
        'Que hay que usar un LLM más grande, que contesta mejor.',
        'Que hay que mandar el audio por TCP para no perder nada.'
      ],
      answer: 1,
      explain: 'El tiempo de respuesta lo fija la conversación humana (Stivers y otros, 2009). Dos segundos de silencio se interpretan como que no hubo respuesta. Repasa 24.1.'
    },
    {
      id: 'cabeceras', type: 'single',
      prompt: 'Opus a 32 kbps en cuadros de 20 ms, con 20 bytes de IP, 8 de UDP, 12 de RTP y 10 del tag de SRTP por paquete. ¿Cuánto ocupa en el cable, por sentido?',
      options: ['32 kbps', '40 kbps', '52 kbps', '64 kbps'],
      fixed: true,
      answer: 2,
      explain: '50 paquetes por segundo × (80 + 50) bytes × 8 bits = 52&#8239;000 bits por segundo. Las cabeceras son el 38&#8239;% del tráfico. Repasa 24.1.'
    },
    {
      id: 'udp', type: 'single',
      prompt: '¿Por qué el audio de una llamada viaja por UDP y no por TCP?',
      options: [
        'Porque UDP cifra y TCP no.',
        'Porque en TCP un paquete perdido frena a los que vienen detrás hasta que se retransmite, y un cuadro de audio que llega 200 ms tarde ya no sirve: es mejor disimularlo y seguir.',
        'Porque UDP garantiza el orden de los paquetes.',
        'Porque los navegadores no permiten TCP.'
      ],
      answer: 1,
      explain: 'Es el head-of-line blocking del M01. Para la voz importa el momento de sonar; lo que llega tarde se trata como perdido y lo tapan la PLC o la FEC. Repasa 24.4.'
    },
    {
      id: 'turn', type: 'single',
      prompt: 'Un usuario llama desde una red corporativa que solo deja salir tráfico al puerto 443. ¿Qué hace que la llamada funcione?',
      options: [
        'Un servidor STUN, que le dice su IP pública.',
        'Un servidor TURN que escucha en TLS sobre el 443 y retransmite el audio, a costa de más latencia y de ancho de banda propio.',
        'Cambiar el códec a G.711.',
        'Nada: con ese firewall la llamada no puede funcionar.'
      ],
      answer: 1,
      explain: 'STUN solo informa la dirección; no sirve si no hay camino UDP. TURN sobre TLS en el 443 atraviesa casi cualquier firewall. ICE lo prueba entre los candidatos. Repasa 24.4 y el escenario del mapa.'
    },
    {
      id: 'websocket', type: 'single',
      prompt: '¿Dónde tiene sentido un WebSocket para el audio?',
      options: [
        'Entre la app del usuario y el borde, en redes móviles.',
        'Entre servidores de la misma región, como el worker que habla con un proveedor speech-to-speech, donde casi no hay pérdida y la simplicidad gana.',
        'En ningún lado: el audio nunca va por TCP.',
        'Solo para la red telefónica.'
      ],
      answer: 1,
      explain: 'Sobre una red con pérdida, el TCP del WebSocket frena el audio en cada retransmisión. Dentro de una región no pasa, y un WebSocket es mucho más fácil que WebRTC. Repasa 24.4.'
    },
    {
      id: 'fec', type: 'single',
      prompt: 'En la red 4G del simulador, un buffer de 20 ms con FEC disimula casi lo mismo que sin FEC. ¿Por qué?',
      options: [
        'Porque Opus no tiene FEC.',
        'Porque la FEC del cuadro perdido viaja en el paquete siguiente, y con 20 ms de buffer ese paquete nunca llega a tiempo para recuperarlo.',
        'Porque la FEC solo sirve en wifi.',
        'Porque la FEC duplica el ancho de banda y la red se satura.'
      ],
      answer: 1,
      explain: 'La FEC de Opus manda en cada paquete una copia del cuadro anterior. Para usarla hay que esperar al paquete siguiente, y eso pide buffer: con 60 ms y FEC, la red 4G baja al 2&#8239;% de audio disimulado. Repasa 24.4.'
    },
    {
      id: 'sfu', type: 'single',
      prompt: '¿Por qué un SFU puede manejar mil sesiones con una sola instancia?',
      options: [
        'Porque mezcla todos los audios en uno.',
        'Porque reenvía los paquetes sin decodificar el audio: gasta en red y en paquetes, no en procesar el sonido.',
        'Porque transcribe el audio y reenvía solo el texto.',
        'Porque usa GPUs.'
      ],
      answer: 1,
      explain: 'El que decodifica y mezcla es el MCU, y por eso es caro. El SFU solo reenvía; el agente entra a la sala como un participante más. Repasa 24.5.'
    },
    {
      id: 'estado', type: 'multi',
      prompt: '¿Qué estado conviene copiar fuera del worker después de cada turno, para que otro worker pueda seguir si este muere? Elige todas las que correspondan.',
      options: [
        'El contexto: el resumen y los turnos recientes.',
        'Qué parte de la última respuesta llegó a sonar.',
        'Los cuadros de audio de los últimos 300 ms.',
        'Las herramientas que cambiaron algo, con su idempotency key.',
        'El estado interno del VAD.'
      ],
      answer: [0, 1, 3],
      explain: 'Lo que cambia cada 20 ms (audio, buffers, VAD) se pierde sin problema. Lo que define la conversación se escribe una vez por turno, y las herramientas con efectos no se repiten gracias a la idempotency key. Repasa 24.5.'
    },
    {
      id: 'finturno', type: 'single',
      prompt: 'Con un umbral fijo de 500 ms de silencio, el agente contesta cada vez que el usuario hace una pausa para pensar a mitad de frase. ¿Qué lo arregla mejor?',
      options: [
        'Subir el umbral a 1.5 s para todos los turnos.',
        'Un detector de fin de turno que lea la transcripción parcial: espera más cuando la frase está incompleta y corta pronto cuando está terminada.',
        'Un VAD por energía.',
        'Pedirle al usuario que diga "cambio" al terminar.'
      ],
      answer: 1,
      explain: 'Subir el umbral hace lento cada turno. El detector semántico (el modelo de turnos de LiveKit, o semantic_vad en la Realtime API) separa las pausas a mitad de frase de los finales. Repasa 24.6.'
    },
    {
      id: 'espera', type: 'single',
      prompt: 'Una llamada de 10 minutos tiene 33 turnos. ¿Cuánto silencio extra suma subir la espera de fin de turno en 100 ms?',
      options: ['100 ms', '1 s', '3.3 s', '33 s'],
      fixed: true,
      answer: 2,
      explain: '33 turnos × 100 ms = 3.3 segundos de silencio de más en cada llamada. El fin de turno ya es el bloque más grande del presupuesto: 250 de 780 ms. Repasa 24.6 y 24.8.'
    },
    {
      id: 'frase', type: 'single',
      prompt: 'Una respuesta de 30 tokens a 25 ms por token se genera en 750 ms y se dice en 9 segundos. ¿Qué conviene hacer?',
      options: [
        'Esperar la respuesta completa y sintetizarla de una vez, para que la voz salga pareja.',
        'Mandar al TTS cada frase apenas se completa: la generación va doce veces más rápido que la voz, así que el resto siempre llega antes de que haga falta.',
        'Mandar cada token al TTS por separado.',
        'Usar un LLM más chico para que la respuesta sea más corta.'
      ],
      answer: 1,
      explain: 'Esperar la respuesta entera suma toda la generación antes de la primera palabra. Por token, el TTS no tiene contexto para la entonación. Por frase es el punto medio. Repasa 24.7.'
    },
    {
      id: 'orden', type: 'order',
      prompt: 'Ordena los saltos de un turno en cascada, desde que el usuario calla hasta que oye al agente.',
      items: [
        'Red de ida y jitter buffer del audio del usuario',
        'Detector de fin de turno',
        'Final del STT',
        'Primer token del LLM',
        'Primera frase completa',
        'Primer audio del TTS',
        'Red de vuelta y reproducción'
      ],
      explain: 'El STT ya transcribió casi todo mientras el usuario hablaba; lo que queda es su final. Después, el LLM, la primera frase y el TTS. Repasa 24.3 y 24.8.'
    },
    {
      id: 'truncar', type: 'single',
      prompt: 'El agente generó una respuesta de 10.4 segundos y el usuario lo interrumpió a los 5.5. ¿Qué pasa si el contexto guarda la respuesta completa?',
      options: [
        'Nada grave: el modelo solo usa los últimos turnos.',
        'El modelo cree que dijo cosas que el usuario nunca oyó, y en los turnos siguientes las da por sabidas.',
        'El TTS vuelve a decir la parte que faltó.',
        'El usuario recibe una transcripción de lo que faltó.'
      ],
      answer: 1,
      explain: 'Con las marcas de tiempo del TTS se corta el texto donde se cortó el audio. En la Realtime API, conversation.item.truncate con audio_end_ms; por WebRTC y SIP lo hace el servidor. Repasa 24.9.'
    },
    {
      id: 'eco', type: 'single',
      prompt: 'En una prueba con altavoz, el agente se corta solo a los 360 ms de empezar a hablar, sin que el usuario diga nada. ¿Qué falta?',
      options: [
        'Un STT más preciso.',
        'Cancelación de eco: el micrófono capta la voz del propio agente y el VAD la toma como una interrupción.',
        'Un buffer más grande.',
        'Más réplicas del LLM.'
      ],
      answer: 1,
      explain: 'La AEC resta del micrófono lo que suena por el parlante. Los navegadores la activan por defecto en WebRTC; un altavoz o una app que la desactiva la rompe. Repasa 24.9.'
    },
    {
      id: 'costo', type: 'single',
      prompt: 'Con gpt-realtime y caché, una llamada de 10 minutos cuesta unos 0.52 USD. ¿Qué es la mayor parte?',
      options: [
        'El audio del usuario.',
        'El texto del system prompt.',
        'El audio del agente: 33 turnos × 180 tokens × 64 USD por millón son unos 0.38 USD, el 73&#8239;%.',
        'El caché.'
      ],
      answer: 2,
      explain: 'Cada segundo que habla el agente son 20 tokens de salida al precio más alto. Sin caché, la misma llamada costaría 4.70 USD, porque cada turno vuelve a pagar todo el audio anterior. Repasa 24.11.'
    },
    {
      id: 'metering', type: 'single',
      prompt: '¿Por qué una sesión de voz emite un evento de uso por turno y no uno solo al colgar?',
      options: [
        'Para que la factura tenga más líneas.',
        'Porque si el worker muere a los 50 minutos, el evento final no sale nunca y esa hora no se cobra; con un evento por turno, con clave sesión y turno, se pierde a lo sumo un turno y no se duplica nada.',
        'Porque Kafka no acepta mensajes grandes.',
        'Porque el precio cambia en cada turno.'
      ],
      answer: 1,
      explain: 'Es la misma idea que los cortes periódicos de un stream largo en el M21. La clave de idempotencia evita contar dos veces si el evento se reintenta. Repasa 24.11.'
    },
    {
      id: 'tasa', type: 'single',
      prompt: 'Un clasificador de moderación con el 1&#8239;% de falsos positivos revisa cada respuesta de la flota de referencia, con 1&#8239;667 turnos por segundo. ¿Cuántas respuestas inocentes corta?',
      options: ['Unas 17 por hora', 'Unas 17 por minuto', 'Unas 17 por segundo, unas 60 000 por hora', 'Ninguna: el 1 % es despreciable'],
      fixed: true,
      answer: 2,
      explain: '1&#8239;667 × 0.01 = 16.7 por segundo; × 3&#8239;600 = unas 60&#8239;000 por hora. Es la tasa base del M22: antes de bloquear, se mide la precisión con conversaciones reales. Repasa 24.12.'
    },
    {
      id: 'little', type: 'single',
      prompt: 'Empiezan 100 sesiones de voz por segundo y duran 5 minutos en promedio. ¿Cuántas hay abiertas a la vez?',
      options: ['500', '3 000', '30 000', '100 000'],
      fixed: true,
      answer: 2,
      explain: 'Ley de Little: 100 por segundo × 300 segundos = 30&#8239;000. Con 80 por worker al 75&#8239;%, son 500 workers en el pico. Repasa 24.11.'
    }
  ]
});
