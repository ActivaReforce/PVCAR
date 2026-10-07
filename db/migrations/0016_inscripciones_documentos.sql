-- =====================================================================
-- PVCAR — 0016_inscripciones_documentos.sql
-- Los seis documentos de la inscripción, su constancia y los datos que
-- piden las fichas del cliente (Contratos/, versión del 2026-10-05).
-- Tercera migración de la Fase 14B. Diseño en docs/fase14b-contratos.md.
--
-- Requiere 0014 y 0015 aplicadas. Todo en una transacción.
--
-- **Cambia tablas de 0014 que están vacías** en dev y en prod (verificado
-- por MCP el 2026-10-05: 0 inscripciones, 0 documentos, 0 precios). Si
-- alguna tuviera filas, la guarda de entrada aborta sin tocar nada.
--
-- ---------------------------------------------------------------------
-- Qué hace
--
-- 1. `documento_legal`: seis tipos en vez de tres —política,
--    autorización de datos, datos médicos, imagen (los "00", iguales
--    para todos), ficha de matrícula ("01") y contrato ("02").
-- 2. `colegio_precio`: los datos del colegio que llevan la ficha y el
--    contrato (nombre de la sede, sede corta, institución, mínimo de
--    alumnos por grupo). Una plantilla por documento, no una por colegio.
-- 3. `inscripcion_config`: una sola fila con el IVA y el membrete.
-- 4. `inscripcion`: fuera las tres columnas de documentos aceptados; las
--    sustituye la constancia (5).
-- 5. `inscripcion_aceptacion`: la constancia. Una fila por alumno y
--    documento: versión, sha256 del texto exacto que vio ya rellenado,
--    lo que marcó y cuándo.
-- 6. `inscripcion_nino`: el PDF pasa a ser el paquete de los seis
--    documentos, y al aprobar se guarda otro con el "Aprobado por".
-- 7. Lo que la ficha pide y nace al aprobar: datos de factura en
--    `padre`; modalidad de salida, detalle del retiro, permisos de
--    imagen y de salud en `nino`; contactos de emergencia y de retiro en
--    `nino_contacto` (nueva).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Guarda de entrada: las tablas que se reestructuran tienen que estar vacías.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    inscripciones int;
    documentos    int;
    precios       int;
BEGIN
    SELECT count(*) INTO inscripciones FROM public.inscripcion;
    SELECT count(*) INTO documentos    FROM public.documento_legal;
    SELECT count(*) INTO precios       FROM public.colegio_precio;
    IF inscripciones > 0 OR documentos > 0 OR precios > 0 THEN
        RAISE EXCEPTION 'Se esperaban vacías: inscripcion (%), documento_legal (%), colegio_precio (%)',
            inscripciones, documentos, precios;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. Seis tipos de documento
-- ---------------------------------------------------------------------
ALTER TABLE public.documento_legal DROP CONSTRAINT IF EXISTS ck_documento_tipo;
ALTER TABLE public.documento_legal ADD CONSTRAINT ck_documento_tipo CHECK (doc_tipo IN (
    'politica', 'autorizacion_datos', 'datos_medicos', 'imagen', 'ficha_matricula', 'contrato'
));

COMMENT ON TABLE public.documento_legal IS
    'Los seis documentos de la inscripción, versionados. Una plantilla por tipo para todos los colegios; los datos de cada colegio están en colegio_precio. La vigente es la publicada de número más alto.';

-- ---------------------------------------------------------------------
-- 2. Datos del colegio para los documentos
-- ---------------------------------------------------------------------
ALTER TABLE public.colegio_precio
    ADD COLUMN IF NOT EXISTS colpre_sede            text     NOT NULL,
    ADD COLUMN IF NOT EXISTS colpre_sede_corta      text     NOT NULL,
    ADD COLUMN IF NOT EXISTS colpre_institucion     text     NOT NULL,
    ADD COLUMN IF NOT EXISTS colpre_minimo_alumnos  smallint NOT NULL;

ALTER TABLE public.colegio_precio DROP CONSTRAINT IF EXISTS ck_colpre_minimo;
ALTER TABLE public.colegio_precio ADD CONSTRAINT ck_colpre_minimo CHECK (colpre_minimo_alumnos > 0);

COMMENT ON COLUMN public.colegio_precio.colpre_sede IS
    'Como lo nombran la ficha y el contrato: "Colegio CRISFE Carcelén".';
COMMENT ON COLUMN public.colegio_precio.colpre_sede_corta IS
    'Para la tarifa y el mínimo del contrato: "Carcelén".';
COMMENT ON COLUMN public.colegio_precio.colpre_institucion IS
    'La institución en las cláusulas (enfermería, mora, salidas): "CRISFE".';

-- ---------------------------------------------------------------------
-- 3. Configuración: IVA y membrete
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inscripcion_config (
    inscfg_id                  smallint     PRIMARY KEY DEFAULT 1,
    inscfg_iva_pct             numeric(5,2) NOT NULL DEFAULT 15,
    inscfg_membrete            text,
    inscfg_fecha_modificacion  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_inscfg_una_fila CHECK (inscfg_id = 1),
    CONSTRAINT ck_inscfg_iva      CHECK (inscfg_iva_pct >= 0 AND inscfg_iva_pct <= 100)
);

COMMENT ON TABLE public.inscripcion_config IS
    'Una sola fila. inscfg_membrete: ruta en el bucket inscripciones; nulo = el membrete de serie del generador.';

INSERT INTO public.inscripcion_config (inscfg_id) VALUES (1) ON CONFLICT (inscfg_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. Fuera las tres columnas de documentos aceptados
-- ---------------------------------------------------------------------
ALTER TABLE public.inscripcion
    DROP COLUMN IF EXISTS doc_contrato_id,
    DROP COLUMN IF EXISTS doc_terminos_id,
    DROP COLUMN IF EXISTS doc_privacidad_id;

-- ---------------------------------------------------------------------
-- 6. El paquete de documentos de cada alumno
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'inscripcion_nino'
                  AND column_name = 'insnino_contrato') THEN
        ALTER TABLE public.inscripcion_nino RENAME COLUMN insnino_contrato        TO insnino_pdf;
        ALTER TABLE public.inscripcion_nino RENAME COLUMN insnino_contrato_sha256 TO insnino_pdf_sha256;
    END IF;
END $$;

ALTER TABLE public.inscripcion_nino
    ADD COLUMN IF NOT EXISTS insnino_pdf_aprobado        text,
    ADD COLUMN IF NOT EXISTS insnino_pdf_aprobado_sha256 text;

ALTER TABLE public.inscripcion_nino DROP CONSTRAINT IF EXISTS ck_insnino_sha256_aprobado;
ALTER TABLE public.inscripcion_nino ADD CONSTRAINT ck_insnino_sha256_aprobado CHECK (
    (insnino_pdf_aprobado IS NULL) = (insnino_pdf_aprobado_sha256 IS NULL)
    AND (insnino_pdf_aprobado_sha256 IS NULL OR insnino_pdf_aprobado_sha256 ~ '^[0-9a-f]{64}$')
);

COMMENT ON COLUMN public.inscripcion_nino.insnino_pdf IS
    'Los seis documentos del alumno, llenos, con la hoja de constancias. Lo que se descargó al enviar.';
COMMENT ON COLUMN public.inscripcion_nino.insnino_pdf_aprobado IS
    'El mismo paquete con "Aprobado por" bajo la firma de Activa. Nace al aprobar.';

-- ---------------------------------------------------------------------
-- 5. La constancia
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inscripcion_aceptacion (
    acep_id            integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ins_id             integer     NOT NULL REFERENCES public.inscripcion(ins_id) ON DELETE CASCADE,
    insnino_id         integer     NOT NULL REFERENCES public.inscripcion_nino(insnino_id) ON DELETE CASCADE,
    doc_id             integer     NOT NULL REFERENCES public.documento_legal(doc_id),
    acep_texto_sha256  text        NOT NULL,
    acep_opciones      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    acep_fecha         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_acep_sha256 CHECK (acep_texto_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT uq_acep_nino_documento UNIQUE (insnino_id, doc_id)
);

COMMENT ON TABLE public.inscripcion_aceptacion IS
    'Constancia de cada documento aceptado: alumno, versión, sha256 del texto rellenado que vio, lo que marcó y cuándo. La IP y el navegador están en inscripcion.';

CREATE INDEX IF NOT EXISTS idx_acep_ins ON public.inscripcion_aceptacion (ins_id);
CREATE INDEX IF NOT EXISTS idx_acep_doc ON public.inscripcion_aceptacion (doc_id);

-- ---------------------------------------------------------------------
-- 7. Lo que nace al aprobar
-- ---------------------------------------------------------------------
ALTER TABLE public.padre
    ADD COLUMN IF NOT EXISTS padre_factura_nombre         text,
    ADD COLUMN IF NOT EXISTS padre_factura_identificacion text,
    ADD COLUMN IF NOT EXISTS padre_factura_correo         text,
    ADD COLUMN IF NOT EXISTS padre_factura_direccion      text;

ALTER TABLE public.nino
    ADD COLUMN IF NOT EXISTS nino_modalidad_salida    text,
    ADD COLUMN IF NOT EXISTS nino_detalle_retiro      text,
    ADD COLUMN IF NOT EXISTS nino_salud_autorizada    boolean,
    ADD COLUMN IF NOT EXISTS nino_imagen_familias     boolean,
    ADD COLUMN IF NOT EXISTS nino_imagen_redes        boolean,
    ADD COLUMN IF NOT EXISTS nino_imagen_promocional  boolean;

ALTER TABLE public.nino DROP CONSTRAINT IF EXISTS ck_nino_modalidad_salida;
ALTER TABLE public.nino ADD CONSTRAINT ck_nino_modalidad_salida
    CHECK (nino_modalidad_salida IS NULL OR nino_modalidad_salida IN ('escolar', 'privado'));

COMMENT ON COLUMN public.nino.nino_imagen_familias IS
    'Permiso de imagen: compartir con las familias del grupo. Nulo = nunca se preguntó (alumno anterior a la inscripción en línea).';

CREATE TABLE IF NOT EXISTS public.nino_contacto (
    nincon_id        integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nino_id          integer     NOT NULL REFERENCES public.nino(nino_id) ON DELETE CASCADE,
    nincon_tipo      text        NOT NULL,
    nincon_nombre    text        NOT NULL,
    nincon_cedula    text,
    nincon_relacion  text        NOT NULL,
    nincon_telefono  text        NOT NULL,
    nincon_fecha_creacion timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_nincon_tipo CHECK (nincon_tipo IN ('emergencia', 'retiro')),
    -- La ficha pide una persona autorizada para retirar y un contacto de emergencia.
    CONSTRAINT uq_nincon_nino_tipo UNIQUE (nino_id, nincon_tipo)
);

COMMENT ON TABLE public.nino_contacto IS
    'Contacto alterno de emergencia y persona autorizada para retirar al alumno (ficha de matrícula, secciones C y D).';

-- ---------------------------------------------------------------------
-- Seguridad de las tablas nuevas, como las demás (0002 y 0005).
-- ---------------------------------------------------------------------
ALTER TABLE public.inscripcion_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscripcion_config     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.inscripcion_aceptacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscripcion_aceptacion FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.nino_contacto          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nino_contacto          FORCE  ROW LEVEL SECURITY;

REVOKE ALL ON public.inscripcion_config, public.inscripcion_aceptacion, public.nino_contacto
    FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.inscripcion_config, public.inscripcion_aceptacion, public.nino_contacto
    TO service_role;

-- ---------------------------------------------------------------------
-- Guarda de salida
-- ---------------------------------------------------------------------
DO $$
DECLARE
    columnas   int;
    viejas     int;
    sin_rls    int;
    expuestas  int;
    config     int;
BEGIN
    SELECT count(*) INTO columnas
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name::text, column_name::text) IN (
          ('colegio_precio', 'colpre_sede'), ('colegio_precio', 'colpre_sede_corta'),
          ('colegio_precio', 'colpre_institucion'), ('colegio_precio', 'colpre_minimo_alumnos'),
          ('inscripcion_nino', 'insnino_pdf'), ('inscripcion_nino', 'insnino_pdf_sha256'),
          ('inscripcion_nino', 'insnino_pdf_aprobado'), ('inscripcion_nino', 'insnino_pdf_aprobado_sha256'),
          ('padre', 'padre_factura_nombre'), ('padre', 'padre_factura_identificacion'),
          ('padre', 'padre_factura_correo'), ('padre', 'padre_factura_direccion'),
          ('nino', 'nino_modalidad_salida'), ('nino', 'nino_detalle_retiro'),
          ('nino', 'nino_salud_autorizada'), ('nino', 'nino_imagen_familias'),
          ('nino', 'nino_imagen_redes'), ('nino', 'nino_imagen_promocional'));

    SELECT count(*) INTO viejas
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name::text, column_name::text) IN (
          ('inscripcion', 'doc_contrato_id'), ('inscripcion', 'doc_terminos_id'),
          ('inscripcion', 'doc_privacidad_id'), ('inscripcion_nino', 'insnino_contrato'));

    SELECT count(*) INTO sin_rls
    FROM pg_class
    WHERE oid IN ('public.inscripcion_config'::regclass, 'public.inscripcion_aceptacion'::regclass,
                  'public.nino_contacto'::regclass)
      AND NOT (relrowsecurity AND relforcerowsecurity);

    SELECT count(*) INTO expuestas
    FROM (VALUES ('public.inscripcion_config'), ('public.inscripcion_aceptacion'),
                 ('public.nino_contacto')) AS t(tabla)
    WHERE has_table_privilege('anon', t.tabla, 'SELECT')
       OR has_table_privilege('authenticated', t.tabla, 'SELECT');

    SELECT count(*) INTO config FROM public.inscripcion_config;

    IF columnas <> 18 THEN RAISE EXCEPTION 'Esperaba 18 columnas nuevas, hay %', columnas; END IF;
    IF viejas <> 0 THEN RAISE EXCEPTION 'Quedan % columnas viejas', viejas; END IF;
    IF sin_rls <> 0 THEN RAISE EXCEPTION '% tablas nuevas sin RLS forzado', sin_rls; END IF;
    IF expuestas <> 0 THEN RAISE EXCEPTION '% tablas nuevas abiertas a anon o authenticated', expuestas; END IF;
    IF config <> 1 THEN RAISE EXCEPTION 'inscripcion_config debería tener 1 fila y tiene %', config; END IF;
END $$;

COMMIT;
