import { Check, Loader2, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { CoordinadorResumen } from '@/api/colegios';

interface Props {
  candidatos: CoordinadorResumen[];
  cargando: boolean;
  seleccionados: number[];
  onChange: (ids: number[]) => void;
}

/**
 * Coordinadores del colegio.
 *
 * La lista la da el backend y solo trae usuarios activos con el rol de
 * Coordinador: en el sistema viejo el selector consultaba `usuario` con la
 * anon key y dejaba nombrar coordinador a cualquiera, incluso a alguien sin
 * ese rol. Esa fila existia, pero el calculo de alcance no se la contaba — el
 * colegio parecia tener responsable y esa persona no veia nada.
 *
 * Un solo bloque para movil y escritorio: botones que envuelven, con area
 * tactil de 44 px.
 */
const CoordinatorMultiSelect = ({ candidatos, cargando, seleccionados, onChange }: Props) => {
  const alternar = (usuId: number) => {
    onChange(
      seleccionados.includes(usuId)
        ? seleccionados.filter((id) => id !== usuId)
        : [...seleccionados, usuId],
    );
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <UserCog className="h-4 w-4" />
        Coordinadores
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

      <div className="flex flex-wrap gap-2">
        {candidatos.map((candidato) => {
          const activo = seleccionados.includes(candidato.usu_id);
          return (
            <button
              key={candidato.usu_id}
              type="button"
              onClick={() => alternar(candidato.usu_id)}
              aria-pressed={activo}
              title={candidato.usu_correo}
              className={`flex min-h-11 min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
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
