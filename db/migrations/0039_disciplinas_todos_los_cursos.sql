-- =====================================================================
-- PVCAR — 0039_disciplinas_todos_los_cursos.sql
-- Las disciplinas sin cursos pasan a tener todos marcados (2026-10-14).
--
-- Con la 0038, una disciplina sin cursos ya valía para todos; esto lo
-- deja escrito, para que al editarla salgan todos marcados y se quiten
-- los que sobren (pedido del cliente). No cambia lo que ve el formulario.
--
-- Solo toca disciplinas sin ningún curso: las que ya se marcaron no se
-- tocan. Requiere 0038. Idempotente. Igual en dev y en prod.
-- =====================================================================

BEGIN;

INSERT INTO public.disciplina_grado (colacthor_id, catninograd_id)
SELECT d.colacthor_id, g.catninograd_id
  FROM public.colegio_actividad_horario d
 CROSS JOIN public.categoria_nino_grado g
 WHERE NOT EXISTS (SELECT 1 FROM public.disciplina_grado x WHERE x.colacthor_id = d.colacthor_id)
ON CONFLICT DO NOTHING;

COMMIT;
