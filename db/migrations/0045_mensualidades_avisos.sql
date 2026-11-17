-- =====================================================================
-- PVCAR — 0045_mensualidades_avisos.sql
-- Avisos de Mensualidades (cliente, 2026-11-16).
--
-- 1. Dos correos nuevos en correo_config:
--    - 'mensualidades_aviso': cuando un representante envía un pago, a la
--      lista del equipo. Con corcfg_notificar_representante (apagado), al
--      aprobarlo le llega un correo al representante.
--    - 'mensualidades_atrasadas': el resumen de atrasados del mes, a una
--      lista (p. ej. el gerente). Nunca al representante.
-- 2. Novedad de tipo 'mensualidad': la que se crea sola el día siguiente al
--    día límite con todos los atrasados. La ven solo Propietario y Admin.
--    Su texto puede ser largo (una línea por alumno): hasta 20 000.
-- 3. mensualidad_aviso_atraso: qué colegio y qué mes ya avisó, para que el
--    aviso salga una sola vez aunque el servidor se reinicie.
--
-- Solo añade: nada cambia al aplicarla. Requiere 0001-0044. Idempotente.
-- Todo en una transacción. Igual en dev y en prod.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Correos
-- ---------------------------------------------------------------------
ALTER TABLE public.correo_config DROP CONSTRAINT IF EXISTS ck_corcfg_tipo;
ALTER TABLE public.correo_config ADD CONSTRAINT ck_corcfg_tipo
    CHECK (corcfg_tipo IN ('inscripciones', 'inscripciones_aviso', 'novedades', 'ausencias', 'mensualidades',
                           'mensualidades_aviso', 'mensualidades_atrasadas'));

INSERT INTO public.correo_config (corcfg_tipo, corcfg_nombre, corcfg_usuario)
VALUES ('mensualidades_aviso', 'Mensualidades Activa Reforce', 'inscripciones'),
       ('mensualidades_atrasadas', 'Mensualidades Activa Reforce', 'inscripciones')
ON CONFLICT (corcfg_tipo) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. Novedad 'mensualidad'
-- ---------------------------------------------------------------------
ALTER TABLE public.novedad DROP CONSTRAINT IF EXISTS ck_nov_tipo;
ALTER TABLE public.novedad ADD CONSTRAINT ck_nov_tipo
    CHECK (nov_tipo IN ('general', 'personal', 'representante', 'alumno', 'ausencia', 'correccion', 'mensualidad'));

ALTER TABLE public.novedad DROP CONSTRAINT IF EXISTS ck_nov_texto;
ALTER TABLE public.novedad ADD CONSTRAINT ck_nov_texto CHECK (
    length(btrim(nov_texto)) >= 1
    AND length(nov_texto) <= CASE WHEN nov_tipo = 'mensualidad' THEN 20000 ELSE 1000 END
);

-- ---------------------------------------------------------------------
-- 3. Avisos de atraso ya hechos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mensualidad_aviso_atraso (
    col_id      integer     NOT NULL REFERENCES public.colegio(col_id) ON DELETE CASCADE,
    -- El mes del aviso (día 1).
    menavi_mes  date        NOT NULL,
    menavi_fecha timestamptz NOT NULL DEFAULT now(),
    -- La novedad creada; nula si ese mes no había atrasados.
    nov_id      integer     REFERENCES public.novedad(nov_id) ON DELETE SET NULL,
    PRIMARY KEY (col_id, menavi_mes),
    CONSTRAINT ck_menavi_mes CHECK (extract(day FROM menavi_mes) = 1)
);

COMMENT ON TABLE public.mensualidad_aviso_atraso IS
    'Colegio y mes cuyo aviso de mensualidades atrasadas ya salió (novedad y correo): una sola vez.';

ALTER TABLE public.mensualidad_aviso_atraso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensualidad_aviso_atraso FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON public.mensualidad_aviso_atraso FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensualidad_aviso_atraso TO service_role;

-- ---------------------------------------------------------------------
-- Guarda de salida
-- ---------------------------------------------------------------------
DO $$
DECLARE
    correos int;
BEGIN
    SELECT count(*) INTO correos FROM public.correo_config
     WHERE corcfg_tipo IN ('mensualidades_aviso', 'mensualidades_atrasadas');
    IF correos <> 2 THEN
        RAISE EXCEPTION 'Faltan las filas de correo de mensualidades (hay % de 2)', correos;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'mensualidad_aviso_atraso'
                  AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)) THEN
        RAISE EXCEPTION 'mensualidad_aviso_atraso sin RLS';
    END IF;

    IF has_table_privilege('anon', 'public.mensualidad_aviso_atraso', 'SELECT')
       OR has_table_privilege('authenticated', 'public.mensualidad_aviso_atraso', 'SELECT') THEN
        RAISE EXCEPTION 'mensualidad_aviso_atraso legible por anon o authenticated';
    END IF;
END $$;

COMMIT;
