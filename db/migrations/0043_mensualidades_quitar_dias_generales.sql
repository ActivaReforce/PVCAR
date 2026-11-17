-- =====================================================================
-- PVCAR — 0043_mensualidades_quitar_dias_generales.sql
-- Quita inscripcion_config.inscfg_mens_dia_limite e inscfg_mens_dia_corte,
-- sin uso desde la 0042 (los dos días son de cada colegio, en
-- colegio_precio). Sus CHECK se van con ellas. El código no las lee.
--
-- Requiere 0041 y 0042. Idempotente. Todo en una transacción. Igual en dev
-- y en prod; en prod, justo después de la 0042.
-- =====================================================================

BEGIN;

ALTER TABLE public.inscripcion_config
    DROP COLUMN IF EXISTS inscfg_mens_dia_limite,
    DROP COLUMN IF EXISTS inscfg_mens_dia_corte;

-- ---------------------------------------------------------------------
-- Guarda de salida
-- ---------------------------------------------------------------------
DO $$
DECLARE
    viejas int;
    nuevas int;
BEGIN
    SELECT count(*) INTO viejas
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inscripcion_config'
      AND column_name IN ('inscfg_mens_dia_limite', 'inscfg_mens_dia_corte');
    IF viejas > 0 THEN
        RAISE EXCEPTION 'Siguen % columna(s) de días generales', viejas;
    END IF;

    SELECT count(*) INTO nuevas
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'colegio_precio'
      AND column_name IN ('colpre_mens_dia_limite', 'colpre_mens_dia_corte');
    IF nuevas <> 2 THEN
        RAISE EXCEPTION 'Faltan los días por colegio de la 0042 (hay % de 2)', nuevas;
    END IF;
END $$;

COMMIT;
