# Fase 8 — Actividades y Disciplinas

Estado al **2026-10-02**. Construido y en `dev`. **En prueba.** Dos arreglos hechos al preparar las pruebas: no se puede cambiar el colegio ni la actividad de una disciplina con historia, y el nombre repetido de actividad ignora también las tildes.

La disciplina (`colegio_actividad_horario`) es el eje del modelo: de ella cuelgan inscripciones, asignaciones de entrenador, evaluaciones y asistencias. Las cuatro **sin cascada**, y eso decide casi todo lo que hay aquí.

---

## 1. Las pruebas (numeradas, para responder por número)

Reescritas el **2026-10-02** con los casos difíciles: entrenadores en dos colegios, auxiliares, varios roles, bajas y lo que arrastran. Se prueba en `dev-pvcar.vercel.app` como **Propietario** salvo que diga otra cosa. Para entrar como otra persona, se le pone contraseña desde Usuarios (`dev` es una copia).

**Gente de `dev` que se usa:** Erika Robayo (`usu_id` 76, entrenadora de Los Chillos) · Elizabeth Mites (70, entrenadora de Calderón) · Carlos Idrobo (91, asistente de Elizabeth) · Alex López (60, entrenador sin disciplinas desde la prueba de la Fase 6) · Jean Carlo Barco (85, asistente de Alex) · **Prueba** (126, coordinador de Calderón).

### A. Arranque

| # | Prueba | Qué tiene que pasar |
|---|---|---|
| 1 | Abrir **Disciplinas** y **Entrenadores** | Cargan sin "Error interno del servidor" (el 500 del 2026-09-18) |
| 2 | Cabecera de Disciplinas | **94 disciplinas · 1 326 inscripciones · 18 sin entrenador** |

### B. Actividades

| # | Prueba | Qué tiene que pasar |
|---|---|---|
| 3 | Crear "Prueba F8" con categoría, espacios, indumentaria y 2 materiales | Al reabrirla, los materiales son **2 elementos**, no una frase |
| 4 | Crear otra llamada "FUTBOL G1" | **409**: ya existe "Fútbol G1" (sin mirar mayúsculas **ni tildes**) |
| 5 | Editar "Prueba F8": quitar la categoría y vaciar los materiales | Queda "Sin categoría" y sin materiales |
| 6 | Renombrar **Ajedrez** a "Ajedrez Escolar" | El nombre nuevo sale en las disciplinas de Ajedrez de **todos** los colegios. Después devolverle el nombre |
| 7 | Borrar **Ajedrez** | Bloqueado, diciendo cuántas disciplinas la usan |
| 8 | Borrar "Prueba F8" | Pide escribir el nombre; se borra |
| 9 | Buscar "futbol" y "percepcion" | Encuentran "Fútbol…" y "Percepción del entrenamiento PRIMERA" |

### C. Disciplinas: crear

| # | Prueba | Qué tiene que pasar |
|---|---|---|
| 10 | Lote: **Colegio de Pruebas Dev + Danza**, lunes y miércoles 15:00–16:00 | Se crean **2** |
| 11 | Lote: Danza, lunes 15:00–16:00 **y** viernes 15:00–16:00 | **409** por el lunes, y el **viernes tampoco** se crea |
| 12 | Lote: Danza, **martes 17:00–18:00 y martes 17:30–18:30** en el mismo envío | **409** por solape **entre las dos del mismo lote**; no se crea ninguna |
| 13 | Danza lunes **15:30–16:30** | **409** diciendo con qué horario choca (15:00–16:00) |
| 14 | Danza lunes **16:00–17:00** (empieza cuando la otra termina) | **Se permite** |
| 15 | **Guitarra** lunes 15:00–16:00 en el mismo colegio | **Se permite**: otra actividad a la misma hora es otro grupo |
| 16 | Danza lunes 15:00–16:00 en **otro** colegio | **Se permite** |
| 17 | Hora de fin antes o igual que la de inicio | El formulario no deja; si llegara, 400 |
| 18 | Danza **sábado** 09:00–10:00 | Sale en la columna del sábado |

### D. Disciplinas: editar

| # | Prueba | Qué tiene que pasar |
|---|---|---|
| 19 | Editar la Danza del lunes 15:00 (sin historia) y cambiarle la actividad a **Guitarra** | **409**: chocaría con la Guitarra de la 15 (el solape también se mira al editar). Cámbiala a **Fútbol** y sí se guarda |
| 20 | Editar **Ajedrez lunes 15:00 de Quitumbe** (`#56`, 145 asistencias) | Colegio y actividad **bloqueados con un candado** y el mensaje "ya tiene historia…" (**nuevo hoy**) |
| 21 | En esa misma, cambiar la hora a 15:30–16:30 | Aviso ámbar antes de guardar; se guarda. **Devolverla a 15:00–16:00** |
| 22 | Editar una disciplina con historia para que pise otra de **su misma actividad y colegio** | **409** |

### E. Lo cruzado: entrenadores, auxiliares, varios roles

| # | Prueba | Qué tiene que pasar |
|---|---|---|
| 23 | En **Entrenadores**, asignarle a **Erika** (Los Chillos) una disciplina **de Calderón** | En Disciplinas su nombre sale en sus 4 de Los Chillos **y** en la de Calderón; con el filtro de colegio Calderón, aparece allí |
| 24 | Entrar **como Erika** | Ve **sus 5** disciplinas de **los dos colegios**, sin botón de crear, y ninguna otra de Calderón |
| 25 | Entrar **como Prueba** (coordinador de Calderón) | Ve **todas** las de Calderón, incluida la de Erika con su nombre, y **ninguna** de Los Chillos (aunque Erika dé clase allí) |
| 26 | Entrar **como Carlos** (asistente de Elizabeth) | Ve **exactamente** las 4 de Elizabeth |
| 27 | Darle a **Prueba** también el rol **Entrenador** (Usuarios) y asignarle una disciplina **de Quitumbe** (Entrenadores). Entrar como Prueba | Ve **todo Calderón + esa de Quitumbe** (la unión de sus dos roles), y solo puede crear en Calderón |
| 28 | Entrar **como Alex** (entrenador sin disciplinas) | Calendario **vacío** con mensaje, **no** todas las del sistema (el fallo grave del sistema viejo) |
| 29 | Entrar **como Jean Carlo** (asistente de Alex) | Tampoco ve nada: hereda el alcance vacío de su titular |

### F. Baja, reactivación y borrado

| # | Prueba | Qué tiene que pasar |
|---|---|---|
| 30 | Dar de baja **la disciplina de Calderón que le diste a Erika** en la 23 | El modal dice cuántos alumnos y entrenadores arrastra. Al confirmar sale del calendario activo y los conteos bajan |
| 31 | Entrar como Erika | **Ya no la ve**; sigue viendo sus 4 de Los Chillos |
| 32 | En Entrenadores, ficha de Erika → historial | La de Calderón sale **cerrada con fecha de hoy**, no borrada |
| 33 | Filtro **Inactivas** en Disciplinas | Aparece la de la 30 |
| 34 | **Reactivarla** | Vuelve al calendario **"Sin entrenador" y sin alumnos**: la baja cerró las inscripciones y la asignación, y reactivar no las reabre |
| 35 | Dar de baja la Danza del miércoles (la 10), crear **otra** Danza miércoles 15:00–16:00 en el mismo colegio, y reactivar la vieja | **409**: el hueco ya está ocupado |
| 36 | Borrar **Ajedrez lunes de Quitumbe** (`#56`) | Bloqueado, con el recuento de inscripciones, asignaciones, evaluaciones y asistencias |
| 37 | Borrar una Danza creada hoy | Pide escribir "Danza"; se borra |
| 38 | Borrar la actividad **Danza** cuando solo le quede una disciplina **de baja** | **Bloqueado**: la disciplina de baja conserva su historia |

### G. Herencia de los datos viejos

| # | Prueba | Qué tiene que pasar |
|---|---|---|
| 39 | Buscar las disciplinas de **Odalys Lema**, **Ricardo Moya**, **Willian Bone** o **Bernard Rosario** | Salen con su nombre como entrenador **aunque su usuario está de baja**, y cuentan como "con entrenador". Es dato heredado: en la plataforma nueva dar de baja a un usuario cierra sus asignaciones y no puede volver a pasar. **Dime si quieres que salgan marcados** |

### H. Pantalla

| # | Prueba | Qué tiene que pasar |
|---|---|---|
| 40 | Buscador del calendario: "calderon", "ajedrez", "lunes" | Encuentra por colegio, actividad y día, sin tildes |
| 41 | Filtro **Sin entrenador** | Coincide con el número de la cabecera |
| 42 | Móvil 360 px | Calendario en una columna, filtros apilados, modal de lote y de edición usables |
| 43 | Modo oscuro | Tarjetas, aviso ámbar, candado y "Sin entrenador" legibles |
| 44 | Modo oscuro, color primario (heredada de la Fase 7) | Todo lo seleccionado o marcado con el color primario **se lee** (antes era blanco sobre blanco) |
| 45 | Modo oscuro, texto secundario (heredada de la Fase 7) | Leyendas y conteos más tenues que el texto normal, no igual de blancos |

Al terminar, yo verifico por MCP la auditoría de cada alta, baja, edición y borrado, y te digo qué queda por limpiar en `dev`.

---

## 2. Qué se construyó

### Backend

**`modules/actividades/`** — `GET /actividades` (paginado, búsqueda, filtro por categoría, con los conteos de disciplinas y colegios donde se usa), `GET /actividades/categorias`, `GET /:id`, `POST`, `PATCH /:id`, `GET /:id/impacto`, `DELETE /:id`.

**`modules/disciplinas/`** — `GET /disciplinas` (alcance, filtros por colegio/actividad/día/estado/sin-entrenador, con conteos), `GET /disciplinas/dias`, `GET /:id`, `POST` (lote), `PATCH /:id`, `GET /:id/previo-baja`, `POST /:id/baja`, `POST /:id/reactivar`, `GET /:id/impacto`, `DELETE /:id`.

**`lib/sql.ts`** — comparación de texto sin tildes, usada ya en los cuatro módulos.

### Base de datos

`0008_unicidades_fase8.sql` — nombre de actividad único (sin mayúsculas) y disciplina única (colegio + actividad + día + hora). Aplicada en dev y prod el 2026-09-17. Las tildes las cubre el backend.

### Frontend

`api/actividades.ts`, `api/disciplinas.ts`, `hooks/useActividades.ts`, `hooks/useDisciplinas.ts`, las dos páginas reescritas y los componentes: `ActivityCard`, `ActivityForm`, `MaterialesInput`, `EliminarActividadDialog`, `DisciplinaCalendar`, `DisciplinaCard`, `DisciplinaLoteForm`, `DisciplinaForm`, `BajaDisciplinaDialog`, `EliminarDisciplinaDialog`.

**Borrados por inservibles (18 archivos):** `ActivityDetails`, `ActivityDialogs`, `ActivityFilters`, `ActivityHeader`, `ActivitySearch`, `ActivityTable`, `ActivityWallet`, `AllActivitiesView`, `CategoryEnvelope`, `WalletCategoryView`, `ColegioFilter`, `DeleteDisciplinaDialog`, `DisciplinaMultiForm`, `DisciplinaTable`, `DisciplinasFilters`, `DisciplinasHeader`, `DisciplinasManager`, `EditDisciplinaForm`.

---

## 3. Qué se arregló del sistema viejo

| Antes | Ahora |
|---|---|
| `DisciplinasManager` decidía el alcance en el navegador con cinco ramas y `return` temprano por rol; **si la lista de permitidos salía vacía, devolvía todas las disciplinas del sistema** | Una sola función en el servidor, y las dos vías (por disciplina y por colegio) cuentan |
| Se podían crear dos disciplinas idénticas | 409 por duplicado y por solape, más índice único en la base |
| Nada comprobaba que la hora de fin fuera posterior a la de inicio | Validado en zod y otra vez en el servicio al editar |
| Borrar decía "revise que no tenga nada atado (Entrenador, Alumnos, Evaluaciones)" | Recuento exacto antes de confirmar, y **baja lógica** como salida real |
| `est_id` existía en la tabla y nadie lo usaba: las 94 disciplinas están activas y no había forma de retirar una | Baja y reactivación, con cierre de inscripciones y asignaciones |
| El calendario era una rejilla fija de 7 columnas que no cabía en 360 px | Un solo markup que se apila; los días vacíos se ven |
| Los conteos de la cabecera se calculaban sobre el array cargado | En SQL, sobre el filtro actual |
| Los materiales de una actividad se partían por comas en el navegador | Lista de verdad, un elemento por material |
| Dos vistas conmutables de actividades ("sobres" y rejilla) + modal de detalles | Una vista: la tarjeta ya enseña el detalle |
| Buscar "futbol" no encontraba "Fútbol G1"; "calderon" no encontraba "Calderón" | Búsqueda sin tildes en Usuarios, Colegios, Actividades y Disciplinas |
| 15 `console.log` con datos de personas | Ninguno |

---

## 4. Decisiones

| Decisión | Por qué |
|---|---|
| **La disciplina sí tiene baja lógica**, el colegio y la actividad no | Es la única de las tres que no se puede borrar nunca (cuatro FK sin cascada) y la única que deja de impartirse cada periodo |
| Dar de baja **cierra** inscripciones y asignaciones | Si no, el alumno queda inscrito en algo que ya no existe y el entrenador la sigue viendo en su alcance |
| Reactivar **no** reabre nada | Misma regla que en Usuarios: reabrir a ciegas resucita vínculos que quizá ya no corresponden |
| El solape se rechaza solo entre la **misma actividad** | Dos actividades a la misma hora en el mismo colegio son legítimas: son dos grupos en espacios distintos |
| Borrar una disciplina se confirma escribiendo **la actividad** | Pedir "Futbol G2 — Quitumbe, lunes 15:00" sería un dictado |
| Las actividades no llevan alcance | "Karate" es el mismo en los siete colegios; el colegio entra en Disciplinas |
| El calendario no se pagina | Se lee entero; pedir 200 de una vez es una consulta, paginarlo de siete en siete lo hace ilegible |

---

## 5. Verificado sin backend

- **SQL contra `PVCAR_Dev` por MCP:** lista de disciplinas por alcance (las 4 del auxiliar, con entrenador, alumnos y evaluaciones), conteos globales (94 · 1326 inscripciones · 14 sin entrenador · 0 de baja), duplicado exacto, `OVERLAPS` con y sin exclusión de la propia fila, lista de actividades con sus dos conteos, y la búsqueda sin tildes ("futbol" pasa de 10 a 24 coincidencias).
- **Las 6 FK** que apuntan a `colegio_actividad_horario`, `actividad` y `categoria`: ninguna con cascada → todas bloqueo. Cuadra con lo que dice el modal.
- **55 pruebas automáticas nuevas** (13 + 14 de validación, 12 de las puertas del servicio, 16 rutas cerradas sin token) → **160 en el backend**.
- `typecheck`, `lint` (0 errores), `test` y `build` en verde.
