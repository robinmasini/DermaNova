import { useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const isStandalonePortal = urlParams.get('portal') === 'true';

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('dermaNovaAuth') === 'true';
  });

  const handleLogin = () => {
    localStorage.setItem('dermaNovaAuth', 'true');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('dermaNovaAuth');
    setIsAuthenticated(false);
  };

  return (
    <>
      {isStandalonePortal ? (
        <Dashboard isStandalonePortal={true} />
      ) : isAuthenticated ? (
        <Dashboard onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </>
  );
}

export default App;
