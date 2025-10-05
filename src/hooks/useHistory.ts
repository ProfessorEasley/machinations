import { useState, useCallback, useRef } from 'react';

interface UseHistoryReturn<T> {
  state: T;
  setState: (newState: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

export function useHistory<T>(initialState: T): UseHistoryReturn<T> {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isApplyingHistoryRef = useRef(false);

  const state = history[currentIndex];
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const setState = useCallback((newState: T) => {
    if (isApplyingHistoryRef.current) {
      return;
    }

    setHistory(prev => {
      const truncated = prev.slice(0, currentIndex + 1);
      const updated = [...truncated, newState];
      return updated.length > 50 ? updated.slice(-50) : updated;
    });

    setCurrentIndex(prev => {
      const newLength = history.slice(0, prev + 1).length + 1;
      return newLength > 50 ? 49 : prev + 1;
    });
  }, [currentIndex, history]);

  const undo = useCallback(() => {
    if (canUndo) {
      isApplyingHistoryRef.current = true;
      setCurrentIndex(prev => prev - 1);
      setTimeout(() => {
        isApplyingHistoryRef.current = false;
      }, 50);
    }
  }, [canUndo]);

  const redo = useCallback(() => {
    if (canRedo) {
      isApplyingHistoryRef.current = true;
      setCurrentIndex(prev => prev + 1);
      setTimeout(() => {
        isApplyingHistoryRef.current = false;
      }, 50);
    }
  }, [canRedo]);

  const clearHistory = useCallback(() => {
    setHistory([state]);
    setCurrentIndex(0);
  }, [state]);

  return {
    state,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  };
}