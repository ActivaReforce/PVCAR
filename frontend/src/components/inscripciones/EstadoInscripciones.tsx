import { CircleCheck, CircleOff } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { usePermissions } from '@/hooks/usePermissions';
import { useAbrirColegio, useAbrirInscripciones, useEstadoInscripciones } from '@/hooks/useInscripciones';
import type { EstadoColegio } from '@/api/inscripciones';

/**
 * Abiertas o cerradas (pedido del cliente, 2026-10-05). Las reglas las
 * calcula el backend (calcularEstado): aquí se enseña el resultado, el
 * porqué y el interruptor.
 *
 * - General: interruptor encendido + los cuatro documentos generales
 *   publicados + al menos un colegio abierto.
 * - Colegio: interruptor encendido + ficha y contrato publicados + valores
 *   del colegio + al menos una disciplina activa.
 */

const Indicador = ({
  abierto,
  titulo,
  motivos,
  children,
}: {
  abierto: boolean;
  titulo: string;
  motivos: string[];
  children?: React.ReactNode;
}) => (
  <section
    className={`space-y-3 rounded-lg border p-4 ${
      abierto ? 'border-emerald-600/40 bg-emerald-500/10' : 'border-muted-foreground/30 bg-muted/40'
    }`}
  >
    <div className="flex items-start gap-3">
      {abierto ? (
        <CircleCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-700 dark:text-emerald-400" />
      ) : (
        <CircleOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{titulo}</p>
        {motivos.length > 0 && (
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
            {motivos.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
    {children}
  </section>
);

/** Para la pestaña Inscripciones: el estado general. */
export const EstadoGeneral = () => {
  const estado = useEstadoInscripciones();
  const abrir = useAbrirInscripciones();
  const { hasPermission } = usePermissions();

  if (!estado.data) return null;
  const e = estado.data;
  const abiertos = e.colegios.filter((c) => c.abierto);

  return (
    <Indicador
      abierto={e.abiertas}
      titulo={e.abiertas ? 'Inscripciones abiertas' : 'Inscripciones cerradas'}
      motivos={e.motivos}
    >
      {abiertos.length > 0 && (
        <p className="text-sm">
          <span className="text-muted-foreground">Colegios abiertos: </span>
          {abiertos.map((c) => c.col_nombre).join(', ')}
        </p>
      )}
      {hasPermission('inscripciones', 'editar') && (
        <div className="flex min-h-11 items-center gap-3">
          <Switch
            id="abrir-inscripciones"
            checked={e.interruptor}
            disabled={abrir.isPending}
            onCheckedChange={(v) => abrir.mutate(v)}
          />
          <Label htmlFor="abrir-inscripciones" className="cursor-pointer">
            Abrir inscripciones
          </Label>
        </div>
      )}
    </Indicador>
  );
};

/** Para Documentos → Por colegio: el estado de un colegio. */
export const EstadoDelColegio = ({ colId }: { colId: number }) => {
  const estado = useEstadoInscripciones();
  const abrir = useAbrirColegio();
  const { hasPermission } = usePermissions();

  const c: EstadoColegio | undefined = estado.data?.colegios.find((x) => x.col_id === colId);
  if (!c) return null;
  const sinValores = c.motivos.includes('Faltan los valores del colegio.');

  return (
    <Indicador
      abierto={c.abierto}
      titulo={c.abierto ? `Inscripciones abiertas en ${c.col_nombre}` : `Inscripciones cerradas en ${c.col_nombre}`}
      motivos={c.motivos}
    >
      {c.abierto && estado.data && !estado.data.abiertas && (
        <p className="text-sm text-muted-foreground">
          El colegio está listo, pero el formulario sigue cerrado: mira el estado general en la pestaña
          Inscripciones.
        </p>
      )}
      {hasPermission('inscripciones', 'editar') && (
        <div className="flex min-h-11 items-center gap-3">
          <Switch
            id={`abrir-colegio-${colId}`}
            checked={c.interruptor}
            disabled={abrir.isPending || sinValores}
            onCheckedChange={(v) => abrir.mutate({ colId, abiertas: v })}
          />
          <Label htmlFor={`abrir-colegio-${colId}`} className="cursor-pointer">
            Abrir inscripciones en este colegio
          </Label>
          {sinValores && <span className="text-xs text-muted-foreground">Primero guarda sus valores.</span>}
        </div>
      )}
    </Indicador>
  );
};
