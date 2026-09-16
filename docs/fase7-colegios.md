# Fase 7 — Colegios

Estado al **2026-09-16**. Construido y en `dev`. **Las pruebas contra el API están pendientes: Railway estaba apagado.**

---

## 1. Qué hay que probar cuando Railway esté arriba

| Prueba | Qué tiene que pasar |
|---|---|
| Crear colegio | Con dirección, contacto, foto y dos coordinadores. Aparece la fila en `colegio` y dos en `colegio_coordinador` |
| Nombre repetido | 409 claro. Probar también con otra caja y espacios (`  innova schools quitumbe `) |
| Editar | Cambiar dirección y datos de contacto. Los conteos de la tarjeta no cambian |
| Cambiar coordinadores | Quitar uno y añadir otro. En la base debe verse **una** baja y **un** alta, no un borrado total |
| Coordinador inválido | Mandar el id de un entrenador o de un usuario inactivo → 400 diciendo qué id falla |
| Foto | Subir una, verla firmada en la tarjeta, reemplazarla y comprobar que la anterior desaparece del bucket |
| Alcance | Entrando como coordinador: ve **solo sus colegios**; `GET /colegios/:id` de otro → 403; `PATCH` de otro → 403 |
| Borrar uno con datos | Modal con el recuento exacto (disciplinas, alumnos, asistencias) y botón bloqueado |
| Borrar uno vacío | Exige escribir el nombre, se borra, y queda registro en `auditoria` |
| Móvil 360 px | Tarjetas en una columna, filtros apilados, botones de 44 px, modal sin desbordes |
| Modo oscuro | Tarjetas, badges y modal legibles |

---

## 2. Qué se construyó

### Backend — `backend/src/modules/colegios/`

| Endpoint | Permiso | Qué hace |
|---|---|---|
| `GET /colegios` | `colegios.ver` | Página filtrada por alcance, con búsqueda, orden y los dos conteos (disciplinas y alumnos activos) |
| `GET /colegios/coordinadores` | `colegios.editar` | Candidatos: usuarios **activos con rol 2** |
| `POST /colegios/foto` | `colegios.editar` | URL de subida firmada, carpeta `colegios/` |
| `GET /colegios/:id` | `colegios.ver` | Ficha |
| `POST /colegios` | `colegios.crear` | Alta, con coordinadores, en una transacción |
| `PATCH /colegios/:id` | `colegios.editar` | Edición, con coordinadores, en una transacción |
| `PUT /colegios/:id/coordinadores` | `colegios.editar` | Reemplaza la lista completa |
| `GET /colegios/:id/impacto` | `colegios.eliminar` | Recuento previo al borrado |
| `DELETE /colegios/:id` | `colegios.eliminar` | Borrado permanente, exige escribir el nombre |

### Base de datos

`0007_colegio_unicidad.sql` — índice único sobre `lower(trim(col_nombre))`. **Pendiente en las dos bases.** Ya está en `SQL/` con su explicación en `ORDEN.md`.

### Frontend

`api/colegios.ts`, `hooks/useColegios.ts`, `pages/Colegios.tsx` reescrita, y en `components/schools/`: `SchoolCard`, `SchoolForm`, `CoordinatorMultiSelect` reescritos y `EliminarColegioDialog` nuevo.

**Borrado por inservible:** `SchoolCardGrid`, `SchoolTable`, `SchoolDetail`. La carpeta pasa de 6 archivos a 4.

---

## 3. Qué se arregló del sistema viejo

- **La pantalla traía la tabla `colegio` entera con la anon key** y buscaba, ordenaba y paginaba en el navegador. Un coordinador veía los siete colegios y los datos de contacto de todos. Ahora la lista sale del alcance, en el servidor.
- **Los coordinadores se guardaban borrando todos e insertando de nuevo**, fuera de transacción: si fallaba el insert, el colegio se quedaba sin nadie a cargo. Ahora es por diferencia y dentro de la transacción.
- **Se podía nombrar coordinador a cualquiera**, incluso a alguien sin el rol 2. Esa fila existía pero `alcanceDe` no se la contaba: el colegio parecía tener responsable y esa persona no veía nada. Ahora se valida y se dice qué id falla.
- **El borrado confiaba en que Postgres fallara** y traducía el error a "No puede eliminar el colegio si existen disciplinas": no decía cuántas ni mencionaba alumnos ni asistencias, que también lo impiden. Ahora hay recuento previo y confirmación escribiendo el nombre.
- **La foto iba a un bucket público** con URL pública. Ahora el bucket es privado, la subida va por URL firmada y la lectura por URL firmada de una hora.
- **La tarjeta no se veía en modo oscuro:** degradado claro fijo (`from-blue-50`) con `text-gray-900` encima, y ocho colores que rotaban por posición en la lista — la misma tarjeta cambiaba de color al pasar de página. Ahora son tokens del tema.
- **Había que desplegar la tarjeta** para ver la dirección y el contacto. Ahora se ven de entrada, y además los conteos de disciplinas y alumnos, que son los que deciden si se puede borrar.
- **Dos colegios podían llamarse igual.** 409 en el backend e índice único en la base.

---

## 4. Decisiones

| Decisión | Por qué |
|---|---|
| Un colegio **no tiene baja lógica** | La tabla no tiene `est_id`. O está vacío y se borra, o tiene historial y no se borra. Añadir estado sería inventar un campo que nadie pidió |
| Las asistencias **bloquean** el borrado | `asistencia_entrenador` y `asistencia_auxiliar` apuntan a `colegio` sin cascada. Son historial: no se tiran para poder borrar un colegio |
| La lista de candidatos vive en `/colegios/coordinadores` | Quien edita un colegio necesita la lista, y no tiene por qué poder abrir el módulo de Usuarios |
| Crear no comprueba alcance | El colegio no existe todavía, así que no está en el alcance de nadie. Lo cierra el permiso `colegios.crear`, que el Coordinador no tiene |

---

## 5. Verificado sin backend

- Las **5 consultas** del módulo ejecutadas contra `PVCAR_Dev` por MCP: lista global (8 colegios con sus conteos), lista de un coordinador (1), candidatos (5 activos con rol 2), validación de coordinadores (rechaza a un entrenador y a un id inexistente) e impacto (el colegio 1 se puede borrar; el 12 queda bloqueado con 22 disciplinas, 184 alumnos y 605 asistencias).
- **29 pruebas automáticas nuevas:** 19 de validación y 10 de las puertas del servicio (alcance en ver, editar, coordinadores, impacto y borrado; confirmación por nombre; bloqueo por datos; ruta de foto de otra carpeta).
- Las 5 FK que apuntan a `colegio`, revisadas una a una: ninguna tiene cascada, así que todas son bloqueo salvo `colegio_coordinador`, que se borra a mano.
- `typecheck`, `lint` (0 errores), `test` (105 backend) y `build` en verde.
