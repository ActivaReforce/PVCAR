import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ESTADO, ROL } from '../../lib/constants.js';
import { TIPO, preguntaSchema, responderSchema } from './encuestas.schemas.js';

/**
 * Encuestas, sin base de datos.
 *
 * El modulo se estrena vacio, asi que estas pruebas no defienden datos
 * existentes: fijan las reglas antes de que haya ninguno. Las tres que
 * importan son el ciclo de estados, que un representante responda una sola vez,
 * y que cada respuesta cuadre con el tipo de su pregunta.
 */

const ENCUESTA = {
  encu_id: 7,
  encu_titulo: 'Satisfaccion del primer trimestre',
  encu_descripcion: 'Como va el curso',
  est_id: ESTADO.BORRADOR as number,
  encu_creador: 1,
  creador: 'Activa Reforce',
  encu_fecha_creacion: '2026-09-17T10:00:00Z',
  preguntas: 2,
  respondidas: 0,
  representantes: 12,
};

const PREGUNTAS = [
  {
    encupreg_id: 100,
    encupreg_orden: 1,
    encupreg_pregunta: 'Que tal el trimestre',
    encupreg_nota: null,
    encutiporesp_id: TIPO.TEXTO_CORTO as number,
    encutiporesp_nombre: 'Texto corto',
    encupreg_escala_min: null,
    encupreg_escala_max: null,
    respuestas: 0,
  },
  {
    encupreg_id: 101,
    encupreg_orden: 2,
    encupreg_pregunta: 'Del 1 al 5, que nota le pones',
    encupreg_nota: null,
    encutiporesp_id: TIPO.ESCALA as number,
    encutiporesp_nombre: 'Escala',
    encupreg_escala_min: 1,
    encupreg_escala_max: 5,
    respuestas: 0,
  },
];

let encuesta: typeof ENCUESTA | null = ENCUESTA;
let preguntas = PREGUNTAS;
let padreId: number | null = 40;
let tieneRol = true;
let yaRespondio = false;

const escrituras: string[] = [];

const query = vi.fn(async (sql: string, _parametros?: unknown[]) => {
  escrituras.push(sql);

  if (sql.includes('FROM public.encuesta e')) {
    return { rows: encuesta ? [encuesta] : [] };
  }
  if (sql.includes('FROM public.encuesta_pregunta p')) {
    return { rows: preguntas };
  }
  if (sql.includes('SELECT padre_id FROM public.padre')) {
    return { rows: padreId === null ? [] : [{ padre_id: padreId }] };
  }
  if (sql.includes('FROM public.usuario_rol WHERE usu_id')) {
    return { rows: tieneRol ? [{ '?column?': 1 }] : [] };
  }
  /* Mas especifico que el de impacto, que tambien nombra esa tabla. */
  if (sql.includes('FROM public.encuesta_respondida WHERE encu_id = $1 AND padre_id = $2')) {
    return { rows: yaRespondio ? [{ '?column?': 1 }] : [] };
  }
  if (sql.includes('RETURNING encurespo_id')) return { rows: [{ encurespo_id: 900 }] };
  if (sql.includes('RETURNING encu_id')) return { rows: [{ encu_id: 7 }] };
  if (sql.includes('AS preguntas') && sql.includes('AS respuestas')) {
    return { rows: [{ preguntas: 2, respondidas: 0, respuestas: 0 }] };
  }
  return { rows: [] };
});

vi.mock('../../config/db.js', () => ({
  getPool: () => ({ query, connect: async () => ({ query, release: vi.fn() }) }),
}));

const service = await import('./encuestas.service.js');

const gestor = {
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

const representante = {
  authUserId: 'auth-90',
  usuario: {
    usu_id: 90,
    usu_nombre: 'Mama de Ana',
    usu_correo: 'mama@example.com',
    est_id: ESTADO.ACTIVO,
    roles: [{ rol_id: ROL.REPRESENTANTE }],
    permisos: [],
  },
  permisos: [],
} as never;

beforeEach(() => {
  encuesta = { ...ENCUESTA };
  preguntas = PREGUNTAS.map((p) => ({ ...p }));
  padreId = 40;
  tieneRol = true;
  yaRespondio = false;
  escrituras.length = 0;
  query.mockClear();
});

describe('el ciclo de estados', () => {
  it('en borrador se edita', async () => {
    await service.actualizar(gestor, 7, { encu_titulo: 'Otro titulo' });
    expect(escrituras.some((s) => s.includes('UPDATE public.encuesta'))).toBe(true);
  });

  it('finalizada no se edita', async () => {
    encuesta = { ...ENCUESTA, est_id: ESTADO.FINALIZADO };
    await expect(
      service.actualizar(gestor, 7, { encu_titulo: 'Otro' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('publicada tampoco, y lo dice por que', async () => {
    encuesta = { ...ENCUESTA, est_id: ESTADO.PUBLICADO };
    await expect(
      service.guardarPreguntas(gestor, 7, []),
    ).rejects.toThrowError(/ya esta publicada/);
  });

  it('una encuesta sin preguntas no se puede finalizar', async () => {
    encuesta = { ...ENCUESTA, preguntas: 0 };
    await expect(service.finalizar(gestor, 7)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('con preguntas si', async () => {
    const f = await service.finalizar(gestor, 7);
    expect(f.encuesta.encu_id).toBe(7);
  });

  it('publicar exige estar finalizada', async () => {
    await expect(service.publicar(gestor, 7)).rejects.toThrowError(/Finalizala antes/);
  });

  it('finalizada se publica', async () => {
    encuesta = { ...ENCUESTA, est_id: ESTADO.FINALIZADO };
    await service.publicar(gestor, 7);
    expect(escrituras.some((s) => s.includes('INSERT INTO public.auditoria'))).toBe(true);
  });

  it('vuelve a borrador si nadie respondio', async () => {
    encuesta = { ...ENCUESTA, est_id: ESTADO.FINALIZADO };
    const f = await service.volverABorrador(gestor, 7);
    expect(f.encuesta.encu_id).toBe(7);
  });

  /**
   * Con una respuesta dentro, volver atras destruiria el sentido de lo ya
   * contestado: dos representantes habrian respondido a preguntas distintas.
   */
  it('no vuelve a borrador si ya la respondieron', async () => {
    encuesta = { ...ENCUESTA, est_id: ESTADO.FINALIZADO, respondidas: 3 };
    await expect(service.volverABorrador(gestor, 7)).rejects.toThrowError(/3 representante/);
  });

  it('una encuesta inexistente da 404', async () => {
    encuesta = null;
    await expect(service.ficha(7)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('responder', () => {
  const completas = {
    respuestas: [
      { encupreg_id: 100, texto: 'Muy bien' },
      { encupreg_id: 101, numero: 4 },
    ],
  };

  beforeEach(() => {
    encuesta = { ...ENCUESTA, est_id: ESTADO.PUBLICADO };
  });

  it('un representante responde y se registra', async () => {
    const r = await service.responder(representante, 7, completas);
    expect(r.registradas).toBe(2);
    expect(escrituras.some((s) => s.includes('INSERT INTO public.encuesta_respondida'))).toBe(
      true,
    );
  });

  it('no puede responder dos veces', async () => {
    yaRespondio = true;
    await expect(service.responder(representante, 7, completas)).rejects.toThrowError(
      /Ya respondiste/,
    );
  });

  it('una encuesta no publicada no se responde', async () => {
    encuesta = { ...ENCUESTA, est_id: ESTADO.FINALIZADO };
    await expect(service.responder(representante, 7, completas)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('quien no es representante no responde', async () => {
    padreId = null;
    tieneRol = false;
    await expect(service.responder(gestor, 7, completas)).rejects.toThrowError(
      /las responden los representantes/,
    );
  });

  /** Tener el rol sin ficha es un estado roto: se dice, no se devuelve vacio. */
  it('con el rol pero sin ficha, lo dice', async () => {
    padreId = null;
    tieneRol = true;
    await expect(service.mias(representante)).rejects.toThrowError(/le falta la ficha/);
  });

  it('faltar una respuesta se rechaza entero', async () => {
    await expect(
      service.responder(representante, 7, { respuestas: [{ encupreg_id: 100, texto: 'Bien' }] }),
    ).rejects.toThrowError(/Faltan respuestas/);
  });

  it('una pregunta de otra encuesta se rechaza', async () => {
    await expect(
      service.responder(representante, 7, {
        respuestas: [
          { encupreg_id: 100, texto: 'Bien' },
          { encupreg_id: 999, numero: 3 },
        ],
      }),
    ).rejects.toThrowError(/no es de esta encuesta/);
  });

  it('el valor tiene que cuadrar con el tipo de la pregunta', async () => {
    await expect(
      service.responder(representante, 7, {
        respuestas: [
          { encupreg_id: 100, numero: 5 },
          { encupreg_id: 101, numero: 4 },
        ],
      }),
    ).rejects.toThrowError(/espera una respuesta escrita/);
  });

  it('un valor fuera de la escala se rechaza', async () => {
    await expect(
      service.responder(representante, 7, {
        respuestas: [
          { encupreg_id: 100, texto: 'Bien' },
          { encupreg_id: 101, numero: 9 },
        ],
      }),
    ).rejects.toThrowError(/admite de 1 a 5/);
  });

  it('nada se escribe si una respuesta esta mal', async () => {
    await expect(
      service.responder(representante, 7, {
        respuestas: [
          { encupreg_id: 100, texto: 'Bien' },
          { encupreg_id: 101, numero: 99 },
        ],
      }),
    ).rejects.toThrow();
    expect(escrituras.some((s) => s.includes('INSERT INTO public.encuesta_respondida'))).toBe(
      false,
    );
  });
});

describe('borrado', () => {
  it('exige el titulo exacto', async () => {
    await expect(service.eliminar(gestor, 7, 'otra cosa')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('con el titulo correcto borra, sin distinguir mayusculas', async () => {
    await service.eliminar(gestor, 7, '  SATISFACCION del primer trimestre ');
    expect(escrituras.some((s) => s.includes('DELETE FROM public.encuesta WHERE'))).toBe(true);
  });
});

describe('validacion de las preguntas', () => {
  const base = {
    encupreg_pregunta: 'Una pregunta cualquiera',
    encutiporesp_id: TIPO.TEXTO_CORTO as number,
  };

  it('una de escala necesita minimo y maximo', () => {
    expect(
      preguntaSchema.safeParse({ ...base, encutiporesp_id: TIPO.ESCALA }).success,
    ).toBe(false);
    expect(
      preguntaSchema.safeParse({
        ...base,
        encutiporesp_id: TIPO.ESCALA,
        encupreg_escala_min: 1,
        encupreg_escala_max: 5,
      }).success,
    ).toBe(true);
  });

  it('el maximo tiene que ser mayor que el minimo', () => {
    expect(
      preguntaSchema.safeParse({
        ...base,
        encutiporesp_id: TIPO.ESCALA,
        encupreg_escala_min: 5,
        encupreg_escala_max: 2,
      }).success,
    ).toBe(false);
  });

  it('las que no son de escala no llevan limites', () => {
    expect(
      preguntaSchema.safeParse({ ...base, encupreg_escala_min: 1, encupreg_escala_max: 5 })
        .success,
    ).toBe(false);
  });

  it('un tipo desconocido se rechaza', () => {
    expect(preguntaSchema.safeParse({ ...base, encutiporesp_id: 99 }).success).toBe(false);
  });

  it('no se puede responder dos veces la misma pregunta en el mismo envio', () => {
    expect(
      responderSchema.safeParse({
        respuestas: [
          { encupreg_id: 1, texto: 'a' },
          { encupreg_id: 1, texto: 'b' },
        ],
      }).success,
    ).toBe(false);
  });

  it('la hora va en HH:MM', () => {
    expect(
      responderSchema.safeParse({ respuestas: [{ encupreg_id: 1, hora: '9:5' }] }).success,
    ).toBe(false);
    expect(
      responderSchema.safeParse({ respuestas: [{ encupreg_id: 1, hora: '09:05' }] }).success,
    ).toBe(true);
  });
});
