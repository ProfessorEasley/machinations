interface ApiFetchOptions {
  method?: string;
  body?: any;
  token?: string | null;
}

export async function apiFetch<T>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { method = 'GET', body, token } = options;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config: RequestInit = {
    method,
    headers,
  };
  
  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }
  
  // For now, return a mock response structure
  // This should be replaced with actual API endpoint
  const baseUrl = process.env.VITE_API_BASE_URL || 'http://localhost:3001';
  const response = await fetch(`${baseUrl}${endpoint}`, config);
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  
  return response.json();
}
