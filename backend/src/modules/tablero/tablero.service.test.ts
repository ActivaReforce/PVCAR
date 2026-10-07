import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ESTADO, ROL } from '../../lib/constants.js';

/**
 * El Tablero, sin base de datos.
 *
 * Lo que se prueba es lo que el sistema viejo hacía mal: elegir el tablero con
 * el primer rol que encontraba, y no decir nunca de qué periodo eran las
 * cifras.
 */

const query = vi.fn(async (sql: string, _parametros?: unknown[]) => {
  if (sql.includes('WITH col_coordinador')) {
    return { rows: [{ colegios: [12, 16], disciplinas: [60, 74] }] };
  }
  if (sql.includes("'YYYY-MM-DD'") && sql.includes('America/Guayaquil')) {
    return { rows: [{ hoy: '2026-09-17' }] };
  }
  return { rows: [{ colegios: [], disciplinas: [], hijos: [] }] };
});

vi.mock('../../config/db.js', () => ({
  getPool: () => ({ query, connect: async () => ({ query, release: vi.fn() }) }),
}));

const service = await import('./tablero.service.js');

function usuario(roles: number[], usuId = 10) {
  return {
    authUserId: `auth-${usuId}`,
    usuario: {
      usu_id: usuId,
      usu_nombre: 'Prueba',
      usu_correo: 'prueba@activareforce.com',
      est_id: ESTADO.ACTIVO,
      roles: roles.map((rol_id) => ({ rol_id })),
      permisos: [],
    },
    permisos: [],
  } as never;
}

/**
 * Con llaves a proposito: `mockClear()` devuelve el propio mock, y un
 * `beforeEach` que devuelve una funcion hace que vitest la trate como el
 * teardown del test y la llame **sin argumentos**. El mock recibia `sql`
 * indefinido y fallaban los 19, incluido uno que ni toca la base.
 */
beforeEach(() => {
  query.mockClear();
});

describe('qué tableros ve cada quien', () => {
  it('el propietario, el general', () => {
    expect(service.tablerosDe(usuario([ROL.PROPIETARIO])).map((t) => t.id)).toEqual(['general']);
  });

  it('el admin de Activa Reforce tambien', () => {
    expect(service.tablerosDe(usuario([ROL.ADMIN])).map((t) => t.id)).toEqual(['general']);
  });

  /**
   * El caso que el sistema viejo rompia: la cadena de `if` se quedaba con
   * coordinador y el entrenador no llegaba nunca a ver sus disciplinas.
   */
  it('quien coordina y ademas entrena ve los dos, el de mas alcance primero', () => {
    const tableros = service.tablerosDe(usuario([ROL.COORDINADOR, ROL.ENTRENADOR]));
    expect(tableros.map((t) => t.id)).toEqual(['coordinador', 'entrenador']);
  });

  it('un asistente ve el de entrenador', () => {
    expect(service.tablerosDe(usuario([ROL.ASISTENTE])).map((t) => t.id)).toEqual(['entrenador']);
  });

  it('un respaldo tambien', () => {
    expect(service.tablerosDe(usuario([ROL.RESPALDO_ENTRENADOR])).map((t) => t.id)).toEqual([
      'entrenador',
    ]);
  });

  it('el representante, el suyo', () => {
    expect(service.tablerosDe(usuario([ROL.REPRESENTANTE])).map((t) => t.id)).toEqual([
      'representante',
    ]);
  });

  it('quien no tiene ningun rol no ve ninguno: no hay tablero de reserva', () => {
    expect(service.tablerosDe(usuario([]))).toEqual([]);
  });

  it('los cuatro a la vez, en orden de alcance', () => {
    const todos = service.tablerosDe(
      usuario([ROL.REPRESENTANTE, ROL.ENTRENADOR, ROL.COORDINADOR, ROL.PROPIETARIO]),
    );
    expect(todos.map((t) => t.id)).toEqual([
      'general',
      'coordinador',
      'entrenador',
      'representante',
    ]);
  });
});

describe('el periodo', () => {
  it('por defecto son los ultimos 30 dias, contados por el servidor', async () => {
    const r = await service.tablero(usuario([ROL.PROPIETARIO]), {});
    expect(r.periodo).toEqual({ desde: '2026-08-19', hasta: '2026-09-17' });
  });

  it('se respeta el que llegue', async () => {
    const r = await service.tablero(usuario([ROL.PROPIETARIO]), {
      desde: '2026-01-01',
      hasta: '2026-03-31',
    });
    expect(r.periodo).toEqual({ desde: '2026-01-01', hasta: '2026-03-31' });
  });

  it('con solo `hasta`, los 30 dias anteriores a esa fecha', async () => {
    const r = await service.tablero(usuario([ROL.PROPIETARIO]), { hasta: '2026-03-31' });
    expect(r.periodo).toEqual({ desde: '2026-03-02', hasta: '2026-03-31' });
  });

  it('viaja en la respuesta, para que la pantalla pueda decirlo', async () => {
    const r = await service.tablero(usuario([ROL.COORDINADOR]), {});
    expect(r.periodo.desde).toBeTruthy();
    expect(r.periodo.hasta).toBeTruthy();
  });
});

describe('quien pide que', () => {
  it('sin `rol` se devuelve el de mayor alcance', async () => {
    const r = await service.tablero(usuario([ROL.COORDINADOR, ROL.ENTRENADOR]), {});
    expect(r.actual).toBe('coordinador');
  });

  it('se puede pedir el otro', async () => {
    const r = await service.tablero(usuario([ROL.COORDINADOR, ROL.ENTRENADOR]), {
      rol: 'entrenador',
    });
    expect(r.actual).toBe('entrenador');
  });

  it('pedir uno que no te toca da 403', async () => {
    await expect(
      service.tablero(usuario([ROL.ENTRENADOR]), { rol: 'general' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('quien no tiene tablero recibe datos nulos, no cifras inventadas', async () => {
    const r = await service.tablero(usuario([]), {});
    expect(r.actual).toBeNull();
    expect(r.datos).toBeNull();
    expect(r.disponibles).toEqual([]);
  });
});

describe('el auxiliar y su propia asistencia', () => {
  /**
   * Su alcance son las disciplinas de su titular, pero su asistencia esta en
   * `asistencia_auxiliar`. Sin distinguirlo veia la del entrenador como suya.
   */
  it('un asistente consulta asistencia_auxiliar', async () => {
    await service.tablero(usuario([ROL.ASISTENTE]), {});
    const sqls = query.mock.calls.map(([sql]) => String(sql));
    expect(sqls.some((s) => s.includes('asistencia_auxiliar'))).toBe(true);
  });

  it('un entrenador titular consulta asistencia_entrenador', async () => {
    await service.tablero(usuario([ROL.ENTRENADOR]), {});
    const sqls = query.mock.calls.map(([sql]) => String(sql));
    expect(sqls.some((s) => s.includes('asistencia_entrenador'))).toBe(true);
    expect(sqls.some((s) => s.includes('asistencia_auxiliar'))).toBe(false);
  });

  it('quien es entrenador y ademas asistente cuenta como titular', async () => {
    await service.tablero(usuario([ROL.ENTRENADOR, ROL.ASISTENTE]), { rol: 'entrenador' });
    const sqls = query.mock.calls.map(([sql]) => String(sql));
    expect(sqls.some((s) => s.includes('asistencia_auxiliar'))).toBe(false);
  });
});
