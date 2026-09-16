import { useState } from 'react';
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
import MaterialesInput from './MaterialesInput';
import { useToast } from '@/hooks/use-toast';
import {
  useActualizarActividad,
  useCategorias,
  useCrearActividad,
} from '@/hooks/useActividades';
import type { Actividad, DatosActividad } from '@/api/actividades';

interface Props {
  actividad?: Actividad | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const SIN_CATEGORIA = 'sin-categoria';

/**
 * Alta y edición de una actividad.
 *
 * Los campos son los mismos del sistema viejo —nombre, categoría, descripción,
 * indumentaria, espacios y materiales— porque describen cómo se imparte y el
 * cliente los usa. Lo que cambia es que se guardan en una sola llamada y que
 * los materiales viajan como lista.
 */
const ActivityForm = ({ actividad, onSuccess, onCancel }: Props) => {
  const esEdicion = Boolean(actividad);
  const { toast } = useToast();
  const categorias = useCategorias();
  const crear = useCrearActividad();
  const actualizar = useActualizarActividad();

  const [nombre, setNombre] = useState(actividad?.act_nombre ?? '');
  const [descripcion, setDescripcion] = useState(actividad?.act_descripcion ?? '');
  const [catId, setCatId] = useState<string>(
    actividad?.cat_id ? String(actividad.cat_id) : SIN_CATEGORIA,
  );
  const [indumentaria, setIndumentaria] = useState(actividad?.act_indumentaria_tipo ?? '');
  const [espacio, setEspacio] = useState(actividad?.act_espacio_trabajo ?? '');
  const [tipoEspacio, setTipoEspacio] = useState(actividad?.act_tipo_espacio ?? '');
  const [espacioSecundario, setEspacioSecundario] = useState(
    actividad?.act_espacio_secundario ?? '',
  );
  const [materiales, setMateriales] = useState<string[]>(actividad?.act_materiales_alumno ?? []);

  const guardando = crear.isPending || actualizar.isPending;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nombre.trim().length < 2) {
      toast({ title: 'El nombre es obligatorio', variant: 'destructive' });
      return;
    }

    const datos: DatosActividad = {
      act_nombre: nombre.trim(),
      act_descripcion: descripcion.trim(),
      cat_id: catId === SIN_CATEGORIA ? null : Number(catId),
      act_indumentaria_tipo: indumentaria.trim(),
      act_espacio_trabajo: espacio.trim(),
      act_tipo_espacio: tipoEspacio.trim(),
      act_espacio_secundario: espacioSecundario.trim(),
      act_materiales_alumno: materiales,
    };

    try {
      if (esEdicion && actividad) {
        await actualizar.mutateAsync({ id: actividad.act_id, datos });
      } else {
        await crear.mutateAsync(datos);
      }
      onSuccess();
    } catch {
      // El mensaje del backend ya se muestra; el formulario queda abierto.
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="act_nombre">Nombre *</Label>
            <Input
              id="act_nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Karate"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat_id">Categoría</Label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger id="cat_id" className="h-11 sm:h-10">
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_CATEGORIA}>Sin categoría</SelectItem>
                {(categorias.data ?? []).map((c) => (
                  <SelectItem key={c.cat_id} value={String(c.cat_id)}>
                    {c.cat_nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="act_descripcion">Descripción</Label>
            <Textarea
              id="act_descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Qué se trabaja en esta actividad"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="act_indumentaria">Indumentaria</Label>
            <Input
              id="act_indumentaria"
              value={indumentaria}
              onChange={(e) => setIndumentaria(e.target.value)}
              placeholder="Uniforme deportivo, karategui…"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="act_espacio">Espacio de trabajo</Label>
            <Input
              id="act_espacio"
              value={espacio}
              onChange={(e) => setEspacio(e.target.value)}
              placeholder="Cancha 1, sparklab, patio…"
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="act_tipo_espacio">Tipo de espacio</Label>
              <Input
                id="act_tipo_espacio"
                value={tipoEspacio}
                onChange={(e) => setTipoEspacio(e.target.value)}
                placeholder="Exterior, aula…"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="act_espacio_secundario">Espacio secundario</Label>
              <Input
                id="act_espacio_secundario"
                value={espacioSecundario}
                onChange={(e) => setEspacioSecundario(e.target.value)}
                placeholder="Aula de apoyo"
                autoComplete="off"
              />
            </div>
          </div>

          <MaterialesInput valor={materiales} onChange={setMateriales} />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" variant="brand" disabled={guardando}>
          {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear actividad'}
        </Button>
      </div>
    </form>
  );
};

export default ActivityForm;
