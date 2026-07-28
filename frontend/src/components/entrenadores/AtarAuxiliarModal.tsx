import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trash2 } from "lucide-react";
import { useAuxiliaryTrainers } from "@/hooks/useAuxiliaryTrainers";
import { EntrenadorWithDetails } from "./EntrenadorTypes";
import { RemoveAuxiliaryDialog } from "./RemoveAuxiliaryDialog";
import { AuxiliaryTrainerWithDetails } from "./AuxiliaryTrainerTypes";

interface AtarAuxiliarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entrenador: EntrenadorWithDetails | null;
  onClose: () => void;
  onSuccess: () => void;
}

const AtarAuxiliarModal = ({
  open,
  onOpenChange,
  entrenador,
  onClose,
  onSuccess
}: AtarAuxiliarModalProps) => {
  const [selectedAuxiliaries, setSelectedAuxiliaries] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [auxiliaryToRemove, setAuxiliaryToRemove] = useState<AuxiliaryTrainerWithDetails | null>(null);

  const {
    assignedAuxiliaries,
    availableAuxiliaries,
    loading,
    loadAvailableAuxiliaries,
    assignAuxiliary,
    removeAuxiliary
  } = useAuxiliaryTrainers(entrenador?.ent_id);

  useEffect(() => {
    if (open && entrenador) {
      loadAvailableAuxiliaries();
    }
  }, [open, entrenador]);

  const handleAuxiliaryToggle = (usuId: number, checked: boolean) => {
    if (checked) {
      setSelectedAuxiliaries(prev => [...prev, usuId]);
    } else {
      setSelectedAuxiliaries(prev => prev.filter(id => id !== usuId));
    }
  };

  const handleSubmit = async () => {
    if (!entrenador || selectedAuxiliaries.length === 0) return;

    setSubmitting(true);
    let allSuccess = true;

    for (const usuId of selectedAuxiliaries) {
      const auxiliary = availableAuxiliaries.find(aux => aux.usu_id === usuId);
      if (auxiliary) {
        const success = await assignAuxiliary(entrenador.ent_id, usuId, auxiliary.rol.rol_id);
        if (!success) {
          allSuccess = false;
        }
      }
    }

    setSubmitting(false);
    
    if (allSuccess) {
      setSelectedAuxiliaries([]);
      onSuccess();
      onClose();
    }
  };

  const handleRemoveAuxiliaryClick = (auxiliary: AuxiliaryTrainerWithDetails) => {
    setAuxiliaryToRemove(auxiliary);
    setShowRemoveDialog(true);
  };

  const handleRemoveConfirm = async () => {
    if (!entrenador || !auxiliaryToRemove) return;
    
    const success = await removeAuxiliary(auxiliaryToRemove.entaux_id, entrenador.ent_id);
    if (success) {
      onSuccess();
    }
    
    setShowRemoveDialog(false);
    setAuxiliaryToRemove(null);
  };

  const handleRemoveDialogClose = () => {
    setShowRemoveDialog(false);
    setAuxiliaryToRemove(null);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Filter out already assigned auxiliaries from available list
  const unassignedAuxiliaries = availableAuxiliaries.filter(aux => 
    !assignedAuxiliaries.some(assigned => assigned.usuario.usu_id === aux.usu_id)
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Asignar Auxiliar a Entrenador</DialogTitle>
          </DialogHeader>

          {entrenador && (
            <div className="space-y-6">
              {/* Trainer Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={entrenador.usuario.usu_foto || undefined} />
                  <AvatarFallback>
                    {getInitials(entrenador.usuario.usu_nombre)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{entrenador.usuario.usu_nombre}</h3>
                  <p className="text-sm text-muted-foreground">{entrenador.usuario.usu_correo}</p>
                </div>
              </div>

              {/* Assigned Auxiliaries Section */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Auxiliares Asignados</h4>
                <Separator />
                
                {assignedAuxiliaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No hay auxiliares asignados actualmente
                  </p>
                ) : (
                  <div className="space-y-2">
                    {assignedAuxiliaries.map((auxiliary) => (
                      <div
                        key={auxiliary.entaux_id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={auxiliary.usuario.usu_foto || undefined} />
                            <AvatarFallback className="text-sm">
                              {getInitials(auxiliary.usuario.usu_nombre)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">
                              {auxiliary.usuario.usu_nombre} – {auxiliary.rol.rol_titulo}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {auxiliary.usuario.usu_correo}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveAuxiliaryClick(auxiliary)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available Auxiliaries Section */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Auxiliares Disponibles</h4>
                <Separator />
                
                {loading ? (
                  <div className="text-center py-4">
                    <div className="text-sm text-muted-foreground">Cargando auxiliares...</div>
                  </div>
                ) : unassignedAuxiliaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No hay auxiliares disponibles para asignar
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {unassignedAuxiliaries.map((auxiliary) => (
                      <div
                        key={auxiliary.usu_id}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/20"
                      >
                        <Checkbox
                          checked={selectedAuxiliaries.includes(auxiliary.usu_id)}
                          onCheckedChange={(checked) =>
                            handleAuxiliaryToggle(auxiliary.usu_id, checked as boolean)
                          }
                        />
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={auxiliary.usu_foto || undefined} />
                          <AvatarFallback className="text-sm">
                            {getInitials(auxiliary.usu_nombre)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {auxiliary.usu_nombre}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {auxiliary.usu_correo}
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {auxiliary.rol.rol_titulo}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={selectedAuxiliaries.length === 0 || submitting}
                >
                  {submitting ? "Asignando..." : "Asignar Auxiliar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Auxiliary Confirmation Dialog */}
      <RemoveAuxiliaryDialog
        isOpen={showRemoveDialog}
        onClose={handleRemoveDialogClose}
        onConfirm={handleRemoveConfirm}
        auxiliaryName={auxiliaryToRemove?.usuario.usu_nombre}
      />
    </>
  );
};

export default AtarAuxiliarModal;
