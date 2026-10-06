SD.defineQuiz('m30', {
  title: 'Quiz: Twitter/X',
  pass: 0.7,
  questions: [
    {
      id: 'asimetria', type: 'single',
      prompt: 'Con 300&#8239;000 lecturas de timeline por segundo y 6&#8239;000 escrituras, ¿por qué conviene precalcular la timeline?',
      options: [
        'Porque mueve el costo de armarla a la operación que ocurre 50 veces menos.',
        'Porque las escrituras son más baratas que las lecturas en Redis.',
        'Porque así no hace falta guardar los tweets fuera de las timelines.',
        'Porque reparte el costo por igual entre lecturas y escrituras.'
      ],
      answer: 0,
      explain: 'Armar la timeline al leer se paga en cada una de las 300&#8239;000 lecturas; precalcularla se paga en cada escritura. Repasa 30.1.'
    },
    {
      id: 'planos', type: 'single',
      prompt: 'En la arquitectura de X, ¿qué papel cumple Kafka entre el plano de escritura y lo derivado?',
      options: [
        'Cada escritura entra una vez al log y cada vista derivada lo consume a su ritmo.',
        'Es la base de datos donde se guardan los posts para siempre.',
        'Reparte las requests de lectura entre los servidores de Home Mixer según su carga.',
        'Coordina una transacción entre Manhattan y cada vista para que se actualicen juntas.'
      ],
      answer: 0,
      explain: 'La verdad se guarda una vez, en Manhattan; Kafka lleva el evento a todo lo que depende de él. Cada consumidor puede atrasarse segundos sin perder nada. Repasa las cinco ideas de 30.2 y la figura 30.1.'
    },
    {
      id: 'derivado', type: 'multi',
      prompt: '¿Cuáles de estas piezas son vistas derivadas del log, que se pueden reconstruir si pierden su estado? Marca todo lo que corresponde.',
      options: [
        'Thunder, con los posts recientes por autor.',
        'Earlybird, el índice de búsqueda.',
        'Los contadores de tendencias.',
        'Manhattan, donde se guarda cada post de forma durable.',
        'TFE, el borde, con sus sesiones.'
      ],
      answer: [0, 1, 2],
      explain: 'Manhattan es la fuente de verdad, no una vista; TFE no guarda estado del producto. Lo derivado vive en memoria justamente porque se puede volver a llenar desde el log. Repasa 30.2.'
    },
    {
      id: 'thunder', type: 'single',
      prompt: 'En Para ti, un post de una cuenta con 30 millones de seguidores cuesta lo mismo que uno de una cuenta con 200. ¿Por qué?',
      options: [
        'Porque Thunder guarda los posts por autor y no hay una copia por seguidor.',
        'Porque las cuentas famosas tienen servidores dedicados.',
        'Porque el fan-out de las cuentas famosas corre con más prioridad y en paralelo.',
        'Porque Para ti solo muestra posts de fuera de tu red, que no pasan por el fan-out.'
      ],
      answer: 0,
      explain: 'Leer 400 listas por autor en cada request es barato porque Thunder vive en memoria y cada entrada pesa 16 bytes. El problema de las cuentas famosas sigue existiendo en el fan-out clásico de Siguiendo. Repasa el trade-off de 30.2 y 30.8.'
    },
    {
      id: 'etapas', type: 'order',
      prompt: 'Ordena las etapas con que Home Mixer arma Para ti.',
      items: [
        'Hidratar la consulta: acciones recientes y a quién sigues',
        'Buscar candidatos en Thunder y en Phoenix retrieval',
        'Hidratar los candidatos en Tweetypie',
        'Filtrar duplicados, posts viejos, vistos y bloqueados',
        'Puntuar con Phoenix',
        'Elegir los mejores y aplicar visibilidad y anuncios'
      ],
      explain: 'Primero el contexto, después los candidatos y su contenido; los filtros van antes de puntuar para no gastar GPU en lo que no se puede mostrar. Repasa el viaje de una request en 30.2 y la figura 30.2.'
    },
    {
      id: 'filtros-antes', type: 'single',
      prompt: 'Home Mixer corre catorce filtros antes de puntuar y solo tres después. ¿Por qué?',
      options: [
        'Porque puntuar en GPU es la etapa más cara y cada candidato filtrado antes la ahorra.',
        'Porque los filtros de después son más lentos y conviene correrlos sobre menos posts.',
        'Porque Phoenix no acepta más de 100 candidatos por request.',
        'Porque los filtros de visibilidad dependen del puntaje que asigna Phoenix.'
      ],
      answer: 0,
      explain: 'En el presupuesto de referencia, Phoenix se lleva 92 de los 175&#8239;ms del servidor. Los tres filtros finales corren solo sobre los elegidos. Repasa la tabla del viaje en 30.2.'
    },
    {
      id: 'paralelo', type: 'single',
      prompt: 'Los 28 hidratadores de la consulta corren en paralelo. 27 tardan 1&#8239;ms y uno nuevo tarda 30&#8239;ms. ¿Cuánto dura la etapa?',
      options: ['1&#8239;ms', '28&#8239;ms', '30&#8239;ms', '57&#8239;ms'],
      fixed: true,
      answer: 2,
      explain: 'Una etapa en paralelo dura lo que su miembro más lento: el hidratador nuevo atrasa toda la timeline. Repasa las lecturas de la tabla en 30.2.'
    },
    {
      id: 'snowflake-bits', type: 'single',
      prompt: '¿Cómo se reparten los 64 bits de un id Snowflake?',
      options: [
        '1 de signo, 41 de milisegundos, 10 de nodo y 12 de secuencia.',
        '32 de segundos desde la época Unix y 32 aleatorios para evitar choques.',
        '48 de milisegundos y 16 de secuencia, sin bits de nodo porque hay un solo generador.',
        '1 de signo, 31 de segundos, 16 de nodo y 16 de secuencia.'
      ],
      answer: 0,
      explain: 'El tiempo en los bits altos hace que ordenar por id sea ordenar por tiempo. Con 12 bits de secuencia, cada worker genera 4&#8239;096 ids por milisegundo. Repasa 30.4 y la figura 30.3.'
    },
    {
      id: 'reloj', type: 'single',
      prompt: 'NTP atrasa el reloj de un generador Snowflake 3&#8239;ms. ¿Qué debe hacer?',
      options: [
        'Seguir generando: los ids igual son únicos porque la secuencia sigue subiendo.',
        'Esperar a que el reloj supere el último milisegundo usado.',
        'Reiniciar la secuencia en cero y seguir con la hora nueva.',
        'Cambiar de worker id, así los ids nuevos no chocan con los viejos.'
      ],
      answer: 1,
      explain: 'Con el reloj atrasado podría volver a un milisegundo ya usado con la misma secuencia y repetir un id. Repasa "Cuando el reloj miente", en 30.4.'
    },
    {
      id: 'grafo', type: 'single',
      prompt: '¿Por qué el grafo social se guarda en las dos direcciones?',
      options: [
        'Por redundancia: si se pierde una dirección, se reconstruye desde la otra.',
        'Para que seguidores y seguidos se lean cada uno desde una sola partición.',
        'Porque MySQL no permite índices secundarios en tablas particionadas por hash.',
        'Para contar seguidores más rápido sin un COUNT sobre toda la tabla.'
      ],
      answer: 1,
      explain: 'Particionar por un lado deja la otra consulta repartida por todas las particiones. FlockDB guardaba cada arista en las dos direcciones. Repasa 30.5.'
    },
    {
      id: 'push-pull', type: 'single',
      prompt: '¿Qué cuesta cada operación con fan-out en escritura?',
      options: [
        'Publicar: una copia por seguidor; leer la timeline: una lectura.',
        'Publicar: una escritura; leer: una lectura por cuenta seguida.',
        'Publicar y leer: una operación cada una, porque la timeline es una lista compartida.',
        'Publicar: una copia por cuenta seguida; leer: ninguna.'
      ],
      answer: 0,
      explain: 'El fan-out en lectura es lo opuesto: una escritura al publicar y una lectura por cuenta seguida al leer. Repasa 30.6.'
    },
    {
      id: 'solo-ids', type: 'single',
      prompt: '¿Por qué la timeline en Redis guarda ids y no el texto de los tweets?',
      options: [
        'Porque Redis solo admite enteros como miembros de un sorted set.',
        'Porque un tweet está en millones de timelines y el texto multiplicaría la memoria.',
        'Porque los ids se comprimen mejor que el texto y la red de Redis es el cuello.',
        'Porque el texto se cifra y Redis no puede guardar datos cifrados en listas.'
      ],
      answer: 1,
      explain: 'La timeline guarda unos 20 bytes por entrada y el contenido se hidrata desde un caché de tweets. Repasa "La timeline en Redis", en 30.6.'
    },
    {
      id: 'memoria', type: 'single',
      prompt: 'Con 800 entradas de 20 bytes por usuario, 300 millones de usuarios activos y tres réplicas, ¿cuánta RAM ocupan las timelines?',
      options: ['480&#8239;GB', '4.8&#8239;TB', '14.4&#8239;TB', '144&#8239;TB'],
      fixed: true,
      answer: 2,
      explain: '800 × 20 bytes = 16&#8239;KB por usuario; × 300 millones = 4.8&#8239;TB; × 3 réplicas = 14.4&#8239;TB. Repasa 30.6.'
    },
    {
      id: 'cola', type: 'single',
      prompt: '¿Por qué el fan-out en escritura va por una cola con prioridad?',
      options: [
        'Para que un tweet de una cuenta chica no espere detrás del de una cuenta enorme.',
        'Para garantizar orden total entre todos los tweets de todas las cuentas.',
        'Porque Redis no acepta escrituras directas desde los servicios de fan-out.',
        'Para que las cuentas grandes pasen primero y sus tweets lleguen antes a más gente.'
      ],
      answer: 0,
      explain: 'Las copias son trabajo asíncrono de tamaño muy desigual: sin prioridad, las grandes tapan a las chicas. Repasa "La cola del fan-out", en 30.7.'
    },
    {
      id: 'famosos', type: 'single',
      prompt: 'Una cuenta con 31 millones de seguidores publica. Con fan-out en escritura y 5 minutos para completarlo, ¿cuántas escrituras por segundo genera ese tweet?',
      options: ['Unas 1&#8239;000', 'Unas 10&#8239;000', 'Más de 100&#8239;000', 'Unas 31 millones'],
      fixed: true,
      answer: 2,
      explain: '31 millones / 300&#8239;s ≈ 103&#8239;000 escrituras por segundo para un solo tweet. Por eso esas cuentas no hacen fan-out. Repasa 30.8.'
    },
    {
      id: 'hibrido', type: 'single',
      prompt: '¿Cómo funciona el timeline híbrido?',
      options: [
        'Las cuentas comunes hacen fan-out en escritura; las enormes se mezclan al leer.',
        'Todos hacen fan-out en lectura, salvo los usuarios que más leen, que reciben copias.',
        'Los tweets se copian a la mitad de los seguidores y la otra mitad los lee al cargar.',
        'Las cuentas famosas hacen fan-out en escritura con prioridad y las comunes al leer.'
      ],
      answer: 0,
      explain: 'Cada usuario sigue a pocas cuentas famosas, y las listas de esas cuentas son las más cacheadas. Repasa 30.8.'
    },
    {
      id: 'for-you', type: 'single',
      prompt: 'El pipeline de Para ti corría unas 5&#8239;000 millones de veces por día con 1&#8239;500 candidatos por request (2023). ¿Cuántos puntajes por segundo calcula en promedio?',
      options: ['Unos 870&#8239;000', 'Unos 8.7 millones', 'Unos 87 millones', 'Unos 870 millones'],
      fixed: true,
      answer: 2,
      explain: '5&#8239;000 millones / 86&#8239;400 ≈ 57&#8239;870 requests por segundo; × 1&#8239;500 ≈ 87 millones. Repasa 30.10.'
    },
    {
      id: 'contadores', type: 'multi',
      prompt: 'Un tweet recibe 50&#8239;000 likes por segundo. ¿Qué técnicas sirven para su contador? Marca todo lo que corresponde.',
      options: [
        'Guardar cada like como fila (user_id, tweet_id) y derivar el número.',
        'Acumular incrementos en memoria y volcar uno por segundo.',
        'Partir el contador en subcontadores y sumarlos al leer.',
        'Un UPDATE likes = likes + 1 por cada like sobre la misma fila, dentro de una transacción.',
        'Bloquear la fila con SELECT FOR UPDATE antes de cada incremento para no perder ninguno.'
      ],
      answer: [0, 1, 2],
      explain: 'Las dos últimas serializan todas las escrituras sobre una sola fila: es la clave caliente del M04. Repasa 30.11.'
    },
    {
      id: 'sketch', type: 'single',
      prompt: 'Un count-min sketch con ε = 0.001 y δ = 0.01 en una ventana de 10 millones de menciones. ¿Qué garantiza?',
      options: [
        'Conteos exactos con una memoria fija, sin importar cuántas frases haya.',
        'Que cada conteo se pase como mucho en 10&#8239;000, con 99&#8239;% de probabilidad.',
        'Que cada conteo pueda quedar corto o largo en hasta 10&#8239;000, con 99&#8239;% de probabilidad.',
        'Que use memoria proporcional a la cantidad de frases distintas de la ventana.'
      ],
      answer: 1,
      explain: 'El error es ε × N = 0.001 × 10 millones = 10&#8239;000, siempre hacia arriba, con 2&#8239;719 × 5 contadores fijos. Una tendencia, además, mide cuánto supera la ventana actual a la línea base de la frase, no el volumen. Repasa 30.12.'
    },
    {
      id: 'busqueda', type: 'multi',
      prompt: '¿Qué hace que un tweet sea buscable en segundos? Marca todo lo que corresponde.',
      options: [
        'Un índice invertido en memoria para lo reciente.',
        'Listas de ids ordenadas, que se recorren desde lo más nuevo.',
        'Un solo escritor por índice y lectores sin locks.',
        'Reconstruir todo el índice cada 10 segundos.',
        'Buscar con LIKE sobre la tabla de tweets particionada por fecha.'
      ],
      answer: [0, 1, 2],
      explain: 'Earlybird indexa en memoria, particiona por tiempo y aprovecha que los ids Snowflake ya están ordenados. Repasa 30.13.'
    }
  ]
});
