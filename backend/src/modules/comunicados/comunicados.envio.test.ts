import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El envío paso a paso, con la base y Resend fingidos. Lo que más importa:
 * los contactos que ya estaban en Resend (reales del cliente) nunca se borran.
 */

type Estado = 'pendiente' | 'creando' | 'creado' | 'existia' | 'borrado';

const com = {
  com_id: 7,
  com_estado: 'en_cola' as string,
  com_asunto: 'Aviso',
  com_html: '<p>Hola</p>',
  com_error: null as string | null,
  com_resend_segmento: null as string | null,
  com_resend_broadcast: null as string | null,
};
let destinatarios = new Map<string, Estado>();

vi.mock('../../config/env.js', () => ({ env: { NODE_ENV: 'test', CORREO_DOMINIO: 'activareforce.com' } }));
vi.mock('../../config/db.js', () => ({ getPool: () => ({}) }));
vi.mock('../../lib/correo.js', () => ({ contarEnvio: async () => undefined }));
vi.mock('../correos/correos.repository.js', () => ({
  obtenerConfig: async () => ({ nombre: 'Activa Reforce', usuario: 'comunicados', responder_a: 'info@x.com' }),
}));

vi.mock('./comunicados.repository.js', () => ({
  siguienteEnvio: async () =>
    ['en_cola', 'preparando', 'enviando', 'limpiando'].includes(com.com_estado) ? { ...com } : null,
  cambiarEstado: async (_id: number, estado: string, error: string | null) => {
    com.com_estado = estado;
    if (error) com.com_error = error;
  },
  guardarSegmentoResend: async (_id: number, s: string) => {
    com.com_resend_segmento = s;
  },
  guardarBroadcastResend: async (_id: number, b: string) => {
    com.com_resend_broadcast = b;
  },
  destinatariosPorEstado: async (_id: number, estados: string[], limite: number) =>
    [...destinatarios.entries()]
      .filter(([, e]) => estados.includes(e))
      .slice(0, limite)
      .map(([correo, estado]) => ({ correo, nombre: correo.split('@')[0], estado })),
  marcarDestinatario: async (_id: number, correo: string, estado: Estado) => {
    destinatarios.set(correo, estado);
  },
  contarDestinatariosEnSegmento: async () => destinatarios.size,
  vaciarDestinatarios: async () => {
    destinatarios = new Map();
  },
}));

const enResend = new Set<string>();
const llamadas: string[] = [];
let estadoBroadcast: { status: string | null; sent_at: string | null } = {
  status: 'sent',
  sent_at: '2020-01-01T00:00:00Z',
};
let fallarAlCrear: string | null = null;

vi.mock('./comunicados.resend.js', async () => {
  const real = await vi.importActual<typeof import('./comunicados.resend.js')>('./comunicados.resend.js');
  return {
    ResendError: real.ResendError,
    existeContacto: async (c: string) => enResend.has(c),
    crearContacto: async (c: string) => {
      if (fallarAlCrear === c) throw new real.ResendError(401, 'restricted_api_key');
      llamadas.push(`crear ${c}`);
      enResend.add(c);
    },
    anadirASegmento: async (c: string) => {
      llamadas.push(`anadir ${c}`);
    },
    borrarContacto: async (c: string) => {
      llamadas.push(`borrar ${c}`);
      enResend.delete(c);
    },
    crearSegmento: async () => {
      llamadas.push('crear segmento');
      return 'seg-1';
    },
    borrarSegmento: async (id: string) => {
      llamadas.push(`borrar segmento ${id}`);
    },
    enviarBroadcast: async (b: { de: string; segmentoId: string }) => {
      llamadas.push(`broadcast ${b.segmentoId} de ${b.de}`);
      return 'bc-1';
    },
    estadoBroadcast: async () => estadoBroadcast,
  };
});

const { procesar } = await import('./comunicados.envio.js');

beforeEach(() => {
  Object.assign(com, {
    com_estado: 'en_cola',
    com_error: null,
    com_resend_segmento: null,
    com_resend_broadcast: null,
  });
  destinatarios = new Map([
    ['real@cliente.com', 'pendiente'],
    ['nuevo@x.com', 'pendiente'],
  ]);
  enResend.clear();
  enResend.add('real@cliente.com');
  enResend.add('otro-real@cliente.com');
  llamadas.length = 0;
  estadoBroadcast = { status: 'sent', sent_at: '2020-01-01T00:00:00Z' };
  fallarAlCrear = null;
});

describe('envío completo', () => {
  it('no borra los contactos que ya estaban en Resend; sí los que creó', async () => {
    await procesar();
    expect(com.com_estado).toBe('enviado');
    expect(llamadas).toEqual([
      'crear segmento',
      'anadir real@cliente.com',
      'crear nuevo@x.com',
      'broadcast seg-1 de Activa Reforce <comunicados@activareforce.com>',
      'borrar nuevo@x.com',
      'borrar segmento seg-1',
    ]);
    expect(enResend.has('real@cliente.com')).toBe(true);
    expect(enResend.has('otro-real@cliente.com')).toBe(true);
    expect(enResend.has('nuevo@x.com')).toBe(false);
    expect(destinatarios.size).toBe(0);
  });

  it('espera 10 minutos tras "sent" antes de limpiar', async () => {
    estadoBroadcast = { status: 'sent', sent_at: new Date().toISOString() };
    await procesar();
    expect(com.com_estado).toBe('enviando');
    expect(llamadas.some((l) => l.startsWith('borrar'))).toBe(false);
  });

  it('mientras Resend lo tiene en cola, espera sin limpiar', async () => {
    estadoBroadcast = { status: 'queued', sent_at: null };
    await procesar();
    expect(com.com_estado).toBe('enviando');
  });

  it('si Resend lo rechaza, limpia lo que creó y queda fallido con el motivo', async () => {
    destinatarios = new Map([
      ['nuevo@x.com', 'pendiente'],
      ['zeta@x.com', 'pendiente'],
    ]);
    fallarAlCrear = 'zeta@x.com';
    await procesar();
    expect(com.com_estado).toBe('fallido');
    expect(com.com_error).toContain('restricted_api_key');
    expect(llamadas).toContain('borrar nuevo@x.com');
    expect(llamadas).toContain('borrar segmento seg-1');
    expect(llamadas.some((l) => l.startsWith('broadcast'))).toBe(false);
    expect(enResend.has('real@cliente.com')).toBe(true);
  });

  it('retoma un "creando" de un corte: lo trata como suyo y lo borra al final', async () => {
    destinatarios = new Map([['corte@x.com', 'creando']]);
    enResend.add('corte@x.com');
    await procesar();
    expect(com.com_estado).toBe('enviado');
    expect(llamadas).toContain('borrar corte@x.com');
  });
});
