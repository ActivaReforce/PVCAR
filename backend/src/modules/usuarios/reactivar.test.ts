import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROL } from '../../lib/constants.js';

/**
 * Reactivar a un usuario que no tiene cuenta de Supabase Auth.
 *
 * Los 23 inactivos que trae la carga estan asi: el backfill del Anexo A solo
 * creo las cuentas de los 45 activos. El CHECK del baseline
 * (`est_id <> 1 OR auth_user_id IS NOT NULL`) no admite un usuario activo sin
 * cuenta, asi que reactivarlo obliga a crearsela en el mismo gesto.
 *
 * Antes esto era un callejon sin salida: el backend pedia "crearle una cuenta
 * primero" y no habia pantalla para hacerlo.
 */

const INACTIVO_SIN_CUENTA = {
  usu_id: 96,
  usu_nombre: 'Ricardo Alexander Moya Tianga',
  usu_correo: 'moya.ricardo9egba@gmail.com',
  usu_telefono: null,
  usu_foto: null,
  usu_fecha_creacion: null,
  usu_fecha_modificacion: null,
  est_id: 2,
  auth_user_id: null as string | null,
  ent_cedula: null,
  ent_est_id: null,
  padre_id: null,
  padre_sector_residencia: null,
  roles: [{ rol_id: ROL.ENTRENADOR }],
};

let usuarioActual = { ...INACTIVO_SIN_CUENTA };
let fallaLaTransaccion = false;

const createUser = vi.fn(async () => ({ data: { user: { id: 'auth-nuevo' } }, error: null }));
const deleteUser = vi.fn(async () => ({ error: null }));

const query = vi.fn(async (sql: string) => {
  if (sql.includes('LEFT JOIN public.entrenador e')) return { rows: [usuarioActual] };
  if (fallaLaTransaccion && sql.includes('SET auth_user_id')) {
    throw new Error('fallo al escribir');
  }
  if (sql.includes('FROM public.usuario_rol WHERE usu_id')) {
    return { rows: usuarioActual.roles };
  }
  return { rows: [] };
});

vi.mock('../../config/db.js', () => ({
  getPool: () => ({ query, connect: async () => ({ query, release: vi.fn() }) }),
}));

vi.mock('../../config/supabase.js', () => ({
  getSupabaseAdmin: () => ({ auth: { admin: { createUser, deleteUser } } }),
}));

vi.mock('../../lib/storage.js', () => ({
  firmarFoto: async () => null,
  firmarFotos: async () => new Map(),
  borrarFoto: async () => undefined,
  firmarSubidaFoto: async () => ({ path: '', signedUrl: '', token: '' }),
}));

const service = await import('./usuarios.service.js');

const propietario = {
  authUserId: 'auth-12',
  usuario: {
    usu_id: 12,
    usu_nombre: 'Propietario',
    usu_correo: 'due@activareforce.com',
    est_id: 1,
    roles: [{ rol_id: ROL.PROPIETARIO }],
    permisos: [],
  },
  permisos: [],
} as never;

beforeEach(() => {
  usuarioActual = { ...INACTIVO_SIN_CUENTA };
  fallaLaTransaccion = false;
  query.mockClear();
  createUser.mockClear();
  deleteUser.mockClear();
});

describe('reactivar sin cuenta de acceso', () => {
  it('sin contrasena responde 409 y lo dice en los detalles', async () => {
    await expect(service.reactivar(propietario, 96)).rejects.toMatchObject({
      statusCode: 409,
      details: { requierePassword: true },
    });
    expect(createUser).not.toHaveBeenCalled();
  });

  it('con contrasena crea la cuenta con el correo ya confirmado', async () => {
    await service.reactivar(propietario, 96, 'contrasena123');

    expect(createUser).toHaveBeenCalledWith({
      email: INACTIVO_SIN_CUENTA.usu_correo,
      password: 'contrasena123',
      email_confirm: true,
    });

    const sqls = query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('SET auth_user_id'))).toBe(true);
  });

  it('si la transaccion falla, borra la cuenta recien creada', async () => {
    fallaLaTransaccion = true;
    await expect(service.reactivar(propietario, 96, 'contrasena123')).rejects.toThrow();
    expect(deleteUser).toHaveBeenCalledWith('auth-nuevo');
  });
});

describe('reactivar con cuenta', () => {
  it('no toca Supabase Auth', async () => {
    usuarioActual = { ...INACTIVO_SIN_CUENTA, auth_user_id: 'auth-ya-existe' };
    await service.reactivar(propietario, 96);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('un usuario ya activo responde 409', async () => {
    usuarioActual = { ...INACTIVO_SIN_CUENTA, est_id: 1, auth_user_id: 'auth-ya-existe' };
    await expect(service.reactivar(propietario, 96)).rejects.toMatchObject({ statusCode: 409 });
  });
});
