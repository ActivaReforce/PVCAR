
import React from 'react';
import { Button } from "@/components/ui/button";
import { Link as LinkIcon } from "lucide-react";
import { useEstudianteDisciplinas } from "@/hooks/useEstudianteDisciplinas";
import EstudianteDisciplinasList from "./EstudianteDisciplinasList";
import EstudianteDisciplinasEmptyState from "./EstudianteDisciplinasEmptyState";
import { RemoveDisciplineDialog } from "./RemoveDisciplineDialog";

interface EstudianteDisciplinasSectionProps {
  estudiante: {
    nino_id: number;
    nino_nombre: string;
  };
  onLinkDisciplines: () => void;
}

const EstudianteDisciplinasSection = ({
  estudiante,
  onLinkDisciplines
}: EstudianteDisciplinasSectionProps) => {
  const {
    assignments,
    loading,
    unlinkingId,
    confirmDialog,
    handleUnlinkRequest,
    handleConfirmUnlink,
    handleCancelUnlink
  } = useEstudianteDisciplinas(estudiante.nino_id);

  if (loading) {
    return (
      <div className="space-y-2">
        <h4 className="font-semibold text-lg">Disciplinas Asignadas</h4>
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-lg">
          Disciplinas Asignadas 
          <span className="ml-2 text-sm text-muted-foreground">
            ({assignments.length} activa{assignments.length !== 1 ? 's' : ''})
          </span>
        </h4>
        <Button
          variant="outline"
          size="sm"
          onClick={onLinkDisciplines}
          className="flex items-center gap-2"
        >
          <LinkIcon className="h-4 w-4" />
          Asignar Disciplinas
        </Button>
      </div>

      {assignments.length === 0 ? (
        <EstudianteDisciplinasEmptyState onLinkDisciplines={onLinkDisciplines} />
      ) : (
        <EstudianteDisciplinasList
          assignments={assignments}
          unlinkingId={unlinkingId}
          onUnlink={handleUnlinkRequest}
        />
      )}

      <RemoveDisciplineDialog
        isOpen={confirmDialog.isOpen}
        onClose={handleCancelUnlink}
        onConfirm={handleConfirmUnlink}
        disciplineName={confirmDialog.disciplineName}
      />
    </div>
  );
};

export default EstudianteDisciplinasSection;
