# PVCAR

Plataforma de gestión deportiva escolar de **Activa Reforce**. Monorepo con backend, frontend y el schema de base de datos versionado.

El plan maestro de construcción y migración **no se versiona aquí**: describe el estado y las debilidades del sistema anterior, que sigue en producción. Se mantiene fuera del repo y se comparte por canal privado. **Léelo antes de tocar nada.**

## Estructura

```
backend/    Express + TypeScript      → Railway (root dir: raíz del repo)
frontend/   Vite + React + TypeScript → Vercel  (root dir: frontend)
db/
  migrations/  SQL versionado — fuente de verdad del schema
  seed/        datos mínimos sintéticos para desarrollo
  scripts/     dump, restore, backfill de auth, copia de storage
docs/       API.md, RUNBOOK-cutover.md (el plan maestro se mantiene fuera del repo)
```

## Ambientes

| | Rama | Backend | Frontend | Base de datos |
|---|---|---|---|---|
| Producción | `main` | `pvcarbackend-production.up.railway.app` | `pvcar.vercel.app` | Supabase `PVCAR` |
| Desarrollo | `dev` | `pvcarbackend-development.up.railway.app` | `dev-pvcar.vercel.app` | Supabase `PVCAR_Dev` |

Un commit a `dev` dispara CI, el preview de Vercel y el deploy de Railway `development`. A `main` se llega solo por PR.

### Estado actual

Los cuatro despliegues responden, pero el producto **todavía no funciona de punta a punta**:

- Las dos bases tienen schema, RLS (deny-by-default, sin políticas) y privilegios cerrados. `PVCAR` está **vacía de datos** a propósito: los recibe en el cutover. `GET /api/v1/health` devuelve `db: "ok"` en los dos ambientes.
- El backend expone `/api/v1/health`, `/api/v1/auth/*` y `/api/v1/me`. Todavía no hay endpoints de negocio.
- El frontend es la SPA anterior tal cual: **97 archivos** consultan Supabase directo y **ninguno** usa `lib/api.ts`. Se migra módulo por módulo; hasta entonces las pantallas no sirven datos desde el API.

### Trampas de despliegue

- **Railway** usa la raíz del repo como contexto de build, no `backend/`: el `package-lock.json` vive en la raíz por npm workspaces. La config está en `railway.json` (raíz), con `watchPatterns` para no redeployar por cambios de frontend.
- **Vercel** salta el build si el commit no toca `frontend/**`. El deployment aparece como `Canceled`, sin logs de build. No es un error.
- Las `VITE_*` se hornean en el bundle en tiempo de build; cambiarlas en el dashboard no surte efecto hasta el build siguiente.
- Los previews están detrás de Vercel Authentication: se abren con sesión del team.
- `FRONTEND_ORIGIN` de los backends desplegados **no incluye `localhost`**. Un frontend local debe apuntar a un backend local, o CORS lo bloquea.

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
