
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface ListItem {
  label: string;
  value?: string | number;
}

interface CoordinatorListCardProps {
  title: string;
  icon: LucideIcon;
  items: ListItem[];
  color?: string;
  emptyText?: string;
}

export const CoordinatorListCard: React.FC<CoordinatorListCardProps> = ({
  title,
  icon: Icon,
  items,
  color = "text-blue-500",
  emptyText = "Sin datos"
}) => {
  return (
    <Card className="hover:shadow-lg transition-all duration-200 dark:bg-card dark:border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-card-foreground">{title}</CardTitle>
        <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${color}`} />
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-center justify-between text-sm">
                <span className="text-card-foreground">{item.label}</span>
                {typeof item.value !== 'undefined' && (
                  <span className={`font-semibold ${color}`}>{item.value}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
