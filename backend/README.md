# PVCAR — Backend

API REST (Node + Express + TypeScript) entre el frontend y Supabase.
Único componente con `service-role` key y connection string Postgres.

## Stack
- Express 4 + TypeScript (ESM, NodeNext)
- `pg` (pool al pooler de Supabase) + `@supabase/supabase-js` (Auth/Storage, service-role)
- `zod` (validación), `helmet`, `cors`
- `tsx` (dev), `vitest` (tests)

## Estructura
```
src/
  config/      env (zod), supabase admin client, pg pool
  middleware/  auth (JWT Supabase), requirePermission, error handler
  modules/     un folder por módulo (routes + controller + service)
  lib/         lógica de negocio movida del front (scoring, datetime…)
  types/
  app.ts  server.ts
```

## Setup local
```bash
cp .env.example .env   # rellenar secretos (service-role, DATABASE_URL)
npm install            # desde la raiz del monorepo
npm run dev            # http://localhost:3000/api/v1/health
```

## Convención del API
- Prefijo `/api/v1`
- Respuestas JSON: `{ data, error }`
- Validación zod por endpoint
- Errores centralizados en `middleware/error.ts`

## Endpoints

| Método | Ruta | Token | Qué hace |
|---|---|---|---|
| GET | `/health` | — | Estado del servicio y ping a la base |
| POST | `/auth/login` | — | Valida contra Supabase Auth y devuelve sesión + usuario + roles + permisos. Rechaza inactivos **antes** de emitir token |
| POST | `/auth/logout` | sí | Revoca todos los refresh tokens del usuario |
| POST | `/auth/forgot-password` | — | Manda el enlace de recuperación. Responde 202 siempre: no revela si el correo existe |
| POST | `/auth/change-password` | sí | Cambia la contraseña exigiendo la actual |
| GET | `/me` | sí | Usuario de dominio, roles y permisos del token |

El refresh del token lo maneja `supabase-js` en el navegador; el backend no lo
reimplementa. Los endpoints con contraseña tienen rate limit propio (10 cada 15
min por IP + cuenta), más estricto que el general del API.

`FRONTEND_ORIGIN` admite varios orígenes separados por coma. **El primero se usa
para armar el enlace del correo de recuperación**, así que debe ser el dominio
real del ambiente.

## Secretos (NUNCA en git)
`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` → solo en `.env` local (gitignoreado)
y en variables de entorno de Railway.
