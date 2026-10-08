import { contieneSinTildes } from '../../lib/sql.js';
import { diaEc, textoEc } from '../../lib/fecha.js';

/**
 * Data anterior: lo que se puede consultar del esquema `archivo`.
 *
 * ---------------------------------------------------------------------------
 * Qué es `archivo`
 *
 * Una copia congelada de la plataforma vieja, tomada el 2026-10-01 cuando la
 * empresa decidió arrancar de cero (migración 0013). Tiene la estructura de la
 * base VIEJA —no la de `public`— y nadie escribe en ella. Sus ids no tienen
 * nada que ver con los de `public`: el colegio 11 de aquí no es el colegio 11
 * de la plataforma nueva. Por eso este módulo no reutiliza ni las listas de
 * colegios ni el alcance del resto del sistema: tiene las suyas.
 *
 * ---------------------------------------------------------------------------
 * Un conjunto se declara, no se programa
 *
 * Igual que los reportes, cada conjunto es su SELECT, sus columnas y **qué
 * filtros admite y sobre qué expresión se aplican**. El WHERE lo arma
 * `construir`, que es la única pieza que numera parámetros: así no hay forma de
 * que un conjunto mande más valores que marcadores, que es lo que tumbó tres
 * pantallas el 2026-09-18.
 *
 * Los SELECT no llevan WHERE ni GROUP BY propios: los recuentos van en
 * subconsultas, para que los filtros se apliquen siempre sobre la fila base.
 *
 * Las fechas salen como texto AAAA-MM-DD: se ordenan bien tal cual y Excel las
 * entiende. Las horas de registro se pasan a la hora de Ecuador.
 */

export type FiltroId =
  | 'buscar'
  | 'colegio'
  | 'actividad'
  | 'entrenador'
  | 'estado'
  | 'asistencia'
  | 'rol'
  | 'desde'
  | 'hasta';

export interface FiltrosHistorico {
  buscar?: string;
  colegio?: number;
  actividad?: number;
  entrenador?: number;
  estado?: number;
  asistencia?: number;
  rol?: number;
  desde?: string;
  hasta?: string;
}

export interface ColumnaHistorico {
  clave: string;
  cabecera: string;
  /** Ancho en el xlsx, en caracteres. */
  ancho: number;
  /** Las numéricas se alinean a la derecha y van como número al Excel. */
  numero?: boolean;
}

export interface Opcion {
  id: number;
  nombre: string;
}

/**
 * Cómo se aplica cada filtro:
 *   - `buscar`: las columnas donde se busca, sin tildes.
 *   - `desde` / `hasta`: la expresión de fecha a acotar.
 *   - el resto: la expresión que se compara por igualdad, o una función que
 *     recibe el marcador ($n) y devuelve la condición entera.
 */
export type Aplicacion = {
  buscar?: string[];
  desde?: string;
  hasta?: string;
} & Partial<Record<Exclude<FiltroId, 'buscar' | 'desde' | 'hasta'>, string | ((p: string) => string)>>;

export interface Conjunto {
  id: string;
  grupo: 'Personas' | 'Estructura' | 'Asistencia' | 'Evaluaciones';
  titulo: string;
  descripcion: string;
  columnas: ColumnaHistorico[];
  /** SELECT ... FROM ... sin WHERE. Puede traer columnas auxiliares `_x`. */
  select: string;
  aplicar: Aplicacion;
  /** ORDER BY por defecto, sobre el alias `r` de la subconsulta. */
  ordenDefecto: string;
  /** Si tiene filtro de estado, sus valores. El catálogo de estados es mixto. */
  estados?: Opcion[];
  /** Qué significa el rango de fechas en este conjunto. */
  rangoSobre?: string;
}

export interface ConsultaHistorico {
  sql: string;
  params: unknown[];
}

/** Filtros que tiene un conjunto, en el orden en que se enseñan. */
export function filtrosDe(conjunto: Conjunto): FiltroId[] {
  const orden: FiltroId[] = [
    'buscar',
    'colegio',
    'actividad',
    'entrenador',
    'rol',
    'estado',
    'asistencia',
    'desde',
    'hasta',
  ];
  return orden.filter((f) => conjunto.aplicar[f] !== undefined);
}

/**
 * El SELECT del conjunto con su WHERE.
 *
 * Cada valor se añade al array **en el momento** en que se escribe su marcador,
 * así que `params.length` coincide siempre con el marcador más alto. Un filtro
 * que el conjunto no admite se ignora en silencio: el frontend solo enseña los
 * que admite, y una URL a mano con uno de más no debe dar 500.
 */
export function construir(conjunto: Conjunto, f: FiltrosHistorico): ConsultaHistorico {
  const params: unknown[] = [];
  const marcador = (valor: unknown) => {
    params.push(valor);
    return `$${params.length}`;
  };
  const condiciones: string[] = [];
  const a = conjunto.aplicar;

  const texto = f.buscar?.trim();
  if (texto && a.buscar && a.buscar.length > 0) {
    const p = marcador(texto);
    condiciones.push(`(${a.buscar.map((c) => contieneSinTildes(c, `${p}::text`)).join(' OR ')})`);
  }

  for (const clave of ['colegio', 'actividad', 'entrenador', 'rol', 'estado', 'asistencia'] as const) {
    const valor = f[clave];
    const regla = a[clave];
    if (valor === undefined || regla === undefined) continue;
    const p = `${marcador(valor)}::int`;
    condiciones.push(typeof regla === 'function' ? regla(p) : `${regla} = ${p}`);
  }

  if (f.desde && a.desde) condiciones.push(`(${a.desde})::date >= ${marcador(f.desde)}::date`);
  if (f.hasta && a.hasta) condiciones.push(`(${a.hasta})::date <= ${marcador(f.hasta)}::date`);

  const where = condiciones.length > 0 ? `\n WHERE ${condiciones.join('\n   AND ')}` : '';
  return { sql: `${conjunto.select}${where}`, params };
}

// ---------------------------------------------------------------------------
// Trozos repetidos

/** Para columnas `date`, que no tienen zona. */
const fecha = (expr: string) => `to_char(${expr}, 'YYYY-MM-DD')`;
/** Para marcas `timestamptz`, que están en UTC: el día que fue en Ecuador. */
const diaDeMarca = (expr: string) => textoEc(expr, 'YYYY-MM-DD');
/** Las marcas de registro están en UTC; se enseñan en hora de Ecuador. */
const momento = (expr: string) => textoEc(expr, 'YYYY-MM-DD HH24:MI');
const horario = (d: string) =>
  `to_char(${d}.colacthor_hora_inicio, 'HH24:MI') || ' - ' || to_char(${d}.colacthor_hora_fin, 'HH24:MI')`;
const siNo = (expr: string) => `CASE WHEN ${expr} THEN 'Sí' WHEN NOT ${expr} THEN 'No' ELSE '' END`;
const pct = (filtro: string, total = 'count(*)') =>
  `round(count(*) FILTER (WHERE ${filtro}) * 100.0 / NULLIF(${total}, 0), 1)::float8`;

/** La disciplina con su colegio, actividad y día, colgando de `col`. */
const disciplina = (col: string) => `
  JOIN archivo.colegio_actividad_horario d ON d.colacthor_id = ${col}
  JOIN archivo.colegio c                   ON c.col_id = d.col_id
  JOIN archivo.actividad a                 ON a.act_id = d.act_id
  JOIN archivo.dia di                      ON di.dia_id = d.dia_id`;

const ESTADOS_ACTIVO: Opcion[] = [
  { id: 1, nombre: 'Activo' },
  { id: 2, nombre: 'Inactivo' },
];

const C = (clave: string, cabecera: string, ancho: number, numero = false): ColumnaHistorico =>
  numero ? { clave, cabecera, ancho, numero } : { clave, cabecera, ancho };

// ---------------------------------------------------------------------------
// Personas

const alumnos: Conjunto = {
  id: 'alumnos',
  grupo: 'Personas',
  titulo: 'Alumnos',
  descripcion: 'Cada alumno con su colegio, cuántas veces se inscribió y su asistencia total.',
  columnas: [
    C('nino_id', 'ID', 8, true),
    C('nino_nombre', 'Nombre', 34),
    C('nino_edad', 'Edad', 7, true),
    C('grado', 'Grado', 16),
    C('colegio', 'Colegio', 30),
    C('transporte', 'Transporte', 11),
    C('estado', 'Estado', 10),
    C('inscripciones', 'Inscripciones', 13, true),
    C('asistencias', 'Asistencias', 12, true),
    C('presentes', 'Presentes', 11, true),
    C('pct_presencia', '% presencia', 12, true),
    C('fecha_creacion', 'Creado', 12),
  ],
  select: `
SELECT n.nino_id,
       n.nino_nombre,
       n.nino_edad,
       COALESCE(g.catninograd_nombre, '') AS grado,
       COALESCE(c.col_nombre, '')         AS colegio,
       ${siNo('n.nino_toma_transporte')}  AS transporte,
       COALESCE(e.est_nombre, '')         AS estado,
       (SELECT count(*) FROM archivo.nino_asignacion na WHERE na.nino_id = n.nino_id)::int AS inscripciones,
       s.asistencias,
       s.presentes,
       s.pct_presencia,
       ${diaDeMarca('n.nino_fecha_creacion')}  AS fecha_creacion
  FROM archivo.nino n
  LEFT JOIN archivo.categoria_nino_grado g ON g.catninograd_id = n.catninograd_id
  LEFT JOIN archivo.colegio c              ON c.col_id = n.col_id
  LEFT JOIN archivo.estado e               ON e.est_id = n.est_id
  LEFT JOIN LATERAL (
      SELECT count(*)::int                                  AS asistencias,
             count(*) FILTER (WHERE an.asisest_id = 1)::int AS presentes,
             ${pct('an.asisest_id = 1')}                    AS pct_presencia
        FROM archivo.asistencia_nino an
       WHERE an.nino_id = n.nino_id
  ) s ON true`,
  aplicar: {
    buscar: ['n.nino_nombre'],
    colegio: 'n.col_id',
    actividad: (p) => `EXISTS (
        SELECT 1 FROM archivo.nino_asignacion na
          JOIN archivo.colegio_actividad_horario d ON d.colacthor_id = na.colacthor_id
         WHERE na.nino_id = n.nino_id AND d.act_id = ${p})`,
    estado: 'n.est_id',
  },
  ordenDefecto: 'r.nino_nombre',
  estados: ESTADOS_ACTIVO,
};

const usuarios: Conjunto = {
  id: 'usuarios',
  grupo: 'Personas',
  titulo: 'Usuarios',
  descripcion: 'Todas las personas con cuenta en la plataforma vieja, con sus roles.',
  columnas: [
    C('usu_id', 'ID', 8, true),
    C('usu_nombre', 'Nombre', 34),
    C('usu_correo', 'Correo', 32),
    C('usu_telefono', 'Teléfono', 14),
    C('cedula', 'Cédula', 14),
    C('roles', 'Roles', 34),
    C('estado', 'Estado', 10),
    C('fecha_creacion', 'Creado', 12),
  ],
  select: `
SELECT u.usu_id,
       u.usu_nombre,
       COALESCE(u.usu_correo, '')   AS usu_correo,
       COALESCE(u.usu_telefono, '') AS usu_telefono,
       COALESCE(en.ent_cedula, '')  AS cedula,
       COALESCE((SELECT string_agg(ro.rol_titulo, ', ' ORDER BY ro.rol_id)
                   FROM archivo.usuario_rol ur
                   JOIN archivo.rol ro ON ro.rol_id = ur.rol_id
                  WHERE ur.usu_id = u.usu_id), 'Sin rol') AS roles,
       COALESCE(e.est_nombre, '')   AS estado,
       ${diaDeMarca('u.usu_fecha_creacion')} AS fecha_creacion
  FROM archivo.usuario u
  LEFT JOIN archivo.entrenador en ON en.ent_id = u.usu_id
  LEFT JOIN archivo.estado e      ON e.est_id = u.est_id`,
  aplicar: {
    buscar: ['u.usu_nombre', 'u.usu_correo', 'en.ent_cedula'],
    rol: (p) => `EXISTS (SELECT 1 FROM archivo.usuario_rol ur WHERE ur.usu_id = u.usu_id AND ur.rol_id = ${p})`,
    estado: 'u.est_id',
  },
  ordenDefecto: 'r.usu_nombre',
  estados: ESTADOS_ACTIVO,
};

const entrenadores: Conjunto = {
  id: 'entrenadores',
  grupo: 'Personas',
  titulo: 'Entrenadores',
  descripcion:
    'Cada entrenador con los colegios donde dio clase, sus disciplinas, su propia asistencia y las asistencias que registró.',
  columnas: [
    C('ent_id', 'ID', 8, true),
    C('nombre', 'Nombre', 34),
    C('cedula', 'Cédula', 14),
    C('correo', 'Correo', 30),
    C('telefono', 'Teléfono', 14),
    C('estado', 'Estado', 10),
    C('colegios', 'Colegios', 40),
    C('disciplinas_total', 'Disciplinas (historial)', 14, true),
    C('disciplinas_al_cierre', 'Disciplinas al cierre', 14, true),
    C('asistencias_propias', 'Su asistencia (días)', 14, true),
    C('pct_presencia', '% presencia', 12, true),
    C('asistencias_registradas', 'Asistencias que registró', 16, true),
  ],
  select: `
SELECT en.ent_id,
       u.usu_nombre                AS nombre,
       COALESCE(en.ent_cedula, '') AS cedula,
       COALESCE(u.usu_correo, '')  AS correo,
       COALESCE(u.usu_telefono, '') AS telefono,
       COALESCE(e.est_nombre, '')  AS estado,
       COALESCE((SELECT string_agg(DISTINCT c.col_nombre, ', ')
                   FROM archivo.entrenador_asignacion ea
                   JOIN archivo.colegio_actividad_horario d ON d.colacthor_id = ea.colacthor_id
                   JOIN archivo.colegio c ON c.col_id = d.col_id
                  WHERE ea.ent_id = en.ent_id), '') AS colegios,
       (SELECT count(*) FROM archivo.entrenador_asignacion ea WHERE ea.ent_id = en.ent_id)::int
                                   AS disciplinas_total,
       (SELECT count(*) FROM archivo.entrenador_asignacion ea
         WHERE ea.ent_id = en.ent_id AND ea.entasig_fecha_fin IS NULL AND ea.est_id = 1)::int
                                   AS disciplinas_al_cierre,
       s.asistencias               AS asistencias_propias,
       s.pct_presencia,
       (SELECT count(*) FROM archivo.asistencia_nino an WHERE an.usu_registrador = en.ent_id)::int
                                   AS asistencias_registradas
  FROM archivo.entrenador en
  JOIN archivo.usuario u     ON u.usu_id = en.ent_id
  LEFT JOIN archivo.estado e ON e.est_id = en.est_id
  LEFT JOIN LATERAL (
      SELECT count(*)::int AS asistencias, ${pct('ae.asisest_id = 1')} AS pct_presencia
        FROM archivo.asistencia_entrenador ae
       WHERE ae.ent_id = en.ent_id
  ) s ON true`,
  aplicar: {
    buscar: ['u.usu_nombre', 'en.ent_cedula', 'u.usu_correo'],
    colegio: (p) => `EXISTS (
        SELECT 1 FROM archivo.entrenador_asignacion ea
          JOIN archivo.colegio_actividad_horario d ON d.colacthor_id = ea.colacthor_id
         WHERE ea.ent_id = en.ent_id AND d.col_id = ${p})`,
    actividad: (p) => `EXISTS (
        SELECT 1 FROM archivo.entrenador_asignacion ea
          JOIN archivo.colegio_actividad_horario d ON d.colacthor_id = ea.colacthor_id
         WHERE ea.ent_id = en.ent_id AND d.act_id = ${p})`,
    estado: 'en.est_id',
  },
  ordenDefecto: 'r.nombre',
  estados: ESTADOS_ACTIVO,
};

const auxiliares: Conjunto = {
  id: 'auxiliares',
  grupo: 'Personas',
  titulo: 'Asistentes y respaldos',
  descripcion: 'Quién respaldaba a qué entrenador, y su propia asistencia.',
  columnas: [
    C('entaux_id', 'ID', 8, true),
    C('auxiliar', 'Asistente / respaldo', 34),
    C('rol', 'Rol', 22),
    C('titular', 'Entrenador titular', 34),
    C('estado', 'Estado del vínculo', 14),
    C('asistencias', 'Su asistencia (días)', 14, true),
    C('pct_presencia', '% presencia', 12, true),
  ],
  select: `
SELECT aux.entaux_id,
       ua.usu_nombre               AS auxiliar,
       COALESCE(ro.rol_titulo, '') AS rol,
       COALESCE(ut.usu_nombre, '') AS titular,
       COALESCE(e.est_nombre, '')  AS estado,
       s.asistencias,
       s.pct_presencia
  FROM archivo.entrenador_auxiliar aux
  JOIN archivo.usuario ua      ON ua.usu_id = aux.usu_id
  LEFT JOIN archivo.usuario ut ON ut.usu_id = aux.ent_id
  LEFT JOIN archivo.rol ro     ON ro.rol_id = aux.rol_id
  LEFT JOIN archivo.estado e   ON e.est_id = aux.est_id
  LEFT JOIN LATERAL (
      SELECT count(*)::int AS asistencias, ${pct('x.asisest_id = 1')} AS pct_presencia
        FROM archivo.asistencia_auxiliar x
       WHERE x.usu_id = aux.usu_id
  ) s ON true`,
  aplicar: {
    buscar: ['ua.usu_nombre', 'ut.usu_nombre'],
    entrenador: 'aux.ent_id',
    estado: 'aux.est_id',
  },
  ordenDefecto: 'r.auxiliar',
  estados: ESTADOS_ACTIVO,
};

// ---------------------------------------------------------------------------
// Estructura

const colegios: Conjunto = {
  id: 'colegios',
  grupo: 'Estructura',
  titulo: 'Colegios',
  descripcion: 'Los colegios con su representante, coordinadores y todo lo que tuvieron.',
  columnas: [
    C('col_id', 'ID', 8, true),
    C('col_nombre', 'Colegio', 32),
    C('col_direccion', 'Dirección', 34),
    C('representante', 'Representante', 28),
    C('rep_telefono', 'Teléfono rep.', 14),
    C('rep_email', 'Correo rep.', 28),
    C('coordinadores', 'Coordinadores', 34),
    C('disciplinas', 'Disciplinas', 11, true),
    C('alumnos', 'Alumnos', 10, true),
    C('inscripciones', 'Inscripciones', 13, true),
    C('asistencias', 'Asistencias', 12, true),
    C('pct_presencia', '% presencia', 12, true),
  ],
  select: `
SELECT c.col_id,
       c.col_nombre,
       COALESCE(c.col_direccion, '')    AS col_direccion,
       COALESCE(c.col_rep_nombre, '')   AS representante,
       COALESCE(c.col_rep_telefono, '') AS rep_telefono,
       COALESCE(c.col_rep_email, '')    AS rep_email,
       COALESCE((SELECT string_agg(u.usu_nombre, ', ' ORDER BY u.usu_nombre)
                   FROM archivo.colegio_coordinador cc
                   JOIN archivo.usuario u ON u.usu_id = cc.usu_id
                  WHERE cc.col_id = c.col_id), '') AS coordinadores,
       (SELECT count(*) FROM archivo.colegio_actividad_horario d WHERE d.col_id = c.col_id)::int AS disciplinas,
       (SELECT count(*) FROM archivo.nino n WHERE n.col_id = c.col_id)::int AS alumnos,
       (SELECT count(*) FROM archivo.nino_asignacion na
          JOIN archivo.colegio_actividad_horario d ON d.colacthor_id = na.colacthor_id
         WHERE d.col_id = c.col_id)::int AS inscripciones,
       s.asistencias,
       s.pct_presencia
  FROM archivo.colegio c
  LEFT JOIN LATERAL (
      SELECT count(*)::int AS asistencias, ${pct('an.asisest_id = 1')} AS pct_presencia
        FROM archivo.asistencia_nino an
        JOIN archivo.colegio_actividad_horario d ON d.colacthor_id = an.colacthor_id
       WHERE d.col_id = c.col_id
  ) s ON true`,
  aplicar: { buscar: ['c.col_nombre', 'c.col_direccion', 'c.col_rep_nombre'] },
  ordenDefecto: 'r.col_nombre',
};

const actividades: Conjunto = {
  id: 'actividades',
  grupo: 'Estructura',
  titulo: 'Actividades',
  descripcion: 'El catálogo de actividades con su ficha completa y cuánto se usó cada una.',
  columnas: [
    C('act_id', 'ID', 8, true),
    C('act_nombre', 'Actividad', 26),
    C('categoria', 'Categoría', 18),
    C('act_descripcion', 'Descripción', 40),
    C('espacio_trabajo', 'Espacio de trabajo', 20),
    C('tipo_espacio', 'Tipo de espacio', 16),
    C('espacio_secundario', 'Espacio secundario', 20),
    C('indumentaria', 'Indumentaria', 18),
    C('materiales', 'Materiales del alumno', 34),
    C('disciplinas', 'Disciplinas', 11, true),
    C('inscripciones', 'Inscripciones', 13, true),
  ],
  select: `
SELECT a.act_id,
       a.act_nombre,
       COALESCE(ca.cat_nombre, '')             AS categoria,
       COALESCE(a.act_descripcion, '')         AS act_descripcion,
       COALESCE(a.act_espacio_trabajo, '')     AS espacio_trabajo,
       COALESCE(a.act_tipo_espacio, '')        AS tipo_espacio,
       COALESCE(a.act_espacio_secundario, '')  AS espacio_secundario,
       COALESCE(a.act_indumentaria_tipo, '')   AS indumentaria,
       COALESCE(array_to_string(a.act_materiales_alumno, ', '), '') AS materiales,
       (SELECT count(*) FROM archivo.colegio_actividad_horario d WHERE d.act_id = a.act_id)::int AS disciplinas,
       (SELECT count(*) FROM archivo.nino_asignacion na
          JOIN archivo.colegio_actividad_horario d ON d.colacthor_id = na.colacthor_id
         WHERE d.act_id = a.act_id)::int AS inscripciones
  FROM archivo.actividad a
  LEFT JOIN archivo.categoria ca ON ca.cat_id = a.cat_id`,
  aplicar: {
    buscar: ['a.act_nombre', 'a.act_descripcion', 'ca.cat_nombre'],
    colegio: (p) => `EXISTS (SELECT 1 FROM archivo.colegio_actividad_horario d WHERE d.act_id = a.act_id AND d.col_id = ${p})`,
  },
  ordenDefecto: 'r.act_nombre',
};

const disciplinas: Conjunto = {
  id: 'disciplinas',
  grupo: 'Estructura',
  titulo: 'Disciplinas',
  descripcion:
    'Cada actividad en un colegio, un día y una hora, con quién la daba al cierre y su asistencia.',
  columnas: [
    C('colacthor_id', 'ID', 8, true),
    C('colegio', 'Colegio', 30),
    C('actividad', 'Actividad', 24),
    C('dia', 'Día', 11),
    C('horario', 'Horario', 14),
    C('estado', 'Estado', 10),
    C('entrenadores', 'Entrenador al cierre', 32),
    C('entrenadores_historial', 'Todos sus entrenadores', 40),
    C('inscritos', 'Inscripciones', 13, true),
    C('inscritos_activos', 'Inscritos activos', 14, true),
    C('asistencias', 'Asistencias', 12, true),
    C('pct_presencia', '% presencia', 12, true),
  ],
  select: `
SELECT d.colacthor_id,
       c.col_nombre   AS colegio,
       a.act_nombre   AS actividad,
       di.dia_nombre  AS dia,
       ${horario('d')} AS horario,
       COALESCE(e.est_nombre, '') AS estado,
       COALESCE((SELECT string_agg(u.usu_nombre, ', ' ORDER BY u.usu_nombre)
                   FROM archivo.entrenador_asignacion ea
                   JOIN archivo.usuario u ON u.usu_id = ea.ent_id
                  WHERE ea.colacthor_id = d.colacthor_id
                    AND ea.entasig_fecha_fin IS NULL AND ea.est_id = 1), '') AS entrenadores,
       COALESCE((SELECT string_agg(DISTINCT u.usu_nombre, ', ')
                   FROM archivo.entrenador_asignacion ea
                   JOIN archivo.usuario u ON u.usu_id = ea.ent_id
                  WHERE ea.colacthor_id = d.colacthor_id), '') AS entrenadores_historial,
       (SELECT count(*) FROM archivo.nino_asignacion na WHERE na.colacthor_id = d.colacthor_id)::int AS inscritos,
       (SELECT count(*) FROM archivo.nino_asignacion na
         WHERE na.colacthor_id = d.colacthor_id AND na.est_id = 1)::int AS inscritos_activos,
       s.asistencias,
       s.pct_presencia,
       d.dia_id                AS _dia,
       d.colacthor_hora_inicio AS _hora
  FROM archivo.colegio_actividad_horario d
  JOIN archivo.colegio c     ON c.col_id = d.col_id
  JOIN archivo.actividad a   ON a.act_id = d.act_id
  JOIN archivo.dia di        ON di.dia_id = d.dia_id
  LEFT JOIN archivo.estado e ON e.est_id = d.est_id
  LEFT JOIN LATERAL (
      SELECT count(*)::int AS asistencias, ${pct('an.asisest_id = 1')} AS pct_presencia
        FROM archivo.asistencia_nino an
       WHERE an.colacthor_id = d.colacthor_id
  ) s ON true`,
  aplicar: {
    buscar: ['c.col_nombre', 'a.act_nombre'],
    colegio: 'd.col_id',
    actividad: 'd.act_id',
    entrenador: (p) => `EXISTS (
        SELECT 1 FROM archivo.entrenador_asignacion ea
         WHERE ea.colacthor_id = d.colacthor_id AND ea.ent_id = ${p})`,
    estado: 'd.est_id',
  },
  ordenDefecto: 'r.colegio, r._dia, r._hora',
  estados: ESTADOS_ACTIVO,
};

const inscripciones: Conjunto = {
  id: 'inscripciones',
  grupo: 'Estructura',
  titulo: 'Inscripciones',
  descripcion: 'Cada vez que un alumno se inscribió en una disciplina, con su alta y su baja.',
  rangoSobre: 'la fecha de inscripción',
  columnas: [
    C('ninoasig_id', 'ID', 8, true),
    C('alumno', 'Alumno', 34),
    C('colegio', 'Colegio', 30),
    C('actividad', 'Actividad', 24),
    C('dia', 'Día', 11),
    C('horario', 'Horario', 14),
    C('fecha_inscripcion', 'Inscrito', 12),
    C('fecha_baja', 'Baja', 12),
    C('estado', 'Estado', 10),
  ],
  select: `
SELECT na.ninoasig_id,
       n.nino_nombre AS alumno,
       c.col_nombre  AS colegio,
       a.act_nombre  AS actividad,
       di.dia_nombre AS dia,
       ${horario('d')} AS horario,
       COALESCE(${diaDeMarca('na.ninoasig_fecha_inscripcion')}, '') AS fecha_inscripcion,
       COALESCE(${diaDeMarca('na.ninoasig_fecha_baja')}, '')        AS fecha_baja,
       COALESCE(e.est_nombre, '') AS estado
  FROM archivo.nino_asignacion na
  JOIN archivo.nino n ON n.nino_id = na.nino_id${disciplina('na.colacthor_id')}
  LEFT JOIN archivo.estado e ON e.est_id = na.est_id`,
  aplicar: {
    buscar: ['n.nino_nombre', 'a.act_nombre'],
    colegio: 'd.col_id',
    actividad: 'd.act_id',
    estado: 'na.est_id',
    desde: diaEc('na.ninoasig_fecha_inscripcion'),
    hasta: diaEc('na.ninoasig_fecha_inscripcion'),
  },
  ordenDefecto: 'r.fecha_inscripcion DESC, r.alumno',
  estados: ESTADOS_ACTIVO,
};

const asignaciones: Conjunto = {
  id: 'asignaciones',
  grupo: 'Estructura',
  titulo: 'Asignaciones de entrenador',
  descripcion: 'Quién dio cada disciplina y desde cuándo hasta cuándo. El historial completo.',
  rangoSobre: 'la fecha de inicio',
  columnas: [
    C('entasig_id', 'ID', 8, true),
    C('entrenador', 'Entrenador', 34),
    C('colegio', 'Colegio', 30),
    C('actividad', 'Actividad', 24),
    C('dia', 'Día', 11),
    C('horario', 'Horario', 14),
    C('inicio', 'Desde', 12),
    C('fin', 'Hasta', 12),
    C('situacion', 'Al cierre', 12),
  ],
  select: `
SELECT ea.entasig_id,
       u.usu_nombre  AS entrenador,
       c.col_nombre  AS colegio,
       a.act_nombre  AS actividad,
       di.dia_nombre AS dia,
       ${horario('d')} AS horario,
       ${fecha('ea.entasig_fecha_inicio')}               AS inicio,
       COALESCE(${fecha('ea.entasig_fecha_fin')}, '')    AS fin,
       CASE WHEN ea.entasig_fecha_fin IS NULL AND ea.est_id = 1 THEN 'Abierta' ELSE 'Cerrada' END AS situacion
  FROM archivo.entrenador_asignacion ea
  JOIN archivo.usuario u ON u.usu_id = ea.ent_id${disciplina('ea.colacthor_id')}`,
  aplicar: {
    buscar: ['u.usu_nombre', 'a.act_nombre', 'c.col_nombre'],
    colegio: 'd.col_id',
    actividad: 'd.act_id',
    entrenador: 'ea.ent_id',
    desde: 'ea.entasig_fecha_inicio',
    hasta: 'ea.entasig_fecha_inicio',
  },
  ordenDefecto: 'r.inicio DESC, r.entrenador',
};

// ---------------------------------------------------------------------------
// Asistencia

const RANGO_CLASE = 'el día de la clase';

const asistenciaAlumnos: Conjunto = {
  id: 'asistencia-alumnos',
  grupo: 'Asistencia',
  titulo: 'Asistencia de alumnos',
  descripcion: 'Cada marca de asistencia: quién, dónde, cuándo, cómo y quién la registró.',
  rangoSobre: RANGO_CLASE,
  columnas: [
    C('asisnino_id', 'ID', 9, true),
    C('fecha', 'Fecha', 12),
    C('alumno', 'Alumno', 34),
    C('colegio', 'Colegio', 30),
    C('actividad', 'Actividad', 24),
    C('dia', 'Día', 11),
    C('horario', 'Horario', 14),
    C('asistencia', 'Asistencia', 12),
    C('hora_tarde', 'Hora (tarde)', 11),
    C('justificacion', 'Justificación', 30),
    C('registrado_por', 'Registrado por', 30),
    C('registrado_el', 'Registrado el', 17),
  ],
  select: `
SELECT an.asisnino_id,
       ${fecha('an.asisnino_fecha')} AS fecha,
       n.nino_nombre AS alumno,
       c.col_nombre  AS colegio,
       a.act_nombre  AS actividad,
       di.dia_nombre AS dia,
       ${horario('d')} AS horario,
       COALESCE(es.asisest_nombre, '') AS asistencia,
       CASE WHEN an.asisest_id = 3 THEN COALESCE(to_char(an.asisnino_hora_tarde, 'HH24:MI'), '') ELSE '' END AS hora_tarde,
       COALESCE(an.asisnino_razon_justificado, '') AS justificacion,
       COALESCE(ur.usu_nombre, '') AS registrado_por,
       COALESCE(${momento('an.asisnino_fecha_registrado')}, '') AS registrado_el
  FROM archivo.asistencia_nino an
  JOIN archivo.nino n ON n.nino_id = an.nino_id${disciplina('an.colacthor_id')}
  LEFT JOIN archivo.asistencia_estado es ON es.asisest_id = an.asisest_id
  LEFT JOIN archivo.usuario ur           ON ur.usu_id = an.usu_registrador`,
  aplicar: {
    buscar: ['n.nino_nombre'],
    colegio: 'd.col_id',
    actividad: 'd.act_id',
    entrenador: 'an.usu_registrador',
    asistencia: 'an.asisest_id',
    desde: 'an.asisnino_fecha',
    hasta: 'an.asisnino_fecha',
  },
  ordenDefecto: 'r.fecha DESC, r.colegio, r.alumno',
};

const asistenciaEntrenadores: Conjunto = {
  id: 'asistencia-entrenadores',
  grupo: 'Asistencia',
  titulo: 'Asistencia de entrenadores',
  descripcion: 'Si cada entrenador fue a su colegio cada día, y quién lo registró.',
  rangoSobre: RANGO_CLASE,
  columnas: [
    C('asisent_id', 'ID', 9, true),
    C('fecha', 'Fecha', 12),
    C('entrenador', 'Entrenador', 34),
    C('colegio', 'Colegio', 30),
    C('asistencia', 'Asistencia', 12),
    C('hora_tarde', 'Hora (tarde)', 11),
    C('justificacion', 'Justificación', 30),
    C('registrado_por', 'Registrado por', 30),
    C('registrado_el', 'Registrado el', 17),
  ],
  select: `
SELECT ae.asisent_id,
       ${fecha('ae.asisent_fecha')} AS fecha,
       u.usu_nombre AS entrenador,
       COALESCE(c.col_nombre, '') AS colegio,
       COALESCE(es.asisest_nombre, '') AS asistencia,
       CASE WHEN ae.asisest_id = 3 THEN COALESCE(to_char(ae.asisent_hora_tarde, 'HH24:MI'), '') ELSE '' END AS hora_tarde,
       COALESCE(ae.asisent_razon_justificado, '') AS justificacion,
       COALESCE(ur.usu_nombre, '') AS registrado_por,
       COALESCE(${momento('ae.asisent_fecha_registrado')}, '') AS registrado_el
  FROM archivo.asistencia_entrenador ae
  JOIN archivo.usuario u                 ON u.usu_id = ae.ent_id
  LEFT JOIN archivo.colegio c            ON c.col_id = ae.col_id
  LEFT JOIN archivo.asistencia_estado es ON es.asisest_id = ae.asisest_id
  LEFT JOIN archivo.usuario ur           ON ur.usu_id = ae.usu_registrador`,
  aplicar: {
    buscar: ['u.usu_nombre'],
    colegio: 'ae.col_id',
    entrenador: 'ae.ent_id',
    asistencia: 'ae.asisest_id',
    desde: 'ae.asisent_fecha',
    hasta: 'ae.asisent_fecha',
  },
  ordenDefecto: 'r.fecha DESC, r.entrenador',
};

const asistenciaAuxiliares: Conjunto = {
  id: 'asistencia-auxiliares',
  grupo: 'Asistencia',
  titulo: 'Asistencia de asistentes y respaldos',
  descripcion: 'La asistencia de los asistentes y respaldos de entrenador.',
  rangoSobre: RANGO_CLASE,
  columnas: [
    C('asisaux_id', 'ID', 9, true),
    C('fecha', 'Fecha', 12),
    C('auxiliar', 'Asistente / respaldo', 34),
    C('colegio', 'Colegio', 30),
    C('asistencia', 'Asistencia', 12),
    C('hora_tarde', 'Hora (tarde)', 11),
    C('justificacion', 'Justificación', 30),
    C('registrado_por', 'Registrado por', 30),
    C('registrado_el', 'Registrado el', 17),
  ],
  select: `
SELECT x.asisaux_id,
       ${fecha('x.asisaux_fecha')} AS fecha,
       u.usu_nombre AS auxiliar,
       COALESCE(c.col_nombre, '') AS colegio,
       COALESCE(es.asisest_nombre, '') AS asistencia,
       CASE WHEN x.asisest_id = 3 THEN COALESCE(to_char(x.asisaux_hora_tarde, 'HH24:MI'), '') ELSE '' END AS hora_tarde,
       COALESCE(x.asisaux_razon_justificado, '') AS justificacion,
       COALESCE(ur.usu_nombre, '') AS registrado_por,
       COALESCE(${momento('x.asisaux_fecha_registrado')}, '') AS registrado_el
  FROM archivo.asistencia_auxiliar x
  JOIN archivo.usuario u                 ON u.usu_id = x.usu_id
  LEFT JOIN archivo.colegio c            ON c.col_id = x.col_id
  LEFT JOIN archivo.asistencia_estado es ON es.asisest_id = x.asisest_id
  LEFT JOIN archivo.usuario ur           ON ur.usu_id = x.usu_registrador`,
  aplicar: {
    buscar: ['u.usu_nombre'],
    colegio: 'x.col_id',
    asistencia: 'x.asisest_id',
    desde: 'x.asisaux_fecha',
    hasta: 'x.asisaux_fecha',
  },
  ordenDefecto: 'r.fecha DESC, r.auxiliar',
};

// ---------------------------------------------------------------------------
// Evaluaciones

const evaluaciones: Conjunto = {
  id: 'evaluaciones',
  grupo: 'Evaluaciones',
  titulo: 'Evaluaciones',
  descripcion: 'Las evaluaciones creadas, en cuántas disciplinas se aplicaron y cuántos alumnos las completaron.',
  columnas: [
    C('eva_id', 'ID', 8, true),
    C('eva_titulo', 'Evaluación', 30),
    C('eva_categoria', 'Categoría', 16),
    C('eva_descripcion', 'Descripción', 40),
    C('creador', 'Creada por', 28),
    C('estado', 'Estado', 12),
    C('puntaje_total', 'Puntaje total', 12, true),
    C('parametros', 'Parámetros', 11, true),
    C('disciplinas', 'Disciplinas', 11, true),
    C('pendientes', 'Alumnos pendientes', 14, true),
    C('evaluados', 'Alumnos evaluados', 14, true),
    C('fecha_creacion', 'Creada', 12),
  ],
  select: `
SELECT ev.eva_id,
       ev.eva_titulo,
       COALESCE(ev.eva_categoria, '')   AS eva_categoria,
       COALESCE(ev.eva_descripcion, '') AS eva_descripcion,
       COALESCE(u.usu_nombre, '')       AS creador,
       COALESCE(e.est_nombre, '')       AS estado,
       ev.eva_puntaje_total::float8     AS puntaje_total,
       (SELECT count(*) FROM archivo.evaluacion_parametro p WHERE p.eva_id = ev.eva_id)::int AS parametros,
       (SELECT count(*) FROM archivo.evaluacion_asignacion x WHERE x.eva_id = ev.eva_id)::int AS disciplinas,
       (SELECT count(*) FROM archivo.evaluacion_nino_pendiente p WHERE p.eva_id = ev.eva_id AND p.est_id = 6)::int AS pendientes,
       (SELECT count(*) FROM archivo.evaluacion_nino_pendiente p WHERE p.eva_id = ev.eva_id AND p.est_id = 7)::int AS evaluados,
       ${diaDeMarca('ev.eva_fecha_creacion')} AS fecha_creacion
  FROM archivo.evaluacion ev
  LEFT JOIN archivo.usuario u ON u.usu_id = ev.eva_creador
  LEFT JOIN archivo.estado e  ON e.est_id = ev.est_id`,
  aplicar: { buscar: ['ev.eva_titulo', 'ev.eva_categoria'], estado: 'ev.est_id' },
  ordenDefecto: 'r.eva_titulo',
  estados: [
    { id: 1, nombre: 'Activo' },
    { id: 2, nombre: 'Inactivo' },
    { id: 3, nombre: 'Borrador' },
    { id: 4, nombre: 'Finalizado' },
    { id: 5, nombre: 'Publicado' },
  ],
};

const parametros: Conjunto = {
  id: 'parametros',
  grupo: 'Evaluaciones',
  titulo: 'Parámetros de evaluación',
  descripcion: 'Qué medía cada evaluación, con qué método y cuántos puntos valía.',
  columnas: [
    C('evaparam_id', 'ID', 8, true),
    C('evaluacion', 'Evaluación', 30),
    C('evaparam_nombre', 'Parámetro', 30),
    C('metodo', 'Método', 18),
    C('evaparam_intentos', 'Intentos', 9, true),
    C('evaparam_puntaje', 'Puntaje', 9, true),
    C('escala', 'Escala', 10),
    C('evaparam_nota', 'Nota', 40),
  ],
  select: `
SELECT p.evaparam_id,
       ev.eva_titulo AS evaluacion,
       p.evaparam_nombre,
       COALESCE(m.evatipometo_nombre, '') AS metodo,
       p.evaparam_intentos,
       p.evaparam_puntaje,
       CASE WHEN p.evaparam_escala_min IS NULL AND p.evaparam_escala_max IS NULL THEN ''
            ELSE COALESCE(p.evaparam_escala_min::text, '') || ' - ' || COALESCE(p.evaparam_escala_max::text, '') END AS escala,
       COALESCE(p.evaparam_nota, '') AS evaparam_nota
  FROM archivo.evaluacion_parametro p
  JOIN archivo.evaluacion ev ON ev.eva_id = p.eva_id
  LEFT JOIN archivo.evaluacion_tipo_metodo m ON m.evatipometo_id = p.evatipometo_id`,
  aplicar: { buscar: ['ev.eva_titulo', 'p.evaparam_nombre'] },
  ordenDefecto: 'r.evaluacion, r.evaparam_id',
};

const resultados: Conjunto = {
  id: 'resultados',
  grupo: 'Evaluaciones',
  titulo: 'Evaluaciones por alumno',
  descripcion: 'Cada alumno que tenía una evaluación asignada: si la completó, cuándo, quién y con qué puntaje.',
  columnas: [
    C('evaninopen_id', 'ID', 8, true),
    C('alumno', 'Alumno', 34),
    C('evaluacion', 'Evaluación', 28),
    C('colegio', 'Colegio', 30),
    C('actividad', 'Actividad', 24),
    C('dia', 'Día', 11),
    C('estado', 'Estado', 11),
    C('puntaje', 'Puntaje obtenido', 14, true),
    C('puntaje_total', 'Sobre', 8, true),
    C('fecha', 'Fecha', 12),
    C('evaluado_por', 'Evaluado por', 30),
  ],
  select: `
SELECT p.evaninopen_id,
       n.nino_nombre AS alumno,
       ev.eva_titulo AS evaluacion,
       c.col_nombre  AS colegio,
       a.act_nombre  AS actividad,
       di.dia_nombre AS dia,
       COALESCE(e.est_nombre, '') AS estado,
       (SELECT round(sum(i.evaint_puntaje_obtenido)::numeric, 2)::float8
          FROM archivo.evaluacion_intento i WHERE i.evaninopen_id = p.evaninopen_id) AS puntaje,
       ev.eva_puntaje_total::float8 AS puntaje_total,
       COALESCE(${diaDeMarca('p.evaninopen_fecha_finalizacion')}, '') AS fecha,
       COALESCE(ur.usu_nombre, '') AS evaluado_por
  FROM archivo.evaluacion_nino_pendiente p
  JOIN archivo.evaluacion ev      ON ev.eva_id = p.eva_id
  JOIN archivo.nino_asignacion na ON na.ninoasig_id = p.ninoasig_id
  JOIN archivo.nino n             ON n.nino_id = na.nino_id${disciplina('na.colacthor_id')}
  LEFT JOIN archivo.estado e      ON e.est_id = p.est_id
  LEFT JOIN archivo.usuario ur    ON ur.usu_id = p.usu_id_registrador`,
  aplicar: {
    buscar: ['n.nino_nombre', 'ev.eva_titulo'],
    colegio: 'd.col_id',
    actividad: 'd.act_id',
    estado: 'p.est_id',
  },
  ordenDefecto: 'r.colegio, r.alumno',
  estados: [
    { id: 6, nombre: 'Pendiente' },
    { id: 7, nombre: 'Evaluado' },
    { id: 2, nombre: 'Inactivo' },
  ],
};

export const CONJUNTOS: Conjunto[] = [
  alumnos,
  usuarios,
  entrenadores,
  auxiliares,
  colegios,
  actividades,
  disciplinas,
  inscripciones,
  asignaciones,
  asistenciaAlumnos,
  asistenciaEntrenadores,
  asistenciaAuxiliares,
  evaluaciones,
  parametros,
  resultados,
];

export function conjuntoDe(id: string): Conjunto | undefined {
  return CONJUNTOS.find((c) => c.id === id);
}
