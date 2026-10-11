SD.defineQuiz('m36', {
  title: 'Quiz: criptografía desde cero', pass: 0.7,
  questions: [
    {
      id: 'objetivos', type: 'single',
      prompt: 'Un webhook se firma con HMAC y funciona. ¿Qué objetivo <b>no</b> consigues con HMAC que sí daría una firma digital?',
      options: [
        'El no repudio, que una firma da y un MAC con clave compartida no',
        'La confidencialidad del cuerpo del webhook',
        'La integridad del mensaje, ya que HMAC por sí mismo no alcanza a notar que alguien cambió un byte',
        'La disponibilidad del servicio receptor, que la firma mantendría aunque la red del laboratorio falle'
      ],
      answer: 0,
      explain: 'HMAC da integridad y autenticidad entre quienes comparten la clave, pero ambos pueden producir la misma etiqueta, así que no hay no repudio. HMAC no cifra el cuerpo, pero sí detecta cambios; la disponibilidad es otra cosa. Repaso en 36.3 y 36.6.'
    },
    {
      id: 'passwords', type: 'single',
      prompt: '¿Por qué guardar contraseñas con SHA-256, aunque sea con sal, es un error?',
      options: [
        'Es un hash rápido y se prueba en masa fuera de línea',
        'Porque SHA-256 dejó de considerarse seguro',
        'Porque SHA-256 es reversible y, conociendo la sal, se recupera la contraseña original del usuario',
        'Porque SHA-256 no admite ninguna sal y por eso deja todos los hashes repetidos a la vista de todos'
      ],
      answer: 0,
      explain: 'La sal arregla los hashes repetidos, pero no la velocidad. SHA-256 sigue siendo seguro como hash, pero es rápido a propósito, y eso ayuda al ataque fuera de línea. Se usa un KDF lento y con memoria como Argon2id. SHA-256 no es reversible. Ver 36.9.'
    },
    {
      id: 'aead', type: 'multi',
      prompt: 'Ciframos un campo con AES-GCM (un modo AEAD). ¿Qué propiedades obtenemos en esa sola operación?',
      options: [
        'Confidencialidad del contenido cifrado',
        'Integridad y autenticidad por el tag que se verifica',
        'No repudio demostrable ante un tercero sin la clave',
        'Compresión del dato para ocupar menos espacio'
      ],
      answer: [0, 1],
      explain: 'AEAD junta cifrado y MAC: confidencialidad más integridad y autenticidad. No da no repudio (la clave es simétrica) ni comprime. Ver 36.4.'
    },
    {
      id: 'nonce', type: 'single',
      prompt: 'En AES-GCM, ¿qué regla sobre el nonce es innegociable y por qué?',
      options: [
        'Que nunca se repita dos veces con la misma clave de cifrado',
        'Que se mantenga siempre en secreto',
        'Que mida 256 bits para que coincida exactamente con el tamaño de la clave de AES elegida',
        'Que sea impredecible, porque a partir de él se deriva la clave con la que luego se cifra'
      ],
      answer: 0,
      explain: 'El nonce puede viajar en claro y no hace falta que sea impredecible; lo que no puede es repetirse con la misma clave. Repetirlo rompe la confidencialidad de esos mensajes y debilita el tag. Con AES-GCM mide 96 bits. Ver 36.4.'
    },
    {
      id: 'fs', type: 'single',
      prompt: '¿Qué ataque evita la forward secrecy que da el intercambio de claves efímero (ECDHE)?',
      options: [
        'Grabar hoy el tráfico y descifrarlo tras robar la clave después',
        'Que alguien suplante al servidor más adelante',
        'Que un intermediario se cuele en medio del intercambio haciéndose pasar por cada uno de los lados',
        'Que el servidor acabe reutilizando un mismo certificado para varios dominios distintos a la vez'
      ],
      answer: 0,
      explain: 'Con claves efímeras que se borran al cerrar, robar la clave del servidor más tarde no abre el tráfico grabado antes. El intermediario se frena con firmas, no con forward secrecy. Ver 36.7.'
    },
    {
      id: 'login', type: 'order',
      prompt: 'Ordena lo que hace el servidor al verificar un login contra un hash de Argon2id guardado.',
      items: [
        'Leer del hash guardado el algoritmo, los parámetros y la sal',
        'Recalcular el hash con esos parámetros y la contraseña recibida',
        'Comparar en tiempo constante el resultado con el hash guardado',
        'Si los parámetros quedaron cortos, recalcular y volver a guardar'
      ],
      explain: 'El propio texto almacenado trae algoritmo, parámetros y sal, así que no hace falta guardarlos aparte. Se recalcula, se compara en tiempo constante y, si el costo subió desde entonces, se rehace el hash en ese login. Ver 36.9.'
    },
    {
      id: 'compare', type: 'single',
      prompt: '¿Por qué se compara una etiqueta HMAC con una función de tiempo constante y no con <span class="mono">==</span>?',
      options: [
        'La comparación normal corta en el primer byte distinto y el tiempo lo delata',
        'Porque <span class="mono">==</span> no acepta cadenas hexadecimales',
        'Porque <span class="mono">==</span> convierte antes las dos cadenas a número y en esa conversión termina perdiendo precisión',
        'Porque la función de tiempo constante, además de comparar, vuelve a cifrar la etiqueta recibida del emisor'
      ],
      answer: 0,
      explain: 'Una comparación que corta en el primer byte distinto tarda distinto según cuántos bytes acertó, y eso se mide. hmac.compare_digest tarda lo mismo pase lo que pase. No cifra nada. Ver 36.3.'
    },
    {
      id: 'cadena', type: 'single',
      prompt: 'Tu navegador confía en el certificado de un sitio. ¿En qué se apoya esa confianza?',
      options: [
        'En una cadena de firmas que sube hasta una CA raíz de confianza',
        'En que el certificado viajó cifrado',
        'En que el dominio del certificado aparece bien posicionado entre los resultados de una búsqueda',
        'En que el certificado incluye también la clave privada del sitio para poder comprobarla al vuelo'
      ],
      answer: 0,
      explain: 'La hoja la firma una intermedia, y la intermedia una raíz que vive en el almacén del sistema: la confianza sube firma por firma. La clave privada nunca viaja. Ver 36.8.'
    },
    {
      id: 'random', type: 'single',
      prompt: 'Necesitas generar un token de sesión. ¿Qué generador usas y por qué?',
      options: [
        'El CSPRNG del sistema, porque el común es predecible',
        'La hora actual en microsegundos',
        'El generador común del lenguaje, que es más veloz y para un simple token rinde de sobra',
        'Un contador que aumenta de uno en uno, de modo que cada token emitido resulte siempre único'
      ],
      answer: 0,
      explain: 'El generador común (random, Math.random) está hecho para repetir la secuencia con la misma semilla: es predecible. Para secretos se usa el CSPRNG del sistema (secrets, os.urandom). La hora y un contador son adivinables. Ver 36.10.'
    }
  ]
});
