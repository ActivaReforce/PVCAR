
import { Card, CardContent } from "@/components/ui/card";
import { DataPagination } from "@/components/ui/data-pagination";
import EntrenadorTable from "./EntrenadorTable";
import { EntrenadorWithDetails } from "./EntrenadorTypes";
import { SortDirection } from "@/hooks/useSorting";

interface EntrenadorDataTableProps {
  entrenadores: EntrenadorWithDetails[];
  onView: (entrenador: EntrenadorWithDetails) => void;
  onAtar: (entrenador: EntrenadorWithDetails) => void;
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  startIndex: number;
  endIndex: number;
  totalItems: number;
}

const EntrenadorDataTable = ({
  entrenadores,
  onView,
  onAtar,
  sortKey,
  sortDirection,
  onSort,
  currentPage,
  totalPages,
  onPageChange,
  canGoNext,
  canGoPrevious,
  startIndex,
  endIndex,
  totalItems
}: EntrenadorDataTableProps) => {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <EntrenadorTable 
            entrenadores={entrenadores} 
            onView={onView} 
            onAtar={onAtar} 
            sortKey={sortKey} 
            sortDirection={sortDirection} 
            onSort={onSort} 
          />
        </div>
        
        <DataPagination 
          currentPage={currentPage} 
          totalPages={totalPages} 
          onPageChange={onPageChange} 
          canGoNext={canGoNext} 
          canGoPrevious={canGoPrevious} 
          startIndex={startIndex} 
          endIndex={endIndex} 
          totalItems={totalItems} 
          itemName="entrenadores" 
        />
      </CardContent>
    </Card>
  );
};

export default EntrenadorDataTable;
