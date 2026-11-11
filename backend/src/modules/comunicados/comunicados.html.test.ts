import { describe, expect, it } from 'vitest';
import { armarCorreo, cuerpoVacio, estilarCuerpo, limpiarHtml, textoPlano } from './comunicados.html.js';

describe('armarCorreo', () => {
  it('mete el contenido en el marcador de la plantilla', () => {
    const html = armarCorreo('<p>Hola</p>', '<div class="marco">{{contenido}}</div>');
    expect(html).toBe('<div class="marco"><p style="margin:0 0 12px">Hola</p></div>');
  });

  it('sin plantilla va en un marco simple', () => {
    const html = armarCorreo('<p>Hola</p>', null);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('max-width:640px');
    expect(html).toContain('Hola');
  });

  it('un "$&" del texto no se expande', () => {
    expect(armarCorreo('<p>$& y $1</p>', '{{contenido}}')).toContain('$& y $1');
  });
});

describe('estilarCuerpo', () => {
  it('pone bordes en línea a la tabla y sus celdas', () => {
    const html = estilarCuerpo('<table><tbody><tr><th>A</th><td>B</td></tr></tbody></table>');
    expect(html).toContain('<table style="border-collapse:collapse');
    expect(html).toContain('<th style="border:1px solid');
    expect(html).toContain('<td style="border:1px solid');
    expect(html).toContain('<tbody>');
  });

  it('respeta el estilo propio, que va después y manda', () => {
    expect(estilarCuerpo('<p style="text-align:center">x</p>')).toBe(
      '<p style="margin:0 0 12px;text-align:center">x</p>',
    );
  });

  it('no confunde thead con th ni pre con p', () => {
    expect(estilarCuerpo('<thead><pre>x</pre></thead>')).toBe('<thead><pre>x</pre></thead>');
  });

  it('imagen autocerrada', () => {
    expect(estilarCuerpo('<img src="a.png"/>')).toBe('<img src="a.png" style="max-width:100%;height:auto" />');
  });
});

describe('limpiarHtml', () => {
  it('quita scripts, manejadores y javascript:', () => {
    const limpio = limpiarHtml('<p onclick="x()">a</p><script>alert(1)</script><a href="javascript:x()">b</a>');
    expect(limpio).not.toMatch(/script|onclick|javascript/i);
    expect(limpio).toContain('href="#"');
  });
});

describe('texto y vacío', () => {
  it('texto plano legible', () => {
    expect(textoPlano('<p>Hola&nbsp;<strong>Ana</strong></p><p><a href="https://x.com">Ver</a></p>')).toBe(
      'Hola Ana\nVer (https://x.com)',
    );
  });

  it('el editor vacío cuenta como vacío; una tabla no', () => {
    expect(cuerpoVacio('<p></p>')).toBe(true);
    expect(cuerpoVacio('<table><tr><td></td></tr></table>')).toBe(false);
    expect(cuerpoVacio('<p>x</p>')).toBe(false);
  });
});
