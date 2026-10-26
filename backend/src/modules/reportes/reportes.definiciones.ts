import { ESTADO, ROL } from '../../lib/constants.js';
import { horarioTexto, primerHorario } from '../../lib/horarios.js';
import { contieneSinTildes } from '../../lib/sql.js';
import { HOY_EC, diaEc, textoEc } from '../../lib/fecha.js';
import { CTE_VISIBLES } from '../usuarios/usuarios.repository.js';

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
  /** Novedades: `false` quita ausencias y correcciones. Sin valor, salen. */
  ausencias?: boolean;
}

/** Una opción de un desplegable de filtro. */
export interface OpcionFiltro {
  id: number;
  nombre: string;
}

/**
 * Qué filtros tiene sentido enseñar en cada reporte.
 *
 * Hasta el 2026-10-07 la pantalla enseñaba los cinco en los nueve: el colegio
 * y las fechas en reportes que no los usaban, y un "Estado" Activo/Inactivo
 * que en asistencias filtraba Presente/Ausente y en evaluaciones no casaba
 * con nada. Ahora cada definición dice los suyos y el desplegable de estado
 * trae sus propias opciones.
 */
export interface FiltrosDisponibles {
  colegio: boolean;
  disciplina: boolean;
  estado: { etiqueta: string; opciones: OpcionFiltro[] } | null;
  /** Rango de fechas. Si el reporte lo exige, lo usa; nunca al revés. */
  fechas: boolean;
  /** Casilla "Ver ausencias" (solo Novedades). */
  ausencias?: boolean;
}

const ACTIVO_INACTIVO = (etiqueta = 'Estado') => ({
  etiqueta,
  opciones: [
    { id: ESTADO.ACTIVO, nombre: 'Activo' },
    { id: ESTADO.INACTIVO, nombre: 'Inactivo' },
  ],
});

const ASISTENCIA = {
  etiqueta: 'Asistencia',
  opciones: [
    { id: 1, nombre: 'Presente' },
    { id: 3, nombre: 'Tarde' },
    { id: 4, nombre: 'Justificado' },
    { id: 2, nombre: 'Ausente' },
  ],
};

export interface ConsultaReporte {
  sql: string;
  params: unknown[];
}

export interface TotalPantalla {
  clave: string;
  etiqueta: string;
  /** Se formatea como moneda ($ con dos decimales). Por defecto, número plano. */
  moneda?: boolean;
}

export interface Totales {
  consulta: ConsultaReporte;
  formato: TotalPantalla[];
}

export interface Definicion {
  id: string;
  titulo: string;
  descripcion: string;
  /** Además de `reportes:ver`, hace falta `accion` (por defecto `ver`) de este módulo. */
  modulo: string;
  /**
   * Novedades pide Eliminar: su reporte enseña quién escribió cada una y las
   * eliminadas, que es justo lo que da ese permiso en el módulo.
   */
  accion?: 'ver' | 'eliminar';
  /**
   * Si está, además del permiso del módulo exige alguno de estos roles.
   * Inscripciones (2026-10-15): solo Propietario; el reporte lleva montos de
   * recaudación y no se abre a nadie más aunque herede `inscripciones:ver`.
   */
  soloRoles?: number[];
  /** Sin rango de fechas el reporte no significa nada: se exige. */
  exigeRango: boolean;
  filtros: FiltrosDisponibles;
  columnas: Columna[];
  /**
   * Columnas que **no salen si no se piden**.
   *
   * Un reporte se manda por correo y se reenvía. Lo que es útil tenerlo a mano
   * —la información de salud de un alumno, para organizar una salida— no tiene
   * por qué viajar en cada Excel que alguien saque para contar inscripciones.
   * Siguen estando; hay que marcar la casilla, y la exportación queda auditada.
   */
  columnasSensibles?: string[];
  construir: (f: FiltrosReporte, ctx: ContextoReporte) => ConsultaReporte;
  /**
   * Un conjunto de cifras agregadas que se pinta encima de la tabla en
   * pantalla, con los mismos filtros que el detalle. Pensado para los
   * reportes donde el total importa de un vistazo —Inscripciones y su
   * total recaudado—. En el Excel sigue viviendo en la hoja Resumen.
   */
  totales?: (f: FiltrosReporte, ctx: ContextoReporte) => Totales;
  /**
   * Una hoja más en el Excel, detrás del detalle, con parte de las mismas
   * filas y sus propias columnas (que la consulta trae además de las suyas).
   */
  hojaExtra?: {
    titulo: string;
    columnas: Columna[];
    incluye: (fila: Record<string, unknown>) => boolean;
    /** Si sale con estos filtros. */
    sale: (f: FiltrosReporte) => boolean;
    /** Sus filas salen solo en ella, no en la hoja del detalle. */
    aparte?: boolean;
  };
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
  filtros: { colegio: false, disciplina: false, estado: ACTIVO_INACTIVO(), fechas: false },
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
      WITH ${CTE_VISIBLES}
      SELECT u.usu_id,
             u.usu_nombre,
             u.usu_correo,
             COALESCE(u.usu_telefono, '')                       AS usu_telefono,
             COALESCE((SELECT string_agg(r.rol_titulo, ', ' ORDER BY r.rol_id)
                         FROM public.usuario_rol ur
                         JOIN public.rol r ON r.rol_id = ur.rol_id
                        WHERE ur.usu_id = u.usu_id), 'Sin rol') AS roles,
             ARRAY(SELECT r.rol_titulo
                     FROM public.usuario_rol ur
                     JOIN public.rol r ON r.rol_id = ur.rol_id
                    WHERE ur.usu_id = u.usu_id ORDER BY r.rol_id) AS _roles,
             e.est_nombre                                       AS estado,
             ${textoEc('u.usu_fecha_creacion', 'DD/MM/YYYY')}        AS usu_fecha_creacion
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
  filtros: { colegio: true, disciplina: false, estado: null, fechas: false },
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
  filtros: { colegio: false, disciplina: false, estado: null, fechas: false },
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
  descripcion: 'Colegio, actividad, días y horas, con su entrenador y sus alumnos.',
  modulo: 'disciplinas',
  exigeRango: false,
  filtros: { colegio: true, disciplina: false, estado: ACTIVO_INACTIVO(), fechas: false },
  columnas: [
    { clave: 'col_nombre', cabecera: 'Colegio', ancho: 30 },
    { clave: 'act_nombre', cabecera: 'Actividad', ancho: 24 },
    { clave: 'horario', cabecera: 'Horario', ancho: 36 },
    { clave: 'estado', cabecera: 'Estado', ancho: 12 },
    { clave: 'entrenadores', cabecera: 'Entrenadores', ancho: 34 },
    { clave: 'alumnos', cabecera: 'Alumnos activos', ancho: 16 },
  ],
  construir: (f, ctx) => ({
    sql: `
      SELECT c.col_nombre,
             a.act_nombre,
             COALESCE(${horarioTexto('cah')}, '')          AS horario,
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
        JOIN public.estado e    ON e.est_id = cah.est_id
       WHERE ($1::boolean OR cah.colacthor_id = ANY($2::int[]) OR cah.col_id = ANY($3::int[]))
         AND ($4::text IS NULL OR ${contieneSinTildes('a.act_nombre', '$4')}
                               OR ${contieneSinTildes('c.col_nombre', '$4')})
         AND ($5::int[] IS NULL OR cah.col_id = ANY($5::int[]))
         AND ($6::int IS NULL OR cah.est_id = $6)
       ORDER BY c.col_nombre, a.act_nombre, ${primerHorario('cah')}`,
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
  descripcion: 'Titulares y auxiliares: qué imparten, en qué colegios y a cuántos alumnos.',
  modulo: 'entrenadores',
  exigeRango: false,
  filtros: { colegio: true, disciplina: false, estado: ACTIVO_INACTIVO(), fechas: false },
  columnas: [
    { clave: 'tipo', cabecera: 'Tipo', ancho: 12 },
    { clave: 'usu_nombre', cabecera: 'Nombre', ancho: 34 },
    { clave: 'acompana_a', cabecera: 'Acompaña a', ancho: 34 },
    { clave: 'usu_cedula', cabecera: 'Cédula', ancho: 14 },
    { clave: 'usu_correo', cabecera: 'Correo', ancho: 30 },
    { clave: 'usu_telefono', cabecera: 'Teléfono', ancho: 14 },
    { clave: 'estado', cabecera: 'Estado', ancho: 12 },
    { clave: 'colegios', cabecera: 'Colegios', ancho: 34 },
    { clave: 'disciplinas', cabecera: 'Disciplinas activas', ancho: 18 },
    { clave: 'alumnos', cabecera: 'Alumnos', ancho: 12 },
  ],
  /**
   * Titulares y auxiliares en una sola lista (pedido del cliente, 2026-10-07).
   *
   * El auxiliar no tiene disciplinas propias: trabaja en las de sus titulares,
   * así que sus colegios, disciplinas y alumnos son los de ellos, sin repetir.
   * Su estado es el de su usuario (no tiene ficha de entrenador). Quien es
   * titular y además auxiliar de otro sale dos veces, una por papel, igual
   * que en la asistencia del personal.
   */
  construir: (f, ctx) => ({
    sql: `
      WITH suyas AS (
          SELECT ea.ent_id, ea.colacthor_id, cah.col_id
            FROM public.entrenador_asignacion ea
            JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
           WHERE ea.entasig_fecha_fin IS NULL AND ea.est_id = ${ESTADO.ACTIVO}
      ),
      personas AS (
          SELECT 'Entrenador'::text AS tipo, en.ent_id AS usu_id, en.est_id,
                 ARRAY[en.ent_id] AS titulares, NULL::text AS acompana_a
            FROM public.entrenador en
          UNION ALL
          SELECT 'Auxiliar', aux.usu_id, u.est_id,
                 array_agg(aux.ent_id),
                 string_agg(t.usu_nombre, ', ' ORDER BY t.usu_nombre)
            FROM public.entrenador_auxiliar aux
            JOIN public.usuario u ON u.usu_id = aux.usu_id
            JOIN public.usuario t ON t.usu_id = aux.ent_id
           WHERE aux.est_id = ${ESTADO.ACTIVO}
           GROUP BY aux.usu_id, u.est_id
      )
      SELECT p.tipo,
             u.usu_nombre,
             COALESCE(p.acompana_a, '')     AS acompana_a,
             COALESCE(u.usu_cedula, '')     AS usu_cedula,
             u.usu_correo,
             COALESCE(u.usu_telefono, '')   AS usu_telefono,
             e.est_nombre                   AS estado,
             COALESCE((SELECT string_agg(DISTINCT c.col_nombre, ', ')
                         FROM suyas s JOIN public.colegio c ON c.col_id = s.col_id
                        WHERE s.ent_id = ANY(p.titulares)), '') AS colegios,
             ARRAY(SELECT DISTINCT c.col_nombre
                     FROM suyas s JOIN public.colegio c ON c.col_id = s.col_id
                    WHERE s.ent_id = ANY(p.titulares))  AS _colegios,
             (SELECT count(DISTINCT s.colacthor_id) FROM suyas s
               WHERE s.ent_id = ANY(p.titulares))::int AS disciplinas,
             (SELECT count(DISTINCT na.nino_id)
                FROM suyas s
                JOIN public.nino_asignacion na ON na.colacthor_id = s.colacthor_id
               WHERE s.ent_id = ANY(p.titulares) AND na.est_id = ${ESTADO.ACTIVO})::int AS alumnos
        FROM personas p
        JOIN public.usuario u ON u.usu_id = p.usu_id
        JOIN public.estado e  ON e.est_id = p.est_id
       WHERE ($1::boolean
              OR EXISTS (SELECT 1 FROM suyas s
                          WHERE s.ent_id = ANY(p.titulares)
                            AND (s.colacthor_id = ANY($2::int[]) OR s.col_id = ANY($3::int[]))))
         AND ($4::text IS NULL OR ${contieneSinTildes('u.usu_nombre', '$4')})
         AND ($5::int IS NULL OR p.est_id = $5)
         AND ($6::int[] IS NULL
              OR EXISTS (SELECT 1 FROM suyas s
                          WHERE s.ent_id = ANY(p.titulares) AND s.col_id = ANY($6::int[])))
       ORDER BY u.usu_nombre, p.tipo DESC`,
    params: [
      ctx.global,
      ctx.disciplinas,
      ctx.colegios,
      textoONulo(f.buscar),
      oNulo(f.estado),
      oNulo(f.colegio),
    ],
  }),
};

const estudiantes: Definicion = {
  id: 'estudiantes',
  titulo: 'Alumnos',
  descripcion: 'Los alumnos con su colegio, su grado y sus disciplinas.',
  modulo: 'estudiantes',
  exigeRango: false,
  filtros: { colegio: true, disciplina: true, estado: ACTIVO_INACTIVO(), fechas: false },
  /** Dato médico de un menor: se incluye a propósito, no por defecto. */
  columnasSensibles: ['nino_info_salud'],
  columnas: [
    { clave: 'nino_id', cabecera: 'ID', ancho: 8 },
    { clave: 'nino_nombre', cabecera: 'Alumno', ancho: 34 },
    { clave: 'nino_fecha_nacimiento', cabecera: 'Fecha de nacimiento', ancho: 18 },
    { clave: 'nino_edad', cabecera: 'Edad', ancho: 8 },
    { clave: 'col_nombre', cabecera: 'Colegio', ancho: 30 },
    { clave: 'catninograd_nombre', cabecera: 'Grado', ancho: 20 },
    { clave: 'transporte', cabecera: 'Salida', ancho: 18 },
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
             COALESCE(to_char(n.nino_fecha_nacimiento, 'YYYY-MM-DD'), '') AS nino_fecha_nacimiento,
             date_part('year', age(${HOY_EC}, n.nino_fecha_nacimiento))::int AS nino_edad,
             c.col_nombre,
             COALESCE(g.catninograd_nombre, '')                    AS catninograd_nombre,
             CASE n.nino_modalidad_salida WHEN 'escolar' THEN 'Transporte escolar'
                                          WHEN 'privado' THEN 'Transporte privado'
                                          ELSE '' END              AS transporte,
             e.est_nombre                                          AS estado,
             COALESCE((SELECT string_agg(a.act_nombre || ' (' || COALESCE(${horarioTexto('cah')}, '') || ')', ', '
                                         ORDER BY ${primerHorario('cah')})
                         FROM public.nino_asignacion na
                         JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = na.colacthor_id
                         JOIN public.actividad a ON a.act_id = cah.act_id
                        WHERE na.nino_id = n.nino_id AND na.est_id = ${ESTADO.ACTIVO}), '') AS disciplinas,
             (SELECT COALESCE(json_agg(json_build_object(
                         'id', cah.colacthor_id,
                         'colegio', cc.col_nombre,
                         'actividad', a.act_nombre,
                         'horario', COALESCE(${horarioTexto('cah')}, ''))), '[]'::json)
                FROM public.nino_asignacion na
                JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = na.colacthor_id
                JOIN public.colegio cc  ON cc.col_id = cah.col_id
                JOIN public.actividad a ON a.act_id = cah.act_id
               WHERE na.nino_id = n.nino_id AND na.est_id = ${ESTADO.ACTIVO}) AS _disciplinas,
             COALESCE((SELECT string_agg(u.usu_nombre, ', ' ORDER BY u.usu_nombre)
                         FROM public.nino_padre np
                         JOIN public.padre p ON p.padre_id = np.padre_id
                         JOIN public.usuario u ON u.usu_id = p.usu_id
                        WHERE np.nino_id = n.nino_id), '')          AS representantes,
             COALESCE(n.nino_info_salud, '')                        AS nino_info_salud,
             ${textoEc('n.nino_fecha_creacion', 'DD/MM/YYYY')}           AS nino_fecha_creacion
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
  filtros: { colegio: true, disciplina: true, estado: ASISTENCIA, fechas: true },
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
    { clave: 'registrado_el', cabecera: 'Hora de registro', ancho: 17 },
  ],
  construir: (f, ctx) => ({
    sql: `
      SELECT to_char(an.asisnino_fecha, 'DD/MM/YYYY')            AS fecha,
             c.col_nombre,
             a.act_nombre,
             d.dia_nombre,
             COALESCE(to_char(h.dishor_hora_inicio, 'HH24:MI') || '–' ||
                      to_char(h.dishor_hora_fin, 'HH24:MI'), '')  AS horario,
             n.nino_nombre,
             ae.asisest_nombre                                   AS estado,
             COALESCE(to_char(an.asisnino_hora_tarde, 'HH24:MI'), '')    AS hora_tarde,
             COALESCE(an.asisnino_razon_justificado, '')         AS razon,
             COALESCE(u.usu_nombre, '')                          AS registrado_por,
             COALESCE(${textoEc('an.asisnino_fecha_registrado', 'DD/MM/YYYY HH24:MI')}, '') AS registrado_el,
             an.asisest_id                                       AS _asisest,
             COALESCE(${horarioTexto('cah')}, '')                AS _disc_horario
        FROM public.asistencia_nino an
        JOIN public.nino n ON n.nino_id = an.nino_id
        JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = an.colacthor_id
        JOIN public.colegio c   ON c.col_id = cah.col_id
        JOIN public.actividad a ON a.act_id = cah.act_id
        -- El dia y la hora de esa clase: los de la fecha, entre los de la disciplina.
        JOIN public.dia d       ON d.dia_id = EXTRACT(ISODOW FROM an.asisnino_fecha)::smallint
        LEFT JOIN public.disciplina_horario h
               ON h.colacthor_id = cah.colacthor_id AND h.dia_id = d.dia_id
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
  filtros: { colegio: true, disciplina: false, estado: ASISTENCIA, fechas: true },
  columnas: [
    { clave: 'fecha', cabecera: 'Fecha', ancho: 12 },
    { clave: 'col_nombre', cabecera: 'Colegio', ancho: 30 },
    { clave: 'tipo', cabecera: 'Tipo', ancho: 14 },
    { clave: 'usu_nombre', cabecera: 'Persona', ancho: 34 },
    { clave: 'estado', cabecera: 'Asistencia', ancho: 14 },
    { clave: 'hora_tarde', cabecera: 'Hora de llegada', ancho: 14 },
    { clave: 'razon', cabecera: 'Justificación', ancho: 40 },
    { clave: 'registrado_por', cabecera: 'Registrado por', ancho: 30 },
    { clave: 'registrado_el', cabecera: 'Hora de registro', ancho: 17 },
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
             COALESCE(${textoEc('ae.asisent_fecha_registrado', 'DD/MM/YYYY HH24:MI')}, '') AS registrado_el,
             ae.asisent_fecha                               AS _orden,
             ae.ent_id                                      AS _persona,
             ae.asisest_id                                  AS _asisest
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
             COALESCE(${textoEc('aa.asisaux_fecha_registrado', 'DD/MM/YYYY HH24:MI')}, ''),
             aa.asisaux_fecha,
             aa.usu_id,
             aa.asisest_id
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

       ORDER BY 10 DESC, 2, 4`,
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
  modulo: 'calificaciones',
  exigeRango: false,
  filtros: {
    colegio: true,
    disciplina: true,
    estado: {
      etiqueta: 'Estado',
      opciones: [
        { id: ESTADO.PENDIENTE, nombre: 'Pendiente' },
        { id: ESTADO.EVALUADO, nombre: 'Evaluado' },
      ],
    },
    fechas: false,
  },
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
             COALESCE(${textoEc('np.evaninopen_fecha_finalizacion', 'DD/MM/YYYY')}, '') AS finalizacion,
             COALESCE(reg.usu_nombre, '')             AS evaluado_por,
             np.est_id                                AS _est
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

const representantes: Definicion = {
  id: 'representantes',
  titulo: 'Representantes',
  descripcion: 'Padres y madres con sus datos y la lista de hijos activos.',
  modulo: 'usuarios',
  exigeRango: false,
  filtros: { colegio: true, disciplina: false, estado: ACTIVO_INACTIVO(), fechas: false },
  columnas: [
    { clave: 'padre_id', cabecera: 'ID', ancho: 8 },
    { clave: 'usu_nombre', cabecera: 'Nombre', ancho: 34 },
    { clave: 'usu_cedula', cabecera: 'Cédula', ancho: 14 },
    { clave: 'usu_correo', cabecera: 'Correo', ancho: 32 },
    { clave: 'usu_telefono', cabecera: 'Teléfono', ancho: 14 },
    { clave: 'hijos_activos', cabecera: 'Hijos activos', ancho: 12 },
    { clave: 'hijos', cabecera: 'Hijos', ancho: 48 },
    { clave: 'colegios', cabecera: 'Colegios', ancho: 32 },
    { clave: 'disciplinas', cabecera: 'Disciplinas', ancho: 36 },
    { clave: 'estado', cabecera: 'Estado', ancho: 12 },
  ],
  /**
   * Propietario y Admin ven todos; el coordinador ve a los representantes
   * con al menos un hijo (activo o no) en sus colegios. Un representante sin
   * ningún hijo queda fuera del alcance del coordinador: ya existe la casilla
   * de "sin hijos activos" en el resumen para que no se pierdan en global.
   */
  construir: (f, ctx) => ({
    sql: `
      SELECT p.padre_id,
             u.usu_nombre,
             COALESCE(u.usu_cedula, '')                           AS usu_cedula,
             u.usu_correo,
             COALESCE(u.usu_telefono, '')                         AS usu_telefono,
             (SELECT count(DISTINCT np.nino_id)
                FROM public.nino_padre np
                JOIN public.nino n ON n.nino_id = np.nino_id
               WHERE np.padre_id = p.padre_id AND n.est_id = ${ESTADO.ACTIVO})::int AS hijos_activos,
             COALESCE((
               SELECT string_agg(
                        n.nino_nombre || COALESCE(' (' || g.catninograd_nombre || ')', ''),
                        ', ' ORDER BY n.nino_nombre)
                 FROM public.nino_padre np
                 JOIN public.nino n ON n.nino_id = np.nino_id
                 LEFT JOIN public.categoria_nino_grado g ON g.catninograd_id = n.catninograd_id
                WHERE np.padre_id = p.padre_id AND n.est_id = ${ESTADO.ACTIVO}
             ), '')                                               AS hijos,
             COALESCE((
               SELECT string_agg(DISTINCT c.col_nombre, ', ' ORDER BY c.col_nombre)
                 FROM public.nino_padre np
                 JOIN public.nino n ON n.nino_id = np.nino_id
                 JOIN public.colegio c ON c.col_id = n.col_id
                WHERE np.padre_id = p.padre_id AND n.est_id = ${ESTADO.ACTIVO}
             ), '')                                               AS colegios,
             ARRAY(
               SELECT DISTINCT c.col_nombre
                 FROM public.nino_padre np
                 JOIN public.nino n ON n.nino_id = np.nino_id
                 JOIN public.colegio c ON c.col_id = n.col_id
                WHERE np.padre_id = p.padre_id AND n.est_id = ${ESTADO.ACTIVO}
             )                                                     AS _colegios,
             COALESCE((
               SELECT string_agg(DISTINCT a.act_nombre, ', ' ORDER BY a.act_nombre)
                 FROM public.nino_padre np
                 JOIN public.nino n       ON n.nino_id = np.nino_id
                 JOIN public.nino_asignacion na
                     ON na.nino_id = n.nino_id AND na.est_id = ${ESTADO.ACTIVO}
                 JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = na.colacthor_id
                 JOIN public.actividad a ON a.act_id = cah.act_id
                WHERE np.padre_id = p.padre_id AND n.est_id = ${ESTADO.ACTIVO}
             ), '')                                               AS disciplinas,
             e.est_nombre                                         AS estado
        FROM public.padre p
        JOIN public.usuario u ON u.usu_id = p.usu_id
        JOIN public.estado e  ON e.est_id = u.est_id
       WHERE ($1::boolean
              OR EXISTS (
                SELECT 1 FROM public.nino_padre np
                  JOIN public.nino n ON n.nino_id = np.nino_id
                 WHERE np.padre_id = p.padre_id AND n.col_id = ANY($2::int[])
              ))
         AND ($3::text IS NULL
              OR ${contieneSinTildes('u.usu_nombre', '$3')}
              OR ${contieneSinTildes("COALESCE(u.usu_cedula,'')", '$3')}
              OR ${contieneSinTildes('u.usu_correo', '$3')})
         AND ($4::int[] IS NULL
              OR EXISTS (
                SELECT 1 FROM public.nino_padre np
                  JOIN public.nino n ON n.nino_id = np.nino_id
                 WHERE np.padre_id = p.padre_id AND n.col_id = ANY($4::int[])
              ))
         AND ($5::int IS NULL OR u.est_id = $5)
       ORDER BY u.usu_nombre`,
    params: [ctx.global, ctx.colegios, textoONulo(f.buscar), oNulo(f.colegio), oNulo(f.estado)],
  }),
};

/**
 * El hijo de `inn` estudia en alguno de los colegios de `$5`. El colegio no
 * se guarda en la inscripción: sale de sus disciplinas (cada disciplina es de
 * un colegio).
 */
const HIJO_EN_COLEGIO = `EXISTS (
                SELECT 1
                  FROM unnest(inn.insnino_disciplinas) AS cid
                  JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = cid
                 WHERE cah.col_id = ANY($5::int[])
              )`;

/** Filtros comunes al detalle y a los totales de Inscripciones. */
const FILTRO_INSCRIPCION = `($1::date IS NULL OR ${diaEc('i.ins_fecha')} >= $1::date)
         AND ($2::date IS NULL OR ${diaEc('i.ins_fecha')} <= $2::date)
         AND ($3::text IS NULL
              OR ${contieneSinTildes("COALESCE(i.ins_representante->>'nombre','')", '$3')}
              OR ${contieneSinTildes("COALESCE(i.ins_representante->>'cedula','')", '$3')}
              OR ${contieneSinTildes("COALESCE(i.ins_representante->>'correo','')", '$3')})
         AND ($4::int IS NULL
              OR ($4 = 1 AND i.ins_estado = 'pendiente')
              OR ($4 = 2 AND i.ins_estado = 'aprobada'))
         AND ($5::int[] IS NULL
              OR EXISTS (
                SELECT 1 FROM public.inscripcion_nino inn
                 WHERE inn.ins_id = i.ins_id AND ${HIJO_EN_COLEGIO}
              ))`;

/**
 * Lo pagado. Con filtro de colegio cuenta solo los hijos de ese colegio: una
 * inscripción puede traer hermanos de colegios distintos y su `ins_total` los
 * suma a todos. El precio de cada hijo (`total_con_iva`) cuadra con
 * `ins_total` en las 84 de prod (comprobado el 2026-10-26).
 */
const VALOR_INSCRIPCION = `CASE WHEN $5::int[] IS NULL THEN COALESCE(i.ins_total, 0)
               ELSE COALESCE((
                 SELECT SUM((inn.insnino_precio->>'total_con_iva')::numeric)
                   FROM public.inscripcion_nino inn
                  WHERE inn.ins_id = i.ins_id AND ${HIJO_EN_COLEGIO}
               ), 0)
             END`;

/*
 * Las anuladas (2026-10-26). Al anular se borra la inscripción entera; lo que
 * queda es su línea en la auditoría, con la foto de cómo estaba (ver
 * `fotoDeAnulada` en Inscripciones). Salen aquí con su valor, pero no suman
 * al recaudado.
 */
const FECHA_ANULADA = "(a.aud_detalle->>'ins_fecha')::timestamptz";
const HIJOS_ANULADA = "jsonb_array_elements(COALESCE(a.aud_detalle->'hijos', '[]'::jsonb))";
const HIJO_ANULADO_EN_COLEGIO = "($5::int[] IS NULL OR (h->>'col_id')::int = ANY($5::int[]))";

const FILTRO_ANULADA = `a.aud_entidad = 'inscripcion' AND a.aud_accion = 'eliminar'
         AND a.aud_detalle->>'anulada' = 'true'
         AND ($1::date IS NULL OR ${diaEc(FECHA_ANULADA)} >= $1::date)
         AND ($2::date IS NULL OR ${diaEc(FECHA_ANULADA)} <= $2::date)
         AND ($3::text IS NULL
              OR ${contieneSinTildes("COALESCE(a.aud_detalle->'representante'->>'nombre','')", '$3')}
              OR ${contieneSinTildes("COALESCE(a.aud_detalle->'representante'->>'cedula','')", '$3')}
              OR ${contieneSinTildes("COALESCE(a.aud_detalle->'representante'->>'correo','')", '$3')})
         AND ($4::int IS NULL OR $4 = 3)
         AND ($5::int[] IS NULL
              OR EXISTS (SELECT 1 FROM ${HIJOS_ANULADA} h WHERE (h->>'col_id')::int = ANY($5::int[])))`;

const SQL_ANULADAS = `
      SELECT a.aud_entidad_id::int,
             ${textoEc(FECHA_ANULADA, 'DD/MM/YYYY HH24:MI')},
             'Anulada',
             COALESCE(a.aud_detalle->'representante'->>'nombre', ''),
             COALESCE(a.aud_detalle->'representante'->>'cedula', ''),
             COALESCE(a.aud_detalle->'representante'->>'correo', ''),
             COALESCE(a.aud_detalle->'representante'->>'telefono', ''),
             COALESCE((SELECT string_agg(h->>'nombre', ', ') FROM ${HIJOS_ANULADA} h), ''),
             jsonb_array_length(COALESCE(a.aud_detalle->'hijos', '[]'::jsonb)),
             COALESCE((SELECT string_agg(DISTINCT h->>'colegio', ', ' ORDER BY h->>'colegio')
                         FROM ${HIJOS_ANULADA} h
                        WHERE h->>'colegio' IS NOT NULL AND ${HIJO_ANULADO_EN_COLEGIO}), ''),
             ARRAY(SELECT DISTINCT h->>'colegio' FROM ${HIJOS_ANULADA} h
                    WHERE h->>'colegio' IS NOT NULL AND ${HIJO_ANULADO_EN_COLEGIO}),
             COALESCE((SELECT string_agg(DISTINCT d, ', ' ORDER BY d)
                         FROM ${HIJOS_ANULADA} h
                         CROSS JOIN LATERAL jsonb_array_elements_text(h->'disciplinas') AS d), ''),
             (CASE WHEN $5::int[] IS NULL THEN COALESCE((a.aud_detalle->>'valor')::numeric, 0)
                   ELSE COALESCE((SELECT SUM((h->>'valor')::numeric) FROM ${HIJOS_ANULADA} h
                                   WHERE ${HIJO_ANULADO_EN_COLEGIO}), 0)
              END)::float8,
             COALESCE(a.aud_detalle->>'aprobada_por', ''),
             COALESCE(${textoEc("(a.aud_detalle->>'ins_fecha_aprobacion')::timestamptz", 'DD/MM/YYYY')}, ''),
             COALESCE(a.aud_detalle->>'anulada_por', a.aud_actor_correo, ''),
             ${textoEc('a.aud_fecha', 'DD/MM/YYYY')},
             ${FECHA_ANULADA}
        FROM public.auditoria a
       WHERE ${FILTRO_ANULADA}`;

const paramsInscripcion = (f: FiltrosReporte) => [
  oNulo(f.desde),
  oNulo(f.hasta),
  textoONulo(f.buscar),
  oNulo(f.estado),
  oNulo(f.colegio),
];

const SQL_INSCRIPCIONES = `
      SELECT i.ins_id,
             ${textoEc('i.ins_fecha', 'DD/MM/YYYY HH24:MI')}        AS fecha,
             CASE i.ins_estado
               WHEN 'pendiente' THEN 'Pendiente'
               WHEN 'aprobada'  THEN 'Aprobada'
             END                                                     AS estado,
             COALESCE(i.ins_representante->>'nombre', '')            AS representante,
             COALESCE(i.ins_representante->>'cedula', '')            AS cedula,
             COALESCE(i.ins_representante->>'correo', '')            AS correo,
             COALESCE(i.ins_representante->>'telefono', '')          AS telefono,
             COALESCE((
               SELECT string_agg(
                        btrim(
                          COALESCE(inn.insnino_datos->>'nombres', inn.insnino_datos->>'nombre', '') ||
                          ' ' || COALESCE(inn.insnino_datos->>'apellidos', '')
                        ),
                        ', ' ORDER BY inn.insnino_orden)
                 FROM public.inscripcion_nino inn
                WHERE inn.ins_id = i.ins_id
             ), '')                                                   AS hijos,
             (SELECT count(*) FROM public.inscripcion_nino WHERE ins_id = i.ins_id)::int AS cantidad_hijos,
             COALESCE((
               SELECT string_agg(DISTINCT c.col_nombre, ', ' ORDER BY c.col_nombre)
                 FROM public.inscripcion_nino inn
                 CROSS JOIN LATERAL unnest(inn.insnino_disciplinas) AS cid
                 JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = cid
                 JOIN public.colegio c ON c.col_id = cah.col_id
                WHERE inn.ins_id = i.ins_id
                  AND ($5::int[] IS NULL OR c.col_id = ANY($5::int[]))
             ), '')                                                   AS colegios,
             ARRAY(
               SELECT DISTINCT c.col_nombre
                 FROM public.inscripcion_nino inn
                 CROSS JOIN LATERAL unnest(inn.insnino_disciplinas) AS cid
                 JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = cid
                 JOIN public.colegio c ON c.col_id = cah.col_id
                WHERE inn.ins_id = i.ins_id
                  AND ($5::int[] IS NULL OR c.col_id = ANY($5::int[]))
             )                                                        AS _colegios,
             COALESCE((
               SELECT string_agg(DISTINCT a.act_nombre, ', ' ORDER BY a.act_nombre)
                 FROM public.inscripcion_nino inn
                 CROSS JOIN LATERAL unnest(inn.insnino_disciplinas) AS cid
                 JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = cid
                 JOIN public.actividad a ON a.act_id = cah.act_id
                WHERE inn.ins_id = i.ins_id
             ), '')                                                   AS disciplinas,
             ${VALOR_INSCRIPCION}::float8                             AS valor,
             COALESCE(ap.usu_nombre, '')                              AS aprobada_por,
             COALESCE(${textoEc('i.ins_fecha_aprobacion', 'DD/MM/YYYY')}, '') AS fecha_aprobacion,
             ''                                                       AS anulada_por,
             ''                                                       AS fecha_anulacion,
             i.ins_fecha                                              AS _orden
        FROM public.inscripcion i
        LEFT JOIN public.usuario ap ON ap.usu_id = i.ins_aprobada_por
       WHERE ${FILTRO_INSCRIPCION}
      UNION ALL${SQL_ANULADAS}
       ORDER BY _orden DESC`;

const inscripciones: Definicion = {
  id: 'inscripciones',
  titulo: 'Inscripciones',
  descripcion: 'Envíos del formulario público: pendientes, aprobadas y anuladas.',
  modulo: 'inscripciones',
  // Lleva montos: solo Propietario (decidido por el cliente, 2026-10-15).
  soloRoles: [ROL.PROPIETARIO],
  exigeRango: false,
  filtros: {
    colegio: true,
    disciplina: false,
    estado: {
      etiqueta: 'Estado',
      opciones: [
        { id: 1, nombre: 'Pendiente' },
        { id: 2, nombre: 'Aprobada' },
        { id: 3, nombre: 'Anulada' },
      ],
    },
    fechas: true,
  },
  columnas: [
    { clave: 'ins_id', cabecera: 'Nº', ancho: 8 },
    { clave: 'fecha', cabecera: 'Fecha', ancho: 17 },
    { clave: 'estado', cabecera: 'Estado', ancho: 12 },
    { clave: 'representante', cabecera: 'Representante', ancho: 32 },
    { clave: 'cedula', cabecera: 'Cédula', ancho: 14 },
    { clave: 'correo', cabecera: 'Correo', ancho: 30 },
    { clave: 'telefono', cabecera: 'Teléfono', ancho: 14 },
    { clave: 'hijos', cabecera: 'Hijos', ancho: 40 },
    { clave: 'cantidad_hijos', cabecera: 'N° hijos', ancho: 10 },
    { clave: 'colegios', cabecera: 'Colegios', ancho: 30 },
    { clave: 'disciplinas', cabecera: 'Disciplinas', ancho: 40 },
    { clave: 'valor', cabecera: 'Valor ($)', ancho: 12 },
    { clave: 'aprobada_por', cabecera: 'Aprobada por', ancho: 28 },
    { clave: 'fecha_aprobacion', cabecera: 'Aprobada el', ancho: 14 },
    { clave: 'anulada_por', cabecera: 'Anulada por', ancho: 28 },
    { clave: 'fecha_anulacion', cabecera: 'Anulada el', ancho: 14 },
  ],
  /**
   * Sin alcance por colegio: el reporte es solo Propietario. El filtro de
   * colegio (2026-10-26) sale de las disciplinas de cada hijo, no del texto
   * suelto de `insnino_datos`.
   *
   * El estado se filtra como id (1=Pendiente, 2=Aprobada, 3=Anulada) para
   * encajar con el desplegable estándar del resto de reportes.
   */
  construir: (f) => ({ sql: SQL_INSCRIPCIONES, params: paramsInscripcion(f) }),
  totales: (f) => ({
    consulta: {
      sql: `
        SELECT count(*)::int                                       AS inscripciones,
               count(*) FILTER (WHERE r.estado = 'Pendiente')::int AS pendientes,
               count(*) FILTER (WHERE r.estado = 'Aprobada')::int  AS aprobadas,
               count(*) FILTER (WHERE r.estado = 'Anulada')::int   AS anuladas,
               COALESCE(SUM(r.valor) FILTER (WHERE r.estado <> 'Anulada'), 0)::float8 AS recaudado
          FROM (${SQL_INSCRIPCIONES}) r`,
      params: paramsInscripcion(f),
    },
    formato: [
      { clave: 'inscripciones', etiqueta: 'Inscripciones' },
      { clave: 'pendientes', etiqueta: 'Pendientes' },
      { clave: 'aprobadas', etiqueta: 'Aprobadas' },
      { clave: 'anuladas', etiqueta: 'Anuladas' },
      { clave: 'recaudado', etiqueta: 'Total recaudado', moneda: true },
    ],
  }),
};

const encuestas: Definicion = {
  id: 'encuestas',
  titulo: 'Encuestas',
  descripcion: 'Encuestas creadas: estado, cuántas preguntas tienen y cuántos las respondieron.',
  modulo: 'encuestas',
  exigeRango: false,
  filtros: {
    colegio: false,
    disciplina: false,
    estado: {
      etiqueta: 'Estado',
      opciones: [
        { id: ESTADO.BORRADOR, nombre: 'Borrador' },
        { id: ESTADO.FINALIZADO, nombre: 'Finalizado' },
        { id: ESTADO.PUBLICADO, nombre: 'Publicado' },
      ],
    },
    fechas: false,
  },
  columnas: [
    { clave: 'encu_id', cabecera: 'ID', ancho: 8 },
    { clave: 'encu_titulo', cabecera: 'Encuesta', ancho: 40 },
    { clave: 'estado', cabecera: 'Estado', ancho: 14 },
    { clave: 'preguntas', cabecera: 'Preguntas', ancho: 11 },
    { clave: 'respondidas', cabecera: 'Respondidas', ancho: 13 },
    { clave: 'encu_fecha_creacion', cabecera: 'Creada', ancho: 14 },
  ],
  /** Catálogo global sin alcance por colegio: una encuesta no vive en un colegio. */
  construir: (f) => ({
    sql: `
      SELECT e.encu_id,
             e.encu_titulo,
             est.est_nombre                                         AS estado,
             (SELECT count(*) FROM public.encuesta_pregunta
               WHERE encu_id = e.encu_id)::int                      AS preguntas,
             (SELECT count(*) FROM public.encuesta_respondida
               WHERE encu_id = e.encu_id)::int                      AS respondidas,
             ${textoEc('e.encu_fecha_creacion', 'DD/MM/YYYY')}      AS encu_fecha_creacion
        FROM public.encuesta e
        JOIN public.estado est ON est.est_id = e.est_id
       WHERE ($1::text IS NULL OR ${contieneSinTildes('e.encu_titulo', '$1')})
         AND ($2::int IS NULL OR e.est_id = $2)
       ORDER BY e.encu_fecha_creacion DESC, e.encu_titulo`,
    params: [textoONulo(f.buscar), oNulo(f.estado)],
  }),
};

const novedades: Definicion = {
  id: 'novedades',
  titulo: 'Novedades',
  descripcion: 'Todas las novedades que han llegado, también las eliminadas de la pantalla.',
  modulo: 'novedades',
  accion: 'eliminar',
  exigeRango: false,
  filtros: {
    colegio: false,
    disciplina: false,
    estado: {
      etiqueta: 'Estado',
      opciones: [
        { id: ESTADO.ACTIVO, nombre: 'En pantalla' },
        { id: ESTADO.INACTIVO, nombre: 'Eliminada' },
      ],
    },
    fechas: true,
    ausencias: true,
  },
  columnas: [
    { clave: 'fecha', cabecera: 'Fecha', ancho: 17 },
    { clave: 'tipo', cabecera: 'Tipo', ancho: 20 },
    { clave: 'nov_texto', cabecera: 'Novedad', ancho: 60 },
    { clave: 'autor', cabecera: 'Escrita por', ancho: 30 },
    { clave: 'sobre', cabecera: 'Sobre', ancho: 40 },
    { clave: 'colegios', cabecera: 'Colegio', ancho: 30 },
    { clave: 'estado', cabecera: 'Estado', ancho: 13 },
    { clave: 'eliminada_por', cabecera: 'Eliminada por', ancho: 30 },
    { clave: 'eliminada_el', cabecera: 'Eliminada el', ancho: 17 },
  ],
  /**
   * Propietario y Admin, todas. Quien tenga Eliminar sin ser global, solo las
   * que escribió: en el módulo no ve las de los demás y aquí tampoco.
   * "Sobre" junta personas y alumnos; "Colegio", el de los alumnos.
   *
   * Las columnas `aus_*` solo las usa la hoja Ausencias del Excel: la clase
   * tal como estaba al avisar (`nov_datos`) y los representantes de hoy.
   */
  hojaExtra: {
    titulo: 'Ausencias',
    columnas: [
      { clave: 'tipo', cabecera: 'Aviso', ancho: 14 },
      { clave: 'fecha', cabecera: 'Avisado el', ancho: 17 },
      { clave: 'sobre', cabecera: 'Alumno', ancho: 32 },
      { clave: 'aus_colegio', cabecera: 'Colegio', ancho: 30 },
      { clave: 'aus_actividad', cabecera: 'Disciplina', ancho: 22 },
      { clave: 'aus_fecha', cabecera: 'Fecha de la clase', ancho: 16 },
      { clave: 'aus_dia', cabecera: 'Día', ancho: 11 },
      { clave: 'aus_horario', cabecera: 'Horario', ancho: 13 },
      { clave: 'aus_asistencia', cabecera: 'Asistencia', ancho: 13 },
      { clave: 'aus_hora', cabecera: 'Hora de llegada', ancho: 14 },
      { clave: 'aus_motivo', cabecera: 'Motivo', ancho: 34 },
      { clave: 'aus_representantes', cabecera: 'Representantes', ancho: 50 },
      { clave: 'autor', cabecera: 'Registró', ancho: 30 },
      { clave: 'estado', cabecera: 'Estado', ancho: 13 },
    ],
    incluye: (fila) => fila.tipo === 'Ausencia' || fila.tipo === 'Corrección',
    sale: (f) => f.ausencias !== false,
    // La hoja Novedades del Excel lleva solo las escritas a mano (2026-10-12).
    aparte: true,
  },
  construir: (f, ctx) => ({
    sql: `
      SELECT ${textoEc('n.nov_fecha_creacion', 'DD/MM/YYYY HH24:MI')} AS fecha,
             CASE n.nov_tipo
               WHEN 'general'       THEN 'General'
               WHEN 'personal'      THEN 'Sobre personal'
               WHEN 'representante' THEN 'Sobre representantes'
               WHEN 'alumno'        THEN 'Sobre alumnos'
               WHEN 'ausencia'      THEN 'Ausencia'
               WHEN 'correccion'    THEN 'Corrección'
             END                                                   AS tipo,
             n.nov_texto,
             a.usu_nombre                                          AS autor,
             COALESCE(NULLIF(concat_ws(', ',
               (SELECT string_agg(u.usu_nombre, ', ' ORDER BY u.usu_nombre)
                  FROM public.novedad_persona np
                  JOIN public.usuario u ON u.usu_id = np.usu_id
                 WHERE np.nov_id = n.nov_id),
               (SELECT string_agg(nn.nino_nombre, ', ' ORDER BY nn.nino_nombre)
                  FROM public.novedad_alumno na
                  JOIN public.nino nn ON nn.nino_id = na.nino_id
                 WHERE na.nov_id = n.nov_id)), ''), '')            AS sobre,
             COALESCE((SELECT string_agg(DISTINCT c.col_nombre, ', ')
                         FROM public.novedad_alumno na
                         JOIN public.nino nn ON nn.nino_id = na.nino_id
                         JOIN public.colegio c ON c.col_id = nn.col_id
                        WHERE na.nov_id = n.nov_id), '')           AS colegios,
             CASE WHEN n.est_id = ${ESTADO.ACTIVO} THEN 'En pantalla' ELSE 'Eliminada' END AS estado,
             COALESCE(b.usu_nombre, '')                            AS eliminada_por,
             COALESCE(${textoEc('n.nov_fecha_eliminacion', 'DD/MM/YYYY HH24:MI')}, '') AS eliminada_el,
             COALESCE(n.nov_datos->>'colegio', '')                 AS aus_colegio,
             COALESCE(n.nov_datos->>'actividad', '')               AS aus_actividad,
             COALESCE(to_char(n.nov_asis_fecha, 'DD/MM/YYYY'), '') AS aus_fecha,
             COALESCE(n.nov_datos->>'dia', '')                     AS aus_dia,
             COALESCE(n.nov_datos->>'horario', '')                 AS aus_horario,
             COALESCE(n.nov_datos->>'estado', '')                  AS aus_asistencia,
             COALESCE(n.nov_datos->>'hora_tarde', '')              AS aus_hora,
             COALESCE(n.nov_datos->>'razon', '')                   AS aus_motivo,
             CASE WHEN n.nov_tipo IN ('ausencia', 'correccion') THEN
               COALESCE((SELECT string_agg(concat_ws(' · ', ru.usu_nombre, ru.usu_telefono, ru.usu_correo),
                                           '; ' ORDER BY ru.usu_nombre)
                           FROM public.novedad_alumno na
                           JOIN public.nino_padre npa ON npa.nino_id = na.nino_id
                           JOIN public.padre pa       ON pa.padre_id = npa.padre_id
                           JOIN public.usuario ru     ON ru.usu_id = pa.usu_id
                          WHERE na.nov_id = n.nov_id AND ru.est_id = ${ESTADO.ACTIVO}), '')
             ELSE '' END                                           AS aus_representantes
        FROM public.novedad n
        JOIN public.usuario a      ON a.usu_id = n.nov_autor_id
        LEFT JOIN public.usuario b ON b.usu_id = n.nov_eliminada_por
       WHERE ($1::boolean OR n.nov_autor_id = $2)
         AND ($3::date IS NULL OR ${diaEc('n.nov_fecha_creacion')} >= $3::date)
         AND ($4::date IS NULL OR ${diaEc('n.nov_fecha_creacion')} <= $4::date)
         AND ($5::text IS NULL OR ${contieneSinTildes('n.nov_texto', '$5')}
                               OR ${contieneSinTildes('a.usu_nombre', '$5')})
         AND ($6::int IS NULL OR n.est_id = $6)
         AND ($7::boolean IS DISTINCT FROM false OR n.nov_tipo NOT IN ('ausencia', 'correccion'))
       ORDER BY n.nov_fecha_creacion DESC, n.nov_id DESC`,
    params: [
      ctx.global,
      ctx.actorId,
      oNulo(f.desde),
      oNulo(f.hasta),
      textoONulo(f.buscar),
      oNulo(f.estado),
      oNulo(f.ausencias),
    ],
  }),
};

/**
 * Orden de las tarjetas en Reportes, decidido por el cliente el 2026-10-15.
 * Encuestas, Representantes e Inscripciones entraron ese día con el pedido
 * de reordenar: antes no estaban porque sus tablas se usaban poco o nada.
 */
export const DEFINICIONES: Definicion[] = [
  usuarios,
  colegios,
  actividades,
  disciplinas,
  entrenadores,
  estudiantes,
  evaluaciones,
  asistenciasAlumnos,
  asistenciasEntrenadores,
  representantes,
  inscripciones,
  encuestas,
  novedades,
];

export function definicionDe(id: string): Definicion | undefined {
  return DEFINICIONES.find((d) => d.id === id);
}
