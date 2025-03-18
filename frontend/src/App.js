import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './LoginPage';
import HomePage from './HomePage';
import MyTunes from './MyTunes';
import Compare from './Compare';
import MelodyMutate from './MelodyMutate';
import { ThemeProvider } from './context/ThemeContext';
import AuthCallback from './AuthCallback';
import ResetPasswordPage from './ResetPasswordPage';


const App = () => {
  // Check if user is logged in
  const isLoggedIn = localStorage.getItem('token') !== null;
  
  // Auth protection HOC
  const ProtectedRoute = ({ children }) => {
    if (!isLoggedIn) {
      return <Navigate to="/login" />;
    }
    return children;
  };

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={
            isLoggedIn ? <Navigate to="/dashboard" /> : <LoginPage />
          } />

          {/* Protected routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } />
          <Route path="/auth-callback" element={<AuthCallback />} />
          <Route path="/my-tunes" element={
            <ProtectedRoute>
              <MyTunes />
            </ProtectedRoute>
          } />
          <Route path="/mytunes" element={
            <ProtectedRoute>
              <MyTunes />
            </ProtectedRoute>
          } />
          <Route path="/compare" element={
            <ProtectedRoute>
              <Compare />
            </ProtectedRoute>
          } />
          <Route path="/mutate" element={
            <ProtectedRoute>
              <MelodyMutate />
            </ProtectedRoute>
          } />
          
          {/* Default route */}
          <Route path="/" element={<Navigate to={isLoggedIn ? "/dashboard" : "/login"} />} />
          
          {/* Catch-all route for 404 */}
          <Route path="*" element={
            <div className="error-container">
              <h1>404 - Page Not Found</h1>
              <button 
                className="primary-btn" 
                onClick={() => window.location.href = isLoggedIn ? '/dashboard' : '/login'}
              >
                Go to {isLoggedIn ? 'Home' : 'Login'}
              </button>
            </div>
          } />

          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;