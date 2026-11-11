import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { clasificar, interpretar, leerArchivo, leerCsv } from './comunicados.importar.js';

describe('leerCsv', () => {
  it('adivina el punto y coma y respeta las comillas', () => {
    expect(leerCsv('Nombre;Correo\r\n"Pérez; Ana";ana@x.com\n')).toEqual([
      ['Nombre', 'Correo'],
      ['Pérez; Ana', 'ana@x.com'],
    ]);
  });

  it('quita el BOM de Excel', () => {
    expect(leerCsv('﻿a,b')[0]).toEqual(['a', 'b']);
  });
});

describe('interpretar', () => {
  it('encuentra el correo en cualquier columna y salta la cabecera', () => {
    const filas = interpretar([
      ['Correo', 'Nombre'],
      ['ANA@X.COM ', 'Ana'],
      ['', ''],
      ['Luis', 'luis@x.com', 'otro dato'],
    ]);
    expect(filas).toEqual([
      { fila: 2, nombre: 'Ana', correo: 'ana@x.com', texto: 'ANA@X.COM · Ana' },
      { fila: 4, nombre: 'Luis', correo: 'luis@x.com', texto: 'Luis · luis@x.com · otro dato' },
    ]);
  });

  it('"Nombre <correo>" en una sola celda', () => {
    expect(interpretar([['Ana Pérez <ana@x.com>']])[0]).toMatchObject({ nombre: 'Ana Pérez', correo: 'ana@x.com' });
  });

  it('una fila con texto y sin correo válido queda sin correo', () => {
    expect(interpretar([['Ana', 'ana@x'], ['b@y.com']])[0]).toMatchObject({ correo: null });
  });
});

describe('clasificar', () => {
  it('reparte en nuevos, repetidos, ya contactos, ya representantes y mal escritos', () => {
    const r = clasificar(
      [
        { fila: 1, nombre: 'A', correo: 'a@x.com', texto: '' },
        { fila: 2, nombre: 'A2', correo: 'a@x.com', texto: '' },
        { fila: 3, nombre: 'B', correo: 'b@x.com', texto: '' },
        { fila: 4, nombre: 'C', correo: 'c@x.com', texto: '' },
        { fila: 5, nombre: '', correo: null, texto: 'basura' },
      ],
      new Set(['b@x.com']),
      new Map([['c@x.com', 'Carla Rep']]),
    );
    expect(r.nuevos).toEqual([{ nombre: 'A', correo: 'a@x.com' }]);
    expect(r.repetidosArchivo).toEqual([{ nombre: 'A2', correo: 'a@x.com', fila: 2 }]);
    expect(r.yaContactos).toEqual([{ nombre: 'B', correo: 'b@x.com' }]);
    expect(r.yaRepresentantes).toEqual([{ nombre: 'C', correo: 'c@x.com', representante: 'Carla Rep' }]);
    expect(r.invalidos).toEqual([{ fila: 5, texto: 'basura' }]);
  });
});

describe('leerArchivo', () => {
  it('lee un .xlsx de verdad', async () => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Hoja1');
    hoja.addRow(['Nombre', 'Correo']);
    hoja.addRow(['Ana', 'ana@x.com']);
    const buffer = Buffer.from(await libro.xlsx.writeBuffer());
    const filas = await leerArchivo('lista.xlsx', buffer.toString('base64'));
    expect(filas).toEqual([{ fila: 2, nombre: 'Ana', correo: 'ana@x.com', texto: 'Ana · ana@x.com' }]);
  });

  it('rechaza .xls y otros formatos con un mensaje claro', async () => {
    await expect(leerArchivo('a.xls', '')).rejects.toMatchObject({ statusCode: 400 });
    await expect(leerArchivo('a.pdf', '')).rejects.toMatchObject({ statusCode: 400 });
  });
});
