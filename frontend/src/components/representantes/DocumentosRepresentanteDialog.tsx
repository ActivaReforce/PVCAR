import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { inscripcionesApi } from '@/api/inscripciones';
import { fechaCorta } from '@/components/inscripciones/formato';

/**
 * Los documentos firmados de un representante: un PDF por alumno de cada
 * inscripción aprobada (ficha, contrato, autorizaciones y constancias, con
 * "Aprobado por"). Solo para quien ve Inscripciones: llevan datos de salud
 * de menores.
 *
 * Sin caché: las URLs están firmadas por diez minutos.
 */
const DocumentosRepresentanteDialog = ({
  usuId,
  nombre,
  onClose,
}: {
  usuId: number | null;
  nombre: string;
  onClose: () => void;
}) => {
  const documentos = useQuery({
    queryKey: ['inscripciones', 'representante', usuId ?? 0],
    queryFn: () => inscripcionesApi.documentosDeRepresentante(usuId as number),
    enabled: usuId !== null,
    staleTime: 0,
    gcTime: 0,
  });

  return (
    <Dialog open={usuId !== null} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="break-words text-lg sm:text-xl">Documentos de {nombre}</DialogTitle>
          <DialogDescription>Ficha, contrato y autorizaciones firmados, uno por alumno.</DialogDescription>
        </DialogHeader>

        {documentos.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {documentos.isError && (
          <p className="text-sm text-destructive">
            No se pudieron cargar: {(documentos.error as Error).message}
          </p>
        )}
        {documentos.data && documentos.data.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No tiene documentos: no llegó por una inscripción en línea.
          </p>
        )}
        {documentos.data && documentos.data.length > 0 && (
          <ul className="divide-y rounded-md border">
            {documentos.data.map((d) => (
              <li key={`${d.ins_id}-${d.alumno}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.alumno}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.colegio ?? '—'} · inscrito el {fechaCorta(d.ins_fecha)}
                  </p>
                </div>
                {d.url ? (
                  <Button variant="outline" size="sm" asChild className="h-10 flex-shrink-0 sm:h-9">
                    <a href={d.url} target="_blank" rel="noreferrer">
                      <FileText className="mr-2 h-4 w-4" /> Ver
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                ) : (
                  <span className="text-xs text-destructive">No disponible</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentosRepresentanteDialog;
