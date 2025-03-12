import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import './Navigation.css';

const Navigation = ({ user }) => {
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };
  
  // Helper to check if the current route matches
  const isActive = (path) => {
    return location.pathname === path;
  };
  
  return (
    <header className="app-header">
      <div className="logo" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
        <div className="logo-icon">
          <i className="fas fa-music"></i>
        </div>
        <h1>TuneBreeder</h1>
      </div>
      
      <div className="header-nav">
        <button 
          className={`nav-btn ${isActive('/dashboard') || isActive('/') ? 'active' : ''}`} 
          onClick={() => navigate('/dashboard')}
        >
          <i className="fas fa-home"></i> Home
        </button>
        <button 
          className={`nav-btn ${isActive('/my-tunes') || isActive('/mytunes') ? 'active' : ''}`} 
          onClick={() => navigate('/my-tunes')}
        >
          <i className="fas fa-album-collection"></i> My Tunes
        </button>
        <button 
          className={`nav-btn ${isActive('/compare') ? 'active' : ''}`} 
          onClick={() => navigate('/compare')}
        >
          <i className="fas fa-balance-scale"></i> Compare
        </button>
      </div>
      
      <div className="user-controls">
        <button className="theme-toggle" onClick={toggleDarkMode}>
          {darkMode ? <i className="fas fa-sun"></i> : <i className="fas fa-moon"></i>}
        </button>
        {user && (
          <div className="user-info">
            <span>
              <i className="fas fa-user"></i> {user.username}
            </span>
            <button className="logout-btn" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt"></i> Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navigation;