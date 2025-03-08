import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './LoginPage';
import HomePage from './HomePage';

const App = () => {
  // Check if user is logged in
  const isLoggedIn = localStorage.getItem('token') !== null;
  
  return (
    <Router>
      <Routes>
        <Route path="/login" element={
          isLoggedIn ? <Navigate to="/dashboard" /> : <LoginPage />
        } />
        <Route path="/dashboard" element={
          isLoggedIn ? <HomePage /> : <Navigate to="/login" />
        } />
        <Route path="/" element={<Navigate to={isLoggedIn ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
};

export default App;
