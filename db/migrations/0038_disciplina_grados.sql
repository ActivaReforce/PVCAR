-- =====================================================================
-- PVCAR — 0038_disciplina_grados.sql
-- Cada disciplina dice para qué cursos es (2026-10-14).
--
-- "Fútbol Sub 12" es para 6to y 7mo: se marca al crear o editar la
-- disciplina, y el formulario público de inscripción solo la ofrece al
-- alumno de esos cursos.
--
-- Una disciplina sin ningún curso marcado vale para todos: es como estaban
-- todas antes de esta migración, así que nada deja de ofrecerse al
-- aplicarla. Se van marcando desde Disciplinas.
--
-- Solo añade una tabla. El código viejo no la usa: se puede correr antes
-- que el PR, y en prod **tiene que** correrse antes del merge.
-- Idempotente. Igual en dev y en prod.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.disciplina_grado (
    colacthor_id    integer  NOT NULL
        REFERENCES public.colegio_actividad_horario (colacthor_id) ON DELETE CASCADE,
    catninograd_id  smallint NOT NULL
        REFERENCES public.categoria_nino_grado (catninograd_id),
    PRIMARY KEY (colacthor_id, catninograd_id)
);

COMMENT ON TABLE public.disciplina_grado IS
    'Cursos para los que es una disciplina. Sin filas = para todos los cursos.';

ALTER TABLE public.disciplina_grado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplina_grado FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON public.disciplina_grado FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disciplina_grado TO service_role;

COMMIT;
