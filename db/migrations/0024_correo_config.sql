-- =====================================================================
-- PVCAR — 0024_correo_config.sql
-- Quién envía cada tipo de correo y a quién va en copia, editable desde
-- la plataforma por el Propietario (decidido por el cliente el 2026-10-07).
--
-- Una fila por tipo de envío. Hoy solo 'inscripciones'; novedades y
-- ausencias se añaden con sus módulos (ampliando el CHECK de corcfg_tipo).
--
-- El dominio NO se guarda: es la variable CORREO_DOMINIO de Railway,
-- porque Resend solo envía desde dominios verificados. Aquí va solo la
-- parte de antes de la arroba.
--
-- Las copias son CC visibles a propósito: el representante debe ver a
-- quién más le llegó.
--
-- Requiere 0005. Idempotente. Todo en una transacción.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.correo_config (
    corcfg_tipo               text PRIMARY KEY,
    corcfg_nombre             text NOT NULL,
    corcfg_usuario            text NOT NULL,
    corcfg_cc                 text[] NOT NULL DEFAULT '{}',
    corcfg_responder_a        text,
    corcfg_fecha_modificacion timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_corcfg_tipo CHECK (corcfg_tipo IN ('inscripciones')),
    CONSTRAINT ck_corcfg_nombre CHECK (length(btrim(corcfg_nombre)) BETWEEN 1 AND 80),
    CONSTRAINT ck_corcfg_usuario CHECK (corcfg_usuario ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
    CONSTRAINT ck_corcfg_cc CHECK (cardinality(corcfg_cc) <= 10),
    CONSTRAINT ck_corcfg_responder_a CHECK (corcfg_responder_a IS NULL OR length(corcfg_responder_a) <= 254)
);

COMMENT ON TABLE public.correo_config IS
    'Remitente, copias y respuesta de cada tipo de correo de la aplicación. Lo edita el Propietario. El dominio es CORREO_DOMINIO (Railway).';
COMMENT ON COLUMN public.correo_config.corcfg_usuario IS
    'Parte local de la dirección del remitente: "inscripciones" en inscripciones@<CORREO_DOMINIO>.';
COMMENT ON COLUMN public.correo_config.corcfg_cc IS
    'Copias visibles (CC). Como mucho 10.';

INSERT INTO public.correo_config (corcfg_tipo, corcfg_nombre, corcfg_usuario)
VALUES ('inscripciones', 'Inscripcion Activa Reforce', 'inscripciones')
ON CONFLICT (corcfg_tipo) DO NOTHING;

ALTER TABLE public.correo_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correo_config FORCE  ROW LEVEL SECURITY;

REVOKE ALL ON public.correo_config FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.correo_config TO service_role;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.correo_config WHERE corcfg_tipo = 'inscripciones') THEN
        RAISE EXCEPTION 'No quedó la fila de inscripciones en correo_config';
    END IF;
    IF has_table_privilege('anon', 'public.correo_config', 'SELECT') THEN
        RAISE EXCEPTION 'anon puede leer correo_config';
    END IF;
END $$;

COMMIT;
