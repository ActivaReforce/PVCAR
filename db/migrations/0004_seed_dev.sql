-- =====================================================================
-- PVCAR — 0004_seed_dev.sql
--
--                  >>> SOLO EN PVCAR_Dev. NUNCA EN PVCAR. <<<
--
-- Datos mínimos para desarrollar. Los catálogos son copia exacta de la
-- prod vieja (mismos IDs y nombres) para que el código se comporte
-- igual en dev que después del cutover.
--
-- En PVCAR (prod) los datos entran una sola vez, en el cutover, desde
-- el dump. Si se sembrara esto ahí, los IDs chocarían con esa carga.
-- Por si acaso, el archivo aborta si encuentra datos.
--
-- Requiere 0001, 0002 y 0003 aplicados.
-- Idempotente: correrlo dos veces no duplica nada.
--
-- ---------------------------------------------------------------------
-- Qué NO siembra: usuarios
--
-- El baseline exige que todo usuario activo tenga cuenta en Supabase
-- Auth (CHECK est_id <> 1 OR auth_user_id IS NOT NULL), y una cuenta de
-- Auth no se crea desde SQL. Los usuarios de prueba de dev los crea el
-- script de la Fase 5 (`backfill-auth.ts`): primero la cuenta en Auth,
-- después la fila en `usuario` con su `auth_user_id`.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Guardas: schema completo y base sin datos de dominio.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    sin_rls integer;
    filas   integer;
BEGIN
    SELECT count(*) INTO sin_rls
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

    IF sin_rls > 0 THEN
        RAISE EXCEPTION 'Faltan migraciones: hay % tablas sin RLS.', sin_rls;
    END IF;

    -- Se mira lo que este archivo nunca siembra (usuarios, niños) y los
    -- colegios que no son el de prueba. Así se puede reejecutar el seed
    -- sin que la guarda salte por sus propios datos.
    SELECT (SELECT count(*) FROM public.usuario)
         + (SELECT count(*) FROM public.nino)
         + (SELECT count(*) FROM public.colegio WHERE col_id <> 1)
      INTO filas;

    IF filas > 0 THEN
        RAISE EXCEPTION
            'Esta base ya tiene datos reales (% filas entre usuario, nino y colegio). El seed es solo para PVCAR_Dev.', filas;
    END IF;
END
$$;

-- =====================================================================
-- 1. CATÁLOGOS — copia exacta de la prod vieja
-- =====================================================================

INSERT INTO public.estado (est_id, est_nombre) VALUES
    (1, 'Activo'),
    (2, 'Inactivo'),
    (3, 'Borrador'),
    (4, 'Finalizado'),
    (5, 'Publicado'),
    (6, 'Pendiente'),
    (7, 'Evaluado')
ON CONFLICT (est_id) DO NOTHING;

INSERT INTO public.dia (dia_id, dia_nombre) VALUES
    (1, 'Lunes'),
    (2, 'Martes'),
    (3, 'Miércoles'),
    (4, 'Jueves'),
    (5, 'Viernes'),
    (6, 'Sábado'),
    (7, 'Domingo')
ON CONFLICT (dia_id) DO NOTHING;

INSERT INTO public.asistencia_estado (asisest_id, asisest_nombre) VALUES
    (1, 'Presente'),
    (2, 'Ausente'),
    (3, 'Tarde'),
    (4, 'Justificado')
ON CONFLICT (asisest_id) DO NOTHING;

INSERT INTO public.categoria_nino_grado (catninograd_id, catninograd_nombre) VALUES
    (1,  '1ero de Básica'),
    (2,  '2do de Básica'),
    (3,  '3ero de Básica'),
    (4,  '4to de Básica'),
    (5,  '5to de Básica'),
    (6,  '6to de Básica'),
    (7,  '7mo de Básica'),
    (8,  '8vo de Básica'),
    (9,  '9no de Básica'),
    (10, '10mo de Básica'),
    (11, '1ro de Bachillerato'),
    (12, '2do de Bachillerato'),
    (13, '3ro de Bachillerato')
ON CONFLICT (catninograd_id) DO NOTHING;

INSERT INTO public.encuesta_tipo_respuesta (encutiporesp_id, encutiporesp_nombre) VALUES
    (1, 'Texto corto'),
    (2, 'Texto largo'),
    (3, 'Escala'),
    (4, 'Fecha'),
    (5, 'Hora'),
    (6, 'Si / No')
ON CONFLICT (encutiporesp_id) DO NOTHING;

INSERT INTO public.evaluacion_tipo_metodo (evatipometo_id, evatipometo_nombre) VALUES
    (1, 'Evaluación por tiempo'),
    (2, 'Evaluación por logro'),
    (3, 'Evaluación por escala'),
    (4, 'Evaluación Mobak (6 intentos)'),
    (5, 'Evaluación Mobak (2 intentos)')
ON CONFLICT (evatipometo_id) DO NOTHING;

-- El espacio sobrante en 'Artística-Deportiva ' está así en la prod
-- vieja. Se copia tal cual para que dev y prod coincidan; si algún día
-- se limpia, se limpia en las dos con su propia migración.
INSERT INTO public.categoria (cat_id, cat_nombre, cat_descripcion) VALUES
    (1, 'Deportiva',             'Actividad física estructurada que implica movimiento corporal, uso de habilidades motrices'),
    (2, 'Artística',             'Actividad que estimula la creatividad, la expresión personal y la sensibilidad estética'),
    (3, 'Artística-Deportiva ',  'Actividad que combina el movimiento físico del deporte con la expresión creativa del arte'),
    (4, 'Científico-Deportiva',  'Actividad que combina elementos del deporte con el conocimiento científico'),
    (5, 'Científica',            'Actividad práctica o teórica diseñada para estimular el pensamiento crítico, la observación, el análisis y la comprensión del mundo natural o tecnológico'),
    (6, 'Artes Marciales',       'Actividad física, mental y disciplinaria basada en técnicas de combate tradicional o moderno, con fines defensivos, deportivos, filosóficos o culturales.')
ON CONFLICT (cat_id) DO NOTHING;

-- =====================================================================
-- 2. ROLES Y PERMISOS — los 7 roles y los 97 permisos de la prod vieja
-- =====================================================================

INSERT INTO public.rol (rol_id, rol_nombre, rol_titulo, rol_descripcion) VALUES
    (1, 'Propietario PVCAR',      'Propietario PVCAR',            'Tiene el control total del sistema'),
    (2, 'Coordinador de Colegio', 'Coordinador de Colegio',       'Tiene el control de su grupo/colegio'),
    (3, 'Entrenador',             'Entrenador',                   'Tiene el control de su grupo, actividades, evaluaciones y alumnos'),
    (4, 'Representante',          'Representante',                'No tiene el control de nada, tiene visualización de su hijo'),
    (5, 'Admin Activa Reforce',   'Administrador Activa Reforce', 'Tiene la visualizción total del sistema pero no puede modificarlo'),
    (6, 'Asistente',              'Asistente',                    'Se vincula a un entrenador y tiene control de su informacion'),
    (7, 'Respaldo Entrenador',    'Respaldo Entrenador',          'Se vincula a un entrenador y tiene control de su informacion')
ON CONFLICT (rol_id) DO NOTHING;

-- rol 1 — Propietario PVCAR (34)
INSERT INTO public.rol_permiso (rol_id, modulo, accion) VALUES
    (1, 'actividades', 'crear'), (1, 'actividades', 'editar'), (1, 'actividades', 'eliminar'), (1, 'actividades', 'ver'),
    (1, 'asistencias_entrenadores', 'ver'),
    (1, 'asistencias_estudiantes', 'ver'),
    (1, 'colegios', 'crear'), (1, 'colegios', 'editar'), (1, 'colegios', 'eliminar'), (1, 'colegios', 'ver'),
    (1, 'dashboard', 'ver'),
    (1, 'disciplinas', 'crear'), (1, 'disciplinas', 'editar'), (1, 'disciplinas', 'eliminar'), (1, 'disciplinas', 'ver'),
    (1, 'encuestas', 'ver'),
    (1, 'entrenadores', 'editar'), (1, 'entrenadores', 'ver'),
    (1, 'estudiantes', 'crear'), (1, 'estudiantes', 'editar'), (1, 'estudiantes', 'eliminar'), (1, 'estudiantes', 'ver'),
    (1, 'evaluaciones', 'crear'), (1, 'evaluaciones', 'editar'), (1, 'evaluaciones', 'eliminar'), (1, 'evaluaciones', 'ver'),
    (1, 'perfil', 'ver'),
    (1, 'permisos', 'ver'),
    (1, 'reportes', 'crear'), (1, 'reportes', 'ver'),
    (1, 'usuarios', 'crear'), (1, 'usuarios', 'editar'), (1, 'usuarios', 'eliminar'), (1, 'usuarios', 'ver'),

-- rol 2 — Coordinador de Colegio (21)
    (2, 'actividades', 'ver'),
    (2, 'asistencias_entrenadores', 'ver'),
    (2, 'asistencias_estudiantes', 'ver'),
    (2, 'colegios', 'ver'),
    (2, 'dashboard', 'ver'),
    (2, 'disciplinas', 'editar'), (2, 'disciplinas', 'ver'),
    (2, 'encuestas', 'ver'),
    (2, 'entrenadores', 'editar'), (2, 'entrenadores', 'ver'),
    (2, 'estudiantes', 'crear'), (2, 'estudiantes', 'editar'), (2, 'estudiantes', 'eliminar'), (2, 'estudiantes', 'ver'),
    (2, 'evaluaciones', 'crear'), (2, 'evaluaciones', 'editar'), (2, 'evaluaciones', 'ver'),
    (2, 'perfil', 'ver'),
    (2, 'reportes', 'crear'), (2, 'reportes', 'ver'),
    (2, 'usuarios', 'ver'),

-- rol 3 — Entrenador (9)
    (3, 'asistencias_estudiantes', 'ver'),
    (3, 'dashboard', 'ver'),
    (3, 'disciplinas', 'ver'),
    (3, 'estudiantes', 'editar'), (3, 'estudiantes', 'ver'),
    (3, 'evaluaciones', 'editar'), (3, 'evaluaciones', 'ver'),
    (3, 'perfil', 'ver'),
    (3, 'reportes', 'ver'),

-- rol 4 — Representante (4)
    (4, 'dashboard', 'ver'),
    (4, 'disciplinas', 'ver'),
    (4, 'perfil', 'ver'),
    (4, 'reporte_estudiante', 'ver'),

-- rol 5 — Admin Activa Reforce (17)
    (5, 'actividades', 'ver'),
    (5, 'asistencias_entrenadores', 'ver'),
    (5, 'asistencias_estudiantes', 'ver'),
    (5, 'colegios', 'ver'),
    (5, 'dashboard', 'ver'),
    (5, 'disciplinas', 'ver'),
    (5, 'encuestas', 'ver'),
    (5, 'entrenadores', 'ver'),
    (5, 'estudiantes', 'crear'), (5, 'estudiantes', 'editar'), (5, 'estudiantes', 'eliminar'), (5, 'estudiantes', 'ver'),
    (5, 'evaluaciones', 'ver'),
    (5, 'perfil', 'ver'),
    (5, 'reportes', 'crear'), (5, 'reportes', 'ver'),
    (5, 'usuarios', 'ver'),

-- rol 6 — Asistente (6)
    (6, 'asistencias_estudiantes', 'ver'),
    (6, 'dashboard', 'ver'),
    (6, 'disciplinas', 'ver'),
    (6, 'estudiantes', 'ver'),
    (6, 'evaluaciones', 'ver'),
    (6, 'perfil', 'ver'),

-- rol 7 — Respaldo Entrenador (6)
    (7, 'asistencias_estudiantes', 'ver'),
    (7, 'dashboard', 'ver'),
    (7, 'disciplinas', 'ver'),
    (7, 'estudiantes', 'ver'),
    (7, 'evaluaciones', 'ver'),
    (7, 'perfil', 'ver')
ON CONFLICT (rol_id, modulo, accion) DO NOTHING;

-- =====================================================================
-- 3. DATOS DE TRABAJO — un colegio, una actividad y un horario
--    Inventados, no salen de prod. Sirven para tener algo con qué
--    probar las pantallas mientras se migran los módulos.
-- =====================================================================

INSERT INTO public.colegio (col_id, col_nombre, col_direccion, col_rep_nombre, col_rep_telefono, col_rep_email) VALUES
    (1, 'Colegio de Pruebas Dev', 'Av. Siempre Viva 742, Quito', 'Contacto de Pruebas', '0999999999', 'pruebas@ejemplo.dev')
ON CONFLICT (col_id) DO NOTHING;

INSERT INTO public.actividad (act_id, cat_id, act_nombre, act_descripcion, act_espacio_trabajo, act_tipo_espacio) VALUES
    (1, 1, 'Fútbol', 'Actividad de prueba para desarrollo', 'Cancha principal', 'Exterior')
ON CONFLICT (act_id) DO NOTHING;

INSERT INTO public.colegio_actividad_horario
    (colacthor_id, col_id, act_id, dia_id, colacthor_hora_inicio, colacthor_hora_fin, est_id) VALUES
    (1, 1, 1, 1, '15:00', '16:30', 1),
    (2, 1, 1, 3, '15:00', '16:30', 1)
ON CONFLICT (colacthor_id) DO NOTHING;

-- =====================================================================
-- 4. SECUENCIAS
--    Las PKs son GENERATED BY DEFAULT AS IDENTITY: al insertar IDs
--    explícitos, el contador se queda en 1 y el siguiente insert de la
--    aplicación chocaría contra la PK. Esto lo reposiciona en max+1.
--    Es la misma operación que hará 0006_resync_identity.sql después de
--    la carga del cutover.
-- =====================================================================

DO $$
DECLARE
    r   record;
    seq text;
    mx  bigint;
BEGIN
    FOR r IN
        SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.is_identity = 'YES'
        ORDER BY c.table_name
    LOOP
        seq := pg_get_serial_sequence('public.' || quote_ident(r.table_name), r.column_name);
        CONTINUE WHEN seq IS NULL;

        EXECUTE format('SELECT max(%I) FROM public.%I', r.column_name, r.table_name) INTO mx;

        IF mx IS NULL THEN
            PERFORM setval(seq, 1, false);
        ELSE
            PERFORM setval(seq, mx, true);
        END IF;
    END LOOP;
END
$$;

-- ---------------------------------------------------------------------
-- Comprobación final dentro de la misma transacción.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    n_estado    integer;
    n_rol       integer;
    n_permiso   integer;
    n_grado     integer;
    proximo_col bigint;
BEGIN
    SELECT count(*) INTO n_estado  FROM public.estado;
    SELECT count(*) INTO n_rol     FROM public.rol;
    SELECT count(*) INTO n_permiso FROM public.rol_permiso;
    SELECT count(*) INTO n_grado   FROM public.categoria_nino_grado;

    IF n_estado <> 7 OR n_rol <> 7 OR n_permiso <> 97 OR n_grado <> 13 THEN
        RAISE EXCEPTION
            'Seed incompleto: estado=%, rol=%, rol_permiso=%, grados=% (esperado 7, 7, 97, 13).',
            n_estado, n_rol, n_permiso, n_grado;
    END IF;

    SELECT last_value INTO proximo_col
    FROM pg_sequences
    WHERE schemaname = 'public' AND sequencename = 'colegio_col_id_seq';

    IF proximo_col IS DISTINCT FROM 1 THEN
        RAISE EXCEPTION 'La secuencia de colegio quedó en % y debía quedar en 1.', proximo_col;
    END IF;
END
$$;

COMMIT;
