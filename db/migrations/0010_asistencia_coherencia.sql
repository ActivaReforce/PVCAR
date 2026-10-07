-- =====================================================================
-- PVCAR — 0010_asistencia_coherencia.sql
-- La hora de llegada solo con Tarde; el motivo solo con Justificado.
-- Migración de la Fase 11.
--
-- Requiere 0001-0009 aplicados. Va en PVCAR_Dev y en PVCAR.
-- Idempotente. Todo en una transacción.
--
-- ---------------------------------------------------------------------
-- Qué arregla
--
-- Las tres tablas de asistencia guardan dos campos condicionales: la
-- hora de llegada, que solo tiene sentido con el estado **Tarde** (3), y
-- el motivo, que solo lo tiene con **Justificado** (4). Hoy esa regla
-- vive únicamente en el navegador —`validateRowData()`, copiada en tres
-- archivos del frontend viejo— y la base acepta cualquier combinación:
-- un "Presente" con hora de llegada, o un "Justificado" sin motivo.
--
-- Un informe que cuente justificados con motivo y otro que cuente
-- justificados a secas darían números distintos y los dos parecerían
-- correctos.
--
-- ---------------------------------------------------------------------
-- Las tres columnas `*_hora_tarde` tenían DEFAULT now()
--
-- Es una trampa fina: son columnas `time`, así que un INSERT que omita
-- la hora **no** deja NULL, deja la hora del reloj del servidor. Nadie
-- llega tarde a las 03:47 UTC. El default se quita: si no hay hora, la
-- fila tiene que decir NULL.
--
-- ---------------------------------------------------------------------
-- Seguro para los datos reales
--
-- Medido el 2026-09-17 sobre PVCAR_Dev, que lleva los 13 202 + 1 726 +
-- 283 registros del respaldo de producción del 2026-07-27:
--
--   hora con estado distinto de Tarde .......... 0 en las tres tablas
--   estado Tarde sin hora ...................... 0 en las tres tablas
--   motivo con estado distinto de Justificado .. 0 en las tres tablas
--   estado Justificado sin motivo .............. 0 en las tres tablas
--
-- No rebota ninguna fila. Prod está vacía; recibe los datos ya limpios
-- en el cutover.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Guarda de entrada: si algo violara los CHECK, parar antes de tocar nada
-- y decir cuántas filas y de qué tabla.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    malas bigint;
BEGIN
    SELECT
        (SELECT count(*) FROM public.asistencia_nino
          WHERE (asisest_id = 3) <> (asisnino_hora_tarde IS NOT NULL)
             OR (asisest_id = 4) <> (COALESCE(btrim(asisnino_razon_justificado), '') <> ''))
      + (SELECT count(*) FROM public.asistencia_entrenador
          WHERE (asisest_id = 3) <> (asisent_hora_tarde IS NOT NULL)
             OR (asisest_id = 4) <> (COALESCE(btrim(asisent_razon_justificado), '') <> ''))
      + (SELECT count(*) FROM public.asistencia_auxiliar
          WHERE (asisest_id = 3) <> (asisaux_hora_tarde IS NOT NULL)
             OR (asisest_id = 4) <> (COALESCE(btrim(asisaux_razon_justificado), '') <> ''))
    INTO malas;

    IF malas > 0 THEN
        RAISE EXCEPTION
            'Hay % fila(s) de asistencia con campos condicionales incoherentes. Corregirlas antes de aplicar 0010.', malas;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. Fuera el DEFAULT now() de las tres columnas de hora
-- ---------------------------------------------------------------------
ALTER TABLE public.asistencia_nino       ALTER COLUMN asisnino_hora_tarde DROP DEFAULT;
ALTER TABLE public.asistencia_entrenador ALTER COLUMN asisent_hora_tarde  DROP DEFAULT;
ALTER TABLE public.asistencia_auxiliar   ALTER COLUMN asisaux_hora_tarde  DROP DEFAULT;

-- ---------------------------------------------------------------------
-- 2. Los CHECK. Se escriben como equivalencia (`<estado> = <campo lleno>`)
--    y no como dos implicaciones sueltas: así cubren los dos sentidos —
--    ni sobra el campo cuando no toca, ni falta cuando sí.
-- ---------------------------------------------------------------------
ALTER TABLE public.asistencia_nino       DROP CONSTRAINT IF EXISTS ck_asisnino_campos_condicionales;
ALTER TABLE public.asistencia_entrenador DROP CONSTRAINT IF EXISTS ck_asisent_campos_condicionales;
ALTER TABLE public.asistencia_auxiliar   DROP CONSTRAINT IF EXISTS ck_asisaux_campos_condicionales;

ALTER TABLE public.asistencia_nino
    ADD CONSTRAINT ck_asisnino_campos_condicionales CHECK (
        (asisest_id = 3) = (asisnino_hora_tarde IS NOT NULL)
    AND (asisest_id = 4) = (COALESCE(btrim(asisnino_razon_justificado), '') <> '')
    );

ALTER TABLE public.asistencia_entrenador
    ADD CONSTRAINT ck_asisent_campos_condicionales CHECK (
        (asisest_id = 3) = (asisent_hora_tarde IS NOT NULL)
    AND (asisest_id = 4) = (COALESCE(btrim(asisent_razon_justificado), '') <> '')
    );

ALTER TABLE public.asistencia_auxiliar
    ADD CONSTRAINT ck_asisaux_campos_condicionales CHECK (
        (asisest_id = 3) = (asisaux_hora_tarde IS NOT NULL)
    AND (asisest_id = 4) = (COALESCE(btrim(asisaux_razon_justificado), '') <> '')
    );

-- ---------------------------------------------------------------------
-- Guarda de salida: los tres CHECK puestos y los tres DEFAULT fuera.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    checks   int;
    defaults int;
BEGIN
    SELECT count(*) INTO checks
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conname IN ('ck_asisnino_campos_condicionales',
                      'ck_asisent_campos_condicionales',
                      'ck_asisaux_campos_condicionales');

    SELECT count(*) INTO defaults
    FROM pg_attribute a
    JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid IN ('public.asistencia_nino'::regclass,
                         'public.asistencia_entrenador'::regclass,
                         'public.asistencia_auxiliar'::regclass)
      AND a.attname IN ('asisnino_hora_tarde', 'asisent_hora_tarde', 'asisaux_hora_tarde');

    IF checks <> 3 THEN
        RAISE EXCEPTION 'Esperaba 3 CHECK de campos condicionales, hay %', checks;
    END IF;
    IF defaults <> 0 THEN
        RAISE EXCEPTION 'Esperaba 0 DEFAULT en las columnas de hora, quedan %', defaults;
    END IF;
END $$;

COMMIT;
