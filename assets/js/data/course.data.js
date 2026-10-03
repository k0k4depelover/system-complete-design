/* Estructura del curso. status: 'ready' (publicado) | 'soon' (en construcción).
   kind: 'module' (por defecto) | 'checkpoint' | 'map'. href es relativo a la raíz. */
window.SD = window.SD || {};
window.SD.course = {
  parts: [
    {
      id: 'p1', label: 'Parte I', title: 'Fundamentos de sistemas distribuidos', line: '--line-p1',
      intro: 'Todo lo que un sistema grande da por sentado: cómo viaja una request, cómo se cachea, se replica, se encola y se protege.',
      items: [
        { id: 'm00', num: 'M00', title: 'El método: cómo se diseña un sistema real', short: 'El método', mins: 50, href: 'modules/m00-metodo.html', status: 'ready',
          summary: 'Requisitos medibles, estimaciones, SLO y error budgets, disponibilidad compuesta y design docs.' },
        { id: 'm01', num: 'M01', title: 'El viaje de una request', short: 'Viaje de una request', mins: 120, href: 'modules/m01-viaje-request.html', status: 'ready',
          summary: 'DNS, TCP, TLS 1.3, HTTP/1.1, 2 y 3, y en qué se va cada milisegundo.' },
        { id: 'm02', num: 'M02', title: 'Protocolos y diseño de APIs', short: 'APIs y protocolos', mins: 70, href: 'modules/m02-apis.html', status: 'ready',
          summary: 'REST, gRPC, GraphQL, WebSockets, SSE y webhooks; paginación, versionado, errores e idempotencia.' },
        { id: 'm03', num: 'M03', title: 'Balanceadores, gateways y proxies', short: 'Balanceo y gateways', mins: 60, href: 'modules/m03-balanceo-gateways.html', status: 'ready',
          summary: 'L4 vs L7, algoritmos de balanceo, health checks, API gateway, BFF y service mesh.' },
        { id: 'm04', num: 'M04', title: 'Caché', short: 'Caché', mins: 70, href: 'modules/m04-cache.html', status: 'ready',
          summary: 'Patrones, invalidación, cache stampede, hot keys y qué pasa cuando la caché entera cae.' },
        { id: 'm05', num: 'M05', title: 'Bases de datos', short: 'Bases de datos', mins: 90, href: 'modules/m05-bases-de-datos.html', status: 'ready',
          summary: 'Modelos de datos, B-tree vs LSM, aislamiento, replicación, sharding y rebalanceo.' },
        { id: 'm06', num: 'M06', title: 'Teoría distribuida', short: 'Teoría distribuida', mins: 180, href: 'modules/m06-teoria-distribuida.html', status: 'ready',
          summary: 'Modelos de sistema, detectores de fallas, CAP, consistencia, quórums, relojes, Raft y Paxos a fondo, FLP, 2PC, CRDTs, bizantinas y verificación, con siete ejercicios guiados.' },
        { id: 'm07', num: 'M07', title: 'Mensajería asíncrona', short: 'Colas y pub/sub', mins: 70, href: 'modules/m07-mensajeria.html', status: 'ready',
          summary: 'Colas vs logs, pub/sub, particiones, semánticas de entrega, outbox, CDC y DLQ.' },
        { id: 'm08', num: 'M08', title: 'Resiliencia', short: 'Resiliencia', mins: 70, href: 'modules/m08-resiliencia.html', status: 'ready',
          summary: 'Timeouts, retries con jitter, circuit breakers, rate limiting, load shedding y multi-región.' },
        { id: 'm09', num: 'M09', title: 'Almacenamiento de objetos', short: 'Objetos y signed URLs', mins: 50, href: 'modules/m09-objetos.html', status: 'ready',
          summary: 'Arquitectura tipo S3, signed URLs paso a paso, subidas directas y multipart.' },
        { id: 'm10', num: 'M10', title: 'Seguridad e identidad', short: 'Seguridad', mins: 60, href: 'modules/m10-seguridad.html', status: 'ready',
          summary: 'OAuth2 y OIDC, JWT vs tokens opacos, API keys, mTLS, KMS y aislamiento multi-tenant.' },
        { id: 'm11', num: 'M11', title: 'Observabilidad y operación', short: 'Observabilidad', mins: 60, href: 'modules/m11-observabilidad.html', status: 'ready',
          summary: 'Logs, métricas y traces, alertas sobre SLOs, despliegues canary y migraciones sin downtime.' },
        { id: 'cpa', num: 'CP-A', kind: 'checkpoint', title: 'Checkpoint A: fundamentos', short: 'Checkpoint A', mins: 90, href: 'modules/checkpoint-a.html', status: 'ready',
          summary: 'Examen integrador y diseño de un acortador de URLs a escala.' }
      ]
    },
    {
      id: 'p2', label: 'Parte II', title: 'IA: de un LLM a ChatGPT', line: '--line-p2',
      intro: 'Desde qué hace una GPU con cada token hasta la infraestructura completa de un producto de chat con millones de usuarios.',
      items: [
        { id: 'm12', num: 'M12', title: 'Un LLM visto por un ingeniero de sistemas', short: 'LLM por dentro', mins: 70, href: 'modules/m12-llm-por-dentro.html', status: 'ready',
          summary: 'Tokens, prefill vs decode, KV cache y las métricas que importan: TTFT, TPOT y throughput.' },
        { id: 'm13', num: 'M13', title: 'Hardware GPU', short: 'GPUs', mins: 60, href: 'modules/m13-gpus.html', status: 'ready',
          summary: 'HBM, FLOPs, roofline, NVLink e InfiniBand; cuántas GPUs necesita un modelo.' },
        { id: 'm14', num: 'M14', title: 'Cuantización', short: 'Cuantización', mins: 60, href: 'modules/m14-cuantizacion.html', status: 'ready',
          summary: 'De FP32 a INT4: GPTQ, AWQ, FP8 y KV cache cuantizado, con su costo en calidad.' },
        { id: 'm15', num: 'M15', title: 'Motores de inferencia', short: 'Motores de inferencia', mins: 90, href: 'modules/m15-motores-inferencia.html', status: 'ready',
          summary: 'Continuous batching, PagedAttention, prefix caching, speculative decoding y paralelismo.' },
        { id: 'm16', num: 'M16', title: 'Context windows', short: 'Context windows', mins: 50, href: 'modules/m16-context-windows.html', status: 'ready',
          summary: 'Límites, costo de la atención, truncado, resumen, RAG vs contexto largo y prompt caching.' },
        { id: 'm17', num: 'M17', title: 'Diseño de la API del LLM', short: 'API y streaming', mins: 80, href: 'modules/m17-api-streaming.html', status: 'ready',
          summary: 'Endpoints completos, streaming SSE, cancelación, tool calling y structured outputs.' },
        { id: 'm18', num: 'M18', title: 'Rate limiting y cuotas por tokens', short: 'Cuotas por tokens', mins: 75, href: 'modules/m18-cuotas-tokens.html', status: 'ready',
          summary: 'RPM y TPM, reservar y reconciliar, reparto justo, admission control y el limitador como problema distribuido.' },
        { id: 'm19', num: 'M19', title: 'Router y flota GPU', short: 'Router y flota GPU', mins: 90, href: 'modules/m19-router-flota.html', status: 'ready',
          summary: 'Plano de control y de datos, routing por prefijo con carga acotada, autoscaling, cold starts, spot y multi-región.' },
        { id: 'm20', num: 'M20', title: 'El producto ChatGPT', short: 'Producto ChatGPT', mins: 80, href: 'modules/m20-producto-chatgpt.html', status: 'ready',
          summary: 'Conversaciones como árbol, uploads, RAG, herramientas en sandbox y moderación.' },
        { id: 'm21', num: 'M21', title: 'Metering y facturación por uso', short: 'Metering', mins: 50, href: 'modules/m21-metering.html', status: 'soon',
          summary: 'Eventos de uso, agregación idempotente, créditos prepagados y límites de gasto.' },
        { id: 'm22', num: 'M22', title: 'Operar modelos en producción', short: 'Operar modelos', mins: 50, href: 'modules/m22-operar-modelos.html', status: 'soon',
          summary: 'Canary de modelos, shadow traffic, evals online, prompt injection y runbooks.' },
        { id: 'm23', num: 'M23', title: 'Imágenes y multimodal', short: 'Multimodal', mins: 60, href: 'modules/m23-multimodal.html', status: 'soon',
          summary: 'Imágenes convertidas en tokens, visión en el serving y generación de imágenes como servicio asíncrono.' },
        { id: 'm24', num: 'M24', title: 'Voz y tiempo real', short: 'Voz y tiempo real', mins: 60, href: 'modules/m24-voz-tiempo-real.html', status: 'soon',
          summary: 'WebRTC y WebSocket, cascada o speech-to-speech, interrupciones y un presupuesto de 800 ms.' },
        { id: 'm25', num: 'M25', title: 'Agentes y herramientas', short: 'Agentes', mins: 70, href: 'modules/m25-agentes.html', status: 'soon',
          summary: 'El bucle de un agente, sandbox de código, MCP, presupuestos, ejecución durable y prompt injection indirecta.' },
        { id: 'm26', num: 'M26', title: 'Entrenamiento y fine-tuning', short: 'Entrenamiento', mins: 80, href: 'modules/m26-entrenamiento.html', status: 'soon',
          summary: 'Clústeres de miles de GPUs, paralelismo, checkpoints y fallas, LoRA, RLHF y DPO, y el camino a producción.' },
        { id: 'map-chatgpt', num: 'Mapa', kind: 'map', title: 'Mapa gigante de ChatGPT', short: 'Mapa de ChatGPT', mins: 60, href: 'maps/chatgpt.html', status: 'soon',
          summary: 'Todo conectado en un lienzo explorable con nueve escenarios animados, caídas incluidas.' },
        { id: 'cpb', num: 'CP-B', kind: 'checkpoint', title: 'Checkpoint B: serving de LLMs', short: 'Checkpoint B', mins: 90, href: 'modules/checkpoint-b.html', status: 'soon',
          summary: 'Diseña el serving de un modelo de 70B para 10 000 usuarios concurrentes con un presupuesto dado.' }
      ]
    },
    {
      id: 'p3', label: 'Parte III', title: 'Casos de estudio', line: '--line-p3',
      intro: 'Tres sistemas reales de punta a punta: dinero que no se puede duplicar, una red que atiende a medio internet y mensajes que tienen que llegar aunque el teléfono esté apagado. Cada uno termina con cómo armarlo tú sobre AWS.',
      items: [
        { id: 'm27', num: 'M27', title: 'Pagos tipo Stripe', short: 'Pagos (Stripe)', mins: 210, href: 'modules/m27-pagos-stripe.html', status: 'ready',
          summary: 'Idempotency keys, ledger de doble entrada, 3D Secure, límites de tasa, ISO 8583, disputas, conciliación y tu propio procesador en AWS.' },
        { id: 'm28', num: 'M28', title: 'Cloudflare', short: 'Cloudflare', mins: 150, href: 'modules/m28-cloudflare.html', status: 'ready',
          summary: 'Anycast, Unimog, DDoS, Workers frente a Kubernetes, Durable Objects, configuración global y tu propia red de borde en AWS.' },
        { id: 'm29', num: 'M29', title: 'WhatsApp', short: 'WhatsApp', mins: 150, href: 'modules/m29-whatsapp.html', status: 'ready',
          summary: 'Conexiones persistentes y gateways, registro de sesiones, buzones, grupos, cifrado de extremo a extremo y tu clon en AWS.' },
        { id: 'cpc', num: 'CP-C', kind: 'checkpoint', title: 'Checkpoint C: diseño final', short: 'Checkpoint C', mins: 90, href: 'modules/checkpoint-c.html', status: 'soon',
          summary: 'Diseña la plataforma de pagos por uso para el producto de IA de la Parte II.' }
      ]
    },
    {
      id: 'f2', label: 'Fase 2', title: 'Más casos de estudio', line: '--line-f2', phase: 2,
      intro: 'Se construye al terminar la Fase 1: redes sociales y colaboración en tiempo real.',
      items: [
        { id: 'm30', num: 'M30', title: 'Twitter/X', short: 'Twitter/X', mins: 120, href: 'modules/m30-twitter.html', status: 'ready',
          summary: 'Fan-out on write vs on read, timelines híbridos, IDs Snowflake, contadores y trending.' },
        { id: 'm31', num: 'M31', title: 'Google Docs', short: 'Google Docs', mins: 90, href: 'modules/m31-google-docs.html', status: 'soon',
          summary: 'OT vs CRDT, sesión por documento, cursores y presencia, historial y permisos.' },
        { id: 'cpd', num: 'CP-D', kind: 'checkpoint', title: 'Checkpoint D: diseña un Slack', short: 'Checkpoint D', mins: 90, href: 'modules/checkpoint-d.html', status: 'soon',
          summary: 'Examen y diseño completo de una plataforma de chat para equipos.' }
      ]
    }
  ]
};
