import { useState } from 'react';
import { CheckCircle2, FileText, Loader2, Mail, Pencil, Send, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { comunicadosApi, type ComunicadoListado, type EstadoVisible } from '@/api/comunicados';
import { useAccionComunicados, useComunicado, useComunicadosLista } from '@/hooks/useComunicados';
import VistaCorreo from './VistaCorreo';
import { fechaHora } from './util';


const ESTADO: Record<EstadoVisible, { texto: string; clase: string; Icono: typeof Send }> = {
  borrador: { texto: 'Borrador', clase: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', Icono: FileText },
  enviando: { texto: 'Enviando', clase: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200', Icono: Loader2 },
  enviado: { texto: 'Enviado', clase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200', Icono: CheckCircle2 },
  fallido: { texto: 'Falló', clase: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200', Icono: XCircle },
};

const Estado = ({ estado }: { estado: EstadoVisible }) => {
  const { texto, clase, Icono } = ESTADO[estado];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${clase}`}>
      <Icono className={`h-3 w-3 ${estado === 'enviando' ? 'animate-spin' : ''}`} />
      {texto}
    </span>
  );
};

/** El correo enviado y sus datos de envío. */
const Detalle = ({ id, onCerrar }: { id: number; onCerrar: () => void }) => {
  const c = useComunicado(id);
  const d = c.data;
  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[94vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="break-words pr-6">{d?.com_asunto || 'Comunicado'}</DialogTitle>
          <DialogDescription>Así salió el correo.</DialogDescription>
        </DialogHeader>
        {!d ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-md bg-muted/50 p-3 text-sm">
              <dt className="font-medium text-muted-foreground">Estado</dt>
              <dd>
                <Estado estado={d.estado} />
              </dd>
              <dt className="font-medium text-muted-foreground">Para</dt>
              <dd className="break-words">{d.com_destino_texto ?? '—'}</dd>
              <dt className="font-medium text-muted-foreground">Correos</dt>
              <dd>{d.com_total?.toLocaleString('es-EC') ?? '—'}</dd>
              <dt className="font-medium text-muted-foreground">Enviado</dt>
              <dd>{fechaHora(d.com_fecha_envio)}</dd>
              {d.autor && (
                <>
                  <dt className="font-medium text-muted-foreground">Por</dt>
                  <dd className="break-words">{d.autor}</dd>
                </>
              )}
              {d.estado === 'fallido' && d.com_error && (
                <>
                  <dt className="font-medium text-destructive">Motivo</dt>
                  <dd className="break-words text-destructive">{d.com_error}</dd>
                </>
              )}
            </dl>
            <VistaCorreo html={d.com_html ?? ''} className="h-[60vh] min-h-[360px]" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface Props {
  onAbrir: (id: number) => void;
}

const PestanaComunicados = ({ onAbrir }: Props) => {
  const lista = useComunicadosLista();
  const [detalle, setDetalle] = useState<number | null>(null);
  const [borrar, setBorrar] = useState<ComunicadoListado | null>(null);
  const eliminar = useAccionComunicados(comunicadosApi.borrar, () => 'Eliminado');

  const todos = lista.data ?? [];
  const borradores = todos.filter((c) => c.estado === 'borrador');
  const historial = todos.filter((c) => c.estado !== 'borrador');

  if (lista.isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {borradores.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Borradores</h2>
          <ul className="space-y-2">
            {borradores.map((c) => (
              <li key={c.com_id} className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onAbrir(c.com_id)}>
                  <p className="break-words font-medium">{c.com_asunto || 'Sin asunto'}</p>
                  <p className="text-xs text-muted-foreground">Guardado {fechaHora(c.com_fecha_modificacion)}</p>
                </button>
                <div className="flex gap-1 self-end sm:self-auto">
                  <Button variant="outline" size="sm" className="h-9" onClick={() => onAbrir(c.com_id)}>
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Seguir
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Eliminar borrador"
                    className="h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setBorrar(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Historial</h2>
        {historial.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            <Mail className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p>Aún no se ha enviado ningún comunicado.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {historial.map((c) => (
              <li key={c.com_id} className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
                <button type="button" className="min-w-0 flex-1 space-y-1 text-left" onClick={() => setDetalle(c.com_id)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Estado estado={c.estado} />
                    <span className="text-xs text-muted-foreground">{fechaHora(c.com_fecha_envio)}</span>
                  </div>
                  <p className="break-words font-medium">{c.com_asunto}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    {c.com_destino_texto}
                    {c.com_total !== null && ` · ${c.com_total.toLocaleString('es-EC')} correos`}
                  </p>
                </button>
                {c.estado !== 'enviando' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Quitar del historial"
                    className="h-9 self-end text-destructive hover:bg-destructive/10 hover:text-destructive sm:self-auto"
                    onClick={() => setBorrar(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {detalle !== null && <Detalle id={detalle} onCerrar={() => setDetalle(null)} />}

      <AlertDialog open={borrar !== null} onOpenChange={(v) => !v && setBorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {borrar?.estado === 'borrador' ? '¿Eliminar este borrador?' : '¿Quitar del historial?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {borrar?.estado === 'borrador'
                ? 'Se borra y no se puede recuperar.'
                : 'Deja de verse aquí. El correo que ya salió no se retira.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={eliminar.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => borrar && eliminar.mutate(borrar.com_id, { onSuccess: () => setBorrar(null) })}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PestanaComunicados;
