
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SurveyStatusTag } from './SurveyStatusTag';
import { SurveyWithQuestions } from './SurveyTypes';
import { SurveyPreviewModal } from './SurveyPreviewModal';
import { TruncatedDescription } from './TruncatedDescription';
import { TruncatedTitle } from './TruncatedTitle';
import { ResponseRatio } from './ResponseRatio';
import { SurveyActionMenu } from './SurveyActionMenu';
import { useSurveyActions } from '@/hooks/useSurveyActions';
import { useSurveyBuilder } from '@/hooks/useSurveyBuilder';

interface SurveyTableProps {
  surveys: SurveyWithQuestions[];
  onDelete: (surveyId: number) => void;
}

export const SurveyTable: React.FC<SurveyTableProps> = ({
  surveys,
  onDelete
}) => {
  const navigate = useNavigate();
  const [previewSurvey, setPreviewSurvey] = useState<SurveyWithQuestions | null>(null);
  const { finalizeSurvey } = useSurveyActions();
  const { publishSurvey } = useSurveyBuilder();

  const handleEdit = (surveyId: number) => {
    navigate(`/encuestas/${surveyId}`);
  };

  const handleView = (surveyId: number) => {
    navigate(`/encuestas/${surveyId}/view`);
  };

  const handlePreview = (survey: SurveyWithQuestions) => {
    setPreviewSurvey(survey);
  };

  const handlePublish = async (surveyId: number) => {
    try {
      // Get the survey data first
      const survey = surveys.find(s => s.encu_id === surveyId);
      if (!survey) return;

      const formData = {
        encu_titulo: survey.encu_titulo,
        encu_descripcion: survey.encu_descripcion || '',
        questions: survey.questions || []
      };

      await publishSurvey(formData, surveyId, survey.encu_creador);
    } catch (error) {
      console.error('Error publishing survey:', error);
    }
  };

  const handleFinalize = async (surveyId: number) => {
    try {
      await finalizeSurvey(surveyId);
    } catch (error) {
      console.error('Error finalizing survey:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <TooltipProvider>
      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border w-full max-w-full overflow-hidden sm:overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Título</TableHead>
                  <TableHead className="w-40 hidden sm:table-cell">Descripción</TableHead>
                  <TableHead className="hidden sm:table-cell">Estado</TableHead>
                  <TableHead className="hidden sm:table-cell">Respondido</TableHead>
                  <TableHead className="hidden sm:table-cell">Fecha Creación</TableHead>
                  <TableHead className="w-12">
                    <span className="hidden sm:inline">⋯</span>
                    <span className="sm:hidden">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surveys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay encuestas creadas aún
                    </TableCell>
                  </TableRow>
                ) : (
                  surveys.map(survey => (
                    <TableRow key={survey.encu_id}>
                      <TableCell className="min-w-0 max-w-[160px] truncate sm:max-w-none">
                        <div className="space-y-1">
                          <TruncatedTitle title={survey.encu_titulo} maxLength={20} />
                          <div className="sm:hidden">
                            <SurveyStatusTag statusId={survey.est_id} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="w-40 hidden sm:table-cell">
                        <TruncatedDescription description={survey.encu_descripcion} maxLength={30} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <SurveyStatusTag statusId={survey.est_id} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <ResponseRatio surveyId={survey.encu_id} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {formatDate(survey.encu_fecha_creacion)}
                      </TableCell>
                      <TableCell>
                        <SurveyActionMenu
                          survey={survey}
                          onEdit={handleEdit}
                          onDelete={onDelete}
                          onPreview={handlePreview}
                          onPublish={handlePublish}
                          onFinalize={handleFinalize}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {previewSurvey && (
        <SurveyPreviewModal 
          isOpen={!!previewSurvey} 
          onClose={() => setPreviewSurvey(null)} 
          formData={{
            encu_titulo: previewSurvey.encu_titulo,
            encu_descripcion: previewSurvey.encu_descripcion || '',
            questions: previewSurvey.questions || []
          }} 
        />
      )}
    </TooltipProvider>
  );
};
