
import { useState } from 'react';
import { EstudianteWithDetails } from './useEstudiantesData';

interface ModalStates {
  createModalOpen: boolean;
  editModalOpen: boolean;
  viewModalOpen: boolean;
  attachModalOpen: boolean;
  linkDisciplinasModalOpen: boolean;
}

export const useEstudiantesModals = () => {
  const [modalStates, setModalStates] = useState<ModalStates>({
    createModalOpen: false,
    editModalOpen: false,
    viewModalOpen: false,
    attachModalOpen: false,
    linkDisciplinasModalOpen: false,
  });
  
  const [selectedEstudiante, setSelectedEstudiante] = useState<EstudianteWithDetails | null>(null);

  const setModalState = (modalName: keyof ModalStates, open: boolean) => {
    setModalStates(prev => ({ ...prev, [modalName]: open }));
  };

  const closeAllModals = () => {
    setModalStates({
      createModalOpen: false,
      editModalOpen: false,
      viewModalOpen: false,
      attachModalOpen: false,
      linkDisciplinasModalOpen: false,
    });
  };

  const handleCreate = () => {
    setSelectedEstudiante(null);
    setModalState('createModalOpen', true);
  };

  const handleEdit = (estudiante: EstudianteWithDetails) => {
    setSelectedEstudiante(estudiante);
    setModalState('editModalOpen', true);
  };

  const handleView = (estudiante: EstudianteWithDetails) => {
    setSelectedEstudiante(estudiante);
    setModalState('viewModalOpen', true);
  };

  const handleAttach = (estudiante: EstudianteWithDetails) => {
    setSelectedEstudiante(estudiante);
    setModalState('attachModalOpen', true);
  };

  const handleLinkDisciplines = (estudiante: EstudianteWithDetails) => {
    setSelectedEstudiante(estudiante);
    setModalState('linkDisciplinasModalOpen', true);
  };

  const handleViewEdit = () => {
    setModalState('viewModalOpen', false);
    setModalState('editModalOpen', true);
  };

  const handleViewAttach = () => {
    setModalState('viewModalOpen', false);
    setModalState('attachModalOpen', true);
  };

  const handleViewLinkDisciplines = () => {
    setModalState('viewModalOpen', false);
    setModalState('linkDisciplinasModalOpen', true);
  };

  return {
    modalStates,
    selectedEstudiante,
    setModalState,
    closeAllModals,
    handleCreate,
    handleEdit,
    handleView,
    handleAttach,
    handleLinkDisciplines,
    handleViewEdit,
    handleViewAttach,
    handleViewLinkDisciplines
  };
};
