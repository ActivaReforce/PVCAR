# Disciplinas v2 — una disciplina con varios horarios (propuesta, 2026-10-05)

**Estado: construido y probado en pantalla por el cliente el 2026-10-06.** Migración `0021_disciplinas_horarios.sql`. Las 6 preguntas de §7 respondidas el 2026-10-06; lo que cambian está en §8; lo construido, en §9.

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
| Máximo de disciplinas por niño | 2 | Un número en la configuración (por defecto 2). **Solo en la inscripción en línea** (cliente, 2026-10-06): desde la plataforma (Estudiantes) el personal puede pasarse del límite |
| No cruzar horarios | sí | Siempre. Cruce = mismo día y horas que se pisan (15–16 y 16–17 **no** se cruzan) |
| Precio | tarifa del colegio | La del colegio por defecto; opcional, un precio propio por disciplina (por si una de 3 días cuesta más) |

**Dónde se comprueba el cruce:**

- Al inscribir (formulario y Estudiantes): el niño no puede quedar en dos disciplinas que se pisen. El límite de 2 no aplica en Estudiantes; el cruce sí, porque el niño no puede estar en dos sitios.
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

## 7. Preguntas para el cliente — respondidas el 2026-10-06

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | ¿Cada día con su propia hora? | **Sí**, pueden ser distintas |
| 2 | Máximo 2 disciplinas por niño | **Solo en la inscripción en línea**; desde la plataforma se puede pasar sin límite (el cruce sí se bloquea siempre) |
| 3 | Precio propio por disciplina | **No**: siempre la tarifa del colegio |
| 4 | Un entrenador por disciplina | **Sí**. Un entrenador puede estar en varios colegios y disciplinas; un auxiliar/respaldo también en varias disciplinas (y con varios titulares) |
| 5 | Nombre del grupo aparte | **No**, se deja como está |
| 6 | Contrato con los días reales | **No**, la cláusula se queda escrita a mano |

## 8. Lo que cambia respecto a §3–§5

- **Sin precio propio** ni columna de precio: cobro = tarifa del colegio por disciplina.
- **Sin nombre de grupo**: dos disciplinas de la misma actividad en un colegio se distinguen por sus horarios. Las etiquetas quedan "Fútbol (Lun 15:00 · Mié 16:00)".
- **Contrato sin `{{horario}}`**: la cláusula 1 no se toca.
- **Máximo por niño** en la configuración, aplicado solo en `inscripcion-publica`; Estudiantes solo comprueba cruces.
- **Auxiliar con varios titulares** (Fase 9 §1b, pendiente desde el 2026-10-02) se construye en el mismo paquete: quitar la regla de "ya respalda a otro", unicidad parcial `(usu_id, ent_id) WHERE est_id = 1`, selector "de quién ver" + "Todos". El choque de horario del entrenador sale de la regla de cruce de §4.

## 9. Lo construido (2026-10-06)

- **Base:** `0021` crea `disciplina_horario` (un día por fila, `UNIQUE (colacthor_id, dia_id)`, fin > inicio), junta los grupos partidos por día (mismo colegio, actividad, estado y franja), borra `dia_id` y las horas de la madre, añade `inscripcion_config.inscfg_max_disciplinas` (1–10, por defecto 2), la función `disciplina_horario_texto(id)` y la unicidad parcial `(usu_id, ent_id)` de `entrenador_auxiliar`. Probada en un Postgres local con datos como los de dev y reaplicada sin daño.
- **Reglas en el backend** (`lib/horarios.ts`): cruce = mismo día y horas que se pisan; 15–16 y 16–17 no se cruzan.
  - Estudiantes: no deja inscribir en dos que se crucen; **sin tope**.
  - Formulario público: tope `inscfg_max_disciplinas` y cruces; las opciones que no se pueden marcar salen desactivadas con el motivo. El tope se cambia en Inscripciones → Documentos → Configuración.
  - Entrenadores: no deja asignar una disciplina que se cruce con otra que ya da, aunque sea de otro colegio.
  - Editar horarios: si el cambio cruza a un alumno o a un entrenador, 409 con los nombres.
  - Misma actividad en el mismo colegio: dos grupos no pueden pisarse ningún día (sustituye al "duplicado exacto" y al "solape" de antes).
- **Asistencias:** la fecha tiene que caer en uno de los días de la disciplina; la hora que se muestra es la de ese día. Reportes: "Día" de asistencias es el de la fecha.
- **Auxiliar con varios titulares** (Fase 9 §1b): se puede atar a varios; `GET /me/titulares`; selector "de quién ver" en la cabecera con "Todos mis entrenadores", que viaja en `X-Titular` y solo **estrecha** el alcance.
- **Pantallas:** Disciplinas (alta y edición con días y horas por día; la tarjeta sale en cada uno de sus días), Estudiantes (horario completo y aviso de cruce antes de guardar), Entrenadores, Evaluaciones, Asistencias, Tablero, Reportes e Inscripción pública.
- Verificado: los 267 SQL del backend con `PREPARE` contra el esquema nuevo, un escenario de punta a punta contra la base local, 558 pruebas, lint, tipos y build.

## 10. Ajustes tras la prueba del cliente (2026-10-06)

- **`/inscripcion` con los días completos:** "Lunes y Miércoles 15:00–16:00" (`horarioLargo`, en `lib/horarios.ts` de backend y frontend), también en la ficha y el contrato generados. Las pantallas internas siguen con la forma corta de `disciplina_horario_texto`.
- **Color por actividad** (`0022`, paleta cambiada por la `0023`): 10 tonos sobrios —marino, acero, cielo, petróleo, bosque, oliva, piedra, grafito, índigo, vino— o ninguno. Tiñen la tarjeta de la actividad y las de sus disciplinas; el borde ámbar de "sin entrenador" va por encima y no hay amarillos ni naranjas. La primera paleta (pastel) le pareció poco sobria y en la segunda los azules no se distinguían (ΔE2000 4,3): la vigente está diseñada en OKLCH con un mínimo de 7 entre cualquier par, en claro y en oscuro (`frontend/src/lib/colores.ts`).
