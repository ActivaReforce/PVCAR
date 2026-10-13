import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ESTADO, ROL } from '../../lib/constants.js';

/** Número de nuevas del menú (2026-10-12), sin base de datos. */

const marcarVisto = vi.fn(async (_usu: number, _hasta: Date) => undefined);
const contarNuevas = vi.fn(async (_usu: number) => 3);

vi.mock('./novedades.repository.js', () => ({ marcarVisto, contarNuevas }));
vi.mock('../../config/db.js', () => ({ getPool: () => ({ query: vi.fn() }) }));
vi.mock('../../config/env.js', () => ({ env: {} }));

const service = await import('./novedades.service.js');

const persona = (rol: number) =>
  ({
    authUserId: `auth-${rol}`,
    usuario: { usu_id: 40 + rol, usu_nombre: 'X', usu_correo: 'x@x.com', est_id: ESTADO.ACTIVO, roles: [{ rol_id: rol }], permisos: [] },
    permisos: [{ modulo: 'novedades', accion: 'ver' }],
  }) as never;

beforeEach(() => {
  marcarVisto.mockClear();
  contarNuevas.mockClear();
});

describe('aviso de novedades', () => {
  it('solo Propietario y Admin: el resto recibe 403 y no se consulta nada', async () => {
    for (const rol of [ROL.COORDINADOR, ROL.ENTRENADOR, ROL.REPRESENTANTE]) {
      await expect(service.aviso(persona(rol))).rejects.toMatchObject({ statusCode: 403 });
      await expect(service.marcarVisto(persona(rol), new Date())).rejects.toMatchObject({ statusCode: 403 });
    }
    expect(contarNuevas).not.toHaveBeenCalled();
    expect(marcarVisto).not.toHaveBeenCalled();
  });

  it('el Admin ve sus nuevas, contadas para él', async () => {
    await expect(service.aviso(persona(ROL.ADMIN))).resolves.toEqual({ nuevas: 3 });
    expect(contarNuevas).toHaveBeenCalledWith(40 + ROL.ADMIN);
  });

  it('una fecha del futuro se recorta a ahora: no tapa las que aún no existen', async () => {
    const antes = Date.now();
    await service.marcarVisto(persona(ROL.PROPIETARIO), new Date('2999-01-01T00:00:00Z'));
    const hasta = marcarVisto.mock.calls[0]![1];
    expect(hasta.getTime()).toBeLessThanOrEqual(Date.now());
    expect(hasta.getTime()).toBeGreaterThanOrEqual(antes);
  });
});
