SD.defineQuiz('m37', {
  title: 'Quiz: arquitecturas seguras en la nube', pass: 0.7,
  questions: [
    {
      id: 'resp', type: 'single',
      prompt: 'En el modelo de responsabilidad compartida, ¿qué parte te toca a ti?',
      options: [
        'El hardware, el hipervisor y la red física de los centros de datos',
        'La configuración, los permisos de IAM, los datos y el código que subes',
        'Los parches del firmware de los discos y el enfriamiento del datacenter',
        'La seguridad física de los edificios y el control de acceso al personal'
      ],
      answer: 1,
      explain: 'El proveedor asegura la seguridad "de" la nube (hardware, hipervisor, instalaciones); tú aseguras lo que pones "en" ella: configuración, IAM, datos y código. Casi todas las brechas son configuraciones propias. Ver 37.1.'
    },
    {
      id: 'wildcard', type: 'single',
      prompt: 'Una política de IAM tiene <code>"Action": "*"</code> y <code>"Resource": "*"</code>. ¿Cuál es el problema?',
      options: [
        'Ninguno: el comodín es la forma recomendada de simplificar las políticas',
        'Que es más lenta de evaluar porque el motor debe expandir cada comodín',
        'Que una credencial filtrada puede hacer cualquier cosa sobre cualquier recurso',
        'Que no funciona si no se le añade antes una condición explícita que acote el comodín a una única región válida'
      ],
      answer: 2,
      explain: 'El comodín concede todo. Si esa credencial se filtra, el atacante hereda acceso total. El mínimo privilegio da solo las acciones y los recursos que la tarea exige. Ver 37.2.'
    },
    {
      id: 'deny', type: 'single',
      prompt: 'En IAM, un rol tiene un Allow amplio y, aparte, un Deny explícito sobre borrar objetos. ¿Qué pasa al intentar borrar?',
      options: [
        'Se permite, porque el Allow es más amplio y abarca la acción de borrar',
        'Depende del orden en que se escribieron las dos sentencias en el JSON',
        'Se niega: en IAM un deny explícito gana siempre sobre cualquier allow',
        'Se pide una confirmación extra antes de resolver el conflicto de permisos'
      ],
      answer: 2,
      explain: 'El deny explícito siempre gana, sin importar el orden. Por eso sirve para guardarraíles duros ("nadie borra los logs") que ninguna política permisiva puede contradecir. Ver 37.2 y 37.7.'
    },
    {
      id: 'roles', type: 'single',
      prompt: '¿Por qué conviene que una máquina asuma un rol en vez de llevar una llave de acceso permanente?',
      options: [
        'Porque el rol da credenciales temporales que rotan solas, sin copiarlas a ningún lado',
        'Porque el rol es gratis y las llaves de acceso permanentes tienen un costo mensual',
        'Porque el rol cifra el disco completo de la máquina además de autenticar cada una de sus llamadas salientes',
        'Porque las llaves permanentes solo funcionan dentro de una única región de la nube'
      ],
      answer: 0,
      explain: 'Una llave permanente incrustada es una contraseña eterna esperando a filtrarse. El rol entrega credenciales temporales que rotan automáticamente y nunca se copian. Ver 37.2.'
    },
    {
      id: 'vpc', type: 'single',
      prompt: '¿Dónde va la base de datos en una VPC bien diseñada?',
      options: [
        'En la subred pública, justo al lado del balanceador de carga, para que las consultas respondan con menos latencia',
        'En la subred privada, sin IP pública, accesible solo desde dentro de la VPC',
        'Fuera de la VPC, con una IP pública protegida solo por su contraseña',
        'En cualquier subred: el grupo de seguridad ya la protege por completo'
      ],
      answer: 1,
      explain: 'La base nunca tiene IP pública: vive en la subred privada y se llega a ella solo desde dentro de la VPC. La subred pública es para el balanceador y la WAF. Ver 37.3.'
    },
    {
      id: 'mtls', type: 'single',
      prompt: '¿Por qué no basta con que una petición llegue desde una IP interna de la VPC para confiar en ella?',
      options: [
        'Porque las IP internas cambian cada pocos minutos y no se pueden memorizar',
        'Porque la IP interna solo es válida si el tráfico además viaja cifrado con TLS',
        'Porque una IP no prueba identidad: si alguien toma un pod, hereda su IP y su posición',
        'Porque el balanceador de carga reescribe la IP de origen de cada paquete y entonces ya no se puede saber quién hizo la llamada'
      ],
      answer: 2,
      explain: 'La red no autentica. Un atacante que llega a un pod hereda su IP. mTLS hace que cada servicio pruebe su identidad con un certificado (SVID de SPIFFE), no con su posición en la red. Ver 37.4.'
    },
    {
      id: 'kms', type: 'single',
      prompt: '¿Qué garantiza que el KMS guarde la clave raíz en un HSM?',
      options: [
        'Que la clave raíz se replica a todas las regiones para no perderla nunca',
        'Que la clave raíz nunca sale en claro del hardware, ni siquiera para ti',
        'Que la clave raíz se puede exportar en claro solo con permiso de un administrador',
        'Que la clave raíz se rota de forma automática cada veinticuatro horas'
      ],
      answer: 1,
      explain: 'El HSM custodia la clave de modo que nunca sale en claro. Le pides al KMS que descifre una clave de datos y te devuelve el resultado; la raíz jamás abandona el hardware. Ver 37.5.'
    },
    {
      id: 'zerotrust', type: 'single',
      prompt: '¿Cuál es la idea central de zero trust frente al modelo de perímetro?',
      options: [
        'Que el firewall tradicional del perímetro simplemente se reemplaza por una WAF de capa 7 bastante más potente',
        'Que todo el tráfico interno se bloquea y solo se permite el externo',
        'Que no hay interior de confianza: cada salto autentica y autoriza la petición',
        'Que se confía en cualquier petición que ya haya cruzado la muralla una vez'
      ],
      answer: 2,
      explain: '"Nunca confíes, siempre verifica" (NIST SP 800-207). No hay interior de confianza: cada petición se verifica salto por salto, con identidad fuerte y mínimo privilegio. Ver 37.6.'
    },
    {
      id: 'capitalone', type: 'multi',
      prompt: 'En la cadena de Capital One, ¿qué controles de este módulo habrían cortado o limitado el daño?',
      options: [
        'IMDSv2, que exige un token con PUT y un límite de saltos',
        'Un rol de mínimo privilegio, que limita qué se puede leer con esas credenciales',
        'CloudTrail, que deja el rastro para detectar el acceso anómalo',
        'Poner la base de datos en la subred pública para vigilarla mejor',
        'Desactivar la WAF para que no interfiera con el tráfico legítimo'
      ],
      answer: [0, 1, 2],
      explain: 'Defensa en profundidad: IMDSv2 corta el robo de credenciales, el mínimo privilegio limita el alcance, y CloudTrail permite detectarlo. Exponer la base o quitar la WAF agrava, no protege. Ver 37.8.'
    }
  ]
});
