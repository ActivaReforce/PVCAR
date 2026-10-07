# Data anterior — Reportes

Estado al **2026-10-02**. Construido y en `dev`. **Sin probar en pantalla.**

La plataforma vieja, de solo lectura, en **Reportes → Data anterior**. Lee el esquema `archivo` (migración `0013`, cargado y verificado en dev y prod el 2026-10-02: 35 tablas, 20 620 filas). Solo Propietario y Admin.

---

## 1. Pruebas

| # | Prueba | Qué tiene que pasar |
|---|---|---|
| 1 | Entrar como Propietario a **Reportes** | Arriba sale la tarjeta **Data anterior** |
| 2 | Entrar como Coordinador o Entrenador | **No** sale la tarjeta; abrir `/reportes/data-anterior` a mano dice que es solo para Propietario y Admin |
| 3 | **Resumen** sin filtros | 808 alumnos, 7 colegios, 94 disciplinas, 1 729 inscripciones, 14 085 asistencias de alumnos, 8 gráficas |
| 4 | Resumen con un colegio y un rango de fechas | Cifras y gráficas cambian; "Alumnos por colegio" avisa que no depende de las fechas |
| 5 | Cada gráfica: botón de tabla | Se ven los números de la gráfica en tabla |
| 6 | **Datos**: recorrer los 15 conjuntos | Cada uno abre con su número de filas, igual al de la lista de la izquierda |
| 7 | Buscar sin tildes | "calderon" encuentra "Calderón"; "futbol", "Fútbol" |
| 8 | Filtros con buscador | En Asistencia de alumnos, "Registrado por" deja escribir para encontrar a la persona |
| 9 | Ordenar | Clic en una cabecera: ascendente; otro: descendente; otro: vuelve al orden de serie |
| 10 | Exportar un conjunto filtrado | El Excel trae las mismas filas que dice la pantalla, en el mismo orden, con cabecera fija y autofiltro, y una hoja **Información** con los filtros escritos con nombres |
| 11 | **Descargar todo en Excel** | Un libro con 15 hojas + Información (≈ 20 600 filas) |
| 12 | Auditoría | Cada exportación deja una fila `historico_exportacion` en `auditoria` |
| 13 | Volver atrás | La pestaña y el conjunto elegidos van en la URL: "atrás" vuelve a donde estabas |
| 14 | Móvil 360 px | Los conjuntos pasan a un desplegable; las cifras en dos columnas; la tabla se desliza en horizontal con la cabecera fija |
| 15 | Modo oscuro | Cifras, tabla, selector con buscador y gráficas legibles |

---

## 2. Qué hay

- **Backend** `modules/historico/`: 15 conjuntos declarados (`historico.definiciones.ts`), 8 gráficas + indicadores (`historico.resumen.ts`), consulta paginada con orden por cualquier columna, exportación de un conjunto y del archivo entero, en streaming.
- **Frontend** `pages/DataAnterior.tsx` + `components/historico/`.
- Los ids de colegio, actividad y persona son **los de `archivo`**, no los de la plataforma nueva: los filtros salen de `GET /historico/opciones`.

## 3. Verificado sin pantalla

- Las 30 consultas de los conjuntos (con y sin filtros), cada filtro por separado y las 9 del resumen, contra una copia local de `archivo`: ninguna falla, todas por debajo de 60 ms.
- Los dos Excel generados de verdad y vueltos a leer: 15 hojas + Información, cabecera fija y autofiltro en cada una.
- 13 pruebas automáticas del módulo + el barrido de parámetros SQL + 6 rutas en la prueba de 401.

## 4. Arreglo de paso en Reportes (Fase 13)

**La exportación a Excel de Reportes fallaba siempre.** Asignaba `hoja.views` después de crear la hoja y, en el escritor en streaming de ExcelJS 4.4, `views` solo tiene getter: `TypeError` con las cabeceras ya enviadas, y la descarga se cortaba. Ahora va en las opciones de `addWorksheet`, y hay una prueba que genera el xlsx y lo vuelve a leer (falla con el código anterior, pasa con el nuevo). Entra en la prueba de exportar de `fase13-tablero-reportes.md`.
