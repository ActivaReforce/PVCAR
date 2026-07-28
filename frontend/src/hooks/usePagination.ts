
import { useState, useMemo } from 'react';

interface UsePaginationProps<T> {
  data: T[];
  itemsPerPage: number;
}

interface UsePaginationReturn<T> {
  currentPage: number;
  totalPages: number;
  paginatedData: T[];
  goToPage: (page: number) => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  startIndex: number;
  endIndex: number;
  totalItems: number;
}

export function usePagination<T>({
  data,
  itemsPerPage,
}: UsePaginationProps<T>): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, data.length);
  
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return data.slice(start, end);
  }, [data, currentPage, itemsPerPage]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const canGoNext = currentPage < totalPages;
  const canGoPrevious = currentPage > 1;

  return {
    currentPage,
    totalPages,
    paginatedData,
    goToPage,
    canGoNext,
    canGoPrevious,
    startIndex,
    endIndex,
    totalItems: data.length,
  };
}
