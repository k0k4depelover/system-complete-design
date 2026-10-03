# Envuelve un fragmento con el esqueleto de una guía de proyecto (proyectos/aNN-*.html).
# Uso: python tools/mkguide.py fragmento.html   (el fragmento empieza con <!--META {...}-->)
# Solo para CREAR guías nuevas: una vez generada, la página en proyectos/ es la fuente de verdad y se edita directo.
#
# META: id, num, file, title, desc, lead, block ("Bloque 1"), time ("3 a 4 h"), mods ("M00, M05").
#       Opcional: "exercises": true carga data/projects/<id>.data.js (SD.defineExercise) y core/exercise.js.
# Inclusiones, con rutas relativas a la carpeta del fragmento:
#   <!--INCLUDE figura.svg-->        inserta el archivo tal cual.
#   <!--SRC ruta/Archivo.java-->     inserta el archivo escapado para ir dentro de <pre><code>.
#   <!--SRC ruta/Archivo.java 10-40-->  solo esas líneas (de la 10 a la 40, inclusive).
import html, json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent   # raíz del proyecto

BRAND = '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path class="bm-line" d="M5 20 L13 12 L21 6" fill="none" stroke-width="2.5" stroke-linecap="round"/><circle class="bm-a" cx="5" cy="20" r="3.5"/><circle class="bm-b" cx="13" cy="12" r="3.2" stroke-width="2.4"/><circle class="bm-c" cx="21" cy="6" r="3.2" stroke-width="2.4"/></svg>'


def src(base, spec):
    parts = spec.split()
    text = (base / parts[0]).read_text(encoding="utf-8")
    if len(parts) > 1:
        a, b = (int(x) for x in parts[1].split("-"))
        text = "\n".join(text.split("\n")[a - 1:b])
    return html.escape(text.rstrip("\n"), quote=False)


def build(frag_path):
    frag = pathlib.Path(frag_path)
    text = frag.read_text(encoding="utf-8")
    m = re.match(r"\s*<!--META\s*(\{.*?\})\s*-->\s*", text, re.S)
    meta = json.loads(m.group(1))
    body = text[m.end():]
    base = frag.parent
    body = re.sub(r"<!--INCLUDE (\S+)-->", lambda mm: (base / mm.group(1)).read_text(encoding="utf-8"), body)
    body = re.sub(r"<!--SRC ([^>]+?)-->", lambda mm: src(base, mm.group(1)), body)
    pid = meta["id"]
    scripts = ["core/sd.js", "data/course.data.js", "data/glossary.data.js", "data/projects.data.js"]
    if meta.get("exercises"):
        scripts.append(f"data/projects/{pid}.data.js")   # ejercicios guiados (SD.defineExercise)
    scripts += ["core/progress.js", "core/nav.js", "core/glossary.js", "core/quiz.js"]
    if meta.get("exercises"):
        scripts.append("core/exercise.js")
    scripts += ["pages/project-state.js", "pages/project-guide.js"]
    script_tags = "\n".join(f'<script src="../assets/js/{s}"></script>' for s in scripts)
    page = f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{meta["num"]}. {meta["title"]}</title>
<meta name="description" content="{meta["desc"]}">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/css/tokens.css">
<link rel="stylesheet" href="../assets/css/layout.css">
<link rel="stylesheet" href="../assets/css/components.css">
<link rel="stylesheet" href="../assets/css/projects.css">
</head>
<body data-root="../" data-project="{pid}" class="page-guide">
<a class="skip-link" href="#contenido">Saltar al contenido</a>

<header class="topbar">
  <button class="menu-btn" type="button" aria-expanded="false" aria-controls="ruta" aria-label="Abrir la lista de proyectos"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.8"/></svg>Ruta</button>
  <button class="side-toggle" type="button" aria-controls="ruta" aria-pressed="false" aria-label="Ocultar la barra lateral" title="Ocultar o mostrar la barra lateral"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="1.5" y="2.5" width="15" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 2.5v13" stroke="currentColor" stroke-width="1.5"/></svg></button>
  <a class="brand" href="../index.html">
    {BRAND}
    <span class="brand-label">Diseño de sistemas reales</span>
  </a>
  <nav class="topnav" aria-label="Principal">
    <a href="../index.html">Curso</a>
    <a href="../proyectos.html" aria-current="page">Proyectos</a>
    <a href="../glosario.html">Glosario</a>
    <span class="top-progress" data-top-progress></span>
  </nav>
</header>

<div class="shell">
  <aside class="sidebar" id="ruta" aria-label="Proyectos">
    <nav data-project-route></nav>
  </aside>

  <main class="main" id="contenido">
    <article class="content">

      <header class="title-block">
        <h1>{meta["title"]}</h1>
        <p class="lead">{meta["lead"]}</p>
        <dl class="tb-grid">
          <div><dt>Proyecto</dt><dd>{meta["num"]}</dd></div>
          <div><dt>Plan</dt><dd>{meta["block"]}</dd></div>
          <div><dt>Tiempo estimado</dt><dd>{meta["time"]}</dd></div>
          <div><dt>Módulos</dt><dd>{meta["mods"]}</dd></div>
          <div><dt>Estado</dt><dd data-project-status="{pid}">Sin empezar</dd></div>
        </dl>
      </header>
{body.rstrip()}

    </article>

    <nav class="pager content" data-project-pager aria-label="Proyecto anterior y siguiente"></nav>
  </main>

  <aside class="toc" data-toc-host aria-label="En esta página"></aside>
</div>

{script_tags}
</body>
</html>
'''
    out = ROOT / "proyectos" / meta["file"]
    out.parent.mkdir(exist_ok=True)
    out.write_text(page, encoding="utf-8", newline="\n")
    print("escrito", out, len(page), "bytes")


for f in sys.argv[1:]:
    build(f)
