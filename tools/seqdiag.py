# Generador de diagramas de secuencia en SVG con las clases del curso.
# seq(id, titulo, desc, actores, mensajes, ancho=770)
#   actores: [("cli", "Cliente"), ...]
#   mensajes: ("cli", "api", "POST /pagos", "req")  kind: req | res | fail | async
#             ("note", "api", "texto")               nota junto a un actor
#             ("cut", "texto")                          separador horizontal (p. ej. "la red se corta")
from html import escape

def seq(sid, title, desc, actors, msgs, width=770, row=34, top=64):
    n = len(actors)
    margin = 70
    xs = {a: margin + i * (width - 2 * margin) / (n - 1) for i, (a, _) in enumerate(actors)}
    step = (width - 2 * margin) / (n - 1) if n > 1 else 124
    bw = min(124, step - 8)                     # con muchos actores, las cajas se angostan para no pisarse
    height = top + row * len(msgs) + 40
    out = [f'<svg viewBox="0 0 {width} {height}" role="img" aria-labelledby="{sid}t {sid}d">',
           f'<title id="{sid}t">{escape(title)}</title>', f'<desc id="{sid}d">{escape(desc)}</desc>',
           f'<defs><marker id="{sid}-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="dg-arrow"/></marker>'
           f'<marker id="{sid}-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--link)"/></marker>'
           f'<marker id="{sid}-f" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--fail)"/></marker>'
           f'<marker id="{sid}-q" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--l-queue)"/></marker></defs>']
    for a, label in actors:
        x = xs[a]
        out.append(f'<rect class="dg-box" x="{x - bw / 2}" y="8" width="{bw}" height="32" rx="4"/>')
        out.append(f'<text class="dg-label" x="{x}" y="29" text-anchor="middle" style="font-size:13.5px">{escape(label)}</text>')
        out.append(f'<path class="dg-frame" d="M{x} 40 V{height - 10}"/>')
    y = top
    for m in msgs:
        if m[0] == 'cut':
            out.append(f'<path d="M20 {y + 6} H{width - 20}" stroke="var(--fail)" stroke-width="1.2" stroke-dasharray="6 5"/>')
            out.append(f'<rect x="{width / 2 - 150}" y="{y - 5}" width="300" height="22" rx="3" fill="var(--paper-sunk)"/>')
            out.append(f'<text class="dg-small" x="{width / 2}" y="{y + 10}" text-anchor="middle" style="fill:var(--fail)">{escape(m[1])}</text>')
        elif m[0] == 'note':
            x = xs[m[1]]
            tw = min(360, 7 * len(m[2]) + 20)
            nx = x + 10 if x + 10 + tw < width else x - 10 - tw
            out.append(f'<rect x="{nx}" y="{y - 6}" width="{tw}" height="24" rx="3" fill="var(--paper-3)" stroke="var(--rule-strong)"/>')
            out.append(f'<text class="dg-tiny" x="{nx + 10}" y="{y + 10}">{escape(m[2])}</text>')
        else:
            a, b, label, kind = m
            x1, x2 = xs[a], xs[b]
            cls = {'req': 'dg-edge', 'res': 'dg-edge dg-res', 'fail': 'dg-edge', 'async': 'dg-edge'}[kind]
            mk = {'req': 'a', 'res': 'r', 'fail': 'f', 'async': 'q'}[kind]
            style = ''
            if kind == 'fail': style = ' style="stroke:var(--fail)"'
            if kind == 'async': style = ' style="stroke:var(--l-queue);stroke-dasharray:6 4"'
            if kind == 'res': style = ' style="stroke-dasharray:5 3"'
            d = 1 if x2 > x1 else -1
            if a == b:
                out.append(f'<path class="{cls}"{style} d="M{x1} {y} h40 v14 h-38" marker-end="url(#{sid}-{mk})"/>')
                out.append(f'<text class="dg-tiny" x="{x1 + 46}" y="{y + 11}">{escape(label)}</text>')
            else:
                out.append(f'<path class="{cls}"{style} d="M{x1 + d * 3} {y + 8} L{x2 - d * 5} {y + 8}" marker-end="url(#{sid}-{mk})"/>')
                lx = (x1 + x2) / 2
                out.append(f'<rect x="{lx - (len(label) * 3.3 + 6)}" y="{y - 9}" width="{len(label) * 6.6 + 12}" height="15" fill="var(--paper)" opacity="0.85"/>')
                out.append(f'<text class="dg-tiny" x="{lx}" y="{y + 2}" text-anchor="middle">{escape(label)}</text>')
        y += row
    out.append('</svg>')
    return '\n'.join(out)
