import { alcanceDe } from '../../lib/alcance.js';
import { ROL, ROLES_AUXILIARES, ROLES_GLOBALES } from '../../lib/constants.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import * as repo from './tablero.repository.js';
import { TABLERO, type TableroId, type TableroQuery } from './tablero.schemas.js';

/**
 * Tablero.
 *
 * ---------------------------------------------------------------------------
 * Varios roles, varios tableros
 *
 * El sistema viejo elegía el tablero con una cadena de `if` sobre los roles y
 * **se quedaba con el primero que encajara**: quien coordina un colegio y
 * además entrena veía el tablero de coordinador y perdía de vista sus propias
 * disciplinas, sin ninguna forma de llegar a ellas.
 *
 * El cliente marcó eso como un error (decisión D2 del mapa de módulos). Aquí
 * se devuelve **la lista de tableros a los que la persona tiene derecho** y se
 * puede pedir cualquiera de ellos; el de mayor alcance viene marcado como el
 * de por defecto.
 *
 * ---------------------------------------------------------------------------
 * El tablero de reserva, fuera
 *
 * El viejo tenía un cuarto camino para "otros roles" con **cifras escritas a
 * mano** —"12 colegios", "328 usuarios", "46 actividades"— que no salían de
 * ninguna consulta. Quien no tenga ningún tablero propio recibe una lista
 * vacía y la pantalla lo dice.
 */

export interface OpcionTablero {
  id: TableroId;
  titulo: string;
}

const TITULOS: Record<TableroId, string> = {
  [TABLERO.GENERAL]: 'General',
  [TABLERO.COORDINADOR]: 'Mis colegios',
  [TABLERO.ENTRENADOR]: 'Mis disciplinas',
  [TABLERO.REPRESENTANTE]: 'Mis representados',
};

/**
 * Qué tableros puede ver esta persona, del de más alcance al de menos.
 *
 * El orden importa: el primero es el que se abre por defecto, y es el que más
 * cosas enseña. Un coordinador que además entrena aterriza en el de colegios,
 * pero la pestaña de sus disciplinas está ahí.
 */
export function tablerosDe(actor: AuthUser): OpcionTablero[] {
  const roles = actor.usuario.roles.map((r) => r.rol_id);
  const tiene = (rolId: number) => roles.includes(rolId);

  const ids: TableroId[] = [];
  if (roles.some((r) => ROLES_GLOBALES.includes(r))) ids.push(TABLERO.GENERAL);
  if (tiene(ROL.COORDINADOR)) ids.push(TABLERO.COORDINADOR);
  if (tiene(ROL.ENTRENADOR) || ROLES_AUXILIARES.some(tiene)) ids.push(TABLERO.ENTRENADOR);
  if (tiene(ROL.REPRESENTANTE)) ids.push(TABLERO.REPRESENTANTE);

  return ids.map((id) => ({ id, titulo: TITULOS[id] }));
}

export interface Periodo {
  desde: string;
  hasta: string;
}

/**
 * El periodo por defecto: los últimos 30 días, contados en Ecuador.
 *
 * Con `new Date()` en el navegador, un teléfono mal puesto en horario abría un
 * tablero de otro día. La fecha la pone el servidor.
 */
async function periodoDe(query: TableroQuery): Promise<Periodo> {
  const hoy = await repo.hoyEnEcuador();

  const hasta = query.hasta ?? hoy;
  if (query.desde) return { desde: query.desde, hasta };

  const inicio = new Date(`${hasta}T00:00:00Z`);
  inicio.setUTCDate(inicio.getUTCDate() - 29);
  return { desde: inicio.toISOString().slice(0, 10), hasta };
}

export interface RespuestaTablero {
  /** Todos los que puede ver, para pintar las pestañas. */
  disponibles: OpcionTablero[];
  /** El que se devuelve en `datos`. */
  actual: TableroId | null;
  periodo: Periodo;
  /**
   * El % de presentes por fecha del periodo. Va aparte de `datos` porque lo
   * comparten tres de los cuatro tableros y es lo único que dibuja una gráfica.
   */
  tendencia: repo.PuntoTendencia[];
  /** Los inventarios son de hoy; solo la asistencia depende del periodo. */
  datos:
    | repo.TableroGeneral
    | repo.TableroCoordinador
    | repo.TableroEntrenador
    | repo.TableroRepresentante
    | null;
}

export async function tablero(actor: AuthUser, query: TableroQuery): Promise<RespuestaTablero> {
  const disponibles = tablerosDe(actor);
  const periodo = await periodoDe(query);

  if (disponibles.length === 0) {
    return { disponibles, actual: null, periodo, tendencia: [], datos: null };
  }

  const pedido = query.rol ?? disponibles[0]!.id;
  if (!disponibles.some((d) => d.id === pedido)) {
    throw new ApiError(403, 'No tienes ese tablero: tu rol no lo incluye');
  }

  const alcance = await alcanceDe(actor.usuario);
  const usuId = actor.usuario.usu_id;

  /**
   * El representante no la lleva: su panel enseña la asistencia de cada hijo
   * por separado, y una media de dos niños no dice nada.
   */
  const tendencia =
    pedido === TABLERO.REPRESENTANTE
      ? []
      : await repo.tendenciaAsistencia(
          periodo.desde,
          periodo.hasta,
          alcance.global,
          alcance.colegios,
          alcance.disciplinas,
        );

  switch (pedido) {
    case TABLERO.GENERAL:
      return {
        disponibles,
        actual: pedido,
        periodo,
        tendencia,
        datos: await repo.tableroGeneral(periodo.desde, periodo.hasta),
      };

    case TABLERO.COORDINADOR:
      return {
        disponibles,
        actual: pedido,
        periodo,
        tendencia,
        datos: await repo.tableroCoordinador(
          periodo.desde,
          periodo.hasta,
          alcance.colegios,
          alcance.disciplinas,
        ),
      };

    case TABLERO.ENTRENADOR: {
      /**
       * El alcance de un auxiliar son las disciplinas de su titular, pero su
       * propia asistencia está en `asistencia_auxiliar`. Sin distinguirlo, un
       * asistente veía la asistencia del entrenador como si fuera la suya.
       */
      const esAuxiliar =
        !actor.usuario.roles.some((r) => r.rol_id === ROL.ENTRENADOR) &&
        actor.usuario.roles.some((r) => ROLES_AUXILIARES.includes(r.rol_id));

      return {
        disponibles,
        actual: pedido,
        periodo,
        tendencia,
        datos: await repo.tableroEntrenador(
          periodo.desde,
          periodo.hasta,
          alcance.disciplinas,
          usuId,
          esAuxiliar,
        ),
      };
    }

    case TABLERO.REPRESENTANTE:
      return {
        disponibles,
        actual: pedido,
        periodo,
        tendencia,
        datos: await repo.tableroRepresentante(periodo.desde, periodo.hasta, usuId),
      };

    default:
      throw new ApiError(400, 'Tablero desconocido');
  }
}
