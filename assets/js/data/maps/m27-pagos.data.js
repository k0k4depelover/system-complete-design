/* Mapa del M27: pagos con tarjeta al estilo de Stripe. La API y su comportamiento público son documentados;
   la arquitectura interna es un diseño de referencia. */
SD.defineMap('m27-pagos', {
  title: 'Pagos con tarjeta de punta a punta',
  intro: 'Una tienda cobra 49.90 EUR con tarjeta. A la izquierda, lo que implementa el comercio; en el centro, un procesador de pagos al estilo de Stripe (su API está documentada; su interior es un diseño de referencia); a la derecha, la red de tarjetas y el banco del cliente.',
  start: 'payments',
  groups: [
    { id: 'g-com', label: 'El comercio', x: 20, y: 40, w: 300, h: 740 },
    { id: 'g-psp', label: 'Procesador de pagos (diseño de referencia)', x: 350, y: 40, w: 1005, h: 740 },
    { id: 'g-red', label: 'Red de tarjetas y bancos', x: 1385, y: 40, w: 280, h: 740 }
  ],
  nodes: [
    { id: 'browser', layer: 'client', label: 'Navegador del cliente', sub: 'Stripe.js y Elements', x: 170, y: 150,
      info: {
        resp: '<p>El formulario de la tarjeta es un iframe servido por el procesador: el número de tarjeta viaja directo del navegador al procesador y nunca toca los servidores del comercio. El navegador recibe del backend del comercio un <code>client_secret</code> y confirma el pago con Stripe.js; si el banco pide 3D Secure, Stripe.js muestra el desafío. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>const stripe = Stripe("pk_live_…");        // clave publicable: solo tokeniza y confirma\nconst { error, paymentIntent } = await stripe.confirmPayment({\n  elements,                               // el iframe con la tarjeta\n  clientSecret,                           // del PaymentIntent creado por el backend\n  redirect: "if_required",\n});</code></pre>',
        data: '<p>Nada de la tarjeta. Solo el <code>client_secret</code> de este PaymentIntent, que permite confirmar ese pago y nada más.</p>',
        fail: '<ul><li><b>Doble clic en Pagar:</b> se deshabilita el botón, pero la protección real es la idempotency key del backend (escenario "Doble clic").</li><li><b>La pestaña se cierra durante 3D Secure:</b> el pago queda en <code>requires_action</code>; el webhook o la vuelta al sitio resuelven el estado final.</li><li><b>El navegador dice "pagado":</b> no es prueba de nada. El comercio cumple el pedido con el webhook, no con el redirect.</li></ul>',
        nums: '<ul><li>Confirmar un pago tarda de 1 a 3 s de punta a punta, casi todo en la red de tarjetas y el banco emisor.</li></ul>'
      } },
    { id: 'merchant', layer: 'service', label: 'Backend del comercio', sub: 'crea pagos, recibe webhooks', x: 170, y: 480,
      info: {
        resp: '<p>Crea el PaymentIntent con el monto calculado en el servidor, nunca con el que manda el navegador, y con una idempotency key derivada del pedido. Entrega el <code>client_secret</code> al navegador y cumple el pedido solo cuando recibe el webhook de pago exitoso.</p>',
        api: '<pre data-lang="python"><code>import os, stripe\nstripe.api_key = os.environ["STRIPE_SECRET_KEY"]\n\npi = stripe.PaymentIntent.create(\n    amount=4990, currency="eur",            # 49.90 EUR en unidades menores\n    metadata={"order_id": "ord_8812"},\n    idempotency_key="ord_8812-pago",        # la misma en cada reintento\n)\nreturn {"client_secret": pi.client_secret}</code></pre>',
        data: '<p>Pedidos y eventos ya procesados, en su propia base (mira ese nodo).</p>',
        fail: '<ul><li><b>Timeout al crear el pago:</b> reintenta con la misma clave; nunca con una nueva.</li><li><b>Webhook lento:</b> responde 2xx en cuanto verificó la firma y guardó el evento, y procesa después; si tarda, el procesador reintenta y llegan duplicados.</li></ul>',
        nums: '<ul><li>Crear el PaymentIntent: unos cientos de ms.</li><li>El webhook llega de milisegundos a segundos después del pago; si el comercio falla, se reintenta hasta 3 días.</li></ul>'
      } },
    { id: 'merchantdb', layer: 'db', label: 'Base del comercio', sub: 'pedidos y eventos procesados', x: 170, y: 660,
      info: {
        resp: '<p>La verdad del comercio sobre sus pedidos. Registrar el evento procesado y cambiar el estado del pedido van en la misma transacción: si no, un reintento puede aplicar el cambio dos veces o ninguna.</p>',
        api: '<pre data-lang="sql"><code>BEGIN;\nINSERT INTO processed_events (event_id) VALUES ($1)\n  ON CONFLICT DO NOTHING;                  -- 0 filas: ya se procesó, salir\nUPDATE orders SET status = \'paid\'\n  WHERE id = $2 AND status = \'pending\';     -- solo avanza, nunca retrocede\nCOMMIT;</code></pre>',
        data: '<pre data-lang="sql"><code>CREATE TABLE orders (\n  id                 text PRIMARY KEY,\n  amount             bigint  NOT NULL,     -- unidades menores\n  currency           char(3) NOT NULL,\n  status             text NOT NULL CHECK (status IN\n                       (\'pending\', \'paid\', \'refunded\', \'fulfilled\')),\n  payment_intent_id  text UNIQUE\n);\nCREATE TABLE processed_events (\n  event_id     text PRIMARY KEY,           -- evt_…\n  received_at  timestamptz NOT NULL DEFAULT now()\n);</code></pre>',
        fail: '<p>La condición <code>status = \'pending\'</code> hace que un evento viejo que llega tarde no pueda devolver a "pagado" un pedido ya reembolsado.</p>',
        nums: '<ul><li>Los eventos procesados se pueden borrar pasados unos días: más que los 3 días de reintentos.</li></ul>'
      } },
    { id: 'edge', layer: 'edge', label: 'API del procesador', sub: 'autenticación, límites, idempotencia', x: 525, y: 330,
      info: {
        resp: '<p>Recibe cada request: autentica la clave secreta (<code>sk_</code>) o publicable (<code>pk_</code>), aplica límites por cuenta y pasa por la capa de idempotencia antes de cualquier operación que cambie estado. La API de Stripe recibe los parámetros como formulario y responde JSON. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre data-lang="http"><code>POST /v1/payment_intents HTTP/1.1\nHost: api.stripe.com\nAuthorization: Bearer sk_live_…\nIdempotency-Key: ord_8812-pago\nContent-Type: application/x-www-form-urlencoded\n\namount=4990&amp;currency=eur&amp;metadata[order_id]=ord_8812</code></pre>',
        data: '<p>Sin estado propio: usa el almacén de idempotencia y los contadores de límites por cuenta.</p>',
        fail: '<ul><li><b>429:</b> el cliente espera y reintenta con backoff.</li><li><b>5xx o timeout:</b> se reintenta con la misma clave. Las librerías oficiales de Stripe reintentan solas y generan la clave si no se la das. <span class="badge badge--doc">Documentado</span></li></ul>',
        nums: '<ul><li>Stripe documenta un límite básico del orden de 100 operaciones de lectura y 100 de escritura por segundo por cuenta en modo live. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'idem', layer: 'db', label: 'Claves de idempotencia', sub: 'una fila por clave, 24 h o más', x: 525, y: 510,
      info: {
        resp: '<p>Por cada clave guarda un hash de la request, quién la está ejecutando y la respuesta final. El comportamiento público de Stripe: la primera respuesta se guarda y se repite, incluidos los errores 500; la misma clave con otros parámetros da error; las claves se pueden borrar pasadas al menos 24 horas. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>INSERT … ON CONFLICT DO NOTHING\nsi la clave ya existía:\n  hash distinto          → 400 idempotency_error\n  respuesta guardada     → devolverla tal cual\n  locked_until &gt; now()   → 409: otra request con esta clave sigue en curso\n  lock vencido           → tomarlo y retomar desde recovery_point</code></pre>',
        data: '<pre data-lang="sql"><code>CREATE TABLE idempotency_keys (\n  account_id      text NOT NULL,\n  key             text NOT NULL,          -- hasta 255 caracteres\n  request_hash    bytea NOT NULL,         -- SHA-256 de método, ruta y cuerpo\n  locked_until    timestamptz,            -- dueño de la ejecución en curso\n  recovery_point  text NOT NULL DEFAULT \'started\',\n  response_code   int,\n  response_body   jsonb,\n  created_at      timestamptz NOT NULL DEFAULT now(),\n  PRIMARY KEY (account_id, key)\n);</code></pre>',
        fail: '<p>Si este almacén no responde, la API no puede garantizar el efecto único: rechaza las escrituras (fail-closed) en lugar de ejecutarlas sin protección. Es la decisión opuesta a la de Radar, y por el mismo motivo: cuál error cuesta más (M00).</p>',
        nums: '<ul><li>1 a 10 kB por clave con la respuesta guardada; particionado por cuenta.</li></ul>'
      } },
    { id: 'payments', layer: 'service', label: 'Servicio de pagos', sub: 'máquina de estados del PaymentIntent', x: 865, y: 330,
      info: {
        resp: '<p>Ejecuta las transiciones del PaymentIntent, consulta a Radar, habla con el adquirente, escribe el ledger y deja el evento en el outbox. Cada operación avanza por puntos de recuperación guardados en la base, así cualquier instancia puede retomar una request cortada a la mitad.</p>',
        api: '<pre><code>POST /v1/payment_intents              crear\nPOST /v1/payment_intents/{id}/confirm confirmar con un medio de pago\nPOST /v1/payment_intents/{id}/capture capturar lo autorizado\nPOST /v1/payment_intents/{id}/cancel  cancelar\nPOST /v1/refunds                      reembolsar, total o parcial</code></pre>',
        data: '<p>Nada en memoria: el estado vive en la base de pagos.</p>',
        fail: '<p>La llamada al adquirente es el único efecto que no se puede deshacer con un rollback. Se registra antes de hacerla, con el ID de transacción que se enviará, y después con el resultado. Si el proceso muere en el medio, la recuperación consulta por ese ID o envía una reversa (escenario "Timeout del banco").</p>',
        nums: '<ul><li>Stripe informó 1.4 billones de dólares de volumen procesado en 2024. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'vault', layer: 'db', label: 'Bóveda de tarjetas', sub: 'números cifrados, alcance PCI', x: 525, y: 150,
      info: {
        resp: '<p>Recibe el número de la tarjeta (PAN), lo cifra con claves custodiadas en HSM (envelope encryption, M10) y devuelve un token (<code>pm_…</code>). Es el único componente dentro del alcance más estricto de PCI DSS: el resto del sistema solo ve tokens.</p>',
        api: '<pre><code>tokenize(pan, vencimiento, cvc)  → pm_1Q…\ndetokenize(pm_1Q…)               → solo desde el conector del adquirente, auditado</code></pre>',
        data: '<p>PAN cifrado, últimos 4 dígitos, marca, vencimiento y un fingerprint para reconocer la misma tarjeta sin descifrarla. El código de seguridad (CVC) no se guarda después de la autorización: PCI DSS lo prohíbe. <span class="badge badge--doc">Documentado</span></p>',
        fail: '<p>Una filtración de la bóveda es el peor incidente posible: red segmentada, acceso de muy pocas personas, claves en HSM y auditoría anual externa.</p>',
        nums: '<ul><li>Tokenizar: milisegundos. Los tokens de la red (network tokens) permiten además que la tarjeta siga funcionando cuando el banco la reemplaza.</li></ul>'
      } },
    { id: 'radar', layer: 'service', label: 'Radar', sub: 'puntaje de fraude', x: 865, y: 150,
      info: {
        resp: '<p>Asigna a cada pago un puntaje de riesgo con un modelo entrenado con pagos de toda la red, y aplica las reglas del comercio: bloquear, mandar a revisión o pedir 3D Secure. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre><code>score(pago) → { risk_score: 0–99, risk_level: normal | elevated | highest }\nregla del comercio:  Block if :risk_score: &gt; 75</code></pre>',
        data: '<p>Señales: fingerprint de la tarjeta, IP, dispositivo, historial de esa tarjeta en otros comercios, velocidad de intentos.</p>',
        fail: '<p>Si Radar no responde a tiempo, el pago sigue con el puntaje por defecto (fail-open): perder una evaluación de fraude cuesta menos que rechazar todos los pagos. La decisión está escrita, no es un accidente.</p>',
        nums: '<ul><li>Decenas de milisegundos por evaluación, dentro del presupuesto de la confirmación.</li></ul>'
      } },
    { id: 'acquirer', layer: 'service', label: 'Conector del adquirente', sub: 'habla ISO 8583 con la red', x: 1195, y: 330,
      info: {
        resp: '<p>Traduce cada intento a mensajes ISO 8583: 0100 para autorizar, 0400 para revertir. Asigna a cada intento un número único (STAN y RRN) que la red usa para detectar duplicados y que después aparece en los archivos de liquidación.</p>',
        api: '<pre><code>0100  autorización\n  campo 2   PAN (desde la bóveda)\n  campo 4   000000004990      monto\n  campo 49  978               EUR\n  campo 11  STAN 004211       número del intento\n0110  respuesta, campo 39: 00 aprobado · 05 no autorizar · 51 sin fondos · 91 emisor no disponible</code></pre>',
        data: '<p>Registro de cada mensaje enviado y recibido, escrito antes de enviarlo y al recibir la respuesta.</p>',
        fail: '<p>Timeout sin respuesta: se envía una reversa (0400) para anular una posible aprobación. Reintentar la autorización a ciegas puede retener el dinero dos veces en la tarjeta del cliente.</p>',
        nums: '<ul><li>Una autorización tarda de 1 a 2 s de ida y vuelta hasta el emisor.</li></ul>'
      } },
    { id: 'network', layer: 'external', label: 'Red de tarjetas', sub: 'Visa, Mastercard', x: 1525, y: 330,
      info: {
        resp: '<p>Enruta la autorización del adquirente al banco emisor según los primeros dígitos de la tarjeta, y cada día hace el clearing y la liquidación entre bancos. Si el emisor no responde, puede aprobar en su nombre dentro de reglas acordadas con él (stand-in processing). <span class="badge badge--doc">Documentado</span></p>',
        api: '<p>Mensajes ISO 8583 en tiempo real para autorizaciones; archivos por lotes para clearing, liquidación y disputas.</p>',
        data: '<p>Reglas de stand-in por emisor, tokens de red e historial de disputas.</p>',
        fail: '<p>Semanas después puede llegar un contracargo: el titular disputa el cobro y la red devuelve el dinero al emisor; el comercio lo recupera solo si gana la disputa.</p>',
        nums: '<ul><li>Las grandes redes procesan cientos de millones de transacciones por día.</li></ul>'
      } },
    { id: 'issuer', layer: 'external', label: 'Banco emisor', sub: 'aprueba y retiene fondos', x: 1525, y: 510,
      info: {
        resp: '<p>El banco del titular de la tarjeta: verifica fondos o crédito, su propio fraude y la autenticación (3D Secure), y aprueba o rechaza. Al aprobar, retiene el monto; el dinero se mueve recién en la liquidación.</p>',
        api: '<p>Responde 0110 con el código 00 (aprobado) o el motivo del rechazo.</p>',
        data: '<p>Saldo, límite y retenciones pendientes de cada tarjeta.</p>',
        fail: '<p>Si está caído, la red aplica stand-in o rechaza con código 91; el comercio muestra "no se pudo procesar, intenta de nuevo".</p>',
        nums: '<ul><li>Una autorización que nunca se captura retiene el dinero unos días; Stripe cancela los PaymentIntents sin capturar a los 7 días en pagos con tarjeta online. <span class="badge badge--doc">Documentado</span></li></ul>'
      } },
    { id: 'paydb', layer: 'db', label: 'Base de pagos', sub: 'PaymentIntents y outbox', x: 865, y: 510,
      info: {
        resp: '<p>El estado de cada pago. El cambio de estado y el evento que lo anuncia se escriben en la misma transacción, en la tabla outbox (M07): no puede existir un pago exitoso sin su evento.</p>',
        api: '<pre data-lang="sql"><code>BEGIN;\nUPDATE payment_intents\n   SET status = \'succeeded\', amount_received = 4990, version = version + 1\n WHERE id = \'pi_3Q…\' AND version = 7;\nINSERT INTO outbox (event_type, payload)\n     VALUES (\'payment_intent.succeeded\', \'{"id": "pi_3Q…"}\');\nCOMMIT;</code></pre>',
        data: '<pre data-lang="sql"><code>CREATE TABLE payment_intents (\n  id               text PRIMARY KEY,     -- pi_3Q…\n  account_id       text NOT NULL,\n  amount           bigint NOT NULL CHECK (amount &gt; 0),\n  currency         char(3) NOT NULL,\n  status           text NOT NULL,\n  amount_received  bigint NOT NULL DEFAULT 0,\n  amount_refunded  bigint NOT NULL DEFAULT 0\n                   CHECK (amount_refunded &lt;= amount_received),\n  version          int NOT NULL DEFAULT 0\n);</code></pre>',
        fail: '<p>Particionada por cuenta: una partición caída detiene los pagos de sus comercios, no los de todos (arquitectura celular, M08).</p>',
        nums: '<ul><li>El <code>CHECK</code> de reembolsos es la última defensa contra reembolsar más de lo cobrado, aunque falle todo lo demás.</li></ul>'
      } },
    { id: 'ledger', layer: 'db', label: 'Ledger', sub: 'doble entrada, solo se agrega', x: 1195, y: 510,
      info: {
        resp: '<p>Registra cada movimiento de dinero como una transacción de asientos que suman cero: lo que sale de una cuenta entra en otra. Los saldos se derivan de los asientos, y nada se edita: un error se corrige con asientos nuevos.</p>',
        api: '<pre><code>cobro de pi_3Q…, 49.90 EUR con 1.00 de comisión:\n  débito   por cobrar al adquirente      4990\n  crédito  saldo pendiente del comercio  4890\n  crédito  ingresos por comisiones        100\n  total                                     0</code></pre>',
        data: '<pre data-lang="sql"><code>CREATE TABLE ledger_entries (\n  id              bigserial PRIMARY KEY,\n  transaction_id  uuid    NOT NULL,\n  account_id      text    NOT NULL,\n  amount          bigint  NOT NULL,       -- débitos +, créditos −\n  currency        char(3) NOT NULL,\n  created_at      timestamptz NOT NULL DEFAULT now()\n);\n-- invariante: por transaction_id y currency, SUM(amount) = 0</code></pre>',
        fail: '<p>Una transacción que no suma cero se rechaza: es un bug de dinero, no un dato raro. La conciliación diaria compara este registro con el mundo exterior.</p>',
        nums: '<ul><li>Cada pago genera varios juegos de asientos (cobro, liquidación, pago al comercio, reembolsos): miles de millones de filas por año.</li></ul>'
      } },
    { id: 'events', layer: 'queue', label: 'Bus de eventos', sub: 'particionado por cuenta', x: 865, y: 690,
      info: {
        resp: '<p>Un relay lee el outbox y publica cada evento en el bus. Lo consumen el envío de webhooks, las proyecciones del ledger, la analítica y el entrenamiento de Radar.</p>',
        api: '<pre data-lang="json"><code>{\n  "id": "evt_1Q9x…",\n  "object": "event",\n  "type": "payment_intent.succeeded",\n  "created": 1790592000,\n  "data": { "object": { "id": "pi_3Q…", "amount": 4990,\n                        "currency": "eur", "status": "succeeded" } }\n}</code></pre>',
        data: '<p>Particionado por cuenta: los eventos de un comercio mantienen su orden dentro del bus. Eso no garantiza el orden de llegada al comercio: los reintentos lo rompen.</p>',
        fail: '<p>Entrega al menos una vez: el relay puede publicar dos veces si muere después de publicar y antes de marcar la fila. Todos los consumidores deduplican por <code>id</code>.</p>',
        nums: '<ul><li>Segundos entre el pago y el evento publicado.</li></ul>'
      } },
    { id: 'webhooks', layer: 'service', label: 'Envío de webhooks', sub: 'firma y reintenta hasta 3 días', x: 525, y: 690,
      info: {
        resp: '<p>Por cada evento y cada endpoint suscrito hace un POST firmado. Si el endpoint no responde 2xx, reintenta con backoff exponencial durante hasta 3 días, y avisa al comercio si su endpoint falla de forma sostenida. <span class="badge badge--doc">Documentado</span></p>',
        api: '<pre data-lang="http"><code>POST /webhooks/pagos HTTP/1.1\nHost: tienda.example\nStripe-Signature: t=1790592001,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd\nContent-Type: application/json\n\n{"id": "evt_1Q9x…", "type": "payment_intent.succeeded", …}</code></pre>',
        data: '<p>Una cola de entregas pendientes por endpoint, con la hora del próximo intento.</p>',
        fail: '<p>El orden de entrega no está garantizado y los duplicados son normales: un endpoint que tardó en responder recibe el mismo evento otra vez. <span class="badge badge--doc">Documentado</span></p>',
        nums: '<ul><li>La firma es un HMAC-SHA256 de <code>{t}.{cuerpo}</code> con el secreto del endpoint; el comercio rechaza firmas de más de 5 minutos para frenar repeticiones.</li></ul>'
      } },
    { id: 'recon', layer: 'service', label: 'Conciliación', sub: 'archivos diarios del adquirente', x: 1195, y: 690,
      info: {
        resp: '<p>Cada día compara el archivo de liquidación del adquirente, línea por línea, con el ledger: montos, comisiones, monedas y fechas. Lo que no coincide abre una excepción que alguien resuelve.</p>',
        api: '<pre data-lang="sql"><code>SELECT f.rrn, f.amount AS en_archivo, l.amount AS en_ledger\n  FROM settlement_file f\n  FULL OUTER JOIN ledger_captures l ON l.rrn = f.rrn\n WHERE l.rrn IS NULL OR f.rrn IS NULL OR l.amount &lt;&gt; f.amount;</code></pre>',
        data: '<p>Excepciones con su categoría: pendiente por horario, falta en el ledger, falta en el archivo, diferencia de monto.</p>',
        fail: '<p>La excepción más grave es un cobro en el archivo que no está en el ledger: dinero que se movió sin que el sistema lo supiera. Suele venir de un timeout mal resuelto.</p>',
        nums: '<ul><li>Una corrida diaria por adquirente y moneda, con millones de líneas.</li></ul>'
      } }
  ],
  edges: [
    { id: 'e1', from: 'browser', to: 'merchant', both: true, label: 'checkout' },
    { id: 'e2', from: 'merchant', to: 'edge', both: true, label: 'POST /v1/payment_intents' },
    { id: 'e3', from: 'browser', to: 'edge', both: true, label: 'confirmar (Stripe.js)' },
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
    { id: 'e15', from: 'webhooks', to: 'merchant', both: true, label: 'webhook firmado' },
    { id: 'e16', from: 'merchant', to: 'merchantdb', both: true },
    { id: 'e17', from: 'network', to: 'recon', async: true, label: 'liquidación diaria', labelAt: 0.78 },
    { id: 'e18', from: 'recon', to: 'ledger', both: true }
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
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'INSERT pi_3Q…', ms: 3, title: 'Se guarda el pago', text: '' },
        { from: 'edge', to: 'idem', kind: 'req', tag: 'guardar respuesta', ms: 2, title: 'La respuesta queda asociada a la clave', text: 'Desde ahora, repetir esta request devuelve exactamente esta respuesta.' },
        { from: 'edge', to: 'merchant', kind: 'res', tag: '200 + client_secret', ms: 60, title: 'El comercio recibe el client_secret', text: 'Y se lo pasa al navegador.' },
        { from: 'merchant', to: 'browser', kind: 'res', tag: 'client_secret', ms: 40, title: 'El navegador tiene con qué confirmar', text: '' },
        { from: 'browser', to: 'edge', kind: 'req', tag: 'confirmar', ms: 80, title: 'Stripe.js confirma con la tarjeta', text: 'Los datos de la tarjeta viajan desde el iframe directo al procesador.' },
        { from: 'edge', to: 'vault', kind: 'req', tag: 'tokenizar', ms: 5, title: 'La tarjeta se convierte en un token', text: 'El resto del sistema trabaja con <code>pm_1Q…</code>.' },
        { from: 'edge', to: 'payments', kind: 'req', tag: 'confirm', ms: 2, title: 'Confirmar el pago', text: '' },
        { from: 'payments', to: 'radar', kind: 'req', tag: '¿riesgo?', ms: 20, title: 'Radar evalúa el fraude', text: 'Puntaje 12 de 99: riesgo normal, sigue sin 3D Secure.' },
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'antes de llamar', ms: 3, title: 'Registra el intento antes de salir', text: 'Guarda el STAN que va a usar. Si el proceso muere durante la llamada, la recuperación sabe qué preguntar.' },
        { from: 'payments', to: 'acquirer', kind: 'req', tag: 'autorizar 4990', ms: 5, title: 'Pide la autorización', text: '' },
        { from: 'acquirer', to: 'network', kind: 'req', tag: '0100', ms: 60, title: 'Mensaje ISO 8583 a la red', text: '' },
        { from: 'network', to: 'issuer', kind: 'req', tag: '¿fondos?', ms: 150, title: 'La red lo lleva al banco emisor', text: 'Según los primeros dígitos de la tarjeta.' },
        { from: 'issuer', to: 'network', kind: 'res', tag: '00 aprobado', ms: 150, title: 'El emisor aprueba', text: 'Retiene 49.90 EUR en la tarjeta del cliente. Todavía no se movió dinero.' },
        { from: 'network', to: 'acquirer', kind: 'res', tag: '0110 · 00', ms: 60, title: 'La respuesta vuelve', text: '' },
        { from: 'acquirer', to: 'payments', kind: 'res', tag: 'aprobado', ms: 5, title: 'Autorizado', text: 'Con captura automática, el pago pasa a <code>succeeded</code>.' },
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'UPDATE + outbox', ms: 4, title: 'Estado y evento en una transacción', text: 'El pago exitoso y su evento <code>payment_intent.succeeded</code> se confirman juntos.' },
        { from: 'payments', to: 'ledger', kind: 'req', tag: 'asientos', ms: 3, title: 'El ledger registra el cobro', text: 'Por cobrar al adquirente 4990; saldo pendiente del comercio 4890; comisión 100. Suma cero.' },
        { from: 'edge', to: 'browser', kind: 'res', tag: 'succeeded', ms: 80, title: 'El navegador muestra "Pago aceptado"', text: 'Es una buena noticia para el cliente, pero no la señal que usa el comercio.' },
        { from: 'paydb', to: 'events', kind: 'async', tag: 'relay', ms: 300, title: 'El relay publica el evento', text: '' },
        { from: 'events', to: 'webhooks', kind: 'async', tag: 'evento', ms: 20, title: 'Se programa el webhook', text: '' },
        { from: 'webhooks', to: 'merchant', kind: 'req', tag: 'POST firmado', ms: 80, title: 'El comercio recibe el webhook', text: 'Verifica la firma sobre el cuerpo crudo antes de parsear nada.' },
        { from: 'merchant', to: 'merchantdb', kind: 'req', tag: 'evento + pedido', ms: 4, title: 'Registra el evento y marca el pedido pagado', text: 'En una transacción, deduplicando por el id del evento.' },
        { from: 'merchant', to: 'webhooks', kind: 'res', tag: '200', ms: 80, title: 'Entrega confirmada', text: 'El pedido se prepara para enviar. La liquidación, con el dinero de verdad, llegará en uno o dos días.' }
      ]
    },
    {
      id: 'doble-clic', title: 'Doble clic en Pagar',
      desc: 'El cliente aprieta dos veces y el backend del comercio manda dos requests casi a la vez, con la misma idempotency key.',
      steps: [
        { from: 'merchant', to: 'edge', kind: 'req', tag: 'POST · clave ord_8812', ms: 60, title: 'Primera request', text: '' },
        { from: 'edge', to: 'idem', kind: 'req', tag: 'INSERT: nueva', ms: 2, title: 'La primera toma la clave', text: 'Queda con <code>locked_until</code> dentro de unos segundos.' },
        { from: 'merchant', to: 'edge', kind: 'req', tag: 'POST · misma clave', ms: 15, title: 'Segunda request, 15 ms después', text: 'Mismo cuerpo, misma clave: el backend la derivó del pedido, no la generó al azar en cada clic.' },
        { from: 'edge', to: 'idem', kind: 'fail', tag: 'existe, en curso', ms: 2, title: 'La clave existe y está tomada', text: 'El hash coincide, no hay respuesta guardada todavía y el lock sigue vigente.' },
        { from: 'edge', to: 'merchant', kind: 'fail', tag: '409', ms: 60, title: 'Conflicto: otra request con esta clave sigue en curso', text: 'Stripe devuelve un error de clave en uso. No se creó nada.' },
        { from: 'edge', to: 'payments', kind: 'req', tag: 'crear (primera)', ms: 5, title: 'La primera sigue su camino', text: '' },
        { from: 'edge', to: 'idem', kind: 'req', tag: 'guardar respuesta', ms: 2, title: 'La primera termina y guarda su respuesta', text: '' },
        { from: 'edge', to: 'merchant', kind: 'res', tag: '200 · pi_3Q…', ms: 60, title: 'Respuesta de la primera', text: '' },
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
        { from: 'payments', to: 'acquirer', kind: 'req', tag: 'autorizar 4990', ms: 5, title: 'Pide la autorización', text: '' },
        { from: 'acquirer', to: 'network', kind: 'req', tag: '0100 · STAN 004211', ms: 60, title: 'El mensaje sale', text: '' },
        { from: 'network', to: 'issuer', kind: 'req', tag: '¿fondos?', ms: 150, title: 'Llega al emisor', text: '' },
        { from: 'issuer', to: 'network', kind: 'res', tag: '00 aprobado', ms: 150, title: 'El emisor aprueba y retiene 49.90', text: '' },
        { from: 'network', to: 'acquirer', kind: 'fail', tag: '0110 ✕', ms: 0, title: 'La respuesta se pierde', text: 'Se corta la conexión entre la red y el conector.' },
        { at: 'acquirer', kind: 'fail', ms: 10000, title: 'Timeout de 10 s', text: 'El conector no sabe si el pago se aprobó. Reintentar la autorización podría retener el dinero dos veces.' },
        { from: 'acquirer', to: 'network', kind: 'req', tag: '0400 reversa', ms: 60, title: 'Envía una reversa por ese STAN', text: 'Es la regla ante una respuesta que no llegó: anular lo que pudo haberse aprobado. La reversa también se reintenta hasta que se confirme.' },
        { from: 'network', to: 'issuer', kind: 'req', tag: 'anular', ms: 150, title: 'El emisor libera la retención', text: '' },
        { from: 'issuer', to: 'network', kind: 'res', tag: 'reversa ok', ms: 150, title: 'Retención liberada', text: '' },
        { from: 'network', to: 'acquirer', kind: 'res', tag: '0410', ms: 60, title: 'La reversa se confirma', text: '' },
        { from: 'acquirer', to: 'payments', kind: 'res', tag: 'no autorizado', ms: 5, title: 'El intento termina como fallido', text: '' },
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'requires_payment_method', ms: 3, title: 'El pago vuelve a esperar un medio de pago', text: 'Con <code>last_payment_error</code> explicando el motivo.' },
        { from: 'edge', to: 'browser', kind: 'res', tag: 'error reintentable', ms: 80, title: 'El cliente ve "no se pudo procesar, intenta de nuevo"', text: 'Si vuelve a intentar, es un intento nuevo del mismo PaymentIntent: nunca dos cobros. Y si la reversa hubiera fallado, la conciliación del día siguiente encontraría la captura sin su pago en el ledger.' }
      ]
    },
    {
      id: 'webhook-dup', title: 'Webhook duplicado y desordenado',
      desc: 'El pago se aprueba y a los pocos segundos se reembolsa. El comercio tarda en responder el primer webhook, así que ese evento se reintenta y llega después del reembolso.',
      steps: [
        { from: 'events', to: 'webhooks', kind: 'async', tag: 'evt_1 succeeded', ms: 20, title: 'Primer evento: pago exitoso', text: '' },
        { from: 'webhooks', to: 'merchant', kind: 'req', tag: 'evt_1', ms: 80, title: 'Se envía evt_1', text: '' },
        { from: 'merchant', to: 'merchantdb', kind: 'req', tag: 'procesa evt_1', ms: 4, title: 'El comercio lo procesa: pedido pagado', text: 'Pero hace más trabajo antes de responder (manda un email, llama a otro servicio).' },
        { from: 'merchant', to: 'webhooks', kind: 'fail', tag: 'timeout', ms: 20000, title: 'No responde a tiempo', text: 'Para el emisor de webhooks, la entrega falló: la reprograma.' },
        { from: 'events', to: 'webhooks', kind: 'async', tag: 'evt_2 refunded', ms: 20, title: 'Segundo evento: reembolso', text: 'El comercio reembolsó el pedido desde su panel.' },
        { from: 'webhooks', to: 'merchant', kind: 'req', tag: 'evt_2', ms: 80, title: 'Llega evt_2', text: '' },
        { from: 'merchant', to: 'merchantdb', kind: 'req', tag: 'refunded', ms: 4, title: 'Pedido reembolsado', text: '' },
        { from: 'merchant', to: 'webhooks', kind: 'res', tag: '200', ms: 80, title: 'Esta vez responde rápido', text: '' },
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
        { from: 'payments', to: 'acquirer', kind: 'req', tag: 'autorizar 4990', ms: 5, title: 'Pide la autorización', text: '' },
        { from: 'acquirer', to: 'network', kind: 'req', tag: '0100', ms: 60, title: 'El mensaje llega a la red', text: '' },
        { from: 'network', to: 'issuer', kind: 'fail', tag: 'sin respuesta', ms: 3000, title: 'El emisor no contesta', text: 'La red espera unos segundos.' },
        { at: 'network', kind: 'info', ms: 5, title: 'Stand-in processing', text: 'Con las reglas que el emisor dejó acordadas (montos máximos, tipos de comercio), la red aprueba en su nombre los pagos chicos y rechaza el resto con el código 91, emisor no disponible.' },
        { from: 'network', to: 'acquirer', kind: 'res', tag: '0110 · 00 (stand-in)', ms: 60, title: 'Aprobado por la red', text: 'Cuando el emisor vuelva, la red le informa lo que aprobó en su nombre.' },
        { from: 'acquirer', to: 'payments', kind: 'res', tag: 'aprobado', ms: 5, title: 'Para el procesador, un pago normal', text: '' },
        { at: 'payments', kind: 'info', ms: 1, title: 'Y si hubiera sido un 91', text: 'El pago falla con un rechazo reintentable: el comercio muestra "intenta de nuevo en unos minutos". Si muchos pagos del mismo emisor fallan así, el procesador abre un circuit breaker para no sumar carga a un banco que se está recuperando (M08).' }
      ]
    },
    {
      id: 'reembolso', title: 'Reembolso parcial',
      desc: 'El cliente devuelve una parte del pedido: se reembolsan 19.90 de los 49.90 EUR.',
      steps: [
        { from: 'merchant', to: 'edge', kind: 'req', tag: 'POST /v1/refunds', ms: 60, title: 'El comercio pide el reembolso', text: 'Con su propia clave: la devolución 1 del pedido.', code: 'POST /v1/refunds HTTP/1.1\nIdempotency-Key: ord_8812-reembolso-1\n\npayment_intent=pi_3Q…&amount=1990', lang: 'http' },
        { from: 'edge', to: 'idem', kind: 'req', tag: 'INSERT clave', ms: 2, title: 'Clave nueva', text: '' },
        { from: 'edge', to: 'payments', kind: 'req', tag: 'refund 1990', ms: 2, title: 'Validar el reembolso', text: '' },
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'SELECT … FOR UPDATE', ms: 3, title: 'Bloquea el pago y verifica', text: 'Cobrado 4990, reembolsado 0: 1990 entra. El lock evita que dos reembolsos simultáneos pasen la verificación a la vez (el write skew del M05); el <code>CHECK</code> de la tabla es la última red.' },
        { from: 'payments', to: 'ledger', kind: 'req', tag: 'asientos', ms: 3, title: 'Asientos del reembolso', text: 'Débito al saldo del comercio 1990; crédito a reembolsos por pagar al adquirente 1990. Suma cero.' },
        { from: 'payments', to: 'acquirer', kind: 'req', tag: 'crédito 1990', ms: 5, title: 'Se envía el crédito a la red', text: '' },
        { from: 'acquirer', to: 'network', kind: 'req', tag: 'reembolso', ms: 60, title: 'La red lo lleva al emisor', text: 'Los reembolsos se liquidan por lotes: el cliente lo ve en su tarjeta en unos días.' },
        { from: 'payments', to: 'paydb', kind: 'req', tag: 'amount_refunded = 1990', ms: 4, title: 'Estado y evento', text: 'Con el evento <code>charge.refunded</code> en el outbox.' },
        { from: 'edge', to: 'merchant', kind: 'res', tag: '200 · re_1Q…', ms: 60, title: 'Reembolso creado', text: 'Si el comercio pidiera ahora otros 4000, la respuesta sería un 400: 1990 + 4000 supera lo cobrado.' },
        { from: 'paydb', to: 'events', kind: 'async', tag: 'charge.refunded', ms: 300, title: 'El evento sale por el outbox', text: '' },
        { from: 'events', to: 'webhooks', kind: 'async', tag: 'evento', ms: 20, title: 'Webhook programado', text: '' },
        { from: 'webhooks', to: 'merchant', kind: 'req', tag: 'POST firmado', ms: 80, title: 'El comercio lo confirma en su base', text: '' }
      ]
    }
  ]
});
