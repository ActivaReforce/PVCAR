# Correos de Auth en español

Los únicos correos que manda el sistema. **No los manda la aplicación: los manda
Supabase Auth.** Por eso no aparecen en el código del backend y por eso la
plataforma vieja no tiene nada parecido — aquella guardaba la contraseña en
texto plano en `usu_contrasena` y la comparaba a mano, sin Auth de por medio.

Hoy salen con la plantilla por defecto de Supabase: en inglés y con remitente
genérico.

---

## 1. Pegar la plantilla

Dashboard de Supabase → **Authentication → Emails → Templates**.

**Solo hay que pegar una: `recuperar-contrasena.html`, en la pestaña "Reset
Password".** Asunto: `Cambia tu contraseña de Activa Reforce`.

### Por qué las otras dos no

Porque no se disparan nunca. Crear un usuario en Activa Reforce funciona igual
que en el sistema viejo: **el admin lo crea y escribe él la contraseña**. El
backend llama a `createUser` con `email_confirm: true` — "este correo ya está
dado por bueno, no preguntes" — así que Supabase no manda nada. Reactivar a un
usuario inactivo hace lo mismo.

| Plantilla | Cuándo se dispararía | ¿Pegarla? |
|---|---|---|
| **Reset Password** | Al pulsar «Olvidé mi contraseña» | **Sí** |
| Confirm signup | Si alguien se registrara solo. No existe registro público | No |
| Invite user | Si el código llamara a `inviteUserByEmail()`. No lo hace | No |

`confirmar-correo.html` e `invitacion.html` se quedan en esta carpeta por si
algún día se cambia el flujo de alta. Mientras tanto no tocan el dashboard.

---

## Pendiente: preguntarle a Activa Reforce

Con el flujo de hoy **el admin conoce la contraseña de todos los usuarios**. El
flujo de invitación lo arregla: el admin crea la cuenta sin contraseña, a la
persona le llega un correo y la elige ella, sin que nadie más la sepa nunca.

El precio es que el alta queda atada al correo: si el SMTP falla o la dirección
está mal escrita, esa persona no puede entrar. Hoy, si el correo falla, no pasa
nada — el admin le dice la contraseña y ya.

**No es decisión técnica: hay que preguntárselo a Activa Reforce.** Y va
**después** de que Resend esté funcionando, porque sin correo fiable la
respuesta es que no. Si dicen que sí, `invitacion.html` y `confirmar-correo.html`
ya están listas.

---

## 2. El remitente — esto sí bloquea

El SMTP que trae Supabase de serie **está limitado a unos pocos correos por
hora y no es para producción**. Con 70 usuarios, un día en que varios pidan
recuperar la contraseña se queda corto y los correos simplemente no salen.

Hace falta **SMTP propio** en *Authentication → Emails → SMTP Settings*.
**Decidido: Resend**, con el dominio de Activa Reforce verificado. Sin eso la
Fase 15 no cierra, aunque la plantilla ya esté en español.

Queda por elegir la dirección de salida; `no-responder@<dominio>` es lo
habitual, y encaja con el pie del correo, que ya dice que no se responda.

---

## 3. A dónde lleva el enlace

*Authentication → URL Configuration → Redirect URLs* tiene que incluir
`https://pvcar.vercel.app/reset-password` en `PVCAR` y
`https://dev-pvcar.vercel.app/reset-password` en `PVCAR_Dev`. Si falta, el
enlace del correo rebota al Site URL y la pantalla de cambiar contraseña nunca
se abre.

Trampa ya conocida: `dev-pvcar.vercel.app` está detrás de Vercel
Authentication, así que el enlace de prueba hay que abrirlo en un navegador con
sesión de Vercel. Desde el móvil rebota.

---

## Detalles de la maquetación

Están hechas con tablas y estilos en línea. Outlook y Gmail tiran el `<style>`
de la cabecera, flexbox y grid: lo que parece anticuado es lo único que se ve
igual en los dos. El `{{ .ConfirmationURL }}` sale dos veces a propósito — en
el botón y como texto copiable — porque hay clientes de correo que no pintan
el botón.
