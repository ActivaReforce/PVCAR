
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type Rol = Database['public']['Tables']['rol']['Row'];

interface UserWithRoles {
  user_roles: Array<{ rol_id: number }>;
}

interface RoleCardProps {
  role: Rol;
  users: UserWithRoles[];
  isSelected: boolean;
  onClick: () => void;
}

const RoleCard = ({ role, users, isSelected, onClick }: RoleCardProps) => {
  const userCount = users.filter(user => 
    user.user_roles?.some(ur => ur.rol_id === role.rol_id)
  ).length;

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary shadow-md' : ''
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            {role.rol_nombre}
          </span>
          <Badge variant={userCount > 0 ? "default" : "secondary"} className="ml-2">
            {userCount}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {role.rol_descripcion || 'Sin descripción disponible'}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {userCount === 0 ? 'Sin usuarios' : `${userCount} usuario${userCount !== 1 ? 's' : ''}`}
        </p>
      </CardContent>
    </Card>
  );
};

export default RoleCard;
