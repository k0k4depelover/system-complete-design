/* Guías de proyectos (proyectos/aNN-*.html). Necesita sd.js, projects.data.js y project-state.js.
   - Ruta de proyectos en el sidebar y anterior/siguiente entre proyectos.
   - Resaltado de java, javascript, yaml, xml, bash, nginx, ini y dockerfile (sd.js ya cubre json, http, sse, sql y python).
   - <pre data-file="ruta"> recibe una cabecera con la ruta del archivo y un botón para copiar.
   - La caja "Tu repositorio" ([data-repo]): enlace al repositorio y lista de comprobación, que marcan
     el proyecto como terminado. */
(function () {
  'use strict';

  var SD = window.SD;
  var h = SD.h;

  /* ---------- Resaltado ---------- */

  function span(cls, text) { return '<span class="' + cls + '">' + SD.escape(text) + '</span>'; }

  /* Recorre src con una regex de grupos alternativos; classes[i] es la clase del grupo i + 1
     (null: sin clase; una función recibe el texto y devuelve HTML). */
  function tokens(src, re, classes) {
    var out = '', last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(src))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      out += SD.escape(src.slice(last, m.index));
      for (var i = 1; i < m.length; i++) {
        if (m[i] == null) continue;
        var c = classes[i - 1];
        out += typeof c === 'function' ? c(m[i], m) : c ? span(c, m[i]) : SD.escape(m[i]);
        break;
      }
      last = re.lastIndex;
    }
    return out + SD.escape(src.slice(last));
  }

  var JAVA_KW = /^(abstract|assert|boolean|break|byte|case|catch|char|class|continue|default|do|double|else|enum|extends|final|finally|float|for|if|implements|import|instanceof|int|interface|long|new|package|private|protected|public|record|return|short|static|super|switch|synchronized|this|throw|throws|try|var|void|volatile|while|yield|true|false|null)$/;
  function hlJava(src) {
    var afterDecl = false;
    var re = /("""[\s\S]*?"""|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])+')|(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(@[A-Za-z_][\w.]*)|(\b\d[\d_]*(?:\.\d+)?[LlFfDd]?\b)|([A-Za-z_$][\w$]*)/g;
    return tokens(src, re, ['c-s', 'c-c', 'c-h', 'c-n', function (w) {
      var kw = JAVA_KW.test(w), decl = afterDecl;
      afterDecl = w === 'class' || w === 'record' || w === 'interface' || w === 'enum';
      if (kw) return span('c-m', w);
      return decl ? span('c-k', w) : SD.escape(w);
    }]);
  }

  /* JavaScript, para los scripts de k6: cadenas (también las de backticks), comentarios, números y palabras clave. */
  var JS_KW = /^(async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|let|new|of|return|switch|this|throw|try|typeof|var|void|while|true|false|null|undefined)$/;
  function hlJs(src) {
    var re = /(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;
    return tokens(src, re, ['c-s', 'c-c', 'c-n', function (w) { return JS_KW.test(w) ? span('c-m', w) : SD.escape(w); }]);
  }

  /* YAML línea por línea: comentario, clave, y en el valor cadenas, ${variables}, números y booleanos. */
  function hlYamlValue(v) {
    var re = /("(?:\\.|[^"\\])*"|'(?:[^']|'')*')|(\$\{[^}]*\})|((?<=^|[\s[,])(?:true|false|null|~)(?=\s|,|\]|$))|(\b\d+(?:\.\d+)?(?:ms|s|m|h|Mi|Gi|Ki)?\b)/g;
    return tokens(v, re, ['c-s', 'c-h', 'c-b', 'c-n']);
  }
  function hlYaml(src) {
    return src.split('\n').map(function (line) {
      var com = '', cm = line.match(/(^|\s)(#.*)$/);
      if (cm && !/["'][^"']*#/.test(line.slice(0, cm.index + cm[1].length + 1))) {
        com = span('c-c', cm[2]);
        line = line.slice(0, cm.index + cm[1].length);
      }
      var m = line.match(/^(\s*(?:-\s+)?)([A-Za-z0-9_.\-/"'$]+(?:\s[A-Za-z0-9_.\-]+)*)(:)(\s.*|$)/);
      var body;
      if (m && !/^\s*-\s*$/.test(m[1] + m[2])) body = SD.escape(m[1]) + span('c-k', m[2]) + m[3] + hlYamlValue(m[4]);
      else body = hlYamlValue(line);
      return body + com;
    }).join('\n');
  }

  function hlXml(src) {
    var re = /(<!--[\s\S]*?-->)|(<\/?)([A-Za-z_][\w:.-]*)|("[^"]*")|(\/?>)/g;
    return tokens(src, re, ['c-c', null, 'c-k', 'c-s', null]);
  }

  var SH_KW = /^(if|then|else|elif|fi|for|in|do|done|while|case|esac|function|export|local|return|exec|set)$/;
  function hlBash(src) {
    /* Las comillas simples no cruzan líneas: en una salida, el apóstrofo de "pod's" no abre una cadena. */
    var re = /((?:^|(?<=\s))#[^\n]*)|('[^'\n]*'|"(?:\\.|[^"\\])*")|(\$\{[^}]*\}|\$\(|\$[A-Za-z_]\w*|\$[0-9@#?])|((?:^|(?<=\s))--?[A-Za-z][\w-]*)|([A-Za-z_][\w.-]*)/gm;
    return tokens(src, re, ['c-c', 'c-s', 'c-h', 'c-n', function (w) { return SH_KW.test(w) ? span('c-m', w) : SD.escape(w); }]);
  }

  function hlNginx(src) {
    var re = /(#[^\n]*)|('[^']*'|"[^"]*")|(\$[A-Za-z_]\w*)|((?:^|(?<=[{;]))\s*[a-z_][a-z0-9_]*)|(\b\d+(?:\.\d+)?(?:ms|s|m|k|r\/s)?\b)/gm;
    return tokens(src, re, ['c-c', 'c-s', 'c-h', 'c-k', 'c-n']);
  }

  function hlIni(src) {
    var re = /(^\s*[;#][^\n]*)|(^\s*\[[^\]\n]+\])|(^\s*[A-Za-z0-9_.*-]+(?=\s*=))|("[^"\n]*")/gm;
    return tokens(src, re, ['c-c', 'c-m', 'c-k', 'c-s']);
  }

  function hlDocker(src) {
    var re = /(^\s*#[^\n]*)|(^\s*(?:FROM|RUN|COPY|ADD|WORKDIR|ENV|ARG|EXPOSE|USER|ENTRYPOINT|CMD|HEALTHCHECK|LABEL|VOLUME)\b)|("(?:\\.|[^"\\])*")|(\$\{?[A-Za-z_]\w*\}?)/gm;
    return tokens(src, re, ['c-c', 'c-m', 'c-s', 'c-h']);
  }

  var HL = { java: hlJava, javascript: hlJs, yaml: hlYaml, xml: hlXml, bash: hlBash, nginx: hlNginx, ini: hlIni, dockerfile: hlDocker };

  function highlight(root) {
    root.querySelectorAll('pre[data-lang]').forEach(function (pre) {
      if (pre.hasAttribute('data-hl')) return;
      var fn = HL[pre.getAttribute('data-lang')];
      if (!fn) return;
      var code = pre.querySelector('code') || pre;
      code.innerHTML = fn(code.textContent.replace(/^\n/, '').replace(/\s+$/, ''));
      pre.setAttribute('data-hl', '');
    });
  }

  /* ---------- Cabecera de archivo y copiar ---------- */

  function copyText(text, done) {
    function fallback() {
      var ta = h('textarea', { class: 'visually-hidden', 'aria-hidden': 'true' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    } else {
      fallback();
    }
  }

  function fileHeaders(root) {
    root.querySelectorAll('pre[data-file]').forEach(function (pre) {
      if (pre.parentNode.classList.contains('code-file')) return;
      var path = pre.getAttribute('data-file');
      var status = h('span', { class: 'visually-hidden', 'aria-live': 'polite' });
      var btn = h('button', { type: 'button', class: 'code-copy', text: 'Copiar', 'aria-label': 'Copiar ' + path });
      btn.addEventListener('click', function () {
        copyText((pre.querySelector('code') || pre).textContent, function (ok) {
          btn.textContent = ok ? 'Copiado' : 'No se pudo copiar';
          status.textContent = ok ? 'Copiado ' + path : '';
          setTimeout(function () { btn.textContent = 'Copiar'; status.textContent = ''; }, 1600);
        });
      });
      var box = h('div', { class: 'code-file' }, [
        h('div', { class: 'code-file-head' }, [h('span', { class: 'code-file-path', text: path }), btn, status])
      ]);
      pre.parentNode.insertBefore(box, pre);
      box.appendChild(pre);
    });
  }

  /* ---------- Ruta de proyectos ---------- */

  function buildRoute(container, currentId) {
    var d = SD.data.projects;
    container.innerHTML = '';
    container.appendChild(h('p', { class: 'pj-route-index' }, [h('a', { href: SD.url('proyectos.html'), text: 'Índice de proyectos' })]));
    function stop(p, kind) {
      var st = SD.projectState.status(p.id);
      var cls = st === 'soon' ? 'is-soon' : st === 'done' ? 'is-done' : st === 'started' ? 'is-started' : 'is-new';
      var li = h('li', { class: 'stop ' + cls + (p.id === currentId ? ' is-current' : ''), 'data-kind': kind });
      var inner = [
        h('span', { class: 'stop-num', text: p.num }),
        h('span', { class: 'stop-title', text: p.title }),
        h('span', { class: 'visually-hidden', text: '. ' + SD.projectStatusText[st] })
      ];
      if (st === 'soon' || !p.href) {
        inner.push(h('span', { class: 'stop-tag', 'aria-hidden': 'true', text: 'pronto' }));
        li.appendChild(h('span', { class: 'stop-link' }, inner));
      } else {
        var a = h('a', { class: 'stop-link', href: SD.url(p.href) }, inner);
        if (p.id === currentId) a.setAttribute('aria-current', 'page');
        li.appendChild(a);
      }
      return li;
    }
    function part(label, title, line, items, kind) {
      var el = h('div', { class: 'route-part', style: '--line: var(' + line + ')' });
      el.appendChild(h('p', { class: 'route-part-head' }, [
        h('span', { class: 'route-part-num', text: label }),
        h('span', { class: 'route-part-title', text: title })
      ]));
      el.appendChild(h('ol', { class: 'route-stops' }, items.map(function (p) { return stop(p, kind); })));
      container.appendChild(el);
    }
    d.tracks.forEach(function (t) { part(t.label, t.title, t.line, t.items, 'module'); });
    part('Al final', 'Sistemas completos', '--label-3', d.capstones, 'checkpoint');
  }

  function buildPager(pagerEl, currentId) {
    var items = SD.projectItems(), idx = -1;
    items.forEach(function (p, i) { if (p.id === currentId) idx = i; });
    if (idx < 0) return;
    function cell(p, dir) {
      var cls = 'pager-cell pager-' + dir;
      if (!p) return h('span', { class: cls + ' is-empty' });
      var kids = [
        h('span', { class: 'pager-dir', text: dir === 'prev' ? 'Proyecto anterior' : 'Proyecto siguiente' }),
        h('span', { class: 'pager-title', text: p.num + '  ' + p.title })
      ];
      if (p.status !== 'ready' || !p.href) {
        kids.push(h('span', { class: 'pager-note', text: 'Guía en preparación' }));
        return h('span', { class: cls + ' is-soon' }, kids);
      }
      return h('a', { class: cls, href: SD.url(p.href) }, kids);
    }
    pagerEl.appendChild(cell(items[idx - 1], 'prev'));
    pagerEl.appendChild(cell(items[idx + 1], 'next'));
  }

  /* ---------- Tu repositorio ---------- */

  function repoBox(box) {
    var id = box.getAttribute('data-repo');
    var p = SD.projectItem(id);
    var st = SD.projectState;
    var list = box.querySelector('.pj-checks');
    var checks = list ? Array.prototype.slice.call(list.querySelectorAll('li[data-check]')) : [];
    st.setTotal(id, checks.length);

    var uid = 'repo-' + id;
    var published = p && p.repo;
    var input = h('input', {
      type: 'url', id: uid, class: 'pj-repo-input', inputmode: 'url', autocomplete: 'url', spellcheck: 'false',
      placeholder: 'https://github.com/tu-usuario/' + (p && p.repoName ? p.repoName : id),
      'aria-describedby': uid + '-msg'
    });
    input.value = st.get(id).repo;
    var save = h('button', { type: 'submit', class: 'btn btn--primary', text: 'Guardar' });
    var msg = h('p', { class: 'pj-repo-msg', id: uid + '-msg' });
    var form = h('form', { class: 'pj-repo-form', novalidate: true }, [
      h('label', { for: uid, class: 'pj-repo-label', text: 'Enlace a tu repositorio' }),
      h('div', { class: 'pj-repo-row' }, [input, save]),
      msg
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (v && !SD.validRepo(v)) {
        msg.textContent = 'El enlace tiene que empezar con https:// e incluir el dominio, como https://github.com/tu-usuario/' + id + '.';
        msg.className = 'pj-repo-msg is-error';
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      st.setRepo(id, v);
      msg.className = 'pj-repo-msg';
      msg.textContent = v ? 'Guardado en este navegador.' : 'Enlace borrado.';
      render();
    });

    var publishedRow = published
      ? h('p', { class: 'pj-repo-published' }, ['Repositorio publicado: ', h('a', { href: published, text: published, rel: 'noopener' })])
      : null;

    checks.forEach(function (li, i) {
      var key = li.getAttribute('data-check');
      var cid = uid + '-c' + i;
      var cb = h('input', { type: 'checkbox', id: cid });
      cb.checked = !!st.get(id).checks[key];
      cb.addEventListener('change', function () { st.setCheck(id, key, cb.checked, checks.length); render(); });
      var label = h('label', { for: cid });
      while (li.firstChild) label.appendChild(li.firstChild);
      li.appendChild(cb);
      li.appendChild(label);
    });

    var state = h('p', { class: 'pj-repo-state', role: 'status' });
    var head = box.querySelector('.pj-repo-head');
    box.insertBefore(form, list || null);
    if (publishedRow) box.insertBefore(publishedRow, form);
    box.appendChild(state);
    if (head) box.insertBefore(head, box.firstChild);

    function render() {
      var s = st.get(id), repo = st.repoOf(id);
      var missing = checks.length - Object.keys(s.checks).filter(function (k) {
        return checks.some(function (li) { return li.getAttribute('data-check') === k; });
      }).length;
      var parts = [];
      if (!repo) parts.push('falta el enlace a tu repositorio');
      if (missing > 0) parts.push(missing === 1 ? 'falta 1 comprobación' : 'faltan ' + missing + ' comprobaciones');
      var done = !parts.length;
      state.className = 'pj-repo-state' + (done ? ' is-done' : '');
      state.textContent = done ? 'Proyecto terminado.' : 'Para terminarlo, ' + parts.join(' y ') + '.';
      document.querySelectorAll('[data-project-status="' + id + '"]').forEach(function (el) {
        el.textContent = SD.projectStatusText[st.status(id)];
      });
    }
    render();
  }

  SD.ready(function () {
    var currentId = document.body.getAttribute('data-project');
    var content = document.querySelector('.content') || document.body;
    highlight(content);
    fileHeaders(content);
    var routeEl = document.querySelector('[data-project-route]');
    var pagerEl = document.querySelector('[data-project-pager]');
    if (routeEl) buildRoute(routeEl, currentId);
    if (pagerEl) buildPager(pagerEl, currentId);
    document.querySelectorAll('[data-repo]').forEach(repoBox);
    document.querySelectorAll('[data-project-status]').forEach(function (el) {
      el.textContent = SD.projectStatusText[SD.projectState.status(el.getAttribute('data-project-status'))];
    });
    window.addEventListener('sd:projects', function () { if (routeEl) buildRoute(routeEl, currentId); });
  });

  SD.projectHighlight = highlight;
})();
