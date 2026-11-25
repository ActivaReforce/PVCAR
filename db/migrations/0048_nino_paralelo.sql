-- =====================================================================
-- PVCAR — 0048_nino_paralelo.sql
-- Paralelo del alumno (2026-11-18).
--
-- En Ecuador cada curso tiene paralelos: "1ero de Básica" A, B, C…
--
--   nino.nino_paralelo — una letra mayúscula (A–Z). NULL en los alumnos que
--                        ya existen: se completa al editarlos o cuando el
--                        representante vuelva a inscribirlos. Desde ahora el
--                        formulario público lo pide (obligatorio); en la
--                        inscripción va dentro de `insnino_datos` (jsonb),
--                        sin columna nueva.
--
-- Solo añade una columna que admite NULL: nada de lo que ya funciona cambia.
-- Idempotente. Todo en una transacción. Igual en dev y en prod.
-- =====================================================================

BEGIN;

ALTER TABLE public.nino
    ADD COLUMN IF NOT EXISTS nino_paralelo text;

ALTER TABLE public.nino
    DROP CONSTRAINT IF EXISTS ck_nino_paralelo;
ALTER TABLE public.nino
    ADD CONSTRAINT ck_nino_paralelo CHECK (nino_paralelo IS NULL OR nino_paralelo ~ '^[A-Z]$');

COMMENT ON COLUMN public.nino.nino_paralelo IS
    'Paralelo del curso: una letra mayúscula (A–Z). NULL en los alumnos anteriores al 2026-11-18.';

COMMIT;
