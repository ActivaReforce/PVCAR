-- =====================================================================
-- PVCAR — 0033_novedades_ausencias.sql
-- Punto 9: aviso automático de ausencia (2026-10-12).
--
-- Al guardar la asistencia de alumnos, cada alumno que pasa a Ausente
-- genera una novedad 'ausencia' (y un correo); si después se corrige a
-- Presente, Tarde o Justificado, una novedad 'correccion' (y otro correo).
-- Las escribe el sistema a nombre de quien guardó la lista.
--
--   1. correo_config: tipo nuevo 'ausencias' con su Para, CC, respuesta
--      y la casilla "avisar también al representante".
--   2. novedad: tipos 'ausencia' y 'correccion', con la clase de la que
--      hablan (disciplina + fecha, para saber si toca corrección) y una
--      foto de los datos de ese momento (colegio, actividad, horario,
--      estado nuevo...). Sin FK a la disciplina: la novedad es historia y
--      no debe impedir borrar una disciplina.
--   3. novedad_alumno admite también esos dos tipos.
--
-- Requiere 0032. Idempotente. Todo en una transacción.
-- Igual en dev y en prod.
-- =====================================================================

BEGIN;

-- 1. Configuración de correo -------------------------------------------

ALTER TABLE public.correo_config DROP CONSTRAINT IF EXISTS ck_corcfg_tipo;
ALTER TABLE public.correo_config ADD CONSTRAINT ck_corcfg_tipo
    CHECK (corcfg_tipo IN ('inscripciones', 'inscripciones_aviso', 'novedades', 'ausencias'));

INSERT INTO public.correo_config (corcfg_tipo, corcfg_nombre, corcfg_usuario)
VALUES ('ausencias', 'Asistencia Activa Reforce', 'asistencia')
ON CONFLICT (corcfg_tipo) DO NOTHING;

-- 2. Novedad: tipos y datos de la clase --------------------------------

ALTER TABLE public.novedad DROP CONSTRAINT IF EXISTS ck_nov_tipo;
ALTER TABLE public.novedad ADD CONSTRAINT ck_nov_tipo
    CHECK (nov_tipo IN ('general', 'personal', 'representante', 'alumno', 'ausencia', 'correccion'));

ALTER TABLE public.novedad
    ADD COLUMN IF NOT EXISTS nov_colacthor_id int,
    ADD COLUMN IF NOT EXISTS nov_asis_fecha   date,
    ADD COLUMN IF NOT EXISTS nov_datos        jsonb;

COMMENT ON COLUMN public.novedad.nov_colacthor_id IS
    'Ausencia/corrección: disciplina de la clase. Sin FK a propósito (es historia).';
COMMENT ON COLUMN public.novedad.nov_asis_fecha IS
    'Ausencia/corrección: fecha de la clase.';
COMMENT ON COLUMN public.novedad.nov_datos IS
    'Ausencia/corrección: colegio, actividad, día, horario, estado, hora de llegada y motivo tal como estaban al guardar.';

ALTER TABLE public.novedad DROP CONSTRAINT IF EXISTS ck_nov_asistencia;
ALTER TABLE public.novedad ADD CONSTRAINT ck_nov_asistencia CHECK (
    (nov_tipo IN ('ausencia', 'correccion'))
    = (nov_colacthor_id IS NOT NULL AND nov_asis_fecha IS NOT NULL AND nov_datos IS NOT NULL)
);

-- Para saber, al guardar, cuál fue el último aviso de esa clase.
CREATE INDEX IF NOT EXISTS ix_novedad_clase
    ON public.novedad (nov_colacthor_id, nov_asis_fecha)
    WHERE nov_colacthor_id IS NOT NULL;

-- 3. novedad_alumno: también ausencias y correcciones -------------------

CREATE OR REPLACE FUNCTION public.validar_novedad_alumno()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (SELECT nov_tipo FROM public.novedad WHERE nov_id = NEW.nov_id)
           NOT IN ('alumno', 'ausencia', 'correccion') THEN
        RAISE EXCEPTION 'novedad_alumno solo aplica a novedades de alumno, ausencia o corrección';
    END IF;
    RETURN NEW;
END
$$;

-- Guardas ----------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.correo_config WHERE corcfg_tipo = 'ausencias') THEN
        RAISE EXCEPTION 'No quedó la fila de ausencias en correo_config';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'novedad'
                      AND column_name = 'nov_datos') THEN
        RAISE EXCEPTION 'No quedó la columna nov_datos';
    END IF;
END $$;

COMMIT;
