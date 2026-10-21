import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { METODO } from '@/api/evaluaciones';
import {
  brutoMobak,
  esMobak,
  etiquetaOperador,
  topeMobak,
  type ParametroCampos,
  type Registro,
} from './metodos';

interface Props {
  parametro: ParametroCampos;
  intento: number;
  registro: Registro;
  onCambiar: (cambios: Partial<Registro>) => void;
}

/**
 * Los controles de un intento según el método del parámetro.
 *
 * Un solo sitio para la pantalla de evaluar y la vista previa (2026-10-16):
 * la vista previa tiene que verse igual que evaluar, y dos copias del mismo
 * JSX acaban divergiendo.
 */
const CamposIntento = ({ parametro, intento, registro: r, onCambiar }: Props) => {
  const metodo = parametro.evatipometo_id;
  const escalaMin = parametro.evaparam_escala_min ?? 0;
  const escalaMax = parametro.evaparam_escala_max ?? 5;

  if (metodo === METODO.TIEMPO) {
    return (
      <div className="space-y-1">
        <Input
          value={r.tiempo}
          onChange={(e) => onCambiar({ tiempo: e.target.value })}
          placeholder="1:30 o 90"
          inputMode="numeric"
          className="h-11 sm:h-10"
          aria-label={`Tiempo del intento ${intento}`}
        />
        <p className="text-xs text-muted-foreground">
          Minutos:segundos, o segundos a secas.
          {parametro.rango && (
            <>
              {' '}
              0 puntos si es {etiquetaOperador(parametro.rango.evatieran_op_cero)}{' '}
              {parametro.rango.evatieran_tiempo_cero}s; completo si es{' '}
              {etiquetaOperador(parametro.rango.evatieran_op_full)}{' '}
              {parametro.rango.evatieran_tiempo_full}s.
            </>
          )}
        </p>
      </div>
    );
  }

  if (metodo === METODO.LOGRO) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={r.logro === true ? 'default' : 'outline'}
          className="h-11 sm:h-10"
          onClick={() => onCambiar({ logro: true })}
        >
          Lo consiguió
        </Button>
        <Button
          type="button"
          variant={r.logro === false ? 'default' : 'outline'}
          className="h-11 sm:h-10"
          onClick={() => onCambiar({ logro: false })}
        >
          No
        </Button>
      </div>
    );
  }

  if (metodo === METODO.ESCALA) {
    // Un borrador puede traer la escala al revés; no se pinta un Array negativo.
    const largo = Math.max(0, escalaMax - escalaMin + 1);
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: largo }, (_, i) => escalaMin + i).map((valor) => (
            <Button
              key={valor}
              type="button"
              variant={r.escala === valor ? 'default' : 'outline'}
              className="h-11 w-11 p-0 sm:h-10 sm:w-10"
              onClick={() => onCambiar({ escala: valor })}
            >
              {valor}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          De {escalaMin} a {escalaMax}.
        </p>
      </div>
    );
  }

  if (esMobak(metodo)) {
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: topeMobak(metodo) + 1 }, (_, valor) => valor).map((valor) => (
            <Button
              key={valor}
              type="button"
              variant={r.mobak === valor ? 'default' : 'outline'}
              className="h-11 w-11 p-0 sm:h-10 sm:w-10"
              onClick={() => onCambiar({ mobak: valor })}
            >
              {valor}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {metodo === METODO.MOBAK_6
            ? '0-2 → nada · 3-4 → la mitad · 5-6 → todo'
            : '0 → nada · 1 → la mitad · 2 → todo'}
          {r.mobak !== null && (
            <>
              {' '}
              · has marcado {r.mobak} ({brutoMobak(metodo, r.mobak)} de 2)
            </>
          )}
        </p>
      </div>
    );
  }

  return null;
};

export default CamposIntento;
