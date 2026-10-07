# Plan — Curso de System Design para sistemas reales e IA

Curso web interactivo (HTML/CSS/JS vanilla, sin build) que va desde fundamentos de backend distribuido hasta el diseño técnico completo de una infraestructura tipo ChatGPT, más casos de estudio de Stripe, Cloudflare y WhatsApp, cada uno con una sección final para armarlo sobre AWS. Twitter y Google Docs van en la Fase 2.

## Decisiones tomadas en la entrevista

| Tema | Decisión |
|---|---|
| Nivel de partida | Backend intermedio: ya sabes hacer APIs REST, SQL y Docker |
| Mapas | Canvas SVG con pan/zoom infinito, nodos clicables y simulación animada de requests |
| Casos de estudio (Fase 1) | LLM serving / ChatGPT, pagos tipo Stripe, Cloudflare |
| Casos de estudio (Fase 2) | Twitter/X, Google Docs (WhatsApp pasó a la Parte III como M29) |
| Checkpoints | Progreso guardado en localStorage y un quiz por módulo |
| Stack | Vanilla multi-archivo, que funciona con doble clic (`file://`) sin servidor |
| Idioma | Español, con los términos técnicos en inglés y su definición la primera vez |
| Estilo | Estilo Apple (HIG): tipografía del sistema, claro y oscuro según el sistema, un color por capa de infraestructura. Reemplazó al blueprint oscuro inicial |
| Términos técnicos | La primera mención por sección de cada término de nivel intermedio enlaza a su explicación a fondo o al glosario; lo básico no se enlaza |
| Parte II: profundidad | Sistemas con números: fórmulas de memoria, FLOPs y ancho de banda con ejemplos resueltos y calculadoras; el transformer como caja, sin su álgebra |
| Parte II: código | Python (el lenguaje del ecosistema de inferencia) |
| Parte II: temas agregados | Imágenes y multimodal, voz y tiempo real, agentes a fondo, entrenamiento y fine-tuning (M23–M26) |
| Parte II: ritmo | De corrido hasta el Checkpoint B, con `PROGRESO.md` al día después de cada módulo |

## Regla de honestidad técnica

En cada caso de estudio se marca cada afirmación con una etiqueta visual:

- **`DOCUMENTADO`**: viene de fuentes públicas (blogs de ingeniería, papers, docs oficiales).
- **`DISEÑO DE REFERENCIA`**: es una reconstrucción razonada de cómo se construiría. OpenAI, Stripe y Cloudflare no publican todo su diseño interno, así que el curso no presenta como hecho lo que es una inferencia.

---

## 1. Arquitectura del sitio

```
ia-system-desing/
├── index.html                  Portada: mapa del curso, progreso global, continuar donde quedaste
├── glosario.html               Glosario completo con buscador
├── modules/
│   ├── m00-metodo.html … m29-whatsapp.html
│   └── checkpoint-a.html, checkpoint-b.html, checkpoint-c.html
├── maps/
│   ├── chatgpt.html            Mapa gigante explorable (pantalla completa)
│   ├── stripe.html
│   └── cloudflare.html
├── assets/
│   ├── css/
│   │   ├── tokens.css          Colores por capa, tipografía, espaciado, grilla blueprint
│   │   ├── layout.css          Sidebar, TOC, contenido, responsive
│   │   ├── components.css      Callouts, definiciones, tablas de esquema, bloques de endpoint, badges
│   │   └── map.css             Estilos del motor de mapas
│   └── js/
│       ├── core/
│       │   ├── progress.js     Estado en localStorage (try/catch), checkpoints, % por módulo
│       │   ├── nav.js          Sidebar, TOC automático, prev/next, deep links
│       │   ├── glossary.js     Tooltips para <dfn data-term="pacelc">
│       │   ├── quiz.js         Motor de quizzes: opción múltiple, orden de pasos, "¿qué falla?"
│       │   └── search.js       Búsqueda client-side sobre títulos, glosario y endpoints
│       ├── map/
│       │   ├── map-engine.js   SVG pan/zoom, nodos, aristas, minimapa, panel de detalle, filtros por capa
│       │   └── flow-sim.js     Anima paquetes por aristas, escenarios de falla, timeline de latencia
│       ├── widgets/
│       │   ├── calculators.js  Back-of-envelope, memoria KV cache, sizing de GPUs, cuantización
│       │   └── sims.js         Mini-simuladores: Raft, batching, rate limiter, consistent hashing
│       └── data/
│           ├── glossary.data.js
│           ├── maps/*.data.js  Nodos, aristas y escenarios de cada sistema
│           └── quizzes/*.data.js
└── PLAN.md
```

Los datos van en archivos `.js` que se registran en `window.SD`. No uso JSON con `fetch`, porque `fetch` no funciona al abrir los archivos con `file://`.

### Motor de mapas: lo que vas a poder hacer

- **Arrastrar y hacer zoom** con rueda, pinch o botones, sobre un lienzo de varios miles de px, con **minimapa** en la esquina.
- **Capas con color**: Cliente, Edge/CDN, Gateway, Servicios, Colas/Streams, Caché, Bases de datos, GPU/Inferencia, Externos. Cada capa se puede ocultar o mostrar.
- **Clic en un nodo** para abrir un panel con 5 pestañas:
  1. *Responsabilidad*: qué hace y por qué existe.
  2. *Endpoints / Interfaz*: método, ruta, request/response de ejemplo, códigos de error.
  3. *Esquema*: tablas con columnas, tipos, índices, partition key.
  4. *Fallos*: qué pasa si cae, cómo se detecta y cómo se mitiga.
  5. *Números*: latencia típica, QPS, tamaño y costo.
- **Escenarios animados**: un botón "▶ Reproducir" mueve un paquete arista por arista. Cada paso muestra el payload real, la latencia acumulada y una explicación, y se puede ir paso a paso (⏮ ⏭).
- **Escenarios de falla**: el nodo se marca como caído (en rojo) y se ve el reintento, el circuit breaker o el failover.
- **Deep links** del tipo `maps/chatgpt.html#node=kv-cache&scenario=gpu-crash`, para que los módulos enlacen directo a un punto del mapa.

### Plantilla de cada módulo

1. Objetivos y prerrequisitos
2. Contenido con diagramas SVG en línea y `<dfn>` con tooltip de definición
3. Callouts: **Definición**, **En producción real**, **Qué pasa si falla…** y **Trade-off**
4. Tablas de esquemas y bloques de endpoints con formato consistente
5. Enlace al nodo o escenario correspondiente del mapa
6. **Quiz** de 6 a 10 preguntas y un **ejercicio de diseño** con solución de referencia desplegable
7. Botón "Marcar checkpoint", que solo se habilita con el quiz aprobado (≥ 70 %)

---

## 2. Currículo

### Parte I — Fundamentos de sistemas distribuidos

| # | Módulo | Contenido clave | Visual / interactivo |
|---|---|---|---|
| M00 | Método de diseño | Requisitos funcionales y no funcionales, estimaciones back-of-envelope, SLI/SLO/SLA, error budgets, cómo documentar un diseño (ADRs) | Calculadora de QPS, almacenamiento y ancho de banda |
| M01 | El viaje de una request | DNS (recursivo/autoritativo, TTL), TCP (handshake, slow start), TLS 1.3, HTTP/1.1 vs 2 vs 3/QUIC, head-of-line blocking, keep-alive, pooling | Mapa pequeño animado navegador → DNS → CDN → LB → app → DB, con latencias reales |
| M02 | Protocolos y diseño de APIs | REST, gRPC, GraphQL, WebSockets, SSE, long polling, webhooks. Diseño de endpoints, versionado, paginación cursor vs offset, errores `application/problem+json`, primera introducción a idempotencia | Comparador lado a lado del mismo caso en cada protocolo |
| M03 | Load balancers, gateways y proxies | L4 vs L7, round robin, least-conn, P2C, consistent hashing, health checks, API gateway (authN, rate limit, routing), BFF, service mesh y sidecars | Simulador de algoritmos de balanceo con un servidor lento |
| M04 | Caché | Cache-aside, write-through, write-behind, refresh-ahead, invalidación, TTL + jitter, **cache stampede** (coalescing, early expiration probabilística), hot keys, **caída total de caché** (cold start, load shedding), Redis Cluster | Escenario "Redis cae": la DB se satura y entra el circuit breaker |
| M05 | Bases de datos | Modelos (relacional, KV, documento, wide-column, grafo, vector, time-series), B-tree vs LSM, niveles de aislamiento y sus anomalías, replicación (leader-follower, multi-leader, leaderless + quórum), sharding y rebalanceo | Simulador de consistent hashing con vnodes; tabla interactiva de anomalías por nivel de aislamiento |
| M06 | Teoría distribuida: lo esencial | Versión simple para quien va de paso (75 min): por qué un sistema distribuido es distinto, síncrono y asíncrono como cotas de tiempo, **CAP**, **PACELC** y de dónde sale la latencia, la escalera de consistencia con analogías, por qué funciona W + R > N, un líder con **Raft** y 2PC frente a sagas | Simulador Raft; ejercicio estático |
| M06.1 | Teoría distribuida a fondo (opcional, no cuenta para el progreso) | Todo el contenido anterior de M06, más el cambio de paradigma de síncrono y asíncrono, la latencia de PACELC (W-ésima respuesta más rápida), modelos de consistencia uno por uno (causal y eventual nuevos, implementación y costo), por qué funcionan los quórums y qué tiene que solaparse en cada algoritmo, y analogías en los conceptos abstractos: Modelos de sistema (síncrono, asíncrono, parcialmente síncrono; caída, omisión, bizantina), **safety y liveness**, detectores de fallas (Chandra–Toueg, Ω, phi accrual, SWIM, gossip), **CAP** con su demostración, harvest/yield, **PACELC**, **linealizabilidad** (Herlihy–Wing), secuencial, garantías de sesión, serializabilidad estricta, quórums (ABD, sloppy, flexibles), relojes (happens-before, Lamport, vectoriales, HLC, TrueTime, commit wait), **Raft** a fondo (seguridad, regla de commit, ReadIndex, membresía, PreVote/CheckQuorum), **Paxos** y Multi-Paxos, **FLP** y sus salidas, **Two Generals**, 2PC, Paxos Commit, Percolator, **CRDTs** y anti-entropía, **Byzantine Generals / PBFT / HotStuff**, split brain, leases, fencing tokens, Redlock, Jepsen, TLA+ y simulación determinista | Simulador Raft; verificador de linealizabilidad; historia con cinco veredictos (`consist`); latencia de W de N (`replat`); simulador de quórums; 7 ejercicios guiados |
| M07 | Mensajería asíncrona | Cola vs log (SQS/RabbitMQ vs Kafka), **pub/sub**, particiones y consumer groups, orden, at-most / at-least / exactly-once efectivo, **outbox pattern**, CDC, DLQ, backpressure | Animación de un topic Kafka con particiones y rebalanceo de consumidores |
| M08 | Resiliencia | Timeouts, retries con backoff exponencial + jitter, circuit breaker, bulkhead, **rate limiting** (token bucket, leaky bucket, sliding window), load shedding, degradación elegante, multi-región active-active / active-passive, RTO/RPO, chaos engineering | Simulador de token bucket; retry storm con y sin jitter |
| M09 | Almacenamiento de objetos | Arquitectura tipo S3, **signed URLs** (canonical request → HMAC → firma → expiración, paso a paso), subida directa presigned, multipart, content-addressed storage, CDN delante | Generador de signed URL didáctico en JS (HMAC real con Web Crypto) |
| M10 | Seguridad e identidad | OAuth2/OIDC flows, JWT vs tokens opacos, API keys (hash + prefijo), mTLS, KMS y envelope encryption, aislamiento multi-tenant, PII y retención | Secuencia OAuth animada |
| M11 | Observabilidad y operación | Logs, métricas, traces (OpenTelemetry), RED/USE, alertas sobre SLOs, blue-green, canary, feature flags, migraciones de esquema sin downtime (expand/contract) | Trace waterfall de una request |
| **CP-A** | **Checkpoint A** | Examen integrador (20 preguntas) + diseño de un acortador de URLs con requisitos de escala | — |

### Parte II — IA / LLM serving desde cero hasta ChatGPT

| # | Módulo | Contenido clave | Visual / interactivo |
|---|---|---|---|
| M12 | Un LLM visto por un ingeniero de sistemas | Tokens y tokenizer, forward pass, **prefill vs decode**, generación autoregresiva, **KV cache** (fórmula: `2 × capas × kv_heads × head_dim × bytes × tokens`), por qué decode está limitado por memoria, métricas **TTFT, TPOT/ITL**, throughput | Animación token a token mostrando cómo crece el KV cache |
| M13 | Hardware GPU | HBM y ancho de banda, FLOPs, arithmetic intensity, modelo roofline, NVLink vs InfiniBand, cuántas GPUs necesita un modelo de 8B, 70B o 400B | Calculadora de sizing GPU |
| M14 | Cuantización | FP32/BF16/FP16/FP8/INT8/INT4, weight-only vs weight+activation, GPTQ, AWQ, SmoothQuant, cuantización del KV cache, calibración, impacto en calidad y en latencia | Calculadora de memoria por formato; comparativa visual de precisión |
| M15 | Motores de inferencia | Static vs **continuous batching**, **PagedAttention**, prefix caching, chunked prefill, **speculative decoding**, FlashAttention, paralelismo tensor / pipeline / expert, MoE, **prefill/decode desagregado** | Simulador de batching: requests entrando y saliendo del batch por iteración |
| M16 | Context windows | Límites y costo cuadrático de la atención, truncado, sliding window, resumen de historial, RAG vs contexto largo, RoPE scaling, **prompt caching** | Visual de un historial que no cabe y de cada estrategia aplicada |
| M17 | Diseño de la API del LLM | `POST /v1/chat/completions`, `/v1/responses`, `/v1/embeddings`, `/v1/files`, `/v1/batches`: schemas completos. **Streaming SSE** (formato de eventos, deltas, evento final, cancelación cuando el cliente se desconecta, keep-alive, reanudación), tool calling, structured outputs, errores 429 / 5xx / overloaded, headers de rate limit | Visor de stream SSE simulado evento por evento |
| M18 | Rate limiting y cuotas por tokens | RPM/TPM, estimación previa de tokens, **reservar → consumir → reconciliar**, tiers, fairness entre tenants, colas de prioridad, admission control | Simulador de cuota TPM con varios tenants |
| M19 | Router y flota GPU | Model registry, routing por modelo, región y capacidad, **routing consciente del KV cache / prefijo**, autoscaling (cola, uso de KV), cold start y carga de pesos, preemption y spot, fallback entre modelos, multi-región | Mapa del plano de control vs plano de datos |
| M20 | El producto ChatGPT | Esquema de DB: users, orgs, conversations, **messages como árbol** (regenerar / editar = rama nueva), attachments, memoria. Uploads con signed URLs → parsing → embeddings → vector DB (RAG). Herramientas (browsing, code interpreter en sandbox), pipeline de moderación, feedback | Tablas de esquema interactivas; árbol de mensajes visual |
| M21 | Metering y facturación por uso | Eventos de uso por request → Kafka → agregador → ledger, idempotencia de eventos, créditos prepagados, límites de gasto, facturas (puente hacia el caso Stripe) | Pipeline animado de eventos de uso |
| M22 | Operar modelos en producción | Canary de modelos, shadow traffic, A/B, evals online, prompt injection, abuso y jailbreaks, retención de datos, runbooks de incidentes | Escenarios de incidente para elegir la respuesta correcta |
| M23 | Imágenes y multimodal | Encoders de visión e imágenes como tokens (parches, tiles, costo), serving de modelos con visión, generación de imágenes (difusión y autorregresiva) como servicio asíncrono: API de jobs, colas por prioridad, GPUs por imagen, almacenamiento con signed URLs, moderación de entrada y salida, procedencia (C2PA) | Calculadora de tokens por imagen; pipeline de un job de generación |
| M24 | Voz y tiempo real | Cascada (VAD → STT → LLM → TTS) vs speech-to-speech, WebRTC vs WebSocket, detección de fin de turno, interrupciones (barge-in) y truncado de lo no escuchado, TTS en streaming, sesiones con estado y media servers, presupuesto de latencia voz a voz | Constructor del presupuesto de latencia; línea de tiempo de una interrupción |
| M25 | Agentes y herramientas | El bucle del agente, tool calling paralelo y de varios pasos, límites (pasos, tokens, dinero, tiempo), sandbox de código (microVMs, red, recursos), MCP, ejecución durable de tareas largas, aprobación humana, prompt injection indirecta, observabilidad por paso | Simulador de un agente con presupuesto y herramientas que fallan |
| M26 | Entrenamiento y fine-tuning | Memoria de entrenamiento (pesos, gradientes, optimizador, activaciones), paralelismo de datos, tensor, pipeline y contexto (FSDP), redes y colectivas, fallas de hardware y checkpoints, pipeline de datos, LoRA y QLoRA, multi-LoRA en serving, RLHF y DPO, del checkpoint a producción | Calculadora de memoria de entrenamiento y del intervalo óptimo de checkpoint |
| **MAP** | **Mapa gigante ChatGPT** | Todo lo anterior conectado en un solo lienzo | Escenarios: mensaje normal con streaming · usuario cierra la pestaña a mitad del stream · nodo GPU muere en pleno decode · Redis de rate limit cae · pico de tráfico con admission control · subida de PDF + RAG · failover de región · herramienta de código en sandbox · conversación por voz con interrupción |
| **CP-B** | **Checkpoint B** | Examen + diseñar el serving de un modelo 70B para 10k usuarios concurrentes con un presupuesto dado | — |

### Parte III — Casos de estudio

| # | Módulo | Contenido clave | Escenarios en el mapa |
|---|---|---|---|
| M27 | **Pagos tipo Stripe** | Máquina de estados de un PaymentIntent, endpoints completos, **idempotency keys** implementadas de principio a fin (tabla, lock, fingerprint del body, respuesta cacheada, TTL, requests concurrentes con la misma key), **ledger de doble entrada** (esquema), dinero como enteros + moneda, flujo con redes de tarjetas (authorize → capture → settle), **webhooks** (firma HMAC, reintentos, dedupe del receptor, desorden), sagas y compensación, reconciliación diaria, tokenización y alcance PCI DSS, detección de fraude | Pago normal · doble clic del usuario · timeout después de que el banco cobró · webhook duplicado y desordenado · el banco no responde · reembolso parcial |
| M28 | **Cloudflare** | Anycast + BGP, PoPs, DNS autoritativo, terminación TLS, WAF, mitigación DDoS L3/L4/L7, caché por niveles (tiered cache), Workers (V8 isolates vs contenedores), Workers KV (eventual), Durable Objects (un solo escritor), R2, propagación de configuración global, Argo smart routing, Zero Trust | Cache hit en el edge · miss → tier superior → origen · SYN flood · un PoP cae (BGP withdraw) · push de config global · Worker + Durable Object |
| M29 | **WhatsApp** | Conexiones persistentes y gateways, registro de sesiones (dónde está cada usuario), buzones y store-and-forward, ACKs (enviado / entregado / leído), grupos con Sender Keys, cifrado E2E (Signal: X3DH, double ratchet), multidispositivo, media con URLs firmadas, push, tormentas de reconexión y despliegue con draining, más una sección final para armarlo sobre AWS |
| **CP-C** | **Checkpoint C** | Examen final de la Fase 1 + diseñar la plataforma de pagos para el producto de IA del M21 | — |

### Fase 2 (después de terminar la Fase 1)

| # | Módulo | Contenido clave |
|---|---|---|
| M30 | Twitter/X | Fan-out on write vs on read, timeline híbrido para celebridades, IDs Snowflake, contadores distribuidos, trending topics (streaming), búsqueda |
| M31 | Google Docs | OT vs CRDT, servidor de sesión por documento, cursores y presencia, historial de versiones, comentarios, permisos |
| CP-D | Checkpoint D | Examen + diseñar un Slack |

### Parte IV — Ciberseguridad

Numerada después de la Parte III (M32 en adelante), con su propio checkpoint. **Cuenta para el progreso.** La premisa transversal: "si no haces esto, el atacante hace esto otro". Todo defensivo: se muestra el patrón vulnerable y su arreglo, nunca cadenas de explotación listas para usar. Hoy solo existe el esqueleto (rutas `soon` y este currículo); los módulos se escriben uno por pedido.

| # | Módulo | Contenido clave | Visual / interactivo (candidato) |
|---|---|---|---|
| M32 | **Firewalls a fondo** | Stateless vs stateful, nftables, iptables, UFW y firewalld, filtrado de entrada y de salida (egress), host vs red, Security Groups y NACLs en la nube, NGFW, WAF (reenvío a M37), segmentación de red, el choque entre Docker y el firewall, IPv6 | Simulador de reglas: un paquete contra una cadena de reglas, con estado de conexión; diagrama de zonas |
| M33 | **Hardening de servidores Linux** | SSH (claves, `AllowGroups`, `sshd_config`, MFA), sudo/su, actualizaciones automáticas, NTP, `/proc`, contraseñas, Fail2Ban y CrowdSec, AIDE, rkhunter, Lynis, `ss`, sysctl, GRUB, umask, paquetes huérfanos. Sección "si el firewall no alcanza": asume que el perímetro cae, inventaría lo expuesto y endurece el servidor por sí mismo (servicios atados a localhost, mínimo privilegio, MAC con AppArmor/SELinux, control de egress, monitoreo y alertas). Formato "si no haces esto, el atacante hace esto" | Checklist interactivo de hardening; antes/después de `sshd_config` |
| M34 | **Operación y troubleshooting para SysAdmin** | Usuarios y permisos, systemd y journald, discos y LVM, backups con pruebas de restauración, diagnóstico de CPU, RAM, disco y red (top, vmstat, iostat, `ss`, dig, strace), runbooks, parches | Árbol de decisión de troubleshooting; lectura guiada de métricas |
| M35 | **Seguridad en bases de datos** | Tablas de bitácora (triggers, pgAudit, CDC), RBAC, ABAC, ACLs, extensión de la **row-level security de M05**, cifrado de columnas, secretos y rotación de credenciales, mínimo privilegio por servicio | Simulador de RBAC/ABAC: un sujeto, una acción y un recurso contra las políticas |
| M36 | **Criptografía desde cero** | Hash, HMAC, cifrado simétrico (AES-GCM), asimétrico, firmas, intercambio de claves, certificados y PKI, contraseñas (Argon2id, bcrypt), aleatoriedad, errores comunes. Reutiliza `SD.crypto` | Laboratorios con `SD.crypto`: hash, HMAC y firma paso a paso |
| M37 | **Arquitecturas seguras en la nube** | IAM y mínimo privilegio, mTLS y SPIFFE, KMS/HSM, gestores de secretos, WAF, VPC y endpoints privados, zero trust, auditoría (CloudTrail), guardrails (SCP), respuesta a incidentes | Diagrama de una arquitectura zero trust; flujo de mTLS entre servicios |
| **CP-E** | **Checkpoint E** | Examen integrador + endurecer una plataforma completa, del firewall a la nube, asumiendo que el atacante ya entró | — |

Fuente base de M33: [How-To-Secure-A-Linux-Server](https://github.com/imthenachoman/How-To-Secure-A-Linux-Server), de Anchal Nigam (imthenachoman), licencia CC BY-SA 4.0. Se escribe prosa propia, se enlaza cada sección al original y se pone un recuadro de atribución arriba.

---

## 3. Checkpoints de construcción

En cada checkpoint **me detengo** para que abras el sitio en el navegador y lo revises. Solo continúo cuando lo apruebas.

**Estado (2026-09-28):** CP0 a CP3 terminados; de la Parte II, M12 a M16 publicados y el resto en pausa; los casos de estudio M27 (Stripe) y M28 (Cloudflare) publicados, con sus mapas embebidos en el módulo en lugar de páginas aparte. El detalle está en `PROGRESO.md`. Para verlo, abre `index.html` con doble clic.

| CP | Entregable | Cómo lo verificas |
|---|---|---|
| **CP0** | Base del sitio: tokens CSS, layout, sidebar, `index.html` con el mapa del curso, `progress.js`, `glossary.js`, `quiz.js` y un módulo de muestra | Abres `index.html` con doble clic, navegas, respondes un quiz de prueba y el progreso sobrevive a recargar la página |
| **CP1** | Motor de mapas + simulador de flujos, estrenado con el mapa del **M01 (viaje de una request)** | Pan/zoom, clic en nodos, reproducir un escenario paso a paso, deep link |
| **CP2** | Módulos M00–M05 con sus widgets | Leer, usar calculadoras y simuladores, aprobar quizzes |
| **CP3** | Módulos M06–M11 + **Checkpoint A** | Simulador Raft, token bucket, generador de signed URL |
| **CP4** | Módulos M12–M16 + calculadoras de GPU, KV cache y cuantización | Las cifras de las calculadoras coinciden con los ejemplos resueltos del texto |
| **CP5** | Módulos M17–M22 | Visor SSE, simulador de cuotas TPM |
| **CP5b** | Módulos M23–M26: multimodal, voz, agentes y entrenamiento | Calculadoras de tokens por imagen, latencia de voz y memoria de entrenamiento |
| **CP6** | **Mapa gigante ChatGPT** + **Checkpoint B** | Los 9 escenarios se reproducen correctamente |
| **CP7** | **Stripe** (módulo + mapa) | Los 6 escenarios, incluida la carrera de idempotencia |
| **CP8** | **Cloudflare** (módulo + mapa) + **Checkpoint C** | Los 6 escenarios |
| **CP9** | Pulido: búsqueda global, glosario completo, móvil, accesibilidad, revisión técnica cruzada | Lighthouse ≥ 90 en accesibilidad; el sitio funciona en el móvil |
| **CP10–12** | Fase 2: Twitter, Google Docs + Checkpoint D (WhatsApp ya está como M29) | — |
| **CP13** | Parte IV: Ciberseguridad (M32–M37 + Checkpoint E). Hoy solo el esqueleto; los módulos se escriben uno por pedido | Cada módulo: 0 errores de consola, 0 términos faltantes, quiz aprobado, sin desborde a 390 px |

---

## 4. Criterios de calidad

- **Cada concepto difícil** (PACELC, FLP, linearizabilidad, byzantine fault, etc.) tiene su tarjeta de **Definición** en una frase, una explicación intuitiva, un ejemplo concreto y un "por qué te importa en producción".
- **Cada nodo de cada mapa** tiene sus 5 pestañas completas. Ningún nodo queda solo con un nombre.
- **Cada escenario de falla** muestra detección → mitigación → recuperación → qué ve el usuario.
- **Ejemplos resueltos con números reales**: por ejemplo, el KV cache de un modelo 70B con GQA para 8k tokens, en GB.
- El sitio no depende de ningún CDN: funciona offline y sin servidor.
