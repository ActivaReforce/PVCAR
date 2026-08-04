-- =====================================================================
-- PVCAR — 0002_rls.sql
-- Row Level Security en las 35 tablas de public, deny-by-default.
--
-- Requiere 0001_baseline.sql aplicado.
-- Orden de ejecución: PVCAR_Dev primero. Solo si sale limpio, PVCAR.
-- Todo va en una transacción: si algo falla, no queda nada a medias.
-- Es idempotente: correrlo dos veces no cambia nada ni da error.
--
-- ---------------------------------------------------------------------
-- Qué hace y por qué (Anexo B del plan)
--
-- ENABLE + FORCE en cada tabla y CERO políticas. Sin políticas, RLS
-- niega todo: la anon key que viaja dentro del bundle del navegador
-- deja de servir para leer o escribir datos.
--
-- El backend no se ve afectado: se conecta como service_role / postgres
-- y ambos roles tienen BYPASSRLS. El chequeo 7 de la verificación lo
-- confirma contra el servidor, no de memoria.
--
-- FORCE es lo que hace que la regla también aplique al dueño de la
-- tabla. Hoy el dueño es postgres, que además tiene BYPASSRLS y pasa
-- igual; queda puesto para que la protección no dependa de quién sea
-- el dueño mañana.
--
-- ---------------------------------------------------------------------
-- Lo que este archivo NO hace, a propósito
--
-- No revoca los GRANT de anon / authenticated. Con los grants puestos,
-- un SELECT con la anon key devuelve **0 filas**; sin ellos devolvería
-- "permission denied" (42501). Se prefiere 0 filas: es el
-- comportamiento que espera la verificación del Anexo B y no delata
-- qué tablas existen. En los dos casos el dato queda igual de cerrado.
--
-- No crea ninguna política. Las Fases 6-14 mueven el frontend al API;
-- ninguna pantalla habla con PostgREST directamente cuando terminen.
-- Si algún día hiciera falta una política, va en su propia migración.
--
-- ---------------------------------------------------------------------
-- REGLA PERMANENTE
--
-- Toda tabla nueva en public nace sin RLS. La migración que la cree
-- tiene que traer su propio ALTER TABLE ... ENABLE + FORCE, y el
-- chequeo 3 de 0002_verificacion.sql (tablas sin RLS = 0) sirve para
-- detectar el olvido. No hay event trigger que lo imponga: Supabase no
-- deja crearlos sin superusuario.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Guarda previa: esto asume el baseline completo. Si el conteo no da
-- 35, la base no está donde este archivo cree y no se toca nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    n integer;
BEGIN
    SELECT count(*) INTO n
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind = 'r';

    IF n <> 35 THEN
        RAISE EXCEPTION
            'Se esperaban 35 tablas en public y hay %. Aplicar 0001_baseline.sql primero.', n;
    END IF;
END
$$;

-- ---------------------------------------------------------------------
-- Las 35 tablas, en orden alfabético para poder cotejarlas de un
-- vistazo contra pg_tables.
-- ---------------------------------------------------------------------
ALTER TABLE public.actividad                  ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_auxiliar        ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_entrenador      ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_estado          ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_nino            ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.categoria                  ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.categoria_nino_grado       ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.colegio                    ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.colegio_actividad_horario  ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.colegio_coordinador        ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dia                        ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.encuesta                   ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.encuesta_pregunta          ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.encuesta_respondida        ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.encuesta_respuesta         ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.encuesta_tipo_respuesta    ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.entrenador                 ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.entrenador_asignacion      ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.entrenador_auxiliar        ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.estado                     ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evaluacion                 ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evaluacion_asignacion      ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evaluacion_intento         ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evaluacion_nino_pendiente  ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evaluacion_parametro       ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evaluacion_tiempo_rangos   ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evaluacion_tipo_metodo     ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.nino                       ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.nino_asignacion            ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.nino_padre                 ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.padre                      ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rol                        ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rol_permiso                ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.usuario                    ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_rol                ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Comprobación final dentro de la misma transacción. Si algo no cuadra,
-- la migración entera se deshace.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    sin_rls    integer;
    sin_force  integer;
    politicas  integer;
BEGIN
    SELECT count(*) INTO sin_rls
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

    SELECT count(*) INTO sin_force
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind = 'r' AND NOT c.relforcerowsecurity;

    SELECT count(*) INTO politicas
    FROM pg_policies WHERE schemaname = 'public';

    IF sin_rls > 0 THEN
        RAISE EXCEPTION 'Quedaron % tablas sin ENABLE ROW LEVEL SECURITY.', sin_rls;
    END IF;

    IF sin_force > 0 THEN
        RAISE EXCEPTION 'Quedaron % tablas sin FORCE ROW LEVEL SECURITY.', sin_force;
    END IF;

    IF politicas > 0 THEN
        RAISE EXCEPTION
            'Hay % politicas en public y deben ser 0: deny-by-default no admite excepciones aqui.', politicas;
    END IF;
END
$$;

COMMIT;
