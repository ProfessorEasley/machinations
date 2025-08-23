import { create } from 'zustand';
import { websocketService } from '../services/websocketService';
import type {
  WebSocketStore,
  AuthenticationData,
  SubscriptionData,
  SimulationUpdate,
  StatusChange,
} from '../types/websocket';

interface AppState {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

interface SimulationState {
  currentStep: number;
  nodeStates: Record<string, unknown>;
  simulationStatus:
    | 'running'
    | 'paused'
    | 'stopped'
    | 'completed'
    | 'error'
    | null;
  lastUpdate: string | null;
}

interface CombinedState extends AppState, WebSocketStore, SimulationState {}

export const useAppStore = create<CombinedState>(set => ({
  // Original app state
  count: 0,
  increment: () => set(state => ({ count: state.count + 1 })),
  decrement: () => set(state => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),

  // WebSocket state
  isConnected: false,
  isAuthenticated: false,
  currentSimulationId: null,
  error: null,

  // Simulation state
  currentStep: 0,
  nodeStates: {},
  simulationStatus: null,
  lastUpdate: null,

  // WebSocket actions
  connect: async () => {
    try {
      set({ error: null });

      websocketService.on('connect', () => {
        set({ isConnected: true, error: null });
      });

      websocketService.on('disconnect', () => {
        set({
          isConnected: false,
          isAuthenticated: false,
          currentSimulationId: null,
          simulationStatus: null,
        });
      });

      websocketService.on('error', error => {
        set({ error });
      });

      websocketService.on('simulation_update', (data: SimulationUpdate) => {
        set({
          currentStep: data.step,
          nodeStates: data.nodeStates,
          lastUpdate: data.timestamp,
        });
      });

      websocketService.on('status_change', (data: StatusChange) => {
        set({
          simulationStatus: data.status,
        });
      });

      await websocketService.connect();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to connect',
      });
    }
  },

  disconnect: () => {
    websocketService.disconnect();
    set({
      isConnected: false,
      isAuthenticated: false,
      currentSimulationId: null,
      simulationStatus: null,
      currentStep: 0,
      nodeStates: {},
      lastUpdate: null,
    });
  },

  authenticate: (data: AuthenticationData) => {
    try {
      websocketService.authenticate(data);
      set({ isAuthenticated: true, error: null });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Authentication failed',
      });
    }
  },

  subscribeToSimulation: (data: SubscriptionData) => {
    try {
      websocketService.subscribeToSimulation(data);
      set({
        currentSimulationId: data.simulationId,
        error: null,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to subscribe to simulation',
      });
    }
  },

  unsubscribeFromSimulation: () => {
    try {
      websocketService.unsubscribeFromSimulation();
      set({
        currentSimulationId: null,
        simulationStatus: null,
        currentStep: 0,
        nodeStates: {},
        lastUpdate: null,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to unsubscribe from simulation',
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
