
import React from 'react';
import { Button } from "@/components/ui/button";
import { Link as LinkIcon } from "lucide-react";

interface EstudianteDisciplinasEmptyStateProps {
  onLinkDisciplines: () => void;
}

const EstudianteDisciplinasEmptyState = ({
  onLinkDisciplines
}: EstudianteDisciplinasEmptyStateProps) => {
  return (
    <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
      <LinkIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
      <p>Sin disciplinas asignadas</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={onLinkDisciplines}
      >
        <LinkIcon className="h-4 w-4 mr-2" />
        Asignar Primera Disciplina
      </Button>
    </div>
  );
};

export default EstudianteDisciplinasEmptyState;
