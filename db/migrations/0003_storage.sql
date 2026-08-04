-- =====================================================================
-- PVCAR — 0003_storage.sql
-- Bucket usufoto, privado. Fotos de perfil de usuario.
--
-- Requiere 0001_baseline.sql y 0002_rls.sql aplicados.
-- Orden de ejecución: PVCAR_Dev primero. Solo si sale limpio, PVCAR.
-- Idempotente: correrlo dos veces deja el bucket igual, sin error.
--
-- ---------------------------------------------------------------------
-- Qué cambia respecto al sistema viejo
--
-- En la prod vieja el bucket es PÚBLICO: cualquiera con la URL ve las
-- 61 fotos, sin sesión. Aquí nace privado (public = false) y el acceso
-- es por URL firmada de corta vida que emite el backend (Anexo B).
--
-- El backend usa service_role, que tiene BYPASSRLS y no necesita
-- políticas. Por eso este archivo NO crea ninguna política sobre
-- storage.objects: sin políticas, la anon key no lee ni escribe nada.
--
-- ---------------------------------------------------------------------
-- Límites, medidos sobre las 61 fotos de la prod vieja
--
--   file_size_limit    = 512000 bytes (500 KB), el mismo de hoy.
--                        La foto más grande pesa 238 KB.
--   allowed_mime_types = jpeg, png, webp.
--                        Hoy hay 58 jpeg y 2 png; webp se admite para
--                        subidas nuevas. El bucket viejo no restringe
--                        el tipo, así que esto es más estricto.
--
-- Nota para el cutover: en el bucket viejo hay un objeto de más,
-- `.emptyFolderPlaceholder` (0 bytes, application/octet-stream), que
-- crea la consola de Supabase. No se copia: el filtro de MIME lo
-- rechazaría y no hace falta para nada.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Guarda previa: este archivo va después del RLS.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    sin_rls integer;
BEGIN
    SELECT count(*) INTO sin_rls
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

    IF sin_rls > 0 THEN
        RAISE EXCEPTION
            'Hay % tablas de public sin RLS. Aplicar 0002_rls.sql primero.', sin_rls;
    END IF;
END
$$;

-- ---------------------------------------------------------------------
-- El bucket. El ON CONFLICT es lo que lo hace repetible y además
-- corrige el bucket si alguien lo dejó público desde la consola.
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'usufoto',
    'usufoto',
    false,
    512000,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public             = EXCLUDED.public,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------
-- Comprobación final, dentro de la misma transacción.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    es_publico   boolean;
    politicas    integer;
    objects_rls  boolean;
BEGIN
    SELECT public INTO es_publico FROM storage.buckets WHERE id = 'usufoto';

    IF es_publico IS NULL THEN
        RAISE EXCEPTION 'El bucket usufoto no quedó creado.';
    END IF;

    IF es_publico THEN
        RAISE EXCEPTION 'El bucket usufoto quedó público y debe ser privado.';
    END IF;

    SELECT c.relrowsecurity INTO objects_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects';

    IF NOT objects_rls THEN
        RAISE EXCEPTION 'storage.objects quedó sin RLS.';
    END IF;

    SELECT count(*) INTO politicas
    FROM pg_policies WHERE schemaname = 'storage';

    IF politicas > 0 THEN
        RAISE EXCEPTION
            'Hay % politicas en storage y deben ser 0: el acceso va por URL firmada del backend.', politicas;
    END IF;
END
$$;

COMMIT;
