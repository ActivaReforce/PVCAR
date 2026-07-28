import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePagination } from "@/hooks/usePagination";
import { useSorting } from "@/hooks/useSorting";
import { DataPagination } from "@/components/ui/data-pagination";
import SchoolCardGrid from "@/components/schools/SchoolCardGrid";
import SchoolForm from "@/components/schools/SchoolForm";
import { ConditionalAction } from "@/components/ui/conditional-actions";

// Define the Colegio type with coordinators info
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

type ColegioFormValues = {
  col_nombre: string;
  col_direccion: string;
  col_rep_nombre?: string | null;
  col_rep_telefono?: string | null;
  col_rep_email?: string | null;
};

export default function Colegios() {
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedColegio, setSelectedColegio] = useState<Colegio | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Filter colegios based on search term
  const filteredColegios = colegios.filter(colegio => {
    if (!searchTerm.trim()) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return colegio.col_nombre.toLowerCase().includes(searchLower);
  });

  // Sorting
  const {
    sortedData: sortedColegios,
    sortKey,
    sortDirection,
    handleSort
  } = useSorting({
    data: filteredColegios,
    defaultSortKey: 'col_nombre',
    defaultSortDirection: 'asc'
  });

  // Pagination
  const {
    currentPage,
    totalPages,
    paginatedData: paginatedColegios,
    goToPage,
    canGoNext,
    canGoPrevious,
    startIndex,
    endIndex,
    totalItems
  } = usePagination({
    data: sortedColegios,
    itemsPerPage: 5
  });

  // Fetch all colegios with coordinators information - BATCHED to avoid N+1
  const fetchColegios = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all colegios in one query
      const { data: colegiosData, error: colegiosError } = await supabase
        .from("colegio")
        .select("*")
        .order("col_nombre");
      
      if (colegiosError) throw colegiosError;

      if (!colegiosData || colegiosData.length === 0) {
        setColegios([]);
        return;
      }

      // 2. BATCH: Fetch ALL coordinators for ALL colegios in ONE query
      const colegioIds = colegiosData.map(c => c.col_id);
      const { data: allCoordinatorsData, error: coordinatorsError } = await supabase
        .from("colegio_coordinador")
        .select(`
          col_id,
          usu_id,
          usuario:usu_id(
            usu_id,
            usu_nombre
          )
        `)
        .in("col_id", colegioIds);

      if (coordinatorsError) {
        console.error("Error fetching coordinators:", coordinatorsError);
      }

      // 3. Group coordinators by colegio_id for efficient lookup
      const coordinatorsByColId = new Map<number, Array<{ usu_id: number; usu_nombre: string }>>();
      (allCoordinatorsData || []).forEach(cc => {
        if (cc.usuario && cc.col_id) {
          const existing = coordinatorsByColId.get(cc.col_id) || [];
          existing.push(cc.usuario as { usu_id: number; usu_nombre: string });
          coordinatorsByColId.set(cc.col_id, existing);
        }
      });

      // 4. Build final data structure without additional queries
      const colegiosWithCoordinators = colegiosData.map(colegio => ({
        ...colegio,
        coordinators: coordinatorsByColId.get(colegio.col_id) || []
      }));

      setColegios(colegiosWithCoordinators);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Error al cargar los colegios: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchColegios();
  }, []);

  // Handle opening edit dialog
  const handleEdit = (colegio: Colegio) => {
    setSelectedColegio(colegio);
    setIsFormDialogOpen(true);
  };

  // Handle opening create dialog
  const handleCreate = () => {
    setSelectedColegio(null);
    setIsFormDialogOpen(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = (colegio: Colegio) => {
    setSelectedColegio(colegio);
    setIsDeleteDialogOpen(true);
  };

  // Upload image to Supabase Storage
  const uploadImage = async (file: File, id: number): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `colegio_${id}_${Date.now()}.${fileExt}`;
      const filePath = `colegios/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('usufoto')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage
        .from('usufoto')
        .getPublicUrl(filePath);
      
      return data.publicUrl;
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Error al subir la imagen: ${error.message}`,
        variant: "destructive"
      });
      return null;
    }
  };

  // Delete image from Supabase Storage
  const deleteImage = async (url: string) => {
    try {
      const path = url.split('/').pop();
      if (!path) return;
      
      const { error } = await supabase.storage
        .from('usufoto')
        .remove([`colegios/${path}`]);
      
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Error al eliminar la imagen anterior: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  // Handle form submission (create or update)
  const handleFormSubmit = async (
    values: ColegioFormValues, 
    imageFile: File | null, 
    coordinatorIds: number[]
  ) => {
    try {
      let imageUrl = selectedColegio?.col_rep_foto || null;

      // If there's a new image, upload it
      if (imageFile) {
        // If editing and there's an existing image, delete it
        if (selectedColegio?.col_rep_foto) {
          await deleteImage(selectedColegio.col_rep_foto);
        }
        const id = selectedColegio?.col_id || Date.now();
        imageUrl = await uploadImage(imageFile, id);
      }

      // Prepare form data
      const formData = {
        col_nombre: values.col_nombre,
        col_direccion: values.col_direccion,
        col_rep_nombre: values.col_rep_nombre || null,
        col_rep_telefono: values.col_rep_telefono || null,
        col_rep_email: values.col_rep_email || null,
        col_rep_foto: imageUrl,
      };

      if (selectedColegio) {
        // Update existing colegio
        const { error: updateError } = await supabase
          .from("colegio")
          .update(formData)
          .eq("col_id", selectedColegio.col_id);
        
        if (updateError) throw updateError;

        // Update coordinators: first delete existing, then insert new ones
        const { error: deleteCoordinatorsError } = await supabase
          .from("colegio_coordinador")
          .delete()
          .eq("col_id", selectedColegio.col_id);
        
        if (deleteCoordinatorsError) throw deleteCoordinatorsError;

        // Insert new coordinators
        if (coordinatorIds.length > 0) {
          const coordinatorInserts = coordinatorIds.map(usu_id => ({
            col_id: selectedColegio.col_id,
            usu_id
          }));

          const { error: insertCoordinatorsError } = await supabase
            .from("colegio_coordinador")
            .insert(coordinatorInserts);
          
          if (insertCoordinatorsError) throw insertCoordinatorsError;
        }

        toast({
          title: "Éxito",
          description: "Colegio actualizado correctamente"
        });
      } else {
        // Create new colegio
        const { data: newColegio, error: insertError } = await supabase
          .from("colegio")
          .insert(formData)
          .select()
          .single();
        
        if (insertError) throw insertError;

        // Insert coordinators
        if (coordinatorIds.length > 0 && newColegio) {
          const coordinatorInserts = coordinatorIds.map(usu_id => ({
            col_id: newColegio.col_id,
            usu_id
          }));

          const { error: insertCoordinatorsError } = await supabase
            .from("colegio_coordinador")
            .insert(coordinatorInserts);
          
          if (insertCoordinatorsError) throw insertCoordinatorsError;
        }

        toast({
          title: "Éxito",
          description: "Colegio creado correctamente"
        });
      }

      setIsFormDialogOpen(false);
      fetchColegios();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedColegio) return;
    
    try {
      // Delete image if exists
      if (selectedColegio.col_rep_foto) {
        await deleteImage(selectedColegio.col_rep_foto);
      }

      // Delete coordinators first (foreign key constraint)
      const { error: deleteCoordinatorsError } = await supabase
        .from("colegio_coordinador")
        .delete()
        .eq("col_id", selectedColegio.col_id);
      
      if (deleteCoordinatorsError) throw deleteCoordinatorsError;

      // Delete the colegio record
      const { error: deleteError } = await supabase
        .from("colegio")
        .delete()
        .eq("col_id", selectedColegio.col_id);
      
      if (deleteError) throw deleteError;

      toast({
        title: "Éxito",
        description: "Colegio eliminado correctamente"
      });
      
      setIsDeleteDialogOpen(false);
      fetchColegios();
    } catch (error: any) {
      // Check if it's a foreign key constraint violation
      let errorMessage = error.message;
      
      if (error.code === '23503' || error.message?.includes('foreign key') || error.message?.includes('violates')) {
        errorMessage = "No puede eliminar el colegio si existen disciplinas en este colegio";
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto px-4 lg:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 py-[6px] gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Gestión de Colegios</h1>
        <ConditionalAction module="colegios" action="crear">
          <Button 
            onClick={handleCreate} 
            className="bg-[#FD5757] hover:bg-[#E04747] text-white font-semibold px-4 sm:px-6 py-2 shadow-lg w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" /> Nuevo Colegio
          </Button>
        </ConditionalAction>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre del colegio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Cards of colegios */}
      {isLoading ? (
        <div className="text-center py-10">Cargando...</div>
      ) : filteredColegios.length === 0 ? (
        <div className="text-center py-10 px-4">
          <p className="text-sm sm:text-base">
            {searchTerm ? "No se encontraron colegios que coincidan con la búsqueda" : "No hay colegios registrados"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <SchoolCardGrid
            schools={paginatedColegios}
            onEdit={handleEdit}
            onDelete={handleDeleteConfirm}
          />

          <DataPagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={goToPage} 
            canGoNext={canGoNext} 
            canGoPrevious={canGoPrevious} 
            startIndex={startIndex} 
            endIndex={endIndex} 
            totalItems={totalItems} 
            itemName="colegios" 
          />
        </div>
      )}

      {/* Create/Edit Form Dialog */}
      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-md md:max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {selectedColegio ? "Editar Colegio" : "Nuevo Colegio"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {selectedColegio ? "Actualiza la información del colegio." : "Completa el formulario para crear un nuevo colegio."}
            </DialogDescription>
          </DialogHeader>

          <SchoolForm 
            school={selectedColegio} 
            onSubmit={handleFormSubmit} 
            onCancel={() => setIsFormDialogOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Esta acción eliminará el colegio "{selectedColegio?.col_nombre}" permanentemente.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground w-full sm:w-auto"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
