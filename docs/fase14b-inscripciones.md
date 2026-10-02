# Fase 14B — Inscripciones

Estado al **2026-10-02**. **Construida**, sin probar en pantalla. Migración `0014_inscripciones.sql` aplicada y verificada por MCP en dev y prod. Falta del cliente: precio y periodo, campos definitivos y los tres textos legales.

---

## 1. Cómo funciona

1. Activa Reforce manda un correo masivo desde **Resend** (fuera de la plataforma) a su lista de representantes interesados, con el link público `activareforce.com/inscripcion`.
2. El representante llena el formulario en cuatro pasos: sus datos, los alumnos (colegio y disciplinas de ese colegio para cada uno), los documentos y el pago.
3. Lee y acepta con casillas el **contrato**, los **términos y condiciones** y la **política de privacidad**. Aceptar es la firma.
4. Sube **un comprobante de pago** (imagen, obligatoria). Si inscribe a varios niños a la vez, el comprobante es uno para todos.
5. Al enviar se genera **un contrato en PDF por niño**, con su sha256, y el representante puede descargar su copia en ese momento.
6. La inscripción queda **pendiente**. El Propietario la revisa en **Inscripciones**: datos, contratos y comprobante, con botones de llamar, WhatsApp y correo.
7. **Aprobar** crea (o reutiliza) la cuenta del representante, crea los alumnos con sus disciplinas y le manda un correo. **Rechazar** borra el envío entero.
8. Si algo está mal, la inscripción se queda pendiente: el admin contacta al representante por fuera y luego aprueba o rechaza.

El alta manual (Usuarios, Estudiantes, Representantes) se mantiene completa.

## 2. Decisiones

| Tema | Decisión |
|---|---|
| Estados | Solo **pendiente** y **aprobada**. Rechazar no es un estado: borra |
| Cuándo nacen la cuenta y el niño | **Al aprobar** (§4). Mientras está pendiente, ningún otro módulo lo ve |
| Rechazar | Solo pendientes. Borra datos, contratos y comprobante. No toca ninguna cuenta (todavía no existe). Queda una línea en `auditoria` sin datos personales. Se confirma escribiendo el nombre del representante |
| Contraseña | La **cédula**. El correo de aprobación dice "tu contraseña es tu número de cédula", sin escribirla. Se cambia desde Perfil. Decisión del cliente, no reabrir |
| Correo ya existente | No se crea otra cuenta: se le añade el rol Representante y los alumnos. La lista lo marca **"Ya tiene cuenta"** y la ficha pide confirmarlo con esa persona (el formulario no pide sesión) |
| No se puede aprobar si… | el usuario del correo está de baja (se reactiva primero en Usuarios), la cédula es de **otra** persona, o una disciplina elegida se dio de baja, se borró o no es del colegio. La ficha lo dice antes de pulsar |
| Captcha | No. Sí un límite invisible: 10 envíos por hora desde la misma IP |
| Cupos | No hay |
| Archivos | **Bucket privado** `inscripciones`, no Google Drive. Comprobante convertido a JPEG ≤ 1 MB en el navegador; el servidor comprueba que de verdad sea una imagen. Contratos en PDF de solo texto (~3 KB). Acceso por URL firmada de 10 minutos |
| Documentos legales | Se publican desde **Inscripciones → Documentos legales**. Una versión publicada no se edita (lo impide la base); cambiar un texto es publicar la siguiente. **El formulario no se abre hasta que estén los tres** |
| Rutas | Formulario público `/inscripcion`; módulo interno `/inscripciones` (solo Propietario). En dev, `dev-pvcar.vercel.app/inscripcion` solo abre con sesión de Vercel |
| Correo | Por la API de Resend desde el backend (`RESEND_API_KEY`, `CORREO_REMITENTE`, ya en Railway). Si falla, la aprobación sigue y la pantalla avisa para llamar al representante |
| **Pendiente del cliente** | Precio y periodo. Campos exactos del formulario. Textos del contrato, términos y privacidad |

## 3. Esquema (migración `0014`, solo añade)

**Nuevas**

- **`documento_legal`**: contrato, términos y privacidad, versionados. Trigger que impide editar una versión.
- **`inscripcion`**: un envío. Datos del representante en `jsonb`, comprobante, las tres versiones aceptadas (tres columnas), IP, navegador, estado, y al aprobar: usuario, quién aprobó y cuándo.
- **`inscripcion_nino`**: un alumno del envío. Sus datos en `jsonb`, ids de disciplinas, ruta y sha256 del contrato, y el `nino_id` que nace al aprobar.
- Bucket **`inscripciones`**, privado, 2 MB.
- Módulo **`inscripciones`** en `rol_permiso`: ver, editar (aprobar, publicar documentos) y eliminar (rechazar), solo Propietario.

Los datos van en `jsonb` a propósito: los campos todavía no están cerrados y así cambiarlos no pide migración.

**Editadas**

- **`usuario.usu_cedula`**, única, admite pasaporte. Ya es la cédula de **cualquier** usuario: en Usuarios aparece con los datos básicos, no solo para entrenadores.
- **`nino.nino_fecha_nacimiento`**: Estudiantes ya pide la fecha y la edad se calcula.
- **`nino_padre.ninopadre_parentesco`** y **`nino_asignacion.insnino_id`**.

**Pendiente — `0015`, cuando el código esté desplegado:** borrar `entrenador.ent_cedula` y `nino.nino_edad`, que el código nuevo ya no usa. En dev después del deploy de `dev`; en prod **solo después del PR a `main`**, porque el código de `main` todavía las lee. No está escrita.

## 4. ¿Cuándo nacen la cuenta y el niño? — B, decidido el 2026-10-02

| | A — al enviar | B — al aprobar |
|---|---|---|
| El representante entra a la plataforma | Enseguida | Cuando se aprueba |
| Mientras está pendiente | Cuenta, niño e inscripciones existen con estado pendiente. **Todos los módulos** tendrían que esconderlos | Todo vive solo en las tablas de inscripción. Ningún módulo lo ve |
| Rechazar | Deshacer en cascada sin tocar una cuenta que ya existía | Borrar la inscripción y sus archivos |
| Riesgo | Un niño sin pago aprobado en una lista de asistencia o un reporte | Ninguno nuevo |

## 5. Verificado

- **Backend:** 504 pruebas (25 nuevas: reglas de disciplinas, bloqueos de aprobación, firma de la imagen, que el correo no lleve la cédula, validación del envío, rutas internas cerradas sin token, límite de cuerpo de 4 MB solo en esta ruta). Tipos y lint limpios.
- **Consultas nuevas** ejecutadas contra `PVCAR_Dev` por MCP (solo lectura): oferta pública (8 colegios), coincidencias de usuario, lista y edad calculada.
- **PDF** generado y revisado: tildes, ñ, viñetas, marcadores rellenados, uno desconocido a la vista, emoji eliminado, 2,9 KB.
- **Frontend:** tipos limpios, build de producción OK, prueba de contrato de rutas pasa.
- De paso: un cuerpo demasiado grande o un JSON mal formado devolvía **500**; ahora devuelve 413/400.

## 6. Lo que falta probar en pantalla

1. **Documentos legales:** publicar los tres (aunque sean borradores) en Inscripciones → Documentos legales. Sin eso el formulario dice "no están abiertas".
2. **El formulario en el móvil**, de punta a punta, con dos alumnos y una captura de pantalla como comprobante. Que se descargue el contrato al final.
3. **Aprobar** una inscripción con correo nuevo: llega el correo, se entra con la cédula, aparecen los alumnos en Estudiantes con sus disciplinas.
4. **Aprobar** otra con el correo de un usuario existente: no crea cuenta, le añade los alumnos.
5. **Rechazar** una: desaparece de la lista.
6. Usuarios: la cédula aparece en el formulario para cualquier rol. Estudiantes: fecha de nacimiento en vez de edad.
7. Modo oscuro de las dos pantallas nuevas.
