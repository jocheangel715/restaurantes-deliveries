import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom'; // Import Router components
import './index.css';
import Login from './LOGIN/login'; // Import Login component
import Homepage from './HOME/home'; // Import Homepage component
import reportWebVitals from './reportWebVitals';
import { onAuthStateChanged } from "firebase/auth"; // Import Firebase auth functions
import { auth } from './firebase'; // Import the initialized Firebase app and auth

const root = ReactDOM.createRoot(document.getElementById('root'));

onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Clear credentials on logout
    localStorage.clear();
  }
  root.render(
    <React.StrictMode>
      <Router>
        <Routes>
          {user ? (
            <>
              <Route path="/restaurantes-deliveries" element={<Homepage />} />
              <Route path="/" element={<Navigate to="/restaurantes-deliveries" />} /> {/* Default route */}
            </>
          ) : (
            <>
              <Route path="/restaurantes-deliveries" element={<Login />} />
              <Route path="/" element={<Navigate to="/restaurantes-deliveries" />} /> {/* Default route */}
            </>
          )}
        </Routes>
      </Router>
    </React.StrictMode>
  );
});

reportWebVitals();
