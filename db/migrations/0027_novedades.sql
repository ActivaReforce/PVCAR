-- =====================================================================
-- PVCAR — 0027_novedades.sql
-- Módulo Novedades (punto 8 del Roadmap, 2026-10-09).
--
-- Cualquier rol escribe una novedad y queda atada a su autor. Tres tipos:
--   general   — texto suelto (ej. "Hoy llovió, no se pudieron hacer las
--               actividades"). No va atada a nadie.
--   personal  — mencionando a 1..N usuarios de Activa Reforce.
--   alumno    — mencionando a 1..N alumnos.
--
-- Al guardar se dispara un correo al Para + CC configurado (una sola fila
-- 'novedades' en correo_config). Si el switch `notificar_mencionado` está
-- activo, se añaden también los mencionados —correo del usuario para
-- 'personal', correo de los representantes del niño para 'alumno'—.
--
-- Las novedades sobre personas o alumnos quedan ligadas en reportería.
-- Lectura: Propietario y Admin ven todas; el autor ve las suyas; con el
-- switch activo, el mencionado ve las novedades sobre él y los
-- representantes las que son sobre sus hijos.
--
-- Permisos nuevos (`rol_permiso`): módulo 'novedades' con ver, crear y
-- eliminar. Por defecto, todos los roles **ver + crear**; eliminar solo
-- Propietario y Admin.
--
-- Requiere 0026. Idempotente. Todo en una transacción.
-- Igual en dev y en prod.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Las tres tablas
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.novedad (
    nov_id              SERIAL PRIMARY KEY,
    nov_tipo            text        NOT NULL,
    nov_texto           text        NOT NULL,
    nov_fecha_creacion  timestamptz NOT NULL DEFAULT now(),
    nov_autor_id        int         NOT NULL REFERENCES public.usuario(usu_id) ON DELETE RESTRICT,
    CONSTRAINT ck_nov_tipo  CHECK (nov_tipo IN ('general', 'personal', 'alumno')),
    CONSTRAINT ck_nov_texto CHECK (length(btrim(nov_texto)) BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS ix_novedad_autor_fecha
    ON public.novedad (nov_autor_id, nov_fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS ix_novedad_fecha
    ON public.novedad (nov_fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS ix_novedad_tipo
    ON public.novedad (nov_tipo);

COMMENT ON TABLE public.novedad IS
    'Novedades e incidencias escritas por los usuarios. Tres tipos: general, personal (menciona usuarios) y alumno (menciona niños).';

CREATE TABLE IF NOT EXISTS public.novedad_persona (
    nov_id int NOT NULL REFERENCES public.novedad(nov_id) ON DELETE CASCADE,
    usu_id int NOT NULL REFERENCES public.usuario(usu_id) ON DELETE RESTRICT,
    PRIMARY KEY (nov_id, usu_id)
);

CREATE INDEX IF NOT EXISTS ix_novedad_persona_usu
    ON public.novedad_persona (usu_id);

COMMENT ON TABLE public.novedad_persona IS
    'A qué usuarios de Activa Reforce menciona una novedad personal.';

CREATE TABLE IF NOT EXISTS public.novedad_alumno (
    nov_id  int NOT NULL REFERENCES public.novedad(nov_id) ON DELETE CASCADE,
    nino_id int NOT NULL REFERENCES public.nino(nino_id) ON DELETE RESTRICT,
    PRIMARY KEY (nov_id, nino_id)
);

CREATE INDEX IF NOT EXISTS ix_novedad_alumno_nino
    ON public.novedad_alumno (nino_id);

COMMENT ON TABLE public.novedad_alumno IS
    'A qué alumnos menciona una novedad de tipo alumno.';

-- Un trigger ligero que exige coherencia tipo/menciones. No se puede como
-- CHECK porque mira filas de otra tabla; aquí se queda explícito.
CREATE OR REPLACE FUNCTION public.validar_novedad_persona()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (SELECT nov_tipo FROM public.novedad WHERE nov_id = NEW.nov_id) <> 'personal' THEN
        RAISE EXCEPTION 'novedad_persona solo aplica a novedades tipo personal';
    END IF;
    RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.validar_novedad_alumno()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (SELECT nov_tipo FROM public.novedad WHERE nov_id = NEW.nov_id) <> 'alumno' THEN
        RAISE EXCEPTION 'novedad_alumno solo aplica a novedades tipo alumno';
    END IF;
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_novedad_persona_tipo ON public.novedad_persona;
CREATE TRIGGER trg_novedad_persona_tipo
    BEFORE INSERT OR UPDATE ON public.novedad_persona
    FOR EACH ROW EXECUTE FUNCTION public.validar_novedad_persona();

DROP TRIGGER IF EXISTS trg_novedad_alumno_tipo ON public.novedad_alumno;
CREATE TRIGGER trg_novedad_alumno_tipo
    BEFORE INSERT OR UPDATE ON public.novedad_alumno
    FOR EACH ROW EXECUTE FUNCTION public.validar_novedad_alumno();

-- ---------------------------------------------------------------------
-- 2. correo_config: nuevo tipo 'novedades' + switch "notificar al mencionado"
-- ---------------------------------------------------------------------

ALTER TABLE public.correo_config
    ADD COLUMN IF NOT EXISTS corcfg_notificar_mencionado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.correo_config.corcfg_notificar_mencionado IS
    'Solo para novedades: si está en true, se avisa también al mencionado (personal) o a los representantes (alumno).';

ALTER TABLE public.correo_config DROP CONSTRAINT IF EXISTS ck_corcfg_tipo;
ALTER TABLE public.correo_config ADD CONSTRAINT ck_corcfg_tipo
    CHECK (corcfg_tipo IN ('inscripciones', 'inscripciones_aviso', 'novedades'));

INSERT INTO public.correo_config (corcfg_tipo, corcfg_nombre, corcfg_usuario)
VALUES ('novedades', 'Novedades Activa Reforce', 'novedades')
ON CONFLICT (corcfg_tipo) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. Permisos del nuevo módulo
-- ---------------------------------------------------------------------

-- ver + crear para todos los roles existentes
INSERT INTO public.rol_permiso (rol_id, modulo, accion)
SELECT r.rol_id, 'novedades', a.accion
  FROM public.rol r
  CROSS JOIN (VALUES ('ver'), ('crear')) AS a(accion)
ON CONFLICT (rol_id, modulo, accion) DO NOTHING;

-- eliminar solo Propietario (1) y Admin (5)
INSERT INTO public.rol_permiso (rol_id, modulo, accion) VALUES
    (1, 'novedades', 'eliminar'),
    (5, 'novedades', 'eliminar')
ON CONFLICT (rol_id, modulo, accion) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. RLS y grants
-- ---------------------------------------------------------------------

ALTER TABLE public.novedad          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novedad          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.novedad_persona  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novedad_persona  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.novedad_alumno   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novedad_alumno   FORCE  ROW LEVEL SECURITY;

REVOKE ALL ON public.novedad         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.novedad_persona FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.novedad_alumno  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.novedad         TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.novedad_persona TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.novedad_alumno  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.novedad_nov_id_seq TO service_role;

-- ---------------------------------------------------------------------
-- 5. Guardas
-- ---------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.correo_config WHERE corcfg_tipo = 'novedades') THEN
        RAISE EXCEPTION 'No quedó la fila de novedades en correo_config';
    END IF;
    IF (SELECT count(*) FROM public.rol_permiso WHERE modulo = 'novedades' AND accion = 'ver') = 0 THEN
        RAISE EXCEPTION 'Nadie tiene novedades:ver';
    END IF;
    IF (SELECT count(*) FROM public.rol_permiso WHERE modulo = 'novedades' AND accion = 'eliminar') = 0 THEN
        RAISE EXCEPTION 'Nadie tiene novedades:eliminar';
    END IF;
    IF has_table_privilege('anon', 'public.novedad', 'SELECT') THEN
        RAISE EXCEPTION 'anon puede leer novedad';
    END IF;
END $$;

COMMIT;
