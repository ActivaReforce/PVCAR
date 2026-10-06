-- =====================================================================
-- PVCAR — 0022_actividad_color.sql
-- Color de la actividad (pedido del cliente, 2026-10-06).
--
-- Requiere 0001. Va en PVCAR_Dev y en PVCAR. Idempotente. Todo en una
-- transacción.
--
-- Se guarda el NOMBRE del color, no el código: la paleta (tonos pastel,
-- con su versión para el modo oscuro) vive en el frontend y se puede
-- retocar sin tocar la base. Sin color = la tarjeta de siempre.
-- La lista tiene que coincidir con COLORES_ACTIVIDAD del backend y con
-- frontend/src/lib/colores.ts.
-- =====================================================================

BEGIN;

ALTER TABLE public.actividad
    ADD COLUMN IF NOT EXISTS act_color text;

ALTER TABLE public.actividad
    DROP CONSTRAINT IF EXISTS ck_act_color;
ALTER TABLE public.actividad
    ADD CONSTRAINT ck_act_color CHECK (
        act_color IS NULL OR act_color IN (
            'rosa', 'coral', 'menta', 'verde', 'turquesa',
            'cielo', 'azul', 'lavanda', 'violeta', 'gris'
        )
    );

COMMENT ON COLUMN public.actividad.act_color IS
    'Nombre del color pastel de la actividad en Actividades y Disciplinas. NULL = sin color.';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'actividad' AND column_name = 'act_color'
    ) THEN
        RAISE EXCEPTION 'actividad.act_color no quedó creada';
    END IF;
END $$;

COMMIT;
