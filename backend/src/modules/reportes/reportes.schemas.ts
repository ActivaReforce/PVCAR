import { z } from 'zod';

/**
 * Entrada de Reportes.
 *
 * Los mismos filtros para los nueve, porque son los mismos cinco ejes —texto,
 * colegio, disciplina, estado y fechas— y cada definición usa los que le
 * sirven. En el sistema viejo cada reporte inventaba los suyos y la pestaña de
 * exportar no siempre llevaba los mismos que la de análisis: se veía una tabla
 * en pantalla y se bajaba un Excel con otro contenido.
 */

const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe ser AAAA-MM-DD')
  .refine((texto) => {
    const d = new Date(`${texto}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
  }, 'Esa fecha no existe');

const listaDeIds = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((valor) => {
    if (valor === undefined) return undefined;
    const texto = Array.isArray(valor) ? valor.join(',') : valor;
    const ids = texto
      .split(',')
      .map((t) => Number(t.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    return ids.length > 0 ? ids : undefined;
  });

export const filtrosSchema = z
  .object({
    buscar: z.string().trim().max(160).optional(),
    colegio: listaDeIds,
    disciplina: z.coerce.number().int().positive().optional(),
    estado: z.coerce.number().int().positive().optional(),
    desde: fecha.optional(),
    hasta: fecha.optional(),
    /** Incluir las columnas sensibles del reporte. Por defecto, no. */
    incluirSensibles: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .optional()
      /* Se deja `undefined` cuando no viene, para que el filtro sea opcional
         de verdad: el servicio compara contra `true`. */
      .transform((v) => (v === undefined ? undefined : v === true || v === 'true' || v === '1')),
  })
  .refine((f) => !f.desde || !f.hasta || f.desde <= f.hasta, {
    path: ['desde'],
    message: 'La fecha inicial no puede ser posterior a la final',
  });

export type FiltrosQuery = z.infer<typeof filtrosSchema>;

/**
 * La vista de pantalla va paginada. El tope de 200 es el mismo que el resto
 * del sistema: una tabla no se lee de otra forma, y para llevarse todo está
 * la exportación.
 */
export const consultaSchema = filtrosSchema.and(
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
);

export type ConsultaQuery = z.infer<typeof consultaSchema>;

export const idParamSchema = z.object({
  modulo: z.string().trim().min(1).max(60),
});
