# PVCAR — Roadmap a producción

> **Producto:** plataforma de gestión deportiva escolar de **Activa Reforce**. 14 módulos. La plataforma vieja tuvo 7 colegios, 808 alumnos menores de edad y 70 usuarios; la nueva arranca vacía (decisión del 2026-10-01).
>
> **Objetivo:** el producto entero corriendo en la infraestructura de Activa Reforce (monorepo `PVCAR`, backend real, autenticación segura, RLS), **mejor de lo que está hoy**, sin perder un dato y sin que el usuario final note el cambio.
>
> **Estrategia:** congelar y cortar. El sistema viejo sigue vivo e intacto hasta un cutover único. Rollback = re-apuntar el dominio.

Este documento sustituye a `Plan.md`. El historial de sesiones anteriores quedó en `Bitacora.md`.

> **Vive en el repo desde el 2026-10-07** (raíz de `ActivaReforce/PVCAR`) para poder seguir desde otro equipo con un `git pull`. Las rutas `PVCAR/...` son la raíz de este repo. `SQL/`, `Backup_bd/`, `Bitacora.md`, `activa-forge-login/` y `.mcp.json` viven en la carpeta de trabajo, fuera del repo, y no se suben: llevan datos de menores, respaldos o claves.

**Corte de este documento: 2026-10-07, cierre (Reportes y Permisos hechos; siguiente: punto 7, asistencia más fluida).**

---

## Índice

1. [Dónde estamos hoy](#1-dónde-estamos-hoy)
2. [Arquitectura y reglas de oro](#2-arquitectura-y-reglas-de-oro)
3. [Reglas transversales — valen para todos los módulos](#3-reglas-transversales--valen-para-todos-los-módulos)
4. [Catálogos del sistema](#4-catálogos-del-sistema)
5. [Cómo se conectan los módulos](#5-cómo-se-conectan-los-módulos)
6. [Fases 0–5 — hechas](#6-fases-05--hechas)
7. [Fases 6–14 — los módulos](#7-fases-614--los-módulos) (+ 14B Inscripciones)
8. [Fase 15 — endurecimiento y QA](#8-fase-15--endurecimiento-y-qa)
9. [Fase 16 — cutover](#9-fase-16--cutover)
10. [Fase 17 — desmantelar Flowward](#10-fase-17--desmantelar-flowward)
11. [Anexo A — migración de autenticación](#anexo-a--migración-de-autenticación)
12. [Anexo B — RLS desde el día 1](#anexo-b--rls-desde-el-día-1)
13. [Anexo C — trampas de infraestructura ya pagadas](#anexo-c--trampas-de-infraestructura-ya-pagadas)
14. [Seguimiento](#seguimiento)

---

## 1. Dónde estamos hoy

| Fase | Estado |
|---|---|
| 0 — Cuentas, herramientas, respaldo | ✅ cerrada |
| 1 — Monorepo PVCAR | ✅ cerrada |
| 2 — Base de datos nueva (schema, sin datos) | ✅ cerrada, dev y prod verificadas |
| 3 — Backend base + Railway 2 ambientes | ✅ cerrada |
| 4 — Frontend base + Vercel | ✅ cerrada |
| 5 — Autenticación con Supabase Auth | ✅ cerrada, en `main` |
| **6 — Usuarios, Roles, Permisos, Perfil** | ✅ **cerrada el 2026-09-17**: 17 pruebas contra `dev`, todas pasadas, más dos arreglos de móvil. Las dos que faltaban se mudaron a las Fases 7 y 9 |
| **7 — Colegios** | ✅ **cerrada el 2026-09-18**: 13/13 pruebas contra `dev`, más dos arreglos |
| **8 — Actividades y Disciplinas** | ✅ **cerrada el 2026-10-02**: 45 pruebas + 9 de repaso contra `dev`. Salieron 4 arreglos y un rediseño de tres pantallas pedido por el cliente (ver Fase 8 abajo). **Reabierta y cerrada otra vez el 2026-10-06: Disciplinas v2** (una disciplina con varios días, cada uno con su hora; `0021`) y **color por actividad** (`0022`/`0023`), probadas en pantalla por el cliente. Detalle en `docs/disciplinas-v2.md` |
| **9 — Entrenadores** | 🟡 construida el 2026-09-16, en `dev`. **Los dos prerrequisitos, hechos el 2026-10-06:** auxiliar con varios titulares (selector "de quién ver" + "Todos") y bloqueo de choque de horario del entrenador. Solo falta probarla |
| **10 — Estudiantes** | 🟡 construida el 2026-09-17, en `dev`. Solo falta probarla |
| **11 — Asistencias** | 🟡 construida el 2026-09-17, en `dev`. Solo falta probarla |
| **12 — Evaluaciones** | 🟡 construida el 2026-09-17, en `dev`. Solo falta probarla |
| **13 — Tablero y Reportes** | 🟡 construida el 2026-09-17, en `dev`. 4 tableros, 9 reportes y 14 gráficas. **+ Data anterior** (2026-10-02): 15 conjuntos, 8 gráficas y Excel de todo; pruebas en `docs/data-anterior.md`. **La exportación a Excel de Reportes fallaba siempre** — arreglada el 2026-10-02. Solo falta probarla |
| **14 — Encuestas y Representantes** | 🟡 construida el 2026-09-17, en `dev`. Solo falta probarla |
| **14B — Inscripciones** (nuevo, 2026-10-01) | 🟡 **rehecha el 2026-10-05 y en `dev`** con los seis documentos del cliente (4 generales + ficha y contrato por colegio), constancia por documento, PDF por alumno con membrete, IVA fijo 15 %, apertura general y por colegio, cuenta bancaria. `0014`–`0019` aplicadas en dev y prod. **El cobro por disciplina quedó resuelto el 2026-10-06** con Disciplinas v2 (una disciplina = una tarifa, máximo configurable por alumno, sin cruces). **Representante con cuenta previa hecho y probado el 2026-10-07**, en `main` desde el PR #11. Estado vigente en `docs/fase14b-contratos.md`. Solo Propietario |
| **15 — Endurecimiento y QA** | 🟡 en marcha desde el 2026-09-17. Hecho todo lo que no necesita la aplicación en marcha. SMTP de Resend puesto en prod y dev (2026-10-07). Falta la auditoría de fugas con token por rol, los e2e y el repaso de accesibilidad |
| 16 — Lanzamiento | ⬜ **Reducida el 2026-10-01** por el arranque de cero: siembra de prod (catálogos ya están; quitar lo de prueba + primer Propietario), deploy de `main`, dominio, smoke tests |
| 17 — Desmantelar Flowward | ⬜ |

### Pedidos del cliente — 2026-10-01

| # | Pedido | Estado |
|---|---|---|
| 1 | Alta de usuario: quien tenga permiso llena nombre, correo, teléfono, contraseña, foto y rol, y **ya existe**. Sin verificación por correo | ✅ Ya es así (Fase 6, `email_confirm: true`). Probado 17/17 |
| 2 | Un usuario puede tener **varios roles** | ✅ Ya es así; el alcance es la unión (T2) |
| 3 | Un entrenador puede estar en **varios colegios** | ✅ Ya es así: se asigna por disciplina. Se confirma al probar la Fase 9 |
| 4 | Un **asistente / respaldo** puede estar con **varios entrenadores** y **varias disciplinas** | ✅ **Hecho el 2026-10-06** (`0021`): se ata a varios titulares y elige arriba "de quién ver" o "Todos mis entrenadores". Falta probarlo en la Fase 9 |
| 5 | Si un entrenador se va (le quitan la disciplina o lo dan de baja), **sus registros se quedan** en reportes y en todo, y otro sigue con normalidad | ✅ Diseñado así (asignaciones se cierran con fecha, nada se borra). **Falta la prueba de punta a punta**, añadida a la Fase 9 |
| 6 | Módulo nuevo **Inscripciones**, solo para Propietario: ver los representantes inscritos | ⬜ **Fase 14B**, nueva. La lógica se discute cuando se llegue |

Detalle y pruebas de 3, 4 y 5 en `docs/fase9-entrenadores.md` §1b.

### Decisión del 2026-10-01 — la plataforma nueva arranca de cero

La empresa está **en pausa un mes**. Decisión del cliente, aprobada por la empresa:

1. **Los datos viejos no se migran a `public`.** La plataforma nueva arranca vacía y el admin crea todo. En prod solo entran los catálogos del sistema y **un Propietario**. Los catálogos **ya están** en prod porque `0004_seed_dev.sql` se aplicó allí por error el 2026-09-17; falta quitar lo de prueba que trajo (Colegio de Pruebas Dev, 1 actividad, 2 disciplinas) y crear el Propietario.
2. **Lo viejo se guarda en el esquema `archivo`** de la misma base, solo lectura, para consultarlo en **Reportes → "Data anterior"** (nuevo trabajo de la Fase 13). Migración `0013_archivo.sql` + `SQL/carga_archivo_2026-10-01.sql`, **aplicadas y verificadas en dev y prod el 2026-10-02**: 35 tablas, 20 620 filas, **sin** contraseñas, información de salud, `nino_otra_info`, cédula de alumnos ni URLs de fotos. Las cédulas, teléfonos, correos y direcciones de los usuarios **sí** se quedan, a petición del cliente.
3. **Respaldo definitivo hecho el 2026-10-01**: `Backup_bd/prod_full_2026-10-01.dump` + `usufoto/` + `MANIFIESTO.txt`. Comprobado contra la base en vivo (70 tablas) y restaurado en un Postgres local (idéntico). Lo anterior de `Backup_bd/` se borró.
4. **La base vieja se borra cuando la nueva esté en producción**, no antes.
5. **Libertad para cambiar el modelo:** sin datos viejos en `public`, cualquier cambio de schema deja de tener que respetarlos.

Esto **vacía la Fase 16**: se caen el dump fresco, los 19 chequeos de compatibilidad, el backfill de Auth, la carga con los triggers apagados, la copia del bucket y la corrección del correo de Bernard.

### Corte de sesión — 2026-10-07 (cierre)

**Hecho en esta sesión — en `main` desde el PR #12 (`bcb5454`, 2026-10-07); `dev` y `main` iguales:**

- **Reportes (punto 5):** hoja **Resumen** primera en los 9 Excel (`de595e8`), con bordes y colores suaves —estilo aprobado por el cliente, mantenerlo en todo Excel nuevo—; sin hoja "Filtros" (`60e60d9`); columna **Hora de registro** en las dos asistencias; cada reporte enseña solo sus filtros, con estado propio (Presente/Tarde/Justificado/Ausente, Pendiente/Evaluado) y filtro de disciplina (`d6422da`); **auxiliares** en el reporte de Entrenadores con Tipo y "Acompaña a" (`fed7fb5`).
- **Permisos (punto 6):** casillas con sentido CRUD (`eb08f3f`, migración `0026`): Asistencias Editar = pasar lista; **Calificar evaluaciones** separado de la plantilla; plantilla compartida solo la cambia quien tiene todas sus disciplinas; Encuestas Ver/Crear/Editar/Eliminar con resultados por alcance; Permisos Editar = guardar; fuera "Reporte del Estudiante". Icono **!** con la explicación de cada casilla y combinaciones sin sentido bloqueadas en pantalla y backend (`dc017c0`). Tabla vigente en `PVCAR/docs/permisos.md`.
- **`0026` corrida en `PVCAR_Dev`** y verificada por MCP el 2026-10-07: cuadra rol por rol, ningún rol con combinaciones sin sentido. **`0026` corrida también en `PVCAR` (prod)** y verificada por MCP el 2026-10-07: idéntica a dev, 0 combinaciones sin sentido. No queda SQL pendiente.
- 605 pruebas automáticas en verde; lint y build limpios.

**Puntos 5 y 6 cerrados en código.** Les falta solo la prueba en pantalla del cliente:
1. Descargar Asistencia de alumnos y de entrenadores, Alumnos y Entrenadores: Resumen legible y cuadra con el detalle.
2. Permisos: el icono **!** se lee al pasar el ratón (y al tocar en el móvil); marcar "Editar" marca "Ver".
3. Como entrenador: pasa lista y califica, pero no ve "Editar y parámetros" en Evaluaciones.

**Al retomar — lista de trabajo, uno por uno:**

1–6. ~~Fechas · Cambio de entrenador · Correos · Correo de aprobación · Reportes · Permisos~~ — hechos.
7. **Tomar asistencia más fluido** (alumnos y entrenadores): analizar cómo se pasa lista hoy y proponer cómo hacerlo más rápido y fácil, sobre todo en el teléfono.
8. **Módulo Novedades** — **preguntar antes de construir.** Cualquier rol escribe una novedad o incidencia. Tipos: general (la ven los Propietarios; correo a gerencia), sobre un alumno (correo a gerencia y al representante) y sobre un entrenador (correo al entrenador y a gerencia). Se ve quién la escribió. Remitente y destinatarios en `correo_config`, con el mismo componente de Configuración que Inscripciones.
9. **Aviso automático de ausencia:** correo al representante cuando su hijo queda ausente; cada envío queda registrado en Novedades. Depende del 8.
10. **Pagos mensuales** — módulo nuevo o parte de Inscripciones. **Espera a que el cliente lo cuente;** no empezar sin eso.
11. **Pruebas en pantalla del cliente** de lo que está en `dev` sin probar: Reportes (hoja Resumen, filtros, auxiliares en Entrenadores), Permisos (icono **!**, casillas nuevas, entrenador que califica pero no cambia plantillas) y las Fases 9–14 que falten (`docs/checklist-modulos.md`).
12. **Decisiones pendientes del cliente:** fechas futuras en asistencia (Fase 11 §4; el sistema viejo las permitía), Mobak escalado al puntaje del parámetro (Fase 12 §4), información de salud en el reporte de Alumnos (Fase 13 §4) y flujo de invitación por correo en vez de contraseña puesta por el admin.
13. **Siembra de prod:** quitar de `PVCAR` lo de prueba que dejó la `0004` (Colegio de Pruebas Dev, su actividad y sus disciplinas) y dejar el primer Propietario real. `.sql` por escribir.
14. **Fase 15 — Endurecimiento y QA:** auditoría de fugas con un token por rol, pruebas e2e y repaso de accesibilidad.
15. **Fase 16 — Lanzamiento:** dominio propio, PR final a `main`, comprobar `/api/v1/health` en producción y arrancar con la plataforma vacía (arranque de cero: no se migran datos; lo viejo está en el esquema `archivo`).
16. **Fase 17 — Apagar lo viejo:** borrar la base vieja (`wfyytrdhqtspapxaikoh`) y retirar `activa-forge-login/`, rotar los PAT de Supabase de `.mcp.json` y pasar el repo a privado.

Pendiente del cliente: borrar `CORREO_REMITENTE` de Railway.

### Corte de sesión — 2026-10-07 (noche)

**Hecho hoy por la tarde y noche (en `dev`; `main` está en el PR #11, `d90198b`):**

- **PR #11 `dev` → `main`** mergeado y desplegado (todo lo del corte de la tarde).
- **Fechas en hora de Ecuador** (`1327375`): base y Railway en UTC; de 19:00 a 23:59 se tomaba "mañana". Arreglado en asignaciones de entrenador, alumnos vigentes en asistencia, fechas de Reportes/Data anterior/Encuestas, sello y nombre del Excel, edad y columnas `date` en el navegador. Regla nueva: CLAUDE.md regla 6 y T12b.
- **Cambio de entrenador verificado**: 21/21 con el backend real contra Postgres local. Nada se borra ni cambia; el nuevo continúa; el que sale conserva su historial; eliminar con historial se rechaza.
- **Auxiliares sin titular** (`0a29a87`): si el entrenador se queda sin ninguna disciplina, sus auxiliares se desvinculan y sale un modal recordatorio. 9/9 contra Postgres local.
- **Correos configurables** (`c994985`, `deb05df`, `0024`, `0025`): tabla `correo_config` con dos tipos —aviso de inscripción nueva (Para + CC + responder a, con resumen y PDF) e inscripción aprobada (al representante + CC + responder a)—. Dominio fijo en `CORREO_DOMINIO` (Railway). Solo Propietario.
- **Pestaña "Más" de Inscripciones** (`9efce93`): cinco tarjetas desplegables, cerradas por defecto, en el orden pedido.
- Probado en pantalla por el cliente: correos y pestaña Más.

**Al retomar — lista de trabajo, uno por uno:**

1. ~~Fechas~~ · 2. ~~Cambio de entrenador~~ · 3. ~~Configuración de correos~~ · 4. ~~Correo de aprobación~~ — hechos.
5. **Reportes con hoja "Resumen"** en todos los Excel (casos ej1: cuántas veces vino cada profe; ej2: estudiantes por disciplina) + revisión de todos los Reportes.
   **Decidido por el cliente (2026-10-07, noche):** Resumen en **los 9** reportes y como **primera hoja**. ej1 = una fila por profe con su total (vino, faltó, %) y debajo el desglose por disciplina. ej2 = **dos cosas**: una tabla de conteos por disciplina y, aparte, la lista agrupada (bloque por disciplina con total y nombres).
   **Hoja Resumen hecha el 2026-10-07 (noche)** (`de595e8`, en `dev`): 596 pruebas en verde, consultas comprobadas contra `PVCAR_Dev`. El desglose de ej1 va **por colegio**: la asistencia del personal se guarda por colegio y día, sin disciplina. Falta: verla en un Excel real y la revisión de todos los Reportes. **Tras la primera prueba del cliente** (`60e60d9`): columna "Hora de registro" en las dos asistencias; fuera la hoja "Filtros" (y la "Información" de cada conjunto de Data anterior, que solo queda en "Exportar todo"); Resumen con bordes y colores suaves. **Revisión de Reportes** (`d6422da`): filtros por reporte (el "Estado" Activo/Inactivo no servía en asistencias ni evaluaciones), filtro de disciplina, colegio en entrenadores, gráfica de alumnos por colegio con alcance de entrenador, representantes en el reporte de usuarios. Auxiliares en el reporte de Entrenadores (`fed7fb5`, decidido por el cliente): columnas Tipo y "Acompaña a"; heredan colegios, disciplinas y alumnos de sus titulares. **Punto 5 cerrado salvo su prueba en pantalla; siguiente: punto 6, Permisos.**
6. **Permisos módulo por módulo** — **hecho el 2026-10-07 (noche)** (`eb08f3f`, en `dev`; migración `0026` en dev ya, en prod **el mismo día del PR**, no antes). Tabla vigente en `PVCAR/docs/permisos.md`. Asistencias Editar = pasar lista; Calificaciones separado de Evaluaciones; plantilla compartida solo la cambia quien tiene todas sus disciplinas; Encuestas CRUD con resultados por alcance; Permisos Editar = guardar; fuera "Reporte del Estudiante". Perfil y Tablero se quedan como están (decisión del cliente). Cierra también la decisión pendiente de "permisos de escritura de Asistencias, Evaluaciones y Encuestas".
7. **Tomar asistencia más fluido** (alumnos y entrenadores): análisis y propuesta.
8. **Novedades** — preguntar antes de construir.
9. **Aviso automático de ausencia** al representante (registrado en Novedades).
10. **Pagos mensuales** — espera a que el cliente lo cuente.
11. Probar Fases 9–14 en pantalla.
12. Lanzamiento: primer Propietario en prod, Fase 15, 16 y 17.

Pendiente del cliente: borrar `CORREO_REMITENTE` de Railway (ya no se usa). PR `dev` → `main` cuando lo pida.

### Corte de sesión — 2026-10-07

**Lo que se hizo (todo en `dev`, probado en pantalla por el cliente):**

- **Representante con cuenta previa** (`docs/fase14b-contratos.md` §9): "Ya inscribí antes" con cédula → inicio de sesión (con la cédula sola no se enseña nada), "Tus datos" comprueba la cédula al continuar, datos e hijos rellenos, disciplinas activas como "ya inscrito", cuenta dada de baja que se reactiva al aprobar, "mismo alumno" (nombre + nacimiento + colegio) que el admin decide al aprobar. El personal con sesión abierta puede inscribir a otra persona sin usar su cuenta. Sin migración.
- **Descuento de hermano con hijos ya inscritos**, corregido dos veces: lidera el hijo ya inscrito con más disciplinas **en total** (activas + nuevas); los demás llevan descuento hasta ese total, ocupando primero sus activas. La familia paga lo mismo que inscribiéndolos juntos.
- **Recuperar contraseña:** todo enlace salía "no válido" porque `/reset-password` se cargaba en diferido (Fase 15) y llegaba tarde al `#type=recovery`. Arreglado leyendo el hash en el arranque. Desde `/inscripcion` se vuelve a la inscripción, con aviso de mirar el spam. `/forgot-password` y `/reset-password` rehechas con el tema (fuera el fondo SVG de Lovable).
- El paso Pago ya no dice "tu cuenta queda en revisión" a quien entra con su cuenta.
- **Disciplinas para el representante:** una sección por hijo (sus hijos y nada más; el personal sigue viendo la vista por colegio).
- **Aviso de inscripciones en el menú:** consulta ligera (`GET /inscripciones/aviso`), solo para quien aprueba, y se repite cada minuto solo con las inscripciones abiertas.
- **Tanda del 2026-10-07 (tarde):** asistencia de entrenadores contaba de más (un auxiliar con dos titulares salía dos veces; arreglado, y DISTINCT en alumnos); botones de asistencia con la palabra completa en móvil; número rojo de pendientes en Inscripciones del menú; pestañas "Configuración" y "Más"; Encuestas: escala que deja borrar el 0, "Añadir pregunta" abajo, vista previa (constructor y lista) y menú de acciones; Reportes: lupa y filtros alineados (arreglado en el buscador común); Perfil rehecho con Configuración (foto, nombre, teléfono, contraseña) y lo que cada uno tiene a cargo; Permisos sin numerar los roles.

**Al retomar:**

1. `/api/v1/health` en los dos ambientes → `db:"ok"`.
2. ~~PR `dev` → `main`~~ hecho el 2026-10-07: PR #11 mergeado (`d90198b`).
3. ~~Plantillas de Supabase Auth y SMTP de Resend~~ en `PVCAR` y `PVCAR_Dev`, revisado por el cliente el 2026-10-07.
4. **Revisar Reportes y Permisos** (§1, "Pendientes de revisar") y la **lista nueva del 2026-10-07** (abajo, "Pendientes nuevos").
5. **Probar la Fase 9** (`docs/fase9-entrenadores.md`); luego 10–14, dándole solo lo que no se puede verificar sin pantalla.
6. Antes de lanzar: primer Propietario en prod y el resto de la Fase 15.

### Corte de sesión — 2026-10-06

**Lo que se hizo:**

- **Disciplinas v2** construida y en `dev`: una disciplina = colegio + actividad con varios días, cada uno con su hora (`0021`). Respuestas del cliente: hora propia por día; máximo 2 **solo** en el formulario público (configurable en Inscripciones → Configuración); tarifa del colegio; un entrenador por disciplina; sin nombre de grupo; contrato sin tocar. Cruces de horario bloqueados para alumnos, entrenadores y al editar horarios. El cliente probó en pantalla: bien.
- **Auxiliar con varios titulares** (prerrequisito de la Fase 9), con selector "de quién ver" en la cabecera.
- **`/inscripcion` con los días completos** ("Lunes y Miércoles 15:00–16:00"), también en la ficha y el contrato generados.
- **Color por actividad:** 10 tonos sobrios (marino, acero, cielo, petróleo, bosque, oliva, piedra, grafito, índigo, vino) que tiñen las tarjetas de Actividades y Disciplinas; el borde ámbar de "sin entrenador" sigue encima. Medidos en ΔE2000 (mínimo 7) tras una primera versión con los azules indistinguibles (`0022`, `0023`).
- **`0021`–`0023` aplicadas en dev y prod**, verificadas por MCP.
- **Forma de trabajo nueva:** se empuja a `dev` en cuanto el código está listo, sin esperar al SQL; el cliente lo corre y lo ve al instante.

**Producción al día desde el 2026-10-06 (noche):** PR #10 `dev` → `main` mergeado (`4294bcd`), Railway `production` y Vercel Production desplegados y comprobados. `dev` sincronizado con `main`.

*(Histórico — el vigente es el corte del 2026-10-07, noche.)* **Al retomar:**

1. `/api/v1/health` en los dos ambientes → `db:"ok"`.
2. ~~PR `dev` → `main`~~ hecho (#10). Revisado además el alcance del auxiliar con dos titulares en dos colegios: ve solo lo de ellos en Disciplinas, Estudiantes, Asistencias, Evaluaciones y Tablero; un titular ajeno en `X-Titular` lo deja vacío.
3. **Probar Inscripciones** de punta a punta en dev (`docs/fase14b-contratos.md` §8), incluido el **representante con cuenta previa** (§9: "Ya inscribí antes", hijos sin duplicar, descuento con hermano ya inscrito, cuenta dada de baja que se reactiva, "mismo alumno" desde el otro padre), construido el 2026-10-06.
4. **Probar la Fase 9** (`docs/fase9-entrenadores.md`), ya sin prerrequisitos pendientes. Para el selector hace falta un Asistente atado a dos entrenadores.
5. Luego 10, 11, 12, 13 (+ `docs/data-anterior.md`) y 14, siempre dándole solo lo que no se puede verificar sin pantalla.
6. Antes de lanzar: **siembra de prod** (primer Propietario; lo de prueba ya se quitó el 2026-10-05) y Fase 15 (SMTP Resend, fugas por rol, e2e, accesibilidad).

### Corte de sesión — 2026-10-02

**Lo que pasó entre el 2026-10-01 y el 2026-10-02:**

- **Arranque de cero decidido** (ver arriba) y **respaldo definitivo** de la prod vieja hecho, comprobado y restaurado.
- **Esquema `archivo`** creado y cargado en dev y prod (`0013` + carga, verificados por MCP).
- **Reportes → Data anterior** construida y en `dev`: resumen con 8 cifras y 8 gráficas, 15 conjuntos con buscador, filtros, orden y Excel, y Excel de todo el archivo. El cliente la vio: "perfecto". Tarjeta movida al final con borde ámbar.
- **Fallo encontrado de paso:** la exportación a Excel de Reportes (Fase 13) **se cortaba siempre**. Arreglada, con prueba.
- **Lovable fuera del proyecto:** `favicon.ico` era su corazón (de ahí el icono en Vercel), `placeholder.svg` y `robots.txt` eran de su plantilla. `robots.txt` ahora prohíbe indexar. Y fuera 8 portadas sin uso (21 MB).
- **`production` de Railway responde otra vez** con `db:"ok"` (el 404 "Application not found" del 2026-09-17 ya no está).
- **Prod tenía `0004_seed_dev` aplicado por error** (Colegio de Pruebas Dev + 1 actividad + 2 disciplinas). Los catálogos sirven; lo de prueba hay que quitarlo antes de lanzar.

**Cola de pruebas** (el cliente prueba en pantalla contra `dev`, responde por número, Claude verifica por MCP).

> **Regla desde el 2026-10-02:** al cliente se le da **solo** lo que Claude no pudo verificar —cómo se ve, si se entiende, uso real en pantalla, móvil, modo oscuro—. Lo verificado (SQL contra dev por MCP, reglas con tests, alcance, conteos, casos cruzados) se le **cuenta** en una lista aparte, no se le pide probar. La lista de 45 de la Fase 8 le costó horas.

| Fase | Estado | Documento |
|---|---|---|
| 6 — Usuarios, Roles, Permisos, Perfil | ✅ cerrada, 17/17 | — |
| 7 — Colegios | ✅ cerrada, 13/13 | — |
| 8 — Actividades y Disciplinas | ✅ cerrada el 2026-10-02 · Disciplinas v2 y colores hechos y probados el 2026-10-06 | `docs/disciplinas-v2.md` |
| 9 — Entrenadores | ⬜ prerrequisitos hechos el 2026-10-06; lista para probar | `docs/fase9-entrenadores.md` |
| 10 — Estudiantes | ⬜ | `docs/fase10-estudiantes.md` |
| 11 — Asistencias | ⬜ | `docs/fase11-asistencias.md` |
| 12 — Evaluaciones | ⬜ | `docs/fase12-evaluaciones.md` |
| 13 — Tablero y Reportes | ⬜ | `docs/fase13-tablero-reportes.md` |
| 13 — Data anterior | ⬜ 15 pruebas (vista y aprobada a ojo) | `docs/data-anterior.md` |
| 14 — Encuestas y Representantes | ⬜ | `docs/fase14-encuestas-representantes.md` |
| 14B — Inscripciones | ⬜ construida; el cliente la está probando en dev vacío | `docs/fase14b-contratos.md` §8 |

**Al retomar — "¿en qué nos quedamos?" (decidido por el cliente el 2026-10-02):**

> *(Histórico — el vigente es el corte del 2026-10-06, más arriba.)* **Lo siguiente (corte del 2026-10-05, noche): Disciplinas v2.** Una disciplina pasa a ser un grupo con varios horarios (Fútbol G1 = lunes y miércoles), se cobra una vez, máximo 2 por niño sin cruces, todo configurable. Análisis completo en `PVCAR/docs/disciplinas-v2.md`. **Al retomar: hacerle una por una las 6 preguntas de su §7 (pedido explícito del cliente: quiere que se le pregunte para quedar conforme) y no construir hasta tener las respuestas.** Resuelve también el pendiente del cobro de la 14B.
>
> Contexto: el cliente prueba en **dev vacío** (catálogos, 4 Propietarios, `archivo`; sin los 796 alumnos de prueba) con sus dos colegios reales. Prod limpia, con Flowward como único Propietario. Estado de Inscripciones en `docs/fase14b-contratos.md`.

1. `/api/v1/health` en los dos ambientes → `db:"ok"`.
2. **Disciplinas v2** (`docs/disciplinas-v2.md`): primero las 6 preguntas, después migración + Disciplinas, Inscripción, Estudiantes, Entrenadores, Asistencias, Evaluaciones, Reportes y Tablero. Después, las pruebas de Inscripciones (`docs/fase14b-contratos.md` §8). Migraciones `0001`–`0020` aplicadas en dev y prod.
2b. **Más revisiones de alcance por rol**, como la del 2026-10-05 (§8): el cliente las pidió para más adelante.
3. **Preparar la Fase 9** (`docs/fase9-entrenadores.md` §1b): auxiliar con varios titulares —migración de unicidad parcial, quitar el 409, selector "de quién ver" con la opción "Todos"— y aviso de choque de horario de un entrenador. Verificar todo lo verificable antes de darle la lista.
4. En la Fase 9: quitar el rol de Entrenador con asignaciones activas → 409 (heredada de la 6), y devolverle sus 4 disciplinas a Alex (`usu_id` 60) en dev.
5. **PR `dev` → `main`** cuando el cliente lo pida. Hasta entonces producción sigue con el favicon de Lovable y sin Data anterior.
6. Antes de lanzar: **siembra de prod** — quitar el colegio, la actividad y las disciplinas de prueba, y crear el primer Propietario. Archivo `.sql` sin escribir.
7. Fase 15 (SMTP con Resend, auditoría de fugas con un token por rol, e2e, accesibilidad).

**Pendientes de construir** (anotados el 2026-10-02; **los dos hechos el 2026-10-06** con Disciplinas v2 — el choque de horario se **bloquea**, no solo se avisa):

- **Asistente o respaldo con varios entrenadores**, con un **selector arriba para elegir de quién ver las clases, incluida la opción "Todos"**. Hoy el backend da 409 si ya respalda a alguien: migración de unicidad parcial `(usu_id, ent_id) WHERE est_id = 1`, quitar esa regla, y el selector en las pantallas del asistente.
- **Aviso cuando un entrenador quede con dos clases a la misma hora** el mismo día, aunque sean de colegios distintos. Hoy nada lo impide.

**Pendientes del cliente (correo, 2026-10-07):**

- ~~**Plantillas de correo de Supabase Auth**~~ (pegadas el 2026-10-07) en `PVCAR_Dev` y `PVCAR`: pegar `PVCAR/docs/correos/recuperar-contrasena.html` en *Reset password* (usa `{{ .ConfirmationURL }}`). Resend ya está conectado como SMTP, pero los correos de recuperación de **dev** no aparecen en Resend: revisar que el SMTP esté puesto también en `PVCAR_Dev` (cada proyecto tiene el suyo).

**Pendientes de revisar (pedidos del cliente, 2026-10-07):**

- **Reportes, todo lo que sale:** repasar cada reporte (columnas, filtros, conteos, Excel y gráficas) contra lo que hay en la base, con datos de dev, y que cada uno tenga sentido con Disciplinas v2 (varios días por disciplina) y el alcance de cada rol.
- **Permisos, módulo por módulo:** que las acciones de cada módulo (ver, crear, editar, eliminar) tengan sentido y hagan lo que dicen. Hoy hay módulos donde `ver` habilita escribir (Asistencias, Evaluaciones, Encuestas) y otros, como Encuestas e Inscripciones, que van por una guarda de personal además del permiso. Revisar el modal de Permisos y el backend juntos y dejar una tabla clara de qué habilita cada casilla.

**Pendientes nuevos (pedidos del cliente, 2026-10-07, tarde):**

0. **Configuración de correos en la plataforma** — **construida el 2026-10-07** (`c994985`, en `dev`; migración `0024` y variable `CORREO_DOMINIO` pendientes del cliente). Tipos: `inscripciones` (aprobada → representante + CC) e `inscripciones_aviso` (nueva → lista fija "Para" + CC, con resumen y PDF; `deb05df`, migración `0025`). Asunto fijo en el código. Decidido así:
   - **Railway** guarda solo `RESEND_API_KEY` y el dominio verificado (`activareforce.com`).
   - **Una tabla, una fila por tipo de envío** (inscripciones, novedades, ausencias): nombre del remitente, parte local de la dirección (el dominio es fijo y no se escribe), copias, destinatarios de gerencia y "responder a".
   - **Las copias van visibles (CC, no CCO):** el representante debe ver a quién más le llegó.
   - **Solo Propietario**, comprobado también en el backend. Se edita desde la pestaña Configuración de cada módulo, con un componente común.
   - **Sin botón de correo de prueba:** lo prueban ellos.
   - **`CORREO_REMITENTE` se borra de Railway** cuando la tabla lo sustituya; sin respaldo.

1. **Tomar asistencia más fluido** — alumnos y entrenadores: analizar y proponer cómo hacerlo más rápido y fácil.
2. ~~**Fechas que no cuadran**~~ — **hecho el 2026-10-07** (`1327375`, en `dev`): todo en hora de Ecuador vía `lib/fecha.ts` (back y front). De 19:00 a 23:59 se tomaba la fecha UTC (= mañana) al asignar/quitar entrenador, en la lista de alumnos vigentes, en fechas de creación de Reportes/Data anterior/Encuestas, en el sello del Excel y en la edad; y las columnas `date` llegaban al navegador como el día anterior. Las fechas de asistencia en sí ya estaban bien (las pone el servidor en hora de Ecuador).
3. **Reportes con hoja "Resumen"** en todos los Excel: ya filtrado y agrupado, para que nadie tenga que trabajar el Excel a mano. Casos para verificar:
   - **ej1:** cuántas veces vino cada profe (entrenador → nº de asistencias en el rango).
   - **ej2:** lista de estudiantes por disciplina (agrupada por disciplina).
4. ~~**Cambio de entrenador en una disciplina**~~ — **verificado el 2026-10-07**: 21/21 comprobaciones con las funciones reales del backend contra un Postgres local con `0001`–`0023`. Reemplazar, cerrar, mover, dar de baja y volver a asignar **no borran ni cambian** ninguna asistencia (huella md5 idéntica antes y después); la asignación se cierra con fecha; las listas de fechas pasadas siguen enseñando al que salió con sus marcas; el nuevo ve el historial y pasa lista; el que salió pierde el acceso (403); eliminarlo se rechaza (409) y la pantalla dice por qué; los reportes conservan su nombre. **Decidido por el cliente:** (a) cuando un entrenador se queda **sin ninguna** disciplina (reemplazo, quitarle la última, baja de disciplina o de la persona), sus auxiliares se desvinculan y un modal recuerda atarlos a mano al nuevo — hecho en `0a29a87`, verificado 9/9 contra Postgres local; (b) `entrenador_auxiliar` sigue sin fechas: lo dejamos simple.
5. ~~**Correo de inscripción aprobada**~~ — hecho con el 0 (la fila arranca como "Inscripcion Activa Reforce"; las copias las pone el Propietario). Era: remitente con nombre "Inscripcion Activa Reforce" (hoy "inscripciones"), asunto "Tu inscripción fue aprobada"; enviarlo desde `CORREO_REMITENTE` y **con copia** a otro correo (nueva variable en Railway).
6. **Módulo nuevo "Novedades":** cualquier rol escribe una novedad/incidencia. Tipos: general (la ven los Propietarios; correo a gerencia), sobre un alumno (correo a gerencia y al representante), sobre un entrenador (correo al entrenador y a gerencia). Remitente `novedades@dominio` y correo de gerencia en variables de Railway. En el modal se ve quién la escribió. **Hacerle preguntas antes de construir.**
7. **Aviso automático de ausencia:** correo al representante cuando su hijo queda ausente; los envíos se ven en Novedades.
8. **Pagos mensuales:** módulo nuevo o parte de Inscripciones — **el cliente lo va a contar**, no empezar sin eso.

**Pendientes de decidir:**

- ~~**Permisos de escritura** de Asistencias, Evaluaciones y Encuestas~~ — resuelto el 2026-10-07 con la `0026` (ver punto 6).
- **Fase 13 §4:** si el reporte de Alumnos sigue sacando la información de salud.
- **Fase 12 §4:** que Mobak escale su 0–2 al puntaje del parámetro.
- **Fase 11 §4:** si se permiten fechas futuras en asistencia. Dato: el sistema viejo las permitía y en `archivo` hay marcas hasta el 2026-10-05.
- **Flujo de invitación por correo** en vez de contraseña puesta por el admin: se pregunta cuando Resend funcione.

**Ya no aplica por el arranque de cero:** el dump fresco del cutover, los 19 chequeos de compatibilidad, el backfill de Auth antes de la carga, los triggers apagados en la carga, la copia del bucket `usufoto` al proyecto nuevo, el correo inválido de Bernard (`usu_id` 119) y los 4 entrenadores con usuario de baja y ficha activa: eran problemas de los datos que iban a migrarse.

**Lo verificado sin backend, que no hay que repetir:** las consultas de los módulos ejecutadas contra `PVCAR_Dev` por MCP, las de Data anterior contra una copia local de `archivo`, las FK revisadas una a una, y **474 pruebas automáticas** en el backend (eran 59 al empezar). `lint` sin errores y `build` verde en cada commit.

**Datos:** `PVCAR_Dev` tiene en `public` los datos reales de la carga del 2026-08-06, solo para probar. `PVCAR` (prod) tiene en `public` los catálogos y lo de prueba por quitar, y en `archivo` la plataforma vieja entera.

---

## 2. Arquitectura y reglas de oro

```
                     GitHub: ActivaReforce/PVCAR  (main | dev)
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        │ /frontend                                    /backend │
        ▼                                                       ▼
┌────────────────────┐        HTTPS + JWT        ┌──────────────────────┐
│  Vercel            │ ────────────────────────▶ │  Railway             │
│  Production ← main │ ◀──────────────────────── │  production ← main   │
│   (dominio propio) │           JSON            │  development ← dev   │
│  Preview    ← dev  │                           └──────────┬───────────┘
└─────────┬──────────┘                                      │ service-role
          │ anon key SOLO para sesión                        ▼
          └──────────────────────────────────▶ ┌──────────────────────────┐
                                               │ Supabase (cta. Activa)   │
                                               │  PVCAR       ← Railway   │
                                               │  PVCAR_Dev   ←  prod/dev │
                                               └──────────────────────────┘
```

| Pieza | URL | Rama | Base |
|---|---|---|---|
| Railway `production` | `pvcarbackend-production.up.railway.app` | `main` | `PVCAR` |
| Railway `development` | `pvcarbackend-development.up.railway.app` | `dev` | `PVCAR_Dev` |
| Vercel Production | `pvcar.vercel.app` | `main` | `PVCAR` |
| Vercel Preview | `dev-pvcar.vercel.app` | `dev` | `PVCAR_Dev` |

**Reglas de oro (no negociables):**

1. `SUPABASE_SERVICE_ROLE_KEY` y `DATABASE_URL` viven **solo** en variables de Railway. Nunca en el front, nunca en git.
2. El frontend usa Supabase **únicamente** para login/sesión. Todo dato pasa por el API.
3. Toda lógica de negocio —alcance, scoring, transiciones de estado, agregaciones— vive en el backend.
4. Ningún endpoint sin validación `zod` y sin chequeo de permisos.
5. Cada cambio de schema es una migración versionada en `PVCAR/db/migrations`, copiada a `SQL/` para que el cliente la ejecute. Nada a mano en el dashboard.
6. `activa-forge-login/` es el sistema en producción: **no se toca hasta la Fase 17.** Solo referencia.

**Flujo de trabajo:** commit a `dev` → CI (`check` + `secrets-scan`) → deploy automático a Railway `development` y preview de Vercel → pruebas → PR a `main`.

---

## 3. Reglas transversales — valen para todos los módulos

Esto es el contrato de cada fase. Si un módulo no cumple estas 24 líneas, no está terminado.

### 3.1 Seguridad y alcance

| # | Regla |
|---|---|
| T1 | **El alcance se decide en el backend, desde el token.** Una sola función, `alcanceDe(usuario)`, devuelve los `col_id` y `colacthor_id` permitidos. Ninguna pantalla decide qué puede ver. |
| T2 | **El alcance de un usuario es la unión de los alcances de todos sus roles.** Nunca un `return` temprano por rol: quien es coordinador *y* entrenador ve las dos cosas. |
| T3 | Permisos por `(modulo, accion)` comprobados en el servidor con `requirePermission`. Que el botón esté oculto no es seguridad. |
| T4 | Ningún endpoint devuelve columnas que su pantalla no usa. Nada de `select *` con joins anidados a `usuario`. |
| T5 | Las fotos van por **URL firmada** emitida por el backend. El bucket `usufoto` es privado y el front nunca lo toca directo. |

### 3.2 Datos

| # | Regla |
|---|---|
| T6 | **Una operación de negocio = una transacción.** Si toca tres tablas y falla la segunda, no queda nada a medias. |
| T7 | **Paginación, filtros, orden y conteos en SQL.** Nunca `array.filter().length` sobre una página. `ORDER BY` con lista blanca. |
| T8 | Cada contador declara **qué filtro ignora a propósito**; si no, dos contadores se contradicen en la misma pantalla. |
| T9 | **Baja lógica (`est_id = 2`) y borrado permanente son dos operaciones distintas.** El borrado exige: recuento previo de lo que destruye, modal con el número exacto, confirmación **escribiendo el nombre**, permiso `<modulo>.eliminar` y registro en `auditoria`. |
| T10 | Si el borrado no se puede hacer (referencias sin cascada), la pantalla **dice por qué** y ofrece la baja lógica. |
| T11 | Todo cambio de alta, baja, borrado, roles o permisos escribe en `auditoria`, dentro de la misma transacción. |
| T12 | Nada de números mágicos: `ROL.ENTRENADOR`, `ESTADO.ACTIVO`, `ASISTENCIA.PRESENTE`. |
| T12b | **Fechas y horas en hora de Ecuador.** La base y Railway están en UTC; se guarda, filtra, compara y enseña en `America/Guayaquil`, siempre a través de `lib/fecha.ts`. Nunca `CURRENT_DATE`, `marca::date`, `to_char(timestamptz)` sin zona ni `toISOString()` para "hoy". Se prueba el caso de 19:00 a 23:59 (en UTC ya es mañana). |

### 3.3 Frontend

| # | Regla |
|---|---|
| T13 | **react-query como única fuente de datos.** Invalidación por clave. Prohibido sincronizar con eventos del DOM. |
| T14 | Cero `any` en la capa de datos; los tipos los define el backend y los comparte el front. |
| T15 | Las rutas del cliente van **sin `/api/v1`**: `VITE_API_URL` ya lo trae. |
| T16 | Al reestructurar se **borra** lo que quedó sin uso: hooks huérfanos, envoltorios de una línea, markup duplicado. |
| T17 | Ningún componente que solo pase props sin decidir nada. |

### 3.4 Responsive y apariencia — se verifica siempre, no "si da tiempo"

| # | Regla |
|---|---|
| T18 | **Tres anchos obligatorios: 360 px (móvil), tablet y escritorio.** Modales incluidos. |
| T19 | **Una sola vista por pantalla.** Nada de un árbol de markup para móvil y otro para escritorio: divergen y el de móvil se queda sin la mitad de los datos (ya pasó en Usuarios). Si móvil y escritorio deben verse distinto, es CSS sobre el mismo markup. |
| T20 | Las tablas se vuelven **tarjetas apiladas** en móvil, no tablas con scroll horizontal. La acción principal de cada fila queda visible sin abrir menús. |
| T21 | **Modo claro y modo oscuro**, pantalla por pantalla y modal por modal. Tokens del tema: nada de `bg-gray-*` ni `text-white` fijos. El rojo de marca va por la variante `brand` del botón. |
| T22 | Datos largos no rompen nada: correo de 45 caracteres, nombre de 60. `min-w-0` + `truncate` en tablas, `break-words` en fichas. |
| T23 | Los modales se centran con `translate`: un `mx-4` los desplaza, no los encoge. El ancho debe descontar el margen. |
| T24 | Área táctil mínima de 44 px en botones de fila; los filtros en móvil van en un desplegable, no en una fila de botones que se sale de la pantalla. |

### 3.5 Definición de "terminado"

Un módulo está listo cuando, **en este orden**:

1. Cada endpoint probado **por HTTP contra dev**. Sin token = 401, no 404.
2. Cada consulta SQL nueva ejecutada contra `PVCAR_Dev` por MCP antes de subirla. TypeScript no mira dentro de las cadenas SQL.
3. El CRUD completo recorrido a mano: crear, ver, editar, dar de baja, reactivar, eliminar — cada uno con su caso que **debe** fallar.
4. F5 en cada ruta del módulo: se queda donde estaba.
5. Consola del navegador **sin un solo error**; pestaña de red sin llamadas directas a Supabase salvo la sesión.
6. Los conteos cuadran y la suma de las partes se explica.
7. Los tres anchos y los dos temas, mirados de verdad.
8. `typecheck`, `lint`, `test`, `build` en los dos workspaces.
9. **Solo entonces** se le pide al cliente que pruebe, con la lista de lo que ya está verificado y de lo que no.

> La lista larga vive en `PVCAR/docs/checklist-modulos.md`. Existe porque en la Fase 6 se dio el módulo por listo cuando lo único verificado era que compilaba, y salieron trece arreglos detrás. **El cliente no es el banco de pruebas.**

---

## 4. Catálogos del sistema

Verificados en `PVCAR_Dev` el 2026-09-16. Son los mismos IDs que la prod vieja.

**`rol`** — 1 Propietario PVCAR · 2 Coordinador de Colegio · 3 Entrenador · 4 Representante · 5 Administrador Activa Reforce · 6 Asistente · 7 Respaldo Entrenador

**`estado`** — 1 Activo · 2 Inactivo · 3 Borrador · 4 Finalizado · 5 Publicado · 6 Pendiente · 7 Evaluado

**`asistencia_estado`** — 1 Presente · 2 Ausente · 3 Tarde · 4 Justificado

**`dia`** — 1 Lunes … 7 Domingo

**`categoria`** (de actividad) — Deportiva, Artística, Artística-Deportiva, Científico-Deportiva, Científica, Artes Marciales

**`evaluacion_tipo_metodo`** — 1 por tiempo · 2 por logro · 3 por escala · 4 Mobak (6 intentos) · 5 Mobak (2 intentos)

**`encuesta_tipo_respuesta`** — 1 Texto corto · 2 Texto largo · 3 Escala · 4 Fecha · 5 Hora · 6 Sí/No

**Módulos de permisos** (14, con sus acciones aplicables):

| Módulo | Acciones |
|---|---|
| `dashboard`, `perfil`, `permisos`, `encuestas`, `asistencias_estudiantes`, `asistencias_entrenadores` | ver |
| `entrenadores` | ver, editar |
| `reportes` | ver, crear |
| `usuarios`, `colegios`, `actividades`, `disciplinas`, `estudiantes`, `evaluaciones` | ver, crear, editar, eliminar |

---

## 5. Cómo se conectan los módulos

### 5.1 El eje: la disciplina

`colegio_actividad_horario` (`colacthor_id`) es **una disciplina**: colegio + actividad + día + franja horaria. Cuatro tablas cuelgan de ella:

```
colegio ─┐
actividad ┼─▶ colegio_actividad_horario  ← "una disciplina"
día ──────┘            │
                       ├── nino_asignacion        quién está inscrito
                       ├── entrenador_asignacion  quién la da
                       ├── evaluacion_asignacion  qué evaluación se aplica
                       └── asistencia_nino        la asistencia de cada sesión
```

Todo lo que se ve en pantalla —listas de alumnos, asistencias, evaluaciones pendientes— es una consulta que pasa por ahí.

### 5.2 Identidades que se solapan

- **`entrenador.ent_id` ES `usuario.usu_id`.** Un entrenador no es una entidad aparte: es un usuario con ficha de entrenador.
- **`padre.usu_id`** es 1:1 con `usuario`. Un representante es un usuario con ficha de padre.
- **`entrenador_auxiliar`** ata un usuario (rol 6 Asistente o 7 Respaldo) a uno **o varios** entrenadores (pedido del 2026-10-01; hoy el código aún limita a uno). El auxiliar no tiene alcance propio: hereda la unión del de sus entrenadores.

### 5.3 Cómo se calcula el alcance de cada rol

| Rol | Camino |
|---|---|
| 1 Propietario, 5 Admin Activa Reforce | todo |
| 2 Coordinador | `colegio_coordinador` → sus `col_id` |
| 3 Entrenador | `entrenador_asignacion` (activas, `entasig_fecha_fin IS NULL`) → `colacthor_id` → `col_id` |
| 6 Asistente / 7 Respaldo | `entrenador_auxiliar` → su `ent_id` → repite el camino del entrenador |
| 4 Representante | `nino_padre` → sus hijos → `nino_asignacion` → `colacthor_id` |

**Unión, siempre** (regla T2).

### 5.4 Qué rompe qué — efectos entre módulos

| Acción | Consecuencia |
|---|---|
| Dar de baja a un **usuario** | Se desactiva su ficha de entrenador y **se cierran sus asignaciones abiertas** con fecha de hoy. Reactivarlo **no** las reabre: se reasignan en Entrenadores. |
| Quitarle el rol de **entrenador** a alguien con asignaciones activas | Se rechaza (409) diciendo cuántas lo impiden. |
| Quitarle el rol de **coordinador** a alguien con colegios a cargo | Se rechaza (409) con el número de colegios. |
| Borrar una **disciplina** | Arrastra inscripciones, asignaciones de entrenador, evaluaciones asignadas y asistencias. Hoy el sistema viejo solo dice "revise que no tenga nada atado". |
| Borrar un **colegio** | Bloqueado si tiene disciplinas. |
| Borrar una **actividad** | Bloqueada si existe una disciplina con ella. |
| **Inscribir a un alumno** en una disciplina | Un trigger crea automáticamente sus filas en `evaluacion_nino_pendiente` para las evaluaciones activas de esa disciplina. |
| Añadir/editar/borrar un **parámetro de evaluación** | Un trigger recalcula `evaluacion.eva_puntaje_total`. |
| Borrar un **alumno** permanentemente | Cascada: inscripciones → evaluaciones pendientes → intentos; asistencias; vínculos con representantes. Destruye el historial entero. |
| Borrar un **usuario** permanentemente | Falla si registró asistencias (`asistencia_nino.usu_registrador`) o creó evaluaciones (`evaluacion.eva_creador`): esas FK **no** tienen cascada. |

**Los dos triggers hay que apagarlos en cargas masivas** (`nino_asignacion` y `evaluacion_parametro`), o revienta con `duplicate key ... evaluacion_nino_pendiente_pkey`. Reaparece en el cutover.

### 5.5 Orden de construcción y por qué

```
6 Usuarios ─▶ 7 Colegios ─▶ 8 Actividades+Disciplinas ─▶ 9 Entrenadores ─▶ 10 Estudiantes
                                                                              │
                                    11 Asistencias ◀─────────────────────────┤
                                    12 Evaluaciones ◀────────────────────────┘
                                             │
                                    13 Tablero y Reportes
                                             │
                                    14 Encuestas y Representantes
```

Cada flecha es una dependencia real: Estudiantes necesita disciplinas para inscribir; Asistencias necesita inscripciones; Reportes necesita todo.

> **Cambio respecto al plan anterior:** Encuestas pasa del puesto 13 al 14, después de Tablero y Reportes. Motivo medido, no opinión: `encuesta`, `encuesta_pregunta`, `encuesta_respondida`, `encuesta_respuesta`, `padre` y `nino_padre` tienen **cero filas en producción**. Es código vivo sobre datos que no existen. El cliente decidió que el módulo se mantiene (D1), pero va al final.

---

## 6. Fases 0–5 — hechas

| Fase | Qué quedó |
|---|---|
| **0** | Cuentas GitHub/Supabase/Railway/Vercel de Activa Reforce con 2FA. Respaldo de prod del 2026-07-27 en `Backup_bd/` + manifiesto de conteos (referencia de verificación del cutover). Dominio `activareforce.com` en Cloudflare. |
| **1** | Monorepo `ActivaReforce/PVCAR`, `main` protegida (checks `check` y `secrets-scan`, sin revisión obligatoria), npm workspaces, CI con lint + typecheck + build + test + escaneo de secretos. |
| **2** | 35 tablas, 63 FK, 107 índices, 6 funciones, 3 triggers en las dos bases. RLS `ENABLE` + `FORCE` en las 35 con **0 políticas**. Bucket `usufoto` privado. `anon`/`authenticated` sin ningún privilegio, ni sobre tablas ni sobre funciones. Correcciones de diseño imposibles de hacer en caliente: `auth_user_id` con CHECK, sin columna de contraseña, índice en todas las FK, unicidades que faltaban. |
| **3** | Backend Express+TS en Railway, dos ambientes, `/api/v1/health` con `db:"ok"`, servicios en `us-east4` (Virginia) para no pagar 55 ms por consulta contra Ohio. |
| **4** | Frontend en Vercel, Production←`main` y Preview fijo←`dev`, env vars por ambiente, `lib/api.ts` con JWT y logout en 401. |
| **5** | Autenticación real: login por el backend (un viaje trae sesión + usuario + roles + permisos), logout global, reset por correo con pantalla `/reset-password`, cambio de contraseña desde Perfil, rate limit por IP+cuenta. 12/12 pruebas. `backfill-auth.ts` idempotente listo para el cutover. |

Detalle histórico completo en `Bitacora.md`.

---

## 7. Fases 6–14 — los módulos

**Patrón de cada fase:** leer cómo funciona hoy → escribir los endpoints en `backend/src/modules/<modulo>` (zod + permisos + transacciones) → mover la lógica del navegador al servidor → reemplazar `supabase.from(...)` por llamadas al API con react-query → **probar contra dev** → borrar el código que quedó huérfano → checklist de la sección 3.5 → PR.

---

### Fase 6 — Usuarios, Roles, Permisos y Perfil

**Para qué sirve:** dar de alta a las personas, decidir qué es cada una y qué puede hacer. Todo lo demás depende de esto.

**Estado:** construida, desplegada en `dev`, **sin escrituras probadas**. `0006_auditoria.sql` aplicada en dev, pendiente en prod.

#### Cómo funciona

**Pantalla de Usuarios** — abre en la lista (Activos, todos los roles).

| Elemento | Comportamiento |
|---|---|
| Filtros de estado | Activos / Inactivos / Todos, con su conteo |
| Tarjetas por rol + "Ver todos" + "Sin rol" | Filtran la lista; cada una con su conteo |
| Buscador | Nombre o correo, con debounce |
| Tabla | Nombre, correo, teléfono, roles, estado, fecha. Paginada en el servidor |
| Botón "Nuevo usuario" | Formulario: nombre, correo, teléfono, foto, **contraseña escrita por el administrador**, y uno o varios roles |
| Menú de fila | Ver ficha · Editar · Cambiar contraseña · Dar de baja / Reactivar · Eliminar permanentemente |

**Reglas de negocio:**

1. Un usuario puede tener **varios roles**; el alcance es la unión (T2).
2. Marcar el rol de entrenador crea la ficha en `entrenador` (con cédula); el rol de representante crea la de `padre`.
3. Correo repetido → 409 con mensaje claro y **sin dejar cuenta huérfana en Auth**.
4. Cambiar el correo lo cambia también en Supabase Auth.
5. Quitar rol de entrenador con asignaciones activas → 409 con el número. Quitar rol de coordinador con colegios a cargo → 409 con el número.
6. Dar de baja: `est_id = 2`, se desactiva la ficha de entrenador, se cierran sus asignaciones abiertas, y deja de poder entrar.
7. Reactivar: vuelve a activo; las asignaciones **no** se reabren.
8. **Nadie puede dejar al sistema sin Propietario activo**, ni quitarle a ese rol el permiso `permisos.ver`.
9. Los roles se actualizan **por diferencia**, no borrando todos e insertando de nuevo.

**Pantalla de Permisos:** selector de rol + matriz de 14 módulos × 4 acciones. Guardar aplica en una transacción. Si el rol es propio, los permisos cambian sin recargar.

**Pantalla de Perfil:** ficha propia (foto por URL firmada, **todos** los roles, no solo uno), edición de teléfono, y cambio de contraseña exigiendo la actual. El sujeto sale del token, nunca de la URL.

#### Qué se arregló del sistema viejo

- La autorización se decidía en el navegador → ahora sale del token, en el servidor, en una sola función.
- Guardar un usuario eran hasta seis escrituras sueltas; si fallaba la cuarta el usuario quedaba **sin ningún rol** → una transacción.
- Se traía la tabla entera y se filtraba, contaba y paginaba en el navegador → todo en SQL.
- `rol_id === 3` (23 apariciones) y comparaciones por nombre de rol → constantes.
- El borrado permanente solo preveía un error de FK que con las cascadas nunca llega a producirse → recuento previo, confirmación escribiendo el nombre, bloqueo con motivo y auditoría.

#### Revisión del 2026-09-16 — tres fallos encontrados y corregidos

Con Railway apagado no se puede probar por HTTP, así que se revisó el módulo entero y se verificó todo lo que no necesita el backend vivo. Salieron tres cosas, dos de ellas serias:

| Fallo | Qué pasaba | Arreglo |
|---|---|---|
| **Escrituras sin comprobar el alcance** | `GET /usuarios/:id` sí comprobaba el alcance, pero `PATCH`, `baja`, `reactivar`, `impacto` y `DELETE` **no**. Con solo cambiar el id de la URL, cualquiera con `usuarios.editar` podía editar, dar de baja o borrar a quien fuera — incluido el Propietario. Hoy solo el Propietario tiene ese permiso, así que la puerta estaba cerrada por costumbre, no por diseño: el día que se le dé `usuarios.editar` a un Coordinador desde Permisos, se abre | `exigirAlcance` en las cinco operaciones |
| **Escalada de privilegios por los roles** | Nada impedía que quien tuviera `usuarios.editar` se concediera el rol de Propietario a sí mismo, ni que un no-global nombrara Propietarios | Reglas nuevas en `usuarios.reglas.ts`: solo un rol global concede o retira roles globales, y **nadie se concede a sí mismo un rol que no tenía** (quitárselos sí, que no escala) |
| **La tabla mentía en móvil** | `UserTable` tenía dos markups. El de móvil pasaba `canEdit`/`canDelete` en `true` fijo: en el teléfono aparecían acciones que el servidor iba a rechazar con 403. Además no mostraba ni roles ni estado y no dejaba ordenar | Un solo markup responsive (rejilla que se apila en móvil), `ConditionalAction` en los dos tamaños, botones de 44 px, y orden también en el teléfono. `UserActionMenu` quedó sin uso y se borró |

Menor: el selector de rol de móvil no era controlado, así que al elegir el rol que ya estaba Radix no emitía el cambio y no había forma de quitarlo salvo pasando por "Ver Todos". Ya es controlado.

**Lo verificado sin backend (12 comprobaciones):**

| Qué | Cómo |
|---|---|
| Las 6 consultas SQL del módulo | Ejecutadas contra `PVCAR_Dev` por MCP con parámetros reales: lista, conteos, alcance, visibilidad, ficha e impacto. Ninguna da error |
| Alcance de un auxiliar (rol 6) | `usu_id` 85 → colegio 11 y 4 disciplinas, por el camino `entrenador_auxiliar → entrenador_asignacion` |
| Alcance y lista de un coordinador | `usu_id` 58 (colegio 14) → ve 7 usuarios activos, no los 45 |
| Los conteos cuadran | 7 activos = 1 coordinador + 5 entrenadores + 1 asistente + 0 sin rol. Sumados en SQL, no en el navegador |
| Filtro "Sin rol" | Devuelve exactamente los 2 documentados (`usu_id` 65 y 101, inactivos) |
| Búsqueda + filtro de rol combinados | `buscar=ana` + `rol=3` → 4 filas, con el total en la misma consulta |
| El recuento de borrado distingue bien | `usu_id` 101 sin nada → se puede borrar; `usu_id` 65 con 2 asignaciones y `usu_id` 60 con 102 asistencias → bloqueados con el motivo |
| Que los bloqueos sean los correctos | Revisadas las 18 FK que apuntan a `usuario`, `entrenador` y `padre`: las que tienen cascada están en "eliminables" y las que no, en "bloqueos". Cuadra una a una |
| Que los INSERT no revienten | Comprobados defaults, nulos e identidades de `auditoria`, `usuario`, `usuario_rol`, `entrenador` y `padre`, y que existe el `UNIQUE (usu_id, rol_id)` del que depende el `ON CONFLICT` |
| Las puertas sin token | 15 rutas del módulo responden 401 sin token (test automático) |
| Las reglas de roles | 14 pruebas unitarias nuevas |
| Las cinco puertas de alcance | 7 pruebas nuevas de servicio con el pool simulado |

`typecheck`, `lint` (0 errores), `test` (67 backend + 4 frontend) y `build` en verde.

#### Pruebas pendientes — necesitan Railway encendido (bloquean la Fase 7)

| Prueba | Qué tiene que pasar |
|---|---|
| Crear usuario | Con contraseña y dos roles (Entrenador + Coordinador). Debe poder entrar. En la base: fila de `usuario`, dos de `usuario_rol`, una de `entrenador`, cuenta en Auth |
| Correo repetido | 409 claro, sin cuenta huérfana en Auth |
| Editar | Nombre, teléfono, foto. Cambiar el correo debe cambiarlo en Auth (probar entrando con el nuevo) |
| Cambiar contraseña | La nueva funciona, la vieja no |
| Quitar rol de entrenador con asignaciones | 409 con el número. No toca nada |
| Quitar rol de coordinador con colegios | 409 con el número |
| Dar de baja | `est_id = 2`, ficha desactivada, asignaciones cerradas con fecha de hoy, no puede entrar |
| Reactivar | Vuelve a activo, las asignaciones no se reabren |
| Último Propietario | Quitarle el rol, darlo de baja o eliminarlo → 409 |
| Eliminar permanente, usuario nuevo | Recuento, exige escribir el nombre, borra fila y cuenta de Auth, deja registro en `auditoria` |
| Eliminar permanente, usuario con historial | Se niega y **dice qué lo impide** |
| Permisos | Cambiar y guardar; si es rol propio, aplica sin recargar; al Propietario no se le quita `permisos.ver` |
| Perfil | Foto por URL firmada y **todos** los roles |
| Alcance del coordinador | Entrando como coordinador, la lista solo trae usuarios de sus colegios |

| **Alcance en escritura** (nuevo) | Con un coordinador que tenga `usuarios.editar`, un `PATCH` a un id fuera de sus colegios debe dar **403** |
| **Escalada de roles** (nuevo) | Un no-Propietario intentando conceder el rol 1 o 5, y cualquiera intentando concedérselo a sí mismo: **403** |
| **Móvil a 360 px** (nuevo) | La lista reestructurada: roles y estado visibles, orden funcionando, y las acciones que no se tienen permitidas **no aparecen** |

Y verificar en `auditoria` que quedó registro de cada alta, baja, borrado y cambio de roles. Hoy la tabla tiene 0 filas en dev: la primera escritura real es también la primera prueba de que se escribe.

**Deuda declarada:** editar el teléfono desde Perfil existe en el API (`PATCH /perfil`) pero la pantalla aún no lo ofrece; los roles 6 y 7 necesitan `entrenador_auxiliar`, que se gestiona en la Fase 9; `auditoria` se escribe pero ninguna pantalla la lee todavía.

---

### Fase 7 — Colegios

**Para qué sirve:** el colegio es el contenedor de todo. Define el alcance del coordinador y agrupa disciplinas y alumnos.

#### Cómo funciona hoy

Pantalla de tarjetas (5 por página) con buscador por nombre. Cada tarjeta muestra nombre, dirección, el representante del colegio (nombre, teléfono, correo, foto) y sus coordinadores.

| Botón | Qué hace |
|---|---|
| Nuevo Colegio | Formulario: nombre, dirección, datos del representante, foto, y **selección múltiple de coordinadores** |
| Editar | Lo mismo, precargado |
| Eliminar | Confirmación. Falla si hay disciplinas: *"No puede eliminar el colegio si existen disciplinas en este colegio"* |

**Reglas de negocio:**

1. Un colegio puede tener **varios coordinadores**; un coordinador, varios colegios.
2. Asignar a alguien como coordinador solo tiene sentido si tiene el rol 2 → la lista de candidatos se filtra por rol.
3. Borrar el colegio arrastra sus filas de `colegio_coordinador`, pero se bloquea si tiene disciplinas.
4. La foto del representante vive en el bucket; al reemplazarla hay que borrar la anterior.

#### Qué se mejora

- Los coordinadores se guardaban **borrando todos e insertando de nuevo**, fuera de transacción → por diferencia, en una transacción.
- La foto se subía al bucket público con URL pública → bucket privado + URL firmada.
- Búsqueda, orden y paginación en el navegador sobre la tabla entera → en SQL.
- El borrado depende de que Postgres falle por FK → **recuento previo**: "este colegio tiene 14 disciplinas y 212 alumnos" antes de dejar intentarlo.
- El coordinador solo ve sus colegios (hoy los ve todos).

#### API objetivo

`GET /colegios` (paginado, busca, alcance) · `GET /colegios/:id` · `POST /colegios` · `PATCH /colegios/:id` · `GET /colegios/:id/impacto` · `DELETE /colegios/:id` · `PUT /colegios/:id/coordinadores`

#### Pruebas

Crear con dos coordinadores · editar quitando uno y añadiendo otro · foto que reemplaza a la anterior (la vieja desaparece del bucket) · borrar uno con disciplinas → bloqueado con el motivo y el recuento · borrar uno vacío → se va y queda en `auditoria` · entrar como coordinador y ver solo los suyos · 360 px: las tarjetas se apilan, el formulario cabe.

---

#### Cerrada el 2026-09-18 — 13/13

Probada contra `dev`. Su documento se borró; lo que quedó vivo se mudó a las Fases 8, 9 y 10.

**Lo que confirmó la auditoría**, que es donde se ve de verdad: el alta con dos coordinadores, el cambio registrado como `coordinadoresQuitados: [107], coordinadoresAgregados: [112]` —una baja y un alta, no un borrado total— y el borrado con su recuento. La base volvió a su estado inicial: 8 colegios y 5 vínculos.

**Dos fallos encontrados y arreglados** (`8114e1f`):

1. **Blanco sobre blanco en modo oscuro.** `ThemeContext` pisaba seis tokens con `setProperty`, bajo el comentario *"Fix contrast issues in dark mode"*. Ese "arreglo" era el fallo: escribía `hsl(0 0% 98%)` en una variable que el tema **vuelve a envolver**, dejando `hsl(hsl(...))` —color inválido— así que el navegador tiraba la regla y el texto heredaba el blanco del padre. Y aun con el formato correcto, poner el texto al 98 % sobre un `--primary` que en oscuro también está al 98 % es blanco sobre blanco. Afectaba a **todo** `bg-primary` y dejaba `--muted-foreground` roto. Los seis tokens ya estaban bien en `.dark`: se borraron las doce líneas de JavaScript.
2. **El coordinador recién creado no aparecía** hasta recargar. Las tres listas de candidatos salen de `usuario` + `usuario_rol` pero sus claves cuelgan de otro módulo, y las mutaciones de usuario solo invalidaban `['usuarios']`. Estaba tapado con un `staleTime` corto, que no arregla nada: solo acorta la ventana en la que está mal. Ahora se invalidan las tres, así que tampoco pasará en Entrenadores ni en Estudiantes.

**Una mejora pedida en la prueba:** el selector de coordinadores pintaba a todos sin scroll ni buscador. Hoy hay 6 y caben, pero la lista no tiene tope. Buscador a partir de 8 candidatos, sin tildes, y alto máximo con scroll; los seleccionados salen siempre aunque la búsqueda no los alcance.

**Dos pruebas dadas por completas por decisión del cliente**, no ejecutadas contra el API desplegado: la 5 (coordinador inválido) y la 8 (alcance por API). Las dos exigían llamar al API a mano, porque la pantalla no deja hacerlas: el desplegable solo ofrece candidatos válidos y no hay ruta a la ficha de un colegio ajeno. **Quedan cubiertas por las 29 pruebas automáticas del módulo**, que comprueban el rechazo en el servicio, y por la prueba 7, que sí se hizo en pantalla y confirmó que un coordinador solo ve sus colegios. Lo que no se demostró es que el **API desplegado** devuelva 403 a una petición fabricada. Entra en la auditoría de fugas con un token por rol, que sigue pendiente en la Fase 15.

**Respuestas a lo que preguntó el cliente durante la prueba:**

- *¿Qué le pasa a un colegio si le quito su coordinador?* Nada se rompe: se queda sin nadie a cargo y la tarjeta lo dice. Ya ocurre con 3 colegios de los datos reales. Y esa persona pasa a ver **cero** colegios — `alcanceDe` devuelve lista vacía y eso significa "no ve nada", no "ve todo", que era justo el fallo del sistema viejo.
- *No sé la contraseña de un coordinador real.* El backfill copió las contraseñas viejas tal cual, así que están en la base antigua, pero no hace falta sacar la credencial de nadie: **`dev` es una copia**, y desde Usuarios se le puede poner la que sea. Para las fases siguientes conviene asignar el usuario de prueba como coordinador de **Innova Schools Calderón** (184 alumnos, 22 disciplinas, 605 asistencias): da un coordinador con datos reales y contraseña conocida.

---

### Fase 8 — Actividades y Disciplinas

**Para qué sirve:** la actividad es el catálogo (Fútbol, Ajedrez, Danza…). La disciplina es la actividad **puesta en un colegio, un día y una hora**. Es el eje del modelo.

#### Actividades — cómo funciona hoy

Dos vistas conmutables: **por categoría** (sobres que se expanden) y **todas**. Buscador por nombre y filtro por categoría.

| Botón | Qué hace |
|---|---|
| Nueva Actividad | Nombre, descripción, categoría, **materiales del alumno** (lista), tipo de indumentaria, espacio de trabajo, tipo de espacio, espacio secundario |
| Ver detalles | Ficha completa |
| Editar / Eliminar | Eliminar falla si existe una disciplina con esa actividad |

#### Disciplinas — cómo funciona hoy

Vista de **calendario semanal**: columnas por día, cada disciplina como bloque con su hora, su colegio y el entrenador asignado. Buscador (colegio, actividad o día) y filtro múltiple por colegio. Arriba, dos conteos: total y cuántas tienen entrenador.

| Botón | Qué hace |
|---|---|
| Crear Nuevas Disciplinas | Formulario **múltiple**: se elige colegio + actividad y se marcan varios días con sus horas de una vez |
| Editar | Colegio, actividad, día, hora de inicio y fin |
| Eliminar | Confirmación. Falla si tiene entrenador, alumnos o evaluaciones atados |

**Lo que ve cada rol:** el coordinador, las de sus colegios; el entrenador y sus auxiliares, solo las suyas (sin botón de crear); el representante, solo las de sus hijos, con pestañas si tiene más de uno.

**Reglas de negocio:**

1. Una disciplina es única por (colegio, actividad, día, hora de inicio). Hoy nada lo impide: se pueden crear duplicados exactos.
2. La hora de fin debe ser posterior a la de inicio.
3. Cambiar el día o la hora de una disciplina con asistencias registradas **reescribe la historia**: debe avisar.
4. Borrarla arrastra inscripciones, asignaciones, evaluaciones asignadas y asistencias.

#### Qué se mejora

- Mensaje de borrado genérico ("revise que no tenga nada atado") → **recuento exacto**: "3 alumnos inscritos, 1 entrenador, 47 asistencias".
- Sin validación de solapamiento → avisar cuando el mismo entrenador o el mismo espacio ya tiene algo a esa hora ese día.
- Sin unicidad → índice único y 409 con mensaje.
- El filtro por colegio se hacía comparando **nombres de colegio en texto** → por `col_id`.
- La elección de qué ve cada rol estaba escrita cinco veces en el mismo archivo con `return` tempranos → `alcanceDe()`.

#### API objetivo

**Actividades:** `GET /actividades` · `POST` · `PATCH /:id` · `GET /actividades/:id/impacto` · `DELETE /:id` · `GET /categorias`
**Disciplinas:** `GET /disciplinas` (por colegio, día, alcance) · `GET /disciplinas/calendario` · `POST /disciplinas/lote` · `PATCH /:id` · `GET /disciplinas/:id/impacto` · `DELETE /:id`

#### Pruebas

Crear 4 disciplinas de una vez (lote) · duplicar exacta → 409 · hora de fin anterior a la de inicio → 400 · editar la hora de una con asistencias → aviso · borrar una con alumnos → recuento y bloqueo · borrar una vacía → se va · entrar como entrenador: solo las suyas y sin botón de crear · **calendario en móvil**: hoy es una rejilla de 7 columnas que no cabe en 360 px → pasa a lista por día con selector de día.

---

#### Cerrada el 2026-10-02

Probada contra `dev`: 45 pruebas y 9 de repaso. Su documento se borró.

**Arreglos que salieron al preparar y hacer las pruebas:**

1. **Cambiar el colegio o la actividad de una disciplina con historia** reescribía toda su historia (las asistencias de Ajedrez en Quitumbe pasaban a ser de otra cosa). Ahora 409 y el formulario bloquea esos dos campos; día y hora se siguen pudiendo mover.
2. **Nombre de actividad repetido con tildes distintas** ("Futbol G1" / "Fútbol G1") entraba como dos. Ahora ignora tildes.
3. **Dar de baja a una persona no soltaba sus vínculos de asistente** (como titular ni como asistente), y quitar los roles tampoco. Ahora sí.
4. **El botón Asignar se ofrecía a entrenadores de baja** (el backend lo rechazaba). Ya no se ofrece. Y los 4 entrenadores que el sistema viejo dio de baja sin cerrar nada (10 disciplinas abiertas) se corrigieron en dev con `SQL/limpieza_dev_entrenadores_2026-10-02.sql`. Decisión del cliente: no se programa nada para casos que en la plataforma nueva no pueden ocurrir.

**Rediseño pedido por el cliente:** Actividades sin paginador y por categoría; Disciplinas por colegio con su semana de lunes a domingo; tarjetas compactas que despliegan el detalle al pasar el ratón y se fijan con un clic; borde ámbar fuerte en disciplinas sin entrenador, y asignarlo desde ahí; Entrenadores como lista paginada al estilo de Usuarios, con borde ámbar en los activos sin disciplinas; ficha y modal de asignar agrupados por colegio, con filtros de colegio, día y "sin entrenador".

**Confirmado al cliente:** al quitar o reemplazar un entrenador solo se cierra el vínculo persona–disciplina. La disciplina sigue con sus inscritos, asistencias y evaluaciones, y el nuevo entrenador ve toda la historia, porque el alcance es por disciplina, no por persona.

---

### Fase 9 — Entrenadores

**Para qué sirve:** decir quién da cada disciplina, y quién lo respalda cuando falta.

#### Cómo funciona hoy

Tabla de entrenadores con foto, nombre, cédula, colegios en los que trabaja y número de disciplinas. Filtros por colegio (con conteo) y "Sin asignar". Buscador por nombre o cédula.

| Botón | Qué hace |
|---|---|
| Ver | Ficha: datos, colegios, lista de disciplinas asignadas |
| **Atar entrenador** | Modal que lista las disciplinas disponibles y las ya asignadas. Añadir crea la asignación con fecha de inicio = hoy; quitar **no borra**: pone `entasig_fecha_fin = hoy` |
| **Agregar auxiliar** | Ata a un usuario con rol 6 (Asistente) o 7 (Respaldo) a este entrenador |
| Quitar auxiliar | Confirmación |

**Reglas de negocio:**

1. Un entrenador **es** un usuario con el rol 3 y ficha en `entrenador` (`ent_id = usu_id`).
2. Las asignaciones son **historia, no estado**: se cierran con fecha, no se borran. Los reportes de asistencia dependen de eso.
3. Una asignación activa es la que tiene `entasig_fecha_fin IS NULL` y `est_id = 1`.
4. El auxiliar **hereda el alcance de sus entrenadores** (puede tener varios, pedido del 2026-10-01), no tiene alcance propio.
5. El coordinador solo ve y ata entrenadores de sus colegios.
6. Un entrenador puede dar disciplinas en **varios colegios**.
7. Si un entrenador se va, **su historial se queda** (asignaciones cerradas, asistencias, evaluaciones) y quien lo reemplaza sigue sobre la misma disciplina sin perder nada en reportes.

#### Qué se mejora

- El filtro por colegio usaba un **hash del nombre del colegio** como identificador → `col_id`.
- Nada impide atar dos entrenadores activos a la misma disciplina, ni atar al mismo dos veces → unicidad parcial + 409.
- Añadir y quitar asignaciones eran escrituras sueltas → transacción con auditoría.
- No hay forma de ver **el historial** de asignaciones de un entrenador (quién dio qué y hasta cuándo), aunque el dato está → pestaña de historial en la ficha.
- 15 `console.log` en la pantalla, incluidos datos de personas.

#### API objetivo

`GET /entrenadores` (alcance, filtro por colegio y sin-asignar, busca) · `GET /entrenadores/:id` · `GET /entrenadores/:id/asignaciones?historial=1` · `POST /entrenadores/:id/asignaciones` · `DELETE /entrenadores/:id/asignaciones/:asigId` (cierra con fecha) · `GET /entrenadores/:id/auxiliares` · `POST` / `DELETE` de auxiliares

#### Pruebas

Atar 3 disciplinas de una vez · quitar una y comprobar que queda con `fecha_fin` y **no** desaparece del historial · atar la misma dos veces → 409 · atar a un usuario sin rol de entrenador → 400 · añadir auxiliar y entrar con él: ve exactamente lo de su entrenador · quitar auxiliar y comprobar que deja de verlo · coordinador: solo sus colegios · 360 px: la tabla pasa a tarjetas, los filtros de colegio a un desplegable.

---

### Fase 10 — Estudiantes

**Para qué sirve:** el registro de los 796 alumnos y de en qué disciplinas está cada uno. Es el módulo con más volumen de pantalla y el que más veces se usa.

#### Cómo funciona hoy

Arranca en **tarjetas de colegio** con el número de alumnos; al elegir uno se entra a la lista. Si el usuario tiene un solo colegio, se salta las tarjetas.

| Elemento | Comportamiento |
|---|---|
| Filtros de estado | Activos / Inactivos / Todos con conteo (ocultos para entrenadores y auxiliares) |
| Filtro por disciplina + "Sin asignar" | Dentro del colegio elegido |
| Buscador | Nombre o cédula |
| Tabla paginada | 7 por página |
| Nuevo alumno | Nombre, foto, edad, cédula, **toma transporte** (sí/no), información de salud, otra información, colegio y grado |
| Ver ficha | Datos + disciplinas en las que está inscrito |
| **Vincular disciplinas** | Modal con las disciplinas del colegio; marcar inscribe, desmarcar da de baja la inscripción |
| **Atar representante** | Vincula al alumno con un usuario con rol 4 |
| Dar de baja | `est_id = 2` **y** cierra sus inscripciones activas con fecha de baja |
| Reactivar | Vuelve a activo (las inscripciones no se reabren) |
| Eliminar permanentemente | Hoy: intenta borrar y confía en que Postgres falle — pero la cascada **sí borra**, en silencio |

**Reglas de negocio:**

1. Un alumno pertenece a **un colegio** y puede estar inscrito en **varias disciplinas** de ese colegio.
2. Solo puede haber **una inscripción activa** por (alumno, disciplina) — ya hay índice único parcial.
3. Al inscribirlo, el trigger crea sus `evaluacion_nino_pendiente` de las evaluaciones activas de esa disciplina.
4. Dar de baja al alumno da de baja sus inscripciones; son dos escrituras que **deben** ir juntas.
5. Un alumno puede tener varios representantes y un representante varios alumnos.
6. `nino_info_salud` es dato sensible de un menor: no viaja a ninguna pantalla que no lo muestre.

#### Qué se mejora

- La consulta traía los 796 alumnos **con padres, usuario del padre, colegio y grado anidados** —incluida la contraseña del padre— y contaba con `.filter()` en JavaScript → paginación, filtros y conteos en SQL, columnas justas.
- La regla "qué colegios ve este usuario" estaba reimplementada en 6 sitios, ya divergentes → una sola función.
- Si la lista de colegios permitidos salía vacía, **el filtro no se aplicaba y devolvía todo** → alcance en el servidor.
- Baja del alumno + baja de inscripciones sin transacción → transacción.
- El borrado permanente en silencio → recuento ("se eliminarán 47 asistencias, 3 inscripciones y 2 evaluaciones"), escribir el nombre, auditoría.
- `AbortController` que se creaba, se abortaba y nunca se pasaba a ninguna consulta → la cancelación de react-query.
- Los 11 tests de estudiantes en `describe.skip` se reescriben aquí, contra el API.

#### API objetivo

`GET /estudiantes` (colegio, disciplina, sin-asignar, estado, busca, página) · `GET /estudiantes/conteos` · `GET /estudiantes/:id` · `POST` · `PATCH /:id` · `POST /estudiantes/:id/baja` · `POST /estudiantes/:id/reactivar` · `GET /estudiantes/:id/impacto` · `DELETE /:id` · `GET` / `PUT /estudiantes/:id/disciplinas` · `GET` / `POST` / `DELETE /estudiantes/:id/representantes` · `GET /grados`

#### Pruebas

Crear alumno con foto y grado · inscribirlo en 2 disciplinas y **comprobar en la base que aparecieron sus evaluaciones pendientes** · inscribirlo dos veces en la misma → 409 · darlo de baja y verificar que las inscripciones quedan cerradas · reactivar · eliminar permanentemente uno nuevo (recuento + nombre + auditoría) · eliminar uno con historial y leer el recuento antes de confirmar · buscar "María" con 796 alumnos y medir que solo viaja una página · entrenador: solo sus alumnos · 360 px: tarjetas en vez de tabla, modal de disciplinas con scroll propio.

---

### Fase 11 — Asistencias

**Para qué sirve:** el registro diario. 13 202 filas de alumnos, 1 726 de entrenadores y 283 de auxiliares. Es lo que más se usa y lo que alimenta todos los reportes.

#### Asistencia de alumnos — cómo funciona hoy

Filtros en cascada: **colegio → día de la semana → disciplina → fecha**. La fecha se valida contra el día elegido (si eliges martes, solo deja martes). Debajo aparece la lista de alumnos inscritos en esa disciplina.

| Elemento | Comportamiento |
|---|---|
| Estado por alumno | Presente · Ausente · Tarde · Justificado |
| Campos condicionales | **Tarde** habilita hora de llegada; **Justificado** habilita el motivo; los demás estados los limpian |
| "Aplicar Presente a todos" | Marca a todos los que no tengan estado |
| Guardar por fila | Upsert por (alumno, disciplina, fecha); guarda quién registró y cuándo |

#### Asistencia de entrenadores — cómo funciona hoy

Filtros **colegio → día**; la fecha se propone sola (el próximo día de la semana elegido) y se puede cambiar a mano. Lista los entrenadores que dan clase ese día en ese colegio **y sus auxiliares**, con los mismos cuatro estados y los mismos campos condicionales. La asistencia del auxiliar va a su propia tabla.

**Reglas de negocio:**

1. La clave es (persona, disciplina o colegio, fecha): registrar dos veces el mismo día **actualiza**, no duplica.
2. La fecha tiene que caer en el día de la semana de la disciplina.
3. Solo se listan alumnos con inscripción activa y entrenadores con asignación activa **a esa fecha**.
4. Queda registrado quién marcó (`usu_registrador`) y cuándo.
5. Hora de llegada solo con estado Tarde; motivo solo con Justificado.

#### Qué se mejora

- La conversión de horas se hacía en el navegador, con utilidades de zona horaria propias → **la hora la fija el backend**, una sola vez, en la zona de Ecuador.
- Guardado fila a fila con una cola de peticiones inventada → **guardado por lote en una transacción**, con el botón "Guardar todo".
- Un `upsert` sin restricción única real detrás puede duplicar si dos personas marcan a la vez → unicidad en la base y upsert sobre ella.
- La pantalla de entrenadores son 743 líneas en un solo archivo con toda la lógica dentro → módulo con su servicio.
- No hay forma de ver la asistencia de una fecha pasada sin rehacer los cuatro filtros → vista de historial por disciplina y rango.
- Hoy el entrenador puede marcar asistencia de disciplinas que no son suyas si conoce el id → alcance en el servidor.

#### API objetivo

`GET /asistencias/alumnos?disciplina&fecha` · `PUT /asistencias/alumnos` (lote) · `GET /asistencias/entrenadores?colegio&fecha` · `PUT /asistencias/entrenadores` (lote, incluye auxiliares) · `GET /asistencias/historial?disciplina&desde&hasta`

#### Pruebas

Marcar 20 alumnos de una disciplina y guardar en bloque · volver a entrar y ver los estados · cambiar uno a Tarde y comprobar que exige hora · a Justificado y que exige motivo · volver a Presente y que ambos campos se limpian en la base · guardar dos veces la misma fecha → actualiza, no duplica (contar filas) · fecha que no cae en el día → rechazada · entrenador marcando una disciplina ajena → 403 · **360 px: el caso de uso real es el entrenador con el teléfono en la cancha** — una tarjeta por alumno, los cuatro estados como botones grandes, "Presente a todos" arriba y "Guardar" fijo abajo.

---

### Fase 12 — Evaluaciones

**Para qué sirve:** medir el progreso de cada alumno. Es la parte con más lógica de negocio del sistema.

#### Cómo funciona hoy

Dos pestañas: **Gestión de Evaluaciones** y **Evaluar Alumnos**.

**Gestión** — lista de evaluaciones con su puntaje total. Botón "Nueva Evaluación", en dos pasos:

1. **Detalles:** título, descripción, categoría.
2. **Parámetros:** cada parámetro tiene nombre, nota, número de intentos, puntaje y un **método**:

| Método | Cómo puntúa |
|---|---|
| Por tiempo | Se configuran dos umbrales con operador (`<`, `<=`, `>`, `>=`): uno da 0 puntos y otro da el puntaje completo. Entre ambos, **interpolación lineal** redondeada a 2 decimales |
| Por logro | Lo consigue o no (booleano) |
| Por escala | Valor entre un mínimo y un máximo configurables |
| Mobak 6 intentos | Puntuación 0–6 → 0-2 puntos: 0-2→0, 3-4→1, 5-6→2 |
| Mobak 2 intentos | Puntuación 0–2 → 0-2 puntos, uno a uno |

El puntaje total de la evaluación lo recalcula **un trigger** cada vez que cambia un parámetro.

Otros botones: vista previa de la evaluación · editar · **vincular a disciplinas** (`evaluacion_asignacion`) · eliminar (RPC dedicada).

**Evaluar Alumnos** — cascada colegio → disciplina → evaluación → lista de alumnos pendientes. Por alumno se abre el modal de evaluación: se registran los intentos de cada parámetro, se calcula el puntaje y al terminar el alumno pasa a Evaluado con fecha de finalización. Se puede modificar una evaluación ya hecha o borrarla.

**Reglas de negocio:**

1. Vincular una evaluación a una disciplina **crea las pendientes** de todos sus alumnos inscritos; inscribir a un alumno nuevo también.
2. Un alumno pendiente pasa a evaluado cuando se registran todos los intentos.
3. El puntaje de cada intento depende del método; el total del alumno es la suma.
4. Solo el entrenador de esa disciplina (o quien tenga alcance) puede evaluar.
5. Borrar una evaluación arrastra parámetros, asignaciones, pendientes e intentos.

#### Qué se mejora

- **El scoring vive en el navegador** (interpolación de tiempo, tablas Mobak): dos versiones distintas podrían dar dos notas distintas → **se calcula en el backend** y se guarda el puntaje ya calculado; el front solo lo muestra.
- El borrado va por una RPC `SECURITY DEFINER` que estuvo **abierta a la anon key** hasta `0005_grants.sql` → endpoint con permisos, la RPC deja de ser el camino.
- No se valida que los parámetros por tiempo tengan sus dos umbrales coherentes (se puede guardar "0 puntos si < 10s" y "todo el puntaje si < 5s" y quedar en un rango imposible) → validación en el servidor.
- Los 5 métodos estaban repartidos entre tres archivos de utilidades del front → un solo servicio de scoring con tests unitarios (es lo único del sistema donde un error silencioso cambia la nota de un niño).
- La lista de pendientes no dice **cuántos faltan** por disciplina → contador.

#### API objetivo

`GET /evaluaciones` · `GET /evaluaciones/:id` (con parámetros) · `POST` · `PATCH /:id` · `DELETE /:id` (con impacto) · `GET`/`PUT /evaluaciones/:id/disciplinas` · `GET /evaluaciones/pendientes?disciplina&evaluacion` · `GET /evaluaciones/pendientes/:id` · `PUT /evaluaciones/pendientes/:id/intentos` (calcula y guarda) · `DELETE /evaluaciones/pendientes/:id`

#### Pruebas

Crear una evaluación con un parámetro de cada método · comprobar que el puntaje total lo puso el trigger · vincularla a una disciplina y **verificar en la base que aparecieron las pendientes** de sus alumnos · inscribir un alumno nuevo en esa disciplina y ver que también le aparece · evaluar a un alumno por tiempo en un valor intermedio y comprobar la interpolación a mano · Mobak 6 con puntuación 4 → 1 punto · modificar una evaluación ya hecha · borrarla y ver que el alumno vuelve a pendiente · borrar la evaluación entera con el recuento delante · entrenador evaluando disciplina ajena → 403 · 360 px: el modal de evaluación es el que más campos tiene — un parámetro por pantalla con avance, no un formulario de 30 campos.

---

### Fase 13 — Tablero y Reportes

**Para qué sirve:** lo primero que ve cada persona al entrar, y la salida de datos para dirección.

#### Tablero — cómo funciona hoy

Hay **cuatro tableros distintos** y el sistema elige uno por el primer rol que encuentra:

| Rol | Qué muestra |
|---|---|
| Propietario / Admin Activa Reforce | Conteos de colegios, usuarios, actividades, disciplinas, alumnos, evaluaciones; porcentajes de asistencia de alumnos y entrenadores; encuestas publicadas |
| Coordinador | Lo mismo acotado a sus colegios, más listas de sus entrenadores y disciplinas |
| Entrenador / Asistente / Respaldo | Sus disciplinas, sus alumnos, sus evaluaciones asignadas, su asistencia y la de sus alumnos |
| Representante | Sus hijos, sus disciplinas, su asistencia y su rendimiento |

#### Reportes — cómo funciona hoy

Nueve reportes (Usuarios, Colegios, Actividades, Disciplinas, Entrenadores, Alumnos, Evaluaciones, Asistencias, Encuestas), cada uno con dos pestañas: **Análisis** (gráficas y tablas en pantalla) y **Reportes** (filtros + exportar a Excel). La pestaña de exportar exige permiso `reportes.crear`.

**Reglas de negocio:**

1. Cada reporte respeta el alcance de quien lo pide.
2. Los reportes de asistencia y evaluación necesitan rango de fechas.
3. El Excel debe llevar los mismos filtros que se ven en pantalla.

#### Qué se mejora

- **Quien tiene dos roles ve un solo tablero** (decisión D2 del cliente: eso está mal) → un tablero por rol accesible por **pestañas o selector**, y por defecto el de mayor alcance.
- Los porcentajes de asistencia se calculan **descargando todas las filas de asistencia** (13 202) y contando en el navegador → agregación en SQL con rango de fechas.
- Las cifras del tablero no dicen de qué periodo son → selector de periodo explícito.
- El Excel se arma en el navegador con toda la tabla descargada → generación en el backend, en streaming.
- Hay un tablero de reserva con **cifras inventadas escritas a mano** ("12 colegios", "328 usuarios") para roles sin tablero propio → fuera.

#### API objetivo

`GET /tablero?rol&desde&hasta` (una respuesta por tablero, todas las agregaciones en SQL) · `GET /reportes/<modulo>?filtros` (JSON para la pestaña de análisis) · `POST /reportes/<modulo>/export` (devuelve el xlsx)

#### Pruebas

Entrar con un usuario que tenga dos roles y comprobar que puede ver **los dos tableros** · cuadrar cada cifra del tablero contra una consulta SQL a mano · cambiar el periodo y ver que cambian · exportar cada uno de los 9 reportes y abrir el archivo · exportar como coordinador y comprobar que el archivo solo trae sus colegios · medir que el tablero no descarga más de unas decenas de KB · 360 px: las tarjetas de KPI se apilan, las gráficas se reducen o se sustituyen por la cifra.

---

### Fase 14 — Encuestas y Representantes

**Para qué sirve:** preguntar a los representantes. **Cero filas en producción**: el código existe, los datos no. Va al final por eso.

El cliente decidió (D1) que se mantiene: *"se tiene que poder hacer encuestas a los padres; puedes reconstruirlo para que funcione mejor si es necesario, pero mantente a la idea"*. Al no haber datos reales, **es el único módulo donde el esquema se puede corregir sin coste de migración**.

#### Cómo funciona hoy

Lista de encuestas paginada, con estado (Borrador / Finalizado / Publicado) y proporción de respuestas. Botón "Crear nueva encuesta" → constructor: título, descripción y preguntas de seis tipos (texto corto, texto largo, escala con mínimo y máximo, fecha, hora, sí/no), reordenables.

Acciones: vista previa · finalizar (bloquea la edición) · publicar (la hace visible a los representantes) · ver resultados con gráficas y exportar · eliminar.

Los representantes la reciben como **modal obligatorio** al entrar, hasta responderla.

**Reglas de negocio:**

1. Borrador se edita; Finalizado no; Publicado se responde.
2. Un representante responde una vez por encuesta.
3. Los resultados se ven agregados y por pregunta.

#### Qué se mejora

- El módulo obligatorio se monta **fuera de la ruta**, en `App.tsx`, y consulta Supabase en todas las pantallas del sistema, provocando errores de permiso en todas ellas → se monta solo donde toca (hoy está desmontado).
- No existe el módulo de **Representantes** como tal: se atan desde la ficha del alumno y no hay dónde verlos ni gestionarlos → pantalla propia, porque sin representantes cargados las encuestas no tienen a quién preguntar.
- 25 componentes y 6 hooks para un módulo de 4 tablas → reconstrucción sobre el mismo modelo de datos.
- ~~Publicar no avisa a nadie → definir con el cliente si debe mandar correo.~~ **Decidido el 2026-09-17: no se manda correo.** La encuesta le aparece al representante cuando entra a la plataforma, y ya está.

#### Pruebas

Crear encuesta con los 6 tipos de pregunta · finalizar y comprobar que no se edita · publicar · entrar como representante y verla obligatoria · responder y comprobar que no vuelve a aparecer · ver resultados y exportar · borrar · 360 px: una pregunta por pantalla.

**Confirmado el 2026-09-16, sobre los tres respaldos de producción** (2026-06-09, 2026-06-10 y 2026-07-27): `encuesta`, `encuesta_pregunta`, `encuesta_respondida`, `encuesta_respuesta`, `padre` y `nino_padre` tienen **0 filas en los tres**. No es que se borraran: nunca se usaron. La prod vieja por MCP no respondió (proyecto dormido), pero tres respaldos separados por siete semanas coinciden.

**Decisión que se sigue de eso:** no hay nada que cargar. **El módulo se estrena vacío** y con él el de Representantes. Si el cliente quiere empezar a usarlo, los representantes se dan de alta como usuarios con rol 4 desde Usuarios y se atan a sus hijos desde Estudiantes.

---

### Fase 14B — Inscripciones

**Pedido del cliente el 2026-10-01. Construida el 2026-10-02 y rehecha el 2026-10-05 con sus documentos.** Estado vigente en `docs/fase14b-contratos.md`; el flujo base (aprobar, rechazar, cuenta, precios) en `docs/fase14b-inscripciones.md`.

Resumen: el representante se inscribe solo desde `/inscripcion` (link de un correo masivo de Resend). Llena sus datos y los de cada hijo, elige colegio y disciplinas, ve el total mensual, acepta contrato, términos y privacidad con casillas (esa es la firma) y sube el comprobante. Se genera un contrato PDF por alumno. Queda **pendiente**; el Propietario la **aprueba** en `/inscripciones` (nacen la cuenta —contraseña = cédula—, los alumnos y sus altas, y sale un correo) o la **rechaza** (se borra). Precios mensuales por colegio con descuento por hermanos (lidera el que más disciplinas tiene). Migraciones `0014` (aplicada) y `0015` (sin correr).

**Rehecha el 2026-10-05:** seis documentos (4 generales + ficha y contrato con texto común y datos por colegio), aceptar es firmar (sin firma dibujada; "Aprobado por" al aprobar), constancia por documento con sha256 en `inscripcion_aceptacion`, un PDF por alumno con membrete editable, IVA fijo 15 %, abrir/cerrar general y por colegio, cuenta bancaria en el paso Pago. Migraciones `0016`–`0019`. La `0017` borró los campos viejos que ya no pide nadie.

---

## 8. Fase 15 — Endurecimiento y QA

En marcha desde el 2026-09-17. Lo que se puede comprobar sin la aplicación en marcha ya está hecho; lo que necesita un navegador o un token por rol espera a la ronda de pruebas.

**Hecho:**

- [x] **`zod` y rate limit en el 100% de los endpoints.** Inventariados los **119**: los 14 routers de negocio aplican `requireAuth` a nivel de router, y las 19 rutas sin `zod` son las que no reciben nada (catálogos como `/dias`, `/tipos`, `/metodos`, `/roles`, más `/health` y `/logout`). El rate limit general (120/min en producción) va montado sobre `/api/v1` **después** de `/health`, para no gastar cupo en los chequeos de Railway; login, forgot-password y change-password llevan uno propio de 10 cada 15 min con clave IP+correo.
- [x] **CORS restringido y guardia de arranque.** `FRONTEND_ORIGIN` la escribe una persona en el dashboard de Railway, así que ahora se valida al arrancar en producción: nada de `*`, nada de `http://`, nada de `localhost`, nada de barra o ruta al final (con barra, el `includes()` del CORS no casa y **todo** el frontend daría 403), y los tres secretos —`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `DATABASE_URL`— pasan de fallar en la primera petición que los necesite a impedir el arranque. 10 pruebas en `config/env.test.ts`.
- [x] **Las tres capas de Supabase, revisadas en dev y prod.** Idénticas en las dos: RLS `ENABLE`+`FORCE` en las 36 tablas con **0 políticas**; **0** privilegios de tabla para `anon`/`authenticated`/`PUBLIC`; las **6 funciones** con ACL explícita (solo `postgres` y `service_role`) y `search_path=public` fijo — incluidas las dos `SECURITY DEFINER`, que fueron el agujero real. Bucket `usufoto` privado, 0 políticas en `storage.objects`. El *advisor* de seguridad solo devuelve los 36 `rls_enabled_no_policy` de nivel INFO, que son el diseño buscado.
- [x] **Cero secretos en el bundle.** Solo tres `VITE_*` (`VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), las tres públicas por diseño. El JWT horneado en el bundle desplegado de `pvcar.vercel.app` se decodificó: `role: "anon"`, `ref: dahsgmpubbofrefvseir` — que de paso confirma que **Vercel Production apunta a `PVCAR`**, algo que hasta ahora solo se había mirado a ojo en el dashboard.
- [x] **Code-splitting.** Cada pantalla es su propio trozo (`React.lazy`) y las librerías van aparte (`react`, `datos`, `graficas`, `supabase`). La primera carga baja de **1 428 kB a 627 kB** (398 → **187 kB** gzip, **53 % menos**): quien abre el login ya no se descarga Recharts, las 9 definiciones de reporte y el constructor de encuestas antes de poder escribir su contraseña.
- [x] **`no-explicit-any` en `error`.** Llegó a 0. De paso salieron **cuatro archivos que no usaba nadie** (`SharedDataContext`, `useSorting`, `useDebounce`, `sortable-table-header`) y cinco declaraciones muertas: estaban escondidos porque `no-unused-vars` seguía en `off` desde el andamiaje original. Las dos reglas están ahora en `error`; quedan 9 avisos, todos de `react-refresh` en ficheros de shadcn.
- [x] **Rendimiento: una cascada encontrada y cortada.** Entrar en frío a `/reportes/:modulo` costaba **tres viajes en serie** (`/me` → catálogo → datos), porque para saber si el reporte exige rango de fechas hacía falta su definición. El catálogo son 9 definiciones que el backend arma en memoria sin tocar la base: ahora se precarga desde el layout y no caduca en toda la sesión. El resto de pantallas ya estaban bien — ningún `enabled` depende de la respuesta de otra consulta, solo de lo que elige el usuario.
- [x] **Plantillas de correo en español**, en `PVCAR/docs/correos/`, con su `LEEME.md`. **Falta que el cliente las pegue** en los dos proyectos.

**Pendiente, y por qué:**

- [ ] **SMTP con Resend en `PVCAR` (producción).** El cliente lo decidió el 2026-09-17: configura Resend y lo conecta al SMTP de Supabase. Hace falta porque el servidor de correo que trae Supabase de serie está limitado a unos pocos envíos por hora y no es para producción: con 70 usuarios, un día con varias recuperaciones de contraseña se queda corto y los correos no salen. **Dashboard del cliente. La Fase 15 no cierra sin esto.**
- [ ] **Pegar solo `recuperar-contrasena.html`** y añadir `https://pvcar.vercel.app/reset-password` a *Redirect URLs*. Las otras dos plantillas **no se pegan**: ver abajo por qué.

**Por qué solo hace falta una plantilla.** Verificado en `usuarios.service.ts` el 2026-09-17: crear un usuario llama a `admin.auth.admin.createUser` con la contraseña que **escribe el admin** y `email_confirm: true`, así que Supabase no manda nada — exactamente como el sistema viejo. Reactivar a un inactivo hace lo mismo. Ni *Confirm signup* ni *Invite user* se disparan nunca: la primera necesitaría registro público, que no existe, y la segunda necesitaría que el código llamara a `inviteUserByEmail()`, que no lo hace. Las dos plantillas quedan escritas en `docs/correos/` por si el flujo cambia, pero **no van al dashboard**.

- [ ] **Preguntarle a Activa Reforce si quieren cambiar el flujo de alta.** Hoy el admin crea al usuario **escribiendo él la contraseña**, así que **conoce la contraseña de todas las personas del sistema**. La alternativa es el flujo de invitación: el admin crea la cuenta sin contraseña, a la persona le llega un correo y la elige ella, sin que nadie más la sepa nunca. A favor: es mejor práctica y quita al admin de en medio. En contra: ata el alta al correo — si el SMTP falla o la dirección está mal, esa persona no puede entrar, mientras que hoy el admin le dice la contraseña y ya. **Es pregunta para ellos, no decisión técnica.** Va después de que Resend esté funcionando, porque sin correo fiable la respuesta es que no. Si dicen que sí, las plantillas `invitacion.html` y `confirmar-correo.html` ya están escritas.
- [x] **Revisión de alcance rol por rol (2026-10-05, estática, con los datos reales del esquema `archivo` para medir).** Tres fugas del mismo tipo, cerradas en `dev` (`448baa9`, `0b0853d`):
  1. **Entrenador y auxiliares veían el colegio entero.** `alcanceDe` les sumaba los colegios de sus disciplinas, y Estudiantes, los reportes y la tendencia del tablero filtran "colegio O disciplina". Un entrenador con 4 disciplinas veía 176 alumnos (con su salud) en vez de sus 37. Ahora `colegios` = solo `colegio_coordinador`.
  2. **Representante.** Su camino aportaba colegios y disciplinas de sus hijos al alcance del personal: con "ver" en Estudiantes o Asistencias habría visto el colegio y la clase entera. Ahora trae solo `ninos` y `disciplinasDeHijos`.
  3. **Encuestas (gestión) e Inscripciones.** No filtran por alcance y solo pedían "ver": `requirePersonal` deja fuera a quien solo es representante; en Inscripciones un no-Propietario/Admin solo ve las suyas.
  De paso: el pase de lista sacaba los colegios de `/colegios` (403 para el entrenador) y no se podía usar; `useColegiosVisibles()` los deduce de sus disciplinas.
  **Regla para lo que venga:** a un representante, `alcance.ninos`; a un entrenador, `alcance.disciplinas`; `colegios` solo a quien coordina; módulo sin filtro de alcance → `requirePersonal` o guarda global.
- [ ] **Auditoría de fugas con un token de cada rol.** El repaso estático dice que el alcance se aplica en el **servicio**, no en el SQL del repositorio: cada módulo que toca datos de menores tiene su guarda (`exigirVisible`, `exigirPendienteVisible`, `exigirSesion`, `exigirAlcance`…) que resuelve el alcance y devuelve 403. Es el diseño correcto, pero eso no se da por bueno leyendo código: se prueba con un token por rol contra todos los endpoints, y eso necesita el API en marcha.
- [ ] Tests e2e por módulo + prueba de carga en dev con el volumen real.
- [ ] Repaso de accesibilidad y responsive de las 14 pantallas, en los dos temas, en los tres anchos.

---

## 9. Fase 16 — Cutover

> ⚠️ **Superada el 2026-10-01** por el arranque de cero (ver §1). La lista de abajo era para migrar los datos y queda **solo como referencia**. El lanzamiento nuevo se reduce a: sembrar catálogos + un Propietario en `PVCAR`, deploy de `main`, dominio, smoke tests. Se reescribe cuando se llegue.

Ventana única, en horario de bajo uso, con el runbook **ensayado entero en dev**. Vive en `PVCAR/docs/RUNBOOK-cutover.md`.

1. [ ] Aviso a usuarios + ventana de mantenimiento. TTL del DNS bajado 24 h antes.
2. [ ] **Campaña previa:** las 7 personas con contraseña de menos de 6 caracteres ya la cambiaron en el sistema viejo (Anexo A.4), y el correo con formato inválido está corregido.
3. [ ] **Congelar escrituras** en el sistema viejo (página de mantenimiento en el Vercel viejo).
4. [ ] Volver a correr los **19 chequeos de compatibilidad** contra la prod vieja (están en `SQL/ORDEN.md`): cubren el baseline y las migraciones `0007`–`0011`. Pasaron el 2026-09-17 con 0 desviaciones, pero la prod vieja sigue recibiendo datos.
5. [ ] **`pg_dump` final, data-only, sacado esa misma noche.** ⚠️ **El respaldo de `Backup_bd/` (2026-07-27) NO sirve: está obsoleto.** Medido el 2026-09-17, producción ya tiene +878 asistencias de alumnos, +12 niños, +57 inscripciones y +2 usuarios respecto a él. Verificar conteos por tabla contra un manifiesto **nuevo**, no contra `conteos_prod_2026-07-27.txt`.
6. [ ] **`backfill-auth.ts` ANTES de cargar los datos.** El `CHECK (est_id <> 1 OR auth_user_id IS NOT NULL)` impide insertar usuarios activos sin cuenta de Auth. El reporte debe cerrar en 50/50 antes de seguir.
7. [ ] Cargar los datos en `PVCAR` en orden de dependencias, con `auth_user_id` ya poblado desde el mapeo y sin la columna de contraseña. **Desactivar los dos triggers durante la carga** (`trigger_nino_asignacion_evaluation` y `trigger_update_evaluacion_puntaje_total`) y volver a activarlos. `setval` de todas las secuencias. `VACUUM ANALYZE`.
8. [ ] **Volver a bajar** el bucket `usufoto` de la prod vieja y copiarlo al proyecto nuevo (que es privado). Hay una copia verificada del 2026-09-17 en `Backup_bd/usufoto_2026-09-17/` (60 objetos + sha256), pero entre esa fecha y el corte pueden subirse fotos nuevas: **la copia sirve de red, no de fuente**. Además, las rutas guardadas como URL absoluta del proyecto viejo hay que reescribirlas.
9. [ ] **Verificación:** conteo por tabla viejo vs nuevo + muestreo de evaluaciones y asistencias del último mes.
10. [ ] Deploy final: Railway `production` + Vercel Production desde `main`.
11. [ ] **Dominio:** quitarlo del Vercel viejo → añadirlo al nuevo → actualizar Cloudflare → esperar propagación → verificar HTTPS.
12. [ ] Smoke tests con un usuario real de cada rol; monitoreo intensivo 48 h.
13. [ ] **Rollback:** re-apuntar el dominio al proyecto viejo, que sigue intacto. Válido **mientras no haya escrituras nuevas** en la base nueva. Ese es el punto de no retorno y hay que comunicarlo.

---

## 10. Fase 17 — Desmantelar Flowward

Solo tras N días estables y con los dumps archivados en frío.

- [ ] Archivar copia final de la DB vieja y del bucket (externo, cifrado).
- [ ] Borrar los repos de Flowward y el proyecto Vercel viejo.
- [ ] Pausar y luego borrar los proyectos Supabase viejos.
- [ ] **Rotar los dos PAT de Supabase** que hoy están en texto plano en `.mcp.json` (riesgo asumido por el cliente, con fecha de caducidad puesta aquí).
- [ ] Pasar el repo `PVCAR` a **privado**.
- [ ] Limpiar el disco local; el workspace sale de la carpeta `Flowward`.

---

## Anexo A — Migración de autenticación

**El problema:** hoy el login compara `usu_contrasena` **en texto plano** y `auth.users` está vacío. Cualquiera con la anon key —que va embebida en el bundle— puede leer las 68 contraseñas.

**Objetivo:** que el día del cutover cada persona entre con **el mismo correo y la misma contraseña de siempre**, sin correo de verificación, sin reset, sin aviso.

**Por qué se puede:** precisamente porque están en texto plano se pueden sembrar en Supabase Auth, que las hashea con bcrypt al recibirlas. La clave está en `email_confirm: true`: la cuenta nace confirmada y nadie recibe nada en su bandeja. El texto plano muere ahí — la columna no existe en el schema nuevo.

**Casos borde medidos en prod (no supuestos):**

| Hallazgo | Cantidad | Qué se hace |
|---|---|---|
| Correos duplicados | 0 | nada |
| Contraseñas ya hasheadas | 0 | todas se pueden sembrar |
| **Contraseñas de menos de 6 caracteres** | **7** | Supabase las rechaza → campaña previa para que las cambien en el sistema viejo |
| Correo con formato inválido | 1 | corregirlo antes del cutover, o esa persona no entra |
| Contraseñas con tildes/ñ | 2 | funcionan; se prueban explícitamente |
| Usuarios inactivos | 18 | **no** se crean en Auth hasta que se reactiven |

**El script `backfill-auth.ts`** es idempotente, transaccional por usuario y con reporte: lee los activos sin `auth_user_id`, valida correo y longitud, crea la cuenta, escribe el `auth_user_id` y **borra la cuenta recién creada si esa escritura falla** (sin huérfanos). Al terminar imprime creados / reusados / omitidos con motivo.

> En dev cierra con **exit 1** y "El reporte NO cierra limpio" por los 5 omitidos: es la guardia pensada para el cutover, no un fallo.

**Verificación antes de mover el dominio:** `auth.users` = usuarios activos · `usuario where est_id=1 and auth_user_id is null` = 0 · login real con una cuenta de cada rol usando su contraseña de siempre · login con una contraseña con tildes · reset por correo funcionando con la plantilla en español · la columna `usu_contrasena` no existe.

---

## Anexo B — RLS desde el día 1

**Situación del sistema viejo:** de 35 tablas, 34 sin RLS. Con la anon key —pública por diseño, embebida en el JavaScript— se pueden leer y escribir los datos de 796 menores. El bucket `usufoto` es público con 61 fotos. **No se puede arreglar ahí**: la SPA depende de esa key sin restricciones.

**En PVCAR sí, desde el primer día,** porque `service_role` tiene `BYPASSRLS = true` y el backend se conecta con ella, mientras el front usa la anon key solo para la sesión:

- `0002_rls.sql`: `ENABLE` + `FORCE` en las 35 tablas y **cero políticas**. Deny-by-default.
- `0003_storage.sql`: bucket privado, acceso por URL firmada de corta vida.
- `0005_grants.sql`: `anon` y `authenticated` sin nada sobre tablas, secuencias **ni funciones**.

**Verificado en dev y prod el 2026-07-30:** 35/35 con RLS y FORCE, 0 políticas; con la anon key todo devuelve 401; `service_role` ve los datos; la URL pública del bucket no sirve el objeto.

> **El hallazgo que no hay que olvidar: RLS no protege funciones.** Con la anon key, `rpc/delete_student_evaluation` (SECURITY DEFINER) devolvía HTTP 204 —entraba— hasta `0005_grants.sql`. Al revisar seguridad en Supabase hay que mirar **tres capas**: RLS, privilegios de tabla y ACL de funciones.

**Regla permanente:** toda tabla nueva nace sin RLS; la migración que la cree debe traer su propio `ENABLE` + `FORCE`.

---

## Anexo C — Trampas de infraestructura ya pagadas

| Trampa | Realidad |
|---|---|
| Root dir | **Railway = raíz del repo** (el `package-lock.json` vive ahí por workspaces). **Vercel = `frontend`.** Al revés uno del otro. |
| Vercel "Canceled" sin logs | Salta el build si el commit no toca `frontend/**`. No es un fallo. |
| Railway no despliega | Solo despliega si el commit toca sus rutas vigiladas (`backend/**` + manifiestos). |
| `VITE_*` | Se hornean en tiempo de build. Cambiarlas en el dashboard no hace nada hasta el build siguiente. |
| Región de Railway | Se guarda pero **no se mueve hasta un Redeploy a mano**. Se comprueba porque el `uptime` de `/health` vuelve a cero. |
| `/health` | Es `/api/v1/health`. Un curl a `/health` pelado da 404 y parece caída falsa. |
| Rutas del cliente | Sin `/api/v1`: `VITE_API_URL` ya lo trae. Duplicarlo da 404 y parece endpoint inexistente. |
| Preview de Vercel | Detrás de Vercel Authentication (302 a `vercel.com/sso-api`): los enlaces de correo hay que abrirlos con sesión de Vercel; desde el móvil rebotan. |
| `FRONTEND_ORIGIN` | No incluye `localhost` por decisión del cliente: se prueba por push a `dev`. |
| Editor SQL de Supabase | Cuando pregunta "Run without RLS" / "Run and enable RLS" → **siempre Run without RLS**. |
| Pantallas vacías | Si una pantalla vieja sale vacía es porque sigue yendo directo a Supabase y RLS la corta. No es un fallo nuevo. |

---

## Seguimiento

- [x] Fase 0 — Cuentas, herramientas y respaldo
- [x] Fase 1 — Monorepo PVCAR
- [x] Fase 2 — Base de datos nueva — 2026-07-30
- [x] Fase 3 — Backend base + Railway — 2026-08-04
- [x] Fase 4 — Frontend base + Vercel — 2026-08-05
- [x] Fase 5 — Autenticación — 2026-08-06, en `main` el 2026-08-07
- [x] Fase 6 — Usuarios, Roles, Permisos, Perfil — cerrada 2026-09-17, 17/17 pruebas contra dev
- [x] Fase 7 — Colegios — cerrada 2026-09-18, 13/13 pruebas contra dev
- [ ] Fase 8 — Actividades y Disciplinas — construida el 2026-09-16; **solo faltan las pruebas**
- [ ] Fase 9 — Entrenadores — construida el 2026-09-16; **solo faltan las pruebas**
- [ ] Fase 10 — Estudiantes — construida el 2026-09-17; **solo faltan las pruebas**
- [ ] Fase 11 — Asistencias — construida el 2026-09-17; **solo faltan las pruebas**
- [ ] Fase 12 — Evaluaciones — construida el 2026-09-17; **solo faltan las pruebas**
- [ ] Fase 13 — Tablero y Reportes — construida el 2026-09-17; **solo faltan las pruebas**
- [ ] Fase 14 — Encuestas y Representantes — construida el 2026-09-17; **solo faltan las pruebas**
- [ ] Fase 15 — Endurecimiento y QA — en marcha desde 2026-09-17; falta el SMTP y lo que necesita la app en marcha
- [ ] Fase 16 — Cutover
- [ ] Fase 17 — Desmantelar Flowward

**🔴 PENDIENTE URGENTE, ANOTADO EL 2026-09-18 — varios módulos dan 500.** El cliente lo vio en pantalla: **Disciplinas y Entrenadores devuelven "Error interno del servidor", y dice que hay más**. Ejemplo exacto de la consola:

```
GET /api/v1/disciplinas?limit=200&estado=1&orden=horario  ->  500
```

**Bloquea la Fase 8**, que es la siguiente de la cola de pruebas. Hay que resolverlo antes de abrirla.

Lo único comprobado hasta ahora, antes de que el cliente pidiera dejarlo: **la consulta SQL de esa ruta, ejecutada tal cual contra `PVCAR_Dev` por MCP con esos mismos parámetros, devuelve las 94 filas sin error.** Así que el fallo **no está en el SQL** — hay que mirar la capa de encima (zod, `alcanceDe`, serialización de la respuesta) o el propio despliegue de Railway. Primer paso al retomar: los logs de `development` en Railway, que dan el stack real.

**Riesgos vivos:**

| Riesgo | Mitigación |
|---|---|
| Divergencia funcional viejo vs nuevo | La sección de cada módulo es el checklist de paridad; obligatorio para cerrar la fase |
| Dar un módulo por listo sin probarlo | La sección 3.5. Ya costó trece arreglos en la Fase 6 |
| Pérdida de datos en el cutover | Dump verificado antes; el sistema viejo y su base quedan intactos; conteos antes de mover el dominio |
| Free tier de Supabase sin backups automáticos | `pg_dump` programado + evaluar Pro **antes** de que la base nueva tenga datos reales |
| PAT en texto plano en `.mcp.json` | Decisión cerrada del cliente; se rotan en la Fase 17 |
| Repo público | Decisión cerrada; pasa a privado al final. Este documento y `Bitacora.md` **no** viven en el repo |
