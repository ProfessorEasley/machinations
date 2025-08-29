import { io, Socket } from 'socket.io-client';
import type {
  SimulationUpdate,
  StatusChange,
  AuthenticationData,
  SubscriptionData,
} from '../types/websocket';
import { WEBSOCKET_CONFIG } from '../config/websocket';

class WebSocketService {
  private socket: Socket | null = null;
  private url: string;
  private onSimulationUpdate?: (data: SimulationUpdate) => void;
  private onStatusChange?: (data: StatusChange) => void;
  private onConnect?: () => void;
  private onDisconnect?: () => void;
  private onError?: (error: string) => void;

  constructor(url: string = WEBSOCKET_CONFIG.URL) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.url, WEBSOCKET_CONFIG.CONNECTION_OPTIONS);

        this.socket.on('connect', () => {
          console.log('WebSocket connected');
          this.onConnect?.();
          resolve();
        });

        this.socket.on('disconnect', reason => {
          console.log('WebSocket disconnected:', reason);
          this.onDisconnect?.();
        });

        this.socket.on('connect_error', error => {
          console.error('WebSocket connection error:', error);
          this.onError?.(error.message);
          reject(error);
        });

        this.socket.on(
          WEBSOCKET_CONFIG.EVENTS.SIMULATION_UPDATE,
          (data: SimulationUpdate) => {
            console.log(`Step ${data.step}:`, data.nodeStates);
            this.onSimulationUpdate?.(data);
          }
        );

        this.socket.on(
          WEBSOCKET_CONFIG.EVENTS.STATUS_CHANGE,
          (data: StatusChange) => {
            console.log(
              `Simulation ${data.simulationId} is now ${data.status}`
            );
            this.onStatusChange?.(data);
          }
        );

        this.socket.on('error', error => {
          console.error('WebSocket error:', error);
          this.onError?.(error.message || 'WebSocket error occurred');
        });
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  authenticate(data: AuthenticationData): void {
    if (!this.socket) {
      throw new Error('WebSocket not connected');
    }
    this.socket.emit(WEBSOCKET_CONFIG.EVENTS.AUTHENTICATE, data);
  }

  subscribeToSimulation(data: SubscriptionData): void {
    if (!this.socket) {
      throw new Error('WebSocket not connected');
    }
    this.socket.emit(WEBSOCKET_CONFIG.EVENTS.SUBSCRIBE_SIMULATION, data);
  }

  unsubscribeFromSimulation(): void {
    if (!this.socket) {
      throw new Error('WebSocket not connected');
    }
    this.socket.emit(WEBSOCKET_CONFIG.EVENTS.UNSUBSCRIBE_SIMULATION);
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Event handlers
  on(
    event: 'simulation_update',
    callback: (data: SimulationUpdate) => void
  ): void;
  on(event: 'status_change', callback: (data: StatusChange) => void): void;
  on(event: 'connect', callback: () => void): void;
  on(event: 'disconnect', callback: () => void): void;
  on(event: 'error', callback: (error: string) => void): void;
  on(event: string, callback: unknown): void {
    switch (event) {
      case 'simulation_update':
        this.onSimulationUpdate = callback as (data: SimulationUpdate) => void;
        break;
      case 'status_change':
        this.onStatusChange = callback as (data: StatusChange) => void;
        break;
      case 'connect':
        this.onConnect = callback as () => void;
        break;
      case 'disconnect':
        this.onDisconnect = callback as () => void;
        break;
      case 'error':
        this.onError = callback as (error: string) => void;
        break;
    }
  }
}

// Create a singleton instance
export const websocketService = new WebSocketService();
export default websocketService;
