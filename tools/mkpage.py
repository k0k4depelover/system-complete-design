# Envuelve un fragmento de contenido con el esqueleto de página de módulo.
# Uso: python tools/mkpage.py fragmento.html   (el fragmento empieza con <!--META {...}-->)
# Solo para CREAR páginas nuevas: una vez generada, la página en modules/ es la fuente de verdad y se edita directo.
# <!--INCLUDE archivo.svg--> inserta un archivo relativo a la carpeta del fragmento.
# META opcional: "css", "data", "scripts", "quiz": false, "exercises": true (carga data/exercises/<id>.data.js y core/exercise.js).
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent   # raíz del proyecto

BRAND = '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path class="bm-line" d="M5 20 L13 12 L21 6" fill="none" stroke-width="2.5" stroke-linecap="round"/><circle class="bm-a" cx="5" cy="20" r="3.5"/><circle class="bm-b" cx="13" cy="12" r="3.2" stroke-width="2.4"/><circle class="bm-c" cx="21" cy="6" r="3.2" stroke-width="2.4"/></svg>'

def build(frag_path):
    src = pathlib.Path(frag_path).read_text(encoding="utf-8")
    m = re.match(r"\s*<!--META\s*(\{.*?\})\s*-->\s*", src, re.S)
    meta = json.loads(m.group(1))
    body = src[m.end():]
    base = pathlib.Path(frag_path).parent
    body = re.sub(r"<!--INCLUDE (\S+)-->", lambda mm: (base / mm.group(1)).read_text(encoding="utf-8"), body)
    mid = meta["id"]
    css = "".join(f'\n<link rel="stylesheet" href="../assets/css/{c}">' for c in meta.get("css", []))
    scripts = ["core/sd.js", "data/course.data.js", "data/glossary.data.js"]
    if meta.get("quiz", True):
        scripts.append(f"data/quizzes/{mid}.data.js")
    if meta.get("exercises"):
        scripts.append(f"data/exercises/{mid}.data.js")   # ejercicios guiados (SD.defineExercise)
    scripts += meta.get("data", [])
    scripts += ["core/progress.js", "core/nav.js", "core/glossary.js", "core/quiz.js"]
    if meta.get("exercises"):
        scripts.append("core/exercise.js")
    scripts += meta.get("scripts", [])
    script_tags = "\n".join(f'<script src="../assets/js/{s}"></script>' for s in scripts)
    tb = f'''        <dl class="tb-grid">
          <div><dt>Plano</dt><dd>{meta["num"]}</dd></div>
          <div><dt>Parte</dt><dd>{meta["part"]}</dd></div>
          <div><dt>Duración</dt><dd>{meta["mins"]} min</dd></div>
          <div><dt>Requisitos previos</dt><dd>{meta["prereq"]}</dd></div>
          <div><dt>Estado</dt><dd data-status="{mid}">Sin empezar</dd></div>
        </dl>'''
    html = f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{meta["num"]}. {meta["title"]}</title>
<meta name="description" content="{meta["desc"]}">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/css/tokens.css">
<link rel="stylesheet" href="../assets/css/layout.css">
<link rel="stylesheet" href="../assets/css/components.css">{css}
</head>
<body data-root="../" data-module="{mid}">
<a class="skip-link" href="#contenido">Saltar al contenido</a>

<header class="topbar">
  <button class="menu-btn" type="button" aria-expanded="false" aria-controls="ruta" aria-label="Abrir la ruta del curso"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.8"/></svg>Ruta</button>
  <button class="side-toggle" type="button" aria-controls="ruta" aria-pressed="false" aria-label="Ocultar la barra lateral" title="Ocultar o mostrar la barra lateral"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="1.5" y="2.5" width="15" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 2.5v13" stroke="currentColor" stroke-width="1.5"/></svg></button>
  <a class="brand" href="../index.html">
    {BRAND}
    <span class="brand-label">Diseño de sistemas reales</span>
  </a>
  <nav class="topnav" aria-label="Principal">
    <a href="../index.html">Curso</a>
    <a href="../glosario.html">Glosario</a>
    <span class="top-progress" data-top-progress></span>
  </nav>
</header>

<div class="shell">
  <aside class="sidebar" id="ruta" aria-label="Ruta del curso">
    <nav data-route></nav>
  </aside>

  <main class="main" id="contenido">
    <article class="content">

      <header class="title-block">
        <h1>{meta["title"]}</h1>
        <p class="lead">{meta["lead"]}</p>
{tb}
      </header>
{body.rstrip()}

    </article>

    <nav class="pager content" data-pager aria-label="Módulo anterior y siguiente"></nav>
  </main>

  <aside class="toc" data-toc-host aria-label="En esta página"></aside>
</div>

{script_tags}
</body>
</html>
'''
    out = ROOT / "modules" / meta["file"]
    out.write_text(html, encoding="utf-8")
    print("escrito", out, len(html), "bytes")

for f in sys.argv[1:]:
    build(f)
