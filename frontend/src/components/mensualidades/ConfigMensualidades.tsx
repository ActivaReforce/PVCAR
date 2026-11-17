import { useEffect, useState } from 'react';
import { CalendarPlus, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfigMensualidades, useGuardarCobroColegio } from '@/hooks/useMensualidades';
import { NOMBRES_DE_MES, type ConfigMensualidades as Config } from '@/api/mensualidades';
import { hoyEc } from '@/lib/fecha';
import { cn } from '@/lib/utils';
import TarjetaConfig from '@/components/inscripciones/TarjetaConfig';
import ConfigCorreo from '@/components/correos/ConfigCorreo';

type ColegioConfig = Config['colegios'][number];

const mesDe = (ano: number, n: number) => `${ano}-${String(n).padStart(2, '0')}-01`;

/**
 * Pestaña Mensualidades de la Configuración de Inscripciones (cliente,
 * 2026-11-16): primero el colegio y debajo sus dos tarjetas, Valores (día
 * límite de pago) y Meses de cobro, con año: el año en curso y, si se abre,
 * el siguiente. Al empezar el año nuevo, ese pasa a ser el principal.
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
  const ano = Number(hoyEc().slice(0, 4));
  const deEsteAno = (c: ColegioConfig) => c.meses.filter((m) => m.startsWith(`${ano}-`)).length;

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
                {c.meses.length === 0 ? ' · no cobra' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {fila.meses.length === 0
            ? 'Este colegio todavía no cobra mensualidades.'
            : `Cobra ${deEsteAno(fila)} ${deEsteAno(fila) === 1 ? 'mes' : 'meses'} en ${ano}.`}
        </p>
      </div>
      <Valores key={`v-${fila.col_id}`} colegio={fila} />
      <MesesDeCobro key={`m-${fila.col_id}`} colegio={fila} ano={ano} />
      <ConfigCorreo
        tipo="mensualidades_aviso"
        titulo="Correo: aviso de mensualidad nueva"
        descripcion="Sale cuando un representante envía un pago de mensualidad. Va al equipo, con el detalle de hijos, meses y total."
        conPara
        avisos={[
          {
            campo: 'notificar_representante',
            texto: 'Enviar un correo al representante cuando se apruebe su pago',
          },
        ]}
      />
      <ConfigCorreo
        tipo="mensualidades_atrasadas"
        titulo="Correo: aviso de mensualidad atrasada"
        descripcion="Sale una vez al mes, el día siguiente al día límite a las 7:00, con todos los alumnos atrasados. Solo a esta lista (por ejemplo, el gerente); nunca al representante."
        conPara
      />
    </div>
  );
};

const Valores = ({ colegio }: { colegio: ColegioConfig }) => {
  const guardar = useGuardarCobroColegio();
  const { hasPermission } = usePermissions();
  const puede = hasPermission('inscripciones', 'editar');
  const [limite, setLimite] = useState(String(colegio.dia_limite));
  useEffect(() => setLimite(String(colegio.dia_limite)), [colegio.dia_limite]);

  const valido = Number.isInteger(Number(limite)) && Number(limite) >= 1 && Number(limite) <= 28;
  const cambio = Number(limite) !== colegio.dia_limite;

  return (
    <TarjetaConfig titulo="Valores" descripcion={`Se paga hasta el día ${colegio.dia_limite} de cada mes.`}>
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
          aria-invalid={!valido}
          className="h-11 max-w-[8rem] sm:h-10"
        />
        <p className="text-xs text-muted-foreground">
          Pasado este día, el mes sin pagar sale atrasado y el alumno queda ausente en Asistencias hasta que pague. Se
          puede pagar después, sin recargo.
        </p>
      </div>
      {puede && (
        <Button
          className="h-11 sm:h-10"
          disabled={!valido || !cambio || guardar.isPending}
          onClick={() => guardar.mutate({ colId: colegio.col_id, meses: colegio.meses, dia_limite: Number(limite) })}
        >
          <Save className="mr-2 h-4 w-4" />
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      )}
    </TarjetaConfig>
  );
};

const MesesDeCobro = ({ colegio, ano }: { colegio: ColegioConfig; ano: number }) => {
  const guardar = useGuardarCobroColegio();
  const { hasPermission } = usePermissions();
  const puede = hasPermission('inscripciones', 'editar');
  const [meses, setMeses] = useState<Set<string>>(new Set(colegio.meses));
  const tieneSiguiente = colegio.meses.some((m) => m.startsWith(`${ano + 1}-`));
  const [siguienteAbierto, setSiguienteAbierto] = useState(tieneSiguiente);
  useEffect(() => {
    setMeses(new Set(colegio.meses));
    setSiguienteAbierto(colegio.meses.some((m) => m.startsWith(`${ano + 1}-`)));
  }, [colegio.meses, ano]);

  const ordenados = [...meses].sort();
  const cambio = ordenados.join() !== [...colegio.meses].sort().join();
  const alternar = (m: string) =>
    setMeses((antes) => {
      const nuevo = new Set(antes);
      if (nuevo.has(m)) nuevo.delete(m);
      else nuevo.add(m);
      return nuevo;
    });

  const anos = siguienteAbierto ? [ano, ano + 1] : [ano];
  const actual = `${hoyEc().slice(0, 7)}-01`;

  return (
    <TarjetaConfig
      titulo="Meses de cobro"
      descripcion="Los meses en que este colegio cobra mensualidad. Los que no marques quedan en pausa (vacaciones): ese mes no se cobra a nadie. Los meses que ya pasaron no se pueden cambiar."
    >
      {anos.map((a) => (
        <div key={a} className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Meses que se cobran</p>
            <Badge variant={a === ano ? 'default' : 'secondary'}>{a}</Badge>
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6" role="group" aria-label={`Meses que cobra ${colegio.col_nombre} en ${a}`}>
            {NOMBRES_DE_MES.map((nombre, i) => {
              const m = mesDe(a, i + 1);
              const activo = meses.has(m);
              // Los meses ya pasados no se tocan: marcar uno dejaría a todos debiéndolo.
              const pasado = m < actual;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={activo}
                  aria-label={`${nombre} ${a}${pasado ? ' (ya pasó)' : ''}`}
                  title={pasado ? 'Ya pasó: no se puede cambiar' : undefined}
                  disabled={!puede || pasado}
                  onClick={() => alternar(m)}
                  className={cn(
                    'min-h-11 rounded-md border px-2 text-sm transition-colors disabled:cursor-not-allowed sm:min-h-9',
                    activo ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted',
                    pasado && 'opacity-50',
                  )}
                >
                  {nombre.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!siguienteAbierto && puede && (
        <Button variant="outline" className="h-11 sm:h-10" onClick={() => setSiguienteAbierto(true)}>
          <CalendarPlus className="mr-2 h-4 w-4" /> Abrir {ano + 1}
        </Button>
      )}
      {siguienteAbierto && (
        <p className="text-xs text-muted-foreground">
          Los representantes pueden pagar por adelantado los meses marcados de {ano} y {ano + 1}.
        </p>
      )}

      {puede && (
        <Button
          className="h-11 sm:h-10"
          disabled={!cambio || guardar.isPending}
          onClick={() => guardar.mutate({ colId: colegio.col_id, meses: ordenados, dia_limite: colegio.dia_limite })}
        >
          <Save className="mr-2 h-4 w-4" />
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      )}
    </TarjetaConfig>
  );
};

export default ConfigMensualidades;
