import { ESTADO } from '../../lib/constants.js';
import { contieneSinTildes } from '../../lib/sql.js';

/**
 * El catálogo de reportes.
 *
 * ---------------------------------------------------------------------------
 * Por qué un registro y no nueve módulos
 *
 * En el sistema viejo cada reporte es un par de componentes de entre 200 y 740
 * líneas —**7 993 en total**— y cada uno reimplementa lo mismo: traerse las
 * filas, cruzarlas en JavaScript, armar la hoja con SheetJS en el navegador y
 * descargarla. Nueve veces, con nueve criterios distintos de qué es "estado" o
 * cómo se formatea una fecha.
 *
 * Aquí lo único propio de cada reporte es **su consulta y sus columnas**. La
 * paginación, los permisos, el alcance, el rango de fechas y la generación del
 * xlsx son maquinaria compartida.
 *
 * ---------------------------------------------------------------------------
 * El alcance
 *
 * Cada definición lo aplica sobre lo que tenga sentido para su entidad, con el
 * mismo criterio que el módulo correspondiente:
 *
 *   colegios, asistencia de entrenadores   -> por `col_id`
 *   disciplinas, asistencia de alumnos,
 *   entrenadores, evaluaciones             -> por `colacthor_id`
 *   estudiantes                            -> por colegio **o** por disciplina
 *   usuarios                               -> la misma regla de "visibles" del
 *                                             módulo de Usuarios
 *   actividades                            -> catálogo global, sin alcance
 *
 * En el sistema viejo ninguno filtraba nada: con la anon key del bundle se
 * exportaba la tabla entera.
 */

export interface Columna {
  clave: string;
  cabecera: string;
  /** Ancho de la columna en el xlsx, en caracteres. */
  ancho: number;
}

export interface ContextoReporte {
  global: boolean;
  colegios: number[];
  disciplinas: number[];
  actorId: number;
}

export interface FiltrosReporte {
  buscar?: string;
  colegio?: number[];
  disciplina?: number;
  estado?: number;
  desde?: string;
  hasta?: string;
}

export interface ConsultaReporte {
  sql: string;
  params: unknown[];
}

export interface Definicion {
  id: string;
  titulo: string;
  descripcion: string;
  /** Además de `reportes:ver`, hace falta el `ver` de este módulo. */
  modulo: string;
  /** Sin rango de fechas el reporte no significa nada: se exige. */
  exigeRango: boolean;
  columnas: Columna[];
  construir: (f: FiltrosReporte, ctx: ContextoReporte) => ConsultaReporte;
}

/** `NULL` cuando el filtro no viene, que es como se apagan en el SQL. */
const oNulo = <T>(v: T | undefined): T | null => v ?? null;
const textoONulo = (v: string | undefined) => (v && v.trim().length > 0 ? v.trim() : null);

// ---------------------------------------------------------------------------

const usuarios: Definicion = {
  id: 'usuarios',
  titulo: 'Usuarios',
  descripcion: 'Personas con acceso al sistema, con sus roles y su estado.',
  modulo: 'usuarios',
  exigeRango: false,
  columnas: [
    { clave: 'usu_id', cabecera: 'ID', ancho: 8 },
    { clave: 'usu_nombre', cabecera: 'Nombre', ancho: 34 },
    { clave: 'usu_correo', cabecera: 'Correo', ancho: 32 },
    { clave: 'usu_telefono', cabecera: 'Teléfono', ancho: 14 },
    { clave: 'roles', cabecera: 'Roles', ancho: 30 },
    { clave: 'estado', cabecera: 'Estado', ancho: 12 },
    { clave: 'usu_fecha_creacion', cabecera: 'Fecha de creación', ancho: 18 },
  ],
  construir: (f, ctx) => ({
    /**
     * Misma regla de visibilidad que el módulo de Usuarios: el coordinador ve
     * a quien toca sus colegios —otros coordinadores, entrenadores con
     * asignación allí, sus auxiliares— y a sí mismo.
     */
    sql: `
      WITH visibles AS (
          SELECT cc.usu_id FROM public.colegio_coordinador cc WHERE cc.col_id = ANY($2::int[])
          UNION
          SELECT ea.ent_id FROM public.entrenador_asignacion ea
            JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
           WHERE cah.col_id = ANY($2::int[])
          UNION
          SELECT aux.usu_id FROM public.entrenador_auxiliar aux
            JOIN public.entrenador_asignacion ea ON ea.ent_id = aux.ent_id
            JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
           WHERE cah.col_id = ANY($2::int[])
      )
      SELECT u.usu_id,
             u.usu_nombre,
             u.usu_correo,
             COALESCE(u.usu_telefono, '')                       AS usu_telefono,
             COALESCE((SELECT string_agg(r.rol_titulo, ', ' ORDER BY r.rol_id)
                         FROM public.usuario_rol ur
                         JOIN public.rol r ON r.rol_id = ur.rol_id
                        WHERE ur.usu_id = u.usu_id), 'Sin rol') AS roles,
             e.est_nombre                                       AS estado,
             to_char(u.usu_fecha_creacion, 'DD/MM/YYYY')        AS usu_fecha_creacion
        FROM public.usuario u
        JOIN public.estado e ON e.est_id = u.est_id
       WHERE ($1::boolean OR u.usu_id IN (SELECT usu_id FROM visibles) OR u.usu_id = $3)
         AND ($4::text IS NULL OR ${contieneSinTildes('u.usu_nombre', '$4')}
                               OR ${contieneSinTildes('u.usu_correo', '$4')})
         AND ($5::int IS NULL OR u.est_id = $5)
       ORDER BY u.usu_nombre`,
    params: [ctx.global, ctx.colegios, ctx.actorId, textoONulo(f.buscar), oNulo(f.estado)],
  }),
};

const colegios: Definicion = {
  id: 'colegios',
  titulo: 'Colegios',
  descripcion: 'Los colegios con sus coordinadores y cuánto se imparte en cada uno.',
  modulo: 'colegios',
  exigeRango: false,
  columnas: [
    { clave: 'col_id', cabecera: 'ID', ancho: 8 },
    { clave: 'col_nombre', cabecera: 'Colegio', ancho: 34 },
    { clave: 'col_direccion', cabecera: 'Dirección', ancho: 34 },
    { clave: 'col_rep_nombre', cabecera: 'Representante', ancho: 28 },
    { clave: 'col_rep_telefono', cabecera: 'Teléfono', ancho: 14 },
    { clave: 'coordinadores', cabecera: 'Coordinadores', ancho: 34 },
    { clave: 'disciplinas', cabecera: 'Disciplinas activas', ancho: 18 },
    { clave: 'estudiantes', cabecera: 'Alumnos activos', ancho: 16 },
  ],
  construir: (f, ctx) => ({
    sql: `
      SELECT c.col_id,
             c.col_nombre,
             COALESCE(c.col_direccion, '')     AS col_direccion,
             COALESCE(c.col_rep_nombre, '')    AS col_rep_nombre,
             COALESCE(c.col_rep_telefono, '')  AS col_rep_telefono,
             COALESCE((SELECT string_agg(u.usu_nombre, ', ' ORDER BY u.usu_nombre)
                         FROM public.colegio_coordinador cc
                         JOIN public.usuario u ON u.usu_id = cc.usu_id
                        WHERE cc.col_id = c.col_id), '') AS coordinadores,
             (SELECT count(*) FROM public.colegio_actividad_horario x
               WHERE x.col_id = c.col_id AND x.est_id = ${ESTADO.ACTIVO})::int AS disciplinas,
             (SELECT count(*) FROM public.nino n
               WHERE n.col_id = c.col_id AND n.est_id = ${ESTADO.ACTIVO})::int AS estudiantes
        FROM public.colegio c
       WHERE ($1::boolean OR c.col_id = ANY($2::int[]))
         AND ($3::text IS NULL OR ${contieneSinTildes('c.col_nombre', '$3')})
         AND ($4::int[] IS NULL OR c.col_id = ANY($4::int[]))
       ORDER BY c.col_nombre`,
    params: [ctx.global, ctx.colegios, textoONulo(f.buscar), oNulo(f.colegio)],
  }),
};

const actividades: Definicion = {
  id: 'actividades',
  titulo: 'Actividades',
  descripcion: 'El catálogo de actividades, con sus espacios y materiales.',
  modulo: 'actividades',
  exigeRango: false,
  columnas: [
    { clave: 'act_id', cabecera: 'ID', ancho: 8 },
    { clave: 'act_nombre', cabecera: 'Actividad', ancho: 26 },
    { clave: 'cat_nombre', cabecera: 'Categoría', ancho: 20 },
    { clave: 'act_descripcion', cabecera: 'Descripción', ancho: 40 },
    { clave: 'act_espacio_trabajo', cabecera: 'Espacio de trabajo', ancho: 22 },
    { clave: 'act_tipo_espacio', cabecera: 'Tipo de espacio', ancho: 18 },
    { clave: 'act_espacio_secundario', cabecera: 'Espacio secundario', ancho: 22 },
    { clave: 'act_indumentaria_tipo', cabecera: 'Indumentaria', ancho: 20 },
    { clave: 'materiales', cabecera: 'Materiales del alumno', ancho: 34 },
    { clave: 'disciplinas', cabecera: 'Disciplinas activas', ancho: 18 },
  ],
  /** Catálogo global: no se filtra por alcance, igual que su propio módulo. */
  construir: (f) => ({
    sql: `
      SELECT a.act_id,
             a.act_nombre,
             COALESCE(cat.cat_nombre, '')            AS cat_nombre,
             COALESCE(a.act_descripcion, '')         AS act_descripcion,
             COALESCE(a.act_espacio_trabajo, '')     AS act_espacio_trabajo,
             COALESCE(a.act_tipo_espacio, '')        AS act_tipo_espacio,
             COALESCE(a.act_espacio_secundario, '')  AS act_espacio_secundario,
             COALESCE(a.act_indumentaria_tipo, '')   AS act_indumentaria_tipo,
             COALESCE(array_to_string(a.act_materiales_alumno, ', '), '') AS materiales,
             (SELECT count(*) FROM public.colegio_actividad_horario x
               WHERE x.act_id = a.act_id AND x.est_id = ${ESTADO.ACTIVO})::int AS disciplinas
        FROM public.actividad a
        LEFT JOIN public.categoria cat ON cat.cat_id = a.cat_id
       WHERE ($1::text IS NULL OR ${contieneSinTildes('a.act_nombre', '$1')})
       ORDER BY a.act_nombre`,
    params: [textoONulo(f.buscar)],
  }),
};

const disciplinas: Definicion = {
  id: 'disciplinas',
  titulo: 'Disciplinas',
  descripcion: 'Colegio, actividad, día y hora, con su entrenador y sus alumnos.',
  modulo: 'disciplinas',
  exigeRango: false,
  columnas: [
    { clave: 'col_nombre', cabecera: 'Colegio', ancho: 30 },
    { clave: 'act_nombre', cabecera: 'Actividad', ancho: 24 },
    { clave: 'dia_nombre', cabecera: 'Día', ancho: 12 },
    { clave: 'hora_inicio', cabecera: 'Hora inicio', ancho: 12 },
    { clave: 'hora_fin', cabecera: 'Hora fin', ancho: 12 },
    { clave: 'estado', cabecera: 'Estado', ancho: 12 },
    { clave: 'entrenadores', cabecera: 'Entrenadores', ancho: 34 },
    { clave: 'alumnos', cabecera: 'Alumnos activos', ancho: 16 },
  ],
  construir: (f, ctx) => ({
    sql: `
      SELECT c.col_nombre,
             a.act_nombre,
             d.dia_nombre,
             to_char(cah.colacthor_hora_inicio, 'HH24:MI') AS hora_inicio,
             to_char(cah.colacthor_hora_fin, 'HH24:MI')    AS hora_fin,
             e.est_nombre                                  AS estado,
             COALESCE((SELECT string_agg(u.usu_nombre, ', ' ORDER BY u.usu_nombre)
                         FROM public.entrenador_asignacion ea
                         JOIN public.usuario u ON u.usu_id = ea.ent_id
                        WHERE ea.colacthor_id = cah.colacthor_id
                          AND ea.entasig_fecha_fin IS NULL
                          AND ea.est_id = ${ESTADO.ACTIVO}), 'Sin entrenador') AS entrenadores,
             (SELECT count(*) FROM public.nino_asignacion na
               WHERE na.colacthor_id = cah.colacthor_id AND na.est_id = ${ESTADO.ACTIVO})::int AS alumnos
        FROM public.colegio_actividad_horario cah
        JOIN public.colegio c   ON c.col_id = cah.col_id
        JOIN public.actividad a ON a.act_id = cah.act_id
        JOIN public.dia d       ON d.dia_id = cah.dia_id
        JOIN public.estado e    ON e.est_id = cah.est_id
       WHERE ($1::boolean OR cah.colacthor_id = ANY($2::int[]) OR cah.col_id = ANY($3::int[]))
         AND ($4::text IS NULL OR ${contieneSinTildes('a.act_nombre', '$4')}
                               OR ${contieneSinTildes('c.col_nombre', '$4')})
         AND ($5::int[] IS NULL OR cah.col_id = ANY($5::int[]))
         AND ($6::int IS NULL OR cah.est_id = $6)
       ORDER BY c.col_nombre, a.act_nombre, d.dia_id, cah.colacthor_hora_inicio`,
    params: [
      ctx.global,
      ctx.disciplinas,
      ctx.colegios,
      textoONulo(f.buscar),
      oNulo(f.colegio),
      oNulo(f.estado),
    ],
  }),
};

const entrenadores: Definicion = {
  id: 'entrenadores',
  titulo: 'Entrenadores',
  descripcion: 'Quién imparte qué, en qué colegios y a cuántos alumnos.',
  modulo: 'entrenadores',
  exigeRango: false,
  columnas: [
    { clave: 'usu_nombre', cabecera: 'Entrenador', ancho: 34 },
    { clave: 'ent_cedula', cabecera: 'Cédula', ancho: 14 },
    { clave: 'usu_correo', cabecera: 'Correo', ancho: 30 },
    { clave: 'usu_telefono', cabecera: 'Teléfono', ancho: 14 },
    { clave: 'estado', cabecera: 'Estado de la ficha', ancho: 16 },
    { clave: 'colegios', cabecera: 'Colegios', ancho: 34 },
    { clave: 'disciplinas', cabecera: 'Disciplinas activas', ancho: 18 },
    { clave: 'alumnos', cabecera: 'Alumnos', ancho: 12 },
  ],
  construir: (f, ctx) => ({
    sql: `
      WITH suyas AS (
          SELECT ea.ent_id, ea.colacthor_id, cah.col_id
            FROM public.entrenador_asignacion ea
            JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
           WHERE ea.entasig_fecha_fin IS NULL AND ea.est_id = ${ESTADO.ACTIVO}
      )
      SELECT u.usu_nombre,
             COALESCE(en.ent_cedula, '')    AS ent_cedula,
             u.usu_correo,
             COALESCE(u.usu_telefono, '')   AS usu_telefono,
             e.est_nombre                   AS estado,
             COALESCE((SELECT string_agg(DISTINCT c.col_nombre, ', ')
                         FROM suyas s JOIN public.colegio c ON c.col_id = s.col_id
                        WHERE s.ent_id = en.ent_id), '') AS colegios,
             (SELECT count(*) FROM suyas s WHERE s.ent_id = en.ent_id)::int AS disciplinas,
             (SELECT count(DISTINCT na.nino_id)
                FROM suyas s
                JOIN public.nino_asignacion na ON na.colacthor_id = s.colacthor_id
               WHERE s.ent_id = en.ent_id AND na.est_id = ${ESTADO.ACTIVO})::int AS alumnos
        FROM public.entrenador en
        JOIN public.usuario u ON u.usu_id = en.ent_id
        JOIN public.estado e  ON e.est_id = en.est_id
       WHERE ($1::boolean
              OR EXISTS (SELECT 1 FROM suyas s
                          WHERE s.ent_id = en.ent_id
                            AND (s.colacthor_id = ANY($2::int[]) OR s.col_id = ANY($3::int[]))))
         AND ($4::text IS NULL OR ${contieneSinTildes('u.usu_nombre', '$4')})
         AND ($5::int IS NULL OR en.est_id = $5)
       ORDER BY u.usu_nombre`,
    params: [ctx.global, ctx.disciplinas, ctx.colegios, textoONulo(f.buscar), oNulo(f.estado)],
  }),
};

const estudiantes: Definicion = {
  id: 'estudiantes',
  titulo: 'Alumnos',
  descripcion: 'Los alumnos con su colegio, su grado y sus disciplinas.',
  modulo: 'estudiantes',
  exigeRango: false,
  columnas: [
    { clave: 'nino_id', cabecera: 'ID', ancho: 8 },
    { clave: 'nino_nombre', cabecera: 'Alumno', ancho: 34 },
    { clave: 'nino_edad', cabecera: 'Edad', ancho: 8 },
    { clave: 'col_nombre', cabecera: 'Colegio', ancho: 30 },
    { clave: 'catninograd_nombre', cabecera: 'Grado', ancho: 20 },
    { clave: 'nino_cedula', cabecera: 'Cédula', ancho: 14 },
    { clave: 'transporte', cabecera: 'Toma transporte', ancho: 16 },
    { clave: 'estado', cabecera: 'Estado', ancho: 12 },
    { clave: 'disciplinas', cabecera: 'Disciplinas', ancho: 40 },
    { clave: 'representantes', cabecera: 'Representantes', ancho: 30 },
    { clave: 'nino_info_salud', cabecera: 'Información de salud', ancho: 40 },
    { clave: 'nino_fecha_creacion', cabecera: 'Fecha de creación', ancho: 18 },
  ],
  construir: (f, ctx) => ({
    sql: `
      SELECT n.nino_id,
             n.nino_nombre,
             n.nino_edad,
             c.col_nombre,
             COALESCE(g.catninograd_nombre, '')                    AS catninograd_nombre,
             COALESCE(n.nino_cedula, '')                           AS nino_cedula,
             CASE WHEN n.nino_toma_transporte THEN 'Sí' ELSE 'No' END AS transporte,
             e.est_nombre                                          AS estado,
             COALESCE((SELECT string_agg(a.act_nombre || ' (' || d.dia_nombre || ')', ', '
                                         ORDER BY d.dia_id)
                         FROM public.nino_asignacion na
                         JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = na.colacthor_id
                         JOIN public.actividad a ON a.act_id = cah.act_id
                         JOIN public.dia d ON d.dia_id = cah.dia_id
                        WHERE na.nino_id = n.nino_id AND na.est_id = ${ESTADO.ACTIVO}), '') AS disciplinas,
             COALESCE((SELECT string_agg(u.usu_nombre, ', ' ORDER BY u.usu_nombre)
                         FROM public.nino_padre np
                         JOIN public.padre p ON p.padre_id = np.padre_id
                         JOIN public.usuario u ON u.usu_id = p.usu_id
                        WHERE np.nino_id = n.nino_id), '')          AS representantes,
             COALESCE(n.nino_info_salud, '')                        AS nino_info_salud,
             to_char(n.nino_fecha_creacion, 'DD/MM/YYYY')           AS nino_fecha_creacion
        FROM public.nino n
        JOIN public.colegio c ON c.col_id = n.col_id
        JOIN public.estado e  ON e.est_id = n.est_id
        LEFT JOIN public.categoria_nino_grado g ON g.catninograd_id = n.catninograd_id
       WHERE ($1::boolean
              OR n.col_id = ANY($3::int[])
              OR EXISTS (SELECT 1 FROM public.nino_asignacion na
                          WHERE na.nino_id = n.nino_id
                            AND na.est_id = ${ESTADO.ACTIVO}
                            AND na.colacthor_id = ANY($2::int[])))
         AND ($4::text IS NULL OR ${contieneSinTildes('n.nino_nombre', '$4')})
         AND ($5::int[] IS NULL OR n.col_id = ANY($5::int[]))
         AND ($6::int IS NULL OR n.est_id = $6)
         AND ($7::int IS NULL OR EXISTS (SELECT 1 FROM public.nino_asignacion na
                                          WHERE na.nino_id = n.nino_id
                                            AND na.colacthor_id = $7
                                            AND na.est_id = ${ESTADO.ACTIVO}))
       ORDER BY c.col_nombre, n.nino_nombre`,
    params: [
      ctx.global,
      ctx.disciplinas,
      ctx.colegios,
      textoONulo(f.buscar),
      oNulo(f.colegio),
      oNulo(f.estado),
      oNulo(f.disciplina),
    ],
  }),
};

const asistenciasAlumnos: Definicion = {
  id: 'asistencias-alumnos',
  titulo: 'Asistencia de alumnos',
  descripcion: 'Una fila por marca. Exige un rango de fechas.',
  modulo: 'asistencias_estudiantes',
  exigeRango: true,
  columnas: [
    { clave: 'fecha', cabecera: 'Fecha', ancho: 12 },
    { clave: 'col_nombre', cabecera: 'Colegio', ancho: 30 },
    { clave: 'act_nombre', cabecera: 'Actividad', ancho: 24 },
    { clave: 'dia_nombre', cabecera: 'Día', ancho: 12 },
    { clave: 'horario', cabecera: 'Horario', ancho: 14 },
    { clave: 'nino_nombre', cabecera: 'Alumno', ancho: 34 },
    { clave: 'estado', cabecera: 'Asistencia', ancho: 14 },
    { clave: 'hora_tarde', cabecera: 'Hora de llegada', ancho: 14 },
    { clave: 'razon', cabecera: 'Justificación', ancho: 40 },
    { clave: 'registrado_por', cabecera: 'Registrado por', ancho: 30 },
  ],
  construir: (f, ctx) => ({
    sql: `
      SELECT to_char(an.asisnino_fecha, 'DD/MM/YYYY')            AS fecha,
             c.col_nombre,
             a.act_nombre,
             d.dia_nombre,
             to_char(cah.colacthor_hora_inicio, 'HH24:MI') || '–' ||
               COALESCE(to_char(cah.colacthor_hora_fin, 'HH24:MI'), '')  AS horario,
             n.nino_nombre,
             ae.asisest_nombre                                   AS estado,
             COALESCE(to_char(an.asisnino_hora_tarde, 'HH24:MI'), '')    AS hora_tarde,
             COALESCE(an.asisnino_razon_justificado, '')         AS razon,
             COALESCE(u.usu_nombre, '')                          AS registrado_por
        FROM public.asistencia_nino an
        JOIN public.nino n ON n.nino_id = an.nino_id
        JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = an.colacthor_id
        JOIN public.colegio c   ON c.col_id = cah.col_id
        JOIN public.actividad a ON a.act_id = cah.act_id
        JOIN public.dia d       ON d.dia_id = cah.dia_id
        JOIN public.asistencia_estado ae ON ae.asisest_id = an.asisest_id
        LEFT JOIN public.usuario u ON u.usu_id = an.usu_registrador
       WHERE an.asisnino_fecha BETWEEN $4::date AND $5::date
         AND ($1::boolean OR an.colacthor_id = ANY($2::int[]) OR cah.col_id = ANY($3::int[]))
         AND ($6::text IS NULL OR ${contieneSinTildes('n.nino_nombre', '$6')})
         AND ($7::int[] IS NULL OR cah.col_id = ANY($7::int[]))
         AND ($8::int IS NULL OR an.colacthor_id = $8)
         AND ($9::int IS NULL OR an.asisest_id = $9)
       ORDER BY an.asisnino_fecha DESC, c.col_nombre, a.act_nombre, n.nino_nombre`,
    params: [
      ctx.global,
      ctx.disciplinas,
      ctx.colegios,
      f.desde,
      f.hasta,
      textoONulo(f.buscar),
      oNulo(f.colegio),
      oNulo(f.disciplina),
      oNulo(f.estado),
    ],
  }),
};

const asistenciasEntrenadores: Definicion = {
  id: 'asistencias-entrenadores',
  titulo: 'Asistencia de entrenadores',
  descripcion: 'Titulares y auxiliares en una sola lista. Exige un rango de fechas.',
  modulo: 'asistencias_entrenadores',
  exigeRango: true,
  columnas: [
    { clave: 'fecha', cabecera: 'Fecha', ancho: 12 },
    { clave: 'col_nombre', cabecera: 'Colegio', ancho: 30 },
    { clave: 'tipo', cabecera: 'Tipo', ancho: 14 },
    { clave: 'usu_nombre', cabecera: 'Persona', ancho: 34 },
    { clave: 'estado', cabecera: 'Asistencia', ancho: 14 },
    { clave: 'hora_tarde', cabecera: 'Hora de llegada', ancho: 14 },
    { clave: 'razon', cabecera: 'Justificación', ancho: 40 },
    { clave: 'registrado_por', cabecera: 'Registrado por', ancho: 30 },
  ],
  /**
   * Las dos tablas en una sola lista. El sistema viejo tenía la de auxiliares
   * como un reporte aparte que casi nadie abría, así que los 283 registros de
   * auxiliares no salían en el informe de asistencia de personal.
   */
  construir: (f, ctx) => ({
    sql: `
      SELECT to_char(ae.asisent_fecha, 'DD/MM/YYYY')        AS fecha,
             c.col_nombre,
             'Entrenador'::text                             AS tipo,
             u.usu_nombre,
             est.asisest_nombre                             AS estado,
             COALESCE(to_char(ae.asisent_hora_tarde, 'HH24:MI'), '')  AS hora_tarde,
             COALESCE(ae.asisent_razon_justificado, '')     AS razon,
             COALESCE(reg.usu_nombre, '')                   AS registrado_por,
             ae.asisent_fecha                               AS _orden
        FROM public.asistencia_entrenador ae
        JOIN public.colegio c ON c.col_id = ae.col_id
        JOIN public.usuario u ON u.usu_id = ae.ent_id
        JOIN public.asistencia_estado est ON est.asisest_id = ae.asisest_id
        LEFT JOIN public.usuario reg ON reg.usu_id = ae.usu_registrador
       WHERE ae.asisent_fecha BETWEEN $3::date AND $4::date
         AND ($1::boolean OR ae.col_id = ANY($2::int[]))
         AND ($5::text IS NULL OR ${contieneSinTildes('u.usu_nombre', '$5')})
         AND ($6::int[] IS NULL OR ae.col_id = ANY($6::int[]))
         AND ($7::int IS NULL OR ae.asisest_id = $7)

      UNION ALL

      SELECT to_char(aa.asisaux_fecha, 'DD/MM/YYYY'),
             c.col_nombre,
             'Auxiliar'::text,
             u.usu_nombre,
             est.asisest_nombre,
             COALESCE(to_char(aa.asisaux_hora_tarde, 'HH24:MI'), ''),
             COALESCE(aa.asisaux_razon_justificado, ''),
             COALESCE(reg.usu_nombre, ''),
             aa.asisaux_fecha
        FROM public.asistencia_auxiliar aa
        JOIN public.colegio c ON c.col_id = aa.col_id
        JOIN public.usuario u ON u.usu_id = aa.usu_id
        JOIN public.asistencia_estado est ON est.asisest_id = aa.asisest_id
        LEFT JOIN public.usuario reg ON reg.usu_id = aa.usu_registrador
       WHERE aa.asisaux_fecha BETWEEN $3::date AND $4::date
         AND ($1::boolean OR aa.col_id = ANY($2::int[]))
         AND ($5::text IS NULL OR ${contieneSinTildes('u.usu_nombre', '$5')})
         AND ($6::int[] IS NULL OR aa.col_id = ANY($6::int[]))
         AND ($7::int IS NULL OR aa.asisest_id = $7)

       ORDER BY 9 DESC, 2, 4`,
    params: [
      ctx.global,
      ctx.colegios,
      f.desde,
      f.hasta,
      textoONulo(f.buscar),
      oNulo(f.colegio),
      oNulo(f.estado),
    ],
  }),
};

const evaluaciones: Definicion = {
  id: 'evaluaciones',
  titulo: 'Evaluaciones',
  descripcion: 'Una fila por alumno y evaluación, con su puntaje.',
  modulo: 'evaluaciones',
  exigeRango: false,
  columnas: [
    { clave: 'eva_titulo', cabecera: 'Evaluación', ancho: 30 },
    { clave: 'eva_categoria', cabecera: 'Categoría', ancho: 20 },
    { clave: 'col_nombre', cabecera: 'Colegio', ancho: 30 },
    { clave: 'act_nombre', cabecera: 'Actividad', ancho: 24 },
    { clave: 'nino_nombre', cabecera: 'Alumno', ancho: 34 },
    { clave: 'estado', cabecera: 'Estado', ancho: 14 },
    { clave: 'puntaje', cabecera: 'Puntaje obtenido', ancho: 16 },
    { clave: 'eva_puntaje_total', cabecera: 'Puntaje total', ancho: 14 },
    { clave: 'porcentaje', cabecera: '%', ancho: 8 },
    { clave: 'finalizacion', cabecera: 'Fecha de evaluación', ancho: 18 },
    { clave: 'evaluado_por', cabecera: 'Evaluado por', ancho: 30 },
  ],
  construir: (f, ctx) => ({
    sql: `
      SELECT e.eva_titulo,
             COALESCE(e.eva_categoria, '')            AS eva_categoria,
             c.col_nombre,
             a.act_nombre,
             n.nino_nombre,
             est.est_nombre                           AS estado,
             COALESCE(p.puntaje, 0)::float8           AS puntaje,
             e.eva_puntaje_total::float8              AS eva_puntaje_total,
             CASE WHEN e.eva_puntaje_total > 0
                  THEN round(COALESCE(p.puntaje, 0) * 100 / e.eva_puntaje_total)::int
                  ELSE 0 END                          AS porcentaje,
             COALESCE(to_char(np.evaninopen_fecha_finalizacion, 'DD/MM/YYYY'), '') AS finalizacion,
             COALESCE(reg.usu_nombre, '')             AS evaluado_por
        FROM public.evaluacion_nino_pendiente np
        JOIN public.evaluacion e ON e.eva_id = np.eva_id
        JOIN public.nino_asignacion na ON na.ninoasig_id = np.ninoasig_id
        JOIN public.nino n ON n.nino_id = na.nino_id
        JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = na.colacthor_id
        JOIN public.colegio c   ON c.col_id = cah.col_id
        JOIN public.actividad a ON a.act_id = cah.act_id
        JOIN public.estado est  ON est.est_id = np.est_id
        LEFT JOIN public.usuario reg ON reg.usu_id = np.usu_id_registrador
        LEFT JOIN LATERAL (
            SELECT sum(i.evaint_puntaje_obtenido) AS puntaje
              FROM public.evaluacion_intento i
             WHERE i.evaninopen_id = np.evaninopen_id
        ) p ON TRUE
       WHERE np.est_id <> ${ESTADO.INACTIVO}
         AND ($1::boolean OR na.colacthor_id = ANY($2::int[]) OR cah.col_id = ANY($3::int[]))
         AND ($4::text IS NULL OR ${contieneSinTildes('n.nino_nombre', '$4')}
                               OR ${contieneSinTildes('e.eva_titulo', '$4')})
         AND ($5::int[] IS NULL OR cah.col_id = ANY($5::int[]))
         AND ($6::int IS NULL OR np.est_id = $6)
         AND ($7::int IS NULL OR na.colacthor_id = $7)
       ORDER BY e.eva_titulo, c.col_nombre, n.nino_nombre`,
    params: [
      ctx.global,
      ctx.disciplinas,
      ctx.colegios,
      textoONulo(f.buscar),
      oNulo(f.colegio),
      oNulo(f.estado),
      oNulo(f.disciplina),
    ],
  }),
};

/**
 * Encuestas no está.
 *
 * Tiene **cero filas en producción** —encuesta, sus preguntas y sus respuestas
 * están vacías— y su módulo se rehace entero en la Fase 14. Un reporte de una
 * tabla vacía no es un reporte, es una pantalla que miente.
 */
export const DEFINICIONES: Definicion[] = [
  usuarios,
  colegios,
  actividades,
  disciplinas,
  entrenadores,
  estudiantes,
  asistenciasAlumnos,
  asistenciasEntrenadores,
  evaluaciones,
];

export function definicionDe(id: string): Definicion | undefined {
  return DEFINICIONES.find((d) => d.id === id);
}
