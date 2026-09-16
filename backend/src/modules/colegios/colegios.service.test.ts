import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROL } from '../../lib/constants.js';

/**
 * Puertas del modulo de Colegios, sin base de datos.
 *
 * Lo que se prueba aqui son las decisiones: que el alcance mande tambien al
 * escribir, que no se pueda borrar un colegio con datos y que la confirmacion
 * por nombre se compruebe en el servidor. El SQL se valida aparte, contra
 * PVCAR_Dev por MCP.
 */

const COLEGIO_AJENO = {
  col_id: 12,
  col_nombre: 'Innova Schools Calderón',
  col_direccion: 'De los Pinos, Calderón',
  col_rep_nombre: null,
  col_rep_telefono: null,
  col_rep_email: null,
  col_rep_foto: null,
  col_fecha_creacion: null,
  col_fecha_modificacion: null,
  coordinadores: [],
  disciplinas: 22,
  estudiantes: 184,
};

const COLEGIO_PROPIO = { ...COLEGIO_AJENO, col_id: 14, col_nombre: 'Innova Schools Los Chillos' };

/** El colegio que devuelve obtenerColegio en cada prueba. */
let colegioActual = COLEGIO_AJENO;
/** Lo que responde calcularImpacto: por defecto, lleno de datos. */
let vacio = false;

const query = vi.fn(async (sql: string) => {
  if (sql.includes('WITH col_coordinador')) {
    // Coordinadora del colegio 14 y de sus disciplinas.
    return { rows: [{ colegios: [14], disciplinas: [80] }] };
  }
  if (sql.includes('FROM public.colegio c')) {
    return { rows: [colegioActual] };
  }
  if (sql.includes('AS coordinadores,') || sql.includes('AS disciplinas,')) {
    return { rows: [colegioActual] };
  }
  if (sql.includes('AS asistencias_auxiliar')) {
    return {
      rows: [
        vacio
          ? {
              coordinadores: '0',
              disciplinas: '0',
              estudiantes: '0',
              asistencias_entrenador: '0',
              asistencias_auxiliar: '0',
            }
          : {
              coordinadores: '1',
              disciplinas: '22',
              estudiantes: '184',
              asistencias_entrenador: '543',
              asistencias_auxiliar: '62',
            },
      ],
    };
  }
  return { rows: [] };
});

vi.mock('../../config/db.js', () => ({
  getPool: () => ({ query, connect: vi.fn() }),
}));

vi.mock('../../config/supabase.js', () => ({
  getSupabaseAdmin: () => ({ storage: { from: () => ({}) } }),
}));

vi.mock('../../lib/storage.js', async () => {
  const real = await vi.importActual<typeof import('../../lib/storage.js')>(
    '../../lib/storage.js',
  );
  return {
    ...real,
    firmarFoto: async () => null,
    firmarFotos: async () => new Map(),
    borrarFoto: async () => undefined,
    firmarSubidaFoto: async () => ({ path: 'colegios/x.jpg', signedUrl: '', token: '' }),
  };
});

const service = await import('./colegios.service.js');

/** Coordinadora del colegio 14. */
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
  colegioActual = COLEGIO_AJENO;
  vacio = false;
  query.mockClear();
});

describe('alcance', () => {
  it('no deja ver la ficha de un colegio ajeno', async () => {
    await expect(service.obtener(coordinadora, 12)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('no deja editar un colegio ajeno', async () => {
    await expect(
      service.actualizar(coordinadora, 12, { col_direccion: 'Otra calle' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('no deja cambiar los coordinadores de un colegio ajeno', async () => {
    await expect(
      service.reemplazarCoordinadores(coordinadora, 12, [58]),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('el recuento previo al borrado tambien esta cerrado', async () => {
    await expect(service.impacto(coordinadora, 12)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('no deja borrar un colegio ajeno', async () => {
    await expect(
      service.eliminar(coordinadora, 12, 'Innova Schools Calderón'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('con el colegio propio si llega a las comprobaciones de negocio', async () => {
    colegioActual = COLEGIO_PROPIO;
    // El nombre no coincide: 400, no 403. Prueba que el alcance ya paso.
    await expect(service.eliminar(coordinadora, 14, 'otro nombre')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('borrado', () => {
  it('exige el nombre exacto, comprobado en el servidor', async () => {
    colegioActual = COLEGIO_PROPIO;
    vacio = true;
    await expect(service.eliminar(coordinadora, 14, 'Innova')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('acepta el nombre con otra caja y sin espacios sobrantes', async () => {
    colegioActual = COLEGIO_PROPIO;
    vacio = false;
    // Llega hasta el bloqueo por datos: 409, que es el paso siguiente al nombre.
    await expect(
      service.eliminar(coordinadora, 14, '  innova schools los chillos '),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('un colegio con disciplinas o alumnos no se borra, y dice por que', async () => {
    colegioActual = COLEGIO_PROPIO;
    await expect(
      service.eliminar(coordinadora, 14, 'Innova Schools Los Chillos'),
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { disciplinas: 22, estudiantes: 184 },
    });
  });
});

describe('fotos', () => {
  it('rechaza una ruta de foto que no sea del bucket de colegios', async () => {
    colegioActual = COLEGIO_PROPIO;
    await expect(
      service.actualizar(coordinadora, 14, { col_rep_foto: 'usuarios/otra.jpg' } as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
