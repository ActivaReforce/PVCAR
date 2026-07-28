import DebouncedSearchInput from "@/components/ui/debounced-search-input";

interface ActivitySearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

const ActivitySearch = ({ searchTerm, onSearchChange }: ActivitySearchProps) => {
  return (
    <div className="mb-4">
      <DebouncedSearchInput
        placeholder="Buscar por nombre de la actividad..."
        value={searchTerm}
        onChange={onSearchChange}
        debounceMs={300}
      />
    </div>
  );
};

export default ActivitySearch;
