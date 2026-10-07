# Fase 14B — Documentos, formulario y estado de las inscripciones

**Vigente al 2026-10-05, noche.** Sustituye todas las versiones anteriores de este archivo. El flujo base (pendiente → aprobar/rechazar, cuenta con contraseña = cédula, precios y descuento por hermano) sigue en `docs/fase14b-inscripciones.md`; donde los dos digan cosas distintas, manda este.

En `dev`. Migraciones `0016`–`0019` aplicadas y verificadas por MCP en dev y prod. Dev se vació el 2026-10-05 (`SQL/reinicio_dev_2026-10-05.sql`) para que el cliente cree sus dos colegios y simule.

---

## 1. Los seis documentos

Vienen de los 8 Word de `Contratos/` (raíz del workspace). Los dos de cada colegio eran el mismo texto con otros datos, así que hay **una plantilla por documento** y los datos de cada colegio entran con marcadores.

| Documento | Grupo | Qué hace el representante |
|---|---|---|
| Autorización de datos personales | Generales | La acepta en el paso 3 (casilla obligatoria) |
| Información de salud | Generales | Contesta No/Sí + especifique y autoriza (obligatorio) en el paso 3 |
| Uso de imagen | Generales | Marca los 3 permisos (opcionales) en el paso 3 |
| Política de datos personales | Generales | La acepta en el paso 4 |
| Ficha de matrícula | Por colegio | La llena en los pasos 1 y 2; la acepta en el paso 4 |
| Contrato | Por colegio | Se llena solo; lo acepta en el paso 4 |

**Plantillas iniciales** en `backend/src/modules/inscripciones/inscripciones.plantillas.ts`: el texto de los Word ya en el formato. El editor arranca con ellas si un tipo no tiene texto.

**Formato del texto** (`inscripciones.documentos.ts`, espejo en `frontend/src/components/inscripciones/documento.ts`): párrafos separados por línea en blanco, `# ` subtítulo, `## ` línea centrada, y piezas entre corchetes que llena el sistema y no se editan: `[casilla clave]`, `[salud]`, `[datos representante|alumno|emergencia|retiro]`, `[firma representante|activa]`, `[politica]`. Las filas de las tablas de la ficha son fijas en código (cada una va unida a un campo del formulario); cambiarlas es pedírmelo.

**Datos para insertar** (`{{clave}}`), en dos grupos: *de la inscripción* (fecha, nombre y cédula del representante, nombre del alumno) y *del colegio* (nombre de la sede, nombre corto de la sede, nombre de la institución, mínimo de alumnos, tarifa mensual, descuento por hermano). Sin IVA. Los ejemplos de las vistas previas son genéricos: ningún colegio real.

**No hay firma dibujada** (decisión del cliente): aceptar es firmar. En el bloque del representante sale "Aceptado electrónicamente" con nombre, C.C. y fecha. En el de Activa queda fijo "Pablo Fernando Andrade Rodríguez — Gerente General" y al aprobar se añade "Aprobado por {usuario en sesión} el {fecha}".

**Una versión publicada no se edita ni se borra** (trigger de 0015); cambiar un texto es publicar otra versión. Publicar exige que estén las piezas obligatorias de ese tipo.

## 2. El formulario público (`/inscripcion`)

Cinco pasos. Cada dato se escribe una vez.

1. **Tus datos:** nombre, cédula (**10 números**, es la contraseña inicial), correo, teléfono (**solo números**). Facturación: interruptor "a mi nombre" (copia nombre, cédula y correo) o datos de otra persona; la dirección siempre.
2. **Alumnos:** datos, parentesco ("Tú eres su…"), colegio (solo los abiertos), curso, disciplinas; contacto de emergencia (obligatorio); **retiro**: interruptor "Yo retiraré al menor" (pone los datos del representante sin poder cambiarlos) o una persona opcional (vacío o completo); modalidad de salida obligatoria, detalle opcional. Cada sección separada con línea.
3. **Salud, imagen y tratamiento de datos:** por alumno, salud (No/Sí; si Sí, especifique obligatorio; la autorización sale en los dos casos y es obligatoria, con la nota de acceso restringido) e imagen (3 permisos). Una vez para todos, la autorización de datos personales (obligatoria) con la política a un toque.
4. **Documentos:** una tarjeta por documento que se abre en una ventana, ya lleno. Solo tres casillas: ficha, contrato y política. Continuar no se habilita sin las tres.
5. **Pago:** desglose por alumno, subtotal, IVA 15 %, **"Pago Inscripción"**; la tarjeta "Transfiere a esta cuenta"; el pedido del comprobante y su campo.

Si el envío no pasa la validación, el backend devuelve frases de lo que falta y dónde ("Alumno 1 · Información de salud: …"), y el formulario las enseña. Los campos opcionales vacíos viajan como `null` y se aceptan.

## 3. El módulo interno (`/inscripciones`)

- **Inscripciones:** arriba, la tarjeta de estado general con su interruptor "Abrir inscripciones" y el motivo si están cerradas; debajo, la lista y la ficha de cada envío (datos, factura, alumnos, constancia de los seis documentos, PDF, comprobante, aprobar o rechazar).
- **Documentos:**
  - *Generales:* cuatro tarjetas. Tocar una enseña la vista previa; desde ahí Editar (con vista previa al lado), Guardar (borrador) y Publicar.
  - *Por colegio:* selector de colegio; tarjeta de **estado del colegio** con su interruptor; tarjeta plegable **Valores del colegio** (tarifa, descuento, mínimo, nombre de la sede, nombre corto, institución); tarjetas de la ficha y el contrato (texto común, vista previa con los datos del colegio elegido).
  - *Configuración:* membrete (cambiar o volver al original) y cuenta bancaria (texto libre con saltos de línea, sale tal cual en el paso Pago).
- **PDF de ejemplo:** un alumno ficticio con lo guardado de cada documento, por el mismo generador.

## 4. Abiertas o cerradas (0018)

- **Un colegio está abierto** si su interruptor está encendido, la ficha y el contrato están publicados, tiene valores y al menos una disciplina activa.
- **Las inscripciones están abiertas** si el interruptor general está encendido, los cuatro generales están publicados y hay al menos un colegio abierto.
- Lo calcula `calcularEstado` en el backend; cada estado dice por qué está cerrado. El formulario solo ofrece colegios abiertos y el envío lo vuelve a comprobar.

## 5. Dinero

- Tarifa mensual por disciplina, por colegio, **sin IVA**. **IVA fijo 15 %** (`IVA_PCT` en `inscripciones.precios.ts`; no se configura). Descuento por hermano según la regla de la 0015.
- **Cobro por disciplina: resuelto el 2026-10-06** con Disciplinas v2 (`docs/disciplinas-v2.md`): una disciplina con todos sus días se cobra una vez; el formulario deja elegir como mucho `inscfg_max_disciplinas` (2, se cambia en Configuración) y bloquea las que se cruzan, con el motivo. Los horarios salen con los días completos ("Lunes y Miércoles 15:00–16:00") en el formulario, la ficha y el contrato.

## 6. Dónde queda cada cosa

| Qué | Dónde |
|---|---|
| Lo que envió, congelado | `inscripcion` (representante y factura en `ins_representante`, IP, navegador, comprobante, total, aprobación) e `inscripcion_nino` (todo lo del alumno en `insnino_datos`, con la foto de los datos del colegio; PDF enviado y aprobado con su sha256) |
| La constancia | `inscripcion_aceptacion`: una fila por alumno y documento, con la versión, el sha256 del texto que vio, lo que marcó (`acep_opciones`) y la fecha |
| Al aprobar | `usuario` (nombre, cédula, correo, teléfono: su cuenta); `padre` (su ficha de representante **y los datos de facturación**, que pueden ser de otra persona); `nino` (salida, retiro, salud, `nino_salud_autorizada`, permisos de imagen); `nino_contacto` (emergencia y retiro); `nino_padre` (vínculo y parentesco); `nino_asignacion` (disciplinas) |
| Configuración | `inscripcion_config` (interruptor general, membrete, cuenta bancaria), `colegio_precio` (valores e interruptor de cada colegio), `documento_legal` (las versiones) |
| Archivos | Bucket privado `inscripciones`: comprobantes, PDF y membrete propio |

**Sobre `padre`** (revisado con el cliente el 2026-10-05): es la ficha del rol Representante, nombre heredado del sistema viejo. Guarda también los datos de facturación, que pueden ser de otra persona (por ejemplo, la esposa). Se valoró moverlos a una tabla `facturacion` y renombrar `padre` a `representante`; **el cliente decidió dejarlo como está**. El inventario de columnas no encontró nada de más en la base.

## 7. Borrado en la 0017 ("solo usamos lo nuevo")

`nino_toma_transporte` (→ modalidad de salida), `nino_cedula`, `nino_otra_info`, `nino_edad`, `padre_sector_residencia` (→ datos de factura) y `ent_cedula` (→ `usu_cedula`). Estudiantes edita ahora salida, retiro, contactos y permisos de imagen; Representantes, la factura; Usuarios ya no pide sector. El esquema `archivo` conserva lo viejo.

## 8. Pendiente

1. ~~**El cobro por disciplina** (§5)~~ → resuelto con Disciplinas v2 el 2026-10-06.
2. ~~**Representante que ya tenía cuenta**~~ → diseñado el 2026-10-06, §9.
3. **Probar en pantalla** el recorrido completo: publicar los seis, valores y apertura de un colegio, inscribir con dos hermanos, aprobar (correo con los PDF adjuntos), rechazar.
4. ~~Antes de lanzar, en prod: quitar el colegio de prueba y crear el primer Propietario.~~ Hecho el 2026-10-05 (`SQL/limpieza_prod_2026-10-05.sql`): prod limpia, Flowward único Propietario.
5. **PDF único** (0020): al aprobar, el aprobado sustituye al enviado; del enviado queda su huella. Representantes muestra la ficha y los documentos firmados (solo personal).
6. **Representante con permiso de ver Inscripciones:** ve solo las suyas ("Mis inscripciones").

## 9. Representante que ya tiene cuenta (decidido con el cliente y construido el 2026-10-06)

**La inscripción es de una vez en la vida.** Se vuelve solo para añadir disciplinas a un hijo o para inscribir a otro. Nada se da de baja automáticamente: sacar a un alumno de una disciplina es cosa del admin.

**Entrada a `/inscripcion`:** "Es mi primera vez" o "Ya inscribí antes". Y el paso **Tus datos**, al pulsar Continuar, comprueba la cédula:

| La cédula… | Qué pasa |
|---|---|
| no existe | sigue como nuevo |
| es de una cuenta activa | "Ya tienes cuenta: entra" → correo y contraseña (la cédula, si no la cambió) y "Olvidé mi contraseña" (el mismo del login: plantilla de Supabase con Resend) |
| es de una cuenta dada de baja | puede inscribir igual, llenando el formulario; la inscripción queda atada a esa cuenta y **al aprobar se reactiva** (el admin lo ve antes de aprobar) |

**Con la cédula sola no se enseña nada:** son datos de menores (salud, contactos). Solo dice si hay cuenta; los datos se ven después de iniciar sesión. Al enviar como nuevo se vuelven a comprobar cédula y correo: si alguno es de una cuenta activa, se le pide entrar.

**Con sesión iniciada:**
- Sus datos y los de facturación salen llenos y se editan; al aprobar se guardan (nombre, teléfono, factura). El correo es el de la cuenta: se cambia en Perfil.
- Ve a sus hijos. Puede **añadir disciplinas** a uno (sus datos salen llenos y editables) o **inscribir otro hijo**. Así no se duplica ningún alumno.
- Las disciplinas que el hijo ya tiene activas salen como **"ya inscrito"**: no se eligen ni se cobran, pero cuentan para el máximo (2) y para los cruces. Si el admin lo sacó de una, vuelve a poder elegirla.
- Si el hijo tiene disciplinas activas, su colegio no se cambia desde aquí.
- **Descuento de hermano:** cuenta también a un hermano que ya tiene disciplinas activas. La regla de siempre: lidera el que más disciplinas tiene; en empate lidera el que ya estaba (ya paga completo).

**Al aprobar:**
- La cuenta es la que envió (o la dada de baja por cédula, que se reactiva). Se actualizan sus datos; el admin ve qué cambia.
- El hijo elegido se actualiza y recibe las disciplinas nuevas, sin duplicarse.
- **Mismo niño desde otro padre:** si un alumno nuevo coincide en nombre, fecha de nacimiento y colegio con uno que ya existe, el admin elige "es el mismo" (se ata también a este representante) o "es otro".
- Se siguen bloqueando: la cédula de otra persona y el correo de otra cuenta.

**Construido el 2026-10-06** (backend `c778a28` y frontend): `POST /inscripcion/identificar` (30/h por IP), `GET /inscripcion/mis-datos`, envío y cotización con sesión opcional, `nino_id` por alumno, `calcularCobro(…, externos)`, ficha con `cuenta` y `posibles` y `aprobar` con `{ mismos }`. El formulario no manda el token salvo que la persona haya elegido "Continuar con mi cuenta" o haya entrado en él (`sinSesion`): alguien del personal con la sesión abierta inscribe a otra persona como anónimo. Recorrido completo probado contra un Postgres local con almacenamiento y correo simulados. Sin migración: `inscripcion.usu_id` e `inscripcion_nino.nino_id` ya existían; ahora se llenan al enviar cuando hay cuenta o hijo.
