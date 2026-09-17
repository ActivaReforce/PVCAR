# Fase 9 — Entrenadores

Estado al **2026-09-16**. Construido y en `dev`. **Sin probar contra el API: Railway apagado.**

Este módulo no da de alta personas — un entrenador **es** un usuario con el rol 3 y su ficha nace en Usuarios — sino que decide **qué imparte cada uno y quién lo respalda**. Eso es lo que puebla el alcance de los roles 3, 6 y 7: tocar aquí cambia lo que esas personas ven en todo el sistema.

---

## 1. Lo que hay que probar cuando Railway esté arriba

| Prueba | Qué tiene que pasar |
|---|---|
| Asignar una disciplina libre | Se abre con fecha de hoy; el entrenador la ve en su ficha y en su alcance |
| Asignar una que ya da otro | 409 **con el nombre del otro**; no toca nada |
| Reemplazar | Cierra la del anterior con fecha de hoy y abre la nueva, en una transacción |
| Asignar la misma dos veces | 409 |
| Asignar a quien perdió el rol 3 | 409 diciendo que hay que devolvérselo desde Usuarios |
| Asignar a un entrenador dado de baja | 409 |
| Asignar una disciplina de baja | 409 |
| Quitar una disciplina | La fila **no se borra**: queda con `entasig_fecha_fin` = hoy y sale en el historial |
| Historial | El botón muestra las 39 asignaciones cerradas de dev con sus fechas |
| Atar auxiliar | Solo salen candidatos activos con rol 6 o 7 que no respalden a nadie |
| Atar a alguien sin rol 6/7 | 400 |
| Atar a quien ya respalda a otro | 409 con el nombre del titular actual |
| Auto-auxiliar | 400 |
| Soltar auxiliar | Baja lógica (`est_id = 2`), no DELETE; deja de heredar el alcance |
| Alcance | Coordinador: solo entrenadores de sus colegios. Ficha ajena → 403. Asignar disciplina ajena → 403 |
| Entrar como auxiliar | Ve exactamente lo de su titular; al soltarlo, deja de verlo |
| Móvil 360 px | Tarjetas en una columna, ficha y modal de asignar usables |
| Modo oscuro | Avisos ámbar y badges legibles |

---

## 2. Qué se construyó

### Backend — `modules/entrenadores/`

| Endpoint | Permiso | Qué hace |
|---|---|---|
| `GET /entrenadores` | `entrenadores.ver` | Página filtrada por alcance, con colegios, disciplinas, alumnos y auxiliares por fila, más conteos |
| `GET /entrenadores/candidatos-auxiliar` | `editar` | Activos con rol 6 o 7 que no respaldan a nadie |
| `GET /entrenadores/:id` | `ver` | Ficha: datos, asignaciones y auxiliares. `?historial=true` añade lo cerrado |
| `GET /entrenadores/:id/disponibles` | `editar` | Disciplinas activas del alcance que no tiene, marcando quién da cada una |
| `POST /entrenadores/:id/asignaciones` | `editar` | Abre una asignación. `reemplazar` cierra la del anterior en la misma transacción |
| `DELETE /entrenadores/:id/asignaciones/:id` | `editar` | La **cierra** con fecha de hoy |
| `POST /entrenadores/:id/auxiliares` | `editar` | Ata un asistente o respaldo |
| `DELETE /entrenadores/:id/auxiliares/:id` | `editar` | Lo suelta (baja lógica) |

### Base de datos

`0009_asignacion_activa_unica.sql` — índice único **parcial**: una sola asignación abierta por (entrenador, disciplina). **Pendiente**, como `0006`–`0008`. El backend ya lo comprueba.

### Frontend

`api/entrenadores.ts`, `hooks/useEntrenadores.ts`, página reescrita y tres componentes: `EntrenadorCard`, `EntrenadorFicha`, `AsignarDisciplinaModal`.

**Borrados por inservibles (14 componentes y 3 hooks):** `AtarAuxiliarModal`, `AtarEntrenadorModal`, `AuxiliaryTrainerTypes`, `EntrenadorActionMenu`, `EntrenadorDataTable`, `EntrenadorDetail`, `EntrenadorHeader`, `EntrenadorSearch`, `EntrenadorTable`, `EntrenadorTypes`, `MobileSchoolSelector`, `RemoveAuxiliaryDialog`, `TrainerSchoolCard`, `TrainerSchoolCardGrid`, `useEntrenadoresData`, `useEntrenadoresFiltering`, `useAuxiliaryTrainers`.

---

## 3. Qué se arregló del sistema viejo

| Antes | Ahora |
|---|---|
| El filtro por colegio usaba un **hash del nombre del colegio** como id, y el alcance se resolvía cruzando arrays de nombres en el navegador | `col_id`, y el alcance en el servidor |
| Nada impedía dos entrenadores activos sobre la misma disciplina, ni asignar dos veces la misma | 409 en los dos casos, con `reemplazar` como salida explícita |
| Nada comprobaba que el entrenador tuviera el rol, que estuviera activo, ni que la disciplina lo estuviera | Cinco comprobaciones antes de abrir una asignación |
| Soltar un auxiliar hacía `DELETE`: desaparecía el vínculo que explica las asistencias de auxiliar ya registradas | Baja lógica |
| Nada validaba que el auxiliar tuviera rol 6/7, ni que no respaldara ya a otro | Ambas cosas, con el nombre del titular actual en el mensaje |
| El historial de asignaciones existía (39 de 119 filas cerradas) y **ninguna pantalla lo mostraba** | Botón de historial en la ficha, con fechas de inicio y fin |
| 15 `console.log`, algunos con datos de personas | Ninguno |

---

## 4. Lo que los datos reales enseñaron (y que la pantalla ahora avisa)

Medido en `PVCAR_Dev` el 2026-09-16 — son datos que vienen del sistema viejo, no errores nuevos:

| Hallazgo | Cantidad |
|---|---|
| Entrenadores con el **usuario dado de baja** pero ficha activa y disciplinas asignadas | **4** |
| Fichas de entrenador de gente que **ya no tiene el rol 3** | 2 |
| Auxiliares activos cuyo usuario está de baja | 2 |
| Auxiliares activos que **no tienen** el rol 6 ni el 7 | 2 |
| Auxiliar que a la vez es titular de otro auxiliar, estando su usuario de baja | 1 |

Ninguna de esas filas se toca: son historia. Pero la tarjeta y la ficha las marcan en ámbar en vez de enseñarlas como si todo estuviera bien, y las validaciones nuevas impiden crear más. **Hay que decidir con el cliente** si esos 4 entrenadores deben seguir dando clase o si sus asignaciones se cierran.

---

## 5. Verificado sin backend

- **SQL contra `PVCAR_Dev` por MCP:** lista con alcance de coordinador (4 entrenadores del colegio 14, con sus colegios, disciplinas y alumnos), conteos, asignaciones con historial, auxiliares con sus dos banderas de aviso, disponibles (8 disciplinas para Erika, marcando quién da cada una) y candidatos a auxiliar (0 libres hoy en dev, y la pantalla lo explica).
- **El par repetido** `(ent 76, disciplina 74)` resultó ser historia legítima: cerrada el 27-10 y reabierta el mismo día. Por eso el índice de `0009` es parcial.
- **14 pruebas automáticas nuevas** de las puertas del servicio + 8 rutas cerradas sin token → **182 en el backend**.
- `typecheck`, `lint` (0 errores), `test` y `build` en verde.
