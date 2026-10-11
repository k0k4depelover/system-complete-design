// Revisa la geometría de los mapas sin abrir Chrome: cajas que se pisan, aristas que atraviesan
// cajas ajenas y etiquetas de aristas que se pisan entre sí o con una caja.
// Usa las mismas fórmulas que map-engine.js (ancho estimado del nodo, borde del bus, punto de la etiqueta).
//
//   node tools/test/map-lint.mjs                         revisa todos los mapas de assets/js/data/maps/
//   node tools/test/map-lint.mjs assets/js/data/maps/chatgpt.data.js
//
// Sale con código 1 si encuentra algún problema.
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import vm from 'node:vm';

const GAP_BOX = 16;     // separación mínima entre cajas
const PAD_EDGE = 4;     // margen al revisar si una arista cruza una caja
const CHAR = 6.3;       // ancho de un carácter de la etiqueta (monoespaciada de 10.5 px)
const LABEL_H = 14;

function loadMaps(file) {
  const maps = [];
  const SD = { defineMap: (id, def) => maps.push({ id, def }), data: {} };
  vm.runInNewContext(readFileSync(file, 'utf8'), { SD, console });
  return maps;
}

function sizeNodes(def) {
  for (const n of def.nodes) {
    const need = 46 + Math.max(n.label.length * 7.6, (n.sub || '').length * 6.1) + 16;
    n.w = Math.max(n.w || 188, Math.ceil(need)); n.h = n.h || 60;
  }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function boxPoint(n, tx, ty, pad) {
  const dx = tx - n.x, dy = ty - n.y;
  if (!dx && !dy) return [n.x, n.y];
  const hw = n.w / 2 + pad, hh = n.h / 2 + pad;
  if (n.bus) {
    if (Math.abs(dx) > n.w / 2) return [n.x + (dx > 0 ? hw : -hw), clamp(ty, n.y - n.h / 2 + 12, n.y + n.h / 2 - 12)];
    return [clamp(tx, n.x - n.w / 2 + 12, n.x + n.w / 2 - 12), n.y + (dy > 0 ? hh : -hh)];
  }
  const sc = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return [n.x + dx * sc, n.y + dy * sc];
}

// Puntos de la arista (recta o curva cuadrática muestreada) y punto de la etiqueta
function edgeGeom(a, b, bend, t) {
  let cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
  if (t == null) t = 0.5;
  if (bend) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    cx += -dy / len * bend; cy += dx / len * bend;
  }
  let p1, p2;
  if (!bend && b.bus) { p2 = boxPoint(b, a.x, a.y, 5); p1 = boxPoint(a, p2[0], p2[1], 3); }
  else if (!bend && a.bus) { p1 = boxPoint(a, b.x, b.y, 3); p2 = boxPoint(b, p1[0], p1[1], 5); }
  else { p1 = boxPoint(a, bend ? cx : b.x, bend ? cy : b.y, 3); p2 = boxPoint(b, bend ? cx : a.x, bend ? cy : a.y, 5); }
  const at = (u) => {
    const v = 1 - u;
    return bend ? [v * v * p1[0] + 2 * v * u * cx + u * u * p2[0], v * v * p1[1] + 2 * v * u * cy + u * u * p2[1]]
                : [p1[0] + u * (p2[0] - p1[0]), p1[1] + u * (p2[1] - p1[1])];
  };
  const pts = [];
  for (let i = 0; i <= 40; i++) pts.push(at(i / 40));
  return { pts, label: at(t) };
}

const rectOf = (n, m = 0) => ({ x0: n.x - n.w / 2 - m, y0: n.y - n.h / 2 - m, x1: n.x + n.w / 2 + m, y1: n.y + n.h / 2 + m });
const overlap = (r, q) => r.x0 < q.x1 && q.x0 < r.x1 && r.y0 < q.y1 && q.y0 < r.y1;

// ¿El segmento p-q toca el rectángulo r? (Liang-Barsky)
function segHitsRect(p, q, r) {
  let t0 = 0, t1 = 1;
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const tests = [[-dx, p[0] - r.x0], [dx, r.x1 - p[0]], [-dy, p[1] - r.y0], [dy, r.y1 - p[1]]];
  for (const [pp, qq] of tests) {
    if (pp === 0) { if (qq < 0) return false; continue; }
    const u = qq / pp;
    if (pp < 0) { if (u > t1) return false; if (u > t0) t0 = u; }
    else { if (u < t0) return false; if (u < t1) t1 = u; }
  }
  return true;
}

function lint(id, def) {
  sizeNodes(def);
  const byId = Object.fromEntries(def.nodes.map((n) => [n.id, n]));
  const issues = [];
  const nodes = def.nodes;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (overlap(rectOf(nodes[i], GAP_BOX / 2), rectOf(nodes[j], GAP_BOX / 2))) {
        issues.push(`cajas pisadas o a menos de ${GAP_BOX} px: ${nodes[i].id} y ${nodes[j].id}`);
      }
    }
  }

  const labels = [];
  for (const e of def.edges || []) {
    const a = byId[e.from], b = byId[e.to];
    if (!a || !b) { issues.push(`arista ${e.id} con nodo inexistente`); continue; }
    const g = edgeGeom(a, b, e.bend || 0, e.labelAt);
    for (const n of nodes) {
      if (n === a || n === b) continue;
      const r = rectOf(n, PAD_EDGE);
      for (let k = 0; k < g.pts.length - 1; k++) {
        if (segHitsRect(g.pts[k], g.pts[k + 1], r)) { issues.push(`arista ${e.id} (${e.from}→${e.to}) cruza la caja ${n.id}`); break; }
      }
    }
    if (e.label) {
      const w = e.label.length * CHAR + 8;
      labels.push({ e, r: { x0: g.label[0] - w / 2, x1: g.label[0] + w / 2, y0: g.label[1] - LABEL_H / 2, y1: g.label[1] + LABEL_H / 2 } });
    }
  }
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (overlap(labels[i].r, labels[j].r)) issues.push(`etiquetas pisadas: ${labels[i].e.id} "${labels[i].e.label}" y ${labels[j].e.id} "${labels[j].e.label}"`);
    }
    for (const n of nodes) {
      if (overlap(labels[i].r, rectOf(n, 2))) issues.push(`etiqueta de ${labels[i].e.id} "${labels[i].e.label}" sobre la caja ${n.id}`);
    }
  }
  return issues;
}

const dir = 'assets/js/data/maps';
const files = process.argv.length > 2 ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith('.data.js')).map((f) => join(dir, f));
let total = 0;
for (const f of files) {
  for (const { id, def } of loadMaps(f)) {
    const issues = lint(id, def);
    total += issues.length;
    console.log(`== ${id} (${basename(f)}): ${def.nodes.length} nodos, ${(def.edges || []).length} aristas, ${issues.length} problemas`);
    for (const s of issues) console.log('  ' + s);
  }
}
process.exit(total ? 1 : 0);
