
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
import { SurveyTable } from '@/components/surveys/SurveyTable';
import { DataPagination } from '@/components/ui/data-pagination';
import { useSurveys } from '@/hooks/useSurveys';
import { usePagination } from '@/hooks/usePagination';

const Encuestas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { surveys, isLoading, deleteSurvey } = useSurveys();

  const {
    currentPage,
    totalPages,
    paginatedData: paginatedSurveys,
    goToPage,
    canGoNext,
    canGoPrevious,
    startIndex,
    endIndex,
    totalItems,
  } = usePagination({
    data: surveys,
    itemsPerPage: 5,
  });

  const handleDelete = async (surveyId: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta encuesta?')) {
      try {
        await deleteSurvey(surveyId);
        toast({
          title: "Éxito",
          description: "Encuesta eliminada correctamente",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "No se pudo eliminar la encuesta",
          variant: "destructive"
        });
      }
    }
  };

  const handleCreateNew = () => {
    navigate('/encuestas/nueva');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-lg">Cargando encuestas...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 lg:p-6">
      {/* Desktop layout */}
      <div className="hidden sm:flex sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Gestión de Encuestas
        </h1>
        <Button onClick={handleCreateNew} className="w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Crear nueva encuesta
        </Button>
      </div>

      {/* Mobile layout */}
      <div className="sm:hidden space-y-4 mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Gestión de Encuestas
        </h1>
        <Button onClick={handleCreateNew} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Crear nueva encuesta
        </Button>
      </div>

      <div className="space-y-4">
        <SurveyTable surveys={paginatedSurveys} onDelete={handleDelete} />
        
        {totalItems > 5 && (
          <DataPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            canGoNext={canGoNext}
            canGoPrevious={canGoPrevious}
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={totalItems}
            itemName="encuestas"
          />
        )}
      </div>
    </div>
  );
};

export default Encuestas;
