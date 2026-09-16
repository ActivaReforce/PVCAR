/**
 * Trozos de SQL compartidos.
 */

/**
 * Comparacion de texto sin tildes y sin mayusculas.
 *
 * Buscar "hernandez" no encontraba a "Ana Karina Guerra Hernández", ni
 * "calderon" al colegio "Innova Schools Calderón", ni "futbol" a "Fútbol G1".
 * En una base con nombres en espanol escritos por personas distintas, eso es
 * la mitad de las busquedas fallando en silencio.
 *
 * Se resuelve con `translate` y no con la extension `unaccent` a proposito:
 * unaccent esta disponible en Supabase pero habria que instalarla con una
 * migracion en las dos bases, y esto no lo necesita. El coste es que la lista
 * de caracteres es explicita — para espanol, que es lo que hay aqui.
 *
 * Ojo: al aplicar la funcion sobre la columna, un indice normal no sirve. Con
 * 68 usuarios, 8 colegios y 94 disciplinas eso da igual; si alguna tabla
 * crecera mucho (nino, con 796) se le pone un indice funcional o pg_trgm.
 */
export function sinTildes(expresion: string): string {
  return `translate(lower(${expresion}), 'áéíóúüñàèìòùâêîôûäëïöÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÄËÏÖ', 'aeiouunaeiouaeiouaeioAEIOUUNAEIOUAEIOUAEIO')`;
}

/**
 * `columna ILIKE %texto%` pero insensible a tildes por los dos lados.
 * `parametro` es el marcador posicional del texto buscado ($3, por ejemplo).
 */
export function contieneSinTildes(columna: string, parametro: string): string {
  return `${sinTildes(columna)} LIKE '%' || ${sinTildes(parametro)} || '%'`;
}
