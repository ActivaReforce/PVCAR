
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';

const UserReportsTab = () => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    role: 'all',
    status: '1' // Default to Active
  });

  // Fetch roles for filter
  const { data: roles } = useQuery({
    queryKey: ['roles-for-users-reports'],
    queryFn: async () => {
      const { data } = await supabase
        .from('rol')
        .select('rol_id, rol_nombre')
        .order('rol_nombre');
      return data || [];
    }
  });

  const handleFilterChange = (filterName: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      let usersQuery = supabase
        .from('usuario')
        .select(`
          *,
          usuario_rol!inner(
            rol:rol(rol_nombre)
          ),
          padre(padre_sector_residencia)
        `)
        .order('usu_fecha_creacion', { ascending: false });

      // Apply role filter
      if (filters.role !== 'all') {
        usersQuery = usersQuery.eq('usuario_rol.rol_id', parseInt(filters.role));
      }

      // Apply status filter
      if (filters.status !== 'all') {
        usersQuery = usersQuery.eq('est_id', parseInt(filters.status));
      }

      const { data: usersData, error: usersError } = await usersQuery;

      if (usersError) throw usersError;

      const excelData = [];

      for (const user of usersData || []) {
        // Get all user roles
        const { data: userRoles } = await supabase
          .from('usuario_rol')
          .select(`
            rol:rol(rol_nombre)
          `)
          .eq('usu_id', user.usu_id);

        const roleNames = userRoles?.map((ur: any) => ur.rol?.rol_nombre).filter(Boolean) || [];

        // Get parent residency sector
        const { data: parentData } = await supabase
          .from('padre')
          .select('padre_sector_residencia')
          .eq('usu_id', user.usu_id);

        const residencySectors = parentData?.map(p => p.padre_sector_residencia).filter(Boolean) || [];
        const uniqueSectors = [...new Set(residencySectors)];

        const baseData = {
          'ID Usuario': user.usu_id,
          'Nombre': user.usu_nombre,
          'Correo': user.usu_correo,
          'Teléfono': user.usu_telefono || '',
          'Fecha Creación': user.usu_fecha_creacion ? new Date(user.usu_fecha_creacion).toLocaleDateString() : '',
          'Roles': roleNames.join(', '),
          'Sector de residencia': uniqueSectors.join(', ')
        };

        excelData.push(baseData);
      }

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuarios');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `users_${currentDate}.xlsx`;

      // Write and download the file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Éxito",
        description: `Reporte exportado como ${filename}`
      });
    } catch (error) {
      console.error('Error exporting users:', error);
      toast({
        title: "Error",
        description: "Error al exportar el reporte de usuarios",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Datos de Usuarios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Role Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Rol</label>
              <Select value={filters.role} onValueChange={(value) => handleFilterChange('role', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {roles?.map((role) => (
                    <SelectItem key={role.rol_id} value={role.rol_id.toString()}>
                      {role.rol_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado del Usuario</label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="1">Activo</SelectItem>
                  <SelectItem value="2">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button
            onClick={handleExportToExcel}
            disabled={isExporting}
            className="bg-[#FD5757] hover:bg-[#E04747]"
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? 'Exportando...' : 'Exportar a Excel'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserReportsTab;
