
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useAuxiliaryTrainers } from "@/hooks/useAuxiliaryTrainers";
import { Database } from "@/integrations/supabase/types";

type Usuario = Database['public']['Tables']['usuario']['Row'];
type Entrenador = Database['public']['Tables']['entrenador']['Row'];

interface EntrenadorWithDetails extends Entrenador {
  usuario: Usuario;
  colegios: string[];
  disciplinas_count: number;
  disciplinas: Array<{
    colegio_nombre: string;
    actividad_nombre: string;
    dia_nombre: string;
    hora_inicio: string | null;
    hora_fin: string | null;
  }>;
}

interface EntrenadorDetailProps {
  entrenador: EntrenadorWithDetails;
  onClose: () => void;
}

const EntrenadorDetail = ({
  entrenador,
  onClose
}: EntrenadorDetailProps) => {
  const { assignedAuxiliaries } = useAuxiliaryTrainers(entrenador.ent_id);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTime = (time: string | null) => {
    if (!time) return "";
    return time.slice(0, 5);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center p-2 bg-muted/20 rounded-lg">
        <Avatar className="h-16 w-16">
          <AvatarImage src={entrenador.usuario.usu_foto || undefined} />
          <AvatarFallback className="text-lg">
            {getInitials(entrenador.usuario.usu_nombre)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 px-3">
          <h3 className="text-xl font-semibold">{entrenador.usuario.usu_nombre}</h3>
          <Badge variant="secondary" className="mt-1">
            Entrenador
          </Badge>
        </div>
      </div>

      {/* Datos Personales Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          
        </div>
        <Separator />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="font-semibold text-sm text-muted-foreground">Email:</Label>
            <p className="mt-1">{entrenador.usuario.usu_correo}</p>
          </div>

          <div>
            <Label className="font-semibold text-sm text-muted-foreground">Teléfono:</Label>
            <p className="mt-1">{entrenador.usuario.usu_telefono || "—"}</p>
          </div>

          <div>
            <Label className="font-semibold text-sm text-muted-foreground">Cédula:</Label>
            <p className="mt-1">{entrenador.ent_cedula || "—"}</p>
          </div>
        </div>
      </div>

      {/* Asignaciones Section */}
      <div className="space-y-4">
        
        <Separator />
        
        <div className="space-y-4">
          <div>
            <Label className="font-semibold text-sm text-muted-foreground">Colegios:</Label>
            <div className="mt-2">
              {entrenador.colegios.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {entrenador.colegios.map((colegio, index) => (
                    <Badge key={index} variant="outline">
                      {colegio}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No asignado a ningún colegio</p>
              )}
            </div>
          </div>

          <div>
            <Label className="font-semibold text-sm text-muted-foreground">
              Disciplinas Asignadas ({entrenador.disciplinas_count}):
            </Label>
            <div className="mt-2 space-y-3 max-h-48 overflow-y-auto">
              {entrenador.disciplinas.length > 0 ? (
                entrenador.disciplinas.map((disciplina, index) => (
                  <div key={index} className="p-3 bg-muted/30 rounded-lg border-l-4 border-primary">
                    <div className="font-medium text-foreground">{disciplina.actividad_nombre}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium">Colegio:</span> {disciplina.colegio_nombre}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Horario:</span> {disciplina.dia_nombre}
                      {disciplina.hora_inicio && disciplina.hora_fin && (
                        <span> • {formatTime(disciplina.hora_inicio)} - {formatTime(disciplina.hora_fin)}</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground italic">No tiene disciplinas asignadas</p>
              )}
            </div>
          </div>

          {/* Auxiliares Section */}
          <div>
            <Label className="font-semibold text-sm text-muted-foreground">
              Auxiliares ({assignedAuxiliaries.length}):
            </Label>
            <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
              {assignedAuxiliaries.length > 0 ? (
                assignedAuxiliaries.map((auxiliary) => (
                  <div key={auxiliary.entaux_id} className="flex items-center gap-3 p-2 bg-muted/20 rounded-lg">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={auxiliary.usuario.usu_foto || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(auxiliary.usuario.usu_nombre)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{auxiliary.usuario.usu_nombre}</div>
                      <div className="text-xs text-muted-foreground">{auxiliary.rol.rol_titulo}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground italic">No tiene auxiliares asignados</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="mt-6">
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </div>
  );
};

export default EntrenadorDetail;
