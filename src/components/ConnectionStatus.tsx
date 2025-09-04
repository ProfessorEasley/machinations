import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

const ConnectionStatus: React.FC = () => {
  const {
    isConnected,
    isAuthenticated,
    error,
    currentSimulationId,
    simulationStatus,
    currentStep,
  } = useWebSocket();

  return (
    <div
      style={{
        padding: '15px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
        margin: '10px 0',
      }}
    >
      <h3>Connection Status Details</h3>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}
      >
        <div>
          <strong>WebSocket Connected:</strong>
          <span
            style={{ color: isConnected ? 'green' : 'red', marginLeft: '5px' }}
          >
            {isConnected ? '✅ Yes' : '❌ No'}
          </span>
        </div>

        <div>
          <strong>Authenticated:</strong>
          <span
            style={{
              color: isAuthenticated ? 'green' : 'orange',
              marginLeft: '5px',
            }}
          >
            {isAuthenticated ? '✅ Yes' : '⚠️ No'}
          </span>
        </div>

        <div>
          <strong>Current Simulation ID:</strong>
          <span style={{ marginLeft: '5px' }}>
            {currentSimulationId || 'None'}
          </span>
        </div>

        <div>
          <strong>Simulation Status:</strong>
          <span style={{ marginLeft: '5px' }}>
            {simulationStatus || 'None'}
          </span>
        </div>

        <div>
          <strong>Current Step:</strong>
          <span style={{ marginLeft: '5px' }}>{currentStep}</span>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: '10px',
            padding: '10px',
            backgroundColor: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '4px',
            color: '#d32f2f',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        <strong>Debug Info:</strong>
        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
          <li>Check browser console for WebSocket logs</li>
          <li>Network tab should show WebSocket connection</li>
          <li>Backend should be running on ws://localhost:3000</li>
        </ul>
      </div>
    </div>
  );
};

export default ConnectionStatus;
