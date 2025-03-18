import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { processAuthCallback } from './api/auth';

const AuthCallback = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const token = processAuthCallback();
    if (token) {
      // Success, redirect to home/dashboard
      navigate('/dashboard', { replace: true });
    } else {
      // No token found, redirect to login
      navigate('/login', { replace: true });
    }
  }, [navigate]);
  
  return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Authenticating...</p>
    </div>
  );
};

export default AuthCallback;