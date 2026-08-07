# Fase 6 — Usuarios, Roles, Permisos y Perfil

Estado al **2026-08-07, final del día**. Todo lo de aquí está en `dev` con CI verde y desplegado en Railway `development` y en `dev-pvcar.vercel.app`. **Nada está en `main` todavía.**

---

## 1. Lo que hay que hacer mañana, primero

**Las pruebas funcionales no se han hecho.** El módulo está construido y la lista carga con datos reales, pero de las operaciones de escritura no se ha ejecutado ninguna contra dev.

| Prueba | Qué tiene que pasar |
|---|---|
| Crear usuario | Con contraseña y dos roles (Entrenador + Coordinador). Debe poder entrar con esa clave. En `PVCAR_Dev` deben aparecer la fila de `usuario`, las dos de `usuario_rol`, la de `entrenador` y la cuenta en Auth. |
| Correo repetido | 409 con mensaje claro, y **sin dejar cuenta huérfana en Auth**. |
| Editar | Cambiar nombre, teléfono y foto. Cambiar el correo debe cambiarlo también en Auth (probar entrando con el nuevo). |
| Cambiar contraseña desde el formulario | La nueva funciona, la vieja no. |
| Quitar rol de entrenador con asignaciones activas | 409 explicando cuántas asignaciones lo impiden. No debe tocar nada. |
| Quitar rol de coordinador con colegios a cargo | 409 con el número de colegios. |
| Dar de baja | `est_id = 2`, la ficha de entrenador se desactiva y sus asignaciones abiertas se cierran con fecha de hoy. El usuario deja de poder entrar. |
| Reactivar | Vuelve a activo; las asignaciones **no** se reabren (se reasignan en Entrenadores, Fase 9). |
| Último Propietario | Quitarle el rol, darlo de baja o eliminarlo debe rechazarse con 409. |
| Eliminar permanente, usuario nuevo | Muestra el recuento, exige escribir el nombre, borra la fila y la cuenta de Auth. Deja registro en `auditoria`. |
| Eliminar permanente, usuario con historial | Se niega y **dice qué lo impide** (asistencias registradas, evaluaciones creadas…). |
| Permisos | Cambiar permisos de un rol y guardar. Si es un rol propio, los permisos cambian sin recargar. Al Propietario no se le puede quitar `permisos.ver`. |
| Perfil | Se ve la foto (URL firmada) y **todos** los roles, no solo uno. |
| Alcance del coordinador | Entrando como coordinador, la lista solo trae usuarios ligados a sus colegios. |

Verificar en `auditoria` que quedó registro de cada alta, baja, borrado y cambio de roles.

---

## 2. Qué se construyó

### Backend (`backend/src/`)

| Pieza | Qué resuelve |
|---|---|
| `lib/constants.ts` | `ROL`, `ESTADO`, `MODULOS`, `ACCIONES`. Mata los `rol_id === 3` sueltos (23 apariciones en el sistema viejo). |
| `lib/alcance.ts` | `alcanceDe(usuario)`: **unión** de los alcances de todos sus roles, en una consulta. Cada camino exige tener el rol. |
| `lib/tx.ts` | `enTransaccion()`. Una operación de negocio = una transacción. |
| `lib/auditoria.ts` | Escribe en `public.auditoria`, dentro de la transacción que audita. |
| `lib/paginacion.ts` | Paginación, y `ordenSeguro()` con lista blanca para el `ORDER BY`. |
| `lib/storage.ts` | URLs firmadas de subida y lectura del bucket privado `usufoto`. |
| `modules/usuarios/` | Lista paginada con conteos, ficha, alta, edición, baja, reactivación, impacto y borrado permanente. |
| `modules/permisos/` | Matriz por rol; sustituye la RPC `set_role_permissions`. |
| `modules/perfil/` | Ficha propia y foto. El sujeto sale del token, nunca de la URL. |

### Base de datos

`0006_auditoria.sql` — aplicada y verificada en **`PVCAR_Dev`** el 2026-08-07 (8 columnas, 4 índices, RLS activo y forzado, 0 políticas, `anon`/`authenticated` sin nada). **Pendiente en `PVCAR` (prod).**

### Frontend

`api/usuarios|permisos|perfil.ts` (tipos y llamadas), `hooks/useUsuarios.ts` (react-query), y reescritas las páginas de Usuarios, Permisos y Perfil.

**Borrado por inservible:** `useUserFormSubmission`, `useRoleTransitions`, `useCoachStatusUpdates`, `usePhotoUpload`, `RoleFilter`, `RoleCard`, `UsersCardGrid`, `UsuariosContent`, `UsuariosSearch`, `UserPhotoSection`. La carpeta `components/users/` pasó de 20 archivos a 12.

---

## 3. Qué se arregló del sistema viejo

- **La autorización se decidía en el navegador.** Ahora el alcance sale del token, en el servidor, en una sola función.
- **Guardar un usuario eran hasta seis escrituras sueltas**; si fallaba la cuarta, el usuario se quedaba sin roles. Ahora es una transacción.
- **Los roles se guardaban borrando todos e insertando de nuevo.** Ahora por diferencia.
- **Se traía la tabla entera** y se filtraba, contaba y paginaba en el navegador. Ahora todo en SQL.
- **El borrado permanente** solo preveía el error de clave foránea, que con las cascadas del esquema no llega a producirse. Ahora hay recuento previo, confirmación escribiendo el nombre, bloqueo con motivo y auditoría.
- **La comprobación por nombre de rol** (`rol_nombre === "entrenador"`) desapareció: se compara por constante.

---

## 4. Decisiones tomadas

| Decisión | Quién |
|---|---|
| Al crear un usuario, **el administrador escribe la contraseña** (no invitación por correo). | Cliente, 2026-08-07 |
| La pantalla **abre en la lista**, con Activos y todos los roles. Fuera las tarjetas por rol. | Cliente, 2026-08-07 |
| El filtro **"Sin rol"** se queda. | Cliente, 2026-08-07 |
| El **coordinador** solo ve usuarios ligados a sus colegios. | Claude, sin objeción del cliente |
| **Nadie puede dejar al sistema sin Propietario activo** ni quitarle el acceso a Permisos. | Claude, sin objeción del cliente |
| Quitar el rol de coordinador con colegios a cargo **se rechaza**. | Claude |
| `MandatorySurveyManager` **desmontado** hasta la Fase 13. | Claude |

---

## 5. Cómo quedan los conteos

Cada uno ignora a propósito el filtro que él mismo gobierna. Si no, se contradicen entre sí en la misma pantalla.

| Conteo | Respeta | Ignora |
|---|---|---|
| Activos / Inactivos / Todos | roles marcados, búsqueda, alcance | el estado |
| Tarjetas de rol, "Ver Todos" y "Sin rol" | estado, búsqueda, alcance | los roles marcados |

**Dos avisos sobre la suma:**
- Los usuarios **sin ningún rol** no salen en ninguna tarjeta. En los datos reales hay dos (`usu_id` 65 y 101, inactivos, sin cuenta de acceso y sin historial). Por eso 23 inactivos = 21 en tarjetas + 2. Tienen filtro propio.
- Quien tenga **dos roles cuenta en las dos tarjetas**, así que la suma puede pasarse del total. Hoy en dev no ocurre; con el multi-rol en uso, sí.

---

## 6. Lo que quedó pendiente

- [ ] **Las pruebas funcionales de la sección 1.**
- [ ] `0006_auditoria.sql` en **`PVCAR` (prod)**.
- [ ] **PR a `main`** cuando dev quede verificado.
- [ ] Editar el **teléfono desde Perfil** está en el API (`PATCH /perfil`) pero la pantalla aún no lo ofrece.
- [ ] Los **roles 6 y 7** (Asistente, Respaldo) necesitan `entrenador_auxiliar`, que se gestiona en la Fase 9.
- [ ] Ninguna pantalla muestra todavía el **historial de `auditoria`**. Se escribe, no se lee.

---

## 7. Bitácora de los arreglos posteriores al "ya está listo"

Está en `docs/checklist-modulos.md`, con la lista de verificación que sale de ellos. **Leerla antes de empezar la Fase 7.**
