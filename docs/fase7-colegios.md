# Fase 7 — Colegios

Estado al **2026-09-17**. Construido y en `dev`. **Ronda de pruebas abierta.**

---

## 1. Las 13 pruebas

Ronda abierta el **2026-09-17** contra `dev-pvcar.vercel.app`. Se responden por número.

**Estado de la base antes de empezar** (medido por MCP): 8 colegios, 5 vínculos en `colegio_coordinador`, 13 filas en `auditoria`. El único colegio vacío es `col_id 1` "Colegio de Pruebas Dev" — no se toca; el de la prueba 11 es el que se crea en la 1.

| # | Prueba | Qué tiene que pasar | Estado |
|---|---|---|---|
| 1 | **Crear** "Colegio Prueba Fase 7" con dirección, contacto y **dos** coordinadores: Ana Karina (58) y Rodrigo (107) | Se crea. En la base, 1 fila en `colegio` y 2 en `colegio_coordinador` | ⬜ |
| 2 | **Nombre repetido**: crear otro escribiendo `  colegio prueba fase 7 ` (minúsculas y con espacios) | **409** con mensaje claro. No se crea nada | ⬜ |
| 3 | **Editar**: cambiar dirección y datos de contacto | Se guarda. Los conteos de la tarjeta (disciplinas y alumnos) no cambian | ⬜ |
| 4 | **Cambiar coordinadores**: quitar a Rodrigo (107) y añadir a Johanna (112) | Quedan 2. En la base **la fila de Ana Karina conserva su `colcoor_id`**: es una baja y un alta, no borrar todo y reinsertar | ⬜ |
| 5 | **Coordinador inválido** (consola, ver abajo): mandar el id 60 (entrenador, sin rol 2) y el 56 (usuario inactivo) | **400** diciendo **qué id** falla. No se guarda nada | ⬜ |
| 6 | **Foto**: subir una, verla en la tarjeta, reemplazarla por otra | Se ve firmada. Al reemplazar, **la anterior desaparece del bucket** | ⬜ |
| 7 | **Alcance**: entrar como coordinador (p. ej. Johanna, 112) e ir a Colegios | Ve **solo los suyos**, no los 9. Sin botón de crear | ⬜ |
| 8 | **Alcance por API** (consola, como coordinador): pedir la ficha y editar un colegio que no es suyo | **403** en los dos | ⬜ |
| 9 | **Borrar uno con datos**: intentar borrar Innova Schools Calderón | Modal con el recuento exacto (**22 disciplinas, 184 alumnos, 605 asistencias**) y el botón bloqueado | ⬜ |
| 10 | **Heredada de la Fase 6**: en Usuarios, quitarle a Johanna (112) el rol **Coordinador**, que ya tiene 2 colegios a cargo | **409** diciendo cuántos colegios tiene. No toca nada | ⬜ |
| 11 | **Borrar el de prueba**, que está vacío | Exige **escribir el nombre**. Se borra, y queda fila en `auditoria` | ⬜ |
| 12 | **Móvil 360 px** | Tarjetas en una columna, filtros apilados, botones de 44 px, modal sin desbordes | ⬜ |
| 13 | **Modo oscuro** | Tarjetas, badges y modal legibles | ⬜ |

### Las dos de consola (5 y 8)

Con la sesión abierta en `dev-pvcar.vercel.app`, F12 → Console. Pega el bloque que toque de `docs/fase7-pruebas-consola.js`. Imprime el código y la respuesta de cada llamada.

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

`0007_colegio_unicidad.sql` — índice único sobre `lower(trim(col_nombre))`. **Aplicada en dev y prod el 2026-09-17**, verificada por MCP.

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
