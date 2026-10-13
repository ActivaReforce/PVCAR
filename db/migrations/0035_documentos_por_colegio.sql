-- =====================================================================
-- PVCAR — 0035_documentos_por_colegio.sql
-- Inscripciones: ficha de matrícula y contrato propios de un colegio
-- (pedido del cliente, 2026-10-12).
--
-- Hasta aquí la ficha y el contrato eran un texto común para todos los
-- colegios, con los datos de cada uno por marcadores. Sigue siendo así por
-- defecto; ahora un colegio puede tener **su propia** versión de cualquiera
-- de los dos, que solo vale para quien se inscriba en ese colegio.
--
--   col_id NULL      → el texto común (como hasta ahora).
--   col_id = colegio → un texto de ese colegio, con sus propias versiones
--                      (borrador, publicada, inmutable, igual que el común).
--   doc_usa_comun    → una versión de ese colegio que dice "desde aquí,
--                      vuelve al texto común". Queda en su historial.
--
-- Qué texto usa un colegio: su última versión publicada propia, salvo que
-- sea una vuelta al común; si no tiene ninguna, el común.
--
-- Borrar un colegio: sus versiones publicadas lo impiden (son historia que
-- otros aceptaron; el trigger de 0015 tampoco deja borrarlas). La FK es
-- RESTRICT y el recuento previo del borrado lo dice.
--
-- Requiere 0016. Idempotente. Todo en una transacción.
-- Igual en dev y en prod.
-- =====================================================================

BEGIN;

ALTER TABLE public.documento_legal
    ADD COLUMN IF NOT EXISTS col_id        integer REFERENCES public.colegio(col_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS doc_usa_comun boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.documento_legal.col_id IS
    'NULL = texto común. Con colegio: versión propia de ese colegio (solo ficha de matrícula y contrato).';
COMMENT ON COLUMN public.documento_legal.doc_usa_comun IS
    'Versión de un colegio que vuelve al texto común. Sin texto propio.';

ALTER TABLE public.documento_legal DROP CONSTRAINT IF EXISTS ck_documento_colegio;
ALTER TABLE public.documento_legal ADD CONSTRAINT ck_documento_colegio
    CHECK (col_id IS NULL OR doc_tipo IN ('ficha_matricula', 'contrato'));

ALTER TABLE public.documento_legal DROP CONSTRAINT IF EXISTS ck_documento_usa_comun;
ALTER TABLE public.documento_legal ADD CONSTRAINT ck_documento_usa_comun
    CHECK (NOT doc_usa_comun OR col_id IS NOT NULL);

-- Las versiones se numeran por tipo **y colegio**.
ALTER TABLE public.documento_legal DROP CONSTRAINT IF EXISTS uq_documento_tipo_version;
CREATE UNIQUE INDEX IF NOT EXISTS uq_documento_tipo_colegio_version
    ON public.documento_legal (doc_tipo, COALESCE(col_id, 0), doc_version);

-- Un solo borrador por tipo y colegio (el común cuenta como uno más).
DROP INDEX IF EXISTS public.uq_documento_un_borrador;
CREATE UNIQUE INDEX IF NOT EXISTS uq_documento_un_borrador
    ON public.documento_legal (doc_tipo, COALESCE(col_id, 0)) WHERE doc_publicado IS NULL;

CREATE INDEX IF NOT EXISTS ix_documento_colegio
    ON public.documento_legal (col_id) WHERE col_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'documento_legal'
                      AND column_name = 'col_id') THEN
        RAISE EXCEPTION 'No quedó la columna col_id';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_documento_tipo_version') THEN
        RAISE EXCEPTION 'Sigue la unicidad vieja por tipo y versión';
    END IF;
END $$;

COMMIT;
