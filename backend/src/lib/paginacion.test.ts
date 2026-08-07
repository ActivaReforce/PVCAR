import { describe, expect, it } from 'vitest';
import { armarPagina, offsetDe, ordenSeguro } from './paginacion.js';

describe('paginacion', () => {
  it('calcula el offset a partir de la pagina', () => {
    expect(offsetDe({ page: 1, limit: 25 })).toBe(0);
    expect(offsetDe({ page: 3, limit: 25 })).toBe(50);
  });

  it('redondea hacia arriba el total de paginas', () => {
    const pagina = armarPagina([1, 2, 3], 26, { page: 1, limit: 25 });
    expect(pagina.totalPages).toBe(2);
  });

  it('con cero resultados no inventa una pagina', () => {
    expect(armarPagina([], 0, { page: 1, limit: 25 }).totalPages).toBe(0);
  });
});

describe('ordenSeguro', () => {
  const permitidas = { nombre: 'u.usu_nombre', correo: 'u.usu_correo' };

  it('traduce una columna permitida', () => {
    expect(ordenSeguro('correo', permitidas, 'u.usu_nombre')).toBe('u.usu_correo');
  });

  it('cae al valor por defecto si la columna no esta en la lista', () => {
    expect(ordenSeguro('otra', permitidas, 'u.usu_nombre')).toBe('u.usu_nombre');
  });

  it('ignora un intento de inyeccion por el ORDER BY', () => {
    const sucio = '1; DROP TABLE usuario; --';
    expect(ordenSeguro(sucio, permitidas, 'u.usu_nombre')).toBe('u.usu_nombre');
  });
});
