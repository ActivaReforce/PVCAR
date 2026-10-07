import { useState } from 'react';
import { ClipboardList, Download, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFichaInscripcion, useInscripciones } from '@/hooks/useInscripciones';
import { fechaCorta, fechaHora } from './formato';

const VERDE =
  'border-transparent bg-emerald-700 text-white hover:bg-emerald-700 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-400';

const Estado = ({ estado }: { estado: 'pendiente' | 'aprobada' }) => (
  <Badge variant="secondary" className={estado === 'aprobada' ? VERDE : undefined}>
    {estado === 'aprobada' ? 'Aprobada' : 'En revisión'}
  </Badge>
);

/**
 * Inscripciones vistas por un representante (decisión del cliente,
 * 2026-10-05): solo las suyas, y de cada una lo que le interesa —sus hijos,
 * en qué colegio y disciplinas, y sus documentos firmados—. Nada de lo que
 * sirve para decidir (otros usuarios, bloqueos, aprobar, rechazar). El
 * backend ya filtra: aunque pidiera otra, no se la devolvería.
 */
const MisInscripciones = () => {
  const lista = useInscripciones({});
  const [abierta, setAbierta] = useState<number | null>(null);
  const items = lista.data?.items ?? [];

  return (
    <div className="container mx-auto min-w-0 max-w-3xl space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Mis inscripciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tus inscripciones y los documentos firmados de tus hijos.
        </p>
      </div>

      {lista.isLoading && <p className="py-8 text-center text-muted-foreground">Cargando…</p>}
      {lista.isError && (
        <p className="text-destructive">No se pudieron cargar: {(lista.error as Error).message}</p>
      )}

      {lista.data && items.length === 0 && (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="text-lg">No tienes inscripciones</p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-lg border">
          {items.map((i) => (
            <li key={i.ins_id}>
              <button
                type="button"
                onClick={() => setAbierta(i.ins_id)}
                className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{i.ninos.join(', ')}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {i.colegios.join(', ')} · enviada el {fechaCorta(i.ins_fecha)}
                  </div>
                </div>
                <Estado estado={i.ins_estado} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <FichaPropia id={abierta} onClose={() => setAbierta(null)} />
    </div>
  );
};

const FichaPropia = ({ id, onClose }: { id: number | null; onClose: () => void }) => {
  const ficha = useFichaInscripcion(id);
  const d = ficha.data;

  return (
    <Dialog open={id !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Inscripción {d && <Estado estado={d.ins_estado} />}
          </DialogTitle>
          <DialogDescription>{d ? `Enviada el ${fechaHora(d.ins_fecha)}` : 'Cargando…'}</DialogDescription>
        </DialogHeader>

        {ficha.isError && (
          <p className="text-sm text-destructive">No se pudo cargar: {(ficha.error as Error).message}</p>
        )}

        {d && (
          <div className="space-y-4">
            {d.ins_estado === 'pendiente' && (
              <p className="text-sm text-muted-foreground">
                Activa Reforce está revisando tu inscripción y tu comprobante. Cuando la apruebe, aquí
                tendrás los documentos firmados por Activa.
              </p>
            )}
            {d.ninos.map((n) => (
              <div key={n.insnino_id} className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{n.datos.nombre}</p>
                  {n.paquete_url && (
                    <Button variant="outline" size="sm" asChild className="h-10 sm:h-9">
                      <a href={n.paquete_url} target="_blank" rel="noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        {d.ins_estado === 'aprobada' ? 'Documentos firmados' : 'Documentos'}
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {n.colegio ?? n.datos.documento.colegio.sede}
                  {n.grado && ` · ${n.grado}`}
                </p>
                <ul className="space-y-0.5 text-sm">
                  {n.disciplinas.map((x) => (
                    <li key={x.colacthor_id}>{x.descripcion}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MisInscripciones;
