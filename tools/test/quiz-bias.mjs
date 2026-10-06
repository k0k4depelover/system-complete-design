// Mide si la longitud de las opciones delata la respuesta correcta en quizzes, ejercicios guiados y decisiones de proyectos.
// Uso: node tools/test/quiz-bias.mjs [archivo.data.js ...]   (sin argumentos: quizzes/, exercises/ y projects/)
// Sale con código 1 si en un archivo la correcta es la más larga (o la más corta) en más del 40 % de las preguntas,
// o si en todo el sitio es la más larga en más del 35 %: así la longitud no sirve de pista en ningún sentido.
import fs from 'node:fs';
import vm from 'node:vm';
const ROOT = new URL('../../assets/js/data/', import.meta.url);
const DIRS = ['quizzes/', 'exercises/', 'projects/'];
const FILE_MAX = 0.4, SITE_MAX = 0.35, MARGIN = 1.1, SHORT = 30;

const files = process.argv.slice(2).length ? process.argv.slice(2).map((f) => new URL(f, new URL('../../', import.meta.url)))
  : DIRS.flatMap((d) => fs.readdirSync(new URL(d, ROOT)).filter((f) => f.endsWith('.data.js')).map((f) => new URL(d + f, ROOT)));

/* Texto visible: sin etiquetas y con cada entidad contada como un carácter. */
const len = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&[#\w]+;/g, 'x').length;
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;

let all = 0, allLong = 0, failed = 0;
for (const url of files) {
  const qs = [];
  const SD = { defineQuiz: (id, o) => qs.push(...o.questions), defineExercise: (id, o) => qs.push(...(o.steps || [])) };
  try { vm.runInNewContext(fs.readFileSync(url, 'utf8'), { SD, window: { SD } }); }
  catch (e) { console.log(`${url.pathname.split('/data/')[1]}  NO CARGA: ${e.message}`); failed++; continue; }
  let n = 0, long = 0, short = 0;
  const flagged = [], shorts = [];
  for (const q of qs) {
    if (!q.options) continue;
    const L = q.options.map(len);
    if (Math.max(...L) < SHORT) continue; /* opciones numéricas o etiquetas cortas: la longitud no informa */
    n++;
    const ok = [].concat(q.answer);
    const c = avg(ok.map((i) => L[i]));
    const rest = L.filter((_, i) => !ok.includes(i));
    if (!rest.length) continue;
    /* single: la correcta es la más larga (o la más corta) de todas. multi: el promedio de las correctas supera en 10 % al de las otras. */
    const multi = Array.isArray(q.answer);
    if (multi ? c > avg(rest) * MARGIN : c > Math.max(...rest)) { long++; flagged.push(q.id); }
    else if (multi ? c * MARGIN < avg(rest) : c < Math.min(...rest)) { short++; shorts.push(q.id); }
  }
  all += n; allLong += long;
  const bad = n && (long / n > FILE_MAX || short / n > FILE_MAX);
  if (bad) failed++;
  const name = url.pathname.split('/data/')[1];
  console.log(`${bad ? '✗' : '✓'} ${name.padEnd(26)} más larga ${String(long).padStart(2)}/${n}  más corta ${String(short).padStart(2)}/${n}${flagged.length ? '  larga: ' + flagged.join(', ') : ''}${shorts.length ? '  corta: ' + shorts.join(', ') : ''}`);
}
const site = all ? allLong / all : 0;
console.log(`\nTotal: la correcta es la más larga en ${allLong}/${all} (${(site * 100).toFixed(1)} %). Límites: ${FILE_MAX * 100} % por archivo, ${SITE_MAX * 100} % en total.`);
if (failed || (process.argv.length <= 2 && site > SITE_MAX)) process.exit(1);
