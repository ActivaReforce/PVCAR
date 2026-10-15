import { AlertTriangle, Lock, Trash2 } from 'lucide-react';
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

type Operador = '<' | '<=' | '>' | '>=';

/** Los operadores con texto legible (pedido del cliente, 2026-10-15). */
const OPERADORES: Array<{ valor: Operador; etiqueta: string }> = [
  { valor: '<', etiqueta: 'menor que' },
  { valor: '<=', etiqueta: 'menor o igual que' },
  { valor: '>', etiqueta: 'mayor que' },
  { valor: '>=', etiqueta: 'mayor o igual que' },
];

const etiquetaDe = (op: Operador) =>
  OPERADORES.find((o) => o.valor === op)?.etiqueta ?? op;

/**
 * Valida el rango de un parámetro Por tiempo. Devuelve el mensaje de error o
 * null si está bien. Dos cotas que apuntan al mismo lado (ambas "mayor que")
 * no se pueden interpolar.
 */
export function validarRango(rango: NonNullable<ParametroInput['rango']>): string | null {
  const op0 = rango.evatieran_op_cero;
  const opFull = rango.evatieran_op_full;
  const ceroEsMayor = op0 === '>' || op0 === '>=';
  const fullEsMayor = opFull === '>' || opFull === '>=';
  if (ceroEsMayor === fullEsMayor) {
    return 'Los dos umbrales deben ir en direcciones opuestas: uno "menor" y otro "mayor". Si no, no se puede interpolar entre ellos.';
  }
  const tCero = rango.evatieran_tiempo_cero;
  const tFull = rango.evatieran_tiempo_full;
  if (ceroEsMayor && tCero <= tFull) {
    return 'Si los tiempos largos valen 0 puntos, el umbral de 0 puntos debe ser mayor que el del puntaje completo.';
  }
  if (!ceroEsMayor && tFull <= tCero) {
    return 'Si los tiempos cortos valen más puntos, el umbral del puntaje completo debe ser menor que el de 0 puntos.';
  }
  return null;
}

/**
 * Input numérico que **sí deja borrar completo** (pedido del cliente,
 * 2026-10-15). El `<Input type="number">` con valor controlado se quedaba
 * atrapado en el mínimo porque `Number('')` da 0 y `Math.max(1, 0)` da 1,
 * y el campo se repintaba al instante. Aquí se usa texto con `inputMode`
 * numérico; mientras edita puede quedar vacío, y al perder foco se
 * normaliza al mínimo si hace falta.
 */
function CampoNumero({
  id,
  valor,
  minimo,
  onCambiar,
  ariaLabel,
}: {
  id?: string;
  valor: number;
  minimo: number;
  onCambiar: (n: number) => void;
  ariaLabel?: string;
}) {
  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={valor === 0 ? '' : String(valor)}
      onChange={(e) => {
        const v = e.target.value;
        if (v === '') onCambiar(0);
        else if (/^\d+$/.test(v)) onCambiar(Number(v));
      }}
      onBlur={(e) => {
        const n = Number(e.target.value);
        if (!/^\d+$/.test(e.target.value) || n < minimo) onCambiar(minimo);
      }}
      className="h-11 sm:h-10"
      aria-label={ariaLabel}
    />
  );
}

/**
 * Los campos de un parámetro.
 *
 * Lo que se ve depende del método: solo se enseña lo que ese método usa. El
 * método se bloquea en cuanto hay notas puestas; un intento guardado como
 * "logro" no significa nada bajo un método por tiempo y el backend lo rechaza
 * con 409.
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
  const errorRango = esTiempo && rango ? validarRango(rango) : null;
  const errorEscala =
    esEscala &&
    (parametro.evaparam_escala_max ?? 0) <= (parametro.evaparam_escala_min ?? 0)
      ? 'El máximo de la escala debe ser mayor que el mínimo.'
      : null;

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
            <CampoNumero
              id={`intentos-${indice}`}
              valor={parametro.evaparam_intentos}
              minimo={1}
              onCambiar={(n) => onCambiar(indice, { evaparam_intentos: n })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`puntaje-${indice}`}>Puntaje</Label>
            <CampoNumero
              id={`puntaje-${indice}`}
              valor={parametro.evaparam_puntaje}
              minimo={1}
              onCambiar={(n) => onCambiar(indice, { evaparam_puntaje: n })}
            />
          </div>
        </div>
      </div>

      {esEscala && (
        <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3">
          <div className="space-y-1">
            <Label htmlFor={`min-${indice}`}>Mínimo de la escala</Label>
            <CampoNumero
              id={`min-${indice}`}
              valor={parametro.evaparam_escala_min ?? 0}
              minimo={0}
              onCambiar={(n) => onCambiar(indice, { evaparam_escala_min: n })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`max-${indice}`}>Máximo</Label>
            <CampoNumero
              id={`max-${indice}`}
              valor={parametro.evaparam_escala_max ?? 5}
              minimo={1}
              onCambiar={(n) => onCambiar(indice, { evaparam_escala_max: n })}
            />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground">
            El mínimo vale 0 puntos y el máximo, los {parametro.evaparam_puntaje} del parámetro. Lo
            de en medio se reparte proporcionalmente.
          </p>
          {errorEscala && (
            <p className="col-span-2 flex items-start gap-1 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              {errorEscala}
            </p>
          )}
        </div>
      )}

      {esTiempo && rango && (
        <div className="space-y-3 rounded-md bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">
            Dos umbrales <strong>en segundos</strong>. Uno da <strong>0 puntos</strong> y el otro
            el <strong>puntaje completo</strong>; entre los dos se interpola.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>0 puntos si el tiempo es…</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={rango.evatieran_op_cero}
                  onValueChange={(v) =>
                    cambiarRango({ evatieran_op_cero: v as Operador })
                  }
                >
                  <SelectTrigger className="h-11 min-w-0 flex-1 sm:h-10">
                    <SelectValue>{etiquetaDe(rango.evatieran_op_cero)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {OPERADORES.map((op) => (
                      <SelectItem key={op.valor} value={op.valor}>
                        {op.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <CampoNumero
                    valor={rango.evatieran_tiempo_cero}
                    minimo={1}
                    onCambiar={(n) => cambiarRango({ evatieran_tiempo_cero: n })}
                    ariaLabel="Segundos del umbral de 0 puntos"
                  />
                  <span className="text-sm text-muted-foreground">s</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Puntaje completo si es…</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={rango.evatieran_op_full}
                  onValueChange={(v) =>
                    cambiarRango({ evatieran_op_full: v as Operador })
                  }
                >
                  <SelectTrigger className="h-11 min-w-0 flex-1 sm:h-10">
                    <SelectValue>{etiquetaDe(rango.evatieran_op_full)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {OPERADORES.map((op) => (
                      <SelectItem key={op.valor} value={op.valor}>
                        {op.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <CampoNumero
                    valor={rango.evatieran_tiempo_full}
                    minimo={1}
                    onCambiar={(n) => cambiarRango({ evatieran_tiempo_full: n })}
                    ariaLabel="Segundos del umbral de puntaje completo"
                  />
                  <span className="text-sm text-muted-foreground">s</span>
                </div>
              </div>
            </div>
          </div>

          {errorRango && (
            <p className="flex items-start gap-1 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              {errorRango}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ParametroCampos;
