-- =====================================================================
-- PVCAR — 0014_inscripciones.sql
-- Inscripciones públicas: el representante se inscribe solo desde un
-- link, y el Propietario aprueba o rechaza. Migración de la Fase 14B.
--
-- Requiere 0001-0013 aplicados.
-- Idempotente. Todo en una transacción.
--
-- **Solo añade.** No borra ni renombra nada, así que el código que hoy
-- está desplegado sigue funcionando con ella aplicada. Las columnas que
-- quedan de sobra (`entrenador.ent_cedula`, `nino.nino_edad`) se quitan
-- en una migración aparte cuando el código nuevo esté desplegado.
--
-- Diseño en docs/fase14b-inscripciones.md.
--
-- ---------------------------------------------------------------------
-- Qué hace
--
-- 1. `usuario.usu_cedula`, única. La cédula deja de ser un dato solo del
--    entrenador: el representante la necesita (es su contraseña inicial)
--    y sirve para reconocer a quien vuelve con otro correo. Se copia la
--    de `entrenador.ent_cedula`.
-- 2. `nino.nino_fecha_nacimiento`. La edad guardada queda vieja cada año.
-- 3. `nino_padre.ninopadre_parentesco`.
-- 4. `documento_legal`: contrato, términos y privacidad, versionados. Una
--    versión no se edita nunca: se publica otra.
-- 5. `inscripcion` (un envío del formulario) e `inscripcion_nino` (un
--    niño de ese envío, con su contrato). Mientras está pendiente, todo
--    vive aquí: el usuario, el niño y sus disciplinas se crean al
--    aprobar. Rechazar es borrar la fila.
-- 6. `nino_asignacion.insnino_id`: de qué inscripción vino el alta.
-- 7. Bucket privado `inscripciones` para comprobantes y contratos.
-- 8. Permisos del módulo `inscripciones` para el Propietario.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Guarda de entrada: dos usuarios con la misma cédula de entrenador
-- harían fallar el índice único más abajo con un error poco claro.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    repetidas int;
BEGIN
    SELECT count(*) INTO repetidas FROM (
        SELECT upper(trim(ent_cedula))
          FROM public.entrenador
         WHERE nullif(trim(ent_cedula), '') IS NOT NULL
         GROUP BY 1 HAVING count(*) > 1
    ) d;

    IF repetidas > 0 THEN
        RAISE EXCEPTION
            'Hay % cédula(s) de entrenador repetidas. Corregirlas antes de aplicar esta migración.', repetidas;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. Cédula en usuario
-- ---------------------------------------------------------------------
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS usu_cedula text;

UPDATE public.usuario u
   SET usu_cedula = trim(e.ent_cedula)
  FROM public.entrenador e
 WHERE e.ent_id = u.usu_id
   AND u.usu_cedula IS NULL
   AND nullif(trim(e.ent_cedula), '') IS NOT NULL;

-- Mayúsculas porque un pasaporte lleva letras.
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_cedula
    ON public.usuario (upper(trim(usu_cedula)))
    WHERE usu_cedula IS NOT NULL;

COMMENT ON COLUMN public.usuario.usu_cedula IS
    'Cédula o pasaporte. Única. Contraseña inicial de los representantes inscritos por el formulario.';

-- ---------------------------------------------------------------------
-- 2. Fecha de nacimiento del niño
-- ---------------------------------------------------------------------
ALTER TABLE public.nino ADD COLUMN IF NOT EXISTS nino_fecha_nacimiento date;

-- ---------------------------------------------------------------------
-- 3. Parentesco
-- ---------------------------------------------------------------------
ALTER TABLE public.nino_padre ADD COLUMN IF NOT EXISTS ninopadre_parentesco text;

-- ---------------------------------------------------------------------
-- 4. Documentos legales
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documento_legal (
    doc_id         integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_tipo       text        NOT NULL,
    doc_version    integer     NOT NULL,
    doc_titulo     text        NOT NULL,
    doc_contenido  text        NOT NULL,
    doc_fecha      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_documento_tipo    CHECK (doc_tipo IN ('contrato', 'terminos', 'privacidad')),
    CONSTRAINT ck_documento_version CHECK (doc_version >= 1),
    CONSTRAINT uq_documento_tipo_version UNIQUE (doc_tipo, doc_version)
);

COMMENT ON TABLE public.documento_legal IS
    'Contrato, términos y privacidad. La versión vigente de cada tipo es la de número más alto. Una versión no se edita: se inserta otra.';

-- Que una versión ya aceptada no cambie por debajo de quien la aceptó.
CREATE OR REPLACE FUNCTION public.documento_legal_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'Un documento legal no se edita: publicar una versión nueva (doc_tipo %, versión %).',
        OLD.doc_tipo, OLD.doc_version;
END;
$$;

DROP TRIGGER IF EXISTS trg_documento_legal_inmutable ON public.documento_legal;
CREATE TRIGGER trg_documento_legal_inmutable
    BEFORE UPDATE ON public.documento_legal
    FOR EACH ROW EXECUTE FUNCTION public.documento_legal_inmutable();

-- ---------------------------------------------------------------------
-- 5. Inscripciones
--
-- Los datos del formulario van en jsonb a propósito: los campos exactos
-- todavía no están cerrados con el cliente, y lo que se guarda aquí es
-- la copia fiel de lo que el representante envió y firmó. Al aprobar se
-- pasa a las columnas de usuario, padre y nino.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inscripcion (
    ins_id                integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ins_estado            text        NOT NULL DEFAULT 'pendiente',
    ins_fecha             timestamptz NOT NULL DEFAULT now(),
    ins_representante     jsonb       NOT NULL,
    ins_comprobante       text        NOT NULL,
    doc_contrato_id       integer     NOT NULL REFERENCES public.documento_legal(doc_id),
    doc_terminos_id       integer     NOT NULL REFERENCES public.documento_legal(doc_id),
    doc_privacidad_id     integer     NOT NULL REFERENCES public.documento_legal(doc_id),
    ins_ip                text,
    ins_navegador         text,
    usu_id                integer     REFERENCES public.usuario(usu_id) ON DELETE SET NULL,
    ins_aprobada_por      integer     REFERENCES public.usuario(usu_id) ON DELETE SET NULL,
    ins_fecha_aprobacion  timestamptz,
    CONSTRAINT ck_inscripcion_estado CHECK (ins_estado IN ('pendiente', 'aprobada')),
    -- Aprobada si y solo si tiene fecha de aprobación.
    CONSTRAINT ck_inscripcion_aprobacion CHECK (
        (ins_estado = 'aprobada') = (ins_fecha_aprobacion IS NOT NULL)
    )
);

COMMENT ON TABLE public.inscripcion IS
    'Un envío del formulario público. Pendiente o aprobada; rechazar la borra.';
COMMENT ON COLUMN public.inscripcion.usu_id IS
    'El representante creado o encontrado al aprobar. Nulo mientras está pendiente.';

CREATE INDEX IF NOT EXISTS idx_inscripcion_estado_fecha
    ON public.inscripcion (ins_estado, ins_fecha DESC);

CREATE TABLE IF NOT EXISTS public.inscripcion_nino (
    insnino_id               integer   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ins_id                   integer   NOT NULL REFERENCES public.inscripcion(ins_id) ON DELETE CASCADE,
    insnino_orden            smallint  NOT NULL,
    insnino_datos            jsonb     NOT NULL,
    -- Ids de colegio_actividad_horario. Sin FK a propósito: una disciplina
    -- que se borra no debe quedar bloqueada por una inscripción pendiente.
    -- Al aprobar se comprueba que sigan existiendo y activas.
    insnino_disciplinas      integer[] NOT NULL,
    insnino_contrato         text      NOT NULL,
    insnino_contrato_sha256  text      NOT NULL,
    nino_id                  integer   REFERENCES public.nino(nino_id) ON DELETE SET NULL,
    CONSTRAINT ck_insnino_orden       CHECK (insnino_orden >= 1),
    CONSTRAINT ck_insnino_disciplinas CHECK (cardinality(insnino_disciplinas) >= 1),
    CONSTRAINT ck_insnino_sha256      CHECK (insnino_contrato_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT uq_insnino_orden UNIQUE (ins_id, insnino_orden)
);

COMMENT ON TABLE public.inscripcion_nino IS
    'Un niño de una inscripción, con su contrato en PDF. nino_id se llena al aprobar.';

-- ---------------------------------------------------------------------
-- 6. De qué inscripción vino un alta en una disciplina
-- ---------------------------------------------------------------------
ALTER TABLE public.nino_asignacion
    ADD COLUMN IF NOT EXISTS insnino_id integer
    REFERENCES public.inscripcion_nino(insnino_id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- Seguridad de las tablas nuevas: igual que las demás (0002 y 0005).
-- Nadie entra salvo el backend con service_role.
-- ---------------------------------------------------------------------
ALTER TABLE public.documento_legal  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documento_legal  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.inscripcion      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscripcion      FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.inscripcion_nino ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscripcion_nino FORCE  ROW LEVEL SECURITY;

REVOKE ALL ON public.documento_legal, public.inscripcion, public.inscripcion_nino
    FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.documento_legal, public.inscripcion, public.inscripcion_nino
    TO service_role;

REVOKE EXECUTE ON FUNCTION public.documento_legal_inmutable() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Bucket privado. 2 MB: el comprobante llega comprimido desde el
-- navegador y el contrato es un PDF de solo texto.
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'inscripciones',
    'inscripciones',
    false,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public             = EXCLUDED.public,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 8. Permisos: ver la lista, aprobar (editar) y rechazar (eliminar).
-- Solo el Propietario (rol 1).
-- ---------------------------------------------------------------------
INSERT INTO public.rol_permiso (rol_id, modulo, accion)
VALUES (1, 'inscripciones', 'ver'),
       (1, 'inscripciones', 'editar'),
       (1, 'inscripciones', 'eliminar')
ON CONFLICT (rol_id, modulo, accion) DO NOTHING;

-- ---------------------------------------------------------------------
-- Guarda de salida
-- ---------------------------------------------------------------------
DO $$
DECLARE
    columnas   int;
    tablas     int;
    sin_rls    int;
    expuestas  int;
    publico    boolean;
    permisos   int;
    copiadas   int;
    origen     int;
BEGIN
    SELECT count(*) INTO columnas
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name::text, column_name::text) IN (('usuario', 'usu_cedula'),
                                        ('nino', 'nino_fecha_nacimiento'),
                                        ('nino_padre', 'ninopadre_parentesco'),
                                        ('nino_asignacion', 'insnino_id'));

    SELECT count(*) INTO tablas
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname IN ('documento_legal', 'inscripcion', 'inscripcion_nino');

    SELECT count(*) INTO sin_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)
      AND c.relname IN ('documento_legal', 'inscripcion', 'inscripcion_nino');

    SELECT count(*) INTO expuestas
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname IN ('documento_legal', 'inscripcion', 'inscripcion_nino')
      AND (has_table_privilege('anon', c.oid, 'SELECT')
        OR has_table_privilege('anon', c.oid, 'INSERT')
        OR has_table_privilege('authenticated', c.oid, 'SELECT')
        OR has_table_privilege('authenticated', c.oid, 'INSERT'));

    SELECT public INTO publico FROM storage.buckets WHERE id = 'inscripciones';

    SELECT count(*) INTO permisos
    FROM public.rol_permiso WHERE rol_id = 1 AND modulo = 'inscripciones';

    SELECT count(*) INTO origen
    FROM public.entrenador WHERE nullif(trim(ent_cedula), '') IS NOT NULL;

    SELECT count(*) INTO copiadas
    FROM public.entrenador e JOIN public.usuario u ON u.usu_id = e.ent_id
    WHERE nullif(trim(e.ent_cedula), '') IS NOT NULL
      AND u.usu_cedula = trim(e.ent_cedula);

    IF columnas <> 4 THEN
        RAISE EXCEPTION 'Esperaba 4 columnas nuevas, hay %', columnas;
    END IF;
    IF tablas <> 3 THEN
        RAISE EXCEPTION 'Esperaba 3 tablas nuevas, hay %', tablas;
    END IF;
    IF sin_rls <> 0 THEN
        RAISE EXCEPTION '% tabla(s) nuevas sin RLS forzado', sin_rls;
    END IF;
    IF expuestas <> 0 THEN
        RAISE EXCEPTION '% tabla(s) nuevas abiertas a anon o authenticated', expuestas;
    END IF;
    IF publico IS DISTINCT FROM false THEN
        RAISE EXCEPTION 'El bucket inscripciones no existe o quedó público';
    END IF;
    IF permisos <> 3 THEN
        RAISE EXCEPTION 'Esperaba 3 permisos de inscripciones para el Propietario, hay %', permisos;
    END IF;
    IF copiadas <> origen THEN
        RAISE EXCEPTION 'Se copiaron % de % cédulas de entrenador', copiadas, origen;
    END IF;
END $$;

COMMIT;
