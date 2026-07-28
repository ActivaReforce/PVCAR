
import { useMemo } from "react";
import { EntrenadorWithDetails } from "@/components/entrenadores/EntrenadorTypes";

export const useEntrenadoresFiltering = (
  entrenadores: EntrenadorWithDetails[],
  searchTerm: string
) => {
  // Filter entrenadores based on search term
  const filteredEntrenadores = useMemo(() => {
    return entrenadores.filter(entrenador => 
      entrenador.usuario.usu_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entrenador.ent_cedula && entrenador.ent_cedula.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [entrenadores, searchTerm]);

  // Custom sort function to handle nested properties and arrays
  const customSort = (data: typeof filteredEntrenadores, key: string, direction: 'asc' | 'desc') => {
    return [...data].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (key) {
        case 'usuario.usu_nombre':
          aValue = a.usuario.usu_nombre;
          bValue = b.usuario.usu_nombre;
          break;
        case 'colegios':
          aValue = a.colegios.join(', ');
          bValue = b.colegios.join(', ');
          break;
        case 'disciplinas_count':
          aValue = a.disciplinas_count;
          bValue = b.disciplinas_count;
          break;
        default:
          aValue = (a as any)[key] || '';
          bValue = (b as any)[key] || '';
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  return {
    filteredEntrenadores,
    customSort
  };
};
