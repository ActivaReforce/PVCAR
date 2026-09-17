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

/**
 * Tests sin red: solo lo que se resuelve antes de hablar con Supabase o con la
 * base. Es justo lo que hay que blindar — que ninguna ruta protegida conteste
 * nada sin token, y que la validacion corte antes de tocar credenciales.
 */
describe('Autenticacion — puertas que no dependen de la red', () => {
  it('GET /me sin token responde 401', async () => {
    const res = await fetch(`${base}/api/v1/me`);
    expect(res.status).toBe(401);

    const body = (await res.json()) as { data: null; error: { message: string } };
    expect(body.data).toBeNull();
    expect(body.error.message).toBe('Token de autorizacion ausente');
  });

  it('POST /auth/change-password sin token responde 401', async () => {
    const res = await fetch(`${base}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'vieja123', newPassword: 'nueva123' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /auth/logout sin token responde 401', async () => {
    const res = await fetch(`${base}/api/v1/auth/logout`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('POST /auth/login con correo invalido responde 400 sin tocar Supabase', async () => {
    const res = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'no-es-un-correo', password: 'algo1234' }),
    });
    expect(res.status).toBe(400);

    const body = (await res.json()) as { data: null; error: { message: string } };
    expect(body.error.message).toBe('Validacion fallida');
  });

  it('POST /auth/forgot-password con correo invalido responde 400', async () => {
    const res = await fetch(`${base}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'arroba-faltante.com' }),
    });
    expect(res.status).toBe(400);
  });
});

/**
 * Modulo de la Fase 6. Igual que arriba: solo lo que se decide antes de tocar
 * la base. Que ninguna de estas rutas conteste sin token es la mitad del
 * arreglo — en el sistema viejo la pantalla de usuarios consultaba la tabla
 * entera con la anon key del bundle.
 */
describe('Modulos de negocio — cerrados sin token', () => {
  const rutas: Array<[string, string]> = [
    ['GET', '/api/v1/usuarios'],
    ['GET', '/api/v1/usuarios/roles'],
    ['GET', '/api/v1/usuarios/1'],
    ['GET', '/api/v1/usuarios/1/impacto'],
    ['POST', '/api/v1/usuarios'],
    ['POST', '/api/v1/usuarios/foto'],
    ['PATCH', '/api/v1/usuarios/1'],
    ['POST', '/api/v1/usuarios/1/baja'],
    ['POST', '/api/v1/usuarios/1/reactivar'],
    ['DELETE', '/api/v1/usuarios/1'],
    ['GET', '/api/v1/colegios'],
    ['GET', '/api/v1/colegios/coordinadores'],
    ['GET', '/api/v1/colegios/1'],
    ['GET', '/api/v1/colegios/1/impacto'],
    ['POST', '/api/v1/colegios'],
    ['POST', '/api/v1/colegios/foto'],
    ['PATCH', '/api/v1/colegios/1'],
    ['PUT', '/api/v1/colegios/1/coordinadores'],
    ['DELETE', '/api/v1/colegios/1'],
    ['GET', '/api/v1/actividades'],
    ['GET', '/api/v1/actividades/categorias'],
    ['GET', '/api/v1/actividades/1'],
    ['POST', '/api/v1/actividades'],
    ['PATCH', '/api/v1/actividades/1'],
    ['DELETE', '/api/v1/actividades/1'],
    ['GET', '/api/v1/disciplinas'],
    ['GET', '/api/v1/disciplinas/dias'],
    ['GET', '/api/v1/disciplinas/1'],
    ['GET', '/api/v1/disciplinas/1/previo-baja'],
    ['GET', '/api/v1/disciplinas/1/impacto'],
    ['POST', '/api/v1/disciplinas'],
    ['PATCH', '/api/v1/disciplinas/1'],
    ['POST', '/api/v1/disciplinas/1/baja'],
    ['POST', '/api/v1/disciplinas/1/reactivar'],
    ['DELETE', '/api/v1/disciplinas/1'],
    ['GET', '/api/v1/entrenadores'],
    ['GET', '/api/v1/entrenadores/candidatos-auxiliar'],
    ['GET', '/api/v1/entrenadores/1'],
    ['GET', '/api/v1/entrenadores/1/disponibles'],
    ['POST', '/api/v1/entrenadores/1/asignaciones'],
    ['DELETE', '/api/v1/entrenadores/1/asignaciones/2'],
    ['POST', '/api/v1/entrenadores/1/auxiliares'],
    ['DELETE', '/api/v1/entrenadores/1/auxiliares/2'],
    ['GET', '/api/v1/estudiantes'],
    ['GET', '/api/v1/estudiantes/grados'],
    ['GET', '/api/v1/estudiantes/candidatos-representante'],
    ['POST', '/api/v1/estudiantes/foto'],
    ['GET', '/api/v1/estudiantes/1'],
    ['GET', '/api/v1/estudiantes/1/disponibles'],
    ['GET', '/api/v1/estudiantes/1/impacto'],
    ['POST', '/api/v1/estudiantes'],
    ['PATCH', '/api/v1/estudiantes/1'],
    ['PUT', '/api/v1/estudiantes/1/inscripciones'],
    ['POST', '/api/v1/estudiantes/1/baja'],
    ['POST', '/api/v1/estudiantes/1/reactivar'],
    ['DELETE', '/api/v1/estudiantes/1'],
    ['POST', '/api/v1/estudiantes/1/representantes'],
    ['DELETE', '/api/v1/estudiantes/1/representantes/2'],
    ['GET', '/api/v1/asistencias/estados'],
    ['GET', '/api/v1/asistencias/contexto'],
    ['GET', '/api/v1/asistencias/alumnos'],
    ['PUT', '/api/v1/asistencias/alumnos'],
    ['GET', '/api/v1/asistencias/historial'],
    ['GET', '/api/v1/asistencias/entrenadores'],
    ['PUT', '/api/v1/asistencias/entrenadores'],
    ['GET', '/api/v1/evaluaciones'],
    ['GET', '/api/v1/evaluaciones/metodos'],
    ['GET', '/api/v1/evaluaciones/categorias'],
    ['GET', '/api/v1/evaluaciones/pendientes'],
    ['GET', '/api/v1/evaluaciones/pendientes/1'],
    ['PUT', '/api/v1/evaluaciones/pendientes/1/intentos'],
    ['DELETE', '/api/v1/evaluaciones/pendientes/1'],
    ['GET', '/api/v1/evaluaciones/1'],
    ['GET', '/api/v1/evaluaciones/1/disciplinas'],
    ['GET', '/api/v1/evaluaciones/1/impacto'],
    ['POST', '/api/v1/evaluaciones'],
    ['PATCH', '/api/v1/evaluaciones/1'],
    ['PUT', '/api/v1/evaluaciones/1/parametros'],
    ['PUT', '/api/v1/evaluaciones/1/disciplinas'],
    ['POST', '/api/v1/evaluaciones/1/baja'],
    ['POST', '/api/v1/evaluaciones/1/reactivar'],
    ['DELETE', '/api/v1/evaluaciones/1'],
    ['GET', '/api/v1/tablero'],
    ['GET', '/api/v1/reportes'],
    ['GET', '/api/v1/reportes/usuarios'],
    ['POST', '/api/v1/reportes/usuarios/export'],
    ['GET', '/api/v1/representantes'],
    ['GET', '/api/v1/representantes/1'],
    ['GET', '/api/v1/representantes/1/disponibles'],
    ['PUT', '/api/v1/representantes/1/hijos'],
    ['PATCH', '/api/v1/representantes/1'],
    ['GET', '/api/v1/encuestas'],
    ['GET', '/api/v1/encuestas/tipos'],
    ['GET', '/api/v1/encuestas/mias'],
    ['GET', '/api/v1/encuestas/mias/1'],
    ['POST', '/api/v1/encuestas/mias/1/responder'],
    ['GET', '/api/v1/encuestas/1'],
    ['GET', '/api/v1/encuestas/1/resultados'],
    ['GET', '/api/v1/encuestas/1/impacto'],
    ['POST', '/api/v1/encuestas'],
    ['PATCH', '/api/v1/encuestas/1'],
    ['PUT', '/api/v1/encuestas/1/preguntas'],
    ['POST', '/api/v1/encuestas/1/finalizar'],
    ['POST', '/api/v1/encuestas/1/borrador'],
    ['POST', '/api/v1/encuestas/1/publicar'],
    ['DELETE', '/api/v1/encuestas/1'],
    ['GET', '/api/v1/permisos'],
    ['PUT', '/api/v1/permisos/rol/1'],
    ['GET', '/api/v1/perfil'],
    ['PATCH', '/api/v1/perfil'],
    ['POST', '/api/v1/perfil/foto'],
  ];

  it.each(rutas)('%s %s responde 401 sin token', async (metodo, ruta) => {
    const res = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: metodo === 'GET' ? undefined : JSON.stringify({}),
    });
    expect(res.status).toBe(401);
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
