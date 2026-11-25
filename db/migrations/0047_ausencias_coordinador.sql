-- =====================================================================
-- PVCAR — 0047_ausencias_coordinador.sql
-- Ausencias: aviso también al coordinador del colegio (2026-11-18).
--
--   corcfg_notificar_coordinador — solo cuenta en 'ausencias': los
--                                  coordinadores del colegio del alumno ven
--                                  el aviso de ausencia (y su corrección) en
--                                  Novedades. Sin correo.
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
    'Solo para ausencias: los coordinadores del colegio del alumno ven el aviso de ausencia y su corrección en Novedades (sin correo).';

COMMIT;
