
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface AnswerWithRepresentative {
  encurespu_id: number;
  encurespu_texto: string;
  representante: string;
}

interface QuestionAnswerCarouselProps {
  questionId: number;
}

export const QuestionAnswerCarousel: React.FC<QuestionAnswerCarouselProps> = ({ questionId }) => {
  const { data: answers = [], isLoading } = useQuery({
    queryKey: ['question-answers', questionId],
    queryFn: async (): Promise<AnswerWithRepresentative[]> => {
      const { data, error } = await supabase
        .from('encuesta_respuesta')
        .select(`
          encurespu_id,
          encurespu_texto,
          encuesta_respondida!inner(
            padre!inner(
              usuario!inner(
                usu_nombre
              )
            )
          )
        `)
        .eq('encupreg_id', questionId);

      if (error) throw error;

      return data.map((item: any) => ({
        encurespu_id: item.encurespu_id,
        encurespu_texto: item.encurespu_texto,
        representante: item.encuesta_respondida?.padre?.usuario?.usu_nombre || '—'
      }));
    }
  });

  if (isLoading) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Cargando respuestas...
      </div>
    );
  }

  if (answers.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No hay respuestas disponibles para esta pregunta
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Carousel 
        className="w-full"
        opts={{
          loop: true,
          align: "start"
        }}
      >
        <CarouselContent>
          {answers.map((answer) => (
            <CarouselItem key={answer.encurespu_id}>
              <div className="p-1">
                <Card>
                  <CardContent className="flex flex-col aspect-square items-center justify-center p-6 text-center space-y-4">
                    <div className="space-y-2">
                      <p className="text-lg font-medium">
                        "{answer.encurespu_texto}"
                      </p>
                      <p className="text-sm text-muted-foreground">
                        — Representante: {answer.representante}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
      
      <div className="flex justify-center mt-4 space-x-2">
        {answers.map((_, index) => (
          <div
            key={index}
            className="w-2 h-2 rounded-full bg-gray-300"
          />
        ))}
      </div>
    </div>
  );
};
