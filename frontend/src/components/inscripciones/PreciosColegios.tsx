import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/hooks/usePermissions';
import { useBorrarPrecio, useGuardarPrecio, usePrecios } from '@/hooks/useInscripciones';
import { dinero, type PrecioColegio } from '@/api/inscripciones';

/**
 * Precio mensual de inscripción por colegio.
 *
 * Dentro de un colegio todas las disciplinas cuestan lo mismo. Si en una
 * misma inscripción van hermanos, lidera el que más disciplinas tiene (paga
 * completo) y cada hermano lleva el descuento de su colegio en tantas
 * disciplinas como el que lidera.
 *
 * Un colegio sin precio **no aparece** en el formulario público.
 */
const PreciosColegios = () => {
  const precios = usePrecios();

  if (precios.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (precios.isError || !precios.data) {
    return (
      <p className="text-sm text-destructive">
        No se pudieron cargar los precios: {(precios.error as Error | null)?.message}
      </p>
    );
  }

  const sinPrecio = precios.data.filter((p) => p.precio === null && p.disciplinas_activas > 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Precio mensual por disciplina. Si se inscriben hermanos juntos, el que más disciplinas tiene
        paga completo, y cada hermano lleva el descuento en tantas disciplinas como él: si el
        primero va a 1, el hermano tiene descuento en 1; si va a 5, en hasta 5.
      </p>
      {sinPrecio.length > 0 && (
        <div className="rounded-md border border-amber-600/50 bg-amber-500/10 p-3 text-sm">
          <span className="font-medium">
            {sinPrecio.length} colegio{sinPrecio.length === 1 ? '' : 's'} sin precio
          </span>{' '}
          <span className="text-muted-foreground">no aparecen en el formulario de inscripción.</span>
        </div>
      )}
      <ul className="space-y-3">
        {precios.data.map((p) => (
          <FilaPrecio key={p.col_id} fila={p} />
        ))}
      </ul>
    </div>
  );
};

const FilaPrecio = ({ fila }: { fila: PrecioColegio }) => {
  const { hasPermission } = usePermissions();
  const puedeEditar = hasPermission('inscripciones', 'editar');
  const guardar = useGuardarPrecio();
  const quitar = useBorrarPrecio();

  const [precio, setPrecio] = useState('');
  const [descuento, setDescuento] = useState('');

  useEffect(() => {
    setPrecio(fila.precio !== null ? String(fila.precio) : '');
    setDescuento(fila.descuento_hermano !== null ? String(fila.descuento_hermano) : '0');
  }, [fila.precio, fila.descuento_hermano]);

  const nPrecio = Number(precio.replace(',', '.'));
  const nDescuento = Number(descuento.replace(',', '.') || '0');
  const valido =
    precio.trim() !== '' &&
    Number.isFinite(nPrecio) &&
    nPrecio > 0 &&
    Number.isFinite(nDescuento) &&
    nDescuento >= 0 &&
    nDescuento <= 100;
  const cambiado =
    nPrecio !== fila.precio ||
    nDescuento !== (fila.descuento_hermano ?? 0);

  const id = (c: string) => `precio-${fila.col_id}-${c}`;

  return (
    <li className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium" title={fila.col_nombre}>
            {fila.col_nombre}
          </p>
          <p className="text-xs text-muted-foreground">
            {fila.disciplinas_activas} disciplina{fila.disciplinas_activas === 1 ? '' : 's'} activa
            {fila.disciplinas_activas === 1 ? '' : 's'}
          </p>
        </div>
        {fila.precio === null ? (
          <Badge variant="secondary">Sin precio</Badge>
        ) : (
          <Badge variant="outline">
            {dinero(fila.precio)} al mes
            {fila.descuento_hermano ? ` · ${fila.descuento_hermano} % hermanos` : ''}
          </Badge>
        )}
      </div>

      {puedeEditar && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor={id('precio')}>Precio mensual por disciplina (USD)</Label>
            <Input
              id={id('precio')}
              inputMode="decimal"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="45,00"
              className="h-11 sm:h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={id('descuento')}>Descuento por hermano (%)</Label>
            <Input
              id={id('descuento')}
              inputMode="decimal"
              value={descuento}
              onChange={(e) => setDescuento(e.target.value)}
              className="h-11 sm:h-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="h-11 flex-1 sm:h-10"
              disabled={!valido || !cambiado || guardar.isPending}
              onClick={() =>
                guardar.mutate({
                  colId: fila.col_id,
                  datos: {
                    precio: Math.round(nPrecio * 100) / 100,
                    descuento_hermano: nDescuento,
                  },
                })
              }
            >
              Guardar
            </Button>
            {fila.precio !== null && (
              <Button
                variant="ghost"
                className="h-11 text-destructive sm:h-10"
                disabled={quitar.isPending}
                onClick={() => quitar.mutate(fila.col_id)}
                title="El colegio deja de aparecer en el formulario"
              >
                Quitar
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
};

export default PreciosColegios;
