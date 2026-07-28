
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { ConditionalAction } from "@/components/ui/conditional-actions";
import { useAuth } from "@/contexts/AuthContext";

interface DisciplinaCounts {
  total: number;
  assigned: number;
}

interface DisciplinasHeaderProps {
  onCreateDisciplina: () => void;
  disciplinaCounts: DisciplinaCounts;
  isTrainer?: boolean;
}

const DisciplinasHeader = ({ 
  onCreateDisciplina, 
  disciplinaCounts, 
  isTrainer = false 
}: DisciplinasHeaderProps) => {
  const { user } = useAuth();
  
  const isRepresentante = () => {
    return user?.roles?.some(role => role.rol_id === 4);
  };

  // Don't render header for representantes (role 4)
  if (isRepresentante()) {
    return null;
  }

  const unassignedCount = disciplinaCounts.total - disciplinaCounts.assigned;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white">
              Disciplinas
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-sm">
                Total: {disciplinaCounts.total}
              </Badge>
              <Badge variant="default" className="text-sm bg-green-100 text-green-800">
                Asignadas: {disciplinaCounts.assigned}
              </Badge>
              <Badge variant="outline" className="text-sm">
                Sin asignar: {unassignedCount}
              </Badge>
            </div>
          </div>
          
          <ConditionalAction module="disciplinas" action="crear">
            <Button 
              onClick={onCreateDisciplina}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nueva Disciplina
            </Button>
          </ConditionalAction>
        </div>
      </CardHeader>
    </Card>
  );
};

export default DisciplinasHeader;
