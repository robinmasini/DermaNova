import { useState } from 'react';
import './Login.css';
import logo from '../assets/dn.png';
import backgroundVideo from '../assets/background.mp4';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username === 'contact@casperdental.com' && password === 'Casper1234') {
      setError('');
      onLogin();
    } else {
      setError('Identifiant ou mot de passe incorrect.');
    }
  };

  return (
    <div className="login-container">
      <video 
        className="login-video-bg" 
        autoPlay 
        loop 
        muted 
        playsInline
      >
        <source src={backgroundVideo} type="video/mp4" />
      </video>
      
      <div className="glass-panel glass-panel-glow login-card animate-fade-in">
        <div className="login-header">
          <img src={logo} alt="DermaNova Logo" className="login-logo" />
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <input 
              type="text" 
              placeholder="Identifiant" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required 
            />
          </div>
          <div className="input-group">
            <input 
              type="password" 
              placeholder="Mot de passe" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" className="login-button">
            Connexion
          </button>
        </form>
      </div>
    </div>
  );
}
