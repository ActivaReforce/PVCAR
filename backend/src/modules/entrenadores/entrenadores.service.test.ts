import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROL } from '../../lib/constants.js';

/**
 * Puertas de Entrenadores, sin base de datos.
 *
 * Aqui se decide quien imparte que, y eso **cambia el alcance** de los roles
 * 3, 6 y 7: una asignacion mal puesta no es un dato feo, es alguien viendo
 * datos de menores que no le tocan. De ahi que casi todas las pruebas sean de
 * puertas.
 */

const ENTRENADOR = {
  ent_id: 76,
  usu_nombre: 'Erika Liliana Robayo Rodriguez',
  usu_correo: 'erika@activareforce.com',
  usu_telefono: null,
  usu_foto: null,
  ent_cedula: '1100114040',
  est_id: 1,
  usuario_est_id: 1,
  tiene_rol: true,
  colegios: [{ col_id: 14, col_nombre: 'Innova Schools Los Chillos' }],
  disciplinas: 4,
  alumnos: 52,
  auxiliares: 0,
};

let entrenadorActual: typeof ENTRENADOR | null = ENTRENADOR;
/** La disciplina que devuelve disciplinaActiva. */
let disciplina: { colacthor_id: number; col_id: number; est_id: number } | null = {
  colacthor_id: 60,
  col_id: 14,
  est_id: 1,
};
let yaLaTiene = false;
let ocupadaPor: { entasig_id: number; ent_id: number; usu_nombre: string } | null = null;
let rolAuxiliar: number | null = ROL.ASISTENTE;
let auxiliarYaAtado: { entaux_id: number; ent_id: number; usu_nombre: string } | null = null;

const query = vi.fn(async (sql: string) => {
  if (sql.includes('WITH col_coordinador')) {
    return { rows: [{ colegios: [14], disciplinas: [60] }] };
  }
  if (sql.includes('FROM public.entrenador e')) {
    return { rows: entrenadorActual ? [entrenadorActual] : [] };
  }
  if (sql.includes('FROM public.colegio_actividad_horario WHERE colacthor_id')) {
    return { rows: disciplina ? [disciplina] : [] };
  }
  if (sql.includes('FROM public.entrenador_asignacion') && sql.includes('LIMIT 1') && sql.includes('colacthor_id = $2')) {
    return { rows: yaLaTiene ? [{ '?column?': 1 }] : [] };
  }
  if (sql.includes('JOIN public.usuario u ON u.usu_id = ea.ent_id')) {
    return { rows: ocupadaPor ? [ocupadaPor] : [] };
  }
  if (sql.includes('FROM public.usuario_rol ur') && sql.includes('rol_id = ANY($2::int[])')) {
    return { rows: rolAuxiliar === null ? [] : [{ rol_id: rolAuxiliar }] };
  }
  if (sql.includes('FROM public.entrenador_auxiliar aux') && sql.includes('LIMIT 1')) {
    return { rows: auxiliarYaAtado ? [auxiliarYaAtado] : [] };
  }
  if (sql.includes('RETURNING entasig_id')) return { rows: [{ entasig_id: 500 }] };
  if (sql.includes('RETURNING entaux_id')) return { rows: [{ entaux_id: 600 }] };
  return { rows: [] };
});

vi.mock('../../config/db.js', () => ({
  getPool: () => ({ query, connect: async () => ({ query, release: vi.fn() }) }),
}));

vi.mock('../../lib/storage.js', () => ({
  firmarFoto: async () => null,
  firmarFotos: async () => new Map(),
  borrarFoto: async () => undefined,
}));

const service = await import('./entrenadores.service.js');

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
  entrenadorActual = ENTRENADOR;
  disciplina = { colacthor_id: 60, col_id: 14, est_id: 1 };
  yaLaTiene = false;
  ocupadaPor = null;
  rolAuxiliar = ROL.ASISTENTE;
  auxiliarYaAtado = null;
  query.mockClear();
});

describe('alcance', () => {
  it('no deja abrir la ficha de un entrenador de otro colegio', async () => {
    entrenadorActual = {
      ...ENTRENADOR,
      colegios: [{ col_id: 12, col_nombre: 'Innova Schools Calderón' }],
    };
    await expect(service.ficha(coordinadora, 76, false)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('no deja asignarle nada', async () => {
    entrenadorActual = { ...ENTRENADOR, colegios: [{ col_id: 12, col_nombre: 'Otro' }] };
    await expect(
      service.asignar(coordinadora, 76, { colacthor_id: 60 }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('no deja asignar una disciplina de un colegio ajeno', async () => {
    disciplina = { colacthor_id: 99, col_id: 12, est_id: 1 };
    await expect(
      service.asignar(coordinadora, 76, { colacthor_id: 99 }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('asignar', () => {
  it('rechaza a quien perdio el rol de Entrenador', async () => {
    entrenadorActual = { ...ENTRENADOR, tiene_rol: false };
    await expect(
      service.asignar(coordinadora, 76, { colacthor_id: 60 }),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('rol') });
  });

  it('rechaza a un entrenador cuyo usuario esta de baja', async () => {
    entrenadorActual = { ...ENTRENADOR, usuario_est_id: 2 };
    await expect(
      service.asignar(coordinadora, 76, { colacthor_id: 60 }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rechaza una disciplina dada de baja', async () => {
    disciplina = { colacthor_id: 60, col_id: 14, est_id: 2 };
    await expect(
      service.asignar(coordinadora, 76, { colacthor_id: 60 }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rechaza una fecha de inicio futura', async () => {
    const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await expect(
      service.asignar(coordinadora, 76, { colacthor_id: 60, desde: manana }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('no repite una disciplina que ya tiene abierta', async () => {
    yaLaTiene = true;
    await expect(
      service.asignar(coordinadora, 76, { colacthor_id: 60 }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('si ya la da otro, lo dice y no hace nada', async () => {
    ocupadaPor = { entasig_id: 300, ent_id: 96, usu_nombre: 'Ricardo Moya' };
    await expect(
      service.asignar(coordinadora, 76, { colacthor_id: 60 }),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('Ricardo Moya') });
  });

  it('con reemplazar, cierra la del otro y abre la nueva', async () => {
    ocupadaPor = { entasig_id: 300, ent_id: 96, usu_nombre: 'Ricardo Moya' };
    await service.asignar(coordinadora, 76, { colacthor_id: 60, reemplazar: true });

    const sqls = query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('SET entasig_fecha_fin = CURRENT_DATE'))).toBe(true);
    expect(sqls.some((s) => s.includes('RETURNING entasig_id'))).toBe(true);
  });
});

describe('auxiliares', () => {
  it('nadie es su propio auxiliar', async () => {
    await expect(service.atarAuxiliar(coordinadora, 76, 76)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('el auxiliar tiene que tener el rol 6 o el 7', async () => {
    rolAuxiliar = null;
    await expect(service.atarAuxiliar(coordinadora, 76, 85)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('Asistente'),
    });
  });

  it('no puede respaldar a dos titulares a la vez', async () => {
    auxiliarYaAtado = { entaux_id: 15, ent_id: 60, usu_nombre: 'Alex Lopez' };
    await expect(service.atarAuxiliar(coordinadora, 76, 85)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('Alex Lopez'),
    });
  });

  it('el titular tiene que ser un entrenador activo con su rol', async () => {
    entrenadorActual = { ...ENTRENADOR, tiene_rol: false };
    await expect(service.atarAuxiliar(coordinadora, 76, 85)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
