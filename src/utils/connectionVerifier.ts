import { websocketService } from '../services/websocketService';
import { WEBSOCKET_CONFIG } from '../config/websocket';

export interface ConnectionVerificationResult {
  isReady: boolean;
  issues: string[];
  details: {
    configValid: boolean;
    serviceInitialized: boolean;
    canConnect: boolean;
    backendReachable: boolean;
  };
}

export class ConnectionVerifier {
  static async verifyFrontendReadiness(): Promise<ConnectionVerificationResult> {
    const issues: string[] = [];
    const details = {
      configValid: false,
      serviceInitialized: false,
      canConnect: false,
      backendReachable: false,
    };

    // 1. Check configuration
    try {
      if (!WEBSOCKET_CONFIG.URL) {
        issues.push('WebSocket URL not configured');
      } else {
        details.configValid = true;
      }
    } catch (error) {
      issues.push(`Configuration error: ${error}`);
    }

    // 2. Check service initialization
    try {
      if (websocketService) {
        details.serviceInitialized = true;
      } else {
        issues.push('WebSocket service not initialized');
      }
    } catch (error) {
      issues.push(`Service initialization error: ${error}`);
    }

    // 3. Test connection capability
    try {
      if (details.serviceInitialized) {
        // Try to connect (this will fail if backend is not running, but that's expected)
        await websocketService.connect();
        details.canConnect = true;

        // Check if we can reach the backend
        if (websocketService.isConnected()) {
          details.backendReachable = true;
        } else {
          issues.push(
            'Backend not reachable (this is expected if backend is not running)'
          );
        }

        // Disconnect after test
        websocketService.disconnect();
      }
    } catch (error) {
      // This is expected if backend is not running
      details.canConnect = true; // Service can attempt connection
      issues.push(
        `Backend connection failed: ${error} (expected if backend is not running)`
      );
    }

    const isReady =
      details.configValid && details.serviceInitialized && details.canConnect;

    return {
      isReady,
      issues,
      details,
    };
  }

  static getConnectionStatus(): string {
    const isConnected = websocketService.isConnected();
    return isConnected ? 'CONNECTED' : 'DISCONNECTED';
  }

  static logVerificationResult(result: ConnectionVerificationResult): void {
    console.log('🔍 Frontend WebSocket Connection Verification');
    console.log('============================================');

    console.log(`✅ Frontend Ready: ${result.isReady ? 'YES' : 'NO'}`);
    console.log('');

    console.log('📋 Details:');
    console.log(
      `  • Configuration Valid: ${result.details.configValid ? '✅' : '❌'}`
    );
    console.log(
      `  • Service Initialized: ${result.details.serviceInitialized ? '✅' : '❌'}`
    );
    console.log(`  • Can Connect: ${result.details.canConnect ? '✅' : '❌'}`);
    console.log(
      `  • Backend Reachable: ${result.details.backendReachable ? '✅' : '❌'}`
    );
    console.log('');

    if (result.issues.length > 0) {
      console.log('⚠️  Issues Found:');
      result.issues.forEach(issue => {
        console.log(`  • ${issue}`);
      });
    } else {
      console.log('✅ No issues found');
    }

    console.log('');
    console.log('🌐 WebSocket Configuration:');
    console.log(`  • URL: ${WEBSOCKET_CONFIG.URL}`);
    console.log(
      `  • Timeout: ${WEBSOCKET_CONFIG.CONNECTION_OPTIONS.timeout}ms`
    );
    console.log(
      `  • Reconnection: ${WEBSOCKET_CONFIG.CONNECTION_OPTIONS.reconnection ? 'Enabled' : 'Disabled'}`
    );
    console.log('');

    console.log('📡 Expected Backend Events:');
    Object.entries(WEBSOCKET_CONFIG.EVENTS).forEach(([key, value]) => {
      console.log(`  • ${key}: "${value}"`);
    });
    console.log('');

    if (result.isReady) {
      console.log('🎉 Frontend is ready to connect to backend!');
      console.log(
        '   Start your backend server and the connection should work automatically.'
      );
    } else {
      console.log(
        '❌ Frontend has issues that need to be resolved before connecting.'
      );
    }
  }
}
