import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFichaEvaluacion } from '@/hooks/useEvaluaciones';
import EvaluacionPreview, { parametrosDeFicha } from './EvaluacionPreview';

interface Props {
  evaId: number | null;
  onClose: () => void;
}

/** Vista previa desde la card: trae la ficha + sus disciplinas vinculadas. */
const PrevisualizarEvaluacionDialog = ({ evaId, onClose }: Props) => {
  const ficha = useFichaEvaluacion(evaId);

  return (
    <Dialog open={evaId !== null} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Detalle de la evaluación</DialogTitle>
        </DialogHeader>
        {ficha.isLoading && (
          <p className="py-6 text-center text-muted-foreground">Cargando evaluación…</p>
        )}
        {ficha.data && (
          <EvaluacionPreview
            titulo={ficha.data.evaluacion.eva_titulo}
            descripcion={ficha.data.evaluacion.eva_descripcion ?? ''}
            categoria={ficha.data.evaluacion.eva_categoria ?? ''}
            parametros={parametrosDeFicha(ficha.data)}
            evaId={ficha.data.evaluacion.eva_id}
            onCerrar={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PrevisualizarEvaluacionDialog;
