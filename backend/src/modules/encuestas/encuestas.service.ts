import { auditar } from '../../lib/auditoria.js';
import { ESTADO } from '../../lib/constants.js';
import { enTransaccion } from '../../lib/tx.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import * as repo from './encuestas.repository.js';
import {
  TIPO,
  type PreguntaInput,
  type ResponderInput,
  type actualizarEncuestaSchema,
  type crearEncuestaSchema,
  type listarEncuestasSchema,
} from './encuestas.schemas.js';
import type { z } from 'zod';

/**
 * Encuestas.
 *
 * ---------------------------------------------------------------------------
 * El modulo se estrena vacio
 *
 * **0 filas en produccion**, comprobado en los tres respaldos y por MCP en las
 * dos bases nuevas. El codigo existia, los datos no. Eso permitio arreglar el
 * esquema entero en la migracion 0012 sin coste de migracion, y permite
 * escribir aqui las reglas como deben ser en vez de respetar una deriva.
 *
 * ---------------------------------------------------------------------------
 * Los tres estados, y por que importan
 *
 *   Borrador (3)   se edita. Es el unico estado donde se tocan las preguntas.
 *   Finalizado (4) no se edita. Todavia no la ve nadie.
 *   Publicado (5)  se responde. Ya no se toca nunca.
 *
 * Que una encuesta publicada sea inmutable no es rigidez: si se le cambia una
 * pregunta a mitad de camino, las respuestas de antes y las de despues
 * contestan a cosas distintas y el resultado no significa nada.
 *
 * ---------------------------------------------------------------------------
 * Quien responde
 *
 * Los endpoints de responder **no piden `encuestas:ver`**: el Representante no
 * lo tiene, y es justo quien tiene que contestar. La puerta ahi es tener el rol
 * 4 y su ficha de `padre`. El permiso del modulo protege la gestion, no la
 * respuesta.
 */

export async function tipos() {
  return repo.listarTipos();
}

export async function listar(actor: AuthUser, query: z.infer<typeof listarEncuestasSchema>) {
  void actor;
  return repo.listarEncuestas(
    query.buscar && query.buscar.length > 0 ? query.buscar : null,
    query.estado ?? null,
  );
}

export interface FichaEncuesta {
  encuesta: repo.EncuestaListada;
  preguntas: repo.PreguntaDetalle[];
}

async function exigirEncuesta(encuId: number): Promise<repo.EncuestaListada> {
  const encuesta = await repo.obtenerEncuesta(encuId);
  if (!encuesta) throw new ApiError(404, 'Esa encuesta no existe');
  return encuesta;
}

export async function ficha(encuId: number): Promise<FichaEncuesta> {
  const encuesta = await exigirEncuesta(encuId);
  return { encuesta, preguntas: await repo.listarPreguntas(encuId) };
}

/** Editar solo en borrador. Es la regla 1 y se comprueba en un solo sitio. */
function exigirBorrador(encuesta: repo.EncuestaListada): void {
  if (encuesta.est_id !== ESTADO.BORRADOR) {
    throw new ApiError(
      409,
      encuesta.est_id === ESTADO.PUBLICADO
        ? 'Esa encuesta ya esta publicada: cambiarla ahora mezclaria respuestas a preguntas distintas'
        : 'Esa encuesta esta finalizada. Vuelvela a borrador para editarla',
    );
  }
}

const vacioANulo = (v: string | undefined | null): string | null => {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
};

export async function crear(
  actor: AuthUser,
  input: z.infer<typeof crearEncuestaSchema>,
): Promise<FichaEncuesta> {
  const encuId = await enTransaccion(async (client) => {
    const nuevoId = await repo.insertarEncuesta(
      client,
      input.encu_titulo,
      vacioANulo(input.encu_descripcion),
      actor.usuario.usu_id,
    );

    if (input.preguntas && input.preguntas.length > 0) {
      await repo.reemplazarPreguntas(client, nuevoId, input.preguntas);
    }

    await auditar(
      {
        actor,
        accion: 'crear',
        entidad: 'encuesta',
        entidadId: nuevoId,
        detalle: { titulo: input.encu_titulo, preguntas: input.preguntas?.length ?? 0 },
      },
      client,
    );

    return nuevoId;
  });

  return ficha(encuId);
}

export async function actualizar(
  actor: AuthUser,
  encuId: number,
  input: z.infer<typeof actualizarEncuestaSchema>,
): Promise<FichaEncuesta> {
  exigirBorrador(await exigirEncuesta(encuId));

  await enTransaccion(async (client) => {
    await repo.actualizarEncuesta(
      client,
      encuId,
      input.encu_titulo,
      vacioANulo(input.encu_descripcion),
      input.encu_descripcion !== undefined,
    );
  });

  return ficha(encuId);
}

export async function guardarPreguntas(
  actor: AuthUser,
  encuId: number,
  preguntas: PreguntaInput[],
): Promise<FichaEncuesta> {
  exigirBorrador(await exigirEncuesta(encuId));

  await enTransaccion(async (client) => {
    await repo.reemplazarPreguntas(client, encuId, preguntas);
    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'encuesta',
        entidadId: encuId,
        detalle: { preguntas: preguntas.length },
      },
      client,
    );
  });

  return ficha(encuId);
}

/**
 * Borrador -> Finalizado.
 *
 * Una encuesta sin preguntas no se puede finalizar: publicarla seria mandar a
 * los representantes un formulario vacio.
 */
export async function finalizar(actor: AuthUser, encuId: number): Promise<FichaEncuesta> {
  const encuesta = await exigirEncuesta(encuId);
  exigirBorrador(encuesta);

  if (encuesta.preguntas === 0) {
    throw new ApiError(409, 'Esa encuesta no tiene preguntas todavia');
  }

  await enTransaccion(async (client) => {
    await repo.cambiarEstado(client, encuId, ESTADO.FINALIZADO);
    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'encuesta',
        entidadId: encuId,
        detalle: { titulo: encuesta.encu_titulo, estado: 'finalizada' },
      },
      client,
    );
  });

  return ficha(encuId);
}

/**
 * Finalizado -> Borrador.
 *
 * Solo mientras nadie haya respondido. En cuanto hay una respuesta, volver
 * atras destruiria el sentido de lo ya contestado.
 */
export async function volverABorrador(actor: AuthUser, encuId: number): Promise<FichaEncuesta> {
  const encuesta = await exigirEncuesta(encuId);

  if (encuesta.est_id !== ESTADO.FINALIZADO) {
    throw new ApiError(409, 'Solo una encuesta finalizada puede volver a borrador');
  }
  if (encuesta.respondidas > 0) {
    throw new ApiError(
      409,
      `Ya la respondieron ${encuesta.respondidas} representante(s): no se puede volver a editar`,
    );
  }

  await enTransaccion(async (client) => {
    await repo.cambiarEstado(client, encuId, ESTADO.BORRADOR);
    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'encuesta',
        entidadId: encuId,
        detalle: { titulo: encuesta.encu_titulo, estado: 'de vuelta a borrador' },
      },
      client,
    );
  });

  return ficha(encuId);
}

/**
 * Finalizado -> Publicado. A partir de aqui la ven los representantes.
 *
 * **No avisa a nadie.** El sistema viejo tampoco lo hacia y mandar correo es
 * una decision del cliente con infraestructura detras; esta anotado en el
 * documento de la fase. Hoy la encuesta le aparece al representante la proxima
 * vez que entra.
 */
export async function publicar(actor: AuthUser, encuId: number): Promise<FichaEncuesta> {
  const encuesta = await exigirEncuesta(encuId);

  if (encuesta.est_id !== ESTADO.FINALIZADO) {
    throw new ApiError(
      409,
      encuesta.est_id === ESTADO.PUBLICADO
        ? 'Esa encuesta ya esta publicada'
        : 'Finalizala antes de publicarla',
    );
  }

  await enTransaccion(async (client) => {
    await repo.cambiarEstado(client, encuId, ESTADO.PUBLICADO);
    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'encuesta',
        entidadId: encuId,
        detalle: { titulo: encuesta.encu_titulo, estado: 'publicada' },
      },
      client,
    );
  });

  return ficha(encuId);
}

export async function impacto(encuId: number): Promise<repo.ImpactoEncuesta> {
  await exigirEncuesta(encuId);
  return repo.calcularImpacto(encuId);
}

export async function eliminar(
  actor: AuthUser,
  encuId: number,
  confirmacion: string,
): Promise<repo.ImpactoEncuesta> {
  const encuesta = await exigirEncuesta(encuId);

  if (confirmacion.trim().toLowerCase() !== encuesta.encu_titulo.trim().toLowerCase()) {
    throw new ApiError(400, 'El titulo escrito no coincide con el de la encuesta');
  }

  const impactoPrevio = await repo.calcularImpacto(encuId);

  await enTransaccion(async (client) => {
    await auditar(
      {
        actor,
        accion: 'eliminar',
        entidad: 'encuesta',
        entidadId: encuId,
        detalle: { titulo: encuesta.encu_titulo, destruido: impactoPrevio.eliminables },
      },
      client,
    );
    await repo.eliminarEncuesta(client, encuId);
  });

  return impactoPrevio;
}

export interface Resultados {
  encuesta: repo.EncuestaListada;
  preguntas: repo.ResultadoPregunta[];
}

export async function resultados(encuId: number): Promise<Resultados> {
  const encuesta = await exigirEncuesta(encuId);
  return { encuesta, preguntas: await repo.resultados(encuId) };
}

// ---------------------------------------------------------------------------
// El lado del representante

/**
 * La ficha de `padre` de quien pregunta, o un 403 con el motivo.
 *
 * Que alguien tenga el rol 4 pero no ficha no deberia pasar —Usuarios la crea
 * al conceder el rol— pero si pasa, decirlo es mejor que devolver una lista
 * vacia: sin ficha no se puede registrar ninguna respuesta.
 */
async function exigirPadre(actor: AuthUser): Promise<number> {
  const padreId = await repo.padreDe(actor.usuario.usu_id);
  if (padreId !== null) return padreId;

  const tieneRol = await repo.esRepresentante(actor.usuario.usu_id);
  throw new ApiError(
    403,
    tieneRol
      ? 'Tu usuario tiene el rol de Representante pero le falta la ficha. Avisa a coordinacion'
      : 'Las encuestas las responden los representantes',
  );
}

export async function mias(actor: AuthUser): Promise<repo.EncuestaParaResponder[]> {
  return repo.misEncuestas(await exigirPadre(actor));
}

export interface EncuestaParaContestar {
  encuesta: repo.EncuestaListada;
  preguntas: repo.PreguntaDetalle[];
  yaRespondida: boolean;
}

export async function paraResponder(
  actor: AuthUser,
  encuId: number,
): Promise<EncuestaParaContestar> {
  const padreId = await exigirPadre(actor);
  const encuesta = await exigirEncuesta(encuId);

  if (encuesta.est_id !== ESTADO.PUBLICADO) {
    throw new ApiError(404, 'Esa encuesta no esta publicada');
  }

  return {
    encuesta,
    preguntas: await repo.listarPreguntas(encuId),
    yaRespondida: await repo.yaRespondio(encuId, padreId),
  };
}

/**
 * Registra las respuestas de un representante.
 *
 * Tres puertas antes de escribir nada:
 *
 * 1. La encuesta esta publicada.
 * 2. No la ha respondido ya. El indice unico de la migracion 0012 lo garantiza
 *    tambien en la base, por si dos pestanas mandan a la vez.
 * 3. **Cada respuesta cuadra con el tipo de su pregunta**, y estan todas. Una
 *    encuesta a medias no es una respuesta: el resultado de una pregunta
 *    saldria calculado sobre menos gente que el de la de al lado, sin que nada
 *    lo indique.
 */
export async function responder(
  actor: AuthUser,
  encuId: number,
  input: ResponderInput,
): Promise<{ registradas: number }> {
  const padreId = await exigirPadre(actor);
  const encuesta = await exigirEncuesta(encuId);

  if (encuesta.est_id !== ESTADO.PUBLICADO) {
    throw new ApiError(409, 'Esa encuesta no esta publicada');
  }
  if (await repo.yaRespondio(encuId, padreId)) {
    throw new ApiError(409, 'Ya respondiste esta encuesta');
  }

  const preguntas = await repo.listarPreguntas(encuId);
  const porId = new Map(preguntas.map((p) => [p.encupreg_id, p]));

  if (input.respuestas.length !== preguntas.length) {
    throw new ApiError(
      400,
      `Faltan respuestas: la encuesta tiene ${preguntas.length} pregunta(s) y llegaron ${input.respuestas.length}`,
    );
  }

  // Se valida todo antes de tocar la base: o entra entera o no entra.
  const aGuardar: repo.RespuestaAGuardar[] = input.respuestas.map((r) => {
    const pregunta = porId.get(r.encupreg_id);
    if (!pregunta) {
      throw new ApiError(400, `La pregunta ${r.encupreg_id} no es de esta encuesta`);
    }

    const vacia: repo.RespuestaAGuardar = {
      encupreg_id: r.encupreg_id,
      texto: null,
      numero: null,
      fecha: null,
      hora: null,
      sino: null,
    };

    const falta = (que: string): never => {
      throw new ApiError(400, `"${pregunta.encupreg_pregunta}" espera ${que}`);
    };

    switch (pregunta.encutiporesp_id) {
      case TIPO.TEXTO_CORTO:
      case TIPO.TEXTO_LARGO: {
        const texto = r.texto?.trim();
        if (!texto) return falta('una respuesta escrita');
        return { ...vacia, texto };
      }
      case TIPO.ESCALA: {
        if (r.numero === null || r.numero === undefined) return falta('un valor de la escala');
        const min = pregunta.encupreg_escala_min ?? 0;
        const max = pregunta.encupreg_escala_max ?? 10;
        if (r.numero < min || r.numero > max) {
          throw new ApiError(
            400,
            `"${pregunta.encupreg_pregunta}" admite de ${min} a ${max}`,
          );
        }
        return { ...vacia, numero: r.numero };
      }
      case TIPO.FECHA:
        if (!r.fecha) return falta('una fecha');
        return { ...vacia, fecha: r.fecha };
      case TIPO.HORA:
        if (!r.hora) return falta('una hora');
        return { ...vacia, hora: `${r.hora}:00` };
      case TIPO.SI_NO:
        if (r.sino === null || r.sino === undefined) return falta('un si o un no');
        return { ...vacia, sino: r.sino };
      default:
        throw new ApiError(409, `Tipo de respuesta desconocido: ${pregunta.encutiporesp_id}`);
    }
  });

  await enTransaccion(async (client) => {
    const encurespoId = await repo.insertarRespondida(client, encuId, padreId);
    for (const respuesta of aGuardar) {
      await repo.insertarRespuesta(client, encurespoId, respuesta);
    }
  });

  return { registradas: aGuardar.length };
}
