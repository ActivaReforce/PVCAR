import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import { ESTADO, ROL } from '../../lib/constants.js';
import { contieneSinTildes } from '../../lib/sql.js';
import type { PreguntaInput } from './encuestas.schemas.js';

/**
 * Consultas de Encuestas.
 *
 * ---------------------------------------------------------------------------
 * Sin alcance, y es correcto
 *
 * Una encuesta no cuelga de un colegio ni de una disciplina: se le pregunta a
 * **todos los representantes**. No hay nada por lo que filtrarla. Quien puede
 * verlas lo dice el permiso `encuestas:ver`, que tienen Propietario,
 * Coordinador y Admin — los tres roles sin alcance acotado o con alcance
 * completo sobre personas.
 *
 * Si algun dia hay que poder dirigir una encuesta a un colegio concreto, eso es
 * una columna nueva y una migracion, no un filtro colado aqui.
 *
 * ---------------------------------------------------------------------------
 * Los tres estados
 *
 * 3 Borrador   se edita
 * 4 Finalizado no se edita, no se responde todavia
 * 5 Publicado  se responde
 *
 * El CHECK `ck_encuesta_estado` de la migracion 0012 impide cualquier otro.
 */

export interface EncuestaListada {
  encu_id: number;
  encu_titulo: string;
  encu_descripcion: string | null;
  est_id: number;
  encu_creador: number;
  creador: string;
  encu_fecha_creacion: string;
  preguntas: number;
  respondidas: number;
  /** Representantes con ficha: el denominador de la proporcion de respuestas. */
  representantes: number;
}

export interface PreguntaDetalle {
  encupreg_id: number;
  encupreg_orden: number;
  encupreg_pregunta: string;
  encupreg_nota: string | null;
  encutiporesp_id: number;
  encutiporesp_nombre: string;
  encupreg_escala_min: number | null;
  encupreg_escala_max: number | null;
  /** Respuestas ya registradas. Bloquea tocar la pregunta. */
  respuestas: number;
}

const DESDE = `
    FROM public.encuesta e
    JOIN public.usuario u ON u.usu_id = e.encu_creador
    LEFT JOIN LATERAL (
        SELECT count(*) AS n FROM public.encuesta_pregunta p WHERE p.encu_id = e.encu_id
    ) preg ON TRUE
    LEFT JOIN LATERAL (
        SELECT count(*) AS n FROM public.encuesta_respondida r WHERE r.encu_id = e.encu_id
    ) resp ON TRUE
`;

const COLUMNAS = `
        e.encu_id,
        e.encu_titulo,
        e.encu_descripcion,
        e.est_id,
        e.encu_creador,
        u.usu_nombre                AS creador,
        e.encu_fecha_creacion,
        COALESCE(preg.n, 0)::int    AS preguntas,
        COALESCE(resp.n, 0)::int    AS respondidas,
        (SELECT count(*) FROM public.padre p
          JOIN public.usuario pu ON pu.usu_id = p.usu_id
         WHERE pu.est_id = ${ESTADO.ACTIVO})::int AS representantes
`;

export async function listarTipos(): Promise<
  Array<{ encutiporesp_id: number; encutiporesp_nombre: string }>
> {
  const { rows } = await getPool().query(
    `SELECT encutiporesp_id, encutiporesp_nombre
       FROM public.encuesta_tipo_respuesta ORDER BY encutiporesp_id`,
  );
  return rows;
}

export async function listarEncuestas(
  buscar: string | null,
  estado: number | null,
): Promise<EncuestaListada[]> {
  const { rows } = await getPool().query<EncuestaListada>(
    `SELECT ${COLUMNAS}
     ${DESDE}
     WHERE ($1::text IS NULL OR ${contieneSinTildes('e.encu_titulo', '$1')})
       AND ($2::int IS NULL OR e.est_id = $2)
     ORDER BY e.encu_fecha_creacion DESC`,
    [buscar, estado],
  );
  return rows;
}

export async function obtenerEncuesta(encuId: number): Promise<EncuestaListada | null> {
  const { rows } = await getPool().query<EncuestaListada>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE e.encu_id = $1`,
    [encuId],
  );
  return rows[0] ?? null;
}

export async function listarPreguntas(encuId: number): Promise<PreguntaDetalle[]> {
  const { rows } = await getPool().query<PreguntaDetalle>(
    `SELECT p.encupreg_id,
            p.encupreg_orden,
            p.encupreg_pregunta,
            p.encupreg_nota,
            p.encutiporesp_id,
            t.encutiporesp_nombre,
            p.encupreg_escala_min,
            p.encupreg_escala_max,
            COALESCE((SELECT count(*) FROM public.encuesta_respuesta r
                       WHERE r.encupreg_id = p.encupreg_id), 0)::int AS respuestas
       FROM public.encuesta_pregunta p
       JOIN public.encuesta_tipo_respuesta t ON t.encutiporesp_id = p.encutiporesp_id
      WHERE p.encu_id = $1
      ORDER BY p.encupreg_orden`,
    [encuId],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Escritura de la plantilla

export async function insertarEncuesta(
  client: PoolClient,
  titulo: string,
  descripcion: string | null,
  creador: number,
): Promise<number> {
  const { rows } = await client.query<{ encu_id: number }>(
    `INSERT INTO public.encuesta (encu_titulo, encu_descripcion, encu_creador, est_id)
     VALUES ($1, $2, $3, ${ESTADO.BORRADOR})
     RETURNING encu_id`,
    [titulo, descripcion, creador],
  );
  return rows[0]!.encu_id;
}

export async function actualizarEncuesta(
  client: PoolClient,
  encuId: number,
  titulo: string | undefined,
  descripcion: string | null,
  tocarDescripcion: boolean,
): Promise<void> {
  await client.query(
    `UPDATE public.encuesta
        SET encu_titulo = COALESCE($2, encu_titulo),
            encu_descripcion = CASE WHEN $4::boolean THEN $3 ELSE encu_descripcion END,
            encu_fecha_modificacion = now()
      WHERE encu_id = $1`,
    [encuId, titulo ?? null, descripcion, tocarDescripcion],
  );
}

export async function cambiarEstado(
  client: PoolClient,
  encuId: number,
  estId: number,
): Promise<void> {
  await client.query(
    `UPDATE public.encuesta SET est_id = $2, encu_fecha_modificacion = now() WHERE encu_id = $1`,
    [encuId, estId],
  );
}

/**
 * Reemplaza las preguntas enteras.
 *
 * Se borran y se vuelven a insertar en el orden en que llegan, en la misma
 * transaccion. Es legitimo **solo en borrador**, que es lo que comprueba el
 * servicio: sin respuestas detras no se pierde nada, y evita el baile de
 * actualizar/crear/borrar con el indice unico de orden por medio.
 */
export async function reemplazarPreguntas(
  client: PoolClient,
  encuId: number,
  preguntas: PreguntaInput[],
): Promise<void> {
  await client.query(`DELETE FROM public.encuesta_pregunta WHERE encu_id = $1`, [encuId]);

  let orden = 1;
  for (const p of preguntas) {
    await client.query(
      `INSERT INTO public.encuesta_pregunta
           (encu_id, encupreg_orden, encupreg_pregunta, encupreg_nota,
            encutiporesp_id, encupreg_escala_min, encupreg_escala_max)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        encuId,
        orden,
        p.encupreg_pregunta,
        p.encupreg_nota && p.encupreg_nota.length > 0 ? p.encupreg_nota : null,
        p.encutiporesp_id,
        p.encupreg_escala_min ?? null,
        p.encupreg_escala_max ?? null,
      ],
    );
    orden += 1;
  }
}

export interface ImpactoEncuesta {
  eliminables: Record<string, number>;
  bloqueos: Record<string, number>;
  puedeEliminar: boolean;
}

export async function calcularImpacto(encuId: number): Promise<ImpactoEncuesta> {
  const { rows } = await getPool().query<{
    preguntas: number;
    respondidas: number;
    respuestas: number;
  }>(
    `SELECT (SELECT count(*) FROM public.encuesta_pregunta WHERE encu_id = $1)::int AS preguntas,
            (SELECT count(*) FROM public.encuesta_respondida WHERE encu_id = $1)::int AS respondidas,
            (SELECT count(*) FROM public.encuesta_respuesta r
               JOIN public.encuesta_respondida ro ON ro.encurespo_id = r.encurespo_id
              WHERE ro.encu_id = $1)::int AS respuestas`,
    [encuId],
  );

  const r = rows[0]!;
  return {
    eliminables: {
      preguntas: r.preguntas,
      'representantes que la respondieron': r.respondidas,
      'respuestas registradas': r.respuestas,
    },
    bloqueos: {},
    puedeEliminar: true,
  };
}

export async function eliminarEncuesta(client: PoolClient, encuId: number): Promise<void> {
  await client.query(`DELETE FROM public.encuesta WHERE encu_id = $1`, [encuId]);
}

// ---------------------------------------------------------------------------
// Resultados

export interface ResultadoPregunta {
  encupreg_id: number;
  encupreg_orden: number;
  encupreg_pregunta: string;
  encutiporesp_id: number;
  encutiporesp_nombre: string;
  respuestas: number;
  /** Escala: media. Nulo en los demas tipos. */
  promedio: number | null;
  /** Escala y Si/No: cuantos de cada valor. */
  conteos: Array<{ etiqueta: string; valor: number }>;
  /** Texto, fecha y hora: lo respondido, sin decir por quien. */
  textos: string[];
}

/**
 * Los resultados, agregados en SQL y **anonimos**.
 *
 * El `::time` de la hora es por si la migracion 0012 todavia no se ha
 * aplicado: alli la columna pasa de `timetz` a `time`, y `to_char` no acepta
 * `timetz`. Despues del cambio es inocuo.
 *
 * Quien contesto una encuesta esta en `encuesta_respondida` —hace falta para
 * saber a quien le falta— pero los resultados no lo cruzan: se responde con
 * mas franqueza cuando la respuesta no lleva nombre, y quien lee un informe
 * agregado no necesita saberlo.
 */
export async function resultados(encuId: number): Promise<ResultadoPregunta[]> {
  const { rows } = await getPool().query<ResultadoPregunta>(
    `SELECT p.encupreg_id,
            p.encupreg_orden,
            p.encupreg_pregunta,
            p.encutiporesp_id,
            t.encutiporesp_nombre,
            COALESCE(a.respuestas, 0)::int AS respuestas,
            a.promedio,
            COALESCE(a.conteos, '[]'::json) AS conteos,
            COALESCE(a.textos, '[]'::json)  AS textos
       FROM public.encuesta_pregunta p
       JOIN public.encuesta_tipo_respuesta t ON t.encutiporesp_id = p.encutiporesp_id
       LEFT JOIN LATERAL (
           SELECT count(*) AS respuestas,
                  CASE WHEN p.encutiporesp_id = 3
                       THEN round(avg(r.encurespu_num), 2)::float8 END AS promedio,
                  CASE WHEN p.encutiporesp_id = 3 THEN (
                           SELECT json_agg(json_build_object('etiqueta', v.valor::text, 'valor', v.n)
                                           ORDER BY v.valor)
                           FROM (SELECT r2.encurespu_num AS valor, count(*)::int AS n
                                   FROM public.encuesta_respuesta r2
                                  WHERE r2.encupreg_id = p.encupreg_id
                                    AND r2.encurespu_num IS NOT NULL
                                  GROUP BY r2.encurespu_num) v)
                       WHEN p.encutiporesp_id = 6 THEN (
                           SELECT json_agg(json_build_object('etiqueta', v.etiqueta, 'valor', v.n))
                           FROM (SELECT CASE WHEN r2.encurespu_sino THEN 'Si' ELSE 'No' END AS etiqueta,
                                        count(*)::int AS n
                                   FROM public.encuesta_respuesta r2
                                  WHERE r2.encupreg_id = p.encupreg_id
                                    AND r2.encurespu_sino IS NOT NULL
                                  GROUP BY 1) v)
                  END AS conteos,
                  CASE WHEN p.encutiporesp_id IN (1, 2, 4, 5) THEN (
                           SELECT json_agg(x.texto)
                           FROM (SELECT COALESCE(
                                            r3.encurespu_texto,
                                            to_char(r3.encurespu_fecha, 'DD/MM/YYYY'),
                                            to_char(r3.encurespu_hora::time, 'HH24:MI')
                                        ) AS texto
                                   FROM public.encuesta_respuesta r3
                                  WHERE r3.encupreg_id = p.encupreg_id
                                  ORDER BY r3.encurespu_id
                                  LIMIT 200) x
                           WHERE x.texto IS NOT NULL)
                  END AS textos
             FROM public.encuesta_respuesta r
            WHERE r.encupreg_id = p.encupreg_id
       ) a ON TRUE
      WHERE p.encu_id = $1
      ORDER BY p.encupreg_orden`,
    [encuId],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// El lado del representante

export async function padreDe(usuId: number): Promise<number | null> {
  const { rows } = await getPool().query<{ padre_id: number }>(
    `SELECT padre_id FROM public.padre WHERE usu_id = $1`,
    [usuId],
  );
  return rows[0]?.padre_id ?? null;
}

export interface EncuestaParaResponder {
  encu_id: number;
  encu_titulo: string;
  encu_descripcion: string | null;
  preguntas: number;
  respondida: boolean;
  encurespo_fecha_registro: string | null;
}

/**
 * Las encuestas publicadas, con si este representante ya las respondio.
 *
 * Una sola consulta que sirve para las dos cosas: la lista de "tienes esto
 * pendiente" y el historial de lo ya contestado.
 */
export async function misEncuestas(padreId: number): Promise<EncuestaParaResponder[]> {
  const { rows } = await getPool().query<EncuestaParaResponder>(
    `SELECT e.encu_id,
            e.encu_titulo,
            e.encu_descripcion,
            (SELECT count(*) FROM public.encuesta_pregunta p WHERE p.encu_id = e.encu_id)::int AS preguntas,
            (r.encurespo_id IS NOT NULL) AS respondida,
            r.encurespo_fecha_registro
       FROM public.encuesta e
       LEFT JOIN public.encuesta_respondida r
              ON r.encu_id = e.encu_id AND r.padre_id = $1
      WHERE e.est_id = ${ESTADO.PUBLICADO}
      ORDER BY (r.encurespo_id IS NOT NULL), e.encu_fecha_creacion DESC`,
    [padreId],
  );
  return rows;
}

export async function yaRespondio(encuId: number, padreId: number): Promise<boolean> {
  const { rows } = await getPool().query(
    `SELECT 1 FROM public.encuesta_respondida WHERE encu_id = $1 AND padre_id = $2`,
    [encuId, padreId],
  );
  return rows.length > 0;
}

export async function insertarRespondida(
  client: PoolClient,
  encuId: number,
  padreId: number,
): Promise<number> {
  const { rows } = await client.query<{ encurespo_id: number }>(
    `INSERT INTO public.encuesta_respondida (encu_id, padre_id)
     VALUES ($1, $2)
     RETURNING encurespo_id`,
    [encuId, padreId],
  );
  return rows[0]!.encurespo_id;
}

export interface RespuestaAGuardar {
  encupreg_id: number;
  texto: string | null;
  numero: number | null;
  fecha: string | null;
  hora: string | null;
  sino: boolean | null;
}

export async function insertarRespuesta(
  client: PoolClient,
  encurespoId: number,
  r: RespuestaAGuardar,
): Promise<void> {
  await client.query(
    `INSERT INTO public.encuesta_respuesta
         (encurespo_id, encupreg_id, encurespu_texto, encurespu_num, encurespu_fecha,
          encurespu_hora, encurespu_sino)
     VALUES ($1, $2, $3, $4, $5::date, $6::time, $7)`,
    [encurespoId, r.encupreg_id, r.texto, r.numero, r.fecha, r.hora, r.sino],
  );
}

/** ¿Este usuario tiene el rol de representante? */
export async function esRepresentante(usuId: number): Promise<boolean> {
  const { rows } = await getPool().query(
    `SELECT 1 FROM public.usuario_rol WHERE usu_id = $1 AND rol_id = ${ROL.REPRESENTANTE}`,
    [usuId],
  );
  return rows.length > 0;
}
