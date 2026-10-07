-- =====================================================================
-- PVCAR — 0023_colores_sobrios.sql
-- Paleta de colores de actividad más sobria (cliente, 2026-10-06:
-- "un poco más varoniles"). Sustituye la lista de la 0022.
--
-- Requiere 0022. Va en PVCAR_Dev y en PVCAR. Idempotente. Todo en una
-- transacción. Las actividades que ya tenían color pasan al tono nuevo
-- más parecido. La lista tiene que coincidir con COLORES_ACTIVIDAD del
-- backend y con frontend/src/lib/colores.ts.
-- =====================================================================

BEGIN;

ALTER TABLE public.actividad DROP CONSTRAINT IF EXISTS ck_act_color;

UPDATE public.actividad
   SET act_color = CASE act_color
           WHEN 'rosa'     THEN 'vino'
           WHEN 'coral'    THEN 'vino'
           WHEN 'menta'    THEN 'bosque'
           WHEN 'verde'    THEN 'oliva'
           WHEN 'turquesa' THEN 'petroleo'
           WHEN 'azul'     THEN 'marino'
           WHEN 'lavanda'  THEN 'indigo'
           WHEN 'violeta'  THEN 'indigo'
           WHEN 'gris'     THEN 'grafito'
           ELSE act_color
       END
 WHERE act_color IN ('rosa', 'coral', 'menta', 'verde', 'turquesa', 'azul', 'lavanda', 'violeta', 'gris');

ALTER TABLE public.actividad
    ADD CONSTRAINT ck_act_color CHECK (
        act_color IS NULL OR act_color IN (
            'marino', 'acero', 'cielo', 'petroleo', 'bosque',
            'oliva', 'piedra', 'grafito', 'indigo', 'vino'
        )
    );

COMMENT ON COLUMN public.actividad.act_color IS
    'Nombre del color de la actividad en Actividades y Disciplinas (paleta sobria, 0023). NULL = sin color.';

COMMIT;
