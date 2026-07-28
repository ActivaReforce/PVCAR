
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EvaluationCard {
  eva_id: number;
  eva_titulo: string;
  eva_categoria: string | null;
}

interface EvaluationCardsGridProps {
  evaluationCards: EvaluationCard[];
  loading: boolean;
  onCardClick: (evaluationId: number) => void;
}

const EvaluationCardsGrid: React.FC<EvaluationCardsGridProps> = ({
  evaluationCards,
  loading,
  onCardClick
}) => {
  const getCardColor = (index: number) => {
    const colors = [
      'bg-blue-100 border-blue-300 hover:bg-blue-200',
      'bg-green-100 border-green-300 hover:bg-green-200',
      'bg-purple-100 border-purple-300 hover:bg-purple-200',
      'bg-orange-100 border-orange-300 hover:bg-orange-200',
      'bg-pink-100 border-pink-300 hover:bg-pink-200',
      'bg-indigo-100 border-indigo-300 hover:bg-indigo-200'
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <p>Cargando evaluaciones...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (evaluationCards.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <p>No hay evaluaciones disponibles para esta disciplina</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evaluaciones Disponibles</CardTitle>
        <p className="text-sm text-muted-foreground">
          {evaluationCards.length} evaluación(es) disponible(s)
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {evaluationCards.map((card, index) => (
            <Card
              key={card.eva_id}
              className={`cursor-pointer transition-colors ${getCardColor(index)}`}
              onClick={() => onCardClick(card.eva_id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{card.eva_titulo}</CardTitle>
              </CardHeader>
              <CardContent>
                {card.eva_categoria && (
                  <p className="text-sm text-muted-foreground">
                    Categoría: {card.eva_categoria}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default EvaluationCardsGrid;
