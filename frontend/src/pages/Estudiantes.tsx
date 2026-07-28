
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search } from "lucide-react";
import { useEstudiantesModals } from "@/hooks/useEstudiantesModals";
import { useStudentsPagination } from "@/hooks/useStudentsPagination";
import { useStudentCounts } from "@/hooks/useStudentCounts";
import { useSchoolCounts } from "@/hooks/useSchoolCounts";
import EstudiantesHeader from "@/components/estudiantes/EstudiantesHeader";
import EstudiantesDataTable from "@/components/estudiantes/EstudiantesDataTable";
import EstudiantesModalsManager from "@/components/estudiantes/EstudiantesModalsManager";
import EstudiantesSchoolCardGrid from "@/components/estudiantes/EstudiantesSchoolCardGrid";
import EstudiantesResponsiveFilters from "@/components/estudiantes/EstudiantesResponsiveFilters";
import StudentStatusFilters from "@/components/estudiantes/StudentStatusFilters";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Estudiantes = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [selectedDiscipline, setSelectedDiscipline] = useState<number | null>(null);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Check if user is a trainer (role 3) or auxiliary (roles 6/7)
  const isTrainer = user?.roles?.some(role => role.rol_id === 3);
  const isAuxiliary = user?.roles?.some(role => role.rol_id === 6 || role.rol_id === 7);
  
  // Use new optimized hooks
  const { schoolCounts, loading: schoolCountsLoading, trainerContext, refreshSchoolCounts } = useSchoolCounts();
  
  // Get student counts for status filters (without discipline filters)
  const { counts: studentCounts, loading: countsLoading, refetch: refreshStudentCounts } = useStudentCounts({
    selectedSchool,
    searchQuery
  });
  
  const {
    students,
    loading: studentsLoading,
    currentPage,
    totalPages,
    totalCount,
    startIndex,
    endIndex,
    canGoNext,
    canGoPrevious,
    goToPage,
    loadStudents,
    refreshStudents
  } = useStudentsPagination({
    itemsPerPage: 7,
    selectedSchool,
    selectedDiscipline,
    searchQuery,
    statusFilter,
    showUnassigned
  });

  const {
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
  } = useEstudiantesModals();

  // Check if trainer/coordinator has only one colegio and auto-select it
  // For auxiliary roles, always auto-select the first colegio to skip cards view
  useEffect(() => {
    const isCoordinator = user?.roles?.some(role => role.rol_id === 2);
    
    if (isCoordinator && schoolCounts.length === 1 && !selectedSchool) {
      // If coordinator has exactly one colegio, auto-select it
      setSelectedSchool(schoolCounts[0].col_nombre);
    } else if (isAuxiliary && trainerContext.resolved && schoolCounts.length > 0 && !selectedSchool) {
      // For auxiliary roles, always auto-select the first colegio to skip cards view
      setSelectedSchool(schoolCounts[0].col_nombre);
    } else if (isTrainer && schoolCounts.length === 1 && !selectedSchool) {
      // If trainer has exactly one colegio, auto-select it
      setSelectedSchool(schoolCounts[0].col_nombre);
    }
  }, [schoolCounts, user, selectedSchool, isTrainer, isAuxiliary, trainerContext.resolved]);

  // Load students when filters change (use ref for stable loadStudents reference)
  useEffect(() => {
    if (selectedSchool) {
      loadStudents(1); // Reset to first page when filters change
    }
  }, [selectedSchool, selectedDiscipline, searchQuery, statusFilter, showUnassigned]); // Removed loadStudents from deps

  const handleStatusChange = (status: 'active' | 'inactive' | 'all') => {
    setStatusFilter(status);
  };

  const handleDelete = async (estudiante: any) => {
    try {
      const { error: studentError } = await supabase
        .from('nino')
        .update({ 
          est_id: 2,
          nino_fecha_modificacion: new Date().toISOString()
        })
        .eq('nino_id', estudiante.nino_id);

      if (studentError) throw studentError;

      const { error: assignmentError } = await supabase
        .from('nino_asignacion')
        .update({ 
          est_id: 2,
          ninoasig_fecha_baja: new Date().toISOString()
        })
        .eq('nino_id', estudiante.nino_id)
        .eq('est_id', 1);

      if (assignmentError) throw assignmentError;

      toast({
        title: "Éxito",
        description: "Estudiante y disciplinas desactivados correctamente",
      });

      refreshStudents();
    } catch (error) {
      console.error("Error deactivating estudiante:", error);
      toast({
        title: "Error",
        description: "Error al desactivar estudiante",
        variant: "destructive",
      });
    }
  };

  const handleReactivate = async (estudiante: any) => {
    try {
      const { error } = await supabase
        .from('nino')
        .update({ 
          est_id: 1,
          nino_fecha_modificacion: new Date().toISOString()
        })
        .eq('nino_id', estudiante.nino_id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Estudiante reactivado correctamente",
      });

      setStatusFilter('active');
      refreshStudents();
    } catch (error) {
      console.error("Error reactivating estudiante:", error);
      toast({
        title: "Error",
        description: "Error al reactivar estudiante",
        variant: "destructive",
      });
    }
  };

  const handlePermanentDelete = async (estudiante: any) => {
    try {
      const { error } = await supabase
        .from('nino')
        .delete()
        .eq('nino_id', estudiante.nino_id);

      if (error) {
        if (error.code === '23503') {
          toast({
            title: "No se puede eliminar",
            description: "No se puede eliminar el estudiante porque tiene registros relacionados.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: `Error al eliminar permanentemente el estudiante: ${error.message}`,
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "Éxito",
        description: "Estudiante eliminado permanentemente",
      });

      refreshStudents();
    } catch (error) {
      console.error("Error permanently deleting estudiante:", error);
      toast({
        title: "Error",
        description: "Error inesperado al eliminar permanentemente el estudiante",
        variant: "destructive",
      });
    }
  };

  const handleModalSuccess = () => {
    closeAllModals();
    refreshStudents();
    refreshStudentCounts(); // Refresh student counts for status filters and "Sin Asignar" badge
    refreshSchoolCounts(); // Refresh school counts for dropdown updates
  };

  // Combined refresh function for colegios in modal dropdowns
  const handleColegiosRefresh = () => {
    refreshSchoolCounts();
  };

  const handleViewDelete = async () => {
    setModalState('viewModalOpen', false);
    if (selectedEstudiante) {
      await handleDelete(selectedEstudiante);
    }
  };

  const handleSchoolSelect = (schoolName: string) => {
    setSelectedSchool(schoolName);
    setSelectedDiscipline(null);
    setShowUnassigned(false);
    setSearchQuery('');
  };

  const handleBackToCards = () => {
    setSelectedSchool(null);
    setSelectedDiscipline(null);
    setShowUnassigned(false);
    setSearchQuery(''); // Clear search when going back
  };

  const handleDisciplineSelect = (disciplineId: number | null) => {
    setSelectedDiscipline(disciplineId);
  };

  const handleUnassignedSelect = (showUnassigned: boolean) => {
    setShowUnassigned(showUnassigned);
  };

  const handleCollegeFilterSelect = (schoolName: string) => {
    setSelectedSchool(schoolName);
    setSelectedDiscipline(null);
    setShowUnassigned(false);
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Always show header */}
      <EstudiantesHeader
        searchQuery=""
        onSearchChange={() => {}}
        onCreateNew={handleCreate}
        showSearch={false}
      />

      {/* Add informational title for roles 6 and 7 */}
      {isAuxiliary && trainerContext.trainerName && (
        <div className="container mx-auto px-4 lg:px-6 pb-2">
          <p className="text-sm text-muted-foreground">
            Estudiantes del entrenador {trainerContext.trainerName}
          </p>
        </div>
      )}

      <div className="container mx-auto p-4 lg:p-6">
        {selectedSchool ? (
          // List view with filters
          <div className="space-y-4">
            {/* Mobile Layout */}
            <div className="sm:hidden space-y-3">
              {/* Back to cards button - Full width */}
              {!(isAuxiliary && trainerContext.trainerId) && !((user?.roles?.some(role => role.rol_id === 2 || role.rol_id === 3)) && schoolCounts.length === 1) && (
                <Button variant="outline" onClick={handleBackToCards} className="w-full flex items-center justify-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Volver a Tarjetas
                </Button>
              )}
              
              
              {/* Status filters - Hide icons and badges on mobile */}
              {!isTrainer && !isAuxiliary && (
                <div className="flex justify-between gap-1">
                  <Button
                    variant={statusFilter === 'active' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter('active')}
                    className="flex-1 text-xs px-2"
                  >
                    Activos
                  </Button>
                  
                  <Button
                    variant={statusFilter === 'inactive' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter('inactive')}
                    className="flex-1 text-xs px-2"
                  >
                    Inactivos
                  </Button>

                  <Button
                    variant={statusFilter === 'all' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                    className="flex-1 text-xs px-2"
                  >
                    Todos
                  </Button>
                </div>
              )}
            </div>

            {/* Desktop Layout */}
            <div className="hidden sm:block">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                {/* Show back button only if not auxiliary and not single colegio scenario */}
                {!(isAuxiliary && trainerContext.trainerId) && !((user?.roles?.some(role => role.rol_id === 2 || role.rol_id === 3)) && schoolCounts.length === 1) && (
                  <Button variant="outline" onClick={handleBackToCards} className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Volver a tarjetas
                  </Button>
                )}
                
                {/* Hide status filters for trainers (role 3) and auxiliaries (roles 6/7) */}
                {!isTrainer && !isAuxiliary && (
                  <StudentStatusFilters
                    statusFilter={statusFilter}
                    onStatusChange={setStatusFilter}
                    studentCounts={studentCounts}
                  />
                )}
              </div>
            </div>

            {/* Responsive Filters */}
            <EstudiantesResponsiveFilters
        colegios={schoolCounts.map(school => ({ 
          col_id: school.col_id, 
          col_nombre: school.col_nombre,
          col_direccion: '',
          col_fecha_creacion: '',
          col_fecha_modificacion: '',
          col_rep_email: '',
          col_rep_foto: '',
          col_rep_nombre: '',
          col_rep_telefono: ''
        }))}
              selectedSchool={selectedSchool}
              selectedDiscipline={selectedDiscipline}
              showUnassigned={showUnassigned}
              statusFilter={statusFilter}
              onCollegeFilterSelect={handleCollegeFilterSelect}
              onDisciplineSelect={handleDisciplineSelect}
              onUnassignedSelect={handleUnassignedSelect}
              searchQuery={searchQuery}
            />

            {/* Search bar */}
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar alumnos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full"
              />
            </div>

            {/* Students Table */}
            <EstudiantesDataTable
              estudiantes={students}
              loading={studentsLoading}
              searchQuery=""
              selectedDiscipline={selectedDiscipline}
              showUnassigned={showUnassigned}
              statusFilter={statusFilter}
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              startIndex={startIndex}
              endIndex={endIndex}
              canGoNext={canGoNext}
              canGoPrevious={canGoPrevious}
              onPageChange={goToPage}
              onEdit={handleEdit}
              onView={handleView}
              onDelete={handleDelete}
              onReactivate={handleReactivate}
              onPermanentDelete={handlePermanentDelete}
              onAttach={handleAttach}
              onLinkDisciplines={handleLinkDisciplines}
            />
          </div>
        ) : (
          // Card grid view (only show for non-auxiliary roles with multiple colegios)
          <div className="space-y-4">
            {/* Hide status filters for trainers (role 3) and auxiliaries (roles 6/7) */}
            {!isTrainer && !isAuxiliary && (
              <StudentStatusFilters
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                studentCounts={studentCounts}
              />
            )}
            
            <EstudiantesSchoolCardGrid
              estudiantes={[]}
              colegios={schoolCounts}
              onSchoolSelect={handleSchoolSelect}
            />
          </div>
        )}
      </div>

      <EstudiantesModalsManager
        modalStates={modalStates}
        onModalStateChange={setModalState}
        selectedEstudiante={selectedEstudiante}
        colegios={schoolCounts.map(school => ({ 
          col_id: school.col_id, 
          col_nombre: school.col_nombre,
          col_direccion: '',
          col_fecha_creacion: '',
          col_fecha_modificacion: '',
          col_rep_email: '',
          col_rep_foto: '',
          col_rep_nombre: '',
          col_rep_telefono: ''
        }))}
        onSuccess={handleModalSuccess}
        onEdit={handleViewEdit}
        onDelete={handleViewDelete}
        onAttach={handleViewAttach}
        onLinkDisciplines={handleViewLinkDisciplines}
        onColegiosRefresh={handleColegiosRefresh}
      />
    </div>
  );
};

export default Estudiantes;
