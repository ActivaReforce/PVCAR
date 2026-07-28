# PVCAR

Plataforma de gestión deportiva escolar de **Activa Reforce**. Monorepo con backend, frontend y el schema de base de datos versionado.

El plan maestro de construcción y migración está en [`docs/Plan.md`](docs/Plan.md). **Léelo antes de tocar nada.**

## Estructura

```
backend/    Express + TypeScript      → Railway (root dir: backend)
frontend/   Vite + React + TypeScript → Vercel  (root dir: frontend)
db/
  migrations/  SQL versionado — fuente de verdad del schema
  seed/        datos mínimos sintéticos para desarrollo
  scripts/     dump, restore, backfill de auth, copia de storage
docs/       Plan.md, API.md, RUNBOOK-cutover.md
```

## Ambientes

| | Rama | Backend | Frontend | Base de datos |
|---|---|---|---|---|
| Producción | `main` | Railway `production` | Vercel Production | Supabase `PVCAR` |
| Desarrollo | `dev` | Railway `development` | Vercel Preview | Supabase `PVCAR_Dev` |

## Setup local

```bash
npm install                 # instala ambos workspaces desde la raíz

cp backend/.env.example backend/.env      # rellenar con los valores de PVCAR_Dev
cp frontend/.env.example frontend/.env

npm run dev:backend         # http://localhost:3000/api/v1/health
npm run dev:frontend        # http://localhost:5173
```

## Reglas no negociables

1. `SUPABASE_SERVICE_ROLE_KEY` y `DATABASE_URL` viven **solo** en variables de entorno de Railway. Nunca en el frontend, nunca en git.
2. El frontend usa Supabase **únicamente** para login/sesión (anon key). Todo dato pasa por el API.
3. Toda lógica de negocio (scoring, transiciones de rol, agregaciones, permisos) vive en el backend.
4. Ningún endpoint sin validación `zod` y sin chequeo de permisos.
5. Cada cambio de schema es una migración versionada en `db/migrations/`. Nada de cambios a mano en el dashboard de Supabase.

## Ramas

`main` (protegida, = producción) ← PR desde `dev` ← PRs de features. CI obligatorio (lint + typecheck + build + test) para mergear.
