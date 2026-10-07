import { describe, expect, it } from 'vitest';
import {
  ASISTENCIA,
  guardarAlumnosSchema,
  guardarEntrenadoresSchema,
  historialSchema,
  listaAlumnosSchema,
} from './asistencias.schemas.js';

/**
 * Los campos condicionales de la asistencia.
 *
 * Esta es la regla que el sistema viejo tenia escrita tres veces en el
 * navegador (`validateRowData`, copiada en AsistenciasNinos, en
 * AsistenciasEntrenadores y en AttendanceChildrenTable) y que la base no
 * defendia en ningun sitio. Aqui se prueba una vez; la migracion 0010 la
 * defiende en la base con un CHECK.
 */

function lote(marca: Record<string, unknown>) {
  return { colacthor_id: 135, fecha: '2026-07-16', marcas: [{ nino_id: 1, ...marca }] };
}

describe('marcas de alumnos', () => {
  it('acepta Presente a secas', () => {
    expect(guardarAlumnosSchema.safeParse(lote({ asisest_id: ASISTENCIA.PRESENTE })).success).toBe(
      true,
    );
  });

  it('Tarde exige la hora de llegada', () => {
    expect(guardarAlumnosSchema.safeParse(lote({ asisest_id: ASISTENCIA.TARDE })).success).toBe(
      false,
    );
    expect(
      guardarAlumnosSchema.safeParse(lote({ asisest_id: ASISTENCIA.TARDE, hora_tarde: '16:35' }))
        .success,
    ).toBe(true);
  });

  it('Justificado exige el motivo', () => {
    expect(
      guardarAlumnosSchema.safeParse(lote({ asisest_id: ASISTENCIA.JUSTIFICADO })).success,
    ).toBe(false);
    expect(
      guardarAlumnosSchema.safeParse(
        lote({ asisest_id: ASISTENCIA.JUSTIFICADO, razon: 'Cita medica' }),
      ).success,
    ).toBe(true);
  });

  it('Presente no admite hora ni motivo: al volver de Tarde, los campos se limpian', () => {
    expect(
      guardarAlumnosSchema.safeParse(
        lote({ asisest_id: ASISTENCIA.PRESENTE, hora_tarde: '16:35' }),
      ).success,
    ).toBe(false);
    expect(
      guardarAlumnosSchema.safeParse(lote({ asisest_id: ASISTENCIA.AUSENTE, razon: 'Se fue' }))
        .success,
    ).toBe(false);
  });

  it('la hora va en HH:MM de 24 horas', () => {
    for (const hora of ['4:35', '16:5', '25:00', '16:60', '16:35:00', 'tarde']) {
      expect(
        guardarAlumnosSchema.safeParse(lote({ asisest_id: ASISTENCIA.TARDE, hora_tarde: hora }))
          .success,
      ).toBe(false);
    }
    expect(
      guardarAlumnosSchema.safeParse(lote({ asisest_id: ASISTENCIA.TARDE, hora_tarde: '00:00' }))
        .success,
    ).toBe(true);
  });

  it('rechaza un estado que no existe', () => {
    expect(guardarAlumnosSchema.safeParse(lote({ asisest_id: 9 })).success).toBe(false);
  });

  it('rechaza el mismo alumno dos veces en el lote', () => {
    const repetido = {
      colacthor_id: 135,
      fecha: '2026-07-16',
      marcas: [
        { nino_id: 1, asisest_id: ASISTENCIA.PRESENTE },
        { nino_id: 1, asisest_id: ASISTENCIA.AUSENTE },
      ],
    };
    expect(guardarAlumnosSchema.safeParse(repetido).success).toBe(false);
  });
});

describe('fechas', () => {
  it('exige AAAA-MM-DD', () => {
    for (const fecha of ['16/07/2026', '2026-7-16', 'hoy', '']) {
      expect(listaAlumnosSchema.safeParse({ disciplina: 1, fecha }).success).toBe(false);
    }
  });

  it('rechaza una fecha que no existe aunque tenga la forma correcta', () => {
    expect(listaAlumnosSchema.safeParse({ disciplina: 1, fecha: '2026-02-31' }).success).toBe(
      false,
    );
    expect(listaAlumnosSchema.safeParse({ disciplina: 1, fecha: '2025-02-29' }).success).toBe(
      false,
    );
    expect(listaAlumnosSchema.safeParse({ disciplina: 1, fecha: '2024-02-29' }).success).toBe(true);
  });
});

describe('historial', () => {
  it('rechaza el rango al reves', () => {
    expect(
      historialSchema.safeParse({ disciplina: 1, desde: '2026-07-16', hasta: '2026-01-01' })
        .success,
    ).toBe(false);
  });

  it('rechaza mas de 180 dias', () => {
    expect(
      historialSchema.safeParse({ disciplina: 1, desde: '2025-01-01', hasta: '2026-01-01' })
        .success,
    ).toBe(false);
    expect(
      historialSchema.safeParse({ disciplina: 1, desde: '2026-01-01', hasta: '2026-06-01' })
        .success,
    ).toBe(true);
  });
});

describe('marcas de entrenadores y auxiliares', () => {
  const base = { col_id: 12, fecha: '2026-01-13' };

  it('un entrenador y un auxiliar con el mismo id no son la misma persona', () => {
    const resultado = guardarEntrenadoresSchema.safeParse({
      ...base,
      marcas: [
        { tipo: 'entrenador', id: 70, asisest_id: ASISTENCIA.PRESENTE },
        { tipo: 'auxiliar', id: 70, asisest_id: ASISTENCIA.PRESENTE },
      ],
    });
    expect(resultado.success).toBe(true);
  });

  it('pero la misma persona dos veces si se rechaza', () => {
    const resultado = guardarEntrenadoresSchema.safeParse({
      ...base,
      marcas: [
        { tipo: 'entrenador', id: 70, asisest_id: ASISTENCIA.PRESENTE },
        { tipo: 'entrenador', id: 70, asisest_id: ASISTENCIA.AUSENTE },
      ],
    });
    expect(resultado.success).toBe(false);
  });

  it('exige un tipo conocido', () => {
    const resultado = guardarEntrenadoresSchema.safeParse({
      ...base,
      marcas: [{ tipo: 'coordinador', id: 70, asisest_id: ASISTENCIA.PRESENTE }],
    });
    expect(resultado.success).toBe(false);
  });
});
