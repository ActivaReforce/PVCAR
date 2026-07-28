
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SurveyFormData } from './SurveyTypes';

interface SurveyGeneralInfoProps {
  formData: SurveyFormData;
  onUpdate: (updates: Partial<SurveyFormData>) => void;
  isDisabled?: boolean;
}

export const SurveyGeneralInfo: React.FC<SurveyGeneralInfoProps> = ({
  formData,
  onUpdate,
  isDisabled = false
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información General</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="title">Título *</Label>
          <Input
            id="title"
            value={formData.encu_titulo}
            onChange={(e) => onUpdate({ encu_titulo: e.target.value })}
            placeholder="Título de la encuesta..."
            required
            disabled={isDisabled}
          />
        </div>
        <div>
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            value={formData.encu_descripcion}
            onChange={(e) => onUpdate({ encu_descripcion: e.target.value })}
            placeholder="Descripción o instrucciones de la encuesta..."
            disabled={isDisabled}
          />
        </div>
      </CardContent>
    </Card>
  );
};
