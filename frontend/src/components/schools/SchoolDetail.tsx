
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DialogFooter } from "@/components/ui/dialog";

interface Colegio {
  col_id: number;
  col_nombre: string;
  col_direccion: string;
  col_rep_nombre?: string | null;
  col_rep_foto?: string | null;
  col_rep_telefono?: string | null;
  col_rep_email?: string | null;
  coordinators?: Array<{
    usu_id: number;
    usu_nombre: string;
  }>;
}

interface SchoolDetailProps {
  school: Colegio;
  onClose: () => void;
}

const SchoolDetail = ({ school, onClose }: SchoolDetailProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="font-semibold">Nombre:</Label>
          <p className="mt-1">{school.col_nombre}</p>
        </div>

        <div>
          <Label className="font-semibold">Dirección:</Label>
          <p className="mt-1">{school.col_direccion}</p>
        </div>

        <div className="md:col-span-2">
          <Label className="font-semibold">Coordinadores AR:</Label>
          <div className="mt-2">
            {school.coordinators && school.coordinators.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {school.coordinators.map((coordinator) => (
                  <Badge 
                    key={coordinator.usu_id} 
                    variant="secondary" 
                    className="text-sm"
                  >
                    {coordinator.usu_nombre}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Sin coordinadores asignados</p>
            )}
          </div>
        </div>

        <div>
          <Label className="font-semibold">Contacto/Autoridad:</Label>
          <p className="mt-1">{school.col_rep_nombre || "—"}</p>
        </div>

        <div>
          <Label className="font-semibold">Teléfono:</Label>
          <p className="mt-1">{school.col_rep_telefono || "—"}</p>
        </div>

        <div className="md:col-span-2">
          <Label className="font-semibold">Email:</Label>
          <p className="mt-1">{school.col_rep_email || "—"}</p>
        </div>
      </div>

      {school.col_rep_foto && (
        <div className="mt-4">
          <Label className="font-semibold">Foto del Contacto/Autoridad:</Label>
          <div className="mt-2">
            <img
              src={school.col_rep_foto}
              alt="Contacto/Autoridad"
              className="h-48 w-auto object-cover rounded-md border"
            />
          </div>
        </div>
      )}

      <DialogFooter className="mt-6">
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </div>
  );
};

export default SchoolDetail;
