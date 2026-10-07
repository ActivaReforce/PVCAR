-- =====================================================================
-- PVCAR — 0020_un_solo_pdf.sql
-- Un solo PDF por alumno (pedido del cliente, 2026-10-05).
--
-- Hasta ahora cada alumno tenía dos: el que se descargó al enviar y, al
-- aprobar, otro igual con "Aprobado por". Desde aquí, al aprobar el
-- aprobado SUSTITUYE al enviado (el archivo viejo se borra del bucket) y
-- todo apunta a él.
--
-- Del enviado se guarda solo su huella (`insnino_pdf_enviado_sha256`): es
-- la copia que se llevó el representante, y si algún día la enseña, la
-- huella dice si es la misma. La constancia de cada documento sigue entera
-- en inscripcion_aceptacion.
--
-- Requiere 0016. Idempotente. Todo en una transacción. No hay ninguna
-- inscripción aprobada en dev ni en prod (verificado el 2026-10-05), así
-- que no queda ningún PDF huérfano.
-- =====================================================================

BEGIN;

ALTER TABLE public.inscripcion_nino
    ADD COLUMN IF NOT EXISTS insnino_pdf_enviado_sha256 text;

UPDATE public.inscripcion_nino
   SET insnino_pdf_enviado_sha256 = insnino_pdf_sha256
 WHERE insnino_pdf_enviado_sha256 IS NULL;

-- Si hubiera alguno aprobado, su PDF aprobado pasa a ser el único.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'inscripcion_nino'
                  AND column_name = 'insnino_pdf_aprobado') THEN
        UPDATE public.inscripcion_nino
           SET insnino_pdf = insnino_pdf_aprobado,
               insnino_pdf_sha256 = insnino_pdf_aprobado_sha256
         WHERE insnino_pdf_aprobado IS NOT NULL;
    END IF;
END $$;

ALTER TABLE public.inscripcion_nino ALTER COLUMN insnino_pdf_enviado_sha256 SET NOT NULL;

ALTER TABLE public.inscripcion_nino DROP CONSTRAINT IF EXISTS ck_insnino_sha256_enviado;
ALTER TABLE public.inscripcion_nino ADD CONSTRAINT ck_insnino_sha256_enviado
    CHECK (insnino_pdf_enviado_sha256 ~ '^[0-9a-f]{64}$');

ALTER TABLE public.inscripcion_nino
    DROP CONSTRAINT IF EXISTS ck_insnino_sha256_aprobado,
    DROP COLUMN IF EXISTS insnino_pdf_aprobado,
    DROP COLUMN IF EXISTS insnino_pdf_aprobado_sha256;

COMMENT ON COLUMN public.inscripcion_nino.insnino_pdf IS
    'El PDF del alumno: el enviado mientras está pendiente; al aprobar, el mismo con "Aprobado por", que lo sustituye.';
COMMENT ON COLUMN public.inscripcion_nino.insnino_pdf_enviado_sha256 IS
    'Huella del PDF que se descargó el representante al enviar. El archivo se borra al aprobar; la huella queda.';

DO $$
DECLARE
    viejas int;
    nueva  int;
BEGIN
    SELECT count(*) INTO viejas FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'inscripcion_nino'
       AND column_name IN ('insnino_pdf_aprobado', 'insnino_pdf_aprobado_sha256');
    SELECT count(*) INTO nueva FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'inscripcion_nino'
       AND column_name = 'insnino_pdf_enviado_sha256';
    IF viejas <> 0 THEN RAISE EXCEPTION 'Quedan % columnas viejas', viejas; END IF;
    IF nueva <> 1 THEN RAISE EXCEPTION 'Falta insnino_pdf_enviado_sha256'; END IF;
END $$;

COMMIT;
