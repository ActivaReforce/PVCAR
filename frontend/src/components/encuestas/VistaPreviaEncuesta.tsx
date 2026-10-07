import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import CampoPregunta from './CampoPregunta';
import { valorVacio, type PreguntaParaPintar } from './respuesta';

/**
 * Cómo verá la encuesta un representante: el mismo modal, una pregunta por
 * pantalla y con los mismos controles (CampoPregunta), pero sin poder
 * contestar ni enviar. Solo se navega y se cierra para volver a editar.
 */
const VistaPreviaEncuesta = ({
  abierta,
  titulo,
  descripcion,
  preguntas,
  onCerrar,
}: {
  abierta: boolean;
  titulo: string;
  descripcion: string | null;
  preguntas: PreguntaParaPintar[];
  onCerrar: () => void;
}) => {
  const [paso, setPaso] = useState(0);
  useEffect(() => {
    if (abierta) setPaso(0);
  }, [abierta]);

  const pregunta = preguntas[paso];

  return (
    <Dialog open={abierta} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Eye className="h-3.5 w-3.5" /> Vista previa · así la verán los representantes
        </p>
        <DialogHeader>
          <DialogTitle className="break-words text-lg sm:text-xl">{titulo.trim() || 'Sin título'}</DialogTitle>
          {descripcion?.trim() && (
            <DialogDescription className="break-words">{descripcion}</DialogDescription>
          )}
        </DialogHeader>

        {pregunta ? (
          <>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Pregunta {paso + 1} de {preguntas.length}
              </div>
              <Progress value={((paso + 1) / preguntas.length) * 100} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              <CampoPregunta pregunta={pregunta} valor={valorVacio()} soloLectura />
            </div>

            <div className="flex gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={() => setPaso((p) => Math.max(0, p - 1))}
                disabled={paso === 0}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={() => setPaso((p) => Math.min(preguntas.length - 1, p + 1))}
                disabled={paso === preguntas.length - 1}
              >
                Siguiente <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Todavía no tiene preguntas.</p>
        )}

        <Button type="button" variant="brand" className="h-11 w-full" onClick={onCerrar}>
          Cerrar
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default VistaPreviaEncuesta;
