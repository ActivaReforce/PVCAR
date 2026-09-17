import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import { ESTADO } from '../../lib/constants.js';

/**
 * Consultas de Asistencias.
 *
 * Dos ideas gobiernan este archivo y conviene tenerlas delante:
 *
 * **1. La lista de una sesion no es "quien esta inscrito hoy".**
 * Es "quien estaba inscrito **esa fecha**" mas "quien ya tiene una marca
 * puesta esa fecha". Sin lo segundo, abrir una fecha pasada esconderia
 * registros: en `PVCAR_Dev` hay 1 393 asistencias de alumnos cuya inscripcion
 * ya se cerro. El sistema viejo filtraba por `est_id = 1` y los perdia todos.
 *
 * **2. El dia de la semana sale de Postgres, no de JavaScript.**
 * `EXTRACT(ISODOW FROM fecha)` da 1=Lunes .. 7=Domingo, que es exactamente la
 * tabla `dia`. El frontend viejo comparaba `date.getDay()` (0=Domingo) contra
 * `dia_id`: coincide de lunes a sabado y **falla el domingo**, que con ese
 * codigo no se puede registrar nunca. Hoy no hay disciplinas en domingo, asi
 * que el fallo esta latente; aqui no existe.
 */

export interface EstadoAsistencia {
  asisest_id: number;
  asisest_nombre: string;
}

export interface Sesion {
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_id: number;
  act_nombre: string;
  dia_id: number;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  est_id: number;
  entrenadores: string[];
}

export interface AlumnoDeSesion {
  nino_id: number;
  nino_nombre: string;
  nino_foto: string | null;
  catninograd_nombre: string | null;
  /** Falso cuando solo aparece porque ya tenia una marca esa fecha. */
  inscrito: boolean;
  asisest_id: number | null;
  hora_tarde: string | null;
  razon: string | null;
  registrado_en: string | null;
  registrado_por: string | null;
}

export interface PersonaDeColegio {
  tipo: 'entrenador' | 'auxiliar';
  id: number;
  usu_nombre: string;
  usu_foto: string | null;
  /** Para un auxiliar, el nombre de su titular. Nulo para un entrenador. */
  titular: string | null;
  /** Lo que imparte ese dia en ese colegio. Vacio si solo sale por historial. */
  imparte: string[];
  /** Falso cuando solo aparece porque ya tenia una marca esa fecha. */
  activo_hoy: boolean;
  asisest_id: number | null;
  hora_tarde: string | null;
  razon: string | null;
  registrado_en: string | null;
  registrado_por: string | null;
}

export interface DiaDeHistorial {
  fecha: string;
  total: number;
  presentes: number;
  ausentes: number;
  tardes: number;
  justificados: number;
}

export async function listarEstados(): Promise<EstadoAsistencia[]> {
  const { rows } = await getPool().query<EstadoAsistencia>(
    `SELECT asisest_id, asisest_nombre FROM public.asistencia_estado ORDER BY asisest_id`,
  );
  return rows;
}

/**
 * La hora de Ecuador, calculada por la base.
 *
 * El sistema viejo la sacaba en el navegador con `date-fns-tz` y el reloj del
 * telefono del entrenador. Dos moviles mal puestos en horario daban dos horas
 * de llegada distintas para la misma clase. Se pregunta al servidor y punto.
 */
export async function horaDeEcuador(): Promise<string> {
  const { rows } = await getPool().query<{ hora: string }>(
    `SELECT to_char(now() AT TIME ZONE 'America/Guayaquil', 'HH24:MI') AS hora`,
  );
  return rows[0]?.hora ?? '00:00';
}

/** La fecha de hoy en Ecuador, para que el front no proponga la del navegador. */
export async function hoyEnEcuador(): Promise<string> {
  const { rows } = await getPool().query<{ hoy: string }>(
    `SELECT to_char(now() AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') AS hoy`,
  );
  return rows[0]?.hoy ?? '';
}

// ---------------------------------------------------------------------------
// Alumnos

export async function obtenerSesion(colacthorId: number): Promise<Sesion | null> {
  const { rows } = await getPool().query<Sesion>(
    `SELECT cah.colacthor_id,
            cah.col_id,
            c.col_nombre,
            cah.act_id,
            a.act_nombre,
            cah.dia_id,
            d.dia_nombre,
            to_char(cah.colacthor_hora_inicio, 'HH24:MI') AS colacthor_hora_inicio,
            to_char(cah.colacthor_hora_fin, 'HH24:MI')    AS colacthor_hora_fin,
            cah.est_id,
            COALESCE((
                SELECT array_agg(u.usu_nombre ORDER BY u.usu_nombre)
                FROM public.entrenador_asignacion ea
                JOIN public.usuario u ON u.usu_id = ea.ent_id
                WHERE ea.colacthor_id = cah.colacthor_id
                  AND ea.entasig_fecha_fin IS NULL
                  AND ea.est_id = ${ESTADO.ACTIVO}
            ), '{}') AS entrenadores
       FROM public.colegio_actividad_horario cah
       JOIN public.colegio c   ON c.col_id = cah.col_id
       JOIN public.actividad a ON a.act_id = cah.act_id
       JOIN public.dia d       ON d.dia_id = cah.dia_id
      WHERE cah.colacthor_id = $1`,
    [colacthorId],
  );
  return rows[0] ?? null;
}

/**
 * Inscripcion vigente a una fecha.
 *
 * `est_id = 1` significa vigente hoy; las cerradas llevan `ninoasig_fecha_baja`
 * y ninguna vigente la tiene (comprobado en dev: 1 326 activas, 0 con fecha de
 * baja). Por eso la condicion sirve para el pasado y para el presente.
 */
const VIGENTE_A_FECHA = `
    na.ninoasig_fecha_inscripcion::date <= $2::date
    AND (na.est_id = ${ESTADO.ACTIVO} OR na.ninoasig_fecha_baja::date >= $2::date)
`;

export async function listarAlumnosDeSesion(
  colacthorId: number,
  fecha: string,
): Promise<AlumnoDeSesion[]> {
  const { rows } = await getPool().query<AlumnoDeSesion>(
    `WITH inscritos AS (
         SELECT na.nino_id
           FROM public.nino_asignacion na
          WHERE na.colacthor_id = $1 AND ${VIGENTE_A_FECHA}
     ),
     marcados AS (
         SELECT an.nino_id
           FROM public.asistencia_nino an
          WHERE an.colacthor_id = $1 AND an.asisnino_fecha = $2::date
     ),
     todos AS (
         SELECT nino_id FROM inscritos
         UNION
         SELECT nino_id FROM marcados
     )
     SELECT n.nino_id,
            n.nino_nombre,
            n.nino_foto,
            g.catninograd_nombre,
            (i.nino_id IS NOT NULL) AS inscrito,
            an.asisest_id,
            to_char(an.asisnino_hora_tarde, 'HH24:MI')  AS hora_tarde,
            an.asisnino_razon_justificado               AS razon,
            an.asisnino_fecha_registrado                AS registrado_en,
            u.usu_nombre                                AS registrado_por
       FROM todos t
       JOIN public.nino n ON n.nino_id = t.nino_id
       LEFT JOIN inscritos i ON i.nino_id = t.nino_id
       LEFT JOIN public.categoria_nino_grado g ON g.catninograd_id = n.catninograd_id
       LEFT JOIN public.asistencia_nino an
              ON an.nino_id = t.nino_id
             AND an.colacthor_id = $1
             AND an.asisnino_fecha = $2::date
       LEFT JOIN public.usuario u ON u.usu_id = an.usu_registrador
      ORDER BY n.nino_nombre`,
    [colacthorId, fecha],
  );
  return rows;
}

/** Los alumnos que el lote puede tocar: exactamente los que la lista devuelve. */
export async function ninosMarcablesEn(
  client: PoolClient,
  colacthorId: number,
  fecha: string,
): Promise<number[]> {
  const { rows } = await client.query<{ nino_id: number }>(
    `SELECT na.nino_id
       FROM public.nino_asignacion na
      WHERE na.colacthor_id = $1 AND ${VIGENTE_A_FECHA}
      UNION
     SELECT an.nino_id
       FROM public.asistencia_nino an
      WHERE an.colacthor_id = $1 AND an.asisnino_fecha = $2::date`,
    [colacthorId, fecha],
  );
  return rows.map((r) => r.nino_id);
}

export interface MarcaAlumno {
  nino_id: number;
  asisest_id: number;
  hora_tarde?: string | null;
  razon?: string | null;
}

/**
 * Upsert sobre `uq_nino_fecha_sesion`.
 *
 * `usu_registrador` y `asisnino_fecha_registrado` se reescriben siempre: quien
 * corrige una marca pasa a ser el responsable de ella, que es lo que un
 * historial de asistencia tiene que poder decir.
 *
 * Devuelve 'alta' o 'cambio' para contar las dos cosas por separado en la
 * respuesta y en la auditoria. `xmax = 0` es la forma estandar de
 * distinguirlas en un INSERT ... ON CONFLICT.
 */
export async function guardarMarcaAlumno(
  client: PoolClient,
  colacthorId: number,
  fecha: string,
  marca: MarcaAlumno,
  registrador: number,
): Promise<'alta' | 'cambio'> {
  const { rows } = await client.query<{ nueva: boolean }>(
    `INSERT INTO public.asistencia_nino
         (nino_id, colacthor_id, asisnino_fecha, asisest_id,
          asisnino_hora_tarde, asisnino_razon_justificado,
          usu_registrador, asisnino_fecha_registrado)
     VALUES ($1, $2, $3::date, $4, $5::time, $6, $7, now())
     ON CONFLICT (nino_id, colacthor_id, asisnino_fecha) DO UPDATE
        SET asisest_id                 = EXCLUDED.asisest_id,
            asisnino_hora_tarde        = EXCLUDED.asisnino_hora_tarde,
            asisnino_razon_justificado = EXCLUDED.asisnino_razon_justificado,
            usu_registrador            = EXCLUDED.usu_registrador,
            asisnino_fecha_registrado  = EXCLUDED.asisnino_fecha_registrado
     RETURNING (xmax = 0) AS nueva`,
    [
      marca.nino_id,
      colacthorId,
      fecha,
      marca.asisest_id,
      marca.hora_tarde ? `${marca.hora_tarde}:00` : null,
      marca.razon ?? null,
      registrador,
    ],
  );
  return rows[0]?.nueva ? 'alta' : 'cambio';
}

export async function historialDeSesion(
  colacthorId: number,
  desde: string,
  hasta: string,
): Promise<DiaDeHistorial[]> {
  const { rows } = await getPool().query<DiaDeHistorial>(
    `SELECT to_char(an.asisnino_fecha, 'YYYY-MM-DD')      AS fecha,
            count(*)::int                                 AS total,
            count(*) FILTER (WHERE an.asisest_id = 1)::int AS presentes,
            count(*) FILTER (WHERE an.asisest_id = 2)::int AS ausentes,
            count(*) FILTER (WHERE an.asisest_id = 3)::int AS tardes,
            count(*) FILTER (WHERE an.asisest_id = 4)::int AS justificados
       FROM public.asistencia_nino an
      WHERE an.colacthor_id = $1
        AND an.asisnino_fecha BETWEEN $2::date AND $3::date
      GROUP BY an.asisnino_fecha
      ORDER BY an.asisnino_fecha DESC`,
    [colacthorId, desde, hasta],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Entrenadores y auxiliares

export interface ColegioBasico {
  col_id: number;
  col_nombre: string;
}

export async function obtenerColegio(colId: number): Promise<ColegioBasico | null> {
  const { rows } = await getPool().query<ColegioBasico>(
    `SELECT col_id, col_nombre FROM public.colegio WHERE col_id = $1`,
    [colId],
  );
  return rows[0] ?? null;
}

/**
 * Quien da clase en ese colegio ese dia, y sus auxiliares.
 *
 * Igual que con los alumnos, la lista suma a quien ya tiene marca esa fecha
 * aunque hoy no le toque: si no, corregir el pasado seria imposible.
 *
 * Los titulares salen de `entrenador_asignacion` vigente **a esa fecha**; los
 * auxiliares, de `entrenador_auxiliar` de esos titulares. El auxiliar no tiene
 * asignacion propia: hereda la del titular, que es como funciona su alcance en
 * todo el sistema (ver lib/alcance.ts).
 */
const SQL_PERSONAL = `
    WITH titulares AS (
        SELECT DISTINCT ea.ent_id
          FROM public.entrenador_asignacion ea
          JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
         WHERE cah.col_id = $1
           AND cah.dia_id = EXTRACT(ISODOW FROM $2::date)::smallint
           AND cah.est_id = ${ESTADO.ACTIVO}
           AND ea.entasig_fecha_inicio <= $2::date
           AND (ea.entasig_fecha_fin IS NULL OR ea.entasig_fecha_fin >= $2::date)
    ),
    ent_marcados AS (
        SELECT ae.ent_id
          FROM public.asistencia_entrenador ae
         WHERE ae.col_id = $1 AND ae.asisent_fecha = $2::date
    ),
    ent_todos AS (
        SELECT ent_id FROM titulares
        UNION
        SELECT ent_id FROM ent_marcados
    ),
    aux_vivos AS (
        SELECT aux.usu_id, aux.ent_id
          FROM public.entrenador_auxiliar aux
          JOIN titulares t ON t.ent_id = aux.ent_id
         WHERE aux.est_id = ${ESTADO.ACTIVO}
    ),
    aux_marcados AS (
        SELECT aa.usu_id
          FROM public.asistencia_auxiliar aa
         WHERE aa.col_id = $1 AND aa.asisaux_fecha = $2::date
    ),
    aux_todos AS (
        SELECT usu_id FROM aux_vivos
        UNION
        SELECT usu_id FROM aux_marcados
    )
    SELECT 'entrenador'::text AS tipo,
           t.ent_id           AS id,
           u.usu_nombre,
           u.usu_foto,
           NULL::text         AS titular,
           COALESCE((
               SELECT array_agg(a.act_nombre ORDER BY cah.colacthor_hora_inicio)
                 FROM public.entrenador_asignacion ea2
                 JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea2.colacthor_id
                 JOIN public.actividad a ON a.act_id = cah.act_id
                WHERE ea2.ent_id = t.ent_id
                  AND cah.col_id = $1
                  AND cah.dia_id = EXTRACT(ISODOW FROM $2::date)::smallint
                  AND ea2.entasig_fecha_inicio <= $2::date
                  AND (ea2.entasig_fecha_fin IS NULL OR ea2.entasig_fecha_fin >= $2::date)
           ), '{}') AS imparte,
           (ti.ent_id IS NOT NULL) AS activo_hoy,
           ae.asisest_id,
           to_char(ae.asisent_hora_tarde, 'HH24:MI') AS hora_tarde,
           ae.asisent_razon_justificado              AS razon,
           ae.asisent_fecha_registrado               AS registrado_en,
           reg.usu_nombre                            AS registrado_por
      FROM ent_todos t
      JOIN public.usuario u ON u.usu_id = t.ent_id
      LEFT JOIN titulares ti ON ti.ent_id = t.ent_id
      LEFT JOIN public.asistencia_entrenador ae
             ON ae.ent_id = t.ent_id AND ae.col_id = $1 AND ae.asisent_fecha = $2::date
      LEFT JOIN public.usuario reg ON reg.usu_id = ae.usu_registrador

    UNION ALL

    SELECT 'auxiliar'::text AS tipo,
           x.usu_id         AS id,
           u.usu_nombre,
           u.usu_foto,
           tit.usu_nombre   AS titular,
           '{}'::text[]     AS imparte,
           (av.usu_id IS NOT NULL) AS activo_hoy,
           aa.asisest_id,
           to_char(aa.asisaux_hora_tarde, 'HH24:MI') AS hora_tarde,
           aa.asisaux_razon_justificado              AS razon,
           aa.asisaux_fecha_registrado               AS registrado_en,
           reg.usu_nombre                            AS registrado_por
      FROM aux_todos x
      JOIN public.usuario u ON u.usu_id = x.usu_id
      LEFT JOIN aux_vivos av ON av.usu_id = x.usu_id
      LEFT JOIN public.usuario tit ON tit.usu_id = av.ent_id
      LEFT JOIN public.asistencia_auxiliar aa
             ON aa.usu_id = x.usu_id AND aa.col_id = $1 AND aa.asisaux_fecha = $2::date
      LEFT JOIN public.usuario reg ON reg.usu_id = aa.usu_registrador

     ORDER BY 1, 3
`;

export async function listarPersonalDeColegio(
  colId: number,
  fecha: string,
): Promise<PersonaDeColegio[]> {
  const { rows } = await getPool().query<PersonaDeColegio>(SQL_PERSONAL, [colId, fecha]);
  return rows;
}

/** Las personas que el lote puede tocar, como pares 'tipo:id'. */
export async function personalMarcableEn(
  client: PoolClient,
  colId: number,
  fecha: string,
): Promise<string[]> {
  const { rows } = await client.query<{ tipo: string; id: number }>(
    `SELECT p.tipo, p.id FROM (${SQL_PERSONAL}) p`,
    [colId, fecha],
  );
  return rows.map((r) => `${r.tipo}:${r.id}`);
}

export interface MarcaPersona {
  tipo: 'entrenador' | 'auxiliar';
  id: number;
  asisest_id: number;
  hora_tarde?: string | null;
  razon?: string | null;
}

export async function guardarMarcaEntrenador(
  client: PoolClient,
  colId: number,
  fecha: string,
  marca: MarcaPersona,
  registrador: number,
): Promise<'alta' | 'cambio'> {
  const { rows } = await client.query<{ nueva: boolean }>(
    `INSERT INTO public.asistencia_entrenador
         (ent_id, col_id, asisent_fecha, asisest_id,
          asisent_hora_tarde, asisent_razon_justificado,
          usu_registrador, asisent_fecha_registrado)
     VALUES ($1, $2, $3::date, $4, $5::time, $6, $7, now())
     ON CONFLICT (ent_id, asisent_fecha, col_id) DO UPDATE
        SET asisest_id                = EXCLUDED.asisest_id,
            asisent_hora_tarde        = EXCLUDED.asisent_hora_tarde,
            asisent_razon_justificado = EXCLUDED.asisent_razon_justificado,
            usu_registrador           = EXCLUDED.usu_registrador,
            asisent_fecha_registrado  = EXCLUDED.asisent_fecha_registrado
     RETURNING (xmax = 0) AS nueva`,
    [
      marca.id,
      colId,
      fecha,
      marca.asisest_id,
      marca.hora_tarde ? `${marca.hora_tarde}:00` : null,
      marca.razon ?? null,
      registrador,
    ],
  );
  return rows[0]?.nueva ? 'alta' : 'cambio';
}

export async function guardarMarcaAuxiliar(
  client: PoolClient,
  colId: number,
  fecha: string,
  marca: MarcaPersona,
  registrador: number,
): Promise<'alta' | 'cambio'> {
  const { rows } = await client.query<{ nueva: boolean }>(
    `INSERT INTO public.asistencia_auxiliar
         (usu_id, col_id, asisaux_fecha, asisest_id,
          asisaux_hora_tarde, asisaux_razon_justificado,
          usu_registrador, asisaux_fecha_registrado)
     VALUES ($1, $2, $3::date, $4, $5::time, $6, $7, now())
     ON CONFLICT (usu_id, asisaux_fecha, col_id) DO UPDATE
        SET asisest_id                = EXCLUDED.asisest_id,
            asisaux_hora_tarde        = EXCLUDED.asisaux_hora_tarde,
            asisaux_razon_justificado = EXCLUDED.asisaux_razon_justificado,
            usu_registrador           = EXCLUDED.usu_registrador,
            asisaux_fecha_registrado  = EXCLUDED.asisaux_fecha_registrado
     RETURNING (xmax = 0) AS nueva`,
    [
      marca.id,
      colId,
      fecha,
      marca.asisest_id,
      marca.hora_tarde ? `${marca.hora_tarde}:00` : null,
      marca.razon ?? null,
      registrador,
    ],
  );
  return rows[0]?.nueva ? 'alta' : 'cambio';
}
