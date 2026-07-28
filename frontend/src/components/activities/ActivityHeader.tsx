
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ConditionalAction } from "@/components/ui/conditional-actions";

interface ActivityHeaderProps {
  onCreateActivity: () => void;
}

const ActivityHeader = ({ onCreateActivity }: ActivityHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 py-[6px] gap-4">
      <h1 className="text-2xl sm:text-3xl font-bold">Gestión de Actividades</h1>
      <ConditionalAction module="actividades" action="crear">
        <Button 
          onClick={onCreateActivity} 
          className="bg-[#FD5757] hover:bg-[#E04747] text-white font-semibold px-4 sm:px-6 py-2 shadow-lg w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" /> Nueva Actividad
        </Button>
      </ConditionalAction>
    </div>
  );
};

export default ActivityHeader;
