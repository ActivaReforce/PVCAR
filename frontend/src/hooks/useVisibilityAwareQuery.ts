import { useEffect, useState, useCallback } from 'react';

/**
 * Hook that tracks document visibility state.
 * @returns Whether the document is currently visible
 */
export function useDocumentVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(() => 
    typeof document !== 'undefined' ? !document.hidden : true
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

/**
 * Calculates the appropriate refetch interval based on visibility.
 * When tab is hidden, polling is paused (returns false).
 * When tab is visible, returns the specified interval.
 * 
 * @param interval - The desired refetch interval in milliseconds
 * @param isVisible - Whether the document is currently visible
 * @returns The refetch interval or false to disable
 */
export function getVisibilityAwareInterval(
  interval: number,
  isVisible: boolean
): number | false {
  return isVisible ? interval : false;
}

/**
 * Hook that provides a visibility-aware refetch interval for React Query.
 * Pauses polling when the tab is not visible to save resources.
 * 
 * @param baseInterval - The base refetch interval in milliseconds (default: 60000ms = 1 minute)
 * @returns The refetch interval to use (number or false)
 */
export function useVisibilityAwareRefetchInterval(
  baseInterval: number = 60000
): number | false {
  const isVisible = useDocumentVisibility();
  return getVisibilityAwareInterval(baseInterval, isVisible);
}
