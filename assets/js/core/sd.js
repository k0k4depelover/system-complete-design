/* SD: espacio de nombres del curso.
   Todo son scripts clásicos (no ES modules) para que el sitio funcione con file://. */
(function () {
  'use strict';

  var SD = window.SD = window.SD || {};
  SD.data = SD.data || { glossary: {}, quizzes: {}, maps: {}, exercises: {} };

  SD.ready = function (fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  };

  /* Rutas: cada página declara <body data-root="../"> si vive en una subcarpeta. */
  SD.root = function () { return document.body.getAttribute('data-root') || ''; };
  SD.url = function (href) { return SD.root() + href; };

  /* h('div', {class: 'x', onclick: fn}, [hijos]) */
  SD.h = function (tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  };

  SD.escape = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  SD.slug = function (s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  };

  SD.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  /* Registro de datos (los archivos *.data.js llaman a estas funciones) */
  SD.defineGlossary = function (list) { list.forEach(function (t) { SD.data.glossary[t.id] = t; }); };
  SD.defineQuiz = function (id, quiz) { SD.data.quizzes[id] = quiz; };
  SD.defineMap = function (id, map) { SD.data.maps[id] = map; };
  SD.defineExercise = function (id, ex) { (SD.data.exercises = SD.data.exercises || {})[id] = ex; };

  /* ---------------------------------------------------------------------------
     Formato de números: agrupación con espacio fino (convención SI), punto decimal.
     --------------------------------------------------------------------------- */
  var NNBSP = ' ';

  function group(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP); }

  function trimZeros(s) { return s.indexOf('.') < 0 ? s : s.replace(/\.?0+$/, ''); }

  function num(n, dec) {
    if (n == null || !isFinite(n)) return '—';
    var abs = Math.abs(n);
    if (dec == null) dec = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : 3;
    var s = trimZeros(abs.toFixed(dec));
    var parts = s.split('.');
    return (n < 0 ? '−' : '') + group(parts[0]) + (parts[1] ? '.' + parts[1] : '');
  }

  /* 3 cifras significativas, sin notación científica */
  function sig(n) {
    if (n === 0) return '0';
    var abs = Math.abs(n);
    var dec = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : Math.min(6, 2 - Math.floor(Math.log10(abs)));
    return num(n, dec);
  }

  /* Cantidades grandes en palabras: 694 mil, 2.08 millones, 11.6 mil millones */
  function words(n) {
    if (n == null || !isFinite(n)) return '—';
    var abs = Math.abs(n);
    if (abs < 10000) return sig(n);
    if (abs < 1e6) return sig(n / 1e3) + ' mil';
    if (abs < 1e9) return sig(n / 1e6) + (abs < 2e6 ? ' millón' : ' millones');
    if (abs < 1e12) return sig(n / 1e9) + ' mil millones';
    return sig(n / 1e12) + ' billones';
  }

  var BYTE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB'];
  function bytes(b) {
    if (b == null || !isFinite(b)) return '—';
    var i = 0, v = b;
    while (Math.abs(v) >= 1000 && i < BYTE_UNITS.length - 1) { v /= 1000; i++; }
    return sig(v) + ' ' + BYTE_UNITS[i];
  }

  var BIT_UNITS = ['bps', 'kbps', 'Mbps', 'Gbps', 'Tbps'];
  function bitrate(bytesPerSec) {
    var v = bytesPerSec * 8, i = 0;
    while (Math.abs(v) >= 1000 && i < BIT_UNITS.length - 1) { v /= 1000; i++; }
    return sig(v) + ' ' + BIT_UNITS[i];
  }

  function pct(x, dec) {
    if (x == null || !isFinite(x)) return '—';
    return num(x * 100, dec == null ? 2 : dec) + NNBSP + '%';
  }

  /* Porcentaje de disponibilidad sin redondear hacia arriba (99.9996 nunca se muestra como 100) */
  function nines(x) {
    if (x >= 1) return '100' + NNBSP + '%';
    var p = x * 100, dec = 2;
    while (dec < 7 && Number(p.toFixed(dec)) >= 100) dec++;
    var f = Math.pow(10, dec);
    return num(Math.floor(p * f) / f, dec) + NNBSP + '%';
  }

  function duration(sec) {
    if (sec == null || !isFinite(sec)) return '—';
    if (sec < 1e-3) return sig(sec * 1e6) + ' µs';
    if (sec < 1) return sig(sec * 1e3) + ' ms';
    if (sec < 120) return sig(sec) + ' s';
    if (sec < 7200) return sig(sec / 60) + ' min';
    if (sec < 3 * 86400) return sig(sec / 3600) + ' h';
    return sig(sec / 86400) + ' días';
  }

  SD.fmt = { num: num, sig: sig, words: words, bytes: bytes, bitrate: bitrate, pct: pct, nines: nines, duration: duration };

  /* ---------------------------------------------------------------------------
     Resaltado mínimo para <pre data-lang="json|http|sse|sql|python|shell">.
     --------------------------------------------------------------------------- */
  function span(cls, text) { return '<span class="' + cls + '">' + SD.escape(text) + '</span>'; }

  function hlJSON(src) {
    var re = /("(?:\\.|[^"\\\n])*")(\s*:)?|(\/\/[^\n]*)|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|\b(true|false|null)\b/g;
    var out = '', last = 0, m;
    while ((m = re.exec(src))) {
      out += SD.escape(src.slice(last, m.index));
      if (m[1]) out += span(m[2] ? 'c-k' : 'c-s', m[1]) + (m[2] ? SD.escape(m[2]) : '');
      else if (m[3]) out += span('c-c', m[3]);
      else if (m[4]) out += span('c-n', m[4]);
      else if (m[5]) out += span('c-b', m[5]);
      last = re.lastIndex;
    }
    return out + SD.escape(src.slice(last));
  }

  function hlHTTP(src) {
    var lines = src.split('\n'), out = [], inBody = false, body = [];
    lines.forEach(function (line) {
      if (inBody) { body.push(line); return; }
      var m;
      if (line.trim() === '') { inBody = true; out.push(''); return; }
      if ((m = line.match(/^([A-Z]+)(\s+)(\S+)(\s+HTTP\/[\d.]+)?$/))) {
        out.push(span('c-m', m[1]) + m[2] + span('c-p', m[3]) + (m[4] ? span('c-c', m[4]) : ''));
      } else if ((m = line.match(/^(HTTP\/[\d.]+)(\s+)(\d{3})(.*)$/))) {
        out.push(span('c-c', m[1]) + m[2] + span('c-n', m[3]) + SD.escape(m[4]));
      } else if ((m = line.match(/^(\/\/.*)$/))) {
        out.push(span('c-c', m[1]));
      } else if ((m = line.match(/^([A-Za-z0-9-]+)(:)(.*)$/))) {
        out.push(span('c-h', m[1]) + m[2] + SD.escape(m[3]));
      } else {
        out.push(SD.escape(line));
      }
    });
    var html = out.join('\n');
    if (body.length) html += '\n' + hlJSON(body.join('\n'));
    return html;
  }

  function hlSSE(src) {
    return src.split('\n').map(function (line) {
      var m = line.match(/^(event|data|id|retry)(:\s?)(.*)$/);
      if (m) return span('c-h', m[1]) + m[2] + (m[1] === 'data' ? hlJSON(m[3]) : SD.escape(m[3]));
      if (/^:/.test(line)) return span('c-c', line);
      return SD.escape(line);
    }).join('\n');
  }

  var SQL_KW = /\b(CREATE|TABLE|INDEX|UNIQUE|PRIMARY|KEY|REFERENCES|FOREIGN|NOT|NULL|DEFAULT|ON|SELECT|FROM|WHERE|AND|OR|INSERT|INTO|VALUES|UPDATE|SET|DELETE|RETURNING|BEGIN|COMMIT|ROLLBACK|FOR|CONFLICT|DO|NOTHING|ORDER|BY|DESC|ASC|LIMIT|PARTITION|CHECK|IF|EXISTS|AS|IN|IS|WITH|USING|JOIN|LEFT|GROUP|HAVING|COUNT|NOW|INTERVAL)\b/g;
  function hlSQL(src) {
    var re = /('(?:[^'\n]|'')*')|(--[^\n]*)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g;
    var out = '', last = 0, m;
    while ((m = re.exec(src))) {
      out += SD.escape(src.slice(last, m.index));
      if (m[1]) out += span('c-s', m[1]);
      else if (m[2]) out += span('c-c', m[2]);
      else if (m[3]) out += span('c-n', m[3]);
      else if (m[4]) out += (SQL_KW.test(m[4]) ? span('c-m', m[4]) : SD.escape(m[4]));
      SQL_KW.lastIndex = 0;
      last = re.lastIndex;
    }
    return out + SD.escape(src.slice(last));
  }

  var PY_KW = /^(def|class|return|if|elif|else|for|while|in|not|and|or|is|import|from|as|with|try|except|finally|raise|async|await|yield|lambda|pass|break|continue|global|nonlocal|assert|del|None|True|False|self)$/;
  function hlPython(src) {
    var re = /("""[\s\S]*?"""|'''[\s\S]*?'''|[rbfu]*"(?:\\.|[^"\\\n])*"|[rbfu]*'(?:\\.|[^'\\\n])*')|(#[^\n]*)|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|(@[A-Za-z_][\w.]*)|([A-Za-z_]\w*)(\s*\()?/g;
    var out = '', last = 0, m, afterDef = false;
    while ((m = re.exec(src))) {
      out += SD.escape(src.slice(last, m.index));
      if (m[5]) {
        /* palabras clave; nombres de funciones al definirlas o llamarlas */
        if (PY_KW.test(m[5])) out += span('c-m', m[5]);
        else if (afterDef || m[6]) out += span('c-k', m[5]);
        else out += SD.escape(m[5]);
        if (m[6]) out += SD.escape(m[6]);
        afterDef = m[5] === 'def' || m[5] === 'class';
      } else {
        if (m[1]) out += span('c-s', m[1]);
        else if (m[2]) out += span('c-c', m[2]);
        else if (m[3]) out += span('c-n', m[3]);
        else if (m[4]) out += span('c-h', m[4]);
        afterDef = false;
      }
      last = re.lastIndex;
    }
    return out + SD.escape(src.slice(last));
  }

  /* Comandos y archivos de configuración (sshd_config, nftables, sysctl): comentarios con #, el prompt $ y cadenas */
  function hlShell(src) {
    var re = /(^|\s)(#[^\n]*)|(^\$(?= ))|("(?:\\.|[^"\\\n])*"|'[^'\n]*')/gm;
    var out = '', last = 0, m;
    while ((m = re.exec(src))) {
      out += SD.escape(src.slice(last, m.index));
      if (m[2]) out += SD.escape(m[1]) + span('c-c', m[2]);
      else if (m[3]) out += span('c-m', m[3]);
      else if (m[4]) out += span('c-s', m[4]);
      last = re.lastIndex;
    }
    return out + SD.escape(src.slice(last));
  }

  var HL = { json: hlJSON, http: hlHTTP, sse: hlSSE, sql: hlSQL, python: hlPython, shell: hlShell };

  SD.highlight = function (root) {
    (root || document).querySelectorAll('pre[data-lang]').forEach(function (pre) {
      if (pre.hasAttribute('data-hl')) return;
      var fn = HL[pre.getAttribute('data-lang')];
      if (!fn) return;
      var code = pre.querySelector('code') || pre;
      code.innerHTML = fn(code.textContent.replace(/^\n/, '').replace(/\s+$/, ''));
      pre.setAttribute('data-hl', '');
    });
  };

  /* ---------------------------------------------------------------------------
     Pestañas: <div class="tabs" data-tabs><section data-tab="REST">…</section>…</div>
     --------------------------------------------------------------------------- */
  var tabsUid = 0;
  SD.initTabs = function (root) {
    (root || document).querySelectorAll('[data-tabs]').forEach(function (host) {
      if (host.hasAttribute('data-tabs-ready')) return;
      host.setAttribute('data-tabs-ready', '');
      var panels = Array.prototype.slice.call(host.children).filter(function (c) { return c.hasAttribute('data-tab'); });
      var list = SD.h('div', { class: 'tabs-list', role: 'tablist', 'aria-label': host.getAttribute('data-tabs') || 'Pestañas' });
      var id = 'tb' + (++tabsUid);
      var btns = panels.map(function (p, i) {
        p.id = p.id || id + '-p' + i;
        p.setAttribute('role', 'tabpanel');
        p.setAttribute('tabindex', '0');
        var b = SD.h('button', { type: 'button', class: 'tabs-btn', role: 'tab', id: id + '-t' + i, 'aria-controls': p.id, text: p.getAttribute('data-tab') });
        p.setAttribute('aria-labelledby', b.id);
        b.addEventListener('click', function () { show(i); });
        b.addEventListener('keydown', function (e) {
          var j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
          if (j == null) return;
          e.preventDefault(); j = (j + panels.length) % panels.length; show(j); btns[j].focus();
        });
        list.appendChild(b);
        return b;
      });
      function show(i) {
        panels.forEach(function (p, j) { p.hidden = i !== j; });
        btns.forEach(function (b, j) { b.setAttribute('aria-selected', i === j ? 'true' : 'false'); b.tabIndex = i === j ? 0 : -1; });
      }
      host.insertBefore(list, host.firstChild);
      show(0);
    });
  };

  SD.ready(function () { SD.highlight(document); SD.initTabs(document); });
})();
