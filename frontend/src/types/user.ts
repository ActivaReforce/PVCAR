
import { Database } from '@/integrations/supabase/types';

type Usuario = Database['public']['Tables']['usuario']['Row'];
type Rol = Database['public']['Tables']['rol']['Row'];

// Canonical UserWithRoles type - using user_roles to match existing codebase
export interface UserWithRoles extends Usuario {
  user_roles: Array<{ rol_id: number }>;
}

// Alternative interface for components that need full role details
export interface UserWithFullRoles extends Usuario {
  roles: Rol[];
}

// Re-export base types for convenience
export type { Usuario, Rol };
