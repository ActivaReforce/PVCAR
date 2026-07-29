import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

// env.ts valida con zod al cargarse y hace process.exit(1) si falta algo:
// las variables van antes del import dinamico de app.js.
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.FRONTEND_ORIGIN = 'https://dev-pvcar.vercel.app,http://localhost:5173';

let server: Server;
let base: string;

beforeAll(async () => {
  const { createApp } = await import('./app.js');
  const app = createApp();
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('GET /api/v1/health', () => {
  it('responde 200 con la forma { data, error }', async () => {
    const res = await fetch(`${base}/api/v1/health`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: { status: string }; error: null };
    expect(body.error).toBeNull();
    expect(body.data.status).toBe('ok');
  });
});

describe('CORS', () => {
  it('permite un origen de la lista y devuelve el header', async () => {
    const origin = 'https://dev-pvcar.vercel.app';
    const res = await fetch(`${base}/api/v1/health`, { headers: { Origin: origin } });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(origin);
  });

  it('permite el segundo origen de la lista separada por comas', async () => {
    const origin = 'http://localhost:5173';
    const res = await fetch(`${base}/api/v1/health`, { headers: { Origin: origin } });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(origin);
  });

  it('permite requests sin Origin (health checks de Railway, curl)', async () => {
    const res = await fetch(`${base}/api/v1/health`);
    expect(res.status).toBe(200);
  });

  it('rechaza un origen no permitido con 403, no 500', async () => {
    const res = await fetch(`${base}/api/v1/health`, {
      headers: { Origin: 'https://evil.example.com' },
    });

    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();

    const body = (await res.json()) as { data: null; error: { message: string } };
    expect(body.data).toBeNull();
    expect(body.error.message).toContain('Origen no permitido por CORS');
  });
});

describe('404', () => {
  it('devuelve 404 con la forma { data, error } en una ruta inexistente', async () => {
    const res = await fetch(`${base}/api/v1/no-existe`);
    expect(res.status).toBe(404);

    const body = (await res.json()) as { data: null; error: { message: string } };
    expect(body.data).toBeNull();
    expect(body.error.message).toBe('Recurso no encontrado');
  });
});
