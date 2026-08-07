import { z } from 'zod';

/**
 * Paginacion en el servidor.
 *
 * En el sistema viejo no la hay: la pantalla de estudiantes pide los 796 ninos
 * con sus padres, usuarios, colegio y grado anidados, y luego cuenta activos e
 * inactivos con .filter() en JavaScript. En toda la aplicacion hay 3 usos de
 * .limit() y 2 de .range().
 *
 * El limite maximo es 200 a proposito: una pantalla no necesita mas y evita
 * que un ?limit=100000 se convierta en una descarga completa de la tabla.
 */
export const paginacionSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export type Paginacion = z.infer<typeof paginacionSchema>;

export interface Pagina<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function armarPagina<T>(items: T[], total: number, { page, limit }: Paginacion): Pagina<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export function offsetDe({ page, limit }: Paginacion): number {
  return (page - 1) * limit;
}

/**
 * Traduce un nombre de columna pedido por el cliente a SQL, contra una lista
 * blanca. Nunca interpolar un ORDER BY que venga del request sin pasar por
 * aqui: los parametros de pg no sirven para nombres de columna.
 */
export function ordenSeguro(
  pedido: string | undefined,
  permitidas: Record<string, string>,
  porDefecto: string,
): string {
  if (pedido && Object.prototype.hasOwnProperty.call(permitidas, pedido)) {
    return permitidas[pedido] as string;
  }
  return porDefecto;
}
