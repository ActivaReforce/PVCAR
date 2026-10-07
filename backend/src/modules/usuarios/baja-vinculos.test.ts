import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROL } from '../../lib/constants.js';

/**
 * Lo que arrastra dar de baja a una persona, o quitarle un rol.
 *
 * Hasta el 2026-10-02 la baja cerraba la ficha y las disciplinas del
 * entrenador pero dejaba vivos los vinculos de asistente/respaldo: el titular
 * dado de baja seguia "respaldado" y el asistente dado de baja seguia en la
 * ficha de su titular. En el sistema viejo eso dejo 4 entrenadores de baja con
 * disciplinas abiertas.
 */

const ACTIVO = {
  usu_id: 70,
  usu_nombre: 'Elizabeth',
  usu_correo: 'elizabeth@activareforce.com',
  usu_telefono: null,
  usu_foto: null,
  usu_fecha_creacion: null,
  usu_fecha_modificacion: null,
  est_id: 1,
  auth_user_id: 'auth-70',
  usu_cedula: null,
  ent_est_id: 1,
  padre_id: null,
  roles: [{ rol_id: ROL.ENTRENADOR }],
};

let roles = [{ rol_id: ROL.ENTRENADOR }];
const escritas: string[] = [];

const query = vi.fn(async (sql: string) => {
  escritas.push(sql);
  if (sql.includes('LEFT JOIN public.entrenador e')) return { rows: [{ ...ACTIVO, roles }] };
  if (sql.includes('FROM public.usuario_rol WHERE usu_id')) return { rows: roles };
  // Hay otro Propietario activo: la baja no deja al sistema sin dueño.
  if (sql.includes('u.usu_id <> $3')) return { rows: [{ n: '1' }] };
  return { rows: [] };
});

vi.mock('../../config/db.js', () => ({
  getPool: () => ({ query, connect: async () => ({ query, release: vi.fn() }) }),
}));

vi.mock('../../config/supabase.js', () => ({
  getSupabaseAdmin: () => ({ auth: { admin: { createUser: vi.fn(), deleteUser: vi.fn() } } }),
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

const soltados = () => escritas.filter((s) => s.includes('UPDATE public.entrenador_auxiliar'));

beforeEach(() => {
  roles = [{ rol_id: ROL.ENTRENADOR }];
  escritas.length = 0;
  query.mockClear();
});

describe('baja', () => {
  it('suelta sus vinculos de asistente como titular y como asistente', async () => {
    await service.darDeBaja(propietario, 70);
    expect(soltados()).toHaveLength(1);
    expect(soltados()[0]).toContain('(aux.ent_id = $1 OR aux.usu_id = $1)');
    // y sigue cerrando ficha y disciplinas
    expect(escritas.some((s) => s.includes('UPDATE public.entrenador_asignacion'))).toBe(true);
  });
});
