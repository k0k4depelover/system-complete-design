/* Widgets de las secciones "Impleméntalo tú mismo" de los casos de estudio:
   <div data-calc="bom" data-preset="m21|m23|m24|m25|m27|m28|m29|m30">  factura mensual estimada de un clon en AWS, en tres escalas
   <div data-calc="gateways">                     cuántos gateways de conexión necesita un clon de WhatsApp
   Precios: lista on-demand aproximada de us-east-1 (septiembre de 2026). Son editables porque cambian. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;
  var HOURS = 730;                                   // horas promedio de un mes
  var UNIT = { h: 'por hora', mes: 'por mes', GB: 'por GB', M: 'por millón', u: 'por unidad' };
  var QTY = { h: 'recursos', mes: 'unidades', GB: 'GB al mes', M: 'millones al mes', u: 'al mes' };

  /* Cada fila: c componente, s servicio o instancia, u unidad de precio, p precio (número o uno por escala), q cantidad por escala.
     Con u = 'h' la cantidad es cuántos recursos corren todo el mes (instancias, balanceadores, nodos). */
  var PRESETS = {
    m21: {
      title: 'Factura mensual de tu metering',
      scales: ['MVP', 'Producción', 'Gran escala'],
      scaleNote: [
        '1 millón de requests por día: Kafka mínimo y una aplicación de Flink de 2 KPU.',
        'La flota del M19: 17 millones de requests y 22.5 millones de eventos de uso por día.',
        'Diez veces más: 225 millones de eventos por día, unos 2 600 por segundo en promedio.'
      ],
      rows: [
        { c: 'Log de eventos', s: 'MSK kafka.m7g.large, un broker', u: 'h', p: 0.204, q: [3, 3, 6] },
        { c: 'Almacenamiento de MSK', s: 'GB al mes (7 días de retención, tres réplicas)', u: 'GB', p: 0.1, q: [100, 300, 3000] },
        { c: 'Dedupe y ventanas', s: 'Managed Service for Apache Flink, KPU-hora (más una de orquestación)', u: 'h', p: 0.11, q: [3, 9, 65] },
        { c: 'Estado de Flink', s: 'almacenamiento de la aplicación, 50 GB por KPU', u: 'GB', p: 0.1, q: [100, 400, 3200] },
        { c: 'Log crudo', s: 'S3 Standard, GB al mes (un año acumulado)', u: 'GB', p: 0.023, q: [300, 5000, 50000] },
        { c: 'Agregados', s: 'ClickHouse en EC2 r7g.xlarge, r7g.2xlarge a gran escala; con réplica', u: 'h', p: [0.2142, 0.2142, 0.4284], q: [2, 2, 6] },
        { c: 'Discos de ClickHouse', s: 'EBS gp3, GB al mes', u: 'GB', p: 0.08, q: [200, 1000, 6000] },
        { c: 'Ledger, saldos y catálogo', s: 'Aurora PostgreSQL db.r7g.large', u: 'h', p: 0.276, q: [2, 2, 4] },
        { c: 'Almacenamiento de Aurora', s: 'por GB al mes', u: 'GB', p: 0.1, q: [20, 200, 2000] },
        { c: 'Operaciones de E/S de Aurora', s: 'por millón', u: 'M', p: 0.2, q: [10, 200, 2000] },
        { c: 'Saldo en caliente y topes', s: 'ElastiCache (Valkey) cache.r7g.large', u: 'h', p: 0.175, q: [0, 2, 4] },
        { c: 'Saldo, topes, facturas y conciliación', s: 'Fargate ARM, tarea de 1 vCPU y 2 GB', u: 'h', p: 0.0395, q: [3, 8, 30] },
        { c: 'Webhooks de Stripe', s: 'SQS, por millón de requests', u: 'M', p: 0.4, q: [1, 5, 50] },
        { c: 'Logs y métricas', s: 'CloudWatch Logs, GB ingerido', u: 'GB', p: 0.5, q: [10, 200, 1500] }
      ],
      foot: 'No incluye Stripe Billing, que en pago por uso cobra el 0.7 % del volumen facturado, ni las GPUs. Con 22.5 millones de eventos por día, el metering cuesta una fracción mínima de la flota que mide: la dificultad está en la exactitud, no en la infraestructura.'
    },
    m28: {
      title: 'Factura mensual de tu propia red de borde',
      scales: ['Prueba', 'Producción', 'Gran escala'],
      scaleNote: [
        'Un sitio chico: 200 requests por segundo en el pico y 5 TB de salida al mes, en 2 regiones.',
        'Un SaaS mediano: 20 000 requests por segundo en el pico y 50 TB de salida al mes, en 3 regiones.',
        'Un producto grande: 200 000 requests por segundo en el pico y 500 TB de salida al mes, en 6 regiones.'
      ],
      rows: [
        { c: 'IPs anycast', s: 'Global Accelerator (cargo fijo)', u: 'h', p: 0.025, q: [1, 1, 1] },
        { c: 'Tráfico por la red de AWS', s: 'Global Accelerator, recargo por GB (0.015 a 0.035 según las regiones)', u: 'GB', p: 0.015, q: [5000, 50000, 500000] },
        { c: 'Balanceo L4 por región', s: 'Network Load Balancer', u: 'h', p: 0.0225, q: [2, 3, 6] },
        { c: 'Capacidad de los NLB', s: 'NLCU-hora (promedio)', u: 'h', p: 0.006, q: [2, 20, 200] },
        { c: 'Proxies (TLS, WAF, reglas)', s: 'EC2 c7gn.xlarge', u: 'h', p: 0.2496, q: [2, 12, 60] },
        { c: 'Caché en disco de cada región', s: 'EC2 i4i.xlarge (NVMe local)', u: 'h', p: 0.343, q: [0, 6, 30] },
        { c: 'Nivel superior junto al origen', s: 'EC2 i4i.2xlarge', u: 'h', p: 0.686, q: [0, 2, 6] },
        { c: 'Contadores de rate limiting', s: 'ElastiCache (Valkey) cache.r7g.large', u: 'h', p: 0.175, q: [1, 3, 6] },
        { c: 'Salida a internet', s: 'EC2 a internet, promedio por tramos', u: 'GB', p: [0.09, 0.086, 0.058], q: [5000, 50000, 500000] },
        { c: 'Reglas del WAF', s: 'AWS WAF, una ACL con 20 reglas', u: 'mes', p: 25, q: [1, 3, 6] },
        { c: 'Inspección del WAF', s: 'AWS WAF, por millón de requests', u: 'M', p: 0.6, q: [100, 1500, 15000] },
        { c: 'DDoS con equipo de respuesta', s: 'Shield Advanced', u: 'mes', p: 3000, q: [0, 1, 1] },
        { c: 'Logs de acceso', s: 'Firehose a S3, por GB', u: 'GB', p: 0.029, q: [200, 3000, 30000] }
      ],
      foot: 'Shield Standard (L3 y L4) es gratis y siempre está activo; Shield Advanced agrega protección L7 con respuesta humana y crédito por los costos de un ataque. Con CloudFront en lugar de proxies propios, la salida cuesta parecido y desaparecen las instancias: para un producto real suele ser la opción correcta.'
    },
    m27: {
      title: 'Factura mensual de tu procesador de pagos',
      scales: ['MVP', 'Producción', 'Gran escala'],
      scaleNote: [
        'Menos de 1 pago por segundo: un solo clúster de base y colas SQS.',
        '50 pagos por segundo en el pico (unos 2 millones al día): ledger aparte, Kafka y HSM dedicado.',
        '500 pagos por segundo en el pico: bases particionadas por grupos de comercios (celdas).'
      ],
      rows: [
        { c: 'Entrada HTTPS', s: 'Application Load Balancer', u: 'h', p: 0.0225, q: [1, 1, 2] },
        { c: 'Capacidad del ALB', s: 'LCU-hora (promedio)', u: 'h', p: 0.008, q: [1, 10, 80] },
        { c: 'Reglas del WAF', s: 'AWS WAF, una ACL con 20 reglas', u: 'mes', p: 25, q: [1, 1, 2] },
        { c: 'API, pagos, webhooks, conciliación', s: 'Fargate ARM, tarea de 1 vCPU y 2 GB', u: 'h', p: 0.0395, q: [6, 30, 200] },
        { c: 'Pagos e idempotency keys', s: 'Aurora PostgreSQL db.r7g.xlarge', u: 'h', p: 0.552, q: [2, 2, 8] },
        { c: 'Ledger', s: 'Aurora PostgreSQL db.r7g.xlarge', u: 'h', p: 0.552, q: [0, 2, 6] },
        { c: 'Almacenamiento de Aurora', s: 'por GB al mes', u: 'GB', p: 0.1, q: [50, 2000, 20000] },
        { c: 'Operaciones de E/S de Aurora', s: 'por millón', u: 'M', p: 0.2, q: [20, 1500, 15000] },
        { c: 'Bóveda de tarjetas', s: 'CloudHSM hsm2m.medium, un HSM', u: 'h', p: 1.6, q: [0, 2, 3] },
        { c: 'Conector del adquirente', s: 'EC2 m7g.xlarge con jPOS, dos zonas', u: 'h', p: 0.1632, q: [0, 2, 4] },
        { c: 'Claves de cifrado', s: 'KMS, claves y llamadas', u: 'mes', p: 60, q: [1, 1, 3] },
        { c: 'Bus de eventos', s: 'MSK kafka.m7g.large, un broker', u: 'h', p: 0.204, q: [0, 3, 6] },
        { c: 'Colas de webhooks y reintentos', s: 'SQS, por millón de requests', u: 'M', p: 0.4, q: [5, 300, 3000] },
        { c: 'Límites de tasa', s: 'ElastiCache (Valkey) cache.r7g.large', u: 'h', p: 0.175, q: [1, 2, 6] },
        { c: 'Archivos de liquidación por SFTP', s: 'Transfer Family, un endpoint', u: 'h', p: 0.3, q: [0, 1, 1] },
        { c: 'Registro de auditoría inmutable', s: 'S3 con Object Lock, GB al mes', u: 'GB', p: 0.023, q: [100, 5000, 50000] },
        { c: 'Logs de la aplicación', s: 'CloudWatch Logs, GB ingerido', u: 'GB', p: 0.5, q: [20, 1000, 8000] },
        { c: 'Salida desde subredes privadas', s: 'NAT Gateway, uno por zona', u: 'h', p: 0.045, q: [1, 3, 3] }
      ],
      foot: 'No incluye lo que más cuesta en pagos: las comisiones de la red y del adquirente, las auditorías de PCI DSS y el equipo de guardia. El HSM dedicado es la línea más cara en producción; muchos empiezan con KMS y un proveedor de tokenización, y reducen el alcance de PCI a cambio.'
    },
    m29: {
      title: 'Factura mensual de tu clon de WhatsApp',
      scales: ['MVP', 'Producción', 'Gran escala'],
      scaleNote: [
        '100 000 usuarios activos al día: DynamoDB para los buzones y SQS para las tareas.',
        '10 millones de usuarios activos al día: 3 millones de conexiones en el pico, buzones en ScyllaDB y Kafka.',
        '100 millones de usuarios activos al día: todo lo anterior por diez, en varias regiones.'
      ],
      rows: [
        { c: 'Entrada TCP y TLS', s: 'Network Load Balancer', u: 'h', p: 0.0225, q: [1, 1, 3] },
        { c: 'Capacidad de los NLB', s: 'NLCU-hora (100 000 conexiones TCP activas cada una)', u: 'h', p: 0.006, q: [1, 30, 300] },
        { c: 'Gateways de conexión', s: 'EC2 m7g.2xlarge (8 vCPU, 32 GB)', u: 'h', p: 0.3264, q: [2, 12, 114] },
        { c: 'Registro de sesiones', s: 'ElastiCache (Valkey) cache.r7g.large', u: 'h', p: 0.175, q: [2, 6, 30] },
        { c: 'Servicio de mensajes y grupos', s: 'EC2 m7g.xlarge', u: 'h', p: 0.1632, q: [2, 12, 90] },
        { c: 'Buzones en DynamoDB: escrituras', s: 'on-demand, por millón de WRU', u: 'M', p: 0.625, q: [360, 0, 0] },
        { c: 'Buzones en DynamoDB: lecturas', s: 'on-demand, por millón de RRU', u: 'M', p: 0.125, q: [180, 0, 0] },
        { c: 'Buzones en ScyllaDB', s: 'EC2 i4i.2xlarge (NVMe local)', u: 'h', p: 0.686, q: [0, 6, 45] },
        { c: 'Usuarios, grupos y dispositivos', s: 'Aurora PostgreSQL db.r7g.xlarge', u: 'h', p: 0.552, q: [2, 2, 6] },
        { c: 'Claves públicas (prekeys)', s: 'DynamoDB on-demand, por millón de WRU', u: 'M', p: 0.625, q: [5, 300, 3000] },
        { c: 'Fotos y videos (30 días)', s: 'S3 Standard, GB al mes', u: 'GB', p: 0.023, q: [1800, 180000, 1800000] },
        { c: 'Descarga de medios', s: 'CloudFront, por GB (promedio por tramos)', u: 'GB', p: [0.085, 0.051, 0.029], q: [3600, 360000, 3600000] },
        { c: 'Push a APNs y FCM', s: 'EC2 m7g.large (servicio propio)', u: 'h', p: 0.0816, q: [1, 4, 30] },
        { c: 'Tareas internas', s: 'SQS, por millón de requests', u: 'M', p: 0.4, q: [30, 0, 0] },
        { c: 'Eventos internos', s: 'MSK kafka.m7g.large, un broker', u: 'h', p: 0.204, q: [0, 3, 12] },
        { c: 'SMS de verificación', s: 'por SMS (varía mucho por país)', u: 'u', p: 0.0075, q: [5000, 300000, 3000000] },
        { c: 'Salida de los gateways', s: 'EC2 a internet, promedio por tramos', u: 'GB', p: [0.09, 0.0875, 0.069], q: [300, 20000, 200000] },
        { c: 'Logs y métricas', s: 'CloudWatch Logs, GB ingerido', u: 'GB', p: 0.5, q: [20, 1000, 8000] }
      ],
      foot: 'APNs y FCM no cobran por notificación; un servicio propio que les habla directo cuesta unas pocas instancias, contra unos 0.50 USD por millón con SNS. Los medios dominan la factura: por eso se cifran una vez, se reenvían sin volver a subirse y se borran del servidor tras la descarga o a los 30 días.'
    },
    m23: {
      title: 'Factura mensual de tu servicio de generación de imágenes',
      scales: ['MVP', 'Producción', 'Gran escala'],
      scaleNote: [
        '100 000 imágenes por día con un DiT de 12 B a 7 s de GPU por imagen: 24 H100 en 3 nodos.',
        '3 millones de imágenes por día, pico al doble del promedio y 70 % de uso en el pico: 695 H100 en 87 nodos.',
        '30 millones de imágenes por día: 6 945 H100 en 869 nodos, todo lo demás por diez.'
      ],
      rows: [
        { c: 'Workers de generación', s: 'EC2 p5.48xlarge (8 H100), on-demand', u: 'h', p: 55.04, q: [3, 87, 869] },
        { c: 'Moderación de entrada y salida', s: 'EC2 g6.xlarge (1 L4)', u: 'h', p: 0.8048, q: [2, 5, 50] },
        { c: 'Plano de control de Kubernetes', s: 'EKS, por clúster', u: 'h', p: 0.10, q: [1, 1, 2] },
        { c: 'API de jobs', s: 'Fargate ARM, tarea de 1 vCPU y 2 GB', u: 'h', p: 0.0395, q: [2, 6, 40] },
        { c: 'Entrada HTTPS', s: 'Application Load Balancer', u: 'h', p: 0.0225, q: [1, 1, 2] },
        { c: 'Capacidad del ALB', s: 'LCU-hora (promedio)', u: 'h', p: 0.008, q: [1, 10, 100] },
        { c: 'Colas por prioridad', s: 'SQS, por millón de requests (4 por job)', u: 'M', p: 0.4, q: [12, 365, 3650] },
        { c: 'Estado de los jobs: escrituras', s: 'DynamoDB on-demand, por millón de WRU (5 por job)', u: 'M', p: 0.625, q: [15, 456, 4563] },
        { c: 'Estado de los jobs: lecturas', s: 'DynamoDB on-demand, por millón de RRU (polling)', u: 'M', p: 0.125, q: [12, 365, 3650] },
        { c: 'Imágenes guardadas', s: 'S3 Standard, PNG de los últimos 30 días, promedio por tramos', u: 'GB', p: [0.023, 0.0224, 0.0214], q: [4720, 141600, 1416000] },
        { c: 'Escrituras en S3', s: 'S3 PUT, por millón (PNG y WebP)', u: 'M', p: 5, q: [6.1, 182.5, 1825] },
        { c: 'Entrega de las imágenes', s: 'CloudFront, WebP de 300 kB y 3 vistas, promedio por tramos', u: 'GB', p: [0.085, 0.073, 0.041], q: [2740, 82125, 821250] },
        { c: 'Webhooks', s: 'Lambda, por millón de invocaciones', u: 'M', p: 0.2, q: [3.04, 91.25, 912.5] },
        { c: 'Logs y métricas', s: 'CloudWatch Logs, GB ingerido', u: 'GB', p: 0.5, q: [10, 200, 2000] }
      ],
      foot: 'Las GPUs son el 99 % de la factura: un modelo destilado de 4 pasos la divide por 12, y la capacidad reservada o spot para batch la baja bastante más que cualquier otra línea. No incluye la duración de las Lambdas, NAT ni transferencia entre zonas, que no cambian el orden de magnitud.'
    },
    m24: {
      title: 'Factura mensual de tu agente de voz en cascada',
      scales: ['MVP', 'Producción', 'Gran escala'],
      scaleNote: [
        '300 sesiones simultáneas en el pico (150 en promedio): 6.57 millones de minutos al mes. El LLM es un nodo de 8 H100 casi ocioso.',
        'La flota de referencia de 24.1: 30 000 sesiones en el pico y 657 millones de minutos al mes; 27 réplicas del LLM, en 14 nodos en el pico.',
        '300 000 sesiones en el pico: todo por diez, con algo de economía de escala en la salida a internet.'
      ],
      rows: [
        { c: 'LLM de la conversación', s: 'EC2 p5.48xlarge (8 H100), réplicas de 4 GPUs', u: 'h', p: 55.04, q: [1, 12, 105] },
        { c: 'Llamadas telefónicas entrantes', s: 'Chime SDK Voice Connector, millón de minutos (10 % de los minutos)', u: 'M', p: 2216, q: [0.657, 65.7, 657] },
        { c: 'Workers de voz', s: 'EC2 m7g.2xlarge (8 vCPU), 80 sesiones cada uno', u: 'h', p: 0.3264, q: [4, 325, 3250] },
        { c: 'TTS en streaming', s: 'EC2 g6.xlarge (1 L4), 200 sesiones cada una', u: 'h', p: 0.8048, q: [2, 130, 1300] },
        { c: 'STT en streaming', s: 'EC2 g6.xlarge (1 L4), 300 sesiones cada una', u: 'h', p: 0.8048, q: [2, 88, 868] },
        { c: 'Audio hacia los usuarios', s: 'Salida a internet, 52 kbps por sesión, promedio por tramos', u: 'GB', p: [0.09, 0.0652, 0.0515], q: [2562, 256230, 2562300] },
        { c: 'SFU', s: 'EC2 c7gn.2xlarge, 1 000 sesiones cada uno', u: 'h', p: 0.4992, q: [2, 40, 400] },
        { c: 'TURN (coturn)', s: 'EC2 c7gn.xlarge, dos por región', u: 'h', p: 0.2496, q: [2, 6, 30] },
        { c: 'Grabaciones con consentimiento', s: 'S3 Standard, 10 % de los minutos, 90 días', u: 'GB', p: [0.023, 0.023, 0.0221], q: [473, 47304, 473040] },
        { c: 'Estado de las sesiones', s: 'ElastiCache (Valkey) cache.r7g.large', u: 'h', p: 0.175, q: [2, 6, 18] },
        { c: 'Eventos de uso (M21)', s: 'MSK kafka.m7g.large, un broker', u: 'h', p: 0.204, q: [0, 3, 6] },
        { c: 'Plano de control de Kubernetes', s: 'EKS, un clúster por región', u: 'h', p: 0.10, q: [1, 3, 6] },
        { c: 'Logs y métricas', s: 'CloudWatch Logs, GB ingerido', u: 'GB', p: 0.5, q: [10, 300, 3000] }
      ],
      foot: 'Supuestos de diseño de referencia, para medir con tus modelos: un SFU cada 1 000 sesiones, un worker de 8 vCPU cada 80, una L4 de STT cada 300 sesiones y una de TTS cada 200; los pools que escalan siguen la curva del día y promedian el 65 % del pico. El 10 % de los minutos entra por teléfono y el 10 % se graba (Opus a 32 kbps). En producción sale a 0.13 centavos por minuto, unas 40 veces menos que la Realtime API con caché, sin contar al equipo que lo opera ni el entrenamiento de los modelos.'
    },
    m25: {
      title: 'Factura mensual de tu plataforma de agentes',
      scales: ['MVP', 'Producción', 'Gran escala'],
      scaleNote: [
        '1 000 tareas por día (30 000 al mes), cada una de 30 pasos como la de 25.1. Unas 4 tareas en curso en el pico.',
        'El servicio de referencia de 25.1: 100 000 tareas por día, 3 millones al mes, unas 417 en curso en el pico y 104 llamadas al modelo por segundo.',
        '1 millón de tareas por día: 30 millones al mes, unas 4 170 en curso en el pico. Los checkpoints se reparten en cuatro clústeres por cliente.'
      ],
      rows: [
        { c: 'Modelo: lecturas del caché', s: 'Claude Sonnet 5.5, millón de tokens leídos del caché', u: 'M', p: 0.2, q: [16965, 1696500, 16965000] },
        { c: 'Modelo: salida', s: 'Claude Sonnet 5.5, millón de tokens de salida', u: 'M', p: 10, q: [270, 27000, 270000] },
        { c: 'Modelo: escrituras del caché', s: 'Claude Sonnet 5.5, millón de tokens escritos en el caché de 5 minutos', u: 'M', p: 2.5, q: [1035, 103500, 1035000] },
        { c: 'Checkpoints: instancias', s: 'Aurora PostgreSQL db.r7g.large (MVP) o db.r7g.xlarge, escritor y réplica', u: 'h', p: [0.276, 0.552, 0.552], q: [2, 2, 8] },
        { c: 'Sandbox de código', s: 'Lambda en una VPC sin internet, millón de GB-s (20 % de las tareas, 30 s, 2 GB)', u: 'M', p: 16.6667, q: [0.36, 36, 360] },
        { c: 'Checkpoints: E/S', s: 'Aurora PostgreSQL, millón de operaciones (unas 600 por tarea)', u: 'M', p: 0.2, q: [18, 1800, 18000] },
        { c: 'Datos hacia la API del modelo', s: 'NAT Gateway, GB procesado (unos 2.4 MB de contexto por tarea)', u: 'GB', p: 0.045, q: [72, 7200, 72000] },
        { c: 'Trazas', s: 'CloudWatch Logs, GB ingerido (unos 150 KB por tarea)', u: 'GB', p: 0.5, q: [4.5, 450, 4500] },
        { c: 'Workers del agente', s: 'Fargate ARM, 1 vCPU y 2 GB, unas 50 tareas en curso cada uno', u: 'h', p: 0.0395, q: [2, 6, 55] },
        { c: 'Checkpoints: almacenamiento', s: 'Aurora PostgreSQL, GB al mes (3 días completos, después solo el estado final)', u: 'GB', p: 0.1, q: [11, 1134, 11340] },
        { c: 'Salida a internet', s: 'NAT Gateway, por hora, uno por zona', u: 'h', p: 0.045, q: [1, 3, 6] },
        { c: 'API de tareas y aprobaciones', s: 'Fargate ARM, 1 vCPU y 2 GB', u: 'h', p: 0.0395, q: [2, 3, 6] },
        { c: 'Colas de tareas y reanudaciones', s: 'SQS estándar, millón de peticiones', u: 'M', p: 0.4, q: [0.0945, 9.45, 94.5] }
      ],
      foot: 'Supuestos de diseño de referencia, para medir con tu propio agente: tareas de 30 pasos con 5 500 tokens de prefijo y 1 000 por paso, con prompt caching; un worker de Python asíncrono lleva unas 50 tareas en curso porque casi todo el tiempo espera al modelo; los pools siguen la curva del día y promedian el 65 % del pico. Si guardas la lista entera de mensajes en cada paso, el checkpoint crece como la entrada: mide los tuyos. En producción, el modelo es el 99.7 % de la factura: cada paso que ahorras vale más que cualquier ajuste de la infraestructura. Con Bedrock y PrivateLink, el NAT deja de cobrar por los datos hacia el modelo.'
    },
    m30: {
      title: 'Factura mensual de tu clon de Twitter',
      scales: ['MVP', 'Producción', 'Gran escala'],
      scaleNote: [
        '100 000 usuarios activos al día: un nodo de Valkey con réplica para las timelines, SQS para el fan-out.',
        '10 millones de usuarios activos al día: 368 GB de timelines en 9 shards, Kafka y caché de tweets aparte.',
        '100 millones de usuarios activos al día: 3.7 TB de timelines en 87 shards, todo lo demás por diez.'
      ],
      rows: [
        { c: 'Timelines precalculadas', s: 'ElastiCache (Valkey) r7g.large en el MVP, r7g.2xlarge después; con réplica', u: 'h', p: [0.175, 0.699, 0.699], q: [2, 18, 174] },
        { c: 'Caché de tweets y autores', s: 'ElastiCache (Valkey) cache.r7g.xlarge', u: 'h', p: 0.35, q: [0, 6, 60] },
        { c: 'Contadores de likes y retweets', s: 'ElastiCache (Valkey) cache.r7g.large', u: 'h', p: 0.175, q: [0, 2, 12] },
        { c: 'Servicios y workers de fan-out', s: 'Fargate ARM, tarea de 4 vCPU y 8 GB', u: 'h', p: 0.158, q: [3, 18, 150] },
        { c: 'Log de eventos', s: 'MSK kafka.m7g.large, un broker', u: 'h', p: 0.204, q: [0, 3, 12] },
        { c: 'Cola del fan-out (MVP)', s: 'SQS, por millón de requests', u: 'M', p: 0.4, q: [20, 0, 0] },
        { c: 'Tweets, grafo y likes: escrituras', s: 'DynamoDB on-demand, por millón de WRU', u: 'M', p: 0.625, q: [46, 4560, 45600] },
        { c: 'Tweets, grafo y likes: lecturas', s: 'DynamoDB on-demand, por millón de RRU', u: 'M', p: 0.125, q: [40, 4000, 40000] },
        { c: 'Almacenamiento de DynamoDB', s: 'GB al mes (crece unos 600 GB por mes en producción)', u: 'GB', p: 0.25, q: [20, 2000, 20000] },
        { c: 'Búsqueda', s: 'OpenSearch r7g.large.search en el MVP, r7g.xlarge.search después', u: 'h', p: [0.178, 0.356, 0.356], q: [2, 3, 15] },
        { c: 'Tendencias', s: 'Fargate ARM, tarea de 2 vCPU y 8 GB', u: 'h', p: 0.0932, q: [1, 2, 6] },
        { c: 'Entrada HTTPS', s: 'Application Load Balancer', u: 'h', p: 0.0225, q: [1, 1, 3] },
        { c: 'Capacidad del ALB', s: 'LCU-hora (promedio)', u: 'h', p: 0.008, q: [1, 80, 800] },
        { c: 'Respuestas de la API', s: 'Salida a internet, promedio por tramos', u: 'GB', p: [0.09, 0.083, 0.056], q: [600, 60000, 600000] },
        { c: 'Logs y métricas', s: 'CloudWatch Logs, GB ingerido', u: 'GB', p: 0.5, q: [20, 1000, 8000] }
      ],
      foot: 'No incluye fotos ni videos: con 10 millones de usuarios, la CDN mueve más de un petabyte al mes y es la línea más cara; se dimensiona como en el M09. Tampoco el ranking de Para ti ni sus GPUs. Con tráfico estable, la capacidad provisionada de DynamoDB cuesta bastante menos que on-demand.'
    }
  };

  function price(row, k) { return Array.isArray(row.p) ? row.p[k] : row.p; }
  function monthly(u, p, q) { return u === 'h' ? p * q * HOURS : p * q; }
  function usd(x) { return F.num(x, x < 100 ? 2 : 0) + ' USD'; }

  function initBom(host) {
    var P = PRESETS[host.getAttribute('data-preset')];
    if (!P) return;
    var scale = 1, uid = 0;
    var chips = h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Escala' });
    var note = h('p', { class: 'calc-note' });
    var tbody = h('tbody');
    var total = h('output', { class: 'bom-total-value' });
    var perHour = h('span', { class: 'bom-total-sub' });
    var top = h('p', { class: 'bom-top' });
    var inputs = [];

    P.rows.forEach(function (r, i) {
      var qid = 'bom' + (++uid), pid = 'bom' + (++uid);
      var q = h('input', { id: qid, type: 'number', min: 0, step: 'any', inputmode: 'decimal', 'aria-label': 'Cantidad: ' + r.c });
      var p = h('input', { id: pid, type: 'number', min: 0, step: 'any', inputmode: 'decimal', 'aria-label': 'Precio en USD ' + UNIT[r.u] + ': ' + r.c });
      var sub = h('td', { class: 'r bom-sub' });
      var tr = h('tr', null, [
        h('td', null, [h('span', { class: 'bom-c', text: r.c }), h('span', { class: 'bom-s', text: r.s })]),
        h('td', { class: 'r' }, [q, h('span', { class: 'bom-u', text: QTY[r.u] })]),
        h('td', { class: 'r' }, [p, h('span', { class: 'bom-u', text: 'USD ' + UNIT[r.u] })]),
        sub
      ]);
      q.addEventListener('input', run); p.addEventListener('input', run);
      inputs.push({ r: r, q: q, p: p, sub: sub, tr: tr });
      tbody.appendChild(tr);
    });

    function val(el) { var x = parseFloat(el.value); return isFinite(x) && x >= 0 ? x : 0; }
    function load(k) {
      scale = k;
      chips.querySelectorAll('button').forEach(function (b, j) { b.setAttribute('aria-pressed', j === k ? 'true' : 'false'); });
      inputs.forEach(function (it) { it.q.value = it.r.q[k]; it.p.value = price(it.r, k); });
      note.textContent = P.scaleNote[k];
      run();
    }
    function run() {
      var sum = 0, rows = [];
      inputs.forEach(function (it) {
        var m = monthly(it.r.u, val(it.p), val(it.q));
        sum += m; rows.push({ c: it.r.c, m: m });
        it.sub.textContent = usd(m);
        it.tr.classList.toggle('is-zero', m === 0);
      });
      total.textContent = usd(sum);
      perHour.textContent = 'unos ' + usd(sum / HOURS) + ' por hora';
      rows.sort(function (a, b) { return b.m - a.m; });
      top.textContent = sum > 0
        ? 'Lo que más pesa: ' + rows.slice(0, 3).filter(function (x) { return x.m > 0; }).map(function (x) { return x.c.toLowerCase() + ' (' + F.pct(x.m / sum, 0) + ')'; }).join(', ') + '.'
        : '';
    }
    P.scales.forEach(function (name, k) {
      chips.appendChild(h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'false', text: name, onclick: function () { load(k); } }));
    });

    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: P.title }), chips]));
    host.appendChild(h('div', { class: 'calc-pad' }, [
      note,
      h('div', { class: 'table-wrap bom-wrap' }, [h('table', { class: 't bom' }, [
        h('thead', null, [h('tr', null, [h('th', { text: 'Componente' }), h('th', { class: 'r', text: 'Cantidad' }), h('th', { class: 'r', text: 'Precio' }), h('th', { class: 'r', text: 'Al mes' })])]),
        tbody
      ])]),
      h('div', { class: 'bom-total', 'aria-live': 'polite' }, [h('span', { class: 'bom-total-label', text: 'Total estimado al mes' }), total, perHour]),
      top
    ]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Precios de lista on-demand aproximados en us-east-1 (septiembre de 2026); cambian con el tiempo y por región, así que se pueden editar. Una instancia cuenta 730 horas al mes. Con reservas o Savings Plans a 1 o 3 años, las instancias bajan entre 35 y 65 %. ' + P.foot }));
    load(1);
  }

  /* ======================= Gateways de conexión (M29) ======================= */

  var INSTANCES = [
    { id: 'm7g.xlarge', mem: 16, vcpu: 4, p: 0.1632 },
    { id: 'm7g.2xlarge', mem: 32, vcpu: 8, p: 0.3264 },
    { id: 'm7g.4xlarge', mem: 64, vcpu: 16, p: 0.6528 },
    { id: 'c7gn.2xlarge', mem: 16, vcpu: 8, p: 0.4992 }
  ];

  function initGateways(host) {
    var uid = 0;
    function num(label, value, step, hint) {
      var id = 'gw' + (++uid);
      var i = h('input', { id: id, type: 'number', min: 0, step: step, value: value, inputmode: 'decimal' });
      var kids = [h('label', { for: id, text: label }), i];
      if (hint) kids.push(h('p', { class: 'field-hint', text: hint }));
      return { el: h('div', { class: 'field' }, kids), input: i };
    }
    var selId = 'gw' + (++uid);
    var sel = h('select', { id: selId }, INSTANCES.map(function (x) {
      return h('option', { value: x.id, text: x.id + ': ' + x.vcpu + ' vCPU, ' + x.mem + ' GB, ' + F.num(x.p, 4) + ' USD/h' });
    }));
    sel.value = 'm7g.2xlarge';
    var f = {
      dau: num('Usuarios activos al día (DAU)', 10000000, 100000),
      conc: num('Conectados a la vez en el pico (% de DAU)', 30, 1, 'Con la app en primer plano o recién usada. En segundo plano, el sistema operativo corta la conexión y el mensaje llega por push.'),
      per: num('Conexiones por gateway (objetivo)', 400000, 10000, 'Por debajo del máximo que aguanta la máquina, para absorber las conexiones de un gateway que cae.'),
      kb: num('Memoria por conexión (KB)', 30, 1, 'Socket del kernel, estado de TLS y buffers de la aplicación. Con buffers ajustados, entre 10 y 50 KB.'),
      msgs: num('Mensajes enviados por usuario al día', 40, 1),
      dev: num('Dispositivos destino por mensaje', 1.5, 0.1, 'Multidispositivo y grupos: un mensaje a un grupo de 20 personas con 1.5 dispositivos cada una son 30 entregas.'),
      peak: num('Factor de pico', 3, 0.5)
    };
    var instField = h('div', { class: 'field' }, [h('label', { for: selId, text: 'Instancia de los gateways' }), sel]);
    function out(label, formula) {
      var v = h('output', { class: 'out-value' });
      return { el: h('div', { class: 'out-row' }, [h('span', { class: 'out-label', text: label }), v, h('span', { class: 'out-formula', text: formula })]), v: v };
    }
    var o = {
      conns: out('Conexiones simultáneas en el pico', 'DAU × % conectados'),
      mem: out('Memoria de conexiones por gateway', 'conexiones por gateway × KB, contra la memoria de la instancia'),
      base: out('Gateways sin margen', '⌈conexiones ÷ conexiones por gateway⌉'),
      az: out('Gateways en 3 zonas, tolerando perder una', 'sin margen × 3/2, redondeado a múltiplo de 3'),
      mps: out('Mensajes por segundo (promedio y pico)', 'DAU × mensajes ÷ 86 400; pico × factor'),
      del: out('Entregas por segundo en el pico', 'mensajes en el pico × dispositivos destino'),
      inbox: out('Escrituras en buzones por segundo en el pico', 'entregas × 2: guardar y borrar al confirmar'),
      cost: out('Costo de los gateways al mes', 'gateways × precio por hora × 730'),
      apigw: out('Lo mismo con API Gateway WebSocket', 'minutos de conexión × 0.25 USD/millón + mensajes × 1 USD/millón')
    };
    var warn = h('p', { class: 'calc-note kv-warn', 'aria-live': 'polite' });
    function v(k) { var x = parseFloat(f[k].input.value); return isFinite(x) && x >= 0 ? x : 0; }
    function run() {
      var inst = INSTANCES.filter(function (x) { return x.id === sel.value; })[0];
      var conns = v('dau') * v('conc') / 100, per = Math.max(1, v('per'));
      var memGB = per * v('kb') / 1e6, share = memGB / inst.mem;
      var base = Math.max(1, Math.ceil(conns / per));
      var az = Math.max(3, Math.ceil(base * 1.5 / 3) * 3);
      var mps = v('dau') * v('msgs') / 86400, mpsPeak = mps * v('peak');
      var del = mpsPeak * v('dev');
      var cost = az * inst.p * HOURS;
      /* API Gateway: conexión promedio ≈ 60 % del pico; mensajes = envíos + entregas + confirmaciones de entrega */
      var connMin = conns * 0.6 * 60 * HOURS;
      var msgsMonth = (v('dau') * v('msgs') * (1 + 2 * v('dev'))) * 30.4;
      var api = connMin * 0.25 / 1e6 + msgsMonth / 1e6;
      o.conns.v.textContent = F.words(conns);
      o.mem.v.textContent = F.num(memGB, 1) + ' de ' + inst.mem + ' GB (' + F.pct(share, 0) + ')';
      o.base.v.textContent = F.num(base, 0);
      o.az.v.textContent = F.num(az, 0);
      o.mps.v.textContent = F.num(mps, 0) + ' · ' + F.num(mpsPeak, 0);
      o.del.v.textContent = F.num(del, 0);
      o.inbox.v.textContent = F.num(del * 2, 0);
      o.cost.v.textContent = usd(cost);
      o.apigw.v.textContent = usd(api) + (cost > 0 ? ' (×' + F.num(api / cost, 0) + ')' : '');
      warn.textContent = share > 0.7
        ? 'Las conexiones ocupan más del 70 % de la memoria: no queda lugar para el runtime, los picos de mensajes ni las conexiones de un gateway caído. Baja las conexiones por gateway o usa una instancia con más memoria.'
        : '';
    }
    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    ['dau', 'conc', 'per', 'kb'].forEach(function (k) { inCol.appendChild(f[k].el); });
    inCol.appendChild(instField);
    ['msgs', 'dev', 'peak'].forEach(function (k) { inCol.appendChild(f[k].el); });
    Object.keys(f).forEach(function (k) { f[k].input.addEventListener('input', run); });
    sel.addEventListener('change', run);
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });
    outCol.appendChild(warn);
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Cuántos gateways necesitas' })]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Dimensiona por memoria, que es el límite de un gateway con muchas conexiones quietas; la CPU importa en los picos de mensajes y de reconexiones. Para API Gateway supone una conexión promedio del 60 % del pico y el precio de lista del primer tramo (1 USD por millón de mensajes de hasta 32 KB, 0.25 USD por millón de minutos de conexión).' }));
    run();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-calc="bom"]').forEach(initBom);
    document.querySelectorAll('[data-calc="gateways"]').forEach(initGateways);
  });
})();
