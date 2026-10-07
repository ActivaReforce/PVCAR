-- =====================================================================
-- PVCAR — 0017_borrar_campos_viejos.sql
-- Borra los campos que ya no pide nadie. Decisión del cliente del
-- 2026-10-05: "solo usamos lo nuevo" (las fichas de Contratos/).
--
-- Requiere 0016 aplicada y el código que ya no los usa desplegado.
-- En **PVCAR_Dev** después del deploy de `dev`. En **PVCAR (prod)** solo
-- después del PR a `main`: el código de `main` todavía los lee y se
-- rompería. Idempotente. Todo en una transacción.
--
-- ---------------------------------------------------------------------
-- Qué borra y qué lo sustituye
--
--   nino.nino_toma_transporte     → nino.nino_modalidad_salida (0016)
--   nino.nino_cedula              → ninguna ficha la pide
--   nino.nino_otra_info           → ninguna ficha la pide
--   nino.nino_edad                → se calcula de nino_fecha_nacimiento (0014)
--   padre.padre_sector_residencia → los datos de factura (0016)
--   entrenador.ent_cedula         → usuario.usu_cedula (0014)
--
-- Lo de la plataforma vieja no se toca: el esquema `archivo` conserva sus
-- columnas para Reportes → Data anterior.
--
-- Verificado por MCP el 2026-10-05 en PVCAR_Dev: ninguna función, vista,
-- índice ni restricción depende de estas columnas.
-- =====================================================================

BEGIN;

ALTER TABLE public.nino
    DROP COLUMN IF EXISTS nino_toma_transporte,
    DROP COLUMN IF EXISTS nino_cedula,
    DROP COLUMN IF EXISTS nino_otra_info,
    DROP COLUMN IF EXISTS nino_edad;

ALTER TABLE public.padre      DROP COLUMN IF EXISTS padre_sector_residencia;
ALTER TABLE public.entrenador DROP COLUMN IF EXISTS ent_cedula;

-- ---------------------------------------------------------------------
-- Guarda de salida
-- ---------------------------------------------------------------------
DO $$
DECLARE
    quedan int;
BEGIN
    SELECT count(*) INTO quedan
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name::text, column_name::text) IN (
          ('nino', 'nino_toma_transporte'), ('nino', 'nino_cedula'),
          ('nino', 'nino_otra_info'), ('nino', 'nino_edad'),
          ('padre', 'padre_sector_residencia'), ('entrenador', 'ent_cedula'));
    IF quedan <> 0 THEN
        RAISE EXCEPTION 'Quedan % columnas por borrar', quedan;
    END IF;
END $$;

COMMIT;
