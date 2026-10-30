import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useConfigMensualidades,
  useGuardarCobroColegio,
  useGuardarConfigMensualidades,
} from '@/hooks/useMensualidades';
import { NOMBRES_DE_MES, nombreDeMes, type ConfigMensualidades as Config } from '@/api/mensualidades';
import { hoyEc } from '@/lib/fecha';
import { cn } from '@/lib/utils';
import TarjetaConfig from '@/components/inscripciones/TarjetaConfig';

const SIN_COBRO = 'ninguno';

/**
 * Configuración de las mensualidades (cliente, 2026-10-30): hasta qué día se
 * paga, desde qué día una inscripción cuenta para el mes siguiente y, por
 * colegio, qué meses se cobran (los demás quedan en pausa) y desde cuándo.
 */
const ConfigMensualidades = () => {
  const config = useConfigMensualidades();
  if (!config.data) return null;
  return (
    <TarjetaConfig
      titulo="Mensualidades"
      descripcion="Día límite de pago, día de corte de la inscripción y los meses que cobra cada colegio."
    >
      <Dias config={config.data} />
      <div className="space-y-3 border-t pt-4">
        <p className="text-sm font-semibold">Meses de cobro por colegio</p>
        <p className="text-sm text-muted-foreground">
          Los meses sin marcar quedan en pausa. Un colegio sin "cobrar desde" no cobra mensualidades. Lo inscrito antes
          de ese mes queda pagado ese mes por la inscripción.
        </p>
        {config.data.colegios.length === 0 && (
          <p className="text-sm text-muted-foreground">Ningún colegio tiene valores todavía (pestaña Por colegio).</p>
        )}
        {config.data.colegios.map((c) => (
          <CobroColegio key={c.col_id} colegio={c} />
        ))}
      </div>
    </TarjetaConfig>
  );
};

const Dias = ({ config }: { config: Config }) => {
  const guardar = useGuardarConfigMensualidades();
  const { hasPermission } = usePermissions();
  const puede = hasPermission('inscripciones', 'editar');
  const [limite, setLimite] = useState('');
  const [corte, setCorte] = useState('');
  useEffect(() => {
    setLimite(String(config.dia_limite));
    setCorte(String(config.dia_corte));
  }, [config.dia_limite, config.dia_corte]);

  const valido = (v: string) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 28;
  const cambio = Number(limite) !== config.dia_limite || Number(corte) !== config.dia_corte;

  return (
    <div className="space-y-3">
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
          onClick={() => guardar.mutate({ dia_limite: Number(limite), dia_corte: Number(corte) })}
        >
          <Save className="mr-2 h-4 w-4" />
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      )}
    </div>
  );
};

const CobroColegio = ({ colegio }: { colegio: Config['colegios'][number] }) => {
  const guardar = useGuardarCobroColegio();
  const { hasPermission } = usePermissions();
  const puede = hasPermission('inscripciones', 'editar');
  const [meses, setMeses] = useState<number[]>(colegio.meses);
  const [desde, setDesde] = useState<string>(colegio.desde ?? SIN_COBRO);
  useEffect(() => {
    setMeses(colegio.meses);
    setDesde(colegio.desde ?? SIN_COBRO);
  }, [colegio.meses, colegio.desde]);

  // Doce meses atrás y doce adelante, más el guardado si quedó fuera.
  const opciones = useMemo(() => {
    const [a, m] = hoyEc().split('-').map(Number) as [number, number];
    const lista = Array.from({ length: 25 }, (_, i) => {
      const total = a * 12 + (m - 1) - 12 + i;
      return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
    });
    if (colegio.desde && !lista.includes(colegio.desde)) lista.unshift(colegio.desde);
    return lista;
  }, [colegio.desde]);

  const ordenados = [...meses].sort((x, y) => x - y);
  const cambio = ordenados.join() !== colegio.meses.join() || (desde === SIN_COBRO ? null : desde) !== colegio.desde;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="font-medium">{colegio.col_nombre}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Meses que cobra ${colegio.col_nombre}`}>
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
                'min-h-9 rounded-md border px-2.5 text-sm transition-colors disabled:cursor-not-allowed',
                activo ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {nombre.slice(0, 3)}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1.5 sm:w-56">
          <Label htmlFor={`mens-desde-${colegio.col_id}`}>Cobrar desde</Label>
          <Select value={desde} onValueChange={setDesde} disabled={!puede}>
            <SelectTrigger id={`mens-desde-${colegio.col_id}`} className="h-11 sm:h-10">
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
        </div>
        {puede && (
          <Button
            variant="outline"
            className="h-11 sm:h-10"
            disabled={!cambio || guardar.isPending || (desde !== SIN_COBRO && meses.length === 0)}
            onClick={() =>
              guardar.mutate({ colId: colegio.col_id, meses: ordenados, desde: desde === SIN_COBRO ? null : desde })
            }
          >
            <Save className="mr-2 h-4 w-4" />
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        )}
      </div>
      {desde !== SIN_COBRO && meses.length === 0 && (
        <p className="text-sm text-destructive">Marca al menos un mes de cobro.</p>
      )}
    </div>
  );
};

export default ConfigMensualidades;
