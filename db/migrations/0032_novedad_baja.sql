-- =====================================================================
-- PVCAR — 0032_novedad_baja.sql
-- Novedades: eliminar solo las quita de la pantalla (2026-10-12).
--
-- Hasta aquí "Eliminar" borraba la fila para siempre. Ahora es una baja
-- lógica con el estado de siempre (1 Activo = en pantalla, 2 Inactivo =
-- eliminada) y queda quién y cuándo la quitó. Las eliminadas siguen en
-- Reportes → Novedades.
--
-- Una regla en la propia tabla: eliminada ⇔ tiene quién y cuándo.
--
-- Requiere 0027. Idempotente. Todo en una transacción.
-- Igual en dev y en prod.
-- =====================================================================

BEGIN;

ALTER TABLE public.novedad
    ADD COLUMN IF NOT EXISTS est_id                int NOT NULL DEFAULT 1 REFERENCES public.estado(est_id),
    ADD COLUMN IF NOT EXISTS nov_eliminada_por     int REFERENCES public.usuario(usu_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS nov_fecha_eliminacion timestamptz;

ALTER TABLE public.novedad DROP CONSTRAINT IF EXISTS ck_nov_estado;
ALTER TABLE public.novedad ADD CONSTRAINT ck_nov_estado CHECK (
    (est_id = 1 AND nov_eliminada_por IS NULL AND nov_fecha_eliminacion IS NULL)
 OR (est_id = 2 AND nov_eliminada_por IS NOT NULL AND nov_fecha_eliminacion IS NOT NULL)
);

COMMENT ON COLUMN public.novedad.est_id IS
    '1 = en pantalla, 2 = eliminada (sigue en Reportes).';

-- La pantalla y el número del menú solo miran las que están en pantalla.
CREATE INDEX IF NOT EXISTS ix_novedad_activas_fecha
    ON public.novedad (nov_fecha_creacion DESC)
    WHERE est_id = 1;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'novedad'
                      AND column_name = 'nov_fecha_eliminacion') THEN
        RAISE EXCEPTION 'No quedó la columna nov_fecha_eliminacion';
    END IF;
END $$;

COMMIT;
