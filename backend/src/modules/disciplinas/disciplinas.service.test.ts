import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROL } from '../../lib/constants.js';

/**
 * Puertas de Disciplinas, sin base de datos.
 *
 * Lo que importa aqui: que el alcance mande, que no se puedan crear dos
 * disciplinas iguales ni solapadas, que una disciplina con historial no se
 * borre, y que la baja no se pueda repetir. El SQL se valida aparte contra
 * PVCAR_Dev por MCP.
 */

const DISCIPLINA = {
  colacthor_id: 80,
  col_id: 14,
  col_nombre: 'Innova Schools Los Chillos',
  act_id: 24,
  act_nombre: 'Futbol G2',
  cat_nombre: 'Deportiva',
  dia_id: 1,
  dia_nombre: 'Lunes',
  colacthor_hora_inicio: '15:00:00',
  colacthor_hora_fin: '16:00:00',
  est_id: 1,
  colacthor_fecha_creacion: null,
  entrenadores: [],
  alumnos: 16,
  evaluaciones: 0,
};

/** La disciplina que devuelve obtenerDisciplina. */
let disciplinaActual: typeof DISCIPLINA | null = DISCIPLINA;
/** Respuesta de existeIgual / haySolape. */
let duplicada = false;
let solapada = false;
/** Respuesta de calcularImpacto. */
let conHistorial = true;

const query = vi.fn(async (sql: string) => {
  if (sql.includes('WITH col_coordinador')) {
    // Coordinadora del colegio 14: sus disciplinas y su colegio.
    return { rows: [{ colegios: [14], disciplinas: [80] }] };
  }
  if (sql.includes('FROM public.colegio_actividad_horario d')) {
    return { rows: disciplinaActual ? [disciplinaActual] : [] };
  }
  if (sql.includes('OVERLAPS')) {
    return { rows: solapada ? [{ colacthor_id: 99, inicio: '15:30:00', fin: '16:30:00' }] : [] };
  }
  if (sql.includes('colacthor_hora_inicio = $4::time')) {
    return { rows: duplicada ? [{ '?column?': 1 }] : [] };
  }
  if (sql.includes('AS asistencias')) {
    return {
      rows: [
        conHistorial
          ? { inscripciones: '16', asignaciones: '1', evaluaciones: '0', asistencias: '120' }
          : { inscripciones: '0', asignaciones: '0', evaluaciones: '0', asistencias: '0' },
      ],
    };
  }
  if (sql.includes('FROM public.colegio WHERE col_id')) return { rows: [{ '?column?': 1 }] };
  if (sql.includes('FROM public.actividad WHERE act_id')) return { rows: [{ '?column?': 1 }] };
  return { rows: [] };
});

const client = {
  query,
  release: vi.fn(),
};

vi.mock('../../config/db.js', () => ({
  getPool: () => ({ query, connect: async () => client }),
}));

const service = await import('./disciplinas.service.js');

const coordinadora = {
  authUserId: 'auth-58',
  usuario: {
    usu_id: 58,
    usu_nombre: 'Ana Karina',
    usu_correo: 'ana@activareforce.com',
    est_id: 1,
    roles: [{ rol_id: ROL.COORDINADOR }],
    permisos: [],
  },
  permisos: [],
} as never;

beforeEach(() => {
  disciplinaActual = DISCIPLINA;
  duplicada = false;
  solapada = false;
  conHistorial = true;
  query.mockClear();
});

describe('alcance', () => {
  it('no deja ver una disciplina de otro colegio', async () => {
    disciplinaActual = { ...DISCIPLINA, colacthor_id: 999, col_id: 12 };
    await expect(service.obtener(coordinadora, 999)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('no deja editarla', async () => {
    disciplinaActual = { ...DISCIPLINA, colacthor_id: 999, col_id: 12 };
    await expect(
      service.actualizar(coordinadora, 999, { dia_id: 2 }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('no deja darla de baja', async () => {
    disciplinaActual = { ...DISCIPLINA, colacthor_id: 999, col_id: 12 };
    await expect(service.darDeBaja(coordinadora, 999)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('no deja crear en un colegio ajeno', async () => {
    await expect(
      service.crear(coordinadora, {
        col_id: 12,
        act_id: 24,
        horarios: [{ dia_id: 1, colacthor_hora_inicio: '15:00', colacthor_hora_fin: '16:00' }],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('la disciplina de su colegio si pasa el alcance', async () => {
    const d = await service.obtener(coordinadora, 80);
    expect(d.colacthor_id).toBe(80);
  });
});

describe('horarios que chocan', () => {
  it('rechaza el duplicado exacto', async () => {
    duplicada = true;
    await expect(
      service.crear(coordinadora, {
        col_id: 14,
        act_id: 24,
        horarios: [{ dia_id: 1, colacthor_hora_inicio: '15:00', colacthor_hora_fin: '16:00' }],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rechaza el solape y dice con que horario choca', async () => {
    solapada = true;
    await expect(
      service.crear(coordinadora, {
        col_id: 14,
        act_id: 24,
        horarios: [{ dia_id: 1, colacthor_hora_inicio: '15:30', colacthor_hora_fin: '16:30' }],
      }),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('15:30') });
  });

  it('al editar, la hora de fin no puede quedar antes de la de inicio', async () => {
    await expect(
      service.actualizar(coordinadora, 80, { colacthor_hora_fin: '14:00' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('baja y borrado', () => {
  it('no se puede dar de baja dos veces', async () => {
    disciplinaActual = { ...DISCIPLINA, est_id: 2 };
    await expect(service.darDeBaja(coordinadora, 80)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('no se puede reactivar una que ya esta activa', async () => {
    await expect(service.reactivar(coordinadora, 80)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('el borrado exige escribir el nombre de la actividad', async () => {
    await expect(service.eliminar(coordinadora, 80, 'otra cosa')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('una disciplina con historial no se borra, y dice que la bloquea', async () => {
    await expect(service.eliminar(coordinadora, 80, 'Futbol G2')).rejects.toMatchObject({
      statusCode: 409,
      details: { inscripciones: 16, asistencias: 120 },
    });
  });
});
