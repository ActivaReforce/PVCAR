-- =====================================================================
-- PVCAR — 0044_mensualidades_por_anio.sql
-- Mensualidades, segunda vuelta (cliente, 2026-11-16).
--
-- Qué cambia
--
-- 1. Los meses de cobro de cada colegio llevan año. Antes eran números del
--    1 al 12 (el mismo enero todos los años); ahora son meses concretos
--    ('2026-12-01', '2027-01-01'…). La pantalla enseña el año en curso y,
--    si se abre, el siguiente. Lo de años pasados se conserva: con eso se
--    calcula lo que se debe de esos meses.
-- 2. Fuera "Cobrar desde" (colpre_cobro_desde) y el día de corte
--    (colpre_mens_dia_corte): ahora el mes que paga la inscripción lo elige
--    el representante en el formulario.
-- 3. inscripcion.ins_mes_inicio: el mes que paga la inscripción (el mes en
--    que el alumno empieza). Las que ya existen pagan noviembre de 2026
--    (o su propio mes, si es posterior): todo lo inscrito en octubre y
--    noviembre es el pago de noviembre.
-- 4. Día límite por defecto, 5 (lo que dice el contrato). Los colegios que
--    seguían con el 10 de serie pasan a 5.
--
-- En dev, el código desplegado antes de este cambio deja de leer la
-- configuración de mensualidades hasta que sube el nuevo (minutos). En prod
-- se corre con la 0041–0043, antes del merge: el código de main no usa
-- nada de esto, y una inscripción enviada mientras tanto toma el mes en
-- curso por defecto.
--
-- Requiere 0041–0043. Idempotente. Todo en una transacción. Igual en dev y
-- en prod.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Meses de cobro con año
-- ---------------------------------------------------------------------
ALTER TABLE public.colegio_precio
    ADD COLUMN IF NOT EXISTS colpre_meses date[] NOT NULL DEFAULT '{}';

-- Lo que hubiera configurado con la forma vieja (solo dev): los meses
-- marcados del año en curso, desde "Cobrar desde".
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'colegio_precio'
                  AND column_name = 'colpre_cobro_desde') THEN
        EXECUTE $q$
            UPDATE public.colegio_precio cp
               SET colpre_meses = ARRAY(
                     SELECT make_date(extract(year FROM cp.colpre_cobro_desde)::int, m, 1)
                       FROM unnest(cp.colpre_meses_cobro) AS m
                      WHERE make_date(extract(year FROM cp.colpre_cobro_desde)::int, m, 1) >= cp.colpre_cobro_desde
                      ORDER BY m)
             WHERE cp.colpre_cobro_desde IS NOT NULL
               AND cardinality(cp.colpre_meses) = 0
        $q$;
    END IF;
END $$;

ALTER TABLE public.colegio_precio DROP CONSTRAINT IF EXISTS ck_colpre_meses_cobro;
ALTER TABLE public.colegio_precio DROP CONSTRAINT IF EXISTS ck_colpre_cobro_desde;
ALTER TABLE public.colegio_precio DROP CONSTRAINT IF EXISTS ck_colpre_mens_dia_corte;
ALTER TABLE public.colegio_precio
    DROP COLUMN IF EXISTS colpre_meses_cobro,
    DROP COLUMN IF EXISTS colpre_cobro_desde,
    DROP COLUMN IF EXISTS colpre_mens_dia_corte;

COMMENT ON COLUMN public.colegio_precio.colpre_meses IS
    'Meses (día 1) en que este colegio cobra mensualidad, con su año. Los que no están quedan en pausa. Vacío = no cobra.';

-- ---------------------------------------------------------------------
-- 2. Día límite: 5 por defecto
-- ---------------------------------------------------------------------
ALTER TABLE public.colegio_precio ALTER COLUMN colpre_mens_dia_limite SET DEFAULT 5;
UPDATE public.colegio_precio SET colpre_mens_dia_limite = 5 WHERE colpre_mens_dia_limite = 10;

COMMENT ON COLUMN public.colegio_precio.colpre_mens_dia_limite IS
    'Día del mes hasta el que se paga la mensualidad. Después, el mes sin pagar sale atrasado y el alumno queda ausente en Asistencias hasta que paga.';

-- ---------------------------------------------------------------------
-- 3. El mes que paga cada inscripción
-- ---------------------------------------------------------------------
ALTER TABLE public.inscripcion
    ADD COLUMN IF NOT EXISTS ins_mes_inicio date;

UPDATE public.inscripcion
   SET ins_mes_inicio = GREATEST(
         date_trunc('month', ins_fecha AT TIME ZONE 'America/Guayaquil')::date,
         DATE '2026-11-01')
 WHERE ins_mes_inicio IS NULL;

ALTER TABLE public.inscripcion
    ALTER COLUMN ins_mes_inicio SET DEFAULT (date_trunc('month', now() AT TIME ZONE 'America/Guayaquil')::date),
    ALTER COLUMN ins_mes_inicio SET NOT NULL;

ALTER TABLE public.inscripcion DROP CONSTRAINT IF EXISTS ck_ins_mes_inicio;
ALTER TABLE public.inscripcion ADD CONSTRAINT ck_ins_mes_inicio
    CHECK (extract(day FROM ins_mes_inicio) = 1);

COMMENT ON COLUMN public.inscripcion.ins_mes_inicio IS
    'Mes (día 1) que paga la inscripción: el alumno empieza ese mes y las mensualidades corren desde el siguiente. Lo elige el representante (mes en curso o el siguiente).';

-- ---------------------------------------------------------------------
-- Guarda de salida
-- ---------------------------------------------------------------------
DO $$
DECLARE
    viejas int;
    sin_mes int;
BEGIN
    SELECT count(*) INTO viejas
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'colegio_precio'
      AND column_name IN ('colpre_meses_cobro', 'colpre_cobro_desde', 'colpre_mens_dia_corte');
    IF viejas > 0 THEN
        RAISE EXCEPTION 'Siguen % columna(s) viejas de mensualidades en colegio_precio', viejas;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'colegio_precio'
                      AND column_name = 'colpre_meses') THEN
        RAISE EXCEPTION 'Falta colegio_precio.colpre_meses';
    END IF;

    SELECT count(*) INTO sin_mes FROM public.inscripcion WHERE ins_mes_inicio IS NULL;
    IF sin_mes > 0 THEN
        RAISE EXCEPTION 'Quedan % inscripción(es) sin mes de inicio', sin_mes;
    END IF;
END $$;

COMMIT;
