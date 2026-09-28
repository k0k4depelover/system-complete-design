// Capturas guiadas por pasos, en modo claro u oscuro.
// Uso: node tools/test/shots.mjs <salida> <página relativa a la raíz> <light|dark> <ancho> "<paso>|<paso>|..."
// Pasos:  @selector       desplaza hasta el elemento y captura
//         hover:selector  mueve el mouse sobre el elemento y captura
//         click:selector  hace clic con el mouse real (Input.dispatchMouseEvent)
//         tap:selector    toque en pantalla táctil (Input.dispatchTouchEvent)
//         key:Tecla       pulsa una tecla (Tab, Escape, Enter)
//         eval:código     ejecuta JS en la página y muestra el resultado
//         shot            captura la ventana tal como está
//         full            captura la página completa (hasta 16000 px)
import fs from 'node:fs';
import { launch, sleep } from './cdp.mjs';
const ROOT = new URL('../../', import.meta.url);
const [OUT, PAGE, SCHEME = 'light', WIDTH = '1440', STEPS = ''] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const b = await launch({ port: 9339 });
const width = +WIDTH, mobile = width < 700;
let n = 0;
const file = (tag) => `${OUT}/${String(++n).padStart(2, '0')}-${SCHEME}-${tag.replace(/[^a-z0-9]+/gi, '_').slice(0, 30)}.png`;
async function center(sel) {
  return b.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
    e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + Math.min(r.width / 2, 40), y: r.top + r.height / 2 }; })()`);
}
try {
  await b.viewport(width, mobile ? 844 : 900, mobile);
  if (mobile) await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: SCHEME }] });
  await b.goto(new URL(PAGE, ROOT).href, 1000);
  for (const step of STEPS.split('|').filter(Boolean)) {
    const [kind, ...rest] = step.split(':');
    const arg = rest.join(':');
    if (step === 'shot') { await b.shot(file('shot')); continue; }
    if (step === 'full') { await b.shot(file('full'), { full: true }); continue; }
    if (step.startsWith('@')) {
      const ok = await b.eval(`(() => { const e = document.querySelector(${JSON.stringify(step.slice(1))}); if (!e) return false;
        window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 80); return true; })()`);
      if (!ok) { console.log('NO EXISTE', step); continue; }
      await sleep(250); await b.shot(file(step.slice(1)));
    } else if (kind === 'hover' || kind === 'click') {
      const p = await center(arg);
      if (!p) { console.log('NO EXISTE', arg); continue; }
      await sleep(150);
      await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
      if (kind === 'click') {
        await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
        await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      }
      await sleep(350); await b.shot(file(kind + '-' + arg));
    } else if (kind === 'tap') {
      const p = await center(arg);
      if (!p) { console.log('NO EXISTE', arg); continue; }
      await sleep(150);
      await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
      await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(400); await b.shot(file('tap-' + arg));
    } else if (kind === 'key') {
      const codes = { Tab: 9, Escape: 27, Enter: 13 };
      await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: arg, code: arg, windowsVirtualKeyCode: codes[arg] || 0 });
      await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: arg, code: arg, windowsVirtualKeyCode: codes[arg] || 0 });
      await sleep(250);
    } else if (kind === 'eval') {
      console.log('EVAL', arg.slice(0, 60), '→', JSON.stringify(await b.eval(arg)));
    }
  }
  const errs = b.logs.filter((l) => /exception|console\.(error|warn)|log\.error/.test(l));
  console.log(errs.length ? errs.join('\n') : 'sin errores de consola');
} catch (e) { console.error('ERROR', e); console.log(b.logs.join('\n')); }
finally { await b.close(); }
