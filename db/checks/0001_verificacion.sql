-- =====================================================================
-- PVCAR — 0001_verificacion.sql
-- Verificación de que 0001_baseline.sql quedó bien aplicado.
--
-- NO es una migración: no crea, no cambia, no borra nada. Solo lee
-- catálogos del sistema. Se puede correr las veces que haga falta.
--
-- Correr en PVCAR_Dev después de 0001_baseline.sql. Después en PVCAR,
-- solo cuando dev quede limpio.
--
-- Todo va en una sola consulta a propósito: el SQL Editor de Supabase
-- muestra únicamente el resultado de la última sentencia. Con esto la
-- salida completa cabe en una sola tabla.
--
-- Los números esperados salen de aplicar el baseline en un Postgres
-- 17.4 limpio (2026-07-29).
-- =====================================================================

SELECT
    bloque,
    chequeo,
    valor,
    esperado,
    CASE
        WHEN esperado = 'informativo' THEN '—'
        WHEN valor = esperado         THEN 'OK'
        ELSE '** REVISAR **'
    END AS estado
FROM (
    VALUES

    -- -----------------------------------------------------------------
    -- Bloque A — inventario de objetos
    -- -----------------------------------------------------------------
    ('A', '1. tablas', (
        SELECT count(*)::text FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
    ), '35'),

    ('A', '2. primary keys', (
        SELECT count(*)::text FROM pg_constraint
        WHERE contype = 'p' AND connamespace = 'public'::regnamespace
    ), '35'),

    ('A', '3. foreign keys', (
        SELECT count(*)::text FROM pg_constraint
        WHERE contype = 'f' AND connamespace = 'public'::regnamespace
    ), '63'),

    ('A', '4. unique constraints', (
        SELECT count(*)::text FROM pg_constraint
        WHERE contype = 'u' AND connamespace = 'public'::regnamespace
    ), '12'),

    ('A', '5. check constraints', (
        SELECT count(*)::text FROM pg_constraint
        WHERE contype = 'c' AND connamespace = 'public'::regnamespace
    ), '8'),

    ('A', '6. indices', (
        SELECT count(*)::text FROM pg_indexes WHERE schemaname = 'public'
    ), '107'),

    ('A', '7. funciones', (
        SELECT count(*)::text FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
    ), '6'),

    ('A', '8. triggers', (
        SELECT count(*)::text FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND NOT t.tgisinternal
    ), '3'),

    -- -----------------------------------------------------------------
    -- Bloque B — ninguna FK sin índice de respaldo
    -- Si esto no da 0, correr la consulta de detalle del final.
    -- -----------------------------------------------------------------
    ('B', '9. FKs sin indice de respaldo', (
        SELECT count(*)::text
        FROM pg_constraint c
        JOIN unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON true
        WHERE c.contype = 'f'
          AND c.connamespace = 'public'::regnamespace
          AND k.ord = 1
          AND NOT EXISTS (
            SELECT 1 FROM pg_index i
            WHERE i.indrelid = c.conrelid AND i.indkey[0] = k.attnum
          )
    ), '0'),

    -- -----------------------------------------------------------------
    -- Bloque C — lo que NO debe existir
    --
    -- El tercero es el que importa: en la prod VIEJA existe el trigger
    -- on_auth_user_created -> handle_new_user() -> inserta en
    -- public.profiles, que no existe. Por eso crear un usuario en
    -- Supabase Auth falla siempre en el sistema actual. En las bases
    -- nuevas no se replica. Si aparece, parar y avisar.
    -- -----------------------------------------------------------------
    ('C', '10. columna usu_contrasena', (
        SELECT count(*)::text FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'usu_contrasena'
    ), '0'),

    ('C', '11. funcion handle_new_user', (
        SELECT count(*)::text FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
    ), '0'),

    ('C', '12. triggers en auth.users', (
        SELECT count(*)::text FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'auth' AND c.relname = 'users'
          AND NOT t.tgisinternal
    ), '0'),

    -- -----------------------------------------------------------------
    -- Bloque D — RLS todavía apagado. Lo activa 0002_rls.sql.
    -- -----------------------------------------------------------------
    ('D', '13. tablas con RLS activo', (
        SELECT count(*)::text FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND c.relrowsecurity
    ), '0'),

    ('D', '14. politicas RLS', (
        SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public'
    ), '0'),

    -- -----------------------------------------------------------------
    -- Informativo — para interpretar diferencias en los conteos
    -- -----------------------------------------------------------------
    ('E', '15. version de postgres', (
        SELECT current_setting('server_version')
    ), 'informativo')

) AS t(bloque, chequeo, valor, esperado)
ORDER BY bloque, lpad(split_part(chequeo, '.', 1), 3, '0');


-- =====================================================================
-- Detalle — correr SOLO si el chequeo 9 no dio 0.
-- Devuelve qué FK quedó sin índice de respaldo.
-- =====================================================================
--
-- SELECT c.conname,
--        c.conrelid::regclass || '.' || a.attname AS fk_sin_indice
-- FROM pg_constraint c
-- JOIN unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON true
-- JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
-- WHERE c.contype = 'f'
--   AND c.connamespace = 'public'::regnamespace
--   AND k.ord = 1
--   AND NOT EXISTS (
--     SELECT 1 FROM pg_index i
--     WHERE i.indrelid = c.conrelid AND i.indkey[0] = k.attnum
--   );
