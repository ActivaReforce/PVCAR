-- =====================================================================
-- PVCAR — 0009_asignacion_activa_unica.sql
-- Un entrenador no puede tener dos veces abierta la misma disciplina.
-- Migración de la Fase 9.
--
-- Requiere 0001-0008 aplicados. Va en PVCAR_Dev y en PVCAR.
-- Idempotente. Todo en una transacción.
--
-- ---------------------------------------------------------------------
-- Por qué es PARCIAL
--
-- Las asignaciones son historia, no estado: quitarle una disciplina a un
-- entrenador no borra la fila, le pone `entasig_fecha_fin`. Por eso el
-- mismo par (entrenador, disciplina) puede repetirse legítimamente — en
-- los datos reales hay un caso: Erika tuvo la disciplina 74 del 3 al 27
-- de octubre, se cerró, y ese mismo día se volvió a abrir.
--
-- Lo que no puede haber es **dos abiertas a la vez**. De ahí el índice
-- parcial sobre las filas con `entasig_fecha_fin IS NULL`: permite todo
-- el histórico que haga falta y solo impide el duplicado vivo.
--
-- ---------------------------------------------------------------------
-- Lo que NO se restringe, a propósito
--
-- "Una disciplina, un entrenador" se comprueba en el backend (y se puede
-- saltar a conciencia con `reemplazar`, que cierra al anterior en la
-- misma transacción), pero no se fija aquí: el modelo admite varios
-- entrenadores en una disciplina y no hay ninguna regla de negocio
-- escrita que lo prohíba para siempre. Hoy no ocurre en ningún caso.
--
-- ---------------------------------------------------------------------
-- Seguro para los datos reales
--
-- Medido el 2026-09-16: en el respaldo de producción del 2026-07-27 hay
-- **80 asignaciones abiertas y 0 pares repetidos** entre ellas; en
-- PVCAR_Dev, las mismas 80 y 0 repetidos (119 filas en total, 39
-- cerradas). El índice no rebota nada.
-- =====================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS entrenador_asignacion_activa_unica_idx
    ON public.entrenador_asignacion (ent_id, colacthor_id)
    WHERE entasig_fecha_fin IS NULL;

COMMENT ON INDEX public.entrenador_asignacion_activa_unica_idx IS
    'Una sola asignación abierta por (entrenador, disciplina). El histórico cerrado puede repetirse. Fase 9.';

COMMIT;
