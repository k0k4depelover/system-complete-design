/* Widgets del M17 (API del LLM y streaming):
   <div data-sim="sse">          un stream SSE evento por evento, en tres formatos (Chat Completions, Responses y Messages
                                  de Anthropic) y cuatro escenarios (normal, herramienta, error a mitad, corte y reanudación),
                                  con un botón para cancelar en cualquier momento
   <div data-calc="streamcap">   streams abiertos, eventos por segundo y ancho de banda del streaming (ley de Little)
   Los eventos siguen los formatos documentados, con ids acortados y un nombre de modelo genérico. */
(function () {
  'use strict';
  var SD = window.SD, h = SD.h, F = SD.fmt;

  /* ======================= Guiones de los streams ======================= */

  var TEXT = ['El', ' KV', ' cache', ' guarda', ' las', ' claves', ' y', ' valores', ' de', ' los', ' tokens', ' anteriores', ' para', ' no', ' recalcular', 'los', '.'];
  var ALT = ['El', ' KV', ' cache', ' almacena', ' las', ' claves', ' y', ' los', ' valores', ' de', ' los', ' tokens', ' previos', '.'];
  var ARGS = ['{"', 'pedido', '_id', '":', ' "', '88', '12', '"}'];
  var PRE = ['Voy', ' a', ' buscar', ' el', ' pedido', '.'];
  var IN_TOK = 1250, T_HEAD = 70, T_FIRST = 380, TPOT = 40, CUT_AT = 8;
  var Q_KV = '¿Qué es el KV cache?', Q_TOOL = '¿Dónde está mi pedido 8812?';
  var MODEL = 'modelo-chat';

  var FORMATS = {
    cc: { name: 'Chat Completions', path: '/v1/chat/completions' },
    resp: { name: 'Responses', path: '/v1/responses' },
    anth: { name: 'Messages (Anthropic)', path: '/v1/messages' }
  };
  var SCENARIOS = {
    normal: 'Respuesta normal',
    tool: 'Llamada a una herramienta',
    error: 'Error a mitad del stream',
    resume: 'Se corta la red y se reanuda'
  };

  var J = function (o) { return JSON.stringify(o); };
  var join = function (a) { return a.join(''); };

  /* Relleno de obfuscation: caracteres al azar para que todos los eventos pesen parecido */
  function pad(seed, piece) {
    var n = Math.max(2, 14 - piece.length), abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) % 2147483648; s += abc[seed % abc.length]; }
    return s;
  }

  function request(fmt, scen) {
    var q = scen === 'tool' ? Q_TOOL : Q_KV, body;
    var tools = { type: 'function', name: 'buscar_pedido', parameters: { type: 'object', properties: { pedido_id: { type: 'string' } }, required: ['pedido_id'] } };
    if (fmt === 'cc') {
      body = { model: MODEL, stream: true, stream_options: { include_usage: true }, messages: [{ role: 'user', content: q }] };
      if (scen === 'tool') body.tools = [{ type: 'function', 'function': { name: tools.name, parameters: tools.parameters } }];
    } else if (fmt === 'resp') {
      body = { model: MODEL, input: q, stream: true };
      if (scen === 'resume') body.background = true;
      if (scen === 'tool') body.tools = [tools];
    } else {
      body = { model: MODEL, max_tokens: 1024, stream: true, messages: [{ role: 'user', content: q }] };
      if (scen === 'tool') body.tools = [{ name: tools.name, input_schema: tools.parameters }];
    }
    return '// cliente → servidor\nPOST ' + FORMATS[fmt].path + '\n\n' + J(body);
  }

  function headers(fmt) {
    return 'HTTP/1.1 200 OK\ncontent-type: text/event-stream\ncache-control: no-cache\n' + (fmt === 'anth' ? 'request-id' : 'x-request-id') + ': req_7Hc2';
  }

  /* Cada evento: { t, who: 'client'|'server'|'net', lang, wire, note, log, text, tool, banner, tok, first, end } */
  function build(fmt, scen) {
    var ev = [], t = 0, seq = 0, outTok = 0;
    function push(e) { ev.push(e); return e; }
    function sse(name, data) { return (name ? 'event: ' + name + '\n' : '') + 'data: ' + (typeof data === 'string' ? data : J(data)); }

    push({ t: 0, who: 'client', lang: 'http', wire: request(fmt, scen),
      note: 'El cliente abre la request con stream: true. Todavía no sabe cuánto va a tardar ni cuántos tokens va a recibir.',
      log: 'request recibida: se autentica la clave y se reserva cuota (M18)' });
    push({ t: 35, who: 'server', log: 'la request espera su lugar en el batch del motor', silent: true });
    push({ t: T_HEAD, who: 'server', lang: 'http', wire: headers(fmt),
      note: 'El servidor manda el 200 y los headers antes de generar nada. Desde este momento el código de estado ya no puede cambiar: si algo falla después, tiene que avisarse dentro del stream.',
      log: 'headers enviados; empieza el prefill de ' + F.num(IN_TOK, 0) + ' tokens' });

    var CC_ID = 'chatcmpl-B7x2', CREATED = 1790726400, RID = 'resp_68c1', MID = 'msg_68c1', FID = 'fc_68c1';
    function ccChunk(delta, fin, obf) {
      var o = { id: CC_ID, object: 'chat.completion.chunk', created: CREATED, model: MODEL, choices: [{ index: 0, delta: delta, finish_reason: fin || null }] };
      if (obf) o.obfuscation = obf;
      return o;
    }
    function rs(name, extra) {
      var o = { type: name, sequence_number: seq++ };
      Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
      return sse(name, o);
    }

    /* ---------- apertura del stream según el formato ---------- */
    t = T_HEAD + 10;
    if (fmt === 'resp') {
      push({ t: t, who: 'server', lang: 'sse', wire: rs('response.created', { response: { id: RID, object: 'response', status: scen === 'resume' ? 'queued' : 'in_progress', model: MODEL, output: [] } }),
        note: 'Responses abre con eventos de ciclo de vida. Cada uno trae sequence_number, el cursor que sirve para reanudar el stream.' });
      push({ t: t + 5, who: 'server', lang: 'sse', wire: rs('response.in_progress', { response: { id: RID, status: 'in_progress' } }),
        note: 'La respuesta pasó a in_progress: el motor ya la tomó.' });
    } else if (fmt === 'anth') {
      push({ t: t, who: 'server', lang: 'sse', wire: sse('message_start', { type: 'message_start', message: { id: 'msg_01Xf', type: 'message', role: 'assistant', content: [], model: MODEL, stop_reason: null, stop_sequence: null, usage: { input_tokens: IN_TOK, output_tokens: 1 } } }),
        note: 'message_start trae el mensaje vacío y los tokens de entrada. Cada evento repite su tipo en la línea event: y en el campo type del JSON.' });
    }

    /* ---------- bloque de texto o de herramienta ---------- */
    t = T_FIRST;
    var pieces, kind = 'text', stopAt = null;
    if (scen === 'tool') pieces = ARGS; else pieces = TEXT;
    if (scen === 'error' || scen === 'resume') stopAt = CUT_AT;

    function openBlock(isTool, first) {
      if (fmt === 'cc') {
        if (isTool) return push({ t: t, who: 'server', lang: 'sse', first: first, tool: { name: 'buscar_pedido' },
          wire: sse(null, ccChunk({ role: 'assistant', content: null, tool_calls: [{ index: 0, id: 'call_Qm2', type: 'function', 'function': { name: 'buscar_pedido', arguments: '' } }] }, null, 'z8Kq')),
          note: 'En lugar de texto, el modelo pide una herramienta: el primer chunk trae el id de la llamada y el nombre de la función, con los argumentos vacíos.' });
        return push({ t: t, who: 'server', lang: 'sse', first: first,
          wire: sse(null, ccChunk({ role: 'assistant', content: '' }, null, 'q8Z2r4N7vQ2mT')),
          note: 'Primer chunk: el rol y un texto vacío. El campo obfuscation rellena con caracteres al azar para que el tamaño de cada evento no delate el largo de cada token (una mitigación contra ataques de canal lateral).' });
      }
      if (fmt === 'resp') {
        if (isTool) return push({ t: t, who: 'server', lang: 'sse', first: first, tool: { name: 'buscar_pedido' },
          wire: rs('response.output_item.added', { output_index: 0, item: { id: FID, type: 'function_call', status: 'in_progress', call_id: 'call_Qm2', name: 'buscar_pedido', arguments: '' } }),
          note: 'Aparece un ítem de salida de tipo function_call: la respuesta no es texto, es un pedido de ejecutar buscar_pedido.' });
        push({ t: t, who: 'server', lang: 'sse', first: first,
          wire: rs('response.output_item.added', { output_index: 0, item: { id: MID, type: 'message', status: 'in_progress', role: 'assistant', content: [] } }),
          note: 'La salida de Responses es una lista de ítems (mensajes, llamadas a herramientas, razonamiento). Empieza un ítem de tipo message.' });
        return push({ t: t + 2, who: 'server', lang: 'sse',
          wire: rs('response.content_part.added', { item_id: MID, output_index: 0, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } }),
          note: 'Dentro del mensaje empieza una parte de texto. Los índices output_index y content_index dicen a qué parte de la respuesta pertenece cada delta.' });
      }
      var idx = isTool && scen === 'tool' ? 1 : 0;
      if (isTool) return push({ t: t, who: 'server', lang: 'sse', tool: { name: 'buscar_pedido' },
        wire: sse('content_block_start', { type: 'content_block_start', index: idx, content_block: { type: 'tool_use', id: 'toolu_01Qm', name: 'buscar_pedido', input: {} } }),
        note: 'Empieza el bloque 1, de tipo tool_use. Los argumentos van a llegar como pedazos de JSON (partial_json) que hay que concatenar.' });
      return push({ t: t, who: 'server', lang: 'sse', first: first,
        wire: sse('content_block_start', { type: 'content_block_start', index: idx, content_block: { type: 'text', text: '' } }),
        note: 'Empieza el bloque de contenido 0, de texto. Una respuesta puede tener varios bloques: texto, tool_use, thinking.' });
    }

    function delta(p, isTool, i) {
      outTok++;
      var e = { t: t, who: 'server', lang: 'sse', tok: 1 };
      if (isTool) e.tool = { frag: p }; else e.text = p;
      if (fmt === 'cc') {
        e.wire = sse(null, isTool ? ccChunk({ tool_calls: [{ index: 0, 'function': { arguments: p } }] }, null, pad(i + 7, p)) : ccChunk({ content: p }, null, pad(i + 1, p)));
      } else if (fmt === 'resp') {
        e.wire = isTool ? rs('response.function_call_arguments.delta', { item_id: FID, output_index: 0, delta: p })
          : rs('response.output_text.delta', { item_id: MID, output_index: 0, content_index: 0, delta: p });
      } else {
        var idx = isTool ? 1 : 0;
        e.wire = sse('content_block_delta', { type: 'content_block_delta', index: idx, delta: isTool ? { type: 'input_json_delta', partial_json: p } : { type: 'text_delta', text: p } });
      }
      if (i === 0 && !isTool) e.note = 'Primer token de texto: el TTFT se mide acá. El usuario ya está leyendo aunque falten casi todos los tokens.';
      else if (i === 0) e.note = isTool ? 'Los argumentos llegan en pedazos que no son JSON válido por separado. Se acumulan y se parsean solo cuando el bloque termina.' : '';
      else if (i === 3 && !isTool) e.note = 'Cada token viaja en su propio evento. El texto útil son unos pocos bytes; el JSON que lo envuelve, doscientos o más.';
      return push(e);
    }

    /* texto previo al tool_use en Anthropic */
    if (scen === 'tool' && fmt === 'anth') {
      openBlock(false, true);
      push({ t: t + 1, who: 'server', lang: 'sse', wire: sse('ping', { type: 'ping' }),
        note: 'ping: un evento vacío que mantiene viva la conexión. El cliente lo ignora.' });
      PRE.forEach(function (p, i) { t += TPOT; delta(p, false, i); });
      t += 5;
      push({ t: t, who: 'server', lang: 'sse', wire: sse('content_block_stop', { type: 'content_block_stop', index: 0 }), note: 'Termina el bloque de texto 0.' });
      t += 20;
    }

    var isTool = scen === 'tool';
    openBlock(isTool, !(scen === 'tool' && fmt === 'anth'));
    if (fmt === 'anth' && !isTool) push({ t: t + 1, who: 'server', lang: 'sse', wire: sse('ping', { type: 'ping' }),
      note: 'ping: un evento vacío que mantiene viva la conexión. Puede aparecer en cualquier momento y el cliente lo ignora.' });

    for (var i = 0; i < pieces.length; i++) {
      if (stopAt != null && i === stopAt) break;
      t += TPOT;
      delta(pieces[i], isTool, i);
    }

    /* ---------- final normal ---------- */
    function finish(textPieces) {
      var full = join(textPieces);
      t += 10;
      if (fmt === 'cc') {
        push({ t: t, who: 'server', lang: 'sse', wire: sse(null, ccChunk({}, isTool ? 'tool_calls' : 'stop', 'Hn3')),
          note: isTool ? 'finish_reason: tool_calls. El modelo terminó su turno: ahora tu aplicación ejecuta la función y manda el resultado en una request nueva.' : 'finish_reason: stop. El modelo terminó por su cuenta; con length habría llegado al máximo de tokens y la respuesta estaría cortada.' });
        push({ t: t + 2, who: 'server', lang: 'sse', wire: sse(null, { id: CC_ID, object: 'chat.completion.chunk', created: CREATED, model: MODEL, choices: [], usage: { prompt_tokens: IN_TOK, completion_tokens: outTok, total_tokens: IN_TOK + outTok } }),
          note: 'Con include_usage, un último chunk con choices vacío trae el uso de toda la request. Sin esta opción, el stream no dice cuántos tokens se cobraron.' });
        push({ t: t + 3, who: 'server', lang: 'sse', wire: 'data: [DONE]', end: true,
          note: 'data: [DONE] marca el final. Un stream que se corta sin [DONE] quedó incompleto, aunque el texto parezca terminado.' });
      } else if (fmt === 'resp') {
        if (isTool) {
          push({ t: t, who: 'server', lang: 'sse', wire: rs('response.function_call_arguments.done', { item_id: FID, output_index: 0, arguments: full }),
            note: 'Los argumentos completos, ya como un JSON entero. Recién acá conviene parsearlos y validarlos contra el esquema.' });
          push({ t: t + 1, who: 'server', lang: 'sse', wire: rs('response.output_item.done', { output_index: 0, item: { id: FID, type: 'function_call', status: 'completed', call_id: 'call_Qm2', name: 'buscar_pedido', arguments: full } }),
            note: 'El ítem function_call quedó completo. Tu aplicación ejecuta la función y responde con un ítem function_call_output que lleva el mismo call_id.' });
        } else {
          push({ t: t, who: 'server', lang: 'sse', wire: rs('response.output_text.done', { item_id: MID, output_index: 0, content_index: 0, text: full }),
            note: 'Los eventos .done repiten el contenido completo. Un cliente que perdió algún delta puede corregir su copia con ellos.' });
          push({ t: t + 1, who: 'server', lang: 'sse', wire: rs('response.content_part.done', { item_id: MID, output_index: 0, content_index: 0, part: { type: 'output_text', text: full } }),
            note: 'Se cierra la parte de texto.' });
          push({ t: t + 2, who: 'server', lang: 'sse', wire: rs('response.output_item.done', { output_index: 0, item: { id: MID, type: 'message', status: 'completed', role: 'assistant' } }),
            note: 'Se cierra el ítem del mensaje.' });
        }
        push({ t: t + 4, who: 'server', lang: 'sse', end: true, wire: rs('response.completed', { response: { id: RID, status: 'completed', usage: { input_tokens: IN_TOK, output_tokens: outTok, total_tokens: IN_TOK + outTok } } }),
          note: 'response.completed trae el uso y cierra el stream. Responses no usa [DONE]: el final es este evento.' });
      } else {
        push({ t: t, who: 'server', lang: 'sse', wire: sse('content_block_stop', { type: 'content_block_stop', index: isTool ? 1 : 0 }),
          note: isTool ? 'Termina el bloque tool_use: ahora sí, los pedazos de partial_json forman un objeto completo.' : 'Termina el bloque de texto.' });
        push({ t: t + 1, who: 'server', lang: 'sse', wire: sse('message_delta', { type: 'message_delta', delta: { stop_reason: isTool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: outTok } }),
          note: isTool ? 'stop_reason: tool_use. Tu aplicación ejecuta la herramienta y manda un bloque tool_result con el mismo id.' : 'message_delta trae el stop_reason y el uso de salida. El número es acumulado, no una suma parcial.' });
        push({ t: t + 2, who: 'server', lang: 'sse', end: true, wire: sse('message_stop', { type: 'message_stop' }),
          note: 'message_stop cierra el stream.' });
      }
    }

    if (scen === 'normal' || scen === 'tool') {
      finish(pieces);
      push({ t: t + 6, who: 'server', silent: true, log: 'fin: el uso va al pipeline de facturación (M21) y se liberan los bloques del KV cache', done: true });
      return ev;
    }

    if (scen === 'error') {
      t += 15;
      if (fmt === 'cc') {
        push({ t: t, who: 'net', lang: 'client', wire: '// la conexión se cierra: no llegan finish_reason, usage ni [DONE]',
          note: 'La conexión se cierra a mitad de la respuesta. Con Chat Completions, la regla segura es tratar como incompleto todo stream que termina sin finish_reason ni [DONE], aunque el texto parezca terminado.',
          log: 'el motor descarta la request por sobrecarga; el servidor cierra el stream', banner: { kind: 'fail', text: 'La respuesta se interrumpió. Reintentar' }, end: true });
      } else if (fmt === 'resp') {
        push({ t: t, who: 'server', lang: 'sse', end: true, wire: rs('response.failed', { response: { id: RID, status: 'failed', error: { code: 'server_is_overloaded', message: 'The requested model is temporarily overloaded.' } } }),
          note: 'response.failed: el error viaja dentro del stream porque el 200 ya se había enviado. El cliente conserva el texto parcial y decide si reintenta.',
          log: 'el motor descarta la request por sobrecarga; el servidor avisa con response.failed', banner: { kind: 'fail', text: 'La respuesta se interrumpió: el modelo está sobrecargado. Reintentar' } });
      } else {
        push({ t: t, who: 'server', lang: 'sse', end: true, wire: sse('error', { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }),
          note: 'event: error con overloaded_error, que sin streaming habría sido un HTTP 529. Llega después de un 200: el código de estado no sirve para detectar este fallo.',
          log: 'el motor descarta la request por sobrecarga; el servidor avisa con un evento error', banner: { kind: 'fail', text: 'La respuesta se interrumpió: el servicio está sobrecargado. Reintentar' } });
      }
      return ev;
    }

    /* ---------- corte de red y reanudación ---------- */
    t += 30;
    var got = pieces.slice(0, CUT_AT), rest = pieces.slice(CUT_AT);
    push({ t: t, who: 'net', lang: 'client', wire: '// la red se corta (el teléfono cambia de wifi a datos)',
      note: fmt === 'resp' ? 'Se corta la conexión. El cliente guarda el último sequence_number que recibió: ' + (seq - 1) + '.' : 'Se corta la conexión. El cliente conserva el texto que alcanzó a recibir.',
      log: fmt === 'resp' ? 'la conexión se cae, pero la generación sigue: con background: true no depende del cliente' : 'la conexión se cae: el servidor detecta el cierre y aborta la generación',
      banner: { kind: 'warn', text: 'Conexión perdida. Reconectando…' } });
    t += 900;
    if (fmt === 'resp') {
      var last = seq - 1;
      push({ t: t, who: 'client', lang: 'http', wire: '// cliente → servidor\nGET /v1/responses/' + RID + '?stream=true&starting_after=' + last,
        note: 'El cliente vuelve a pedir el stream desde el evento ' + last + '. El servidor tiene guardados los eventos, así que no se regenera nada.',
        log: 'reconexión: se reenvían los eventos desde el ' + (last + 1) + ' y se sigue en vivo', banner: { kind: 'ok', text: 'Reconectado' } });
      t += 60;
      for (var j = 0; j < rest.length; j++) { t += j < 4 ? 4 : TPOT; delta(rest[j], false, CUT_AT + j); }
      ev[ev.length - rest.length].note = 'Los eventos que se generaron durante el corte llegan juntos, en ráfaga, y después el stream sigue al ritmo del modelo.';
      finish(pieces);
    } else if (fmt === 'anth') {
      var partial = join(got);
      push({ t: t, who: 'client', lang: 'http', wire: '// cliente → servidor: request nueva de continuación\nPOST /v1/messages\n\n' + J({ model: MODEL, max_tokens: 1024, stream: true, messages: [{ role: 'user', content: Q_KV }, { role: 'user', content: 'Tu respuesta anterior se interrumpió y terminó en «' + partial + '». Continúa desde ahí.' }] }),
        note: 'No hay reanudación del lado del servidor. El cliente arma una request nueva con la respuesta parcial y pide continuar: se paga de nuevo toda la entrada, y la continuación puede no empalmar perfecto.',
        log: 'request nueva: entrada de ' + F.num(IN_TOK + 40, 0) + ' tokens; prefill otra vez', banner: { kind: 'ok', text: 'Continuando la respuesta' } });
      t += T_HEAD;
      push({ t: t, who: 'server', lang: 'http', wire: headers(fmt).replace('7Hc2', '9Pd4'), note: 'Otro 200, otro stream.' });
      t += 10;
      push({ t: t, who: 'server', lang: 'sse', wire: sse('message_start', { type: 'message_start', message: { id: 'msg_01Yk', type: 'message', role: 'assistant', content: [], model: MODEL, stop_reason: null, stop_sequence: null, usage: { input_tokens: IN_TOK + 40, output_tokens: 1 } } }),
        note: 'La continuación cuenta otra vez los tokens de entrada, ahora con la respuesta parcial incluida.' });
      t = t + (T_FIRST - T_HEAD);
      push({ t: t, who: 'server', lang: 'sse', wire: sse('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }), note: 'Nuevo bloque de texto.' });
      outTok = 0;
      for (var k = 0; k < rest.length; k++) { t += TPOT; delta(rest[k], false, CUT_AT + k); }
      t += 10;
      push({ t: t, who: 'server', lang: 'sse', wire: sse('content_block_stop', { type: 'content_block_stop', index: 0 }), note: 'Termina el bloque.' });
      push({ t: t + 1, who: 'server', lang: 'sse', wire: sse('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: outTok } }), note: 'La continuación terminó bien.' });
      push({ t: t + 2, who: 'server', lang: 'sse', end: true, wire: sse('message_stop', { type: 'message_stop' }), note: 'Fin del segundo stream.' });
    } else {
      push({ t: t, who: 'client', lang: 'http', wire: request('cc', 'normal'),
        note: 'Chat Completions no tiene cómo reanudar: el cliente repite la request entera. El modelo genera todo otra vez, se paga dos veces y la respuesta puede salir distinta.',
        log: 'request nueva desde cero: prefill y decode otra vez', banner: { kind: 'ok', text: 'Reintentando desde el principio' }, clearText: true });
      t += T_HEAD;
      push({ t: t, who: 'server', lang: 'http', wire: headers(fmt).replace('7Hc2', '9Pd4'), note: 'Otro 200, otro stream.' });
      t = t + (T_FIRST - T_HEAD);
      push({ t: t, who: 'server', lang: 'sse', wire: sse(null, ccChunk({ role: 'assistant', content: '' }, null, 'w2Pd8Ls4Kq9Zt')), note: 'El stream empieza de cero.' });
      outTok = 0;
      for (var m = 0; m < ALT.length; m++) { t += TPOT; delta(ALT[m], false, m); }
      ev[ev.length - ALT.length + 3].note = 'Fíjate en el texto: con muestreo, la segunda generación no es igual a la primera.';
      finish(ALT);
    }
    push({ t: t + 6, who: 'server', silent: true, log: 'fin: se registra el uso y se liberan los bloques del KV cache', done: true });
    return ev;
  }

  /* ======================= Visor ======================= */

  var enc = window.TextEncoder ? new TextEncoder() : null;
  function bytesOf(s) { return enc ? enc.encode(s).length : s.length; }

  function initSSE(host) {
    var fmt = 'cc', scen = 'normal', events = [], shown = 0, timer = null, cancelled = false;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var chips = h('div', { class: 'calc-presets', role: 'group', 'aria-label': 'Formato de la API' });
    Object.keys(FORMATS).forEach(function (k) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': k === fmt ? 'true' : 'false', text: FORMATS[k].name });
      b.addEventListener('click', function () { fmt = k; chips.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); reset(); });
      chips.appendChild(b);
    });
    var sel = h('select', { id: 'sse-scen-' + (++uid) }, Object.keys(SCENARIOS).map(function (k) { return h('option', { value: k, text: SCENARIOS[k] }); }));
    sel.addEventListener('change', function () { scen = sel.value; reset(); });

    var play = h('button', { type: 'button', class: 'btn btn--primary', text: 'Reproducir' });
    var step = h('button', { type: 'button', class: 'btn', text: 'Siguiente evento' });
    var stop = h('button', { type: 'button', class: 'btn', text: 'Detener la respuesta' });
    var again = h('button', { type: 'button', class: 'btn btn--ghost', text: 'Reiniciar' });

    var wire = h('div', { class: 'sse-wire', tabindex: '0', 'aria-label': 'Eventos que viajan por la conexión' });
    var textEl = h('p', { class: 'sse-text' });
    var caret = h('span', { class: 'sse-caret' + (reduce ? ' is-still' : ''), 'aria-hidden': 'true' });
    var toolEl = h('div', { class: 'sse-tool', hidden: true });
    var banner = h('p', { class: 'sse-banner', hidden: true });
    var view = h('div', { class: 'sse-view' }, [h('p', { class: 'sse-q' }), h('div', {}, [textEl]), toolEl, banner]);
    var log = h('ol', { class: 'raft-log sse-log', 'aria-label': 'Qué pasa en el servidor' });
    var stats = h('div', { class: 'sim-stats' });
    var note = h('p', { class: 'sim-note', 'aria-live': 'polite' });

    function stat(label, value) { stats.appendChild(h('div', { class: 'sim-stat' }, [h('span', { text: label }), h('b', { text: value })])); }

    function reset() {
      pause();
      cancelled = false;
      events = build(fmt, scen);
      shown = 0;
      wire.innerHTML = ''; log.innerHTML = ''; textEl.textContent = ''; toolEl.hidden = true; toolEl.textContent = '';
      banner.hidden = true; banner.className = 'sse-banner';
      view.querySelector('.sse-q').textContent = scen === 'tool' ? Q_TOOL : Q_KV;
      textEl.appendChild(caret);
      note.textContent = 'Elige un formato y un escenario, y reproduce el stream o avánzalo evento por evento. Puedes detener la respuesta en cualquier momento.';
      update();
    }

    var toolName = '', toolArgs = '';
    function apply(e) {
      if (e.log) log.insertBefore(h('li', {}, [h('span', { class: 'raft-t', text: F.num(e.t, 0) + ' ms' }), h('span', { text: e.log })]), log.firstChild);
      if (e.clearText) { textEl.textContent = ''; textEl.appendChild(caret); }
      if (e.wire) {
        var pre = h('pre', { class: 'sse-ev is-' + e.who, 'data-lang': e.lang === 'client' ? null : e.lang }, [h('code', { text: e.wire })]);
        wire.querySelectorAll('.is-last').forEach(function (x) { x.classList.remove('is-last'); });
        pre.classList.add('is-last');
        wire.appendChild(pre);
        SD.highlight(wire);
        wire.scrollTop = wire.scrollHeight;
      }
      if (e.text) textEl.insertBefore(document.createTextNode(e.text), caret);
      if (e.tool) {
        if (e.tool.name) { toolName = e.tool.name; toolArgs = ''; }
        if (e.tool.frag) toolArgs += e.tool.frag;
        toolEl.hidden = false;
        toolEl.textContent = 'Llamada a herramienta: ' + toolName + '(' + toolArgs + ')';
      }
      if (e.banner) { banner.hidden = false; banner.className = 'sse-banner is-' + e.banner.kind; banner.textContent = e.banner.text; }
      if (e.note) note.textContent = e.note;
    }

    function update() {
      var last = shown ? events[shown - 1] : null, t = last ? last.t : 0;
      var nEv = 0, bytes = 0, tok = 0, first = null;
      for (var i = 0; i < shown; i++) {
        var e = events[i];
        if (e.who === 'server' && e.wire) { bytes += bytesOf(e.wire) + 2; if (e.lang === 'sse') nEv++; }
        if (e.tok) { tok += e.tok; if (first == null) first = e.t; }
      }
      stats.innerHTML = '';
      stat('Tiempo', F.num(t, 0) + ' ms');
      stat('Primer token', first == null ? '—' : F.num(first, 0) + ' ms');
      stat('Eventos SSE', F.num(nEv, 0));
      stat('Bytes recibidos', F.num(bytes, 0));
      stat('Tokens de salida', F.num(tok, 0));
      var ended = shown >= events.length || cancelled;
      step.disabled = ended; play.disabled = ended;
      stop.disabled = ended || shown < 3 || (last && (last.end || last.done));
      if (ended) { caret.remove(); if (timer) pause(); }
    }

    function next() {
      if (shown >= events.length || cancelled) return false;
      var e = events[shown++];
      apply(e);
      /* los eventos del servidor sin nada visible (silent) se muestran junto con el siguiente */
      while (shown < events.length && events[shown].silent) apply(events[shown++]);
      update();
      return shown < events.length;
    }

    function delay() {
      if (shown >= events.length) return 0;
      var prev = shown ? events[shown - 1].t : 0, dt = events[shown].t - prev;
      return Math.max(90, Math.min(650, dt * 2.2));
    }
    function tick() { timer = null; if (next()) timer = setTimeout(tick, delay()); else pause(); }
    function pause() { if (timer) clearTimeout(timer); timer = null; play.textContent = 'Reproducir'; }
    play.addEventListener('click', function () {
      if (timer) { pause(); return; }
      play.textContent = 'Pausa';
      tick();
    });
    step.addEventListener('click', function () { pause(); next(); });
    again.addEventListener('click', reset);
    stop.addEventListener('click', function () {
      pause();
      var t = shown ? events[shown - 1].t : 0, got = 0;
      for (var i = 0; i < shown; i++) if (events[i].tok) got += events[i].tok;
      cancelled = true;
      apply({ t: t + 5, who: 'client', lang: 'client', wire: '// el cliente llama a AbortController.abort(): se cierra la conexión (en HTTP/2, un RST_STREAM)',
        log: 'el usuario detuvo la respuesta', banner: { kind: 'warn', text: 'Detenido. Lo que ya llegó queda en pantalla.' },
        note: 'El cliente cierra la conexión. El servidor no recibe un mensaje de "cancelar": se entera porque la conexión se cerró, y tiene que propagar la cancelación hasta el motor.' });
      apply({ t: t + 25, who: 'server', log: 'la escritura del siguiente evento falla: conexión cerrada' });
      apply({ t: t + 30, who: 'server', log: 'abort(req_7Hc2): el motor saca la request del batch y libera sus bloques del KV cache' });
      apply({ t: t + 32, who: 'server', log: 'se registra el uso parcial: ' + F.num(IN_TOK, 0) + ' de entrada y ' + F.num(got, 0) + ' de salida' });
      update();
    });

    host.classList.add('sim', 'sse-sim');
    host.appendChild(h('div', { class: 'sim-head' }, [h('p', { class: 'sim-title', text: 'Un stream, evento por evento' }), chips]));
    host.appendChild(h('div', { class: 'sim-body' }, [
      h('div', { class: 'sim-controls' }, [
        h('div', { class: 'field' }, [h('label', { for: sel.id, text: 'Escenario' }), sel]),
        h('div', { class: 'btn-row' }, [play, step, stop, again])
      ]),
      h('div', { class: 'sse-grid' }, [
        h('div', {}, [h('p', { class: 'sse-col-title', text: 'Lo que viaja por la conexión' }), wire]),
        h('div', {}, [h('p', { class: 'sse-col-title', text: 'Lo que ve el usuario' }), view,
          h('p', { class: 'sse-col-title sse-col-title--gap', text: 'Qué pasa en el servidor' }), log])
      ]),
      note, stats
    ]));
    host.appendChild(h('p', { class: 'sim-foot', text: 'Formatos según la documentación de OpenAI y de Anthropic, con ids acortados y un modelo genérico. Tiempos de ejemplo: 70 ms hasta los headers, 380 ms hasta el primer token y 40 ms por token. Los bytes cuentan todo lo que manda el servidor.' }));
    reset();
  }
  var uid = 0;

  /* ======================= Capacidad del streaming ======================= */

  function initCap(host) {
    var n = 0;
    function num(label, value, step, hint) {
      var id = 'sc' + (++n) + '-' + (++uid);
      var i = h('input', { id: id, type: 'number', min: 0, step: step, value: value, inputmode: 'decimal' });
      var kids = [h('label', { for: id, text: label }), i];
      if (hint) kids.push(h('p', { class: 'field-hint', text: hint }));
      return { el: h('div', { class: 'field' }, kids), input: i };
    }
    var f = {
      rps: num('Requests por segundo en el pico', 2000, 100),
      out: num('Tokens de salida por respuesta', 600, 50),
      speed: num('Velocidad de cada stream (tokens/s)', 50, 5, 'Lo que ve el usuario: 1 ÷ TPOT.'),
      ttft: num('TTFT (s)', 0.8, 0.1),
      evb: num('Bytes por evento en la conexión', 260, 10, 'Un chunk de Chat Completions con obfuscation pesa unos 250 a 300 bytes.'),
      tpe: num('Tokens por evento', 1, 1, 'Algunos servidores juntan varios tokens por evento para gastar menos.'),
      conn: num('Streams abiertos por instancia del gateway', 10000, 1000, 'Límite práctico por memoria, descriptores y CPU de TLS.')
    };
    function out(label, formula) {
      var v = h('output', { class: 'out-value' });
      return { el: h('div', { class: 'out-row' }, [h('span', { class: 'out-label', text: label }), v, h('span', { class: 'out-formula', text: formula })]), v: v };
    }
    var o = {
      dur: out('Duración de cada stream', 'TTFT + tokens ÷ velocidad'),
      open: out('Streams abiertos a la vez', 'ley de Little: requests/s × duración'),
      evs: out('Eventos por segundo', 'requests/s × tokens ÷ tokens por evento'),
      bw: out('Ancho de banda de salida', 'eventos/s × bytes por evento'),
      over: out('Bytes en la conexión por byte de texto', 'bytes por evento ÷ (tokens por evento × 4 bytes)'),
      inst: out('Instancias del gateway solo por conexiones', 'streams abiertos ÷ streams por instancia')
    };
    function v(k) { var x = parseFloat(f[k].input.value); return isFinite(x) && x >= 0 ? x : 0; }
    function run() {
      var rps = v('rps'), tok = v('out'), sp = Math.max(0.1, v('speed')), tpe = Math.max(1, v('tpe'));
      var dur = v('ttft') + tok / sp, open = rps * dur, evs = rps * tok / tpe, bw = evs * v('evb');
      o.dur.v.textContent = F.duration(dur);
      o.open.v.textContent = F.num(open, 0);
      o.evs.v.textContent = F.words(evs);
      o.bw.v.textContent = F.bitrate(bw);
      o.over.v.textContent = F.num(v('evb') / (tpe * 4), 0) + '×';
      o.inst.v.textContent = F.num(Math.ceil(open / Math.max(1, v('conn'))), 0);
    }
    var inCol = h('div', { class: 'calc-inputs' }), outCol = h('div', { class: 'calc-outputs', 'aria-live': 'polite' });
    Object.keys(f).forEach(function (k) { inCol.appendChild(f[k].el); f[k].input.addEventListener('input', run); });
    Object.keys(o).forEach(function (k) { outCol.appendChild(o[k].el); });
    host.classList.add('calc');
    host.appendChild(h('div', { class: 'calc-head' }, [h('p', { class: 'calc-title', text: 'Cuánto cuesta mantener los streams abiertos' })]));
    host.appendChild(h('div', { class: 'calc-body' }, [inCol, outCol]));
    host.appendChild(h('p', { class: 'calc-foot', text: 'Supone un token de unos 4 bytes de texto y que cada stream queda abierto desde la request hasta el último token. No cuenta la entrada, que viaja una sola vez en la request.' }));
    run();
  }

  SD.ready(function () {
    document.querySelectorAll('[data-sim="sse"]').forEach(initSSE);
    document.querySelectorAll('[data-calc="streamcap"]').forEach(initCap);
  });
})();
