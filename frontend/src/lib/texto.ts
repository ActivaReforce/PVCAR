/**
 * Búsqueda de texto en el navegador, sin tildes y sin distinguir mayúsculas.
 *
 * El gemelo del `contieneSinTildes` del backend, que usa `unaccent` de
 * Postgres. Aquí hace falta cuando la lista ya está en memoria y filtrarla en
 * el servidor sería un viaje de red para nada — el selector de coordinadores,
 * por ejemplo.
 *
 * `NFD` separa cada letra de su tilde y el rango `\u0300-\u036f` borra las
 * tildes sueltas: «Ángel» pasa a «angel», así que buscar "angel" lo encuentra.
 * La ñ **no** se toca a propósito: en español es una letra distinta, no una n
 * con adorno, y quien busca "ninez" no está buscando "niñez".
 */
export function sinTildes(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** True si `texto` contiene `termino`, ignorando tildes y mayúsculas. */
export function contieneSinTildes(texto: string, termino: string): boolean {
  return sinTildes(texto).includes(sinTildes(termino));
}
