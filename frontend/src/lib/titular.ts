/**
 * De quién ve ahora un auxiliar con varios titulares (decidido con el
 * cliente el 2026-10-02): null = de todos.
 *
 * Vive fuera de React porque lo lee `apiFetch`, que lo manda en la cabecera
 * `X-Titular`. El backend solo lo usa para **estrechar** el alcance del
 * auxiliar; un id que no es suyo deja ese camino vacío, nunca amplía nada.
 * Se recuerda en el navegador para no tener que elegirlo en cada entrada.
 */
const CLAVE = 'pvcar.titular';

let elegido: number | null = (() => {
  try {
    const guardado = Number(localStorage.getItem(CLAVE));
    return Number.isInteger(guardado) && guardado > 0 ? guardado : null;
  } catch {
    return null;
  }
})();

export function titularElegido(): number | null {
  return elegido;
}

export function elegirTitular(entId: number | null): void {
  elegido = entId;
  try {
    if (entId === null) localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, String(entId));
  } catch {
    // Sin almacenamiento (privado): vale para esta pestaña.
  }
}
