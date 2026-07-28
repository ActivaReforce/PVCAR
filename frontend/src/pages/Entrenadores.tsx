
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSorting } from "@/hooks/useSorting";
import { useEntrenadoresData } from "@/hooks/useEntrenadoresData";
import { useEntrenadoresFiltering } from "@/hooks/useEntrenadoresFiltering";
import { useIsMobile } from "@/hooks/use-mobile";
import { EntrenadorWithDetails } from "@/components/entrenadores/EntrenadorTypes";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import EntrenadorHeader from "@/components/entrenadores/EntrenadorHeader";
import EntrenadorDetail from "@/components/entrenadores/EntrenadorDetail";
import AtarEntrenadorModal from "@/components/entrenadores/AtarEntrenadorModal";
import AtarAuxiliarModal from "@/components/entrenadores/AtarAuxiliarModal";
import EntrenadorTable from "@/components/entrenadores/EntrenadorTable";
import MobileSchoolSelector from "@/components/entrenadores/MobileSchoolSelector";

const Entrenadores = () => {
  const isMobile = useIsMobile();
  const [showDetails, setShowDetails] = useState(false);
  const [showAtarModal, setShowAtarModal] = useState(false);
  const [showAuxiliarModal, setShowAuxiliarModal] = useState(false);
  const [viewingEntrenador, setViewingEntrenador] = useState<EntrenadorWithDetails | null>(null);
  const [selectedEntrenador, setSelectedEntrenador] = useState<EntrenadorWithDetails | null>(null);
  const [auxiliarEntrenador, setAuxiliarEntrenador] = useState<EntrenadorWithDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<number | 'unassigned' | 'all' | null>('all');
  const [coordinatorSchools, setCoordinatorSchools] = useState<Array<{ col_id: number; col_nombre: string; count?: number }>>([]);
  const { user } = useAuth();

  // Data management
  const {
    entrenadores,
    loading,
    loadEntrenadores
  } = useEntrenadoresData();

  // Filtering and sorting
  const {
    filteredEntrenadores,
    customSort
  } = useEntrenadoresFiltering(entrenadores, searchTerm);

  // Sorting for filtered entrenadores
  const {
    sortKey,
    sortDirection,
    handleSort
  } = useSorting({
    data: filteredEntrenadores,
    defaultSortKey: 'ent_fecha_creacion',
    defaultSortDirection: 'desc'
  });

  // Apply custom sorting
  const sortedEntrenadores = sortKey ? customSort(filteredEntrenadores, sortKey, sortDirection) : filteredEntrenadores;

  // Check if user is coordinator
  const isCoordinator = () => {
    return user?.roles?.some(role => role.rol_id === 2);
  };

  // Load coordinator schools
  useEffect(() => {
    const loadCoordinatorSchools = async () => {
      if (!isCoordinator() || !user?.usu_id) {
        return;
      }

      try {
        const { data, error } = await supabase
          .from('colegio_coordinador')
          .select(`
            col_id,
            colegio:col_id (
              col_id,
              col_nombre
            )
          `)
          .eq('usu_id', user.usu_id);

        if (error) {
          console.error("Error loading coordinator schools:", error);
          return;
        }

        const schools = (data || [])
          .map(item => ({
            col_id: (item.colegio as any)?.col_id || 0,
            col_nombre: (item.colegio as any)?.col_nombre || '',
            count: 0
          }))
          .filter(school => school.col_nombre);

        console.log("Loaded coordinator schools:", schools);
        setCoordinatorSchools(schools);
      } catch (error) {
        console.error("Error in loadCoordinatorSchools:", error);
      }
    };

    loadCoordinatorSchools();
  }, [user]);

  // Get available schools with counts - consistent ID generation
  const getAvailableSchools = () => {
    const schoolCounts = new Map<string, number>();
    
    entrenadores.forEach(trainer => {
      trainer.colegios.forEach(school => {
        schoolCounts.set(school, (schoolCounts.get(school) || 0) + 1);
      });
    });
    
    // Create consistent ID from school name hash
    const hashString = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash);
    };
    
    const schoolsWithCounts = Array.from(schoolCounts.entries())
      .map(([schoolName, count]) => ({
        col_id: hashString(schoolName),
        col_nombre: schoolName,
        count
      }))
      .sort((a, b) => a.col_nombre.localeCompare(b.col_nombre));
    
    console.log("Available schools with counts:", schoolsWithCounts);
    
    if (isCoordinator()) {
      const filtered = schoolsWithCounts.filter(school => 
        coordinatorSchools.some(cs => cs.col_nombre === school.col_nombre)
      );
      console.log("Coordinator filtered schools:", filtered);
      return filtered;
    }
    
    return schoolsWithCounts;
  };

  // Filter trainers based on selected filter
  const getFilteredTrainers = () => {
    console.log("Filtering trainers with selectedFilter:", selectedFilter);
    console.log("Total sortedEntrenadores:", sortedEntrenadores.length);
    
    if (selectedFilter === 'all') {
      if (isCoordinator()) {
        const filtered = sortedEntrenadores.filter(trainer => 
          trainer.colegios.length === 0 || 
          trainer.colegios.some(school => coordinatorSchools.some(cs => 
            typeof cs === 'string' ? cs === school : cs.col_nombre === school
          ))
        );
        console.log("Coordinator 'all' filtered trainers:", filtered.length);
        return filtered;
      }
      console.log("Returning all trainers for non-coordinator:", sortedEntrenadores.length);
      return sortedEntrenadores;
    }
    if (selectedFilter === 'unassigned') {
      const filtered = sortedEntrenadores.filter(trainer => trainer.disciplinas_count === 0);
      console.log("Unassigned trainers:", filtered.length);
      return filtered;
    }
    if (typeof selectedFilter === 'number') {
      const schoolName = getAvailableSchools().find(s => s.col_id === selectedFilter)?.col_nombre;
      console.log("Filtering by school:", schoolName, "for ID:", selectedFilter);
      const filtered = schoolName ? sortedEntrenadores.filter(trainer => trainer.colegios.includes(schoolName)) : [];
      console.log("School filtered trainers:", filtered.length);
      return filtered;
    }
    return sortedEntrenadores;
  };

  const handleViewEntrenador = (entrenador: EntrenadorWithDetails) => {
    setViewingEntrenador(entrenador);
    setShowDetails(true);
  };

  const handleAtarEntrenador = (entrenador: EntrenadorWithDetails) => {
    setSelectedEntrenador(entrenador);
    setShowAtarModal(true);
  };

  const handleAgregarAuxiliar = (entrenador: EntrenadorWithDetails) => {
    setAuxiliarEntrenador(entrenador);
    setShowAuxiliarModal(true);
  };

  const handleDetailsClose = () => {
    setShowDetails(false);
    setViewingEntrenador(null);
  };

  const handleAtarModalClose = () => {
    setShowAtarModal(false);
    setSelectedEntrenador(null);
  };

  const handleAuxiliarModalClose = () => {
    setShowAuxiliarModal(false);
    setAuxiliarEntrenador(null);
  };

  const handleAtarSuccess = () => {
    loadEntrenadores();
    handleAtarModalClose();
  };

  const handleAuxiliarSuccess = () => {
    loadEntrenadores();
    handleAuxiliarModalClose();
  };

  const handleSchoolChange = (schoolId: number | 'unassigned' | 'all' | null) => {
    console.log("School filter changed to:", schoolId);
    setSelectedFilter(schoolId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Cargando entrenadores...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6 max-w-full min-w-0">
      <EntrenadorHeader title="Gestión de Entrenadores" />

      {/* Trainers list view */}
      <div className="space-y-4">
        {isMobile ? (
          <div className="space-y-4">
            <MobileSchoolSelector
              schools={getAvailableSchools()}
              selectedSchool={selectedFilter}
              onSchoolChange={handleSchoolChange}
              isCoordinator={isCoordinator()}
            />
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0 dark:text-black" />
              <Input
                placeholder="Buscar por nombre o cédula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-gray-200 dark:text-black"
              />
            </div>
          </div>
        ) : (
          <>
            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2 bg-gray-100 p-4 dark:bg-gray-100">
              <Button
                variant={selectedFilter === 'unassigned' ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter('unassigned')}
                className="flex items-center gap-2"
              >
                Sin asignar
                <Badge variant="secondary" className="text-xs">
                  {entrenadores.filter(e => e.disciplinas_count === 0).length}
                </Badge>
              </Button>
              
              {!isCoordinator() && (
                <Button
                  variant={selectedFilter === 'all' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFilter('all')}
                  className="flex items-center gap-2"
                >
                  Ver todos
                  <Badge variant="secondary" className="text-xs">
                    {entrenadores.length}
                  </Badge>
                </Button>
              )}
              
              {getAvailableSchools().map((school) => (
                <Button
                  key={school.col_id}
                  variant={selectedFilter === school.col_id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFilter(school.col_id)}
                  className="flex items-center gap-2"
                >
                  {school.col_nombre}
                  <Badge variant="secondary" className="text-xs">
                    {school.count}
                  </Badge>
                </Button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o cédula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-full sm:max-w-sm bg-white dark:bg-gray-200 dark:text-black"
              />
            </div>
          </>
        )}

        {/* Trainers Table */}
        <div className="bg-white rounded-lg">
          <EntrenadorTable
            entrenadores={getFilteredTrainers()}
            onView={handleViewEntrenador}
            onAtar={handleAtarEntrenador}
            onAgregarAuxiliar={handleAgregarAuxiliar}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        </div>
      </div>

      {/* Entrenador Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-md md:max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Detalles del Entrenador</DialogTitle>
          </DialogHeader>

          {viewingEntrenador && (
            <EntrenadorDetail
              entrenador={viewingEntrenador}
              onClose={handleDetailsClose}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Atar Entrenador Modal */}
      <AtarEntrenadorModal
        open={showAtarModal}
        onOpenChange={setShowAtarModal}
        entrenador={selectedEntrenador}
        onClose={handleAtarModalClose}
        onSuccess={handleAtarSuccess}
      />

      {/* Atar Auxiliar Modal */}
      <AtarAuxiliarModal
        open={showAuxiliarModal}
        onOpenChange={setShowAuxiliarModal}
        entrenador={auxiliarEntrenador}
        onClose={handleAuxiliarModalClose}
        onSuccess={handleAuxiliarSuccess}
      />
    </div>
  );
};

export default Entrenadores;
