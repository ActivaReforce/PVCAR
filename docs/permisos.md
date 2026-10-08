# Permisos: qué habilita cada casilla

Vigente desde la migración `0026_permisos_crud.sql` (2026-10-07). Sale de las rutas del backend (`requirePermission` en cada `*.routes.ts`), que es quien decide de verdad: la pantalla solo esconde botones.

**El alcance limita además de la casilla.** Propietario y Admin ven todo; el coordinador, sus colegios; el entrenador y sus auxiliares, sus disciplinas; el representante, solo a sus hijos (`lib/alcance.ts`). Marcar "Ver" nunca amplía el alcance.

| Módulo | Ver | Crear | Editar | Eliminar |
|---|---|---|---|---|
| Tablero | Ver el inicio | — | — | — |
| Usuarios | Lista y fichas (incluidos representantes) | Crear usuario | Datos, foto, roles, dar de baja o reactivar | Borrar del todo |
| Colegios | Lista y fichas | Crear | Datos, foto y asignar coordinadores | Borrar |
| Actividades | Catálogo | Crear | Editar | Borrar |
| Disciplinas | Lista y horarios | Crear | Horario, dar de baja o reactivar | Borrar |
| Entrenadores | Lista y fichas | *(se crean en Usuarios)* | Asignar disciplinas y auxiliares | *(no existe)* |
| Alumnos | Lista y fichas | Crear | Datos, foto, inscribir en disciplinas, representantes, baja | Borrar |
| Evaluaciones (plantillas) | Ver las plantillas | Crear plantilla | Datos, parámetros, vincular a disciplinas, baja | Borrar |
| Calificar evaluaciones | Notas y pendientes de los alumnos | — | Calificar y quitar la pendiente de un alumno | — |
| Asistencia de alumnos | Consultar listas e historial | — | Pasar lista | — |
| Asistencia de personal | Consultar listas | — | Pasar lista | — |
| Encuestas | Lista, vista previa y resultados (solo de las familias de su alcance) | Crear | Preguntas, finalizar, publicar, volver a borrador | Borrar |
| Inscripciones | Lista (el representante, solo las suyas) | *(las crea el representante desde el formulario)* | Aprobar, documentos, precios, abrir y cerrar | Rechazar |
| Reportes | Ver, gráficas y Data anterior | Exportar a Excel | — | — |
| Perfil | Ver y editar el propio perfil | — | — | — |
| Permisos | Ver la matriz | — | Guardar la matriz | — |

## Reglas que van por encima de la casilla

- **Plantilla de evaluación compartida:** quien no es Propietario ni Admin solo la cambia si **todas** las disciplinas que la usan están en su alcance (`exigirEditable` en `evaluaciones.service.ts`). Si no, 409.
- **Inscripciones:** Editar y Eliminar solo funcionan para Propietario y Admin, se marquen a quien se marquen (`esPersonal`).
- **Encuestas (gestión):** el representante no entra aunque tenga la casilla (`requirePersonal`).
- **Permisos:** guardar exige además ser Propietario o Admin. Al Propietario no se le pueden quitar Ver ni Editar de Permisos: sin ellas nadie podría volver a repartirlos.
- **Correos** (Configuración de Inscripciones): solo Propietario, sin casilla.

## Qué cambió en la 0026

| Antes | Ahora |
|---|---|
| Asistencias: solo "Ver", que también dejaba pasar lista | Ver = consultar · Editar = pasar lista |
| Evaluaciones: "Editar" era calificar **y** cambiar la plantilla; el Entrenador lo tenía para calificar | Evaluaciones = plantilla · Calificar evaluaciones = notas. El Entrenador conserva calificar y pierde cambiar plantillas |
| Encuestas: "Ver" lo hacía todo, con las respuestas de todas las familias | Ver / Crear / Editar / Eliminar, y resultados solo del alcance |
| Permisos: "Ver" dejaba guardar | Ver = mirar · Editar = guardar |
| "Reporte del Estudiante": casilla que no abría nada | Quitada; al representante se le reconoce por su rol |
