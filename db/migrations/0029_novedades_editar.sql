-- =====================================================================
-- PVCAR — 0029_novedades_editar.sql
-- Novedades: casilla "Editar" (2026-10-12).
--
-- Editar en Novedades = la pestaña Configuración (correo de Novedades y los
-- dos avisos). Por defecto solo Propietario (1) y Admin (5); el resto se
-- reparte desde Permisos.
--
-- Requiere 0027. Idempotente. Todo en una transacción.
-- Igual en dev y en prod.
-- =====================================================================

BEGIN;

INSERT INTO public.rol_permiso (rol_id, modulo, accion)
VALUES (1, 'novedades', 'editar'),
       (5, 'novedades', 'editar')
ON CONFLICT (rol_id, modulo, accion) DO NOTHING;

COMMIT;
