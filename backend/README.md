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

## Secretos (NUNCA en git)
`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` → solo en `.env` local (gitignoreado)
y en variables de entorno de Railway.
