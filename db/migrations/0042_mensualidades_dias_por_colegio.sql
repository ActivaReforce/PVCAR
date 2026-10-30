-- =====================================================================
-- PVCAR — 0042_mensualidades_dias_por_colegio.sql
-- El día límite de pago y el día de corte, por colegio (cliente,
-- 2026-10-30): la configuración de Mensualidades se hace colegio por
-- colegio, como sus valores.
--
-- Añade las dos columnas a colegio_precio con lo que hoy vale para todos
-- (los de inscripcion_config), así que nada cambia al aplicarla. Las de
-- inscripcion_config se quedan sin uso; se quitan en la limpieza final.
--
-- Requiere 0041. Idempotente. Todo en una transacción. Igual en dev y en
-- prod; en prod, justo después de la 0041.
-- =====================================================================

BEGIN;

ALTER TABLE public.colegio_precio
    ADD COLUMN IF NOT EXISTS colpre_mens_dia_limite smallint,
    ADD COLUMN IF NOT EXISTS colpre_mens_dia_corte  smallint;

UPDATE public.colegio_precio cp
   SET colpre_mens_dia_limite = COALESCE(cp.colpre_mens_dia_limite, c.inscfg_mens_dia_limite),
       colpre_mens_dia_corte  = COALESCE(cp.colpre_mens_dia_corte,  c.inscfg_mens_dia_corte)
  FROM public.inscripcion_config c
 WHERE c.inscfg_id = 1;

ALTER TABLE public.colegio_precio
    ALTER COLUMN colpre_mens_dia_limite SET DEFAULT 10,
    ALTER COLUMN colpre_mens_dia_limite SET NOT NULL,
    ALTER COLUMN colpre_mens_dia_corte  SET DEFAULT 20,
    ALTER COLUMN colpre_mens_dia_corte  SET NOT NULL;

ALTER TABLE public.colegio_precio DROP CONSTRAINT IF EXISTS ck_colpre_mens_dia_limite;
ALTER TABLE public.colegio_precio ADD CONSTRAINT ck_colpre_mens_dia_limite
    CHECK (colpre_mens_dia_limite BETWEEN 1 AND 28);
ALTER TABLE public.colegio_precio DROP CONSTRAINT IF EXISTS ck_colpre_mens_dia_corte;
ALTER TABLE public.colegio_precio ADD CONSTRAINT ck_colpre_mens_dia_corte
    CHECK (colpre_mens_dia_corte BETWEEN 1 AND 28);

COMMENT ON COLUMN public.colegio_precio.colpre_mens_dia_limite IS
    'Día del mes hasta el que se paga la mensualidad en este colegio. Después, atrasada. No bloquea nada.';
COMMENT ON COLUMN public.colegio_precio.colpre_mens_dia_corte IS
    'Una inscripción enviada desde este día (hora de Ecuador) paga el mes siguiente, no el suyo.';
COMMENT ON COLUMN public.inscripcion_config.inscfg_mens_dia_limite IS
    'Sin uso desde la 0042 (pasó a colegio_precio). Se quita en la limpieza final.';
COMMENT ON COLUMN public.inscripcion_config.inscfg_mens_dia_corte IS
    'Sin uso desde la 0042 (pasó a colegio_precio). Se quita en la limpieza final.';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.colegio_precio
                WHERE colpre_mens_dia_limite IS NULL OR colpre_mens_dia_corte IS NULL) THEN
        RAISE EXCEPTION 'Quedó un colegio sin día límite o sin día de corte';
    END IF;
END $$;

COMMIT;
