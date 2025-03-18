import React, { useState, useEffect, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ThemeContext } from './context/ThemeContext';
import './ResetPasswordPage.css';

function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState('');
  
  const location = useLocation();
  const navigate = useNavigate();
  const { darkMode } = useContext(ThemeContext);
  
  useEffect(() => {
    // Extract token from URL params
    const queryParams = new URLSearchParams(location.search);
    const urlToken = queryParams.get('token');
    if (!urlToken) {
      setError('Invalid password reset link. Please request a new one.');
    } else {
      setToken(urlToken);
    }
    
    // Apply dark mode class to body if needed
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [location, darkMode]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:8000/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          new_password: password
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to reset password');
      }
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      
    } catch (error) {
      setError(error.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Generate background notes (like on login page)
  const renderBackgroundNotes = () => {
    const notes = ['♩', '♪', '♫', '♬', '♭', '♮', '♯'];
    const bgNotes = [];
    
    for (let i = 0; i < 30; i++) {
      const note = notes[Math.floor(Math.random() * notes.length)];
      const left = `${Math.random() * 100}%`;
      const top = `${Math.random() * 100}%`;
      const delay = `${Math.random() * 20}s`;
      const duration = `${20 + Math.random() * 30}s`;
      
      bgNotes.push(
        <div 
          key={i} 
          className="bg-note"
          style={{
            left,
            top,
            animationDelay: delay,
            animationDuration: duration
          }}
        >
          {note}
        </div>
      );
    }
    
    return bgNotes;
  };
  
  return (
    <div className={`reset-password-page ${darkMode ? 'dark-mode' : ''}`}>
      <div className="bg-notes-container">
        {renderBackgroundNotes()}
      </div>
      
      <div className="reset-password-container">
        <div className="reset-password-card">
          <div className="logo-container">
            <h1>TuneBreeder</h1>
          </div>
          
          <h2>Reset Your Password</h2>
          
          {error && <div className="error-message">{error}</div>}
          {success && (
            <div className="success-message">
              <div className="success-icon">✓</div>
              <div>
                <h3>Password reset successfully!</h3>
                <p>Redirecting to login page...</p>
              </div>
            </div>
          )}
          
          {!success && token && (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="password">New Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className={darkMode ? 'dark-input' : ''}
                  placeholder="Enter new password"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className={darkMode ? 'dark-input' : ''}
                  placeholder="Confirm new password"
                />
              </div>
              
              <button 
                type="submit" 
                className="reset-button"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="loading-spinner">
                    <span className="spinner"></span>
                    Resetting...
                  </span>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          )}
          
          <div className="back-to-login">
            <a href="/login">← Back to Login</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;