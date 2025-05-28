import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { clipboard } from '@tauri-apps/api';
import './App.css';

console.log('App component is loading...');

// Check if we're running in Tauri context
const isTauri = typeof window !== 'undefined' && window.__TAURI__;

function App() {
  console.log('App component is rendering...');
  console.log('Is Tauri context:', isTauri);
  
  // Authentication state
  const [authStatus, setAuthStatus] = useState({ is_authenticated: false, needs_setup: true });
  const [isLoading, setIsLoading] = useState(true);
  
  // Password management state
  const [passwords, setPasswords] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: '' });
  
  // Form states
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState({
    title: '',
    username: '',
    password: '',
    category: '',
    notes: ''
  });

  // Check authentication status on app load
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Auto-refresh session every 5 minutes
  useEffect(() => {
    if (authStatus.is_authenticated) {
      const interval = setInterval(checkAuthStatus, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [authStatus.is_authenticated]);

  async function checkAuthStatus() {
    try {
      const status = await invoke('check_auth_status');
      setAuthStatus(status);
      if (status.is_authenticated) {
        loadPasswords();
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      showError('Failed to check authentication status');
    } finally {
      setIsLoading(false);
    }
  }

  async function setupMasterPassword() {
    if (masterPassword !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }
    if (masterPassword.length < 8) {
      showError('Master password must be at least 8 characters');
      return;
    }

    try {
      await invoke('setup_master_password', { masterPassword });
      showSuccess('Master password set up successfully!');
      setAuthStatus({ is_authenticated: true, needs_setup: false });
      setMasterPassword('');
      setConfirmPassword('');
      loadPasswords();
    } catch (error) {
      showError('Failed to set up master password: ' + error);
    }
  }

  async function authenticate() {
    if (!masterPassword) {
      showError('Please enter your master password');
      return;
    }

    try {
      const success = await invoke('authenticate', { masterPassword });
      if (success) {
        showSuccess('Welcome back!');
        setAuthStatus({ is_authenticated: true, needs_setup: false });
        setMasterPassword('');
        loadPasswords();
      } else {
        showError('Incorrect master password');
      }
    } catch (error) {
      showError('Authentication failed: ' + error);
    }
  }

  async function logout() {
    try {
      await invoke('logout');
      setAuthStatus({ is_authenticated: false, needs_setup: false });
      setPasswords([]);
      setMasterPassword('');
      showSuccess('Logged out successfully');
    } catch (error) {
      showError('Failed to logout: ' + error);
    }
  }

  async function loadPasswords() {
    try {
      const passwordList = await invoke('get_passwords');
      setPasswords(passwordList);
    } catch (error) {
      if (error.includes('Session expired')) {
        setAuthStatus({ is_authenticated: false, needs_setup: false });
        showError('Session expired. Please log in again.');
      } else {
        showError('Failed to load passwords: ' + error);
      }
    }
  }

  async function handleAddPassword() {
    if (!newPassword.title || !newPassword.username || !newPassword.password) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      await invoke('add_password', {
        title: newPassword.title,
        username: newPassword.username,
        password: newPassword.password,
        category: newPassword.category || null,
        notes: newPassword.notes || null
      });
      
      showSuccess('Password added successfully');
      setNewPassword({ title: '', username: '', password: '', category: '', notes: '' });
      setShowAddForm(false);
      loadPasswords();
    } catch (error) {
      if (error.includes('Session expired')) {
        setAuthStatus({ is_authenticated: false, needs_setup: false });
        showError('Session expired. Please log in again.');
      } else {
        showError('Failed to add password: ' + error);
      }
    }
  }

  async function handleCopyPassword(id) {
    try {
      const password = await invoke('decrypt_password', { id });
      
      if (window.__TAURI__) {
        await clipboard.writeText(password);
        showSuccess('Password copied to clipboard');
        
        // Clear clipboard after 30 seconds
        setTimeout(async () => {
          await clipboard.writeText('');
        }, 30000);
      } else {
        // Fallback for web
        navigator.clipboard.writeText(password);
        showSuccess('Password copied to clipboard');
      }
    } catch (error) {
      if (error.includes('Session expired')) {
        setAuthStatus({ is_authenticated: false, needs_setup: false });
        showError('Session expired. Please log in again.');
      } else {
        showError('Failed to copy password: ' + error);
      }
    }
  }

  async function handleDeletePassword(id) {
    if (!confirm('Are you sure you want to delete this password?')) {
      return;
    }

    try {
      await invoke('delete_password', { id });
      showSuccess('Password deleted successfully');
      loadPasswords();
    } catch (error) {
      if (error.includes('Session expired')) {
        setAuthStatus({ is_authenticated: false, needs_setup: false });
        showError('Session expired. Please log in again.');
      } else {
        showError('Failed to delete password: ' + error);
      }
    }
  }

  function showSuccess(message) {
    setNotification({ message, type: 'success' });
    setTimeout(() => setNotification({ message: '', type: '' }), 3000);
  }

  function showError(message) {
    setNotification({ message, type: 'error' });
    setTimeout(() => setNotification({ message: '', type: '' }), 5000);
  }

  function generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword({ ...newPassword, password });
  }

  // Loading screen
  if (isLoading) {
    return (
      <div className="container-fluid vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading Password Manager...</p>
        </div>
      </div>
    );
  }

  // Setup screen (first time use)
  if (authStatus.needs_setup) {
    return (
      <div className="container-fluid vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="card shadow-lg" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="card-body p-5">
            <div className="text-center mb-4">
              <i className="fas fa-shield-alt text-primary" style={{ fontSize: '3rem' }}></i>
              <h2 className="mt-3">Welcome to Password Manager</h2>
              <p className="text-muted">Set up your master password to get started</p>
            </div>
            
            <div className="mb-3">
              <label className="form-label">Master Password</label>
              <input
                type="password"
                className="form-control"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder="Enter a strong master password"
                minLength="8"
              />
              <div className="form-text">Must be at least 8 characters long</div>
            </div>
            
            <div className="mb-4">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your master password"
              />
            </div>
            
            <button 
              className="btn btn-primary w-100"
              onClick={setupMasterPassword}
              disabled={!masterPassword || !confirmPassword}
            >
              <i className="fas fa-key me-2"></i>
              Set Up Master Password
            </button>
            
            <div className="alert alert-info mt-3 small">
              <i className="fas fa-info-circle me-2"></i>
              Your master password encrypts all your data. Make sure to remember it!
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Login screen
  if (!authStatus.is_authenticated) {
    return (
      <div className="container-fluid vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="card shadow-lg" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="card-body p-5">
            <div className="text-center mb-4">
              <i className="fas fa-lock text-primary" style={{ fontSize: '3rem' }}></i>
              <h2 className="mt-3">Password Manager</h2>
              <p className="text-muted">Enter your master password to continue</p>
            </div>
            
            <div className="mb-4">
              <label className="form-label">Master Password</label>
              <input
                type="password"
                className="form-control"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder="Enter your master password"
                onKeyPress={(e) => e.key === 'Enter' && authenticate()}
                autoFocus
              />
            </div>
            
            <button 
              className="btn btn-primary w-100"
              onClick={authenticate}
              disabled={!masterPassword}
            >
              <i className="fas fa-sign-in-alt me-2"></i>
              Unlock
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main application (authenticated)
  return (
    <div className="container-fluid vh-100 d-flex flex-column">
      {/* Notification */}
      {notification.message && (
        <div className={`alert alert-${notification.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show position-fixed`} 
             style={{ top: '20px', right: '20px', zIndex: 1050, minWidth: '300px' }}>
          {notification.message}
          <button type="button" className="btn-close" onClick={() => setNotification({ message: '', type: '' })}></button>
        </div>
      )}

      {/* Header */}
      <nav className="navbar navbar-dark bg-primary">
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">
            <i className="fas fa-shield-alt me-2"></i>
            Password Manager
          </span>
          <div className="d-flex">
            <button className="btn btn-outline-light me-2" onClick={() => setShowAddForm(true)}>
              <i className="fas fa-plus me-1"></i>Add Password
            </button>
            <button className="btn btn-outline-light" onClick={logout}>
              <i className="fas fa-sign-out-alt me-1"></i>Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-grow-1 p-4">
        {showAddForm && (
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Add New Password</h5>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowAddForm(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newPassword.title}
                    onChange={(e) => setNewPassword({ ...newPassword, title: e.target.value })}
                    placeholder="e.g., Gmail, Facebook"
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Username *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newPassword.username}
                    onChange={(e) => setNewPassword({ ...newPassword, username: e.target.value })}
                    placeholder="Username or email"
                  />
                </div>
                <div className="col-md-8 mb-3">
                  <label className="form-label">Password *</label>
                  <input
                    type="password"
                    className="form-control"
                    value={newPassword.password}
                    onChange={(e) => setNewPassword({ ...newPassword, password: e.target.value })}
                    placeholder="Password"
                  />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">&nbsp;</label>
                  <button className="btn btn-outline-primary w-100" onClick={generatePassword}>
                    <i className="fas fa-random me-1"></i>Generate
                  </button>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={newPassword.category}
                    onChange={(e) => setNewPassword({ ...newPassword, category: e.target.value })}
                  >
                    <option value="">Select category</option>
                    <option value="Social">Social</option>
                    <option value="Work">Work</option>
                    <option value="Finance">Finance</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Notes</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newPassword.notes}
                    onChange={(e) => setNewPassword({ ...newPassword, notes: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-primary" onClick={handleAddPassword}>
                  <i className="fas fa-save me-1"></i>Save Password
                </button>
                <button className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Password List */}
        <div className="row">
          {passwords.length === 0 ? (
            <div className="col-12 text-center py-5">
              <i className="fas fa-key text-muted" style={{ fontSize: '4rem' }}></i>
              <h4 className="mt-3 text-muted">No passwords saved yet</h4>
              <p className="text-muted">Click "Add Password" to get started</p>
            </div>
          ) : (
            passwords.map((password) => (
              <div key={password.id} className="col-md-6 col-lg-4 mb-3">
                <div className="card h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h6 className="card-title mb-0">{password.title}</h6>
                      {password.category && (
                        <span className="badge bg-secondary">{password.category}</span>
                      )}
                    </div>
                    <p className="card-text text-muted small mb-2">
                      <i className="fas fa-user me-1"></i>
                      {password.username}
                    </p>
                    {password.notes && (
                      <p className="card-text small text-muted mb-3">{password.notes}</p>
                    )}
                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-sm btn-primary flex-grow-1"
                        onClick={() => handleCopyPassword(password.id)}
                      >
                        <i className="fas fa-copy me-1"></i>Copy
                      </button>
                      <button 
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDeletePassword(password.id)}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
