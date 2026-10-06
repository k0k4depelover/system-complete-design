/* Checkpoint A: examen integrador de la Parte I (M00 a M11). Cada explicación dice qué módulo repasar. */
SD.defineQuiz('cpa', {
  title: 'Examen del Checkpoint A',
  pass: 0.7,
  questions: [
    {
      id: 'estimacion', type: 'single',
      prompt: 'Un acortador de URLs atiende 10 000 millones de redirecciones por mes. ¿Cuántas por segundo en promedio, y qué pico planificarías con un factor de pico de 3?',
      options: [
        'Unas 390 por segundo, con un pico de unas 1200.',
        'Unas 3900 por segundo, con un pico de unas 12 000.',
        'Unas 39 000 por segundo, con un pico de unas 120 000.',
        'Unas 3900 por segundo; el pico no importa porque la caché lo absorbe.'
      ],
      answer: 1,
      explain: '10<sup>10</sup> ÷ 2.59 millones de segundos por mes ≈ 3860 por segundo; por 3, unas 11 600. El pico sí importa: dimensiona las capas que no cachean (y la caché misma). Repasa M00, estimaciones.'
    },
    {
      id: 'disponibilidad', type: 'single',
      prompt: 'Una request pasa en serie por un gateway (99.99&#8239;%), un servicio (99.95&#8239;%) y una base de datos (99.95&#8239;%). ¿Qué disponibilidad puede prometer el conjunto, como máximo?',
      options: [
        '99.99&#8239;%, la del gateway, porque es el que recibe todas las requests.',
        '99.95&#8239;%, la del peor componente: la cadena es tan fuerte como su eslabón más débil.',
        'Alrededor de 99.89&#8239;%: en serie, las disponibilidades se multiplican.',
        '99.97&#8239;%, el promedio de los tres componentes de la cadena.'
      ],
      answer: 2,
      explain: '0.9999 × 0.9995 × 0.9995 ≈ 0.9989. Cada dependencia en serie resta; para prometer más hay que poner redundancia en paralelo o quitar dependencias del camino. Repasa M00, disponibilidad compuesta.'
    },
    {
      id: 'rtt', type: 'single',
      prompt: 'Un usuario en Buenos Aires llama por primera vez a una API en Virginia (RTT de 150 ms) con HTTPS sobre TCP y TLS 1.3. Sin contar el DNS ni el procesamiento, ¿cuánto tarda como mínimo el primer byte de la respuesta?',
      options: ['150 ms', '300 ms', '450 ms', '600 ms'],
      answer: 2,
      fixed: true,
      explain: 'Un RTT para el handshake de TCP, uno para TLS 1.3 y uno para la request y su respuesta: 3 × 150 ms. Una CDN cerca del usuario hace los dos primeros contra un PoP a pocos milisegundos, y HTTP/3 junta transporte y cifrado en un solo RTT. Repasa M01.'
    },
    {
      id: 'idempotencia', type: 'single',
      prompt: 'El cliente envía <code>POST /v1/payments</code> con un <code>Idempotency-Key</code>. El servidor cobra, pero la respuesta se pierde por un corte de red y el cliente reintenta con la misma clave y el mismo cuerpo. ¿Qué debe pasar?',
      options: [
        'Se cobra otra vez: un POST nunca es idempotente, aunque lleve la clave.',
        'El servidor devuelve la respuesta guardada del primer intento, sin cobrar de nuevo.',
        'El servidor responde 409 siempre que vea una clave repetida.',
        'El servidor ignora la request y el cliente queda esperando hasta su timeout.'
      ],
      answer: 1,
      explain: 'Esa es la razón de ser de la clave: el reintento devuelve el mismo resultado. Un 409 corresponde solo si el primer intento sigue en curso, y un 422 si la clave llega con un cuerpo distinto. Repasa M02, idempotencia.'
    },
    {
      id: 'balanceo', type: 'single',
      prompt: 'Uno de los diez servidores de un pool se degrada y responde diez veces más lento que los demás, sin fallar los health checks. ¿Qué algoritmo de balanceo limita mejor el daño?',
      options: [
        'Round robin con pesos, porque reparte por igual entre los diez.',
        'Aleatorio: con muchas requests, el servidor lento recibe solo una décima parte.',
        'Menos requests en curso o power of two choices, que esquivan al lento.',
        'Hash de la IP del cliente, que mantiene a cada cliente en el mismo servidor.'
      ],
      answer: 2,
      explain: 'Round robin y aleatorio le siguen mandando su parte, y cada request que le toca es lenta. Los algoritmos que miran el trabajo en curso lo detectan solos, antes que cualquier health check. Repasa M03, algoritmos.'
    },
    {
      id: 'stampede', type: 'multi',
      prompt: 'Una clave que se lee 100 000 veces por segundo vence, y recalcularla tarda 2 s en la base de datos. ¿Qué medidas evitan la estampida?',
      options: [
        'Single-flight o un lock: una sola request recalcula.',
        'Expiración anticipada probabilística: alguna request la renueva antes de que venza.',
        'Stale-while-revalidate: servir el valor viejo mientras se recalcula.',
        'Bajar el TTL a 1 segundo, para que el valor vencido se recalcule más seguido.',
        'Agregar réplicas de lectura a la base, para repartir las 100 000 lecturas.'
      ],
      answer: [0, 1, 2],
      explain: 'Las tres evitan que miles de requests recalculen lo mismo a la vez. Un TTL más corto hace que la estampida ocurra más seguido, y las réplicas solo suben el umbral: 2 s × 100 000 requests por segundo siguen siendo 200 000 consultas iguales. Repasa M04, cache stampede.'
    },
    {
      id: 'cache-caida', type: 'single',
      prompt: 'Se cae todo el clúster de Redis. La base de datos está dimensionada para el 10&#8239;% de las lecturas y de golpe recibe el 100&#8239;%. ¿Qué la protege mientras la caché vuelve?',
      options: [
        'Reintentar las lecturas que fallan en la caché hasta que Redis vuelva.',
        'Limitar la concurrencia hacia la base y descartar el excedente (load shedding).',
        'Escalar la base en caliente, que con autoscaling tarda unos segundos.',
        'Subir los timeouts para que ninguna request falle mientras la base procesa la cola.'
      ],
      answer: 1,
      explain: 'La base no puede atender diez veces su capacidad: si lo intenta, cae ella también y la recuperación se vuelve metaestable. Atender bien una parte es mejor que atender mal a todos. Repasa M04 (cuando la caché entera cae) y M08 (load shedding).'
    },
    {
      id: 'write-skew', type: 'single',
      prompt: 'Dos médicos de guardia piden la baja a la vez. Cada transacción comprueba que queda al menos otro médico de guardia, y las dos confirman: quedan cero. ¿Qué anomalía es y qué la evita?',
      options: [
        'Lectura sucia; la evita Read Committed, que no deja ver datos sin confirmar.',
        'Write skew; la evita Serializable o <code>SELECT … FOR UPDATE</code>.',
        'Actualización perdida; la evita Repeatable Read, que bloquea las filas escritas.',
        'Retraso de replicación; la evita leer las dos comprobaciones del primario.'
      ],
      answer: 1,
      explain: 'Cada transacción lee un conjunto, decide con él y escribe una fila distinta: ninguna pisa a la otra, por eso Snapshot Isolation no lo detecta. Serializable, o bloquear lo leído, sí. Repasa M05, transacciones.'
    },
    {
      id: 'sharding', type: 'single',
      prompt: 'Particionas los pedidos por hash de <code>customer_id</code> en 64 shards. ¿Qué consulta se vuelve cara?',
      options: [
        'Los pedidos de un cliente, que quedan repartidos entre los 64 shards.',
        'Un pedido por <code>(customer_id, order_id)</code>, que necesita un índice global.',
        'Los pedidos del último día de todos los clientes, ordenados por fecha.',
        'Insertar un pedido nuevo, que tiene que avisar a los 64 shards.'
      ],
      answer: 2,
      explain: 'Sin el <code>customer_id</code> la consulta va a los 64 shards y hay que fusionar los resultados (scatter-gather). Esas consultas se sirven desde otro almacén, alimentado por CDC. Repasa M05, sharding.'
    },
    {
      id: 'quorum', type: 'single',
      prompt: 'Con replicación sin líder y N = 3 réplicas, ¿qué combinación de réplicas por lectura (R) y por escritura (W) garantiza que una lectura vea la última escritura confirmada?',
      options: ['R = 1, W = 1', 'R = 2, W = 2', 'R = 1, W = 2', 'R = 2, W = 1'],
      answer: 1,
      fixed: true,
      explain: 'Con R + W > N, todo conjunto de lectura se cruza con todo conjunto de escritura en al menos una réplica, que tiene el valor nuevo. Repasa M05, quórums.'
    },
    {
      id: 'pacelc', type: 'single',
      prompt: '¿Cuál de estas afirmaciones es correcta?',
      options: [
        'Con Raft, el lado minoritario de una partición deja de aceptar escrituras.',
        'CAP obliga a elegir dos de tres propiedades incluso cuando no hay partición.',
        'Un sistema AP nunca devuelve datos viejos, porque sigue aceptando escrituras en los dos lados.',
        'PACELC solo describe lo que pasa durante una partición, igual que CAP.'
      ],
      answer: 0,
      explain: 'CAP solo obliga a elegir durante una partición; PACELC agrega el caso normal (Else): latencia contra consistencia. Un sistema AP responde siempre, a costa de poder devolver datos viejos. Repasa M06, CAP y PACELC.'
    },
    {
      id: 'fencing', type: 'single',
      prompt: 'Un worker tiene un lease de 10 s, se pausa 15 s por el recolector de basura y, al volver, escribe creyendo que todavía es el dueño. Otro worker ya tomó el lease. ¿Qué evita que la escritura vieja se aplique?',
      options: [
        'Sincronizar los relojes con NTP para que el worker sepa que su lease venció.',
        'Un fencing token creciente que el almacenamiento verifica en cada escritura.',
        'Un lease más largo que la pausa más larga del recolector de basura.',
        'Que el worker renueve el lease justo antes de escribir.'
      ],
      answer: 1,
      explain: 'El worker no puede saber que estuvo pausado; quien tiene que protegerse es el recurso compartido. Un lease más largo solo cambia cuánto tiene que durar la pausa. Repasa M06, leases y fencing tokens.'
    },
    {
      id: 'outbox', type: 'single',
      prompt: 'El servicio de pedidos guarda el pedido en PostgreSQL y después publica el evento en Kafka. Si el proceso muere entre los dos pasos, ¿qué pasa y cómo se evita?',
      options: [
        'Nada: el productor de Kafka reintenta la publicación solo al reiniciar.',
        'El evento nunca se publica; se evita con una tabla outbox en la misma transacción.',
        'El evento se publica dos veces; lo evita el modo exactamente una vez de Kafka.',
        'Se pierde el pedido; se evita publicando el evento primero y guardando después.'
      ],
      answer: 1,
      explain: 'Son dos sistemas sin transacción común. Con el outbox, pedido y evento se confirman juntos; un relay o CDC publica el evento al menos una vez y los consumidores deduplican. Repasa M07, outbox.'
    },
    {
      id: 'orden', type: 'single',
      prompt: 'Los eventos de una misma cuenta tienen que procesarse en orden, y quieres 12 consumidores en paralelo. ¿Cómo?',
      options: [
        'Con un solo consumidor.',
        'Usando <code>account_id</code> como clave de partición.',
        'Repartiendo al azar y ordenando por timestamp al consumir.',
        'Con una cola sin particiones, que entrega todo en orden a los 12 consumidores.'
      ],
      answer: 1,
      explain: 'El orden existe solo dentro de una partición; la clave decide qué eventos comparten partición. Con al menos 12 particiones, los 12 consumidores trabajan en paralelo sin romper el orden de ninguna cuenta. Repasa M07, particiones y consumer groups.'
    },
    {
      id: 'reintentos', type: 'multi',
      prompt: 'Una dependencia empieza a fallar el 30&#8239;% de las requests. ¿Qué medidas evitan que tus reintentos terminen de tirarla?',
      options: [
        'Backoff exponencial con jitter.',
        'Un presupuesto de reintentos, de un 10&#8239;% extra como máximo.',
        'Un circuit breaker que corta las llamadas mientras falla.',
        'Reintentar de inmediato, hasta 5 intentos en cada capa, para recuperar el 30&#8239;% perdido.',
        'Quitar los timeouts para no cortar las requests lentas, que terminan reintentándose.'
      ],
      answer: [0, 1, 2],
      explain: 'Hasta 5 intentos en cada una de 3 capas multiplican la carga hasta 5 × 5 × 5 = 125 veces, justo cuando la dependencia está débil. Sin timeouts, las requests colgadas agotan tus propios recursos. Repasa M08, reintentos y circuit breakers.'
    },
    {
      id: 'token-bucket', type: 'single',
      prompt: 'Un token bucket tiene capacidad 100 y recarga 10 tokens por segundo. Un cliente que estuvo quieto un minuto envía 150 requests de golpe. ¿Cuántas pasan en ese instante?',
      options: ['10', '100', '150', '600'],
      answer: 1,
      fixed: true,
      explain: 'El balde se llena hasta su capacidad y no acumula más: pasan 100, y las otras 50 reciben 429 (o esperan a los tokens nuevos, a 10 por segundo). La capacidad define la ráfaga permitida; la recarga, el ritmo sostenido. Repasa M08, rate limiting.'
    },
    {
      id: 'presigned', type: 'multi',
      prompt: '¿Qué es cierto de una URL prefirmada de subida (<code>PUT</code>) que genera tu backend?',
      options: [
        'El archivo va directo del cliente al almacenamiento, sin pasar por tus servidores.',
        'Cualquiera que tenga la URL puede usarla hasta que venza.',
        'Quien la recibe puede cambiar la clave del objeto sin invalidar la firma, porque solo se firma el bucket.',
        'Se pueden fijar el tipo de contenido o el tamaño, firmando esos headers.',
        'El secreto del backend viaja en la URL, cifrado con la clave pública del bucket.'
      ],
      answer: [0, 1, 3],
      explain: 'La firma cubre el método, la clave, los headers firmados y el vencimiento: cambiar cualquiera la invalida. En la URL viaja el id de la clave de acceso y la firma, nunca el secreto. Como cualquiera con la URL puede usarla, se emiten con vencimientos cortos. Repasa M09, signed URLs.'
    },
    {
      id: 'bola', type: 'single',
      prompt: 'Una API recibe <code>GET /v1/invoices/{id}</code> con un JWT válido del usuario A y devuelve la factura del usuario B si alguien cambia el id. ¿Qué falla?',
      options: [
        'La verificación de la firma del JWT, que acepta tokens de otros usuarios.',
        'La autenticación del usuario.',
        'La autorización a nivel de objeto (BOLA).',
        'La configuración de CORS, que deja llamar a la API desde cualquier origen.'
      ],
      answer: 2,
      explain: 'El token dice correctamente quién es A; lo que nadie comprobó es si A puede ver ese objeto. Es la vulnerabilidad más común en APIs. Repasa M10, aislamiento multi-tenant.'
    },
    {
      id: 'burn', type: 'single',
      prompt: 'SLO de 99.9&#8239;% en 30 días. Durante las últimas 6 horas, y todavía ahora, falla el 0.7&#8239;% de las requests; antes todo estaba bien. ¿Qué regla de burn rate se dispara?',
      options: [
        'La de 1 hora (14.4×), porque el problema sigue ahora.',
        'La de 6 horas (6×): el burn rate es 7×.',
        'Ninguna: 0.7&#8239;% de errores está por debajo del 1&#8239;%.',
        'Las tres, porque la de 3 días también ve el 7×.'
      ],
      answer: 1,
      explain: '0.7&#8239;% ÷ 0.1&#8239;% = 7×: supera 6× pero no 14.4×. En la ventana de 3 días, el promedio es 7 × 6 ÷ 72 ≈ 0.6×, por debajo de 1×. Repasa M11, burn rate.'
    },
    {
      id: 'incidente', type: 'order',
      prompt: 'Salta una alerta de burn rate diez minutos después de un deploy. Ordena lo que debería hacer la guardia:',
      items: [
        'Confirmar el impacto en el dashboard del SLO',
        'Revertir el deploy',
        'Comprobar que el burn rate vuelve a la normalidad',
        'Investigar la causa con traces y logs',
        'Escribir el postmortem sin culpas, con acciones y responsables'
      ],
      explain: 'Primero mitigar, después entender: revertir es rápido y casi siempre seguro, y la investigación se hace con el sistema estable y sin presión. Repasa M11, incidentes y postmortems.'
    }
  ]
});
