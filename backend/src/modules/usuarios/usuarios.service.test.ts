import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROL } from '../../lib/constants.js';

/**
 * Pruebas de las puertas de escritura de Usuarios, sin base de datos.
 *
 * Existen por un agujero real encontrado al revisar la Fase 6: `obtener` si
 * comprobaba el alcance, pero `actualizar`, `baja`, `reactivar`, `impacto` y
 * `eliminar` no. Mientras solo el Propietario tenga `usuarios.editar` no se
 * nota, pero la pantalla de Permisos permite darle ese permiso a un
 * Coordinador — y ese dia, un coordinador podria editar, dar de baja o borrar
 * a cualquiera, incluido el Propietario, adivinando un id en la URL.
 *
 * El pool se sustituye por un enrutador de SQL: cada consulta se reconoce por
 * un trozo de su texto. No prueba el SQL (eso se valida contra PVCAR_Dev por
 * MCP), prueba las decisiones.
 */

interface FilaUsuario {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
  est_id: number;
  auth_user_id: string | null;
  usu_foto: string | null;
  roles: Array<{ rol_id: number }>;
}

const USUARIO_AJENO: FilaUsuario = {
  usu_id: 12,
  usu_nombre: 'Propietario Ajeno',
  usu_correo: 'propietario@activareforce.com',
  est_id: 1,
  auth_user_id: 'auth-12',
  usu_foto: null,
  roles: [{ rol_id: ROL.PROPIETARIO }],
};

/** Lo que devuelve esVisible: vacio = fuera del alcance. */
let visible = false;

const query = vi.fn(async (sql: string) => {
  if (sql.includes('WITH col_coordinador')) {
    return { rows: [{ colegios: [14], disciplinas: [80] }] };
  }
  if (sql.includes('LEFT JOIN public.entrenador e')) {
    return { rows: [USUARIO_AJENO] };
  }
  // esVisible
  if (sql.includes('LIMIT 1') && sql.includes('colegio_coordinador cc')) {
    return { rows: visible ? [{ '?column?': 1 }] : [] };
  }
  return { rows: [] };
});

vi.mock('../../config/db.js', () => ({
  getPool: () => ({ query, connect: vi.fn() }),
}));

vi.mock('../../config/supabase.js', () => ({
  getSupabaseAdmin: () => ({
    auth: { admin: { createUser: vi.fn(), updateUserById: vi.fn(), deleteUser: vi.fn() } },
  }),
}));

vi.mock('../../lib/storage.js', () => ({
  firmarFoto: async () => null,
  firmarFotos: async () => new Map(),
  borrarFoto: async () => undefined,
  firmarSubidaFoto: async () => ({ path: 'usuarios/x.jpg', signedUrl: '', token: '' }),
}));

const service = await import('./usuarios.service.js');

/** Coordinador del colegio 14, con permisos de escritura concedidos. */
const coordinador = {
  authUserId: 'auth-58',
  usuario: {
    usu_id: 58,
    usu_nombre: 'Coordinadora',
    usu_correo: 'coordinadora@activareforce.com',
    est_id: 1,
    roles: [{ rol_id: ROL.COORDINADOR }],
    permisos: [],
  },
  permisos: [],
} as never;

beforeEach(() => {
  visible = false;
  query.mockClear();
});

describe('alcance en las operaciones de escritura', () => {
  it('actualizar a alguien fuera del alcance responde 403', async () => {
    await expect(
      service.actualizar(coordinador, USUARIO_AJENO.usu_id, { usu_nombre: 'Nuevo nombre' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('dar de baja a alguien fuera del alcance responde 403', async () => {
    await expect(service.darDeBaja(coordinador, USUARIO_AJENO.usu_id)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('el recuento previo al borrado tambien esta cerrado', async () => {
    await expect(service.impacto(coordinador, USUARIO_AJENO.usu_id)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('eliminar a alguien fuera del alcance responde 403 antes de comprobar el nombre', async () => {
    await expect(
      service.eliminar(coordinador, USUARIO_AJENO.usu_id, 'Propietario Ajeno'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('reactivar a alguien fuera del alcance responde 403', async () => {
    await expect(service.reactivar(coordinador, USUARIO_AJENO.usu_id)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('escalada de privilegios', () => {
  it('un coordinador no puede crear un Propietario', async () => {
    await expect(
      service.crear(coordinador, {
        usu_nombre: 'Nuevo Jefe',
        usu_correo: 'jefe@activareforce.com',
        password: 'contrasena123',
        roles: [ROL.PROPIETARIO],
      } as never),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('un coordinador dentro de su alcance tampoco puede ascender a nadie a Admin', async () => {
    visible = true;
    await expect(
      service.actualizar(coordinador, USUARIO_AJENO.usu_id, { roles: [ROL.ADMIN] } as never),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
