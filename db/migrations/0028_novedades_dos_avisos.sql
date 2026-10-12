-- =====================================================================
-- PVCAR — 0028_novedades_dos_avisos.sql
-- Novedades: el switch "notificar también" se parte en dos (2026-10-12).
--
--   corcfg_notificar_mencionado     — las novedades sobre personal avisan
--                                     también al mencionado (y él las ve).
--   corcfg_notificar_representante  — nueva: las novedades sobre un alumno
--                                     avisan también al representante (y él
--                                     las ve).
--
-- La columna nueva arranca con el valor que tenía el switch único, para que
-- nada cambie de comportamiento al aplicarla. Solo se copia la primera vez:
-- si la columna ya existe no se toca.
--
-- Requiere 0027. Idempotente. Todo en una transacción.
-- Igual en dev y en prod.
-- =====================================================================

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name   = 'correo_config'
           AND column_name  = 'corcfg_notificar_representante'
    ) THEN
        ALTER TABLE public.correo_config
            ADD COLUMN corcfg_notificar_representante boolean NOT NULL DEFAULT false;

        UPDATE public.correo_config
           SET corcfg_notificar_representante = corcfg_notificar_mencionado;
    END IF;
END $$;

COMMENT ON COLUMN public.correo_config.corcfg_notificar_mencionado IS
    'Solo para novedades: las novedades sobre personal avisan también al mencionado, y él puede verlas.';

COMMENT ON COLUMN public.correo_config.corcfg_notificar_representante IS
    'Solo para novedades: las novedades sobre un alumno avisan también al representante, y él puede verlas.';

COMMIT;
