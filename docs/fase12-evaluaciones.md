# Fase 12 — Evaluaciones

Estado al **2026-09-17**. Construido y en `dev`. **Sin probar contra el API.**

La parte con más lógica de negocio del sistema, y la menos usada: en producción hay **5 evaluaciones, 72 vínculos, 1 261 pendientes y un solo intento registrado**. Sus huecos no han hecho daño todavía; eso no significa que no estén.

---

## ⚠️ Antes de probar nada: correr `0011`

**El módulo no funciona sin `SQL/0011_evaluaciones_integridad.sql`.** Vincular una evaluación a una disciplina hace un `INSERT ... ON CONFLICT (eva_id, ninoasig_id)` y ese índice único lo crea la migración. Sin ella la operación falla con:

```
42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

Comprobado contra `PVCAR_Dev`. `0010` (Fase 11) también está pendiente; van en orden.

---

## 1. Lo que hay que probar

### La plantilla

| Prueba | Qué tiene que pasar |
|---|---|
| Crear una evaluación con **un parámetro de cada método** | Se guarda en una sola operación. El **puntaje total lo pone el trigger**: comprobar que `eva_puntaje_total` = suma de los parámetros |
| Parámetro por tiempo sin umbrales | 400 diciendo que necesita sus dos umbrales |
| Umbrales incoherentes (`0 pts si < 10s` y `todo si < 5s`) | 400 antes de tocar la base |
| Parámetro por escala sin máximo | 400 |
| Editar y añadir un parámetro | El total sube solo |
| Borrar un parámetro **con notas puestas** | 409 que dice cuántas. No un error de clave foránea |
| Cambiar el método de un parámetro **con notas puestas** | 409. El selector ya sale bloqueado con el motivo |
| Dar de baja / reactivar | La evaluación sale de activas; vínculos y notas se conservan |
| Eliminar permanentemente | Modal con el recuento real (parámetros, vínculos, pendientes, evaluados, intentos), exige escribir el título |

### Vincular a disciplinas

| Prueba | Qué tiene que pasar |
|---|---|
| Vincular una evaluación **sin parámetros** | 409: configúralos antes |
| Vincular una disciplina con 40 alumnos | **En la base aparecen 40 `evaluacion_nino_pendiente` con `est_id = 6`**, en una sola transacción |
| Inscribir un alumno nuevo en esa disciplina (desde Alumnos) | Le aparece su pendiente sola: lo hace el trigger `trigger_nino_asignacion_evaluation` |
| **Desvincular una disciplina con alumnos ya evaluados** | Las pendientes pasan a `est_id = 2` y **las notas siguen ahí**. Contar filas antes y después: no debe desaparecer ninguna |
| Volver a vincular una que estuvo | Reactiva el vínculo y las pendientes, no duplica |
| Coordinador vinculando una disciplina de otro colegio | 403 |
| Coordinador guardando su lista | **No desvincula** las disciplinas de otros colegios que él no ve |

### Evaluar alumnos

| Prueba | Qué tiene que pasar |
|---|---|
| Evaluar por **tiempo** en un valor intermedio | Interpolación lineal. Con `0 pts si >= 30s`, `todo si <= 10s` y 10 puntos: **20s → 5 pts**, 25s → 2.5, 13s → 8.5. Comprobar a mano |
| **Mobak de 6** con puntuación 4 | 1 punto sobre 2 (o la mitad del puntaje del parámetro, ver §4) |
| **Mobak de 2** con puntuación 2 | El puntaje completo |
| **Por escala** 0–5 con 10 puntos, valor 2 | 4 puntos |
| **Por logro** | Todo o nada |
| Registrar todos los intentos | El alumno pasa a **Evaluado** con fecha de finalización y queda quién lo evaluó |
| Registrar solo algunos | Sigue **pendiente**, y el modal lo avisa |
| Modificar una evaluación ya hecha | Se reemplaza entera y aparece **una fila en `auditoria`** |
| Borrarla | Los intentos desaparecen y el alumno vuelve a pendiente |
| Entrenador evaluando una disciplina ajena | 403 |
| Mandar un valor que no corresponde al método (por API) | 400, y **sin haber borrado nada** |
| **360 px** | Un parámetro por pantalla con barra de avance, botones de 44 px, "Anterior / Siguiente / Guardar" abajo |
| Modo oscuro | Badges de puntaje y avisos legibles |

---

## 2. Qué se construyó

### Migración `0011_evaluaciones_integridad.sql`

Ver `SQL/ORDEN.md`. Dos índices únicos, cuatro `NOT NULL`, un `CHECK` y el cambio de `real` a `numeric(6,2)` en el puntaje obtenido. **0 filas afectadas** en dev.

### Backend — `modules/evaluaciones/`

| Endpoint | Permiso | Qué hace |
|---|---|---|
| `GET /evaluaciones` | `ver` | Página filtrada por alcance, con conteos |
| `GET /evaluaciones/metodos` · `/categorias` | `ver` | Los 5 métodos · las categorías ya usadas |
| `GET /evaluaciones/:id` | `ver` | Ficha con parámetros y umbrales |
| `POST /evaluaciones` | `crear` | Alta con parámetros, en una transacción |
| `PATCH /evaluaciones/:id` | `editar` | Detalles |
| `PUT /evaluaciones/:id/parametros` | `editar` | La lista completa: crea, actualiza y borra |
| `GET` · `PUT /evaluaciones/:id/disciplinas` | `ver` · `editar` | Vinculadas y disponibles · sincronizar |
| `POST /evaluaciones/:id/baja` · `/reactivar` | `editar` | Baja lógica |
| `GET /evaluaciones/:id/impacto` · `DELETE` | `eliminar` | Recuento · borrado con confirmación por título |
| `GET /evaluaciones/pendientes?evaluacion&disciplina` | `ver` | Alumnos con su estado, su puntaje y **cuántos faltan** |
| `GET /evaluaciones/pendientes/:id` | `ver` | Parámetros e intentos de un alumno |
| `PUT /evaluaciones/pendientes/:id/intentos` | `editar` | Puntúa, guarda y decide si queda evaluado |
| `DELETE /evaluaciones/pendientes/:id` | `editar` | Borra los intentos y vuelve a pendiente |

**Evaluar pide `editar`, no `crear`:** en `rol_permiso`, `crear` lo tienen Propietario y Coordinador, y `editar` además el **Entrenador** — que es quien evalúa. Si pidiera `crear`, ningún entrenador podría hacer su trabajo.

**77 pruebas automáticas nuevas** (backend: 333 en total, antes 256). **31 son solo del scoring**, método a método, con sus bordes y sus entradas equivocadas: es lo único del sistema donde un error silencioso cambia la nota de un niño.

Las consultas nuevas, ejecutadas contra `PVCAR_Dev` por MCP; los `INSERT` validados con `PREPARE` y con `EXPLAIN` —que es justo lo que destapó la dependencia con `0011`.

### Frontend

`api/evaluaciones.ts`, `hooks/useEvaluaciones.ts`, la página reescrita y siete componentes en `components/evaluaciones/`: `EvaluacionesLista`, `EvaluacionForm`, `ParametroCampos`, `VincularDisciplinasDialog`, `EliminarEvaluacionDialog`, `EvaluarAlumnos`, `EvaluarAlumnoDialog` y `metodos.ts`.

**Borrado por inservible:** `components/evaluations/` entera (23 archivos, ~6 000 líneas, con `EvaluateStudentModal.tsx` de 1 132 y `EvaluationsTable.tsx` de 519), más `useEvaluations`, `useDeleteEvaluation`, `useDeleteEvaluationTemplate`, `useTrainerEvaluationContext` y `estudiantes/RemoveDisciplineDialog`, que solo seguía vivo porque lo usaba el modal de vincular (así quedó anotado al cerrar la Fase 10).

---

## 3. Lo que se arregló del sistema viejo

| Estaba mal | Ahora |
|---|---|
| **Desvincular una disciplina borraba las notas.** `DELETE` de todas las pendientes de esa disciplina, evaluadas incluidas, sin avisar y sin transacción | Desactiva las que siguen pendientes y **conserva lo evaluado**. El diálogo dice cuántas notas hay en juego antes de guardar |
| **El scoring vivía en el navegador**: interpolación de tiempo y tablas Mobak en tres archivos del front. Dos versiones cargadas podían dar dos notas distintas | Un solo servicio en el backend, con 31 pruebas. El front manda lo registrado y muestra lo que devuelve el servidor |
| Vincular creaba las pendientes con **dos peticiones por alumno** en un bucle desde el navegador, y los fallos se tragaban con `console.error` | Un `INSERT ... SELECT` dentro de una transacción |
| El borrado de la evaluación de un alumno iba por la RPC `delete_student_evaluation`, `SECURITY DEFINER`, **abierta a la anon key** hasta `0005_grants.sql` | Endpoint con permisos y alcance. La RPC sigue en el esquema pero ya no es el camino |
| Nada impedía **cambiarle el método a un parámetro con notas puestas**: los intentos viejos quedaban con el valor en la columna equivocada, valiendo 0 y pareciendo una nota legítima | 409, y el selector sale bloqueado con el motivo |
| Borrar la plantilla eran **dos peticiones sueltas** (parámetros y luego evaluación): si fallaba la segunda quedaba una evaluación sin parámetros con alumnos pendientes de algo impuntuable | Una transacción, con recuento previo y confirmación por título |
| El método por escala **inventaba un máximo de 10** cuando faltaba, y devolvía una nota plausible y equivocada | 409: el parámetro está mal configurado y hay que arreglarlo |
| Los intentos escribían **las cuatro columnas** de método en cada insert, arrastrando valores viejos al corregir | Solo la columna del método que toca |
| La lista no decía **cuántos alumnos faltaban** por evaluar | Contador en la lista, en el selector de evaluación y en el de disciplina |
| Cascada colegio → disciplina → evaluación: tres pasos para descubrir que esa disciplina no tenía ninguna evaluación | Evaluación → disciplina: un filtro menos y sin combinaciones vacías |
| El modal de evaluar eran 1 132 líneas con los 30 campos de golpe | Un parámetro por pantalla, con avance |

---

## 4. Decisión que hay que confirmar

**Mobak y el puntaje del parámetro.** MOBAK puntúa de 0 a 2 por ítem, y el sistema viejo guardaba ese 0, 1 o 2 **literal**, ignorando el `evaparam_puntaje` configurado. Un parámetro Mobak de 10 puntos no podía dar más de 2, así que `eva_puntaje_total` prometía un máximo inalcanzable y los porcentajes de los informes salían mal.

Ahora el 0-2 **se escala al puntaje del parámetro**: con 10 puntos, una puntuación de 6 en Mobak-6 da 10.

**Es compatible con todos los datos reales**: los tres parámetros Mobak de producción están configurados con 2 puntos y 1 intento, y ahí `(bruto / 2) × 2 = bruto`, exactamente lo de antes. Si prefieres que Mobak sea siempre 0, 1 o 2 pase lo que pase, se cambia una función y se fuerza `evaparam_puntaje = 2` en esos parámetros.
