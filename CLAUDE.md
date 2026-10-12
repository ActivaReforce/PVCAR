# Contexto del workspace — Activa Reforce / PVCAR

> **Vive en el repo** (raíz de `ActivaReforce/PVCAR`) para poder seguir desde otro equipo. Se borra del repo al cerrar el proyecto (Fase 17). Las rutas `PVCAR/...` son la raíz de este repo; `SQL/`, `Bitacora.md`, `Cosas/`, `Contratos/` y `.mcp.json` son de la carpeta de trabajo y no están aquí. En otro equipo hay que recrear `.mcp.json` (dos servidores Supabase `--read-only`) y los `.env`, que nunca se suben.

**Lee `PVCAR/Roadmap.md` antes de proponer o ejecutar cualquier cosa** (el `Roadmap.md` de la raíz es solo un aviso). Es el documento maestro: estado de cada fase, reglas transversales, especificación funcional de cada módulo y anexos de RLS e infraestructura. El historial de sesiones viejas está en `Bitacora.md`.

## Qué es esto

La plataforma de gestión deportiva escolar de Activa Reforce: monorepo `ActivaReforce/PVCAR` (`backend/` en Railway, `frontend/` en Vercel) contra dos proyectos Supabase (`PVCAR` para prod, `PVCAR_Dev` para dev). **En producción en `activareforce.com` desde el 2026-10-12**, con datos reales que va cargando el cliente.

La plataforma anterior se dio de baja el 2026-10-12: no queda nada de ella (ni base, ni hosting, ni repo, ni respaldo) salvo los datos del esquema **`archivo`**, en solo lectura, para Reportes → "Data anterior".

## Reparto de trabajo

Los dashboards de **Vercel, Railway, Supabase y Cloudflare los opera el cliente**; Claude entrega los pasos concretos e inspecciona en solo lectura. El código, el repo y los archivos locales los hace Claude.

## Reglas duras

1. **Nunca escribir en ninguna Supabase.** Todo MCP de Supabase va `--read-only` y así se queda; las consultas con `psql` también. Los cambios de schema los aplica el cliente a mano desde `SQL/`. `.mcp.json` tiene dos servidores, los dos `--read-only` y con `--project-ref` fijo: `pvcar_dev` (`vjwlwjqaalppzmycbalw`) y `pvcar_prod` (`dahsgmpubbofrefvseir`). Las banderas no se tocan.
2. **Ningún secreto en disco fuera de `.env` gitignoreados ni en el repo.** No crear archivos de notas con keys. El `service_role` y `DATABASE_URL` viven solo en variables de entorno de Railway. **Excepción decidida por el cliente (2026-07-29):** los dos PAT de Supabase van en texto plano en `.mcp.json` de la raíz del workspace, que no es repo git. Riesgo asumido, se rotan en la Fase 17. No reabrir.
3. **Cada cambio de schema es una migración versionada** en `PVCAR/db/migrations`. Nada de cambios a mano en el dashboard de Supabase.
4. **Prod tiene datos reales y no hay respaldo automático** (plan gratuito de Supabase). Antes de cualquier operación destructiva sobre prod: respaldo fresco verificado. Montar el respaldo de prod está pendiente en la Fase 15.
5. **Fechas y horas siempre en hora de Ecuador** (`America/Guayaquil`, UTC-5, sin horario de verano). La base y Railway están en UTC; todo lo que se guarda, filtra, compara o enseña se piensa en hora de Ecuador. Toda fecha nueva pasa por `lib/fecha.ts` (backend: `HOY_EC`, `diaEc()`, `textoEc()`; frontend: `hoyEc()`, `fechaDia()`). Prohibido `CURRENT_DATE`, `marca::date`, `to_char(timestamptz)` sin zona y `new Date().toISOString()` para "hoy". Al revisar o construir cualquier cosa con fechas, comprobar qué pasa de 19:00 a 23:59 en Ecuador, cuando UTC ya es mañana.

## Mapa del workspace

| Carpeta | Qué es |
|---|---|
| `PVCAR/` | Clon de trabajo del monorepo (remoto `ActivaReforce/PVCAR`). Aquí se trabaja. |
| `PVCAR/Roadmap.md` | Documento maestro. Fuente de verdad. |
| `Bitacora.md` | Archivo histórico: cómo se cerró cada fase 0–5 y los cortes de sesión viejos. |
| `SQL/` | **Canal de entrega:** archivos que el cliente ejecuta a mano en el SQL Editor de Supabase, con `ORDEN.md`. Copia de `PVCAR/db/migrations/`, que es la fuente de verdad. Si se cambia la migración, hay que recopiarla. |
| `Cosas/`, `Contratos/` | Contrato, RUC, assets de marca, documentos de inscripción. |

## Infraestructura desplegada

| Pieza | URL | Rama | Supabase |
|---|---|---|---|
| Railway `production` | `pvcarbackend-production.up.railway.app` | `main` | `PVCAR` |
| Railway `development` | `pvcarbackend-development.up.railway.app` | `dev` | `PVCAR_Dev` |
| Vercel Production | `activareforce.com` (`www` redirige a la raíz) | `main` | `PVCAR` |
| Vercel Preview | `dev-pvcar.vercel.app` | `dev` | `PVCAR_Dev` |

DNS en Cloudflare. `FRONTEND_ORIGIN` de `production` = `https://activareforce.com` (el primero de la lista es el origen canónico de los enlaces de correo). Site URL y Redirect URL (`/reset-password`) de Supabase `PVCAR` apuntan al mismo dominio.

Flujo de trabajo: commit a `dev` → CI → preview en Vercel y deploy en Railway `development`. A `main` solo por PR (rama protegida, checks `check` y `secrets-scan`).

**Quién mergea:** `main` no exige revisión de nadie y `gh` está autenticado como ActivaReforce. Claude **sí puede** abrir el PR y mergear con `gh pr merge`; no lo hace sin que el cliente lo pida. Cuando diga "sube a dev" o "mergea a main", se hace entero — nada de devolverle pasos manuales de GitHub. Antes de mergear, comprobar por MCP que el SQL que trae el PR ya está en prod.

**Pantalla temporal en prod:** `/novedades` enseña "En desarrollo" en producción (`NovedadesEnDesarrollo.tsx`, elegida en `App.tsx` por el `VITE_API_URL` de producción) hasta que el cliente apruebe Novedades en `dev`. Al aprobarlo se borran las dos cosas.

Trampas de configuración que ya costaron tiempo:
- **Railway root dir = raíz del repo**, no `backend/` (el `package-lock.json` vive en la raíz por npm workspaces). `railway.json` está en la raíz.
- **Vercel root dir = `frontend`**, al revés que Railway. Y Vercel **salta el build** si el commit no toca `frontend/**`: el deployment sale `Canceled` sin logs.
- Las `VITE_*` se hornean en tiempo de build; cambiarlas en el dashboard no hace nada hasta el build siguiente.
- `FRONTEND_ORIGIN` no incluye `localhost` por decisión del cliente: se prueba siempre por push a `dev`, no en local.
- Railway está en **US East (Virginia)** = `us-east4`, junto a Supabase en Ohio. Railway **guarda la región pero no la mueve hasta el siguiente deploy**; se comprueba porque el `uptime` de `/health` vuelve a cero.
- **Todas las rutas del backend cuelgan de `/api/v1`.** Un `curl` a `/health` pelado devuelve 404 y parece caída falsa. Es `/api/v1/health`.
- `dev-pvcar.vercel.app` está detrás de Vercel Authentication (302 a `vercel.com/sso-api`): los enlaces de correo hay que abrirlos en el navegador con sesión de Vercel; desde el móvil rebotan.
- Cuando el editor SQL de Supabase pregunte **"Run without RLS" / "Run and enable RLS"** → siempre **Run without RLS**.

## Herramientas disponibles

`gh`, `railway`, `vercel` (scope `pvcar`), `supabase`, `psql`/`pg_dump 17.4` (en `C:\Program Files\PostgreSQL\17\bin`, ya en el PATH de usuario), node 24, git.

**Trampa:** en `gh` la cuenta **activa es una cuenta personal**, sin permiso sobre el repo: `git push` da 403. ActivaReforce también está logueada; se empuja sin cambiar la cuenta activa con `git -c credential.helper= -c 'credential.helper=!f(){ echo username=x-access-token; echo "password=$(gh auth token -u ActivaReforce)"; }; f' push origin dev`, y para `gh` se exporta `GH_TOKEN=$(gh auth token -u ActivaReforce)`.

## Dónde estamos

**Si pregunta "¿en qué nos quedamos?": corte del 2026-10-12 en `Roadmap.md` §1**, con la lista de trabajo numerada. Lo siguiente: que el cliente pruebe Novedades en `dev`, después el punto 9 (aviso automático de ausencia) y el respaldo de prod.

**Bases:** migraciones `0001`–`0027` aplicadas y verificadas por MCP en dev y prod. `0004_seed_dev.sql` (catálogos) también está en prod; lo de prueba que traía ya se quitó. Dev lo usa el cliente para simular; prod tiene datos reales. **No hay SQL pendiente.**

**Decisiones esperando respuesta del cliente:** información de salud en el reporte de Alumnos (`docs/fase13-tablero-reportes.md` §4), Mobak escalado al puntaje del parámetro (`docs/fase12-evaluaciones.md` §4), fechas futuras en asistencia (`docs/fase11-asistencias.md` §4) y flujo de invitación por correo en vez de contraseña puesta por el admin (Resend ya funciona, se puede preguntar).

**Decisiones cerradas, no reabrir:**
- Publicar una encuesta **no** manda correo; le aparece al representante cuando entra.
- Varios roles por usuario; el alcance es la **unión** de todos.
- Borrado permanente junto a la baja lógica, con recuento previo, confirmación escribiendo el nombre y auditoría.
- `padre` guarda también la facturación, que puede ser de otra persona; no se separa.
- Repo público hasta la Fase 17, sin reescribir el historial.

## Cómo trabajar

- **Mapa de módulos** en `PVCAR/docs/mapa-modulos.md`; **permisos** en `PVCAR/docs/permisos.md`; **Inscripciones** en `PVCAR/docs/fase14b-contratos.md` (manda sobre `fase14b-inscripciones.md`); checklist de "terminado" en `PVCAR/docs/checklist-modulos.md`.
- **Alcance por rol** (`Roadmap.md` §8): `colegios` solo lo da el coordinador; el entrenador y sus auxiliares llegan por `disciplinas`; el representante solo por `ninos` / `disciplinasDeHijos`; Encuestas (gestión) e Inscripciones llevan guarda de personal. "Ver" nunca debe ampliar el alcance.
- **Seguridad en Supabase son tres capas:** RLS, privilegios de tabla y ACL de funciones. RLS no protege funciones `SECURITY DEFINER`; lo cierra `0005_grants.sql`. Toda tabla nueva trae su propio `ENABLE` + `FORCE` RLS.
- **Correos:** Supabase Auth manda solo el de recuperar contraseña (plantilla `PVCAR/docs/correos/recuperar-contrasena.html`, SMTP de Resend en prod y dev). Los de Inscripciones y Novedades los manda el backend con Resend según `correo_config`. El admin crea usuarios escribiendo él la contraseña (`email_confirm: true`).
- **Gráficas con la skill `dataviz` y su validador, no a ojo.** La paleta obvia de asistencia (verde/ámbar/azul/rojo) no pasa bajo daltonismo; se usa escala divergente azul↔rojo con gris neutro (`frontend/src/components/graficas/paleta.ts`). Los botones de pasar lista siguen en verde: un control no es una marca de datos.
- **Excel:** hoja Resumen primero, bordes y colores suaves, sin hoja Filtros. Es el estilo aprobado.
- **Cuando algo heredado lleva un comentario diciendo que arregla un problema, comprobar que lo arregla:** en la Fase 7 un "Fix contrast issues in dark mode" era la causa del fallo.
- **Empujar a `dev` sin esperar el SQL:** en cuanto el código esté listo se entrega el `.sql` y se empuja a la vez; él lo corre y lo ve al instante. Solo si no daña nada más.
- **Forma de las respuestas al cliente:** mensajes cortos. Todo SQL que él deba ejecutar va en un `.sql` propio; los `.md` solo llevan plan y orden. No se entregan archivos de verificación: él corre la migración y Claude verifica por MCP. Pruebas: solo lo que Claude **no pudo verificar** (aspecto, uso real en pantalla, móvil, oscuro), corto y numerado; lo verificado se le cuenta en otra lista breve.
- Si no está claro cómo debe funcionar el negocio, preguntarle; si está claro, decidir y seguir sin preguntar. El cliente pidió señalar lo que está mal y mejorarlo, no copiarlo.
