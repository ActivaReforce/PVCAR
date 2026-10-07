# Fase 11 — Asistencias

Estado al **2026-09-17**. Construido y en `dev`. **Sin probar contra el API.**

El registro diario y lo que más se usa del sistema: **13 202 marcas de alumnos, 1 726 de entrenadores y 283 de auxiliares**. Alimenta todos los informes.

> El cliente decidió el 2026-09-17 seguir construyendo y dejar las pruebas de las Fases 7–11 para después. Esta fase se suma a la cola de pruebas pendientes.

---

## 1. Lo que hay que probar

### Alumnos

| Prueba | Qué tiene que pasar |
|---|---|
| Abrir la pantalla | El día arranca en el de **hoy** y el colegio se elige solo si solo hay uno en el alcance |
| Elegir una disciplina | La fecha se propone en su **última sesión pasada**, no en la próxima |
| Marcar 20 alumnos y guardar | Una sola petición. El aviso dice "20 registrada(s)" |
| Volver a entrar | Los 20 estados están puestos, con quién los registró y cuándo |
| Cambiar uno a **Tarde** | Aparece la hora. El botón de guardar se bloquea y dice que falta la hora |
| Botón "Ahora" | Pone la hora **de Ecuador según el servidor**, no la del teléfono |
| Cambiar a **Justificado** | Aparece el motivo, exige 3 letras, y la hora desaparece |
| Volver a **Presente** | En la base, `asisnino_hora_tarde` y `asisnino_razon_justificado` quedan **NULL** |
| Guardar dos veces la misma fecha | **Actualiza, no duplica.** Contar filas: `SELECT count(*) FROM asistencia_nino WHERE colacthor_id = X AND asisnino_fecha = 'Y'` |
| Corregir una marca ya guardada | El aviso dice "corregida(s)" y aparece **una fila en `auditoria`** |
| Pasar lista por primera vez | **No** escribe en `auditoria` (es el trabajo diario, no una corrección) |
| Fecha que no cae en el día | Aviso en pantalla antes de pedir nada; si se fuerza por API, **400** |
| "Presente a los N" | Solo marca a los que no tienen estado. **No pisa** las correcciones ya hechas |
| Deshacer | Vuelve a lo que hay guardado |
| Entrenador con disciplina ajena | **403** (probar con `curl` y un id de otra disciplina) |
| Fecha pasada con alumnos ya dados de baja | Salen igual, con el aviso "ya no está inscrito" |
| Historial | Abre el rango, lista las fechas con sus conteos y al pulsar una **abre esa sesión** |
| **360 px** | Una tarjeta por alumno, los cuatro estados como botones de 44 px con inicial (P·A·T·J), "Guardar" fijo abajo |
| Modo oscuro | Los cuatro colores de estado legibles, seleccionados y sin seleccionar |

### Entrenadores y auxiliares

| Prueba | Qué tiene que pasar |
|---|---|
| Elegir colegio y fecha | Salen los que dan clase **ese día** ahí, con lo que imparten |
| Auxiliares | Salen debajo, con "Auxiliar de \<titular\>" |
| Guardar el lote | Entrenadores a `asistencia_entrenador` y auxiliares a `asistencia_auxiliar`, en **una transacción** |
| Repetir el mismo día | Actualiza, no duplica (índices `uq_entrenador_fecha_colegio` y `uq_auxiliar_fecha_colegio`) |
| Colegio fuera del alcance | **403** |
| Fecha en la que alguien ya no tenía asignación | Sale si tiene marca, con el aviso correspondiente |
| Sin nadie ese día | Mensaje que explica que la lista sale de las asignaciones vigentes |

---

## 2. Qué se construyó

### Migración `0010_asistencia_coherencia.sql`

Va en **las dos bases**, después de `0009`. Dos cosas:

1. **Tres CHECK**, uno por tabla: la hora de llegada solo con **Tarde** y el motivo solo con **Justificado**, en los dos sentidos (ni sobra ni falta). Hasta ahora esa regla vivía solo en el navegador, copiada en tres archivos.
2. **Fuera el `DEFAULT now()`** de las tres columnas `*_hora_tarde`. Son columnas `time`: un INSERT que omitiera la hora no dejaba NULL, dejaba la hora del reloj del servidor.

**Seguro:** medido sobre `PVCAR_Dev`, que lleva los 15 211 registros del respaldo de producción — **0 filas violan cualquiera de los cuatro casos** en las tres tablas.

### Backend — `modules/asistencias/`

| Endpoint | Permiso | Qué hace |
|---|---|---|
| `GET /asistencias/estados` | `ver` de cualquiera de los dos módulos | Los cuatro estados |
| `GET /asistencias/contexto` | idem | La fecha y la hora **de Ecuador según el servidor** |
| `GET /asistencias/alumnos?disciplina&fecha` | `asistencias_estudiantes:ver` | La sesión, la lista y el resumen contado en SQL |
| `PUT /asistencias/alumnos` | idem | Lote en una transacción |
| `GET /asistencias/historial?disciplina&desde&hasta` | idem | Conteos por fecha, rango máximo 180 días |
| `GET /asistencias/entrenadores?colegio&fecha` | `asistencias_entrenadores:ver` | Titulares vigentes ese día y sus auxiliares |
| `PUT /asistencias/entrenadores` | idem | Lote con los dos tipos, cada uno a su tabla |

**36 pruebas automáticas nuevas** (backend: 256 en total, antes 218). `lint`, `typecheck` y `build` verdes en los dos workspaces. Las seis consultas nuevas, **ejecutadas contra `PVCAR_Dev` por MCP**; los tres `INSERT ... ON CONFLICT`, validados con `PREPARE` (parsea y resuelve el índice único sin escribir nada).

### Frontend

`api/asistencias.ts`, `hooks/useAsistencias.ts`, `hooks/useBorradorAsistencia.ts`, dos páginas (`AsistenciasAlumnos`, `AsistenciasEntrenadores`) y cinco componentes en `components/asistencias/`: `FilaAsistencia`, `BarraGuardar`, `ResumenAsistencia`, `HistorialDisciplina` y `estados.ts`.

**Borrado por inservible:** la carpeta `components/attendance/` entera (20 archivos, 2 400 líneas), `hooks/useAttendanceData.ts` (437), `hooks/useRequestQueue.ts`, `hooks/useTrainerContext.ts`, `pages/Asistencias.tsx` (envoltorio de una línea) y `pages/AsistenciasNinos.tsx` (463 líneas **que no estaban ni enrutadas**). De `TimezoneUtils.ts` sobrevive una función, movida a `lib/hora.ts`, que aún usa el informe de entrenadores (Fase 13).

**Cambio de ruta:** `/attendance/coaches` → `/asistencias/entrenadores`. Era el único camino en inglés del sistema. El menú lateral ya apunta al nuevo.

---

## 3. Lo que se arregló del sistema viejo

| Estaba mal | Ahora |
|---|---|
| **El domingo no se podía registrar.** El navegador comparaba `date.getDay()` (0=Domingo) contra `dia_id` (7=Domingo): coincide de lunes a sábado y falla el domingo | El día lo calcula Postgres con `EXTRACT(ISODOW)`, que es justo la tabla `dia`. Hoy no hay disciplinas en domingo, así que el fallo estaba **latente** |
| Guardado fila a fila, con una cola de peticiones escrita a mano (`useRequestQueue`) | Un lote, una transacción. Entran las 42 marcas o ninguna |
| La hora se convertía en el navegador con `date-fns-tz` y el reloj del teléfono | La fija el servidor, en la zona de Ecuador, una sola vez |
| El `upsert` iba por `onConflict` de PostgREST sin más red debajo | Índices únicos reales (ya estaban en el baseline) + `ON CONFLICT` sobre ellos |
| El entrenador podía marcar disciplinas ajenas si conocía el id | Alcance en el servidor, 403 |
| La lista filtraba por inscripción **activa hoy**, así que abrir una fecha pasada escondía registros | La lista es "inscritos esa fecha" ∪ "ya marcados esa fecha". En dev son **1 393 asistencias** que antes desaparecían |
| "Aplicar Presente a todos" pisaba las correcciones ya hechas | Solo marca a quien no tiene estado |
| No había forma de ver una fecha pasada sin rehacer los cuatro filtros | Historial por rango, y cada fecha abre su sesión |
| Los estados se comparaban por nombre en minúsculas (`=== 'presente'`) en cinco archivos | Un solo mapa de estados, por id |
| La pantalla de entrenadores eran 743 líneas en un archivo | Módulo con su servicio y componentes compartidos con la de alumnos |

---

## 4. Decisiones que hay que confirmar

**1. Permisos.** En `rol_permiso` los dos módulos de asistencia **solo tienen la acción `ver`** — nadie tiene `crear` ni `editar` sobre ellos. Así que `ver` habilita también el pase de lista, que es lo que la pantalla siempre ha hecho; quien de verdad limita es el **alcance**.

Si quieres separar "consultar la asistencia" de "pasar lista", hay que conceder `editar` a los roles que deban marcar (desde Permisos) y cambiar dos líneas de `asistencias.routes.ts`. **Tal como está hoy, exigir `editar` dejaría el módulo inservible para todos.**

**2. Fechas futuras.** El selector no deja pasar de hoy. El sistema viejo proponía la **próxima** sesión, o sea registrar una clase que aún no ha ocurrido. Si alguna vez hace falta dejar constancia por adelantado, se quita el tope.

**3. Disciplina dada de baja.** Su historial se consulta pero no admite marcas nuevas (409). Si una clase se da de baja por error y hay que registrar la sesión que faltaba, primero se reactiva la disciplina.
