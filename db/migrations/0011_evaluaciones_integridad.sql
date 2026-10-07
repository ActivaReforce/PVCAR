-- =====================================================================
-- PVCAR — 0011_evaluaciones_integridad.sql
-- Cierra los huecos del modelo de Evaluaciones.
-- Migración de la Fase 12.
--
-- Requiere 0001-0010 aplicados. Va en PVCAR_Dev y en PVCAR.
-- Idempotente. Todo en una transacción.
--
-- ---------------------------------------------------------------------
-- Por qué
--
-- Evaluaciones es la parte con más lógica de negocio del sistema y la
-- única donde un error silencioso **cambia la nota de un niño**. El
-- esquema heredado la deja casi entera en manos del código:
--
--   1. Nada impide **dos intentos con el mismo número** para el mismo
--      parámetro del mismo alumno. El frontend viejo lo evitaba
--      consultando antes de insertar, con la carrera obvia entre medias:
--      dos pestañas abiertas y el alumno tiene dos veces el intento 1,
--      los dos sumando al total.
--
--   2. Nada impide **dos pendientes de la misma evaluación para la misma
--      inscripción**. El trigger y la función de reactivación hacen su
--      EXISTS antes de insertar; el vínculo de disciplinas lo hacía desde
--      el navegador, fila a fila, sin transacción.
--
--   3. `evaluacion_intento.evaninopen_id` es **nullable**: un intento sin
--      alumno al que pertenecer es un huérfano que ninguna consulta
--      encuentra y ninguna cascada borra.
--
--   4. El puntaje obtenido se guarda en `real` (float4). Los métodos por
--      tiempo y por escala interpolan y redondean a 2 decimales; float4
--      no representa exactamente 0.01 y al sumar intentos el total se
--      desvía. Pasa a `numeric(6,2)`, que es exacto. El máximo posible
--      hoy son 12 puntos por parámetro: 9999.99 sobra.
--
-- ---------------------------------------------------------------------
-- Seguro para los datos reales
--
-- Medido el 2026-09-17 sobre PVCAR_Dev, con los datos del respaldo de
-- producción del 2026-07-27 (5 evaluaciones, 5 parámetros, 72
-- asignaciones, 1 261 pendientes, 1 intento):
--
--   intentos con (pendiente, parámetro, nº) repetido ...... 0
--   intentos sin pendiente ................................ 0
--   pendientes con (evaluación, inscripción) repetido ..... 0
--   pendientes sin evaluación ............................. 0
--   parámetros sin método, sin intentos o con puntaje <= 0  0
--
-- No rebota ninguna fila.
--
-- **Antes del cutover hay que repetir estas cinco cuentas contra la prod
-- vieja**, que sigue viva: las restricciones se aplican a la base vacía
-- y la carga entraría después.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Guarda de entrada
-- ---------------------------------------------------------------------
DO $$
DECLARE
    malas bigint;
BEGIN
    SELECT
        (SELECT count(*) FROM (
            SELECT 1 FROM public.evaluacion_intento
            GROUP BY evaninopen_id, evaparam_id, evaint_intento HAVING count(*) > 1) a)
      + (SELECT count(*) FROM public.evaluacion_intento WHERE evaninopen_id IS NULL)
      + (SELECT count(*) FROM (
            SELECT 1 FROM public.evaluacion_nino_pendiente
            GROUP BY eva_id, ninoasig_id HAVING count(*) > 1) b)
      + (SELECT count(*) FROM public.evaluacion_nino_pendiente WHERE eva_id IS NULL)
      + (SELECT count(*) FROM public.evaluacion_parametro
          WHERE evatipometo_id IS NULL OR evaparam_intentos IS NULL OR evaparam_puntaje <= 0)
      + (SELECT count(*) FROM public.evaluacion_asignacion WHERE est_id IS NULL)
    INTO malas;

    IF malas > 0 THEN
        RAISE EXCEPTION
            'Hay % fila(s) de evaluaciones que no cumplen las restricciones de 0011. Corregirlas antes de aplicar.', malas;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. Un intento por (alumno pendiente, parámetro, número de intento)
-- ---------------------------------------------------------------------
ALTER TABLE public.evaluacion_intento ALTER COLUMN evaninopen_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_intento_pendiente_parametro
    ON public.evaluacion_intento (evaninopen_id, evaparam_id, evaint_intento);

-- ---------------------------------------------------------------------
-- 2. Una pendiente por (evaluación, inscripción)
--
-- Es la condición que el trigger `handle_nino_asignacion_insert` y la
-- función `reactivate_nino_asignacion` ya comprueban con un EXISTS. Aquí
-- queda garantizada, y de paso el índice sirve a ese mismo EXISTS.
-- ---------------------------------------------------------------------
ALTER TABLE public.evaluacion_nino_pendiente ALTER COLUMN eva_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pendiente_evaluacion_inscripcion
    ON public.evaluacion_nino_pendiente (eva_id, ninoasig_id);

-- ---------------------------------------------------------------------
-- 3. Un parámetro sin método o sin puntaje no se puede puntuar
-- ---------------------------------------------------------------------
ALTER TABLE public.evaluacion_parametro ALTER COLUMN evatipometo_id   SET NOT NULL;
ALTER TABLE public.evaluacion_parametro ALTER COLUMN evaparam_intentos SET NOT NULL;
ALTER TABLE public.evaluacion_parametro ALTER COLUMN evaparam_intentos SET DEFAULT 1;

ALTER TABLE public.evaluacion_parametro DROP CONSTRAINT IF EXISTS ck_evaparam_puntaje_positivo;
ALTER TABLE public.evaluacion_parametro
    ADD CONSTRAINT ck_evaparam_puntaje_positivo CHECK (evaparam_puntaje > 0);

ALTER TABLE public.evaluacion_asignacion ALTER COLUMN est_id SET NOT NULL;

-- ---------------------------------------------------------------------
-- 4. El puntaje obtenido, exacto
--
-- `real` no representa 0.01. Con 1 sola fila hoy el cambio es
-- instantáneo; se hace ahora, no cuando haya 50 000.
-- ---------------------------------------------------------------------
ALTER TABLE public.evaluacion_intento
    ALTER COLUMN evaint_puntaje_obtenido TYPE numeric(6,2)
    USING round(evaint_puntaje_obtenido::numeric, 2);

-- ---------------------------------------------------------------------
-- Guarda de salida
-- ---------------------------------------------------------------------
DO $$
DECLARE
    indices int;
    checks  int;
    tipo    text;
BEGIN
    SELECT count(*) INTO indices
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN ('uq_intento_pendiente_parametro', 'uq_pendiente_evaluacion_inscripcion');

    SELECT count(*) INTO checks
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conname = 'ck_evaparam_puntaje_positivo';

    SELECT format_type(a.atttypid, a.atttypmod) INTO tipo
    FROM pg_attribute a
    WHERE a.attrelid = 'public.evaluacion_intento'::regclass
      AND a.attname = 'evaint_puntaje_obtenido';

    IF indices <> 2 THEN
        RAISE EXCEPTION 'Esperaba los 2 índices únicos de evaluaciones, hay %', indices;
    END IF;
    IF checks <> 1 THEN
        RAISE EXCEPTION 'Falta el CHECK ck_evaparam_puntaje_positivo';
    END IF;
    IF tipo <> 'numeric(6,2)' THEN
        RAISE EXCEPTION 'evaint_puntaje_obtenido deberia ser numeric(6,2) y es %', tipo;
    END IF;
END $$;

COMMIT;
