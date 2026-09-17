# Fase 14 — Encuestas y Representantes

Estado al **2026-09-17**. Construido y en `dev`. **Sin probar contra el API.**

Dos módulos: el que existía y nunca se usó, y el que **no existía**.

---

## ⚠️ Antes de probar: correr `0012`

`SQL/0012_encuestas_representantes.sql`. Como las Fases 11 y 12, la migración es **requisito**: sin ella un representante puede responder dos veces la misma encuesta, y la consulta de resultados falla al formatear la hora (`to_char` no acepta `time with time zone`).

---

## 0. Por qué esta fase pudo reescribir el esquema

**Las seis tablas tienen 0 filas.** En los tres respaldos de producción (2026-06-09, 2026-06-10 y 2026-07-27), en `PVCAR_Dev` y en `PVCAR` — comprobado por MCP el 2026-09-17. No es que se borraran: el módulo nunca se usó.

Eso lo convierte en **el único sitio del sistema donde el esquema se puede corregir sin coste de migración**, y por eso se corrigió entero ahora:

| Estaba mal | Ahora |
|---|---|
| Un representante podía **responder dos veces** la misma encuesta | `UNIQUE (encu_id, padre_id)` |
| Y mandar **dos respuestas a la misma pregunta**, con lo que cualquier recuento sería mentira | `UNIQUE (encurespo_id, encupreg_id)` |
| Dos preguntas podían compartir número de orden: el formulario salía en el orden que quisiera el `ORDER BY` | `UNIQUE (encu_id, encupreg_orden)` |
| Un usuario podía tener **dos fichas de representante**, y una ficha podía no apuntar a ningún usuario | `usu_id` NOT NULL + UNIQUE |
| Un vínculo niño–representante podía tener cualquiera de los dos lados en NULL | Los dos NOT NULL |
| La hora de una respuesta se guardaba en `time with time zone`, un tipo que el manual de Postgres desaconseja: una hora sin fecha no tiene zona que valga | `time`, como las horas de asistencia |
| Una pregunta de texto podía llevar mínimo y máximo, y una de escala podía no llevarlos | CHECK de equivalencia, como los campos condicionales de la asistencia |
| El estado de una encuesta podía ser cualquiera de los siete del catálogo | CHECK: solo Borrador, Finalizada, Publicada |

---

## 1. Lo que hay que probar

### Representantes

| Prueba | Qué tiene que pasar |
|---|---|
| Abrir la pantalla sin datos | Mensaje que explica el camino: alta en **Usuarios** con el rol, después atar aquí |
| Crear un usuario con rol Representante (en Usuarios) | Aparece aquí, con "Sin representados" |
| Atar dos alumnos | En la base, dos filas en `nino_padre`. La ficha del alumno también los enseña |
| Soltar uno | Desaparece el vínculo; el alumno no se toca |
| Sector de residencia | Se guarda en `padre_sector_residencia` |
| Coordinador | Solo ve representantes de alumnos de sus colegios, y solo puede atarle alumnos suyos |
| Coordinador guardando | **No suelta** los representados de otro colegio que él no ve |
| Uno "sin ficha" | Si sale en rojo, es un usuario con rol 4 sin fila en `padre`. No debería ocurrir; si ocurre, hay que verlo |

### Encuestas — gestión

| Prueba | Qué tiene que pasar |
|---|---|
| Crear con **los 6 tipos** de pregunta | Se guarda en borrador. Comprobar el orden en `encupreg_orden`: 1..6 sin huecos |
| Reordenar con las flechas y guardar | El orden nuevo queda en la base |
| Pregunta de escala sin mínimo/máximo | 400 |
| Pregunta de texto con mínimo/máximo | 400 |
| Finalizar sin preguntas | 409 |
| Finalizar con preguntas | Ya no se edita: el botón de editar desaparece y por API da 409 |
| Volver a borrador | Funciona mientras **nadie** haya respondido |
| Publicar | Aviso de que a partir de ahí no se edita. Después, 409 al intentarlo |
| Eliminar | Recuento delante y exige escribir el título |

### Encuestas — el representante

| Prueba | Qué tiene que pasar |
|---|---|
| Entrar como representante con una encuesta publicada | **El modal salta solo**, una pregunta por pantalla con barra de avance |
| "Ahora no, la respondo luego" | Se cierra y no vuelve en esa sesión |
| Responder y enviar | Gracias, y **no vuelve a aparecer** |
| Intentar responder dos veces (por API) | 409 |
| Dejar una pregunta sin contestar | El botón de enviar no se activa; por API, 400 |
| Mandar un valor que no cuadra con el tipo | 400, y **sin haber escrito nada** |
| Entrar como cualquier otro rol | **Ni siquiera se hace la llamada.** La consola, limpia |
| Ver resultados | Escala y sí/no en gráfica, texto/fecha/hora en lista. **Sin nombres** |
| **360 px** | Una pregunta por pantalla, botones de 44 px |

---

## 2. Qué se construyó

### Backend

**`modules/representantes/`** — `GET /representantes` · `GET /:id` · `GET /:id/disponibles` · `PUT /:id/hijos` · `PATCH /:id`.

**`modules/encuestas/`** — la gestión (`GET /`, `/tipos`, `/:id`, `POST`, `PATCH`, `PUT /:id/preguntas`, `/finalizar`, `/borrador`, `/publicar`, `/:id/resultados`, `/:id/impacto`, `DELETE`) y **el lado del representante** (`GET /encuestas/mias`, `/mias/:id`, `POST /mias/:id/responder`).

**52 pruebas nuevas** (backend: 437 en total, antes 385).

### Frontend

`api/encuestas.ts`, `api/representantes.ts`, `hooks/useEncuestas.ts`, las páginas `Encuestas` y `Representantes`, y tres componentes: `ConstructorEncuesta`, `ResultadosEncuesta` y `EncuestaPendiente`.

**Borrado:** `components/surveys/` entera (26 archivos, 2 100 líneas) y los **seis** hooks de encuestas. Y de paso, dos dependencias que se quedaron sin usar: **`xlsx`** —el Excel lo genera el backend desde la Fase 13— y **`date-fns-tz`**, con su `lib/datetime.ts` huérfano.

---

## 3. Lo que se arregló del sistema viejo

| Estaba mal | Ahora |
|---|---|
| **El modal obligatorio se montaba en `App.tsx`, fuera de la ruta**, y consultaba `padre`, `encuesta` y `encuesta_respondida` directo a Supabase **en todas las pantallas**: con RLS, cuatro 403 en la consola cada vez que se abría cualquier página. Estaba desmontado desde la Fase 4 por eso | Vive dentro del layout, pregunta una vez al API y **solo si quien mira es representante** |
| **No existía el módulo de Representantes**: se ataban desde la ficha de cada alumno, uno a uno, sin ninguna pantalla donde verlos | Pantalla propia, con sus representados, su sector y cuántas encuestas ha respondido |
| 25 componentes y 6 hooks para un módulo de 4 tablas | Tres componentes y un hook |
| El orden de las preguntas lo recalculaba el navegador al reordenar, y nada impedía repetirlo | **El orden es la posición en la lista**: no puede llegar repetido ni con huecos |
| Una encuesta publicada se podía tocar | No. Cambiar una pregunta a mitad mezclaría respuestas a cosas distintas |
| El modal pintaba las seis preguntas de golpe | Una por pantalla, con avance — el mismo patrón que evaluar alumnos |
| Los resultados cruzaban quién respondió qué | **Anónimos**: quién respondió sigue registrado (hace falta para saber a quién le falta), pero los resultados no lo cruzan |
| No se podía dejar la encuesta para luego: o respondías o no usabas el sistema | "Ahora no, la respondo luego". Obligar de verdad no es una encuesta, es un peaje |

---

## 4. Dos cosas que decidir

**1. Permisos.** Igual que en Asistencias: en `rol_permiso` el módulo `encuestas` **solo tiene la acción `ver`** (Propietario, Coordinador y Admin). Así que `ver` habilita también crear, publicar y borrar. Si quieres separar "mirar encuestas" de "crear y publicar", se conceden las acciones desde Permisos y se cambian unas líneas de `encuestas.routes.ts`.

Lo mismo con Representantes: **no existe** un módulo `representantes` en el catálogo y no me lo inventé. Ver la lista pide `usuarios:ver` y atar representados pide `estudiantes:editar`, que es el permiso que ya pedía el endpoint gemelo en Estudiantes.

**2. Publicar no avisa a nadie.** El sistema viejo tampoco lo hacía: la encuesta le aparece al representante la próxima vez que entra. Mandar un correo al publicar es posible —Supabase Auth ya manda correos— pero es una decisión tuya y tiene infraestructura detrás (plantilla, remitente, qué pasa con los que no tienen correo válido). Dime si lo quieres y lo monto en la Fase 15, junto con las plantillas en español que ya están pendientes.
