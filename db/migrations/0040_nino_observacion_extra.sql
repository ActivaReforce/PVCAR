-- =====================================================================
-- PVCAR — 0040_nino_observacion_extra.sql
-- Observaciones extra de cada alumno (2026-10-20).
--
-- El representante puede escribir, por alumno, una observación libre al
-- inscribirlo. Va en el jsonb de la inscripción (no necesita columna) y,
-- al aprobar, pasa a esta columna del alumno. En Estudiantes la ve quien
-- ve la ficha y la edita el Propietario.
--
-- Solo añade una columna, nula en todos los alumnos que ya existen: nada
-- cambia al aplicarla. El código nuevo la lee, así que en cada base se
-- corre **antes** de que llegue el código (dev ya; prod antes del merge).
-- Idempotente. Igual en dev y en prod.
-- =====================================================================

BEGIN;

ALTER TABLE public.nino
    ADD COLUMN IF NOT EXISTS nino_observacion_extra text;

ALTER TABLE public.nino
    DROP CONSTRAINT IF EXISTS ck_nino_observacion_extra;
ALTER TABLE public.nino
    ADD CONSTRAINT ck_nino_observacion_extra CHECK (
        nino_observacion_extra IS NULL
        OR (length(btrim(nino_observacion_extra)) > 0 AND length(nino_observacion_extra) <= 2000)
    );

COMMENT ON COLUMN public.nino.nino_observacion_extra IS
    'Observación libre del alumno: la del representante al inscribirlo o la que pone el Propietario. Nula = ninguna.';

COMMIT;
