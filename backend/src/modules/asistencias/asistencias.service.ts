import { alcanceDe, alcanzaColegio, alcanzaDisciplina } from '../../lib/alcance.js';
import { auditar } from '../../lib/auditoria.js';
import { ESTADO } from '../../lib/constants.js';
import { firmarFotos } from '../../lib/storage.js';
import { hoyEc } from '../../lib/fecha.js';
import { enTransaccion } from '../../lib/tx.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import * as repo from './asistencias.repository.js';
import { enviarAvisos, registrarAvisos } from '../novedades/novedades.ausencias.js';
import {
  type GuardarAlumnosInput,
  type GuardarEntrenadoresInput,
  type ListaAlumnosQuery,
  type ListaEntrenadoresQuery,
} from './asistencias.schemas.js';

/**
 * Asistencias.
 *
 * El registro diario: 13 202 marcas de alumnos, 1 726 de entrenadores y 283 de
 * auxiliares. Es lo que mas se usa del sistema y lo que alimenta todos los
 * informes.
 *
 * Las cuatro cosas que aqui cambian respecto al sistema viejo:
 *
 * 1. **Se guarda por lote, en una transaccion.** Antes cada fila era un upsert
 *    suelto desde el navegador, encolado por un `useRequestQueue` escrito a
 *    mano: con la pantalla a medio guardar y la conexion cayendose en una
 *    cancha, la sesion quedaba partida. Ahora entran las 42 marcas o no entra
 *    ninguna.
 * 2. **El alcance se decide aqui.** El entrenador solo puede pasar lista de
 *    sus propias disciplinas; antes bastaba con conocer el id de otra.
 * 3. **La fecha tiene que caer en el dia de la disciplina**, y el dia lo
 *    calcula Postgres (ver el comentario del repositorio: el domingo estaba
 *    roto en el navegador).
 * 4. **La hora la pone el servidor.** `asis*_fecha_registrado` es `now()` de la
 *    base, y la hora de llegada que el front propone al marcar Tarde sale de
 *    `/asistencias/contexto`, no del reloj del telefono.
 */

// ---------------------------------------------------------------------------
// Catalogos y reloj

export async function estados(): Promise<repo.EstadoAsistencia[]> {
  return repo.listarEstados();
}

export interface Contexto {
  /** Hoy en Ecuador, AAAA-MM-DD. */
  hoy: string;
  /** La hora de Ecuador, HH:MM. Es la que se propone al marcar Tarde. */
  hora: string;
}

export async function contexto(): Promise<Contexto> {
  const [hoy, hora] = await Promise.all([repo.hoyEnEcuador(), repo.horaDeEcuador()]);
  return { hoy, hora };
}

// ---------------------------------------------------------------------------
// Puertas

/**
 * La sesion existe, esta dentro del alcance de quien pregunta y la fecha cae
 * en su dia de la semana.
 *
 * El dia se compara contra `EXTRACT(ISODOW)`, que la base ya devolvio al
 * construir la lista; aqui se recalcula con `Date` **en UTC** a proposito:
 * `new Date('2026-07-16')` se interpreta como medianoche UTC, asi que
 * `getUTCDay()` no depende de la zona del servidor de Railway. El mapeo
 * 0=Domingo de JavaScript se traduce a 7, que es el `dia_id` de Domingo.
 */
function diaIsoDe(fecha: string): number {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return dia === 0 ? 7 : dia;
}

async function exigirSesion(
  actor: AuthUser,
  colacthorId: number,
  fecha: string,
): Promise<repo.Sesion> {
  const sesion = await repo.obtenerSesion(colacthorId);
  if (!sesion) throw new ApiError(404, 'Esa disciplina no existe');

  const alcance = await alcanceDe(actor.usuario);
  if (!alcanzaDisciplina(alcance, colacthorId)) {
    throw new ApiError(403, 'Esa disciplina esta fuera de tu alcance');
  }

  // Una disciplina tiene varios dias: la fecha tiene que caer en uno de ellos.
  const dia = diaIsoDe(fecha);
  if (!sesion.horarios.some((h) => h.dia_id === dia)) {
    const dias = sesion.horarios.map((h) => h.dia_nombre.toLowerCase());
    const lista = dias.length > 1 ? `${dias.slice(0, -1).join(', ')} y ${dias.at(-1)}` : (dias[0] ?? 'ningún día');
    throw new ApiError(400, `La disciplina es de los ${lista} y ${fecha} no cae en ninguno`);
  }

  return sesion;
}

/**
 * No se pasa lista de una clase que aún no ha ocurrido (decidido por el
 * cliente el 2026-10-12). La pantalla ya no deja elegirla; esto lo cierra en
 * el servidor. "Hoy" es el de Ecuador: a las 20:00 de Guayaquil UTC ya es
 * mañana, y esa fecha sigue siendo futura.
 */
function exigirNoFutura(fecha: string): void {
  if (fecha > hoyEc()) throw new ApiError(400, 'No se puede pasar lista de una fecha futura');
}

async function exigirColegio(actor: AuthUser, colId: number): Promise<repo.ColegioBasico> {
  const colegio = await repo.obtenerColegio(colId);
  if (!colegio) throw new ApiError(404, 'Ese colegio no existe');

  const alcance = await alcanceDe(actor.usuario);
  if (!alcanzaColegio(alcance, colId)) {
    throw new ApiError(403, 'Ese colegio esta fuera de tu alcance');
  }

  return colegio;
}

// ---------------------------------------------------------------------------
// Alumnos

export type AlumnoConFoto = repo.AlumnoDeSesion & { nino_foto_url: string | null };

export interface ListaAlumnos {
  sesion: repo.Sesion;
  fecha: string;
  alumnos: AlumnoConFoto[];
  /** Hora de Ecuador al abrir la pantalla, para proponerla al marcar Tarde. */
  hora_servidor: string;
}

async function conFotos(alumnos: repo.AlumnoDeSesion[]): Promise<AlumnoConFoto[]> {
  const firmadas = await firmarFotos(alumnos.map((a) => a.nino_foto));
  return alumnos.map((a) => ({
    ...a,
    nino_foto_url: a.nino_foto ? (firmadas.get(a.nino_foto) ?? a.nino_foto) : null,
  }));
}

export async function listaAlumnos(
  actor: AuthUser,
  query: ListaAlumnosQuery,
): Promise<ListaAlumnos> {
  const sesion = await exigirSesion(actor, query.disciplina, query.fecha);

  const [alumnos, hora] = await Promise.all([
    repo.listarAlumnosDeSesion(query.disciplina, query.fecha),
    repo.horaDeEcuador(),
  ]);

  return {
    sesion,
    fecha: query.fecha,
    alumnos: await conFotos(alumnos),
    hora_servidor: hora,
  };
}

export interface ResultadoGuardado {
  altas: number;
  cambios: number;
  /** Ausencias y correcciones avisadas en este guardado (solo alumnos). */
  avisos?: number;
}

/**
 * Guardado por lote de la asistencia de una sesion.
 *
 * Solo se admiten alumnos que la propia lista de esa fecha devuelve: los
 * inscritos entonces mas los que ya tenian marca. Mandar el id de un alumno
 * que no toca es un 400, no un insert silencioso — y esa es la puerta que
 * impide pasar lista de nadie por fuera de la pantalla.
 *
 * La disciplina dada de baja no se puede seguir marcando: si la clase ya no
 * existe, su historial se consulta pero no crece.
 */
export async function guardarAlumnos(
  actor: AuthUser,
  input: GuardarAlumnosInput,
): Promise<ListaAlumnos & { resultado: ResultadoGuardado }> {
  exigirNoFutura(input.fecha);
  const sesion = await exigirSesion(actor, input.colacthor_id, input.fecha);

  if (sesion.est_id !== ESTADO.ACTIVO) {
    throw new ApiError(409, 'Esa disciplina esta dada de baja: su asistencia ya no se modifica');
  }

  const resultado = await enTransaccion(async (client) => {
    const marcables = new Set(
      await repo.ninosMarcablesEn(client, input.colacthor_id, input.fecha),
    );

    const intrusos = input.marcas.filter((m) => !marcables.has(m.nino_id));
    if (intrusos.length > 0) {
      throw new ApiError(
        400,
        `${intrusos.length} alumno(s) del lote no estaban inscritos en esa disciplina el ${input.fecha}`,
      );
    }

    let altas = 0;
    let cambios = 0;
    for (const marca of input.marcas) {
      const efecto = await repo.guardarMarcaAlumno(
        client,
        input.colacthor_id,
        input.fecha,
        marca,
        actor.usuario.usu_id,
      );
      if (efecto === 'alta') altas += 1;
      else cambios += 1;
    }

    /**
     * Se audita solo la correccion, no el pase de lista.
     *
     * Marcar por primera vez es el trabajo diario y llenaria `auditoria` con
     * una fila por clase y dia. **Reescribir una marca que ya existia** si es
     * sensible: cambia un historial que despues sale en los informes, y la
     * fila deja dicho quien lo hizo.
     */
    if (cambios > 0) {
      await auditar(
        {
          actor,
          accion: 'editar',
          entidad: 'asistencia_alumnos',
          entidadId: input.colacthor_id,
          detalle: {
            fecha: input.fecha,
            colegio: sesion.col_nombre,
            actividad: sesion.act_nombre,
            altas,
            cambios,
          },
        },
        client,
      );
    }

    /**
     * Punto 9: ausencias y correcciones. En la misma transacción, para que
     * no quede una novedad de una lista que no se guardó; el correo, después.
     */
    const avisos = await registrarAvisos(client, {
      clase: sesion,
      fecha: input.fecha,
      marcas: input.marcas,
      autorId: actor.usuario.usu_id,
    });

    return { altas, cambios, avisos };
  });

  void enviarAvisos(resultado.avisos);

  return {
    ...(await listaAlumnos(actor, { disciplina: input.colacthor_id, fecha: input.fecha })),
    resultado: { altas: resultado.altas, cambios: resultado.cambios, avisos: resultado.avisos.length },
  };
}

// ---------------------------------------------------------------------------
// Entrenadores y auxiliares

export type PersonaConFoto = repo.PersonaDeColegio & { usu_foto_url: string | null };

export interface ListaEntrenadores {
  colegio: repo.ColegioBasico;
  fecha: string;
  dia_id: number;
  personas: PersonaConFoto[];
  hora_servidor: string;
}

export async function listaEntrenadores(
  actor: AuthUser,
  query: ListaEntrenadoresQuery,
): Promise<ListaEntrenadores> {
  const colegio = await exigirColegio(actor, query.colegio);

  const [personas, hora] = await Promise.all([
    repo.listarPersonalDeColegio(query.colegio, query.fecha),
    repo.horaDeEcuador(),
  ]);

  const firmadas = await firmarFotos(personas.map((p) => p.usu_foto));

  return {
    colegio,
    fecha: query.fecha,
    dia_id: diaIsoDe(query.fecha),
    personas: personas.map((p) => ({
      ...p,
      usu_foto_url: p.usu_foto ? (firmadas.get(p.usu_foto) ?? p.usu_foto) : null,
    })),
    hora_servidor: hora,
  };
}

/**
 * Lote de entrenadores y auxiliares.
 *
 * Los dos tipos viajan juntos porque se marcan en el mismo gesto, pero cada
 * uno acaba en su tabla: `asistencia_entrenador` va por `ent_id` y
 * `asistencia_auxiliar` por `usu_id`. Un mismo numero puede significar las dos
 * cosas, de ahi que la clave de control sea 'tipo:id'.
 */
export async function guardarEntrenadores(
  actor: AuthUser,
  input: GuardarEntrenadoresInput,
): Promise<ListaEntrenadores & { resultado: ResultadoGuardado }> {
  exigirNoFutura(input.fecha);
  const colegio = await exigirColegio(actor, input.col_id);

  const resultado = await enTransaccion(async (client) => {
    const marcables = new Set(await repo.personalMarcableEn(client, input.col_id, input.fecha));

    const intrusos = input.marcas.filter((m) => !marcables.has(`${m.tipo}:${m.id}`));
    if (intrusos.length > 0) {
      throw new ApiError(
        400,
        `${intrusos.length} persona(s) del lote no daban clase en ese colegio el ${input.fecha}`,
      );
    }

    let altas = 0;
    let cambios = 0;
    for (const marca of input.marcas) {
      const guardar =
        marca.tipo === 'entrenador' ? repo.guardarMarcaEntrenador : repo.guardarMarcaAuxiliar;
      const efecto = await guardar(client, input.col_id, input.fecha, marca, actor.usuario.usu_id);
      if (efecto === 'alta') altas += 1;
      else cambios += 1;
    }

    if (cambios > 0) {
      await auditar(
        {
          actor,
          accion: 'editar',
          entidad: 'asistencia_entrenadores',
          entidadId: input.col_id,
          detalle: { fecha: input.fecha, colegio: colegio.col_nombre, altas, cambios },
        },
        client,
      );
    }

    return { altas, cambios };
  });

  return {
    ...(await listaEntrenadores(actor, { colegio: input.col_id, fecha: input.fecha })),
    resultado,
  };
}
