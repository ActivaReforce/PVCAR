import DebouncedSearchInput from "@/components/ui/debounced-search-input";
import { useIsMobile } from "@/hooks/use-mobile";

interface UsuariosSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

const UsuariosSearch = ({ searchTerm, onSearchChange }: UsuariosSearchProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DebouncedSearchInput 
        placeholder="Buscar por nombre o email..." 
        value={searchTerm} 
        onChange={onSearchChange} 
        className="w-full max-w-full min-w-0"
        debounceMs={300}
      />
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
      <DebouncedSearchInput 
        placeholder="Buscar por nombre o email..." 
        value={searchTerm} 
        onChange={onSearchChange} 
        className="max-w-full sm:max-w-sm"
        debounceMs={300}
      />
    </div>
  );
};

export default UsuariosSearch;
