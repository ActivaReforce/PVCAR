import { useState } from 'react';
import { ClipboardList, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { METODO, type EvaluacionDeHijo, type IntentoDeHijo, type ParametroDeHijo } from '@/api/evaluaciones';
import { fechaDia } from '@/lib/fecha';
import { enMinutos, esMobak, topeMobak } from './metodos';

/**
 * Las notas de los hijos del representante (pedido del cliente, 2026-10-20).
 *
 * La misma vista en el tablero (card "Evaluaciones") y en la pestaña "Mis
 * hijos" de Evaluaciones. Solo pinta: qué evaluaciones entran y la nota de
 * cada intento salen del servidor. El detalle se abre en un modal para no
 * estirar la página (pedido del cliente, 2026-10-20).
 */

const ESTADO_EVALUADO = 7;

const numero = (v: number) => v.toLocaleString('es-EC', { maximumFractionDigits: 2 });

/** Lo que se registró en un intento, dicho como lo leería un papá. */
function registrado(p: ParametroDeHijo, i: IntentoDeHijo): string {
  if (p.evatipometo_id === METODO.TIEMPO) {
    return i.evaint_tiempo === null ? '—' : enMinutos(i.evaint_tiempo);
  }
  if (p.evatipometo_id === METODO.LOGRO) {
    if (i.evaint_logro === null) return '—';
    return i.evaint_logro ? 'Lo logró' : 'No lo logró';
  }
  if (p.evatipometo_id === METODO.ESCALA) {
    if (i.evaint_num === null) return '—';
    return p.evaparam_escala_max === null
      ? String(i.evaint_num)
      : `${i.evaint_num} de ${p.evaparam_escala_max}`;
  }
  if (esMobak(p.evatipometo_id)) {
    return i.evaint_mobak === null ? '—' : `${i.evaint_mobak} de ${topeMobak(p.evatipometo_id)}`;
  }
  return '—';
}

const Detalle = ({ parametros }: { parametros: ParametroDeHijo[] }) => (
  <ul className="divide-y rounded-md border">
    {parametros.map((p) => {
      const obtenido = p.intentos.reduce((t, i) => t + i.evaint_puntaje_obtenido, 0);
      return (
        <li key={p.evaparam_id} className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 break-words text-sm font-medium">{p.evaparam_nombre}</span>
            <span className="flex-shrink-0 text-sm font-semibold tabular-nums">
              {numero(obtenido)} / {numero(p.evaparam_puntaje)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.intentos.map((i) => (
              <span
                key={i.evaint_intento}
                className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                {p.intentos.length > 1 && `Intento ${i.evaint_intento}: `}
                <strong className="font-medium text-foreground">{registrado(p, i)}</strong>
                {' · '}
                {numero(i.evaint_puntaje_obtenido)} pts
              </span>
            ))}
          </div>
        </li>
      );
    })}
  </ul>
);

const Fila = ({ e }: { e: EvaluacionDeHijo }) => {
  const [abierta, setAbierta] = useState(false);
  const evaluada = e.est_id === ESTADO_EVALUADO;
  const pct = e.eva_puntaje_total > 0 ? Math.round((e.puntaje / e.eva_puntaje_total) * 100) : 0;

  return (
    <li className="px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="break-words font-medium">{e.eva_titulo}</div>
          <div className="break-words text-sm text-muted-foreground">
            {e.act_nombre} · {e.col_nombre}
            {evaluada && ` · ${fechaDia(e.evaninopen_fecha_finalizacion)}`}
          </div>
        </div>
        {evaluada ? (
          <div className="flex-shrink-0 sm:text-right">
            <div className="text-lg font-semibold tabular-nums">
              {numero(e.puntaje)} / {numero(e.eva_puntaje_total)}
              <span className="ml-2 text-sm font-normal text-muted-foreground">{pct}%</span>
            </div>
          </div>
        ) : (
          <Badge variant="secondary" className="w-fit flex-shrink-0">
            Por evaluar
          </Badge>
        )}
      </div>

      {evaluada && (
        <>
          <Progress value={pct} className="mt-2 h-2" aria-label={`${pct}% del puntaje`} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {e.evaluado_por ? `Evaluó: ${e.evaluado_por}` : ''}
            </span>
            {e.parametros.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => setAbierta(true)}
              >
                <Eye className="mr-1 h-4 w-4" />
                Ver detalle
              </Button>
            )}
          </div>
          <Dialog open={abierta} onOpenChange={setAbierta}>
            <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="break-words pr-6">{e.eva_titulo}</DialogTitle>
                <DialogDescription className="break-words">
                  {e.nino_nombre} · {e.act_nombre} · {e.col_nombre} ·{' '}
                  {fechaDia(e.evaninopen_fecha_finalizacion)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <div className="text-lg font-semibold tabular-nums">
                  {numero(e.puntaje)} / {numero(e.eva_puntaje_total)}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">{pct}%</span>
                </div>
                <Progress value={pct} className="h-2" aria-label={`${pct}% del puntaje`} />
                {e.evaluado_por && (
                  <div className="text-xs text-muted-foreground">Evaluó: {e.evaluado_por}</div>
                )}
              </div>
              <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
                <Detalle parametros={e.parametros} />
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </li>
  );
};

interface Props {
  evaluaciones: EvaluacionDeHijo[];
}

const EvaluacionesDeHijos = ({ evaluaciones }: Props) => {
  if (evaluaciones.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-50" />
        <p>Todavía no hay evaluaciones de tus representados.</p>
      </div>
    );
  }

  // Ya vienen ordenadas por niño: se agrupan sin perder ese orden.
  const grupos: Array<{ nino_id: number; nombre: string; items: EvaluacionDeHijo[] }> = [];
  for (const e of evaluaciones) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.nino_id === e.nino_id) ultimo.items.push(e);
    else grupos.push({ nino_id: e.nino_id, nombre: e.nino_nombre, items: [e] });
  }

  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <section key={g.nino_id}>
          <h3 className="mb-2 break-words text-sm font-semibold">{g.nombre}</h3>
          <ul className="divide-y rounded-md border">
            {g.items.map((e) => (
              <Fila key={e.evaninopen_id} e={e} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default EvaluacionesDeHijos;
