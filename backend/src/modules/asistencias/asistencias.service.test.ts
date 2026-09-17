import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ESTADO, ROL } from '../../lib/constants.js';
import { ASISTENCIA } from './asistencias.schemas.js';

/**
 * Puertas de Asistencias, sin base de datos.
 *
 * Lo que se prueba aqui es exactamente lo que el sistema viejo dejaba abierto:
 * que la fecha caiga en el dia de la disciplina, que nadie pase lista de una
 * disciplina que no es suya, y que un lote no pueda colar a un alumno que no
 * estaba en esa clase.
 */

/** Disciplina 135: Innova Los Chillos, jueves (dia_id 4). */
const SESION = {
  colacthor_id: 135,
  col_id: 14,
  col_nombre: 'Innova Schools Los Chillos',
  act_id: 3,
  act_nombre: 'Karate',
  dia_id: 4,
  dia_nombre: 'Jueves',
  colacthor_hora_inicio: '15:00',
  colacthor_hora_fin: '16:00',
  est_id: ESTADO.ACTIVO as number,
  entrenadores: ['Erika Liliana Robayo Rodriguez'],
};

let sesion: typeof SESION | null = SESION;
let colegio: { col_id: number; col_nombre: string } | null = {
  col_id: 14,
  col_nombre: 'Innova Schools Los Chillos',
};
let marcables = [11, 22, 33];
let personalMarcable = [
  { tipo: 'entrenador', id: 76 },
  { tipo: 'auxiliar', id: 91 },
];
/** Lo que devuelve el upsert: true = fila nueva, false = correccion. */
let esAlta = true;

const auditorias: string[] = [];

const query = vi.fn(async (sql: string, _parametros?: unknown[]) => {
  if (sql.includes('WITH col_coordinador')) {
    return { rows: [{ colegios: [14], disciplinas: [135] }] };
  }
  if (sql.includes("'HH24:MI'") && sql.includes('America/Guayaquil')) {
    return { rows: [{ hora: '16:35' }] };
  }
  if (sql.includes("'YYYY-MM-DD'") && sql.includes('America/Guayaquil')) {
    return { rows: [{ hoy: '2026-07-16' }] };
  }
  if (sql.includes('FROM public.colegio_actividad_horario cah')) {
    return { rows: sesion ? [sesion] : [] };
  }
  if (sql.includes('FROM public.colegio WHERE col_id')) {
    return { rows: colegio ? [colegio] : [] };
  }
  if (sql.includes('WITH inscritos AS')) {
    return {
      rows: [
        {
          nino_id: 11,
          nino_nombre: 'Ana',
          nino_foto: null,
          catninograd_nombre: '5to',
          inscrito: true,
          asisest_id: ASISTENCIA.PRESENTE,
          hora_tarde: null,
          razon: null,
          registrado_en: null,
          registrado_por: null,
        },
      ],
    };
  }
  if (sql.includes('SELECT p.tipo, p.id FROM (')) {
    return { rows: personalMarcable };
  }
  if (sql.includes('WITH titulares AS')) {
    return {
      rows: [
        {
          tipo: 'entrenador',
          id: 76,
          usu_nombre: 'Erika',
          usu_foto: null,
          titular: null,
          imparte: ['Karate'],
          activo_hoy: true,
          asisest_id: null,
          hora_tarde: null,
          razon: null,
          registrado_en: null,
          registrado_por: null,
        },
      ],
    };
  }
  if (sql.includes('FROM public.nino_asignacion na') && sql.includes('UNION')) {
    return { rows: marcables.map((nino_id) => ({ nino_id })) };
  }
  if (sql.includes('INSERT INTO public.auditoria')) {
    auditorias.push(sql);
    return { rows: [] };
  }
  if (sql.includes('RETURNING (xmax = 0) AS nueva')) {
    return { rows: [{ nueva: esAlta }] };
  }
  return { rows: [] };
});

vi.mock('../../config/db.js', () => ({
  getPool: () => ({ query, connect: async () => ({ query, release: vi.fn() }) }),
}));

vi.mock('../../lib/storage.js', () => ({
  firmarFotos: async () => new Map(),
  firmarFoto: async () => null,
}));

const service = await import('./asistencias.service.js');

const entrenadora = {
  authUserId: 'auth-76',
  usuario: {
    usu_id: 76,
    usu_nombre: 'Erika',
    usu_correo: 'erika@activareforce.com',
    est_id: ESTADO.ACTIVO,
    roles: [{ rol_id: ROL.ENTRENADOR }],
    permisos: [],
  },
  permisos: [],
} as never;

const propietario = {
  authUserId: 'auth-1',
  usuario: {
    usu_id: 1,
    usu_nombre: 'Activa Reforce',
    usu_correo: 'admin@activareforce.com',
    est_id: ESTADO.ACTIVO,
    roles: [{ rol_id: ROL.PROPIETARIO }],
    permisos: [],
  },
  permisos: [],
} as never;

/** El 2026-07-16 es jueves; el 2026-07-17, viernes. */
const JUEVES = '2026-07-16';
const VIERNES = '2026-07-17';

beforeEach(() => {
  sesion = SESION;
  colegio = { col_id: 14, col_nombre: 'Innova Schools Los Chillos' };
  marcables = [11, 22, 33];
  personalMarcable = [
    { tipo: 'entrenador', id: 76 },
    { tipo: 'auxiliar', id: 91 },
  ];
  esAlta = true;
  auditorias.length = 0;
  query.mockClear();
});

describe('la fecha tiene que caer en el dia de la disciplina', () => {
  it('un jueves en una disciplina de jueves pasa', async () => {
    const lista = await service.listaAlumnos(entrenadora, {
      disciplina: 135,
      fecha: JUEVES,
    });
    expect(lista.sesion.dia_nombre).toBe('Jueves');
    expect(lista.fecha).toBe(JUEVES);
  });

  it('un viernes en una disciplina de jueves se rechaza', async () => {
    await expect(
      service.listaAlumnos(entrenadora, { disciplina: 135, fecha: VIERNES }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('el domingo tambien se puede registrar: dia_id 7, no 0', async () => {
    sesion = { ...SESION, dia_id: 7, dia_nombre: 'Domingo' };
    // 2026-07-19 es domingo.
    const lista = await service.listaAlumnos(propietario, {
      disciplina: 135,
      fecha: '2026-07-19',
    });
    expect(lista.sesion.dia_id).toBe(7);
  });
});

describe('alcance', () => {
  it('una disciplina que no es suya da 403', async () => {
    sesion = { ...SESION, colacthor_id: 999 };
    await expect(
      service.listaAlumnos(entrenadora, { disciplina: 999, fecha: JUEVES }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('el propietario ve cualquiera', async () => {
    sesion = { ...SESION, colacthor_id: 999 };
    const lista = await service.listaAlumnos(propietario, { disciplina: 999, fecha: JUEVES });
    expect(lista.alumnos).toHaveLength(1);
  });

  it('una disciplina inexistente da 404', async () => {
    sesion = null;
    await expect(
      service.listaAlumnos(propietario, { disciplina: 1, fecha: JUEVES }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('un colegio fuera del alcance da 403', async () => {
    colegio = { col_id: 99, col_nombre: 'Otro' };
    await expect(
      service.listaEntrenadores(entrenadora, { colegio: 99, fecha: JUEVES }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('guardado por lote de alumnos', () => {
  const marcas = [
    { nino_id: 11, asisest_id: ASISTENCIA.PRESENTE as number },
    { nino_id: 22, asisest_id: ASISTENCIA.TARDE as number, hora_tarde: '16:35' },
  ];

  it('guarda y cuenta las altas', async () => {
    const res = await service.guardarAlumnos(propietario, {
      colacthor_id: 135,
      fecha: JUEVES,
      marcas,
    });
    expect(res.resultado).toEqual({ altas: 2, cambios: 0 });
  });

  it('un alumno que no estaba en esa clase se rechaza entero', async () => {
    marcables = [11];
    await expect(
      service.guardarAlumnos(propietario, { colacthor_id: 135, fecha: JUEVES, marcas }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('la disciplina dada de baja no admite marcas nuevas', async () => {
    sesion = { ...SESION, est_id: ESTADO.INACTIVO };
    await expect(
      service.guardarAlumnos(propietario, { colacthor_id: 135, fecha: JUEVES, marcas }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('pasar lista por primera vez no escribe en auditoria', async () => {
    await service.guardarAlumnos(propietario, { colacthor_id: 135, fecha: JUEVES, marcas });
    expect(auditorias).toHaveLength(0);
  });

  it('corregir una marca ya existente si queda auditado', async () => {
    esAlta = false;
    const res = await service.guardarAlumnos(propietario, {
      colacthor_id: 135,
      fecha: JUEVES,
      marcas,
    });
    expect(res.resultado).toEqual({ altas: 0, cambios: 2 });
    expect(auditorias).toHaveLength(1);
  });

  it('la hora de llegada se guarda con segundos', async () => {
    await service.guardarAlumnos(propietario, { colacthor_id: 135, fecha: JUEVES, marcas });
    const parametros = query.mock.calls
      .filter(([sql]) => String(sql).includes('INSERT INTO public.asistencia_nino'))
      .flatMap((llamada) => llamada[1] ?? []);
    expect(parametros).toContain('16:35:00');
  });
});

describe('guardado por lote de entrenadores y auxiliares', () => {
  it('cada tipo va a su tabla', async () => {
    await service.guardarEntrenadores(propietario, {
      col_id: 14,
      fecha: JUEVES,
      marcas: [
        { tipo: 'entrenador' as const, id: 76, asisest_id: ASISTENCIA.PRESENTE as number },
        { tipo: 'auxiliar' as const, id: 91, asisest_id: ASISTENCIA.AUSENTE as number },
      ],
    });

    const sqls = query.mock.calls.map(([sql]) => String(sql));
    expect(sqls.some((s) => s.includes('INSERT INTO public.asistencia_entrenador'))).toBe(true);
    expect(sqls.some((s) => s.includes('INSERT INTO public.asistencia_auxiliar'))).toBe(true);
  });

  it('alguien que no daba clase ese dia se rechaza', async () => {
    personalMarcable = [{ tipo: 'entrenador', id: 76 }];
    await expect(
      service.guardarEntrenadores(propietario, {
        col_id: 14,
        fecha: JUEVES,
        marcas: [{ tipo: 'auxiliar', id: 91, asisest_id: ASISTENCIA.PRESENTE }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('el resumen lo calcula el servidor', () => {
  it('cuenta marcados y sin marcar', async () => {
    const lista = await service.listaAlumnos(propietario, { disciplina: 135, fecha: JUEVES });
    expect(lista.resumen).toMatchObject({ total: 1, marcados: 1, sinMarcar: 0, presentes: 1 });
  });

  it('propone la hora del servidor, no la del navegador', async () => {
    const lista = await service.listaAlumnos(propietario, { disciplina: 135, fecha: JUEVES });
    expect(lista.hora_servidor).toBe('16:35');
  });
});
