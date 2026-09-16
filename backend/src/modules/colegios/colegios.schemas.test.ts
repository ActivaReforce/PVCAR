import { describe, expect, it } from 'vitest';
import {
  actualizarColegioSchema,
  coordinadoresSchema,
  crearColegioSchema,
  eliminarColegioSchema,
  listarColegiosSchema,
} from './colegios.schemas.js';

describe('crearColegioSchema', () => {
  const valido = {
    col_nombre: 'Innova Schools Quitumbe',
    col_direccion: 'Condor Nan y Pumapungo, Quito',
  };

  it('acepta lo minimo: nombre y direccion', () => {
    expect(crearColegioSchema.parse(valido).col_nombre).toBe('Innova Schools Quitumbe');
  });

  it('recorta los espacios del nombre', () => {
    const r = crearColegioSchema.parse({ ...valido, col_nombre: '  Tomas Moro  ' });
    expect(r.col_nombre).toBe('Tomas Moro');
  });

  it('rechaza un nombre de menos de 3 caracteres', () => {
    expect(crearColegioSchema.safeParse({ ...valido, col_nombre: 'AB' }).success).toBe(false);
  });

  it('exige direccion', () => {
    expect(crearColegioSchema.safeParse({ col_nombre: 'Colegio X' }).success).toBe(false);
  });

  it('normaliza el correo del contacto a minusculas', () => {
    const r = crearColegioSchema.parse({ ...valido, col_rep_email: '  Contacto@Colegio.EC ' });
    expect(r.col_rep_email).toBe('contacto@colegio.ec');
  });

  it('admite el correo vacio (el contacto es opcional)', () => {
    expect(crearColegioSchema.safeParse({ ...valido, col_rep_email: '' }).success).toBe(true);
  });

  it('rechaza un correo con formato invalido', () => {
    expect(crearColegioSchema.safeParse({ ...valido, col_rep_email: 'arroba-no' }).success).toBe(
      false,
    );
  });

  it('rechaza un telefono con letras', () => {
    expect(crearColegioSchema.safeParse({ ...valido, col_rep_telefono: '099-ABC' }).success).toBe(
      false,
    );
  });

  it('acepta el telefono con los signos de siempre', () => {
    expect(
      crearColegioSchema.safeParse({ ...valido, col_rep_telefono: '+593 (99) 123-4567' }).success,
    ).toBe(true);
  });

  it('rechaza coordinadores repetidos', () => {
    expect(
      crearColegioSchema.safeParse({ ...valido, coordinadores: [58, 58] }).success,
    ).toBe(false);
  });
});

describe('actualizarColegioSchema', () => {
  it('admite tocar un solo campo', () => {
    expect(actualizarColegioSchema.safeParse({ col_direccion: 'Otra calle 123' }).success).toBe(
      true,
    );
  });

  it('rechaza un cuerpo vacio', () => {
    expect(actualizarColegioSchema.safeParse({}).success).toBe(false);
  });

  it('deja quitar la foto mandando null', () => {
    const r = actualizarColegioSchema.parse({ col_rep_foto: null });
    expect(r.col_rep_foto).toBeNull();
  });
});

describe('coordinadoresSchema', () => {
  it('acepta la lista vacia: quitarlos todos es una decision valida', () => {
    expect(coordinadoresSchema.parse({ coordinadores: [] }).coordinadores).toEqual([]);
  });

  it('rechaza ids que no son enteros positivos', () => {
    expect(coordinadoresSchema.safeParse({ coordinadores: [0] }).success).toBe(false);
    expect(coordinadoresSchema.safeParse({ coordinadores: [-3] }).success).toBe(false);
  });
});

describe('eliminarColegioSchema', () => {
  it('exige escribir algo', () => {
    expect(eliminarColegioSchema.safeParse({ confirmacion: '   ' }).success).toBe(false);
  });
});

describe('listarColegiosSchema', () => {
  it('trae page y limit por defecto', () => {
    const r = listarColegiosSchema.parse({});
    expect(r.page).toBe(1);
    expect(r.limit).toBe(25);
  });

  it('no deja pedir mas de 200 por pagina', () => {
    expect(listarColegiosSchema.safeParse({ limit: '5000' }).success).toBe(false);
  });

  it('rechaza un orden que no esta en la lista blanca', () => {
    expect(listarColegiosSchema.safeParse({ orden: 'col_id; drop table' }).success).toBe(false);
  });
});
