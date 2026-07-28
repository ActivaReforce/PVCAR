
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { RemoveDisciplineDialog } from '@/components/estudiantes/RemoveDisciplineDialog';
import { useLinkDisciplinesModal } from './LinkDisciplinesModal/useLinkDisciplinesModal';

interface LinkDisciplinesToEvaluationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluationId: number | null;
  evaluationTitle: string;
}

const LinkDisciplinesToEvaluationModal: React.FC<LinkDisciplinesToEvaluationModalProps> = ({
  open,
  onOpenChange,
  evaluationId,
  evaluationTitle
}) => {
  const [removeDialog, setRemoveDialog] = useState<{
    open: boolean;
    disciplineId: number | null;
    disciplineName: string;
  }>({ open: false, disciplineId: null, disciplineName: '' });

  const {
    schools,
    linkedDisciplines,
    selectedDisciplines,
    searchTerm,
    isLoading,
    isSaving,
    isUnlinking,
    canUnlinkDiscipline,
    setSearchTerm,
    handleDisciplineToggle,
    handleUnlink,
    handleSave
  } = useLinkDisciplinesModal(evaluationId, open);

  const handleRemoveClick = (disciplineId: number, disciplineName: string) => {
    // Check if user can remove this discipline
    const discipline = linkedDisciplines.find(ld => ld.evaasig_id === disciplineId);
    if (discipline && !canUnlinkDiscipline(discipline)) {
      return; // Don't allow removal
    }

    setRemoveDialog({
      open: true,
      disciplineId,
      disciplineName
    });
  };

  const handleRemoveConfirm = () => {
    if (removeDialog.disciplineId) {
      handleUnlink(removeDialog.disciplineId);
    }
    setRemoveDialog({ open: false, disciplineId: null, disciplineName: '' });
  };

  const handleRemoveCancel = () => {
    setRemoveDialog({ open: false, disciplineId: null, disciplineName: '' });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Vincular disciplinas a evaluación</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Datos básicos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">Datos básicos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Título de la evaluación:</span> {evaluationTitle}
                </div>
              </CardContent>
            </Card>

            {/* Disciplinas asignadas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">Disciplinas asignadas</CardTitle>
              </CardHeader>
              <CardContent>
                {linkedDisciplines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay disciplinas asignadas</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {linkedDisciplines.map(discipline => {
                      const canUnlink = canUnlinkDiscipline(discipline);
                      return (
                        <Badge 
                          key={discipline.colacthor_id} 
                          variant="default" 
                          className={`flex items-center gap-1 pr-1 ${
                            !canUnlink ? 'opacity-50 bg-gray-400' : ''
                          }`}
                        >
                          <span className="text-xs">
                            {discipline.colegio_actividad_horario.actividad.act_nombre} - {discipline.colegio.col_nombre}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`h-4 w-4 p-0 ${
                              canUnlink 
                                ? 'hover:bg-destructive hover:text-destructive-foreground' 
                                : 'cursor-not-allowed opacity-50'
                            }`}
                            onClick={() => canUnlink && handleRemoveClick(
                              discipline.evaasig_id, 
                              `${discipline.colegio_actividad_horario.actividad.act_nombre} - ${discipline.colegio.col_nombre}`
                            )} 
                            disabled={isUnlinking === discipline.evaasig_id || !canUnlink}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Disciplinas disponibles */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">Disciplinas disponibles</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar disciplina..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="pl-10" 
                  />
                </div>

                {/* Disciplines list - scrollable */}
                <div className="max-h-80 overflow-y-auto space-y-4">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Cargando disciplinas...</p>
                    </div>
                  ) : schools.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No hay disciplinas disponibles
                    </p>
                  ) : (
                    schools.map(school => (
                      <div key={school.col_id} className="space-y-2">
                        <h4 className="font-medium text-sm text-muted-foreground">
                          {school.col_nombre}
                        </h4>
                        <div className="space-y-2 pl-4">
                          {school.disciplines
                            .filter(discipline => 
                              discipline.actividad.act_nombre.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            .map(discipline => {
                              const isLinked = linkedDisciplines.some(linked => linked.colacthor_id === discipline.colacthor_id);
                              const isSelected = selectedDisciplines.has(discipline.colacthor_id);
                              return (
                                <div key={discipline.colacthor_id} className="flex items-center space-x-2">
                                  <Checkbox 
                                    id={`discipline-${discipline.colacthor_id}`} 
                                    checked={isSelected} 
                                    disabled={isLinked} 
                                    onCheckedChange={() => handleDisciplineToggle(discipline.colacthor_id)} 
                                  />
                                  <label 
                                    htmlFor={`discipline-${discipline.colacthor_id}`} 
                                    className={`text-sm flex-1 cursor-pointer ${isLinked ? 'text-muted-foreground line-through' : ''}`}
                                  >
                                    {discipline.actividad.act_nombre} - {discipline.dia.dia_nombre} {discipline.colacthor_hora_inicio}-{discipline.colacthor_hora_fin}
                                    {isLinked && <span className="ml-2 text-xs">(ya asignada)</span>}
                                  </label>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="border-t pt-4 bg-white">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {selectedDisciplines.size > 0 && (
                  <Badge variant="outline">{selectedDisciplines.size} seleccionada(s)</Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cerrar
                </Button>
                <Button onClick={handleSave} disabled={selectedDisciplines.size === 0 || isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RemoveDisciplineDialog
        isOpen={removeDialog.open}
        onClose={handleRemoveCancel}
        onConfirm={handleRemoveConfirm}
        disciplineName={removeDialog.disciplineName}
      />
    </>
  );
};

export default LinkDisciplinesToEvaluationModal;
