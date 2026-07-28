
import React from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';

interface Answer {
  encurespu_id: number;
  encurespu_texto: string;
}

interface SurveyCarouselProps {
  answers: Answer[];
}

export const SurveyCarousel: React.FC<SurveyCarouselProps> = ({ answers }) => {
  if (answers.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No hay respuestas disponibles para esta pregunta
      </div>
    );
  }

  return (
    <div className="w-full max-w-xs mx-auto">
      <Carousel className="w-full">
        <CarouselContent>
          {answers.map((answer) => (
            <CarouselItem key={answer.encurespu_id}>
              <div className="p-1">
                <Card>
                  <CardContent className="flex aspect-square items-center justify-center p-6">
                    <span className="text-lg font-medium text-center">
                      {answer.encurespu_texto}
                    </span>
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
