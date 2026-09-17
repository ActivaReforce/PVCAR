import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import ImageUpload from '@/components/ImageUpload';
import { useToast } from '@/hooks/use-toast';
import { useColegios } from '@/hooks/useColegios';
import {
  useActualizarEstudiante,
  useCrearEstudiante,
  useGrados,
  useSubirFotoEstudiante,
} from '@/hooks/useEstudiantes';
import type { DatosEstudiante, EstudianteDetalle } from '@/api/estudiantes';

interface Props {
  estudiante?: EstudianteDetalle | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const SIN_GRADO = 'sin-grado';

/**
 * Alta y edición de un estudiante.
 *
 * Una sola llamada: el backend resuelve todo en una transacción. Al crear se
 * puede dejar sin disciplinas — se inscribe después desde la ficha, que es
 * donde se ven las de su colegio con su horario y su entrenador.
 *
 * Cambiar de colegio con inscripciones activas lo rechaza el backend: esas
 * inscripciones son de disciplinas del colegio viejo y quedarían cruzadas.
 */
const EstudianteForm = ({ estudiante, onSuccess, onCancel }: Props) => {
  const esEdicion = Boolean(estudiante);
  const { toast } = useToast();

  const colegios = useColegios({ limit: 200, orden: 'nombre' });
  const grados = useGrados();
  const crear = useCrearEstudiante();
  const actualizar = useActualizarEstudiante();
  const subirFoto = useSubirFotoEstudiante();

  const [nombre, setNombre] = useState(estudiante?.nino_nombre ?? '');
  const [colId, setColId] = useState(estudiante ? String(estudiante.col_id) : '');
  const [gradoId, setGradoId] = useState(
    estudiante?.catninograd_id ? String(estudiante.catninograd_id) : SIN_GRADO,
  );
  const [edad, setEdad] = useState(estudiante?.nino_edad ? String(estudiante.nino_edad) : '');
  const [cedula, setCedula] = useState(estudiante?.nino_cedula ?? '');
  const [transporte, setTransporte] = useState(estudiante?.nino_toma_transporte ?? false);
  const [salud, setSalud] = useState(estudiante?.nino_info_salud ?? '');
  const [otra, setOtra] = useState(estudiante?.nino_otra_info ?? '');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoQuitada, setFotoQuitada] = useState(false);

  const guardando = crear.isPending || actualizar.isPending || subirFoto.isPending;

  const cambiarFoto = (archivo: File | null) => {
    setFoto(archivo);
    setFotoQuitada(archivo === null && Boolean(estudiante?.nino_foto));
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nombre.trim().length < 3) {
      toast({ title: 'El nombre es obligatorio', variant: 'destructive' });
      return;
    }
    if (!colId) {
      toast({ title: 'Elige el colegio', variant: 'destructive' });
      return;
    }
    if (edad && (Number(edad) < 4 || Number(edad) > 25)) {
      toast({ title: 'La edad debe estar entre 4 y 25', variant: 'destructive' });
      return;
    }

    let ruta: string | null | undefined;
    if (foto) {
      try {
        ruta = await subirFoto.mutateAsync(foto);
      } catch {
        return;
      }
    } else if (fotoQuitada) {
      ruta = null;
    }

    const datos: DatosEstudiante = {
      nino_nombre: nombre.trim(),
      col_id: Number(colId),
      catninograd_id: gradoId === SIN_GRADO ? null : Number(gradoId),
      nino_edad: edad ? Number(edad) : null,
      nino_cedula: cedula.trim(),
      nino_toma_transporte: transporte,
      nino_info_salud: salud.trim(),
      nino_otra_info: otra.trim(),
      ...(ruta !== undefined ? { nino_foto: ruta } : {}),
    };

    try {
      if (esEdicion && estudiante) {
        await actualizar.mutateAsync({ id: estudiante.nino_id, datos });
      } else {
        await crear.mutateAsync(datos);
      }
      onSuccess();
    } catch {
      // El hook ya muestra el motivo; el formulario queda abierto.
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nino_nombre">Nombre completo *</Label>
            <Input
              id="nino_nombre"
              value={nombre}
              onChange={(ev) => setNombre(ev.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="col_id">Colegio *</Label>
            <Select value={colId} onValueChange={setColId}>
              <SelectTrigger id="col_id" className="h-11 sm:h-10">
                <SelectValue placeholder="Elige un colegio" />
              </SelectTrigger>
              <SelectContent>
                {(colegios.data?.items ?? []).map((c) => (
                  <SelectItem key={c.col_id} value={String(c.col_id)}>
                    {c.col_nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {esEdicion && (estudiante?.disciplinas ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                Tiene {estudiante?.disciplinas} inscripciones activas: para cambiarlo de colegio
                hay que darlas de baja primero.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="grado">Grado</Label>
              <Select value={gradoId} onValueChange={setGradoId}>
                <SelectTrigger id="grado" className="h-11 sm:h-10">
                  <SelectValue placeholder="Sin grado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_GRADO}>Sin grado</SelectItem>
                  {(grados.data ?? []).map((g) => (
                    <SelectItem key={g.catninograd_id} value={String(g.catninograd_id)}>
                      {g.catninograd_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edad">Edad</Label>
              <Input
                id="edad"
                type="number"
                min={4}
                max={25}
                value={edad}
                onChange={(ev) => setEdad(ev.target.value)}
                className="h-11 sm:h-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cedula">Cédula</Label>
            <Input
              id="cedula"
              value={cedula}
              onChange={(ev) => setCedula(ev.target.value)}
              inputMode="numeric"
              autoComplete="off"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="transporte"
              checked={transporte}
              onCheckedChange={(v) => setTransporte(v === true)}
            />
            <Label htmlFor="transporte" className="cursor-pointer">
              Toma transporte
            </Label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Foto</Label>
            <ImageUpload
              initialImageUrl={estudiante?.nino_foto_url ?? undefined}
              onImageChange={cambiarFoto}
              buttonText="Subir foto"
            />
          </div>

          {/* Dato sensible de un menor: solo se ve y se edita en la ficha, y
              el API no lo manda en la lista. */}
          <div className="space-y-2">
            <Label htmlFor="salud">Información de salud</Label>
            <Textarea
              id="salud"
              value={salud}
              onChange={(ev) => setSalud(ev.target.value)}
              rows={3}
              placeholder="Alergias, medicación, condiciones a tener en cuenta"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="otra">Otra información</Label>
            <Textarea
              id="otra"
              value={otra}
              onChange={(ev) => setOtra(ev.target.value)}
              rows={2}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" variant="brand" disabled={guardando}>
          {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear estudiante'}
        </Button>
      </div>
    </form>
  );
};

export default EstudianteForm;
