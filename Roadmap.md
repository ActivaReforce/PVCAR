# PVCAR — Roadmap a producción

> **Producto:** plataforma de gestión deportiva escolar de **Activa Reforce**. 14 módulos. **En producción en `activareforce.com` desde el 2026-10-12.** Arrancó vacía (decisión del 2026-10-01) y el admin la está cargando con datos reales.
>
> **Objetivo:** el producto entero corriendo en la infraestructura de Activa Reforce (monorepo `PVCAR`, backend real, autenticación segura, RLS).
>
> **La plataforma anterior se dio de baja el 2026-10-12:** su base, su hosting, su repo y su respaldo local están borrados. De ella solo quedan los datos del esquema `archivo`, en solo lectura, en Reportes → Data anterior.

> **Vive en el repo desde el 2026-10-07** (raíz de `ActivaReforce/PVCAR`) para poder seguir desde otro equipo con un `git pull`. Las rutas `PVCAR/...` son la raíz de este repo. `SQL/` y `.mcp.json` viven en la carpeta de trabajo, fuera del repo, y no se suben.

**Corte de este documento: 2026-10-16 (Fase 12 cerrada y aprobada por el cliente; vista previa de evaluaciones igual que evaluar. Antes: Evaluaciones con Visualizar, agrupar por colegios, bloqueo con notas, puntaje en vivo, umbrales con palabras, permisos; listas apiladas hasta 1024 px; aviso al dar de alta un alumno manual; "sin disciplinas" cuenta solo activos).**

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
9. [Fase 16 — lanzamiento](#9-fase-16--lanzamiento)
10. [Fase 17 — cierre del proyecto](#10-fase-17--cierre-del-proyecto)
11. [Anexo A — RLS desde el día 1](#anexo-a--rls-desde-el-día-1)
12. [Anexo B — trampas de infraestructura ya pagadas](#anexo-b--trampas-de-infraestructura-ya-pagadas)
13. [Seguimiento](#seguimiento)

---

## 1. Dónde estamos hoy

| Fase | Estado |
|---|---|
| 0 — Cuentas y herramientas | ✅ cerrada |
| 1 — Monorepo PVCAR | ✅ cerrada |
| 2 — Base de datos nueva (schema, sin datos) | ✅ cerrada, dev y prod verificadas |
| 3 — Backend base + Railway 2 ambientes | ✅ cerrada |
| 4 — Frontend base + Vercel | ✅ cerrada |
| 5 — Autenticación con Supabase Auth | ✅ cerrada, en `main` |
| **6 — Usuarios, Roles, Permisos, Perfil** | ✅ **cerrada el 2026-09-17**: 17 pruebas contra `dev`, todas pasadas, más dos arreglos de móvil. Las dos que faltaban se mudaron a las Fases 7 y 9 |
| **7 — Colegios** | ✅ **cerrada el 2026-09-18**: 13/13 pruebas contra `dev`, más dos arreglos |
| **8 — Actividades y Disciplinas** | ✅ **cerrada el 2026-10-02**: 45 pruebas + 9 de repaso contra `dev`. Salieron 4 arreglos y un rediseño de tres pantallas pedido por el cliente (ver Fase 8 abajo). **Reabierta y cerrada otra vez el 2026-10-06: Disciplinas v2** (una disciplina con varios días, cada uno con su hora; `0021`) y **color por actividad** (`0022`/`0023`), probadas en pantalla por el cliente. Detalle en `docs/disciplinas-v2.md` |
| **9 — Entrenadores** | 🟡 construida el 2026-09-16, en `dev`. **Los dos prerrequisitos, hechos el 2026-10-06:** auxiliar con varios titulares (selector "de quién ver" + "Todos") y bloqueo de choque de horario del entrenador. Solo falta probarla |
| **10 — Alumnos** | ✅ **cerrada el 2026-10-16**: probada en pantalla y aprobada por el cliente |
| **11 — Asistencias** | ✅ **cerrada el 2026-10-16**: probada en pantalla y aprobada por el cliente |
| **12 — Evaluaciones** | ✅ **cerrada el 2026-10-16**: probada en pantalla y aprobada por el cliente. En `main` desde el PR #21; la vista previa igual que evaluar, en `dev` |
| **13 — Tablero y Reportes** | 🟡 construida el 2026-09-17, en `dev`. 4 tableros, 9 reportes y 14 gráficas. **+ Data anterior** (2026-10-02): 15 conjuntos, 8 gráficas y Excel de todo; pruebas en `docs/data-anterior.md`. **La exportación a Excel de Reportes fallaba siempre** — arreglada el 2026-10-02. Solo falta probarla |
| **14 — Encuestas y Representantes** | 🟡 construida el 2026-09-17, en `dev`. Solo falta probarla |
| **14B — Inscripciones** (nuevo, 2026-10-01) | ✅ **cerrada el 2026-10-16**: probada de punta a punta y aprobada por el cliente; en producción y abierta al público desde el 2026-10-14. Historia: **rehecha el 2026-10-05 y en `dev`** con los seis documentos del cliente (4 generales + ficha y contrato por colegio), constancia por documento, PDF por alumno con membrete, IVA fijo 15 %, apertura general y por colegio, cuenta bancaria. `0014`–`0019` aplicadas en dev y prod. **El cobro por disciplina quedó resuelto el 2026-10-06** con Disciplinas v2 (una disciplina = una tarifa, máximo configurable por alumno, sin cruces). **Representante con cuenta previa hecho y probado el 2026-10-07**, en `main` desde el PR #11. Estado vigente en `docs/fase14b-contratos.md`. Solo Propietario |
| **Novedades** (puntos 8 y 9, fuera de fase) | ✅ **cerrado el 2026-10-12**: probado y aprobado por el cliente en `dev`. Novedades a mano (general, personal, representantes, alumnos), ausencias y correcciones automáticas al pasar lista, correos configurables, número en el menú, baja lógica y reporte con hoja Ausencias. En producción desde el PR #16 (2026-10-13) |
| **15 — Endurecimiento y QA** | 🟡 en marcha desde el 2026-09-17. Hecho todo lo que no necesita la aplicación en marcha. SMTP de Resend puesto en prod y dev (2026-10-07). Falta la auditoría de fugas con token por rol, los e2e y el repaso de accesibilidad (el respaldo de prod se hace a mano cuando lo pida; el alta de usuarios se queda con contraseña del admin) |
| **16 — Lanzamiento** | ✅ **2026-10-12**: `activareforce.com` en producción. Prod limpia de lo de prueba y con datos reales cargados por el cliente |
| **17 — Cierre del proyecto** | 🟡 plataforma anterior borrada el 2026-10-12; faltan los PAT, el repo privado y la limpieza final |

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

1. **Los datos anteriores no se migran a `public`.** Producción arrancó con los catálogos y un Propietario, y el admin crea todo. El 2026-10-12 el cliente creó el primer colegio real y sus actividades.
2. **Lo anterior está en el esquema `archivo`** de la misma base, solo lectura, para consultarlo en **Reportes → "Data anterior"**. Migración `0013_archivo.sql`, verificada en dev y prod el 2026-10-02: 35 tablas, 20 620 filas, **sin** contraseñas, información de salud, cédula de alumnos ni fotos. Las cédulas, teléfonos, correos y direcciones de los usuarios **sí** se quedan, a petición del cliente.
3. **No hay respaldo fuera de la base.** El 2026-10-12, al dar de baja la plataforma anterior, el cliente decidió borrar también el respaldo local. Lo que no está en `archivo` (contraseñas, salud, fotos) ya no existe.
4. **Libertad para cambiar el modelo:** sin datos anteriores en `public`, ningún cambio de schema tiene que respetarlos.

### Corte de sesión — 2026-10-16

**Hecho hoy (en `main` desde el PR #21, salvo la vista previa del final, que está en `dev`):**

- **Fase 12 cerrada en código** tras las pruebas en pantalla del cliente, tres bloques:
  - **Form de evaluación** reescrito: umbrales de Por tiempo con palabras ("menor que", "menor o igual que"...), sufijo "s", inputs numéricos que ya dejan borrar completo (se normalizan al perder foco), validación inline + toast al guardar si los umbrales van en el mismo sentido o la escala tiene máximo ≤ mínimo, y botón "Añadir parámetro" al final de la lista.
  - **Vista previa readonly** (nuevo `EvaluacionPreview` + `PrevisualizarEvaluacionDialog`): botón "Visualizar" en el formulario (borrador en memoria) y botón ojo en la card de la lista (ficha + sección de disciplinas vinculadas con horario y conteos). El menú de la fila queda solo con Editar, Reactivar, Baja y Eliminar.
  - **Vincular disciplinas** agrupado por colegio con cabecera cuando hay varios en el alcance.
  - **Permisos del listado**: quien tiene `evaluaciones:crear` ve todas; el resto solo las que creó él mismo o las vinculadas a disciplinas de su alcance.
  - **Bloqueo al editar con alumnos evaluados**: AlertDialog explica + opción "Borrar notas y editar" con segunda confirmación → `POST /evaluaciones/:id/resetear-evaluados` (endpoint nuevo, sin SQL: borra intentos y marca a los evaluados como pendientes en una transacción, auditado) y abre el editor.
  - **Pantalla de evaluar al alumno**: la barra avanza por parámetros completos (no por intentos), con **puntaje en vivo** por parámetro y acumulado / total posible arriba. El cálculo replica el `scoring.ts` del backend; al guardar manda el servidor.
- **Resumen de asistencias en móvil**: ocultas las cinco tarjetas de Presentes/Ausentes/Tarde/Justificado/Sin marcar en pantallas pequeñas (ocupaban demasiado); desde `sm` vuelven. "Sin marcar" sigue en la barra de guardado.
- **Alta manual de alumno**: antes de abrir el formulario sale un AlertDialog recordando que **no se guarda contrato, aceptación de política de datos ni pago** (eso solo se registra con el formulario público).
- **Conteo "sin disciplinas"** del encabezado de Alumnos: cuenta solo los **activos**. Un inactivo no está pidiendo asignación.
- **Listas** de Alumnos, Entrenadores y Usuarios: hasta 1024 px tarjeta apilada; desde 1024 px columnas completas. Se quitó el escalón intermedio md que seguía amontonando columnas con nombres largos.
- 638/638 tests de backend, 7/7 de frontend; typecheck, lint y build limpios. **Sin SQL en toda la Fase 12.**
- **Vista previa igual que evaluar** (en `dev`, `eb0c41b` + `bde8b86`): arriba, las disciplinas vinculadas; luego el separador **"Así se ve al evaluar:"** y la pantalla de evaluar tal cual (un parámetro por pantalla, todos sus intentos con los controles de su método, avance y puntaje en vivo). Se puede marcar para probar; solo Limpiar y Cerrar, nada se guarda. Los controles de un intento viven en `CamposIntento`, compartido con la pantalla de evaluar; los umbrales de tiempo se leen con palabras en las dos.
- **Fase 12 aprobada por el cliente** el 2026-10-16: ✅ cerrada.

**Al retomar — lista de trabajo, uno por uno:**

0. **Pasar a `main`** la vista previa de evaluaciones (sin SQL) cuando el cliente lo pida.
1. **Pruebas en pantalla** de las Fases 9, 13 y 14 (10, 11, 12 y 14B cerradas y aprobadas el 2026-10-16) (Reportes y Encuestas/Representantes) y 14B (Inscripciones). `docs/checklist-modulos.md`.
2. **Pagos mensuales** — esperar a que el cliente lo cuente.
3. **Fase 15** (fugas con un token por rol, e2e, accesibilidad) y **Fase 17**.

### Corte de sesión — 2026-10-15

**Hecho hoy (todo en `dev`, sin SQL):**

- **Reportes reordenados** y tres **nuevos** (Representantes, Inscripciones, Encuestas). Orden: Usuarios · Colegios · Actividades · Disciplinas · Entrenadores · Alumnos · Evaluaciones · Asistencia de alumnos · Asistencia de entrenadores · Representantes · Inscripciones · Encuestas · Novedades. Data anterior sigue como la tarjeta final, sin tocar.
  - **Representantes** (`modulo: usuarios`): nombre, cédula, correo, teléfono, hijos activos, lista de hijos con grado, colegios y disciplinas de los hijos. Alcance: Propietario/Admin ven todos; coordinador, los representantes con al menos un hijo en sus colegios. Resumen con totales, por estado, por colegio y lista de representantes sin hijos activos.
  - **Inscripciones** (`modulo: inscripciones`, **solo Propietario**): envíos del formulario público (fecha, estado, representante con cédula/correo/teléfono, hijos, colegios, disciplinas, valor y aprobador). Filtros de fechas, estado (Pendiente / Aprobada) y texto. **Valor por fila (`$`)** y hoja Resumen con **Total recaudado** y **Recaudado por colegio**. Fuera el bloque "Por estado" del resumen.
  - **Encuestas** (`modulo: encuestas`): una fila por encuesta con estado, preguntas, respondidas y fecha de creación. Resumen por estado y lista de encuestas sin respuestas. Lo más limpio posible: preguntas y respuestas viven en la pantalla de la encuesta.
- **Totales en pantalla** (nueva prop opcional `Definicion.totales` con su propio SQL). Hoy solo Inscripciones: encima de la tabla, el **Total recaudado** sale en un card destacado (borde brand, texto grande) y los conteos de Inscripciones, Pendientes y Aprobadas en tres cards pequeños. Se calculan sobre **todas** las filas filtradas, no sobre la página. En el Excel sigue viviendo en la hoja Resumen.
- **soloRoles** en la Definicion: Inscripciones queda cerrado al Propietario aunque Admin herede `inscripciones:ver`. Chequeado en `puedeVer` y en `exigirDefinicion`.
- **Fix /reportes/representantes 500**: `padre_sector_residencia` ya no existe (la borró la `0017`); fuera del SELECT y de la lista de columnas.
- **Listas con rejilla densa** (/estudiantes, /usuarios, /entrenadores) con **dos escalones**:
  - móvil (<768 px): tarjeta apilada como antes;
  - md (768–1023 px): columnas identitarias + acciones (Estudiantes esconde Grado y Estado; Usuarios esconde Creado; Entrenadores esconde Cédula·teléfono y Estado);
  - lg (≥1024 px): todas las columnas como antes.
  Decidido con el cliente: ocultar lo secundario antes que amontonar.
- **Respaldo de prod** marcado como **no necesario como tarea** (decidido por el cliente): se hace a mano cuando lo pida.
- 638/638 tests de backend, 7/7 de frontend; lint y build limpios.

**Al retomar — lista de trabajo, uno por uno:**

1. **Mergear a `main` cuando el cliente pruebe** `/reportes/*` y las listas en una pantalla intermedia.
2. **Pruebas en pantalla** de las Fases 9–14 (`docs/checklist-modulos.md`).
3. **Pagos mensuales** — esperar a que el cliente lo cuente.
4. **Fase 15** (fugas con un token por rol, e2e, accesibilidad) y **Fase 17**.

### Corte de sesión — 2026-10-12

**Hecho:**

- **PR #14** (asistencia más fluida) y **PR #15** (Novedades) en `main`. `0027` aplicada en dev y prod. En producción, `/novedades` enseñaba **"En desarrollo"** mientras el cliente lo probaba en `dev`; aprobado el 2026-10-12, la pantalla temporal ya está borrada en `dev` y desaparece de prod con el próximo merge.
- **Módulo Novedades cerrado (puntos 8 y 9):** el cliente lo probó y lo aprobó el 2026-10-12.
- **Lanzamiento (Fase 16):** `activareforce.com` en Vercel Production, `www` redirige a la raíz (308), DNS en Cloudflare. `FRONTEND_ORIGIN=https://activareforce.com` en Railway `production` (es el origen canónico de los enlaces de correo). Site URL `https://activareforce.com` y Redirect URL `https://activareforce.com/reset-password` en Supabase `PVCAR`. Verificado: HTTPS, redirección, CORS y login. `pvcar.vercel.app` ya no responde.
- **Plataforma anterior dada de baja:** el cliente borró su hosting, su Supabase (y la cuenta) y su repo. Claude borró la copia local del código, `_ref/`, el respaldo local y el servidor MCP que apuntaba a ella.

**Novedades, dos avisos (2026-10-12):** el switch único de "notificar también" se partió en dos casillas: las novedades sobre personal avisan al mencionado (y él las ve) y las de alumno avisan al representante (y él las ve). Migración `0028_novedades_dos_avisos.sql`. Después, **pestañas Novedades / Configuración** (la segunda con la casilla Editar de Novedades, `0029`), las cuatro casillas de Novedades visibles en Permisos, y borrar solo con la casilla Eliminar (el autor tampoco; sin Eliminar no se ve el autor). **Tipo nuevo "Representantes"** (`0030`): Personal de Activa Reforce ya no lista representantes; los representantes mencionables son los de los alumnos del alcance de quien escribe, y avisa y deja ver con la casilla del representante. El representante menciona alumnos (y sus representantes) del colegio de sus hijos; las listas se agrupan por colegio. **Número rojo de Novedades en el menú** (`0031`, tabla `novedad_visto`): solo Propietario y Admin, novedades de otros desde la última que llegó a su pantalla; una consulta que solo cuenta, cada minuto y solo con la pestaña a la vista. **Eliminar ya no borra** (`0032`): la novedad pasa a `est_id` 2 con quién y cuándo, deja de verse en el módulo y en el número del menú, y sigue en el **reporte nuevo Reportes → Novedades** (todas, en pantalla y eliminadas; filtros de fechas, texto/autor y estado; Resumen por tipo y por autor). Ese reporte pide la casilla Eliminar de Novedades, no Ver: enseña autores y eliminadas. Propietario y Admin ven todas; otro con Eliminar, solo las suyas.

**Punto 9 — aviso automático de ausencia (2026-10-12, `0033`):** guardar la asistencia de alumnos escribe, en la misma transacción, una novedad **Ausencia** (etiqueta roja) por cada alumno que pasa a Ausente y una **Corrección** si después pasa a Presente, Tarde o Justificado. Lo decide el último aviso de esa clase (disciplina + fecha + alumno, también entre los eliminados), no la marca anterior: guardar dos veces no repite, y sin ausencia avisada no hay corrección. Solo clases de hoy y de los 7 días anteriores (pasar lista atrasada no escribe a los padres). La novedad va a nombre de quien guardó y guarda una foto de la clase (`nov_datos`: colegio, actividad, día, horario, estado, hora de llegada, motivo); la tarjeta enseña además los representantes con teléfono y correo. Correo propio `ausencias` en Configuración de Novedades (Para, CC, respuestas y la casilla "avisar también al representante", que también se las enseña en sus Novedades); uno por alumno, después del COMMIT, en fila a 600 ms (Resend admite 2/s). Código en `backend/src/modules/novedades/novedades.ausencias.ts`. Además: borrar para siempre a un alumno o usuario que sale en novedades ya no da 500; se bloquea con el recuento y se pide la baja. Y en las dos asistencias el botón "Presentes a los N y guardar" se partió en **"Marcar Presente a Todos" / "Marcar Presentes a N"** (solo marca) y **"Guardar"** al lado (apagado sin cambios). En **Reportes → Novedades**, casilla **"Ver ausencias"** (marcada por defecto; quitada, saca ausencias y correcciones de la lista y del Excel) y hoja **Ausencias** en el Excel con la clase, la asistencia, el motivo y los representantes (`Definicion.hojaExtra`). En el Excel, la hoja Novedades lleva solo las escritas a mano (ausencias y correcciones van solo en su hoja) y el Resumen cuenta solo el total, sin en pantalla / eliminadas.

**Tablero → "Correos enviados hoy" (2026-10-12, `0034`):** tarjeta en el tablero General con los correos que salieron hoy y de qué tipo. Contador `correo_diario` por día de Ecuador y tipo (una fila por día y tipo, no por correo): se suma en `lib/correo.ts` cuando Resend acepta el envío, y en recuperar contraseña cuando Supabase lo acepta. Vuelve a 0 sola a las 00:00 de Ecuador porque la clave es la fecha de Ecuador; los días anteriores quedan de histórico. Cuenta correos (envíos), no destinatarios.

**Al retomar — lista de trabajo, uno por uno:**

1. ~~**Punto 8 — Novedades**~~ — ✅ cerrado el 2026-10-12, aprobado por el cliente.
2. ~~**Punto 9 — aviso automático de ausencia**~~ — ✅ cerrado el 2026-10-12, aprobado por el cliente.
3. ~~**Pasar a `main`**~~ — ✅ **PR #16 mergeado el 2026-10-13**: Novedades, ausencias, correos del tablero y ficha/contrato por colegio en producción; `0028`–`0036` en prod. CRISFE Carcelén debe publicar su ficha y su contrato antes de abrir inscripciones.
3b. ~~**Arreglos de Inscripción en prod**~~ — ✅ **PR #17 y #18 (2026-10-13)**: `/inscripcion` siempre en claro; sin traductor automático ni pantalla negra al reventar (`ErrorBoundary`); "Tus datos" detecta la cuenta también por correo (una cuenta sin cédula ya no llena todo para que la rechacen al enviar). Detalle en `docs/fase14b-contratos.md` §9. Sin SQL.
3c. ~~**Inscripciones abiertas al público y cursos por disciplina**~~ — ✅ **2026-10-14**: pruebas borradas de prod (desde la inscripción 4 todo es real); Vercel Analytics (PR #19); `0037` (la asignación no nace con fecha de baja); **cursos por disciplina** (PR #20, `0038` + `0039`): cada disciplina marca sus cursos y el formulario público solo ofrece las del curso elegido (el backend lo comprueba; en la ficha de una pendiente, aviso sin bloquear).
4. ~~**Respaldo de prod**~~ — **no necesario como tarea** (decidido por el cliente el 2026-10-15): se hará a mano, puntual, cuando lo pida. Se le avisa antes de cualquier operación destructiva en prod.
5. **Pruebas en pantalla** de las Fases 9–14 (`docs/checklist-modulos.md`).
6. **Reportes — pedido del cliente (2026-10-14, orden decidido el 2026-10-15):** tarjetas en este orden: Usuarios, Colegios, Actividades, Disciplinas, Entrenadores, Alumnos, Evaluaciones, Asistencias de alumnos, Asistencias de entrenadores, **Representantes** (nueva: resumen + lista con toda su información y vinculación con hijos), **Inscripciones** (nueva: resumen + detalle), **Encuestas** (nueva: lo más limpio posible, solo información necesaria), Novedades, Data anterior (al final, no se toca).
7. **Pagos mensuales** — esperar a que el cliente lo cuente.
8. **Fase 15** (fugas con un token por rol, e2e, accesibilidad) y **Fase 17**.

**Decididas por el cliente el 2026-10-12:**

- **Fase 13 §4:** el reporte de Alumnos **sí** saca la información de salud (columna sensible con casilla y auditoría, como está).
- **Fase 12 §4:** Mobak se deja como está; se revisa al probar la Fase 12.
- **Fase 11 §4:** **no** se permiten fechas futuras en asistencia; ahora lo rechaza también el servidor.
- **Sin invitación por correo:** el admin pone siempre la contraseña al crear el usuario.

**Ficha y contrato, uno por colegio (2026-10-13, `0035` + `0036`):** decidido por el cliente. Cada colegio arranca con el texto base sin publicar y publica los suyos (tal cual o editados); lo de uno no toca a los demás. Detalle en `docs/fase14b-contratos.md` §1.

### Corte de sesión — 2026-10-09

**Hecho hoy (todo en `dev`; `0027_novedades.sql` por correr antes de probar):**

- **Punto 8 — módulo Novedades.** Cualquier rol escribe una novedad con uno de tres alcances: **General** (texto suelto), **Personal de Activa Reforce** (menciona 1..N usuarios activos) y **Alumnos** (menciona 1..N alumnos del alcance). Al enviar sale correo al Para + CC configurados; si el switch "notificar también al mencionado y al representante" está activo, se añaden al Para los mencionados (personal) o los representantes (alumno).
- **Visibilidad del listado:** Propietario y Admin ven todas; el resto ve las suyas; con el switch activo, los mencionados ven las que les tocan y los representantes las de sus hijos. Las generales solo las ven autor y globales.
- **Eliminar:** solo con la casilla Eliminar (Propietario y Admin); el autor no borra la suya (decidido el 2026-10-12). No se edita (el correo ya salió). Quien no tiene Eliminar tampoco ve el autor.
- **Permisos** `novedades` (`ver`, `crear`, `eliminar`) añadidos a `rol_permiso` por la propia `0027`: todos los roles ven y crean; eliminar solo Propietario y Admin. Si el cliente quiere restringir, se reparte desde la pantalla de Permisos.
- **Nuevo tipo `novedades` en `correo_config`** y columna `corcfg_notificar_mencionado`.
- **Infra añadida:** `backend/src/modules/novedades/*`, `frontend/src/pages/Novedades.tsx`, `components/novedades/{SelectorMenciones,CrearNovedadDialog}`, `api/novedades.ts`, `hooks/useNovedades.ts`. Montado en `app.ts` y en el sidebar con icono Megaphone.
- **Correos** reutilizan `enviarComo` con un `paraExtra` nuevo que suma los mencionados al Para configurado.
- 7/7 tests de frontend, 605/605 de backend, lint sin errores y build limpio.

**Card Novedades en Reportes:** hecho el 2026-10-12 (ver corte de arriba).

**SQL por correr (dev):** `db/migrations/0027_novedades.sql`. Prod lo recibe cuando el cliente apruebe el PR a `main`, como siempre.

**Al retomar — lista de trabajo, uno por uno:**

1–8. ~~Fechas · Cambio de entrenador · Correos · Correo de aprobación · Reportes · Permisos · Asistencia más fluida · Novedades~~ — hechos.
9. ~~**Aviso automático de ausencia**~~ — ✅ cerrado el 2026-10-12 (ver corte del 2026-10-12).
10. **Pagos mensuales** — esperar al cliente.
11. **Pruebas en pantalla del cliente** (las de Novedades, hechas y aprobadas el 2026-10-12).
12. **Decisiones pendientes.**
13. **Siembra de prod** + Fases 15/16/17.

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
| Vercel Production | `activareforce.com` | `main` | `PVCAR` |
| Vercel Preview | `dev-pvcar.vercel.app` | `dev` | `PVCAR_Dev` |

**Reglas de oro (no negociables):**

1. `SUPABASE_SERVICE_ROLE_KEY` y `DATABASE_URL` viven **solo** en variables de Railway. Nunca en el front, nunca en git.
2. El frontend usa Supabase **únicamente** para login/sesión. Todo dato pasa por el API.
3. Toda lógica de negocio —alcance, scoring, transiciones de estado, agregaciones— vive en el backend.
4. Ningún endpoint sin validación `zod` y sin chequeo de permisos.
5. Cada cambio de schema es una migración versionada en `PVCAR/db/migrations`, copiada a `SQL/` para que el cliente la ejecute. Nada a mano en el dashboard.

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

Verificados en `PVCAR_Dev` el 2026-09-16. Son los mismos IDs que los del esquema `archivo`.

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
| Borrar una **disciplina** | Arrastra inscripciones, asignaciones de entrenador, evaluaciones asignadas y asistencias. |
| Borrar un **colegio** | Bloqueado si tiene disciplinas. |
| Borrar una **actividad** | Bloqueada si existe una disciplina con ella. |
| **Inscribir a un alumno** en una disciplina | Un trigger crea automáticamente sus filas en `evaluacion_nino_pendiente` para las evaluaciones activas de esa disciplina. |
| Añadir/editar/borrar un **parámetro de evaluación** | Un trigger recalcula `evaluacion.eva_puntaje_total`. |
| Borrar un **alumno** permanentemente | Cascada: inscripciones → evaluaciones pendientes → intentos; asistencias; vínculos con representantes. Destruye el historial entero. |
| Borrar un **usuario** permanentemente | Falla si registró asistencias (`asistencia_nino.usu_registrador`) o creó evaluaciones (`evaluacion.eva_creador`): esas FK **no** tienen cascada. |

**Los dos triggers hay que apagarlos en cargas masivas** (`nino_asignacion` y `evaluacion_parametro`), o revienta con `duplicate key ... evaluacion_nino_pendiente_pkey`.

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
| **0** | Cuentas GitHub/Supabase/Railway/Vercel de Activa Reforce con 2FA. Dominio `activareforce.com` en Cloudflare. |
| **1** | Monorepo `ActivaReforce/PVCAR`, `main` protegida (checks `check` y `secrets-scan`, sin revisión obligatoria), npm workspaces, CI con lint + typecheck + build + test + escaneo de secretos. |
| **2** | 35 tablas, 63 FK, 107 índices, 6 funciones, 3 triggers en las dos bases. RLS `ENABLE` + `FORCE` en las 35 con **0 políticas**. Bucket `usufoto` privado. `anon`/`authenticated` sin ningún privilegio, ni sobre tablas ni sobre funciones. Correcciones de diseño imposibles de hacer en caliente: `auth_user_id` con CHECK, sin columna de contraseña, índice en todas las FK, unicidades que faltaban. |
| **3** | Backend Express+TS en Railway, dos ambientes, `/api/v1/health` con `db:"ok"`, servicios en `us-east4` (Virginia) para no pagar 55 ms por consulta contra Ohio. |
| **4** | Frontend en Vercel, Production←`main` y Preview fijo←`dev`, env vars por ambiente, `lib/api.ts` con JWT y logout en 401. |
| **5** | Autenticación real: login por el backend (un viaje trae sesión + usuario + roles + permisos), logout global, reset por correo con pantalla `/reset-password`, cambio de contraseña desde Perfil, rate limit por IP+cuenta. 12/12 pruebas. |

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

#### Malas prácticas corregidas

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

- *¿Qué le pasa a un colegio si le quito su coordinador?* Nada se rompe: se queda sin nadie a cargo y la tarjeta lo dice. Ya ocurre con 3 colegios de los datos reales. Y esa persona pasa a ver **cero** colegios — `alcanceDe` devuelve lista vacía y eso significa "no ve nada", no "ve todo".

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
4. **El botón Asignar se ofrecía a entrenadores de baja** (el backend lo rechazaba). Ya no se ofrece.

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

### Fase 10 — Alumnos

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

**Confirmado el 2026-09-16:** en la plataforma anterior, `encuesta`, `encuesta_pregunta`, `encuesta_respondida`, `encuesta_respuesta`, `padre` y `nino_padre` tenían **0 filas**. Nunca se usaron, así que el módulo se estrenó vacío.

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
- [x] **Cero secretos en el bundle.** Solo tres `VITE_*` (`VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), las tres públicas por diseño. El JWT horneado en el bundle de producción se decodificó: `role: "anon"`, `ref: dahsgmpubbofrefvseir` — que de paso confirma que **Vercel Production apunta a `PVCAR`**, algo que hasta ahora solo se había mirado a ojo en el dashboard.
- [x] **Code-splitting.** Cada pantalla es su propio trozo (`React.lazy`) y las librerías van aparte (`react`, `datos`, `graficas`, `supabase`). La primera carga baja de **1 428 kB a 627 kB** (398 → **187 kB** gzip, **53 % menos**): quien abre el login ya no se descarga Recharts, las 9 definiciones de reporte y el constructor de encuestas antes de poder escribir su contraseña.
- [x] **`no-explicit-any` en `error`.** Llegó a 0. De paso salieron **cuatro archivos que no usaba nadie** (`SharedDataContext`, `useSorting`, `useDebounce`, `sortable-table-header`) y cinco declaraciones muertas: estaban escondidos porque `no-unused-vars` seguía en `off` desde el andamiaje original. Las dos reglas están ahora en `error`; quedan 9 avisos, todos de `react-refresh` en ficheros de shadcn.
- [x] **Rendimiento: una cascada encontrada y cortada.** Entrar en frío a `/reportes/:modulo` costaba **tres viajes en serie** (`/me` → catálogo → datos), porque para saber si el reporte exige rango de fechas hacía falta su definición. El catálogo son 9 definiciones que el backend arma en memoria sin tocar la base: ahora se precarga desde el layout y no caduca en toda la sesión. El resto de pantallas ya estaban bien — ningún `enabled` depende de la respuesta de otra consulta, solo de lo que elige el usuario.
- [x] **Plantillas de correo en español**, en `PVCAR/docs/correos/`, con su `LEEME.md`. **Falta que el cliente las pegue** en los dos proyectos.

**Pendiente, y por qué:**

- [x] **SMTP con Resend en `PVCAR` (producción)** — puesto el 2026-10-07. El cliente lo decidió el 2026-09-17: configura Resend y lo conecta al SMTP de Supabase. Hace falta porque el servidor de correo que trae Supabase de serie está limitado a unos pocos envíos por hora y no es para producción: con 70 usuarios, un día con varias recuperaciones de contraseña se queda corto y los correos no salen.
- [x] **Pegar solo `recuperar-contrasena.html`** (2026-10-07) y `https://activareforce.com/reset-password` en *Redirect URLs* (2026-10-12). Las otras dos plantillas **no se pegan**: ver abajo por qué.

**Por qué solo hace falta una plantilla.** Verificado en `usuarios.service.ts` el 2026-09-17: crear un usuario llama a `admin.auth.admin.createUser` con la contraseña que **escribe el admin** y `email_confirm: true`, así que Supabase no manda nada. Reactivar a un inactivo hace lo mismo. Ni *Confirm signup* ni *Invite user* se disparan nunca: la primera necesitaría registro público, que no existe, y la segunda necesitaría que el código llamara a `inviteUserByEmail()`, que no lo hace. Las dos plantillas quedan escritas en `docs/correos/` por si el flujo cambia, pero **no van al dashboard**.

- [x] ~~**Preguntarle a Activa Reforce si quieren cambiar el flujo de alta.**~~ **Cerrado el 2026-10-16: el admin sigue poniendo la contraseña, se queda así.** No hay invitación por correo. Lo de abajo es el razonamiento original. Hoy el admin crea al usuario **escribiendo él la contraseña**, así que **conoce la contraseña de todas las personas del sistema**. La alternativa es el flujo de invitación: el admin crea la cuenta sin contraseña, a la persona le llega un correo y la elige ella, sin que nadie más la sepa nunca. A favor: es mejor práctica y quita al admin de en medio. En contra: ata el alta al correo — si el SMTP falla o la dirección está mal, esa persona no puede entrar, mientras que hoy el admin le dice la contraseña y ya. **Es pregunta para ellos, no decisión técnica.** Resend ya funciona, así que se le puede preguntar. Si dicen que sí, las plantillas `invitacion.html` y `confirmar-correo.html` ya están escritas.
- [x] **Revisión de alcance rol por rol (2026-10-05, estática, con los datos reales del esquema `archivo` para medir).** Tres fugas del mismo tipo, cerradas en `dev` (`448baa9`, `0b0853d`):
  1. **Entrenador y auxiliares veían el colegio entero.** `alcanceDe` les sumaba los colegios de sus disciplinas, y Estudiantes, los reportes y la tendencia del tablero filtran "colegio O disciplina". Un entrenador con 4 disciplinas veía 176 alumnos (con su salud) en vez de sus 37. Ahora `colegios` = solo `colegio_coordinador`.
  2. **Representante.** Su camino aportaba colegios y disciplinas de sus hijos al alcance del personal: con "ver" en Estudiantes o Asistencias habría visto el colegio y la clase entera. Ahora trae solo `ninos` y `disciplinasDeHijos`.
  3. **Encuestas (gestión) e Inscripciones.** No filtran por alcance y solo pedían "ver": `requirePersonal` deja fuera a quien solo es representante; en Inscripciones un no-Propietario/Admin solo ve las suyas.
  De paso: el pase de lista sacaba los colegios de `/colegios` (403 para el entrenador) y no se podía usar; `useColegiosVisibles()` los deduce de sus disciplinas.
  **Regla para lo que venga:** a un representante, `alcance.ninos`; a un entrenador, `alcance.disciplinas`; `colegios` solo a quien coordina; módulo sin filtro de alcance → `requirePersonal` o guarda global.
- [ ] **Auditoría de fugas con un token de cada rol.** El repaso estático dice que el alcance se aplica en el **servicio**, no en el SQL del repositorio: cada módulo que toca datos de menores tiene su guarda (`exigirVisible`, `exigirPendienteVisible`, `exigirSesion`, `exigirAlcance`…) que resuelve el alcance y devuelve 403. Es el diseño correcto, pero eso no se da por bueno leyendo código: se prueba con un token por rol contra todos los endpoints, y eso necesita el API en marcha.
- [ ] Tests e2e por módulo + prueba de carga en dev con el volumen real.
- [ ] Repaso de accesibilidad y responsive de las 14 pantallas, en los dos temas, en los tres anchos.
- [x] ~~**Respaldo de prod.**~~ **No necesario como tarea** (cliente, 2026-10-15): se hace a mano, puntual, cuando lo pida. Antes de cualquier operación destructiva en prod se le avisa.

---

## 9. Fase 16 — Lanzamiento

✅ **Hecha el 2026-10-12.** Con el arranque de cero no hubo migración de datos: el lanzamiento se redujo a esto.

- [x] Prod limpia de lo de prueba y con un Propietario.
- [x] `main` desplegado en Railway `production` y Vercel Production (PR #15).
- [x] Dominio: quitado del hosting anterior, añadido a Vercel Production (`www` → raíz), DNS en Cloudflare, HTTPS verificado.
- [x] `FRONTEND_ORIGIN`, Site URL y Redirect URLs al dominio nuevo; CORS y login verificados.
- [ ] Smoke test con un usuario real de cada rol, según se vayan creando.

---

## 10. Fase 17 — Cierre del proyecto

- [x] Borrar la plataforma anterior: hosting, Supabase, cuenta de Supabase y repo (2026-10-12, el cliente).
- [x] Borrar la copia local de su código, `_ref/` y el respaldo local (2026-10-12, decisión del cliente). El cliente confirmó el 2026-10-16 que la plataforma anterior ya no está en el workspace y que su repo y su base están eliminados.
- [ ] **Rotar los dos PAT de Supabase** que están en texto plano en `.mcp.json` (riesgo asumido por el cliente).
- [ ] Borrar `CLAUDE.md` y `Roadmap.md` del repo (están solo para trabajar desde otro equipo).
- [ ] Pasar el repo `PVCAR` a **privado**.
- [x] ~~El workspace sale de la carpeta `Flowward`.~~ Cerrado el 2026-10-16: la carpeta se queda en `Flowward` para siempre (decisión del cliente).

---

## Anexo A — RLS desde el día 1

**Desde el primer día,** porque `service_role` tiene `BYPASSRLS = true` y el backend se conecta con ella, mientras el front usa la anon key solo para la sesión:

- `0002_rls.sql`: `ENABLE` + `FORCE` en las 35 tablas y **cero políticas**. Deny-by-default.
- `0003_storage.sql`: bucket privado, acceso por URL firmada de corta vida.
- `0005_grants.sql`: `anon` y `authenticated` sin nada sobre tablas, secuencias **ni funciones**.

**Verificado en dev y prod el 2026-07-30:** 35/35 con RLS y FORCE, 0 políticas; con la anon key todo devuelve 401; `service_role` ve los datos; la URL pública del bucket no sirve el objeto.

> **El hallazgo que no hay que olvidar: RLS no protege funciones.** Con la anon key, `rpc/delete_student_evaluation` (SECURITY DEFINER) devolvía HTTP 204 —entraba— hasta `0005_grants.sql`. Al revisar seguridad en Supabase hay que mirar **tres capas**: RLS, privilegios de tabla y ACL de funciones.

**Regla permanente:** toda tabla nueva nace sin RLS; la migración que la cree debe traer su propio `ENABLE` + `FORCE`.

---

## Anexo B — Trampas de infraestructura ya pagadas

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
- [x] Fase 8 — Actividades y Disciplinas — cerrada 2026-10-02; Disciplinas v2 probada el 2026-10-06
- [ ] Fase 9 — Entrenadores — construida; **solo faltan las pruebas**
- [x] Fase 10 — Alumnos — cerrada 2026-10-16, aprobada por el cliente
- [x] Fase 11 — Asistencias — cerrada 2026-10-16, aprobada por el cliente
- [x] Fase 12 — Evaluaciones — cerrada 2026-10-16, aprobada por el cliente
- [ ] Fase 13 — Tablero y Reportes — construida; **solo faltan las pruebas**
- [ ] Fase 14 — Encuestas y Representantes — construida; **solo faltan las pruebas**
- [x] Fase 14B — Inscripciones — cerrada 2026-10-16, probada de punta a punta por el cliente
- [ ] Fase 15 — Endurecimiento y QA — en marcha; falta lo que necesita la app en marcha (fugas por rol, e2e, accesibilidad)
- [x] Fase 16 — Lanzamiento — 2026-10-12, `activareforce.com`
- [ ] Fase 17 — Cierre del proyecto — plataforma anterior borrada; faltan PAT, repo privado y limpieza

**Riesgos vivos:**

| Riesgo | Mitigación |
|---|---|
| Dar un módulo por listo sin probarlo | La sección 3.5. Ya costó trece arreglos en la Fase 6 |
| Free tier de Supabase sin backups automáticos | **Prod tiene datos reales.** Decidido por el cliente (2026-10-15): respaldo a mano cuando lo pida; aviso antes de cualquier operación destructiva |
| PAT en texto plano en `.mcp.json` | Decisión cerrada del cliente; se rotan en la Fase 17 |
| Repo público | Decisión cerrada; pasa a privado en la Fase 17. este documento vive en el repo hasta la Fase 17 |
