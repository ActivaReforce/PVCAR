import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Grafica from '@/components/graficas/Grafica';
import SelectorBuscable from './SelectorBuscable';
import { useOpcionesHistorico, useResumenHistorico } from '@/hooks/useHistorico';
import type { FiltrosResumen, Indicadores } from '@/api/historico';

const entero = (n: number | null | undefined) => (n ?? 0).toLocaleString('es-EC');
const porcentaje = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n} %`);

/** "2026-03-01" -> "1 mar 2026", sin pasar por Date para no correr de día por la zona. */
function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(d)} ${meses[Number(m) - 1] ?? m} ${a}`;
}

/**
 * Una cifra con su nombre. Sin color: un número no es una marca de datos y el
 * color de este sistema ya tiene dueño (la escala de asistencia).
 */
function Cifra({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-muted-foreground">{detalle}</p>}
    </div>
  );
}

function Cifras({ i }: { i: Indicadores }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Cifra titulo="Alumnos" valor={entero(i.alumnos)} />
      <Cifra titulo="Colegios" valor={entero(i.colegios)} />
      <Cifra titulo="Disciplinas" valor={entero(i.disciplinas)} />
      <Cifra titulo="Entrenadores" valor={entero(i.entrenadores)} detalle="con alguna disciplina asignada" />
      <Cifra titulo="Inscripciones" valor={entero(i.inscripciones)} />
      <Cifra
        titulo="Asistencias de alumnos"
        valor={entero(i.asistencias)}
        detalle={`${porcentaje(i.pct_presencia)} presentes`}
      />
      <Cifra
        titulo="Asistencias de entrenadores"
        valor={entero(i.asistencias_entrenadores)}
        detalle={`${porcentaje(i.pct_presencia_entrenadores)} presentes`}
      />
      <Cifra
        titulo="Periodo con asistencia"
        valor={fechaCorta(i.primera)}
        detalle={`hasta ${fechaCorta(i.ultima)}`}
      />
    </div>
  );
}

/**
 * El panorama de la plataforma anterior.
 *
 * Tres filtros —colegio y rango de fechas— porque son los únicos que
 * significan lo mismo en todas las cifras y gráficas. Lo fino se hace en la
 * pestaña de Datos.
 */
const ResumenHistorico = () => {
  const [colegio, setColegio] = useState<number | undefined>();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const opciones = useOpcionesHistorico();
  const filtros: FiltrosResumen = { colegio, desde: desde || undefined, hasta: hasta || undefined };
  const resumen = useResumenHistorico(filtros);
  const hayFiltros = colegio !== undefined || desde !== '' || hasta !== '';
  const rango = opciones.data?.rango;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
        <div className="space-y-1">
          <Label className="text-xs">Colegio</Label>
          <SelectorBuscable
            etiqueta="Colegio"
            todos="Todos los colegios"
            opciones={opciones.data?.colegios ?? []}
            valor={colegio}
            onChange={setColegio}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:col-span-1 lg:contents">
          <div className="space-y-1">
            <Label htmlFor="resumen-desde" className="text-xs">
              Desde
            </Label>
            <Input
              id="resumen-desde"
              type="date"
              value={desde}
              min={rango?.desde ?? undefined}
              max={hasta || rango?.hasta || undefined}
              onChange={(e) => setDesde(e.target.value)}
              className="h-11 sm:h-10"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="resumen-hasta" className="text-xs">
              Hasta
            </Label>
            <Input
              id="resumen-hasta"
              type="date"
              value={hasta}
              min={desde || rango?.desde || undefined}
              max={rango?.hasta ?? undefined}
              onChange={(e) => setHasta(e.target.value)}
              className="h-11 sm:h-10"
            />
          </div>
        </div>
        <Button
          variant="ghost"
          className="h-11 sm:h-10"
          disabled={!hayFiltros}
          onClick={() => {
            setColegio(undefined);
            setDesde('');
            setHasta('');
          }}
        >
          <X className="mr-1 h-4 w-4" />
          Limpiar
        </Button>
      </div>

      {resumen.isError && (
        <p className="py-8 text-center text-destructive">{(resumen.error as Error).message}</p>
      )}
      {resumen.isLoading && <p className="py-12 text-center text-muted-foreground">Calculando…</p>}

      {resumen.data && (
        <div className={resumen.isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <Cifras i={resumen.data.indicadores} />
          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {resumen.data.graficas.map((g) => (
              <Grafica key={g.id} grafica={g} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumenHistorico;
