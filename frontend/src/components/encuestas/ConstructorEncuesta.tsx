import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TIPO, type FichaEncuesta, type PreguntaInput } from '@/api/encuestas';
import {
  useActualizarEncuesta,
  useCrearEncuesta,
  useGuardarPreguntas,
  useTiposRespuesta,
} from '@/hooks/useEncuestas';

interface Props {
  /** Null al crear. */
  ficha: FichaEncuesta | null;
  onListo: (encuId: number) => void;
  onCancelar: () => void;
}

const preguntaVacia = (): PreguntaInput => ({
  encupreg_pregunta: '',
  encupreg_nota: '',
  encutiporesp_id: TIPO.TEXTO_CORTO,
  encupreg_escala_min: null,
  encupreg_escala_max: null,
});

/**
 * El constructor de encuestas.
 *
 * **El orden es la posición en la lista**, no un campo que se edite. Así no
 * puede llegar un orden repetido ni un hueco en la numeración, que es lo que
 * pasaba cuando el navegador lo recalculaba al reordenar y el índice único
 * `uq_pregunta_orden` de la migración 0012 ni siquiera existía.
 *
 * Solo se abre en **borrador**. Una encuesta finalizada o publicada no se
 * edita, y no es rigidez: si se le cambia una pregunta a mitad de camino, las
 * respuestas de antes y las de después contestan a cosas distintas.
 */
const ConstructorEncuesta = ({ ficha, onListo, onCancelar }: Props) => {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [preguntas, setPreguntas] = useState<PreguntaInput[]>([preguntaVacia()]);

  const tipos = useTiposRespuesta();
  const crear = useCrearEncuesta();
  const actualizar = useActualizarEncuesta();
  const guardarPreguntas = useGuardarPreguntas();

  useEffect(() => {
    if (!ficha) return;
    setTitulo(ficha.encuesta.encu_titulo);
    setDescripcion(ficha.encuesta.encu_descripcion ?? '');
    setPreguntas(
      ficha.preguntas.length > 0
        ? ficha.preguntas.map((p) => ({
            encupreg_id: p.encupreg_id,
            encupreg_pregunta: p.encupreg_pregunta,
            encupreg_nota: p.encupreg_nota ?? '',
            encutiporesp_id: p.encutiporesp_id,
            encupreg_escala_min: p.encupreg_escala_min,
            encupreg_escala_max: p.encupreg_escala_max,
          }))
        : [preguntaVacia()],
    );
  }, [ficha]);

  const cambiar = (indice: number, cambios: Partial<PreguntaInput>) => {
    setPreguntas((previas) => previas.map((p, i) => (i === indice ? { ...p, ...cambios } : p)));
  };

  /** Cambiar de tipo tira lo que era propio del anterior. */
  const cambiarTipo = (indice: number, valor: string) => {
    const tipo = Number(valor);
    cambiar(indice, {
      encutiporesp_id: tipo,
      encupreg_escala_min: tipo === TIPO.ESCALA ? 1 : null,
      encupreg_escala_max: tipo === TIPO.ESCALA ? 5 : null,
    });
  };

  const mover = (indice: number, direccion: -1 | 1) => {
    const destino = indice + direccion;
    if (destino < 0 || destino >= preguntas.length) return;
    setPreguntas((previas) => {
      const copia = [...previas];
      [copia[indice], copia[destino]] = [copia[destino]!, copia[indice]!];
      return copia;
    });
  };

  const faltaAlgo =
    titulo.trim().length < 3 ||
    preguntas.length === 0 ||
    preguntas.some((p) => p.encupreg_pregunta.trim().length < 3);

  const guardando = crear.isPending || actualizar.isPending || guardarPreguntas.isPending;

  const guardar = async () => {
    const detalles = { encu_titulo: titulo.trim(), encu_descripcion: descripcion.trim() };
    try {
      if (!ficha) {
        const creada = await crear.mutateAsync({ ...detalles, preguntas });
        onListo(creada.encuesta.encu_id);
        return;
      }
      const encuId = ficha.encuesta.encu_id;
      await actualizar.mutateAsync({ id: encuId, datos: detalles });
      await guardarPreguntas.mutateAsync({ id: encuId, preguntas });
      onListo(encuId);
    } catch {
      // El hook ya enseña el motivo; el formulario conserva lo escrito.
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="encu-titulo">Título</Label>
          <Input
            id="encu-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Satisfacción del primer trimestre"
            className="h-11 sm:h-10"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="encu-descripcion">Descripción</Label>
          <Textarea
            id="encu-descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Para qué es y qué se va a hacer con las respuestas"
            rows={2}
            className="resize-none"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">
            Preguntas{' '}
            <span className="text-sm font-normal text-muted-foreground">
              · {preguntas.length}
            </span>
          </h3>
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-10"
            onClick={() => setPreguntas((p) => [...p, preguntaVacia()])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Añadir
          </Button>
        </div>

        {preguntas.map((pregunta, indice) => (
          <div key={indice} className="space-y-3 rounded-lg border p-3 sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Pregunta {indice + 1}
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => mover(indice, -1)}
                  disabled={indice === 0}
                  aria-label={`Subir la pregunta ${indice + 1}`}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => mover(indice, 1)}
                  disabled={indice === preguntas.length - 1}
                  aria-label={`Bajar la pregunta ${indice + 1}`}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  onClick={() => setPreguntas((p) => p.filter((_, i) => i !== indice))}
                  aria-label={`Quitar la pregunta ${indice + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor={`preg-${indice}`}>La pregunta</Label>
              <Input
                id={`preg-${indice}`}
                value={pregunta.encupreg_pregunta}
                onChange={(e) => cambiar(indice, { encupreg_pregunta: e.target.value })}
                placeholder="¿Cómo valoras el trimestre?"
                className="h-11 sm:h-10"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor={`nota-${indice}`}>Aclaración (opcional)</Label>
              <Input
                id={`nota-${indice}`}
                value={pregunta.encupreg_nota ?? ''}
                onChange={(e) => cambiar(indice, { encupreg_nota: e.target.value })}
                placeholder="Se enseña debajo de la pregunta"
                className="h-11 sm:h-10"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`tipo-${indice}`}>Tipo de respuesta</Label>
                <Select
                  value={String(pregunta.encutiporesp_id)}
                  onValueChange={(v) => cambiarTipo(indice, v)}
                >
                  <SelectTrigger id={`tipo-${indice}`} className="h-11 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(tipos.data ?? []).map((t) => (
                      <SelectItem key={t.encutiporesp_id} value={String(t.encutiporesp_id)}>
                        {t.encutiporesp_nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {pregunta.encutiporesp_id === TIPO.ESCALA && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor={`min-${indice}`}>Mínimo</Label>
                    <Input
                      id={`min-${indice}`}
                      type="number"
                      min={0}
                      value={pregunta.encupreg_escala_min ?? 1}
                      onChange={(e) =>
                        cambiar(indice, { encupreg_escala_min: Number(e.target.value) })
                      }
                      className="h-11 sm:h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`max-${indice}`}>Máximo</Label>
                    <Input
                      id={`max-${indice}`}
                      type="number"
                      min={1}
                      value={pregunta.encupreg_escala_max ?? 5}
                      onChange={(e) =>
                        cambiar(indice, { encupreg_escala_max: Number(e.target.value) })
                      }
                      className="h-11 sm:h-10"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-11 sm:h-10" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="brand"
          className="h-11 sm:h-10"
          onClick={guardar}
          disabled={faltaAlgo || guardando}
        >
          {guardando ? 'Guardando…' : ficha ? 'Guardar cambios' : 'Crear en borrador'}
        </Button>
      </div>
    </div>
  );
};

export default ConstructorEncuesta;
