-- =====================================================================
-- PVCAR — 0005_grants.sql
-- Privilegios: cierra el hueco que RLS no cubre.
--
-- Requiere 0001-0003 aplicados. Va en PVCAR_Dev y en PVCAR.
-- Idempotente. Todo en una transacción.
--
-- ---------------------------------------------------------------------
-- Por qué hace falta, si ya hay RLS
--
-- RLS filtra filas. NO filtra funciones. En Postgres, una función sin
-- ACL explícita es ejecutable por PUBLIC, y una función SECURITY
-- DEFINER corre con los permisos de su dueño (postgres), así que
-- ignora RLS por completo.
--
-- Verificado con la anon key contra PVCAR_Dev el 2026-07-30:
--   POST /rest/v1/rpc/delete_student_evaluation  ->  HTTP 204
-- Es decir: cualquiera con la key del bundle podía invocar una función
-- que borra intentos de evaluación. Se probó con un id inexistente
-- (999999) y con la tabla vacía, así que no se borró nada.
--
-- Las tablas sí estaban cubiertas, pero por un accidente afortunado:
-- ni anon ni authenticated ni service_role tienen SELECT/INSERT/
-- UPDATE/DELETE sobre ellas (el ACL heredado solo trae D, x, t, m).
-- Eso también rompe al backend cuando use supabase-js con la
-- service-role key, porque BYPASSRLS no otorga privilegios.
--
-- ---------------------------------------------------------------------
-- Lo que deja este archivo
--
--   anon, authenticated : nada. Ni tablas, ni secuencias, ni funciones.
--   service_role        : SELECT/INSERT/UPDATE/DELETE, uso de
--                         secuencias y EXECUTE. Es el rol del backend.
--   postgres            : dueño, sin cambios (el pool `pg` del backend
--                         entra por aquí).
--
-- Doble cerradura sobre los datos: sin privilegios y, además, con RLS.
-- =====================================================================

BEGIN;

DO $$
DECLARE
    sin_rls integer;
BEGIN
    SELECT count(*) INTO sin_rls
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

    IF sin_rls > 0 THEN
        RAISE EXCEPTION 'Hay % tablas sin RLS. Aplicar 0002_rls.sql primero.', sin_rls;
    END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 1. Funciones — esto es lo que cierra el agujero
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO   service_role;

-- ---------------------------------------------------------------------
-- 2. Tablas y secuencias
-- ---------------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ---------------------------------------------------------------------
-- 3. Lo mismo para lo que se cree de aquí en adelante, para no depender
--    de que alguien se acuerde. Aplica a los objetos que cree postgres,
--    que es el rol del SQL Editor.
-- ---------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO service_role;

-- ---------------------------------------------------------------------
-- Comprobación final dentro de la misma transacción.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    tablas_anon      integer;
    funciones_anon   integer;
    tablas_service   integer;
    funciones_service integer;
    total_tablas     integer;
    total_funciones  integer;
BEGIN
    SELECT count(*) INTO total_tablas
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r';

    SELECT count(*) INTO total_funciones
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public';

    SELECT count(*) INTO tablas_anon
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND (has_table_privilege('anon', c.oid, 'SELECT')
        OR has_table_privilege('anon', c.oid, 'INSERT')
        OR has_table_privilege('anon', c.oid, 'UPDATE')
        OR has_table_privilege('anon', c.oid, 'DELETE')
        OR has_table_privilege('authenticated', c.oid, 'SELECT')
        OR has_table_privilege('authenticated', c.oid, 'INSERT')
        OR has_table_privilege('authenticated', c.oid, 'UPDATE')
        OR has_table_privilege('authenticated', c.oid, 'DELETE'));

    SELECT count(*) INTO funciones_anon
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));

    SELECT count(*) INTO tablas_service
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND has_table_privilege('service_role', c.oid, 'SELECT')
      AND has_table_privilege('service_role', c.oid, 'INSERT')
      AND has_table_privilege('service_role', c.oid, 'UPDATE')
      AND has_table_privilege('service_role', c.oid, 'DELETE');

    SELECT count(*) INTO funciones_service
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND has_function_privilege('service_role', p.oid, 'EXECUTE');

    IF tablas_anon > 0 THEN
        RAISE EXCEPTION 'anon o authenticated conservan permisos sobre % tablas.', tablas_anon;
    END IF;

    IF funciones_anon > 0 THEN
        RAISE EXCEPTION 'anon o authenticated pueden ejecutar % funciones.', funciones_anon;
    END IF;

    IF tablas_service <> total_tablas THEN
        RAISE EXCEPTION
            'service_role tiene permiso completo en % de % tablas; el backend quedaria ciego.',
            tablas_service, total_tablas;
    END IF;

    IF funciones_service <> total_funciones THEN
        RAISE EXCEPTION
            'service_role puede ejecutar % de % funciones.', funciones_service, total_funciones;
    END IF;
END
$$;

COMMIT;
