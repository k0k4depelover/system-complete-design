// Prueba de una página de módulo: errores, glosario, mapas, quiz y capturas.
// Uso: node tools/test/test-page.mjs <carpeta de salida> <archivo en modules/> [selectores a capturar, separados por |]
// Abre la página en Chrome headless (file://), reporta errores de consola y términos del glosario faltantes,
// recorre todos los pasos de los escenarios de cada mapa, revisa desborde en móvil y guarda capturas.
import { launch, sleep } from './cdp.mjs';
const ROOT = new URL('../../', import.meta.url).href;   // raíz del proyecto como URL file://
const [OUT, FILE, SELS] = process.argv.slice(2);
const b = await launch({ port: 9335 });
const log = (...a) => console.log(...a);
async function at(sel, file, offset = 70) {
  const ok = await b.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return false; window.scrollTo(0, e.getBoundingClientRect().top + scrollY - ${offset}); return true;})()`);
  if (!ok) { log('NO EXISTE', sel); return; }
  await sleep(300);
  await b.shot(OUT + '/' + file);
}
try {
  await b.viewport(1440, 900);
  await b.goto(ROOT + 'modules/' + FILE, 1200);
  log('PAGE', await b.eval(`JSON.stringify({
    title: document.title,
    terms: document.querySelectorAll('.term-link').length,
    missing: [...document.querySelectorAll('.term-missing')].map(e => e.dataset.term),
    quiz: document.querySelectorAll('.q').length,
    maps: document.querySelectorAll('.sdmap').length,
    calcs: document.querySelectorAll('.calc').length,
    sims: document.querySelectorAll('[data-sim]').length,
    toc: document.querySelectorAll('.toc a').length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  })`));
  // Mapas: recorrer todos los pasos de todos los escenarios
  const mapRes = await b.eval(`(async () => {
    const out = [];
    for (const el of document.querySelectorAll('.sdmap')) {
      const m = el._map; if (!m) { out.push('sin instancia'); continue; }
      const r = { nodes: Object.keys(m.nodes).length, edges: Object.keys(m.edges).length, scen: [] };
      for (const sc of (m.def.scenarios || [])) {
        m.openScenario(sc.id, -1);
        for (let i = 0; i < sc.steps.length; i++) await m.go(i, false);
        r.scen.push(sc.id + ':' + sc.steps.length + ':' + m.clock.textContent);
      }
      // cada nodo con sus 5 pestañas
      const empty = [];
      for (const id of Object.keys(m.nodes)) { const inf = m.nodes[id].def.info || {}; ['resp','api','data','fail','nums'].forEach(k => { if (!inf[k]) empty.push(id + '.' + k); }); }
      r.emptyTabs = empty;
      out.push(r);
    }
    return JSON.stringify(out);
  })()`);
  log('MAPS', mapRes);
  const sels = (SELS || '').split('|').filter(Boolean);
  let i = 0;
  for (const s of sels) await at(s, `p${++i}.png`);
  // mapa: nodo seleccionado y paso de escenario a media reproducción
  const hasMap = await b.eval(`!!document.querySelector('.sdmap')`);
  if (hasMap) {
    await b.eval(`(()=>{const m=document.querySelector('.sdmap')._map; m.openScenario(m.def.scenarios[0].id, -1); m.select(Object.keys(m.nodes)[Math.min(5, Object.keys(m.nodes).length-1)]); })()`);
    await at('.sdmap', 'map-node.png', 60);
    await b.eval(`(()=>{const m=document.querySelector('.sdmap')._map; const n=m.def.scenarios[0].steps.length; m.go(Math.floor(n*0.6), true);})()`);
    await sleep(400);
    await b.shot(OUT + '/map-step.png');
    await b.eval(`window.scrollBy(0, 420)`); await sleep(200);
    await b.shot(OUT + '/map-step2.png');
  }
  await b.viewport(390, 844, true);
  await b.goto(ROOT + 'modules/' + FILE, 1000);
  log('MOBILE', await b.eval(`JSON.stringify({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, wide: [...document.querySelectorAll('.content *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > document.documentElement.clientWidth + 1 && !e.closest('.table-wrap,.figure-frame,pre,.sdm-stage,.sim-scroll'); }).slice(0,6).map(e => e.tagName + '.' + e.className)})`));
  if (hasMap) await at('.sdmap', 'm-map.png', 60);
  log('LOGS\n' + b.logs.join('\n'));
} catch (e) { console.error('ERROR', e); console.log(b.logs.join('\n')); }
finally { await b.close(); }
