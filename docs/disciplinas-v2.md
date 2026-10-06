# Disciplinas v2 — una disciplina con varios horarios (propuesta, 2026-10-05)

**Estado: análisis, sin construir.** Espera las respuestas del cliente (§7).

## 1. Cómo funciona el negocio (cliente, 2026-10-05)

- Una **disciplina** es una actividad que se da **varios días a la semana**: hoy siempre dos (Fútbol lunes y miércoles, 15:00–16:00).
- El representante **paga una disciplina**, no cada día.
- Un niño puede estar como mucho en **dos disciplinas**, y sus horarios **no pueden cruzarse**.
- Tiene que poder cambiar: mañana Fútbol lunes, miércoles y viernes.

## 2. Cómo está hoy y por qué falla

Hoy cada fila de `colegio_actividad_horario` es **un día**. "Fútbol lunes y miércoles" son dos filas sin nada que las una. Todo cuelga de esa fila:

| Qué | Cuelga de | Problema con dos filas |
|---|---|---|
| Inscripción del niño (`nino_asignacion`) | un día | Hay que inscribirlo dos veces; puede quedar en uno solo |
| Entrenador (`entrenador_asignacion`) | un día | **Pasa en dev:** "Furbol G1" tiene entrenador el miércoles y no el lunes |
| Evaluación (`evaluacion_asignacion`) | un día | Hay que vincularla a cada día |
| Cobro de inscripción | cuenta filas | Fútbol L+M se cobra **doble** |
| Límite de 2 disciplinas | — | No existe; y contaría días, no disciplinas |
| Cruce de horarios del niño | — | No existe (solo hay control de que dos disciplinas iguales no se pisen) |
| Nombre del grupo | — | No hay dónde: en dev se escribió "Furbol **G1**" en el nombre de la **actividad** |

## 3. La propuesta

**Una disciplina = un grupo con N horarios.**

```
colegio_actividad_horario (la DISCIPLINA, el mismo id de siempre)
  ├─ colegio, actividad, nombre del grupo ("G1", "Sub-10"…), estado
  └─ disciplina_horario (nueva): uno por día
        día · hora inicio · hora fin
```

La clave: **el id de la disciplina no cambia**. Inscripciones de niños, entrenadores, evaluaciones, asistencias e inscripciones en línea ya apuntan a `colacthor_id`; ese id pasa a significar "la disciplina entera" en vez de "un día". Lo que se mueve es solo el día y la hora, a la tabla hija. Así el cambio no rompe la cadena de datos: cambia el significado de una fila, no las relaciones.

| Qué | Después |
|---|---|
| Niño | Se inscribe **una vez** a la disciplina y va todos sus días |
| Entrenador | Uno por disciplina, todos los días (el que falta un día lo cubre el Respaldo) |
| Evaluación | Se vincula una vez |
| Asistencia | Sigue siendo **por fecha**: se pasa lista de la disciplina en una fecha que sea uno de sus días (la tabla no cambia) |
| Cobro | Una disciplina = una tarifa, tenga 2 o 3 días. **El pendiente del cobro de la 14B se resuelve solo** |
| Calendario | La misma tarjeta aparece en cada uno de sus días |

## 4. Reglas configurables (para que sirva hoy y mañana)

| Regla | Hoy | Dónde se cambia |
|---|---|---|
| Días por disciplina | 2 | **No es regla del sistema**: cada disciplina lleva los que tenga (1, 2, 3…), y cada día puede tener su propia hora |
| Máximo de disciplinas por niño | 2 | Un número en la configuración (por defecto 2). Se aplica en la inscripción en línea **y** al inscribir desde Estudiantes |
| No cruzar horarios | sí | Siempre. Cruce = mismo día y horas que se pisan (15–16 y 16–17 **no** se cruzan) |
| Precio | tarifa del colegio | La del colegio por defecto; opcional, un precio propio por disciplina (por si una de 3 días cuesta más) |

**Dónde se comprueba el cruce:**

- Al inscribir (formulario y Estudiantes): el niño no puede quedar en dos disciplinas que se pisen.
- Al **editar los horarios** de una disciplina con niños inscritos: si el cambio hace que algún niño quede cruzado con su otra disciplina, se avisa con sus nombres antes de guardar.
- Entrenador: no puede dar dos disciplinas que se pisen (hoy no se controla).

## 5. Lo que cambia en el sistema

- **Base (una migración):** tabla `disciplina_horario`; cada fila actual pasa a ser una disciplina con un horario; se quitan `dia_id` y las horas de la tabla madre; se añade el nombre del grupo, el máximo por niño en la configuración y, si se quiere, el precio propio. En dev hay 6 filas de prueba (3 pares); se pueden juntar en 3 disciplinas o recrearlas. Prod está vacía.
- **Disciplinas:** el formulario pasa a "actividad + grupo + horarios (añadir/quitar días)". El alta en lote se simplifica.
- **Inscripción en línea:** el padre elige disciplinas (tarjetas con sus días y horas), máximo 2, y las que se cruzan con la ya elegida salen desactivadas con el motivo.
- **Estudiantes, Entrenadores, Asistencias, Evaluaciones, Reportes, Tablero:** donde hoy dicen "Fútbol (Lunes)" dirán "Fútbol G1 (Lun y Mié 15:00–16:00)"; las consultas leen los días de la tabla hija. La asistencia comprueba que la fecha sea uno de los días de la disciplina.
- **Contrato:** la cláusula 1 dice "dos sesiones semanales de 60 minutos" escrito a mano. Si mañana hay disciplinas de tres días, mentiría. Propuesta: que diga los días con un dato (`{{horario}}` = "lunes y miércoles de 15:00 a 16:00"), que ya sale en la ficha.
- **Data anterior (`archivo`):** no se toca.

Tamaño: unos 30 archivos leen el día o la hora de la disciplina. Es una reestructura de las Fases 8–13, pero sin datos que migrar (dev de prueba, prod vacía): es el mejor momento.

## 6. Alternativas descartadas

- **Agrupar sin cambiar nada** (un campo "grupo" que junta filas de un día): el niño, el entrenador y la evaluación seguirían colgando de cada día, y la inconsistencia de hoy (entrenador en un día y no en el otro) seguiría siendo posible.
- **Renombrar la tabla a `disciplina`:** más claro, pero toca 48 archivos solo por el nombre. Se deja, como con `padre`.

## 7. Preguntas para el cliente

1. ¿Cada día de una disciplina puede tener **su propia hora** (lunes 15:00, miércoles 16:00)? El sistema lo permitiría igual; es para saber cómo presentarlo.
2. **Máximo 2 disciplinas por niño:** ¿igual para todos los colegios? ¿El Propietario puede saltárselo desde Estudiantes en un caso especial?
3. ¿Quieren **precio propio por disciplina**, o siempre la tarifa del colegio?
4. **Entrenador:** ¿uno por disciplina para todos sus días? (Si un día falta, lo cubre el Respaldo.)
5. ¿Le ponemos **nombre al grupo** ("G1", "Sub-10", "Avanzado") separado del nombre de la actividad?
6. **Contrato:** ¿cambiamos "dos sesiones semanales de 60 minutos" por los días y horas reales de la disciplina?
