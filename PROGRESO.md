# Progreso del curso: estado y traspaso

> Archivo de continuidad. Se actualiza al terminar cada módulo. Si la sesión se corta, una sesión nueva puede
> retomar leyendo este archivo, `PLAN.md` (currículo completo) y una página ya hecha como plantilla (`modules/m00-metodo.html`).

**Última actualización:** 2026-09-28. M16 terminado, M27 y M28 publicados. Parte II en pausa desde el M17; el trabajo está detenido esperando la revisión del usuario.
**Pedido vigente del usuario (2026-09-28):** terminar lo que hubiera quedado a medias (era el M16) y, en lugar de seguir la Parte II, **implementar los casos de estudio M27 (pagos tipo Stripe) y M28 (Cloudflare)**. El resto de la Parte II (M17–M26, el mapa de ChatGPT y el Checkpoint B) queda **en pausa** hasta nuevo aviso.

**Pedido anterior (2026-09-27, en pausa):** "Implementa CP-B": toda la Parte II de corrido.

**Decisiones de la entrevista de la Parte II:**
- Profundidad: "sistemas con números". Fórmulas de memoria, FLOPs y ancho de banda con ejemplos resueltos y calculadoras; el transformer como caja, sin su álgebra.
- Código de ejemplo en **Python**.
- Temas agregados: imágenes y multimodal (M23), voz y tiempo real (M24), agentes a fondo (M25), entrenamiento y fine-tuning (M26).
- Para no invalidar las referencias existentes a M12–M22, los temas nuevos van al final de la Parte II. Se renumeraron Stripe (M27), Cloudflare (M28) y la Fase 2 (M29–M31), en `course.data.js`, el glosario, `PLAN.md` y las referencias de texto de M00–M06 y del mapa del M01.
- El mapa gigante de ChatGPT pasa de 7 a 9 escenarios: se suman una herramienta de código en sandbox y una conversación por voz con interrupción.
Desde el M10, además: **estilo Apple** (skill apple-design) en todo el sitio y **cada término técnico de nivel intermedio
enlazado** a su sección a fondo o al glosario (sin enlazar lo básico, como caché, DNS o REST).

---

## Dónde quedó el trabajo

- **CP3 completo:** M06 a M11 y el Checkpoint A publicados, más el rediseño Apple y los enlaces automáticos a términos.
- **Parte II:** M12 a M16 publicados; M17 a M26, el mapa y el CP-B en pausa.
- **Casos de estudio:** M27 y M28 publicados. Falta el Checkpoint C, que no se pidió todavía.
- **Siguiente:** esperar indicaciones del usuario (retomar la Parte II en el M17, o el Checkpoint C).

---

## Hecho

### CP0: base del sitio
- [x] Sistema de diseño: `assets/css/tokens.css` (paleta de capas validada contra daltonismo y contraste), `layout.css`, `components.css` y `home.css`.
- [x] Tipografías del sistema (SF Pro en Apple, Segoe UI Variable en Windows): no se descarga ninguna fuente ni se usa CDN. Las fuentes Barlow y Martian Mono del primer diseño se eliminaron.
- [x] Núcleo JS en `assets/js/core/`: `sd.js` (espacio de nombres, formato de números, resaltado de código, pestañas), `progress.js` (localStorage envuelto en try/catch), `nav.js` (ruta lateral, índice de la página, anterior/siguiente, menú móvil, posición de lectura), `glossary.js` (tooltips y página del glosario) y `quiz.js` (quizzes de tipo single, multi y order, más el checkpoint).
- [x] `index.html` con el mapa de la ruta del curso (SVG serpentino animado), el plan por partes y el respaldo, restauración y reinicio del progreso.
- [x] `glosario.html`, con buscador y filtro por categoría.
- [x] M00 como módulo de muestra, con 3 calculadoras (`widgets/calculators.js`).

### CP1: motor de mapas
- [x] `assets/js/map/map-engine.js`: pan y zoom (arrastre, rueda con clic previo o Ctrl, pinch, teclado), minimapa, filtros por capa, panel de 5 pestañas por nodo (Responsabilidad, Endpoints, Esquema, Fallos, Números), pantalla completa, deep links (`#node=`, `#scenario=`, `#step=`) y ancho de nodos automático.
- [x] `assets/js/map/flow-sim.js`: escenarios paso a paso con paquetes animados, reloj acumulado, línea de tiempo clicable, nodos caídos y cámara que sigue al paquete.
- [x] `assets/css/map.css`.
- [x] M01, el viaje de una request, con el mapa `m01-request` (12 nodos y 5 escenarios).

### CP2: M00 a M05
- [x] M02, protocolos y APIs: pestañas comparativas, idempotency keys, paginación por cursor y webhooks.
- [x] M03, balanceo y gateways: simulador de balanceo `widgets/sim-lb.js`.
- [x] M04, caché: mapa `m04-cache` (9 nodos y 5 escenarios) y simulador de estampida `widgets/sim-cache.js`.
- [x] M05, bases de datos: aislamiento, quórum y anillo de hashing (`widgets/sim-db.js`).

### Rediseño con estilo Apple (pedido durante el CP3)
- [x] `tokens.css` reescrito con colores semánticos de Apple (fondos, etiquetas, separadores, acento `#0066cc` / `#2997ff`), modo claro y oscuro según el sistema (sin interruptor propio), `prefers-contrast: more` y `prefers-reduced-transparency`. La paleta de capas `--l-*` se revalidó para ambos fondos.
- [x] `layout.css`, `components.css`, `map.css` y `home.css` reescritos con los mismos nombres de clase: barra superior y sidebar de vidrio (solo la capa funcional), superficies sólidas en el contenido, botones cápsula, controles segmentados, objetivos de toque de 44 px en pantallas táctiles.
- [x] Botón `.side-toggle` en la barra superior (solo escritorio) que oculta el sidebar; se recuerda en localStorage (`sd-ui-side-hidden`). Implementado en `nav.js` (`sideToggle`).
- [x] Colores fijos de los widgets (`sim-db`, `sim-raft`, `sim-resil`, `sim-cache`) y de los SVG en línea reemplazados por tokens.
- [x] Favicon con variante clara y oscura.

### Enlaces automáticos a términos
- [x] `glossary.data.js`: cada término tiene `deep` ('mNN#ancla' de la sección donde se explica a fondo), `aliases`, y `basic` o `noauto` cuando corresponde. La cabecera del archivo documenta los campos.
- [x] `glossary.js` reescrito: `SD.autolink(root)` enlaza la primera mención de cada término por sección h2 (texto de `.content`, sin tocar encabezados, código, widgets ni quizzes). El destino es la sección a fondo si ese módulo está publicado y es otra sección; si no, el glosario. Los `<dfn data-term>` y `<span data-term>` escritos a mano se convierten en enlaces.
- [x] Tooltips por delegación: con mouse aparecen al pasar; con teclado al enfocar; en pantallas táctiles el primer toque muestra la definición y el segundo sigue el enlace. El tooltip ofrece "Tema completo" y "Ver en el glosario".
- [x] Glosario: cada entrada enlaza a su tema completo y a los términos que menciona; un `#t-id` oculto por el filtro limpia el filtro.
- [x] `tools/test/links.mjs` lista, por página y sección, qué se enlazó y adónde, y reporta enlaces anidados, anclas rotas y términos faltantes. `tools/test/shots.mjs` toma capturas en claro u oscuro con pasos (hover, clic, toque, teclas).
- Al agregar un módulo: poner `deep` a sus términos nuevos y revisar con `links.mjs` que no haya alias ambiguos (así se detectaron "latencia de cola" en el sentido de espera en cola y "estampida" en M03).

### CP3 (en curso)
- [x] M06, teoría distribuida: simulador de Raft `widgets/sim-raft.js` (elecciones, partición, log).
- [x] M07, mensajería: simulador de Kafka `widgets/sim-kafka.js` (particiones, consumer group, lag, rebalanceo).
- [x] M08, resiliencia: token bucket y tormenta de reintentos con falla metaestable (`widgets/sim-resil.js`).
- [x] M09, objetos y signed URLs: generador SigV4 `widgets/sim-signurl.js` (SHA-256 y HMAC en JS puro, verificado contra el ejemplo oficial de AWS: la firma `aeeed9bb…` coincide) y mapa `m09-objetos` (9 nodos y 4 escenarios).
- [x] M10, seguridad e identidad: laboratorio de JWT `widgets/sim-jwt.js` (HS256 real; acepta el token válido y rechaza la manipulación, alg none, la expiración y otra audiencia) y diagramas de OAuth con PKCE y de envelope encryption.
- [x] M11, observabilidad y operación: waterfall de traces con tres escenarios y calculadora de burn rate (`widgets/sim-obs.js`, atributos con las convenciones semánticas actuales de OpenTelemetry), figuras del flujo alerta → trace → logs y del canary por etapas, expand/contract, postmortem de ejemplo y ejercicio de operación de la API de chat.
- [x] Checkpoint A (`modules/checkpoint-a.html`): examen de 20 preguntas (`quizzes/cpa.data.js`) que cruza los doce módulos y dice qué repasar; diseño completo de un acortador de URLs con solución de referencia plegable (estimaciones, API, esquema, generación de códigos, arquitectura, caminos de lectura y escritura, analítica, fallos, seguridad, operación y decisiones); tabla de repaso con enlaces a cada sección.
- [x] Pasada final: los 13 módulos y el glosario sin errores de consola, sin enlaces rotos ni anidados, todos los escenarios de los mapas recorridos y sin desborde horizontal a 390 px.
- [x] Correcciones de la pasada: M00 usaba 409 para una `Idempotency-Key` reutilizada con otro cuerpo; ahora es 422, como en M02 (409 queda para una request en curso). La barra de progreso de los quizzes se adapta a 20 preguntas en móvil.

---

## Pendiente

### Parte II (M12–M16 hechos; el resto en pausa desde el 2026-09-28)
- [x] M12, un LLM visto por un ingeniero de sistemas: tokenizer didáctico con fallback a bytes y simulación de generación con KV cache (`widgets/sim-llm.js`), datos compartidos de modelos y GPUs en `data/llm.data.js`, resaltado de Python en `sd.js`.
- [x] M13, hardware GPU: calculadora de sizing con TPOT y costo, y roofline interactivo (`widgets/sim-gpu.js`); tabla de GPUs A100, H100, H200, B200 y MI300X.
- [x] M14, cuantización: simulador que cuantiza 64 pesos a INT8, INT4, FP8 o FP4 por tensor o por grupo (`widgets/sim-quant.js`); tabla de impacto para el 70B.
- [x] M15, motores de inferencia: simulador de static contra continuous batching y calculadora de speculative decoding (`widgets/sim-engine.js`); PagedAttention, prefix caching, chunked prefill, desagregación, paralelismo y configuración de vLLM.
- [x] M16, context windows: estrategias de contexto sobre una conversación que no entra y calculadora del costo de una conversación con y sin prompt caching (`widgets/sim-context.js`).
- [ ] M17, API del LLM y streaming SSE (visor de stream)
- [ ] M18, rate limiting y cuotas por tokens (simulador TPM)
- [ ] M19, router y flota GPU
- [ ] M20, el producto ChatGPT (árbol de mensajes)
- [ ] M21, metering y facturación por uso
- [ ] M22, operar modelos en producción
- [ ] M23, imágenes y multimodal
- [ ] M24, voz y tiempo real
- [ ] M25, agentes y herramientas
- [ ] M26, entrenamiento y fine-tuning
- [ ] Mapa gigante de ChatGPT (`maps/chatgpt.html`, 9 escenarios)
- [ ] Checkpoint B (`modules/checkpoint-b.html`)
- [ ] Pasada final de la Parte II

### Casos de estudio (M27 y M28 hechos el 2026-09-28)
- [x] M27, pagos tipo Stripe: módulo de 12 secciones y mapa embebido `data/maps/m27-pagos.data.js` (16 nodos con sus 5 pestañas, 6 escenarios: pago, doble clic, timeout después de la aprobación, webhook duplicado y desordenado, emisor caído, reembolso parcial). Idempotency keys de referencia en Python, ledger con asientos verificados, webhooks, sagas, conciliación y PCI DSS; 13 términos nuevos en el glosario.
- [x] M28, Cloudflare: módulo de 10 secciones y mapa embebido `data/maps/m28-cloudflare.data.js` (18 nodos con sus 5 pestañas, 6 escenarios: cache hit, miss con nivel superior, SYN flood, un PoP que cae, cambio de configuración global, Worker con Durable Object). Anycast y BGP, DDoS por capa, caché por niveles, isolates, KV contra Durable Objects contra R2 con PACELC, Quicksilver y Zero Trust; 11 términos nuevos y `deep` actualizado para `anycast`, `pop` y `cdn`.

### Después (según PLAN.md)
- Al retomar la Parte II: poner `deep` a los términos que se expliquen a fondo en M17–M26. (Los `deep` de `ledger`, `anycast`, `cdn` y `pop` ya apuntan a M27 y M28.)
- Checkpoint C: examen de la Fase 1 y diseño de la plataforma de pagos por uso del producto de IA (usa M21, que está en pausa).
- CP5: M17–M22.
- CP6: mapa gigante de ChatGPT (`maps/chatgpt.html`, 7 escenarios) y Checkpoint B.
- CP7: Stripe. CP8: Cloudflare y Checkpoint C. CP9: pulido (búsqueda global, glosario, accesibilidad).
- Fase 2: WhatsApp, Twitter y Google Docs, más el Checkpoint D.

---

## Cómo continuar (convenciones clave)

- **Funciona con `file://`:** solo scripts clásicos (nada de `type="module"` ni `fetch`). Los datos se registran con `SD.defineQuiz`, `SD.defineGlossary` y `SD.defineMap`.
- **Módulo nuevo:**
  1. Escribir un fragmento HTML con cabecera `<!--META {...}-->` (ver la cabecera de `tools/mkpage.py` y cualquier módulo existente) y generarlo con `python tools/mkpage.py fragmento.html`. La página generada en `modules/` pasa a ser la fuente de verdad.
  2. Agregar el quiz en `assets/js/data/quizzes/<id>.data.js` y los términos nuevos al final de `assets/js/data/glossary.data.js`. Todo `data-term` usado debe existir; si no, la prueba lo reporta.
  3. Cambiar `status: 'soon'` a `'ready'` en `assets/js/data/course.data.js`.
  4. Probar con `node tools/test/test-page.mjs <salida> <archivo.html> "<selector>|<selector>"` y revisar las capturas.
- **Diagramas de secuencia:** `tools/seqdiag.py` (función `seq(...)`) genera SVG con las clases del curso.
- **Contenido:** en español, con términos técnicos en inglés definidos la primera vez. Las afirmaciones sobre empresas reales llevan la etiqueta `Documentado` (fuente pública) o `Diseño de referencia`. Números verificados; los cálculos de ejemplo se comprueban.
- **Diseño:** estilo Apple (HIG): tipografía del sistema, colores semánticos (`--label`, `--bg-2`, `--accent`…), claro y oscuro automáticos, vidrio solo en la barra superior y el sidebar. Paleta de capas fija (tokens `--l-*`, validada); no agregar tonos nuevos sin validarlos. Estados reservados: `--ok`, `--warn`, `--fail`, siempre con icono o texto. Nada de colores fijos en JS o SVG: siempre `var(--token)`.
- **Términos:** marcar con `<dfn data-term="id">` la definición en contexto; el resto de las menciones se enlaza solo. Si una palabra es ambigua, `noauto: true` en el glosario o `class="no-autolink"` en el elemento.
- **Pruebas:** la extensión de Chrome no estaba conectada; las pruebas usan Chrome headless por DevTools Protocol (`tools/test/cdp.mjs`, sin dependencias, con el WebSocket nativo de Node 22 o superior).
