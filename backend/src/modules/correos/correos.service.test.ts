import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ESTADO, ROL } from '../../lib/constants.js';
import { configCorreoSchema } from './correos.schemas.js';

/** Configuracion de correos (2026-10-07), sin base de datos ni Resend. */

let fila: Record<string, unknown> | null = {
  tipo: 'inscripciones',
  nombre: 'Inscripcion Activa Reforce',
  usuario: 'inscripciones',
  cc: ['gerencia@activareforce.com'],
  responder_a: 'info@activareforce.com',
};
const actualizaciones: unknown[][] = [];

const query = vi.fn(async (sql: string, parametros?: unknown[]) => {
  if (sql.includes('FROM public.correo_config')) return { rows: fila ? [fila] : [] };
  if (sql.includes('UPDATE public.correo_config')) {
    actualizaciones.push(parametros ?? []);
    return { rowCount: 1, rows: [] };
  }
  return { rows: [] };
});

vi.mock('../../config/db.js', () => ({
  getPool: () => ({ query, connect: async () => ({ query, release: vi.fn() }) }),
}));
vi.mock('../../config/env.js', () => ({
  env: { CORREO_DOMINIO: 'activareforce.com', RESEND_API_KEY: 're_prueba' },
}));

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}', { status: 200 }));
vi.stubGlobal('fetch', fetchMock);

const service = await import('./correos.service.js');

const persona = (rol: number) =>
  ({
    authUserId: `auth-${rol}`,
    usuario: { usu_id: rol, usu_nombre: 'X', usu_correo: 'x@x.com', est_id: ESTADO.ACTIVO, roles: [{ rol_id: rol }], permisos: [] },
    permisos: [],
  }) as never;

const entrada = {
  nombre: 'Inscripcion Activa Reforce',
  usuario: 'inscripciones',
  cc: ['gerencia@activareforce.com'],
  responder_a: null,
};

beforeEach(() => {
  actualizaciones.length = 0;
  fetchMock.mockClear();
});

describe('solo el Propietario', () => {
  it('el Admin no la ve ni la cambia (403)', async () => {
    await expect(service.obtener(persona(ROL.ADMIN), 'inscripciones')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.guardar(persona(ROL.ADMIN), 'inscripciones', entrada)).rejects.toMatchObject({ statusCode: 403 });
    expect(actualizaciones).toHaveLength(0);
  });

  it('el Propietario la ve con el dominio fijo y la guarda', async () => {
    const config = await service.obtener(persona(ROL.PROPIETARIO), 'inscripciones');
    expect(config.dominio).toBe('activareforce.com');
    await service.guardar(persona(ROL.PROPIETARIO), 'inscripciones', entrada);
    expect(actualizaciones).toHaveLength(1);
  });
});

describe('el envio usa la configuracion del tipo', () => {
  it('remitente con nombre, copias visibles y responder a', async () => {
    const salio = await service.enviarComo('inscripciones', {
      para: 'mama@correo.com',
      asunto: 'Tu inscripción fue aprobada',
      html: '<p>Hola</p>',
      texto: 'Hola',
    });
    expect(salio).toBe(true);
    const cuerpo = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
    expect(cuerpo.from).toBe('Inscripcion Activa Reforce <inscripciones@activareforce.com>');
    expect(cuerpo.to).toEqual(['mama@correo.com']);
    expect(cuerpo.cc).toEqual(['gerencia@activareforce.com']);
    expect(cuerpo.bcc).toBeUndefined();
    expect(cuerpo.reply_to).toBe('info@activareforce.com');
    expect(cuerpo.subject).toBe('Tu inscripción fue aprobada');
  });

  it('sin fila de configuracion no sale y no lanza', async () => {
    const guardada = fila;
    fila = null;
    const salio = await service.enviarComo('inscripciones', { para: 'a@b.com', asunto: 'x', html: 'x', texto: 'x' });
    fila = guardada;
    expect(salio).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('validacion de la pantalla', () => {
  it('no deja escribir el dominio en la direccion', () => {
    expect(configCorreoSchema.safeParse({ ...entrada, usuario: 'inscripciones@gmail.com' }).success).toBe(false);
  });

  it('quita copias repetidas y normaliza mayusculas', () => {
    const r = configCorreoSchema.parse({ ...entrada, cc: ['Gerencia@ActivaReforce.com', 'gerencia@activareforce.com'] });
    expect(r.cc).toEqual(['gerencia@activareforce.com']);
  });

  it('mas de 10 copias se rechaza', () => {
    const cc = Array.from({ length: 11 }, (_, i) => `c${i}@x.com`);
    expect(configCorreoSchema.safeParse({ ...entrada, cc }).success).toBe(false);
  });

  it('responder a vacio queda en null', () => {
    expect(configCorreoSchema.parse({ ...entrada, responder_a: '' }).responder_a).toBeNull();
  });
});
