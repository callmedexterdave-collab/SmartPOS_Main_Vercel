const getBaseUrl = () => {
  if (import.meta.env.PROD) {
    // In production, always use the Render backend URL
    return 'https://smartposv4.onrender.com';
  } else {
    // In development, use the current origin which will be proxied by Vite
    return window.location.origin;
  }
};

const getHeaders = () => {
  const token = localStorage.getItem('smartpos_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const api = {
  async get(endpoint: string) {
    try {
      const response = await fetch(`${getBaseUrl()}${endpoint}`, {
        headers: getHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API GET Error (${response.status}): ${errorText || response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error(`API GET failed for ${endpoint}:`, error);
      throw error;
    }
  },

  async post(endpoint: string, body: any) {
    try {
      const response = await fetch(`${getBaseUrl()}${endpoint}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorText = await response.text();
        try {
          // Try to parse the error as JSON
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.message || `API POST Error (${response.status})`);
        } catch (e) {
          // If it's not JSON, throw the raw text or status
          throw new Error(errorText || `API POST Error (${response.status})`);
        }
      }
      return response.json();
    } catch (error) {
      console.error(`API POST failed for ${endpoint}:`, error);
      throw error;
    }
  },

  async put(endpoint: string, body: any) {
    const response = await fetch(`${getBaseUrl()}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || 'An unknown error occurred');
      } catch (e) {
        throw new Error(errorText || 'An unknown error occurred');
      }
    }
    return response.json();
  },

  async delete(endpoint: string) {
    const response = await fetch(`${getBaseUrl()}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || 'An unknown error occurred');
      } catch (e) {
        throw new Error(errorText || 'An unknown error occurred');
      }
    }
    return response.json();
  },
};

export default api;
