-- =====================================================================
-- PVCAR — 0006_auditoria.sql
-- Registro de acciones sensibles. Primera migración de la Fase 6.
--
-- Requiere 0001-0005 aplicados. Va en PVCAR_Dev y en PVCAR.
-- Idempotente. Todo en una transacción.
--
-- ---------------------------------------------------------------------
-- Por qué
--
-- El cliente pidió (2026-08-07) que además de la baja lógica exista el
-- borrado permanente. El esquema ya arrastra en cascada: borrar un niño
-- destruye asignaciones, asistencias, evaluaciones pendientes e intentos.
-- Es lo que se quiere, pero hoy ocurriría sin dejar rastro de quién lo
-- hizo. Esta tabla es ese rastro.
--
-- No sustituye a un log de auditoría por trigger sobre todas las tablas:
-- se escribe explícitamente desde el backend, solo en las operaciones
-- que importan (alta, edición, baja, reactivación, borrado permanente y
-- cambios de roles o de permisos de rol).
--
-- ---------------------------------------------------------------------
-- Dos decisiones del diseño
--
-- 1. `aud_actor_correo` duplica el correo del actor a propósito. La FK a
--    usuario es ON DELETE SET NULL: si mañana se borra al que borró, el
--    registro tiene que seguir diciendo quién fue.
-- 2. `aud_entidad_id` es text, no integer. Las claves del esquema son
--    integer hoy, pero la tabla debe servir para cualquier entidad sin
--    volver a migrarse.
--
-- No lleva FK a la entidad afectada: el registro tiene que sobrevivir
-- justo a la fila que se borró.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.auditoria (
    aud_id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aud_fecha        timestamptz NOT NULL DEFAULT now(),
    aud_actor_id     integer     NULL REFERENCES public.usuario(usu_id) ON DELETE SET NULL,
    aud_actor_correo text        NOT NULL,
    aud_accion       text        NOT NULL,
    aud_entidad      text        NOT NULL,
    aud_entidad_id   text        NOT NULL,
    aud_detalle      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT auditoria_accion_check CHECK (aud_accion IN (
        'crear', 'editar', 'baja', 'reactivar', 'eliminar', 'roles', 'permisos'
    ))
);

COMMENT ON TABLE  public.auditoria IS
    'Acciones sensibles escritas por el backend. Ver 0006_auditoria.sql.';
COMMENT ON COLUMN public.auditoria.aud_actor_correo IS
    'Copia del correo del actor: sobrevive al borrado de su usuario.';
COMMENT ON COLUMN public.auditoria.aud_detalle IS
    'Contexto de la acción: qué cambió, y en los borrados el recuento de lo destruido.';

-- Las dos consultas previstas: "historial de esta fila" y "lo último que pasó".
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad
    ON public.auditoria (aud_entidad, aud_entidad_id, aud_fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha
    ON public.auditoria (aud_fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_actor
    ON public.auditoria (aud_actor_id);

-- ---------------------------------------------------------------------
-- Misma cerradura que el resto del esquema (0002 y 0005): RLS activo y
-- forzado, cero políticas, y solo service_role con privilegios. El pool
-- del backend entra como postgres, que tiene BYPASSRLS.
-- ---------------------------------------------------------------------
ALTER TABLE public.auditoria ENABLE  ROW LEVEL SECURITY;
ALTER TABLE public.auditoria FORCE   ROW LEVEL SECURITY;

REVOKE ALL ON public.auditoria FROM anon, authenticated;
GRANT SELECT, INSERT ON public.auditoria TO service_role;

-- ---------------------------------------------------------------------
-- Comprobación dentro de la misma transacción.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    rls_ok      boolean;
    force_ok    boolean;
    fuga        integer;
    indices     integer;
BEGIN
    SELECT c.relrowsecurity, c.relforcerowsecurity
      INTO rls_ok, force_ok
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'auditoria';

    IF NOT rls_ok OR NOT force_ok THEN
        RAISE EXCEPTION 'auditoria quedó sin RLS activo y forzado.';
    END IF;

    SELECT count(*) INTO fuga
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'auditoria'
       AND (has_table_privilege('anon', c.oid, 'SELECT')
         OR has_table_privilege('anon', c.oid, 'INSERT')
         OR has_table_privilege('authenticated', c.oid, 'SELECT')
         OR has_table_privilege('authenticated', c.oid, 'INSERT'));

    IF fuga > 0 THEN
        RAISE EXCEPTION 'anon o authenticated conservan privilegios sobre auditoria.';
    END IF;

    SELECT count(*) INTO indices
      FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'auditoria';

    IF indices < 4 THEN
        RAISE EXCEPTION 'auditoria tiene % índices, se esperaban 4 (PK + 3).', indices;
    END IF;
END
$$;

COMMIT;
