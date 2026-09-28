/* Widgets del M12 (un LLM visto por un ingeniero de sistemas):
   <div data-sim="tokenizer">  tokenizer didáctico: coincidencia más larga sobre un vocabulario chico, con fallback a bytes
   <div data-sim="kvcache">    generación token a token: TTFT, TPOT y cuánto ocupa el KV cache del batch en el despliegue */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt, LLM = SD.data.llm;
  var reduceMotion = SD.reduceMotion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ======================= Tokenizer ======================= */

  var WORDS = (' de| la| que| el| en| y| a| los| se| del| las| un| por| con| no| una| su| para| es| al| lo| como| más| pero| sus| le| ya| o| este| porque| esta| entre| cuando| muy| sin| sobre| también| me| hasta| hay| donde| desde| todo| nos| todos| uno| les| ni| otros| ese| eso| esto| antes| qué| cada| suele| ser| leen| lee| pedazo| texto| memoria| respuesta| usuario| usuarios| tiempo| sistema| datos| red| servidor| modelo| modelos| lenguaje| palabra| palabras| token| tokens| cuesta| cuestan| español| inglés| mismo| misma| número| números| función| calcular| language| models| model| read| not| words| the| of| and| to| is| in| it| that| for| with| on| as| are| this| tokens| cost| more').split('|');
  var STARTS = 'Los|Las|El|La|Un|Una|En|Language|The|Model|Models|Tokens|Cada|Each'.split('|');
  var PIECES = 'ción|ciones|mente|ando|iendo|ado|ada|ados|adas|ido|ida|idad|idades|ar|er|ir|es|os|as|al|ales|iza|izar|ización|izaciones|des|in|institu|cional|ional|funcion|calcular|tok|en|iz|ador|adores|ones|ón|ía|ías|ble|bles|ista|istas|ismo|pre|re|con|trans|sub|inter|super|anti| des| in| re| con| inter|nos|mos|ron|aba|aban|ía|ían|que|qu|gu|ll|rr|ch|str|ing|tion|ed|er|ly|()|_|==|:=|->|def |return'.split('|');
  var SINGLES = ('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZáéíóúñüÁÉÍÓÚÑÜ0123456789 .,:;!?¿¡()"\'-_/=+*<>[]{}#@%&\n').split('');
  var VOCAB = {}, NEXT = 256, MAXLEN = 1;
  [SINGLES, PIECES, WORDS, STARTS].forEach(function (list) {
    list.forEach(function (p) {
      if (!p || VOCAB[p] != null) return;
      VOCAB[p] = NEXT++;
      if (p.length > MAXLEN) MAXLEN = p.length;
    });
  });

  var encoder = window.TextEncoder ? new TextEncoder() : null;

  function tokenize(text) {
    var out = [], i = 0;
    while (i < text.length) {
      var hit = null;
      for (var len = Math.min(MAXLEN, text.length - i); len > 0; len--) {
        var piece = text.substr(i, len);
        if (VOCAB[piece] != null) { hit = piece; break; }
      }
      if (hit) { out.push({ text: hit, id: VOCAB[hit] }); i += hit.length; continue; }
      /* Fuera del vocabulario: un token por byte de UTF-8, como el byte fallback de los tokenizers reales */
      var cp = text.codePointAt(i), ch = String.fromCodePoint(cp);
      var bytes = encoder ? Array.prototype.slice.call(encoder.encode(ch)) : [cp & 255];
      bytes.forEach(function (b, k) { out.push({ text: k === 0 ? ch : '', id: b, byte: '<0x' + (b < 16 ? '0' : '') + b.toString(16).toUpperCase() + '>' }); });
      i += ch.length;
    }
    return out;
  }

  var TOK_PRESETS = [
    { name: 'Español', text: 'Los modelos de lenguaje no leen palabras: leen tokens. Cada token suele ser un pedazo de palabra.' },
    { name: 'Inglés', text: 'Language models read tokens, not words. Each token is usually a piece of a word.' },
    { name: 'Palabras raras y emoji', text: 'La desinstitucionalización 🚀 cuesta más tokens que la palabra red.' },
    { name: 'Código', text: 'def calcular(x):\n    return x * 2 == 10' }
  ];

  function initTokenizer(host) {
    var area = h('textarea', { class: 'tok-input', rows: 3, 'aria-label': 'Texto a tokenizar', spellcheck: 'false' });
    var chips = h('div', { class: 'tok-chips', 'aria-live': 'polite' });
    var stats = h('div', { class: 'sim-stats' });
    var bar = h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Ejemplos' });
    TOK_PRESETS.forEach(function (p, i) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': i === 0 ? 'true' : 'false', text: p.name });
      b.addEventListener('click', function () {
        bar.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        area.value = p.text; run();
      });
      bar.appendChild(b);
    });

    function run() {
      var toks = tokenize(area.value);
      chips.innerHTML = '';
      toks.forEach(function (t, i) {
        var label = t.byte || t.text.replace(/ /g, '·').replace(/\n/g, '↵');
        chips.appendChild(h('span', { class: 'tok-chip' + (i % 2 ? ' is-alt' : '') + (t.byte ? ' is-byte' : ''), title: 'ID ' + t.id }, [
          h('span', { class: 'tok-text', text: label }),
          h('span', { class: 'tok-id', text: String(t.id) })
        ]));
      });
      var chars = Array.from(area.value).length;
      stats.innerHTML = '';
      [['Caracteres', F.num(chars, 0)], ['Tokens', F.num(toks.length, 0)], ['Caracteres por token', toks.length ? F.num(chars / toks.length, 1) : '—'],
       ['Tokens de byte', F.num(toks.filter(function (t) { return t.byte; }).length, 0)]].forEach(function (x) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
    }

    area.value = TOK_PRESETS[0].text;
    area.addEventListener('input', run);
    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Tokenizer didáctico' }), bar]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'field' }, [area]),
      chips, stats,
      h('p', { class: 'sim-note', text: 'Cada caja es un token, con su ID abajo; el punto marca un espacio que forma parte del token. Lo que no está en el vocabulario se parte en bytes de UTF-8: por eso un emoji o una palabra rara cuestan varios tokens.' })
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Vocabulario de unas 400 piezas armado para esta demo, con coincidencia de la pieza más larga. Uno real (BPE) tiene entre 100 000 y 200 000 piezas aprendidas de los datos, y parte el texto con otras reglas: las cifras exactas cambian, la idea es la misma.' }));
    run();
  }

  /* ======================= Generación y KV cache ======================= */

  /* Despliegue de referencia de cada modelo: GPUs y precisión de los pesos */
  var DEPLOY = {
    llama8b:   { gpu: 'h100', n: 1, w: 'bf16' },
    llama70b:  { gpu: 'h100', n: 4, w: 'fp8' },
    llama405b: { gpu: 'h100', n: 8, w: 'fp8' },
    gpt3:      { gpu: 'h100', n: 8, w: 'bf16' },
    dsv3:      { gpu: 'h200', n: 8, w: 'fp8' }
  };
  var RESERVE = 5e9;          /* por GPU: activaciones, CUDA graphs y el runtime */
  var MFU_PREFILL = 0.4, MFU_DECODE = 0.5;
  var SAMPLE = ' El| KV| cache| guarda| las| claves| y| los| valores| de| cada| token| anterior|,| así| el| modelo| no| repite| el| trabajo| en| cada| paso|.| Ocupa| memoria| de| la| GPU| que| crece| con| el| contexto| y| con| los| usuarios|.'.split('|');

  function initKV(host) {
    var model = h('select', { 'aria-label': 'Modelo' });
    ['llama8b', 'llama70b', 'llama405b', 'gpt3', 'dsv3'].forEach(function (k) {
      model.appendChild(h('option', { value: k, text: LLM.models[k].name }));
    });
    model.value = 'llama70b';
    var kvp = h('select', { 'aria-label': 'Precisión del KV cache' }, [h('option', { value: 'bf16', text: 'BF16 (2 bytes)' }), h('option', { value: 'fp8', text: 'FP8 (1 byte)' })]);
    function range(label, min, max, step, value) {
      var input = h('input', { type: 'range', min: min, max: max, step: step, value: value, 'aria-label': label });
      var out = h('output', { class: 'range-val' });
      return { input: input, out: out, el: h('div', { class: 'field' }, [h('label', {}, [label + ': ', out]), input]) };
    }
    var prompt = range('Prompt (tokens)', 100, 32000, 100, 2000);
    var outLen = range('Respuesta (tokens)', 10, 2000, 10, 500);
    var users = range('Usuarios en el batch', 1, 256, 1, 32);
    var play = h('button', { type: 'button', class: 'btn btn--primary', text: 'Generar' });
    var reset = h('button', { type: 'button', class: 'btn', text: 'Reiniciar' });
    var deployTxt = h('p', { class: 'sim-note' });
    var svgHost = h('div', { class: 'sim-scroll' });
    var genLine = h('p', { class: 'kv-gen', 'aria-live': 'off' });
    var stats = h('div', { class: 'sim-stats', 'aria-live': 'polite' });
    var warn = h('p', { class: 'sim-note kv-warn' });

    var t = 0, running = false, raf = null;

    function cfg() {
      var m = LLM.models[model.value], d = DEPLOY[model.value], g = LLM.gpus[d.gpu];
      var kvB = LLM.bytes[kvp.value], wB = LLM.bytes[d.w];
      var peak = d.w === 'fp8' && g.fp8 ? g.fp8 : g.bf16;
      return {
        m: m, d: d, g: g, kvTok: LLM.kvPerToken(m, kvB), W: m.params * wB, wB: wB, active: LLM.activeParams(m),
        mem: d.n * g.mem, reserve: d.n * RESERVE, bw: d.n * g.bw, peak: d.n * peak,
        P: +prompt.input.value, O: +outLen.input.value, U: +users.input.value
      };
    }

    /* Bytes de pesos leídos por paso: en un MoE, con pocos usuarios solo se leen los expertos activos */
    function weightRead(c) { return c.m.active ? Math.min(c.m.params, c.active * c.U) * c.wB : c.W; }

    function tpot(c, ctx) {
      var bytes = weightRead(c) + c.U * ctx * c.kvTok;
      var mem = bytes / c.bw, comp = 2 * c.active * c.U / (c.peak * MFU_DECODE);
      return { t: Math.max(mem, comp), bound: mem >= comp ? 'memoria' : 'cómputo' };
    }

    function draw() {
      var c = cfg();
      prompt.out.textContent = F.num(c.P, 0);
      outLen.out.textContent = F.num(c.O, 0);
      users.out.textContent = F.num(c.U, 0);
      deployTxt.textContent = 'Despliegue de referencia: ' + c.d.n + ' × ' + c.g.name + ', pesos en ' + c.d.w.toUpperCase() + ' (' + F.bytes(c.W) + '). Reserva de ' + F.bytes(RESERVE) + ' por GPU para activaciones y el runtime.';

      var ctx = c.P + t;
      var ttft = 2 * c.active * c.P / (c.peak * MFU_PREFILL);
      var step = tpot(c, ctx);
      var kvConv = ctx * c.kvTok, kvAll = kvConv * c.U;
      var free = c.mem - c.W - c.reserve;

      /* ---- SVG ---- */
      var W = 740, H = 176, l = 150, pw = W - l - 16;
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tiempo de la request y memoria del despliegue">';
      /* tiempo */
      var total = ttft + c.O * tpot(c, c.P + c.O / 2).t;
      var X = function (sec) { return l + Math.min(1, sec / total) * pw; };
      var now = t === 0 ? 0 : ttft + t * tpot(c, c.P + t / 2).t;
      s += '<text class="sim-label" x="0" y="30">Tiempo</text>';
      s += '<rect x="' + l + '" y="16" width="' + pw + '" height="22" rx="5" fill="var(--fill)"/>';
      s += '<rect x="' + l + '" y="16" width="' + (X(ttft) - l).toFixed(1) + '" height="22" rx="5" fill="var(--l-gpu)"/>';
      if (t > 0) s += '<rect x="' + X(ttft).toFixed(1) + '" y="16" width="' + Math.max(1, X(now) - X(ttft)).toFixed(1) + '" height="22" fill="color-mix(in srgb, var(--l-gpu) 35%, var(--bg))"/>';
      s += '<text class="sim-axis" x="' + l + '" y="54">prefill ' + F.duration(ttft) + '</text>';
      s += '<text class="sim-axis" x="' + (l + pw) + '" y="54" text-anchor="end">fin ≈ ' + F.duration(total) + '</text>';
      /* memoria */
      var MX = function (b) { return l + Math.max(0, Math.min(1, b / c.mem)) * pw; };
      var y = 80;
      s += '<text class="sim-label" x="0" y="' + (y + 15) + '">Memoria (' + F.bytes(c.mem) + ')</text>';
      s += '<rect x="' + l + '" y="' + y + '" width="' + pw + '" height="22" rx="5" fill="var(--fill)"/>';
      s += '<rect x="' + l + '" y="' + y + '" width="' + (MX(c.W) - l).toFixed(1) + '" height="22" rx="5" fill="var(--l-gpu)"/>';
      s += '<rect x="' + MX(c.W).toFixed(1) + '" y="' + y + '" width="' + (MX(c.W + c.reserve) - MX(c.W)).toFixed(1) + '" height="22" fill="var(--separator-strong)"/>';
      var kvFit = Math.min(kvAll, Math.max(0, free));
      s += '<rect x="' + MX(c.W + c.reserve).toFixed(1) + '" y="' + y + '" width="' + (MX(c.W + c.reserve + kvFit) - MX(c.W + c.reserve)).toFixed(1) + '" height="22" fill="var(--l-cache)"/>';
      if (kvAll > free) s += '<rect x="' + (l + pw - 6) + '" y="' + (y - 4) + '" width="6" height="30" rx="2" fill="var(--fail)"/>';
      var legY = y + 42;
      [['var(--l-gpu)', 'pesos'], ['var(--separator-strong)', 'reserva'], ['var(--l-cache)', 'KV cache del batch'], ['var(--fill-2)', 'libre']].forEach(function (it, i) {
        var lx = l + i * 150;
        s += '<rect x="' + lx + '" y="' + (legY - 9) + '" width="12" height="12" rx="3" fill="' + it[0] + '"/><text class="sim-axis" x="' + (lx + 18) + '" y="' + legY + '">' + it[1] + '</text>';
      });
      s += '<text class="sim-axis" x="' + l + '" y="' + (legY + 26) + '">KV de una conversación: ' + F.bytes(kvConv) + ' (' + F.num(ctx, 0) + ' tokens × ' + F.bytes(c.kvTok) + ')</text>';
      s += '</svg>';
      svgHost.innerHTML = s;

      var shown = [];
      for (var i = Math.max(0, t - 14); i < t; i++) shown.push(SAMPLE[i % SAMPLE.length]);
      genLine.textContent = t === 0 ? 'Listo para el prefill del prompt de ' + F.num(c.P, 0) + ' tokens.' : 'Token ' + F.num(t, 0) + ' de ' + F.num(c.O, 0) + ':' + shown.join('');

      warn.textContent = kvAll > free
        ? 'No cabe: el KV del batch (' + F.bytes(kvAll) + ') supera la memoria libre (' + F.bytes(Math.max(0, free)) + '). Un motor real no admite tantos usuarios a la vez: los pone en cola o saca alguno del batch (M15).'
        : '';
      stats.innerHTML = '';
      [['KV por token', F.bytes(c.kvTok)],
       ['KV del batch ahora', F.bytes(kvAll)],
       ['TTFT (solo prefill)', F.duration(ttft)],
       ['TPOT ahora, límite por ' + step.bound, F.duration(step.t)],
       ['Tokens/s de cada usuario', F.num(1 / step.t, 0)],
       ['Tokens/s en total', F.num(c.U / step.t, 0)]].forEach(function (x) {
        stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: x[0] }), h('b', { text: x[1] })]));
      });
      play.textContent = running ? 'Pausar' : (t >= c.O ? 'Generar de nuevo' : t > 0 ? 'Seguir' : 'Generar');
    }

    function tick() {
      var c = cfg();
      t = Math.min(c.O, t + Math.max(1, Math.round(c.O / 240)));
      draw();
      if (t >= c.O) { running = false; draw(); return; }
      raf = requestAnimationFrame(tick);
    }
    play.addEventListener('click', function () {
      var c = cfg();
      if (running) { running = false; cancelAnimationFrame(raf); draw(); return; }
      if (t >= c.O) t = 0;
      if (reduceMotion) { t = c.O; draw(); return; }
      running = true; tick();
    });
    reset.addEventListener('click', function () { running = false; cancelAnimationFrame(raf); t = 0; draw(); });
    [model, kvp].forEach(function (x) { x.addEventListener('change', function () { t = Math.min(t, cfg().O); draw(); }); });
    [prompt, outLen, users].forEach(function (r) { r.input.addEventListener('input', function () { t = Math.min(t, cfg().O); draw(); }); });

    host.classList.add('sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Generación token a token y KV cache' })]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [
        h('div', { class: 'field' }, [h('label', { text: 'Modelo' }), model]),
        h('div', { class: 'field' }, [h('label', { text: 'KV cache en' }), kvp]),
        prompt.el, outLen.el, users.el,
        h('div', { class: 'btn-row' }, [play, reset])
      ]),
      deployTxt, svgHost, genLine, warn, stats
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Límite teórico: el prefill a un 40 % del pico de FLOPS y el decode limitado por el ancho de banda de HBM (o por el cómputo si es mayor). No incluye la atención del prefill, que crece con el cuadrado del prompt (M16). Un motor real llega a un 60–80 % de estas cifras en modelos densos; en un MoE con pocos usuarios manda la comunicación entre GPUs y la cifra teórica es muy optimista.' }));
    draw();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="tokenizer"]').forEach(initTokenizer);
    document.querySelectorAll('[data-sim="kvcache"]').forEach(initKV);
  });
})();
