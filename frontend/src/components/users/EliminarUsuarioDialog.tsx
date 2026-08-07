import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { UsuarioListado } from '@/api/usuarios';
import { useEliminarUsuario, useImpactoEliminacion } from '@/hooks/useUsuarios';

interface Props {
  usuario: UsuarioListado | null;
  onClose: () => void;
  onEliminado: () => void;
}

/**
 * Borrado permanente.
 *
 * Lo que pidio el cliente (2026-08-07): recuento de lo que se destruye antes
 * de confirmar, confirmacion escribiendo el nombre —no un boton— y aviso claro
 * de que no se puede deshacer.
 *
 * El recuento y el bloqueo los calcula el backend. Aqui solo se pintan: si la
 * comprobacion viviera en este archivo, bastaria con abrir las herramientas
 * del navegador para saltarsela.
 */
const ETIQUETAS: Record<string, string> = {
  roles: 'roles asignados',
  ficha_entrenador: 'ficha de entrenador',
  ficha_representante: 'ficha de representante',
  colegios_coordinados: 'colegios que coordina',
  es_auxiliar_de: 'vínculos como auxiliar',
  auxiliares_a_su_cargo: 'auxiliares a su cargo',
  asignaciones: 'asignaciones a disciplinas',
  asistencias_propias: 'asistencias propias',
  asistencias_registradas: 'asistencias de estudiantes que registró',
  asistencias_entrenador_registradas: 'asistencias de entrenadores que registró',
  asistencias_auxiliar_registradas: 'asistencias de auxiliares que registró',
  asistencias_como_auxiliar: 'asistencias suyas como auxiliar',
  evaluaciones_creadas: 'evaluaciones que creó',
  evaluaciones_registradas: 'evaluaciones que registró',
  encuestas_creadas: 'encuestas que creó',
  estudiantes_vinculados: 'estudiantes vinculados',
  encuestas_respondidas: 'encuestas respondidas',
};

const etiqueta = (clave: string) => ETIQUETAS[clave] ?? clave.replace(/_/g, ' ');

const EliminarUsuarioDialog = ({ usuario, onClose, onEliminado }: Props) => {
  const [confirmacion, setConfirmacion] = useState('');
  const impacto = useImpactoEliminacion(usuario?.usu_id ?? null);
  const eliminar = useEliminarUsuario();

  const nombreCoincide =
    confirmacion.trim().toLowerCase() === (usuario?.usu_nombre ?? '').trim().toLowerCase();

  const bloqueos = Object.entries(impacto.data?.bloqueos ?? {});
  const aEliminar = Object.entries(impacto.data?.eliminables ?? {}).filter(([, n]) => n > 0);
  const puedeEliminar = impacto.data?.puedeEliminar ?? false;

  const cerrar = () => {
    setConfirmacion('');
    onClose();
  };

  const confirmar = async () => {
    if (!usuario) return;
    try {
      await eliminar.mutateAsync({ id: usuario.usu_id, confirmacion });
      setConfirmacion('');
      onEliminado();
    } catch {
      // El hook ya muestra el motivo; el modal se queda abierto.
    }
  };

  return (
    <Dialog open={Boolean(usuario)} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Eliminar permanentemente
          </DialogTitle>
          <DialogDescription>
            Vas a eliminar a <strong>{usuario?.usu_nombre}</strong> ({usuario?.usu_correo}).
            <strong> Esta acción no se puede deshacer.</strong>
          </DialogDescription>
        </DialogHeader>

        {impacto.isLoading && <p className="text-sm text-muted-foreground">Calculando…</p>}

        {impacto.data && !puedeEliminar && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
            <p className="text-sm font-medium">No se puede eliminar: tiene historial en el sistema.</p>
            <ul className="text-sm list-disc pl-5">
              {bloqueos.map(([clave, n]) => (
                <li key={clave}>
                  {n} {etiqueta(clave)}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Dalo de baja en su lugar: deja de entrar al sistema y el historial se conserva.
            </p>
          </div>
        )}

        {impacto.data && puedeEliminar && (
          <div className="space-y-3">
            {aEliminar.length > 0 ? (
              <div className="rounded-md border p-3">
                <p className="text-sm font-medium mb-1">Se eliminarán también:</p>
                <ul className="text-sm list-disc pl-5">
                  {aEliminar.map(([clave, n]) => (
                    <li key={clave}>
                      {n} {etiqueta(clave)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay nada más colgando de esta ficha.</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="confirmacion">
                Escribe <strong>{usuario?.usu_nombre}</strong> para confirmar
              </Label>
              <Input
                id="confirmacion"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={confirmar}
            disabled={!puedeEliminar || !nombreCoincide || eliminar.isPending}
          >
            {eliminar.isPending ? 'Eliminando…' : 'Eliminar para siempre'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EliminarUsuarioDialog;
