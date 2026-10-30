# Mensualidades

Pedido del cliente el 2026-10-30. Migraciones `0041_mensualidades.sql`, `0042_mensualidades_dias_por_colegio.sql` y `0043_mensualidades_quitar_dias_generales.sql`. Código en `backend/src/modules/mensualidades` y `frontend/src/components/mensualidades`.

## Qué es

La inscripción paga el primer mes. Desde ahí, cada mes de cada alumno es una **cuota**: el representante la paga desde su cuenta (Inscripciones → Mensualidades) o desde `/inscripcion` → "Pagar mensualidad", con un comprobante, y el personal la aprueba o la rechaza. No se bloquea nada por no pagar.

## Reglas (decididas con el cliente)

| Tema | Regla |
|---|---|
| Primer mes | Lo paga la inscripción. Sale como **"Pagado (Inscripción)"**, también en los reportes. |
| Día de corte | Una inscripción enviada **desde** ese día (hora de Ecuador) paga el mes siguiente: inscrito el 25 de enero, empieza en febrero. Por colegio (por defecto 20). |
| Mes de la cuota | Es el mes que se paga, no la fecha del pago: quien paga abril el 25 de abril está pagando abril, tarde. |
| Meses de cobro | Por colegio. Los meses no marcados quedan **en pausa**. |
| Cobrar desde | Por colegio; el select ofrece de enero del año en curso a diciembre del siguiente. Sin él, el colegio no cobra mensualidades. Lo inscrito antes de ese mes queda pagado ese mes por la inscripción (lo de prod: noviembre 2026). |
| Día límite | Por colegio (por defecto 10). Pasado ese día, el mes sin pagar sale **atrasado**. Los meses anteriores sin pagar, también. No se bloquea nada. |
| Adelantado | No: se paga el mes en curso y los que se deben. |
| Varios hijos | Casilla por mes y por hijo, agrupados por colegio; el total cambia al marcar. Un solo comprobante por todo lo marcado. |
| Descuento de hermano | El importe de cada hijo se calcula con **toda la familia** (la misma regla de la inscripción), no con lo marcado: desmarcar a un hijo resta exactamente lo suyo. Familia = alumnos unidos por algún representante en común. |
| Disciplina añadida | El mes en que entra por inscripción, esa disciplina la pagó la inscripción: la cuota de ese mes cobra solo las demás, con su parte proporcional. |
| Alta a mano | Una disciplina dada de alta desde Estudiantes (sin inscripción) cobra desde su primer mes, con el mismo día de corte. |
| Rechazo | El personal escribe el motivo. Desaparece de su lista; el representante ve el motivo y **"Volver a intentar"**, que lo borra del todo (con el comprobante) y deja esos meses por pagar otra vez. |
| Factura | No: solo se lleva el registro. |

## Qué se guarda

- **Lo que se debe no se guarda:** se calcula cada vez (`mensualidades.calculo.ts`, puro y con tests) con las disciplinas activas, la configuración de cada colegio y lo ya pagado. Cambiar la configuración cambia lo que se debe desde ese momento.
- **Lo pagado sí, congelado:** `mensualidad_pago` (un comprobante: estado, totales, copia del detalle, motivo) y `mensualidad_cuota` (un mes de un alumno, con disciplinas e importes). Un mes de un alumno se paga una sola vez (índice único). Borrar un alumno no borra su contabilidad (`SET NULL`, con el nombre copiado).
- Configuración (Inscripciones → Configuración → Mensualidades, colegio por colegio): `colegio_precio.colpre_mens_dia_limite`, `colpre_mens_dia_corte` (0042), `colpre_meses_cobro`, `colpre_cobro_desde` (0041). General: `inscripcion_config.inscfg_mens_recordatorio`. Las `inscfg_mens_dia_*` de la 0041 se quitan en la 0043.

## Permisos

- El representante paga y ve lo suyo sin casilla (su cuenta ya es el alcance). La `0041` le da **Ver** en Inscripciones para que el módulo le salga en el menú.
- El personal (Propietario y Admin), con la casilla de Inscripciones: Ver = lista y estado del mes; Editar = aprobar y configurar; Eliminar = rechazar.

## Pendiente

1. Reportes → Inscripciones → pestaña **Mensualidades** (pantalla y Excel).
2. **Recordatorio por correo** (interruptor en Configuración; la columna y el remitente `mensualidades` de `correo_config` ya están en la `0041`).
3. Cambiar de disciplina desde aquí: el cliente aún no decide.
