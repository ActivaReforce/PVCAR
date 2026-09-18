# Fase 8 — Actividades y Disciplinas

Estado al **2026-09-18**. Construido y en `dev`. **La siguiente de la cola de pruebas**, tras cerrar la Fase 7.

La disciplina (`colegio_actividad_horario`) es el eje del modelo: de ella cuelgan inscripciones, asignaciones de entrenador, evaluaciones y asistencias. Las cuatro **sin cascada**, y eso decide casi todo lo que hay aquí.

---

## 1. Las pruebas

### Actividades

| Prueba | Qué tiene que pasar |
|---|---|
| Crear | Con categoría, espacios, indumentaria y dos materiales. Los materiales se guardan como lista, no como cadena |
| Nombre repetido | 409, también con otra caja o tildes distintas |
| Editar | Quitar la categoría (queda "Sin categoría") y vaciar la lista de materiales |
| Borrar una en uso | Bloqueada, diciendo cuántas disciplinas la usan |
| Borrar una sin usar | Exige escribir el nombre; se va y queda en `auditoria` |
| Buscar sin tildes | "futbol" encuentra "Fútbol G1" |

### Disciplinas

| Prueba | Qué tiene que pasar |
|---|---|
| Crear por lote | Colegio + actividad + lunes y miércoles + 15:00–16:00 → **2** disciplinas, una transacción |
| Duplicada | Repetir una que ya existe → 409, y **ninguna** de las del lote entra |
| Solapada | Misma actividad y colegio el mismo día de 15:30 a 16:30 → 409 diciendo con qué horario choca |
| Hora invertida | Fin ≤ inicio → 400 |
| Editar con historial | Cambiar el día de una con alumnos → el formulario avisa antes de guardar |
| Dar de baja | Modal con el recuento; al confirmar, las inscripciones activas quedan cerradas con fecha y las asignaciones de entrenador con `entasig_fecha_fin` = hoy |
| Reactivar | Vuelve al calendario; las inscripciones **no** se reabren |
| Reactivar con el hueco ocupado | Si mientras estaba de baja se creó otra igual → 409 |
| Borrar con historial | Bloqueada, con el recuento de inscripciones, asignaciones, evaluaciones y asistencias |
| Borrar una recién creada | Exige escribir la actividad; se va |
| Alcance | Coordinador: solo las de sus colegios. Entrenador: solo las suyas, sin botón de crear. `GET /disciplinas/:id` ajena → 403 |
| Conteos | "94 disciplinas · 1326 inscripciones · 14 sin entrenador" cuadran con SQL |
| Móvil 360 px | Calendario en una columna, filtros apilados, modal de lote usable |
| Modo oscuro | Tarjetas, avisos y el texto "Sin entrenador" legibles |

### Heredadas de la Fase 7

Dos arreglos se hicieron **después** de que el cliente probara la Fase 7, así que no llegó a verlos en pantalla. Los dos son globales y se comprueban aquí sin montar nada aparte.

| Prueba | Qué tiene que pasar |
|---|---|
| **Contraste en oscuro** | En modo oscuro, cualquier cosa seleccionada o marcada con el color primario tiene que **leerse**. El fallo era blanco sobre blanco y venía de `ThemeContext`, que pisaba seis tokens con un valor inválido; afectaba a todo `bg-primary` y dejaba el texto apagado en blanco puro. Si algo sigue ilegible, es que queda otro token mal |
| **Texto apagado** | Las leyendas, los conteos y los mensajes secundarios tienen que verse **más tenues** que el texto normal, no igual de blancos |

---

## 2. Qué se construyó

### Backend

**`modules/actividades/`** — `GET /actividades` (paginado, búsqueda, filtro por categoría, con los conteos de disciplinas y colegios donde se usa), `GET /actividades/categorias`, `GET /:id`, `POST`, `PATCH /:id`, `GET /:id/impacto`, `DELETE /:id`.

**`modules/disciplinas/`** — `GET /disciplinas` (alcance, filtros por colegio/actividad/día/estado/sin-entrenador, con conteos), `GET /disciplinas/dias`, `GET /:id`, `POST` (lote), `PATCH /:id`, `GET /:id/previo-baja`, `POST /:id/baja`, `POST /:id/reactivar`, `GET /:id/impacto`, `DELETE /:id`.

**`lib/sql.ts`** — comparación de texto sin tildes, usada ya en los cuatro módulos.

### Base de datos

`0008_unicidades_fase8.sql` — nombre de actividad único y disciplina única (colegio + actividad + día + hora). **Pendiente en las dos bases**, igual que `0006` y `0007`. El backend ya rechaza los dos casos por su cuenta, así que el código no depende de que estén aplicados.

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
