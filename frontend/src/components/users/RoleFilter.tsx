
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type Rol = Database['public']['Tables']['rol']['Row'];

interface RoleFilterProps {
  roles: Rol[];
  selectedRoles: number[];
  onRoleChange: (selectedRoleIds: number[]) => void;
}

const RoleFilter = ({ roles, selectedRoles, onRoleChange }: RoleFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleRoleToggle = (roleId: number) => {
    if (selectedRoles.includes(roleId)) {
      onRoleChange(selectedRoles.filter(id => id !== roleId));
    } else {
      onRoleChange([...selectedRoles, roleId]);
    }
  };

  const handleClearAll = () => {
    onRoleChange([]);
    setIsOpen(false);
  };

  const selectedRoleNames = roles
    .filter(role => selectedRoles.includes(role.rol_id))
    .map(role => role.rol_nombre);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="h-auto p-0 font-medium hover:bg-transparent justify-start"
      >
        Rol
        <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-popover border border-border rounded-md shadow-lg z-50">
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Filtrar por rol</span>
              {selectedRoles.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-xs h-auto p-1 hover:bg-muted"
                >
                  Limpiar
                </Button>
              )}
            </div>
            
            {selectedRoles.length > 0 && (
              <div className="mb-3 text-xs text-muted-foreground">
                Seleccionados: {selectedRoleNames.join(', ')}
              </div>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {roles.map((role) => (
                <div key={role.rol_id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`role-${role.rol_id}`}
                    checked={selectedRoles.includes(role.rol_id)}
                    onCheckedChange={() => handleRoleToggle(role.rol_id)}
                  />
                  <label 
                    htmlFor={`role-${role.rol_id}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {role.rol_nombre}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleFilter;
