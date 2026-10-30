# Contexto del workspace — Activa Reforce / PVCAR

> **Vive en el repo** (raíz de `ActivaReforce/PVCAR`) para poder seguir desde otro equipo. Se borra del repo al cerrar el proyecto (Fase 17). Las rutas `PVCAR/...` son la raíz de este repo; `SQL/`, `Cosas/`, `Contratos/` y `.mcp.json` son de la carpeta de trabajo y no están aquí. En otro equipo hay que recrear `.mcp.json` (dos servidores Supabase `--read-only`) y los `.env`, que nunca se suben.

**Lee `PVCAR/Roadmap.md` antes de proponer o ejecutar cualquier cosa** (el `Roadmap.md` de la raíz es solo un aviso). Es el documento maestro: estado de cada fase, reglas transversales, especificación funcional de cada módulo y anexos de RLS e infraestructura.

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

**Novedades aprobado por el cliente el 2026-10-12** (puntos 8 y 9) y **en producción desde el PR #16** (2026-10-13), sin la pantalla temporal.

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

**Cursos por disciplina en producción (PR #20, 2026-10-14):** cada disciplina marca sus cursos y la inscripción solo ofrece las del curso elegido.

**2026-10-20 en producción (PR #22):** notas de los hijos para el representante (card Evaluaciones en el tablero + pestaña "Mis hijos" en Evaluaciones con la casilla Ver; endpoint `GET /evaluaciones/mis-hijos`), y la inscripción reintenta sola si se corta la conexión, con `Idempotency-Key` (`lib/unaVez.ts`) para no duplicar; el número rojo de Inscripciones en el menú solo para el Propietario. Railway a veces no recibe el webhook del push: si no aparece despliegue, otro push a `backend/**` lo dispara. **Observaciones extra** por alumno (formulario → ficha de la inscripción con borde ámbar en la lista → `nino_observacion_extra`, editable solo por el Propietario en Estudiantes): `0040` ya aplicada en dev y prod (verificada por MCP).

**2026-10-26 en producción (PR #23, sin SQL):** filtro por colegio en el reporte de Inscripciones (valor y recaudado solo de los hijos de ese colegio) y **Anular inscripción** aprobada, solo Propietario, en `docs/fase14b-contratos.md` §10: borrado definitivo de lo que trajo, baja solo de lo que tiene historia, anuladas en el reporte sin sumar al recaudado. Además: nombre del alumno en su ficha, sin botón "Sin disciplinas", y Asistencias simple (sin resumen ni historial, «← Hoy» arriba a la derecha, una sola barra al pie).

**2026-10-27 en producción (PR #24, sin SQL):** el Excel de Reportes con un colegio elegido daba "Validacion fallida" (el cuerpo manda `colegio` como números); arreglado en `reportes.schemas.ts`.

**2026-10-30 en producción (PR #25, sin SQL, sin Mensualidades):** un entrenador puede dar varias disciplinas a la misma hora; al asignar o al editar horarios sale un aviso del cruce y se guarda igual.

**Si pregunta "¿en qué nos quedamos?": corte del 2026-10-30 (cierre) en `Roadmap.md` §1 — se retoma **Mensualidades**, feature en `dev` sin PR (diseño en `docs/mensualidades.md`; `0041`–`0043` aplicadas en dev, ninguna en prod). Hay 4 preguntas al cliente sin respuesta, listadas en el corte: empezar por ellas. Antes, corte del 2026-10-20 en `Roadmap.md` §1 (todo en producción, PR #22; pendiente registrado sin empezar: marcas de color en la lista de Alumnos). Antes, corte del 2026-10-16: Fase 12 ✅ cerrada y aprobada por el cliente (2026-10-16), en `main` desde el PR #21; en `dev` (pendiente PR, sin SQL) la vista previa de evaluaciones igual que evaluar, con disciplinas arriba y separador "Así se ve al evaluar:". Lo de la Fase 12: Evaluaciones con Visualizar, agrupar por colegios, bloqueo al editar con alumnos evaluados (endpoint nuevo `POST /evaluaciones/:id/resetear-evaluados` sin SQL), puntaje en vivo con el mismo cálculo del backend, umbrales con palabras, inputs numéricos borrables, permisos por rol. Más: resumen de asistencias oculto en móvil, aviso al dar de alta un alumno manual, "sin disciplinas" cuenta solo activos, listas apiladas hasta 1024 px. Sin SQL en toda la Fase 12. Cerradas y aprobadas por el cliente el 2026-10-16: Fases 10 (Alumnos), 11 (Asistencias), 12 (Evaluaciones) y 14B (Inscripciones, de punta a punta). Alta de usuarios: el admin pone la contraseña, cerrado. Lo siguiente: pruebas en pantalla de Fases 9, 13 y 14. Corte histórico anterior: 2026-10-15 en `Roadmap.md` §1. Hoy en `dev` (pendiente PR a `main`): tres reportes nuevos (Representantes, Inscripciones solo Propietario, Encuestas) con el orden pedido por el cliente; totales en pantalla (card destacado del Total recaudado en Inscripciones + conteos); listas de /estudiantes, /usuarios y /entrenadores en dos escalones para no amontonarse en tamaños intermedios. Respaldo de prod marcado como "no necesario como tarea" (se hace a mano cuando lo pida). Lo siguiente: mergear a `main` tras aprobación y pasar a las pruebas en pantalla de Fases 9–14.** Lo de abajo es histórico, puede estar superado. Corte original (histórico): 2026-10-12 en `Roadmap.md` §1**, con la lista de trabajo numerada. Novedades (puntos 8 y 9) cerrado y en producción (PR #16, 2026-10-13). Arreglos de Inscripción en producción (PR #17 y #18, 2026-10-13): siempre en claro, sin pantalla negra, cuenta detectada también por correo. Lo siguiente: el respaldo de prod y las pruebas en pantalla de las Fases 9–14.

**Bases:** migraciones `0001`–`0040` aplicadas y verificadas por MCP en dev y prod; `0041`–`0043` (Mensualidades) solo en dev, verificadas por MCP. `0004_seed_dev.sql` (catálogos) también está en prod; lo de prueba que traía ya se quitó. Dev lo usa el cliente para simular; prod tiene datos reales: **inscripciones abiertas al público desde el 2026-10-14**; las pruebas se borraron ese día y desde la inscripción 4 todo es real. **SQL pendiente en prod: `0041`, `0042` y `0043`, en orden, antes del merge de Mensualidades.**

**Decisiones esperando respuesta del cliente:** ninguna. Mobak se revisa al probar la Fase 12. (Ficha y contrato: uno por colegio, hecho el 2026-10-13, `0035` + `0036`.)

**Decisiones cerradas, no reabrir:**
- Publicar una encuesta **no** manda correo; le aparece al representante cuando entra.
- (2026-10-13) Solo hay representantes **ecuatorianos que hablan español**: la cédula es de 10 números (sin pasaporte) y la página va sin traductor.
- (2026-10-12) El reporte de Alumnos **sí** saca la información de salud (con casilla y auditoría). **No** hay fechas futuras en asistencia (lo rechaza el servidor). **No** hay invitación por correo: el admin pone siempre la contraseña.
- Varios roles por usuario; el alcance es la **unión** de todos.
- (2026-10-30) Un entrenador **puede** dar varias disciplinas a la misma hora el mismo día (p. ej. Fútbol Sub 8 y Sub 10 juntas). Sale un aviso del cruce (al asignar y al editar horarios) pero no bloquea. Los alumnos sí siguen sin poder cruzarse.
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
