import { z } from 'zod';
import { alcanceDe } from '../../lib/alcance.js';
import { auditar } from '../../lib/auditoria.js';
import { firmarFoto, firmarFotos } from '../../lib/storage.js';
import { enTransaccion } from '../../lib/tx.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import * as repo from './representantes.repository.js';

/**
 * Representantes.
 *
 * El módulo que **no existía**. Los representantes se ataban desde la ficha de
 * cada alumno, uno a uno, y no había ninguna pantalla donde ver quiénes son,
 * cuántos hijos tiene cada uno ni si han respondido las encuestas. Sin eso, el
 * módulo de Encuestas no tiene a quién preguntar.
 *
 * Aquí **no se dan de alta personas**: un representante es un usuario con el
 * rol 4, y su ficha de `padre` la crea Usuarios al concederle el rol. Esta
 * pantalla ve y ata; no duplica el alta.
 *
 * Hoy en producción hay **cero**. El módulo se estrena vacío, igual que
 * Encuestas.
 */

export const listarSchema = z.object({
  buscar: z.string().trim().max(160).optional(),
  estado: z.coerce.number().int().positive().optional(),
});

export const hijosSchema = z.object({
  nino_ids: z
    .array(z.number().int().positive())
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, 'Hay un alumno repetido'),
});

export const sectorSchema = z.object({
  padre_sector_residencia: z.string().trim().max(160).optional().or(z.literal('')),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const disponiblesSchema = z.object({
  buscar: z.string().trim().max(160).optional(),
});

const vacioANulo = (v: string | undefined | null): string | null => {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
};

export type RepresentanteConFoto = repo.RepresentanteListado & { usu_foto_url: string | null };

export interface ListaRepresentantes {
  representantes: RepresentanteConFoto[];
  conteos: repo.ConteosRepresentantes;
}

export async function listar(
  actor: AuthUser,
  query: z.infer<typeof listarSchema>,
): Promise<ListaRepresentantes> {
  const alcance = await alcanceDe(actor.usuario);

  const [lista, conteos] = await Promise.all([
    repo.listarRepresentantes(
      alcance,
      query.buscar && query.buscar.length > 0 ? query.buscar : null,
      query.estado ?? null,
    ),
    repo.contarRepresentantes(alcance),
  ]);

  const firmadas = await firmarFotos(lista.map((r) => r.usu_foto));

  return {
    representantes: lista.map((r) => ({
      ...r,
      usu_foto_url: r.usu_foto ? (firmadas.get(r.usu_foto) ?? r.usu_foto) : null,
    })),
    conteos,
  };
}

/**
 * Un representante está dentro del alcance si lo está alguno de sus hijos.
 *
 * Los que todavía no tienen ninguno solo los ve quien ve todo: si no, nadie
 * podría llegar a atarles el primero y quedarían invisibles para siempre.
 */
async function exigirVisible(
  actor: AuthUser,
  usuId: number,
): Promise<{ representante: repo.RepresentanteListado; alcance: Awaited<ReturnType<typeof alcanceDe>> }> {
  const representante = await repo.obtenerRepresentante(usuId);
  if (!representante) {
    throw new ApiError(404, 'Ese usuario no es un representante');
  }

  const alcance = await alcanceDe(actor.usuario);
  if (alcance.global) return { representante, alcance };

  const visibles = await repo.listarRepresentantes(alcance, null, null);
  if (!visibles.some((r) => r.usu_id === usuId)) {
    throw new ApiError(403, 'Ese representante esta fuera de tu alcance');
  }

  return { representante, alcance };
}

export interface FichaRepresentante {
  representante: RepresentanteConFoto;
  hijos: repo.HijoListado[];
}

export async function ficha(actor: AuthUser, usuId: number): Promise<FichaRepresentante> {
  const { representante } = await exigirVisible(actor, usuId);

  const hijos = representante.padre_id ? await repo.listarHijos(representante.padre_id) : [];

  return {
    representante: { ...representante, usu_foto_url: await firmarFoto(representante.usu_foto) },
    hijos,
  };
}

export async function disponibles(
  actor: AuthUser,
  usuId: number,
  buscar: string | undefined,
): Promise<repo.AlumnoDisponible[]> {
  const { representante, alcance } = await exigirVisible(actor, usuId);
  return repo.listarDisponibles(
    representante.padre_id,
    alcance,
    buscar && buscar.length > 0 ? buscar : null,
  );
}

/**
 * Sincroniza los hijos: llega la lista completa que debe tener.
 *
 * Solo se puede atar o soltar alumnos **del alcance de quien guarda**. Sin esa
 * comprobación, la lista que manda la pantalla se tomaría como la verdad
 * completa y un coordinador soltaría sin querer a los hijos de otro colegio que
 * ni siquiera ve. Es el mismo cuidado que en las disciplinas de una evaluación.
 */
export async function sincronizarHijos(
  actor: AuthUser,
  usuId: number,
  deseados: number[],
): Promise<FichaRepresentante> {
  const { representante, alcance } = await exigirVisible(actor, usuId);

  await enTransaccion(async (client) => {
    const padreId = representante.padre_id ?? (await repo.asegurarFicha(client, usuId));
    const actuales = await repo.hijosActuales(client, padreId);

    const aAtar = deseados.filter((id) => !actuales.includes(id));
    const aSoltar = actuales.filter((id) => !deseados.includes(id));

    for (const ninoId of aAtar) {
      if (!(await repo.ninoEnAlcance(client, ninoId, alcance))) {
        throw new ApiError(403, 'Alguno de esos alumnos esta fuera de tu alcance');
      }
      await repo.atar(client, padreId, ninoId);
    }

    for (const ninoId of aSoltar) {
      // Lo que no ves, no lo sueltas.
      if (!(await repo.ninoEnAlcance(client, ninoId, alcance))) continue;
      await repo.soltar(client, padreId, ninoId);
    }

    if (aAtar.length > 0 || aSoltar.length > 0) {
      await auditar(
        {
          actor,
          accion: 'editar',
          entidad: 'representante',
          entidadId: usuId,
          detalle: { nombre: representante.usu_nombre, atados: aAtar, soltados: aSoltar },
        },
        client,
      );
    }
  });

  return ficha(actor, usuId);
}

export async function actualizarSector(
  actor: AuthUser,
  usuId: number,
  sector: string | undefined,
): Promise<FichaRepresentante> {
  const { representante } = await exigirVisible(actor, usuId);

  await enTransaccion(async (client) => {
    const padreId = representante.padre_id ?? (await repo.asegurarFicha(client, usuId));
    await repo.actualizarSector(client, padreId, vacioANulo(sector));
  });

  return ficha(actor, usuId);
}
