
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { SurveyFormData, SURVEY_STATUS, QUESTION_TYPES } from './SurveyTypes';
import { useSurveyBuilder } from '@/hooks/useSurveyBuilder';
import { validateSurveyForm } from './SurveyValidation';
import { SurveyHeader } from './SurveyHeader';
import { SurveyPreviewModal } from './SurveyPreviewModal';
import { SurveyBuilderContainer } from './SurveyBuilderContainer';
import { PublishConfirmationDialog } from './PublishConfirmationDialog';

export const SurveyBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditing = !!id;

  const {
    survey,
    isLoading,
    saveSurvey,
    publishSurvey,
    loadSurvey
  } = useSurveyBuilder();

  const [formData, setFormData] = useState<SurveyFormData>({
    encu_titulo: '',
    encu_descripcion: '',
    questions: []
  });

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);

  // Check if user is authenticated
  useEffect(() => {
    if (!user) {
      toast({
        title: "Acceso denegado",
        description: "Debes iniciar sesión para crear encuestas.",
        variant: "destructive"
      });
      navigate('/login');
      return;
    }
  }, [user, navigate, toast]);

  useEffect(() => {
    if (isEditing && id && user) {
      loadSurvey(parseInt(id)).then((data) => {
        if (data) {
          setFormData({
            encu_titulo: data.encu_titulo,
            encu_descripcion: data.encu_descripcion || '',
            questions: data.questions || []
          });
        }
      }).catch((error) => {
        console.error('Error loading survey:', error);
        toast({
          title: "Error",
          description: "No se pudo cargar la encuesta. Verifica que el ID sea válido.",
          variant: "destructive"
        });
      });
    } else if (!isEditing) {
      // Auto-create first blank question for new surveys
      setFormData(prev => ({
        ...prev,
        questions: [{
          encupreg_pregunta: '',
          encupreg_nota: '',
          encutiporesp_id: QUESTION_TYPES.TEXT_SHORT,
          encupreg_orden: 1
        }]
      }));
    }
  }, [id, isEditing, loadSurvey, toast, user]);

  const handleFormUpdate = (updates: Partial<SurveyFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const validateAndShowError = (): boolean => {
    if (!user) {
      toast({
        title: "Error de autenticación",
        description: "Debes iniciar sesión para guardar encuestas.",
        variant: "destructive"
      });
      return false;
    }

    const error = validateSurveyForm(formData);
    if (error) {
      toast({
        title: error.title,
        description: error.description,
        variant: "destructive"
      });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateAndShowError()) return;

    try {
      await saveSurvey(formData, isEditing ? parseInt(id!) : undefined, user!.usu_id);
      toast({
        title: "Éxito",
        description: "Encuesta guardada correctamente",
      });
      navigate('/encuestas');
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la encuesta. Verifica que todos los campos estén completos.",
        variant: "destructive"
      });
    }
  };

  const handlePublishClick = () => {
    if (!validateAndShowError()) return;
    setIsPublishDialogOpen(true);
  };

  const handlePublishConfirm = async () => {
    try {
      await publishSurvey(formData, isEditing ? parseInt(id!) : undefined, user!.usu_id);
      toast({
        title: "Éxito",
        description: "Encuesta publicada correctamente",
      });
      navigate('/encuestas');
    } catch (error) {
      console.error('Publish error:', error);
      toast({
        title: "Error",
        description: "No se pudo publicar la encuesta. Verifica que todos los campos estén completos.",
        variant: "destructive"
      });
    } finally {
      setIsPublishDialogOpen(false);
    }
  };

  const handlePreview = () => {
    if (!formData.encu_titulo.trim()) {
      toast({
        title: "Error",
        description: "Debe agregar un título antes de previsualizar",
        variant: "destructive"
      });
      return;
    }
    
    if (formData.questions.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos una pregunta antes de previsualizar",
        variant: "destructive"
      });
      return;
    }

    setIsPreviewOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-lg">Cargando...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isPublished = survey?.est_id === SURVEY_STATUS.PUBLISHED;

  return (
    <div className="container mx-auto p-4 lg:p-6 max-w-4xl">
      <SurveyHeader 
        isEditing={isEditing}
        onBack={() => navigate('/encuestas')}
        onPreview={handlePreview}
        onSave={handleSave}
        onPublish={handlePublishClick}
        showActions={!isPublished}
      />

      <SurveyBuilderContainer
        isEditing={isEditing}
        surveyId={id}
        isPublished={isPublished}
        formData={formData}
        onFormUpdate={handleFormUpdate}
        onSave={handleSave}
        onPublish={handlePublishClick}
        onPreview={handlePreview}
      />

      <SurveyPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        formData={formData}
      />

      <PublishConfirmationDialog
        isOpen={isPublishDialogOpen}
        onClose={() => setIsPublishDialogOpen(false)}
        onConfirm={handlePublishConfirm}
      />
    </div>
  );
};
