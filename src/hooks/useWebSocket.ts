import { useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { AuthenticationData, SubscriptionData } from '../types/websocket';

export const useWebSocket = () => {
  const {
    // WebSocket state
    isConnected,
    isAuthenticated,
    currentSimulationId,
    error,

    // Simulation state
    currentStep,
    nodeStates,
    simulationStatus,
    lastUpdate,

    // WebSocket actions
    connect,
    disconnect,
    authenticate,
    subscribeToSimulation,
    unsubscribeFromSimulation,
    clearError,
  } = useAppStore();

  // Auto-connect on mount
  useEffect(() => {
    if (!isConnected) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      if (isConnected) {
        disconnect();
      }
    };
  }, [isConnected, connect, disconnect]);

  const handleAuthenticate = useCallback(
    (data: AuthenticationData) => {
      if (!isConnected) {
        throw new Error('WebSocket not connected. Please connect first.');
      }
      authenticate(data);
    },
    [isConnected, authenticate]
  );

  const handleSubscribeToSimulation = useCallback(
    (data: SubscriptionData) => {
      if (!isConnected) {
        throw new Error('WebSocket not connected. Please connect first.');
      }
      if (!isAuthenticated) {
        throw new Error('Not authenticated. Please authenticate first.');
      }
      subscribeToSimulation(data);
    },
    [isConnected, isAuthenticated, subscribeToSimulation]
  );

  const handleUnsubscribeFromSimulation = useCallback(() => {
    if (!isConnected) {
      throw new Error('WebSocket not connected.');
    }
    unsubscribeFromSimulation();
  }, [isConnected, unsubscribeFromSimulation]);

  return {
    // State
    isConnected,
    isAuthenticated,
    currentSimulationId,
    error,
    currentStep,
    nodeStates,
    simulationStatus,
    lastUpdate,

    // Actions
    connect,
    disconnect,
    authenticate: handleAuthenticate,
    subscribeToSimulation: handleSubscribeToSimulation,
    unsubscribeFromSimulation: handleUnsubscribeFromSimulation,
    clearError,

    // Computed
    isReady: isConnected && isAuthenticated,
    hasActiveSimulation: currentSimulationId !== null,
  };
};
