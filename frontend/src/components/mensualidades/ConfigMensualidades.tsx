import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfigMensualidades, useGuardarCobroColegio } from '@/hooks/useMensualidades';
import { NOMBRES_DE_MES, nombreDeMes, type ConfigMensualidades as Config } from '@/api/mensualidades';
import { hoyEc } from '@/lib/fecha';
import { cn } from '@/lib/utils';
import TarjetaConfig from '@/components/inscripciones/TarjetaConfig';

type ColegioConfig = Config['colegios'][number];
const SIN_COBRO = 'ninguno';

/**
 * Pestaña Mensualidades de la Configuración de Inscripciones (cliente,
 * 2026-10-30): como "Por colegio", primero el colegio y debajo sus dos
 * tarjetas, Valores (día límite y día de corte) y Meses de cobro.
 */
const ConfigMensualidades = () => {
  const config = useConfigMensualidades();
  const [colId, setColId] = useState<string>('');

  if (config.isLoading) return <p className="text-sm text-muted-foreground">Cargando colegios…</p>;
  if (config.isError || !config.data) {
    return (
      <p className="text-sm text-destructive">
        No se pudo cargar: {(config.error as Error | null)?.message}
      </p>
    );
  }
  const colegios = config.data.colegios;
  if (colegios.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ningún colegio tiene valores todavía. Ponlos en la pestaña Por colegio y vuelve aquí.
      </p>
    );
  }
  const fila = colegios.find((c) => String(c.col_id) === colId) ?? colegios[0]!;

  return (
    <div className="space-y-5">
      <div className="max-w-md space-y-1.5">
        <Label htmlFor="mens-colegio">Colegio</Label>
        <Select value={String(fila.col_id)} onValueChange={setColId}>
          <SelectTrigger id="mens-colegio" className="h-11 sm:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {colegios.map((c) => (
              <SelectItem key={c.col_id} value={String(c.col_id)}>
                {c.col_nombre}
                {c.desde === null ? ' · no cobra' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {fila.desde === null
            ? 'Este colegio todavía no cobra mensualidades.'
            : `Cobra desde ${nombreDeMes(fila.desde)}, ${fila.meses.length} ${fila.meses.length === 1 ? 'mes' : 'meses'} al año.`}
        </p>
      </div>
      <Valores key={`v-${fila.col_id}`} colegio={fila} />
      <MesesDeCobro key={`m-${fila.col_id}`} colegio={fila} />
    </div>
  );
};

/** Lo que se guarda: siempre todo el colegio, cada tarjeta con lo suyo cambiado. */
const datosDe = (c: ColegioConfig) => ({ meses: c.meses, desde: c.desde, dia_limite: c.dia_limite, dia_corte: c.dia_corte });

const Valores = ({ colegio }: { colegio: ColegioConfig }) => {
  const guardar = useGuardarCobroColegio();
  const { hasPermission } = usePermissions();
  const puede = hasPermission('inscripciones', 'editar');
  const [limite, setLimite] = useState(String(colegio.dia_limite));
  const [corte, setCorte] = useState(String(colegio.dia_corte));
  useEffect(() => {
    setLimite(String(colegio.dia_limite));
    setCorte(String(colegio.dia_corte));
  }, [colegio.dia_limite, colegio.dia_corte]);

  const valido = (v: string) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 28;
  const cambio = Number(limite) !== colegio.dia_limite || Number(corte) !== colegio.dia_corte;

  return (
    <TarjetaConfig
      titulo="Valores"
      descripcion={`Se paga hasta el día ${colegio.dia_limite}. Quien se inscribe desde el día ${colegio.dia_corte} empieza el mes siguiente.`}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mens-limite">Día límite de pago</Label>
          <Input
            id="mens-limite"
            type="number"
            inputMode="numeric"
            min={1}
            max={28}
            value={limite}
            disabled={!puede}
            onChange={(e) => setLimite(e.target.value)}
            aria-invalid={!valido(limite)}
            className="h-11 max-w-[8rem] sm:h-10"
          />
          <p className="text-xs text-muted-foreground">Pasado este día, el mes sin pagar sale como atrasado. No se bloquea nada.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mens-corte">Día de corte de la inscripción</Label>
          <Input
            id="mens-corte"
            type="number"
            inputMode="numeric"
            min={1}
            max={28}
            value={corte}
            disabled={!puede}
            onChange={(e) => setCorte(e.target.value)}
            aria-invalid={!valido(corte)}
            className="h-11 max-w-[8rem] sm:h-10"
          />
          <p className="text-xs text-muted-foreground">
            Quien se inscribe desde este día paga con la inscripción el mes siguiente (inscrito el 25 de enero, paga febrero).
          </p>
        </div>
      </div>
      {puede && (
        <Button
          className="h-11 sm:h-10"
          disabled={!valido(limite) || !valido(corte) || !cambio || guardar.isPending}
          onClick={() =>
            guardar.mutate({ colId: colegio.col_id, ...datosDe(colegio), dia_limite: Number(limite), dia_corte: Number(corte) })
          }
        >
          <Save className="mr-2 h-4 w-4" />
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      )}
    </TarjetaConfig>
  );
};

/** Enero del año en curso a diciembre del siguiente; cambia solo al empezar cada año. */
function mesesElegibles(guardado: string | null): string[] {
  const ano = Number(hoyEc().slice(0, 4));
  const lista = [ano, ano + 1].flatMap((a) => NOMBRES_DE_MES.map((_, i) => `${a}-${String(i + 1).padStart(2, '0')}-01`));
  // Uno guardado en un año que ya pasó sigue saliendo, para no cambiarlo sin querer.
  if (guardado && !lista.includes(guardado)) lista.unshift(guardado);
  return lista;
}

const MesesDeCobro = ({ colegio }: { colegio: ColegioConfig }) => {
  const guardar = useGuardarCobroColegio();
  const { hasPermission } = usePermissions();
  const puede = hasPermission('inscripciones', 'editar');
  const [meses, setMeses] = useState<number[]>(colegio.meses);
  const [desde, setDesde] = useState<string>(colegio.desde ?? SIN_COBRO);
  useEffect(() => {
    setMeses(colegio.meses);
    setDesde(colegio.desde ?? SIN_COBRO);
  }, [colegio.meses, colegio.desde]);

  const opciones = useMemo(() => mesesElegibles(colegio.desde), [colegio.desde]);
  const ordenados = [...meses].sort((x, y) => x - y);
  const elegido = desde === SIN_COBRO ? null : desde;
  const cambio = ordenados.join() !== colegio.meses.join() || elegido !== colegio.desde;
  const faltaMes = elegido !== null && meses.length === 0;
  // El primer mes elegido tiene que ser de cobro: si no, en realidad empezaría después.
  const desdeEnPausa = elegido !== null && meses.length > 0 && !meses.includes(Number(elegido.slice(5, 7)));

  return (
    <TarjetaConfig
      titulo="Meses de cobro"
      descripcion={
        colegio.desde === null
          ? 'Todavía no cobra mensualidades.'
          : `Desde ${nombreDeMes(colegio.desde)}: ${colegio.meses.map((m) => NOMBRES_DE_MES[m - 1]!.slice(0, 3)).join(', ')}.`
      }
    >
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Meses que se cobran</p>
        <p className="text-xs text-muted-foreground">Los que no marques quedan en pausa (vacaciones): ese mes no se cobra a nadie.</p>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6" role="group" aria-label={`Meses que cobra ${colegio.col_nombre}`}>
          {NOMBRES_DE_MES.map((nombre, i) => {
            const n = i + 1;
            const activo = meses.includes(n);
            return (
              <button
                key={n}
                type="button"
                aria-pressed={activo}
                disabled={!puede}
                onClick={() => setMeses((antes) => (activo ? antes.filter((x) => x !== n) : [...antes, n]))}
                className={cn(
                  'min-h-11 rounded-md border px-2 text-sm transition-colors disabled:cursor-not-allowed sm:min-h-9',
                  activo ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted',
                )}
              >
                {nombre.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`mens-desde-${colegio.col_id}`}>Cobrar desde</Label>
        <Select value={desde} onValueChange={setDesde} disabled={!puede}>
          <SelectTrigger id={`mens-desde-${colegio.col_id}`} className="h-11 sm:h-10 sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_COBRO}>Todavía no cobra</SelectItem>
            {opciones.map((m) => (
              <SelectItem key={m} value={m}>
                {nombreDeMes(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          El primer mes en que este colegio cobra mensualidad. Antes de ese mes no se cobra nada, y quien ya estaba
          inscrito tiene ese primer mes pagado con su inscripción. Ejemplo: con Noviembre 2026, los inscritos en octubre
          tienen noviembre pagado y su primera mensualidad es diciembre.
        </p>
      </div>

      {faltaMes && <p className="text-sm text-destructive">Marca al menos un mes de cobro.</p>}
      {desdeEnPausa && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {nombreDeMes(elegido!)} está en pausa: el cobro empezará en el siguiente mes marcado.
        </p>
      )}

      {puede && (
        <Button
          className="h-11 sm:h-10"
          disabled={!cambio || faltaMes || guardar.isPending}
          onClick={() => guardar.mutate({ colId: colegio.col_id, ...datosDe(colegio), meses: ordenados, desde: elegido })}
        >
          <Save className="mr-2 h-4 w-4" />
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      )}
    </TarjetaConfig>
  );
};

export default ConfigMensualidades;
