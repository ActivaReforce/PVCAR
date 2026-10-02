-- =====================================================================
-- PVCAR — 0015_inscripciones_precios.sql
-- Precios por colegio con descuento por hermanos, y borradores de los
-- documentos legales. Segunda migración de la Fase 14B.
--
-- Requiere 0014 aplicada. Idempotente. Todo en una transacción.
-- **Solo añade**: el código desplegado sigue funcionando con ella.
--
-- ---------------------------------------------------------------------
-- Qué hace
--
-- 1. `colegio_precio`: lo que cuesta inscribirse en una disciplina de un
--    colegio (todas cuestan lo mismo dentro del colegio), el descuento
--    por hermano en porcentaje, y si ese descuento cubre todas las
--    disciplinas del hermano o solo la primera. Un colegio sin fila aquí
--    no aparece en el formulario público.
-- 2. `documento_legal.doc_publicado`: una versión nace en **borrador**
--    (se puede editar y borrar) y se **publica** (desde ahí no cambia
--    nunca). La vigente es la publicada de número más alto. El trigger
--    de 0014 pasa a proteger solo las publicadas.
-- 3. `inscripcion.ins_total` e `inscripcion_nino.insnino_precio`: lo que
--    se cobró, calculado por el backend al recibir el envío y congelado,
--    igual que el contrato.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Precios
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.colegio_precio (
    col_id                    integer      PRIMARY KEY REFERENCES public.colegio(col_id) ON DELETE CASCADE,
    colpre_precio_disciplina  numeric(10,2) NOT NULL,
    colpre_descuento_hermano  numeric(5,2)  NOT NULL DEFAULT 0,
    colpre_descuento_solo_primera boolean   NOT NULL DEFAULT false,
    colpre_fecha_modificacion timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_colpre_precio    CHECK (colpre_precio_disciplina > 0),
    CONSTRAINT ck_colpre_descuento CHECK (colpre_descuento_hermano >= 0 AND colpre_descuento_hermano <= 100)
);

COMMENT ON TABLE public.colegio_precio IS
    'Precio por disciplina en cada colegio y descuento por hermano (porcentaje). Sin fila, el colegio no se ofrece en el formulario público.';
COMMENT ON COLUMN public.colegio_precio.colpre_descuento_solo_primera IS
    'true: el descuento del hermano solo se aplica a su primera disciplina. false: a todas.';

-- ---------------------------------------------------------------------
-- 2. Borradores de documentos legales
-- ---------------------------------------------------------------------
ALTER TABLE public.documento_legal ADD COLUMN IF NOT EXISTS doc_publicado timestamptz;

-- Un solo borrador por tipo: es "la próxima versión", no una pila.
CREATE UNIQUE INDEX IF NOT EXISTS uq_documento_un_borrador
    ON public.documento_legal (doc_tipo) WHERE doc_publicado IS NULL;

CREATE OR REPLACE FUNCTION public.documento_legal_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF OLD.doc_publicado IS NOT NULL THEN
        RAISE EXCEPTION 'Un documento publicado no se modifica: crear una versión nueva (doc_tipo %, versión %).',
            OLD.doc_tipo, OLD.doc_version;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documento_legal_inmutable ON public.documento_legal;
CREATE TRIGGER trg_documento_legal_inmutable
    BEFORE UPDATE OR DELETE ON public.documento_legal
    FOR EACH ROW EXECUTE FUNCTION public.documento_legal_inmutable();

REVOKE EXECUTE ON FUNCTION public.documento_legal_inmutable() FROM PUBLIC, anon, authenticated;

-- Lo que hubiera de 0014 ya se veía en el formulario: queda publicado.
-- Va después del trigger nuevo: el de 0014 prohibía cualquier UPDATE.
UPDATE public.documento_legal SET doc_publicado = doc_fecha WHERE doc_publicado IS NULL;

-- ---------------------------------------------------------------------
-- 3. Lo cobrado, congelado en la inscripción
-- ---------------------------------------------------------------------
ALTER TABLE public.inscripcion      ADD COLUMN IF NOT EXISTS ins_total numeric(10,2);
ALTER TABLE public.inscripcion_nino ADD COLUMN IF NOT EXISTS insnino_precio jsonb;

-- ---------------------------------------------------------------------
-- Seguridad de la tabla nueva, como las demás.
-- ---------------------------------------------------------------------
ALTER TABLE public.colegio_precio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colegio_precio FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON public.colegio_precio FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.colegio_precio TO service_role;

-- ---------------------------------------------------------------------
-- Guarda de salida
-- ---------------------------------------------------------------------
DO $$
DECLARE
    columnas  int;
    rls       boolean;
    expuesta  boolean;
    disparos  text;
BEGIN
    SELECT count(*) INTO columnas
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name::text, column_name::text) IN (('documento_legal', 'doc_publicado'),
                                                    ('inscripcion', 'ins_total'),
                                                    ('inscripcion_nino', 'insnino_precio'));

    SELECT relrowsecurity AND relforcerowsecurity INTO rls
    FROM pg_class WHERE oid = 'public.colegio_precio'::regclass;

    SELECT has_table_privilege('anon', 'public.colegio_precio', 'SELECT')
        OR has_table_privilege('authenticated', 'public.colegio_precio', 'SELECT')
      INTO expuesta;

    -- tgtype: bit 8 = DELETE, bit 16 = UPDATE.
    SELECT CASE WHEN (tgtype & 24) = 24 THEN 'DELETE,UPDATE' ELSE tgtype::text END INTO disparos
    FROM pg_trigger
    WHERE tgrelid = 'public.documento_legal'::regclass
      AND tgname = 'trg_documento_legal_inmutable';

    IF columnas <> 3 THEN
        RAISE EXCEPTION 'Esperaba 3 columnas nuevas, hay %', columnas;
    END IF;
    IF NOT rls THEN
        RAISE EXCEPTION 'colegio_precio quedó sin RLS forzado';
    END IF;
    IF expuesta THEN
        RAISE EXCEPTION 'colegio_precio quedó abierta a anon o authenticated';
    END IF;
    IF disparos IS DISTINCT FROM 'DELETE,UPDATE' THEN
        RAISE EXCEPTION 'El trigger de documentos debería cubrir UPDATE y DELETE y cubre %', disparos;
    END IF;
END $$;

COMMIT;
