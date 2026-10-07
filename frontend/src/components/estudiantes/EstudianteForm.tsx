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
import { useColegiosVisibles } from '@/hooks/useColegios';
import {
  useActualizarEstudiante,
  useCrearEstudiante,
  useGrados,
  useSubirFotoEstudiante,
} from '@/hooks/useEstudiantes';
import type {
  ContactoNino,
  DatosEstudiante,
  EstudianteDetalle,
  ModalidadSalida,
  PermisosImagen,
} from '@/api/estudiantes';
import { hoyEc } from '@/lib/fecha';

interface Props {
  estudiante?: EstudianteDetalle | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const SIN_GRADO = 'sin-grado';
const SIN_SALIDA = 'sin-indicar';
const CONTACTO_VACIO: ContactoNino = { nombre: '', cedula: '', relacion: '', telefono: '' };

/** Todo vacío = sin contacto (null); a medias = 'incompleto'. */
function contactoDe(c: ContactoNino, conCedula: boolean): ContactoNino | null | 'incompleto' {
  const v = {
    nombre: c.nombre.trim(),
    cedula: (c.cedula ?? '').trim(),
    relacion: c.relacion.trim(),
    telefono: c.telefono.trim(),
  };
  const campos = conCedula ? [v.nombre, v.cedula, v.relacion, v.telefono] : [v.nombre, v.relacion, v.telefono];
  if (campos.every((x) => x === '')) return null;
  if (campos.some((x) => x === '')) return 'incompleto';
  return { ...v, cedula: conCedula ? v.cedula : null };
}

const CamposContacto = ({
  prefijo,
  contacto,
  onChange,
  conCedula,
}: {
  prefijo: string;
  contacto: ContactoNino;
  onChange: (c: ContactoNino) => void;
  conCedula: boolean;
}) => {
  const campo = (clave: keyof ContactoNino, etiqueta: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="space-y-1">
      <Label htmlFor={`${prefijo}-${clave}`} className="text-xs text-muted-foreground">
        {etiqueta}
      </Label>
      <Input
        id={`${prefijo}-${clave}`}
        value={contacto[clave] ?? ''}
        onChange={(ev) => onChange({ ...contacto, [clave]: ev.target.value })}
        autoComplete="off"
        {...extra}
      />
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {campo('nombre', 'Nombres y apellidos')}
      {conCedula && campo('cedula', 'Cédula / identificación', { maxLength: 20 })}
      {campo('relacion', 'Relación con el menor')}
      {campo('telefono', 'Teléfono', { type: 'tel' })}
    </div>
  );
};

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

  const colegios = useColegiosVisibles();
  const grados = useGrados();
  const crear = useCrearEstudiante();
  const actualizar = useActualizarEstudiante();
  const subirFoto = useSubirFotoEstudiante();

  const [nombre, setNombre] = useState(estudiante?.nino_nombre ?? '');
  const [colId, setColId] = useState(estudiante ? String(estudiante.col_id) : '');
  const [gradoId, setGradoId] = useState(
    estudiante?.catninograd_id ? String(estudiante.catninograd_id) : SIN_GRADO,
  );
  const [nacimiento, setNacimiento] = useState(estudiante?.nino_fecha_nacimiento ?? '');
  const [salida, setSalida] = useState<string>(estudiante?.nino_modalidad_salida ?? SIN_SALIDA);
  const [detalleRetiro, setDetalleRetiro] = useState(estudiante?.nino_detalle_retiro ?? '');
  const [salud, setSalud] = useState(estudiante?.nino_info_salud ?? '');
  const [imagen, setImagen] = useState<PermisosImagen>({
    familias: estudiante?.nino_imagen_familias ?? false,
    redes: estudiante?.nino_imagen_redes ?? false,
    promocional: estudiante?.nino_imagen_promocional ?? false,
  });
  const [emergencia, setEmergencia] = useState<ContactoNino>(
    estudiante?.contacto_emergencia ?? { ...CONTACTO_VACIO },
  );
  const [retiro, setRetiro] = useState<ContactoNino>(estudiante?.contacto_retiro ?? { ...CONTACTO_VACIO });
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

    const em = contactoDe(emergencia, false);
    const re = contactoDe(retiro, true);
    if (em === 'incompleto' || re === 'incompleto') {
      toast({
        title: 'Contacto incompleto',
        description:
          'Llena todos los datos del contacto de emergencia y de quien lo retira (con su cédula), o déjalos vacíos.',
        variant: 'destructive',
      });
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
      nino_fecha_nacimiento: nacimiento || null,
      nino_modalidad_salida: salida === SIN_SALIDA ? null : (salida as ModalidadSalida),
      nino_detalle_retiro: detalleRetiro.trim(),
      nino_info_salud: salud.trim(),
      imagen,
      contacto_emergencia: em,
      contacto_retiro: re,
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
              <Label htmlFor="nacimiento">Fecha de nacimiento</Label>
              <Input
                id="nacimiento"
                type="date"
                max={hoyEc()}
                value={nacimiento}
                onChange={(ev) => setNacimiento(ev.target.value)}
                className="h-11 sm:h-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="salida">Modalidad de salida</Label>
            <Select value={salida} onValueChange={setSalida}>
              <SelectTrigger id="salida" className="h-11 sm:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_SALIDA}>Sin indicar</SelectItem>
                <SelectItem value="escolar">Transporte escolar</SelectItem>
                <SelectItem value="privado">Transporte privado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="detalle-retiro">Detalle del recorrido o instrucciones de retiro</Label>
            <Textarea
              id="detalle-retiro"
              value={detalleRetiro}
              onChange={(ev) => setDetalleRetiro(ev.target.value)}
              rows={2}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Contacto alterno de emergencia</legend>
            <CamposContacto prefijo="em" contacto={emergencia} onChange={setEmergencia} conCedula={false} />
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Persona autorizada para retirarlo</legend>
            <CamposContacto prefijo="re" contacto={retiro} onChange={setRetiro} conCedula />
          </fieldset>
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

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Uso de imagen autorizado</legend>
            {(
              [
                ['familias', 'Compartir con las familias del grupo'],
                ['redes', 'Publicar en redes sociales de ACTIVA'],
                ['promocional', 'Material institucional o promocional'],
              ] as const
            ).map(([clave, texto]) => (
              <div key={clave} className="flex min-h-11 items-center gap-2 sm:min-h-9">
                <Checkbox
                  id={`imagen-${clave}`}
                  checked={imagen[clave]}
                  onCheckedChange={(v) => setImagen((x) => ({ ...x, [clave]: v === true }))}
                />
                <Label htmlFor={`imagen-${clave}`} className="cursor-pointer font-normal">
                  {texto}
                </Label>
              </div>
            ))}
          </fieldset>
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
