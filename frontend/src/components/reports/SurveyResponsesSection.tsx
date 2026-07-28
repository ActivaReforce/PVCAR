import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/data-pagination';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePagination } from '@/hooks/usePagination';
import { cn } from '@/lib/utils';
interface Question {
  encupreg_id: number;
  encupreg_pregunta: string;
  encupreg_orden: number;
  encupreg_nota?: string;
}
interface Representative {
  padre_id: number;
  usu_nombre: string;
}
interface ResponseData {
  padre_id: number;
  usu_nombre: string;
  response: string;
}
interface RepresentativeResponse {
  encupreg_pregunta: string;
  encupreg_nota?: string;
  response: string;
  encupreg_orden: number;
}
interface SurveyResponsesSectionProps {
  selectedSurvey: string;
  surveyName: string;
}

// Helper function to format response data - used consistently across both views
const formatResponse = (item: any): string => {
  if (item.encurespu_texto) return item.encurespu_texto;
  if (item.encurespu_num !== null && item.encurespu_num !== undefined) return item.encurespu_num.toString();
  if (item.encurespu_fecha) return new Date(item.encurespu_fecha).toLocaleDateString();
  if (item.encurespu_hora) return item.encurespu_hora;
  if (item.encurespu_sino !== null && item.encurespu_sino !== undefined) return item.encurespu_sino ? 'Sí' : 'No';
  return 'Sin respuesta';
};
const SurveyResponsesSection: React.FC<SurveyResponsesSectionProps> = ({
  selectedSurvey,
  surveyName
}) => {
  const [selectedQuestion, setSelectedQuestion] = useState<string>('placeholder');
  const [selectedRepresentative, setSelectedRepresentative] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [representativeDropdownOpen, setRepresentativeDropdownOpen] = useState(false);

  // Fetch questions for the selected survey
  const {
    data: questions = []
  } = useQuery({
    queryKey: ['survey-questions', selectedSurvey],
    queryFn: async (): Promise<Question[]> => {
      if (selectedSurvey === 'placeholder') return [];
      const {
        data,
        error
      } = await supabase.from('encuesta_pregunta').select('encupreg_id, encupreg_pregunta, encupreg_orden, encupreg_nota').eq('encu_id', parseInt(selectedSurvey)).order('encupreg_orden');
      if (error) throw error;
      return data || [];
    },
    enabled: selectedSurvey !== 'placeholder'
  });

  // Fetch representatives who have responded to this survey
  const {
    data: representatives = []
  } = useQuery({
    queryKey: ['survey-representatives', selectedSurvey],
    queryFn: async (): Promise<Representative[]> => {
      if (selectedSurvey === 'placeholder') return [];
      const {
        data,
        error
      } = await supabase.from('encuesta_respondida').select(`
          padre_id,
          padre!inner(
            usu_id,
            usuario!inner(usu_nombre)
          )
        `).eq('encu_id', parseInt(selectedSurvey));
      if (error) throw error;
      return data?.map(item => ({
        padre_id: item.padre_id,
        usu_nombre: item.padre.usuario.usu_nombre
      })) || [];
    },
    enabled: selectedSurvey !== 'placeholder'
  });

  // Filter representatives by search with case-insensitive matching
  const filteredRepresentatives = useMemo(() => {
    if (!searchFilter.trim()) return representatives;
    return representatives.filter(rep => rep.usu_nombre.toLowerCase().includes(searchFilter.toLowerCase().trim()));
  }, [representatives, searchFilter]);

  // Fetch responses for all representatives for the selected question
  const {
    data: questionResponses = []
  } = useQuery({
    queryKey: ['question-responses', selectedSurvey, selectedQuestion],
    queryFn: async (): Promise<ResponseData[]> => {
      if (selectedSurvey === 'placeholder' || selectedQuestion === 'placeholder') return [];
      const {
        data,
        error
      } = await supabase.from('encuesta_respuesta').select(`
          encurespu_texto,
          encurespu_num,
          encurespu_fecha,
          encurespu_hora,
          encurespu_sino,
          encuesta_respondida!inner(
            padre_id,
            padre!inner(
              usuario!inner(usu_nombre)
            )
          )
        `).eq('encupreg_id', parseInt(selectedQuestion));
      if (error) throw error;
      return data?.map(item => {
        const response = formatResponse(item);
        return {
          padre_id: item.encuesta_respondida.padre_id,
          usu_nombre: item.encuesta_respondida.padre.usuario.usu_nombre,
          response
        };
      }).filter(item => item.response !== 'Sin respuesta') || [];
    },
    enabled: selectedSurvey !== 'placeholder' && selectedQuestion !== 'placeholder'
  });

  // Fetch all responses for a specific representative
  const {
    data: representativeResponses = []
  } = useQuery({
    queryKey: ['representative-responses', selectedSurvey, selectedRepresentative],
    queryFn: async (): Promise<RepresentativeResponse[]> => {
      if (selectedSurvey === 'placeholder' || selectedRepresentative === 'all') return [];
      const surveyId = parseInt(selectedSurvey);
      const repId = parseInt(selectedRepresentative);

      // 1) Obtener el encurespo_id del representante para esta encuesta
      const {
        data: encRespondida,
        error: encRespondidaError
      } = await supabase.from('encuesta_respondida').select('encurespo_id').eq('encu_id', surveyId).eq('padre_id', repId).maybeSingle();
      if (encRespondidaError) throw encRespondidaError;

      // 2) Obtener todas las preguntas del survey (para mostrar "Sin respuesta" cuando aplique)
      const {
        data: allQuestions,
        error: questionsError
      } = await supabase.from('encuesta_pregunta').select('encupreg_id, encupreg_pregunta, encupreg_orden, encupreg_nota').eq('encu_id', surveyId).order('encupreg_orden');
      if (questionsError) throw questionsError;

      // Si no hay submission del representante, devolvemos todas las preguntas con "Sin respuesta"
      if (!encRespondida) {
        return (allQuestions || []).map(q => ({
          encupreg_pregunta: q.encupreg_pregunta,
          encupreg_nota: q.encupreg_nota,
          response: 'Sin respuesta',
          encupreg_orden: q.encupreg_orden
        }));
      }

      // 3) Obtener todas las respuestas de ese encurespo_id
      const {
        data: respuestas,
        error: respuestasError
      } = await supabase.from('encuesta_respuesta').select('encupreg_id, encurespu_texto, encurespu_num, encurespu_fecha, encurespu_hora, encurespu_sino').eq('encurespo_id', encRespondida.encurespo_id);
      if (respuestasError) throw respuestasError;

      // 4) Mapear por encupreg_id para encontrar la respuesta correcta por pregunta
      const respPorPregunta = new Map<number, string>();
      (respuestas || []).forEach(r => {
        const formatted = formatResponse(r);
        // Solo asignamos si hay alguna respuesta (evitamos "Sin respuesta" para dejar fallback uniforme)
        if (formatted !== 'Sin respuesta') {
          respPorPregunta.set(r.encupreg_id as number, formatted);
        }
      });

      // 5) Devolver todas las preguntas con su respuesta (o "Sin respuesta")
      return (allQuestions || []).map(q => ({
        encupreg_pregunta: q.encupreg_pregunta,
        encupreg_nota: q.encupreg_nota,
        response: respPorPregunta.get(q.encupreg_id as number) || 'Sin respuesta',
        encupreg_orden: q.encupreg_orden
      }));
    },
    enabled: selectedSurvey !== 'placeholder' && selectedRepresentative !== 'all'
  });

  // Pagination for question responses (5 items per page)
  const {
    currentPage,
    totalPages,
    paginatedData: paginatedResponses,
    goToPage,
    canGoNext,
    canGoPrevious,
    startIndex,
    endIndex,
    totalItems
  } = usePagination({
    data: questionResponses,
    itemsPerPage: 5
  });

  // Reset selections when survey changes
  React.useEffect(() => {
    setSelectedQuestion('placeholder');
    setSelectedRepresentative('all');
    setSearchFilter('');
  }, [selectedSurvey]);

  // Auto-select first question when questions load
  React.useEffect(() => {
    if (questions.length > 0 && selectedQuestion === 'placeholder') {
      setSelectedQuestion(questions[0].encupreg_id.toString());
    }
  }, [questions, selectedQuestion]);
  if (selectedSurvey === 'placeholder') {
    return <Card>
        <CardHeader>
          <CardTitle>Respuestas de Encuesta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Selecciona una encuesta para ver las respuestas
          </div>
        </CardContent>
      </Card>;
  }
  const selectedQuestionData = questions.find(q => q.encupreg_id.toString() === selectedQuestion);
  const selectedRepresentativeData = representatives.find(r => r.padre_id.toString() === selectedRepresentative);
  return <Card>
      <CardHeader>
        <CardTitle className="mb-5">Respuestas de la encuesta '{surveyName}'</CardTitle>
        <div className="flex flex-wrap gap-6">
          {/* Questions Dropdown with Label */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Preguntas:</Label>
            <Select value={selectedQuestion} onValueChange={setSelectedQuestion}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Seleccionar pregunta" />
              </SelectTrigger>
              <SelectContent>
                {questions.map(question => <SelectItem key={question.encupreg_id} value={question.encupreg_id.toString()}>
                    {question.encupreg_pregunta}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Representatives Dropdown with Label and Inline Search */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Representantes:</Label>
            <Popover open={representativeDropdownOpen} onOpenChange={setRepresentativeDropdownOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={representativeDropdownOpen} className="w-[300px] justify-between">
                  {selectedRepresentative === 'all' ? 'Todos los representantes' : selectedRepresentativeData?.usu_nombre || 'Seleccionar representante'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Buscar representante..." value={searchFilter} onValueChange={setSearchFilter} />
                  <CommandList>
                    <CommandEmpty>No se encontraron representantes.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="all" onSelect={() => {
                      setSelectedRepresentative('all');
                      setRepresentativeDropdownOpen(false);
                    }}>
                        <Check className={cn("mr-2 h-4 w-4", selectedRepresentative === 'all' ? "opacity-100" : "opacity-0")} />
                        Todos los representantes
                      </CommandItem>
                      {filteredRepresentatives.map(rep => <CommandItem key={rep.padre_id} value={rep.padre_id.toString()} onSelect={() => {
                      setSelectedRepresentative(rep.padre_id.toString());
                      setRepresentativeDropdownOpen(false);
                    }}>
                          <Check className={cn("mr-2 h-4 w-4", selectedRepresentative === rep.padre_id.toString() ? "opacity-100" : "opacity-0")} />
                          {rep.usu_nombre}
                        </CommandItem>)}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {selectedRepresentative === 'all' ?
      // Default View - All Representatives for Selected Question
      <div className="space-y-4">
            {selectedQuestionData && <div className="mb-4">
                <h3 className="text-lg font-medium">
                  Pregunta: {selectedQuestionData.encupreg_pregunta}
                </h3>
                {selectedQuestionData.encupreg_nota && <p className="text-sm text-muted-foreground mt-1">
                    Nota: {selectedQuestionData.encupreg_nota}
                  </p>}
              </div>}
            
            {selectedQuestion === 'placeholder' ? <div className="text-center text-muted-foreground py-8">
                Selecciona una pregunta para ver las respuestas
              </div> : questionResponses.length === 0 ? <div className="text-center text-muted-foreground py-8">
                No hay respuestas para esta pregunta
              </div> : <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre Representante</TableHead>
                      <TableHead>Respuesta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedResponses.map((response, index) => <TableRow key={`${response.padre_id}-${index}`}>
                        <TableCell>{response.usu_nombre}</TableCell>
                        <TableCell>{response.response}</TableCell>
                      </TableRow>)}
                  </TableBody>
                </Table>
                
                {totalItems > 5 && <DataPagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} canGoNext={canGoNext} canGoPrevious={canGoPrevious} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} itemName="respuestas" />}
              </>}
          </div> :
      // Representative View - All Questions for Selected Representative
      <div className="space-y-4">
            {selectedRepresentativeData && <div className="mb-4">
                <h3 className="font-medium text-3xl mt-2.5 ">
                  Respuestas de {selectedRepresentativeData.usu_nombre}
                </h3>
              </div>}
            
            {representativeResponses.length === 0 ? <div className="text-center text-muted-foreground py-8">
                No hay respuestas disponibles para este representante
              </div> : <div className="space-y-4">
                {representativeResponses.map((response, index) => <div key={index} className="border-b pb-4">
                    <div className="font-medium text-sm text-muted-foreground mb-1">
                      Pregunta {response.encupreg_orden}:
                    </div>
                    <div className="mb-2">{response.encupreg_pregunta}</div>
                    {response.encupreg_nota && <div className="text-sm text-muted-foreground mb-2">
                        Nota: {response.encupreg_nota}
                      </div>}
                    <div className="font-medium">
                      Respuesta: <span className="font-normal">{response.response}</span>
                    </div>
                  </div>)}
              </div>}
          </div>}
      </CardContent>
    </Card>;
};
export default SurveyResponsesSection;