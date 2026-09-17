import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ESTADO, ROL } from '../../lib/constants.js';
import { DEFINICIONES } from './reportes.definiciones.js';

/**
 * Reportes, sin base de datos.
 *
 * Las tres cosas que el sistema viejo no hacía: comprobar quién puede abrir
 * cada reporte, aplicarle el alcance, y exigir rango de fechas a los que no
 * significan nada sin él.
 */

const consultas: string[] = [];

const query = vi.fn(async (sql: string, _parametros?: unknown[]) => {
  consultas.push(sql);

  if (sql.includes('WITH col_coordinador')) {
    return { rows: [{ colegios: [12, 16], disciplinas: [60, 74] }] };
  }
  if (sql.includes('count(*) AS total')) {
    return { rows: [{ total: '3' }] };
  }
  // Una fila con una columna de mas, para comprobar que se proyecta.
  return {
    rows: [
      {
        usu_id: 1,
        usu_nombre: 'Ana',
        usu_correo: 'ana@activareforce.com',
        usu_telefono: '',
        roles: 'Coordinador de Colegio',
        estado: 'Activo',
        usu_fecha_creacion: '01/01/2026',
        _orden: 'no deberia salir',
      },
    ],
  };
});

vi.mock('../../config/db.js', () => ({
  getPool: () => ({ query, connect: async () => ({ query, release: vi.fn() }) }),
}));

const service = await import('./reportes.service.js');

function actorCon(modulos: string[], roles: number[] = [ROL.COORDINADOR]) {
  const permisos = modulos.map((modulo) => ({ modulo, accion: 'ver' }));
  return {
    authUserId: 'auth-58',
    usuario: {
      usu_id: 58,
      usu_nombre: 'Ana Karina',
      usu_correo: 'ana@activareforce.com',
      est_id: ESTADO.ACTIVO,
      roles: roles.map((rol_id) => ({ rol_id })),
      permisos,
    },
    permisos,
  } as never;
}

const TODO = actorCon(
  DEFINICIONES.map((d) => d.modulo),
  [ROL.PROPIETARIO],
);

beforeEach(() => {
  consultas.length = 0;
  query.mockClear();
});

describe('el catalogo', () => {
  it('trae los nueve reportes a quien tiene todos los permisos', () => {
    expect(service.catalogo(TODO)).toHaveLength(9);
  });

  /**
   * Un entrenador tiene `reportes:ver` pero no `usuarios:ver`: el reporte de
   * personas no debe ni aparecerle.
   */
  it('a un entrenador no le ofrece el de usuarios', () => {
    const entrenador = actorCon(['estudiantes', 'asistencias_estudiantes'], [ROL.ENTRENADOR]);
    const ids = service.catalogo(entrenador).map((r) => r.id);
    expect(ids).toContain('estudiantes');
    expect(ids).not.toContain('usuarios');
  });

  it('cada reporte dice sus columnas y si exige rango', () => {
    const asistencias = service.catalogo(TODO).find((r) => r.id === 'asistencias-alumnos');
    expect(asistencias?.exigeRango).toBe(true);
    expect(asistencias?.columnas.length).toBeGreaterThan(5);
  });

  it('encuestas no esta: tiene cero filas y se rehace en la Fase 14', () => {
    expect(service.catalogo(TODO).map((r) => r.id)).not.toContain('encuestas');
  });
});

describe('puertas', () => {
  it('un reporte inexistente da 404', async () => {
    await expect(
      service.ejecutar(TODO, 'inventado', { page: 1, limit: 50 }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('sin el permiso del modulo de origen, 403', async () => {
    const entrenador = actorCon(['estudiantes'], [ROL.ENTRENADOR]);
    await expect(
      service.ejecutar(entrenador, 'usuarios', { page: 1, limit: 50 }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('un reporte de asistencia sin rango da 400', async () => {
    await expect(
      service.ejecutar(TODO, 'asistencias-alumnos', { page: 1, limit: 50 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('con rango, pasa', async () => {
    const r = await service.ejecutar(TODO, 'asistencias-alumnos', {
      page: 1,
      limit: 50,
      desde: '2026-06-01',
      hasta: '2026-06-30',
    });
    expect(r.id).toBe('asistencias-alumnos');
  });

  it('los que no exigen rango funcionan sin el', async () => {
    const r = await service.ejecutar(TODO, 'usuarios', { page: 1, limit: 50 });
    expect(r.total).toBe(3);
  });
});

describe('la consulta', () => {
  it('pagina envolviendo la consulta de la definicion', async () => {
    await service.ejecutar(TODO, 'usuarios', { page: 2, limit: 25 });
    const paginada = consultas.find((s) => s.includes('LIMIT') && s.includes('OFFSET'));
    expect(paginada).toBeTruthy();

    const llamada = query.mock.calls.find(([sql]) =>
      String(sql).includes('LIMIT') && String(sql).includes('OFFSET'),
    );
    expect(llamada?.[1]).toContain(25);
    expect(llamada?.[1]).toContain(25); // offset = (2-1) * 25
  });

  it('cuenta el total con la misma consulta, sin el limite', async () => {
    const r = await service.ejecutar(TODO, 'usuarios', { page: 1, limit: 10 });
    expect(r.total).toBe(3);
    expect(r.totalPages).toBe(1);
  });

  /**
   * La fila que devuelve la base trae `_orden`, una columna auxiliar del UNION
   * de asistencias. Solo deben salir las columnas declaradas.
   */
  it('devuelve exactamente las columnas declaradas, ni una mas', async () => {
    const r = await service.ejecutar(TODO, 'usuarios', { page: 1, limit: 10 });
    const claves = Object.keys(r.filas[0]!);
    expect(claves).toEqual(r.columnas.map((c) => c.clave));
    expect(claves).not.toContain('_orden');
  });

  /**
   * `alcanceDe` sale antes de consultar nada cuando el rol es global, asi que
   * para ver la consulta de alcance hace falta alguien que **no** lo sea.
   */
  it('el alcance sale del token, no de los filtros', async () => {
    const coordinadora = actorCon(['colegios'], [ROL.COORDINADOR]);
    await service.ejecutar(coordinadora, 'colegios', { page: 1, limit: 10 });
    expect(consultas.some((s) => s.includes('WITH col_coordinador'))).toBe(true);
  });

  it('a un rol global no se le consulta el alcance: se le da todo', async () => {
    await service.ejecutar(TODO, 'colegios', { page: 1, limit: 10 });
    expect(consultas.some((s) => s.includes('WITH col_coordinador'))).toBe(false);
  });
});

describe('las definiciones', () => {
  it('ninguna repite id', () => {
    const ids = DEFINICIONES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todas tienen columnas y un modulo de permiso', () => {
    for (const d of DEFINICIONES) {
      expect(d.columnas.length).toBeGreaterThan(0);
      expect(d.modulo.length).toBeGreaterThan(0);
    }
  });

  it('ninguna columna se repite dentro de su reporte', () => {
    for (const d of DEFINICIONES) {
      const claves = d.columnas.map((c) => c.clave);
      expect(new Set(claves).size).toBe(claves.length);
    }
  });

  it('cada consulta usa tantos parametros como declara', () => {
    const ctx = { global: false, colegios: [1], disciplinas: [2], actorId: 3 };
    for (const d of DEFINICIONES) {
      const { sql, params } = d.construir(
        { desde: '2026-01-01', hasta: '2026-01-31' },
        ctx,
      );
      const usados = new Set([...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
      expect(usados.size, `${d.id}: marcadores distintos`).toBe(params.length);
      expect(Math.max(...usados), `${d.id}: el mayor marcador`).toBe(params.length);
    }
  });
});
