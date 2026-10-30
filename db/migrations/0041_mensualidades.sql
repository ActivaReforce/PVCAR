-- =====================================================================
-- PVCAR — 0041_mensualidades.sql
-- Mensualidades (pedido del cliente, 2026-10-30).
--
-- La inscripción paga el primer mes. Desde ahí, cada mes de cada alumno es
-- una cuota que el representante paga desde su cuenta (o desde
-- /inscripcion → "Pagar mensualidad") subiendo un comprobante, y el
-- personal la aprueba o la rechaza. Diseño en docs/mensualidades.md.
--
-- Qué hace
--
-- 1. inscripcion_config: día límite de pago, día de corte de la inscripción
--    y el interruptor del recordatorio por correo.
-- 2. colegio_precio: meses que se cobran (el resto, pausa) y desde qué mes.
--    Vacío / nulo = ese colegio aún no cobra mensualidades: nada cambia
--    hasta que el Propietario lo configure.
-- 3. mensualidad_pago (un comprobante) y mensualidad_cuota (un mes de un
--    alumno pagado con ese comprobante). Rechazar borra las cuotas y deja
--    el pago con su motivo hasta que el representante vuelve a intentar,
--    que lo borra del todo.
-- 4. Fila 'mensualidades' en correo_config (remitente del recordatorio).
-- 5. Permiso Ver de Inscripciones para el Representante (rol 4): es donde
--    paga y ve su historial.
--
-- Solo añade: el código desplegado sigue funcionando con ella aplicada.
-- Requiere 0001-0040. Idempotente. Todo en una transacción. Igual en dev y
-- en prod.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Configuración general
-- ---------------------------------------------------------------------
ALTER TABLE public.inscripcion_config
    ADD COLUMN IF NOT EXISTS inscfg_mens_dia_limite   smallint NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS inscfg_mens_dia_corte    smallint NOT NULL DEFAULT 20,
    ADD COLUMN IF NOT EXISTS inscfg_mens_recordatorio boolean  NOT NULL DEFAULT false;

ALTER TABLE public.inscripcion_config DROP CONSTRAINT IF EXISTS ck_inscfg_mens_dia_limite;
ALTER TABLE public.inscripcion_config ADD CONSTRAINT ck_inscfg_mens_dia_limite
    CHECK (inscfg_mens_dia_limite BETWEEN 1 AND 28);
ALTER TABLE public.inscripcion_config DROP CONSTRAINT IF EXISTS ck_inscfg_mens_dia_corte;
ALTER TABLE public.inscripcion_config ADD CONSTRAINT ck_inscfg_mens_dia_corte
    CHECK (inscfg_mens_dia_corte BETWEEN 1 AND 28);

COMMENT ON COLUMN public.inscripcion_config.inscfg_mens_dia_limite IS
    'Día del mes hasta el que se paga la mensualidad. Después, la cuota sale como atrasada. No bloquea nada.';
COMMENT ON COLUMN public.inscripcion_config.inscfg_mens_dia_corte IS
    'Una inscripción enviada desde este día (hora de Ecuador) paga el mes siguiente, no el suyo.';
COMMENT ON COLUMN public.inscripcion_config.inscfg_mens_recordatorio IS
    'Recordatorio por correo a quien no ha pagado el mes.';

-- ---------------------------------------------------------------------
-- 2. Por colegio
-- ---------------------------------------------------------------------
ALTER TABLE public.colegio_precio
    ADD COLUMN IF NOT EXISTS colpre_meses_cobro smallint[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS colpre_cobro_desde date;

ALTER TABLE public.colegio_precio DROP CONSTRAINT IF EXISTS ck_colpre_meses_cobro;
ALTER TABLE public.colegio_precio ADD CONSTRAINT ck_colpre_meses_cobro
    CHECK (colpre_meses_cobro <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]);
ALTER TABLE public.colegio_precio DROP CONSTRAINT IF EXISTS ck_colpre_cobro_desde;
ALTER TABLE public.colegio_precio ADD CONSTRAINT ck_colpre_cobro_desde
    CHECK (colpre_cobro_desde IS NULL OR extract(day FROM colpre_cobro_desde) = 1);

COMMENT ON COLUMN public.colegio_precio.colpre_meses_cobro IS
    'Meses (1-12) en que se cobra la mensualidad. Los demás quedan en pausa. Vacío = no cobra.';
COMMENT ON COLUMN public.colegio_precio.colpre_cobro_desde IS
    'Primer mes (día 1) que se cobra. Nulo = aún no cobra. Las inscripciones anteriores cubren este mes.';

-- ---------------------------------------------------------------------
-- 3. Pagos y cuotas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mensualidad_pago (
    menpag_id             integer       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    menpag_estado         text          NOT NULL DEFAULT 'pendiente',
    menpag_fecha          timestamptz   NOT NULL DEFAULT now(),
    usu_id                integer       REFERENCES public.usuario(usu_id) ON DELETE SET NULL,
    menpag_comprobante    text          NOT NULL,
    menpag_subtotal       numeric(10,2) NOT NULL,
    menpag_iva            numeric(10,2) NOT NULL,
    menpag_total          numeric(10,2) NOT NULL,
    -- Copia de lo que pagó (alumno, colegio, mes, disciplinas, importes):
    -- se sigue viendo aunque se rechace o se borre el alumno.
    menpag_detalle        jsonb         NOT NULL,
    menpag_motivo         text,
    menpag_revisado_por   integer       REFERENCES public.usuario(usu_id) ON DELETE SET NULL,
    menpag_fecha_revision timestamptz,
    menpag_ip             text,
    menpag_navegador      text,
    CONSTRAINT ck_menpag_estado CHECK (menpag_estado IN ('pendiente', 'aprobado', 'rechazado')),
    CONSTRAINT ck_menpag_revision CHECK (
        (menpag_estado = 'pendiente') = (menpag_fecha_revision IS NULL)
    ),
    CONSTRAINT ck_menpag_motivo CHECK (
        (menpag_estado = 'rechazado') = (menpag_motivo IS NOT NULL)
        AND (menpag_motivo IS NULL OR length(btrim(menpag_motivo)) BETWEEN 1 AND 500)
    ),
    CONSTRAINT ck_menpag_total CHECK (menpag_total >= 0)
);

COMMENT ON TABLE public.mensualidad_pago IS
    'Un comprobante de mensualidad. Pendiente, aprobado o rechazado (con motivo, hasta que el representante vuelve a intentar).';

CREATE INDEX IF NOT EXISTS idx_menpag_estado_fecha ON public.mensualidad_pago (menpag_estado, menpag_fecha DESC);
CREATE INDEX IF NOT EXISTS idx_menpag_usuario ON public.mensualidad_pago (usu_id);

CREATE TABLE IF NOT EXISTS public.mensualidad_cuota (
    mencuo_id          integer       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    menpag_id          integer       NOT NULL REFERENCES public.mensualidad_pago(menpag_id) ON DELETE CASCADE,
    -- SET NULL: borrar un alumno no borra la contabilidad.
    nino_id            integer       REFERENCES public.nino(nino_id) ON DELETE SET NULL,
    mencuo_nino_nombre text          NOT NULL,
    col_id             integer       REFERENCES public.colegio(col_id) ON DELETE SET NULL,
    mencuo_mes         date          NOT NULL,
    mencuo_disciplinas text[]        NOT NULL,
    mencuo_subtotal    numeric(10,2) NOT NULL,
    mencuo_descuento   numeric(10,2) NOT NULL DEFAULT 0,
    mencuo_iva         numeric(10,2) NOT NULL,
    mencuo_total       numeric(10,2) NOT NULL,
    CONSTRAINT ck_mencuo_mes CHECK (extract(day FROM mencuo_mes) = 1),
    CONSTRAINT ck_mencuo_total CHECK (mencuo_total >= 0)
);

COMMENT ON TABLE public.mensualidad_cuota IS
    'Un mes de un alumno, pagado (o en revisión) con un comprobante. Un mes de un alumno se paga una sola vez.';

-- Un mes de un alumno, una sola vez (en revisión o aprobado: el rechazado ya no tiene cuotas).
CREATE UNIQUE INDEX IF NOT EXISTS uq_mencuo_nino_mes
    ON public.mensualidad_cuota (nino_id, mencuo_mes) WHERE nino_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mencuo_pago ON public.mensualidad_cuota (menpag_id);
CREATE INDEX IF NOT EXISTS idx_mencuo_mes ON public.mensualidad_cuota (mencuo_mes);

ALTER TABLE public.mensualidad_pago  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensualidad_pago  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.mensualidad_cuota ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensualidad_cuota FORCE  ROW LEVEL SECURITY;

REVOKE ALL ON public.mensualidad_pago, public.mensualidad_cuota FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensualidad_pago, public.mensualidad_cuota TO service_role;

-- ---------------------------------------------------------------------
-- 4. Remitente del recordatorio
-- ---------------------------------------------------------------------
ALTER TABLE public.correo_config DROP CONSTRAINT IF EXISTS ck_corcfg_tipo;
ALTER TABLE public.correo_config ADD CONSTRAINT ck_corcfg_tipo
    CHECK (corcfg_tipo IN ('inscripciones', 'inscripciones_aviso', 'novedades', 'ausencias', 'mensualidades'));

INSERT INTO public.correo_config (corcfg_tipo, corcfg_nombre, corcfg_usuario)
VALUES ('mensualidades', 'Mensualidades Activa Reforce', 'inscripciones')
ON CONFLICT (corcfg_tipo) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. El representante ve Inscripciones (las suyas y sus mensualidades)
-- ---------------------------------------------------------------------
INSERT INTO public.rol_permiso (rol_id, modulo, accion)
VALUES (4, 'inscripciones', 'ver')
ON CONFLICT (rol_id, modulo, accion) DO NOTHING;

-- ---------------------------------------------------------------------
-- Guarda de salida
-- ---------------------------------------------------------------------
DO $$
DECLARE
    columnas  int;
    sin_rls   int;
    expuestas int;
BEGIN
    SELECT count(*) INTO columnas
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name::text, column_name::text) IN (
          ('inscripcion_config', 'inscfg_mens_dia_limite'),
          ('inscripcion_config', 'inscfg_mens_dia_corte'),
          ('inscripcion_config', 'inscfg_mens_recordatorio'),
          ('colegio_precio', 'colpre_meses_cobro'),
          ('colegio_precio', 'colpre_cobro_desde'));
    IF columnas <> 5 THEN
        RAISE EXCEPTION 'Faltan columnas de configuración (hay % de 5)', columnas;
    END IF;

    SELECT count(*) INTO sin_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname IN ('mensualidad_pago', 'mensualidad_cuota')
      AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);
    IF sin_rls > 0 THEN
        RAISE EXCEPTION 'Hay % tabla(s) de mensualidades sin RLS', sin_rls;
    END IF;

    SELECT count(*) INTO expuestas
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname IN ('mensualidad_pago', 'mensualidad_cuota')
      AND (has_table_privilege('anon', c.oid, 'SELECT')
        OR has_table_privilege('authenticated', c.oid, 'SELECT'));
    IF expuestas > 0 THEN
        RAISE EXCEPTION 'Hay % tabla(s) de mensualidades legibles por anon o authenticated', expuestas;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.correo_config WHERE corcfg_tipo = 'mensualidades') THEN
        RAISE EXCEPTION 'No quedó la fila de mensualidades en correo_config';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.rol_permiso
                    WHERE rol_id = 4 AND modulo = 'inscripciones' AND accion = 'ver') THEN
        RAISE EXCEPTION 'El Representante no quedó con Ver en Inscripciones';
    END IF;
END $$;

COMMIT;
