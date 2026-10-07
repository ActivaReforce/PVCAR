import { describe, expect, it } from 'vitest';
import {
  actualizarActividadSchema,
  crearActividadSchema,
  eliminarActividadSchema,
  listarActividadesSchema,
} from './actividades.schemas.js';

describe('crearActividadSchema', () => {
  it('acepta lo minimo: el nombre', () => {
    expect(crearActividadSchema.parse({ act_nombre: 'Karate' }).act_nombre).toBe('Karate');
  });

  it('rechaza un nombre de un caracter', () => {
    expect(crearActividadSchema.safeParse({ act_nombre: 'K' }).success).toBe(false);
  });

  it('admite actividad sin categoria', () => {
    expect(crearActividadSchema.safeParse({ act_nombre: 'Ajedrez', cat_id: null }).success).toBe(
      true,
    );
  });

  it('los materiales son una lista, no una cadena con comas', () => {
    const r = crearActividadSchema.parse({
      act_nombre: 'Pintura',
      act_materiales_alumno: ['mandil', 'pinceles'],
    });
    expect(r.act_materiales_alumno).toEqual(['mandil', 'pinceles']);
    expect(
      crearActividadSchema.safeParse({
        act_nombre: 'Pintura',
        act_materiales_alumno: 'mandil, pinceles',
      }).success,
    ).toBe(false);
  });

  it('no admite un material vacio', () => {
    expect(
      crearActividadSchema.safeParse({ act_nombre: 'Danza', act_materiales_alumno: ['  '] })
        .success,
    ).toBe(false);
  });

  it('recorta los espacios del nombre', () => {
    expect(crearActividadSchema.parse({ act_nombre: '  Teatro ' }).act_nombre).toBe('Teatro');
  });
});

describe('actualizarActividadSchema', () => {
  it('admite tocar un solo campo', () => {
    expect(actualizarActividadSchema.safeParse({ act_espacio_trabajo: 'Cancha 2' }).success).toBe(
      true,
    );
  });

  it('rechaza un cuerpo vacio', () => {
    expect(actualizarActividadSchema.safeParse({}).success).toBe(false);
  });

  it('deja quitar la categoria mandando null', () => {
    expect(actualizarActividadSchema.parse({ cat_id: null }).cat_id).toBeNull();
  });

  it('deja vaciar la lista de materiales', () => {
    expect(actualizarActividadSchema.parse({ act_materiales_alumno: [] }).act_materiales_alumno)
      .toEqual([]);
  });
});

describe('eliminarActividadSchema', () => {
  it('exige escribir algo', () => {
    expect(eliminarActividadSchema.safeParse({ confirmacion: '  ' }).success).toBe(false);
  });
});

describe('listarActividadesSchema', () => {
  it('trae los valores por defecto', () => {
    const r = listarActividadesSchema.parse({});
    expect(r.page).toBe(1);
    expect(r.limit).toBe(25);
  });

  it('rechaza un orden fuera de la lista blanca', () => {
    expect(listarActividadesSchema.safeParse({ orden: 'act_id --' }).success).toBe(false);
  });
});
