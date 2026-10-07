import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TIPO } from '@/api/encuestas';
import type { PreguntaParaPintar, ValorRespuesta } from './respuesta';


/**
 * Una pregunta tal como la ve el representante: el enunciado, la aclaración y
 * el control de su tipo. Lo usan el modal de responder y la vista previa del
 * constructor, así que la vista previa es fiel por construcción.
 *
 * `soloLectura`: la vista previa. Se ve igual pero no se puede contestar.
 */
const CampoPregunta = ({
  pregunta,
  valor,
  onCambio,
  soloLectura = false,
}: {
  pregunta: PreguntaParaPintar;
  valor: ValorRespuesta;
  onCambio?: (cambios: Partial<ValorRespuesta>) => void;
  soloLectura?: boolean;
}) => {
  const cambiar = (c: Partial<ValorRespuesta>) => {
    if (!soloLectura) onCambio?.(c);
  };
  const min = pregunta.encupreg_escala_min ?? 1;
  const max = pregunta.encupreg_escala_max ?? 5;
  const escala = max >= min ? Array.from({ length: max - min + 1 }, (_, i) => min + i) : [];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="break-words font-medium">{pregunta.encupreg_pregunta || 'Sin enunciado'}</h3>
        {pregunta.encupreg_nota && <p className="mt-1 text-sm text-muted-foreground">{pregunta.encupreg_nota}</p>}
      </div>

      {pregunta.encutiporesp_id === TIPO.TEXTO_CORTO && (
        <Input
          value={valor.texto}
          onChange={(e) => cambiar({ texto: e.target.value })}
          readOnly={soloLectura}
          className="h-11 sm:h-10"
          aria-label={pregunta.encupreg_pregunta}
        />
      )}

      {pregunta.encutiporesp_id === TIPO.TEXTO_LARGO && (
        <Textarea
          value={valor.texto}
          onChange={(e) => cambiar({ texto: e.target.value })}
          readOnly={soloLectura}
          rows={4}
          className="resize-none"
          aria-label={pregunta.encupreg_pregunta}
        />
      )}

      {pregunta.encutiporesp_id === TIPO.ESCALA && (
        <div className="flex flex-wrap gap-2">
          {escala.map((n) => (
            <Button
              key={n}
              type="button"
              variant={valor.numero === n ? 'default' : 'outline'}
              className="h-11 w-11 p-0"
              onClick={() => cambiar({ numero: n })}
              aria-disabled={soloLectura}
            >
              {n}
            </Button>
          ))}
        </div>
      )}

      {pregunta.encutiporesp_id === TIPO.FECHA && (
        <Input
          type="date"
          value={valor.fecha}
          onChange={(e) => cambiar({ fecha: e.target.value })}
          readOnly={soloLectura}
          className="h-11 sm:h-10"
          aria-label={pregunta.encupreg_pregunta}
        />
      )}

      {pregunta.encutiporesp_id === TIPO.HORA && (
        <Input
          type="time"
          value={valor.hora}
          onChange={(e) => cambiar({ hora: e.target.value })}
          readOnly={soloLectura}
          className="h-11 w-36 sm:h-10"
          aria-label={pregunta.encupreg_pregunta}
        />
      )}

      {pregunta.encutiporesp_id === TIPO.SI_NO && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={valor.sino === true ? 'default' : 'outline'}
            className="h-11"
            onClick={() => cambiar({ sino: true })}
            aria-disabled={soloLectura}
          >
            Sí
          </Button>
          <Button
            type="button"
            variant={valor.sino === false ? 'default' : 'outline'}
            className="h-11"
            onClick={() => cambiar({ sino: false })}
            aria-disabled={soloLectura}
          >
            No
          </Button>
        </div>
      )}
    </div>
  );
};

export default CampoPregunta;
