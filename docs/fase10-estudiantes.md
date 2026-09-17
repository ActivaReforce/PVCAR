# Fase 10 — Estudiantes

Estado al **2026-09-17**. Construido y en `dev`. **Sin probar contra el API: Railway apagado.**

El módulo de más volumen: **796 alumnos, 1672 inscripciones, 13 202 asistencias colgando**. Y el que más datos personales de menores maneja.

---

## 1. Lo que hay que probar cuando Railway esté arriba

| Prueba | Qué tiene que pasar |
|---|---|
| Crear alumno | Con colegio, grado, edad, foto y dos disciplinas. Aparece la fila y **sus evaluaciones pendientes** (las crea el trigger) |
| Crear con disciplina de otro colegio | 400 diciendo que es de otro colegio |
| Editar | Nombre, grado, transporte, salud. La lista no debe traer salud ni cédula (mirar la pestaña de red) |
| Cambiar de colegio con inscripciones | 409 con el número de inscripciones activas |
| Cambiar de colegio sin inscripciones | Se guarda; las disciplinas disponibles pasan a ser las del colegio nuevo |
| Inscribir | Marcar dos casillas y guardar una vez: en la base, dos filas nuevas y sus pendientes |
| Desinscribir | La fila queda con `est_id = 2` y `ninoasig_fecha_baja`; **no se borra** |
| Reinscribir a uno que ya estuvo | **Reabre** la fila anterior (no crea otra) y devuelve sus evaluaciones a pendiente. Verificar que sigue habiendo una sola fila para ese par |
| Dar de baja | `est_id = 2` y sus inscripciones activas cerradas, con el recuento en el modal |
| Reactivar | Vuelve a activo; las inscripciones **no** se reabren |
| Eliminar permanentemente | Modal con el recuento real (inscripciones, asistencias, evaluaciones, intentos, representantes), exige escribir el nombre, y en la base desaparece todo eso |
| Atar representante | Hoy no hay ninguno: debe decirlo. Crear uno con rol 4 en Usuarios y volver |
| Alcance coordinador | Solo alumnos de sus colegios |
| Alcance entrenador | Solo los inscritos en sus disciplinas (37 en dev para el entrenador 60) |
| Búsqueda | "pesantez" encuentra a "Pesántez" |
| Paginación | 20 por página, el contador cuadra, cambiar de filtro vuelve a la página 1 |
| Móvil 360 px | La lista se apila en tarjetas, la ficha y el formulario caben |
| Modo oscuro | Aviso de salud en ámbar y badges legibles |

---

## 2. Qué se construyó

### Backend — `modules/estudiantes/`

| Endpoint | Permiso | Qué hace |
|---|---|---|
| `GET /estudiantes` | `ver` | Página filtrada por alcance (colegio **o** disciplina), con búsqueda sin tildes, filtros y conteos |
| `GET /estudiantes/grados` | `ver` | Los 13 grados, con cuántos alumnos activos hay en cada uno |
| `GET /estudiantes/candidatos-representante` | `editar` | Usuarios activos con rol 4 y ficha de `padre` |
| `POST /estudiantes/foto` | `editar` | URL de subida firmada, carpeta `estudiantes/` |
| `GET /estudiantes/:id` | `ver` | Ficha con inscripciones y representantes. `?historial=true` añade las cerradas |
| `GET /estudiantes/:id/disponibles` | `editar` | Disciplinas activas **de su colegio** en las que no está inscrito, marcando si ya estuvo |
| `POST /estudiantes` | `crear` | Alta, con inscripciones opcionales, en una transacción |
| `PATCH /estudiantes/:id` | `editar` | Edición |
| `PUT /estudiantes/:id/inscripciones` | `editar` | La lista completa: inscribe lo que falta y da de baja lo que sobra |
| `POST /estudiantes/:id/baja` · `/reactivar` | `editar` | Baja lógica que cierra inscripciones · reactivación que no las reabre |
| `GET /estudiantes/:id/impacto` · `DELETE` | `eliminar` | Recuento de lo que destruye · borrado con confirmación por nombre |
| `POST` · `DELETE /estudiantes/:id/representantes` | `editar` | Atar y soltar |

### Frontend

`api/estudiantes.ts`, `hooks/useEstudiantes.ts`, página reescrita y cuatro componentes: `EstudiantesLista`, `EstudianteForm`, `EstudianteFicha`, `EliminarEstudianteDialog`.

**Borrados por inservibles (18 componentes, 6 hooks y 3 archivos de test):** `AttachRepresentanteModal`, `EstudianteBasicForm`, `EstudianteDisciplinasChips`, `EstudianteDisciplinasEmptyState`, `EstudianteDisciplinasList`, `EstudianteDisciplinasSection`, `EstudianteRepresentanteForm`, `EstudiantesDataTable`, `EstudiantesDisciplineFilters`, `EstudiantesHeader`, `EstudiantesModal`, `EstudiantesModalsManager`, `EstudiantesResponsiveFilters`, `EstudiantesSchoolCardGrid`, `EstudiantesTable`, `EstudiantesViewModal`, `LinkDisciplinasModal`, `StudentStatusFilters`, más `useEstudiantesData`, `useStudentsPagination`, `useStudentCounts`, `useEstudiantesModals`, `useEstudianteDisciplinas` y `useSchoolCounts`.

`RemoveDisciplineDialog` se queda: lo usa todavía `LinkDisciplinesToEvaluationModal`, que es de la Fase 12.

Los **11 tests en `describe.skip`** que arrastraba el repo desde la Fase 1 se borran con los componentes que probaban. Nunca llegaron a ejecutarse (sus mocks de Supabase estaban desfasados) y lo que probaban —que el navegador armara bien la consulta— ya no existe. Su sustituto son las 16 pruebas de servicio del backend.

---

## 3. Qué se arregló del sistema viejo

| Antes | Ahora |
|---|---|
| `useEstudiantesData` pedía los **796 niños** con padres, usuario del padre (**incluida su contraseña**), colegio y grado anidados, y contaba con `.filter()` | Paginación, filtros, orden y conteos en SQL; la lista trae 11 columnas y ni cédula ni salud |
| El alcance se resolvía en el navegador y **si la lista de colegios permitidos salía vacía, el filtro no se aplicaba**: devolvía los 796 | `alcanceDe` en el servidor, por colegio **y** por disciplina |
| La regla "qué colegios ve este usuario" estaba escrita en 6 hooks, ya divergentes | Una sola función |
| Baja del alumno = dos updates sueltos sin transacción: si fallaba el segundo, quedaba inactivo pero seguía en las listas de asistencia | Una transacción |
| Nada impedía inscribirlo en una disciplina de **otro colegio**: el selector se alimentaba del colegio filtrado en pantalla, no del suyo | 400 explícito (y 0 casos en los datos reales, así que la regla no rompe nada) |
| Reinscribir podía chocar contra el índice único parcial | Reusa `reactivate_nino_asignacion`, que reabre la fila y devuelve sus evaluaciones a pendiente |
| El borrado permanente pasaba **en silencio**: el código solo preveía un error de clave foránea que con las cascadas nunca llega | Recuento exacto de las 5 cosas que destruye + escribir el nombre + auditoría |
| Un `AbortController` que se creaba, se abortaba y no se pasaba a ninguna consulta | La cancelación de react-query |
| Vista de tarjetas por colegio obligatoria antes de llegar a la lista | Se entra directo a la lista, con el colegio como filtro |

---

## 4. Decisiones

| Decisión | Por qué |
|---|---|
| La lista **no** devuelve cédula, salud ni datos del representante | Son datos sensibles de un menor y la lista se pinta 20 veces al día. Van solo en la ficha |
| Cambiar de colegio con inscripciones activas se **rechaza** | Esas inscripciones son de disciplinas del colegio viejo; cerrarlas automáticamente escondería que el alumno deja esas clases |
| Las inscripciones se editan con casillas y **un** botón de guardar | El sistema viejo hacía una escritura por clic. Así la diferencia se calcula en el servidor y entra entera o no entra |
| Soltar un representante **sí** es DELETE | `nino_padre` es un vínculo puro, sin estado ni fechas: no hay historial que perder |
| El borrado no tiene bloqueos | Las tres FK hacia `nino` son ON DELETE CASCADE. No hay nada que lo impida, y por eso el aviso es lo único que protege |

---

## 5. Verificado sin backend

- **SQL contra `PVCAR_Dev` por MCP:** lista con alcance de entrenador (37 alumnos de sus 4 disciplinas), lista y conteos con alcance de coordinador (141 · 88 activos · 53 inactivos · 55 sin disciplinas), inscripciones de un alumno con su entrenador, disponibles (14 para el alumno 173) e impacto (4 inscripciones, 54 asistencias, 5 evaluaciones).
- **Las cascadas**, una a una: `nino` → `nino_asignacion` → `evaluacion_nino_pendiente` → `evaluacion_intento`, más `asistencia_nino` y `nino_padre`. Todas ON DELETE CASCADE: el borrado no tiene freno y por eso el modal cuenta.
- **El índice `ninoasig_una_activa_por_horario`** ya existe en el baseline: es la razón de reusar `reactivate_nino_asignacion` en vez de insertar.
- **Datos que conviene saber:** 98 alumnos sin grado, solo 3 con cédula, 3 con información de salud, 5 activos sin ninguna inscripción y **0 inscripciones cruzadas de colegio**.
- **16 pruebas de servicio nuevas** + 15 rutas cerradas sin token → **213 en el backend**.
- `typecheck`, `lint` (0 errores) y `build` en verde.
