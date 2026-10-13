-- =====================================================================
-- PVCAR — 0034_correo_diario.sql
-- Tablero: correos enviados hoy (2026-10-12).
--
-- Un contador por día (de Ecuador) y tipo de correo: una fila que se suma
-- en cada envío que sale bien, no una fila por correo. "Hoy" es la fecha de
-- Ecuador, así que la cuenta vuelve a cero sola a las 00:00 de Guayaquil
-- sin ningún proceso que la reinicie; los días anteriores quedan como
-- histórico (unas pocas filas por día).
--
-- Tipos: los de correo_config (inscripciones, inscripciones_aviso,
-- novedades, ausencias) y recuperar_contrasena (el de Supabase Auth, que
-- se cuenta cuando Supabase acepta el envío).
--
-- Requiere 0001. Idempotente. Todo en una transacción.
-- Igual en dev y en prod.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.correo_diario (
    cordia_dia      date NOT NULL,
    cordia_tipo     text NOT NULL,
    cordia_enviados int  NOT NULL DEFAULT 0 CHECK (cordia_enviados >= 0),
    PRIMARY KEY (cordia_dia, cordia_tipo)
);

COMMENT ON TABLE public.correo_diario IS
    'Correos enviados por la plataforma, por día de Ecuador y tipo. Alimenta el tablero.';

ALTER TABLE public.correo_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correo_diario FORCE  ROW LEVEL SECURITY;

REVOKE ALL ON public.correo_diario FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.correo_diario TO service_role;

DO $$
BEGIN
    IF has_table_privilege('anon', 'public.correo_diario', 'SELECT') THEN
        RAISE EXCEPTION 'anon puede leer correo_diario';
    END IF;
END $$;

COMMIT;
