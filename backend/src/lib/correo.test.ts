import { beforeEach, describe, expect, it, vi } from 'vitest';

/** El contador de "Correos enviados hoy" del tablero (2026-10-12). */

const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] }));
vi.mock('../config/db.js', () => ({ getPool: () => ({ query }) }));
vi.mock('../config/env.js', () => ({ env: { RESEND_API_KEY: 'k' } }));

const { enviarCorreo } = await import('./correo.js');

const correo = {
  para: 'a@x.com',
  asunto: 'A',
  html: '<p>A</p>',
  texto: 'A',
  de: 'X <x@x.com>',
  tipo: 'ausencias',
};

beforeEach(() => query.mockClear());

describe('contar los correos enviados', () => {
  it('suma uno al tipo, en el día de Ecuador, cuando Resend lo acepta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    await expect(enviarCorreo(correo)).resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain("AT TIME ZONE 'America/Guayaquil'");
    expect(sql).toContain('cordia_enviados + 1');
    expect(params).toEqual(['ausencias']);
  });

  it('si Resend lo rechaza no cuenta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 422 })));
    await expect(enviarCorreo(correo)).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it('si el contador falla, el correo sigue contando como enviado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    query.mockRejectedValueOnce(new Error('sin base'));
    await expect(enviarCorreo(correo)).resolves.toBe(true);
  });
});
