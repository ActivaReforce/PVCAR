-- =====================================================================
-- PVCAR — 0018_inscripciones_abiertas.sql
-- Abrir y cerrar las inscripciones: en general y por colegio.
-- Pedido del cliente del 2026-10-05.
--
-- Requiere 0016. Idempotente. Todo en una transacción.
--
-- Las inscripciones están abiertas si el interruptor general está
-- encendido, los cuatro documentos generales están publicados y al menos
-- un colegio está abierto. Un colegio está abierto si su interruptor está
-- encendido, la ficha y el contrato están publicados, tiene sus valores y
-- al menos una disciplina activa. Las reglas las aplica el backend; aquí
-- solo se guardan los dos interruptores, apagados al empezar.
--
-- De paso borra `inscripcion_config.inscfg_iva_pct`: el IVA es siempre
-- 15 % (decisión del cliente) y el código ya no lo lee.
-- =====================================================================

BEGIN;

ALTER TABLE public.inscripcion_config
    ADD COLUMN IF NOT EXISTS inscfg_abiertas boolean NOT NULL DEFAULT false;

ALTER TABLE public.inscripcion_config
    DROP CONSTRAINT IF EXISTS ck_inscfg_iva,
    DROP COLUMN IF EXISTS inscfg_iva_pct;

ALTER TABLE public.colegio_precio
    ADD COLUMN IF NOT EXISTS colpre_inscripciones_abiertas boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.inscripcion_config.inscfg_abiertas IS
    'Interruptor general. Abiertas de verdad solo si además están los documentos generales y algún colegio abierto.';
COMMENT ON COLUMN public.colegio_precio.colpre_inscripciones_abiertas IS
    'Interruptor del colegio. Abierto de verdad solo si además están la ficha y el contrato publicados y tiene disciplinas activas.';

DO $$
DECLARE
    columnas int;
    iva      int;
BEGIN
    SELECT count(*) INTO columnas
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name::text, column_name::text) IN (('inscripcion_config', 'inscfg_abiertas'),
                                                    ('colegio_precio', 'colpre_inscripciones_abiertas'));
    SELECT count(*) INTO iva
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inscripcion_config' AND column_name = 'inscfg_iva_pct';

    IF columnas <> 2 THEN RAISE EXCEPTION 'Esperaba 2 columnas nuevas, hay %', columnas; END IF;
    IF iva <> 0 THEN RAISE EXCEPTION 'inscfg_iva_pct sigue ahí'; END IF;
END $$;

COMMIT;
