import React, { useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

const ConnectionTest: React.FC = () => {
  const {
    isConnected,
    isAuthenticated,
    error,
    connect,
    authenticate,
    subscribeToSimulation,
  } = useWebSocket();

  // Log connection status changes
  useEffect(() => {
    console.log(
      '🔌 WebSocket Connection Status:',
      isConnected ? 'CONNECTED' : 'DISCONNECTED'
    );
  }, [isConnected]);

  useEffect(() => {
    console.log(
      '🔐 Authentication Status:',
      isAuthenticated ? 'AUTHENTICATED' : 'NOT AUTHENTICATED'
    );
  }, [isAuthenticated]);

  useEffect(() => {
    if (error) {
      console.error('❌ WebSocket Error:', error);
    }
  }, [error]);

  const handleTestConnection = () => {
    console.log('🧪 Testing WebSocket connection...');
    if (isConnected) {
      console.log('✅ WebSocket is connected!');
    } else {
      console.log('❌ WebSocket is not connected. Attempting to connect...');
      connect();
    }
  };

  const handleTestAuth = () => {
    console.log('🧪 Testing authentication...');
    try {
      authenticate({
        token: 'test_jwt_token',
        userId: 123,
      });
      console.log('✅ Authentication request sent!');
    } catch (error) {
      console.error('❌ Authentication failed:', error);
    }
  };

  const handleTestSubscription = () => {
    console.log('🧪 Testing simulation subscription...');
    try {
      subscribeToSimulation({
        simulationId: 456,
      });
      console.log('✅ Subscription request sent!');
    } catch (error) {
      console.error('❌ Subscription failed:', error);
    }
  };

  return (
    <div
      style={{
        padding: '15px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f0f8ff',
        margin: '10px 0',
      }}
    >
      <h3>🔧 Connection Testing Tools</h3>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <button
          onClick={handleTestConnection}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          Test Connection
        </button>

        <button
          onClick={handleTestAuth}
          disabled={!isConnected}
          style={{
            padding: '8px 16px',
            backgroundColor: isConnected ? '#2196F3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          Test Auth
        </button>

        <button
          onClick={handleTestSubscription}
          disabled={!isAuthenticated}
          style={{
            padding: '8px 16px',
            backgroundColor: isAuthenticated ? '#FF9800' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          Test Subscription
        </button>
      </div>

      <div style={{ fontSize: '12px', color: '#666' }}>
        <strong>Instructions:</strong>
        <ol style={{ margin: '5px 0', paddingLeft: '20px' }}>
          <li>Open browser console (F12 → Console tab)</li>
          <li>Click "Test Connection" to verify WebSocket connection</li>
          <li>
            Click "Test Auth" to test authentication (requires connection)
          </li>
          <li>
            Click "Test Subscription" to test simulation subscription (requires
            auth)
          </li>
          <li>Watch console for detailed logs and status updates</li>
        </ol>
      </div>

      <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
        <strong>Expected Console Output:</strong>
        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
          <li>🔌 WebSocket Connection Status: CONNECTED</li>
          <li>🔐 Authentication Status: AUTHENTICATED</li>
          <li>✅ WebSocket is connected!</li>
          <li>✅ Authentication request sent!</li>
          <li>✅ Subscription request sent!</li>
        </ul>
      </div>
    </div>
  );
};

export default ConnectionTest;
