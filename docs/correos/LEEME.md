# Correos de Auth en español

Los únicos correos que manda el sistema. **No los manda la aplicación: los manda
Supabase Auth.** Por eso no aparecen en el código del backend y por eso la
plataforma vieja no tiene nada parecido — aquella guardaba la contraseña en
texto plano en `usu_contrasena` y la comparaba a mano, sin Auth de por medio.

Hoy salen con la plantilla por defecto de Supabase: en inglés y con remitente
genérico.

---

## 1. Pegar las plantillas

Dashboard de Supabase → **Authentication → Emails → Templates**. Se hace en los
**dos** proyectos, `PVCAR_Dev` y `PVCAR`.

| Pestaña de Supabase | Archivo | ¿Se usa hoy? |
|---|---|---|
| **Reset Password** | `recuperar-contrasena.html` | **Sí.** Es el único. Lo dispara «Olvidé mi contraseña» |
| Confirm signup | `confirmar-correo.html` | No. Las cuentas se crean con el correo ya confirmado |
| Invite user | `invitacion.html` | No. Al crear a alguien se le pone la contraseña en el acto |

Los dos que no se usan van igual: el día que se activen, que no salgan en inglés.

El **asunto** de cada uno se escribe en su campo, encima del cuerpo:

- Reset Password → `Cambia tu contraseña de Activa Reforce`
- Confirm signup → `Confirma tu correo`
- Invite user → `Te damos acceso a Activa Reforce`

---

## 2. El remitente — esto sí bloquea

El SMTP que trae Supabase de serie **está limitado a unos pocos correos por
hora y no es para producción**. Con 70 usuarios, un día en que varios pidan
recuperar la contraseña se queda corto y los correos simplemente no salen.

Hace falta **SMTP propio** en *Authentication → Emails → SMTP Settings*, con un
proveedor (Resend, SendGrid, Mailgun, Brevo) y el dominio de Activa Reforce
verificado. Sin eso la Fase 15 no cierra de verdad, aunque las plantillas ya
estén en español.

Decisión tuya: qué proveedor y qué dirección de salida
(`no-responder@<dominio>` es lo habitual).

---

## 3. A dónde lleva el enlace

*Authentication → URL Configuration → Redirect URLs* tiene que incluir
`https://pvcar.vercel.app/reset-password` en `PVCAR` y
`https://dev-pvcar.vercel.app/reset-password` en `PVCAR_Dev`. Si falta, el
enlace del correo rebota al Site URL y la pantalla de cambiar contraseña nunca
se abre.

---

## Detalles de la maquetación

Están hechas con tablas y estilos en línea. Outlook y Gmail tiran el `<style>`
de la cabecera, flexbox y grid: lo que parece anticuado es lo único que se ve
igual en los dos. El `{{ .ConfirmationURL }}` sale dos veces a propósito — en
el botón y como texto copiable — porque hay clientes de correo que no pintan
el botón.
