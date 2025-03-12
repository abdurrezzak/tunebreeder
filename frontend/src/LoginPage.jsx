import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from './context/ThemeContext';
import './LoginPage.css';

const LoginPage = () => {
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);
  const [activeForm, setActiveForm] = useState('login'); // 'login', 'signup', or 'forgot'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Form data states
  const [loginData, setLoginData] = useState({ email: '', password: '', remember: false });
  const [signupData, setSignupData] = useState({ fullname: '', email: '', password: '', confirmPassword: '' });
  const [forgotData, setForgotData] = useState({ email: '' });
  
  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Generate background notes
  const renderBackgroundNotes = () => {
    const notes = ['♩', '♪', '♫', '♬', '♭', '♮', '♯'];
    const bgNotes = [];
    
    // Create 30 randomly positioned notes
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

  // API request functions
  const loginUser = async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      // Create FormData as FastAPI expects form data for OAuth2
      const formData = new FormData();
      formData.append('username', email); // FastAPI OAuth expects 'username'
      formData.append('password', password);
      
      const response = await fetch('http://localhost:8000/api/token', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }
      
      // Store token in localStorage or cookies
      localStorage.setItem('token', data.access_token);
      
      // Redirect to dashboard or home page
      window.location.href = '/dashboard';
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const signupUser = async (fullname, email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8000/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          username: fullname, // Your backend expects 'username', not 'full_name'
          password,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Signup failed');
      }
      
      // Auto-login the user or redirect to login page with success message
      setActiveForm('login');
      // Show success message
      alert('Account created successfully! Please login.');
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const resetPassword = async (email) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8000/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send reset link');
      }
      
      // Show success message
      alert('Password reset link has been sent to your email!');
      setActiveForm('login');
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoogleLogin = () => {
    // Redirect to Google OAuth endpoint
    window.location.href = 'http://localhost:8000/auth/google/login';
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    switch (activeForm) {
      case 'login':
        loginUser(loginData.email, loginData.password);
        break;
      case 'signup':
        if (signupData.password !== signupData.confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        signupUser(signupData.fullname, signupData.email, signupData.password);
        break;
      case 'forgot':
        resetPassword(forgotData.email);
        break;
      default:
        break;
    }
  };

  // Handle input changes
  const handleLoginChange = (e) => {
    const { id, value, checked, type } = e.target;
    setLoginData({
      ...loginData,
      [id]: type === 'checkbox' ? checked : value
    });
  };
  
  const handleSignupChange = (e) => {
    const { id, value } = e.target;
    setSignupData({
      ...signupData,
      [id === 'fullname' ? 'fullname' : 
       id === 'signup-email' ? 'email' : 
       id === 'signup-password' ? 'password' : 
       id === 'confirm-password' ? 'confirmPassword' : id]: value
    });
  };
  
  const handleForgotChange = (e) => {
    setForgotData({ email: e.target.value });
  };

  // Render the appropriate form based on activeForm state
  const renderForm = () => {
    switch (activeForm) {
      case 'login':
        return (
          <>
            <h1>Welcome Back</h1>
            <p className="subtitle">Sign in to continue your musical evolution</p>
            
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input 
                  type="email" 
                  id="email" 
                  value={loginData.email}
                  onChange={handleLoginChange}
                  placeholder="Enter your email" 
                  required 
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input 
                  type="password" 
                  id="password" 
                  value={loginData.password}
                  onChange={handleLoginChange}
                  placeholder="Enter your password" 
                  required 
                />
              </div>
              
              <div className="options">
                <div className="remember">
                  <input 
                    type="checkbox" 
                    id="remember" 
                    checked={loginData.remember}
                    onChange={handleLoginChange}
                  />
                  <label htmlFor="remember">Remember me</label>
                </div>
                <button 
                  type="button" 
                  className="forgot text-btn"
                  onClick={() => setActiveForm('forgot')}
                >
                  Forgot password?
                </button>
              </div>
              
              <button 
                type="submit" 
                className="submit-btn" 
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
              
              <div className="separator">or continue with</div>
              
              <div className="social-login">
                <div 
                  className="social-btn google-btn"
                  onClick={handleGoogleLogin}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z" fill="#4285F4"/>
                  </svg>
                  <span>Continue with Google</span>
                </div>
              </div>
            </form>
            
            <div className="form-switch">
              Don't have an account? <button className="text-btn" onClick={() => setActiveForm('signup')}>Sign up</button>
            </div>
          </>
        );
        
      case 'signup':
        return (
          <>
            <h1>Create Account</h1>
            <p className="subtitle">Join our musical evolution community</p>
            
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="fullname">Full Name</label>
                <input 
                  type="text" 
                  id="fullname" 
                  value={signupData.fullname}
                  onChange={handleSignupChange}
                  placeholder="Enter your full name" 
                  required 
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="signup-email">Email</label>
                <input 
                  type="email" 
                  id="signup-email" 
                  value={signupData.email}
                  onChange={handleSignupChange}
                  placeholder="Enter your email" 
                  required 
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="signup-password">Password</label>
                <input 
                  type="password" 
                  id="signup-password" 
                  value={signupData.password}
                  onChange={handleSignupChange}
                  placeholder="Create a password" 
                  required 
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="confirm-password">Confirm Password</label>
                <input 
                  type="password" 
                  id="confirm-password" 
                  value={signupData.confirmPassword}
                  onChange={handleSignupChange}
                  placeholder="Confirm your password" 
                  required 
                />
              </div>
              
              <button 
                type="submit" 
                className="submit-btn"
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
              
              <div className="separator">or sign up with</div>
              
              <div className="social-login">
                <div 
                  className="social-btn google-btn"
                  onClick={handleGoogleLogin}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z" fill="#4285F4"/>
                  </svg>
                  <span>Sign up with Google</span>
                </div>
              </div>
            </form>
            
            <div className="form-switch">
              Already have an account? <button className="text-btn" onClick={() => setActiveForm('login')}>Sign in</button>
            </div>
          </>
        );
        
      case 'forgot':
        return (
          <>
            <h1>Forgot Password</h1>
            <p className="subtitle">We'll send you a reset link to your email</p>
            
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="reset-email">Email</label>
                <input 
                  type="email" 
                  id="reset-email" 
                  value={forgotData.email}
                  onChange={handleForgotChange}
                  placeholder="Enter your email" 
                  required 
                />
              </div>
              
              <button 
                type="submit" 
                className="submit-btn"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            
            <div className="form-switch">
              <button className="text-btn" onClick={() => setActiveForm('login')}>
                <span className="back-arrow">←</span> Back to login
              </button>
            </div>
          </>
        );
        
      default:
        return null;
    }
  };

  return (
    <>
      <div className="bg-notes">
        {renderBackgroundNotes()}
      </div>
      
      <div className={`container ${darkMode ? 'dark-mode' : ''}`}>
        <div className="content-box">
          <div className="login-form">
            <div className="login-header">
              <h1>TuneBreeder</h1>
              <button className="theme-toggle" onClick={toggleDarkMode}>
                {darkMode ? <i className="fas fa-sun"></i> : <i className="fas fa-moon"></i>}
              </button>
            </div>
            
            {renderForm()}
          </div>
          
          <div className="graphic">
            <div className="music-notes note1">♪</div>
            <div className="music-notes note2">♫</div>
            <div className="music-notes note3">♩</div>
            <div className="music-notes note4">♬</div>
            
            <svg className="wave-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320">
              <path fill="currentColor" fillOpacity="0.2" d="M0,192L48,197.3C96,203,192,213,288,202.7C384,192,480,160,576,170.7C672,181,768,235,864,250.7C960,267,1056,245,1152,208C1248,171,1344,117,1392,90.7L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
            </svg>
            
            <div className="graphic-content">
              <h2>Collaborative Musical Evolution</h2>
              <p>Join our community to create, mutate, and evolve musical genomes. Help shape the next generation of beautiful melodies.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;