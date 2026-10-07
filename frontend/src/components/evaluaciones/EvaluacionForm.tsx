import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { METODO, type FichaEvaluacion, type ParametroInput } from '@/api/evaluaciones';
import {
  useActualizarEvaluacion,
  useCategoriasEvaluacion,
  useCrearEvaluacion,
  useGuardarParametros,
} from '@/hooks/useEvaluaciones';
import ParametroCampos from './ParametroCampos';

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
 * pantalla: los detalles arriba, los parámetros debajo, y el puntaje total se
 * ve actualizarse según se escribe.
 *
 * **El puntaje total no se escribe:** es la suma de los parámetros y la
 * mantiene `trigger_update_evaluacion_puntaje_total` en la base. Lo que se
 * enseña aquí es la previsión de lo que quedará al guardar.
 */
const EvaluacionForm = ({ ficha, onListo, onCancelar }: Props) => {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [parametros, setParametros] = useState<ParametroInput[]>([parametroVacio()]);

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

  const guardar = async () => {
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
          {/* Texto libre, pero con lo ya usado a mano: sin esto salen "S17", "s17" y "Sub 17". */}
          <datalist id="categorias-evaluacion">
            {(categorias.data ?? []).map((c) => (
              <option key={c.categoria} value={c.categoria} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">
            Parámetros{' '}
            <span className="text-sm font-normal text-muted-foreground">
              · total previsto {totalPrevisto} pts
            </span>
          </h3>
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-10"
            onClick={() => setParametros((p) => [...p, parametroVacio()])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Añadir
          </Button>
        </div>

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
          {guardando ? 'Guardando…' : ficha ? 'Guardar cambios' : 'Crear evaluación'}
        </Button>
      </div>
    </div>
  );
};

export default EvaluacionForm;
