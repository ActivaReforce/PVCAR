import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROL } from '../../lib/constants.js';

/**
 * Puertas de Estudiantes, sin base de datos.
 *
 * Es el modulo con datos personales de 796 menores, asi que lo que se prueba
 * aqui es sobre todo quien puede ver y tocar a quien, mas las dos reglas que
 * el sistema viejo no tenia: que la disciplina sea del colegio del nino y que
 * cambiar de colegio con inscripciones activas se rechace.
 */

const ESTUDIANTE = {
  nino_id: 173,
  nino_nombre: 'Adrián Arturo Pesántez Suárez',
  nino_edad: 9,
  nino_foto: null,
  col_id: 11,
  col_nombre: 'Innova Schools Quitumbe',
  catninograd_id: 4,
  catninograd_nombre: '4to de Básica',
  est_id: 1,
  nino_fecha_creacion: null,
  nino_fecha_modificacion: null,
  nino_cedula: null,
  nino_toma_transporte: null,
  nino_info_salud: null,
  nino_otra_info: null,
  disciplinas: 4,
  representantes: 0,
};

let estudianteActual = ESTUDIANTE;
/** Inscripciones activas que devuelve listarInscripciones. */
let inscripciones: Array<{ colacthor_id: number; est_id: number }> = [
  { colacthor_id: 80, est_id: 1 },
];
/** La disciplina que devuelve disciplinaDelColegio. */
let disciplina: { colacthor_id: number; col_id: number; est_id: number } | null = {
  colacthor_id: 90,
  col_id: 11,
  est_id: 1,
};
let padre: { padre_id: number } | null = { padre_id: 5 };

const query = vi.fn(async (sql: string) => {
  if (sql.includes('WITH col_coordinador')) {
    // Coordinadora del colegio 14 (el estudiante es del 11).
    return { rows: [{ colegios: [14], disciplinas: [60] }] };
  }
  if (sql.includes('FROM public.nino n')) {
    return { rows: [estudianteActual] };
  }
  if (sql.includes('FROM public.nino_asignacion na') && sql.includes('JOIN public.colegio_actividad_horario cah')) {
    return { rows: inscripciones };
  }
  if (sql.includes('FROM public.colegio_actividad_horario WHERE colacthor_id')) {
    return { rows: disciplina ? [disciplina] : [] };
  }
  if (sql.includes('FROM public.padre p')) {
    return { rows: padre ? [padre] : [] };
  }
  if (sql.includes('SELECT ninoasig_id, colacthor_id FROM public.nino_asignacion')) {
    return { rows: inscripciones.map((i, n) => ({ ninoasig_id: 900 + n, colacthor_id: i.colacthor_id })) };
  }
  if (sql.includes('AS intentos')) {
    return {
      rows: [
        { inscripciones: '4', asistencias: '54', representantes: '0', evaluaciones: '5', intentos: '0' },
      ],
    };
  }
  if (sql.includes('reactivate_nino_asignacion')) return { rows: [{ id: null }] };
  if (sql.includes('RETURNING ninoasig_id')) return { rows: [{ ninoasig_id: 999 }] };
  return { rows: [] };
});

vi.mock('../../config/db.js', () => ({
  getPool: () => ({ query, connect: async () => ({ query, release: vi.fn() }) }),
}));

vi.mock('../../config/supabase.js', () => ({
  getSupabaseAdmin: () => ({ storage: { from: () => ({}) } }),
}));

vi.mock('../../lib/storage.js', async () => {
  const real = await vi.importActual<typeof import('../../lib/storage.js')>('../../lib/storage.js');
  return {
    ...real,
    firmarFoto: async () => null,
    firmarFotos: async () => new Map(),
    borrarFoto: async () => undefined,
  };
});

const service = await import('./estudiantes.service.js');

/** Coordinadora del colegio 14. El estudiante de las pruebas es del 11. */
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

/** Entrenador de la disciplina 60. */
const entrenador = {
  authUserId: 'auth-60',
  usuario: {
    usu_id: 60,
    usu_nombre: 'Alex Lopez',
    usu_correo: 'alex@activareforce.com',
    est_id: 1,
    roles: [{ rol_id: ROL.ENTRENADOR }],
    permisos: [],
  },
  permisos: [],
} as never;

beforeEach(() => {
  estudianteActual = ESTUDIANTE;
  inscripciones = [{ colacthor_id: 80, est_id: 1 }];
  disciplina = { colacthor_id: 90, col_id: 11, est_id: 1 };
  padre = { padre_id: 5 };
  query.mockClear();
});

describe('alcance', () => {
  it('un coordinador no ve la ficha de un alumno de otro colegio', async () => {
    await expect(service.ficha(coordinadora, 173, false)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('pero si lo ve si esta inscrito en una disciplina suya', async () => {
    // El estudiante esta inscrito en la disciplina 60, que si esta en su alcance.
    inscripciones = [{ colacthor_id: 60, est_id: 1 }];
    const ficha = await service.ficha(coordinadora, 173, false);
    expect(ficha.estudiante.nino_id).toBe(173);
  });

  it('el entrenador llega por su disciplina, no por el colegio', async () => {
    inscripciones = [{ colacthor_id: 60, est_id: 1 }];
    const ficha = await service.ficha(entrenador, 173, false);
    expect(ficha.estudiante.nino_id).toBe(173);
  });

  it('no deja crear en un colegio ajeno', async () => {
    await expect(
      service.crear(coordinadora, { nino_nombre: 'Nuevo Alumno', col_id: 11 } as never),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('no deja borrar a un alumno fuera del alcance', async () => {
    await expect(
      service.eliminar(coordinadora, 173, ESTUDIANTE.nino_nombre),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('inscripciones', () => {
  beforeEach(() => {
    // Alumno dentro del alcance por disciplina.
    inscripciones = [{ colacthor_id: 60, est_id: 1 }];
  });

  it('rechaza una disciplina de otro colegio', async () => {
    disciplina = { colacthor_id: 90, col_id: 12, est_id: 1 };
    await expect(
      service.sincronizarInscripciones(coordinadora, 173, [60, 90]),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('otro colegio') });
  });

  it('rechaza una disciplina dada de baja', async () => {
    disciplina = { colacthor_id: 90, col_id: 11, est_id: 2 };
    await expect(
      service.sincronizarInscripciones(coordinadora, 173, [60, 90]),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('no deja inscribir a un alumno dado de baja', async () => {
    estudianteActual = { ...ESTUDIANTE, est_id: 2 };
    await expect(
      service.sincronizarInscripciones(coordinadora, 173, [90]),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('reinscribir intenta primero reabrir la inscripcion cerrada', async () => {
    await service.sincronizarInscripciones(coordinadora, 173, [60, 90]);
    const sqls = query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('reactivate_nino_asignacion'))).toBe(true);
  });
});

describe('edicion y bajas', () => {
  beforeEach(() => {
    inscripciones = [{ colacthor_id: 60, est_id: 1 }];
  });

  it('no deja cambiar de colegio con inscripciones activas', async () => {
    await expect(
      service.actualizar(coordinadora, 173, { col_id: 14 } as never),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('inscripcion') });
  });

  it('no se puede dar de baja dos veces', async () => {
    estudianteActual = { ...ESTUDIANTE, est_id: 2 };
    await expect(service.darDeBaja(coordinadora, 173)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('no se puede reactivar a uno que ya esta activo', async () => {
    await expect(service.reactivar(coordinadora, 173)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('la baja cierra las inscripciones en la misma transaccion', async () => {
    estudianteActual = { ...ESTUDIANTE, est_id: 1 };
    await service.darDeBaja(coordinadora, 173);
    const sqls = query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('SET est_id = $2, ninoasig_fecha_baja = now()'))).toBe(true);
  });
});

describe('borrado', () => {
  beforeEach(() => {
    inscripciones = [{ colacthor_id: 60, est_id: 1 }];
  });

  it('exige el nombre exacto', async () => {
    await expect(service.eliminar(coordinadora, 173, 'Adrian')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('devuelve el recuento de todo lo que destruyo', async () => {
    const impacto = await service.eliminar(coordinadora, 173, ESTUDIANTE.nino_nombre);
    expect(impacto.eliminables).toMatchObject({
      inscripciones: 4,
      asistencias: 54,
      evaluaciones: 5,
    });
    expect(impacto.puedeEliminar).toBe(true);
  });
});

describe('representantes', () => {
  beforeEach(() => {
    inscripciones = [{ colacthor_id: 60, est_id: 1 }];
  });

  it('rechaza a un usuario que no es representante activo', async () => {
    padre = null;
    await expect(service.atarRepresentante(coordinadora, 173, 42)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('Representante'),
    });
  });
});
