
import React from 'react';
import EstudiantesModal from "./EstudiantesModal";
import EstudiantesViewModal from "./EstudiantesViewModal";
import AttachRepresentanteModal from "./AttachRepresentanteModal";
import LinkDisciplinasModal from "./LinkDisciplinasModal";
import { EstudianteWithDetails } from "@/hooks/useEstudiantesData";
import { Database } from "@/integrations/supabase/types";

type Colegio = Database['public']['Tables']['colegio']['Row'];

interface ModalStates {
  createModalOpen: boolean;
  editModalOpen: boolean;
  viewModalOpen: boolean;
  attachModalOpen: boolean;
  linkDisciplinasModalOpen: boolean;
}

interface EstudiantesModalsManagerProps {
  modalStates: ModalStates;
  onModalStateChange: (modalName: keyof ModalStates, open: boolean) => void;
  selectedEstudiante: EstudianteWithDetails | null;
  colegios: Colegio[];
  onSuccess: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAttach: () => void;
  onLinkDisciplines: () => void;
  onColegiosRefresh?: () => void; // New refresh callback
}

const EstudiantesModalsManager = ({
  modalStates,
  onModalStateChange,
  selectedEstudiante,
  colegios,
  onSuccess,
  onEdit,
  onDelete,
  onAttach,
  onLinkDisciplines,
  onColegiosRefresh
}: EstudiantesModalsManagerProps) => {
  return (
    <>
      <EstudiantesModal
        open={modalStates.createModalOpen}
        onOpenChange={(open) => onModalStateChange('createModalOpen', open)}
        estudiante={null}
        colegios={colegios}
        onSuccess={onSuccess}
        onColegiosRefresh={onColegiosRefresh}
      />

      <EstudiantesModal
        open={modalStates.editModalOpen}
        onOpenChange={(open) => onModalStateChange('editModalOpen', open)}
        estudiante={selectedEstudiante}
        colegios={colegios}
        onSuccess={onSuccess}
        onColegiosRefresh={onColegiosRefresh}
      />

      <EstudiantesViewModal
        open={modalStates.viewModalOpen}
        onOpenChange={(open) => onModalStateChange('viewModalOpen', open)}
        estudiante={selectedEstudiante}
        onEdit={onEdit}
        onDelete={onDelete}
        onAttach={onAttach}
        onLinkDisciplines={onLinkDisciplines}
      />

      <AttachRepresentanteModal
        open={modalStates.attachModalOpen}
        onOpenChange={(open) => onModalStateChange('attachModalOpen', open)}
        estudiante={selectedEstudiante}
        onSuccess={onSuccess}
      />

      <LinkDisciplinasModal
        open={modalStates.linkDisciplinasModalOpen}
        onOpenChange={(open) => onModalStateChange('linkDisciplinasModalOpen', open)}
        estudiante={selectedEstudiante}
        onSuccess={onSuccess}
      />
    </>
  );
};

export default EstudiantesModalsManager;
