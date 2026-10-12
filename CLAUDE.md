# Contexto del workspace — Activa Reforce / PVCAR

> **Vive en el repo desde el 2026-10-07** (raíz de `ActivaReforce/PVCAR`) para poder seguir desde otro equipo. Se borra del repo al cerrar el proyecto (Fase 17). Las rutas `PVCAR/...` son la raíz de este repo; `SQL/`, `Backup_bd/`, `Bitacora.md`, `activa-forge-login/`, `Cosas/`, `_ref/` y `.mcp.json` son de la carpeta de trabajo y no están aquí. En otro equipo hay que recrear `.mcp.json` (tres servidores Supabase `--read-only`) y los `.env`, que nunca se suben.

**Lee `PVCAR/Roadmap.md` antes de proponer o ejecutar cualquier cosa** (desde el 2026-10-07 vive en el repo; el `Roadmap.md` de la raíz es solo un aviso). Toda mención a `Roadmap.md` en este archivo se refiere a ese. Es el documento maestro (17 fases, reglas transversales, especificación funcional de cada módulo, anexos de autenticación, RLS e infraestructura). Sustituye a `Plan.md`, que quedó archivado entero en `Bitacora.md`.

## Qué es esto

Se está sacando el producto de Activa Reforce de la cuenta **Flowward** para reconstruirlo en la infraestructura propia del cliente: un monorepo único `ActivaReforce/PVCAR` (`backend/` en Railway, `frontend/` en Vercel) contra dos proyectos Supabase nuevos (`PVCAR` para prod, `PVCAR_Dev` para dev). Estrategia: **congelar y cortar al final** — el sistema viejo sigue vivo hasta un cutover único.

## Reparto de trabajo

Los dashboards de **Vercel, Railway y Supabase los opera el cliente**; Claude entrega los pasos concretos e inspecciona en solo lectura. El código, el repo y los archivos locales los hace Claude.

## Reglas duras

1. **`activa-forge-login/` es el sistema en producción. No se modifica, no se despliega, no se borra hasta la Fase 17.** Sirve solo como referencia de código.
2. **Nunca escribir en ninguna Supabase.** Todo MCP de Supabase va `--read-only` y así se queda; las consultas con `psql` también. Los cambios de schema los aplica el cliente a mano desde `SQL/`. `.mcp.json` tiene tres servidores, los tres `--read-only` y con `--project-ref` fijo: `pvcar_dev` (`vjwlwjqaalppzmycbalw`), `pvcar_prod` (`dahsgmpubbofrefvseir`) y `supabase_vieja` (`wfyytrdhqtspapxaikoh`). Las banderas no se tocan.
3. **Ningún secreto en disco fuera de `.env` gitignoreados ni en el repo.** No crear archivos de notas con keys. El `service_role` y `DATABASE_URL` viven solo en variables de entorno de Railway. **Excepción decidida por el cliente (2026-07-29):** los dos PAT de Supabase van en texto plano en `.mcp.json` de la raíz del workspace, que no es repo git. Riesgo asumido, se rotan al cerrar la Fase 17. No reabrir.
4. **Cada cambio de schema es una migración versionada** en `PVCAR/db/migrations`. Nada de cambios a mano en el dashboard de Supabase.
5. Antes de cualquier operación destructiva sobre datos reales: respaldo fresco verificado.
6. **Fechas y horas siempre en hora de Ecuador** (`America/Guayaquil`, UTC-5, sin horario de verano). La base y Railway están en UTC; todo lo que se guarda, filtra, compara o enseña se piensa en hora de Ecuador. Toda fecha nueva pasa por `lib/fecha.ts` (backend: `HOY_EC`, `diaEc()`, `textoEc()`; frontend: `hoyEc()`, `fechaDia()`). Prohibido `CURRENT_DATE`, `marca::date`, `to_char(timestamptz)` sin zona y `new Date().toISOString()` para "hoy". Al revisar o construir cualquier cosa con fechas, comprobar qué pasa de 19:00 a 23:59 en Ecuador, cuando UTC ya es mañana.

## Mapa del workspace

| Carpeta | Qué es |
|---|---|
| `PVCAR/Roadmap.md` | Documento maestro. Fuente de verdad. En el repo para seguir desde otro equipo. |
| `Bitacora.md` | El `Plan.md` viejo, archivado: cómo se cerró cada fase 0–5 y el registro día a día. |
| `activa-forge-login/` | SPA viva en prod (Vite+React+TS+shadcn). Solo lectura. |
| `Backup_bd/` | **Respaldo definitivo** de la prod vieja, 2026-10-01: `prod_full_2026-10-01.dump`, `usufoto/` y `MANIFIESTO.txt` (sha256 + conteos). Lleva datos de menores y contraseñas en texto plano: nunca al repo. |
| `_ref/` | Material de arranque de la Fase 1, ya consumido. |
| `Cosas/` | Contrato, RUC, assets de marca. |
| `PVCAR/` | Clon de trabajo del monorepo (remoto `ActivaReforce/PVCAR`). Aquí se trabaja. |
| `SQL/` | **Canal de entrega:** archivos que el cliente ejecuta a mano en el SQL Editor de Supabase, con `ORDEN.md`. Copia de `PVCAR/db/migrations/`, que es la fuente de verdad. Si se cambia la migración, hay que recopiarla. |

## Infraestructura desplegada

| Pieza | URL | Rama | Supabase |
|---|---|---|---|
| Railway `production` | `pvcarbackend-production.up.railway.app` | `main` | `PVCAR` |
| Railway `development` | `pvcarbackend-development.up.railway.app` | `dev` | `PVCAR_Dev` |
| Vercel Production | `pvcar.vercel.app` | `main` | `PVCAR` |
| Vercel Preview | `dev-pvcar.vercel.app` | `dev` | `PVCAR_Dev` |

Flujo de trabajo: commit a `dev` → CI → preview en Vercel y deploy en Railway `development`. A `main` solo por PR (rama protegida, checks `check` y `secrets-scan`).

Trampas de configuración que ya costaron tiempo:
- **Railway root dir = raíz del repo**, no `backend/` (el `package-lock.json` vive en la raíz por npm workspaces). `railway.json` está en la raíz.
- **Vercel root dir = `frontend`**, al revés que Railway. Y Vercel **salta el build** si el commit no toca `frontend/**`: el deployment sale `Canceled` sin logs.
- Las `VITE_*` se hornean en tiempo de build; cambiarlas en el dashboard no hace nada hasta el build siguiente.
- `FRONTEND_ORIGIN` no incluye `localhost` por decisión del cliente: se prueba siempre por push a `dev`, no en local.
- **Regiones — resuelto el 2026-08-04.** Los servicios de Railway estaban en US West (California) contra Supabase `PVCAR` en `us-east-2` (Ohio): ~55–60 ms por consulta. Ya están en **US East (Virginia)** = `us-east4`. Railway **guarda la región pero no la mueve hasta el siguiente deploy**: hace falta *Redeploy* a mano, y se comprueba porque el `uptime` de `/health` vuelve a cero.

**El frontend desplegado casi no usa el backend:** salvo la autenticación (Fase 5), 96 archivos importan el cliente de Supabase directo. Eso se cierra módulo por módulo en las Fases 6–14. No dar por funcional lo que solo está desplegado.

**Todas las rutas del backend cuelgan de `/api/v1`.** Un `curl` a `/health` pelado devuelve 404 del `notFoundHandler` y parece caída falsa. Es `/api/v1/health`.

## Herramientas disponibles

`gh 2.96`, `railway 5.30`, `vercel 58`, `supabase 2.110`, `psql`/`pg_dump 17.4` (en `C:\Program Files\PostgreSQL\17\bin`, ya en el PATH de usuario), node 24, git. Además `git-filter-repo 2.47` vía pip.

**Trampa (2026-10-02):** en `gh` la cuenta **activa es una cuenta personal**, sin permiso sobre el repo: `git push` da 403. ActivaReforce también está logueada; se empuja sin cambiar la cuenta activa con `git -c credential.helper= -c 'credential.helper=!f(){ echo username=x-access-token; echo "password=$(gh auth token -u ActivaReforce)"; }; f' push origin dev`, y para `gh` se exporta `GH_TOKEN=$(gh auth token -u ActivaReforce)`.

Estado de autenticación (verificado 2026-07-29): `gh` ✅ ActivaReforce · `vercel` ✅ activareforce, scope `pvcar` · `railway` ❌ sin autenticar · `supabase` ❌ sin autenticar (**hace falta para la Fase 2**).

Para conectarse a la prod vieja en lectura (session pooler, puerto 5432):
session pooler de `sa-east-1`, puerto 5432, usuario `postgres.<ref>`; la cadena completa no se versiona

## Siguiente paso

**Fase 2 cerrada el 2026-07-30.** Estado de las dos bases, todo verificado por MCP:

| Migración | `PVCAR_Dev` | `PVCAR` (prod) |
|---|---|---|
| `0001_baseline.sql` — 35 tablas, 63 FK, 107 índices, 6 funciones, 3 triggers | ✅ | ✅ |
| `0002_rls.sql` — ENABLE + FORCE en las 35, **0 políticas** | ✅ | ✅ |
| `0003_storage.sql` — bucket `usufoto` privado, 500 KB, jpeg/png/webp | ✅ | ✅ |
| `0004_seed_dev.sql` — catálogos + 1 colegio de prueba | ✅ | **nunca** |
| `0005_grants.sql` — `anon`/`authenticated` sin nada, `service_role` con lo suyo | ✅ | ✅ |

Prod está vacía de datos a propósito: los recibe en el cutover (Fase 16).

**Fase 3 cerrada el 2026-08-04.** Env vars sembradas en los dos ambientes de Railway (`DATABASE_URL` por el transaction pooler, puerto 6543), `/health` da `db:"ok"` en `production` y `development`, servicios movidos a `us-east4`, y la deuda de repo saldada: PR #6 versionó `0002`–`0005` y `db/checks/`. No queda nada suelto en `git status`.

**Fase 4 cerrada el 2026-08-05.** El login real desde `dev-pvcar.vercel.app` es la primera llamada del front al API.

**Fase 5 cerrada el 2026-08-06 y en `main` desde el 2026-08-07.** Las 12 pruebas hechas: login, logout, reset por correo (el enlace aterriza en `/reset-password`), cambio desde Perfil, refresh del token tras una hora y permisos por rol. `PVCAR_Dev` tiene 45 usuarios sembrados por `backfill-auth.ts`, verificados por MCP. PR #7 mergeado (`e9bbabb`) más el PR #8 de vuelta a `dev`; `production` redesplegó con `db:"ok"`.

**Quién mergea:** `main` exige solo los checks `check` y `secrets-scan`, **no exige revisión de nadie**, y `gh` está autenticado como ActivaReforce. Claude **sí puede** abrir el PR y mergear con `gh pr merge`; simplemente no lo hace sin que el cliente lo pida. Cuando diga "sube a dev" o "mergea a main", se hace entero — nada de devolverle pasos manuales de GitHub.

**Los datos reales ya están en `PVCAR_Dev`** desde el 2026-08-06: 19 388 filas en 25 tablas, cargadas con `SQL/carga_dev_datos_2026-08-06.sql` por `psql` y verificadas por MCP (las 35 tablas cuadran con cuatro desviaciones previstas). **Trampa que costó un intento y vuelve a aparecer en el cutover:** hay que desactivar dos triggers durante la carga —`nino_asignacion`/`trigger_nino_asignacion_evaluation` y `evaluacion_parametro`/`trigger_update_evaluacion_puntaje_total`— o revienta con `duplicate key ... evaluacion_nino_pendiente_pkey`. El arreglo está dentro del propio `.sql` y en `Backup_bd/generador_carga_dev.mjs`.

**Mapa global de módulos** en `PVCAR/docs/mapa-modulos.md` (commiteado en `cba3c46`). Es la referencia de las Fases 6–14: las 14 áreas con sus tablas, el eje `colegio_actividad_horario`, nueve malas prácticas con su arreglo —la grave: **la autorización se decide en el navegador**— y las tres decisiones de negocio del cliente (encuestas se mantienen; varios roles por usuario es esencial y el alcance debe ser la **unión** de todos los roles; borrado permanente junto a la baja lógica, con recuento previo, confirmación escribiendo el nombre y auditoría).

**Data anterior construida y en `dev` el 2026-10-02** (Reportes → Data anterior, solo Propietario/Admin): pruebas en `PVCAR/docs/data-anterior.md`, sin probar en pantalla. De paso se arregló que **la exportación a Excel de Reportes se cortaba siempre**.

**🔵 DECISIÓN DEL 2026-10-01 — ARRANQUE DE CERO.** La empresa está en pausa un mes. **Los datos viejos ya no se migran:** la plataforma nueva arranca vacía (catálogos + un Propietario; esa siembra está sin escribir) y lo viejo va al esquema **`archivo`** para Reportes → "Data anterior". Respaldo definitivo hecho y comprobado. **`archivo` cargado y verificado por MCP en dev y prod el 2026-10-02** (35 tablas, 20 620 filas, cerrado a anon/authenticated, `service_role` solo lee). **Ojo: `0004_seed_dev.sql` está aplicado en prod por error** (Colegio de Pruebas Dev + 1 actividad + 2 disciplinas); los catálogos sirven para el arranque, pero lo de prueba hay que quitarlo antes de lanzar. La Fase 16 tal como estaba queda superada; todo lo de "dump fresco", backfill y carga del cutover que sale más abajo **ya no aplica**. La base vieja se borra cuando la nueva esté en producción. Detalle en `Roadmap.md` §1.

**Pedidos del cliente del 2026-10-01** (tabla en `Roadmap.md` §1): alta de usuario sin verificación de correo, varios roles y entrenador en varios colegios — **ya funcionan**. Historial que se queda cuando un entrenador se va — diseñado, **falta probarlo** (Fase 9). **Un auxiliar con varios entrenadores — el código hoy lo prohíbe (409), hay que cambiarlo antes de probar la Fase 9** (`docs/fase9-entrenadores.md` §1b). Módulo nuevo **Inscripciones**, solo Propietario → **Fase 14B**, lógica por discutir.

**Inscripciones (14B) rehecha el 2026-10-05, todo menos el cobro, en `dev`.** El estado vigente está en `PVCAR/docs/fase14b-contratos.md`, que manda sobre `fase14b-inscripciones.md`: seis documentos (4 generales + ficha y contrato con texto común y datos por colegio), formulario en 5 pasos, constancia por documento en `inscripcion_aceptacion`, PDF por alumno con membrete, IVA fijo 15 %, abrir/cerrar general y por colegio, cuenta bancaria. Migraciones `0014`–`0019` aplicadas y verificadas en dev y prod. `RESEND_API_KEY` y `CORREO_REMITENTE` ya están en Railway.

**Si pregunta "¿en qué nos quedamos?": corte del 2026-10-09 en `Roadmap.md` §1. Hecho el punto 8 — módulo Novedades (en `dev`, con `0027_novedades.sql` por correr): tres tipos de novedad (General, Personal de Activa Reforce, Alumnos), menciones múltiples, correos al Para+CC configurado y, con el switch "notificar también al mencionado y al representante", al mencionado o a los representantes. Visibilidad: Propietario/Admin ven todas; el resto solo las suyas (más las que lo mencionan si el switch está activo); eliminar: autor + Propietario/Admin. Permisos CRUD de `novedades` ya repartidos por la propia `0027`. Pendiente conocido: card Novedades en Reportes con Excel. Lo siguiente es el punto 9, aviso automático de ausencia (depende del 8). Tabla de permisos: `PVCAR/docs/permisos.md`.** Lo de abajo es histórico, puede estar superado. Hecho y probado por el cliente: Disciplinas v2, auxiliar con varios titulares, colores de actividad, días completos en `/inscripcion` (en `main` desde el PR #10) y, ya solo en `dev`, el **representante con cuenta previa** (`fase14b-contratos.md` §9), el descuento de hermano con hijos ya inscritos y el arreglo de recuperar contraseña. También en `dev` (2026-10-07, tarde): asistencia sin duplicar al auxiliar con dos titulares, aviso de inscripciones en el menú, mejoras de Encuestas (vista previa, escala, acciones), Reportes alineados y Perfil con Configuración. PR #11 a `main` hecho el 2026-10-07 (`d90198b`). Siguiente: **lista nueva de 8 pedidos** en `Roadmap.md` §1 ("Pendientes nuevos": hoja Resumen en reportes con ej1/ej2, Novedades, aviso de ausencia, pagos mensuales…); **revisar todos los Reportes y el modelo de Permisos módulo por módulo** (pendientes anotados en `Roadmap.md` §1); y la Fase 9. SMTP de Resend confirmado por el cliente en prod y dev (2026-10-07). **`padre` guarda también la facturación**, que puede ser de otra persona: se valoró separarla y renombrar la tabla, y el cliente decidió dejarlo así; no reabrir.

**Dev vaciado el 2026-10-05** con `SQL/reinicio_dev_2026-10-05.sql` (verificado por MCP): quedan los catálogos, los 4 Propietarios con su acceso y `archivo` entero. **Dev ya no tiene los 796 alumnos de prueba**: lo que haya lo creó el cliente simulando. La `0017` borró los campos viejos que ya no pide nadie (`nino_toma_transporte`, `nino_cedula`, `nino_otra_info`, `nino_edad`, `padre_sector_residencia`, `ent_cedula`).

**Lo primero al retomar (corte del 2026-10-02 — detalle en `Roadmap.md` §1):**

1. `/api/v1/health` en los dos ambientes → `db:"ok"`. **Los dos responden** (el 404 de `production` ya no está).
2. **Fase 8 cerrada el 2026-10-02.** Siguiente: **preparar la Fase 9** (`PVCAR/docs/fase9-entrenadores.md` §1b) — auxiliar con varios titulares con selector "de quién ver" + "Todos", y aviso de choque de horario. Luego 10, 11, 12, 13 (+ `docs/data-anterior.md`) y 14.
3. **Cómo se le dan las pruebas (regla del 2026-10-02):** solo lo que Claude **no pudo verificar** —aspecto, uso real en pantalla, móvil, oscuro—, corto y numerado. Lo verificado se le cuenta en otra lista breve. La de 45 de la Fase 8 le costó horas.
4. **Coordinador de prueba:** `prueba@activareforce.com` (`usu_id` 126) en dev; asignarle Innova Schools Calderón. Desde Usuarios se le pone la contraseña que sea.
5. **PR `dev` → `main` solo cuando él lo pida.** Hasta entonces producción sigue con el favicon de Lovable y sin Data anterior.
6. Antes de lanzar: **siembra de prod** (quitar lo de prueba de `0004` + primer Propietario), `.sql` sin escribir.

**No hay SQL pendiente:** `0001`–`0026` (la `0026` en dev y prod, verificada el 2026-10-07), la carga de `archivo`, el reinicio de dev y la limpieza de prod (Flowward único Propietario), aplicados y verificados por MCP.

**Las gráficas se hacen con la skill `dataviz` y su validador, no a ojo.** En la Fase 13 se midió la paleta obvia (verde/ámbar/azul/rojo) y **no pasó**: el ámbar visible sobre blanco choca con el verde bajo daltonismo (ΔE 2–3) y verde contra rojo da ΔE 4.1. La asistencia se rehízo como **escala divergente azul↔rojo con gris neutro**, que sí pasa en los dos modos. Los botones de pasar lista siguen en verde a propósito: un control no es una marca de datos. Está razonado en `frontend/src/components/graficas/paleta.ts`.

**Decisión de la Fase 13 esperando respuesta** (`docs/fase13-tablero-reportes.md` §4): el reporte de Alumnos sigue llevando la columna **Información de salud**, como el del sistema viejo. Es dato médico de menores en un Excel que se reenvía; se puede sacar, dejarla solo en la ficha o restringir el reporte.

**Decisión de la Fase 12 esperando respuesta** (`docs/fase12-evaluaciones.md` §4): Mobak ahora **escala** su 0-2 al `evaparam_puntaje` del parámetro, en vez de devolver 0/1/2 literales ignorándolo como hacía el sistema viejo. Es un no-op con todos los datos reales (los tres parámetros Mobak tienen 2 puntos y 1 intento), pero cambia el resultado si alguien configura uno con otro puntaje.

**Decisión de la Fase 11 esperando respuesta** (`docs/fase11-asistencias.md` §4): si se permiten o no fechas futuras. (Lo de que `ver` habilitaba pasar lista quedó resuelto con la `0026`: ahora es `editar`.)

**La prod vieja (`wfyytrdhqtspapxaikoh`)** sigue viva y en solo lectura para nosotros; se borra cuando la nueva esté en producción. Su respaldo definitivo es el del 2026-10-01 en `Backup_bd/`. Su `auth.users` tiene 0 filas y el trigger `on_auth_user_created` roto: el sistema viejo autentica con `usu_contrasena` en texto plano. Lo de "dump fresco", "19 chequeos", "correo inválido" y "copiar `usufoto`" **ya no aplica**: era para migrar datos, y no se migran.

**Las cuentas de acceso de los inactivos:** los 23 usuarios inactivos de `PVCAR_Dev` no tienen cuenta en Supabase Auth (el backfill solo cubrió a los 45 activos) y el CHECK del baseline no admite un activo sin ella. Reactivar a uno pide la contraseña y le crea la cuenta en el mismo gesto. **El del correo inválido es un usuario (`usu_id` 119)**: hay que corregirlo antes de reactivarlo.

**Decisiones del 2026-09-17:**

- **Publicar una encuesta NO manda correo.** Le aparece al representante cuando entra. Cerrado, no volver a preguntarlo.
- ~~Los permisos de escritura de Asistencias, Evaluaciones y Encuestas se quedan como están~~ — resuelto el 2026-10-07 con la `0026` (`PVCAR/docs/permisos.md`).
- **El lanzamiento es lo último**, y solo después de todas las pruebas. (Los 4 entrenadores con usuario de baja ya no importan: eran datos que iban a migrarse.)

**Hallazgo de la Fase 7, del tipo que se repite:** un "arreglo" heredado de la SPA original era la causa del fallo. `ThemeContext` pisaba seis tokens de color con `documentElement.style.setProperty` bajo el comentario *"Fix contrast issues in dark mode"*, escribiendo `hsl(0 0% 98%)` en una variable que el tema **vuelve a envolver** — `hsl(hsl(...))` no es un color, el navegador tira la regla y el texto hereda el blanco del padre. Cuando algo del sistema viejo lleva un comentario diciendo que arregla un problema, conviene comprobar que lo arregla.

Dos salidas que **parecen** fallos y no lo son: `backfill-auth.ts` cierra con exit 1 y "El reporte NO cierra limpio" por los 5 omitidos del Anexo A (guardia pensada para el cutover, no para dev), y las pantallas de datos salen vacías porque siguen yendo directo a Supabase con RLS.

**Encuestas y Padres nunca se usaron.** Medido el 2026-08-06 sobre el respaldo: `encuesta`, `encuesta_pregunta`, `encuesta_respondida`, `encuesta_respuesta`, `padre` y `nino_padre` tienen **cero filas** en producción. El código existe, los datos no. Por eso Encuestas pasó a ser la **Fase 14**, la última, y se estrena vacío.

**Forma de trabajo de las Fases 6–14, acordada el 2026-08-06:** módulo por módulo, probando cada uno antes de pasar al siguiente. Pero el **mapa global de módulos va antes del primer módulo** — el modelo está muy entrelazado y diseñar Usuarios sin verlo obliga a rehacerlo en Estudiantes. Al hacer el mapa, el cliente pidió explícitamente **señalar qué está mal y mejorarlo**: el sistema viejo funciona pero usa malas prácticas. Si no está claro cómo debe funcionar el negocio, preguntarle; si está claro, decidir y seguir sin preguntar.

Trampa para probar el correo: `dev-pvcar.vercel.app` está detrás de Vercel Authentication (302 a `vercel.com/sso-api`). El enlace hay que abrirlo en el navegador con sesión de Vercel; desde el móvil rebota.

**Los correos:** el sistema manda **un solo tipo**, el de recuperar contraseña, y no lo manda la aplicación sino **Supabase Auth**. La plataforma vieja no manda ninguno porque guarda la contraseña en texto plano en `usu_contrasena` y la compara a mano, sin Auth; por eso el cliente no reconocía de qué se hablaba. **Solo hace falta pegar una plantilla, la de recuperar contraseña** (`PVCAR/docs/correos/recuperar-contrasena.html`). Verificado en `usuarios.service.ts`: el admin crea al usuario **escribiendo él la contraseña**, con `email_confirm: true`, igual que el sistema viejo — así que *Confirm signup* e *Invite user* no se disparan nunca. Esas dos plantillas quedan en el repo por si el flujo cambia, pero **no van al dashboard**. El cliente configurará **Resend** como SMTP de `PVCAR`. **Pendiente de preguntarle a Activa Reforce:** si quieren pasar al flujo de invitación (el admin crea sin contraseña, la persona la elige desde el correo), porque hoy el admin conoce la contraseña de todos. Se pregunta después de que Resend funcione. Y el bloqueo real: el SMTP de serie de Supabase está limitado a unos pocos envíos por hora y no sirve para producción — hace falta proveedor propio y dominio verificado. **La Fase 15 no cierra sin eso.**

Hallazgo que cambia el runbook del cutover: el `CHECK (est_id <> 1 OR auth_user_id IS NOT NULL)` de `usuario` impide insertar usuarios activos sin cuenta de Auth, así que en la Fase 16 el backfill va **antes** de la carga de datos, no después. Ya corregido en `Roadmap.md`.

Límite de la verificación de la Fase 3: `/health` es el único endpoint, así que prueba que hay conexión pero no **contra qué base**. Que `production` apunte a `PVCAR` se validó a ojo en el dashboard.

**Alcance por rol, revisado el 2026-10-05** (`Roadmap.md` §8): `colegios` solo lo da el coordinador; el entrenador y sus auxiliares llegan por `disciplinas`; el representante solo por `ninos` / `disciplinasDeHijos`; Encuestas (gestión) e Inscripciones llevan guarda de personal. El cliente reparte permisos desde el modal: "ver" nunca debe ampliar el alcance. Quedan más revisiones de este tipo para después.

**Hallazgo que no hay que olvidar:** RLS no protege funciones. Con la anon key, `rpc/delete_student_evaluation` (SECURITY DEFINER) devolvía HTTP 204 hasta `0005_grants.sql`. Al revisar seguridad en Supabase hay que mirar tres capas: RLS, privilegios de tabla y ACL de funciones.

**Empujar a `dev` sin esperar el SQL (2026-10-06):** en cuanto el código esté listo se entrega el `.sql` y se empuja a `dev` a la vez; él corre el SQL y lo ve al instante. Solo si no daña nada más.

Reglas de formato del cliente: **todo SQL que él deba ejecutar va en un `.sql` propio**; los `.md` solo llevan plan y orden. **No se entregan archivos de verificación**: él corre la migración y Claude verifica por MCP en solo lectura (decidido el 2026-07-30). Y mensajes cortos — si son largos, no los lee.

Cuando el editor pregunte **"Run without RLS" / "Run and enable RLS"** → siempre **Run without RLS**.

Dato que conviene no olvidar: en la prod **vieja**, `auth.users` tiene el trigger `on_auth_user_created` → `handle_new_user()` → inserta en `public.profiles`, que no existe. **Crear un usuario en Supabase Auth falla siempre** en el sistema actual. En la base nueva no se replica ninguno de los dos.

Ver "Dónde estamos hoy" al principio de `Roadmap.md`.

Pendiente de seguridad, no bloquea y ya decidido: los PAT en texto plano en `.mcp.json` se quedan así hasta la Fase 17, cuando se rotan. Ver regla dura 3.
