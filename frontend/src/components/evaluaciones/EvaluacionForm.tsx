import { useEffect, useState } from 'react';
import { Eye, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { METODO, type FichaEvaluacion, type ParametroInput } from '@/api/evaluaciones';
import {
  useActualizarEvaluacion,
  useCategoriasEvaluacion,
  useCrearEvaluacion,
  useGuardarParametros,
} from '@/hooks/useEvaluaciones';
import ParametroCampos, { validarRango } from './ParametroCampos';
import EvaluacionPreview from './EvaluacionPreview';

interface Props {
  /** Null al crear. */
  ficha: FichaEvaluacion | null;
  onListo: (evaId: number) => void;
  onCancelar: () => void;
}

const parametroVacio = (): ParametroInput => ({
  evaparam_nombre: '',
  evaparam_nota: '',
  evatipometo_id: METODO.LOGRO,
  evaparam_intentos: 1,
  evaparam_puntaje: 1,
  evaparam_escala_min: null,
  evaparam_escala_max: null,
  rango: null,
});

/**
 * Alta y edición de una evaluación, en un solo formulario.
 *
 * El sistema viejo lo partía en dos pasos —detalles y después parámetros— con
 * un asistente que impedía volver atrás sin perder lo escrito. Aquí es una
 * pantalla: los detalles arriba, los parámetros debajo, y **"Añadir
 * parámetro" al final de la lista** como en Encuestas (pedido del cliente,
 * 2026-10-15). El puntaje total lo mantiene el trigger de la base.
 */
const EvaluacionForm = ({ ficha, onListo, onCancelar }: Props) => {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [parametros, setParametros] = useState<ParametroInput[]>([parametroVacio()]);
  const [visualizando, setVisualizando] = useState(false);
  const { toast } = useToast();

  const categorias = useCategoriasEvaluacion();
  const crear = useCrearEvaluacion();
  const actualizar = useActualizarEvaluacion();
  const guardarParametros = useGuardarParametros();

  /** Al abrir en edición, el formulario parte de lo que hay guardado. */
  useEffect(() => {
    if (!ficha) return;
    setTitulo(ficha.evaluacion.eva_titulo);
    setDescripcion(ficha.evaluacion.eva_descripcion ?? '');
    setCategoria(ficha.evaluacion.eva_categoria ?? '');
    setParametros(
      ficha.parametros.length > 0
        ? ficha.parametros.map((p) => ({
            evaparam_id: p.evaparam_id,
            evaparam_nombre: p.evaparam_nombre,
            evaparam_nota: p.evaparam_nota ?? '',
            evatipometo_id: p.evatipometo_id,
            evaparam_intentos: p.evaparam_intentos,
            evaparam_puntaje: p.evaparam_puntaje,
            evaparam_escala_min: p.evaparam_escala_min,
            evaparam_escala_max: p.evaparam_escala_max,
            rango: p.rango,
          }))
        : [parametroVacio()],
    );
  }, [ficha]);

  const notasDe = (indice: number) =>
    ficha?.parametros.find((p) => p.evaparam_id === parametros[indice]?.evaparam_id)
      ?.intentos_registrados ?? 0;

  const cambiarParametro = (indice: number, cambios: Partial<ParametroInput>) => {
    setParametros((previos) =>
      previos.map((p, i) => (i === indice ? { ...p, ...cambios } : p)),
    );
  };

  const borrarParametro = (indice: number) => {
    setParametros((previos) => previos.filter((_, i) => i !== indice));
  };

  const totalPrevisto = parametros.reduce((suma, p) => suma + (p.evaparam_puntaje || 0), 0);

  const faltaAlgo =
    titulo.trim().length < 3 ||
    parametros.length === 0 ||
    parametros.some((p) => p.evaparam_nombre.trim().length < 2);

  const guardando = crear.isPending || actualizar.isPending || guardarParametros.isPending;

  /**
   * Valida cada parámetro antes de pedir nada al servidor: umbrales de
   * tiempo que apuntan al mismo lado, escala con máximo <= mínimo, intentos
   * o puntaje a cero. Devuelve el primer problema encontrado, o null.
   */
  function validarParametros(): string | null {
    for (let i = 0; i < parametros.length; i += 1) {
      const p = parametros[i]!;
      const prefijo = `Parámetro ${i + 1}${p.evaparam_nombre.trim() ? ` (${p.evaparam_nombre.trim()})` : ''}`;
      if (p.evaparam_intentos < 1) {
        return `${prefijo}: los intentos deben ser al menos 1.`;
      }
      if (p.evaparam_puntaje < 1) {
        return `${prefijo}: el puntaje debe ser al menos 1.`;
      }
      if (p.evatipometo_id === METODO.ESCALA) {
        const min = p.evaparam_escala_min ?? 0;
        const max = p.evaparam_escala_max ?? 0;
        if (max <= min) {
          return `${prefijo}: el máximo de la escala debe ser mayor que el mínimo.`;
        }
      }
      if (p.evatipometo_id === METODO.TIEMPO) {
        if (!p.rango) {
          return `${prefijo}: los umbrales de tiempo son obligatorios.`;
        }
        const err = validarRango(p.rango);
        if (err) return `${prefijo}: ${err}`;
      }
    }
    return null;
  }

  const guardar = async () => {
    const error = validarParametros();
    if (error) {
      toast({ title: 'Revisa los parámetros', description: error, variant: 'destructive' });
      return;
    }

    const detalles = {
      eva_titulo: titulo.trim(),
      eva_descripcion: descripcion.trim(),
      eva_categoria: categoria.trim(),
    };

    try {
      if (!ficha) {
        const creada = await crear.mutateAsync({ ...detalles, parametros });
        onListo(creada.evaluacion.eva_id);
        return;
      }

      const evaId = ficha.evaluacion.eva_id;
      await actualizar.mutateAsync({ id: evaId, datos: detalles });
      await guardarParametros.mutateAsync({ id: evaId, parametros });
      onListo(evaId);
    } catch {
      // El hook ya enseña el motivo; el formulario se queda con lo escrito.
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="eva-titulo">Título</Label>
          <Input
            id="eva-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Saltar 8 y 9 años"
            className="h-11 sm:h-10"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="eva-descripcion">Descripción</Label>
          <Textarea
            id="eva-descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Qué mide y cómo se aplica"
            rows={2}
            className="resize-none"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="eva-categoria">Categoría</Label>
          <Input
            id="eva-categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            list="categorias-evaluacion"
            placeholder="8 y 9 años de edad"
            className="h-11 sm:h-10"
          />
          <datalist id="categorias-evaluacion">
            {(categorias.data ?? []).map((c) => (
              <option key={c.categoria} value={c.categoria} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium">
          Parámetros{' '}
          <span className="text-sm font-normal text-muted-foreground">
            · total previsto {totalPrevisto} pts
          </span>
        </h3>

        {parametros.length === 0 && (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Una evaluación necesita al menos un parámetro.
          </p>
        )}

        {parametros.map((parametro, indice) => (
          <ParametroCampos
            key={parametro.evaparam_id ?? `nuevo-${indice}`}
            indice={indice}
            parametro={parametro}
            intentosRegistrados={notasDe(indice)}
            onCambiar={cambiarParametro}
            onBorrar={borrarParametro}
          />
        ))}

        {/* "Añadir parámetro" vive abajo, como en Encuestas (2026-10-15):
            se añade justo después del último que estás configurando. */}
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full sm:h-10"
          onClick={() => setParametros((p) => [...p, parametroVacio()])}
        >
          <Plus className="mr-2 h-4 w-4" />
          Añadir parámetro
        </Button>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-11 sm:h-10" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-10"
          onClick={() => setVisualizando(true)}
          disabled={titulo.trim().length === 0 && parametros.length === 0}
        >
          <Eye className="mr-2 h-4 w-4" />
          Visualizar
        </Button>
        <Button
          type="button"
          variant="brand"
          className="h-11 sm:h-10"
          onClick={guardar}
          disabled={faltaAlgo || guardando}
        >
          {guardando ? 'Guardando…' : ficha ? 'Guardar cambios' : 'Crear evaluación'}
        </Button>
      </div>

      {/* Vista previa del borrador en memoria (2026-10-15). */}
      <Dialog open={visualizando} onOpenChange={(v) => (!v ? setVisualizando(false) : undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Vista previa</DialogTitle>
          </DialogHeader>
          <EvaluacionPreview
            titulo={titulo}
            descripcion={descripcion}
            categoria={categoria}
            parametros={parametros}
            onCerrar={() => setVisualizando(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EvaluacionForm;
