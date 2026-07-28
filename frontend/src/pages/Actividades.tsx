import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ActivityHeader from "@/components/activities/ActivityHeader";
import ActivityFilters from "@/components/activities/ActivityFilters";
import WalletCategoryView from "@/components/activities/WalletCategoryView";
import AllActivitiesView from "@/components/activities/AllActivitiesView";
import ActivityDialogs from "@/components/activities/ActivityDialogs";

interface Categoria {
  cat_id: number;
  cat_nombre: string;
  cat_descripcion?: string | null;
}

interface Actividad {
  act_id: number;
  act_nombre: string;
  act_descripcion?: string | null;
  act_materiales_alumno?: string[] | null;
  act_indumentaria_tipo?: string | null;
  act_espacio_trabajo?: string | null;
  act_tipo_espacio?: string | null;
  act_espacio_secundario?: string | null;
  cat_id?: number | null;
  act_fecha_creacion: string;
  act_fecha_modificacion: string;
  categoria?: Categoria | null;
}

type ActividadFormValues = {
  act_nombre: string;
  act_descripcion?: string | null;
  act_materiales_alumno?: string[] | null;
  act_indumentaria_tipo?: string | null;
  act_espacio_trabajo?: string | null;
  act_tipo_espacio?: string | null;
  act_espacio_secundario?: string | null;
  cat_id?: number | null;
};

export default function Actividades() {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [selectedActividad, setSelectedActividad] = useState<Actividad | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewMode, setViewMode] = useState<'categories' | 'all'>('categories');
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [materialesInput, setMaterialesInput] = useState("");
  const { toast } = useToast();

  // Fetch categorias
  const fetchCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from("categoria")
        .select("cat_id, cat_nombre, cat_descripcion")
        .order("cat_nombre");
      
      if (error) throw error;
      setCategorias(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Error al cargar las categorías: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  // Fetch all actividades with categoria information
  const fetchActividades = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("actividad")
        .select(`
          *,
          categoria:cat_id(cat_id, cat_nombre, cat_descripcion)
        `)
        .order("act_nombre");
      
      if (error) throw error;
      
      const transformedData = (data || []).map(actividad => ({
        ...actividad,
        categoria: actividad.categoria || null
      }));
      
      setActividades(transformedData);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Error al cargar las actividades: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActividades();
    fetchCategorias();
  }, []);

  // Filter actividades based on search term and category
  const filteredActividades = actividades.filter(actividad => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm.trim() || actividad.act_nombre.toLowerCase().includes(searchLower);
    const matchesCategory = selectedCategory === "all" || actividad.cat_id?.toString() === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Group activities by category for envelope view
  const actividadesByCategory = categorias.map(categoria => ({
    categoria,
    actividades: filteredActividades.filter(actividad => actividad.cat_id === categoria.cat_id)
  })).filter(group => group.actividades.length > 0);

  // Add uncategorized activities
  const uncategorizedActividades = filteredActividades.filter(actividad => !actividad.cat_id);
  if (uncategorizedActividades.length > 0) {
    actividadesByCategory.push({
      categoria: { cat_id: 0, cat_nombre: "Sin Categoría", cat_descripcion: "Actividades sin categoría asignada" },
      actividades: uncategorizedActividades
    });
  }

  const handleCategoryToggle = (categoriaId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoriaId)) {
      newExpanded.delete(categoriaId);
    } else {
      newExpanded.add(categoriaId);
    }
    setExpandedCategories(newExpanded);
  };

  // Handle opening edit dialog
  const handleEdit = (actividad: Actividad) => {
    setSelectedActividad(actividad);
    setMaterialesInput(actividad.act_materiales_alumno?.join(', ') || '');
    setIsFormDialogOpen(true);
  };

  // Handle opening create dialog
  const handleCreate = () => {
    setSelectedActividad(null);
    setMaterialesInput('');
    setIsFormDialogOpen(true);
  };

  // Handle viewing details
  const handleViewDetails = (actividad: Actividad) => {
    setSelectedActividad(actividad);
    setIsDetailsDialogOpen(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = (actividad: Actividad) => {
    setSelectedActividad(actividad);
    setIsDeleteDialogOpen(true);
  };

  // Handle form submission (create or update)
  const handleFormSubmit = async (values: ActividadFormValues) => {
    setIsFormLoading(true);
    try {
      const formData = {
        act_nombre: values.act_nombre,
        act_descripcion: values.act_descripcion || null,
        act_materiales_alumno: values.act_materiales_alumno || null,
        act_indumentaria_tipo: values.act_indumentaria_tipo || null,
        act_espacio_trabajo: values.act_espacio_trabajo || null,
        act_tipo_espacio: values.act_tipo_espacio || null,
        act_espacio_secundario: values.act_espacio_secundario || null,
        cat_id: values.cat_id || null,
        act_fecha_modificacion: new Date().toISOString()
      };

      if (selectedActividad) {
        // Update existing
        const { error } = await supabase
          .from("actividad")
          .update(formData)
          .eq("act_id", selectedActividad.act_id);
        
        if (error) throw error;
        
        toast({
          title: "Éxito",
          description: "Actividad actualizada correctamente"
        });
      } else {
        // Create new
        const { error } = await supabase
          .from("actividad")
          .insert({
            ...formData,
            act_fecha_creacion: new Date().toISOString()
          });
        
        if (error) throw error;
        
        toast({
          title: "Éxito",
          description: "Actividad creada correctamente"
        });
      }

      setIsFormDialogOpen(false);
      fetchActividades();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsFormLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedActividad) return;
    
    try {
      const { error } = await supabase
        .from("actividad")
        .delete()
        .eq("act_id", selectedActividad.act_id);
      
      if (error) throw error;
      
      toast({
        title: "Éxito",
        description: "Actividad eliminada correctamente"
      });
      
      setIsDeleteDialogOpen(false);
      fetchActividades();
    } catch (error: any) {
      // Check if it's a foreign key violation error
      const isForeignKeyError = error.code === '23503' || 
        error.message?.toLowerCase().includes('foreign key') ||
        error.message?.toLowerCase().includes('violates');
      
      toast({
        title: "Error",
        description: isForeignKeyError 
          ? "No puede eliminar la actividad si existen disciplinas con esta actividad"
          : error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto px-4 lg:px-6 space-y-6">
      <ActivityHeader onCreateActivity={handleCreate} />
      
      <ActivityFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        categorias={categorias}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {isLoading ? (
        <div className="text-center py-10">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4 mx-auto"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {viewMode === 'categories' ? (
            // Wallet Category View
            <WalletCategoryView
              actividadesByCategory={actividadesByCategory}
              onView={handleViewDetails}
              onEdit={handleEdit}
              onDelete={handleDeleteConfirm}
            />
          ) : (
            // All Activities Grid View
            <AllActivitiesView
              actividades={filteredActividades}
              onView={handleViewDetails}
              onEdit={handleEdit}
              onDelete={handleDeleteConfirm}
            />
          )}
        </div>
      )}

      <ActivityDialogs
        isFormDialogOpen={isFormDialogOpen}
        setIsFormDialogOpen={setIsFormDialogOpen}
        isDetailsDialogOpen={isDetailsDialogOpen}
        setIsDetailsDialogOpen={setIsDetailsDialogOpen}
        isDeleteDialogOpen={isDeleteDialogOpen}
        setIsDeleteDialogOpen={setIsDeleteDialogOpen}
        selectedActividad={selectedActividad}
        isFormLoading={isFormLoading}
        materialesInput={materialesInput}
        setMaterialesInput={setMaterialesInput}
        onFormSubmit={handleFormSubmit}
        onDelete={handleDelete}
      />
    </div>
  );
}
