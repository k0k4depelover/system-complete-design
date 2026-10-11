# PLAN_SEGURIDAD.md — Parte IV: Ciberseguridad (M32–M38 + Checkpoint E)

> Plan autosuficiente. Una sesión futura debería poder implementar cada módulo leyendo **solo** este archivo,
> consultando las referencias que lista, su índice y las descripciones de diagramas que incluye. Lo que cambie
> (qué módulo está hecho) se refleja en `PROGRESO.md`; las reglas estables están en `CLAUDE.md` y el currículo
> global en `PLAN.md`. Hoy la Parte IV existe solo como esqueleto en `course.data.js` (rutas `soon`); cada módulo
> se escribe de a uno, por pedido del usuario.

---

## 0. Cómo usar este plan

1. Lee la sección **1 (principios)** y **2 (convenciones)** una vez: valen para los seis módulos.
2. Para el módulo que toque, ve a su sección (M32…M37 o CP-E). Cada una trae, en este orden fijo:
   - **Objetivo y encaje** (qué resuelve, qué retoma, qué promete).
   - **Secciones con sus ids** (la estructura `h2`/`h3` ya numerada).
   - **Diagramas y figuras** (qué dibuja cada una, con qué nodos; suficiente para construir el SVG).
   - **Widgets interactivos** (selector, archivo, qué hace, lógica a verificar).
   - **Quiz** (temas de las 8–9 preguntas; los casos de estudio llevan más).
   - **Ejercicio** (estático o guiado).
   - **Términos del glosario** (nuevos, ya verificados contra los 479 ids actuales).
   - **Fuentes a verificar** (con URL; verificar vigencia y cifras antes de escribir).
   - **Promesas y enlaces** (qué menciones de otros módulos se convierten en enlaces).
3. Sigue el flujo de **"Cómo se agrega un módulo"** de `CLAUDE.md` (fragmento con `<!--META-->` → `mkpage.py` →
   quiz → glosario → `status: 'ready'` → pruebas → traspaso).
4. Cierra con el **checklist de pruebas** de la sección 9 de este plan.

Orden de implementación sugerido: **M36 (criptografía) → M32 (firewalls) → M33 (hardening) → M34 (sysadmin) →
M35 (BD) → M37 (nube) → CP-E**. Criptografía primero porque M37 (KMS, mTLS, PKI) y M33 (SSH, claves) la citan;
pero cada módulo funciona solo, así que el usuario puede pedir cualquier orden.

---

## 1. Principios transversales de la Parte IV

### 1.1. Restricción de seguridad (obligatoria, no negociable)

Todo el contenido es **defensivo**. En cada tema se muestra **el patrón vulnerable y su arreglo**, nunca una
cadena de explotación lista para usar, ni técnicas de evasión de defensas pensadas para atacar.

- La premisa pedagógica es **"si no haces esto, el atacante hace esto otro, y te despiden"**: se nombra la
  consecuencia para motivar la defensa, sin dar el procedimiento ofensivo.
- La sección de M33 **"si el firewall no alcanza"** asume que el perímetro **ya cayó**, inventaría lo que queda
  expuesto y endurece el servidor por sí mismo. No explica cómo se salta un firewall: explica qué proteger
  suponiendo que alguien ya está dentro de la red. (Un intento anterior de redactar "cómo saltar el firewall"
  fue detenido por un clasificador de seguridad; **no reproducir ese enfoque, ni reescrito**. Mantener todo en
  el registro defensivo: inventario de exposición, mínimo privilegio, detección y respuesta.)
- Comandos de ejemplo: solo defensivos y de diagnóstico (configurar `sshd`, leer logs, correr un escáner de
  endurecimiento como Lynis). Nada de payloads, exploits ni pasos de intrusión.
- Si un tema solo se puede explicar bien nombrando una técnica de ataque (p. ej. ARP spoofing en una red local),
  se describe **el concepto y la defensa**, sin el procedimiento reproducible.

### 1.2. Honestidad técnica (regla del proyecto)

- Toda afirmación sobre un producto o incidente real lleva `<span class="badge badge--doc">Documentado</span>`
  con fuente pública, o `<span class="badge badge--ref">Diseño de referencia</span>` si es una reconstrucción.
- Las cifras se verifican contra la fuente antes de escribirlas; los ejemplos con cuentas se muestran con la
  cuenta hecha. **Nunca se inventan números.**
- Cuando se parafrasea contenido de un repositorio con licencia (el caso de M33, ver 1.3), se escribe **prosa
  propia**, se enlaza a la sección original y se pone un recuadro de atribución.

### 1.3. Atribución de How-To-Secure-A-Linux-Server (base de M33)

- Repositorio: `https://github.com/imthenachoman/How-To-Secure-A-Linux-Server`.
- Autor: **Anchal Nigam** (usuario `imthenachoman`). Licencia: **Creative Commons Attribution-ShareAlike 4.0
  (CC BY-SA 4.0)**.
- Obligaciones: (a) atribuir al autor y nombrar la licencia; (b) enlazar al original; (c) si se adapta el texto,
  compartir bajo la misma licencia. Como escribimos prosa propia y enlazamos a cada sección, cumplimos con un
  **recuadro de atribución** arriba del módulo (`callout` con el crédito, la licencia y el enlace) y un enlace
  por sección al ancla correspondiente del README original.
- Verificar vigencia del repositorio y de los nombres de secciones antes de escribir (el README es largo; se
  baja crudo de `raw.githubusercontent.com/imthenachoman/How-To-Secure-A-Linux-Server/master/README.md`, en dos
  mitades por tamaño: una con `offset` al principio y otra con `offset 100000`).
- Secciones del original a mapear (verificar que sigan existiendo): **The SSH Server** (claves, `AllowGroups`,
  `sshd_config`, Diffie-Hellman moduli, 2FA), **The Basics** (sudo, su, FireJail, NTP, `/proc` hidepid,
  contraseñas, actualizaciones automáticas, entropía/`haveged`/`rng-tools`, contraseña de pánico), **Networking**
  (UFW, Docker vs UFW, PSAD, Fail2Ban, CrowdSec), **Auditing** (AIDE, ClamAV, rkhunter, chkrootkit, Logwatch,
  `ss`, Lynis, OSSEC), **The Danger Zone** (sysctl, contraseña de GRUB, deshabilitar login de root, umask,
  software huérfano), **Miscellaneous** (MSMTP, Exim4, iptables log separado).

---

## 2. Convenciones del proyecto relevantes (resumen operativo)

Todo lo de `CLAUDE.md` aplica. Lo más usado aquí:

- **Funciona con `file://`**: solo `<script src>` clásicos; nada de módulos ES, `import`, `fetch` ni CDN.
- **Colores solo con tokens** (`var(--l-service)`, etc.). Estados reservados `--ok`/`--warn`/`--fail` con texto
  o icono. La Parte IV usa la línea `--line-p4` (ya definida como `var(--l-cache)` en `tokens.css`).
- **Español con tú.** Números con punto decimal, miles con espacio fino (`SD.fmt.num`) y `&#8239;%`.
- **Términos**: `<dfn data-term="id">` en la primera mención por sección `h2`. Todo `data-term` debe existir en
  `glossary.data.js`. Básicos con `basic: true`; ambiguos con `noauto: true`. Correr `links.mjs` para detectar
  enlaces con otro sentido.
- **Quiz**: `SD.defineQuiz`, se aprueba con 70&#8239;%. Debe pasar `quiz-bias.mjs` (la correcta no puede ser la
  más larga o la más corta por sistema; distractores plausibles con su justificación falsa creíble). Módulos de
  Parte IV: **8–9 preguntas** (como Parte I); el Checkpoint E, **20**.
- **Estructura de página**: `objectives`, secciones numeradas con `sec-num`, cierre con
  `<h2 id="comprueba">`, `<div data-quiz="mNN">`, ejercicio y `<div data-checkpoint="mNN">`.
- **Figuras**: `figure.figure` con `svg viewBox` y `title`/`desc`; clases `dg-box`, `dg-box--em`, `dg-layer`
  (con `style="--c: var(--l-*)"`), `dg-ok`, `dg-bad`, `dg-edge`, `dg-frame`, `dg-arrow`, `dg-label`, `dg-small`,
  `dg-tiny`, `dg-group`. Ids de `title`/`desc`/`marker` únicos por página. Mínimo 12&#8239;px entre cajas.
- **Diagramas de secuencia**: `tools/seqdiag.py` → `seq(id, titulo, desc, actores, mensajes, footer=?)`.
  `footer={actor: "ejemplo"}` o `{actor: ("Nombre", "aclaración")}` dibuja cajas de "quién es quién" al pie.
- **Mapas** (si se usan): `SD.defineMap` + `data-map`, motor en `map/map-engine.js` y `map/flow-sim.js`.
  `stepPanel: true` para que el panel lateral narre el escenario. Pasillos de ~150&#8239;px entre columnas.
- **Widgets**: IIFE con `SD.h`, `SD.fmt`, init en `SD.ready` sobre `document.querySelectorAll('[data-sim]')` o
  `[data-calc]`. Clases `sim`/`sim-head`/`sim-title`/`sim-body`/`sim-controls`/`chip-btn`/`sim-note`/`sim-foot`.
  Respetar `prefers-reduced-motion`. Reutilizar `SD.flowAnim` (en `sim-dbflow.js`) para escenas con nodos y
  mensajes, y `SD.crypto` (en `sim-signurl.js`: SHA-256, HMAC, base64url) para los laboratorios de M36.
- **Badges**: `badge--doc` (documentado) y `badge--ref` (diseño de referencia).
- **Ediciones grandes**: script de Python con `assert s.count(viejo) == 1`. En Windows, nada de heredoc con
  barras invertidas: usar Write/Edit.
- **No hacer commits** salvo que el usuario lo pida.

### 2.1. Progreso y rutas (ya hecho, no repetir)

- `course.data.js` ya tiene la parte `p4` con M32–M37 (`status: 'soon'`) y `cpe` (Checkpoint E). Al terminar un
  módulo, cambiar su `status` a `'ready'` (y ajustar `mins` si la estimación cambió). La Parte IV **cuenta para
  el progreso** (no lleva `phase: 2` ni `kind: 'deep'`).
- `--line-p4` ya está en `tokens.css`; la fila de ruta de `home.js` ya incluye todo lo que no es `p1` ni `p2`.
- Al publicar un módulo, convertir en enlaces las menciones "(MNN)" que otros módulos ya le hacían (ver cada
  sección "Promesas y enlaces"), y actualizar `PROGRESO.md` con un bloque "Siguiente" para los dos que vienen.

---

## 3. Índice de la Parte IV

| # | Archivo | Título | mins (estimado) | Mapa | Estado |
|---|---|---|---|---|---|
| M32 | `modules/m32-firewalls.html` | Firewalls a fondo | 90 | no | ready (2026-10-07) |
| M33 | `modules/m33-hardening-linux.html` | Hardening de servidores Linux | 150 | no | ready (2026-10-07) |
| M34 | `modules/m34-sysadmin.html` | Operación y troubleshooting para SysAdmin | 150 | no | ready (2026-10-10) |
| M35 | `modules/m35-seguridad-bd.html` | Seguridad en bases de datos | 120 | no | ready (2026-10-10) |
| M36 | `modules/m36-criptografia.html` | Criptografía desde cero | 140 | no | ready (2026-10-10) |
| M37 | `modules/m37-nube.html` | Arquitecturas seguras en la nube | 120 | no (diagrama zero-trust estático) | ready (2026-10-10) |
| M38 | `modules/m38-active-directory.html` | Active Directory: cómo se ataca y cómo se defiende | 150 | no (lámina de Kerberos) | ready (2026-10-10) |
| CP-E | `modules/checkpoint-e.html` | Checkpoint E: endurece una plataforma | 90 | sí (defensa en profundidad) | ready (2026-10-10) |

Prerrequisitos sugeridos (encadenamiento con el resto del curso):
- M32: M01 (redes), M03 (balanceo/gateways), M08 (resiliencia).
- M33: M32.
- M34: M33, M11 (observabilidad).
- M35: M05 (bases, RLS), M10 (seguridad, audit log).
- M36: M10 (ya usa KMS, envelope, HMAC vía `SD.crypto`).
- M37: M32, M36, M10, M28 (Cloudflare/WAF).
- M38: M33, M34, M36 (Kerberos), M10, M11.
- CP-E: toda la Parte IV, más M10.

---

## 4. Referencias maestras (verificar vigencia y cifras al implementar)

**Redes y firewalls (M32)**
- nftables wiki: `https://wiki.nftables.org/` (tablas, cadenas, hooks, `inet`, sets, verdict maps).
- iptables → nftables: `https://wiki.nftables.org/wiki-nftables/index.php/Moving_from_iptables_to_nftables`.
- UFW (Ubuntu): `https://help.ubuntu.com/community/UFW`. firewalld: `https://firewalld.org/documentation/`.
- Docker y el firewall (publica saltándose UFW; cadena `DOCKER-USER`):
  `https://docs.docker.com/engine/network/packet-filtering-firewalls/` y el proyecto `chaifeng/ufw-docker`.
- AWS Security Groups vs NACL: `https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html` y
  `.../network-acls.html` (SG con estado, por recurso; NACL sin estado, por subred).
- NIST SP 800-41 Rev.1 (guía de firewalls): `https://csrc.nist.gov/pubs/sp/800/41/r1/final`.

**Hardening Linux (M33)**
- How-To-Secure-A-Linux-Server (ver 1.3).
- CIS Benchmarks (Linux): `https://www.cisecurity.org/cis-benchmarks`.
- NIST SP 800-123 (seguridad de servidores): `https://csrc.nist.gov/pubs/sp/800/123/final`.
- OpenSSH `sshd_config`: `https://man.openbsd.org/sshd_config`.
- Fail2Ban: `https://github.com/fail2ban/fail2ban`. CrowdSec: `https://docs.crowdsec.net/`.
- AIDE: `https://aide.github.io/`. rkhunter, chkrootkit (manpages). Lynis: `https://cisofy.com/lynis/`.
- AppArmor: `https://apparmor.net/`. SELinux: `https://github.com/SELinuxProject`.
- `sysctl` hardening: kernel docs (`Documentation/admin-guide/sysctl/net.rst`), Debian/Ubuntu security guides.

**SysAdmin y operación (M34)**
- systemd/journald: `https://www.freedesktop.org/software/systemd/man/` (`systemctl`, `journalctl`, units).
- LVM: Red Hat / Ubuntu docs. `strace`, `ss`, `vmstat`, `iostat`, `dig` (manpages).
- Backups 3-2-1 y pruebas de restauración (concepto, citar fuente al usarlo).
- Google SRE Book (runbooks, postmortems): `https://sre.google/books/` (ya citado en M11).

**Seguridad en bases de datos (M35)**
- PostgreSQL: `GRANT`/roles (`https://www.postgresql.org/docs/current/sql-grant.html`), RLS (ya en M05),
  `pgaudit` (`https://github.com/pgaudit/pgaudit`), triggers de auditoría, `pgcrypto`.
- NIST RBAC (modelo): `https://csrc.nist.gov/projects/role-based-access-control`.
- NIST SP 800-162 (ABAC): `https://csrc.nist.gov/pubs/sp/800/162/final`.
- Cifrado de columnas y TDE (concepto; citar el motor concreto al usarlo).

**Criptografía (M36)**
- AES: FIPS 197. Modos y GCM: NIST SP 800-38A / 800-38D. HMAC: FIPS 198-1. SHA-2/3: FIPS 180-4 / 202.
- ChaCha20-Poly1305: RFC 8439. Curvas/ECDH, firmas (ECDSA/EdDSA): FIPS 186-5.
- Hash de contraseñas: Argon2 (RFC 9106), bcrypt, scrypt (RFC 7914). PBKDF2: SP 800-132.
- Aleatoriedad (DRBG): NIST SP 800-90A Rev.1. X.509: RFC 5280. TLS 1.3: RFC 8446 (ya citado en M01).
- OWASP Cryptographic Storage Cheat Sheet: `https://cheatsheetseries.owasp.org/`.
- Reutiliza `SD.crypto` (SHA-256, HMAC, base64url) de `sim-signurl.js` para los laboratorios.

**Nube segura (M37)**
- AWS IAM (política, condiciones, roles): `https://docs.aws.amazon.com/IAM/latest/UserGuide/`.
- AWS KMS (ya cubierto en M10): límites de `Encrypt` (4&#8239;KB), rotación anual, `ScheduleKeyDeletion` 7–30 días.
- AWS Secrets Manager, CloudTrail, Organizations SCP (guardrails).
- SPIFFE/SPIRE (identidad de carga de trabajo, base de mTLS): `https://spiffe.io/docs/`.
- NIST SP 800-207 (Zero Trust Architecture): `https://csrc.nist.gov/pubs/sp/800/207/final`.
- mTLS (ya como término `mtls`), service mesh (M03 `service-mesh`), WAF (M28), OWASP CRS (`owasp-crs`).

**Active Directory (M38)**
- Microsoft, Securing privileged access y Enterprise Access Model:
  `https://learn.microsoft.com/en-us/security/privileged-access-workstations/privileged-access-access-model`.
- Microsoft, Best practices for securing Active Directory:
  `https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/plan/security-best-practices/best-practices-for-securing-active-directory`.
- Windows LAPS: `https://learn.microsoft.com/en-us/windows-server/identity/laps/laps-overview`.
- Protected Users: `https://learn.microsoft.com/en-us/windows-server/security/credentials-protection-and-management/protected-users-security-group`.
- gMSA: `https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/group-managed-service-accounts/group-managed-service-accounts/group-managed-service-accounts-overview`.
- Recuperación del bosque y reset de `krbtgt`: `https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/forest-recovery-guide/ad-forest-recovery-guide`.
- Eventos a vigilar: `https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/plan/appendix-l--events-to-monitor`.
- MITRE ATT&CK (solo para nombrar técnicas y su mitigación/detección, no procedimientos): T1558.003
  (Kerberoasting), T1558.004 (AS-REP roasting), T1550.002 (pass-the-hash), T1003.006 (DCSync), T1558.001
  (Golden Ticket). `https://attack.mitre.org/`.
- ANSSI, puntos de control de AD (guía defensiva): `https://www.cert.ssi.gouv.fr/uploads/ad_checklist.html`.
- SpecterOps, "Certified Pre-Owned" (2021, AD CS): leer solo la parte de detección y prevención.
- NotPetya en Maersk: Andy Greenberg, Wired, "The Untold Story of NotPetya" (2018).

**Incidentes reales reutilizables (ya verificados en M10, con `badge--doc`)**
- Capital One 2019 (SSRF → metadatos AWS, 100M+ personas). 23andMe 2023 (credential stuffing, 6.9M).
- CircleCI 2023 (malware roba cookie de sesión con MFA ya resuelto). TalkTalk 2015 (SQLi, multa ICO £400k).
- Llama 3: 419 interrupciones en 54 días sobre 16&#8239;384 H100 (ya en M13; útil para M34 fallas de hardware).

---

## 5. Glosario: términos nuevos por módulo (verificados contra los 479 ids actuales)

> Antes de crear un término, confirmar con `grep "id: '<id>'" assets/js/data/glossary.data.js` que no exista.
> Los que ya existen se **reutilizan** (no se duplican) y, si el módulo los explica a fondo, se les mueve el
> `deep`. Categoría casi siempre `seguridad`; `redes` para los de M32; `nube` para los de M37.

- **Ya existen (reutilizar):** `waf`, `zero-trust`, `spiffe`, `mtls`, `kms`, `envelope`, `rls`, `bola`, `ssrf`,
  `bfla`, `mass-assignment`, `crypto-shredding`, `gdpr`, `audit-log`, `owasp-crs`, `web-acl`, `ddos`, `xdp`,
  `syn-cookies`, `hmac`, `cifrado-simetrico`, `criptografia-asimetrica`, `diffie-hellman`, `forward-secrecy`,
  `certificado-tls`, `ca`, `hsts`, `no-repudio`, `e2ee`, `double-ratchet`, `prekey`, `sender-key`, `nat`, `bgp`,
  `anycast`, `dns`, `tcp-handshake`, `service-mesh`, `runbook`, `postmortem`, `cdc`, `connection-pool`.
- **M32 (nuevos, cat `redes`):** `firewall`, `stateful-firewall`, `nftables`, `egress-filtering`,
  `security-group`, `nacl`, `ngfw`. (Quizá `dmz`, `micro-segmentacion`.)
- **M33 (nuevos, cat `seguridad`):** `hardening`, `fail2ban`, `mac-control` (control de acceso obligatorio:
  AppArmor/SELinux), `aide` (integridad de archivos), `rootkit`, `lynis`, `cis-benchmark`. (Quizá `2fa`.)
- **M34 (nuevos):** `systemd` (¿`basic`?), `journald`, `lvm`, `strace`, `backup-3-2-1`. (Varios son básicos de
  SysAdmin: marcar `basic: true` los muy comunes para no sobre-enlazar.)
- **M35 (nuevos):** `rbac`, `abac`, `acl`, `pgaudit`, `tde` (cifrado transparente), `mínimo-privilegio`
  (`minimo-privilegio`). Reutiliza `rls`, `audit-log`, `cdc`.
- **M36 (nuevos):** `funcion-hash`, `aead` (AES-GCM/ChaCha20-Poly1305), `nonce`, `salt`, `password-hashing`
  (Argon2/bcrypt), `pki`, `csprng`, `firma-digital`, `intercambio-claves`. Reutiliza `hmac`,
  `cifrado-simetrico`, `criptografia-asimetrica`, `diffie-hellman`, `forward-secrecy`, `certificado-tls`, `ca`.
- **M37 (nuevos, cat `nube`/`seguridad`):** `iam`, `hsm`, `secrets-manager`, `vpc`, `private-endpoint`,
  `scp-guardrail`, `incident-response`. Reutiliza `mtls`, `spiffe`, `kms`, `waf`, `zero-trust`, `audit-log`.

---

## 6. Módulos

### M32 — Firewalls a fondo

**Objetivo y encaje.** Enseñar el firewall como una de varias capas, no como la única defensa. Retoma M01
(paquetes, IP, puertos, TCP/UDP), M03 (gateways y proxies) y M08 (resiliencia). Deja claro dónde encaja el WAF
(se profundiza en M37/M28) y qué **no** resuelve un firewall de red (ataques en capa 7, credenciales robadas).

**Secciones (ids).**
- 32.1 `#que-es` — Qué hace y qué no hace un firewall; capas (L3/L4 vs L7); por qué no basta.
- 32.2 `#stateless-stateful` — Sin estado vs con estado (`stateful-firewall`): seguimiento de conexiones
  (conntrack), por qué una regla "permitir respuestas establecidas" es clave.
- 32.3 `#nftables` — nftables: tablas, cadenas, hooks (`input`/`forward`/`output`), familias (`inet`), sets y
  verdict maps; relación con iptables (mismo backend, otra sintaxis) y con los frontends.
- 32.4 `#frontends` — UFW y firewalld: cuándo usar cada uno, zonas de firewalld, por qué simplifican.
- 32.5 `#entrada-salida` — Filtrado de entrada (ingress) y de **salida** (`egress-filtering`): por qué bloquear
  la salida corta la exfiltración y el C2 (se nombra la defensa, no el ataque).
- 32.6 `#host-vs-red` — Firewall de host vs de red; defensa en profundidad; `dmz` y segmentación/
  `micro-segmentacion`.
- 32.7 `#nube` — En la nube: `security-group` (con estado, por recurso) vs `nacl` (sin estado, por subred);
  reglas por defecto; cómo se combinan. Enlaza a M37 (VPC) y M28 (borde).
- 32.8 `#ngfw-waf` — NGFW (`ngfw`) y WAF: qué agregan sobre un firewall de puertos; el WAF vive en L7 (reenvío a
  M37/M28). OWASP CRS (`owasp-crs`).
- 32.9 `#docker` — Docker y el firewall: por qué `docker run -p` publica puertos **saltándose UFW** (manipula
  iptables directo), y la solución (`DOCKER-USER`, `ufw-docker`). IPv6 (reglas duplicadas, no olvidarlo).
- 32.10 `#evasion` — **Ampliación del 2026-10-08** (pedido del usuario: cómo se evita un firewall o reverse proxy,
  cómo se detecta y cómo se combate). Enfoque estrictamente defensivo: patrón, señal de detección y arreglo, sin
  cadenas de intrusión ni técnicas de evasión reescritas. Mentalidad "asume la brecha" (`assume-breach`). Tabla de
  cinco caminos: túnel de salida/C2 (`c2`, `beaconing`), la capa que el firewall no inspecciona (app-layer), saltarse
  el WAF/reverse proxy, el acceso de confianza (credenciales, lateral) y el propio equipo de borde (CVE en
  firewall/VPN). Subsecciones `#origen` (origin lockdown con mTLS o secreto, request smuggling en clave defensiva),
  `#deteccion` (señales centralizadas, el egress como mejor detector, `threat-hunting`) y `#responder-evasion`
  (defensa en profundidad, contener sin avisar, rotar y reconstruir, cerrar el camino; reenvío a M37/M28).
- 32.11 `#fallos`, luego `#comprueba` + quiz (10) + ejercicio + checkpoint.

**Diagramas y figuras.**
- Fig 32.1 — **Capas donde actúa cada defensa.** Pila vertical: paquete → firewall L3/L4 (filtra IP/puerto) →
  LB/proxy L7 → WAF (filtra contenido) → app. Cajas `dg-layer` con el color de su capa; marca qué ve cada una.
- Fig 32.2 — **Con estado vs sin estado.** Dos mini-diagramas de secuencia (usar `seqdiag.py`): sin estado, cada
  paquete se evalúa aislado (hace falta regla de vuelta explícita); con estado, conntrack recuerda la conexión y
  la respuesta pasa por "established".
- Fig 32.3 — **nftables: tablas → cadenas → hooks.** Árbol: tabla `inet filter` con cadenas `input`, `forward`,
  `output` colgando de sus hooks del kernel; una regla de ejemplo con su veredicto (`accept`/`drop`).
- Fig 32.4 — **SG vs NACL en una VPC.** Subred con una NACL en el borde (sin estado, numerada) y dos instancias
  con sus SG (con estado). Muestra que la NACL evalúa entrada y salida por separado y el SG recuerda la conexión.
- Fig 32.5 — **El agujero de Docker.** `docker -p 8080:80` dibuja una flecha que entra por iptables por debajo de
  las reglas de UFW; al lado, la versión corregida con `DOCKER-USER`.

**Widgets.**
- `data-sim="firewall"` (archivo nuevo `widgets/sim-firewall.js`): un **paquete contra una cadena de reglas**.
  Chips para elegir el paquete (IP origen, puerto destino, estado: nuevo/established, protocolo) y una lista de
  reglas editable o predefinida; el widget evalúa regla por regla y muestra el veredicto y **por qué** (qué regla
  hizo match). Incluir un caso "sin la regla de established" para mostrar que un firewall sin estado rompe las
  respuestas. Reutilizar el patrón visual de `sim-rls.js` (tabla + chips + explicación), no hace falta animación.

**Quiz (8–9 preguntas).** Temas: con estado vs sin estado (por qué la regla de vuelta); qué capa ve un firewall
de puertos vs un WAF; SG (con estado) vs NACL (sin estado); por qué el filtrado de egress importa; el agujero de
Docker/UFW; orden de evaluación de reglas (primera que hace match); IPv6 olvidado.

**Ejercicio (estático).** Diseñar las reglas de entrada y salida de un servidor web con base de datos en otra
subred: qué puertos abrir, qué cerrar, egress mínimo, dónde va el WAF.

**Términos.** Nuevos: `firewall`, `stateful-firewall`, `nftables`, `egress-filtering`, `security-group`, `nacl`,
`ngfw` (y opcional `dmz`, `micro-segmentacion`). Reutiliza `waf`, `owasp-crs`, `ddos`, `nat`, `ip`, `puerto`,
`tcp-handshake`, `service-mesh`.

**Fuentes a verificar.** nftables wiki; Docker packet-filtering docs + `ufw-docker`; AWS SG vs NACL; NIST
SP 800-41. (Ver sección 4.)

**Promesas y enlaces.** Enlazar "(M32)"/"firewall" desde M03, M08, M28 y M37 cuando se publique. El WAF reenvía a
M37 `#waf` (o M28). SG/NACL reenvía a M37 `#vpc`.

---

### M33 — Hardening de servidores Linux

**Objetivo y encaje.** La guía más amplia de la Parte IV. Formato **"si no haces esto, el atacante hace esto"**.
Basada en How-To-Secure-A-Linux-Server (atribución obligatoria, ver 1.3). Prerrequisito M32. Incluye la sección
defensiva **"si el firewall no alcanza"**.

**Secciones (ids).**
- 33.0 (recuadro, antes de la 33.1) — **Atribución**: `callout` con crédito a Anchal Nigam, licencia CC BY-SA
  4.0 y enlace al repositorio.
- 33.1 `#modelo` — El modelo de amenaza del servidor: qué quiere el atacante (persistencia, credenciales,
  pivote), y la idea de defensa en capas. Presenta el formato "si no haces X, pasa Y".
- 33.2 `#ssh` — SSH: claves en vez de contraseña, `PasswordAuthentication no`, `PermitRootLogin no`,
  `AllowGroups`, puerto y `sshd_config` endurecido, 2FA. Enlaza al original.
- 33.3 `#cuentas` — Cuentas y privilegios: `sudo` en vez de root, `su`, grupos, principio de mínimo privilegio.
- 33.4 `#actualizaciones` — Actualizaciones automáticas (unattended-upgrades), NTP, por qué parchear a tiempo.
- 33.5 `#contrasenas` — Contraseñas y PAM: políticas, bloqueo tras intentos, contraseña de pánico (del original).
- 33.6 `#red` — Endurecer la red del host: UFW (reenvío a M32), Fail2Ban/CrowdSec (ban por intentos),
  `/proc` `hidepid`, servicios atados a `localhost`.
- 33.7 `#mac` — Control de acceso obligatorio (`mac-control`): AppArmor y SELinux, qué añaden sobre los permisos
  Unix (confinan un servicio aunque lo comprometan).
- 33.8 `#auditoria` — Auditoría e integridad: AIDE (`aide`, detecta cambios en archivos), rkhunter/chkrootkit
  (`rootkit`), ClamAV, Logwatch, Lynis (`lynis`, escáner de endurecimiento con puntaje), OSSEC.
- 33.9 `#sysctl` — `sysctl` y arranque: parámetros de red del kernel, contraseña de GRUB, umask, software
  huérfano. (Describir el efecto defensivo de cada `sysctl`, no como receta ciega.)
- 33.10 `#sin-firewall` — **"Si el firewall no alcanza"** (defensivo). Asume que el perímetro cayó:
  (a) inventario de lo expuesto (`ss -tulpen`, qué escucha y por qué); (b) reducir superficie (apagar servicios,
  atar a `localhost`); (c) mínimo privilegio y MAC; (d) control de egress (reenvío a M32); (e) detección y
  alertas (logs centralizados, AIDE, Fail2Ban); (f) respuesta (aislar, rotar credenciales, restaurar).
  **No describe cómo se evade un firewall.**
- 33.11 `#checklist` — Checklist final de endurecimiento (resumen accionable).
- 33.12 `#comprueba` + quiz + ejercicio + checkpoint.

**Diagramas y figuras.**
- Fig 33.1 — **Capas de defensa de un servidor.** Anillos concéntricos o pila: red (firewall) → cuentas/SSH →
  servicios con mínimo privilegio → MAC (AppArmor/SELinux) → auditoría/detección. Cada capa con "si falta, el
  atacante…".
- Fig 33.2 — **SSH: contraseña vs clave.** Secuencia (`seqdiag.py`): con contraseña, el atacante prueba
  (fuerza bruta, se defiende con Fail2Ban); con clave, no hay qué adivinar. Footer: servidor = tu VPS.
- Fig 33.3 — **Qué ve `ss -tulpen`.** Tabla-figura de puertos escuchando, cuál atado a `0.0.0.0` (expuesto) vs
  `127.0.0.1` (local): el inventario de exposición de la 33.10.
- Fig 33.4 — **AIDE: línea base e integridad.** Diagrama: se toma una base de datos de hashes de archivos, y una
  comprobación posterior marca lo que cambió (un binario modificado salta).

**Widgets.**
- `data-sim="hardening"` (archivo nuevo `widgets/sim-harden.js`): **checklist interactivo**. Lista de medidas
  (SSH con claves, root deshabilitado, auto-updates, Fail2Ban, AIDE, MAC, egress, …); al marcar/desmarcar cada
  una, muestra "qué pasa si no está" (la consecuencia defensiva) y un puntaje de endurecimiento tipo Lynis. Sin
  animación; reutiliza patrón de chips/estado.
- (Opcional) un bloque "antes/después" de `sshd_config` con pestañas (`div.tabs`), inseguro vs endurecido.

**Quiz (8–9).** Temas: por qué claves SSH > contraseñas; qué hace `PermitRootLogin no`; para qué sirve Fail2Ban;
qué detecta AIDE (integridad, no malware); qué añade AppArmor/SELinux sobre permisos Unix; qué significa "atar un
servicio a localhost"; la idea de "si el firewall no alcanza" (inventariar y reducir superficie).

**Ejercicio (guiado, `data-exercise="m33-hardening"`).** Un VPS recién creado expuesto a internet: el lector
decide, paso a paso, el orden de endurecimiento y por qué (SSH primero, luego superficie, luego detección).
Datos en `data/exercises/m33.data.js`. Debe pasar `quiz-bias.mjs`.

**Términos.** Nuevos: `hardening`, `fail2ban`, `mac-control`, `aide`, `rootkit`, `lynis`, `cis-benchmark`
(opcional `2fa`). Reutiliza `ssh`? (no existe; `firewall`, `egress-filtering` de M32).

**Fuentes a verificar.** How-To-Secure-A-Linux-Server (vigencia, secciones, licencia, autor); CIS Benchmarks;
NIST SP 800-123; `sshd_config` manpage; Fail2Ban/CrowdSec/AIDE/Lynis docs. (Ver 4.)

**Promesas y enlaces.** Enlaza a M32 (`#docker`, UFW, egress) y a M11 (logs/alertas). Deja indicio hacia M34
(operación) y M37 (nube).

---

### M34 — Operación y troubleshooting para SysAdmin

**Objetivo y encaje.** La guía de operación diaria: administrar y diagnosticar servidores. Menos "seguridad
ofensiva", más "mantener el sistema vivo y sano". Prerrequisitos M33 y M11 (observabilidad). Formato con
runbooks y árboles de decisión.

**Secciones (ids).**
- 34.1 `#usuarios` — Usuarios, grupos y permisos (repaso operativo; enlaza a M33 para la parte de seguridad).
- 34.2 `#systemd` — `systemd` y unidades: servicios, `systemctl`, dependencias, límites de recursos
  (`MemoryMax`, `CPUQuota`); `journald` y `journalctl` para logs.
- 34.3 `#discos` — Discos, particiones y LVM: crecer un volumen, snapshots, `df`/`du`, llenado de disco.
- 34.4 `#backups` — Backups y **pruebas de restauración**: regla 3-2-1, por qué un backup sin prueba de
  restauración no es un backup. Enlaza al audit/ledger de M27 solo como analogía de inmutabilidad.
- 34.5 `#troubleshooting` — Método de diagnóstico: síntoma → hipótesis → medición → arreglo. El árbol de
  decisión (ver figura).
- 34.6 `#cpu-mem` — CPU y memoria: `top`/`htop`, load average, `vmstat`, OOM killer, swap.
- 34.7 `#disco-red` — Disco y red: `iostat`, `ss`, `dig`, latencia y pérdida, `strace` para ver syscalls.
- 34.8 `#runbooks` — Runbooks y parches: cómo se escribe un runbook (retoma `runbook` de M11), ventanas de
  mantenimiento, parcheo sin downtime (enlaza a M11 `#migraciones`/despliegues).
- 34.9 `#comprueba` + quiz + ejercicio + checkpoint.

**Diagramas y figuras.**
- Fig 34.1 — **Árbol de decisión de troubleshooting.** "El servicio está lento" → ¿CPU? ¿memoria? ¿disco? ¿red?
  con la herramienta de cada rama (`top`, `vmstat`, `iostat`, `ss`). Cajas `dg-box` con flechas `dg-edge`.
- Fig 34.2 — **Anatomía de una unidad systemd.** Diagrama de estados: `inactive` → `activating` → `active` →
  `failed`, con `Restart=` y el watchdog. Reutilizar el estilo de la figura de ciclo de vida de M05.
- Fig 34.3 — **LVM en capas.** Discos físicos (PV) → grupo de volúmenes (VG) → volúmenes lógicos (LV); una flecha
  de "crecer el LV" sin tocar los datos.
- Fig 34.4 — **3-2-1.** 3 copias, 2 medios, 1 fuera de sitio; una flecha de "prueba de restauración" que cierra
  el ciclo.

**Widgets.**
- `data-sim="triage"` (archivo nuevo `widgets/sim-triage.js`): **lectura guiada de métricas**. Presenta un caso
  (load alto, poca CPU idle, mucho `wa` de I/O wait, por ejemplo) con valores de `top`/`vmstat`/`iostat` y pide
  al lector elegir el cuello de botella; explica cómo se lee cada número. 3–4 casos (CPU-bound, I/O-bound,
  memoria/OOM, red). Patrón de chips + explicación, sin animación.

**Quiz (8–9).** Temas: qué significa load average alto con CPU idle (I/O wait); para qué sirve `journalctl -u`;
cómo crecer un LV; por qué un backup sin prueba de restauración no cuenta; qué muestra `ss -s`; cuándo usar
`strace`; qué hace el OOM killer.

**Ejercicio (estático o guiado).** Un servidor que "se puso lento": el lector sigue el árbol de diagnóstico con
las salidas que se le dan y llega a la causa (disco lleno de logs, por ejemplo) y al arreglo.

**Términos.** Nuevos: `systemd` (`basic`? no, útil enlazar), `journald`, `lvm`, `strace`, `backup-3-2-1`.
Reutiliza `runbook`, `observabilidad`, `postmortem`.

**Fuentes a verificar.** systemd/journald man; LVM docs; manpages de `vmstat`/`iostat`/`ss`/`strace`; SRE Book
(runbooks). (Ver 4.)

**Promesas y enlaces.** Enlaza a M11 (observabilidad, runbooks, despliegues) y a M33 (endurecimiento). Indicio
hacia M35 (la base como servicio que se opera).

---

### M35 — Seguridad en bases de datos

**Objetivo y encaje.** Profundiza la seguridad de datos iniciada en M05 (RLS) y M10 (audit log, multi-tenant).
Prerrequisitos M05 y M10. Aquí viven las **tablas de bitácora**, **RBAC/ABAC/ACL** y el cifrado en la base.

**Secciones (ids).**
- 35.1 `#modelo` — El modelo de amenaza de una base: quién la toca (app, migraciones, analistas, backups), qué
  se protege (filas, columnas, credenciales). Mínimo privilegio por servicio (`minimo-privilegio`).
- 35.2 `#rbac` — RBAC (`rbac`): roles, jerarquías de roles, roles de aplicación vs de persona. Retoma roles/
  `GRANT` de M05 `#rls`.
- 35.3 `#abac` — ABAC (`abac`): atributos (del sujeto, del recurso, del entorno) y políticas; cuándo ABAC supera
  a RBAC (NIST SP 800-162). Relación con RLS (una política de fila es ABAC aplicado en la base).
- 35.4 `#acl` — ACLs (`acl`): listas por objeto; comparación RBAC vs ABAC vs ACL (tabla).
- 35.5 `#bitacora` — Tablas de bitácora/auditoría **dentro** de la base: triggers de auditoría, `pgaudit`
  (`pgaudit`), CDC (`cdc`) como fuente. Diferencia con el log de auditoría de aplicación de M10 (`audit-log`).
- 35.6 `#cifrado-datos` — Cifrado en la base: en reposo (TDE, `tde`), a nivel de columna (`pgcrypto`, enlaza a
  envelope de M10), y cuándo no alcanza (la app ve el claro). Datos sensibles y seudonimización.
- 35.7 `#credenciales` — Credenciales y secretos de la base: rotación, no incrustar la contraseña, mínimo
  privilegio del rol de la app; reenvío a M37 (secrets manager).
- 35.8 `#comprueba` + quiz + ejercicio + checkpoint.

**Diagramas y figuras.**
- Fig 35.1 — **RBAC vs ABAC vs ACL.** Tres mini-esquemas: RBAC (sujeto→rol→permiso), ABAC (política evalúa
  atributos), ACL (objeto→lista de sujetos). Misma escena, tres modelos.
- Fig 35.2 — **Trigger de auditoría.** Secuencia: un `UPDATE` dispara un trigger que escribe la fila vieja y la
  nueva en `audit_log`; append-only. Reutiliza el esquema `audit_events` de M10 como punto de partida.
- Fig 35.3 — **Quién se conecta con qué rol.** La app con `app_rw`, las migraciones con el dueño, el analista con
  un rol de solo lectura con RLS; `pg_dump` con BYPASSRLS. (Extiende la figura de M05.)

**Widgets.**
- `data-sim="rbac"` (archivo nuevo `widgets/sim-rbac.js`): **un sujeto, una acción, un recurso** contra las
  políticas. Chips: rol/atributos del sujeto, acción, recurso; el widget evalúa bajo RBAC y bajo ABAC y muestra
  permitido/denegado y por qué. Reutiliza el patrón de `sim-rls.js`.
- Reutilizar `data-sim="rls"` de M05 con un enlace ("ya lo viste en M05").

**Quiz (8–9).** Temas: RBAC vs ABAC (cuándo cada uno); por qué una política RLS es ABAC en la base; qué registra
`pgaudit` vs el audit log de la app; por qué cifrar columnas no protege del propio servicio de la app; mínimo
privilegio del rol de la app; rotación de credenciales.

**Ejercicio (estático).** Diseñar los roles y políticas de un SaaS multi-tenant con analistas: qué rol para la
app, cuál para analistas (solo lectura + RLS), cómo auditar accesos, qué columnas cifrar.

**Términos.** Nuevos: `rbac`, `abac`, `acl`, `pgaudit`, `tde`, `minimo-privilegio`. Reutiliza `rls`, `audit-log`,
`cdc`, `envelope`, `gdpr`, `crypto-shredding`, `connection-pool`.

**Fuentes a verificar.** PostgreSQL GRANT/roles, pgaudit, pgcrypto; NIST RBAC y SP 800-162 ABAC. (Ver 4.)

**Promesas y enlaces.** Cierra el reenvío que M10 `#audit-log` hace a M35 ("las tablas de bitácora dentro de la
base se tratan en M35"). Enlaza a M05 `#rls` y M10 `#multitenant`/`#audit-log`/`#cifrado`. Indicio a M37.

---

### M36 — Criptografía desde cero

**Objetivo y encaje.** Criptografía para principiantes, con laboratorios. Da el vocabulario que M10, M35 y M37
dan por sabido (hash, HMAC, AES-GCM, claves, firmas, certificados). Reutiliza `SD.crypto` (SHA-256, HMAC,
base64url) para que los laboratorios corran en el navegador sin red.

**Secciones (ids).**
- 36.1 `#intro` — Qué resuelve la criptografía: confidencialidad, integridad, autenticidad, no repudio. Qué
  **no** resuelve (no es magia; el error está casi siempre en el uso).
- 36.2 `#hash` — Funciones hash (`funcion-hash`): propiedades (una vía, resistencia a colisiones), SHA-2/3, para
  qué sirven (huellas, integridad) y para qué **no** (no cifran, no guardan contraseñas por sí solas).
- 36.3 `#hmac` — HMAC (`hmac`, ya existe): integridad con clave compartida; por qué `hash(clave||mensaje)` es
  frágil y HMAC no. Laboratorio.
- 36.4 `#simetrico` — Cifrado simétrico (`cifrado-simetrico`): AES, modos, y por qué se usa **AEAD** (`aead`):
  AES-GCM y ChaCha20-Poly1305 cifran y autentican a la vez. El `nonce` (`nonce`) y por qué no se repite.
- 36.5 `#asimetrico` — Cifrado asimétrico (`criptografia-asimetrica`): clave pública/privada, RSA vs curvas
  elípticas; cifrar vs firmar; por qué es lento y se usa para intercambiar una clave simétrica.
- 36.6 `#firmas` — Firmas digitales (`firma-digital`): firmar con la privada, verificar con la pública;
  integridad + autenticidad + no repudio (`no-repudio`). Relación con JWT (M10).
- 36.7 `#intercambio` — Intercambio de claves (`intercambio-claves`): Diffie-Hellman (`diffie-hellman`), forward
  secrecy (`forward-secrecy`); cómo dos partes acuerdan una clave sin enviarla.
- 36.8 `#certificados` — Certificados y PKI (`pki`): X.509, cadena de confianza, la CA (`ca`,
  `certificado-tls`); cómo TLS 1.3 (M01) usa todo esto junto.
- 36.9 `#contrasenas` — Contraseñas: por qué un hash rápido (SHA-256) es malo para contraseñas, `salt` (`salt`)
  y hashes lentos (`password-hashing`: Argon2id, bcrypt, scrypt). Retoma el login de M10.
- 36.10 `#aleatoriedad` — Aleatoriedad (`csprng`): CSPRNG vs PRNG; por qué un nonce/clave predecible rompe todo.
- 36.11 `#errores` — Errores comunes: reusar nonce, clave hardcodeada, ECB, comparar MAC sin tiempo constante,
  "rodar tu propia cripto". (Defensivo: el error y el arreglo.)
- 36.12 `#comprueba` + quiz + ejercicio + checkpoint.

**Diagramas y figuras.**
- Fig 36.1 — **Los cuatro objetivos.** Tabla-figura: confidencialidad→cifrado; integridad→hash/HMAC;
  autenticidad→firma/MAC; no repudio→firma. Qué herramienta da cada uno.
- Fig 36.2 — **Simétrico vs asimétrico.** Dos esquemas lado a lado: misma clave para cifrar/descifrar vs par
  pública/privada; y el patrón híbrido (asimétrico para intercambiar la clave, simétrico para los datos).
- Fig 36.3 — **Firma y verificación.** Secuencia: emisor hashea → firma con privada → envía; receptor verifica
  con la pública. Footer con un caso real (un JWT, un paquete de software).
- Fig 36.4 — **Cadena de confianza (PKI).** CA raíz → CA intermedia → certificado del servidor; el navegador
  confía en la raíz. Conecta con TLS de M01.
- Fig 36.5 — **Diffie-Hellman (analogía de los colores).** La analogía clásica de mezclar pinturas: color común
  público, secreto de cada uno, mezcla final igual sin enviar el secreto.

**Widgets (reutilizan `SD.crypto`).**
- `data-calc="hash"` (en archivo nuevo `widgets/sim-crypto.js`): escribe un texto, ve su SHA-256; cambia un
  carácter y mira el efecto avalancha. Muestra que el hash no se invierte.
- `data-calc="hmac"`: texto + clave → HMAC; cambiar la clave cambia todo; sin la clave no se puede recomputar.
- `data-sim="sign"`: laboratorio de firma paso a paso (hash → "firmar" → verificar), con un caso de manipulación
  que falla la verificación. (Puede simular la firma con HMAC si no hay asimétrico en `SD.crypto`; dejar claro
  que es una analogía de la mecánica, con `badge--ref`.)
- (Opcional) `data-calc="pwhash"`: mostrar por qué un hash lento tarda a propósito (comparar "intentos por
  segundo" de SHA-256 vs Argon2, con cifras documentadas, no medidas en el navegador).

**Quiz (8–9).** Temas: qué garantiza un hash y qué no; por qué HMAC y no `hash(clave||msg)`; por qué AEAD (nonce
único); simétrico vs asimétrico (y el híbrido); firmar vs cifrar; qué es forward secrecy; por qué Argon2 y no
SHA-256 para contraseñas; por qué no reusar nonce; por qué no inventar tu propia cripto.

**Ejercicio (guiado, `data-exercise="m36-cripto"`).** Diseñar el cifrado de un campo sensible y el guardado de
contraseñas de una app: qué algoritmo para qué, dónde vive la clave (enlaza a KMS/M10), cómo se guardan las
contraseñas. Datos en `data/exercises/m36.data.js`.

**Términos.** Nuevos: `funcion-hash`, `aead`, `nonce`, `salt`, `password-hashing`, `pki`, `csprng`,
`firma-digital`, `intercambio-claves`. Reutiliza `hmac`, `cifrado-simetrico`, `criptografia-asimetrica`,
`diffie-hellman`, `forward-secrecy`, `certificado-tls`, `ca`, `no-repudio`, `kms`, `envelope`, `jwt`.

**Fuentes a verificar.** FIPS 197/198/180-4/202/186-5; SP 800-38D/90A/132; RFC 8439/9106/7914/5280/8446; OWASP
Cryptographic Storage Cheat Sheet. (Ver 4.)

**Promesas y enlaces.** Enlaza desde M10 (`#tokens`, `#cifrado`), M01 (TLS), M35 (cifrado de columnas) y M37
(KMS/mTLS/PKI). Al publicarse, mover el `deep` de `hmac`, `cifrado-simetrico`, `criptografia-asimetrica`,
`diffie-hellman`, `forward-secrecy`, `certificado-tls`, `ca` a `m36#…` (hoy apuntan a otros módulos; revisar con
`links.mjs`).

---

### M37 — Arquitecturas seguras en la nube

**Objetivo y encaje.** Cierra la Parte IV subiendo a la arquitectura: cómo se arma un sistema seguro en la nube.
Reúne IAM, mTLS, KMS, secretos, WAF, VPC, zero trust y auditoría. Prerrequisitos M32, M36, M10, M28.

**Secciones (ids).**
- 37.1 `#modelo` — Modelo de responsabilidad compartida y superficie de ataque en la nube; el principio rector:
  mínimo privilegio en todo.
- 37.2 `#iam` — IAM (`iam`): identidades, políticas, roles, condiciones; roles de carga de trabajo en vez de
  llaves largas; el error del comodín `*`.
- 37.3 `#red` — Red: VPC (`vpc`), subredes públicas/privadas, endpoints privados (`private-endpoint`), SG/NACL
  (reenvío a M32); salida controlada. Dónde va el WAF (`waf`, reenvío a M28).
- 37.4 `#mtls` — Identidad entre servicios: mTLS (`mtls`) y SPIFFE/SPIRE (`spiffe`); por qué la red no alcanza y
  cada servicio prueba quién es. Retoma M10 `#servicios` y M03 `service-mesh`.
- 37.5 `#kms` — Claves y secretos: KMS/HSM (`kms`, `hsm`), envelope (M10), gestores de secretos
  (`secrets-manager`), rotación. Reenvío a M36 (criptografía) y M10 (envelope, crypto-shredding).
- 37.6 `#zero-trust` — Zero trust (`zero-trust`, NIST SP 800-207): "nunca confíes, siempre verifica"; identidad
  en cada salto, microsegmentación (M32). Contrasta con el modelo de perímetro.
- 37.7 `#auditoria` — Auditoría y guardarraíles: CloudTrail (`audit-log`), SCP/Organizations (`scp-guardrail`),
  detección.
- 37.8 `#incidentes` — Respuesta a incidentes (`incident-response`): detectar, contener, erradicar, recuperar,
  aprender; rotar credenciales; el postmortem (M11). Reutiliza el caso Capital One (SSRF) como hilo.
- 37.9 `#comprueba` + quiz + ejercicio + checkpoint.

**Diagramas y figuras.**
- Fig 37.1 — **Arquitectura segura de referencia.** Una VPC con subred pública (LB/WAF) y privada (servicios,
  base), IAM por servicio, KMS y secrets manager aparte, CloudTrail capturando todo, mTLS entre servicios.
  Usar `dg-layer` por capa; marcar qué cruza cada frontera.
- Fig 37.2 — **Perímetro vs zero trust.** Izquierda: castillo con foso (una muralla, dentro todo confía).
  Derecha: cada servicio verifica identidad en cada salto. Muestra por qué el perímetro solo no basta.
- Fig 37.3 — **mTLS con SPIFFE.** Secuencia: dos servicios presentan sus certificados de identidad (SVID),
  cada uno verifica al otro antes de hablar. Footer: servicio A/servicio B, autoridad = SPIRE.
- Fig 37.4 — **Ciclo de respuesta a incidentes.** Detectar → contener → erradicar → recuperar → aprender, en
  anillo, con el postmortem cerrando.
- (Opcional) un **mapa explorable** `data/maps/m37-nube.data.js` con la arquitectura de 37.1 y 3–4 escenarios
  (request normal por el WAF, un servicio que pide un secreto al KMS, un SSRF contenido por IMDSv2, una
  credencial rotada). Solo si el tiempo lo permite; si no, basta la Fig 37.1 estática.

**Widgets.**
- `data-calc="iam"` (opcional, `widgets/sim-cloud.js`): evaluar una política IAM contra una acción/recurso y
  mostrar permitido/denegado y por qué (el peligro del `*`). Patrón de chips.
- Si se hace el mapa, usar `map-engine.js`/`flow-sim.js` con `stepPanel: true`.

**Quiz (8–9).** Temas: por qué roles en vez de llaves largas; el peligro del `*` en IAM; subred privada +
endpoint privado; por qué mTLS si ya hay VPC; qué es zero trust; para qué SCP/guardrails; los pasos de respuesta
a incidentes; qué fue el SSRF de Capital One y cómo lo corta IMDSv2 (retoma M10).

**Ejercicio (guiado, `data-exercise="m37-nube"`).** Endurecer la arquitectura de un producto de IA (reutiliza el
de M10/M21): VPC, IAM por servicio, KMS, secretos, WAF, mTLS, auditoría; el lector decide capa por capa. Datos
en `data/exercises/m37.data.js`.

**Términos.** Nuevos: `iam`, `hsm`, `secrets-manager`, `vpc`, `private-endpoint`, `scp-guardrail`,
`incident-response`. Reutiliza `mtls`, `spiffe`, `kms`, `envelope`, `waf`, `zero-trust`, `audit-log`, `ssrf`,
`service-mesh`, `owasp-crs`, `crypto-shredding`.

**Fuentes a verificar.** AWS IAM/KMS/Secrets Manager/CloudTrail/Organizations; SPIFFE/SPIRE; NIST SP 800-207;
caso Capital One (ya verificado). (Ver 4.)

**Promesas y enlaces.** Cierra los reenvíos "(M37)" de M32 (WAF, VPC, SG/NACL) y M35 (secretos). Enlaza a M10
(`#servicios`, `#cifrado`), M28 (WAF/borde), M03 (service mesh), M36 (criptografía). Indicio a CP-E.

---

### M38 — Active Directory: cómo se ataca y cómo se defiende

**Objetivo y encaje.** Active Directory (AD) es el directorio de identidades de casi toda empresa con Windows:
quién es cada usuario y cada máquina, a qué grupos pertenece y qué puede tocar. Por eso es el objetivo número
uno de un intrusor dentro de una red corporativa: quien controla el dominio controla todo lo que está unido a
él, y el ransomware moderno suele desplegarse **desde** el dominio (una GPO, una tarea programada en todas las
máquinas). El módulo enseña AD como lo necesita un SysAdmin que lo defiende: cómo funciona (Kerberos, NTLM,
LDAP, GPO), **qué abusa cada ataque conocido y qué rastro deja**, y cómo se corta cada uno. Prerrequisitos
sugeridos: M33 (hardening), M34 (operación), M36 (criptografía: claves simétricas, hashes, firmas), M10
(identidad y mínimo privilegio), M11 (logs, alertas, incidentes).

**Restricción (repite 1.1, aplica con más fuerza aquí).** Cada ataque se explica a nivel de **concepto**: qué
debilidad de diseño o de configuración abusa, qué consigue el atacante, qué evento deja en los logs y qué control
lo impide. **Nunca** se escriben comandos ofensivos, nombres de opciones de herramientas de ataque, payloads,
pasos ordenados de una intrusión ni técnicas para evitar la detección. Los únicos comandos del módulo son de
administración, auditoría y detección (PowerShell del módulo `ActiveDirectory`, `Get-ADUser`, `auditpol`,
consultas de eventos, Group Policy). Las herramientas de auditoría que también usan los atacantes (BloodHound,
PingCastle) se presentan **solo en su uso defensivo**: cómo el equipo de defensa encuentra y cierra rutas de
ataque antes que nadie. La premisa del usuario, "para defender hay que entender cómo atacan", se cumple
explicando el **mecanismo** y su **rastro**, no el procedimiento.

**Secciones (ids).**
- 38.1 `#que-es` — Qué es AD: dominio, bosque, controlador de dominio (DC), unidades organizativas (OU),
  objetos, grupos, GPO, DNS integrado, replicación, roles FSMO. Por qué el DC es la joya de la corona.
  Analogía: el registro civil y la cerradura maestra de un edificio en un mismo lugar.
- 38.2 `#kerberos` — Kerberos paso a paso: AS-REQ/AS-REP (TGT), TGS-REQ/TGS-REP (ticket de servicio),
  AP-REQ; la cuenta `krbtgt` y por qué su clave firma todos los TGT; preautenticación; tipos de cifrado (RC4 vs
  AES) y por qué RC4 es el punto débil. NTLM como protocolo heredado: desafío-respuesta con el hash de la
  contraseña, sin autenticar al servidor. Retoma M36 (claves simétricas, hashes).
- 38.3 `#ataques` — Cómo atacan, a nivel de concepto. Tabla con una fila por técnica: qué abusa, qué consigue,
  qué rastro deja, qué la corta. Técnicas (nombrar, no detallar procedimiento):
  - **Password spraying**: pocas contraseñas comunes contra muchas cuentas. Rastro: 4625/4771 repartidos.
    Defensa: MFA, lista de contraseñas prohibidas, política de bloqueo inteligente.
  - **Kerberoasting**: cualquier usuario del dominio puede pedir un ticket de servicio; el ticket va cifrado con
    la clave de la cuenta de servicio, y si la contraseña es débil se puede adivinar fuera de línea. Rastro:
    4769 con cifrado RC4 (0x17) en ráfaga. Defensa: gMSA, AES obligatorio, contraseñas largas.
  - **AS-REP roasting**: cuentas con la preautenticación desactivada. Rastro: 4768 sin preautenticación.
    Defensa: no desactivarla nunca; auditar el atributo.
  - **Robo y reutilización de credenciales** (pass-the-hash, pass-the-ticket): NTLM acepta el hash en lugar de
    la contraseña; un admin que inicia sesión en una máquina comprometida deja credenciales en memoria.
    Defensa: tiering, LAPS, Credential Guard, Protected Users, no iniciar sesión con cuentas de admin en
    estaciones de trabajo.
  - **Relay de NTLM**: reenviar una autenticación NTLM a otro servidor. Defensa: firma SMB obligatoria, firma
    LDAP y channel binding, EPA, reducir NTLM.
  - **Abuso de ACL y rutas de ataque**: permisos delegados de más (GenericAll, WriteDACL, miembro de un grupo
    que administra a otro) encadenados hasta Domain Admins. Defensa: auditar rutas con BloodHound o PingCastle,
    AdminSDHolder, limpiar delegaciones.
  - **Delegación sin restricciones**: un servidor que guarda los TGT de quien se conecta. Defensa: delegación
    restringida o basada en recursos, "la cuenta es sensible y no se puede delegar", Protected Users.
  - **AD CS mal configurado** (plantillas de certificados que permiten pedir un certificado a nombre de otro):
    concepto de la investigación "Certified Pre-Owned" (SpecterOps, 2021). Defensa: auditar plantillas,
    aprobación del administrador, parches.
  - **DCSync**: una cuenta con permisos de replicación pide al DC los hashes de todos. Rastro: 4662 con los GUID
    de replicación desde una máquina que no es DC. Defensa: auditar quién tiene esos permisos.
  - **Golden Ticket y Silver Ticket**: con la clave de `krbtgt` (o de un servicio) se fabrican tickets válidos.
    Defensa: el DC es tier 0; rotar `krbtgt` **dos veces** (esperando la replicación entre una y otra) tras un
    compromiso, y periódicamente.
  - **GPP con contraseñas** (histórico, MS14-025): contraseñas en `SYSVOL` cifradas con una clave pública
    conocida. Defensa: buscarlas y borrarlas; enseña por qué los secretos no van en la configuración.
- 38.4 `#tiering` — El modelo de niveles y el Enterprise Access Model de Microsoft: plano de control (tier 0:
  DC, AD CS, Entra Connect, ADFS, backups del DC), plano de gestión, plano de datos y usuarios. Reglas: una
  cuenta de tier 0 nunca inicia sesión en un tier inferior; estaciones de acceso privilegiado (PAW); cuentas
  admin separadas de las de uso diario. Fig 38.2.
- 38.5 `#endurecer` — Controles concretos, como checklist: Windows LAPS (contraseña de admin local única y
  rotada en cada máquina), grupo Protected Users, gMSA para servicios, AES y desactivar RC4 donde se pueda,
  Credential Guard, firma SMB y LDAP, channel binding, reducir y auditar NTLM (con el camino a desactivarlo),
  política de contraseñas y lista de prohibidas, MFA para todo acceso remoto y privilegiado, Tier 0 vacío de
  cuentas de servicio, Papelera de reciclaje de AD, GPO de auditoría avanzada. Cada control con su "si no lo
  haces" y el comando o la GPO **de administración** para verificarlo.
- 38.6 `#detectar` — Qué eventos mirar y por qué: 4624 (inicio de sesión y su tipo), 4625, 4768, 4769 (con tipo
  de cifrado), 4771, 4662, 4672, 4720, 4728/4732/4756 (alta en grupos privilegiados), 5136 (cambio en un
  objeto), 4741/4742. Política de auditoría avanzada necesaria para que existan. Cuentas señuelo (honeytokens)
  y alertas sobre su uso. Microsoft Defender for Identity como opción gestionada. Enlaza a M11 (alertas por
  síntoma, runbooks).
- 38.7 `#hibrido` — AD híbrido con Entra ID: Entra Connect como tier 0, sincronización de hashes vs
  autenticación de paso, acceso condicional y MFA, por qué un compromiso en un lado alcanza al otro.
- 38.8 `#recuperar` — Respuesta y recuperación: aislar, rotar `krbtgt` dos veces, restablecer cuentas
  privilegiadas, revisar GPO y tareas programadas, backups de estado del sistema **fuera de línea**,
  restauración autoritativa, guía de recuperación del bosque de Microsoft. Caso real: NotPetya en Maersk (2017),
  que perdió todos sus DC salvo uno que estaba apagado por un corte de luz en Ghana. Retoma el postmortem de M11.
- 38.9 `#comprueba` + quiz + ejercicio.

**Diagramas y figuras.**
- Fig 38.1 — **Kerberos en una lámina** (formato Lámina de M11: marcas numeradas y clave). Cliente, KDC (AS y
  TGS dentro del DC), servicio; los tres intercambios con qué va cifrado con qué clave (la del usuario, la de
  `krbtgt`, la del servicio). Las marcas señalan dónde actúa cada ataque de 38.3 (sin procedimiento: "aquí el
  ticket va cifrado con la clave del servicio; si esa contraseña es débil…") y qué evento se registra en cada
  paso (4768, 4769, 4624).
- Fig 38.2 — **Tiering.** Tres anillos o franjas (tier 0, 1, 2) con qué vive en cada uno, y las flechas
  permitidas (de arriba hacia abajo para administrar) y prohibidas (un admin de tier 0 entrando a una estación
  de tier 2), marcadas con una cruz.
- Fig 38.3 — **Una ruta de ataque y dónde se corta.** Grafo: usuario de phishing → estación → credencial de admin
  en caché → servidor → grupo con permiso de más → Domain Admins. Cada arista con el control que la corta (LAPS,
  tiering, Protected Users, limpieza de ACL). Es la base del widget.
- Fig 38.4 — **Línea de tiempo de detección.** Los eventos que deja una intrusión típica, en orden, con cuáles
  disparan alerta y cuáles solo sirven después, en la investigación.

**Widgets.**
- `data-sim="adpaths"` (`widgets/sim-ad.js`): **rutas de ataque y defensas.** Un grafo fijo de identidades y
  máquinas (como Fig 38.3, 10–14 nodos) con las rutas posibles hasta tier 0. El lector activa controles (chips:
  LAPS, tiering, Protected Users, gMSA, AES, firma SMB, limpieza de ACL, MFA) y ve qué aristas desaparecen y si
  queda alguna ruta. Muestra "rutas restantes: N" y la más corta. Es un modelo defensivo: no hay pasos de
  ataque, solo qué relación de confianza existe y qué control la elimina. Lógica: BFS sobre aristas activas;
  cada arista lista los controles que la cortan.
- `data-calc="adevents"` (opcional): lector guiado de eventos. Se muestra un lote de eventos de ejemplo
  (inventados, marcados como tales) y el lector elige qué patrón ve (spraying, kerberoasting, alta en Domain
  Admins, DCSync desde una estación). Patrón de chips con explicación.
- Si se hace la Fig 38.1 animada, reutilizar `SD.flowAnim` (sim-dbflow.js) con `deco` por paso, como
  `sim-traceprop.js` de M11.

**Quiz (9–10).** Temas: por qué el DC es tier 0; qué clave firma un TGT y qué implica perderla; por qué
kerberoasting funciona con cualquier usuario y por qué gMSA lo neutraliza; qué evento delata una ráfaga de
tickets RC4; qué resuelve LAPS; por qué rotar `krbtgt` dos veces; qué hace el grupo Protected Users; firma SMB
contra relay de NTLM; qué es una ruta de ataque por ACL y cómo se audita; la lección de Maersk sobre backups
fuera de línea.

**Ejercicio (guiado, `data-exercise="m38-ad"`).** Auditar un dominio de ejemplo descrito en una tabla (cuentas,
grupos, SPN, atributos, delegaciones, quién inicia sesión dónde): el lector marca cada hallazgo, su riesgo y su
arreglo, en orden de prioridad. Solución de referencia plegable. Datos en `data/exercises/m38.data.js`.

**Términos.** Nuevos (cat `seguridad`, verificar con grep): `active-directory`, `controlador-dominio`,
`kerberos`, `tgt`, `krbtgt`, `ntlm`, `gpo`, `kerberoasting`, `pass-the-hash`, `ntlm-relay`, `dcsync`,
`golden-ticket`, `ruta-ataque`, `tiering`, `paw`, `laps`, `gmsa`, `protected-users`, `honeytoken`. Reutiliza
`mfa`, `zero-trust`, `audit-log`, `runbook`, `postmortem`, `incident-response` (de M37 si ya existe),
`minimo-privilegio` (de M35 si ya existe).

**Fuentes a verificar.** (Ver 4, bloque "Active Directory (M38)".) Verificar sobre todo: disponibilidad y
versiones de Windows LAPS; estado actual de la deprecación de NTLM y de NTLMv1; valores por defecto de firma
SMB y LDAP en Windows Server 2025 y Windows 11 24H2; comportamiento exacto de Protected Users (sin NTLM, sin
DES/RC4 en preautenticación, sin delegación, TGT de 4 h); intervalo de rotación de gMSA; IDs de evento y sus
campos.

**Promesas y enlaces.** Retoma M10 (identidad, mínimo privilegio), M11 (alertas, runbook, postmortem), M33
(hardening del host), M34 (operación, backups), M36 (criptografía de Kerberos), M37 (IAM y zero trust en la
nube; Entra ID). Indicio a CP-E: la plataforma de CP-E puede incluir un dominio.

---

### CP-E — Checkpoint E: endurece una plataforma

**Objetivo y encaje.** Examen integrador de la Parte IV + un diseño: tomar una plataforma y endurecerla del
firewall a la nube, **asumiendo que el atacante ya entró** (defensa en profundidad). Formato del Checkpoint A.

**Estructura (ids).**
- `#examen` — 20 preguntas de quiz (`cpe` en `quizzes/cpe.data.js`) que recorren M32–M38: firewalls (estado,
  SG/NACL, egress), hardening (SSH, MAC, auditoría), operación (triage, backups), BD (RBAC/ABAC, bitácora,
  cifrado), criptografía (hash/HMAC/AEAD/firmas/contraseñas) y nube (IAM, mTLS, zero trust, respuesta).
- `#diseno` — Ejercicio de diseño con solución de referencia plegable (`details.solution`): endurecer la
  plataforma del producto de IA (reutilizar el sistema de M10/M21/M37), capa por capa, con la premisa de la
  brecha asumida. Qué se hace en cada capa, qué detecta el ataque, cómo se responde.
- `<div data-checkpoint="cpe">` al final.

**Diagramas.** Reutiliza la Fig 37.1 (arquitectura de referencia) como base del enunciado, anotada con las
capas de defensa de cada módulo.

**Quiz.** 20 preguntas, pasa `quiz-bias.mjs`. Distribución ~3–4 por módulo de la Parte IV.

**Términos.** Ninguno nuevo; reutiliza los de M32–M38.

**Promesas y enlaces.** Es el cierre de la parte; enlaza a cada módulo de la Parte IV en la solución.

---

## 7. Infraestructura compartida a crear (una vez)

- **Widgets nuevos** (archivos en `assets/js/widgets/`), todos patrón IIFE + `SD.h`, init en `SD.ready`:
  `sim-firewall.js` (M32), `sim-harden.js` (M33), `sim-triage.js` (M34), `sim-rbac.js` (M35),
  `sim-crypto.js` (M36, reutiliza `SD.crypto`), `sim-cloud.js` (M37, opcional), `sim-ad.js` (M38). Documentar cada uno en la tabla
  de widgets de `CLAUDE.md` al crearlo.
- **CSS**: estilos propios de cada widget en `components.css` (reutilizar al máximo `.sim-*`, `.chip-btn`, y el
  patrón de `sim-rls.js`: tabla + chips + explicación). No agregar tonos de color nuevos; usar tokens.
- **Ejercicios guiados** (si se usan): `data/exercises/m33.data.js`, `m36.data.js`, `m37.data.js`, con
  `SD.defineExercise('mNN-…')`. Cargar `core/exercise.js` y el `.data.js` en la página (META `"exercises": true`).
- **Datos de mapa** (solo M37, opcional): `data/maps/m37-nube.data.js`.

---

## 8. Encadenamiento: menciones a convertir en enlaces al publicar

(Confirmar con `grep -n "MNN" modules/*.html` al implementar cada módulo.)

- **M32** publicado → enlazar "firewall"/"(M32)" en M03, M08, M28, M37; WAF/SG/NACL reenvían a M37.
- **M33** → enlazar hardening/SSH desde M34, M37; "(M33)".
- **M34** → enlazar operación/runbooks desde M11, M33.
- **M35** → **cerrar** el reenvío de M10 `#audit-log` ("las tablas de bitácora… M35"); enlazar desde M05, M10.
- **M36** → enlazar criptografía desde M01 (TLS), M10 (tokens/cifrado), M35, M37; **mover `deep`** de los
  términos de cripto que hoy viven en otros módulos.
- **M37** → **cerrar** reenvíos "(M37)" de M32 y M35; enlazar desde M10, M28, M03.

---

## 9. Checklist de cierre por módulo (pruebas)

Para cada módulo, antes de darlo por hecho:

1. `node tools/test/test-page.mjs <carpeta_existente> mNN-….html` → **0 errores de consola**, **0 términos
   faltantes**, quiz OK, cada escenario del mapa corre (si hay), **0 desborde a 390&#8239;px**.
2. `node tools/test/links.mjs modules/mNN-….html` → **0 problemas**; luego `links.mjs` sin argumentos si se
   movió algún `deep` o se agregaron términos que podrían autoenlazarse en otras páginas.
3. `node tools/test/quiz-bias.mjs assets/js/data/quizzes/mNN.data.js` → pasa (y el ejercicio guiado, si hay).
4. `node tools/test/shots.mjs` en **claro, oscuro y 390&#8239;px** de las figuras, los widgets y (si hay) el
   mapa: sin etiquetas pisadas, sin desbordes.
5. Si hay ejercicio guiado, resolverlo de punta a punta con `shots.mjs` y pasos `eval:` (ver "Trucos" de
   `CLAUDE.md`): todas las decisiones `single`/`multi` coinciden con la referencia.
6. `course.data.js`: `status: 'ready'` y `mins` ajustado. Verificar que `index.html` muestra el módulo en la
   Parte IV y que el anterior/siguiente funciona.
7. Convertir las menciones "(MNN)" de otros módulos en enlaces (sección 8). Actualizar `PROGRESO.md` (qué quedó
   hecho + bloque "Siguiente" para los dos módulos que vienen) y la tabla de widgets/estructura de `CLAUDE.md`.

---

## 10. Riesgos y notas

- **Clasificador de seguridad.** Mantener todo defensivo (sección 1.1). Si un tema roza lo ofensivo, describir
  el concepto y la defensa, nunca el procedimiento reproducible. No reintentar el enfoque "cómo saltar un
  firewall" que fue bloqueado antes.
- **Licencia de M33.** Prosa propia + atribución + enlaces (sección 1.3). No copiar bloques del original.
- **No inventar cifras.** Todo número con fuente (`badge--doc`) o cuenta a la vista; lo reconstruido con
  `badge--ref`.
- **Tamaño.** Cada módulo se escribe de a uno, por pedido. No intentar los seis de una vez.
