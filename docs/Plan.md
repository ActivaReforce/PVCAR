# PVCAR — Plan maestro de construcción y migración

> **Producto:** plataforma de gestión deportiva escolar de **Activa Reforce** (14 módulos, datos reales de estudiantes menores de edad).
>
> **Objetivo:** operar el producto 100% dentro de la infraestructura propia de Activa Reforce, en un monorepo único **`PVCAR`**, con backend real, autenticación segura, y ambientes dev/prod separados — sin perder un solo dato y sin que los usuarios finales noten el cambio.

---

## 1. Alcance

**Se construye:**
- Un repositorio único `activareforce/PVCAR` → monorepo con `/backend` y `/frontend`.
- Backend Node + Express + TypeScript en **Railway** (2 ambientes: `production`←`main`, `development`←`dev`).
- Frontend Vite + React + TS en **Vercel** (Production←`main` con dominio propio, Preview←`dev` en `*.vercel.app`).
- Dos proyectos **Supabase** en la cuenta de Activa Reforce: `PVCAR-prod` y `PVCAR-dev`.
- Autenticación con **Supabase Auth** (hoy los passwords están en texto plano).
- **RLS activo desde el día 1** en ambas DB nuevas.

**Se elimina al final (Fase 16):** todo rastro de Activa Reforce en la cuenta **Flowward** — repos GitHub, proyecto Vercel, proyectos Supabase, tokens y claves.

**Estrategia elegida:** *congelar y cortar al final*. El sistema viejo sigue vivo e intacto en Flowward durante toda la construcción. Un único cutover mueve datos + dominio. Rollback = re-apuntar el dominio.

---

## 1.1 Diagnóstico verificado del sistema vivo (2026-07-27, solo lectura)

**Supabase prod `wfyytrdhqtspapxaikoh`** (sa-east-1, PostgreSQL 15.8) — 35 tablas en `public`.

| Tabla | Filas | | Tabla | Filas |
|---|---|---|---|---|
| asistencia_nino | 13.202 | | evaluacion_asignacion | 72 |
| nino_asignacion | 1.672 | | usuario_rol | 66 |
| asistencia_entrenador | 1.726 | | entrenador | 49 |
| evaluacion_nino_pendiente | 1.261 | | actividad | 19 |
| nino | 796 | | categoria_nino_grado | 13 |
| asistencia_auxiliar | 283 | | colegio | 7 / rol 7 / dia 7 |
| entrenador_asignacion | 119 | | evaluacion 5, parámetros 5 |
| rol_permiso | 97 | | encuestas: **todas en 0** |
| colegio_actividad_horario | 94 | | nino_padre / padre: **0** |
| usuario | 68 (50 activos, 18 inactivos) | | evaluacion_tiempo_rangos: **0** |

Manifiesto completo: `Backup_bd/conteos_prod_2026-07-27.txt`. **Es la referencia de verificación del cutover.**

**Autenticación (confirmado):**
- `auth.users` tiene **0 registros** → Supabase Auth nunca se usó.
- `usuario.usu_contrasena text NOT NULL` con las claves **en texto plano**: 0 de 68 tienen formato bcrypt.
- 68 correos, **0 duplicados** (ni ignorando mayúsculas). ✅
- **1 correo con formato inválido** → hay que corregirlo antes del cutover.
- Longitud de contraseñas: mín. 4, máx. 19. **7 usuarios tienen menos de 6 caracteres** → Supabase Auth exige mínimo 6. Ver Anexo A.
- 2 contraseñas contienen caracteres no-ASCII (tildes/ñ). No bloquea, pero se prueban explícitamente.

**Seguridad:**
- RLS activo en **1 de 35 tablas** (`rol_permiso`, sin `FORCE`, 1 política). Las otras 34 están abiertas a cualquiera que tenga la anon key, que está embebida en el bundle del navegador.
- Bucket `usufoto`: **público**, 61 objetos (fotos de personas, incluidos menores).
- Roles con `BYPASSRLS = true`: `postgres`, `service_role`, `supabase_admin`. → **Activar RLS no rompe al backend nuevo**, que usa service-role. Confirmado contra el servidor, no supuesto.

**Almacenamiento:** el dump completo pesa 0,5 MB comprimido. La migración de datos del cutover es de minutos, no de horas.

---

## 2. Arquitectura objetivo

```
                     GitHub: activareforce/PVCAR  (main | dev)
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        │ /frontend                                    /backend │
        ▼                                                       ▼
┌────────────────────┐        HTTPS + JWT        ┌──────────────────────┐
│  Vercel            │ ────────────────────────▶ │  Railway             │
│  Production ← main │ ◀──────────────────────── │  production ← main   │
│   (dominio propio) │           JSON            │  development ← dev   │
│  Preview    ← dev  │                           └──────────┬───────────┘
│   (*.vercel.app)   │                                      │ service-role
└─────────┬──────────┘                                      │ + pg pool
          │ anon key SOLO para Supabase Auth                 ▼
          └──────────────────────────────────▶ ┌──────────────────────────┐
                                               │ Supabase (cta. Activa)   │
                                               │  PVCAR-prod  ← Railway   │
                                               │  PVCAR-dev   ←  prod/dev │
                                               │  Postgres+Auth+Storage   │
                                               └──────────────────────────┘
```

**Reglas de oro (no negociables):**
1. `SUPABASE_SERVICE_ROLE_KEY` y `DATABASE_URL` viven **solo** en variables de entorno de Railway. Nunca en el front, nunca en git.
2. El frontend usa Supabase **únicamente** para login/sesión (anon key, que es pública por diseño). Todo dato pasa por el API.
3. Toda lógica de negocio (scoring, transiciones de rol, agregaciones, permisos) vive en el backend.
4. Ningún endpoint sin validación `zod` y sin chequeo de permisos.
5. Cada cambio de schema es una migración versionada en `/db/migrations`. Nada de cambios a mano en el dashboard.

---

## 3. Convenciones

**Branching:** `main` (protegida, = producción) ← PR desde `dev` ← PRs de features. CI obligatorio (lint + typecheck + build + tests) para mergear.

**Layout del monorepo:**
```
PVCAR/
├── backend/          Express + TS      (Railway root dir)
│   └── src/
│       ├── config/       env, cliente supabase admin, pool pg
│       ├── middleware/   auth, permisos, validación, errores
│       ├── modules/      un folder por módulo: routes + controller + service
│       ├── lib/          scoring, timezone, paginación
│       └── app.ts  server.ts
├── frontend/         Vite + React + TS (Vercel root dir)
│   └── src/          components, pages, hooks, contexts, lib/api.ts
├── db/
│   ├── migrations/   SQL versionado (fuente de verdad del schema)
│   ├── seed/         datos mínimos para dev
│   └── scripts/      dump, restore, backfill de auth, copia de storage
├── docs/             Plan.md, API.md, RUNBOOK-cutover.md
├── .github/workflows/ci.yml
└── package.json      npm workspaces
```

**API:** REST, prefijo `/api/v1`, respuestas `{ data, error }`, paginación `?page&limit`, errores con código HTTP correcto.

**Variables de entorno:**

| Ambiente | Dónde | Variables |
|---|---|---|
| Backend prod | Railway `production` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (→ PVCAR-prod), `FRONTEND_ORIGIN` (dominio propio), `NODE_ENV=production` |
| Backend dev | Railway `development` | Las mismas → **PVCAR-dev**, `FRONTEND_ORIGIN` (*.vercel.app + localhost) |
| Front prod | Vercel Production | `VITE_API_URL` (Railway prod), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (→ PVCAR-prod) |
| Front dev | Vercel Preview | Las mismas → PVCAR-dev / Railway dev |
| Local | `.env` (gitignored) | copiadas de `.env.example` |

Secretos reales: **solo en gestor de contraseñas + dashboards**. Ningún `.txt` suelto en disco.

---

## 4. Fases

### Fase 0 — Cuentas, herramientas y respaldo

**Cuentas nuevas** (todas con el correo corporativo de Activa Reforce, 2FA activo, códigos de recuperación al gestor de contraseñas):
- [x] GitHub, Supabase, Railway y Vercel creadas por el cliente.
- [x] `gh` autenticado en la cuenta **ActivaReforce** (verificado con `gh auth status`).
- [ ] Verificar `supabase`, `railway` y `vercel` (los ejecuta el cliente; Claude solo guía).
- Pendiente de plan: Railway Hobby ~$5/mes para 2 ambientes; Vercel Hobby prohíbe uso comercial → Pro para el dominio propio.

**Datos recopilados:**
- [x] Dominio de producción: **`activareforce.com`**, DNS administrado en **Cloudflare** por el cliente. El cutover es un cambio de registros con TTL bajo, reversible en segundos.
- [x] Repos `flowward/ActivaReforce_Front` y `_Back` **eliminados** (eran duplicado y scaffold; nada dependía de ellos).

**Herramientas locales** (hay node 24, git y PostgreSQL 17.4 en `C:\Program Files\PostgreSQL\17\bin` — sin PATH; falta todo lo demás):
```powershell
winget install --id GitHub.cli
npm i -g @railway/cli vercel supabase
# añadir al PATH del usuario: C:\Program Files\PostgreSQL\17\bin
```
- [x] `gh auth login` con la cuenta **ActivaReforce** (`pvcar-activareforce@hotmail.com`).

**Respaldo del sistema vivo (crítico, antes de tocar nada):**
- [x] Respaldo fresco en `Backup_bd/` (2026-07-27): `prod_full_2026-07-27.dump` (custom, 0,5 MB), `prod_schema_public_2026-07-27.sql` (64 KB) y `prod_data_public_2026-07-27.sql` (1,1 MB).
- [x] Manifiesto de conteos por tabla: `conteos_prod_2026-07-27.txt`.
- [x] Inventario del bucket `usufoto`: **61 objetos**, bucket público.
- [ ] Verificar que el dump **restaura**. Se hará al cargar el baseline en `PVCAR-dev` (Fase 2) — es mejor prueba que una DB local.

**Test de fase:** los 4 CLIs autenticados en las cuentas nuevas; el schema del dump se aplica limpio en `PVCAR-dev`.

---

### Fase 1 — Monorepo PVCAR

1. [x] Repo `ActivaReforce/PVCAR` privado con `main` y `dev`. ⚠️ **`main` sin proteger:** la protección de ramas en repos privados exige GitHub Pro (403 de la API). Decisión pendiente: pagar Pro, hacer el repo público, o trabajar por disciplina (nunca push directo a `main`).
2. [x] Estructura de carpetas de la sección 3 + `package.json` raíz con npm workspaces.
3. [x] `/frontend`: SPA importada **sin historia de Lovable**; `integrations/supabase/client.ts` lee `import.meta.env`; `src/lib/api.ts` (fetch tipado, JWT de sesión, logout en 401); `vercel.json` con rewrites SPA. Puerto de dev movido a 5173 para no chocar con el backend.
4. [x] `/backend`: Express + TS con `config/env.ts` (zod), supabase admin lazy, pool `pg` lazy, middlewares de auth/permisos/errores, CORS multi-origen, rate limit y `GET /api/v1/health` (verificado en local: `{"status":"ok","db":"not_configured"}`). `railway.json` con healthcheck.
5. [x] `.gitignore` estricto, `.env.example` en ambos paquetes, `README.md`, `docs/Plan.md`.
6. [x] `.github/workflows/ci.yml`: lint + typecheck + build + test, más un job `secrets-scan` que bloquea JWTs y connection strings en el diff. **CI verde en `main` y `dev`.**

**Deuda heredada de la SPA (documentada en el código, no se arrastra en silencio):**
- `@typescript-eslint/no-explicit-any` en `warn`: ~210 usos, casi todos en el código que habla directo con Supabase y que muere en las fases 6–14. Sube a `error` cuando el conteo llegue a 0.
- 11 tests de estudiantes en `describe.skip`: sus mocks de Supabase estaban desfasados de las queries reales y **nunca corrieron en CI** (al repo original le faltaba `@vitejs/plugin-react`). Se reescriben en la Fase 10, contra el API.
- Bundle único de 2,2 MB (625 KB gzip) sin code-splitting. Se ataca en la Fase 15.

**Test de fase:** ✅ `npm install` + `npm run typecheck/lint/build/test` limpios en la raíz; `/api/v1/health` responde en local; CI verde en ambas ramas.

---

### Fase 2 — Base de datos nueva (schema, sin datos)

> Las DB nuevas nacen **vacías y correctas**. Los datos reales entran una sola vez, en el cutover.

1. [x] Proyectos Supabase creados por el cliente: **`PVCAR`** (prod) y **`PVCAR_Dev`** (dev), ambos vacíos.
2. [ ] Extraer el **schema puro** de la prod actual (`pg_dump --schema-only --no-owner --no-privileges`) y convertirlo en la migración inicial `db/migrations/0001_baseline.sql` (26 tablas, RPCs `set_role_permissions`, `delete_student_evaluation`, `reactivate_nino_asignacion`, y el trigger de `eva_puntaje_total`).
3. [ ] **Correcciones de diseño en el baseline** (posibles porque la DB está vacía):
   - `usuario.auth_user_id uuid UNIQUE` (nullable) + `CHECK (est_id <> 1 OR auth_user_id IS NOT NULL)` → todo usuario **activo** debe tener cuenta en Supabase Auth; los 18 inactivos no consumen una cuenta hasta que se reactiven.
   - **Sin** columna `usu_contrasena`. Los passwords los gestiona Supabase Auth.
   - Índices faltantes en FKs y en las columnas de filtro de reportes.
   - `usu_correo`: `CITEXT` o índice único sobre `lower(trim(usu_correo))` — Supabase Auth normaliza el correo a minúsculas y hay que evitar divergencia.
4. [ ] `0002_rls.sql`: `ENABLE ROW LEVEL SECURITY` + `FORCE` en **todas** las tablas, con políticas deny-by-default. El backend usa service-role (bypasea RLS); la anon key queda inservible para datos. Esto cierra desde el inicio el agujero que tiene el sistema viejo.
5. [ ] `0003_storage.sql`: bucket `usufoto` **privado**; acceso solo por URL firmada emitida por el backend.
6. [ ] Aplicar migraciones a **dev** y a **prod** (ambas vacías). `db/seed/` con datos mínimos para desarrollar (roles, permisos, 1 colegio, 1 usuario admin de prueba).

**Test de fase:** `psql` lista 26 tablas en ambos proyectos; `SELECT relrowsecurity` = true en todas; el seed carga en dev sin violar constraints.

---

### Fase 3 — Backend base + Railway (2 ambientes)

1. [ ] `config/env.ts` que valida las env vars con zod al arrancar (falla rápido si falta una).
2. [ ] Cliente `supabase-js` admin (service-role) + pool `pg` para transacciones y agregaciones.
3. [ ] Middlewares: `helmet`, `cors` restringido a `FRONTEND_ORIGIN`, JSON parser, logger, rate limit, error handler centralizado (nunca filtra stack traces).
4. [ ] `middleware/auth.ts`: valida el `Authorization: Bearer` con `supabase.auth.getUser(token)`, resuelve el `usuario` por `auth_user_id`, carga roles + permisos en `req.user`.
5. [ ] `middleware/requirePermission(modulo, accion)`: valida contra `rol_permiso`.
6. [ ] `GET /api/v1/health` → estado del proceso + ping a la DB.
7. [ ] Railway: proyecto `PVCAR`, servicio con root dir `/backend` y watch path `backend/**`; ambiente `production`←`main` (→PVCAR-prod) y `development`←`dev` (→PVCAR-dev); env vars cargadas en cada uno.

**Test de fase:** `/health` responde `db:"ok"` en las dos URLs de Railway, cada una contra su propia DB.

---

### Fase 4 — Frontend base + Vercel

1. [ ] Proyecto Vercel con root dir `/frontend`, Production branch `main`, deploy de `dev` como Preview fijo.
2. [ ] Env vars por ambiente; build de producción sin ninguna clave hardcodeada (verificar el bundle).
3. [ ] `lib/api.ts`: fetch tipado, inyecta el JWT de sesión, maneja 401 → logout, normaliza errores.
4. [ ] El dominio propio **no se toca todavía** — sigue apuntando al sistema viejo hasta la Fase 15.

**Test de fase:** la URL `*.vercel.app` de dev carga la SPA y consume `/health` del Railway de dev.

---

### Fase 5 — Autenticación (Supabase Auth)

1. [ ] Backend: `/api/v1/auth/*` (login, refresh, logout delegados a Supabase Auth) y `/api/v1/me` → usuario + roles + permisos desde el JWT.
2. [ ] Frontend: reescribir `AuthContext` con `supabase.auth.signInWithPassword`; sesión gestionada por Supabase (fuera el blob manual en localStorage); `ProtectedRoute` y `usePermissions` consumen `/me`.
3. [ ] Endpoints de reset de password y cambio de password.
4. [ ] `db/scripts/backfill-auth.ts`: script **idempotente** que siembra las cuentas de Supabase Auth con la contraseña actual de cada usuario. Mecánica completa, casos borde y tareas previas en el **Anexo A**.

**Test de fase:** en dev, login/logout/refresh/reset funcionan y los permisos por rol son correctos.

---

### Fases 6–14 — Módulos, uno a la vez

> **Patrón por módulo:** endpoints REST en `/backend/modules/<modulo>` (zod + permisos) → mover la lógica de negocio del front al back → reemplazar `supabase.from(...)` por llamadas al API vía react-query → pruebas CRUD en dev → checklist de paridad contra el sistema viejo → PR a `dev`.

| Fase | Módulo | Tablas | Lo que se arregla |
|---|---|---|---|
| 6 | Usuarios, Roles, Permisos, Perfil | `usuario`, `rol`, `usuario_rol`, `rol_permiso` | Transiciones de rol multi-tabla → **transacción SQL** en el backend |
| 7 | Colegios | `colegio`, `colegio_coordinador`, `colegio_actividad_horario`, `dia` | CRUD + coordinadores + horarios |
| 8 | Actividades y Disciplinas | `actividad`, `categoria`, `colegio_actividad_horario` | — |
| 9 | Entrenadores | `entrenador`, `entrenador_asignacion`, `entrenador_auxiliar` | Asignaciones y auxiliares |
| 10 | Estudiantes | `nino`, `nino_asignacion`, `nino_padre`, `padre`, `categoria_nino_grado` | Filtrado por alcance (entrenador ve solo lo suyo) → **al backend** |
| 11 | Asistencias | `asistencia_nino`, `asistencia_entrenador`, `asistencia_auxiliar`, `asistencia_estado` | Zona horaria centralizada en backend; upserts con constraints contra concurrencia |
| 12 | Evaluaciones | `evaluacion*` (7 tablas) | **Scoring Mobak y por tiempo movidos al backend**; respetar el trigger de `eva_puntaje_total` |
| 13 | Encuestas | `encuesta*` (5 tablas) | Encuestas obligatorias a padres + exportación |
| 14 | Dashboard y Reportes | agregaciones | Agregaciones en SQL con filtros de fecha (hoy el cliente descarga todo el histórico); export xlsx generado en backend |

**Transversal:** Storage `usufoto` — el backend emite URLs firmadas de subida/lectura; el front nunca toca el bucket directo.

**Test de cada fase:** paridad funcional verificada contra el sistema viejo, módulo por módulo, en dev.

---

### Fase 15 — Endurecimiento y QA

- [ ] Rate limiting y validación zod en el 100% de los endpoints.
- [ ] CORS solo al dominio propio en producción.
- [ ] Auditoría: ninguna respuesta expone datos de menores fuera del alcance del rol.
- [ ] Tests e2e por módulo + prueba de carga en dev.
- [ ] Revisión de las políticas RLS y de los permisos del bucket.
- [ ] Revisar el bundle de producción: cero secretos.

---

### Fase 16 — Cutover (ventana única, `docs/RUNBOOK-cutover.md`)

> Se ejecuta en horario de bajo uso, con aviso previo a los usuarios. Todo el runbook debe estar **ensayado en dev** antes.

1. [ ] Aviso a usuarios + ventana de mantenimiento.
2. [ ] **Congelar escrituras** en el sistema viejo (página de mantenimiento en el Vercel viejo).
3. [ ] `pg_dump` final **data-only** de la prod vieja. Verificar conteos por tabla.
4. [ ] Cargar los datos en `PVCAR-prod` (schema ya migrado), en orden de dependencias; `setval` de todas las secuencias; `VACUUM ANALYZE`.
5. [ ] Correr `backfill-auth.ts` (**Anexo A**): crea las cuentas en Supabase Auth sembrando la contraseña actual de cada quien y llena `auth_user_id`. Revisar el reporte antes de continuar: debe cerrar en 50/50 usuarios activos.
6. [ ] Copiar los objetos del bucket `usufoto` al proyecto nuevo.
7. [ ] **Verificación:** conteo por tabla viejo vs nuevo, y muestreo de registros críticos (evaluaciones, asistencias del último mes).
8. [ ] Deploy final: Railway `production` + Vercel Production desde `main`.
9. [ ] **Dominio:** quitar el dominio del proyecto Vercel viejo → añadirlo al proyecto nuevo → actualizar los registros en el DNS → esperar propagación → verificar HTTPS.
10. [ ] Smoke tests con usuarios reales de cada rol; monitoreo intensivo 48 h.
11. [ ] **Rollback:** re-apuntar el dominio al proyecto viejo (sigue intacto y con su DB intacta). Válido **mientras no haya escrituras nuevas** en la DB nueva; pasado ese punto, un rollback exige dump inverso. Definir y comunicar el punto de no retorno.

---

### Fase 17 — Desmantelar Flowward

> Solo después de N días estables post-cutover, y con todos los dumps archivados en frío.

- [ ] Archivar copia final de la DB vieja y del bucket viejo (almacenamiento externo, cifrado).
- [ ] Borrar repos `flowward/activa-forge-login`, `flowward/ActivaReforce_Front`, `flowward/ActivaReforce_Back`.
- [ ] Borrar el proyecto Vercel viejo.
- [ ] Pausar y luego borrar los proyectos Supabase `wfyytrdhqtspapxaikoh` y `fudgahyqcuuifqdzqaul`.
- [ ] **Revocar** el PAT de Supabase de Flowward y toda key vieja (anon y service-role quedan muertas con el proyecto).
- [ ] Limpiar el disco local: borrar duplicados y notas con secretos; el workspace queda fuera de la carpeta `Flowward`.

---

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Pérdida de datos en el cutover | Dump verificado antes; el sistema viejo y su DB quedan intactos; verificación de conteos antes de mover el dominio |
| Passwords en texto plano hoy | Se siembran en Supabase Auth durante el cutover y la columna nunca existe en la DB nueva |
| Correos duplicados o inválidos al crear usuarios de Auth | Reporte de discrepancias en dev con el dump real, resuelto antes de la ventana |
| Dominio: propagación DNS lenta | Bajar el TTL 24 h antes del cutover; verificar antes de levantar el mantenimiento |
| Divergencia funcional viejo vs nuevo | Checklist de paridad por módulo, obligatorio para cerrar cada fase |
| Free tier de Supabase sin backups automáticos | Script de `pg_dump` programado + evaluar Pro antes de que la DB nueva tenga datos reales |
| Secretos filtrados | Solo en dashboards y gestor de contraseñas; `.env` en `.gitignore`; CI que bloquea secretos en el diff |
| Datos de menores en dev | La DB de dev nace **vacía**: solo schema + seed sintético |

---

## 6. Seguimiento

- [x] Fase 0 — Cuentas, herramientas y respaldo
- [x] Fase 1 — Monorepo PVCAR *(salvo protección de `main`, bloqueada por el plan de GitHub)*
- [ ] Fase 2 — DB nueva (schema, sin datos) — proyectos creados, faltan las migraciones
- [ ] Fase 3 — Backend base + Railway
- [ ] Fase 4 — Frontend base + Vercel
- [ ] Fase 5 — Autenticación
- [ ] Fase 6 — Usuarios/Roles/Permisos/Perfil
- [ ] Fase 7 — Colegios
- [ ] Fase 8 — Actividades/Disciplinas
- [ ] Fase 9 — Entrenadores
- [ ] Fase 10 — Estudiantes
- [ ] Fase 11 — Asistencias
- [ ] Fase 12 — Evaluaciones
- [ ] Fase 13 — Encuestas
- [ ] Fase 14 — Dashboard y Reportes
- [ ] Fase 15 — Endurecimiento y QA
- [ ] Fase 16 — Cutover
- [ ] Fase 17 — Desmantelar Flowward

---

# Anexo A — Migración de autenticación sin que el usuario lo note

## A.1 El problema

Hoy no existe autenticación real: el login lee la tabla `usuario` y compara `usu_contrasena` **en texto plano**. `auth.users` está vacío. Cualquiera con la anon key (que va embebida en el bundle del navegador) puede leer las 68 contraseñas.

El objetivo: que el día del cutover cada persona entre con **el mismo correo y la misma contraseña de siempre**, sin correo de verificación, sin reset, sin aviso.

## A.2 Por qué se puede hacer sin fricción

Precisamente porque las contraseñas están en texto plano, se pueden **sembrar** en Supabase Auth. Supabase las hashea con bcrypt al recibirlas:

```ts
await admin.auth.admin.createUser({
  email: correoNormalizado,          // lower(trim(usu_correo))
  password: usu_contrasena,          // la de siempre, en claro, viaja por TLS
  email_confirm: true,               // clave: NO envía correo de verificación
  user_metadata: { usu_id }          // trazabilidad con la tabla de dominio
})
// → guardar data.user.id en usuario.auth_user_id
```

`email_confirm: true` es lo que hace la migración invisible: la cuenta nace confirmada y nadie recibe nada en su bandeja. Si esto se omitiera, 50 personas recibirían un correo de verificación el día del cutover y el cambio sería evidente.

**El texto plano muere ahí:** la columna `usu_contrasena` no existe en el schema nuevo. Después del cutover, la única copia es el hash bcrypt dentro de `auth.users`.

## A.3 Casos borde reales (medidos en prod, no supuestos)

| Hallazgo | Cantidad | Qué se hace |
|---|---|---|
| Correos duplicados | **0** | Nada. Supabase Auth exige correo único y aquí no hay conflicto. |
| Contraseñas ya hasheadas | **0** | Todas son texto plano → todas se pueden sembrar. |
| **Contraseñas de menos de 6 caracteres** | **7** | Supabase Auth **rechaza** menos de 6. Ver A.4. |
| Correo con formato inválido | **1** | Corregirlo en el sistema viejo antes del cutover. Sin corregir, esa persona no podrá entrar. |
| Contraseñas con tildes/ñ | 2 | Funcionan (UTF-8), pero se prueban explícitamente en dev. |
| Usuarios inactivos | 18 | **No** se crean en Auth. Se les crea la cuenta si algún día se reactivan. Por eso `auth_user_id` es nullable con `CHECK`. |

## A.4 Las 7 contraseñas cortas — decisión

Tres caminos:

- **(a) Campaña previa (recomendado).** Semanas antes del cutover, pedirle a esas 7 personas que cambien su clave en el sistema **viejo** por una de 6+ caracteres. Cuando llega el cutover ya no hay caso borde y el día D nadie nota nada. Sin cambios de código.
- (b) Sembrar clave temporal y forzar reset por correo. Rompe la promesa de "no se nota" para esas 7 personas.
- (c) Bajar el mínimo de Supabase. Se descarta: debilita a los 68 para acomodar a 7.

Se toma **(a)**. Si el día del cutover alguna sigue corta, cae automáticamente en (b) y el script lo reporta.

## A.5 El script `backfill-auth.ts`

Requisitos: **idempotente** (se puede correr N veces sin duplicar), **transaccional por usuario**, y con **reporte** antes de que nadie dependa de él.

1. Lee de la DB nueva los usuarios con `est_id = 1` y `auth_user_id IS NULL`.
2. Lee la contraseña desde el dump de la tabla vieja (nunca se copia `usu_contrasena` a la DB nueva).
3. Valida: correo con formato correcto, contraseña de 6+ caracteres. Lo que no valida, va al reporte y **no se intenta**.
4. `createUser(...)` con `email_confirm: true`. Si el correo ya existe en Auth (reintento), lo busca y reusa su id en vez de fallar.
5. Escribe `auth_user_id`. Si esa escritura falla, borra la cuenta de Auth recién creada → sin huérfanos.
6. Pausa corta entre llamadas (rate limits de la Admin API).
7. Al terminar imprime: creados / reusados / omitidos con motivo. **El cutover no avanza hasta que el reporte cierre en 50/50.**

Se ensaya completo en `PVCAR-dev` con los datos del dump antes de la ventana real.

## A.6 Verificación antes de mover el dominio

- [ ] `select count(*) from auth.users` = usuarios activos migrados.
- [ ] `select count(*) from usuario where est_id=1 and auth_user_id is null` = **0**.
- [ ] Login real probado con una cuenta de cada rol (Admin, Coordinador, Entrenador, Padre) usando su contraseña de siempre.
- [ ] Login probado con una de las contraseñas con tildes.
- [ ] Reset de contraseña por correo funciona (plantilla de correo configurada con el dominio de Activa Reforce).
- [ ] La columna `usu_contrasena` **no existe** en la DB nueva.

## A.7 Qué gana el usuario final (además de no notar nada)

Hashing bcrypt, sesiones con refresh token, "olvidé mi contraseña" que sí funciona, y la posibilidad de MFA más adelante. Todo gratis con Supabase Auth.

---

# Anexo B — RLS desde el día 1

## B.1 Situación actual

De 35 tablas en `public`, **34 no tienen RLS**. La única que lo tiene (`rol_permiso`) está sin `FORCE`. La anon key vive dentro del JavaScript que descarga cualquier visitante: hoy, con esa key, se pueden leer y escribir los datos de 796 estudiantes menores de edad. El bucket `usufoto` es público, con 61 fotos.

Esto **no se puede arreglar en el sistema viejo**: la SPA depende de esa key sin restricciones. Activar RLS ahí lo rompería.

## B.2 Por qué en PVCAR sí, desde el primer día

Verificado contra el servidor: los roles `postgres` y `service_role` tienen `BYPASSRLS = true`. El backend se conecta con service-role → **RLS activo no le afecta**. Y el frontend nuevo usa la anon key **solo** para el login. Entonces:

- `0002_rls.sql`: `ENABLE` + `FORCE ROW LEVEL SECURITY` en las 35 tablas, y **cero políticas para `anon`/`authenticated`**. Deny-by-default: con la anon key en la mano no se lee ni una fila.
- El único camino a los datos es el API, que valida JWT + permisos por rol.
- `0003_storage.sql`: bucket `usufoto` **privado**; el acceso es por URL firmada de corta vida emitida por el backend.

## B.3 Verificación (obligatoria al cerrar la Fase 2)

- [ ] `select count(*) from pg_class ... where relrowsecurity and relforcerowsecurity` = 35.
- [ ] Con la **anon key**, un `select` a `nino` devuelve **0 filas** (no error: 0 filas — así se comporta deny-by-default).
- [ ] Con la **service-role key**, el mismo `select` funciona.
- [ ] La URL pública directa de un objeto de `usufoto` devuelve **403**.

---

# Estado y siguiente paso

**Fecha de corte de este documento: 2026-07-28.**

Completado: diagnóstico verificado (sección 1.1), respaldo fresco de prod, herramientas locales instaladas, limpieza del workspace, repos duplicados de Flowward eliminados, **Fase 1 cerrada** (monorepo `ActivaReforce/PVCAR` con CI verde en `main` y `dev`), y los dos proyectos Supabase (`PVCAR`, `PVCAR_Dev`) creados y vacíos.

**Reparto de trabajo:** las acciones en Vercel, Railway y Supabase las ejecuta el cliente; Claude entrega los pasos e inspecciona Supabase en solo lectura. El código, el repo y los archivos locales los hace Claude.

**Workspace local:** `C:\Users\Administrador\Documents\Flowward\Activa Reforce PVCAR`
- `PVCAR/` — monorepo nuevo (clon de trabajo, remoto `ActivaReforce/PVCAR`).
- `activa-forge-login/` — SPA viva en producción. **No se toca hasta la Fase 17.**
- `Backup_bd/` — respaldos y manifiesto de conteos.
- `_ref/` — material de partida ya consumido por la Fase 1.
- `Cosas/` — contrato, RUC, assets de marca.

**Siguiente paso concreto (Fase 2):** extraer el schema puro de la prod vieja (solo lectura) y convertirlo en `db/migrations/0001_baseline.sql` con las correcciones de diseño, más `0002_rls.sql` y `0003_storage.sql`. El cliente los aplica en `PVCAR_Dev` primero y luego en `PVCAR`.

**Decisiones abiertas:**
- **Región de los proyectos Supabase:** ya están creados; confirmar en qué región quedaron. Prod vieja está en `sa-east-1` (São Paulo); desde Ecuador `us-east-1` suele dar menos latencia.
- **Protección de `main`:** requiere GitHub Pro en repos privados. Pagar Pro, o trabajar por disciplina (PR desde `dev`, nunca push directo).
