import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ImageUpload from '@/components/ImageUpload';
import CoordinatorMultiSelect from './CoordinatorMultiSelect';
import { useToast } from '@/hooks/use-toast';
import {
  useActualizarColegio,
  useCandidatosACoordinador,
  useCrearColegio,
  useSubirFotoColegio,
} from '@/hooks/useColegios';
import type { ColegioDetalle, DatosColegio } from '@/api/colegios';

interface Props {
  colegio?: ColegioDetalle | null;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Alta y edicion de un colegio.
 *
 * Manda un solo POST o PATCH: datos del colegio y coordinadores viajan juntos
 * y el backend los resuelve en una transaccion. Antes eran tres escrituras
 * sueltas desde el navegador (update, delete de todos los coordinadores,
 * insert de los nuevos) y entre la segunda y la tercera el colegio se quedaba
 * sin nadie a cargo.
 */
const SchoolForm = ({ colegio, onSuccess, onCancel }: Props) => {
  const esEdicion = Boolean(colegio);
  const { toast } = useToast();

  const [nombre, setNombre] = useState(colegio?.col_nombre ?? '');
  const [direccion, setDireccion] = useState(colegio?.col_direccion ?? '');
  const [repNombre, setRepNombre] = useState(colegio?.col_rep_nombre ?? '');
  const [repTelefono, setRepTelefono] = useState(colegio?.col_rep_telefono ?? '');
  const [repEmail, setRepEmail] = useState(colegio?.col_rep_email ?? '');
  const [coordinadores, setCoordinadores] = useState<number[]>(
    colegio?.coordinadores.map((c) => c.usu_id) ?? [],
  );
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoQuitada, setFotoQuitada] = useState(false);

  const candidatos = useCandidatosACoordinador(true);
  const crear = useCrearColegio();
  const actualizar = useActualizarColegio();
  const subirFoto = useSubirFotoColegio();

  const guardando = crear.isPending || actualizar.isPending || subirFoto.isPending;

  const cambiarFoto = (archivo: File | null) => {
    setFoto(archivo);
    setFotoQuitada(archivo === null && Boolean(colegio?.col_rep_foto));
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nombre.trim().length < 3) {
      toast({ title: 'El nombre debe tener al menos 3 caracteres', variant: 'destructive' });
      return;
    }
    if (direccion.trim().length < 3) {
      toast({ title: 'La dirección es obligatoria', variant: 'destructive' });
      return;
    }

    let ruta: string | null | undefined;
    if (foto) {
      try {
        ruta = await subirFoto.mutateAsync(foto);
      } catch {
        return; // el hook ya avisa; no se guarda nada a medias
      }
    } else if (fotoQuitada) {
      ruta = null;
    }

    const datos: DatosColegio = {
      col_nombre: nombre.trim(),
      col_direccion: direccion.trim(),
      col_rep_nombre: repNombre.trim(),
      col_rep_telefono: repTelefono.trim(),
      col_rep_email: repEmail.trim(),
      coordinadores,
      ...(ruta !== undefined ? { col_rep_foto: ruta } : {}),
    };

    try {
      if (esEdicion && colegio) {
        await actualizar.mutateAsync({ id: colegio.col_id, datos });
      } else {
        await crear.mutateAsync(datos);
      }
      onSuccess();
    } catch {
      // El mensaje del backend ya se muestra; el formulario queda abierto para
      // no perder lo escrito.
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="col_nombre">Nombre *</Label>
            <Input
              id="col_nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Innova Schools Quitumbe"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="col_direccion">Dirección *</Label>
            <Input
              id="col_direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Cóndor Ñan y Pumapungo, Quito"
              autoComplete="off"
            />
          </div>

          {/* El contacto del colegio es la autoridad con la que se habla; no
              es un usuario del sistema y por eso vive en la propia fila. */}
          <div className="space-y-2">
            <Label htmlFor="col_rep_nombre">Contacto del colegio</Label>
            <Input
              id="col_rep_nombre"
              value={repNombre}
              onChange={(e) => setRepNombre(e.target.value)}
              placeholder="Nombre de la autoridad"
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="col_rep_telefono">Teléfono</Label>
              <Input
                id="col_rep_telefono"
                value={repTelefono}
                onChange={(e) => setRepTelefono(e.target.value)}
                placeholder="0999999999"
                inputMode="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="col_rep_email">Correo</Label>
              <Input
                id="col_rep_email"
                value={repEmail}
                onChange={(e) => setRepEmail(e.target.value)}
                placeholder="contacto@colegio.edu.ec"
                inputMode="email"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Foto del contacto</Label>
            <ImageUpload
              initialImageUrl={colegio?.col_rep_foto_url ?? undefined}
              onImageChange={cambiarFoto}
              buttonText="Subir foto"
            />
          </div>

          <CoordinatorMultiSelect
            candidatos={candidatos.data ?? []}
            cargando={candidatos.isLoading}
            seleccionados={coordinadores}
            onChange={setCoordinadores}
          />
        </div>
      </div>

      {/* En móvil los botones se apilan con Cancelar abajo, bajo el pulgar. */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" variant="brand" disabled={guardando}>
          {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear colegio'}
        </Button>
      </div>
    </form>
  );
};

export default SchoolForm;
