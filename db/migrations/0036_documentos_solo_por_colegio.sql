-- =====================================================================
-- PVCAR — 0036_documentos_solo_por_colegio.sql
-- Inscripciones: ficha y contrato, uno por colegio (2026-10-13).
--
-- La 0035 dejaba un texto común con versiones propias opcionales por
-- colegio, y una "vuelta al común". Al cliente le resultó confuso
-- ("parece que hay que llenar cuatro documentos"). Queda así:
--
--   - Cada colegio tiene **su** ficha y **su** contrato (col_id), con sus
--     versiones, y los publica él. Sin publicar, el colegio no abre.
--   - La ficha y el contrato sin colegio (col_id NULL) que ya estaban
--     publicados pasan a ser solo el **texto base**: con él arranca el
--     editor de cada colegio. Ya no los acepta nadie nuevo.
--
-- Sobra la "vuelta al común": se quita la columna. No había ninguna
-- (comprobado por MCP en dev y prod el 2026-10-13); la guarda lo exige.
--
-- Requiere 0035. Idempotente. Todo en una transacción.
-- Igual en dev y en prod.
-- =====================================================================

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'documento_legal'
                  AND column_name = 'doc_usa_comun')
       AND EXISTS (SELECT 1 FROM public.documento_legal WHERE doc_usa_comun) THEN
        RAISE EXCEPTION 'Hay versiones "vuelta al común": revisar antes de quitar la columna';
    END IF;
END $$;

ALTER TABLE public.documento_legal DROP CONSTRAINT IF EXISTS ck_documento_usa_comun;
ALTER TABLE public.documento_legal DROP COLUMN IF EXISTS doc_usa_comun;

COMMENT ON COLUMN public.documento_legal.col_id IS
    'Ficha de matrícula y contrato: el colegio al que pertenecen. Sin colegio, el texto base con el que arranca cada uno.';

COMMIT;
