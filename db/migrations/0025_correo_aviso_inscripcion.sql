-- =====================================================================
-- PVCAR — 0025_correo_aviso_inscripcion.sql
-- Aviso interno de inscripción nueva (pedido del cliente, 2026-10-07).
--
-- Cuando un representante envía la inscripción, sale un correo a una
-- lista fija de personas del equipo, con el resumen y los PDF. Es otra
-- fila de correo_config, 'inscripciones_aviso', y por eso la tabla gana
-- la columna corcfg_para: la lista fija de destinatarios. La fila de
-- 'inscripciones' (aprobada) no la usa: su destinatario es el
-- representante.
--
-- Requiere 0024. Idempotente. Todo en una transacción.
-- =====================================================================

BEGIN;

ALTER TABLE public.correo_config
    ADD COLUMN IF NOT EXISTS corcfg_para text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.correo_config DROP CONSTRAINT IF EXISTS ck_corcfg_para;
ALTER TABLE public.correo_config ADD CONSTRAINT ck_corcfg_para
    CHECK (cardinality(corcfg_para) <= 10);

ALTER TABLE public.correo_config DROP CONSTRAINT IF EXISTS ck_corcfg_tipo;
ALTER TABLE public.correo_config ADD CONSTRAINT ck_corcfg_tipo
    CHECK (corcfg_tipo IN ('inscripciones', 'inscripciones_aviso'));

COMMENT ON COLUMN public.correo_config.corcfg_para IS
    'Destinatarios fijos, como mucho 10. Solo para avisos internos; vacío = el aviso no sale.';

INSERT INTO public.correo_config (corcfg_tipo, corcfg_nombre, corcfg_usuario)
VALUES ('inscripciones_aviso', 'Inscripcion Activa Reforce', 'inscripciones')
ON CONFLICT (corcfg_tipo) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.correo_config WHERE corcfg_tipo = 'inscripciones_aviso') THEN
        RAISE EXCEPTION 'No quedó la fila de inscripciones_aviso';
    END IF;
END $$;

COMMIT;
