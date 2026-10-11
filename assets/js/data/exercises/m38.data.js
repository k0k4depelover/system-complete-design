SD.defineExercise('m38-ad', {
  title: 'auditar un dominio y cerrar sus rutas a tier 0',
  scenario: '<p>Heredas el dominio <code>corp.example.com</code>: 1 bosque, 2 controladores de dominio, unos 900 equipos. Corres una auditoría de solo lectura (sin tocar nada) y anotas los hallazgos. Vas a priorizarlos y a elegir el control de cada uno, siempre desde la defensa. Trabaja con los números que da cada paso.</p>',
  steps: [
    {
      id: 'ha1',
      type: 'single',
      prompt: 'Primer hallazgo: la cuenta <code>DA_soporte</code>, miembro de Domain Admins, aparece en el evento 4624 iniciando sesión en 37 estaciones de help desk la última semana. ¿Cuál es el riesgo principal?',
      options: [
        'Ninguno grave: es normal que el equipo de soporte use una cuenta con privilegios para arreglar estaciones',
        'Su credencial queda en memoria en 37 máquinas poco protegidas, lista para ser robada y usada contra el DC',
        'El problema es solo de licencias, porque una misma cuenta no debería iniciar sesión en tantos equipos'
      ],
      answer: 1,
      explain: 'Una credencial de tier 0 en una estación de tier 2 es exactamente el eslabón que vuelve posible la ruta de la figura 38.3. El control es el tiering: cuentas de administración separadas y PAW para lo privilegiado. Ver 38.4.'
    },
    {
      id: 'ha2',
      type: 'single',
      prompt: 'Segundo hallazgo: 6 cuentas de servicio tienen SPN, contraseña sin cambiar desde 2019 y los tickets salen en RC4 (<code>0x17</code>). ¿Qué atacan y qué pones?',
      options: [
        'AS-REP roasting; se corta reactivando la preautenticación de Kerberos en esas seis cuentas',
        'Relay de NTLM; se corta exigiendo firma SMB en todos los servidores del dominio',
        'Kerberoasting; se corta migrando a gMSA y forzando AES, que quita la contraseña débil y la señal'
      ],
      answer: 2,
      explain: 'SPN + contraseña vieja + RC4 es el escenario de libro del Kerberoasting: el ticket se adivina fuera de línea. gMSA deja la contraseña en manos de AD y AES elimina el RC4. Ver 38.3 y 38.5.'
    },
    {
      id: 'ha3',
      type: 'multi',
      prompt: 'Tercer hallazgo: el servidor de <b>Entra Connect</b> está en la misma OU que los servidores de aplicaciones, lo administran las mismas cuentas de tier 1 y no tiene MFA para el acceso remoto. ¿Qué corriges? (varias)',
      options: [
        'Reclasificarlo como tier 0 y administrarlo solo desde cuentas y estaciones de ese nivel',
        'Exigir MFA para todo acceso remoto y para cualquier tarea privilegiada sobre ese servidor',
        'Moverlo a la OU de estaciones de trabajo para que reciba las mismas GPO que los equipos de usuario',
        'Tratarlo con el mismo celo que un controlador de dominio, porque une la nube con el dominio local'
      ],
      answer: [0, 1, 3],
      explain: 'Entra Connect tiene credenciales potentes a ambos lados: es tier 0. Se aísla, se le exige MFA y se cuida como un DC. Bajarlo a la OU de estaciones haría lo contrario: lo expondría más. Ver 38.7.'
    },
    {
      id: 'ha4',
      type: 'single',
      prompt: 'Cuarto hallazgo: el evento 4662 con los GUID de replicación aparece generado desde <code>PC-114</code>, una estación de trabajo normal. ¿Qué haces primero?',
      options: [
        'Lo ignoras: es tráfico de replicación de rutina entre máquinas del dominio',
        'Lo tratas como un posible DCSync y revisas qué cuenta pidió la replicación y con qué permisos',
        'Reinicias PC-114 para que deje de replicar y así cortar el tráfico que estaría saturando a los controladores'
      ],
      answer: 1,
      explain: 'Solo un DC debería pedir replicación. Ese evento desde una estación es la firma de DCSync. Lo primero es identificar la cuenta y sus permisos de replicación, no reiniciar a ciegas. Ver 38.3 y 38.6.'
    },
    {
      id: 'ha5',
      type: 'order',
      prompt: 'Confirmas un compromiso del dominio. Ordena la respuesta, del primer paso al último:',
      items: [
        'Aislar lo comprometido y contener, apoyándote en el runbook preparado de antemano',
        'Rotar la clave de krbtgt dos veces, esperando la replicación entre una rotación y la otra',
        'Reconstruir desde backups de estado del sistema fuera de línea y revisar GPO y tareas en busca de persistencia',
        'Escribir el postmortem sin culpables y convertir lo aprendido en controles nuevos'
      ],
      explain: 'Contener primero, luego invalidar los tickets (krbtgt dos veces), reconstruir desde copias que el atacante no pudo tocar y cerrar con el postmortem. Ver 38.8 y M11.'
    }
  ],
  solution: '<ul>' +
    '<li><b>DA_soporte en 37 estaciones:</b> el hallazgo más grave. Separa cuentas de administración de las de uso diario e impón tiering con PAW. Ninguna cuenta de tier 0 baja a tier 2.</li>' +
    '<li><b>6 cuentas de servicio en RC4:</b> Kerberoasting. Migra a gMSA y fuerza AES; de paso desaparece la señal RC4 que vigilas en el 4769.</li>' +
    '<li><b>Entra Connect mal ubicado:</b> es tier 0. Aíslalo, exígele MFA y adminístralo como un DC.</li>' +
    '<li><b>4662 desde una estación:</b> posible DCSync. Identifica la cuenta y audita quién tiene permisos de replicación.</li>' +
    '<li><b>Respuesta al compromiso:</b> contener, rotar krbtgt dos veces, reconstruir desde backups fuera de línea, postmortem sin culpables.</li>' +
    '</ul>'
});
