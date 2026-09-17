# Fase 13 — Tablero y Reportes

Estado al **2026-09-17**. Construido y en `dev`. **Sin probar contra el API.**

Lo primero que ve cada persona al entrar, y la salida de datos para dirección.

---

## ⚠️ Lo que NO incluye esta fase

**La pestaña de Análisis con gráficas por reporte.** El Roadmap la describe (cada reporte tenía dos pestañas: *Análisis* con gráficas y *Reportes* con filtros y exportación) y aquí está solo la segunda.

Lo que sí se movió: **las cifras que de verdad se miraban** —conteos, porcentajes de asistencia, pendientes por evaluar— están en el tablero, agregadas en SQL y con su periodo. Lo que falta son las gráficas específicas de cada uno de los nueve reportes, que son nueve piezas distintas.

No está bloqueado ni es difícil: es volumen. **Dime si lo quieres y es lo siguiente que hago**; si no, la Fase 13 se cierra sin ello y se documenta el recorte.

---

## 1. Lo que hay que probar

### Tablero

| Prueba | Qué tiene que pasar |
|---|---|
| Entrar como Propietario | Tablero **General** con 8 cifras y las dos tarjetas de asistencia |
| Entrar con **dos roles** (coordinador + entrenador) | **Dos pestañas.** Abre en "Mis colegios" y la de "Mis disciplinas" funciona. Es el fallo que marcaste: antes solo se veía el primero |
| Entrar como asistente | Ve el tablero de entrenador, con las disciplinas de **su titular**, y en "Tu asistencia" la suya —de `asistencia_auxiliar`, no la del entrenador |
| Cambiar el periodo | Cambian solo los porcentajes de asistencia. Los conteos de colegios/alumnos **no**, y la pantalla lo dice |
| "Volver a los últimos 30 días" | Vuelve al periodo por defecto, calculado por el servidor |
| Cuadrar cada cifra | Contra una consulta SQL a mano. En dev: 8 colegios, 46 usuarios activos, 94 disciplinas, 652 alumnos, 1 058 por evaluar |
| Un usuario sin rol | Mensaje de que no tiene tablero. **Nunca más "12 colegios, 328 usuarios"** inventados |
| Pedir por API un tablero que no te toca | 403 |
| Medir el tráfico | El tablero debe bajar unas decenas de KB, no 13 202 filas de asistencia |
| Recargar (F5) | Se queda donde estaba |
| 360 px y modo oscuro | Las tarjetas se apilan; las pestañas ocupan el ancho |

### Reportes

| Prueba | Qué tiene que pasar |
|---|---|
| Abrir Reportes | Salen **solo los que puedes ver**. Un entrenador no debe ver el de Usuarios |
| Abrir uno | Tabla con sus columnas, paginada de 50 en 50, con el total arriba |
| Asistencias sin fechas | Aviso en ámbar y no consulta nada. Con fechas, funciona |
| Filtrar y exportar | El Excel trae **lo mismo que la pantalla**, y una segunda hoja "Filtros" con qué se usó, quién lo generó y cuándo |
| Abrir el .xlsx | Cabeceras en negrita, fila fija, anchos razonables |
| Exportar como coordinador | Solo sus colegios. **Cuadrar el número de filas** contra la pantalla |
| Exportar sin `reportes:crear` | El botón no sale; por API, 403 |
| Exportar un reporte cuyo módulo no puedes ver | 403 |
| Un reporte inexistente en la URL | Mensaje y botón de volver |
| Asistencia de entrenadores | Trae **titulares y auxiliares** en la misma hoja, con su columna "Tipo" |
| 360 px | La tabla se desplaza en horizontal; los filtros se apilan |

---

## 2. Qué se construyó

### Backend — `modules/tablero/`

`GET /tablero?rol&desde&hasta` — un solo endpoint. Devuelve **qué tableros puede ver quien pregunta**, cuál se está enseñando, el periodo y los datos.

Cuatro tableros, **una consulta cada uno**, todo agregado en SQL: general, coordinador, entrenador (con sus auxiliares) y representante.

### Backend — `modules/reportes/`

| Endpoint | Permiso | Qué hace |
|---|---|---|
| `GET /reportes` | `reportes:ver` | Los reportes que puedes abrir, con sus columnas |
| `GET /reportes/:modulo` | `reportes:ver` + `ver` del módulo | Filas paginadas |
| `POST /reportes/:modulo/export` | `reportes:crear` + `ver` del módulo | El xlsx, en streaming |

**Nueve reportes** en un registro de definiciones (`reportes.definiciones.ts`): usuarios, colegios, actividades, disciplinas, entrenadores, alumnos, asistencia de alumnos, asistencia de entrenadores y evaluaciones. Lo único propio de cada uno es su consulta y sus columnas; permisos, alcance, paginación, rango de fechas y generación del Excel son compartidos.

**Encuestas no está**: cero filas en producción y su módulo se rehace en la Fase 14.

**41 pruebas automáticas nuevas** (backend: 374 en total, antes 333). Una de ellas comprueba que **cada definición usa exactamente tantos marcadores `$n` como parámetros declara** — el fallo que en la Fase 6 costó un 500 en producción y que TypeScript no puede ver dentro de una cadena SQL.

Las consultas nuevas, ejecutadas contra `PVCAR_Dev` por MCP antes de subirlas.

**Dependencia nueva:** `exceljs` en el backend, para generar el xlsx en streaming sin tener el archivo entero en memoria.

### Frontend

`api/tablero.ts`, `api/reportes.ts`, `hooks/useTablero.ts`, `Dashboard` reescrito, `Reportes` (índice) y `ReporteDetalle` (una pantalla para los nueve), más tres componentes en `components/tablero/`. En `lib/api.ts` se añadió `api.descargar()`, que baja un archivo con el token y **comprueba que lo que llegó no es un JSON de error disfrazado de xlsx**.

**Borrado por inservible:** `components/dashboard/` entera (9 archivos), `components/reports/` entera (21 archivos, 7 993 líneas), los cuatro hooks de tablero, `useVisibilityAwareQuery` y las **nueve páginas `Reportes*.tsx`**. En total unas **11 400 líneas**.

**El bundle pasó de 2 112 kB a 1 070 kB** (de 591 a 299 kB comprimido): la mitad. Los avisos de lint bajaron de 144 a 31.

---

## 3. Lo que se arregló del sistema viejo

| Estaba mal | Ahora |
|---|---|
| **Quien tiene dos roles veía un solo tablero.** Una cadena de `if` se quedaba con el primero que encajara: un coordinador que además entrena no llegaba nunca a sus disciplinas | Pestañas con todos los que le tocan, el de mayor alcance por defecto |
| **Un tablero de reserva con cifras escritas a mano** en el código: "12 colegios", "328 usuarios", "46 actividades" | Fuera. Quien no tiene tablero propio lo lee dicho |
| Los porcentajes de asistencia se calculaban **descargando las 13 202 filas** de `asistencia_nino` y contándolas con un `forEach`, en cada carga **y cada 60 segundos** | Agregación en SQL, una consulta, sin recarga automática |
| Las cifras no decían de qué periodo eran: eran el histórico completo desde 2025 | Periodo explícito, visible y cambiable, con el valor por defecto calculado en Ecuador por el servidor |
| Un 100 % sobre 4 marcas se veía igual que sobre 3 000 | Cada tarjeta dice sobre cuántos registros va |
| El Excel se armaba en el navegador con SheetJS, tras descargar la tabla entera | Se genera en el backend, en streaming, con tope de 50 000 filas |
| Ningún reporte filtraba por alcance: con la anon key se exportaba la tabla completa | Cada definición aplica el alcance de su entidad, con el mismo criterio que su módulo |
| La pestaña de análisis y la de exportar tenían filtros distintos: se veía una cosa y se bajaba otra | Los mismos filtros para las dos, y el archivo los deja escritos en una hoja aparte |
| Nueve reportes = nueve páginas y dieciocho componentes, cada uno con su idea de qué es "estado" | Un registro de definiciones y una pantalla |
| La asistencia de auxiliares era un reporte aparte que nadie abría, así que sus 283 registros no salían en el informe de personal | Titulares y auxiliares en la misma hoja, con su columna "Tipo" |
| Un fallo en la descarga guardaba un .xlsx que al abrirlo decía "403" | El cliente detecta el JSON de error y avisa; si falla a mitad del streaming, corta la conexión en vez de dejar un archivo a medias |

---

## 4. Decisión que hay que confirmar

**La información de salud en el Excel de Alumnos.**

El reporte lleva la columna *Información de salud*, igual que el del sistema viejo. Es dato médico de menores en un archivo que se manda por correo y se reenvía.

No la he quitado porque quitarla cambiaría en silencio un informe que ya usas. Pero conviene decidirlo: **se puede sacar de la exportación, dejarla solo en la ficha del alumno, o restringir el reporte a ciertos roles.** Dime cuál y lo cambio.
