import React, { useEffect, useState } from 'react';
import {
  ConnectionVerifier,
  type ConnectionVerificationResult,
} from '../utils/connectionVerifier';

const ConnectionVerifierComponent: React.FC = () => {
  const [verificationResult, setVerificationResult] =
    useState<ConnectionVerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const runVerification = async () => {
      setIsLoading(true);
      try {
        const result = await ConnectionVerifier.verifyFrontendReadiness();
        setVerificationResult(result);

        // Also log to console for debugging
        ConnectionVerifier.logVerificationResult(result);
      } catch (error) {
        console.error('Verification failed:', error);
        setVerificationResult({
          isReady: false,
          issues: [`Verification error: ${error}`],
          details: {
            configValid: false,
            serviceInitialized: false,
            canConnect: false,
            backendReachable: false,
          },
        });
      } finally {
        setIsLoading(false);
      }
    };

    runVerification();
  }, []);

  if (isLoading) {
    return (
      <div
        style={{
          padding: '15px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#fff3cd',
          margin: '10px 0',
        }}
      >
        <h3>🔍 Verifying Frontend Readiness...</h3>
        <p>Checking WebSocket configuration and service initialization...</p>
      </div>
    );
  }

  if (!verificationResult) {
    return (
      <div
        style={{
          padding: '15px',
          border: '1px solid #f44336',
          borderRadius: '8px',
          backgroundColor: '#ffebee',
          margin: '10px 0',
        }}
      >
        <h3>❌ Verification Failed</h3>
        <p>Unable to verify frontend readiness.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '15px',
        border: `1px solid ${verificationResult.isReady ? '#4caf50' : '#f44336'}`,
        borderRadius: '8px',
        backgroundColor: verificationResult.isReady ? '#e8f5e8' : '#ffebee',
        margin: '10px 0',
      }}
    >
      <h3>
        {verificationResult.isReady
          ? '✅ Frontend Ready'
          : '❌ Frontend Issues Found'}
      </h3>

      <div style={{ marginBottom: '15px' }}>
        <strong>Status:</strong>{' '}
        {verificationResult.isReady ? 'Ready to connect' : 'Needs attention'}
      </div>

      <div style={{ marginBottom: '15px' }}>
        <strong>Details:</strong>
        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
          <li>
            Configuration Valid:{' '}
            {verificationResult.details.configValid ? '✅' : '❌'}
          </li>
          <li>
            Service Initialized:{' '}
            {verificationResult.details.serviceInitialized ? '✅' : '❌'}
          </li>
          <li>
            Can Connect: {verificationResult.details.canConnect ? '✅' : '❌'}
          </li>
          <li>
            Backend Reachable:{' '}
            {verificationResult.details.backendReachable ? '✅' : '❌'}
          </li>
        </ul>
      </div>

      {verificationResult.issues.length > 0 && (
        <div style={{ marginBottom: '15px' }}>
          <strong>Issues:</strong>
          <ul
            style={{ margin: '5px 0', paddingLeft: '20px', color: '#d32f2f' }}
          >
            {verificationResult.issues.map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ fontSize: '12px', color: '#666' }}>
        <strong>Next Steps:</strong>
        {verificationResult.isReady ? (
          <p>
            ✅ Frontend is ready! Start your backend server and the connection
            should work automatically.
          </p>
        ) : (
          <p>
            ❌ Please resolve the issues above before attempting to connect to
            the backend.
          </p>
        )}
      </div>
    </div>
  );
};

export default ConnectionVerifierComponent;
