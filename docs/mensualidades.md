# Mensualidades

Pedido del cliente el 2026-10-30; segunda vuelta el 2026-11-16 (respuestas de Activa Reforce: entrega el jueves 26 de noviembre). Migraciones `0041_mensualidades.sql`, `0042_mensualidades_dias_por_colegio.sql`, `0043_mensualidades_quitar_dias_generales.sql` y `0044_mensualidades_por_anio.sql`. Código en `backend/src/modules/mensualidades` y `frontend/src/components/mensualidades`.

## Qué es

No hay costo de inscripción: la inscripción es el pago del primer mes. Desde ahí, cada mes de cada alumno es una **cuota**: el representante la paga desde su cuenta (Inscripciones → Mensualidades) o desde `/inscripcion` → "Pagar mensualidad", con un comprobante, y el personal la aprueba o la rechaza. El 26 de noviembre de 2026 se abre el pago de diciembre: tiene que estar en producción antes.

## Reglas (decididas con el cliente)

| Tema | Regla |
|---|---|
| Primer mes | Lo paga la inscripción. En el formulario el representante elige **en qué mes empieza**: el en curso o el siguiente (`ins_mes_inicio`, 0044). Si elige diciembre, noviembre no se cobra. Sale como **"Pagado (Inscripción)"**. Todo lo inscrito antes de la 0044 (octubre y noviembre de 2026) es el pago de **noviembre de 2026**. |
| Meses de cobro | Por colegio y **con año** (`colpre_meses`, 0044). La pantalla enseña el año en curso con su etiqueta y el botón **"Abrir siguiente año"**; al empezar el año nuevo, ese pasa a ser el principal. Los meses no marcados quedan **en pausa**. Lo de años pasados se conserva. Sin meses marcados, el colegio no cobra. |
| Mes de la cuota | Es el mes que se paga, no la fecha del pago. |
| Día límite | Por colegio (por defecto **5**, lo del contrato). Pasado ese día, el mes sin pagar sale **atrasado**; los meses anteriores sin pagar, también. Se puede pagar después, sin recargo: el pago está **siempre abierto**. |
| Por adelantado | Sí: el representante ve todos los meses marcados de su colegio (año en curso y el siguiente si está abierto) y elige los que quiera, con **un solo comprobante**. **En orden**: no puede elegir enero si diciembre sigue por pagar (sale el aviso "Primero selecciona Diciembre…"); quitar un mes quita los siguientes. El servidor lo exige igual, por hijo. Al abrir no hay nada elegido. |
| Atraso → Asistencias | El alumno que debe un mes vencido el día de la clase sale **Ausente sin poder cambiarlo**, con "Pago de mensualidad pendiente (dic)" en su tarjeta. Al guardar se crea una novedad y se manda un **correo distinto** (título "Mensualidad pendiente", meses que debe, enlace para pagar), que va **siempre** al representante. Uno cada vez que se guarda la lista con él ausente. Se mira con lo pagado **hoy**: en cuanto se aprueba el pago, esos días se pueden volver a editar (dentro de los 7 días de siempre). Un pago **en revisión no bloquea**. Vale para todos (entrenador y personal). |
| Dinero por mes | Por **fecha de pago** (caja): quien paga $300 el 16 de noviembre por diciembre, enero y febrero suma $300 en noviembre ("incluye dic, ene y feb"), y en diciembre, enero y febrero sale **Pagado · $0 · pagado el 16/11/2026**. La fecha es la del envío del comprobante, no la de la aprobación. |
| Cambiar de disciplina | **No** desde aquí: el contrato pide una solicitud y un contrato nuevo, cada trimestre. |
| Varios hijos | Casilla por mes y por hijo, agrupados por colegio; el total cambia al marcar. |
| Descuento de hermano | 20 % todos los meses (la regla de la inscripción). El importe de cada hijo se calcula con **toda la familia**, no con lo marcado: desmarcar a un hijo resta exactamente lo suyo. Familia = alumnos unidos por algún representante en común. |
| Disciplina añadida | El mes que paga su inscripción, esa disciplina está pagada: la cuota de ese mes cobra solo las demás, con su parte proporcional. Si ese mes o los siguientes ya estaban pagados por adelantado, quedan como estaban: la diferencia se cobra aparte. |
| Alta a mano | Una disciplina dada de alta desde Estudiantes (sin inscripción) cobra desde el mes del alta. |
| Precio | Lo pagado queda con su precio; los meses sin pagar toman el precio vigente. |
| Baja con meses adelantados | Esos meses siguen como pagados; la devolución va fuera de la plataforma. |
| Rechazo | El personal escribe el motivo. Desaparece de su lista; el representante ve el motivo y **"Volver a intentar"**, que lo borra del todo (con el comprobante) y deja esos meses por pagar otra vez. |
| Factura | No: solo se lleva el registro. |

## Pantallas

- **Menú lateral:** punto rojo **sin número** en Inscripciones si hay alguna inscripción o algún pago de mensualidad por revisar. Solo Propietario. Se refresca cada minuto.
- **/inscripciones:** el número rojo va en cada pestaña (Inscripciones y Mensualidades).
- **Pagar mensualidad (representante), en tres pasos:** 1) elegir el mes o los meses (los que se deben y, de este mes en adelante, también los pagados o en revisión, con su etiqueta y sin poder elegirlos); 2) una tarjeta por hijo con los meses elegidos, estado y precio, cada mes con su casilla (diciembre para los dos hijos y enero solo para uno, en un mismo pago), todo marcado al empezar y en orden por hijo; 3) total a pagar con el desglose "Mensualidad diciembre 2026 … $X" por mes, la cuenta y un solo comprobante.
- **Pestaña Mensualidades (personal):** pagos por revisar o aprobados (buscador, colegio, estado) y debajo **Estado del mes**, solo lectura: por defecto el mes en curso; se elige entre enero del año pasado y diciembre del siguiente (cambia solo con el año); su select de colegio es independiente del de arriba. Totales por colegio: recaudado en el mes, en revisión, por cobrar de ese mes, alumnos.
- **Configuración → Mensualidades:** colegio; Valores (día límite); Meses de cobro (año en curso con etiqueta, "Abrir siguiente año").
- **Reportes → Mensualidades** (solo Propietario): una fila por mes pagado con la fecha del pago; filtros de fecha de pago, colegio y estado; Excel con Resumen (totales, por mes en que se pagó, por mes pagado, por colegio).

## Qué se guarda

- **Lo que se debe no se guarda:** se calcula cada vez (`mensualidades.calculo.ts`, puro y con tests) con las disciplinas activas, la configuración de cada colegio y lo ya pagado. Cambiar la configuración cambia lo que se debe desde ese momento.
- **Lo pagado sí, congelado:** `mensualidad_pago` (un comprobante: estado, totales, copia del detalle, motivo, fecha de envío) y `mensualidad_cuota` (un mes de un alumno, con disciplinas e importes). Un mes de un alumno se paga una sola vez (índice único). Borrar un alumno no borra su contabilidad (`SET NULL`, con el nombre copiado).
- Configuración: `colegio_precio.colpre_meses` (0044) y `colpre_mens_dia_limite` (0042). General: `inscripcion_config.inscfg_mens_recordatorio` (sin uso todavía). `inscripcion.ins_mes_inicio` (0044).
- La novedad de mensualidad es una `ausencia` con `nov_datos.mensualidad` = meses que debe.

## Permisos

- El representante paga y ve lo suyo sin casilla (su cuenta ya es el alcance). La `0041` le da **Ver** en Inscripciones para que el módulo le salga en el menú.
- El personal (Propietario y Admin), con la casilla de Inscripciones: Ver = lista y estado del mes; Editar = aprobar y configurar; Eliminar = rechazar. El reporte, solo Propietario.

## Pendiente

1. **Recordatorio por correo** antes del día límite (interruptor en Configuración; la columna y el remitente `mensualidades` de `correo_config` ya están en la `0041`). No pedido para el 26.
