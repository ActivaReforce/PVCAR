# Mapa de módulos — sistema viejo

Levantado el 2026-08-06 sobre `activa-forge-login/` (la SPA en producción) y contrastado con el esquema de `PVCAR_Dev`, que ya tiene los datos reales del respaldo del 2026-07-27.

Sirve para dos cosas: saber qué hay que reconstruir en las Fases 6–14, y dejar por escrito **qué está mal hecho** para no copiarlo. El cliente lo pidió explícito: *"analiza qué está mal y mejora, todo estaba funcionando pero se usaron métodos y malas prácticas"*.

---

## 1. Cómo está montado hoy

SPA de Vite + React + TypeScript + shadcn/ui. **329 archivos** `.ts`/`.tsx` en `src/`, de los cuales **125 importan el cliente de Supabase directamente**. No hay backend: el navegador habla con la base con la anon key.

- **27 pantallas** (`src/pages/`), 10 de ellas son reportes.
- **39 hooks** propios (`src/hooks/`), casi todos con consultas dentro.
- **3 contextos**: `AuthContext` (sesión y permisos), `SharedDataContext` (caché de asignaciones), `ThemeContext`.
- **Autenticación propia** contra la tabla `usuario`, con la contraseña en claro. Cero llamadas a `supabase.auth`. Ya reemplazada en la Fase 5; se documenta porque explica el diseño del resto.

Los permisos salen de `rol_permiso (rol_id, modulo, accion)`, con 14 módulos declarados en `src/constants/modules.ts` y cuatro acciones: `ver`, `crear`, `editar`, `eliminar`. `AuthContext` los carga al entrar y los guarda en `localStorage`.

---

## 2. El eje del modelo: `colegio_actividad_horario`

Es la pieza que hay que entender antes de diseñar cualquier módulo. En el negocio se llama **disciplina**: la combinación de un colegio, una actividad, un día de la semana y una franja horaria.

```
colegio ─┐
actividad ┼─> colegio_actividad_horario (colacthor_id)  ← "una disciplina"
dia ──────┘            │
                       ├── nino_asignacion        (qué niño está inscrito)
                       ├── entrenador_asignacion  (qué entrenador la da)
                       ├── evaluacion_asignacion  (qué evaluación se aplica)
                       └── asistencia_nino        (la asistencia de una sesión)
```

Cuatro tablas cuelgan de `colacthor_id` por clave foránea. Todo lo que se ve en pantalla —listas de estudiantes, asistencias, evaluaciones pendientes— es una consulta que pasa por ahí. **Diseñar Usuarios o Estudiantes sin tener esto resuelto obliga a rehacerlo después.**

Tres detalles del modelo que condicionan la API nueva:

- **`entrenador` comparte clave primaria con `usuario`**: `entrenador.ent_id` es FK a `usuario.usu_id`. Un entrenador *es* un usuario, no una entidad aparte. El código viejo se apoya en esa igualdad en todas partes (`.eq('ent_id', user.usu_id)`).
- **`padre` es 1:1 con `usuario`** por `padre.usu_id`.
- **El alcance de cada rol se calcula por caminos distintos**: un coordinador ve sus colegios por `colegio_coordinador`; un entrenador, por `entrenador_asignacion → colegio_actividad_horario.col_id`; un auxiliar, resolviendo primero su entrenador en `entrenador_auxiliar` y repitiendo el camino del entrenador.

Dos triggers escriben solos y hay que tenerlos presentes al diseñar la API:

- `nino_asignacion` AFTER INSERT → crea las filas de `evaluacion_nino_pendiente` de las evaluaciones activas de esa disciplina.
- `evaluacion_parametro` AFTER INSERT/UPDATE/DELETE → recalcula `evaluacion.eva_puntaje_total`.

---

## 3. Los módulos

| Módulo | Ruta | Tablas que toca | Dónde vive la lógica |
|---|---|---|---|
| **Tablero** | `/dashboard` | `nino`, `usuario`, `colegio`, `actividad`, `colegio_actividad_horario`, `asistencia_nino`, `asistencia_entrenador`, `evaluacion`, `evaluacion_asignacion`, `encuesta` | 4 tableros distintos por rol: `useDashboardData`, `useCoordinatorDashboardData`, `useTrainerDashboardData`, `useParentDashboardData` |
| **Usuarios** | `/usuarios` | `usuario`, `usuario_rol`, `rol`, `entrenador`, `padre`, `colegio_coordinador`, `entrenador_asignacion` | `useUserForm`, `useUserFormSubmission`, `useRoleTransitions`, `usePhotoUpload` |
| **Colegios** | `/colegios` | `colegio`, `colegio_coordinador`, `usuario_rol`, `nino`, `nino_asignacion` | `useSchoolCounts`, `components/schools/` |
| **Actividades** | `/actividades` | `actividad`, `categoria` | `components/activities/` |
| **Disciplinas** | `/disciplinas` | `colegio_actividad_horario`, `colegio`, `actividad`, `dia`, `entrenador`, `entrenador_asignacion`, `entrenador_auxiliar`, `nino_asignacion` | `components/disciplinas/` |
| **Entrenadores** | `/entrenadores` | `entrenador`, `entrenador_asignacion`, `entrenador_auxiliar`, `colegio_actividad_horario`, `colegio_coordinador` | `useEntrenadoresData`, `useAuxiliaryTrainers`, `useCoachStatusUpdates` |
| **Estudiantes** | `/estudiantes` | `nino`, `nino_asignacion`, `nino_padre`, `padre`, `colegio`, `categoria_nino_grado`, `colegio_actividad_horario` | `useEstudiantesData`, `useStudentsPagination`, `useStudentCounts`, `useEstudianteDisciplinas` |
| **Evaluaciones** | `/evaluaciones` | `evaluacion`, `evaluacion_parametro`, `evaluacion_asignacion`, `evaluacion_nino_pendiente`, `evaluacion_intento`, `evaluacion_tiempo_rangos`, `evaluacion_tipo_metodo` | `useEvaluations`, `useDeleteEvaluation` (RPC), `useDeleteEvaluationTemplate` |
| **Asistencias — estudiantes** | `/asistencias` | `asistencia_nino`, `asistencia_estado`, `nino_asignacion`, `colegio_actividad_horario`, `dia` | `useAttendanceData`, `components/attendance/` |
| **Asistencias — entrenadores** | `/attendance/coaches` | `asistencia_entrenador`, `asistencia_auxiliar`, `asistencia_estado`, `entrenador_asignacion`, `entrenador_auxiliar`, `colegio`, `colegio_coordinador`, `dia` | Todo dentro de `AsistenciasEntrenadores.tsx` (743 líneas) |
| **Encuestas** | `/encuestas`, `/encuestas/:id` | `encuesta`, `encuesta_pregunta`, `encuesta_respondida`, `encuesta_respuesta`, `encuesta_tipo_respuesta`, `padre` | 25 componentes + 6 hooks. **Cero filas en producción.** |
| **Reportes** | `/reportes/*` | 29 tablas — prácticamente todas | 21 componentes en `components/reports/`, dos pestañas por reporte |
| **Perfil** | `/perfil` | `usuario` | `Perfil.tsx` |
| **Permisos** | `/permisos` | `rol`, `rol_permiso` + RPC `set_role_permissions` | `Permisos.tsx` |

**Encuestas y Padres no se usaron nunca**: `encuesta`, `encuesta_pregunta`, `encuesta_respondida`, `encuesta_respuesta`, `padre` y `nino_padre` tienen cero filas en producción. Es código vivo sobre datos que no existen.

---

## 4. Qué está mal

Ordenado por gravedad. Cada punto lleva qué hacer en el sistema nuevo.

### H1 — La autorización vive en el navegador *(crítico)*

Quién ve qué se decide en el cliente. `useEstudiantesData` resuelve los colegios permitidos y luego añade un `.in('col_id', allowedColegioIds)` a la consulta. Si esa lista sale vacía, **el filtro no se aplica y se devuelve todo**. Y en cualquier caso, quien tenga la anon key —está en el JavaScript servido, es pública por diseño— consulta la tabla entera sin pasar por ese código.

**Nuevo:** el alcance se decide en el backend, a partir del token, en una sola función de dominio (`alcanceDe(usuario)`) que devuelve los `col_id` y `colacthor_id` permitidos y de la que dependen todas las consultas. RLS como segunda capa, no como única.

### H2 — Escrituras multi-paso sin transacción

Guardar un usuario dispara hasta seis escrituras sueltas: transiciones de rol, `update usuario`, `delete usuario_rol`, `insert usuario_rol`, y `insert`/`update` en `entrenador` o `padre`. Si falla la cuarta, el usuario queda **sin ningún rol**. Lo mismo al dar de baja a un estudiante: `nino` y `nino_asignacion` se actualizan por separado.

**Nuevo:** una operación de negocio = una transacción en el backend. Las que tocan varias tablas van en función SQL o en una transacción explícita.

### H3 — Traer todo y filtrar en el cliente

`useEstudiantesData` pide los 796 niños **con sus padres, usuarios, colegio y grado anidados**, y después cuenta activos e inactivos con `.filter()` en JavaScript. En toda la aplicación hay **3 usos de `.limit()` y 2 de `.range()`**. Los conteos de tarjetas del tablero se calculan igual: descargando filas.

**Nuevo:** paginación y filtros en el servidor (`?page`, `?colegio`, `?estado`), conteos con `count` en SQL, y `select` de las columnas que se usan, no `*`.

### H4 — Datos personales de más viajando al navegador

La consulta de estudiantes trae anidado el `usuario` del padre **incluyendo `usu_contrasena`**. Además hay 37 `console.log`, y el de Usuarios imprime el objeto completo del formulario con la contraseña dentro.

**Nuevo:** la columna ya no existe (la Fase 5 la eliminó), pero el patrón sí: cada endpoint devuelve solo los campos de su pantalla. Nada de `select('*')` con joins anidados a `usuario`. Logs sin cuerpos.

### H5 — Números mágicos por todas partes

`rol_id === 3` aparece 23 veces, `rol_id === 2` 19 veces, `est_id === 1` 29 veces. El significado —3 es entrenador, 1 es activo— no está escrito en ningún sitio. Cambiar un catálogo obliga a buscar y reemplazar por 300 archivos.

**Nuevo:** enums o constantes con nombre en un módulo compartido (`ROL.ENTRENADOR`, `ESTADO.ACTIVO`), derivados del catálogo, y comparaciones por esa constante.

### H6 — La misma regla escrita seis veces

"Qué colegios ve este usuario" está reimplementado en `useEstudiantesData`, `useStudentsPagination`, `useStudentCounts`, `useSchoolCounts`, `useAttendanceData` y `SharedDataContext`, con variantes. Ya divergen: unas contemplan al auxiliar y otras no.

**Nuevo:** una sola función, en el backend, y los módulos la usan.

### H7 — Dos modelos de estado conviviendo

38 archivos usan react-query; 70 usan `useEffect` + `useState` a mano. Para comunicar los dos mundos hay un **evento del DOM inventado**: `window.dispatchEvent('disciplineAssignmentChanged')`, que `useEstudiantesData` escucha para recargar. Es un canal invisible que se rompe sin avisar.

**Nuevo:** react-query como única fuente, invalidando por clave. Sin eventos del DOM para sincronizar datos.

### H8 — Tipos que no protegen

`: any` aparece 114 veces, muchas para escapar de los tipos generados de Supabase en los joins anidados (`(assignment.colegio_actividad_horario as any).col_id`). El compilador no está comprobando nada en los sitios que más lo necesitan.

**Nuevo:** los tipos de la API los define el backend y los comparte el front. Cero `any` en la capa de datos.

### H9 — Detalles que engañan

`useEstudiantesData` crea un `AbortController`, lo aborta al desmontar… y nunca se lo pasa a ninguna consulta: no cancela nada. Y los roles se guardan borrando todos e insertando de nuevo, lo que pierde la traza de cuándo se concedió cada uno y deja al usuario sin roles si el insert falla.

**Nuevo:** cancelación real (la que trae react-query) y actualización de roles por diferencia, no por borrado.

---

## 5. Qué implica para el orden de las Fases 6–14

El orden que se sostiene solo, por dependencias reales:

1. **Usuarios, roles y permisos** — todo lo demás necesita saber quién eres y qué alcance tienes. Aquí se construye `alcanceDe(usuario)` (H1) y el catálogo de constantes (H5).
2. **Colegios, Actividades y Disciplinas** — el eje `colegio_actividad_horario`. Sin esto, ni Estudiantes ni Asistencias tienen de dónde colgar.
3. **Entrenadores** — asignaciones y auxiliares; es quien puebla el alcance de los roles 3, 6 y 7.
4. **Estudiantes** — inscripciones sobre disciplinas. Primer módulo con paginación de verdad (H3).
5. **Asistencias** (estudiantes y entrenadores) — el mayor volumen: 13 202 filas.
6. **Evaluaciones** — la parte con más lógica de negocio; ojo a los dos triggers.
7. **Reportes** — depende de todo lo anterior; se hace al final por eso, no por prioridad.
8. **Encuestas y Padres** — cero datos reales. Último, y con la pregunta de si se reconstruyen (ver abajo).

---

## 6. Decisiones del cliente — 2026-08-07

### D1 — Encuestas a padres: se mantienen

El módulo sigue en el alcance. *"Se tiene que poder hacer encuestas a los padres; puedes reconstruirlo para que funcione mejor si es necesario, pero mantente a la idea."*

Traducción: misma funcionalidad —crear encuestas con preguntas de varios tipos, publicarlas, que los padres respondan, ver resultados—, implementación libre. Al no haber datos reales que respetar (cero filas), no hay compatibilidad hacia atrás que cuidar: **es el único módulo donde el esquema se puede corregir sin coste de migración**. Sigue siendo el último de la lista por prioridad de negocio, no por dificultad.

### D2 — Varios roles por usuario: esencial, y hay que arreglarlo

*"Es esencial que alguien pueda tener dos o más roles, y eso hay que mejorar porque antes había problemas."*

Los problemas que recuerda están en el código, localizados. La función que calcula el alcance decide **por el primer rol que encuentra y se sale**:

```ts
if (user.roles?.some(role => role.rol_id === 2)) {   // coordinador
   ...return colegios de colegio_coordinador          // <- sale aquí
}
if (user.roles?.some(role => role.rol_id === 3)) {   // entrenador
   ...return colegios de entrenador_asignacion
}
```

Quien sea coordinador **y** entrenador ve solo sus colegios de coordinador: las disciplinas que él mismo imparte desaparecen de su pantalla. El mismo patrón se repite en la elección de tablero (cada rol tiene el suyo y solo se muestra uno) y en los permisos, que sí se unen bien porque salen de un `IN` sobre `rol_permiso`.

**Regla para el sistema nuevo:** el alcance de un usuario es la **unión** de los alcances de todos sus roles, calculada en el backend en una sola función. Nunca un `return` temprano por rol. Donde hoy hay un tablero por rol, el usuario con varios roles debe poder ver los dos —por pestañas o por selector—, no que se le elija uno.

### D3 — Baja lógica y borrado permanente: los dos, con avisos

*"Quiero poder dar de baja a alguien, y si en algún punto se quiere eliminar para siempre se debe poder hacerlo. Me imagino que si se elimina a un niño permanentemente se elimina todo su historial de todo. Deben existir avisos y modales de confirmación con la advertencia."*

Confirmado en el esquema: **el borrado en cascada ya está puesto y arrastra todo**.

```
nino ──ON DELETE CASCADE──> nino_asignacion ──> evaluacion_nino_pendiente ──> evaluacion_intento
  ├──ON DELETE CASCADE──> asistencia_nino
  └──ON DELETE CASCADE──> nino_padre
```

Borrar un niño destruye su historial entero de asistencias, inscripciones y evaluaciones sin preguntar nada a la base. Es lo que el cliente quiere, pero hoy ocurre **en silencio**: el código viejo solo prevé el error de clave foránea, que con estas reglas no llega a producirse nunca.

**Cómo se hace en el sistema nuevo:**

1. Dos operaciones distintas y separadas en la interfaz: **dar de baja** (`est_id = 2`, reversible, la de todos los días) y **eliminar definitivamente** (irreversible).
2. El borrado exige el permiso `estudiantes.eliminar`, comprobado en el backend.
3. Antes de confirmar, el backend devuelve **el recuento exacto de lo que se va a destruir** y el modal lo muestra: *"Se eliminarán 47 asistencias, 3 inscripciones y 2 evaluaciones. Esta acción no se puede deshacer."*
4. La confirmación no es un botón: hay que **escribir el nombre del estudiante**. Un clic de más no puede borrar un historial.
5. Queda registro de quién borró qué y cuándo, en una tabla de auditoría que hoy no existe y que habrá que crear (propuesta para la Fase 6, junto con Usuarios).

Lo mismo aplica a usuarios y entrenadores, con una diferencia importante: `asistencia_nino.usu_registrador` y `evaluacion.eva_creador` apuntan a `usuario` **sin cascada**, así que borrar un usuario que registró asistencias fallará por clave foránea. Ahí el borrado permanente solo puede ofrecerse cuando no queda nada que lo referencie; si queda, la interfaz debe decir por qué no se puede y ofrecer la baja lógica.
