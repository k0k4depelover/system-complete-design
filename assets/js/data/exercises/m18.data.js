/* Ejercicios guiados del M18 (cuotas por tokens). Formato en core/exercise.js. */

SD.defineExercise('m18-limitador', {
  title: 'un límite global para 30 gateways en tres regiones',
  scenario: '<p>Una API de LLM atiende con 30 gateways, 10 en cada una de tres regiones, cada región con su propio Redis (un primario y una réplica asíncrona). Entre regiones hay unos 70 ms de ida y vuelta. Un cliente empresarial tiene un límite global de 2&#8239;000&#8239;000 tokens por minuto, y el 70&#8239;% de su tráfico llega a una sola región.</p><p>Hay que respetar el límite con un exceso pequeño y acotado, sin sumarle 70 ms a cada request y sin dejar al cliente sin servicio si se cae el Redis de una región.</p>',
  steps: [
    {
      id: 'central', type: 'single',
      prompt: 'Primera idea: un único contador global, linealizable, en el Redis de una región. ¿Qué cuesta?',
      options: [
        'Nada: Redis responde en menos de un milisegundo.',
        'Cada request de las otras dos regiones paga una ida y vuelta de 70 ms, y si la región del contador queda aislada, las otras tienen que elegir entre rechazar todo o admitir todo.',
        'Solo memoria en Redis.',
        'Que el contador se vuelve eventual.'
      ],
      answer: 1,
      explain: 'Es PACELC todos los días (la latencia de coordinar entre regiones en cada request) y CAP durante un corte (dejar pasar o rechazar sin saber el saldo). Un contador global sirve dentro de una región, no entre continentes. Repasa 18.8 y M06.'
    },
    {
      id: 'caido', type: 'single',
      prompt: 'Un gateway pierde contacto con el Redis de su región. ¿Qué política aplica mientras tanto?',
      options: [
        'Rechazar todo hasta que vuelva Redis: el límite es sagrado.',
        'Admitir todo hasta que vuelva Redis: el cliente paga.',
        'Un límite local conservador: admitir como mucho el límite dividido por los 30 gateways, unos 66&#8239;700 tokens por minuto por gateway.',
        'Encolar las requests hasta que vuelva Redis.'
      ],
      answer: 2,
      explain: 'Rechazar deja sin servicio a un cliente que paga por un problema interno; admitir todo abre la puerta a un abuso sin límite. Con un reparto fijo del límite, el total nunca lo supera, aunque el tráfico desparejo reciba menos de lo que paga mientras dure el corte. Es escrow estático.'
    },
    {
      id: 'regiones', type: 'single',
      prompt: '¿Cómo se reparte el límite global entre las tres regiones sin coordinar en cada request?',
      options: [
        'Un tercio fijo del límite para cada región.',
        'Contadores por región que se sincronizan cada 2 segundos y se combinan como un CRDT.',
        'Escrow entre regiones: cada región recibe una parte del límite proporcional a su demanda reciente, un coordinador la rebalancea cada pocos segundos y, dentro de cada región, el contador fuerte vive en su Redis.',
        'Consenso entre las tres regiones en cada request.'
      ],
      answer: 2,
      explain: 'Un tercio fijo frena a la región que recibe el 70&#8239;% del tráfico. Los contadores CRDT convergen, pero cuentan lo que ya pasó: en una ráfaga dejan pasar hasta la tasa de llegada por el intervalo de sincronización. El escrow con rebalanceo no deja pasar de más, y su costo es la cuota que queda prestada a una región que no la usa. Es el árbol de Doorman de YouTube.'
    },
    {
      id: 'failover', type: 'single',
      prompt: 'El primario de Redis de la región grande muere, y su réplica asíncrona toma el lugar con 0.3 s de retraso. El cliente consume unos 23&#8239;000 tokens por segundo en esa región. ¿Qué le pasa a su saldo?',
      options: [
        'Nada: Redis confirma en disco antes de responder.',
        'Retrocede: los descuentos de los últimos 0.3 s se pierden y el cliente puede volver a gastarlos, unos 7&#8239;000 tokens. Para un limitador es aceptable, porque la factura sale del metering y no del limitador.',
        'Se bloquea la cuenta del cliente hasta revisarla.',
        'Nada: con WAIT, Redis se vuelve fuertemente consistente.'
      ],
      answer: 1,
      explain: 'La replicación de Redis es asíncrona: una escritura confirmada puede perderse en un failover, y WAIT achica la ventana sin volverla fuertemente consistente, como aclara su documentación. El exceso queda acotado por la tasa por el retraso: 23&#8239;000 × 0.3 ≈ 7&#8239;000 tokens. Lo exacto es el metering (M21).'
    },
    {
      id: 'reconciliar', type: 'single',
      prompt: 'Al terminar una request, el gateway devuelve los tokens reservados que no se usaron. No recibe respuesta y reintenta. ¿Cómo evitas devolverlos dos veces?',
      options: [
        'Con un lock distribuido alrededor de la reconciliación.',
        'Con entrega exactamente una vez de la red.',
        'El script de Lua borra la reserva en la misma operación atómica en la que devuelve la diferencia: un reintento no la encuentra y no hace nada.',
        'No reintentando nunca.'
      ],
      answer: 2,
      explain: 'Es exactamente una vez como efecto, sobre una entrega de al menos una vez, igual que una idempotency key. Y si la reconciliación se pierde del todo, la reserva vence sola: el cliente pierde cuota un rato, pero la flota nunca pasa de más. Repasa 18.3 y 18.8.'
    },
    {
      id: 'reloj', type: 'single',
      prompt: 'Cada gateway calcula la recarga del balde con su propio reloj y escribe el resultado. Uno va 2 segundos adelantado. ¿Qué pasa y cómo se evita?',
      options: [
        'Nada: NTP lo corrige antes de que importe.',
        'Le regala al cliente 2 segundos de recarga, y uno atrasado calcula tiempo negativo. Se evita con un solo reloj por clave: el de Redis, leído con TIME dentro del script.',
        'Se evita con relojes vectoriales en los gateways.',
        'Se evita usando la hora del cliente.'
      ],
      answer: 1,
      explain: 'Redis replica los efectos del script, no el script, así que la réplica no vuelve a leer su propio reloj. En el gateway, las duraciones se miden con un reloj monotónico. Los relojes vectoriales ordenan eventos causalmente, pero no miden tiempo transcurrido. Repasa 18.8 y M06.'
    }
  ],
  solution: '<ul><li><b>Dentro de cada región:</b> un contador fuerte en Redis, con reservar, consumir y reconciliar en scripts de Lua y los baldes de la organización bajo un mismo hash tag.</li><li><b>Entre regiones:</b> escrow. Cada región recibe una parte del límite global proporcional a su demanda reciente (la región grande, cerca del 70&#8239;%), y un coordinador la rebalancea cada pocos segundos. Ninguna request espera 70 ms.</li><li><b>Si Redis no responde:</b> límite local conservador, el límite dividido por la cantidad de gateways. Ni rechazar todo ni admitir todo.</li><li><b>Failover:</b> se acepta un retroceso acotado del saldo, la tasa por el retraso de la replicación (unos 7&#8239;000 tokens acá). La factura sale del metering.</li><li><b>Reconciliación:</b> idempotente, borrando la reserva en la misma operación; y reservas con vencimiento, para que una reconciliación perdida favorezca a la flota.</li><li><b>Tiempo:</b> un solo reloj por clave, el de Redis con TIME, y relojes monotónicos en los gateways.</li></ul>'
});
