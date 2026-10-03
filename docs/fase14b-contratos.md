# Fase 14B — Contratos, fichas y firma (análisis del 2026-10-02)

**Repetirle esto tal cual cuando pregunte "¿en qué nos quedamos?".** No se ha construido nada de lo que sigue; está esperando sus cinco respuestas (al final). Los documentos del cliente están en `Contratos/` (raíz del workspace, fuera del repo).

---

## Lo que encontré en los 10 documentos

1. **Son Word sin campos rellenables**, solo líneas `______`. Todos llevan el mismo membrete de Activa Reforce arriba; no hay logo del colegio.
2. **Las versiones de cada colegio son casi idénticas.** Comparadas palabra por palabra, CRISFE y Pérez Pallares solo cambian en cuatro cosas: el nombre de la sede, el mínimo de alumnos por grupo (14 / 20), la tarifa (USD 32,10 / 17,39 más IVA) y el descuento por hermano (20 % en los dos). No hacen falta dos juegos de archivos: basta **un modelo por documento y los datos de cada colegio** en la plataforma.
3. **⚠️ Error en los documentos del cliente:** el contrato de Pérez Pallares nombra a **CRISFE 6 veces** (enfermería, mora, cambios de disciplina, salidas, datos de salud). Se copió del otro sin corregir.
4. **⚠️ IVA:** la tarifa dice "más IVA". Hoy la plataforma calcula sin IVA: el padre vería un total menor que lo que se le factura.
5. **⚠️ La disciplina no coincide con la del sistema.** El contrato dice que una disciplina son *dos sesiones semanales*. En el sistema, cada día de cada actividad es una disciplina aparte: en dev, **44 de 50 actividades tienen 2 días**. Con el cálculo actual, quien elige Fútbol martes y jueves **pagaría dos veces**. Hay que cambiarlo para que el padre elija la actividad (con sus dos días) y se cobre una sola vez.
6. **Quién firma qué:** la **política de datos** solo se lee; la **autorización general de datos** se firma una vez por representante; el **contrato** y las fichas de **matrícula**, **datos médicos** e **imagen** se firman una vez por cada niño.

## Cómo lo haría: llenar una vez, firmar una vez

El padre no ve 5 documentos con huecos: ve un formulario por pasos, y **cada dato se escribe una sola vez** aunque aparezca en varios documentos.

1. **Representante y facturación:** nombre, cédula o RUC, teléfono, correo, y datos de factura (nombre, identificación, correo, dirección).
2. **Cada alumno:** nombre, fecha de nacimiento, curso, actividad (con sus días), contacto de emergencia, persona autorizada para retirarlo, transporte escolar o privado.
3. **Salud:** alergias, condiciones, medicamentos, otra información, con **Sí autorizo / No autorizo**. Si dice que no, esos datos **no se guardan** (lo exige la ley).
4. **Imagen:** las 4 casillas por separado (registro interno, compartir con las familias, redes sociales, material promocional).
5. **Revisión:** se le muestran **sus documentos ya rellenados**.
6. **Firma con el dedo, una vez**; se estampa en todos los documentos.
7. **Pago** y comprobante.

Resultado: **un PDF por niño** con todos sus documentos llenos y firmados, más la autorización general. Al **aprobar**, el admin estampa la firma del Gerente General: aprobar equivale a que Activa firma.

## Cómo generar los PDF

**Recomendado: recrearlos con nuestro generador y su membrete.** Son sencillos (membrete, texto, tablas de datos, casillas, bloque de firma). El admin edita el texto en la plataforma, como ahora, con datos como `{{sede}}`, `{{tarifa}}` o `{{minimo_estudiantes}}`; tablas, casillas y firmas las arma el sistema con lo guardado.

Alternativa descartada por ahora: usar sus Word como plantilla y convertirlos a PDF en el servidor. Saldrían idénticos y seguirían editando en Word, pero exige LibreOffice en Railway (pesado y lento).

## Lo que hay que añadir a la base

| Dónde | Qué |
|---|---|
| Representante | Datos de factura: nombre, cédula o RUC, correo, dirección |
| Alumno | Modalidad de salida (transporte escolar / privado, en lugar del sí/no de transporte) y detalle del retiro |
| Contactos del alumno (tabla nueva) | Contacto de emergencia y persona autorizada para retirarlo: nombre, cédula, relación, teléfono |
| Salud del alumno (tabla nueva) | Alergias, condiciones, medicamentos, otra información. Aparte y con acceso restringido, como dice su política |
| Consentimientos (tabla nueva) | Cada sí/no con fecha y versión del documento: datos generales, datos médicos y las 4 de imagen. Revocar añade un registro nuevo; el historial no se borra |
| Colegio | Nombre de la sede para documentos, nombre corto (CRISFE) y mínimo de alumnos. Precio y descuento ya existen |
| Documentos | Seis tipos en vez de tres: contrato, matrícula, ficha médica, imagen, autorización de datos, política |
| Firma | Imagen de la firma en el bucket privado, con su huella |

Útil además: mostrar los permisos de imagen en la ficha del alumno, para que el entrenador sepa a quién no puede fotografiar.

## Lo que tiene que decidir el cliente

1. **IVA:** ¿se aplica el 15 %? ¿Al padre se le muestra el total con IVA?
2. **Disciplina = actividad con sus dos días**, cobrada una sola vez: ¿correcto?
3. **Persona autorizada para retirar:** ¿una sola, como en la ficha, o varias?
4. **Firma de Activa:** ¿se estampa la del Gerente General al aprobar? Si sí, hace falta la imagen de su firma.
5. ¿Le avisa él al cliente del error de CRISFE en el contrato de Pérez Pallares?
