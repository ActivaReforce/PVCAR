import { useMemo, useState } from 'react';
import { Check, Loader2, Search, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { contieneSinTildes } from '@/lib/texto';
import type { CoordinadorResumen } from '@/api/colegios';

interface Props {
  candidatos: CoordinadorResumen[];
  cargando: boolean;
  seleccionados: number[];
  onChange: (ids: number[]) => void;
}

/**
 * A partir de aquí aparece el buscador. Por debajo estorbaría más que ayuda:
 * con seis nombres se lee antes la lista que el cuadro de búsqueda.
 */
const UMBRAL_BUSCADOR = 8;

/**
 * Coordinadores del colegio.
 *
 * La lista la da el backend y solo trae usuarios activos con el rol de
 * Coordinador: en el sistema viejo el selector consultaba `usuario` con la
 * anon key y dejaba nombrar coordinador a cualquiera, incluso a alguien sin
 * ese rol. Esa fila existía, pero el cálculo de alcance no se la contaba — el
 * colegio parecía tener responsable y esa persona no veía nada.
 *
 * ---------------------------------------------------------------------------
 * Por qué hay buscador y altura máxima
 *
 * Porque la lista no tiene tope. Hoy en la academia hay 6 coordinadores y
 * caben de un vistazo, pero nada impide que mañana haya 100: sin esto, el
 * formulario se convertiría en un muro de botones y el resto de campos se
 * iría fuera de la pantalla. El buscador solo aparece cuando hace falta
 * (más de 8), y la zona tiene alto máximo con scroll propio.
 *
 * Los seleccionados salen SIEMPRE, aunque la búsqueda no los alcance: si no,
 * escribir en el buscador escondería a alguien ya marcado y parecería que se
 * ha desasignado.
 *
 * Un solo bloque para móvil y escritorio: botones que envuelven, con área
 * táctil de 44 px.
 */
const CoordinatorMultiSelect = ({ candidatos, cargando, seleccionados, onChange }: Props) => {
  const [busqueda, setBusqueda] = useState('');

  const alternar = (usuId: number) => {
    onChange(
      seleccionados.includes(usuId)
        ? seleccionados.filter((id) => id !== usuId)
        : [...seleccionados, usuId],
    );
  };

  const hayBuscador = candidatos.length > UMBRAL_BUSCADOR;

  const visibles = useMemo(() => {
    const termino = busqueda.trim();
    if (!termino) return candidatos;
    return candidatos.filter(
      (c) =>
        seleccionados.includes(c.usu_id) ||
        contieneSinTildes(c.usu_nombre, termino) ||
        contieneSinTildes(c.usu_correo, termino),
    );
  }, [candidatos, busqueda, seleccionados]);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <UserCog className="h-4 w-4" />
        Coordinadores
        {candidatos.length > 0 && (
          <span className="text-xs font-normal text-muted-foreground">
            ({candidatos.length} disponible{candidatos.length === 1 ? '' : 's'})
          </span>
        )}
      </Label>

      {cargando && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando candidatos…
        </p>
      )}

      {!cargando && candidatos.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay usuarios activos con el rol de Coordinador. Créalos primero en Usuarios.
        </p>
      )}

      {hayBuscador && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="h-11 pl-10 sm:h-10"
            aria-label="Buscar coordinador"
          />
        </div>
      )}

      {candidatos.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-md">
          <div className="flex flex-wrap gap-2 p-0.5">
            {visibles.map((candidato) => {
              const activo = seleccionados.includes(candidato.usu_id);
              return (
                <button
                  key={candidato.usu_id}
                  type="button"
                  onClick={() => alternar(candidato.usu_id)}
                  aria-pressed={activo}
                  title={candidato.usu_correo}
                  className={`flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    activo
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {activo && <Check className="h-4 w-4 flex-shrink-0" />}
                  <span className="truncate">{candidato.usu_nombre}</span>
                </button>
              );
            })}
          </div>

          {visibles.length === 0 && (
            <p className="py-3 text-sm text-muted-foreground">
              Ningún coordinador coincide con «{busqueda.trim()}».
            </p>
          )}
        </div>
      )}

      {seleccionados.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {seleccionados.length} seleccionado{seleccionados.length === 1 ? '' : 's'}. Verán
          únicamente los datos de este colegio.
        </p>
      )}

      {seleccionados.length === 0 && !cargando && candidatos.length > 0 && (
        <Badge variant="outline" className="text-xs">
          Sin coordinador asignado
        </Badge>
      )}
    </div>
  );
};

export default CoordinatorMultiSelect;
