-- =====================================================================
-- PVCAR — 0037_asignacion_sin_baja_al_nacer.sql
-- nino_asignacion.ninoasig_fecha_baja deja de nacer rellena (2026-10-14).
--
-- Venía de la base vieja con DEFAULT now() (anotado como pendiente en la
-- 0001, punto 1): toda asignación nueva, también las que crea aprobar una
-- inscripción, quedaba con una "baja" a la misma hora en que se inscribió.
-- El reporte histórico de alumnos la enseña como fecha de baja. Las bajas
-- de verdad ya ponen la fecha a mano (SET est_id = 2, fecha_baja = now()).
--
-- Se quita el default y se vacía la fecha en las asignaciones activas.
-- Idempotente. Igual en dev y en prod; se puede correr en cualquier momento.
-- =====================================================================

BEGIN;

ALTER TABLE public.nino_asignacion ALTER COLUMN ninoasig_fecha_baja DROP DEFAULT;

UPDATE public.nino_asignacion
   SET ninoasig_fecha_baja = NULL
 WHERE est_id = 1
   AND ninoasig_fecha_baja IS NOT NULL;

COMMIT;
