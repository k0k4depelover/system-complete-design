/* Mapa del M27: pagos con tarjeta al estilo de Stripe. La API y su comportamiento público son documentados;
   la arquitectura interna es un diseño de referencia. */
SD.defineMap('m27-pagos', {
  title: 'Pagos con tarjeta de punta a punta',
  intro: 'Una tienda cobra 49.90 EUR con tarjeta. A la izquierda, lo que implementa el comercio; en el centro, un procesador de pagos al estilo de Stripe (su API está documentada; su interior es un diseño de referencia); a la derecha, la red de tarjetas y el banco del cliente.',
  start: 'edge',
  stepPanel: true,
  pieces: true,
  groups: [
    { id: 'g-com', label: 'El comercio', x: 20, y: 40, w: 300, h: 920 },
    { id: 'g-psp', label: 'Procesador de pagos (diseño de referencia)', x: 500, y: 40, w: 1005, h: 920 },
    { id: 'g-red', label: 'Red de tarjetas y bancos', x: 1595, y: 40, w: 280, h: 920 }
  ],
  nodes: [
    { id: 'browser', layer: 'client', label: 'Navegador del cliente', sub: 'Stripe.js y Elements', x: 170, y: 150,
      brief: 'Muestra el formulario de la tarjeta (un iframe del procesador) y confirma el pago.',
      info: {
        resp: '<p>El formulario de la tarjeta es un iframe servido por el procesador: el número de tarjeta viaja directo del navegador al procesador y nunca toca los servidores del comercio. El navegador recibe del backend del comercio un <code>client_secret</code> y confirma el pago con Stripe.js; si el banco pide 3D Secure, Stripe.js muestra el desafío. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>const stripe = Stripe("pk_live_…");        // clave publicable: solo tokeniza y confirma\nconst { error, paymentIntent } = await stripe.confirmPayment({\n  elements,                               // el iframe con la tarjeta\n  clientSecret,                           // del PaymentIntent creado por el backend\n  redirect: "if_required",\n});</code></pre>',
        data: '<p>Nada de la tarjeta. Solo el <code>client_secret</code> de este PaymentIntent, que permite confirmar ese pago y nada más.</p>',
        fail: '<ul><li><b>Doble clic en Pagar:</b> se deshabilita el botón, pero la protección real es la idempotency key del backend (escenario "Doble clic").</li><li><b>La pestaña se cierra durante 3D Secure:</b> el pago queda en <code>requires_action</code>; el webhook o la vuelta al sitio resuelven el estado final.</li><li><b>El navegador dice "pagado":</b> no es prueba de nada. El comercio cumple el pedido con el webhook, no con el redirect.</li></ul>',
        nums: '<ul><li>Confirmar un pago tarda de 1 a 3 s de punta a punta, casi todo en la red de tarjetas y el banco emisor.</li></ul>'
      } },
    { id: 'merchant', layer: 'service', label: 'Backend del comercio', sub: 'crea pagos, recibe webhooks', x: 170, y: 480,
      brief: 'Crea el pago con el monto calculado en el servidor y cumple el pedido cuando llega el webhook.',
      info: {
        resp: '<p>Crea el PaymentIntent con el monto calculado en el servidor, nunca con el que manda el navegador, y con una idempotency key derivada del pedido. Entrega el <code>client_secret</code> al navegador y cumple el pedido solo cuando recibe el webhook de pago exitoso.</p>',
        api: '<pre data-lang="python"><code>import os, stripe\nstripe.api_key = os.environ["STRIPE_SECRET_KEY"]\n\npi = stripe.PaymentIntent.create(\n    amount=4990, currency="eur",            # 49.90 EUR en unidades menores\n    metadata={"order_id": "ord_8812"},\n    idempotency_key="ord_8812-pago",        # la misma en cada reintento\n)\nreturn {"client_secret": pi.client_secret}</code></pre>',
        data: '<p>Pedidos y eventos ya procesados, en su propia base (mira ese nodo).</p>',
        fail: '<ul><li><b>Timeout al crear el pago:</b> reintenta con la misma clave; nunca con una nueva.</li><li><b>Webhook lento:</b> responde 2xx en cuanto verificó la firma y guardó el evento, y procesa después; si tarda, el procesador reintenta y llegan duplicados.</li></ul>',
        nums: '<ul><li>Crear el PaymentIntent: unos cientos de ms.</li><li>El webhook llega de milisegundos a segundos después del pago; si el comercio falla, se reintenta hasta 3 días.</li></ul>'
      } },
    { id: 'merchantdb', layer: 'db', label: 'Base del comercio', sub: 'pedidos y eventos procesados', x: 170, y: 660,
      brief: 'Guarda los pedidos y los eventos ya procesados, en la misma transacción.',
      info: {
        resp: '<p>La verdad del comercio sobre sus pedidos. Registrar el evento procesado y cambiar el estado del pedido van en la misma transacción: si no, un reintento puede aplicar el cambio dos veces o ninguna.</p>',
        api: '<pre data-lang="sql"><code>BEGIN;\nINSERT INTO processed_events (event_id) VALUES ($1)\n  ON CONFLICT DO NOTHING;                  -- 0 filas: ya se procesó, salir\nUPDATE orders SET status = \'paid\'\n  WHERE id = $2 AND status = \'pending\';     -- solo avanza, nunca retrocede\nCOMMIT;</code></pre>',
        data: '<pre data-lang="sql"><code>CREATE TABLE orders (\n  id                 text PRIMARY KEY,\n  amount             bigint  NOT NULL,     -- unidades menores\n  currency           char(3) NOT NULL,\n  status             text NOT NULL CHECK (status IN\n                       (\'pending\', \'paid\', \'refunded\', \'fulfilled\')),\n  payment_intent_id  text UNIQUE\n);\nCREATE TABLE processed_events (\n  event_id     text PRIMARY KEY,           -- evt_…\n  received_at  timestamptz NOT NULL DEFAULT now()\n);</code></pre>',
        fail: '<p>La condición <code>status = \'pending\'</code> hace que un evento viejo que llega tarde no pueda devolver a "pagado" un pedido ya reembolsado.</p>',
        nums: '<ul><li>Los eventos procesados se pueden borrar pasados unos días: más que los 3 días de reintentos.</li></ul>'
      } },
    { id: 'edge', layer: 'edge', label: 'API del procesador', sub: 'autenticación, límites, idempotencia', x: 675, y: 330,
      brief: 'Puerta de entrada: autentica la clave, aplica los límites de tasa y pasa por la idempotencia.',
      info: {
        resp: '<p>Recibe cada request: autentica la clave secreta (<code>sk_</code>) o publicable (<code>pk_</code>), aplica límites por cuenta y pasa por la capa de idempotencia antes de cualquier operación que cambie estado. La API de Stripe recibe los parámetros como formulario y responde JSON, y versiona por fecha: cada cuenta queda fijada a la versión de su primera request y puede pedir otra con el header <code>Stripe-Version</code>. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre data-lang="http"><code>POST /v1/payment_intents HTTP/1.1\nHost: api.stripe.com\nAuthorization: Bearer sk_live_…\nIdempotency-Key: ord_8812-pago\nContent-Type: application/x-www-form-urlencoded\n\namount=4990&amp;currency=eur&amp;metadata[order_id]=ord_8812</code></pre>',
        data: '<p>Sin estado propio: usa el almacén de idempotencia y los contadores de límites por cuenta.</p>',
        fail: '<ul><li><b>429:</b> el cliente espera y reintenta con backoff exponencial y jitter. El header <code>Stripe-Rate-Limited-Reason</code> dice cuál límite se superó (<code>global-rate</code>, <code>endpoint-rate</code>, <code>global-concurrency</code>…). <span class="badge badge--doc">Documentado</span></li><li><b>5xx o timeout:</b> se reintenta con la misma clave. Las librerías oficiales de Stripe reintentan solas y generan la clave si no se la das. <span class="badge badge--doc">Documentado</span></li><li><b>Bajo presión:</b> cuatro capas de límites y descarte, de la más suave a la más dura (escenario "Flash sale").</li></ul>',
        nums: '<ul><li>Límite global de 100 requests por segundo por cuenta en modo live y 25 en sandbox; 25 por segundo por endpoint salvo que se indique otro; 1000 actualizaciones por hora por PaymentIntent. <span class="badge badge--doc">Documentado</span></li><li>Las lecturas tienen además un presupuesto: en promedio 500 por transacción en 30 días. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'idem', layer: 'db', label: 'Claves de idempotencia', sub: 'una fila por clave, 24 h o más', x: 675, y: 510,
      brief: 'Guarda la respuesta de cada idempotency key para repetirla sin ejecutar nada dos veces.',
      info: {
        resp: '<p>Por cada clave guarda un hash de la request, quién la está ejecutando y la respuesta final. El comportamiento público de Stripe: la primera respuesta se guarda y se repite, incluidos los errores 500; la misma clave con otros parámetros da error; las claves se pueden borrar pasadas al menos 24 horas. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>INSERT … ON CONFLICT DO NOTHING\nsi la clave ya existía:\n  hash distinto          → 400 idempotency_error\n  respuesta guardada     → devolverla tal cual\n  locked_until &gt; now()   → 409: otra request con esta clave sigue en curso\n  lock vencido           → tomarlo y retomar desde recovery_point</code></pre>',
        data: '<pre data-lang="sql"><code>CREATE TABLE idempotency_keys (\n  account_id      text NOT NULL,\n  key             text NOT NULL,          -- hasta 255 caracteres\n  request_hash    bytea NOT NULL,         -- SHA-256 de método, ruta y cuerpo\n  locked_until    timestamptz,            -- dueño de la ejecución en curso\n  recovery_point  text NOT NULL DEFAULT \'started\',\n  response_code   int,\n  response_body   jsonb,\n  created_at      timestamptz NOT NULL DEFAULT now(),\n  PRIMARY KEY (account_id, key)\n);</code></pre>',
        fail: '<p>Si este almacén no responde, la API no puede garantizar el efecto único: rechaza las escrituras (fail-closed) en lugar de ejecutarlas sin protección. Es la decisión opuesta a la de Radar, y por el mismo motivo: cuál error cuesta más (M00).</p>',
        nums: '<ul><li>1 a 10 kB por clave con la respuesta guardada; particionado por cuenta.</li></ul>'
      } },
    { id: 'payments', layer: 'service', label: 'Servicio de pagos', sub: 'máquina de estados del PaymentIntent', x: 1015, y: 330,
      brief: 'Mueve el PaymentIntent por su máquina de estados y coordina a todos los demás.',
      info: {
        resp: '<p>Ejecuta las transiciones del PaymentIntent, consulta a Radar, habla con el adquirente, escribe el ledger y deja el evento en el outbox. Cada operación avanza por puntos de recuperación guardados en la base, así cualquier instancia puede retomar una request cortada a la mitad.</p>',
        api: '<pre><code>POST /v1/payment_intents              crear\nPOST /v1/payment_intents/{id}/confirm confirmar con un medio de pago\nPOST /v1/payment_intents/{id}/capture capturar lo autorizado\nPOST /v1/payment_intents/{id}/cancel  cancelar\nPOST /v1/refunds                      reembolsar, total o parcial</code></pre>',
        data: '<p>Nada en memoria: el estado vive en la base de pagos.</p>',
        fail: '<p>La llamada al adquirente es el único efecto que no se puede deshacer con un rollback. Se registra antes de hacerla, con el ID de transacción que se enviará, y después con el resultado. Si el proceso muere en el medio, la recuperación consulta por ese ID o envía una reversa (escenario "Timeout del banco").</p>',
        nums: '<ul><li>Stripe informó 1.4 billones de dólares de volumen procesado en 2024. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'vault', layer: 'db', label: 'Bóveda de tarjetas', sub: 'números cifrados, alcance PCI', x: 675, y: 150,
      brief: 'Cifra el número de la tarjeta y devuelve un token: el único lugar donde existe el número.',
      info: {
        resp: '<p>Recibe el número de la tarjeta (PAN), lo cifra con claves custodiadas en HSM (envelope encryption, M10) y devuelve un token (<code>pm_…</code>). Es el único componente dentro del alcance más estricto de PCI DSS: el resto del sistema solo ve tokens.</p>',
        api: '<pre><code>tokenize(pan, vencimiento, cvc)  → pm_1Q…\ndetokenize(pm_1Q…)               → solo desde el conector del adquirente, auditado</code></pre>',
        data: '<p>PAN cifrado, últimos 4 dígitos, marca, vencimiento y un fingerprint para reconocer la misma tarjeta sin descifrarla. El código de seguridad (CVC) no se guarda después de la autorización: PCI DSS lo prohíbe. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<p>Una filtración de la bóveda es el peor incidente posible: red segmentada, acceso de muy pocas personas, claves en HSM y auditoría anual externa.</p>',
        nums: '<ul><li>Tokenizar: milisegundos. Los tokens de la red (network tokens) permiten además que la tarjeta siga funcionando cuando el banco la reemplaza.</li></ul>'
      } },
    { id: 'radar', layer: 'service', label: 'Radar', sub: 'puntaje de fraude', x: 1015, y: 150,
      brief: 'Puntúa el riesgo de fraude de cada pago en menos de 100 ms y aplica las reglas del comercio.',
      info: {
        resp: '<p>Asigna a cada pago un puntaje de riesgo con un modelo entrenado con pagos de toda la red, y aplica las reglas del comercio: bloquear, mandar a revisión o pedir 3D Secure. Evalúa más de mil características de cada pago y decide en menos de 100 ms, dentro de la ruta de la autorización. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>score(pago) → { risk_score: 0–99, risk_level: normal | elevated | highest }\nregla del comercio:  Block if :risk_score: &gt; 75</code></pre>',
        data: '<p>Señales: fingerprint de la tarjeta, IP, dispositivo, historial de esa tarjeta en otros comercios, velocidad de intentos.</p>',
        fail: '<p>Si Radar no responde a tiempo, el pago sigue con el puntaje por defecto (fail-open): perder una evaluación de fraude cuesta menos que rechazar todos los pagos. La decisión está escrita, no es un accidente.</p>',
        nums: '<ul><li>Decenas de milisegundos por evaluación, dentro del presupuesto de la confirmación.</li></ul>'
      } },
    { id: 'acquirer', layer: 'service', label: 'Conector del adquirente', sub: 'habla ISO 8583 con la red', x: 1345, y: 330,
      brief: 'Traduce cada intento a mensajes ISO 8583 y conversa con la red de tarjetas.',
      info: {
        resp: '<p>Traduce cada intento a mensajes ISO 8583: 0100 para autorizar, 0400 para revertir. Asigna a cada intento un número único (STAN y RRN) que la red usa para detectar duplicados y que después aparece en los archivos de liquidación.</p>',
        api: '<pre><code>0100  autorización\n  campo 2   PAN (desde la bóveda)\n  campo 4   000000004990      monto\n  campo 49  978               EUR\n  campo 11  STAN 004211       número del intento\n0110  respuesta, campo 39: 00 aprobado · 05 no autorizar · 51 sin fondos · 91 emisor no disponible</code></pre>',
        data: '<p>Registro de cada mensaje enviado y recibido, escrito antes de enviarlo y al recibir la respuesta.</p>',
        fail: '<p>Timeout sin respuesta: se envía una reversa (0400) para anular una posible aprobación. Reintentar la autorización a ciegas puede retener el dinero dos veces en la tarjeta del cliente.</p>',
        nums: '<ul><li>Una autorización tarda de 1 a 2 s de ida y vuelta hasta el emisor.</li></ul>'
      } },
    { id: 'network', layer: 'external', label: 'Red de tarjetas', sub: 'Visa, Mastercard', x: 1735, y: 330,
      brief: 'Lleva la autorización al banco emisor y liquida el dinero entre bancos cada día.',
      info: {
        resp: '<p>Enruta la autorización del adquirente al banco emisor según los primeros dígitos de la tarjeta, y cada día hace el clearing y la liquidación entre bancos. Si el emisor no responde, puede aprobar en su nombre dentro de reglas acordadas con él (stand-in processing). <span class="badge badge--doc">Documentado</span></p>',
        api: '<p>Mensajes ISO 8583 en tiempo real para autorizaciones (0100/0110), reversas (0400/0410) y mensajes de red como el eco (0800); archivos por lotes para clearing, liquidación y disputas.</p>',
        data: '<p>Reglas de stand-in por emisor, tokens de red e historial de disputas.</p>',
        fail: '<p>Semanas después puede llegar un contracargo: el titular disputa el cobro y la red devuelve el dinero al emisor; el comercio lo recupera solo si gana la disputa.</p>',
        nums: '<ul><li>Las grandes redes procesan cientos de millones de transacciones por día.</li></ul>'
      } },
    { id: 'issuer', layer: 'external', label: 'Banco emisor', sub: 'aprueba y retiene fondos', x: 1735, y: 510,
      brief: 'El banco del cliente: autentica al titular, aprueba o rechaza y retiene los fondos.',
      info: {
        resp: '<p>El banco del titular de la tarjeta: verifica fondos o crédito, su propio fraude y la autenticación (3D Secure), y aprueba o rechaza. Al aprobar, retiene el monto; el dinero se mueve recién en la liquidación.</p>',
        api: '<p>Responde 0110 con el código 00 (aprobado) o el motivo del rechazo.</p>',
        data: '<p>Saldo, límite y retenciones pendientes de cada tarjeta.</p>',
        fail: '<p>Si está caído, la red aplica stand-in o rechaza con código 91; el comercio muestra "no se pudo procesar, intenta de nuevo".</p>',
        nums: '<ul><li>Una autorización que nunca se captura retiene el dinero unos días; Stripe cancela los PaymentIntents sin capturar a los 7 días en pagos con tarjeta online. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'paydb', layer: 'db', label: 'Base de pagos', sub: 'PaymentIntents y outbox', x: 1015, y: 510,
      brief: 'Guarda el estado de cada pago y su evento (outbox) en la misma transacción.',
      info: {
        resp: '<p>El estado de cada pago. El cambio de estado y el evento que lo anuncia se escriben en la misma transacción, en la tabla outbox (M07): no puede existir un pago exitoso sin su evento.</p>',
        api: '<pre data-lang="sql"><code>BEGIN;\nUPDATE payment_intents\n   SET status = \'succeeded\', amount_received = 4990, version = version + 1\n WHERE id = \'pi_3Q…\' AND version = 7;\nINSERT INTO outbox (event_type, payload)\n     VALUES (\'payment_intent.succeeded\', \'{"id": "pi_3Q…"}\');\nCOMMIT;</code></pre>',
        data: '<pre data-lang="sql"><code>CREATE TABLE payment_intents (\n  id               text PRIMARY KEY,     -- pi_3Q…\n  account_id       text NOT NULL,\n  amount           bigint NOT NULL CHECK (amount &gt; 0),\n  currency         char(3) NOT NULL,\n  status           text NOT NULL,\n  amount_received  bigint NOT NULL DEFAULT 0,\n  amount_refunded  bigint NOT NULL DEFAULT 0\n                   CHECK (amount_refunded &lt;= amount_received),\n  version          int NOT NULL DEFAULT 0\n);</code></pre>',
        fail: '<p>Particionada por cuenta: una partición caída detiene los pagos de sus comercios, no los de todos (arquitectura celular, M08). Stripe describió públicamente su base de documentos, DocDB, construida sobre MongoDB: más de 2000 shards y 5 millones de consultas por segundo, con migraciones de datos entre shards sin cortes (la transferencia de tráfico dura menos de 2 segundos). <span class="badge badge--doc">Documentado</span></p>',
        nums: '<ul><li>El <code>CHECK</code> de reembolsos es la última defensa contra reembolsar más de lo cobrado, aunque falle todo lo demás.</li></ul>'
      } },
    { id: 'ledger', layer: 'db', label: 'Ledger', sub: 'doble entrada, solo se agrega', x: 1345, y: 510,
      brief: 'Registra cada movimiento de dinero en asientos que suman cero; nada se edita.',
      info: {
        resp: '<p>Registra cada movimiento de dinero como una transacción de asientos que suman cero: lo que sale de una cuenta entra en otra. Los saldos se derivan de los asientos, y nada se edita: un error se corrige con asientos nuevos.</p>',
        api: '<pre><code>cobro de pi_3Q…, 49.90 EUR con 1.00 de comisión:\n  débito   por cobrar al adquirente      4990\n  crédito  saldo pendiente del comercio  4890\n  crédito  ingresos por comisiones        100\n  total                                     0</code></pre>',
        data: '<pre data-lang="sql"><code>CREATE TABLE ledger_entries (\n  id              bigserial PRIMARY KEY,\n  transaction_id  uuid    NOT NULL,\n  account_id      text    NOT NULL,\n  amount          bigint  NOT NULL,       -- débitos +, créditos −\n  currency        char(3) NOT NULL,\n  created_at      timestamptz NOT NULL DEFAULT now()\n);\n-- invariante: por transaction_id y currency, SUM(amount) = 0</code></pre>',
        fail: '<p>Una transacción que no suma cero se rechaza: es un bug de dinero, no un dato raro. La conciliación diaria compara este registro con el mundo exterior.</p>',
        nums: '<ul><li>Cada pago genera varios juegos de asientos (cobro, liquidación, pago al comercio, reembolsos): miles de millones de filas por año.</li><li>Stripe describió su Ledger como un registro inmutable que recibe cinco mil millones de eventos por día, con el 99.99 % del volumen en dólares ingerido y verificado en cuatro días y una explicabilidad del movimiento de dinero superior al 99.9999 %. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'events', layer: 'queue', label: 'Bus de eventos', sub: 'particionado por cuenta', x: 1015, y: 690,
      brief: 'Reparte los eventos del outbox a los webhooks, al ledger, a la analítica y a Radar.',
      info: {
        resp: '<p>Un relay lee el outbox y publica cada evento en el bus. Lo consumen el envío de webhooks, las proyecciones del ledger, la analítica y el entrenamiento de Radar.</p>',
        api: '<pre data-lang="json"><code>{\n  "id": "evt_1Q9x…",\n  "object": "event",\n  "type": "payment_intent.succeeded",\n  "created": 1790592000,\n  "data": { "object": { "id": "pi_3Q…", "amount": 4990,\n                        "currency": "eur", "status": "succeeded" } }\n}</code></pre>',
        data: '<p>Particionado por cuenta: los eventos de un comercio mantienen su orden dentro del bus. Eso no garantiza el orden de llegada al comercio: los reintentos lo rompen.</p>',
        fail: '<p>Entrega al menos una vez: el relay puede publicar dos veces si muere después de publicar y antes de marcar la fila. Todos los consumidores deduplican por <code>id</code>.</p>',
        nums: '<ul><li>Segundos entre el pago y el evento publicado.</li></ul>'
      } },
    { id: 'webhooks', layer: 'service', label: 'Envío de webhooks', sub: 'firma y reintenta hasta 3 días', x: 675, y: 690,
      brief: 'Avisa al comercio con POST firmados y reintenta hasta 3 días si no responde.',
      info: {
        resp: '<p>Por cada evento y cada endpoint suscrito hace un POST firmado. Si el endpoint no responde 2xx, reintenta con backoff exponencial durante hasta 3 días, y avisa al comercio si su endpoint falla de forma sostenida. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre data-lang="http"><code>POST /webhooks/pagos HTTP/1.1\nHost: tienda.example\nStripe-Signature: t=1790592001,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd\nContent-Type: application/json\n\n{"id": "evt_1Q9x…", "type": "payment_intent.succeeded", …}</code></pre>',
        data: '<p>Una cola de entregas pendientes por endpoint, con la hora del próximo intento.</p>',
        fail: '<p>El orden de entrega no está garantizado y los duplicados son normales: un endpoint que tardó en responder recibe el mismo evento otra vez. <span class="badge badge--doc">Documentado</span></p>',
        nums: '<ul><li>La firma es un HMAC-SHA256 de <code>{t}.{cuerpo}</code> con el secreto del endpoint; las librerías oficiales rechazan por defecto firmas de más de 5 minutos para frenar repeticiones. Cada reintento lleva una firma y una hora nuevas. <span class="badge badge--doc">Documentado</span></li><li>En modo live reintenta hasta 3 días con backoff exponencial; en sandbox, 3 veces en unas horas. Un evento se puede reenviar a mano desde el panel hasta 15 días después, y con la CLI hasta 30. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'recon', layer: 'service', label: 'Conciliación', sub: 'archivos diarios del adquirente', x: 1345, y: 690,
      brief: 'Compara cada día el archivo de liquidación con el ledger y abre una excepción por cada diferencia.',
      info: {
        resp: '<p>Cada día compara el archivo de liquidación del adquirente, línea por línea, con el ledger: montos, comisiones, monedas y fechas. Lo que no coincide abre una excepción que alguien resuelve.</p>',
        api: '<pre data-lang="sql"><code>SELECT f.rrn, f.amount AS en_archivo, l.amount AS en_ledger\n  FROM settlement_file f\n  FULL OUTER JOIN ledger_captures l ON l.rrn = f.rrn\n WHERE l.rrn IS NULL OR f.rrn IS NULL OR l.amount &lt;&gt; f.amount;</code></pre>',
        data: '<p>Excepciones con su categoría: pendiente por horario, falta en el ledger, falta en el archivo, diferencia de monto.</p>',
        fail: '<p>La excepción más grave es un cobro en el archivo que no está en el ledger: dinero que se movió sin que el sistema lo supiera. Suele venir de un timeout mal resuelto.</p>',
        nums: '<ul><li>Una corrida diaria por adquirente y moneda, con millones de líneas.</li></ul>'
      } },
    { id: 'payouts', layer: 'service', label: 'Payouts', sub: 'saldo disponible al banco', x: 1015, y: 870,
      brief: 'Transfiere el saldo disponible de cada comercio a su banco, según su calendario.',
      info: {
        resp: '<p>Mueve el saldo disponible de cada comercio a su cuenta bancaria, con el calendario de su cuenta (diario, semanal o manual). El saldo tiene al menos dos partes: el pendiente, cobrado pero sin liquidar, y el disponible; un payout solo sale del disponible. Cada payout tiene sus propios estados: <code>pending</code>, <code>in_transit</code>, <code>paid</code>, <code>failed</code> y <code>canceled</code>. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre data-lang="http"><code>POST /v1/payouts HTTP/1.1\nHost: api.stripe.com\nAuthorization: Bearer sk_live_…\nIdempotency-Key: payout-2026-10-07\n\namount=4890&amp;currency=eur</code></pre><p>Con el calendario automático, el procesador crea los payouts solo; la llamada sirve para los pagos manuales. El resultado llega con los eventos <code>payout.paid</code> y <code>payout.failed</code>. <span class="badge badge--doc">Documentado</span></p>',
        data: '<pre data-lang="sql"><code>CREATE TABLE payouts (\n  id            text PRIMARY KEY,          -- po_1Q…\n  account_id    text NOT NULL,\n  amount        bigint NOT NULL CHECK (amount &gt; 0),\n  currency      char(3) NOT NULL,\n  status        text NOT NULL,             -- pending, in_transit, paid, failed, canceled\n  bank_account  text NOT NULL,             -- token de la cuenta, no el número\n  idem_key      text NOT NULL UNIQUE,\n  failure_code  text,                      -- account_closed, no_account…\n  arrival_date  date\n);</code></pre>',
        fail: '<ul><li><b>El banco devuelve la transferencia días después:</b> cuenta cerrada o número inválido. El ledger revierte con asientos nuevos, el saldo vuelve a disponible, el payout pasa a <code>failed</code> y el comercio debe corregir su cuenta (escenario "Pago al comercio y devolución"). Por eso <code>paid</code> no es definitivo hasta pasado un margen.</li><li><b>Saldo negativo:</b> un reembolso o un contracargo mayor que las ventas del día. Se recupera de los próximos cobros o, si el comercio ya no vende, de su cuenta bancaria.</li><li><b>Timeout con el banco:</b> se reintenta con el id del payout como referencia y como clave; el banco no paga dos veces.</li></ul>',
        nums: '<ul><li>Del cobro de 49.90 EUR, al comercio le quedan 48.90 (4890 céntimos) después de la comisión de 1.00 del ejemplo.</li><li>Los cobros pasan a disponibles unos días después de liquidarse; un comercio nuevo o de alto riesgo tiene una retención más larga, porque el procesador responde por los contracargos que lleguen después.</li></ul>'
      } },
    { id: 'merchantbank', layer: 'external', label: 'Banco del comercio', sub: 'recibe los payouts', x: 1735, y: 870,
      brief: 'Acredita los payouts en la cuenta del comercio, o los devuelve si la cuenta no sirve.',
      info: {
        resp: '<p>El banco donde el comercio tiene su cuenta. Recibe la transferencia del procesador (en la zona euro, una transferencia SEPA) y la acredita. Si la cuenta está cerrada o el número no existe, devuelve el dinero, a veces días después.</p>',
        api: '<p>Una orden de transferencia con el monto, la cuenta de destino y una referencia única: el id del payout. La respuesta inmediata solo dice que la orden se aceptó; el resultado final es la acreditación o, más tarde, una devolución.</p>',
        data: '<p>La cuenta del comercio y sus movimientos. La referencia de cada transferencia, el id del payout, es lo que permite conciliar el extracto del banco con el ledger.</p>',
        fail: '<p>Una devolución llega como un movimiento nuevo con un código de motivo; Stripe lo expone en el <code>failure_code</code> del payout, con valores como <code>account_closed</code> o <code>no_account</code>. <span class="badge badge--doc">Documentado</span> El procesador no lo ve como un error de la llamada, sino en el extracto o en un aviso, días después.</p>',
        nums: '<ul><li>Una transferencia SEPA estándar se acredita a más tardar el día hábil siguiente; una SEPA instantánea, en unos 10 segundos. <span class="badge badge--doc">Documentado</span></li></ul>'
      } }
  ],
  edges: [
    { id: 'e1', from: 'browser', to: 'merchant', both: true, label: 'checkout' },
    { id: 'e2', from: 'merchant', to: 'edge', both: true, label: 'POST /v1/payment_intents', labelAt: 0.47 },
    { id: 'e3', from: 'browser', to: 'edge', both: true, label: 'confirmar (Stripe.js)', labelAt: 0.46 },
    { id: 'e4', from: 'edge', to: 'vault', both: true, label: 'tokenizar' },
    { id: 'e5', from: 'edge', to: 'idem', both: true },
    { id: 'e6', from: 'edge', to: 'payments', both: true },
    { id: 'e7', from: 'payments', to: 'radar', both: true },
    { id: 'e8', from: 'payments', to: 'paydb', both: true },
    { id: 'e9', from: 'payments', to: 'acquirer', both: true },
    { id: 'e10', from: 'acquirer', to: 'network', both: true, label: 'ISO 8583' },
    { id: 'e11', from: 'network', to: 'issuer', both: true },
    { id: 'e12', from: 'payments', to: 'ledger', both: true, label: 'asientos' },
    { id: 'e13', from: 'paydb', to: 'events', async: true, label: 'outbox' },
    { id: 'e14', from: 'events', to: 'webhooks', async: true },
    { id: 'e15', from: 'webhooks', to: 'merchant', both: true, label: 'webhook firmado', labelAt: 0.54 },
    { id: 'e16', from: 'merchant', to: 'merchantdb', both: true },
    { id: 'e17', from: 'network', to: 'recon', async: true, label: 'liquidación diaria', labelAt: 0.84 },
    { id: 'e18', from: 'recon', to: 'ledger', both: true },
    { id: 'e19', from: 'payouts', to: 'ledger', both: true, label: 'saldos' },
    { id: 'e20', from: 'payouts', to: 'merchantbank', both: true, label: 'transferencia', labelAt: 0.84 },
    { id: 'e21', from: 'payouts', to: 'events', async: true }
  ],
  scenarios: [
    {
      id: 'pago', title: 'Pago con tarjeta',
      desc: 'Un cliente paga 49.90 EUR. El número de la tarjeta nunca pasa por el comercio, y el pedido se cumple con el webhook, no con el navegador.',
      steps: [
        { from: 'browser', to: 'merchant', kind: 'req', tag: 'Pagar', ms: 40, title: 'El cliente aprieta Pagar', text: 'El navegador solo manda el pedido; el monto lo calcula el servidor.' },
        { from: 'merchant', to: 'edge', kind: 'req', tag: 'POST /v1/payment_intents', ms: 60, title: 'El comercio crea el PaymentIntent', text: 'Con una idempotency key derivada del pedido: si esta llamada se corta y se repite, no nace un segundo pago.', code: 'POST /v1/payment_intents HTTP/1.1\nIdempotency-Key: ord_8812-pago\n\namount=4990&currency=eur&metadata[order_id]=ord_8812', lang: 'http' },
        { from: 'edge', to: 'idem', kind: 'req', tag: 'INSERT clave', ms: 2, title: 'La clave es nueva', text: 'La fila se crea con el hash de la request y un lock de esta ejecución.' },
        { from: 'edge', to: 'payments', kind: 'req', tag: 'crear', ms: 2, title: 'Nace el PaymentIntent', text: 'Estado <code>requires_payment_method</code>: todavía no hay tarjeta.' },
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'INSERT pi_3Q…', ms: 3, title: 'Se guarda el pago', text: 'La fila nace con <code>status = requires_payment_method</code>, <code>version = 0</code> y el monto en céntimos. Desde aquí, el estado vive en la base y no en la memoria del servicio.' },
        { from: 'edge', to: 'idem', kind: 'req', tag: 'guardar respuesta', ms: 2, title: 'La respuesta queda asociada a la clave', text: 'Desde ahora, repetir esta request devuelve exactamente esta respuesta.' },
        { from: 'edge', to: 'merchant', kind: 'res', tag: '200 + client_secret', ms: 60, title: 'El comercio recibe el client_secret', text: 'Y se lo pasa al navegador.' },
        { from: 'merchant', to: 'browser', kind: 'res', tag: 'client_secret', ms: 40, title: 'El navegador tiene con qué confirmar', text: 'El <code>client_secret</code> solo sirve para confirmar este PaymentIntent desde el navegador: no permite leer otros pagos ni cambiar el monto.' },
        { from: 'browser', to: 'edge', kind: 'req', tag: 'confirmar', ms: 80, title: 'Stripe.js confirma con la tarjeta', text: 'Los datos de la tarjeta viajan desde el iframe directo al procesador.' },
        { from: 'edge', to: 'vault', kind: 'req', tag: 'tokenizar', ms: 5, title: 'La tarjeta se convierte en un token', text: 'El resto del sistema trabaja con <code>pm_1Q…</code>.' },
        { from: 'edge', to: 'payments', kind: 'req', tag: 'confirm', ms: 2, title: 'Confirmar el pago', text: 'El servicio de pagos recibe el token <code>pm_1Q…</code>, nunca el número de la tarjeta. Primero evalúa el riesgo y, si pasa, pide la autorización a la red.' },
        { from: 'payments', to: 'radar', kind: 'req', tag: '¿riesgo?', ms: 20, title: 'Radar evalúa el fraude', text: 'Puntaje 12 de 99: riesgo normal, sigue sin 3D Secure.' },
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'antes de llamar', ms: 3, title: 'Registra el intento antes de salir', text: 'Guarda el STAN que va a usar. Si el proceso muere durante la llamada, la recuperación sabe qué preguntar.' },
        { from: 'payments', to: 'acquirer', kind: 'req', tag: 'autorizar 4990', ms: 5, title: 'Pide la autorización', text: 'El conector recibe el monto, la moneda, el token y el STAN ya registrado. Es el único que puede pedir a la bóveda el número real, para ponerlo en el mensaje a la red.' },
        { from: 'acquirer', to: 'network', kind: 'req', tag: '0100', ms: 60, title: 'Mensaje ISO 8583 a la red', text: 'Tipo de mensaje 0100 (autorización): el número de la tarjeta en el campo 2, el monto en el 4, el STAN en el 11 y la moneda (978, EUR) en el 49.' },
        { from: 'network', to: 'issuer', kind: 'req', tag: '¿fondos?', ms: 150, title: 'La red lo lleva al banco emisor', text: 'Según los primeros dígitos de la tarjeta.' },
        { from: 'issuer', to: 'network', kind: 'res', tag: '00 aprobado', ms: 150, title: 'El emisor aprueba', text: 'Retiene 49.90 EUR en la tarjeta del cliente. Todavía no se movió dinero.' },
        { from: 'network', to: 'acquirer', kind: 'res', tag: '0110 · 00', ms: 60, title: 'La respuesta vuelve', text: 'Un 0110 con el código de respuesta 00 en el campo 39 y el código de autorización del emisor.' },
        { from: 'acquirer', to: 'payments', kind: 'res', tag: 'aprobado', ms: 5, title: 'Autorizado', text: 'Con captura automática, el pago pasa a <code>succeeded</code>.' },
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'UPDATE + outbox', ms: 4, title: 'Estado y evento en una transacción', text: 'El pago exitoso y su evento <code>payment_intent.succeeded</code> se confirman juntos.' },
        { from: 'payments', to: 'ledger', kind: 'req', tag: 'asientos', ms: 3, title: 'El ledger registra el cobro', text: 'Por cobrar al adquirente 4990; saldo pendiente del comercio 4890; comisión 100. Suma cero.' },
        { from: 'edge', to: 'browser', kind: 'res', tag: 'succeeded', ms: 80, title: 'El navegador muestra "Pago aceptado"', text: 'Es una buena noticia para el cliente, pero no la señal que usa el comercio.' },
        { from: 'paydb', to: 'events', kind: 'async', tag: 'relay', ms: 300, title: 'El relay publica el evento', text: 'Un proceso aparte lee las filas nuevas del outbox, las publica en el bus y las marca como enviadas. Si muere entre publicar y marcar, el evento sale dos veces: por eso todos los consumidores deduplican.' },
        { from: 'events', to: 'webhooks', kind: 'async', tag: 'evento', ms: 20, title: 'Se programa el webhook', text: 'El servicio de webhooks busca los endpoints suscritos a <code>payment_intent.succeeded</code> y deja una entrega pendiente por cada uno.' },
        { from: 'webhooks', to: 'merchant', kind: 'req', tag: 'POST firmado', ms: 80, title: 'El comercio recibe el webhook', text: 'Verifica la firma sobre el cuerpo crudo antes de parsear nada.' },
        { from: 'merchant', to: 'merchantdb', kind: 'req', tag: 'evento + pedido', ms: 4, title: 'Registra el evento y marca el pedido pagado', text: 'En una transacción, deduplicando por el id del evento.' },
        { from: 'merchant', to: 'webhooks', kind: 'res', tag: '200', ms: 80, title: 'Entrega confirmada', text: 'El pedido se prepara para enviar. La liquidación, con el dinero de verdad, llegará en uno o dos días.' }
      ]
    },
    {
      id: 'doble-clic', title: 'Doble clic en Pagar',
      desc: 'El cliente aprieta dos veces y el backend del comercio manda dos requests casi a la vez, con la misma idempotency key.',
      steps: [
        { from: 'merchant', to: 'edge', kind: 'req', tag: 'POST · clave ord_8812', ms: 60, title: 'Primera request', text: 'El backend crea el PaymentIntent con la clave <code>ord_8812-pago</code>, derivada del pedido.' },
        { from: 'edge', to: 'idem', kind: 'req', tag: 'INSERT: nueva', ms: 2, title: 'La primera toma la clave', text: 'Queda con <code>locked_until</code> dentro de unos segundos.' },
        { from: 'merchant', to: 'edge', kind: 'req', tag: 'POST · misma clave', ms: 15, title: 'Segunda request, 15 ms después', text: 'Mismo cuerpo, misma clave: el backend la derivó del pedido, no la generó al azar en cada clic.' },
        { from: 'edge', to: 'idem', kind: 'fail', tag: 'existe, en curso', ms: 2, title: 'La clave existe y está tomada', text: 'El hash coincide, no hay respuesta guardada todavía y el lock sigue vigente.' },
        { from: 'edge', to: 'merchant', kind: 'fail', tag: '409', ms: 60, title: 'Conflicto: otra request con esta clave sigue en curso', text: 'Stripe devuelve un error de clave en uso. No se creó nada.' },
        { from: 'edge', to: 'payments', kind: 'req', tag: 'crear (primera)', ms: 5, title: 'La primera sigue su camino', text: 'Crea el PaymentIntent como en un pago normal. La segunda request nunca llegó hasta aquí.' },
        { from: 'edge', to: 'idem', kind: 'req', tag: 'guardar respuesta', ms: 2, title: 'La primera termina y guarda su respuesta', text: 'La fila de la clave guarda el código 200 y el cuerpo de la respuesta, y libera el lock.' },
        { from: 'edge', to: 'merchant', kind: 'res', tag: '200 · pi_3Q…', ms: 60, title: 'Respuesta de la primera', text: 'El backend recibe su PaymentIntent y le pasa el <code>client_secret</code> al navegador.' },
        { from: 'merchant', to: 'edge', kind: 'req', tag: 'reintento', ms: 1000, title: 'La segunda reintenta tras un segundo', text: 'Con la misma clave, como indica el 409.' },
        { from: 'edge', to: 'idem', kind: 'req', tag: 'respuesta guardada', ms: 2, title: 'La clave está completa', text: 'No se ejecuta nada: se lee la respuesta guardada.' },
        { from: 'edge', to: 'merchant', kind: 'res', tag: '200 · el mismo pi_3Q…', ms: 60, title: 'El mismo PaymentIntent', text: 'Dos requests, un solo pago. Si la segunda hubiera llegado con otro monto, la respuesta sería un 400 <code>idempotency_error</code>: una clave reutilizada con otra request es un bug del cliente.' }
      ]
    },
    {
      id: 'timeout-banco', title: 'Timeout después de que el banco aprobó',
      desc: 'El emisor aprueba y retiene el dinero, pero la respuesta se pierde en el camino. Nadie sabe si el pago salió.',
      steps: [
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'antes de llamar', ms: 3, title: 'Registra el intento con su STAN', text: 'Esta es la línea que permite recuperarse después.' },
        { from: 'payments', to: 'acquirer', kind: 'req', tag: 'autorizar 4990', ms: 5, title: 'Pide la autorización', text: 'Igual que en un pago normal: monto, moneda, token y el STAN 004211, que ya quedó guardado.' },
        { from: 'acquirer', to: 'network', kind: 'req', tag: '0100 · STAN 004211', ms: 60, title: 'El mensaje sale', text: 'Un 0100 con el STAN 004211: el número que identifica este intento ante la red.' },
        { from: 'network', to: 'issuer', kind: 'req', tag: '¿fondos?', ms: 150, title: 'Llega al emisor', text: 'La red lo enruta según los primeros dígitos de la tarjeta.' },
        { from: 'issuer', to: 'network', kind: 'res', tag: '00 aprobado', ms: 150, title: 'El emisor aprueba y retiene 49.90', text: 'Para el banco, el pago está aprobado: el dinero ya queda retenido en la tarjeta del cliente.' },
        { from: 'network', to: 'acquirer', kind: 'fail', tag: '0110 ✕', ms: 0, title: 'La respuesta se pierde', text: 'Se corta la conexión entre la red y el conector.' },
        { at: 'acquirer', kind: 'fail', ms: 10000, title: 'Timeout de 10 s', text: 'El conector no sabe si el pago se aprobó. Reintentar la autorización podría retener el dinero dos veces.' },
        { from: 'acquirer', to: 'network', kind: 'req', tag: '0400 reversa', ms: 60, title: 'Envía una reversa por ese STAN', text: 'Es la regla ante una respuesta que no llegó: anular lo que pudo haberse aprobado. La reversa también se reintenta hasta que se confirme.' },
        { from: 'network', to: 'issuer', kind: 'req', tag: 'anular', ms: 150, title: 'El emisor libera la retención', text: 'La reversa identifica la autorización original por su STAN y sus datos, y el emisor anula la retención.' },
        { from: 'issuer', to: 'network', kind: 'res', tag: 'reversa ok', ms: 150, title: 'Retención liberada', text: 'El cupo de la tarjeta del cliente vuelve a estar completo.' },
        { from: 'network', to: 'acquirer', kind: 'res', tag: '0410', ms: 60, title: 'La reversa se confirma', text: 'Un 0410: la red confirma la reversa. Recién ahora el conector sabe en qué estado quedó el intento.' },
        { from: 'acquirer', to: 'payments', kind: 'res', tag: 'no autorizado', ms: 5, title: 'El intento termina como fallido', text: 'El conector informa un resultado definitivo, no autorizado, y el registro del intento se cierra con ese resultado.' },
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'requires_payment_method', ms: 3, title: 'El pago vuelve a esperar un medio de pago', text: 'Con <code>last_payment_error</code> explicando el motivo.' },
        { from: 'edge', to: 'browser', kind: 'res', tag: 'error reintentable', ms: 80, title: 'El cliente ve "no se pudo procesar, intenta de nuevo"', text: 'Si vuelve a intentar, es un intento nuevo del mismo PaymentIntent: nunca dos cobros. Y si la reversa hubiera fallado, la conciliación del día siguiente encontraría la captura sin su pago en el ledger.' }
      ]
    },
    {
      id: 'webhook-dup', title: 'Webhook duplicado y desordenado',
      desc: 'El pago se aprueba y a los pocos segundos se reembolsa. El comercio tarda en responder el primer webhook, así que ese evento se reintenta y llega después del reembolso.',
      steps: [
        { from: 'events', to: 'webhooks', kind: 'async', tag: 'evt_1 succeeded', ms: 20, title: 'Primer evento: pago exitoso', text: 'El pago se aprobó y su evento <code>payment_intent.succeeded</code> sale por el outbox.' },
        { from: 'webhooks', to: 'merchant', kind: 'req', tag: 'evt_1', ms: 80, title: 'Se envía evt_1', text: 'Un POST firmado al endpoint del comercio.' },
        { from: 'merchant', to: 'merchantdb', kind: 'req', tag: 'procesa evt_1', ms: 4, title: 'El comercio lo procesa: pedido pagado', text: 'Pero hace más trabajo antes de responder (manda un email, llama a otro servicio).' },
        { from: 'merchant', to: 'webhooks', kind: 'fail', tag: 'timeout', ms: 20000, title: 'No responde a tiempo', text: 'Para el emisor de webhooks, la entrega falló: la reprograma.' },
        { from: 'events', to: 'webhooks', kind: 'async', tag: 'evt_2 refunded', ms: 20, title: 'Segundo evento: reembolso', text: 'El comercio reembolsó el pedido desde su panel.' },
        { from: 'webhooks', to: 'merchant', kind: 'req', tag: 'evt_2', ms: 80, title: 'Llega evt_2', text: 'El evento <code>charge.refunded</code>, firmado igual que el anterior.' },
        { from: 'merchant', to: 'merchantdb', kind: 'req', tag: 'refunded', ms: 4, title: 'Pedido reembolsado', text: 'Registra <code>evt_2</code> y pasa el pedido a <code>refunded</code> en la misma transacción.' },
        { from: 'merchant', to: 'webhooks', kind: 'res', tag: '200', ms: 80, title: 'Esta vez responde rápido', text: 'Responde 200 en cuanto guarda el evento; el trabajo lento va a una cola propia.' },
        { from: 'webhooks', to: 'merchant', kind: 'req', tag: 'evt_1 (reintento)', ms: 80, title: 'Llega evt_1 otra vez, después de evt_2', text: 'Duplicado y fuera de orden. Las dos cosas son normales.', code: 'Stripe-Signature: t=1790592061,v1=…\n\n{"id": "evt_1…", "type": "payment_intent.succeeded", …}', lang: 'http' },
        { from: 'merchant', to: 'merchantdb', kind: 'req', tag: 'INSERT evt_1: 0 filas', ms: 3, title: 'Ya estaba procesado', text: 'El <code>INSERT … ON CONFLICT DO NOTHING</code> no inserta nada: se ignora. Y aunque no lo hubiera procesado antes, el <code>UPDATE … WHERE status = \'pending\'</code> no podría devolver a "pagado" un pedido reembolsado.' },
        { from: 'merchant', to: 'webhooks', kind: 'res', tag: '200', ms: 80, title: 'Responde 200 sin cambiar nada', text: 'Responder error a un duplicado solo genera más reintentos.' }
      ]
    },
    {
      id: 'emisor-caido', title: 'El banco emisor no responde',
      desc: 'El sistema de autorizaciones del banco del cliente está caído. La red decide por él dentro de reglas acordadas.',
      down: ['issuer'],
      steps: [
        { from: 'payments', to: 'acquirer', kind: 'req', tag: 'autorizar 4990', ms: 5, title: 'Pide la autorización', text: 'Un pago normal de 49.90 EUR, con su STAN registrado antes de salir.' },
        { from: 'acquirer', to: 'network', kind: 'req', tag: '0100', ms: 60, title: 'El mensaje llega a la red', text: 'La red intenta enrutarlo hacia el banco emisor de la tarjeta.' },
        { from: 'network', to: 'issuer', kind: 'fail', tag: 'sin respuesta', ms: 3000, title: 'El emisor no contesta', text: 'La red espera unos segundos.' },
        { at: 'network', kind: 'info', ms: 5, title: 'Stand-in processing', text: 'Con las reglas que el emisor dejó acordadas (montos máximos, tipos de comercio), la red aprueba en su nombre los pagos chicos y rechaza el resto con el código 91, emisor no disponible.' },
        { from: 'network', to: 'acquirer', kind: 'res', tag: '0110 · 00 (stand-in)', ms: 60, title: 'Aprobado por la red', text: 'Cuando el emisor vuelva, la red le informa lo que aprobó en su nombre.' },
        { from: 'acquirer', to: 'payments', kind: 'res', tag: 'aprobado', ms: 5, title: 'Para el procesador, un pago normal', text: 'El código 00 es el mismo: el pago sigue a <code>succeeded</code>, al ledger y al outbox como en el escenario "Pago con tarjeta".' },
        { at: 'payments', kind: 'info', ms: 1, title: 'Y si hubiera sido un 91', text: 'El pago falla con un rechazo reintentable: el comercio muestra "intenta de nuevo en unos minutos". Si muchos pagos del mismo emisor fallan así, el procesador abre un circuit breaker para no sumar carga a un banco que se está recuperando (M08).' }
      ]
    },
    {
      id: 'reembolso', title: 'Reembolso parcial',
      desc: 'El cliente devuelve una parte del pedido: se reembolsan 19.90 de los 49.90 EUR.',
      steps: [
        { from: 'merchant', to: 'edge', kind: 'req', tag: 'POST /v1/refunds', ms: 60, title: 'El comercio pide el reembolso', text: 'Con su propia clave: la devolución 1 del pedido.', code: 'POST /v1/refunds HTTP/1.1\nIdempotency-Key: ord_8812-reembolso-1\n\npayment_intent=pi_3Q…&amount=1990', lang: 'http' },
        { from: 'edge', to: 'idem', kind: 'req', tag: 'INSERT clave', ms: 2, title: 'Clave nueva', text: 'Es la primera vez que llega <code>ord_8812-reembolso-1</code>: se crea la fila con el hash de la request y el lock.' },
        { from: 'edge', to: 'payments', kind: 'req', tag: 'refund 1990', ms: 2, title: 'Validar el reembolso', text: 'El servicio de pagos recibe el pedido de devolver 19.90 EUR de este PaymentIntent.' },
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'SELECT … FOR UPDATE', ms: 3, title: 'Bloquea el pago y verifica', text: 'Cobrado 4990, reembolsado 0: 1990 entra. El lock evita que dos reembolsos simultáneos pasen la verificación a la vez (el write skew del M05); el <code>CHECK</code> de la tabla es la última red.' },
        { from: 'payments', to: 'ledger', kind: 'req', tag: 'asientos', ms: 3, title: 'Asientos del reembolso', text: 'Débito al saldo del comercio 1990; crédito a reembolsos por pagar al adquirente 1990. Suma cero.' },
        { from: 'payments', to: 'acquirer', kind: 'req', tag: 'crédito 1990', ms: 5, title: 'Se envía el crédito a la red', text: 'El conector arma el reembolso con la referencia del cobro original.' },
        { from: 'acquirer', to: 'network', kind: 'req', tag: 'reembolso', ms: 60, title: 'La red lo lleva al emisor', text: 'Los reembolsos se liquidan por lotes: el cliente lo ve en su tarjeta en unos días.' },
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'amount_refunded = 1990', ms: 4, title: 'Estado y evento', text: 'Con el evento <code>charge.refunded</code> en el outbox.' },
        { from: 'edge', to: 'merchant', kind: 'res', tag: '200 · re_1Q…', ms: 60, title: 'Reembolso creado', text: 'Si el comercio pidiera ahora otros 4000, la respuesta sería un 400: 1990 + 4000 supera lo cobrado.' },
        { from: 'paydb', to: 'events', kind: 'async', tag: 'charge.refunded', ms: 300, title: 'El evento sale por el outbox', text: 'El relay publica <code>charge.refunded</code> en el bus.' },
        { from: 'events', to: 'webhooks', kind: 'async', tag: 'evento', ms: 20, title: 'Webhook programado', text: 'Una entrega pendiente por cada endpoint suscrito.' },
        { from: 'webhooks', to: 'merchant', kind: 'req', tag: 'POST firmado', ms: 80, title: 'El comercio lo confirma en su base', text: 'Registra el evento y la devolución en su base, deduplicando por el id del evento.' }
      ]
    },
    {
      id: '3ds', title: 'Pago con 3D Secure',
      desc: 'Un cliente europeo paga 120 EUR. La regulación pide autenticación reforzada: el pago queda esperando que el titular confirme en la app de su banco.',
      steps: [
        { from: 'browser', to: 'edge', kind: 'req', tag: 'confirmar', ms: 80, title: 'Stripe.js confirma con la tarjeta', text: 'Junto con la tarjeta viajan datos del navegador y del dispositivo que el banco usará para decidir.' },
        { from: 'edge', to: 'vault', kind: 'req', tag: 'tokenizar', ms: 5, title: 'La tarjeta se convierte en un token', text: 'El número de la tarjeta queda en la bóveda; el resto del flujo usa <code>pm_…</code>.' },
        { from: 'edge', to: 'payments', kind: 'req', tag: 'confirm', ms: 2, title: 'Confirmar el pago', text: 'Con el token y los datos del dispositivo, que viajarán hasta el banco para la autenticación.' },
        { from: 'payments', to: 'radar', kind: 'req', tag: '¿riesgo? ¿SCA?', ms: 20, title: 'Radar y las reglas de autenticación', text: 'El puntaje es normal, pero 120 EUR superan la exención de bajo valor (30 EUR) y la tarjeta es europea: hay que autenticar al titular, salvo que el banco lo considere de riesgo bajo.' },
        { from: 'payments', to: 'acquirer', kind: 'req', tag: 'AReq 3DS2', ms: 5, title: 'Pide autenticación 3D Secure 2', text: 'Un mensaje con más de cien datos del pago, el dispositivo y el titular.' },
        { from: 'acquirer', to: 'network', kind: 'req', tag: 'AReq', ms: 60, title: 'La red lo lleva al servidor de directorio', text: 'El servidor de directorio de la marca sabe qué servidor de control de acceso (ACS) atiende cada rango de tarjetas.' },
        { from: 'network', to: 'issuer', kind: 'req', tag: 'AReq', ms: 150, title: 'El banco evalúa el riesgo', text: 'Su servidor de control de acceso (ACS) decide: sin fricción si el riesgo es bajo, o pedir un desafío.' },
        { from: 'issuer', to: 'network', kind: 'res', tag: 'ARes: desafío', ms: 150, title: 'El banco pide un desafío', text: 'El titular deberá aprobar en la app del banco.' },
        { from: 'network', to: 'acquirer', kind: 'res', tag: 'ARes', ms: 60, title: 'La respuesta vuelve', text: 'Con los datos que Stripe.js necesita para mostrar el desafío del banco.' },
        { from: 'acquirer', to: 'payments', kind: 'res', tag: 'requires_action', ms: 5, title: 'El pago necesita una acción del titular', text: 'El servicio de pagos no puede seguir solo: el PaymentIntent pasa a <code>requires_action</code>.' },
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'status = requires_action', ms: 3, title: 'El estado se guarda', text: 'Si el proceso muere, otra instancia sabe en qué punto está el pago.' },
        { from: 'edge', to: 'browser', kind: 'res', tag: 'requires_action', ms: 80, title: 'Stripe.js muestra el desafío del banco', text: 'En un iframe o con una redirección. El PaymentIntent no avanza hasta que el titular actúe, y el comercio no debe cumplir el pedido todavía.' },
        { at: 'browser', kind: 'info', ms: 20000, title: 'El titular aprueba en la app de su banco', text: 'Con su huella o PIN. Puede tardar decenas de segundos. Si cierra la pestaña, el pago queda en requires_action hasta que el comercio lo cancele o la autenticación expire.' },
        { from: 'browser', to: 'edge', kind: 'req', tag: 'confirmar (autenticado)', ms: 80, title: 'Stripe.js avisa que el desafío terminó', text: 'El navegador vuelve del desafío y Stripe.js le pide al procesador que siga con el pago.' },
        { from: 'edge', to: 'payments', kind: 'req', tag: 'continuar', ms: 2, title: 'El pago retoma', text: 'Cualquier instancia puede atenderlo: el estado está en la base, no en memoria.' },
        { from: 'payments', to: 'acquirer', kind: 'req', tag: 'autorizar · CAVV · ECI 05', ms: 5, title: 'Pide la autorización con la prueba de autenticación', text: 'El banco entregó un valor de autenticación (CAVV) y el indicador ECI 05: autenticación completa.' },
        { from: 'acquirer', to: 'network', kind: 'req', tag: '0100', ms: 60, title: 'Mensaje ISO 8583 a la red', text: 'La autorización lleva ahora el CAVV y el ECI, que prueban la autenticación.' },
        { from: 'network', to: 'issuer', kind: 'req', tag: '¿fondos?', ms: 150, title: 'El banco verifica los fondos', text: 'Ya sabe que el titular se autenticó: solo falta ver el saldo o el cupo.' },
        { from: 'issuer', to: 'network', kind: 'res', tag: '00 aprobado', ms: 150, title: 'Aprobado', text: 'Retiene 120 EUR.' },
        { from: 'network', to: 'acquirer', kind: 'res', tag: '0110 · 00', ms: 60, title: 'La respuesta vuelve', text: 'Aprobado, con el código de autorización del emisor.' },
        { from: 'acquirer', to: 'payments', kind: 'res', tag: 'aprobado', ms: 5, title: 'Autorizado', text: 'Con captura automática, el pago pasa a <code>succeeded</code>.' },
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'UPDATE + outbox', ms: 4, title: 'Estado y evento en una transacción', text: 'El estado <code>succeeded</code> y el evento <code>payment_intent.succeeded</code> se confirman juntos.' },
        { from: 'payments', to: 'ledger', kind: 'req', tag: 'asientos', ms: 3, title: 'El ledger registra el cobro', text: 'Y queda anotado que el pago fue autenticado: si el titular disputa el cobro por fraude, la responsabilidad pasa al banco (liability shift).' },
        { from: 'edge', to: 'browser', kind: 'res', tag: 'succeeded', ms: 80, title: 'Pago aceptado', text: 'Unos 25 segundos en total, casi todos esperando al titular. Sin 3D Secure habrían sido 2.' }
      ]
    },
    {
      id: 'limites', title: 'Flash sale: límites y prioridades',
      desc: 'Un comercio lanza una oferta y su backend manda 400 requests por segundo. La API protege a todos: limita por cuenta, prioriza lo crítico y descarta lo que puede esperar.',
      steps: [
        { from: 'merchant', to: 'edge', kind: 'req', tag: '400 req/s', ms: 60, title: 'Una ráfaga muy por encima del límite', text: 'El límite global en modo live es de 100 requests por segundo por cuenta.' },
        { at: 'edge', kind: 'info', ms: 1, title: 'Limitador de tasa por cuenta', text: 'Un token bucket en Redis: cada cuenta tiene un balde que se llena a razón fija, permite ráfagas breves y se vacía si la tasa sostenida es mayor. Es el limitador que más se activa, sobre todo con tráfico de prueba.' },
        { from: 'edge', to: 'merchant', kind: 'fail', tag: '429 · global-rate', ms: 60, title: 'Rechazadas antes de ejecutar nada', text: 'El header Stripe-Rate-Limited-Reason dice por qué. Como la request no llegó a ejecutarse, no se guarda ningún resultado de idempotencia: se puede reintentar con la misma clave.' },
        { from: 'merchant', to: 'edge', kind: 'req', tag: 'reintento con backoff y jitter', ms: 800, title: 'El comercio reintenta con espera creciente y aleatoria', text: 'Sin jitter, todos sus workers volverían a golpear a la vez (M08). Mejor aún es limitar del lado del cliente con su propio token bucket.' },
        { at: 'edge', kind: 'info', ms: 1, title: 'Limitador de concurrencia', text: 'Un listado con expansiones puede tardar segundos. Si el comercio tiene demasiados en curso a la vez, los nuevos reciben 429 aunque su tasa sea baja. La solución es procesar con N trabajadores, no lanzar todo junto.' },
        { at: 'edge', kind: 'fail', ms: 1, title: 'Load shedder de la flota', text: 'La flota reserva capacidad para las operaciones críticas (crear y confirmar pagos). Si el uso total supera el umbral, primero se descarta lo no crítico, como listar cargos, con un 503.' },
        { from: 'merchant', to: 'edge', kind: 'req', tag: 'GET /v1/charges', ms: 60, title: 'Un listado del panel de reportes', text: 'Puede esperar.' },
        { from: 'edge', to: 'merchant', kind: 'fail', tag: '503', ms: 30, title: 'Descartado por no ser crítico', text: 'El 503 le dice al panel de reportes que reintente más tarde. Leer cargos puede esperar; crear pagos, no.' },
        { at: 'payments', kind: 'fail', ms: 1, title: 'Load shedder por utilización de workers', text: 'El último recurso en un incidente: si los workers se saturan, se descarta por prioridad en cuatro niveles (métodos críticos, POST, GET y tráfico de prueba) y de forma gradual, para no oscilar entre saturado y vacío.' },
        { from: 'merchant', to: 'edge', kind: 'req', tag: 'POST /v1/payment_intents', ms: 60, title: 'Crear un pago', text: 'Es una operación crítica.' },
        { from: 'edge', to: 'payments', kind: 'req', tag: 'crear', ms: 2, title: 'Pasa todos los filtros', text: 'Tasa dentro del balde, concurrencia baja y prioridad crítica: llega al servicio de pagos como cualquier día.' },
        { from: 'edge', to: 'merchant', kind: 'res', tag: '200', ms: 60, title: 'Las ventas siguen', text: 'La API sacrificó los reportes para no perder pagos.' }
      ]
    },
    {
      id: 'liquidacion', title: 'Liquidación y conciliación del día',
      desc: 'Llega el archivo de liquidación del adquirente. La conciliación lo compara con el ledger: casi todo cuadra, salvo un cobro que el ledger no conoce.',
      steps: [
        { from: 'network', to: 'recon', kind: 'async', tag: 'archivo de liquidación', ms: 2000, title: 'El adquirente recibe el archivo del día', text: 'La red hizo el clearing y la liquidación entre bancos. El archivo lista cada transacción (con su RRN, monto y comisiones) y el neto a pagar.' },
        { at: 'recon', kind: 'info', ms: 20000, title: 'Compara línea por línea', text: 'Un FULL OUTER JOIN por RRN entre el archivo y las capturas del ledger: montos, monedas, comisiones y fechas.' },
        { from: 'recon', to: 'ledger', kind: 'req', tag: 'capturas del día', ms: 40, title: 'Lee las capturas registradas', text: 'Todas las capturas del día para este adquirente y esta moneda, con su RRN y su monto.' },
        { from: 'ledger', to: 'recon', kind: 'res', tag: '1 204 883 coinciden', ms: 40, title: 'Casi todo cuadra', text: 'Las líneas que coinciden se marcan conciliadas sin intervención humana.' },
        { at: 'recon', kind: 'fail', ms: 1, title: 'Una línea está en el archivo y no en el ledger', text: 'RRN 000913, 49.90 EUR. Es un timeout mal resuelto: el banco aprobó y cobró, la reversa falló, y el sistema creyó que el pago no salió. Dinero movido sin registro: la excepción más grave.' },
        { from: 'recon', to: 'ledger', kind: 'req', tag: 'asiento de ajuste', ms: 4, title: 'Se corrige con asientos nuevos, no editando', text: 'Por cobrar al adquirente contra una cuenta de excepciones. El historial queda completo: el error y su corrección.' },
        { at: 'recon', kind: 'info', ms: 1, title: 'Se abre una excepción con dueño y fecha', text: 'Alguien investiga y decide: reembolsar al cliente, o completar el pago si ya se envió el pedido. La antigüedad y el monto de las excepciones abiertas son métricas con alertas.' },
        { at: 'payouts', kind: 'info', ms: 2000, title: 'Lo liquidado queda disponible para pagar al comercio', text: 'Lo que la red ya liquidó pasa del saldo pendiente al disponible, y el servicio de payouts lo transfiere al banco del comercio con su calendario. El escenario "Pago al comercio y devolución" lo muestra paso a paso, incluida una transferencia que el banco devuelve.' }
      ]
    },
    {
      id: 'contracargo', title: 'Contracargo',
      desc: 'Cuarenta días después, el titular desconoce un cobro. La red saca el dinero del comercio y abre una disputa con plazos.',
      steps: [
        { from: 'issuer', to: 'network', kind: 'req', tag: 'contracargo · 10.4', ms: 150, title: 'El banco abre la disputa', text: 'El titular dice que no autorizó el cobro. Motivo Visa 10.4, otro fraude con tarjeta ausente. Los emisores tienen plazos de hasta unos 120 días desde la transacción.' },
        { from: 'network', to: 'acquirer', kind: 'req', tag: 'contracargo', ms: 60, title: 'La red lo baja al adquirente', text: 'Y retira el dinero de la liquidación de ese día.' },
        { from: 'acquirer', to: 'payments', kind: 'req', tag: 'disputa por RRN', ms: 5, title: 'Se asocia con el pago', text: 'El RRN del mensaje original es la clave que une el contracargo con el PaymentIntent.' },
        { from: 'payments', to: 'ledger', kind: 'req', tag: 'asientos de disputa', ms: 3, title: 'El dinero sale del saldo desde el primer día', text: 'Débito al saldo del comercio por 49.90 más la tarifa de disputa. Aunque la disputa aún pueda ganarse, el ledger no espera: registra lo que ya ocurrió con el dinero.' },
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'dispute + outbox', ms: 3, title: 'Estado y evento', text: 'Se crea la disputa con su plazo para responder, y el evento <code>charge.dispute.created</code> queda en el outbox en la misma transacción.' },
        { from: 'paydb', to: 'events', kind: 'async', tag: 'charge.dispute.created', ms: 300, title: 'El evento sale por el outbox', text: 'El relay lo publica en el bus.' },
        { from: 'events', to: 'webhooks', kind: 'async', tag: 'evento', ms: 20, title: 'Webhook programado', text: 'Una entrega por cada endpoint suscrito a las disputas.' },
        { from: 'webhooks', to: 'merchant', kind: 'req', tag: 'POST firmado', ms: 80, title: 'El comercio se entera y tiene un plazo', text: 'Suelen ser pocos días para presentar evidencia. Perder el plazo es perder la disputa.' },
        { from: 'merchant', to: 'edge', kind: 'req', tag: 'evidencia', ms: 60, title: 'Presenta la evidencia', text: 'Prueba de entrega, comunicaciones con el cliente, historial de compras anteriores sin disputa y, si hubo 3D Secure, el resultado de la autenticación.' },
        { from: 'edge', to: 'payments', kind: 'req', tag: 'evidencia', ms: 2, title: 'Se guarda y se prepara el paquete', text: 'Los documentos quedan asociados a la disputa y se arma el paquete con el formato que pide la red.' },
        { from: 'payments', to: 'acquirer', kind: 'req', tag: 'representación', ms: 5, title: 'El adquirente responde a la red', text: 'Se llama representment: el comercio contesta al contracargo.' },
        { from: 'acquirer', to: 'network', kind: 'req', tag: 'evidencia', ms: 60, title: 'La red lo lleva al emisor', text: 'Dentro del plazo de la red; fuera de plazo, la disputa se pierde sin revisión.' },
        { from: 'network', to: 'issuer', kind: 'req', tag: 'evidencia', ms: 150, title: 'El emisor decide', text: 'Semanas después. Si rechaza la evidencia, puede haber una segunda ronda (pre-arbitraje) y, al final, el arbitraje de la red, con costo.' },
        { from: 'issuer', to: 'network', kind: 'res', tag: 'a favor del comercio', ms: 150, title: 'El comercio gana', text: 'Con evidencia sólida, en este caso. Muchos comercios pierden por no responder a tiempo.' },
        { from: 'network', to: 'acquirer', kind: 'res', tag: 'resuelta', ms: 60, title: 'La red revierte el contracargo', text: 'El dinero vuelve al adquirente en una próxima liquidación.' },
        { from: 'acquirer', to: 'payments', kind: 'res', tag: 'disputa ganada', ms: 5, title: 'La disputa se cierra a favor del comercio', text: 'La disputa queda ganada (<code>won</code>) y el evento correspondiente avisa al comercio.' },
        { from: 'payments', to: 'ledger', kind: 'req', tag: 'asientos de reversión', ms: 3, title: 'El monto vuelve al saldo', text: 'Con nuevos asientos: no se edita el débito anterior. La tarifa de disputa puede no devolverse, según las reglas de la cuenta.' }
      ]
    },
    {
      id: 'payout', title: 'Pago al comercio y devolución',
      desc: 'El calendario diario manda al banco del comercio su saldo disponible: los 48.90 EUR que dejó el cobro del escenario "Pago con tarjeta". Tres días después, el banco devuelve la transferencia porque la cuenta estaba cerrada.',
      steps: [
        { at: 'payouts', kind: 'info', ms: 1, title: 'Corre el calendario diario', text: 'Cada día, para cada comercio con pagos automáticos, se calcula el saldo disponible. Aquí son 4890 céntimos: el cobro ya se liquidó y pasó de pendiente a disponible.' },
        { from: 'payouts', to: 'ledger', kind: 'req', tag: 'saldo disponible FOR UPDATE', ms: 4, title: 'Bloquea y lee el saldo disponible', text: 'Un payout solo sale del saldo disponible, nunca del pendiente. El lock evita que dos payouts simultáneos gasten el mismo saldo.' },
        { from: 'payouts', to: 'ledger', kind: 'req', tag: 'asiento pendiente', ms: 4, title: 'Reserva: de disponible a en tránsito', text: 'En una transacción: la fila del payout en <code>pending</code> con su idempotency key, y una transferencia pendiente en el ledger, con débito al saldo disponible por 4890 y crédito a en tránsito por 4890. Suma cero.' },
        { from: 'payouts', to: 'merchantbank', kind: 'req', tag: 'transferencia · po_1Q…', ms: 200, title: 'Ordena la transferencia', text: 'Con el id del payout como referencia y como clave: si la llamada se corta y se repite, el banco no paga dos veces.' },
        { from: 'merchantbank', to: 'payouts', kind: 'res', tag: 'orden aceptada', ms: 200, title: 'El banco acepta la orden', text: 'Aceptar la orden no es pagar: solo dice que la recibió y que tiene un formato válido.' },
        { from: 'payouts', to: 'ledger', kind: 'req', tag: 'confirmar', ms: 3, title: 'Se confirma la transferencia pendiente', text: 'El payout pasa a <code>in_transit</code> y el saldo disponible del comercio queda en cero.' },
        { at: 'merchantbank', kind: 'info', ms: 86400000, title: 'Al día siguiente, el dinero llega', text: 'La transferencia se acredita en la cuenta del comercio y el payout pasa a <code>paid</code>.' },
        { from: 'payouts', to: 'events', kind: 'async', tag: 'payout.paid', ms: 300, title: 'Sale el evento', text: 'Por el outbox del servicio de payouts, igual que los eventos de los pagos.' },
        { from: 'events', to: 'webhooks', kind: 'async', tag: 'payout.paid', ms: 20, title: 'Webhook programado', text: 'Una entrega por cada endpoint suscrito a los payouts.' },
        { from: 'webhooks', to: 'merchant', kind: 'req', tag: 'POST firmado', ms: 80, title: 'El comercio se entera', text: 'Puede marcar en su contabilidad los cobros que cubre este payout.' },
        { from: 'merchant', to: 'webhooks', kind: 'res', tag: '200', ms: 80, title: 'Entrega confirmada', text: 'Responde 200 en cuanto guarda el evento.' },
        { from: 'merchantbank', to: 'payouts', kind: 'fail', tag: 'devuelto · account_closed', ms: 259200000, title: 'Tres días después, el banco devuelve el dinero', text: 'La cuenta del comercio estaba cerrada. La devolución llega como un movimiento nuevo con su motivo, no como un error de la llamada. Por eso <code>paid</code> no es definitivo hasta pasado un margen.' },
        { from: 'payouts', to: 'ledger', kind: 'req', tag: 'asientos de reversión', ms: 4, title: 'El saldo vuelve a disponible', text: 'Con asientos nuevos, de en tránsito a disponible: el asiento original no se edita. El payout pasa a <code>failed</code> con <code>failure_code = account_closed</code> y la cuenta bancaria se marca como inválida.' },
        { from: 'payouts', to: 'events', kind: 'async', tag: 'payout.failed', ms: 300, title: 'Sale el evento del fallo', text: 'Por el mismo camino que <code>payout.paid</code>.' },
        { from: 'events', to: 'webhooks', kind: 'async', tag: 'payout.failed', ms: 20, title: 'Webhook programado', text: 'Una entrega por cada endpoint suscrito.' },
        { from: 'webhooks', to: 'merchant', kind: 'req', tag: 'POST firmado', ms: 80, title: 'El comercio debe corregir su cuenta', text: 'Hasta que cargue una cuenta válida, el saldo se acumula. Si en el medio llega un reembolso o un contracargo mayor que las ventas, el saldo puede quedar negativo y se recupera de los próximos cobros.' }
      ]
    },
    {
      id: 'card-testing', title: 'Ataque de card testing',
      desc: 'Un script prueba miles de tarjetas robadas contra el formulario de pago de un comercio, con montos de 1 EUR, para saber cuáles siguen activas. Primero pasa; después lo frenan los límites por señal y Radar.',
      steps: [
        { from: 'browser', to: 'edge', kind: 'req', tag: 'confirmar · 1.00 EUR', ms: 80, title: 'Un script prueba tarjetas robadas', text: 'Montos de 1 EUR, miles de tarjetas distintas desde pocas IPs y números casi consecutivos. El atacante quiere saber cuáles siguen activas para usarlas o venderlas.' },
        { from: 'edge', to: 'vault', kind: 'req', tag: 'tokenizar', ms: 5, title: 'Cada tarjeta se tokeniza', text: 'Al principio, para el procesador son pagos chicos como cualquier otro.' },
        { from: 'edge', to: 'payments', kind: 'req', tag: 'confirm', ms: 2, title: 'Confirmar el pago', text: 'Un PaymentIntent de 1 EUR por cada intento.' },
        { from: 'payments', to: 'radar', kind: 'req', tag: '¿riesgo?', ms: 20, title: 'Radar todavía no ve un patrón', text: 'Los primeros intentos tienen un puntaje bajo: cada uno, solo, parece normal.' },
        { from: 'payments', to: 'acquirer', kind: 'req', tag: 'autorizar 100', ms: 5, title: 'Pide la autorización', text: 'Cada intento llega a la red, aunque termine rechazado.' },
        { from: 'acquirer', to: 'network', kind: 'req', tag: '0100', ms: 60, title: 'Un mensaje por cada tarjeta probada', text: 'La red los reparte entre los bancos emisores de cada tarjeta.' },
        { from: 'network', to: 'issuer', kind: 'req', tag: '¿fondos?', ms: 150, title: 'Cada emisor recibe su intento', text: 'Muchos bancos distintos, cada uno con una sola tarjeta de la lista: ninguno ve el ataque completo.' },
        { from: 'issuer', to: 'network', kind: 'fail', tag: '05 · 14 · 54', ms: 150, title: 'Rechazos en serie', text: 'No autorizar (05), número inválido (14), tarjeta vencida (54). Pocos aprobados entre muchísimos rechazos: cada aprobación le dice al atacante que esa tarjeta sirve.' },
        { from: 'network', to: 'acquirer', kind: 'res', tag: '0110 · 05', ms: 60, title: 'Los rechazos vuelven', text: 'Una tasa de rechazo así daña la reputación del comercio y del procesador ante la red.' },
        { from: 'acquirer', to: 'payments', kind: 'res', tag: 'rechazado', ms: 5, title: 'El intento termina rechazado', text: 'El PaymentIntent vuelve a <code>requires_payment_method</code> con el motivo del rechazo.' },
        { at: 'radar', kind: 'info', ms: 1, title: 'Radar ve el patrón', text: 'Cientos de tarjetas distintas desde las mismas IPs y el mismo dispositivo en pocos minutos, montos de 1 EUR y una tasa de rechazo altísima. Como Radar aprende de pagos de toda la red, reconoce el ataque aunque sea el primero contra este comercio.' },
        { from: 'browser', to: 'edge', kind: 'req', tag: 'confirmar · tarjeta 437', ms: 80, title: 'El script sigue', text: 'Misma IP, otra tarjeta.' },
        { from: 'edge', to: 'browser', kind: 'fail', tag: '429', ms: 80, title: 'Límite por señal', text: 'Aquí la cuenta del comercio es la víctima, así que limitar por cuenta no alcanza. La API limita los intentos fallidos por IP, por dispositivo y por sesión, y las tarjetas distintas por PaymentIntent.' },
        { from: 'browser', to: 'edge', kind: 'req', tag: 'confirmar · otra IP', ms: 80, title: 'El atacante cambia de IP', text: 'Pero el dispositivo y el patrón de los intentos siguen siendo los mismos.' },
        { from: 'edge', to: 'payments', kind: 'req', tag: 'confirm', ms: 2, title: 'Pasa el límite de tasa', text: 'Una IP nueva todavía no acumuló intentos fallidos.' },
        { from: 'payments', to: 'radar', kind: 'req', tag: '¿riesgo?', ms: 20, title: 'Radar evalúa con lo que ya sabe', text: 'El dispositivo y el patrón ya quedaron marcados por los intentos anteriores.' },
        { from: 'radar', to: 'payments', kind: 'fail', tag: 'block · puntaje 91', ms: 20, title: 'Una regla bloquea el pago', text: 'Puntaje 91 y una regla del comercio sobre la señal del ataque, como bloquear si una misma IP o un mismo dispositivo probó más de N tarjetas distintas en una hora. El pago no llega a la red: el emisor no ve el intento y el atacante no aprende nada de esa tarjeta.' },
        { from: 'edge', to: 'browser', kind: 'fail', tag: 'rechazado', ms: 80, title: 'El script recibe un rechazo sin detalle', text: 'El comercio no muestra por qué se rechazó, para no enseñarle al atacante qué señal lo delató. Y suma fricción donde corresponde: un CAPTCHA antes del formulario, el código de seguridad obligatorio, 3D Secure ante un puntaje elevado y un monto mínimo.' }
      ]
    }
  ]
});
