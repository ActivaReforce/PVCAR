import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ESTADO, ROL } from '../../lib/constants.js';
import { METODO } from './evaluaciones.scoring.js';

/**
 * Puertas y reglas de Evaluaciones, sin base de datos.
 *
 * El scoring tiene sus propias pruebas (evaluaciones.scoring.test.ts). Aqui va
 * lo que lo rodea: quien puede ver que, que no se puede borrar, y las dos
 * operaciones que en el sistema viejo destruian datos sin avisar —desvincular
 * una disciplina y cambiarle el metodo a un parametro con notas puestas.
 */

const EVALUACION = {
  eva_id: 43,
  eva_titulo: 'Saltar 6 y 7 años',
  eva_descripcion: 'Habilidad motriz basica',
  eva_categoria: '6 y 7 años de edad',
  eva_puntaje_total: 2,
  est_id: ESTADO.ACTIVO as number,
  eva_fecha_creacion: '2025-12-16T15:44:50Z',
  eva_creador: 54,
  creador: 'Victor',
  parametros: 1,
  disciplinas: 20,
  pendientes: 322,
  evaluados: 0,
};

const PARAMETRO = {
  evaparam_id: 178,
  evaparam_nombre: 'Saltar hacia adelante',
  evaparam_nota: null,
  evatipometo_id: METODO.MOBAK_2 as number,
  evatipometo_nombre: 'Evaluación Mobak (2 intentos)',
  evaparam_intentos: 1,
  evaparam_puntaje: 2,
  evaparam_escala_min: null,
  evaparam_escala_max: 2,
  rango: null,
  intentos_registrados: 0,
};

const PENDIENTE = {
  evaninopen_id: 492,
  eva_id: 43,
  eva_titulo: 'Saltar 6 y 7 años',
  eva_puntaje_total: 2,
  nino_id: 624,
  nino_nombre: 'Robinson Garcia',
  nino_foto: null,
  colacthor_id: 60,
  col_id: 14,
  col_nombre: 'Innova Schools Los Chillos',
  act_nombre: 'Karate',
  est_id: ESTADO.PENDIENTE as number,
  evaninopen_fecha_finalizacion: null,
  evaluado_por: null,
};

let evaluacion: typeof EVALUACION | null = EVALUACION;
let parametros: Array<typeof PARAMETRO> = [PARAMETRO];
let pendiente: typeof PENDIENTE | null = PENDIENTE;
let vinculadas = [
  { evaasig_id: 1, colacthor_id: 60, est_id: ESTADO.ACTIVO as number },
  { evaasig_id: 2, colacthor_id: 99, est_id: ESTADO.ACTIVO as number },
];
let intentos: Array<{ evaint_id: number; evaparam_id: number; evaint_intento: number; evaint_puntaje_obtenido: number }> = [];

const escrituras: string[] = [];

const query = vi.fn(async (sql: string, _parametros?: unknown[]) => {
  escrituras.push(sql);

  if (sql.includes('WITH col_coordinador')) {
    return { rows: [{ colegios: [14], disciplinas: [60] }] };
  }
  if (sql.includes('FROM public.evaluacion e') && sql.includes('WHERE e.eva_id = $1')) {
    return { rows: evaluacion ? [evaluacion] : [] };
  }
  if (sql.includes('FROM public.evaluacion_parametro p')) {
    return { rows: parametros };
  }
  if (sql.includes('FROM public.evaluacion_asignacion a')) {
    return { rows: vinculadas.map((v) => ({ ...v, alumnos: 10, pendientes: 10, evaluados: 0 })) };
  }
  if (sql.includes('SELECT evaasig_id, colacthor_id')) {
    return { rows: vinculadas.filter((v) => v.est_id === ESTADO.ACTIVO) };
  }
  if (sql.includes('FROM public.colegio_actividad_horario cah') && sql.includes('estuvo')) {
    return { rows: [] };
  }
  if (sql.includes('FROM public.evaluacion_nino_pendiente np') && sql.includes('WHERE np.evaninopen_id = $1')) {
    return { rows: pendiente ? [pendiente] : [] };
  }
  if (sql.includes('FROM public.evaluacion_intento') && sql.includes('WHERE evaninopen_id = $1')) {
    return { rows: intentos };
  }
  if (sql.includes('SELECT evaparam_id FROM public.evaluacion_parametro')) {
    return { rows: parametros.map((p) => ({ evaparam_id: p.evaparam_id })) };
  }
  if (sql.includes('count(*)::int AS n') && sql.includes('EVALUADO'.toLowerCase())) {
    return { rows: [{ n: 0 }] };
  }
  if (sql.includes('SELECT count(*)::int AS n')) {
    return { rows: [{ n: 2 }] };
  }
  if (sql.includes('AS parametros') && sql.includes('AS intentos')) {
    return {
      rows: [{ parametros: 1, disciplinas: 20, pendientes: 322, evaluados: 0, intentos: 0 }],
    };
  }
  if (sql.includes('RETURNING eva_id')) return { rows: [{ eva_id: 99 }] };
  if (sql.includes('RETURNING evaparam_id')) return { rows: [{ evaparam_id: 500 }] };

  return { rows: [], rowCount: 3 };
});

vi.mock('../../config/db.js', () => ({
  getPool: () => ({ query, connect: async () => ({ query, release: vi.fn() }) }),
}));

vi.mock('../../lib/storage.js', () => ({
  firmarFoto: async () => null,
  firmarFotos: async () => new Map(),
}));

const service = await import('./evaluaciones.service.js');

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

/** Coordinadora: alcance = colegio 14, disciplina 60. No creo la evaluacion. */
const coordinadora = {
  authUserId: 'auth-58',
  usuario: {
    usu_id: 58,
    usu_nombre: 'Ana Karina',
    usu_correo: 'ana@activareforce.com',
    est_id: ESTADO.ACTIVO,
    roles: [{ rol_id: ROL.COORDINADOR }],
    permisos: [],
  },
  permisos: [],
} as never;

/** El creador de la evaluacion, sin alcance sobre ninguna disciplina suya. */
const creador = {
  authUserId: 'auth-54',
  usuario: {
    usu_id: 54,
    usu_nombre: 'Victor',
    usu_correo: 'victor@activareforce.com',
    est_id: ESTADO.ACTIVO,
    roles: [{ rol_id: ROL.ENTRENADOR }],
    permisos: [],
  },
  permisos: [],
} as never;

beforeEach(() => {
  evaluacion = { ...EVALUACION };
  parametros = [{ ...PARAMETRO }];
  pendiente = { ...PENDIENTE };
  vinculadas = [
    { evaasig_id: 1, colacthor_id: 60, est_id: ESTADO.ACTIVO },
    { evaasig_id: 2, colacthor_id: 99, est_id: ESTADO.ACTIVO },
  ];
  intentos = [];
  escrituras.length = 0;
  query.mockClear();
});

describe('quien ve una evaluacion', () => {
  it('el propietario, todas', async () => {
    const f = await service.ficha(propietario, 43);
    expect(f.evaluacion.eva_titulo).toBe('Saltar 6 y 7 años');
  });

  it('quien la creo, aunque no tenga la disciplina', async () => {
    const f = await service.ficha(creador, 43);
    expect(f.evaluacion.eva_creador).toBe(54);
  });

  it('la coordinadora, porque esta vinculada a su disciplina 60', async () => {
    const f = await service.ficha(coordinadora, 43);
    expect(f.parametros).toHaveLength(1);
  });

  it('si no esta vinculada a nada suyo ni la creo, 403', async () => {
    vinculadas = [{ evaasig_id: 2, colacthor_id: 99, est_id: ESTADO.ACTIVO }];
    await expect(service.ficha(coordinadora, 43)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('una evaluacion inexistente, 404', async () => {
    evaluacion = null;
    await expect(service.ficha(propietario, 1)).rejects.toMatchObject({ statusCode: 404 });
  });
});

/** Lo que la pantalla devuelve de un parametro ya guardado, como entrada. */
function comoInput(p: typeof PARAMETRO) {
  return {
    evaparam_id: p.evaparam_id,
    evaparam_nombre: p.evaparam_nombre,
    evatipometo_id: p.evatipometo_id,
    evaparam_intentos: p.evaparam_intentos,
    evaparam_puntaje: p.evaparam_puntaje,
    evaparam_escala_min: p.evaparam_escala_min,
    evaparam_escala_max: p.evaparam_escala_max,
  };
}

describe('parametros', () => {
  const nuevo = {
    evaparam_nombre: 'Nuevo parametro',
    evatipometo_id: METODO.LOGRO as number,
    evaparam_intentos: 1,
    evaparam_puntaje: 5,
  };

  it('anade uno nuevo', async () => {
    await service.guardarParametros(propietario, 43, [comoInput(PARAMETRO), nuevo]);
    expect(escrituras.some((s) => s.includes('INSERT INTO public.evaluacion_parametro'))).toBe(
      true,
    );
  });

  it('borrar uno con notas puestas da 409, no un error de clave foranea', async () => {
    parametros = [{ ...PARAMETRO, intentos_registrados: 7 }];
    await expect(
      service.guardarParametros(propietario, 43, [nuevo]),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('borrar uno sin notas si se puede', async () => {
    await service.guardarParametros(propietario, 43, [nuevo]);
    expect(escrituras.some((s) => s.includes('DELETE FROM public.evaluacion_parametro'))).toBe(
      true,
    );
  });

  /**
   * El caso que el sistema viejo permitia: un intento guardado como "logro" se
   * quedaba en la base bajo un metodo por tiempo, valiendo 0 y pareciendo una
   * nota legitima.
   */
  it('cambiarle el metodo a uno con notas puestas da 409', async () => {
    parametros = [{ ...PARAMETRO, intentos_registrados: 3 }];
    await expect(
      service.guardarParametros(propietario, 43, [
        { ...comoInput(PARAMETRO), evatipometo_id: METODO.LOGRO },
      ]),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('cambiarle el metodo a uno sin notas si se puede', async () => {
    await service.guardarParametros(propietario, 43, [
      { ...comoInput(PARAMETRO), evatipometo_id: METODO.LOGRO },
    ]);
    expect(escrituras.some((s) => s.includes('UPDATE public.evaluacion_parametro'))).toBe(true);
  });

  it('un parametro de otra evaluacion se rechaza', async () => {
    await expect(
      service.guardarParametros(propietario, 43, [{ ...comoInput(PARAMETRO), evaparam_id: 9999 }]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('vincular disciplinas', () => {
  it('sin parametros no se puede vincular', async () => {
    evaluacion = { ...EVALUACION, parametros: 0 };
    await expect(
      service.sincronizarDisciplinas(propietario, 43, [60]),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('vincular crea las pendientes de un solo golpe', async () => {
    vinculadas = [];
    await service.sincronizarDisciplinas(propietario, 43, [60]);
    expect(
      escrituras.some((s) => s.includes('INSERT INTO public.evaluacion_nino_pendiente')),
    ).toBe(true);
  });

  /**
   * El arreglo mas importante del modulo: antes esto era un DELETE de todas
   * las pendientes de la disciplina, evaluados incluidos.
   */
  it('desvincular desactiva, no borra', async () => {
    await service.sincronizarDisciplinas(propietario, 43, [60]);
    expect(escrituras.some((s) => s.includes('DELETE FROM public.evaluacion_nino_pendiente'))).toBe(
      false,
    );
    expect(
      escrituras.some(
        (s) => s.includes('UPDATE public.evaluacion_nino_pendiente') && s.includes('est_id'),
      ),
    ).toBe(true);
  });

  it('una disciplina fuera del alcance no se puede vincular', async () => {
    await expect(
      service.sincronizarDisciplinas(coordinadora, 43, [60, 99]),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  /**
   * La coordinadora solo ve la disciplina 60. Al guardar su lista, la 99 —de
   * otro colegio— no puede desaparecer: no es suya para quitarla.
   */
  it('no desvincula lo que el actor no puede ver', async () => {
    const r = await service.sincronizarDisciplinas(coordinadora, 43, [60]);
    expect(r.resultado.desvinculadas).toBe(0);
  });
});

describe('evaluar a un alumno', () => {
  it('el puntaje lo calcula el servidor, no llega del cliente', async () => {
    await service.guardarIntentos(propietario, 492, {
      intentos: [{ evaparam_id: 178, evaint_intento: 1, mobak: 2 }],
    });

    const insert = query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO public.evaluacion_intento'),
    );
    // Mobak 2 con un parametro de 2 puntos y 1 intento = 2 puntos.
    expect(insert?.[1]).toContain(2);
  });

  it('con todos los intentos, el alumno queda evaluado', async () => {
    await service.guardarIntentos(propietario, 492, {
      intentos: [{ evaparam_id: 178, evaint_intento: 1, mobak: 1 }],
    });

    const update = query.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE public.evaluacion_nino_pendiente') &&
      String(sql).includes('evaninopen_fecha_finalizacion'),
    );
    expect(update?.[1]).toContain(ESTADO.EVALUADO);
  });

  it('a medias sigue pendiente', async () => {
    parametros = [{ ...PARAMETRO, evaparam_intentos: 3 }];
    await service.guardarIntentos(propietario, 492, {
      intentos: [{ evaparam_id: 178, evaint_intento: 1, mobak: 1 }],
    });

    const update = query.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE public.evaluacion_nino_pendiente') &&
      String(sql).includes('evaninopen_fecha_finalizacion'),
    );
    expect(update?.[1]).toContain(ESTADO.PENDIENTE);
  });

  it('un parametro de otra evaluacion se rechaza', async () => {
    await expect(
      service.guardarIntentos(propietario, 492, {
        intentos: [{ evaparam_id: 9999, evaint_intento: 1, mobak: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('un numero de intento por encima de los configurados se rechaza', async () => {
    await expect(
      service.guardarIntentos(propietario, 492, {
        intentos: [{ evaparam_id: 178, evaint_intento: 5, mobak: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('un valor que no corresponde al metodo se rechaza antes de borrar nada', async () => {
    await expect(
      service.guardarIntentos(propietario, 492, {
        intentos: [{ evaparam_id: 178, evaint_intento: 1, logro: true }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(escrituras.some((s) => s.includes('DELETE FROM public.evaluacion_intento'))).toBe(false);
  });

  it('un alumno de otra disciplina, 403', async () => {
    pendiente = { ...PENDIENTE, colacthor_id: 999 };
    await expect(
      service.fichaDeAlumno(coordinadora, 492),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('borrar su evaluacion lo devuelve a pendiente', async () => {
    await service.borrarEvaluacionDeAlumno(propietario, 492);
    expect(escrituras.some((s) => s.includes('DELETE FROM public.evaluacion_intento'))).toBe(true);
    expect(escrituras.some((s) => s.includes('INSERT INTO public.auditoria'))).toBe(true);
  });
});

describe('borrado permanente de la plantilla', () => {
  it('exige el titulo exacto', async () => {
    await expect(
      service.eliminar(propietario, 43, 'otra cosa'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('con el titulo correcto borra, sin distinguir mayusculas', async () => {
    await service.eliminar(propietario, 43, '  saltar 6 y 7 AÑOS ');
    expect(escrituras.some((s) => s.includes('DELETE FROM public.evaluacion WHERE eva_id'))).toBe(
      true,
    );
  });

  it('deja constancia en auditoria antes de borrar', async () => {
    await service.eliminar(propietario, 43, 'Saltar 6 y 7 años');
    const auditoria = escrituras.findIndex((s) => s.includes('INSERT INTO public.auditoria'));
    const borrado = escrituras.findIndex((s) =>
      s.includes('DELETE FROM public.evaluacion WHERE eva_id'),
    );
    expect(auditoria).toBeGreaterThan(-1);
    expect(auditoria).toBeLessThan(borrado);
  });
});

describe('baja y reactivacion', () => {
  it('no se puede dar de baja dos veces', async () => {
    evaluacion = { ...EVALUACION, est_id: ESTADO.INACTIVO };
    await expect(service.darDeBaja(propietario, 43)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('no se puede reactivar una activa', async () => {
    await expect(service.reactivar(propietario, 43)).rejects.toMatchObject({ statusCode: 409 });
  });
});
