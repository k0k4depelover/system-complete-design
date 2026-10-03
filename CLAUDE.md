# CLAUDE.md

Guía para trabajar en este repositorio. Aquí va lo estable: reglas, componentes, herramientas y estructura. Lo que cambia (qué está hecho, qué está en pausa, dónde quedó el trabajo) vive en `PROGRESO.md`, y el currículo completo en `PLAN.md`.

## El proyecto

Curso web en español de diseño de sistemas reales:

- **Parte I:** fundamentos de sistemas distribuidos (M00–M11 y el Checkpoint A).
- **Parte II:** de un LLM a ChatGPT (M12–M26, el mapa gigante y el Checkpoint B).
- **Parte III:** casos de estudio: Stripe (M27), Cloudflare (M28) y WhatsApp (M29). La Fase 2 suma Twitter (M30) y Google Docs (M31).
- **Aplicación de conocimiento** (`proyectos.html`): mini-proyectos en Java y Spring Boot para construir lo de cada módulo. Por ahora solo está el índice propuesto; las guías se escriben cuando el usuario lo aprueba.

Es un sitio estático de HTML, CSS y JS vanilla, sin build ni dependencias. Funciona con doble clic (`file://`) y se publica en GitHub Pages con cada push a `main` (`.github/workflows/static.yml`).

Quien lo usa habla español y tiene nivel backend intermedio (REST, SQL, Docker). Pidió profundidad con números reales, mapas explorables con escenarios animados, quizzes con progreso, estilo Apple y cada término técnico de nivel medio enlazado a donde se explica.

## Antes de empezar

1. Lee `PROGRESO.md`: estado, pendientes y el pedido vigente.
2. Abre el módulo publicado más parecido al que vas a hacer y copia su estructura: `modules/m15-motores-inferencia.html` para la Parte II, `modules/m29-whatsapp.html` para un caso de estudio con mapa.
3. Actualiza `PROGRESO.md` al terminar cada módulo. Si el uso del plan se acerca al 95 %, deja `PROGRESO.md` al día y detente.
4. No hagas commits ni push salvo que el usuario lo pida.

## Cómo trabaja Claude en este proyecto

- **Caveman, siempre en el chat.** Usa la skill `caveman:caveman` en nivel `full` en todas las respuestas del chat; si no está activa, actívala con `/caveman full`. Frases cortas, sin relleno, con los términos técnicos, rutas, comandos y errores exactos. Vale solo para el chat: las páginas del curso, `PROGRESO.md`, `CLAUDE.md`, los commits y los comentarios del código van en prosa normal. Las advertencias de seguridad y las acciones irreversibles se escriben en prosa clara.
- **RTK para los comandos.** Sigue `~/.claude/RTK.md`: la salida de los comandos llega condensada y se trata como completa. Corre los comandos normalmente y agrupa los relacionados en una sola llamada. Repite un comando como `rtk proxy <cmd>` solo si su resultado no sirve: vacío cuando se esperaba salida, contradictorio con su código de salida o ilegible.

## Reglas que no se rompen

### Técnicas
- **Todo funciona con `file://`:** solo `<script src>` clásicos. Nada de `type="module"`, `import`, `fetch`, CDN ni fuentes descargadas.
- **Los datos son archivos `.js`** que se registran con `SD.defineQuiz`, `SD.defineGlossary` y `SD.defineMap`, o con `SD.data.x = …`.
- **`localStorage` siempre dentro de `try/catch`** (ver `core/progress.js`): en modo privado el curso sigue funcionando con estado en memoria.
- **Colores solo con tokens** (`var(--label)`, `var(--l-gpu)`…). Nada de hex en JS, SVG ni HTML. La paleta de capas `--l-*` está validada contra daltonismo en claro y en oscuro: no agregues tonos sin revalidarla.
- **Estados reservados:** `--ok`, `--warn` y `--fail`, siempre acompañados de texto o de un icono.
- **Anclas e ids:** no pueden empezar con un dígito (`#3ds` rompe `querySelector`; se usó `#sca`).

### De contenido
- Español con tú, sin voseo. Los términos técnicos quedan en inglés y se definen la primera vez que aparecen.
- **Números:** punto decimal (`99.9`), miles con espacio fino (`128 000`; `SD.fmt.num` lo hace solo) y `&#8239;` antes de `%` (`99.9&#8239;%`).
- **Honestidad:** toda afirmación sobre una empresa o un producto real lleva `<span class="badge badge--doc">Documentado</span>` si tiene fuente pública, o `<span class="badge badge--ref">Diseño de referencia</span>` si es una reconstrucción razonada. Las cifras se verifican y los ejemplos resueltos se comprueban con un cálculo.
- El código de ejemplo va en Python en la Parte II; también se usan bloques JSON, HTTP, SSE y SQL.
- **Cada módulo trae:** objetivos, secciones numeradas, quiz (se aprueba con 70 %), ejercicio de diseño con solución plegable (estático o guiado) y checkpoint.

### De diseño (Apple HIG)
- Tipografía del sistema. El modo claro u oscuro sigue al sistema, sin interruptor propio.
- El vidrio va solo en la barra superior y en el sidebar; el contenido usa superficies sólidas.
- Objetivos de 44 px en pantallas táctiles. Nada desborda la página a 390 px: las figuras se desplazan dentro de su marco (`min-width: 640px`).
- Sin mayúsculas sostenidas en etiquetas y sin decoración que no informe. La numeración solo se usa en secuencias reales.

### Términos del glosario
- La definición se marca con `<dfn data-term="id">`. `glossary.js` enlaza solo la primera mención de cada término por sección `h2`.
- Cada término nuevo lleva `deep: 'mNN#ancla'`, la sección donde se explica a fondo. Si ese módulo no está publicado, el enlace va al glosario.
- Lo básico (caché, DNS, REST, timeout) lleva `basic: true` y no se enlaza. Las palabras ambiguas llevan `noauto: true` en el glosario, o `class="no-autolink"` en el elemento.
- Revisa con `node tools/test/links.mjs modules/<archivo>.html` que ningún término se enlace con otro sentido.

## Cómo se agrega un módulo

1. **Fragmento.** Escribe el contenido en un archivo aparte (fuera de `modules/`), con esta cabecera:

   ```html
   <!--META {"id":"m17","num":"M17","file":"m17-api-streaming.html","title":"…","desc":"…",
     "part":"II. De un LLM a ChatGPT","mins":80,"prereq":"M02, M12","lead":"…",
     "css":["map.css"], "data":["data/maps/xx.data.js"], "scripts":["widgets/sim-x.js"], "quiz":true} -->
   ```

   `css`, `data`, `scripts` y `quiz` son opcionales; `"exercises": true` carga `data/exercises/<id>.data.js` y `core/exercise.js` para los ejercicios guiados. `<!--INCLUDE figura.svg-->` inserta un archivo relativo al fragmento.

2. **Página.** Genérala con `python tools/mkpage.py fragmento.html`, que escribe `modules/<file>`. Desde ese momento, la página en `modules/` es la fuente de verdad y se edita directamente.
3. **Quiz.** Créalo en `assets/js/data/quizzes/<id>.data.js`.
4. **Glosario.** Agrega los términos nuevos al final de `assets/js/data/glossary.data.js`, en un bloque `/* ---------- MNN: … ---------- */`. Todo `data-term` que uses tiene que existir.
5. **Publicación.** En `assets/js/data/course.data.js`, cambia `status: 'soon'` por `'ready'`. La ruta, el anterior/siguiente y la portada se actualizan solos.
6. **Pruebas.** Corre `test-page.mjs` y `links.mjs` (ver "Pruebas") y mira las capturas en claro, en oscuro y a 390 px.
7. **Traspaso.** Actualiza `PROGRESO.md`.

## Componentes de uso general

Todos están en `assets/css/components.css`; los interactivos, en `assets/js/`. Copia el marcado tal cual.

### Estructura de la página

```html
<section class="objectives" data-toc="skip" aria-labelledby="obj">
  <h2 class="plain" id="obj">Al terminar podrás</h2>
  <ul><li>…</li></ul>
</section>

<h2 id="streaming"><span class="sec-num">17.3</span>Streaming con SSE</h2>
<h3 id="streaming-cancelar">Cancelar cuando el cliente se va</h3>
```

- El índice lateral se arma solo con los `h2` y `h3` del contenido. Si un encabezado no tiene `id`, se genera uno con `SD.slug`; conviene ponerlo a mano para que los enlaces desde otros módulos no se rompan. `data-toc="skip"` excluye un bloque.
- Al final de cada módulo van, en este orden: `<h2 id="comprueba">Comprueba lo aprendido</h2>`, `<div data-quiz="m17"></div>`, el ejercicio y `<div data-checkpoint="m17"></div>`.

### Callouts

```html
<aside class="callout callout--prod">      <!-- también: callout--fail, callout--tradeoff, callout--def -->
  <p class="callout-label">En producción real</p>   <!-- "Qué pasa si falla", "Trade-off", "Definición" -->
  <p>…</p>
</aside>
```

La tarjeta de definición completa (`callout--def`) suma `p.def-term` (con `span.def-en` para el nombre en inglés), `p.def-one` (la definición en una frase) y un `dl.def-rows` con Intuición, Ejemplo y "Por qué importa en producción". Hay un ejemplo en `m00-metodo.html` (percentiles).

### Badges

```html
<span class="badge badge--doc">Documentado</span>
<span class="badge badge--ref">Diseño de referencia</span>
```

### Tablas

```html
<div class="table-wrap">
  <table class="t">
    <thead><tr><th>…</th></tr></thead>
    <tbody><tr><td>…</td><td class="r">1 024</td></tr></tbody>   <!-- .r: número alineado a la derecha -->
  </table>
</div>
```

### Endpoint

```html
<div class="endpoint">
  <div class="ep-head">
    <span class="ep-method" data-m="POST">POST</span>          <!-- GET, POST, PUT, PATCH, DELETE -->
    <code class="ep-path">/v1/chat/completions</code>
    <span class="badge badge--doc">Documentado</span>
  </div>
  <p class="ep-desc">Qué hace y quién lo llama.</p>
  <div class="ep-body">
    <p class="ep-sec">Request</p>
<pre data-lang="http"><code>…</code></pre>
    <p class="ep-sec">Respuesta 200</p>
<pre data-lang="json"><code>…</code></pre>
    <p class="ep-sec">Códigos de respuesta</p>
    <ul class="ep-responses">
      <li><span class="st st--2xx">200</span><span>…</span></li>   <!-- st--4xx, st--5xx -->
    </ul>
  </div>
</div>
```

### Esquema de una tabla de base de datos

```html
<figure class="schema">
  <figcaption class="schema-head">
    <code class="schema-name">messages</code>
    <span class="schema-chip">PostgreSQL</span>
    <span class="schema-chip">Partición: <b>conversation_id</b></span>
    <span class="badge badge--ref">Diseño de referencia</span>
  </figcaption>
  <div class="table-wrap">
    <table class="t t--schema">
      <thead><tr><th>Campo</th><th>Tipo</th><th>Restricciones</th><th>Para qué</th></tr></thead>
      <tbody><tr><td><code>id</code><span class="key">PK</span></td><td>…</td><td>…</td><td>…</td></tr></tbody>
    </table>                                       <!-- clave foránea: <span class="key key--fk">FK</span> -->
  </div>
</figure>
```

### Código

```html
<pre data-lang="python"><code>…</code></pre>      <!-- json | http | sse | sql | python -->
```

`sd.js` resalta el código solo. Dentro de `<code>` hay que escapar `&`, `<` y `>`.

### Figuras SVG

```html
<figure class="figure">
  <div class="figure-frame">
<svg viewBox="0 0 770 260" role="img" aria-labelledby="f173t f173d">
<title id="f173t">Título corto</title>
<desc id="f173d">Lo que muestra la figura, en prosa, para lectores de pantalla.</desc>
<defs><marker id="f173a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="dg-arrow"/></marker></defs>
…
</svg>
  </div>
  <figcaption><b>Figura 17.3.</b> Qué hay que ver en ella.</figcaption>
</figure>
```

- Los ids (`f173t`, `f173d`, `f173a`) tienen que ser únicos en la página.
- Clases de las figuras (`components.css`, sección "Figuras y diagramas SVG"):
  - cajas: `dg-box`, `dg-box--em`, `dg-layer` (con `style="--c: var(--l-gpu)"`), `dg-ok`, `dg-bad`, `dg-warnbox`, `hb-a`, `hb-b`, `hb-c`, `hb-lost`;
  - texto: `dg-label`, `dg-small`, `dg-tiny`, `dg-num`, `dg-group`, `dg-big`, `dg-in`, `dg-fail-text`;
  - líneas: `dg-edge`, `dg-feedback` (punteada; también sirve de guía entre una etiqueta y su flecha), `dg-frame`, `dg-arrow`;
  - gráficos: `sim-axis`, `sim-grid`, `sim-label`, `sim-val`.
- Los diagramas de secuencia se generan con `tools/seqdiag.py`: `seq(id, titulo, desc, actores, mensajes)`, con mensajes de tipo `req`, `res`, `fail` o `async`, notas y cortes. Con más de cinco actores, las cajas se angostan solas.
- Deja al menos 12 px entre cajas y textos. Una etiqueta lejos de su flecha lleva una guía `dg-feedback`.

### Pasos, pestañas, ADR

```html
<ol class="steps"><li><span class="step-title">Reservar</span>Texto del paso.</li></ol>

<div class="tabs" data-tabs="Formatos de streaming">
  <section data-tab="Chat Completions">…</section>
  <section data-tab="Responses">…</section>
</div>

<div class="adr">
  <div class="adr-head"><span class="adr-id">ADR-007. Título</span><span class="adr-state">Aceptado</span></div>
  <div class="adr-body"><h4>Contexto</h4><p>…</p>
    <ul class="pm-list"><li class="plus">A favor</li><li class="minus">En contra</li></ul></div>
</div>
```

### Ejercicio y solución larga

```html
<section class="exercise" aria-labelledby="ej-m17">
  <p class="exercise-title" id="ej-m17">Ejercicio de diseño: …</p>
  <p>Enunciado con números.</p>
  <details><summary>Ver la solución de referencia</summary><ul><li>…</li></ul></details>
</section>

<details class="solution" data-toc="skip">          <!-- soluciones largas, como la del Checkpoint A -->
  <summary>Ver la solución de referencia</summary>
  <div class="solution-body">…</div>
</details>
```

### Ejercicio guiado

Un escenario de diseño que se resuelve decisión por decisión: cada decisión es una pregunta con el formato del quiz, muestra su explicación al responderla y la siguiente aparece cuando el lector quiere seguir. Al final aparecen el puntaje y la solución de referencia, que también se puede abrir en cualquier momento. No cuenta para el checkpoint ni se guarda en el progreso.

```html
<div data-exercise="m06-planificador"></div>   <!-- dentro de una sección, o al final en lugar del ejercicio estático -->
```

```js
// assets/js/data/exercises/m06.data.js
SD.defineExercise('m06-planificador', {
  title: 'un planificador de tareas sin duplicados',    // se muestra como "Ejercicio guiado: …"
  scenario: '<p>Enunciado con números.</p>',            // HTML
  steps: [ /* preguntas como las del quiz: single, multi u order, con explain */ ],
  solution: '<ul><li>…</li></ul>'                        // HTML
});
```

- Los scripts: `data/exercises/<id>.data.js` después de los datos del quiz, y `core/exercise.js` después de `core/quiz.js` (usa `SD.quizKit`). Con `mkpage.py`, alcanza con `"exercises": true` en el META; en una página existente se agregan a mano (así está en M18).
- El glosario no enlaza dentro de `[data-exercise]`: los términos se explican en el texto del módulo.
- Ejercicios publicados: siete en M06, uno en M18 y uno en M19.

### Quiz y checkpoint

```html
<div data-quiz="m17"></div>
<div data-checkpoint="m17"></div>   <!-- se habilita al aprobar el quiz con 70 % o más -->
```

```js
SD.defineQuiz('m17', {
  title: 'Quiz: …', pass: 0.7,
  questions: [
    { id: 'x', type: 'single', prompt: '…', options: ['…', '…'], answer: 1, explain: '…' },
    { id: 'y', type: 'multi',  prompt: '…', options: [...], answer: [0, 2], explain: '…' },
    { id: 'z', type: 'order',  prompt: 'Ordena…', items: ['primero', 'segundo', '…'], explain: '…' }
  ]
});
```

- Las opciones se barajan; `fixed: true` conserva el orden (por ejemplo, si son números).
- `explain` dice por qué la respuesta es esa y adónde volver a leer. El `prompt` admite HTML.
- Los módulos de las Partes I y II tienen 8 o 9 preguntas (el M06, ampliado, tiene 18); los casos de estudio, entre 16 y 20, y el Checkpoint A, 20.

### Término del glosario

```js
{ id: 'tpm', term: 'TPM', en: 'Tokens per minute', cat: 'ia', mods: ['m18'],
  deep: 'm18#cuotas', aliases: ['tokens por minuto'],      // basic: true | noauto: true si corresponde
  short: 'Una o dos frases que se entiendan solas.', related: ['rate-limiting'] }
```

Categorías (`SD.catNames` en `glossary.js`): `metodo`, `redes`, `datos`, `distribuidos`, `resiliencia`, `seguridad`, `ia`, `pagos`, `edge`, `nube`, `mensajeria`.

### Mapa explorable

- En la página: `<div data-map="m29-whatsapp"></div>`. En el META: `"css":["map.css"]`, `"data":["data/maps/m29-whatsapp.data.js"]` y `"scripts":["map/map-engine.js","map/flow-sim.js"]`.
- Formato completo en la cabecera de `map/map-engine.js` y `map/flow-sim.js`:
  - `groups`, `nodes` y `edges`, con las coordenadas del centro de cada nodo;
  - capas: `client`, `edge`, `service`, `queue`, `cache`, `db`, `gpu`, `external`;
  - `bus: true` con un `w` grande dibuja una barra, como un log de Kafka: cada arista llega de frente, a la altura o en la columna del otro nodo (así está en M30);
  - cada nodo tiene cinco pestañas: `info.resp`, `info.api`, `info.data`, `info.fail` e `info.nums`;
  - `scenarios` con `steps` de la forma `{from, to | at, kind, tag, ms, title, text, code, lang, down, up}`;
  - enlaces directos: `#node=<id>&scenario=<id>&step=<n>`.
- Deja pasillos de unos 150 px entre columnas de nodos para que las etiquetas de las aristas no se pisen.

### Widgets (calculadoras y simuladores)

| Selector | Archivo | Qué hace |
|---|---|---|
| `data-calc="envelope"`, `"availability"`, `"tail"` | `widgets/calculators.js` | Back-of-envelope, disponibilidad compuesta y latencia de cola con fan-out (M00) |
| `data-sim="lb"` | `widgets/sim-lb.js` | Algoritmos de balanceo con un servidor lento (M03) |
| `data-sim="stampede"` | `widgets/sim-cache.js` | Cache stampede y sus mitigaciones (M04) |
| `data-sim="isolation"`, `"quorum"`, `"ring"` | `widgets/sim-db.js` | Aislamiento, quórum y hashing consistente (M05) |
| `data-sim="raft"` | `widgets/sim-raft.js` | Elecciones, log y particiones de Raft (M06) |
| `data-sim="lin"` | `widgets/sim-lin.js` | ¿Es linealizable? Historias editables y verificador exhaustivo, linealizable y secuencial; lógica en `SD.linCore` (M06) |
| `data-sim="kafka"` | `widgets/sim-kafka.js` | Particiones, consumer group, lag y rebalanceo (M07) |
| `data-sim="bucket"`, `"retry"` | `widgets/sim-resil.js` | Token bucket y tormenta de reintentos (M08) |
| `data-sim="signurl"` | `widgets/sim-signurl.js` | URL firmada SigV4; expone `SD.crypto` (SHA-256 y HMAC en JS puro) (M09) |
| `data-sim="jwt"` | `widgets/sim-jwt.js` | Laboratorio de JWT; necesita `sim-signurl.js` (M10) |
| `data-sim="trace"`, `"burnrate"` | `widgets/sim-obs.js` | Waterfall de traces y alertas por burn rate (M11) |
| `data-sim="tokenizer"`, `"kvcache"` | `widgets/sim-llm.js` | Tokenizer y generación con KV cache (M12); usa `data/llm.data.js` |
| `data-calc="gpusizing"`, `data-sim="roofline"` | `widgets/sim-gpu.js` | Sizing de GPUs y roofline (M13) |
| `data-sim="quant"` | `widgets/sim-quant.js` | Cuantización de pesos (M14) |
| `data-sim="batching"`, `data-calc="speculative"` | `widgets/sim-engine.js` | Static y continuous batching, speculative decoding (M15) |
| `data-sim="context"`, `data-calc="convcost"` | `widgets/sim-context.js` | Estrategias de contexto y costo de una conversación (M16) |
| `data-sim="sse"`, `data-calc="streamcap"` | `widgets/sim-sse.js` | Un stream SSE evento por evento en tres formatos, y streams abiertos con la ley de Little (M17) |
| `data-sim="reserve"`, `"tenants"`, `data-calc="escrow"` | `widgets/sim-quota.js` | Reservar y reconciliar tokens, cuatro clientes sobre una flota, y contador central contra escrow; lógica en `SD.quotaCore` (M18) |
| `data-sim="router"`, `data-calc="coldstart"` | `widgets/sim-router.js` | Cinco políticas de routing con prefix caching y carga, y cold start con colchón de réplicas; lógica en `SD.routerCore` (M19) |
| `data-calc="snowflake"`, `data-calc="fanout"` | `widgets/sim-feed.js` | Id Snowflake bit por bit, y escrituras y lecturas del fan-out en escritura, en lectura e híbrido (M30) |
| `data-calc="bom" data-preset="m27\|m28\|m29\|m30"`, `data-calc="gateways"` | `widgets/sim-infra.js` | Factura mensual en AWS y dimensionamiento de gateways (casos de estudio) |

Para escribir un widget nuevo:

- Copia el patrón de `widgets/sim-context.js`: una IIFE que usa `SD.h` para crear nodos y `SD.fmt` para los números, y que se inicializa en `SD.ready` sobre `document.querySelectorAll('[data-sim="…"]')`.
- Usa las clases `sim`, `sim-head`, `sim-title`, `sim-body`, `sim-controls`, `field`, `sim-stats`, `sim-stat`, `sim-note` y `sim-foot`, o sus equivalentes `calc-*` con `out-row`.
- Los botones son `btn`, `btn--primary`, `chip-btn` (con `aria-pressed`) e `icon-btn`.
- Los resultados que cambian van en un contenedor con `aria-live="polite"`.
- Respeta `prefers-reduced-motion` en las animaciones.

### Ayudas de `core/sd.js`

- `SD.h(tag, attrs, hijos)` crea elementos.
- `SD.fmt` formatea números: `num`, `sig`, `words`, `bytes`, `bitrate`, `pct`, `nines` y `duration`.
- También están `SD.escape`, `SD.slug` y `SD.shuffle`.
- `SD.highlight(root)` resalta código y `SD.initTabs(root)` arma las pestañas.
- `SD.ready(fn)` corre `fn` cuando el DOM está listo. `SD.autolink(root)` está en `glossary.js`.

## Pruebas

Se necesitan Node 22 o superior (usa el WebSocket nativo) y Chrome instalado. No hay dependencias.

| Comando | Qué revisa |
|---|---|
| `node tools/test/test-page.mjs <salida> <archivo en modules/> ["sel1\|sel2"]` | Errores de consola, términos faltantes, quiz, cada paso de cada escenario de los mapas, índice, desborde a 390 px y capturas. **La carpeta de salida tiene que existir.** |
| `node tools/test/links.mjs [modules/x.html …]` | Qué enlazó el glosario en cada sección, enlaces anidados, anclas rotas y términos faltantes. Sin argumentos revisa todo el sitio. |
| `node tools/test/shots.mjs <salida> <página> <light\|dark> <ancho> "<pasos>"` | Capturas guiadas: `@sel`, `hover:`, `click:`, `tap:`, `key:`, `eval:`, `shot` y `full`. |

Una página está lista cuando las pruebas dan cero errores de consola, cero términos faltantes, cero problemas de enlaces y ningún desborde a 390 px, y las capturas en claro y en oscuro se ven bien.

## Trucos aprendidos

- **Ediciones grandes o de varias líneas:** usa un script de Python con `assert s.count(viejo) == 1` antes de reemplazar. Las comillas anidadas en PowerShell suelen fallar.
- **Node en Windows:** los `import` de ESM aceptan rutas relativas o URLs `file://`, no `C:/…`.
- **Figuras en el teléfono:** a 390 px se desplazan dentro de su marco. El texto más chico de una figura de 770 px de ancho queda cerca de 9.6 px, así que no bajes de `dg-tiny` (11.5 px).
- **Etiquetas de aristas en los mapas:** se pisan fácilmente. Mídelo con capturas y acomoda con `labelAt` o `bend`.
- **Alias del glosario:** los alias ambiguos generan enlaces falsos. Así pasó con "latencia de cola" usado como espera en una cola, y con "estampida" en M03. `links.mjs` los muestra. Por eso "liveness" no es alias de nada (M03 habla de liveness probes) y "máquina de estados" tampoco (M27 la usa para pagos).
- **Barras invertidas:** el heredoc del Bash tool convierte `\\n` en `\n`. Para cualquier texto con barras invertidas (Python que genera SVG, regex, JS), usa Write o Edit en lugar de un heredoc.
- **Gráficos de widgets en el teléfono:** los SVG de `.sim` se achican al ancho disponible. Si las etiquetas importan, dale un `min-width` al SVG dentro de `.sim-scroll`, como `.lin-chart svg { min-width: 560px; }`, y el gráfico se desplaza en su marco.
- **Probar un ejercicio guiado de punta a punta:** `shots.mjs` con un paso `eval:` que, para cada decisión, hace clic en `.opt[data-idx="<respuesta>"]` (y en `.q-check` si es multi) y después en `.gx-next`; al final, `.gx-score` dice cuántas coinciden.

## Estructura

Salida de `tree /f` en la raíz del proyecto. Para actualizarla, vuelve a correr el comando.

<!-- tree:start -->
```text
ia-system-desing
│   CLAUDE.md
│   glosario.html
│   index.html
│   PLAN.md
│   PROGRESO.md
│   proyectos.html
│   Referencias.md
│
├───.github
│   └───workflows
│           static.yml
│
├───assets
│   │   favicon.svg
│   │
│   ├───css
│   │       components.css
│   │       home.css
│   │       layout.css
│   │       map.css
│   │       projects.css
│   │       tokens.css
│   │
│   └───js
│       ├───core
│       │       exercise.js
│       │       glossary.js
│       │       nav.js
│       │       progress.js
│       │       quiz.js
│       │       sd.js
│       │
│       ├───data
│       │   │   course.data.js
│       │   │   glossary.data.js
│       │   │   llm.data.js
│       │   │   projects.data.js
│       │   │
│       │   ├───exercises
│       │   │       m06.data.js
│       │   │       m18.data.js
│       │   │       m19.data.js
│       │   │
│       │   ├───maps
│       │   │       m01-request.data.js
│       │   │       m04-cache.data.js
│       │   │       m09-objetos.data.js
│       │   │       m19-flota.data.js
│       │   │       m27-pagos.data.js
│       │   │       m28-cloudflare.data.js
│       │   │       m29-whatsapp.data.js
│       │   │       m30-twitter.data.js
│       │   │
│       │   └───quizzes
│       │           cpa.data.js
│       │           m00.data.js
│       │           m01.data.js
│       │           m02.data.js
│       │           m03.data.js
│       │           m04.data.js
│       │           m05.data.js
│       │           m06.data.js
│       │           m07.data.js
│       │           m08.data.js
│       │           m09.data.js
│       │           m10.data.js
│       │           m11.data.js
│       │           m12.data.js
│       │           m13.data.js
│       │           m14.data.js
│       │           m15.data.js
│       │           m16.data.js
│       │           m17.data.js
│       │           m18.data.js
│       │           m19.data.js
│       │           m20.data.js
│       │           m27.data.js
│       │           m28.data.js
│       │           m29.data.js
│       │           m30.data.js
│       │
│       ├───map
│       │       flow-sim.js
│       │       map-engine.js
│       │
│       ├───pages
│       │       home.js
│       │       projects.js
│       │
│       └───widgets
│               calculators.js
│               sim-cache.js
│               sim-collab.js
│               sim-context.js
│               sim-db.js
│               sim-feed.js
│               sim-engine.js
│               sim-gpu.js
│               sim-infra.js
│               sim-jwt.js
│               sim-kafka.js
│               sim-lb.js
│               sim-lin.js
│               sim-llm.js
│               sim-obs.js
│               sim-quant.js
│               sim-quota.js
│               sim-raft.js
│               sim-resil.js
│               sim-router.js
│               sim-signurl.js
│               sim-sse.js
│
├───modules
│       checkpoint-a.html
│       m00-metodo.html
│       m01-viaje-request.html
│       m02-apis.html
│       m03-balanceo-gateways.html
│       m04-cache.html
│       m05-bases-de-datos.html
│       m06-teoria-distribuida.html
│       m07-mensajeria.html
│       m08-resiliencia.html
│       m09-objetos.html
│       m10-seguridad.html
│       m11-observabilidad.html
│       m12-llm-por-dentro.html
│       m13-gpus.html
│       m14-cuantizacion.html
│       m15-motores-inferencia.html
│       m16-context-windows.html
│       m17-api-streaming.html
│       m18-cuotas-tokens.html
│       m19-router-flota.html
│       m20-producto-chatgpt.html
│       m27-pagos-stripe.html
│       m28-cloudflare.html
│       m29-whatsapp.html
│       m30-twitter.html
│
└───tools
    │   mkpage.py
    │   seqdiag.py
    │
    └───test
            cdp.mjs
            links.mjs
            shots.mjs
            test-page.mjs
```
<!-- tree:end -->

| Ruta | Para qué |
|---|---|
| `index.html` + `assets/css/home.css` + `assets/js/pages/home.js` | Portada: mapa de la ruta del curso, "continuar donde quedaste", plan por partes y respaldo del progreso |
| `glosario.html` | Glosario con buscador y filtro por categoría; lo arma `core/glossary.js` |
| `proyectos.html` + `assets/css/projects.css` + `assets/js/pages/projects.js` | "Aplicación de conocimiento": índice de mini-proyectos en Java y Spring Boot, con sus datos en `data/projects.data.js` (cada proyecto con `tier`, `status`, `mods` y `repo`, obligatorio para publicarlo) |
| `modules/` | Una página por módulo y por checkpoint, generada con `mkpage.py` y editada después a mano |
| `assets/css/tokens.css` | Colores semánticos en claro y oscuro, paleta de capas `--l-*`, tipografía y espacios |
| `assets/css/layout.css` | Barra superior, sidebar, índice lateral y responsive |
| `assets/css/components.css` | Todos los componentes del contenido y de los widgets |
| `assets/css/map.css` | Motor de mapas |
| `assets/js/core/` | `sd.js` (espacio de nombres y utilidades), `progress.js`, `nav.js`, `glossary.js`, `quiz.js` y `exercise.js` (ejercicios guiados) |
| `assets/js/map/` | `map-engine.js` (pan, zoom, minimapa, panel de 5 pestañas) y `flow-sim.js` (escenarios animados) |
| `assets/js/widgets/` | Calculadoras y simuladores; uno o dos widgets por archivo |
| `assets/js/data/` | `course.data.js` (estructura y estado de cada módulo), `glossary.data.js`, `llm.data.js` (modelos y GPUs), `maps/`, `quizzes/` y `exercises/` |
| `tools/mkpage.py` | Genera la página de un módulo a partir de un fragmento con `<!--META-->` |
| `tools/seqdiag.py` | Genera diagramas de secuencia en SVG con las clases del curso |
| `tools/test/` | Arnés de pruebas con Chrome headless por DevTools Protocol |
| `PLAN.md`, `PROGRESO.md` | Currículo completo y estado de traspaso entre sesiones |
