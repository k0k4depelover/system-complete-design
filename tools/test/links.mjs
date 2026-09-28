// Revisa los enlaces automáticos a términos en todas las páginas publicadas.
// Uso: node tools/test/links.mjs [archivo.html ...]   (sin argumentos: todos los módulos y el glosario)
// Reporta errores de consola, enlaces anidados o en encabezados, destinos rotos y, por sección, qué se enlazó.
import fs from 'node:fs';
import { launch } from './cdp.mjs';
const ROOT = new URL('../../', import.meta.url);
const files = process.argv.slice(2).length ? process.argv.slice(2)
  : fs.readdirSync(new URL('modules/', ROOT)).filter((f) => f.endsWith('.html')).map((f) => 'modules/' + f).concat(['glosario.html']);
const b = await launch({ port: 9337 });
let problems = 0;
try {
  await b.viewport(1440, 900);
  for (const f of files) {
    b.logs.length = 0;
    await b.goto(new URL(f, ROOT).href, 900);
    const r = JSON.parse(await b.eval(`JSON.stringify((() => {
      const links = [...document.querySelectorAll('a.term-link')];
      const bad = [];
      links.forEach((a) => {
        if (a.parentElement.closest('a')) bad.push('anidado: ' + a.textContent);
        if (a.closest('h1,h2,h3,h4,h5,h6')) bad.push('en encabezado: ' + a.textContent);
        const href = a.getAttribute('href');
        if (href.startsWith('#') && !document.getElementById(href.slice(1))) bad.push('ancla rota: ' + href);
      });
      /* sección h2 de cada enlace */
      const bySec = {};
      let cur = '(inicio)';
      const walker = document.createTreeWalker(document.querySelector('.content') || document.body, NodeFilter.SHOW_ELEMENT);
      let n;
      while ((n = walker.nextNode())) {
        if (n.tagName === 'H2') cur = n.id || n.textContent.trim().slice(0, 20);
        if (n.matches('a.term-link')) (bySec[cur] = bySec[cur] || []).push(n.textContent.replace(/\\s+/g, ' ') + '→' + n.dataset.term + (n.getAttribute('href').includes('glosario') ? '(g)' : n.getAttribute('href').startsWith('#') ? '(#)' : '(m)'));
      }
      return { total: links.length, bad, bySec, missing: [...document.querySelectorAll('.term-missing')].map((e) => e.dataset.term) };
    })())`));
    const errs = b.logs.filter((l) => /exception|console\.(error|warn)|log\.error/.test(l));
    console.log(`\n== ${f}: ${r.total} enlaces`);
    errs.forEach((e) => { problems++; console.log('  !! ' + e); });
    r.bad.forEach((e) => { problems++; console.log('  !! ' + e); });
    r.missing.forEach((e) => { problems++; console.log('  !! término faltante: ' + e); });
    if (!f.includes('glosario')) for (const [s, l] of Object.entries(r.bySec)) console.log(`  ${s}: ${l.join(', ')}`);
  }
} finally {
  await b.close();
}
console.log(`\n${problems} problemas`);
