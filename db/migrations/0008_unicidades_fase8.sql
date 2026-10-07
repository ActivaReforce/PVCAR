-- =====================================================================
-- PVCAR — 0008_unicidades_fase8.sql
-- Dos cosas que no pueden repetirse. Migración de la Fase 8.
--
-- Requiere 0001-0007 aplicados. Va en PVCAR_Dev y en PVCAR.
-- Idempotente. Todo en una transacción.
--
-- ---------------------------------------------------------------------
-- 1. El nombre de una actividad
--
-- Mismo caso que el del colegio en 0007: el nombre es lo único que se ve
-- en los selectores de Disciplinas, Evaluaciones y Reportes. Dos "Karate"
-- son indistinguibles en pantalla y el error solo aparece cuando alguien
-- crea la disciplina con el equivocado.
--
-- ---------------------------------------------------------------------
-- 2. La disciplina misma
--
-- Una disciplina es colegio + actividad + día + hora de inicio. Nada
-- impedía crear dos veces exactamente la misma, y entonces aparece dos
-- veces en el calendario, dos veces en el selector de inscripciones y
-- las asistencias de esa tarde se reparten entre las dos al azar.
--
-- El índice cubre **todas** las filas, activas y de baja, a propósito: si
-- solo cubriera las activas, se podría crear una copia de una dada de
-- baja y al reactivarla habría dos. Reactivar ya comprueba el hueco en el
-- backend; esto lo respalda en la base.
--
-- ---------------------------------------------------------------------
-- Seguro para los datos reales
--
-- Medido el 2026-09-16 sobre el respaldo de producción del 2026-07-27 y
-- sobre PVCAR_Dev:
--   * nombres de actividad repetidos: 0 en los dos (19 y 20 actividades)
--   * (colegio, actividad, día, hora) repetidos: 0 en los dos (94 filas)
-- Ninguno de los dos índices rebota nada.
--
-- Si alguna vez rebotara, el error nombra la fila que lo impide; se
-- corrige el dato y se vuelve a aplicar.
-- =====================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS actividad_nombre_unico_idx
    ON public.actividad (lower(trim(act_nombre)));

COMMENT ON INDEX public.actividad_nombre_unico_idx IS
    'Una actividad por nombre, sin distinguir mayúsculas ni espacios sobrantes. Fase 8.';

CREATE UNIQUE INDEX IF NOT EXISTS colacthor_unica_idx
    ON public.colegio_actividad_horario (col_id, act_id, dia_id, colacthor_hora_inicio);

COMMENT ON INDEX public.colacthor_unica_idx IS
    'Una disciplina por colegio, actividad, día y hora de inicio. Fase 8.';

COMMIT;
