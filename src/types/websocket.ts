export interface SimulationUpdate {
  step: number;
  nodeStates: Record<string, unknown>;
  timestamp: string;
}

export interface StatusChange {
  simulationId: number;
  status: 'running' | 'paused' | 'stopped' | 'completed' | 'error';
  message?: string;
}

export interface AuthenticationData {
  token: string;
  userId: number;
}

export interface SubscriptionData {
  simulationId: number;
}

export interface WebSocketState {
  isConnected: boolean;
  isAuthenticated: boolean;
  currentSimulationId: number | null;
  error: string | null;
}

export interface WebSocketActions {
  connect: () => void;
  disconnect: () => void;
  authenticate: (data: AuthenticationData) => void;
  subscribeToSimulation: (data: SubscriptionData) => void;
  unsubscribeFromSimulation: () => void;
  clearError: () => void;
}

export type WebSocketStore = WebSocketState & WebSocketActions;
