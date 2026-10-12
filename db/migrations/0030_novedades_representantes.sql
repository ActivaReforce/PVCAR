-- =====================================================================
-- PVCAR — 0030_novedades_representantes.sql
-- Novedades: tipo nuevo 'representante' (2026-10-12).
--
-- "Personal de Activa Reforce" deja de listar representantes; para ellos hay
-- un tipo propio. Sus menciones van en la misma tabla novedad_persona (son
-- usuarios), así que el trigger que vigila el tipo admite los dos.
--
-- Requiere 0027. Idempotente. Todo en una transacción.
-- Igual en dev y en prod.
-- =====================================================================

BEGIN;

ALTER TABLE public.novedad DROP CONSTRAINT IF EXISTS ck_nov_tipo;
ALTER TABLE public.novedad ADD CONSTRAINT ck_nov_tipo
    CHECK (nov_tipo IN ('general', 'personal', 'representante', 'alumno'));

COMMENT ON TABLE public.novedad IS
    'Novedades e incidencias escritas por los usuarios. Cuatro tipos: general, personal (menciona personal), representante (menciona representantes) y alumno (menciona niños).';

COMMENT ON TABLE public.novedad_persona IS
    'A qué usuarios menciona una novedad de tipo personal o representante.';

-- CREATE OR REPLACE conserva el dueño y los privilegios de la función.
CREATE OR REPLACE FUNCTION public.validar_novedad_persona()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (SELECT nov_tipo FROM public.novedad WHERE nov_id = NEW.nov_id)
           NOT IN ('personal', 'representante') THEN
        RAISE EXCEPTION 'novedad_persona solo aplica a novedades tipo personal o representante';
    END IF;
    RETURN NEW;
END
$$;

COMMIT;
