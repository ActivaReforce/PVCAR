import { describe, expect, it, vi } from 'vitest';
import { ESTADO, ROL } from '../../lib/constants.js';

/**
 * Guardar la matriz de un rol: quién puede y qué combinaciones no se aceptan.
 * Las comprobaciones van antes de tocar la base, así que basta con que el rol
 * exista.
 */

const query = vi.fn(async (sql: string) =>
  sql.includes('FROM public.rol WHERE rol_id') ? { rows: [{ '?column?': 1 }] } : { rows: [] },
);

vi.mock('../../config/db.js', () => ({
  getPool: () => ({ query, connect: async () => ({ query, release: vi.fn() }) }),
}));

const service = await import('./permisos.service.js');

function persona(rol: number) {
  return {
    authUserId: 'x',
    usuario: { usu_id: 1, usu_nombre: 'P', usu_correo: 'p@x.com', est_id: ESTADO.ACTIVO, roles: [{ rol_id: rol }] },
    permisos: [],
  } as never;
}

const p = (modulo: string, accion: string) => ({ modulo, accion });

describe('guardar los permisos de un rol', () => {
  it('solo Propietario o Admin', async () => {
    await expect(
      service.reemplazarPermisosDeRol(persona(ROL.COORDINADOR), ROL.ENTRENADOR, []),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('editar sin ver el módulo no tiene sentido', async () => {
    await expect(
      service.reemplazarPermisosDeRol(persona(ROL.PROPIETARIO), ROL.ENTRENADOR, [
        p('asistencias_estudiantes', 'editar'),
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('calificar sin ver las evaluaciones tampoco', async () => {
    await expect(
      service.reemplazarPermisosDeRol(persona(ROL.PROPIETARIO), ROL.ENTRENADOR, [
        p('calificaciones', 'ver'),
        p('calificaciones', 'editar'),
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('al Propietario no se le quita Editar de Permisos', async () => {
    await expect(
      service.reemplazarPermisosDeRol(persona(ROL.PROPIETARIO), ROL.PROPIETARIO, [
        p('permisos', 'ver'),
      ]),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
