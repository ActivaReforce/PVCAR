-- =====================================================================
-- PVCAR — 0007_colegio_unicidad.sql
-- Un colegio no puede llamarse igual que otro. Migración de la Fase 7.
--
-- Requiere 0001-0006 aplicados. Va en PVCAR_Dev y en PVCAR.
-- Idempotente. Todo en una transacción.
--
-- ---------------------------------------------------------------------
-- Por qué
--
-- Ni la base vieja ni el baseline impiden dos colegios con el mismo
-- nombre. El nombre es lo único que se ve en los selectores de
-- Disciplinas, Estudiantes, Entrenadores y Asistencias: dos "Innova
-- Schools Quitumbe" son indistinguibles en pantalla, y el error solo se
-- descubre cuando alguien inscribe a un alumno en el colegio equivocado.
--
-- El backend ya lo rechaza con un 409 antes de insertar. Esto es la
-- segunda capa: la regla vive en la base, así que también protege a la
-- carga del cutover y a cualquier script.
--
-- Se compara normalizado —`lower(trim(...))`— igual que `usu_correo`.
-- Sin eso, "Tomás Moro" y "tomás moro " serían dos colegios distintos
-- para la base y el mismo para las personas.
--
-- ---------------------------------------------------------------------
-- Seguro para los datos reales
--
-- Medido el 2026-09-16 sobre el respaldo de producción del 2026-07-27 y
-- sobre PVCAR_Dev: 7 colegios en prod y 8 en dev, **0 nombres repetidos**
-- en los dos, ni siquiera ignorando mayúsculas y espacios. El índice no
-- rebota nada.
--
-- Si alguna vez rebotara, el error diría qué fila lo impide; se corrige
-- el nombre y se vuelve a aplicar.
-- =====================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS colegio_nombre_unico_idx
    ON public.colegio (lower(trim(col_nombre)));

COMMENT ON INDEX public.colegio_nombre_unico_idx IS
    'Un colegio por nombre, sin distinguir mayúsculas ni espacios sobrantes. Fase 7.';

COMMIT;
