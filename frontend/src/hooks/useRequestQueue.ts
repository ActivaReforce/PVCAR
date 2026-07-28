import { useRef, useCallback } from 'react';

interface QueuedRequest<T> {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

/**
 * Hook that provides a request queue to prevent race conditions.
 * Requests are processed sequentially, and duplicate requests for the same ID
 * will wait for the previous request to complete.
 */
export function useRequestQueue<T = any>() {
  const queueRef = useRef<Map<string, Promise<any>>>(new Map());
  const processingRef = useRef<Set<string>>(new Set());

  /**
   * Enqueues a request. If a request with the same ID is already in progress,
   * the new request will wait for it to complete before executing.
   * 
   * @param id - Unique identifier for this request (e.g., 'attendance-123')
   * @param execute - The async function to execute
   * @returns Promise that resolves when the request completes
   */
  const enqueue = useCallback(async (
    id: string,
    execute: () => Promise<T>
  ): Promise<T> => {
    // Wait for any existing request with the same ID to complete
    const existingPromise = queueRef.current.get(id);
    if (existingPromise) {
      try {
        await existingPromise;
      } catch {
        // Ignore errors from previous requests
      }
    }

    // Mark this ID as processing
    processingRef.current.add(id);

    // Create and store the new promise
    const promise = execute().finally(() => {
      processingRef.current.delete(id);
      queueRef.current.delete(id);
    });

    queueRef.current.set(id, promise);

    return promise;
  }, []);

  /**
   * Checks if a request with the given ID is currently being processed.
   */
  const isProcessing = useCallback((id: string): boolean => {
    return processingRef.current.has(id);
  }, []);

  /**
   * Gets the number of requests currently being processed.
   */
  const getPendingCount = useCallback((): number => {
    return processingRef.current.size;
  }, []);

  return {
    enqueue,
    isProcessing,
    getPendingCount,
  };
}
