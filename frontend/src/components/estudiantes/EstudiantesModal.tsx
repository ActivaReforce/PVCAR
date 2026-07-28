import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import EstudianteBasicForm from "./EstudianteBasicForm";
import EstudianteRepresentanteForm from "./EstudianteRepresentanteForm";
import { compressImage } from "@/lib/imageCompression";

type Nino = Database['public']['Tables']['nino']['Row'];
type Colegio = Database['public']['Tables']['colegio']['Row'];

interface EstudianteWithDetails extends Nino {
  colegio: { col_nombre: string } | null;
  categoria_nino_grado?: { catninograd_nombre: string } | null;
  representantes: Array<{
    padre: {
      padre_id: number;
      usu_id: number;
      usuario: Database['public']['Tables']['usuario']['Row'];
    };
  }>;
}

interface EstudiantesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estudiante: EstudianteWithDetails | null;
  colegios: Colegio[];
  onSuccess: () => void;
  onColegiosRefresh?: () => void; // New callback to refresh colegios from parent
}

interface FormData {
  col_id: number | null;
  nino_nombre: string;
  nino_edad: number | null;
  nino_cedula: string;
  catninograd_id: number | null;
  nino_toma_transporte: boolean | null;
  nino_info_salud: string;
  nino_otra_info: string;
  selectedUsuId: number | null;
}

const EstudiantesModal = ({
  open,
  onOpenChange,
  estudiante,
  colegios: propColegios,
  onSuccess,
  onColegiosRefresh
}: EstudiantesModalProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [colegios, setColegios] = useState<Colegio[]>(propColegios || []);
  const [loadingColegios, setLoadingColegios] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    col_id: null,
    nino_nombre: "",
    nino_edad: null,
    nino_cedula: "",
    catninograd_id: null,
    nino_toma_transporte: null,
    nino_info_salud: "",
    nino_otra_info: "",
    selectedUsuId: null,
  });

  const isEditMode = !!estudiante;

  // Fetch all colegios when modal opens or when refresh is requested
  const fetchColegios = async () => {
    setLoadingColegios(true);
    try {
      const { data, error } = await supabase
        .from('colegio')
        .select('*')
        .order('col_nombre');

      if (error) throw error;
      setColegios(data || []);
    } catch (error) {
      console.error('Error fetching colegios:', error);
      toast({
        title: "Error",
        description: "Error al cargar los colegios",
        variant: "destructive",
      });
    } finally {
      setLoadingColegios(false);
    }
  };

  // Refresh colegios when parent requests it
  useEffect(() => {
    if (onColegiosRefresh && open) {
      fetchColegios();
    }
  }, [onColegiosRefresh, open]);

  useEffect(() => {
    if (open) {
      fetchColegios();
    }
  }, [open]);

  useEffect(() => {
    if (estudiante && open) {
      setFormData({
        col_id: estudiante.col_id,
        nino_nombre: estudiante.nino_nombre,
        nino_edad: estudiante.nino_edad,
        nino_cedula: estudiante.nino_cedula || "",
        catninograd_id: estudiante.catninograd_id,
        nino_toma_transporte: estudiante.nino_toma_transporte,
        nino_info_salud: estudiante.nino_info_salud || "",
        nino_otra_info: estudiante.nino_otra_info || "",
        selectedUsuId: estudiante.representantes[0]?.padre?.usu_id || null,
      });
    } else if (!estudiante && open) {
      setFormData({
        col_id: null,
        nino_nombre: "",
        nino_edad: null,
        nino_cedula: "",
        catninograd_id: null,
        nino_toma_transporte: null,
        nino_info_salud: "",
        nino_otra_info: "",
        selectedUsuId: null,
      });
    }
    setCurrentStep(1);
    setPhotoFile(null);
  }, [estudiante, open]);

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isStep1Valid = () => {
    return formData.col_id && formData.nino_nombre.trim();
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      // Compress the image transparently before uploading
      let toUpload = file;
      try {
        toUpload = await compressImage(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 800,
          initialQuality: 0.8,
          useWebWorker: true,
        });
      } catch (compressionError) {
        console.warn("Image compression failed, proceeding with original file:", compressionError);
      }

      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('usufoto')
        .upload(filePath, toUpload);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('usufoto')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading photo:", error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!isStep1Valid()) {
      toast({
        title: "Error",
        description: "Debe completar los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let photoUrl = estudiante?.nino_foto;
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile);
        if (!photoUrl) {
          throw new Error("Error al subir la foto");
        }
      }

      const estudianteData = {
        col_id: formData.col_id!,
        nino_nombre: formData.nino_nombre,
        nino_edad: formData.nino_edad,
        nino_cedula: formData.nino_cedula || null,
        catninograd_id: formData.catninograd_id,
        nino_toma_transporte: formData.nino_toma_transporte,
        nino_info_salud: formData.nino_info_salud || null,
        nino_otra_info: formData.nino_otra_info || null,
        nino_foto: photoUrl,
        nino_fecha_modificacion: new Date().toISOString(),
      };

      let ninoId: number;

      if (isEditMode) {
        const { error } = await supabase
          .from('nino')
          .update(estudianteData)
          .eq('nino_id', estudiante!.nino_id);

        if (error) throw error;
        ninoId = estudiante!.nino_id;

        // Update representante relationship if changed
        const currentUsuId = estudiante!.representantes[0]?.padre?.usu_id || null;
        if (formData.selectedUsuId !== currentUsuId) {
          // Remove existing relationships
          await supabase
            .from('nino_padre')
            .delete()
            .eq('nino_id', ninoId);

          // Add new relationship if selected
          if (formData.selectedUsuId) {
            // First, get or create the padre record for this usuario
            let padreId: number;
            
            const { data: existingPadre, error: findError } = await supabase
              .from('padre')
              .select('padre_id')
              .eq('usu_id', formData.selectedUsuId)
              .single();

            if (findError && findError.code !== 'PGRST116') {
              throw findError;
            }

            if (existingPadre) {
              padreId = existingPadre.padre_id;
            } else {
              // Create a new padre record
              const { data: newPadre, error: createError } = await supabase
                .from('padre')
                .insert({
                  usu_id: formData.selectedUsuId,
                  padre_fecha_creacion: new Date().toISOString(),
                  padre_fecha_modificacion: new Date().toISOString()
                })
                .select('padre_id')
                .single();

              if (createError) throw createError;
              padreId = newPadre.padre_id;
            }

            // Create the nino_padre relationship
            const { error: relationError } = await supabase
              .from('nino_padre')
              .insert({
                nino_id: ninoId,
                padre_id: padreId
              });

            if (relationError) throw relationError;
          }
        }
      } else {
        const { data, error } = await supabase
          .from('nino')
          .insert([{
            ...estudianteData,
            nino_fecha_creacion: new Date().toISOString(),
          }])
          .select()
          .single();

        if (error) throw error;
        ninoId = data.nino_id;

        // Add representante relationship if selected
        if (formData.selectedUsuId) {
          // First, get or create the padre record for this usuario
          let padreId: number;
          
          const { data: existingPadre, error: findError } = await supabase
            .from('padre')
            .select('padre_id')
            .eq('usu_id', formData.selectedUsuId)
            .single();

          if (findError && findError.code !== 'PGRST116') {
            throw findError;
          }

          if (existingPadre) {
            padreId = existingPadre.padre_id;
          } else {
            // Create a new padre record
            const { data: newPadre, error: createError } = await supabase
              .from('padre')
              .insert({
                usu_id: formData.selectedUsuId,
                padre_fecha_creacion: new Date().toISOString(),
                padre_fecha_modificacion: new Date().toISOString()
              })
              .select('padre_id')
              .single();

            if (createError) throw createError;
            padreId = newPadre.padre_id;
          }

          // Create the nino_padre relationship
          const { error: relationError } = await supabase
            .from('nino_padre')
            .insert({
              nino_id: ninoId,
              padre_id: padreId
            });

          if (relationError) throw relationError;
        }
      }

      toast({
        title: "Éxito",
        description: `Estudiante ${isEditMode ? "actualizado" : "creado"} correctamente`,
      });

      onSuccess();
    } catch (error: any) {
      console.error("Error saving estudiante:", error);
      toast({
        title: "Error",
        description: error.message || `Error al ${isEditMode ? "actualizar" : "crear"} el estudiante`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (isStep1Valid()) {
      setCurrentStep(2);
    }
  };

  const handleSkipAndSave = () => {
    handleSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Editar Alumno" : "Nuevo Alumno"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step indicator */}
          <div className="flex items-center space-x-4">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              1
            </div>
            <div className={`flex-1 h-1 ${currentStep >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              2
            </div>
          </div>

          {currentStep === 1 && (
            <EstudianteBasicForm
              formData={formData}
              colegios={colegios}
              loadingColegios={loadingColegios}
              initialImageUrl={estudiante?.nino_foto}
              onInputChange={handleInputChange}
              onImageChange={setPhotoFile}
            />
          )}

          {currentStep === 2 && (
            <EstudianteRepresentanteForm
              selectedPadreId={formData.selectedUsuId}
              onPadreChange={(usuId) => handleInputChange('selectedUsuId', usuId)}
            />
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4">
            {currentStep === 1 ? (
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!isStep1Valid()}
                >
                  Siguiente
                </Button>
              </div>
            ) : (
              <div className="flex justify-between w-full">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                >
                  Anterior
                </Button>
                <div className="flex gap-2">
                  {!formData.selectedUsuId && (
                    <Button
                      variant="outline"
                      onClick={handleSkipAndSave}
                      disabled={loading}
                      data-testid="skip-and-save-btn"
                    >
                      Omitir y Guardar
                    </Button>
                  )}
                  {formData.selectedUsuId && (
                    <Button
                      onClick={handleSubmit}
                      disabled={loading}
                      data-testid="create-btn"
                    >
                      {loading ? "Guardando..." : (isEditMode ? "Actualizar" : "Crear")}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EstudiantesModal;
