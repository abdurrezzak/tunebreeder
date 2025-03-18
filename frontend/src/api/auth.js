const API_URL = 'http://localhost:8000/api';

export const loginUser = async (email, password) => {
  const formData = new FormData();
  formData.append('username', email); // FastAPI OAuth expects 'username'
  formData.append('password', password);
  
  const response = await fetch(`${API_URL}/token`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Login failed');
  }
  
  return response.json();
};

export const registerUser = async (email, username, password) => {
  const response = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, username, password }),
  });
  
  if (!response.ok) {
    throw new Error('Registration failed');
  }
  
  return response.json();
};

// Add this helper function to handle Google auth callback
export const processAuthCallback = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  
  if (token) {
    localStorage.setItem('token', token);
    return token;
  }
  
  return null;
};