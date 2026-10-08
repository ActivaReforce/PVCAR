-- =====================================================================
-- PVCAR — 0026_permisos_crud.sql
-- Permisos con sentido CRUD (pedido del cliente, 2026-10-07).
--
-- Cada casilla de la pantalla de Permisos tiene que hacer lo que dice.
-- Hasta ahora había módulos donde "ver" dejaba escribir. Esta migración
-- solo reparte las casillas nuevas a quien ya podía hacer eso, así que
-- nadie gana ni pierde nada, salvo el punto 2 (el entrenador deja de
-- poder cambiar la plantilla de una evaluación):
--
--   1. Asistencia de alumnos y de personal: "editar" = pasar lista.
--      Se da a todo rol que tenga "ver".
--   2. Evaluaciones se parte en dos:
--        - evaluaciones   = la plantilla (crear, cambiar parámetros,
--                           vincular, dar de baja, borrar);
--        - calificaciones = calificar a los alumnos (ver / editar).
--      Quien tenía evaluaciones:ver recibe calificaciones:ver, y quien
--      tenía evaluaciones:editar, calificaciones:editar. Al Entrenador se
--      le quita evaluaciones:editar: lo tenía para calificar, y con él
--      podía cambiar una plantilla que usan otros colegios.
--   3. Encuestas: crear, editar (preguntas, publicar, cerrar) y eliminar.
--      Se dan a todo rol que tenga "ver", que hoy lo hacía todo con él.
--   4. Permisos: "editar" = guardar la matriz. Al Propietario.
--   5. "Reporte del Estudiante" desaparece: no abría ninguna pantalla.
--
-- Idempotente. Todo en una transacción. Igual en dev y en prod.
-- =====================================================================

BEGIN;

-- 1. Asistencias
INSERT INTO public.rol_permiso (rol_id, modulo, accion)
SELECT rol_id, modulo, 'editar'
  FROM public.rol_permiso
 WHERE modulo IN ('asistencias_estudiantes', 'asistencias_entrenadores')
   AND accion = 'ver'
ON CONFLICT (rol_id, modulo, accion) DO NOTHING;

-- 2. Calificaciones
INSERT INTO public.rol_permiso (rol_id, modulo, accion)
SELECT rol_id, 'calificaciones', accion
  FROM public.rol_permiso
 WHERE modulo = 'evaluaciones'
   AND accion IN ('ver', 'editar')
ON CONFLICT (rol_id, modulo, accion) DO NOTHING;

DELETE FROM public.rol_permiso
 WHERE rol_id = 3            -- Entrenador
   AND modulo = 'evaluaciones'
   AND accion = 'editar';

-- 3. Encuestas
INSERT INTO public.rol_permiso (rol_id, modulo, accion)
SELECT p.rol_id, 'encuestas', a.accion
  FROM public.rol_permiso p
 CROSS JOIN (VALUES ('crear'), ('editar'), ('eliminar')) AS a(accion)
 WHERE p.modulo = 'encuestas'
   AND p.accion = 'ver'
ON CONFLICT (rol_id, modulo, accion) DO NOTHING;

-- 4. Permisos
INSERT INTO public.rol_permiso (rol_id, modulo, accion)
VALUES (1, 'permisos', 'editar')
ON CONFLICT (rol_id, modulo, accion) DO NOTHING;

-- 5. Reporte del Estudiante
DELETE FROM public.rol_permiso WHERE modulo = 'reporte_estudiante';

COMMIT;
