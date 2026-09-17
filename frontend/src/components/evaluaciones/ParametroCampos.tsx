import { Lock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { METODO, type ParametroInput } from '@/api/evaluaciones';
import { METODOS } from './metodos';

interface Props {
  indice: number;
  parametro: ParametroInput;
  /** Notas ya puestas: bloquea cambiar el método y borrar el parámetro. */
  intentosRegistrados: number;
  onCambiar: (indice: number, cambios: Partial<ParametroInput>) => void;
  onBorrar: (indice: number) => void;
}

const OPERADORES = ['<', '<=', '>', '>='] as const;

/**
 * Los campos de un parámetro.
 *
 * Lo que se ve depende del método, y **solo se enseña lo que ese método usa**:
 * el formulario viejo pintaba los campos de escala y los umbrales de tiempo
 * siempre, con los que no tocaban en gris, y eran 30 campos en pantalla para
 * configurar un parámetro de "lo consigue o no".
 *
 * El método se bloquea en cuanto hay notas puestas: un intento guardado como
 * "logro" no significa nada bajo un método por tiempo, y el backend lo rechaza
 * con un 409. Mejor decirlo aquí que después de guardar.
 */
const ParametroCampos = ({
  indice,
  parametro,
  intentosRegistrados,
  onCambiar,
  onBorrar,
}: Props) => {
  const bloqueado = intentosRegistrados > 0;
  const esTiempo = parametro.evatipometo_id === METODO.TIEMPO;
  const esEscala = parametro.evatipometo_id === METODO.ESCALA;
  const rango = parametro.rango;

  /** Cambiar de método tira lo que era propio del anterior. */
  const cambiarMetodo = (valor: string) => {
    const metodo = Number(valor);
    onCambiar(indice, {
      evatipometo_id: metodo,
      rango:
        metodo === METODO.TIEMPO
          ? (rango ?? {
              evatieran_op_cero: '>=',
              evatieran_tiempo_cero: 30,
              evatieran_op_full: '<=',
              evatieran_tiempo_full: 10,
            })
          : null,
      evaparam_escala_min: metodo === METODO.ESCALA ? (parametro.evaparam_escala_min ?? 0) : null,
      evaparam_escala_max: metodo === METODO.ESCALA ? (parametro.evaparam_escala_max ?? 5) : null,
    });
  };

  const cambiarRango = (cambios: Partial<NonNullable<ParametroInput['rango']>>) => {
    if (!rango) return;
    onCambiar(indice, { rango: { ...rango, ...cambios } });
  };

  return (
    <div className="space-y-4 rounded-lg border p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-muted-foreground">Parámetro {indice + 1}</h4>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-destructive hover:text-destructive"
          onClick={() => onBorrar(indice)}
          disabled={bloqueado}
          title={
            bloqueado
              ? `No se puede borrar: tiene ${intentosRegistrados} nota(s) puesta(s)`
              : 'Quitar parámetro'
          }
          aria-label={`Quitar parámetro ${indice + 1}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`nombre-${indice}`}>Nombre</Label>
          <Input
            id={`nombre-${indice}`}
            value={parametro.evaparam_nombre}
            onChange={(e) => onCambiar(indice, { evaparam_nombre: e.target.value })}
            placeholder="Saltar la cuerda"
            className="h-11 sm:h-10"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`nota-${indice}`}>Indicación para quien evalúa (opcional)</Label>
          <Input
            id={`nota-${indice}`}
            value={parametro.evaparam_nota ?? ''}
            onChange={(e) => onCambiar(indice, { evaparam_nota: e.target.value })}
            placeholder="Cuenta los saltos seguidos sin fallar"
            className="h-11 sm:h-10"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`metodo-${indice}`}>Método</Label>
          <Select
            value={String(parametro.evatipometo_id)}
            onValueChange={cambiarMetodo}
            disabled={bloqueado}
          >
            <SelectTrigger id={`metodo-${indice}`} className="h-11 sm:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(METODOS).map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="flex items-start gap-1 text-xs text-muted-foreground">
            {bloqueado && <Lock className="mt-0.5 h-3 w-3 flex-shrink-0" />}
            {bloqueado
              ? `Bloqueado: ya hay ${intentosRegistrados} nota(s) puesta(s) con este método.`
              : METODOS[parametro.evatipometo_id]?.registra}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`intentos-${indice}`}>Intentos</Label>
            <Input
              id={`intentos-${indice}`}
              type="number"
              min={1}
              max={20}
              value={parametro.evaparam_intentos}
              onChange={(e) =>
                onCambiar(indice, { evaparam_intentos: Math.max(1, Number(e.target.value)) })
              }
              className="h-11 sm:h-10"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`puntaje-${indice}`}>Puntaje</Label>
            <Input
              id={`puntaje-${indice}`}
              type="number"
              min={1}
              max={1000}
              value={parametro.evaparam_puntaje}
              onChange={(e) =>
                onCambiar(indice, { evaparam_puntaje: Math.max(1, Number(e.target.value)) })
              }
              className="h-11 sm:h-10"
            />
          </div>
        </div>
      </div>

      {esEscala && (
        <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3">
          <div className="space-y-1">
            <Label htmlFor={`min-${indice}`}>Mínimo de la escala</Label>
            <Input
              id={`min-${indice}`}
              type="number"
              min={0}
              value={parametro.evaparam_escala_min ?? 0}
              onChange={(e) => onCambiar(indice, { evaparam_escala_min: Number(e.target.value) })}
              className="h-11 sm:h-10"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`max-${indice}`}>Máximo</Label>
            <Input
              id={`max-${indice}`}
              type="number"
              min={1}
              value={parametro.evaparam_escala_max ?? 5}
              onChange={(e) => onCambiar(indice, { evaparam_escala_max: Number(e.target.value) })}
              className="h-11 sm:h-10"
            />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground">
            El mínimo vale 0 puntos y el máximo, los {parametro.evaparam_puntaje} del parámetro. Lo
            de en medio se reparte proporcionalmente.
          </p>
        </div>
      )}

      {esTiempo && rango && (
        <div className="space-y-3 rounded-md bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">
            Dos umbrales, en segundos. Uno da <strong>0 puntos</strong> y el otro el{' '}
            <strong>puntaje completo</strong>; entre los dos se interpola.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>0 puntos si el tiempo es</Label>
              <div className="flex gap-2">
                <Select
                  value={rango.evatieran_op_cero}
                  onValueChange={(v) =>
                    cambiarRango({ evatieran_op_cero: v as (typeof OPERADORES)[number] })
                  }
                >
                  <SelectTrigger className="h-11 w-20 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERADORES.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  value={rango.evatieran_tiempo_cero}
                  onChange={(e) =>
                    cambiarRango({ evatieran_tiempo_cero: Math.max(1, Number(e.target.value)) })
                  }
                  className="h-11 sm:h-10"
                  aria-label="Segundos del umbral de 0 puntos"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Puntaje completo si es</Label>
              <div className="flex gap-2">
                <Select
                  value={rango.evatieran_op_full}
                  onValueChange={(v) =>
                    cambiarRango({ evatieran_op_full: v as (typeof OPERADORES)[number] })
                  }
                >
                  <SelectTrigger className="h-11 w-20 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERADORES.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  value={rango.evatieran_tiempo_full}
                  onChange={(e) =>
                    cambiarRango({ evatieran_tiempo_full: Math.max(1, Number(e.target.value)) })
                  }
                  className="h-11 sm:h-10"
                  aria-label="Segundos del umbral de puntaje completo"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParametroCampos;
