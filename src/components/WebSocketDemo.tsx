import React, { useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

const WebSocketDemo: React.FC = () => {
  const {
    isConnected,
    isAuthenticated,
    currentSimulationId,
    error,
    currentStep,
    nodeStates,
    simulationStatus,
    lastUpdate,
    authenticate,
    subscribeToSimulation,
    unsubscribeFromSimulation,
    clearError,
    isReady,
    hasActiveSimulation,
  } = useWebSocket();

  const [token, setToken] = useState('jwt_token');
  const [userId, setUserId] = useState('123');
  const [simulationId, setSimulationId] = useState('456');

  const handleAuthenticate = () => {
    try {
      authenticate({
        token,
        userId: parseInt(userId),
      });
    } catch (error) {
      console.error('Authentication error:', error);
    }
  };

  const handleSubscribe = () => {
    try {
      subscribeToSimulation({
        simulationId: parseInt(simulationId),
      });
    } catch (error) {
      console.error('Subscription error:', error);
    }
  };

  const handleUnsubscribe = () => {
    try {
      unsubscribeFromSimulation();
    } catch (error) {
      console.error('Unsubscribe error:', error);
    }
  };

  return (
    <div
      className="websocket-demo"
      style={{ padding: '20px', maxWidth: '800px' }}
    >
      <h2>WebSocket Integration Demo</h2>

      {/* Connection Status */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Connection Status</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#4CAF50' : '#f44336',
            }}
          />
          <span>
            {isConnected ? 'Connected' : 'Disconnected'}
            {isAuthenticated && ' (Authenticated)'}
          </span>
        </div>
        {error && (
          <div style={{ color: '#f44336', marginTop: '10px' }}>
            Error: {error}
            <button onClick={clearError} style={{ marginLeft: '10px' }}>
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Authentication Section */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Authentication</h3>
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <input
            type="text"
            placeholder="JWT Token"
            value={token}
            onChange={e => setToken(e.target.value)}
            style={{ padding: '8px', flex: 1 }}
          />
          <input
            type="number"
            placeholder="User ID"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            style={{ padding: '8px', width: '100px' }}
          />
          <button
            onClick={handleAuthenticate}
            disabled={!isConnected || isAuthenticated}
            style={{ padding: '8px 16px' }}
          >
            Authenticate
          </button>
        </div>
      </div>

      {/* Simulation Subscription */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Simulation Subscription</h3>
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <input
            type="number"
            placeholder="Simulation ID"
            value={simulationId}
            onChange={e => setSimulationId(e.target.value)}
            style={{ padding: '8px', width: '150px' }}
          />
          <button
            onClick={handleSubscribe}
            disabled={!isReady || hasActiveSimulation}
            style={{ padding: '8px 16px' }}
          >
            Subscribe
          </button>
          <button
            onClick={handleUnsubscribe}
            disabled={!hasActiveSimulation}
            style={{ padding: '8px 16px' }}
          >
            Unsubscribe
          </button>
        </div>
      </div>

      {/* Simulation Data */}
      {hasActiveSimulation && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Simulation Data</h3>
          <div
            style={{
              backgroundColor: '#f5f5f5',
              padding: '15px',
              borderRadius: '4px',
            }}
          >
            <div>
              <strong>Current Step:</strong> {currentStep}
            </div>
            <div>
              <strong>Status:</strong> {simulationStatus || 'Unknown'}
            </div>
            <div>
              <strong>Last Update:</strong> {lastUpdate || 'None'}
            </div>
            <div>
              <strong>Active Simulation ID:</strong> {currentSimulationId}
            </div>

            {Object.keys(nodeStates).length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <strong>Node States:</strong>
                <pre
                  style={{
                    backgroundColor: '#fff',
                    padding: '10px',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                  }}
                >
                  {JSON.stringify(nodeStates, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div
        style={{
          backgroundColor: '#e3f2fd',
          padding: '15px',
          borderRadius: '4px',
        }}
      >
        <h3>How to Use</h3>
        <ol>
          <li>Wait for the WebSocket to connect automatically</li>
          <li>Enter your JWT token and user ID, then click "Authenticate"</li>
          <li>
            Enter a simulation ID and click "Subscribe" to receive real-time
            updates
          </li>
          <li>Watch the simulation data update in real-time</li>
          <li>Click "Unsubscribe" to stop receiving updates</li>
        </ol>
      </div>
    </div>
  );
};

export default WebSocketDemo;
