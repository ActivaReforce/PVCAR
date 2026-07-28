
import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Search, User } from "lucide-react";

type Usuario = Database['public']['Tables']['usuario']['Row'];

// Users who have the representative role (rol_id = 4).
type UsuarioRepresentante = Usuario;

interface EstudianteRepresentanteFormProps {
  selectedPadreId: number | null;
  onPadreChange: (usuId: number | null) => void;
}

const EstudianteRepresentanteForm = ({
  selectedPadreId,
  onPadreChange
}: EstudianteRepresentanteFormProps) => {
  const [representantes, setRepresentantes] = useState<UsuarioRepresentante[]>([]);
  const [filteredRepresentantes, setFilteredRepresentantes] = useState<UsuarioRepresentante[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRepresentantes = async () => {
    try {
      // Use a proper JOIN query instead of nested select
      const { data, error } = await supabase
        .from('usuario')
        .select(`
          usu_id,
          usu_nombre,
          usu_correo,
          usu_telefono,
          usu_foto,
          usu_fecha_creacion,
          usu_fecha_modificacion,
          usu_contrasena,
          est_id,
          usuario_rol!inner(rol_id)
        `)
        .eq('usuario_rol.rol_id', 4)
        .order('usu_fecha_creacion', { ascending: false });

      if (error) {
        console.error("Supabase query error:", error);
        throw error;
      }

      // Filter out any null usuarios and map to the expected format
      const usuariosRepresentantes = (data || []).filter(Boolean) as UsuarioRepresentante[];
      
      setRepresentantes(usuariosRepresentantes);
      setFilteredRepresentantes(usuariosRepresentantes);
    } catch (error) {
      console.error("Error fetching representantes:", error);
      toast({
        title: "Error",
        description: `Error al cargar representantes: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepresentantes();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredRepresentantes(representantes);
    } else {
      const filtered = representantes.filter(representante => 
        representante.usu_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        representante.usu_correo.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredRepresentantes(filtered);
    }
  }, [searchTerm, representantes]);

  const selectedRepresentante = representantes.find(r => r.usu_id === selectedPadreId);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Asignar Representante</h3>
      
      {selectedRepresentante && (
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium">{selectedRepresentante.usu_nombre}</p>
                <p className="text-sm text-muted-foreground">{selectedRepresentante.usu_correo}</p>
                {selectedRepresentante.usu_telefono && (
                  <p className="text-sm text-muted-foreground">
                    Teléfono: {selectedRepresentante.usu_telefono}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onPadreChange(null)}>
              Quitar
            </Button>
          </div>
        </div>
      )}

      {!selectedRepresentante && (
        <>
          <div className="space-y-2">
            <Label htmlFor="search-representante">Buscar Representante</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                id="search-representante"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre o correo..."
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Seleccionar Representante</Label>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando representantes...
              </div>
            ) : filteredRepresentantes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "No se encontraron representantes" : "No hay representantes registrados"}
              </div>
            ) : (
              <ScrollArea className="h-64 border rounded-md">
                <div className="p-2">
                  {filteredRepresentantes.map((representante) => (
                    <Button
                      key={representante.usu_id}
                      variant="ghost"
                      className="w-full justify-start p-3 h-auto"
                      onClick={() => onPadreChange(representante.usu_id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium">{representante.usu_nombre}</p>
                          <p className="text-sm text-muted-foreground">{representante.usu_correo}</p>
                          {representante.usu_telefono && (
                            <p className="text-xs text-muted-foreground">
                              Tel: {representante.usu_telefono}
                            </p>
                          )}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default EstudianteRepresentanteForm;
