# Fase 13 — Tablero y Reportes

Estado al **2026-09-17**. Construido y en `dev`. **Sin probar contra el API.**

Lo primero que ve cada persona al entrar, y la salida de datos para dirección.

---

## 0. Las gráficas

Están las **14 gráficas de análisis**, repartidas en los nueve reportes, más la de tendencia en el tablero. Y no se eligieron los colores a ojo: se midieron.

### El hallazgo que cambió el diseño

El primer intento fue el obvio: Presente verde, Tarde ámbar, Justificado azul, Ausente rojo — los mismos colores que los botones de pasar lista. Al pasarlo por el validador de paletas:

| Lo que se midió | Resultado |
|---|---|
| Ámbar brillante (`#fab219`) contra blanco | **1.83:1 de contraste** — un relleno casi invisible |
| Ámbar oscurecido para que se vea (`#c98500`, `#b87d00`, `#a87400`) | La separación con el verde cae a **ΔE 3.0 / 2.6 / 2.0** — un daltónico no distingue "Presente" de "Tarde" |
| Verde contra rojo, los dos estados que más importan | **ΔE 4.1** bajo deuteranopía. El choque rojo/verde de manual |

No hay paso intermedio que salve las dos cosas. **Sobre blanco, verde y ámbar son incompatibles.**

### Lo que se hizo en su lugar

Presente → Tarde → Justificado → Ausente no son cuatro categorías sueltas: son **una escala ordenada** de "vino" a "no vino". Para eso la forma correcta no es una paleta categórica sino una divergente — dos polos que se leen como opuestos y un neutro en medio:

| Estado | Papel | Claro | Oscuro |
|---|---|---|---|
| Presente | polo positivo | azul intenso | azul claro |
| Tarde | positivo débil | azul claro | azul medio |
| Justificado | neutro: faltó, pero está justificado | gris | gris |
| Ausente | polo negativo | rojo | rojo |

Medido con la lista de pares contiguos, que es la que aplica a una barra apilada: **ΔE 9.7 daltónico y 16.8 con visión normal, en los dos modos**. Pasa. Y el choque rojo/verde desaparece: los dos estados que más importan quedan en los extremos, separados por dos tramos.

**Los botones de pasar lista siguen en verde.** Un botón no es una marca de datos: "verde = Presente" es una convención que el entrenador ya tiene en el dedo, y cambiarla para que cuadre con un informe sería empeorar la herramienta. La gráfica siempre lleva leyenda y tabla, así que nadie tiene que emparejar colores entre las dos pantallas. Todo esto está escrito, con los números, en `components/graficas/paleta.ts`.

### Las reglas que cumplen todas

- **Ningún eje doble.** Dos medidas de escalas distintas son dos gráficas, nunca una con dos escalas.
- **Una serie, un color.** Nada de pintar cada barra más oscura donde es más grande: eso codifica dos veces lo mismo.
- **El color sigue a la entidad, no al ranking.** Al filtrar, quien sobrevive conserva su color.
- **Tope de tres tonos categóricos.** Pasar de ahí obligaría a inventar un color que bajo daltonismo sería indistinguible de otro; la salida es agrupar en "Otros" o partir la gráfica. Hay una prueba automática que lo impide.
- **Marcas finas:** barras de 24 px como mucho, líneas de 2 px, rejilla de un pelo y **sólida** —nunca a rayas—, y un hueco de 2 px del color del fondo entre segmentos que se tocan.
- **Leyenda siempre con dos o más series y ninguna con una** (el título ya dice qué se mide), etiquetas directas con cuentagotas y **vista de tabla en todas**, que es la versión accesible y la prueba de que ningún valor depende de distinguir un color.

### Qué gráfica lleva cada reporte

| Reporte | Gráficas |
|---|---|
| Usuarios | Usuarios por rol |
| Colegios | Alumnos por colegio · Disciplinas por colegio |
| Actividades | Actividades más impartidas |
| Disciplinas | Carga por día de la semana · Disciplinas con más alumnos |
| Entrenadores | Carga de alumnos por entrenador |
| Alumnos | Alumnos por grado · Alumnos por colegio |
| Asistencia de alumnos | **Asistencia en el tiempo** · Asistencia por día de la semana · Composición por colegio |
| Asistencia de entrenadores | Asistencia del personal en el tiempo · Composición por colegio |
| Evaluaciones | Distribución de los puntajes · Promedio por evaluación |

Y el **tablero** lleva la de asistencia en el tiempo, que es la que responde lo que de verdad se quiere saber: no cuánta asistencia hay, sino **si sube o baja**.

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

### Gráficas

| Prueba | Qué tiene que pasar |
|---|---|
| Abrir un reporte con gráficas | Abre en **Análisis**; la pestaña **Datos** tiene la tabla |
| Cambiar un filtro | Las gráficas y la tabla se rehacen con el mismo filtro |
| Botón de tabla en una gráfica | Enseña los mismos números en tabla. **Es la comprobación de que ningún valor depende del color** |
| Pasar el ratón | Tooltip con el valor; en las apiladas, además el % de esa fila |
| Modo oscuro | Los cuatro colores de asistencia siguen distinguiéndose; la rejilla no grita |
| **360 px** | Las barras horizontales no aplastan los nombres; la leyenda envuelve; nada se sale de la tarjeta |
| Nombres largos | El eje corta con "…" y el tooltip y la tabla lo dan entero |
| Un reporte sin datos en el rango | "No hay datos con estos filtros", no una gráfica vacía |
| Cuadrar una gráfica | Contra la tabla del mismo reporte. Ej.: los alumnos por colegio deben sumar el total de Alumnos |

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

**Nueve reportes** en un registro de definiciones (`reportes.definiciones.ts`), y sus **14 gráficas** en otro (`reportes.analisis.ts`), servidas por `GET /reportes/:modulo/analisis`. Cada gráfica es **una consulta agregada**: lo que viaja son las diez o veinte filas que se dibujan: usuarios, colegios, actividades, disciplinas, entrenadores, alumnos, asistencia de alumnos, asistencia de entrenadores y evaluaciones. Lo único propio de cada uno es su consulta y sus columnas; permisos, alcance, paginación, rango de fechas y generación del Excel son compartidos.

**Encuestas no está**: cero filas en producción y su módulo se rehace en la Fase 14.

**52 pruebas automáticas nuevas** (backend: 385 en total, antes 333). Una de ellas comprueba que **cada definición usa exactamente tantos marcadores `$n` como parámetros declara** — el fallo que en la Fase 6 costó un 500 en producción y que TypeScript no puede ver dentro de una cadena SQL.

Las consultas nuevas, ejecutadas contra `PVCAR_Dev` por MCP antes de subirlas.

**Dependencia nueva:** `exceljs` en el backend, para generar el xlsx en streaming sin tener el archivo entero en memoria.

### Frontend

`api/tablero.ts`, `api/reportes.ts`, `hooks/useTablero.ts`, `Dashboard` reescrito, `Reportes` (índice) y `ReporteDetalle` (una pantalla para los nueve), más tres componentes en `components/tablero/` y dos en `components/graficas/` — un solo componente que dibuja **por forma** (línea, barras, apilada al 100 %, histograma), así que añadir una gráfica es añadir una consulta en el backend y nada en el frontend. En `lib/api.ts` se añadió `api.descargar()`, que baja un archivo con el token y **comprueba que lo que llegó no es un JSON de error disfrazado de xlsx**.

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
| La pestaña de análisis y la de exportar tenían filtros distintos: se veía una cosa y se bajaba otra | Los mismos filtros para las tres —gráficas, tabla y Excel—, y el archivo los deja escritos en una hoja aparte |
| Cada pestaña de análisis eran entre 194 y **741 líneas** que se traían las filas y las agrupaban con `reduce`: la de evaluaciones descargaba las 1 261 pendientes y la de asistencia, las 13 202 marcas, para pintar cuatro barras | Una consulta agregada por gráfica |
| Los colores de las gráficas se elegían a ojo | Validados con un script contra las dos superficies reales; el verde y el ámbar no pasaron y la escala se rehízo |
| Nueve reportes = nueve páginas y dieciocho componentes, cada uno con su idea de qué es "estado" | Un registro de definiciones y una pantalla |
| La asistencia de auxiliares era un reporte aparte que nadie abría, así que sus 283 registros no salían en el informe de personal | Titulares y auxiliares en la misma hoja, con su columna "Tipo" |
| Un fallo en la descarga guardaba un .xlsx que al abrirlo decía "403" | El cliente detecta el JSON de error y avisa; si falla a mitad del streaming, corta la conexión en vez de dejar un archivo a medias |

---

## 4. Decisión que hay que confirmar

**La información de salud en el Excel de Alumnos.**

El reporte lleva la columna *Información de salud*, igual que el del sistema viejo. Es dato médico de menores en un archivo que se manda por correo y se reenvía.

No la he quitado porque quitarla cambiaría en silencio un informe que ya usas. Pero conviene decidirlo: **se puede sacar de la exportación, dejarla solo en la ficha del alumno, o restringir el reporte a ciertos roles.** Dime cuál y lo cambio.
