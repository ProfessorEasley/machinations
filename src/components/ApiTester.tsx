import React, { useState } from 'react';

const ApiTester: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleTest = async () => {
    setLoading(true);
    setResult('');
    setError('');

    try {
      const base =
        import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3000';
      const res = await fetch(`${base}/health`, { credentials: 'include' });
      const data = await res.json();
      setResult(JSON.stringify(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: 12, marginBottom: 12 }}>
      <h3>API Tester (/health)</h3>
      <button onClick={handleTest} disabled={loading}>
        {loading ? 'Calling...' : 'Call /health'}
      </button>
      {result && (
        <pre style={{ background: '#f7f7f7', padding: 8, marginTop: 8 }}>
          {result}
        </pre>
      )}
      {error && (
        <div style={{ color: '#d32f2f', marginTop: 8 }}>Error: {error}</div>
      )}
    </div>
  );
};

export default ApiTester;
