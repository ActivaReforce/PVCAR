
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, CarouselApi } from '@/components/ui/carousel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { QuestionAnswerCarousel } from './QuestionAnswerCarousel';

interface Question {
  encupreg_id: number;
  encupreg_pregunta: string;
}

interface MultiQuestionCarouselProps {
  questions: Question[];
  surveyId: number;
}

export const MultiQuestionCarousel: React.FC<MultiQuestionCarouselProps> = ({ questions, surveyId }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();

  React.useEffect(() => {
    if (!api) return;

    api.on("select", () => {
      setCurrentQuestionIndex(api.selectedScrollSnap());
    });
  }, [api]);

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">No hay preguntas disponibles</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Question Counter */}
      <div className="flex justify-end">
        <div className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {currentQuestionIndex + 1} / {questions.length}
        </div>
      </div>

      {/* Outer Carousel */}
      <Carousel 
        className="w-full"
        setApi={setApi}
        opts={{
          loop: true,
          align: "start"
        }}
      >
        <CarouselContent>
          {questions.map((question, index) => (
            <CarouselItem key={question.encupreg_id}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Pregunta {index + 1}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base mb-6">{question.encupreg_pregunta}</p>
                  <QuestionAnswerCarousel questionId={question.encupreg_id} />
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
};
