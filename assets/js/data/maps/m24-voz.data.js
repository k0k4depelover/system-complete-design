/* Mapa del M24: un agente de voz en tiempo real, del micrófono del usuario a la voz del agente. Diseño de referencia
   para la flota de 24.1 (30 000 sesiones simultáneas en el pico); lo documentado por terceros (WebRTC, la Realtime API
   de OpenAI, LiveKit, Silero, AWS) va marcado en cada caja. Se lee de arriba abajo: clientes, borde, agente, modelos y
   plataforma. El ms de cada paso es lo que suma al camino crítico: el total del turno normal es el presupuesto de 24.8. */
SD.defineMap('m24-voz', {
  title: 'Un agente de voz en tiempo real',
  intro: 'El camino de un turno de voz. Arriba, la app y el teléfono; en el borde, la señalización, STUN, TURN, el SFU y el gateway SIP; en el medio, el worker que orquesta el turno con el VAD y el detector de fin de turno; abajo, los modelos (STT, LLM, TTS o un speech-to-speech) y la plataforma. Los escenarios recorren un turno normal, una interrupción, una pausa larga, una red con pérdida, un cambio de red, un firewall que solo deja salir el 443, un worker que muere, una llamada telefónica, una herramienta lenta y el mismo turno con speech-to-speech.',
  start: 'worker',
  groups: [
    { id: 'g-cli', label: 'Clientes', x: 20, y: 54, w: 2140, h: 110 },
    { id: 'g-borde', label: 'Borde: conexión y medios', x: 20, y: 264, w: 2140, h: 110 },
    { id: 'g-agente', label: 'Agente: turnos y orquestación', x: 20, y: 474, w: 2140, h: 110 },
    { id: 'g-modelos', label: 'Modelos', x: 20, y: 684, w: 2140, h: 110 },
    { id: 'g-plat', label: 'Plataforma', x: 20, y: 894, w: 2140, h: 110 }
  ],
  nodes: [
    /* ---------- Clientes ---------- */
    { id: 'app', layer: 'client', label: 'App con voz', sub: 'navegador o app móvil, WebRTC', x: 640, y: 120,
      info: {
        resp: '<p>Captura el micrófono, le resta el eco de lo que suena por el parlante (AEC), comprime con el códec Opus en cuadros de 20 ms y los manda por UDP al SFU. En el otro sentido, ordena los paquetes que llegan en su jitter buffer y los reproduce. Nunca tiene la clave de la API: pide un token de corta duración al app server.</p>',
        api: '<pre><code>POST /voice/session            → {"token": "eyJ…", "url": "wss://sfu.example.com"}\nWebSocket de señalización      → oferta SDP y candidatos ICE\nSRTP sobre UDP                 → audio en los dos sentidos</code></pre><p>En el navegador, todo esto es <code>RTCPeerConnection</code> y <code>getUserMedia</code>, con la cancelación de eco activada por defecto. <span class="badge badge--doc">Documentado</span></p>',
        data: '<p>Nada que dure: el token, el estado de la conexión y unos cientos de milisegundos de audio en los buffers. Si la app guarda la transcripción para mostrarla, la recibe del worker por un canal de datos.</p>',
        fail: '<ul><li><b>Sin cancelación de eco:</b> el agente se oye a sí mismo y se interrumpe (escenario "Una interrupción a mitad de frase" y el simulador de 24.9).</li><li><b>Cambia de red:</b> reinicia ICE (escenario "De wifi a datos").</li><li><b>Pestaña en segundo plano:</b> algunos navegadores frenan los timers; el audio sigue, la interfaz no.</li></ul>',
        nums: '<ul><li>Opus a 32 kbps: 80 bytes de audio y 50 de cabeceras (IP, UDP, RTP y el tag de SRTP) cada 20 ms; 52 kbps en el cable.</li><li>Captura y codificación: unos 30 ms; jitter buffer y reproducción: unos 40 ms. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    { id: 'pstn', layer: 'external', label: 'Teléfono', sub: 'red telefónica, G.711 a 8 kHz', x: 1960, y: 120,
      info: {
        resp: '<p>Un teléfono cualquiera que llama a un número. El audio viaja por la red telefónica hasta un proveedor de troncales SIP, que lo entrega como RTP con el códec G.711.</p>',
        api: '<p>No hay API: hay un número de teléfono. Los dígitos que marca el usuario llegan como eventos DTMF dentro de RTP (RFC 4733). <span class="badge badge--doc">Documentado</span></p>',
        data: '<p>Nada en tu sistema, salvo el número que llama (y que no prueba quién es: se puede falsificar).</p>',
        fail: '<ul><li><b>Audio de 8 kHz:</b> el STT pierde precisión; conviene un modelo ajustado con audio telefónico.</li><li><b>Número falsificado:</b> el número que llama no autentica a nadie (24.12).</li></ul>',
        nums: '<ul><li>G.711: 8 kHz, 64 kbps; con cabeceras, 80 kbps por sentido. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    /* ---------- Borde ---------- */
    { id: 'appsrv', layer: 'service', label: 'App server', sub: 'token efímero y sala', x: 200, y: 330,
      info: {
        resp: '<p>Tu backend de siempre. Autentica al usuario, decide qué agente le toca, crea la sala en el SFU y le devuelve un token firmado que vale para esa sala y por unos minutos. Es el único que conoce las claves de los proveedores (M10).</p>',
        api: '<pre data-lang="json"><code>POST /voice/session\n200 {"room": "ses_81", "token": "eyJhbGciOi…", "expires_in": 600,\n     "ice_servers": [{"urls": ["stun:stun.example.com:3478"]},\n                     {"urls": ["turns:turn.example.com:443?transport=tcp"],\n                      "username": "1760000000:u_42", "credential": "…"}]}</code></pre><p>En LiveKit, el token es un JWT con la sala y los permisos. <span class="badge badge--doc">Documentado</span></p>',
        data: '<p>La sesión de voz en su base: quién, cuándo, qué agente y con qué consentimiento de grabación. Las credenciales de TURN son temporales y derivadas de un secreto compartido con coturn.</p>',
        fail: '<ul><li><b>Cae:</b> nadie empieza sesiones nuevas; las que ya están abiertas siguen, porque el audio no pasa por acá.</li><li><b>Token robado:</b> sirve solo para esa sala y por minutos.</li></ul>',
        nums: '<ul><li>Una request por sesión: con 30 000 sesiones simultáneas de 5 minutos, unas 100 por segundo.</li></ul>'
      } },
    { id: 'stun', layer: 'edge', label: 'STUN', sub: '¿cuál es mi IP pública?', x: 640, y: 330,
      info: {
        resp: '<p>Le dice al cliente con qué IP y puerto lo ve internet, del otro lado de su NAT (M01). Con eso, ICE arma los candidatos "server reflexive". No toca el audio. <span class="badge badge--doc">Documentado</span> (RFC 8489)</p>',
        api: '<pre><code>Binding Request  (UDP 3478)\nBinding Response XOR-MAPPED-ADDRESS = 190.12.40.7:51234</code></pre>',
        data: '<p>Nada. Es tan barato que muchos SFU lo resuelven ellos mismos.</p>',
        fail: '<ul><li><b>La red bloquea UDP:</b> no responde; ICE sigue con TURN (escenario "Red corporativa").</li></ul>',
        nums: '<ul><li>Un RTT por consulta.</li></ul>'
      } },
    { id: 'turn', layer: 'edge', label: 'TURN', sub: 'retransmite cuando UDP no pasa', x: 1080, y: 330,
      info: {
        resp: '<p>Un relay: cuando el cliente no puede mandar UDP directo al SFU (NAT simétrico, firewall corporativo), le manda el audio al TURN y el TURN lo reenvía. Puede escuchar en UDP, en TCP o en TLS sobre el puerto 443, que casi ninguna red bloquea. <span class="badge badge--doc">Documentado</span> (RFC 8656)</p>',
        api: '<pre><code>Allocate Request  (credenciales temporales)\nCreatePermission  peer = SFU\nChannelData       audio, 4 bytes de cabecera extra</code></pre>',
        data: '<p>Las asignaciones activas, en memoria. coturn valida las credenciales con el mismo secreto que usa el app server para firmarlas.</p>',
        fail: '<ul><li><b>Saturado:</b> el audio de quienes dependen de él se corta. Se dimensiona por ancho de banda, no por CPU.</li><li><b>TURN sobre TCP o TLS:</b> funciona, pero con head-of-line blocking (M01): una pérdida frena a los paquetes que siguen.</li></ul>',
        nums: '<ul><li>Entre el 10 y el 30&#8239;% de las sesiones lo necesitan, como en el M29; con el 25&#8239;% de 30 000 sesiones: 30 000 × 0.25 × 52 kbps × 2 sentidos = 0.78 Gbps.</li><li>Kinesis Video Streams cobra 0.12 USD por mil minutos de TURN. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'sfu', layer: 'edge', label: 'SFU', sub: 'reenvía el audio de la sala', x: 1520, y: 330,
      info: {
        resp: '<p>El servidor de medios. Cada sesión es una sala con dos participantes: el usuario y el agente. Recibe los paquetes de cada uno y los reenvía al otro sin decodificarlos (por eso es selectivo y barato). También lleva la señalización por WebSocket y despacha un worker cuando se abre una sala. Va en la región más cercana al usuario.</p>',
        api: '<pre><code>wss://sfu.example.com/rtc?access_token=eyJ…    señalización: SDP, ICE, eventos\nSRTP/UDP                                      audio del usuario y del agente\nRTCP                                          pérdida, jitter, RTT y ancho de banda</code></pre><p>En LiveKit, el agente entra a la sala como un participante más. <span class="badge badge--doc">Documentado</span></p>',
        data: '<p>El estado de las salas en memoria, y un registro de quién estuvo conectado y cuánto: sirve para conciliar el metering si un worker muere sin cerrar sus eventos (M21).</p>',
        fail: '<ul><li><b>Cae un SFU:</b> sus salas se cortan; los clientes reconectan a otro y el worker retoma la sesión desde el estado guardado.</li><li><b>Sala en otra región:</b> 100 ms más de ida y vuelta que se comen el presupuesto.</li></ul>',
        nums: '<ul><li>Un SFU cada 1 000 sesiones; 40 en el pico, repartidos en las regiones. <span class="badge badge--ref">Diseño de referencia</span></li><li>Red de ida y de vuelta: 25 ms cada una con un SFU cercano.</li></ul>'
      } },
    { id: 'sip', layer: 'edge', label: 'Gateway SIP', sub: 'de la red telefónica a la sala', x: 1960, y: 330,
      info: {
        resp: '<p>Recibe las llamadas del troncal SIP y las convierte en un participante de una sala, igual que una app. El SIP lleva la señalización (quién llama, colgar, transferir) y el audio va en RTP con G.711.</p>',
        api: '<pre><code>INVITE sip:+5215550001234@voice.example.com  SIP/2.0\nSDP: m=audio 40000 RTP/AVP 0 101     (0 = G.711 µ-law, 101 = DTMF)</code></pre>',
        data: '<p>El registro de cada llamada: número, duración, cómo terminó. Es la base del cobro de los minutos.</p>',
        fail: '<ul><li><b>El troncal rechaza llamadas:</b> el usuario oye tono de ocupado; se ve en las métricas de llamadas fallidas, no en las del agente.</li><li><b>Fraude telefónico:</b> llamadas automatizadas que consumen minutos (24.12).</li></ul>',
        nums: '<ul><li>Chime SDK Voice Connector: 0.002216 USD por minuto entrante en EE. UU. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    /* ---------- Agente ---------- */
    { id: 'vad', layer: 'service', label: 'VAD', sub: '¿hay voz en este cuadro?', x: 200, y: 540,
      info: {
        resp: '<p>Decide, cuadro por cuadro, si hay voz humana. Un VAD por energía se confunde con el ruido; uno con un modelo chico, como Silero, distingue voz de música y de ruido. Corre en la CPU del worker. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>vad.push(frame_pcm16_16khz_30ms) → 0.93      probabilidad de voz\nevento speech_start / speech_end con umbral y tiempos mínimos</code></pre>',
        data: '<p>Un estado chico por sesión (el modelo es recurrente), en memoria del worker.</p>',
        fail: '<ul><li><b>Umbral bajo:</b> la tos, el teclado o la tele cortan al agente.</li><li><b>Umbral alto:</b> una voz baja no se detecta y el agente habla encima.</li></ul>',
        nums: '<ul><li>Silero: menos de 1 ms por cuadro de 30 ms en un hilo de CPU; unos 2 MB. <span class="badge badge--doc">Documentado</span></li><li>Para confirmar voz se piden unos 200 ms de habla. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    { id: 'eot', layer: 'service', label: 'Fin de turno', sub: 'silencio más lo que dijo', x: 640, y: 540,
      info: {
        resp: '<p>Decide cuándo el usuario terminó de hablar. Combina el silencio que ve el VAD con lo que dijo, según los parciales del STT: "quiero cambiar mi vuelo al…" no está terminado aunque haya silencio. Con alta probabilidad cierra el turno pronto; con baja, espera más.</p>',
        api: '<pre><code>eot.predict(historial, parcial="quiero cambiar mi vuelo al") → 0.04\nespera = min_delay si p alta; max_delay si p baja</code></pre><p>En LiveKit, <code>min_endpointing_delay</code> es 0.5 s y <code>max_endpointing_delay</code> 6 s por defecto; la Realtime API ofrece <code>server_vad</code> (500 ms de silencio por defecto) y <code>semantic_vad</code>. <span class="badge badge--doc">Documentado</span></p>',
        data: '<p>Nada propio: lee el estado del VAD y el último parcial.</p>',
        fail: '<ul><li><b>Corta antes:</b> el agente contesta a media frase y el usuario lo interrumpe.</li><li><b>Espera de más:</b> cada 100 ms de espera se suman a todos los turnos.</li></ul>',
        nums: '<ul><li>250 ms en el presupuesto de 24.8: un tercio de los 780 ms del turno. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    { id: 'worker', layer: 'service', label: 'Worker de voz', sub: 'un participante más de la sala', x: 1080, y: 540,
      info: {
        resp: '<p>El orquestador de la sesión. Entra a la sala como participante, decodifica el audio del usuario, lo pasa al VAD y al STT, decide con el detector cuándo empieza un turno, arma el contexto, llama al LLM y a las herramientas, corta el texto en frases para el TTS, manda el audio de vuelta y maneja las interrupciones. Una sesión vive en un worker de principio a fin: es afinidad por sesión, como las sticky sessions del M03.</p>',
        api: '<pre><code>on_audio_frame(frame)        → vad, stt\non_end_of_turn()             → llm.stream(ctx)\non_sentence(text)            → tts.stream(text)\non_user_speech_started()     → cancel(); truncate(audio_end_ms)</code></pre>',
        data: '<p>En memoria: el contexto de la conversación, el texto que se mandó al TTS con sus marcas de tiempo y qué parte ya sonó. Cada turno lo copia al estado de sesión para que otro worker pueda seguir si este muere.</p>',
        fail: '<ul><li><b>Muere:</b> el SFU despacha otro, que lee el estado y sigue (escenario "Un worker muere").</li><li><b>CPU al límite:</b> el VAD y la decodificación se atrasan y la latencia sube en todas sus sesiones: se dimensiona con margen.</li></ul>',
        nums: '<ul><li>80 sesiones por worker de 8 vCPU; 500 en el pico para 30 000 sesiones. <span class="badge badge--ref">Diseño de referencia</span></li><li>Jitter buffer de entrada: 30 ms.</li><li>Una trace por turno, con una marca en cada salto (M11).</li></ul>'
      } },
    { id: 'tools', layer: 'external', label: 'Herramientas', sub: 'las APIs de tu negocio', x: 1520, y: 540,
      info: {
        resp: '<p>Las APIs que el agente llama para hacer algo: buscar un vuelo, cambiar una reserva, consultar un saldo. En voz importan más que en texto, porque el usuario espera en silencio.</p>',
        api: '<pre data-lang="http"><code>GET /flights/AV204/seats?date=2026-10-09\n200 {"available": 12, "fare_difference_usd": "40.00"}</code></pre>',
        data: '<p>Las de cada sistema. Las que cambian algo llevan una idempotency key por turno, para que un reintento después de una caída no cambie dos veces la reserva (M27).</p>',
        fail: '<ul><li><b>Lenta:</b> a los 700 ms el agente dice una frase de relleno; a los 8 s se rinde y lo dice (escenario "Una herramienta lenta").</li><li><b>Caída:</b> degradación elegida (M08): ofrecer pasar a una persona.</li></ul>',
        nums: '<ul><li>Timeout por herramienta de 8 s, con deadline del turno. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    /* ---------- Modelos ---------- */
    { id: 'stt', layer: 'gpu', label: 'STT en streaming', sub: 'parciales y finales', x: 640, y: 750,
      info: {
        resp: '<p>Transcribe el audio mientras llega. Emite resultados parciales, que pueden cambiar, y un resultado final por segmento. El detector de fin de turno lee los parciales; el LLM recibe el final.</p>',
        api: '<pre data-lang="json"><code>{"type": "partial", "text": "quiero cambiar mi vuelo del"}\n{"type": "final", "text": "Quiero cambiar mi vuelo del viernes.", "words": [{"w": "Quiero", "start": 0.12, "end": 0.41}, …]}</code></pre>',
        data: '<p>Un stream abierto por sesión mientras el usuario habla. El vocabulario propio (nombres de productos, códigos de vuelo) se le pasa al abrir el stream.</p>',
        fail: '<ul><li><b>Lento:</b> el final tarda y todo el turno se corre; se puede arrancar el LLM con el parcial estable y descartar si el final cambia.</li><li><b>Se equivoca con un nombre:</b> el LLM contesta sobre otra cosa; el vocabulario propio ayuda.</li></ul>',
        nums: '<ul><li>50 ms del final en el presupuesto de 24.8.</li><li>Una L4 cada 300 sesiones en la flota propia. <span class="badge badge--ref">Diseño de referencia</span></li><li>Por API: gpt-4o-transcribe, 0.006 USD por minuto. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'llm', layer: 'gpu', label: 'LLM', sub: 'la flota del M19, en la región', x: 1080, y: 750,
      info: {
        resp: '<p>El mismo motor de los módulos anteriores, con otras prioridades: el TTFT pesa más que el TPOT, porque el TTS arranca con la primera frase. Las respuestas son cortas y para decir en voz alta: sin markdown, sin listas, con números escritos como se leen.</p>',
        api: '<pre data-lang="json"><code>{"model": "modelo-m", "stream": true, "max_tokens": 150,\n "messages": [{"role": "system", "content": "Eres un agente telefónico… Responde en una o dos frases."}, …]}</code></pre>',
        data: '<p>El historial va en el prefijo cacheado (M16): cada turno agrega unas decenas de tokens, así que el prefill es corto aunque la conversación sea larga.</p>',
        fail: '<ul><li><b>TTFT alto en el pico:</b> el router prioriza las sesiones de voz (M18, M19).</li><li><b>Respuesta larga:</b> se habla igual, frase por frase, pero el usuario se cansa y la interrumpe.</li></ul>',
        nums: '<ul><li>1 667 turnos por segundo × 30 tokens × 25 ms = 1 250 generaciones en curso: 27 réplicas a 64 por réplica y al 75&#8239;% de uso.</li><li>TTFT de 150 ms en el presupuesto. <span class="badge badge--ref">Diseño de referencia</span></li></ul>'
      } },
    { id: 'tts', layer: 'gpu', label: 'TTS en streaming', sub: 'primer audio y marcas de tiempo', x: 1520, y: 750,
      info: {
        resp: '<p>Convierte texto en voz frase por frase y devuelve el audio en trozos apenas los tiene, con la marca de tiempo de cada palabra. Esas marcas son las que permiten saber qué se dijo hasta el punto exacto de una interrupción.</p>',
        api: '<pre data-lang="json"><code>{"text": "Claro, te ayudo con eso.", "voice": "v_marina", "format": "pcm_24000"}\n→ chunks de audio + {"word": "Claro", "start_ms": 0, "end_ms": 310}</code></pre>',
        data: '<p>Las voces, que son datos sensibles: una voz clonada necesita el consentimiento de su dueño (24.12).</p>',
        fail: '<ul><li><b>Primer audio lento:</b> se nota entero en la latencia; las frases de relleno se sintetizan antes y se guardan.</li><li><b>Sin marcas de tiempo:</b> no se puede truncar bien una interrupción.</li></ul>',
        nums: '<ul><li>80 ms hasta el primer audio en el presupuesto de 24.8; una L4 cada 200 sesiones. <span class="badge badge--ref">Diseño de referencia</span></li><li>Por API: gpt-4o-mini-tts, unos 0.015 USD por minuto. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 's2s', layer: 'external', label: 'Speech-to-speech', sub: 'Realtime API: audio entra, audio sale', x: 1960, y: 750,
      info: {
        resp: '<p>La alternativa a la cascada: un solo modelo que recibe audio y devuelve audio, con su propio VAD y detección de turno del lado del servidor. Escucha el tono y las pausas, y su latencia es menor; a cambio, controlas menos el texto y pagas más por minuto.</p>',
        api: '<pre data-lang="json"><code>{"type": "session.update", "session": {"turn_detection": {"type": "semantic_vad", "eagerness": "auto"}}}\n{"type": "input_audio_buffer.speech_started", "audio_start_ms": 5230}\n{"type": "conversation.item.truncate", "item_id": "item_…", "content_index": 0, "audio_end_ms": 5540}</code></pre><p>Audio PCM a 24 kHz; sesiones de hasta 60 minutos; por WebRTC el servidor trunca solo al interrumpir, por WebSocket lo hace el cliente. <span class="badge badge--doc">Documentado</span></p>',
        data: '<p>La conversación vive en la sesión del proveedor y se vuelve a mandar entera en cada respuesta; el caché de prompts abarata lo repetido.</p>',
        fail: '<ul><li><b>La sesión llega a 60 minutos:</b> se abre otra con un resumen del contexto.</li><li><b>El proveedor se degrada:</b> no hay plan B dentro del mismo modelo; la cascada propia lo es.</li></ul>',
        nums: '<ul><li>Audio de entrada: 1 token cada 100 ms; de salida, 1 cada 50 ms; gpt-realtime cobra 32 y 64 USD por millón. <span class="badge badge--doc">Documentado</span></li><li>Una llamada de 10 minutos: unos 0.52 USD con caché (24.11).</li></ul>'
      } },
    /* ---------- Plataforma ---------- */
    { id: 'metering', layer: 'queue', label: 'Eventos de uso', sub: 'el pipeline del M21', x: 640, y: 960,
      info: {
        resp: '<p>Cada sesión emite eventos de uso por tramos, no uno al final: segundos de audio de entrada y de salida, tokens del LLM y minutos de teléfono. Así una sesión de una hora no queda sin medir si el worker muere a los 50 minutos.</p>',
        api: '<pre data-lang="json"><code>{"event_id": "ses_81:t14", "org_id": "org_7",\n "units": {"audio_in_s": 4.2, "audio_out_s": 9.1, "input_tokens": 3120, "cache_read_tokens": 2900, "output_tokens": 34}}</code></pre>',
        data: '<p>El mismo log de Kafka y el mismo procesador del M21: el <code>event_id</code> por turno permite descartar los duplicados.</p>',
        fail: '<ul><li><b>Worker muerto sin cerrar su tramo:</b> la conciliación lo reconstruye con el registro del SFU (M21).</li></ul>',
        nums: '<ul><li>Un evento por turno: 1 667 por segundo en el pico.</li></ul>'
      } },
    { id: 'moderacion', layer: 'service', label: 'Moderación', sub: 'el texto antes de decirlo', x: 1080, y: 960,
      info: {
        resp: '<p>Los guardrails del M22 aplicados a la voz: el texto del usuario (la transcripción) y el texto del agente antes de pasar al TTS. En tiempo real no hay espera posible: corre en paralelo con la primera frase y, si marca algo, corta el audio.</p>',
        api: '<pre><code>moderate(texto_frase) → {"flagged": false, "categories": {…}}</code></pre>',
        data: '<p>Las frases marcadas, con la sesión, para revisión.</p>',
        fail: '<ul><li><b>Cae:</b> falla cerrada para lo que el agente dice (frases fijas y pasar a una persona) y abierta para registrar lo que dice el usuario.</li><li><b>La tasa base de M22:</b> con muchos turnos, un 1&#8239;% de falsos positivos son miles de cortes por hora.</li></ul>',
        nums: '<ul><li>Un clasificador chico por frase: unos milisegundos.</li></ul>'
      } },
    { id: 'sesion', layer: 'cache', label: 'Estado de sesión', sub: 'Redis: contexto y transcripción', x: 1520, y: 960,
      info: {
        resp: '<p>Lo que hace falta para que otro worker siga la conversación: el contexto resumido, los turnos recientes, qué parte de la última respuesta sonó y qué herramientas quedaron a medias. Al cerrar la sesión, la transcripción (y la grabación, si hubo consentimiento) se copia a S3.</p>',
        api: '<pre data-lang="json"><code>HSET ses:81 turns 14 summary "Cambio de vuelo AV204 del 9 de octubre…"\n             last_item item_7f last_audio_end_ms 3120 tools_pending "[]"</code></pre>',
        data: '<p>Un hash por sesión, con TTL de 2 horas. Las transcripciones y las grabaciones tienen su propia retención y entran en el borrado de datos del M22.</p>',
        fail: '<ul><li><b>Se pierde el último turno:</b> el worker nuevo pregunta "¿me repites lo último?" en lugar de inventar.</li></ul>',
        nums: '<ul><li>Una escritura por turno: 1 667 por segundo en el pico.</li></ul>'
      } }
  ],
  edges: [
    { id: 'e1', from: 'app', to: 'appsrv', both: true, label: 'token' },
    { id: 'e2', from: 'app', to: 'stun', both: true, label: '¿mi IP?' },
    { id: 'e3', from: 'app', to: 'turn', both: true, label: 'relay' },
    { id: 'e4', from: 'app', to: 'sfu', both: true, label: 'SRTP sobre UDP', labelAt: 0.62 },
    { id: 'e5', from: 'turn', to: 'sfu', both: true, label: 'audio retransmitido' },
    { id: 'e6', from: 'pstn', to: 'sip', both: true, label: 'llamada' },
    { id: 'e7', from: 'sip', to: 'sfu', both: true, label: 'RTP' },
    { id: 'e8', from: 'sfu', to: 'worker', both: true, label: 'audio de la sala' },
    { id: 'e9', from: 'vad', to: 'worker', both: true, label: 'cuadros y eventos', bend: -200 },
    { id: 'e10', from: 'vad', to: 'eot', label: 'voz o silencio' },
    { id: 'e11', from: 'eot', to: 'worker', label: 'fin de turno' },
    { id: 'e12', from: 'worker', to: 'stt', both: true, label: 'audio', labelAt: 0.45 },
    { id: 'e13', from: 'stt', to: 'eot', label: 'parciales' },
    { id: 'e14', from: 'worker', to: 'llm', both: true, label: 'contexto' },
    { id: 'e16', from: 'worker', to: 'tts', both: true, label: 'frases y audio', labelAt: 0.45 },
    { id: 'e17', from: 'worker', to: 's2s', both: true, label: 'audio en los dos sentidos', labelAt: 0.6 },
    { id: 'e18', from: 'worker', to: 'tools', both: true, label: 'herramientas' },
    { id: 'e19', from: 'llm', to: 'moderacion', label: 'texto' },
    { id: 'e20', from: 'worker', to: 'metering', async: true, label: 'uso por turno', labelAt: 0.6 },
    { id: 'e21', from: 'worker', to: 'sesion', both: true, label: 'estado', labelAt: 0.6 }
  ],
  scenarios: [
    {
      id: 'turno', title: 'Un turno en cascada: 780 ms',
      desc: 'El usuario dice "Quiero cambiar mi vuelo del viernes" y calla. Se sigue el camino crítico hasta que oye "Claro". Los pasos en paralelo suman 0 ms; el total es el presupuesto de 24.8.',
      steps: [
        { at: 'app', kind: 'info', tag: 'el usuario calla', ms: 30, title: 'Último cuadro', text: 'El último cuadro de 20 ms se captura, pasa por la cancelación de eco y el códec Opus lo comprime.' },
        { from: 'app', to: 'sfu', kind: 'req', tag: 'SRTP · 20 ms de audio', ms: 25, title: 'Al SFU más cercano', text: 'Por UDP, a la región del usuario: 80 bytes de audio y 50 de cabeceras.' },
        { from: 'sfu', to: 'worker', kind: 'req', tag: 'RTP', ms: 0, title: 'Reenvío', text: 'El SFU reenvía el paquete al worker, el otro participante de la sala, sin decodificarlo. Dentro de la región tarda menos de un milisegundo.' },
        { at: 'worker', kind: 'info', tag: 'jitter buffer', ms: 30, title: 'Ordenar y decodificar', text: 'El jitter buffer espera 30 ms para absorber el jitter de red; después decodifica a PCM.' },
        { from: 'worker', to: 'vad', kind: 'req', tag: 'cuadros PCM', ms: 0, title: 'En paralelo: el VAD', text: 'El VAD ve cada cuadro: ya no hay voz.' },
        { from: 'worker', to: 'stt', kind: 'req', tag: 'audio en streaming', ms: 0, title: 'En paralelo: el STT', text: 'El STT recibe el audio desde que el usuario empezó a hablar, así que casi todo ya está transcrito.' },
        { from: 'stt', to: 'eot', kind: 'res', tag: 'parcial: «…mi vuelo del viernes»', ms: 0, title: 'Parcial', text: 'El detector de fin de turno lee el parcial: la frase suena terminada.' },
        { from: 'vad', to: 'eot', kind: 'res', tag: 'silencio', ms: 0, title: 'Silencio', text: 'El VAD informa silencio desde el último cuadro con voz.' },
        { at: 'eot', kind: 'info', tag: 'p = 0.92', ms: 250, title: 'Fin de turno', text: 'Con 250 ms de silencio y una frase completa, el modelo da alta probabilidad de que el usuario terminó. Solo con un umbral de silencio habría esperado 500 ms.' },
        { from: 'eot', to: 'worker', kind: 'res', tag: 'fin de turno', ms: 0, title: 'Turno cerrado', text: 'El worker arranca el turno del agente.' },
        { from: 'stt', to: 'worker', kind: 'res', tag: 'final', ms: 50, title: 'Resultado final', text: 'El worker pide cerrar el segmento; el final llega 50 ms después: "Quiero cambiar mi vuelo del viernes."' },
        { from: 'worker', to: 'llm', kind: 'req', tag: 'historial + turno', ms: 0, title: 'Al LLM', text: 'System prompt, historial y la frase nueva. El prefijo está en el caché de prompts (M16), así que el prefill es corto.', code: '{"model": "modelo-m", "stream": true, "max_tokens": 150,\n "messages": [… 14 turnos …, {"role": "user", "content": "Quiero cambiar mi vuelo del viernes."}]}', lang: 'json' },
        { at: 'llm', kind: 'info', tag: 'TTFT', ms: 150, title: 'Primer token', text: 'Prefill del turno nuevo y primer token.' },
        { from: 'llm', to: 'moderacion', kind: 'async', tag: 'frase', ms: 0, title: 'En paralelo: moderación', text: 'Cada frase pasa por el clasificador mientras el TTS empieza. Si marca algo, el worker corta el audio.' },
        { from: 'llm', to: 'worker', kind: 'res', tag: 'tokens hasta el punto', ms: 100, title: 'Primera frase', text: 'El worker acumula tokens hasta tener una frase que se pueda decir; el punto llega unos 100 ms después del primer token.' },
        { from: 'worker', to: 'tts', kind: 'req', tag: '«Claro, te ayudo con eso.»', ms: 0, title: 'Al TTS', text: 'La primera frase sale al TTS mientras el LLM sigue generando la segunda.' },
        { at: 'tts', kind: 'info', tag: 'primer audio', ms: 80, title: 'Primer audio', text: 'El TTS devuelve el primer trozo de audio con las marcas de tiempo de cada palabra.' },
        { from: 'tts', to: 'worker', kind: 'res', tag: 'audio + marcas', ms: 0, title: 'Al worker', text: 'El worker guarda las marcas: las va a necesitar si el usuario interrumpe.' },
        { from: 'worker', to: 'sfu', kind: 'res', tag: 'RTP', ms: 0, title: 'A la sala', text: 'Codificado en Opus y publicado en la sala.' },
        { from: 'sfu', to: 'app', kind: 'res', tag: 'SRTP', ms: 25, title: 'De vuelta', text: 'Red de vuelta hasta el teléfono.' },
        { at: 'app', kind: 'info', tag: '«Claro…»', ms: 40, title: 'El usuario oye la respuesta', text: 'Jitter buffer del cliente y reproducción. 780 ms desde que el usuario calló: casi cuatro veces el silencio típico entre dos personas.' },
        { from: 'worker', to: 'metering', kind: 'async', tag: 'uso del turno', ms: 0, title: 'Uso', text: 'Segundos de audio, tokens y el id del turno.' },
        { from: 'worker', to: 'sesion', kind: 'async', tag: 'turno 15', ms: 0, title: 'Estado', text: 'El turno queda guardado para que otro worker pueda seguir.' }
      ]
    },
    {
      id: 'interrupcion', title: 'Una interrupción a mitad de frase',
      desc: 'El agente va por "…puedo cambiarlo" cuando el usuario dice "No, no, déjalo así". Son los números del simulador de 24.9: el usuario empieza a hablar a los 5 230 ms y el audio del agente se corta a los 5 540.',
      steps: [
        { at: 'app', kind: 'info', tag: 'el agente habla', ms: 0, title: 'El agente va por la mitad', text: 'Lleva 5.2 s de una respuesta de 10.4 s. Lo que falta, con el precio del cambio, ya está generado y en camino.' },
        { at: 'app', kind: 'info', tag: '«No, no…»', ms: 30, title: 'El usuario habla encima', text: 'La cancelación de eco resta la voz del agente que sale por el parlante; queda la del usuario.' },
        { from: 'app', to: 'sfu', kind: 'req', tag: 'SRTP', ms: 25, title: 'Al SFU', text: 'Como cualquier otro cuadro.' },
        { from: 'sfu', to: 'worker', kind: 'req', tag: 'RTP', ms: 0, title: 'Al worker', text: 'Reenvío dentro de la región.' },
        { at: 'worker', kind: 'info', tag: 'jitter buffer', ms: 30, title: 'Decodificar', text: '85 ms después de que el usuario empezó, su audio está en el worker.' },
        { from: 'worker', to: 'vad', kind: 'req', tag: 'cuadros', ms: 0, title: 'Al VAD', text: 'El VAD sigue escuchando mientras habla el agente: es lo que permite interrumpir.' },
        { at: 'vad', kind: 'info', tag: '200 ms de voz', ms: 200, title: 'Voz confirmada', text: 'Pide 200 ms de habla seguida antes de confirmar, para no cortar con un golpe o un "ajá".' },
        { from: 'vad', to: 'worker', kind: 'res', tag: 'speech_started', ms: 0, title: 'Interrupción', text: 'Con <code>interrupt_response</code>, una voz confirmada mientras habla el agente es una interrupción.' },
        { from: 'worker', to: 'llm', kind: 'req', tag: 'cancelar', ms: 0, title: 'Cancelar la generación', text: 'Si el modelo sigue generando, se cancela, como un cliente que se va (M17).' },
        { from: 'worker', to: 'tts', kind: 'req', tag: 'descartar', ms: 0, title: 'Vaciar el TTS', text: 'Las frases que no salieron se descartan.' },
        { from: 'worker', to: 'sfu', kind: 'req', tag: 'dejar de publicar', ms: 0, title: 'Silencio en la sala', text: 'El worker deja de mandar audio.' },
        { from: 'sfu', to: 'app', kind: 'req', tag: 'clear', ms: 25, title: 'El cliente calla', text: 'El cliente vacía su buffer. El agente habló 310 ms encima del usuario: 30 + 25 + 30 + 200 + 25.' },
        { at: 'worker', kind: 'info', tag: 'truncar en 5 540 ms', ms: 0, title: 'Truncar lo que no sonó', text: 'Con las marcas de tiempo del TTS, el worker sabe que sonó hasta "puedo cambiarlo" y borra el resto del contexto. Sin esto, el modelo cree que ya dijo el precio.', code: '{"type": "conversation.item.truncate", "item_id": "item_7f",\n "content_index": 0, "audio_end_ms": 5540}', lang: 'json' },
        { from: 'worker', to: 'sesion', kind: 'async', tag: 'turno truncado', ms: 0, title: 'Estado', text: 'El turno se guarda con lo que el usuario oyó de verdad.' }
      ]
    },
    {
      id: 'pausa', title: 'Una pausa larga y un falso fin de turno',
      desc: 'El usuario dice "Quiero cambiar mi vuelo al…", piensa 700 ms y sigue: "…del viernes". Con un umbral de silencio de 500 ms, el agente lo habría cortado.',
      steps: [
        { from: 'app', to: 'sfu', kind: 'req', tag: '«…mi vuelo al…»', ms: 55, title: 'Primera mitad', text: 'Captura y red de ida.' },
        { from: 'sfu', to: 'worker', kind: 'req', tag: 'RTP', ms: 0, title: 'Al worker', text: 'Reenvío.' },
        { from: 'stt', to: 'eot', kind: 'res', tag: 'parcial: «…mi vuelo al»', ms: 0, title: 'Un parcial sin terminar', text: 'Termina en "al", una preposición.' },
        { from: 'vad', to: 'eot', kind: 'res', tag: 'silencio', ms: 0, title: 'Silencio', text: 'El usuario está pensando.' },
        { at: 'eot', kind: 'info', tag: 'p = 0.04', ms: 500, title: 'No cierra el turno', text: 'A los 500 ms, <code>server_vad</code> con sus valores por defecto ya habría cerrado el turno. El detector lee el parcial y da una probabilidad muy baja de que el usuario terminó, así que extiende la espera hacia el máximo.' },
        { at: 'app', kind: 'info', tag: '«…del viernes»', ms: 200, title: 'El usuario sigue', text: 'A los 700 ms de silencio, sigue hablando.' },
        { from: 'app', to: 'sfu', kind: 'req', tag: 'SRTP', ms: 25, title: 'Segunda mitad', text: 'Llega como cualquier otro audio.' },
        { from: 'stt', to: 'eot', kind: 'res', tag: 'parcial: «…al del viernes»', ms: 0, title: 'Ahora sí', text: 'La frase está completa.' },
        { at: 'eot', kind: 'info', tag: 'p = 0.9', ms: 250, title: 'Fin de turno', text: '250 ms de silencio con una frase terminada.' },
        { from: 'eot', to: 'worker', kind: 'res', tag: 'fin de turno', ms: 0, title: 'Turno cerrado', text: 'Sin el detector, el agente habría empezado "¿A qué vuelo?" a los 500 ms, el usuario habría seguido encima, y el turno habría terminado en una interrupción y una respuesta tirada.' }
      ]
    },
    {
      id: 'perdida', title: '4G en movimiento: jitter y pérdida',
      desc: 'El usuario habla desde un auto. Los paquetes llegan con jitter de red alto y alguno se pierde. Son los números del simulador de 24.4.',
      steps: [
        { from: 'app', to: 'sfu', kind: 'req', tag: 'cuadros con jitter', ms: 25, title: 'Llegan desordenados', text: 'Algunos paquetes tardan 150 ms más que otros.' },
        { at: 'sfu', kind: 'info', tag: 'sin retransmitir', ms: 0, title: 'No se retransmite', text: 'Pedir de nuevo un paquete de audio cuesta un RTT más y casi siempre llega tarde para su turno de reproducción. El SFU reenvía lo que llega.' },
        { from: 'sfu', to: 'worker', kind: 'req', tag: 'RTP', ms: 0, title: 'Al worker', text: 'Reenvío.' },
        { at: 'worker', kind: 'info', tag: 'buffer: 30 → 85 ms', ms: 85, title: 'El buffer crece', text: 'El jitter buffer adaptativo mide el jitter de los últimos paquetes y crece: en la simulación, 85 ms en promedio. Son 55 ms más en cada turno.' },
        { at: 'worker', kind: 'info', tag: 'FEC', ms: 0, title: 'Recuperado con FEC', text: 'Un paquete se perdió, pero el siguiente trae una copia de menor calidad (FEC en banda del códec Opus) y llegó a tiempo. Con FEC y 60 ms de buffer, se disimula el 2&#8239;% del audio; sin FEC, el 11.6&#8239;%.' },
        { at: 'worker', kind: 'fail', tag: 'PLC: 40 ms', ms: 0, title: 'Dos perdidos seguidos', text: 'Ni FEC alcanza: el decodificador inventa 40 ms de audio a partir de lo anterior (PLC).' },
        { from: 'worker', to: 'stt', kind: 'req', tag: 'audio con un hueco', ms: 0, title: 'Al STT', text: 'Una sílaba disimulada puede cambiar una palabra. Por eso el STT recibe el audio ya pasado por el jitter buffer, nunca los paquetes crudos.' },
        { from: 'sfu', to: 'app', kind: 'res', tag: 'RTCP: 4 % de pérdida', ms: 25, title: 'El cliente se adapta', text: 'Los reportes RTCP le dicen al cliente cuánto se pierde; el control de congestión baja el bitrate del códec Opus y sube la redundancia.' }
      ]
    },
    {
      id: 'red', title: 'De wifi a datos móviles',
      desc: 'El usuario sale de su casa a mitad de la conversación. La IP cambia y el camino de audio se rompe. ICE restart arma uno nuevo sin cerrar la sesión.',
      steps: [
        { at: 'app', kind: 'fail', tag: 'se pierde el wifi', ms: 0, title: 'Cambia la red', text: 'El sistema operativo avisa el cambio de interfaz; la app no espera a notar que los paquetes dejaron de llegar.' },
        { from: 'app', to: 'stun', kind: 'req', tag: 'binding', ms: 40, title: 'Nueva IP pública', text: 'Desde la interfaz de datos: ¿con qué IP me ven ahora?' },
        { from: 'stun', to: 'app', kind: 'res', tag: '201.1.8.40:62011', ms: 40, title: 'Candidato nuevo', text: 'Un candidato "server reflexive" nuevo, detrás del NAT del operador.' },
        { from: 'app', to: 'sfu', kind: 'req', tag: 'ICE restart', ms: 150, title: 'Señalización por la red nueva', text: 'El WebSocket de señalización se reconecta (TCP y TLS) y lleva credenciales ICE nuevas con los candidatos.' },
        { from: 'sfu', to: 'app', kind: 'res', tag: 'candidatos del SFU', ms: 30, title: 'Respuesta', text: 'Los candidatos del SFU no cambiaron.' },
        { from: 'app', to: 'sfu', kind: 'req', tag: 'chequeos de conectividad', ms: 60, title: 'Ruta nueva', text: 'ICE prueba el par nuevo y lo elige. DTLS no se repite si el SFU conserva la sesión.' },
        { at: 'worker', kind: 'info', tag: 'hueco de ~320 ms', ms: 0, title: 'El worker ni se enteró', text: 'Para el worker fue un hueco de unos 320 ms: 40 + 40 + 150 + 30 + 60. Si hablaba el usuario, se perdieron esas sílabas; si hablaba el agente, conviene pausar el audio y retomarlo, en lugar de mandarlo al vacío.' },
        { from: 'worker', to: 'sesion', kind: 'async', tag: 'evento: cambio de red', ms: 0, title: 'Registro', text: 'Queda en la trace del turno: explica una transcripción rara.' }
      ]
    },
    {
      id: 'firewall', title: 'Una red que solo deja salir el 443',
      desc: 'El usuario está en la red de una empresa que bloquea UDP y todo puerto que no sea 443. WebRTC funciona igual, por TURN sobre TLS, con un costo.',
      steps: [
        { from: 'app', to: 'appsrv', kind: 'req', tag: 'POST /voice/session', ms: 40, title: 'HTTPS sí pasa', text: 'La sesión se crea como siempre.' },
        { from: 'appsrv', to: 'app', kind: 'res', tag: 'token + servidores ICE', ms: 40, title: 'Credenciales de TURN', text: 'Incluye un TURN por TLS en el 443.', code: '{"ice_servers": [{"urls": ["stun:stun.example.com:3478"]},\n  {"urls": ["turns:turn.example.com:443?transport=tcp"], "username": "1760000000:u_42", "credential": "…"}]}', lang: 'json' },
        { from: 'app', to: 'stun', kind: 'fail', tag: 'UDP descartado', ms: 0, title: 'Sin respuesta', text: 'La red descarta el UDP: no hay candidato "server reflexive". ICE prueba todos los pares en paralelo, así que no espera a que este falle.' },
        { from: 'app', to: 'turn', kind: 'req', tag: 'TURN sobre TLS, 443', ms: 120, title: 'Por el relay', text: 'TCP, TLS y la asignación: unos tres RTT. Para el firewall parece HTTPS.' },
        { from: 'turn', to: 'sfu', kind: 'req', tag: 'audio por UDP', ms: 1, title: 'Del relay al SFU', text: 'Dentro de la nube, el TURN sigue por UDP.' },
        { at: 'app', kind: 'info', tag: 'audio sobre TCP', ms: 0, title: 'Funciona, con head-of-line blocking', text: 'Un paquete perdido frena a todos los que siguen hasta que TCP lo retransmite (M01). El jitter buffer crece y cada turno suma latencia. Por eso el TURN por TLS es el último recurso, no la opción por defecto.' }
      ]
    },
    {
      id: 'worker-muere', title: 'Un worker muere a mitad del turno',
      desc: 'El nodo del worker se recicla mientras el agente habla. El SFU despacha otro worker, que lee el estado y sigue sin inventar.',
      steps: [
        { at: 'worker', kind: 'fail', tag: 'se recicla el nodo', ms: 0, title: 'Muere el worker', text: 'Una instancia spot reclamada o un OOM. Sus 80 sesiones se quedan sin agente.', down: ['worker'] },
        { at: 'sfu', kind: 'info', tag: 'participante perdido', ms: 2000, title: 'El SFU lo nota', text: 'El participante del agente dejó de mandar y su conexión se cerró. Unos 2 s, según los timeouts. <span class="badge badge--ref">Diseño de referencia</span>' },
        { at: 'sfu', kind: 'info', tag: 'despachar otro', ms: 200, title: 'Otro worker', text: 'Un worker de la flota con capacidad libre acepta la sala.', up: ['worker'] },
        { from: 'worker', to: 'sesion', kind: 'req', tag: 'HGETALL ses:81', ms: 2, title: 'Leer el estado', text: 'Contexto resumido, turnos recientes y qué parte de la última respuesta sonó.' },
        { from: 'sesion', to: 'worker', kind: 'res', tag: 'estado del turno 14', ms: 1, title: 'Estado', text: 'El último turno guardado es el 14; el 15 estaba en curso.', code: '{"turns": 14, "summary": "Cambio de vuelo AV204 del 9 de octubre…",\n "last_item": "item_7f", "last_audio_end_ms": 3120, "tools_pending": []}', lang: 'json' },
        { from: 'worker', to: 'sfu', kind: 'req', tag: 'unirse a la sala', ms: 50, title: 'Entra a la sala', text: 'Mismo token de sala, participante nuevo.' },
        { from: 'worker', to: 'tts', kind: 'req', tag: '«Perdón, se me cortó…»', ms: 80, title: 'No inventa', text: 'No sabe qué dijo el usuario en el turno 15, así que lo pregunta: "Perdón, se me cortó. ¿Me repites lo último?"' },
        { from: 'tts', to: 'worker', kind: 'res', tag: 'audio', ms: 0, title: 'Audio', text: 'Primer trozo.' },
        { from: 'worker', to: 'sfu', kind: 'res', tag: 'RTP', ms: 0, title: 'A la sala', text: 'Publicado.' },
        { from: 'sfu', to: 'app', kind: 'res', tag: 'SRTP', ms: 65, title: 'El usuario lo oye', text: 'Unos 2.4 s de silencio en total. Una herramienta que había cambiado algo no se repite: lleva su idempotency key del turno.' },
        { from: 'worker', to: 'metering', kind: 'async', tag: 'tramo reconstruido', ms: 0, title: 'El uso perdido', text: 'El worker muerto no cerró su evento del turno 15; la conciliación del M21 lo reconstruye con el registro del SFU.' }
      ]
    },
    {
      id: 'telefono', title: 'Una llamada telefónica por SIP',
      desc: 'Alguien llama al número del banco desde un teléfono fijo. El agente es el mismo; cambian la entrada, el códec y lo que cuesta cada minuto.',
      steps: [
        { from: 'pstn', to: 'sip', kind: 'req', tag: 'INVITE', ms: 0, title: 'Entra la llamada', text: 'Por un troncal SIP, por ejemplo Chime SDK Voice Connector.' },
        { from: 'sip', to: 'sfu', kind: 'req', tag: 'nuevo participante', ms: 20, title: 'A una sala', text: 'El gateway crea la sala y entra como participante.' },
        { from: 'sfu', to: 'worker', kind: 'req', tag: 'despachar agente', ms: 50, title: 'Un worker', text: 'Igual que con una app.' },
        { at: 'worker', kind: 'info', tag: 'saludo en caché', ms: 0, title: 'El primer audio no espera', text: 'El saludo ya está sintetizado: "Hola, soy el asistente del banco. ¿En qué te ayudo?"' },
        { from: 'pstn', to: 'sip', kind: 'req', tag: 'G.711, 8 kHz', ms: 0, title: 'Audio telefónico', text: '8 kHz y 64 kbps: la mitad del ancho de banda de voz que captura una app.' },
        { from: 'sip', to: 'sfu', kind: 'req', tag: 'RTP', ms: 0, title: 'A la sala', text: 'Sin transcodificar: el worker decodifica.' },
        { from: 'sfu', to: 'worker', kind: 'req', tag: 'RTP', ms: 0, title: 'Al worker', text: 'Reenvío.' },
        { at: 'worker', kind: 'info', tag: '8 kHz → 16 kHz', ms: 0, title: 'Reescalar no recupera', text: 'Subir la frecuencia de muestreo no devuelve los agudos perdidos: conviene un STT ajustado con audio telefónico.' },
        { at: 'worker', kind: 'info', tag: 'DTMF: 4', ms: 0, title: 'El usuario marca', text: 'Los dígitos llegan como eventos (RFC 4733), no como audio: no pasan por el STT.' },
        { from: 'worker', to: 'metering', kind: 'async', tag: 'minutos de teléfono', ms: 0, title: 'Otro costo', text: 'Cada minuto entrante cuesta 0.002216 USD en el troncal, además del agente. <span class="badge badge--doc">Documentado</span>' }
      ]
    },
    {
      id: 'herramienta', title: 'Una herramienta lenta y una frase de relleno',
      desc: '"¿Hay asientos en el de las 10:15?" El modelo llama a una herramienta que tarda 2.4 s. El usuario no puede quedarse en silencio.',
      steps: [
        { from: 'worker', to: 'llm', kind: 'req', tag: 'turno', ms: 0, title: 'Al LLM', text: 'El turno, con las herramientas disponibles.' },
        { at: 'llm', kind: 'info', tag: 'TTFT', ms: 150, title: 'Decide usar una herramienta', text: 'El primer token es una llamada a herramienta, no texto.' },
        { from: 'llm', to: 'worker', kind: 'res', tag: 'buscar_asientos(AV204)', ms: 50, title: 'Tool call', text: 'Los argumentos completos llegan en unos tokens más.' },
        { from: 'worker', to: 'tools', kind: 'req', tag: 'GET /flights/AV204/seats', ms: 0, title: 'A la API', text: 'Con un deadline de 8 s para el turno (M08).' },
        { at: 'worker', kind: 'info', tag: '700 ms sin respuesta', ms: 700, title: 'El silencio pesa', text: 'Pasados 700 ms, el worker no deja al usuario esperando en silencio.' },
        { from: 'worker', to: 'sfu', kind: 'res', tag: '«Dame un segundo, lo reviso.»', ms: 0, title: 'Frase de relleno', text: 'Sintetizada de antemano y guardada: no pasa por el LLM ni por el TTS.' },
        { from: 'sfu', to: 'app', kind: 'res', tag: 'SRTP', ms: 65, title: 'El usuario oye algo', text: 'Ahora sabe que el agente lo escuchó.' },
        { from: 'tools', to: 'worker', kind: 'res', tag: '12 asientos, +40 USD', ms: 1635, title: 'La API contesta', text: '2.4 s después de la llamada.' },
        { from: 'worker', to: 'llm', kind: 'req', tag: 'resultado', ms: 0, title: 'De vuelta al LLM', text: 'El resultado como mensaje de herramienta.' },
        { at: 'llm', kind: 'info', tag: 'TTFT', ms: 150, title: 'Primer token', text: 'Prefill corto: solo el resultado es nuevo.' },
        { from: 'llm', to: 'worker', kind: 'res', tag: 'tokens hasta el punto', ms: 100, title: 'Primera frase', text: 'El worker junta la primera frase.' },
        { from: 'worker', to: 'tts', kind: 'req', tag: '«Sí, quedan 12.»', ms: 0, title: 'Al TTS', text: 'Frase por frase.' },
        { at: 'tts', kind: 'info', tag: 'primer audio', ms: 80, title: 'Primer audio', text: 'Del TTS en streaming.' },
        { from: 'tts', to: 'worker', kind: 'res', tag: 'audio', ms: 0, title: 'Al worker', text: 'Con marcas de tiempo.' },
        { from: 'worker', to: 'sfu', kind: 'res', tag: 'RTP', ms: 0, title: 'A la sala', text: 'Publicado.' },
        { from: 'sfu', to: 'app', kind: 'res', tag: '«Sí, quedan 12…»', ms: 65, title: 'Respuesta', text: 'Tres segundos desde que el usuario calló, pero con una frase de relleno antes del primer segundo.' }
      ]
    },
    {
      id: 's2s', title: 'El mismo turno con speech-to-speech: 700 ms',
      desc: 'El worker manda el audio a un modelo que recibe y devuelve audio, con su propio VAD en el servidor. Desaparecen el STT, la primera frase y el TTS.',
      steps: [
        { at: 'app', kind: 'info', tag: 'el usuario calla', ms: 30, title: 'Último cuadro', text: 'Captura y códec.' },
        { from: 'app', to: 'sfu', kind: 'req', tag: 'SRTP', ms: 25, title: 'Al SFU', text: 'Igual que en la cascada.' },
        { from: 'sfu', to: 'worker', kind: 'req', tag: 'RTP', ms: 0, title: 'Al worker', text: 'Reenvío.' },
        { at: 'worker', kind: 'info', tag: 'jitter buffer', ms: 30, title: 'Decodificar', text: 'A PCM de 24 kHz, el formato de la Realtime API.' },
        { from: 'worker', to: 's2s', kind: 'req', tag: 'input_audio_buffer.append', ms: 0, title: 'Audio en streaming', text: 'Por WebSocket desde el worker, en la misma región: pocos milisegundos.' },
        { at: 's2s', kind: 'info', tag: 'fin de turno', ms: 250, title: 'VAD del servidor', text: 'Con <code>semantic_vad</code>, el modelo decide que el usuario terminó por lo que dijo, no solo por el silencio.' },
        { at: 's2s', kind: 'info', tag: 'primer audio', ms: 300, title: 'Primer audio', text: 'El mismo modelo escucha y contesta: no hay transcripción ni frases en el medio.' },
        { from: 's2s', to: 'worker', kind: 'res', tag: 'response.output_audio.delta', ms: 0, title: 'Audio de vuelta', text: 'Con la transcripción del audio generado al lado, para el registro y la moderación.' },
        { from: 'worker', to: 'sfu', kind: 'res', tag: 'RTP', ms: 0, title: 'A la sala', text: 'Codificado en Opus.' },
        { from: 'sfu', to: 'app', kind: 'res', tag: 'SRTP', ms: 25, title: 'De vuelta', text: 'Red de vuelta.' },
        { at: 'app', kind: 'info', tag: '«Claro…»', ms: 40, title: 'El usuario oye la respuesta', text: '700 ms: 80 menos que la cascada. A cambio, la moderación llega después de que el audio ya existe, y la llamada de 10 minutos cuesta unos 0.52 USD contra 0.12 de la cascada por APIs (24.11).' }
      ]
    }
  ]
});
