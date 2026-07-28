
import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

interface UseSortingProps<T> {
  data: T[];
  defaultSortKey?: keyof T | string;
  defaultSortDirection?: SortDirection;
}

interface UseSortingReturn<T> {
  sortedData: T[];
  sortKey: keyof T | string | null;
  sortDirection: SortDirection;
  handleSort: (key: keyof T | string) => void;
}

export function useSorting<T>({
  data,
  defaultSortKey = null,
  defaultSortDirection = null,
}: UseSortingProps<T>): UseSortingReturn<T> {
  const [sortKey, setSortKey] = useState<keyof T | string | null>(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) {
      return data;
    }

    return [...data].sort((a, b) => {
      let aValue, bValue;

      // Special handling for roles sorting
      if (sortKey === 'roles') {
        // Get the first role name for sorting (assumes data has user_roles structure)
        const aRoles = (a as any).user_roles || [];
        const bRoles = (b as any).user_roles || [];
        
        // If only one unique role exists across all data, don't change order
        const allRoles = data.flatMap((item: any) => 
          (item.user_roles || []).map((ur: any) => ur.rol_id)
        );
        const uniqueRoles = [...new Set(allRoles)];
        
        if (uniqueRoles.length <= 1) {
          return 0; // Keep original order
        }
        
        // Sort by first role ID (which correlates to role names)
        aValue = aRoles.length > 0 ? aRoles[0].rol_id : 999;
        bValue = bRoles.length > 0 ? bRoles[0].rol_id : 999;
        
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle nested properties (e.g., "colegio.col_nombre")
      if (typeof sortKey === 'string' && sortKey.includes('.')) {
        aValue = getNestedValue(a, sortKey);
        bValue = getNestedValue(b, sortKey);
      } else {
        aValue = a[sortKey as keyof T];
        bValue = b[sortKey as keyof T];
      }

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? -1 : 1;
      if (bValue == null) return sortDirection === 'asc' ? 1 : -1;

      // Handle different data types
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      if (aValue instanceof Date && bValue instanceof Date) {
        return sortDirection === 'asc' 
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }

      // Convert to string for comparison as fallback
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      const comparison = aStr.localeCompare(bStr);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDirection]);

  const handleSort = (key: keyof T | string) => {
    if (sortKey === key) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortKey(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return {
    sortedData,
    sortKey,
    sortDirection,
    handleSort,
  };
}
