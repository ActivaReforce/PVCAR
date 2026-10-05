# Fase 14B — Contratos, fichas y firma (análisis del 2026-10-05)

**Construido el 2026-10-05, todo menos el cobro** (ver "Construido" al final). Sustituye al análisis del 2026-10-02. Los documentos están en `Contratos/` (raíz del workspace, fuera del repo): 8 archivos Word.

---

## Su idea, tal como la entiendo

| Grupo | Documentos | Qué hace el padre | ¿Cambia por colegio? |
|---|---|---|---|
| **00** | Política de datos, Autorización de datos, Datos médicos, Imagen | Lee y acepta (médicos e imagen además marcan opciones) | No: iguales para todos |
| **01** | Ficha de matrícula | La llena con sus datos | Solo el nombre de la sede |
| **02** | Contrato | Nada que escribir: **se llena solo** con la 01 y los datos del colegio. Solo lo acepta | Sede, mínimo de alumnos y tarifa |

Seis documentos por niño, y de **cada uno** queda prueba de que el representante lo leyó y aceptó o firmó.

## Qué cambió en los documentos desde el 2026-10-02

1. **El error de CRISFE en Pérez Pallares está corregido.** Comparados palabra por palabra, los dos colegios ahora solo difieren en datos: nombre de sede, nombre corto, mínimo (14 / 20) y tarifa (32,10 / 17,39). El descuento es 20 % en los dos.
2. **Datos médicos se simplificó:** una pregunta (No / Sí + especifique) y una casilla de autorización. Ya no son cuatro campos.
3. **Imagen bajó a 3 casillas** (familias, redes, material promocional). Desapareció la de registro interno.
4. **La autorización de datos es una sola casilla** y enlaza a la política.
5. La ficha pide **una sola** persona autorizada para retirar. Lo tomo como decidido.

## Cómo lo haríamos

### Plantillas: una por documento, no una por colegio

Como los dos colegios solo cambian en datos, cada documento es **una plantilla** con marcadores, y cada colegio guarda sus datos:

- `{{sede}}` → "Colegio CRISFE Carcelén" / "Unidad Educativa Pérez Pallares"
- `{{sede_corta}}` → "Carcelén" / "Pérez Pallares" (la tarifa y el mínimo)
- `{{institucion}}` → "CRISFE" / "PÉREZ PALLARES" (enfermería, mora, salidas, datos)
- `{{minimo_alumnos}}`, `{{tarifa}}`, `{{descuento_hermano}}` (estos dos ya existen en `colegio_precio`)

Un colegio nuevo = llenar sus datos, no un Word nuevo. Si algún día un colegio necesita un texto distinto, se le permite una plantilla propia que reemplaza la general; hoy no hace falta.

Las plantillas se editan en **Inscripciones → Documentos**, con el ciclo borrador → publicado que ya existe (una versión publicada no se toca). Pasan de **3 tipos a 6**.

### El formulario del padre

1. **Representante y factura** (01-A).
2. **Cada alumno**: datos, colegio, disciplina (01-B) — días y horario salen solos; contacto de emergencia (01-C); retiro y transporte (01-D).
3. **Salud** (00 médicos): No / Sí + texto, y la casilla de autorizar. **Si dice Sí pero no autoriza, no se guarda el texto** (lo exige su propia política).
4. **Imagen** (00 imagen): las 3 casillas, todas opcionales.
5. **Revisión**: ve sus seis documentos ya llenos, con la política para abrir. Acepta la autorización de datos.
6. **Aceptación final:** casillas de aceptar. No hay firma dibujada; en las líneas de firma de la ficha y el contrato sale su nombre y cédula como aceptación electrónica.
7. **Pago** y comprobante.

La pregunta "¿Aplica descuento por hermano?" de la ficha **no se le hace**: la calcula el sistema con la regla de la 0015 y la ficha la muestra ya respondida.

### El respaldo de cada documento

Por cada niño y cada documento se guarda una **constancia**:

- qué documento y **qué versión** (la publicada en ese momento);
- la **huella sha256 del texto exacto que vio**, ya rellenado;
- lo que eligió (Sí/No médico, las 3 de imagen, la casilla de datos);
- fecha y hora, IP y navegador;

Al enviar se genera **un PDF por niño con los seis documentos** llenos y, al final, una **hoja de constancia** con esa tabla. El padre lo descarga en el momento y le llega en el correo de aprobación. Al **aprobar**, el bloque de Activa (Gerente General, fijo) recibe "Aprobado por {usuario en sesión} el {fecha}".

Retirar un permiso (por ejemplo, el de redes sociales) crea una constancia nueva; la anterior no se borra.

### Cómo se generan los PDF

Con **nuestro generador**, recreando los Word con el membrete de Activa (`Cosas/activaIcon.png`). Son texto, tablas y casillas: se recrean bien y permiten el llenado automático del contrato. Usar los Word tal cual exigiría LibreOffice en Railway. (La opción "su PDF como plantilla" del 2026-10-02 ya no aplica: son Word con líneas, no PDF con campos.)

## Lo que cambia en la base (`0016_inscripciones_documentos.sql`)

| Dónde | Qué |
|---|---|
| `documento_legal` | 6 tipos: `politica`, `autorizacion_datos`, `datos_medicos`, `imagen`, `ficha_matricula`, `contrato` |
| `colegio` | `col_nombre_documento`, `col_sede_corta`, `col_institucion_corta`, `col_minimo_alumnos` |
| `inscripcion_aceptacion` (nueva) | La constancia: inscripción, niño (nulo para lo que es por representante), documento + versión, sha256, opciones `jsonb`, fecha. Sustituye a las tres columnas `doc_*_id` |
| Configuración | Ruta del membrete vigente |
| `inscripcion_nino` | El PDF pasa a ser el paquete de seis |
| Al aprobar | Contactos y salud pasan a la ficha del alumno; la salud aparte y con acceso restringido. Los permisos de imagen se ven en la ficha, para que el entrenador sepa a quién no fotografiar |

Los datos del formulario siguen en `jsonb` mientras los campos se mueven.

## Respuestas del cliente (2026-10-05)

1. **IVA: sí.** Se suma y el padre ve el desglose (subtotal, IVA 15 %, total) en el formulario y en el contrato.
2. **Disciplina: pendiente.** Primero hay que resolver qué es una disciplina dentro del módulo de Disciplinas; la inscripción se simplifica después. **Bloquea el cobro de la 14B.**
3. **Firma (corregido el 2026-10-05): no hay firma dibujada, ni del representante ni de Activa.**
   - **Representante:** firmar = marcar las casillas de aceptación. En cada bloque de firma del PDF sale su nombre y cédula con "Aceptado electrónicamente el {fecha y hora}" (más IP en la hoja de constancias).
   - **Activa:** el bloque sigue diciendo "Pablo Fernando Andrade Rodríguez — Gerente General — ACTIVA REFORCE S.A.S." fijo. Al aprobar se añade debajo "Aprobado por {nombre del usuario en sesión} el {fecha}".
   - Se cae del diseño: el lienzo de firma, la imagen de firma en el bucket y su huella.
4. **Fechas: ok.** La fecha la pone el sistema; el año lectivo se edita en la plantilla.

**Sin archivos en tiempo de ejecución:** los Word solo sirven para copiar los textos una vez a las plantillas.

**Membrete configurable (pedido del 2026-10-05):** en **Inscripciones → Documentos** hay una opción para ver y cambiar la imagen del membrete. Arranca con la del contrato (`word/media/image1.png`, 1240×260 aprox., 70 KB). Subir otra la usa en los PDF nuevos; los ya generados no cambian (están guardados con su huella). Se guarda en el bucket privado `inscripciones` y su ruta en una fila de configuración; PNG o JPEG.

## Construido (2026-10-05)

Todo lo de arriba menos **el cobro por disciplina**, que espera a definir qué es una disciplina en su módulo. El IVA sí entra en el cálculo.

- **Migración `0016_inscripciones_documentos.sql`** (en `SQL/`, sin correr). Cambia tablas de 0014/0015 que están vacías; si no lo están, se aborta.
- **Plantillas iniciales** (`backend/src/modules/inscripciones/inscripciones.plantillas.ts`): el texto de los seis Word ya pasado al formato, con los datos del colegio como marcadores. El editor arranca con ellas: basta revisarlas, guardar y publicar. Una prueba comprueba que el contrato rellenado con CRISFE dice lo mismo que su Word.
- **Formulario en 5 pasos:** tus datos (con facturación), alumnos (ficha B-D), salud e imagen, documentos (los seis llenos, una casilla por documento), pago con IVA.
- **PDF por alumno:** carta, Helvetica 9,5, membrete arriba en cada página, tablas de la ficha con la etiqueta sombreada como en el Word, casillas y círculos dibujados, firmas lado a lado, hoja final de constancias. La ficha cabe en una página. ~90 KB con membrete (se incrusta una vez).
- **Al aprobar** se regenera el paquete con "Aprobado por {usuario en sesión} el {fecha}" encima de la firma de Activa y se manda adjunto en el correo.
- **Módulo interno:** pestañas Documentos (editor con vista previa, piezas obligatorias, PDF de ejemplo), Colegios y precios (más sede, sede corta, institución y mínimo) y Membrete e IVA.

### Campos: qué se añadió y qué sobra

| Tabla | Añadido | Para qué |
|---|---|---|
| `padre` | `padre_factura_nombre`, `_identificacion`, `_correo`, `_direccion` | Ficha A |
| `nino` | `nino_modalidad_salida`, `nino_detalle_retiro` | Ficha D |
| `nino` | `nino_salud_autorizada`, `nino_imagen_familias`, `_redes`, `_promocional` | Fichas de salud e imagen |
| `nino_contacto` (nueva) | emergencia y retiro: nombre, cédula, relación, teléfono | Ficha C y D |
| `colegio_precio` | `colpre_sede`, `_sede_corta`, `_institucion`, `_minimo_alumnos` | Contrato y ficha |
| `inscripcion_config` (nueva) | IVA y membrete | |
| `inscripcion_aceptacion` (nueva) | la constancia | |
| `inscripcion` | **fuera** `doc_contrato_id`, `doc_terminos_id`, `doc_privacidad_id` | Los sustituye la constancia |

**Borrados en la `0017` (decisión del cliente, 2026-10-05: "solo usamos lo nuevo"):** `nino_toma_transporte` (lo sustituye la modalidad de salida), `nino_cedula`, `nino_otra_info`, `padre_sector_residencia` (lo sustituyen los datos de factura), más `nino_edad` y `ent_cedula`, que ya estaban pendientes. `nino_info_salud` se queda: es donde cae el detalle de salud, solo si autorizó. Estudiantes edita ahora salida, retiro, contactos y permisos de imagen; Representantes, los datos de factura; Usuarios ya no pide sector.

**Parentesco:** se pide en el paso Alumnos ("Tú eres su…", obligatorio) y queda en `nino_padre.ninopadre_parentesco`. No sale en ningún documento porque los Word no lo tienen.

### Pantalla de Documentos (2026-10-05)

Dos secciones: **Generales (00)**, con los cuatro que se aceptan, y **Por colegio (01 y 02)**: se elige el colegio, se editan sus datos y se ven su ficha y su contrato llenos; debajo, el texto común de los dos. La pestaña "Colegios y precios" desapareció: sus datos viven en "Por colegio". El cliente eligió texto común con datos por colegio, no un texto por colegio.

### Falta

1. El cobro por disciplina (ver arriba).
2. Probar en pantalla (lista corta al cliente).
