# WebSocket Integration Guide

This document explains how to use the WebSocket integration to connect your React frontend to the backend simulation APIs.

## Overview

The WebSocket integration provides real-time communication between your frontend and backend for simulation updates. It includes:

- Automatic connection management
- Authentication with JWT tokens
- Simulation subscription/unsubscription
- Real-time data updates
- Error handling and reconnection

## Files Structure

```
src/
├── config/
│   └── websocket.ts          # Configuration settings
├── hooks/
│   └── useWebSocket.ts       # Custom React hook
├── services/
│   └── websocketService.ts   # WebSocket service class
├── store/
│   └── useAppStore.tsx       # Zustand store with WebSocket state
├── types/
│   └── websocket.ts          # TypeScript type definitions
└── components/
    └── WebSocketDemo.tsx     # Demo component
```

## Quick Start

### 1. Basic Usage

```tsx
import { useWebSocket } from '../hooks/useWebSocket';

function MyComponent() {
  const {
    isConnected,
    isAuthenticated,
    currentStep,
    nodeStates,
    simulationStatus,
    authenticate,
    subscribeToSimulation,
    unsubscribeFromSimulation,
  } = useWebSocket();

  // Authenticate with your backend
  const handleAuth = () => {
    authenticate({
      token: 'your_jwt_token',
      userId: 123,
    });
  };

  // Subscribe to a simulation
  const handleSubscribe = () => {
    subscribeToSimulation({
      simulationId: 456,
    });
  };

  return (
    <div>
      <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
      <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
      <p>Current Step: {currentStep}</p>
      <p>Status: {simulationStatus}</p>

      <button onClick={handleAuth}>Authenticate</button>
      <button onClick={handleSubscribe}>Subscribe to Simulation</button>
    </div>
  );
}
```

### 2. Configuration

The WebSocket URL can be configured via environment variables:

```bash
# .env
VITE_WEBSOCKET_URL=ws://localhost:3000
```

Or modify `src/config/websocket.ts`:

```typescript
export const WEBSOCKET_CONFIG = {
  URL: 'ws://your-backend-url:port',
  // ... other options
};
```

## API Reference

### useWebSocket Hook

Returns an object with the following properties:

#### State Properties

- `isConnected`: boolean - WebSocket connection status
- `isAuthenticated`: boolean - Authentication status
- `currentSimulationId`: number | null - Currently subscribed simulation ID
- `error`: string | null - Last error message
- `currentStep`: number - Current simulation step
- `nodeStates`: Record<string, any> - Current node states
- `simulationStatus`: string | null - Current simulation status
- `lastUpdate`: string | null - Timestamp of last update

#### Action Methods

- `connect()`: Promise<void> - Manually connect to WebSocket
- `disconnect()`: void - Disconnect from WebSocket
- `authenticate(data: AuthenticationData)`: void - Authenticate with backend
- `subscribeToSimulation(data: SubscriptionData)`: void - Subscribe to simulation updates
- `unsubscribeFromSimulation()`: void - Unsubscribe from simulation updates
- `clearError()`: void - Clear error state

#### Computed Properties

- `isReady`: boolean - True if connected and authenticated
- `hasActiveSimulation`: boolean - True if subscribed to a simulation

### Types

```typescript
interface AuthenticationData {
  token: string;
  userId: number;
}

interface SubscriptionData {
  simulationId: number;
}

interface SimulationUpdate {
  step: number;
  nodeStates: Record<string, any>;
  timestamp: string;
}

interface StatusChange {
  simulationId: number;
  status: 'running' | 'paused' | 'stopped' | 'completed' | 'error';
  message?: string;
}
```

## Backend Integration

The frontend expects your backend to handle these WebSocket events:

### Client → Server Events

- `authenticate`: Send JWT token and user ID
- `subscribe_simulation`: Subscribe to simulation updates
- `unsubscribe_simulation`: Unsubscribe from simulation updates

### Server → Client Events

- `simulation_update`: Real-time simulation data
- `status_change`: Simulation status changes

### Example Backend Event Handlers

```javascript
// Backend (Node.js with Socket.IO)
io.on('connection', socket => {
  console.log('Client connected');

  socket.on('authenticate', data => {
    // Verify JWT token
    const { token, userId } = data;
    // ... authentication logic
    console.log(`User ${userId} authenticated`);
  });

  socket.on('subscribe_simulation', data => {
    const { simulationId } = data;
    socket.join(`simulation_${simulationId}`);
    console.log(`Client subscribed to simulation ${simulationId}`);
  });

  socket.on('unsubscribe_simulation', () => {
    // Leave all simulation rooms
    socket.rooms.forEach(room => {
      if (room.startsWith('simulation_')) {
        socket.leave(room);
      }
    });
  });
});

// Send simulation updates
function sendSimulationUpdate(simulationId, step, nodeStates) {
  io.to(`simulation_${simulationId}`).emit('simulation_update', {
    step,
    nodeStates,
    timestamp: new Date().toISOString(),
  });
}

// Send status changes
function sendStatusChange(simulationId, status, message) {
  io.to(`simulation_${simulationId}`).emit('status_change', {
    simulationId,
    status,
    message,
  });
}
```

## Error Handling

The WebSocket service includes automatic error handling:

- Connection errors are captured and stored in the error state
- Automatic reconnection attempts (configurable)
- Error clearing functionality
- Graceful disconnection handling

## Testing

Use the `WebSocketDemo` component to test the integration:

1. Start your backend server
2. Navigate to the home page
3. Use the demo interface to test authentication and subscription
4. Monitor real-time updates in the browser console

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check if your backend is running and the URL is correct
2. **Authentication Failed**: Verify your JWT token is valid
3. **No Updates**: Ensure you're subscribed to the correct simulation ID
4. **CORS Issues**: Configure your backend to allow WebSocket connections from your frontend domain

### Debug Mode

Enable debug logging by checking the browser console for WebSocket events and errors.

## Security Considerations

- Always use HTTPS/WSS in production
- Validate JWT tokens on the backend
- Implement proper authentication and authorization
- Consider rate limiting for WebSocket connections
- Sanitize all data received from the WebSocket
