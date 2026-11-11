# Comunicados

Pedido y diseñado con el cliente el 2026-11-11. Rama `comunicados`, migración `0044_comunicados.sql`.

Sirve para mandar correos masivos a representantes y contactos por **Resend Broadcasts** sin entrar a Resend. Lo usa **solo el rol Propietario**, sin casilla en Permisos.

## Por qué Broadcasts

- El plan Marketing gratis de Resend cobra por **contactos guardados (1.000)**, no por envíos, y deja hacer broadcasts sin límite. Es un plan aparte del transaccional (3.000 al mes, 100 al día), que sigue siendo el de Inscripciones, Novedades y las pruebas.
- Mandar a 180 o más personas por la API transaccional se pasa del límite de 100 al día y arriesga la reputación de los correos importantes.

## Resend como tubería

Resend queda vacío en reposo. Los contactos, segmentos y plantillas viven en la plataforma (`0044`). En cada envío (`backend/src/modules/comunicados/comunicados.envio.ts`):

1. **en_cola → preparando:** se crea un segmento temporal en Resend y se mete en él a cada destinatario, sin repetidos.
   - Si el correo **ya existía en Resend** (los contactos reales que el cliente tenía antes, 2026-11-11), solo se añade al segmento y se marca `existia`. **Nunca se borra ni se le cambia nada.**
   - Si no existía, se crea ya dentro del segmento y se marca `creado`.
2. **Broadcast** con `send: true`, desde el remitente de Configuración.
3. **enviando:** se pregunta a Resend hasta que diga `sent`, y se esperan 10 minutos más antes de limpiar.
4. **limpiando:** se borran solo los contactos `creado` y el segmento temporal, por su id. Los segmentos propios del cliente no se tocan. La lista de trabajo (`comunicado_destinatario`) se vacía.
5. **enviado**, o **fallido** con el motivo.

Más reglas del envío:

- **De uno en uno.** El plan gratis admite 3 segmentos y el cliente ya ocupa 2. Además, si dos envíos compartieran un correo, la limpieza del primero se lo quitaría al segundo. Los demás esperan en cola, y en pantalla se ven como «Enviando».
- **Retomable.** Lo mueve un temporizador cada 15 s (`server.ts`) bajo un advisory lock de Postgres. Un reinicio o un deploy a mitad de envío sigue donde quedó: el estado `creando` distingue un contacto propio a medio crear de uno que ya existía.
- **Ritmo:** el límite de Resend es de 10 peticiones por segundo por cuenta, sumando todas las keys. Se usa una cada 150 ms como mucho, y un 429 o un 5xx se reintentan. Son unas 2 peticiones por destinatario: 1.000 correos tardan unos 5 minutos en prepararse.
- **Errores.** Un correo que Resend no acepta (400/422) se salta. Un error definitivo, como una key sin permiso, limpia lo creado y deja el comunicado como fallido.
- **Tope:** 1.000 correos por comunicado, con el contador en vivo al elegir el destino.
- **Sin enlace de baja ni personalización.** Lo decidió el cliente: son avisos académicos. La API de Resend no lo exige.
- **Dev y prod comparten la cuenta de Resend.** Lo decidió el cliente. Es seguro porque cada envío solo borra lo que él mismo creó.

## Variables

- `RESEND_API_KEY_BROADCASTS` (Railway): key de **acceso completo**. Sin ella se puede escribir y guardar, pero no enviar.
- `RESEND_API_KEY` y `CORREO_DOMINIO`: las de siempre. La prueba sale por la API transaccional.

## Pantalla (`/comunicados`)

- **Comunicados:**
  - Borradores (se retoman) e Historial con fecha, asunto, destino en palabras, total y estado (Enviando / Enviado / Falló).
  - Al abrir uno se ven el correo tal cual salió y sus datos. **No se guarda la lista de personas.**
- **Nuevo comunicado:**
  - **Para:** uno o varios grupos (todos los contactos, un segmento, o representantes por colegio, curso y disciplina, combinables), con el total sin repetidos.
  - Plantilla o ninguna, asunto y el editor tipo Word: negrita, colores, títulos, listas, tablas, enlaces, botones e imágenes por enlace. El botón **HTML** permite escribir o pegar el código a mano.
  - Vista previa al lado.
  - Guardar borrador, **Enviar prueba** a un correo y **Enviar** con una confirmación que repite asunto, destino, total, plantilla, remitente y una miniatura.
- **Contactos:**
  - CRUD y segmentos (CRUD; añadir y quitar contactos marcados).
  - Importar Excel o CSV en dos pasos: el servidor reparte las filas en nuevos, ya contactos, ya representantes, repetidos y mal escritos, y solo se guarda al confirmar.
  - Si el correo de un contacto es de un representante, avisa y pide confirmación.
- **Representantes:** solo lectura, con los filtros de colegio, curso y disciplina. Representante activo con al menos un hijo activo que cumpla todos los filtros a la vez; sin filtros, todos los activos.
- **Plantillas:** HTML con el marcador `{{contenido}}` (obligatorio) y vista previa con un texto de ejemplo.
- **Configuración:** remitente único (nombre, dirección y «responder a»), sin copias, porque un broadcast no las admite.

## Seguridad

- Seis tablas con `ENABLE` + `FORCE` RLS y solo `service_role`.
- La vista previa va en un `iframe` con `sandbox` vacío.
- Al armar el correo se quitan `<script>`, los `on…=` y los `javascript:`. A tablas, celdas, párrafos e imágenes se les pone el estilo en línea para Gmail y Outlook (`comunicados.html.ts`).

## Pendiente

- Cuando los contactos reales de Resend estén en la plataforma (importados) y Comunicados en producción, el cliente limpia Resend. Hasta entonces no se toca.
