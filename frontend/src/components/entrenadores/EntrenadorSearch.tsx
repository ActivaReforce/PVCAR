import { Card, CardHeader } from "@/components/ui/card";
import DebouncedSearchInput from "@/components/ui/debounced-search-input";

interface EntrenadorSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

const EntrenadorSearch = ({ searchTerm, onSearchChange }: EntrenadorSearchProps) => {
  return (
    <Card>
      <CardHeader>
        <DebouncedSearchInput 
          placeholder="Buscar por nombre o cédula..." 
          value={searchTerm} 
          onChange={onSearchChange} 
          className="max-w-full sm:max-w-sm"
          debounceMs={300}
        />
      </CardHeader>
    </Card>
  );
};

export default EntrenadorSearch;
