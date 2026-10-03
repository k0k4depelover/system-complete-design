# Progreso del curso: estado y traspaso

> Archivo de continuidad. Se actualiza al terminar cada módulo. Si la sesión se corta, una sesión nueva puede
> retomar leyendo este archivo, `PLAN.md` (currículo completo) y una página ya hecha como plantilla (`modules/m00-metodo.html`).

**Última actualización:** 2026-10-03.

**Aplicación de conocimiento (2026-10-03):** pedidos del usuario: escribir las guías de los mini-proyectos por bloques ("implementa de bloques de 5 en 5", y después "implementa otros 3"), cada proyecto independiente, con "Cómo conectar" al final y solo hacia proyectos anteriores de la lista. Regla del 2026-10-02, ya escrita en `CLAUDE.md` ("De las guías de proyectos"): Claude escribe las guías y no las ejecuta; nada de contenedores, Maven, Gatling ni Kubernetes en la máquina del usuario.
- **Publicadas:** A00 a A07, de `proyectos/a00-laboratorio.html` a `proyectos/a07-kubernetes.html`, cada una con sus decisiones guiadas en `assets/js/data/projects/<id>.data.js`. Se generan con `tools/mkguide.py` desde un fragmento con `<!--META-->`, y el código entra con `<!--SRC ../lab/<id>/…-->`. Los fragmentos (`guides/a00.html` a `a07.html`) y el código (`lab/a00` a `lab/a07`) están en el scratchpad de la sesión 8e065194; si se pierde, la página de `proyectos/` es la fuente de verdad y se edita a mano.
- **A07, Kubernetes (terminada):** k3s en Docker con un server y dos agentes, Traefik con Gateway API, CloudNativePG con un Pooler de PgBouncer, Deployment con probes, `preStop` y apagado ordenado, HPA y PDB. Se comprueba con un rollout con carga, un despliegue sin cuidados, el HPA bajo una rampa, el drain del nodo del primario y la caída del primario. Las salidas y las cifras son las de la corrida guardada en el scratchpad (`a07_history.txt`), tomada antes de la regla; lo que no se midió queda para que el lector lo anote.
- **Arreglos en el código de A07, sin compilar por la regla:** una contraseña de más de 72 bytes en UTF-8 (40 eñes) pasaba el `@Size` y bcrypt respondía 500; ahora `AccountService.fitsBcrypt` da 400, con su caso en la prueba. Hikari quedó en `connection-timeout: 5000`, en milisegundos, porque la propiedad es un número y no está claro que acepte `5s`.
- **Java:** las guías piden Java 25 y las imágenes usan `eclipse-temurin:25-jre`, pero el código de las mediciones de A00 a A07 se compiló con el JDK 21. `proyectos.html` lo dice.
- **A06:** se sumó la medición de borrar un mes (`DELETE` contra `DETACH CONCURRENTLY` y `DROP`), tomada en una corrida anterior del mismo experimento. El 400 para un shard desconocido (`Topology.requireKnown`) compiló, pero ninguna prueba lo cubre, y la suite corrió por última vez sobre una versión anterior del código.
- **Arreglos comunes:** el resaltado de bash de `project-guide.js` ya no deja que un apóstrofo de una salida ("pod's") pinte las líneas siguientes. El botón del menú móvil de las guías dice "Ruta", como en los módulos: con "Proyectos", el ícono quedaba en 0 px a 390 px.
- **Fuera de esta área, sin tocar:** a 390 px, el ícono del `.menu-btn` también se encoge en los módulos (11.7 px en lugar de 16). Se arregla en `layout.css` con `.menu-btn svg { flex: none; }`, como ya tiene `.brand svg`.
- **Pruebas (2026-10-03):** `test-page.mjs` en A00 a A07 da 0 errores de consola, 0 términos faltantes y 0 desborde a 390 px; `links.mjs proyectos/*.html` da 0 problemas; el ejercicio de A07 da 4 de 4. Capturas de A07 y del índice revisadas en claro, oscuro y 390 px.
- **Siguiente:** el próximo bloque empieza en A08, "Un solo líder". Esperar el pedido del usuario.

**Pedido vigente del usuario (2026-10-02):** "solo crea el nuevo apartado y el índice de mini-proyectos". Plan a futuro del usuario: una sección "Aplicación de conocimiento" con tutoriales para implementar cada patrón en Java y Spring Boot (Redis, PostgreSQL con PgBouncer obligatorio en las guías de bases de datos, PostGIS, Kubernetes, R2 y disco local, Nginx, Spring Cloud Gateway, OAuth con un servidor en Cloudflare Workers, Docker, git y GitHub Actions), cada uno con diagrama de arquitectura, endpoints al inicio, solo dependencias (sin explicar cómo crear el proyecto), paso a paso con decisiones de diseño como un tutor, y un enlace obligatorio al repositorio que arma el usuario. Al final, sistemas completos que juntan varios patrones.
- **Hecho:** `proyectos.html` (estilos en `assets/css/projects.css`, datos en `assets/js/data/projects.data.js`, render en `assets/js/pages/projects.js`), con el formato de cada guía, el stack, el índice (A00 a A26: 22 de núcleo y 5 de ampliación), dos sistemas completos (C1 pagos distribuidos, C2 pedidos a domicilio) y ocho decisiones pendientes. Enlace "Proyectos" en la barra superior de todas las páginas y en `tools/mkpage.py`; bloque de presentación en la portada. Probado en claro, oscuro y 390 px, sin errores de consola ni desborde; `links.mjs` sin problemas.
- **Resuelto:** el usuario respondió las decisiones (Workers en TypeScript, Kafka con DLQ, write-behind cache, k3s, dos repositorios principales y cada proyecto independiente) y pidió las guías. Ver "Aplicación de conocimiento (2026-10-03)" arriba.
- Cada proyecto tiene `repo: ''` en los datos: una guía no pasa a `status: 'ready'` sin el enlace del usuario.

**M01 ampliado para nivel inicial en redes (2026-10-02, terminado):** pedido: "mantén el contenido del viaje de la request, pero asume un nivel más bajo en redes… primero enseña qué es eso [ClientHello, SNI, 0-RTT, QUIC], asume un nivel junior, aunque quede mucho más largo". El M01 pasó de 60 a 120 minutos y tiene 12 secciones:
- **Secciones:** 1.1 recorrido en seis pasos, 1.2 fundamentos nuevos (paquetes y MTU, IP y NAT, puertos y la 4-tupla, capas, TCP contra UDP, RTT contra ancho de banda), 1.3 mapa, 1.4 DNS (árbol, registros, actores, resolución paso a paso, TTL), 1.5 TCP (handshake con números de secuencia, pérdida y retransmisión, slow start, cerrar y reutilizar), 1.6 TLS (criptografía con Diffie-Hellman explicado con mezclas, certificados y cadena de confianza, el ClientHello campo por campo, SNI y ECH, reanudación y 0-RTT con replay, HSTS, dónde termina TLS), 1.7 HTTP (anatomía del mensaje, versiones, head-of-line blocking), 1.8 QUIC (por qué existe, qué hace, cómo se descubre), 1.9 intermediarios (CDN y balanceador L4 y L7), 1.10 presupuesto con TTFB resuelto, 1.11 cómo medirlo (DevTools y `curl -w`) y 1.12 fallas.
- **Figuras:** 13 nuevas (de 1.1 a 1.15; la 1.12 y la 1.14 son las dos que ya existían, renumeradas). Se conservaron todas las anclas anteriores.
- **Quiz:** 15 preguntas, 6 de ellas nuevas (puerto efímero, ancho de banda, UDP en DNS, connection refused, certificado copiado, qué ve el proveedor con SNI).
- **Glosario:** 23 términos nuevos en el bloque "M01: fundamentos de redes y TLS"; los `deep` de rtt, ttl, resolver, tcp-handshake, slow-start, hol-blocking, sni, quic, zero-rtt, keep-alive y hsts apuntan a las secciones nuevas.
- **Datos verificados y marcados como Documentado:** la duración de los certificados (votación SC-081 del CA/Browser Forum: 200 días desde el 15 de marzo de 2026, 100 en 2027 y 47 en 2029), Let's Encrypt de 90 a 45 días, ECH (RFC 9849), Early-Data y 425 Too Early (RFC 8470), y Chrome 90 probando primero HTTPS.
- **Archivos de trabajo** en el scratchpad de la sesión: `svg_m01.py` (figuras), `m01_body_a/b/c.html` (cuerpo), `splice_m01.py` (reemplaza el cuerpo de la página original guardada en `m01-orig.html`). La página `modules/m01-viaje-request.html` ya es la fuente de verdad.
- **Pruebas:** 84 términos, 0 faltantes, quiz de 15, los cinco escenarios del mapa corren, índice con 46 entradas, 0 desborde a 390 px, sin errores de consola y `links.mjs` sin problemas. Las figuras se revisaron en claro, oscuro y 390 px; se corrigieron las etiquetas pisadas de las figuras 1.1, 1.4, 1.6, 1.7, 1.8, 1.11 y 1.13.

**M31 Google Docs, en pausa (2026-10-02):** el usuario cambió de pedido a mitad del módulo. Hecho y probado: `assets/js/widgets/sim-collab.js` (`SD.otCore` con TP1 en 20 000 pares, protocolo en 3 000 sesiones; simulador `data-sim="ot"` y calculadora `data-calc="collab"`) y su CSS en `components.css` (sección "Simulador de OT (M31)"). En el scratchpad de la sesión: datos verificados en `m31-fuentes.md`, 12 figuras en `svg_m31.py` (sin revisión visual), y el fragmento en dos bloques: `frags/m31_a.html` (META, objetivos, 31.1 a 31.6) y `frags/m31_b.html` (31.7 a 31.12). Falta: bloque C (31.13 permisos y zookies, 31.14 offline, 31.15 cliente, 31.16 fallas, 31.17 flota con la calculadora, 31.18 clon en AWS con `data-preset="m31"`, y `comprueba`), el mapa `m31-docs.data.js` con 12 escenarios, el quiz de 20, el ejercicio guiado, los términos del glosario, el preset `m31` de `sim-infra.js`, cambiar los valores por defecto de la calculadora (docs 2 800 000, editors 0.3, ops 2), `course.data.js` a `ready` y las pruebas. El plan completo está en `~/.claude/plans/glistening-sprouting-cookie.md`. Si el scratchpad se perdió, los bloques A y B se reescriben siguiendo ese plan.

**Pedido vigente del usuario (2026-10-01):** "continua": seguir la Parte II. **M19 terminado y probado.** Después: "implementa el producto ChatGPT" (con 20 minutos de plazo): **M20 publicado y probado**, en versión compacta. Después: "implementa el caso de uso M30" (20 minutos): **M30 Twitter/X publicado y probado**, en versión compacta. Después: "mejora todo lo que hiciste con el tiempo limitado… no agregues nada, únicamente mejora lo que se había creado": **M30 profundizado** (ver abajo); **M20 sigue pendiente** de la misma mejora. Después: "no agregaste el diagrama HLD de Twitter… el diagrama más realista que podría tener Twitter actualmente, agrega la sección del diagrama completo y el viaje de la request": **hecho**, sección 30.2. Siguiente: profundizar M20 al nivel de la Parte II (árbol de mensajes interactivo, calculadora de RAG, ejercicio guiado, quiz más largo, cifras verificadas), sin módulos nuevos.

**Pedidos vigentes del usuario (2026-09-30, segunda parte):**
1. "Implementa el M17 y M18": **terminado.** M17 (API del LLM y streaming, 10 secciones, visor SSE y calculadora de streams) y M18 (cuotas por tokens, 9 secciones, dos simuladores y la calculadora de escrow, con la sección 18.8 de teoría distribuida aplicada al limitador) están publicados y probados.
2. `CLAUDE.md` en la raíz, con reglas, catálogo de componentes y la estructura de `tree /f`: **hecho.** Se regenera la sección de estructura con `tree /f` al agregar archivos.
3. "Profundiza mucho más en la teoría distribuida, eso es lo que más me interesa": **terminado.** El M06 pasó de 8 a 15 secciones (180 min): modelo del sistema y safety/liveness, detectores de fallas (Chandra–Toueg, Ω, phi accrual, SWIM y gossip), CAP con su demostración y harvest/yield, PACELC, linealizabilidad con un verificador interactivo, secuencial, garantías de sesión y serializabilidad estricta, quórums (ABD, sloppy, flexibles), relojes (happens-before, vectoriales, HLC, TrueTime y commit wait), Raft a fondo (las cinco propiedades, la regla de commit, ReadIndex y leases, cambios de membresía, PreVote/CheckQuorum, el incidente de Cloudflare de 2020), Paxos y Multi-Paxos, FLP con sus salidas y cotas, 2PC, Paxos Commit y Percolator, CRDTs y anti-entropía, bizantinas (cota por quórums, firmas, HotStuff, corrupción silenciosa), leases, fencing y el debate de Redlock, y verificación (Jepsen, TLA+, simulación determinista). 14 figuras, quiz de 18 y 36 términos nuevos.
4. "Agrega más ejercicios con solución como el del planificador de tareas, como quizzes interactivos con respuestas ya hechas": **terminado.** Componente de ejercicio guiado (`core/exercise.js`, `data-exercise`, datos en `data/exercises/<id>.data.js`): escenario, decisiones de a una con su explicación y la solución de referencia al final; no cuenta para el checkpoint. M06 tiene 7 (detector de fallas, relojes, Raft en un corte de red, transferencia entre shards, contador en tres regiones, ¿es seguro este lock? y el planificador, que reemplazó al ejercicio estático) y M18 tiene 1 (límite global para 30 gateways en tres regiones). Para sumar ejercicios a otros módulos: `"exercises": true` en el META, o agregar los dos `<script>` a mano en una página existente (ver M18).

**Pedido anterior del usuario (2026-09-30), terminado:**
1. **M28 Cloudflare:** cómo corren los Workers comparados con Kubernetes, Lambda/microVMs y contenedores (sección 28.8, figura y tabla), más Unimog, Traffic Manager, Pingora, Durable Objects por dentro, Quicksilver y las caídas de 2019 y 2025.
2. **M27 y M28, más profundidad:** M27 pasó de 12 a 18 secciones (3D Secure, límites de tasa, ISO 8583, ledger a fondo, disputas, payouts, migraciones y regiones, observabilidad); M28 pasó de 10 a 12.
3. **M29 WhatsApp**, nuevo, en la Parte III: gateways de conexión, registro de sesiones, buzones, grupos, E2EE, multidispositivo, medios, push, tormenta de reconexión y despliegues.
4. **Sección final "Impleméntalo tú mismo"** en los tres casos: tabla de servicios e instancias de AWS, figura de la arquitectura, orden de construcción y una calculadora de la factura mensual (`widgets/sim-infra.js`); el M29 suma otra calculadora para dimensionar la flota de gateways.
5. **Arreglo de espaciado de Stripe:** el mapa del M27 y las figuras 27.2 quedaron sin avisos en la medición.

**Revisión visual (2026-09-30):** las 21 figuras de M27 (9), M28 (6) y M29 (6) se capturaron en modo oscuro a 1440 px y a 390 px. En oscuro se ven bien todas (las figuras usan solo tokens `var(--…)`, sin colores fijos). En 390 px ninguna página desborda; las figuras se desplazan dentro de su marco (`min-width: 640px`, como en todo el sitio) y el texto más chico queda en 9,6 px (9,1 px en los ejes de la figura 29.5). Único arreglo: en la figura 27.2 la etiqueta "medio de pago" flotaba 37 px sobre su flecha; ahora tiene una guía punteada, como "captura manual".

**Datos verificados en fuentes públicas (2026-09-30):** blogs de ingeniería de Cloudflare y Stripe, documentación de ambos, el documento técnico de cifrado de WhatsApp (feb. 2026), el artículo de multidispositivo de Meta, las charlas de escala de WhatsApp de 2012 y 2014, y precios y límites de AWS. Los precios del widget son de lista en us-east-1 y se pueden editar en pantalla.

**Pedido anterior (2026-09-28):** M16 terminado, M27 y M28 publicados. Parte II en pausa desde el M17.
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
- **Parte II:** M12 a M20 publicados; siguen M21 a M26, el mapa y el CP-B.
- **M20 (2026-10-01):** fragmento en el scratchpad de la sesión (`frags/m20.html`, figuras en `svg_m20.py`); la página `modules/m20-producto-chatgpt.html` ya es la fuente de verdad. Pruebas: 0 errores de consola, 0 términos faltantes, 0 desborde a 390 px, `links.mjs` sin problemas en todo el sitio, figuras revisadas en claro y oscuro. Por el plazo quedó sin widget, sin mapa y con ejercicio estático. Pendientes posibles: un árbol de mensajes interactivo (regenerar, editar y cambiar de rama), un ejercicio guiado y una calculadora del pipeline de archivos.
- **M19 (2026-10-01):** fragmento en el scratchpad de la sesión (`frags/m19.html`, figuras en `svg_m19.py`). La página `modules/m19-router-flota.html` ya es la fuente de verdad. Pruebas: 0 errores de consola, 0 términos faltantes, 8 escenarios del mapa, 0 desborde a 390 px, `links.mjs` sin problemas en todo el sitio, ejercicio guiado 6 de 6, capturas en claro y oscuro revisadas.
- **M06 ampliado (2026-09-30):** fragmento en el scratchpad de la sesión (`frags/m06_a.html`, `m06_b.html` y `m06_c.html`, unidos en `m06.html`; figuras en `svg_m06c.py` y `svg_m06d.py`). La página `modules/m06-teoria-distribuida.html` ya es la fuente de verdad. Se conservaron las anclas que usan otros módulos (`cap`, `pacelc`, `consistencia`, `relojes`, `consenso`, `imposibles`, `bizantinas`, `leases`).
- **Casos de estudio:** M27 (Stripe), M28 (Cloudflare) y M29 (WhatsApp) publicados, con sus mapas embebidos. **M30 (Twitter/X, 2026-10-01)** publicado y profundizado: fragmento en el scratchpad (`frags/m30.html`; figuras en `svg_m30.py` y `svg_m30_hld.py`), la página `modules/m30-twitter.html` ya es la fuente de verdad. 16 secciones, 120 min. La 30.2, "La arquitectura de X hoy", es el HLD realista armado con el blog de infraestructura de 2017, `the-algorithm` (2023) y `x-algorithm` (2026): figura 30.1 por planos (borde, API, lectura, escritura, Kafka y lo derivado), tabla de 19 piezas con su fuente, el mapa explorable y "El viaje de una request: abrir Para ti" (figura 30.2 de secuencia, presupuesto de 175 ms en el servidor salto por salto como Diseño de referencia, y el trade-off de Thunder: Para ti ya no depende del fan-out). El mapa `data/maps/m30-twitter.data.js` es X real, no un clon: 35 nodos en seis bandas, 54 aristas, Kafka como barra (`bus: true`, opción nueva de `map-engine.js`) y 12 escenarios (Para ti de 33 pasos, Siguiendo, publicar una foto, cuenta famosa, like viral, búsqueda, tendencia, notificación, DM cifrado, Community Note, reconstrucción y pico). Calculadoras: `snowflake` y `fanout` (`widgets/sim-feed.js`) y la factura con `data-preset="m30"` en 30.16. 10 figuras, quiz de 20, ejercicio estático "la final del Mundial". Pruebas: 0 errores de consola, 0 términos faltantes, 0 desborde a 390 px, `links.mjs` sin problemas en todo el sitio, figuras y mapa revisados en capturas claras y oscuras. `flow-sim.js` ahora muestra en minutos u horas los escenarios de más de 2 minutos. Lo que X no publicó (cómo arma hoy Siguiendo, esquemas, tamaños de flota, milisegundos) está marcado como Diseño de referencia. Falta el Checkpoint C, que no se pidió todavía.
- **Siguiente:** M21, metering y facturación por uso. Después M22; el Checkpoint C y la Fase 2 esperan indicaciones.

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
- [x] M06, teoría distribuida: simulador de Raft `widgets/sim-raft.js` (elecciones, partición, log). Ampliado el 2026-09-30 a 15 secciones, con el verificador de linealizabilidad `widgets/sim-lin.js` (búsqueda exhaustiva de un orden linealizable y otro secuencial, lógica en `SD.linCore`) y 7 ejercicios guiados.
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
- [x] M17, diseño de la API del LLM: endpoints y esquemas (chat, Responses, Messages, embeddings, archivos y batches), SSE a fondo con los tres formatos, infraestructura del streaming, cancelación hasta la GPU, streams reanudables, tool calling, salidas estructuradas, errores y un endpoint de referencia en Python. Visor de streams evento por evento y calculadora de streams abiertos (`widgets/sim-sse.js`), 6 figuras (`svg_m17.py` en el scratchpad), quiz de 9 y 6 términos nuevos; `sse` ahora apunta a `m17#sse`.
- [x] M18, rate limiting y cuotas por tokens: dimensiones, estimar antes de saber, reservar y reconciliar con scripts de Lua, algoritmos, cuotas por niveles y headers, reparto justo, admission control y el limitador como problema distribuido (confluencia de invariantes, contador central, CRDT y escrow, CAP y PACELC, Redis Cluster, relojes, reconciliación exactamente una vez). Simuladores de reservas y de cuatro clientes sobre una flota, y calculadora de escrow (`widgets/sim-quota.js`, con la lógica en `SD.quotaCore`), 4 figuras (`svg_m18.py`), quiz de 9 y 13 términos nuevos. Ejercicio guiado `m18-limitador` al final de 18.8.
- [x] M19, router y flota GPU: plano de control y de datos con estabilidad estática, model registry con alias y canary, señales para elegir réplica, routing por prefijo con carga acotada (índice de prefijos, hashing consistente con carga acotada), autoscaling por uso de KV cache con la fórmula del HPA, cold start y carga de pesos con pool precalentado, spot con drenaje y continuación de streams, fallback entre modelos y entre regiones. Mapa de la flota (16 nodos, 8 escenarios), simulador de cinco políticas de routing y calculadora de cold start y colchón (`widgets/sim-router.js`, lógica en `SD.routerCore`), 6 figuras (`svg_m19.py`), quiz de 9, 9 términos nuevos y el ejercicio guiado `m19-flota`.
- [x] M20, el producto ChatGPT: piezas alrededor del modelo y escala (800 millones de usuarios semanales), esquema de conversaciones con current_node y tabla del historial por usuario, mensajes como árbol (regenerar y editar crean hermanos; formato `mapping` del export), armar el contexto desde la rama (SQL recursivo y Python), un turno de punta a punta con id del cliente como idempotency key y buffer de eventos en Redis para reanudar, archivos y RAG (signed URL, parsing, chunking 800/400, `text-embedding-3-large` a 256 dimensiones, búsqueda híbrida), herramientas y sandbox de código, memoria, moderación y feedback. 2 figuras (`svg_m20.py`), quiz de 9, 4 términos nuevos y ejercicio estático "compartir conversación".
- [ ] M21, metering y facturación por uso
- [ ] M22, operar modelos en producción
- [ ] M23, imágenes y multimodal
- [ ] M24, voz y tiempo real
- [ ] M25, agentes y herramientas
- [ ] M26, entrenamiento y fine-tuning
- [ ] Mapa gigante de ChatGPT (`maps/chatgpt.html`, 9 escenarios)
- [ ] Checkpoint B (`modules/checkpoint-b.html`)
- [ ] Pasada final de la Parte II

### Casos de estudio (M27 y M28 el 2026-09-28; ampliados y M29 el 2026-09-30)
- [x] M27, pagos tipo Stripe: módulo de 12 secciones y mapa embebido `data/maps/m27-pagos.data.js` (16 nodos con sus 5 pestañas, 6 escenarios: pago, doble clic, timeout después de la aprobación, webhook duplicado y desordenado, emisor caído, reembolso parcial). Idempotency keys de referencia en Python, ledger con asientos verificados, webhooks, sagas, conciliación y PCI DSS; 13 términos nuevos en el glosario.
- [x] M28, Cloudflare: módulo de 10 secciones y mapa embebido `data/maps/m28-cloudflare.data.js` (18 nodos con sus 5 pestañas, 6 escenarios: cache hit, miss con nivel superior, SYN flood, un PoP que cae, cambio de configuración global, Worker con Durable Object). Anycast y BGP, DDoS por capa, caché por niveles, isolates, KV contra Durable Objects contra R2 con PACELC, Quicksilver y Zero Trust; 11 términos nuevos y `deep` actualizado para `anycast`, `pop` y `cdn`.
- [x] **Ampliación del 2026-09-30.** M27: 18 secciones y 10 escenarios (se suman 3D Secure, flash sale con límites, liquidación y contracargo); figuras de 3D Secure, capas de límites, disputas, migraciones y arquitectura en AWS. M28: 12 secciones y 8 escenarios (se suman el despliegue de un Worker y un Worker con un contenedor), nodo Contenedor en el mapa, mapa reacomodado con pasillos de 150 px; figuras de Unimog, Kubernetes contra Workers y la red de borde en AWS. Cada uno termina con "Impleméntalo tú mismo".
- [x] **M29, WhatsApp:** módulo de 14 secciones, mapa `data/maps/m29-whatsapp.data.js` (14 nodos con sus 5 pestañas y 8 escenarios: mensaje con destinatario conectado, sin conexión, grupo de 256, primer mensaje con prekeys, foto, teléfono y computadora, caída de un gateway y despliegue con draining), 6 figuras, quiz de 16 preguntas y 10 términos nuevos (categoría "Mensajería en tiempo real"). Pasó de la Fase 2 a la Parte III en `course.data.js`.
- [x] **Herramientas nuevas:** `widgets/sim-infra.js` (factura mensual estimada con presets m27, m28 y m29, y dimensionamiento de gateways), estilos `.bom-*` en `components.css`, y `tools/seqdiag.py` ahora angosta las cajas de los actores cuando hay más de cinco.

### Después (según PLAN.md)
- Al retomar la Parte II: poner `deep` a los términos que se expliquen a fondo en M17–M26. (Los `deep` de `ledger`, `anycast`, `cdn` y `pop` ya apuntan a M27 y M28.)
- Checkpoint C: examen de la Fase 1 y diseño de la plataforma de pagos por uso del producto de IA (usa M21, que está en pausa).
- CP5: M17–M22.
- CP6: mapa gigante de ChatGPT (`maps/chatgpt.html`, 7 escenarios) y Checkpoint B.
- CP7: Stripe. CP8: Cloudflare y Checkpoint C. CP9: pulido (búsqueda global, glosario, accesibilidad).
- Fase 2: Twitter y Google Docs, más el Checkpoint D (WhatsApp ya está como M29).

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
