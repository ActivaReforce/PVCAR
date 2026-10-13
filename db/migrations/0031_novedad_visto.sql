-- =====================================================================
-- PVCAR — 0031_novedad_visto.sql
-- Novedades: número de nuevas en el menú (2026-10-12).
--
-- Una fila por persona con la fecha de la última novedad que llegó a ver en
-- pantalla. El menú cuenta las novedades de otros posteriores a esa fecha
-- (índice ix_novedad_fecha, de la 0027). Solo lo usan Propietario y Admin.
--
-- Requiere 0027. Idempotente. Todo en una transacción.
-- Igual en dev y en prod.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.novedad_visto (
    usu_id           int         PRIMARY KEY REFERENCES public.usuario(usu_id) ON DELETE CASCADE,
    novvis_hasta     timestamptz NOT NULL,
    novvis_fecha_modificacion timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.novedad_visto IS
    'Hasta qué novedad (por fecha) ha visto cada persona. Alimenta el número de nuevas del menú.';

ALTER TABLE public.novedad_visto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novedad_visto FORCE  ROW LEVEL SECURITY;

REVOKE ALL ON public.novedad_visto FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.novedad_visto TO service_role;

COMMIT;
