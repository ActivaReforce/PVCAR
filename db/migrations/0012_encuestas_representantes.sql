-- =====================================================================
-- PVCAR — 0012_encuestas_representantes.sql
-- Cierra el modelo de Encuestas y Representantes.
-- Migración de la Fase 14.
--
-- Requiere 0001-0011 aplicados. Va en PVCAR_Dev y en PVCAR.
-- Idempotente. Todo en una transacción.
--
-- ---------------------------------------------------------------------
-- Por qué esta migración puede ser tan agresiva
--
-- Porque **no hay nada que romper**. Las seis tablas —`encuesta`,
-- `encuesta_pregunta`, `encuesta_respondida`, `encuesta_respuesta`,
-- `padre` y `nino_padre`— tienen **0 filas** en los tres respaldos de
-- producción (2026-06-09, 2026-06-10 y 2026-07-27), 0 en `PVCAR_Dev` y 0
-- en `PVCAR`. Comprobado por MCP el 2026-09-17 en las dos bases nuevas.
--
-- No es que se borraran: el módulo nunca se usó. Eso lo convierte en el
-- único sitio del sistema donde el esquema se puede corregir sin coste
-- de migración, y por eso se corrige entero ahora y no después.
--
-- ---------------------------------------------------------------------
-- Qué se arregla
--
-- 1. Un representante podía **responder dos veces** la misma encuesta.
--    La regla de negocio dice que una, y no había nada que lo impidiera.
-- 2. Y podía mandar **dos respuestas a la misma pregunta**, con lo que
--    cualquier recuento de resultados sería mentira.
-- 3. Dos preguntas podían compartir el mismo número de orden, así que el
--    orden del formulario dependía de cómo saliera el `ORDER BY`.
-- 4. Un mismo usuario podía tener **dos fichas de representante**, y una
--    ficha podía no apuntar a ningún usuario.
-- 5. Un vínculo niño–representante podía tener cualquiera de los dos
--    lados en NULL.
-- 6. La hora de una respuesta se guardaba en `time with time zone`, un
--    tipo que la propia documentación de Postgres desaconseja: una hora
--    sin fecha no tiene zona que valga. Pasa a `time`, como las horas de
--    asistencia.
-- 7. Los campos de escala vivían sueltos: una pregunta de texto podía
--    llevar mínimo y máximo, y una de escala podía no llevarlos.
-- 8. El estado de una encuesta podía ser cualquiera de los siete del
--    catálogo; solo tres significan algo aquí.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Guarda de entrada: esto solo es seguro sobre tablas vacías.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    filas bigint;
BEGIN
    SELECT (SELECT count(*) FROM public.encuesta)
         + (SELECT count(*) FROM public.encuesta_pregunta)
         + (SELECT count(*) FROM public.encuesta_respondida)
         + (SELECT count(*) FROM public.encuesta_respuesta)
         + (SELECT count(*) FROM public.padre)
         + (SELECT count(*) FROM public.nino_padre)
    INTO filas;

    IF filas > 0 THEN
        RAISE EXCEPTION
            'Hay % fila(s) en las tablas de encuestas o representantes. Esta migración asume que están vacías: revisar antes de aplicarla.', filas;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. Representantes: un usuario, una ficha
-- ---------------------------------------------------------------------
ALTER TABLE public.padre ALTER COLUMN usu_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_padre_usuario ON public.padre (usu_id);

ALTER TABLE public.nino_padre ALTER COLUMN nino_id  SET NOT NULL;
ALTER TABLE public.nino_padre ALTER COLUMN padre_id SET NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Una encuesta está en uno de tres estados, y solo tres
--
-- 3 Borrador (se edita) · 4 Finalizado (no se edita) · 5 Publicado (se
-- responde). Los otros cuatro del catálogo —activo, inactivo, pendiente,
-- evaluado— no significan nada para una encuesta.
-- ---------------------------------------------------------------------
ALTER TABLE public.encuesta DROP CONSTRAINT IF EXISTS ck_encuesta_estado;
ALTER TABLE public.encuesta
    ADD CONSTRAINT ck_encuesta_estado CHECK (est_id IN (3, 4, 5));

-- ---------------------------------------------------------------------
-- 3. Preguntas: el orden no se repite y la escala es coherente
--
-- Mismo patrón que los campos condicionales de la asistencia (0010): la
-- regla se escribe como equivalencia, así que cubre los dos sentidos —ni
-- sobran los límites cuando no es una escala, ni faltan cuando lo es.
-- El tipo 3 es "Escala" en `encuesta_tipo_respuesta`.
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_pregunta_orden
    ON public.encuesta_pregunta (encu_id, encupreg_orden);

ALTER TABLE public.encuesta_pregunta DROP CONSTRAINT IF EXISTS ck_pregunta_orden_positivo;
ALTER TABLE public.encuesta_pregunta
    ADD CONSTRAINT ck_pregunta_orden_positivo CHECK (encupreg_orden >= 1);

ALTER TABLE public.encuesta_pregunta DROP CONSTRAINT IF EXISTS ck_pregunta_escala;
ALTER TABLE public.encuesta_pregunta
    ADD CONSTRAINT ck_pregunta_escala CHECK (
        (encutiporesp_id = 3) = (encupreg_escala_min IS NOT NULL AND encupreg_escala_max IS NOT NULL)
        AND (encupreg_escala_max IS NULL OR encupreg_escala_max > encupreg_escala_min)
    );

-- ---------------------------------------------------------------------
-- 4. Un representante responde una vez, y una respuesta por pregunta
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_respondida_encuesta_padre
    ON public.encuesta_respondida (encu_id, padre_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_respuesta_pregunta
    ON public.encuesta_respuesta (encurespo_id, encupreg_id);

-- ---------------------------------------------------------------------
-- 5. La hora, sin zona
--
-- `time with time zone` guarda un desplazamiento que no significa nada
-- sin una fecha al lado (el propio manual de Postgres lo desaconseja).
-- Con la tabla vacía el cambio es instantáneo.
-- ---------------------------------------------------------------------
ALTER TABLE public.encuesta_respuesta
    ALTER COLUMN encurespu_hora TYPE time without time zone;

-- ---------------------------------------------------------------------
-- Guarda de salida
-- ---------------------------------------------------------------------
DO $$
DECLARE
    indices int;
    checks  int;
    tipo    text;
    nulos   int;
BEGIN
    SELECT count(*) INTO indices
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN ('uq_padre_usuario', 'uq_pregunta_orden',
                        'uq_respondida_encuesta_padre', 'uq_respuesta_pregunta');

    SELECT count(*) INTO checks
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conname IN ('ck_encuesta_estado', 'ck_pregunta_orden_positivo', 'ck_pregunta_escala');

    SELECT format_type(atttypid, atttypmod) INTO tipo
    FROM pg_attribute
    WHERE attrelid = 'public.encuesta_respuesta'::regclass AND attname = 'encurespu_hora';

    SELECT count(*) INTO nulos
    FROM pg_attribute
    WHERE attrelid IN ('public.padre'::regclass, 'public.nino_padre'::regclass)
      AND attname IN ('usu_id', 'nino_id', 'padre_id')
      AND NOT attnotnull;

    IF indices <> 4 THEN
        RAISE EXCEPTION 'Esperaba 4 índices únicos nuevos, hay %', indices;
    END IF;
    IF checks <> 3 THEN
        RAISE EXCEPTION 'Esperaba 3 CHECK nuevos, hay %', checks;
    END IF;
    IF tipo <> 'time without time zone' THEN
        RAISE EXCEPTION 'encurespu_hora deberia ser time sin zona y es %', tipo;
    END IF;
    IF nulos <> 0 THEN
        RAISE EXCEPTION 'Quedan % columna(s) de vínculo que admiten NULL', nulos;
    END IF;
END $$;

COMMIT;
