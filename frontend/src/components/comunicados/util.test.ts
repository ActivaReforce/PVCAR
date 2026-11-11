import { describe, expect, it } from 'vitest';
import { nombreDestino, previsualizar } from './util';

const ops = {
  colegios: [{ id: 1, nombre: 'Colegio Sol' }],
  cursos: [{ id: 3, nombre: '2.º EGB' }],
  disciplinas: [{ id: 9, col_id: 1, nombre: 'Fútbol', horario: 'Lun 15:00–16:00' }],
};

describe('nombreDestino', () => {
  it('representantes con filtros en palabras', () => {
    expect(nombreDestino({ tipo: 'representantes', colegio: 1, curso: 3, disciplina: 9 }, ops, [])).toBe(
      'Representantes · Colegio Sol · 2.º EGB · Fútbol (Lun 15:00–16:00)',
    );
  });

  it('sin filtros, todos', () => {
    expect(nombreDestino({ tipo: 'representantes', colegio: null, curso: null, disciplina: null }, ops, [])).toBe(
      'Todos los representantes',
    );
    expect(nombreDestino({ tipo: 'contactos' }, ops, [])).toBe('Todos los contactos');
  });

  it('segmento por su nombre', () => {
    expect(
      nombreDestino({ tipo: 'segmento', segmento: 4 }, ops, [{ comseg_id: 4, comseg_nombre: 'Feria', contactos: 2 }]),
    ).toBe('Segmento «Feria»');
  });
});

describe('previsualizar', () => {
  it('mete el cuerpo en el marcador de la plantilla y añade los estilos base en el head', () => {
    const html = previsualizar('<p>Hola</p>', '<html><head></head><body>{{contenido}}</body></html>');
    expect(html).toContain('<body><p>Hola</p></body>');
    expect(html).toMatch(/<head><style>/);
  });

  it('sin plantilla, marco simple', () => {
    expect(previsualizar('<p>Hola</p>', null)).toContain('max-width:640px');
  });
});
