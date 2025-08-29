export const WEBSOCKET_CONFIG = {
  // WebSocket server URL
  URL: import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3000',

  // Connection options
  CONNECTION_OPTIONS: {
    transports: ['websocket'],
    timeout: 10000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  },

  // Event names (matching your backend)
  EVENTS: {
    AUTHENTICATE: 'authenticate',
    SUBSCRIBE_SIMULATION: 'subscribe_simulation',
    UNSUBSCRIBE_SIMULATION: 'unsubscribe_simulation',
    SIMULATION_UPDATE: 'simulation_update',
    STATUS_CHANGE: 'status_change',
  },
};
