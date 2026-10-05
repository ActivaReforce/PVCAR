import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/hooks/usePermissions';
import { useBorrarPrecio, useGuardarPrecio } from '@/hooks/useInscripciones';
import { dinero, type PrecioColegio } from '@/api/inscripciones';

interface Campos {
  precio: string;
  descuento: string;
  sede: string;
  sede_corta: string;
  institucion: string;
  minimo: string;
}

const camposDe = (f: PrecioColegio): Campos => ({
  precio: f.precio !== null ? String(f.precio) : '',
  descuento: f.descuento_hermano !== null ? String(f.descuento_hermano) : '0',
  sede: f.sede ?? f.col_nombre,
  sede_corta: f.sede_corta ?? '',
  institucion: f.institucion ?? '',
  minimo: f.minimo_alumnos !== null ? String(f.minimo_alumnos) : '',
});

/**
 * Lo de un colegio que usan la inscripción y sus documentos: la tarifa
 * mensual, el descuento por hermano, el mínimo de alumnos y cómo se nombra
 * la sede. La ficha y el contrato son un texto común para todos; estos datos
 * entran en él con marcadores ({{sede}}, {{tarifa}}…).
 *
 * Dentro de un colegio todas las disciplinas cuestan lo mismo. Si en una
 * misma inscripción van hermanos, lidera el que más disciplinas tiene (paga
 * completo) y cada hermano lleva el descuento de su colegio en tantas
 * disciplinas como el que lidera.
 *
 * Un colegio sin precio **no aparece** en el formulario público.
 */
const DatosColegio = ({ fila }: { fila: PrecioColegio }) => {
  const { hasPermission } = usePermissions();
  const puedeEditar = hasPermission('inscripciones', 'editar');
  const guardar = useGuardarPrecio();
  const quitar = useBorrarPrecio();

  const [c, setC] = useState<Campos>(() => camposDe(fila));
  useEffect(() => {
    setC(camposDe(fila));
  }, [fila]);
  const poner = (campo: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setC((x) => ({ ...x, [campo]: e.target.value }));

  const nPrecio = Number(c.precio.replace(',', '.'));
  const nDescuento = Number(c.descuento.replace(',', '.') || '0');
  const nMinimo = Number(c.minimo);
  const valido =
    c.precio.trim() !== '' &&
    Number.isFinite(nPrecio) &&
    nPrecio > 0 &&
    Number.isFinite(nDescuento) &&
    nDescuento >= 0 &&
    nDescuento <= 100 &&
    c.sede.trim().length >= 3 &&
    c.sede_corta.trim().length >= 2 &&
    c.institucion.trim().length >= 2 &&
    Number.isInteger(nMinimo) &&
    nMinimo >= 1;
  const original = camposDe(fila);
  const cambiado = (Object.keys(c) as Array<keyof Campos>).some((k) => c[k] !== original[k]);

  const id = (x: string) => `precio-${fila.col_id}-${x}`;
  const campoDe = ({ campo, etiqueta, ayuda, ...resto }: {
    campo: keyof Campos;
    etiqueta: string;
    ayuda?: string;
  } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="space-y-1.5">
      <Label htmlFor={id(campo)}>{etiqueta}</Label>
      <Input id={id(campo)} value={c[campo]} onChange={poner(campo)} className="h-11 sm:h-10" {...resto} />
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );

  return (
    <div className="space-y-3 rounded-lg border p-4">
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
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {campoDe({ campo: 'precio', etiqueta: 'Tarifa mensual', ayuda: 'Por disciplina, en dólares, sin IVA.', inputMode: 'decimal' })}
            {campoDe({ campo: 'descuento', etiqueta: 'Descuento por hermano', ayuda: 'En porcentaje.', inputMode: 'decimal' })}
            {campoDe({ campo: 'minimo', etiqueta: 'Mínimo de alumnos por grupo', ayuda: 'Para abrir un grupo.', inputMode: 'numeric' })}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {campoDe({ campo: 'sede', etiqueta: 'Nombre de la sede', ayuda: 'El nombre completo: sale en la ficha y al inicio del contrato.' })}
            {campoDe({ campo: 'sede_corta', etiqueta: 'Nombre corto de la sede', ayuda: 'Para frases cortas del contrato: la tarifa y el mínimo de alumnos.' })}
            {campoDe({ campo: 'institucion', etiqueta: 'Nombre de la institución', ayuda: 'Cómo se nombra al colegio en las cláusulas: enfermería, mora, salidas.' })}
          </div>
          <div className="flex gap-2">
            <Button
              className="h-11 sm:h-10"
              disabled={!valido || !cambiado || guardar.isPending}
              onClick={() =>
                guardar.mutate({
                  colId: fila.col_id,
                  datos: {
                    precio: Math.round(nPrecio * 100) / 100,
                    descuento_hermano: nDescuento,
                    sede: c.sede.trim(),
                    sede_corta: c.sede_corta.trim(),
                    institucion: c.institucion.trim(),
                    minimo_alumnos: nMinimo,
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
        </>
      )}
      <p className="text-xs text-muted-foreground">
        La tarifa es sin IVA; al representante se le suma el 15 %. Con hermanos en la misma inscripción, el que más
        disciplinas tiene paga completo y cada hermano lleva el descuento en tantas disciplinas como él.
      </p>
    </div>
  );
};

export default DatosColegio;
