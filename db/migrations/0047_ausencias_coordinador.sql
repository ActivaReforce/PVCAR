-- =====================================================================
-- PVCAR — 0047_ausencias_coordinador.sql
-- Ausencias: aviso también al coordinador del colegio (2026-11-18).
--
--   corcfg_notificar_coordinador — solo cuenta en 'ausencias': el aviso de
--                                  ausencia (y su corrección) va también por
--                                  correo a los coordinadores del colegio
--                                  del alumno, y ellos lo ven en Novedades.
--
-- Arranca encendida (decisión del cliente). Se salta la 0046, reservada
-- para Comunicados (rama aparte, sin correr).
--
-- Idempotente. Todo en una transacción. Igual en dev y en prod.
-- =====================================================================

BEGIN;

ALTER TABLE public.correo_config
    ADD COLUMN IF NOT EXISTS corcfg_notificar_coordinador boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.correo_config.corcfg_notificar_coordinador IS
    'Solo para ausencias: el aviso de ausencia y su corrección van también a los coordinadores del colegio del alumno, y ellos los ven en Novedades.';

COMMIT;
