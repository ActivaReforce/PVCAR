-- =====================================================================
-- PVCAR — 0019_cuenta_bancaria.sql
-- Los datos de la cuenta a la que se transfiere el pago de la inscripción.
-- Pedido del cliente del 2026-10-05: se escriben en Inscripciones →
-- Documentos → Configuración y se enseñan en el paso Pago del formulario.
--
-- Requiere 0016. Idempotente. Todo en una transacción.
-- =====================================================================

BEGIN;

ALTER TABLE public.inscripcion_config
    ADD COLUMN IF NOT EXISTS inscfg_cuenta_bancaria text;

ALTER TABLE public.inscripcion_config DROP CONSTRAINT IF EXISTS ck_inscfg_cuenta_bancaria;
ALTER TABLE public.inscripcion_config ADD CONSTRAINT ck_inscfg_cuenta_bancaria
    CHECK (inscfg_cuenta_bancaria IS NULL OR length(inscfg_cuenta_bancaria) <= 2000);

COMMENT ON COLUMN public.inscripcion_config.inscfg_cuenta_bancaria IS
    'Texto libre, con saltos de línea: banco, tipo y número de cuenta, titular. Es público: sale en el formulario de inscripción.';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'inscripcion_config'
                      AND column_name = 'inscfg_cuenta_bancaria') THEN
        RAISE EXCEPTION 'No se creó inscfg_cuenta_bancaria';
    END IF;
END $$;

COMMIT;
