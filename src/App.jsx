import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api';
import { clipboard } from '@tauri-apps/api';
import { dialog } from '@tauri-apps/api';
import './App.css';

console.log('App component is loading...');

// Check if we're running in Tauri context
const isTauri = typeof window !== 'undefined' && window.__TAURI__;

function App() {
  console.log('App component is rendering...');
  console.log('Is Tauri context:', isTauri);
  
  const [passwords, setPasswords] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    username: '',
    password: '',
    category: '',
    notes: ''
  });
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('useEffect is running...');
    loadPasswords();
  }, []);

  function showSuccess(message) {
    setToast({ show: true, message, type: 'success' });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  }

  function showError(message) {
    setToast({ show: true, message, type: 'error' });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  }

  async function loadPasswords() {
    console.log('Loading passwords...');
    setIsLoading(true);
    setError(null);
    try {
      if (isTauri) {
        const result = await invoke('get_passwords');
        console.log('Passwords loaded:', result);
        setPasswords(result || []);
      } else {
        // Fallback for web development
        console.log('Running in web mode - using mock data');
        setPasswords([]);
      }
    } catch (error) {
      console.error('Failed to load passwords:', error);
      setError('Failed to load passwords: ' + error);
      showError('Failed to load passwords');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddPassword(e) {
    e.preventDefault();
    try {
      if (isTauri) {
        await invoke('add_password', formData);
      } else {
        // Fallback for web development
        console.log('Would add password:', formData);
        showSuccess('Password would be added (web mode)');
      }
      setShowAddModal(false);
      setFormData({ title: '', username: '', password: '', category: '', notes: '' });
      await loadPasswords();
      if (isTauri) {
        showSuccess('Password added successfully');
      }
    } catch (error) {
      console.error('Failed to add password:', error);
      showError('Failed to add password');
    }
  }

  async function handleCopyPassword(id) {
    try {
      if (isTauri) {
        const password = await invoke('decrypt_password', { id });
        await clipboard.writeText(password);
        showSuccess('Password copied to clipboard');
        
        // Clear clipboard after 30 seconds
        setTimeout(async () => {
          await clipboard.writeText('');
        }, 30000);
      } else {
        // Fallback for web development
        console.log('Would copy password for id:', id);
        showSuccess('Password would be copied (web mode)');
      }
    } catch (error) {
      console.error('Failed to copy password:', error);
      showError('Failed to copy password');
    }
  }

  async function handleDeletePassword(id) {
    let confirmed = true;
    
    if (isTauri) {
      confirmed = await dialog.confirm('Are you sure you want to delete this password?', {
        title: 'Confirm Deletion',
        type: 'warning'
      });
    } else {
      // Fallback for web development
      confirmed = window.confirm('Are you sure you want to delete this password?');
    }
    
    if (confirmed) {
      try {
        if (isTauri) {
          await invoke('delete_password', { id });
        } else {
          // Fallback for web development
          console.log('Would delete password with id:', id);
        }
        await loadPasswords();
        showSuccess('Password deleted successfully');
      } catch (error) {
        console.error('Failed to delete password:', error);
        showError('Failed to delete password');
      }
    }
  }

  return (
    <div className="app-container">
      <nav className="navbar navbar-dark">
        <div className="container-fluid">
          <span className="navbar-brand">
            <i className="fas fa-lock"></i> Password Manager
          </span>
        </div>
      </nav>

      <div className="container">
        <div className="dashboard-container">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h1>Your Secure Vault</h1>
            <button className="btn btn-light" onClick={() => setShowAddModal(true)}>
              <i className="fas fa-plus me-2"></i>Add Password
            </button>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              <strong>Error:</strong> {error}
            </div>
          )}

          {isLoading ? (
            <div className="text-center">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p>Loading passwords...</p>
            </div>
          ) : (
            <div className="row">
              {passwords.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-lock empty-icon"></i>
                  <h3>No passwords stored yet</h3>
                  <p className="text-muted">Start securing your credentials by adding your first password entry.</p>
                </div>
              ) : (
                passwords.map(password => (
                  <div key={password.id} className="col-md-6 col-lg-4">
                    <div className="password-card">
                      <div className="password-header">
                        <h3 className="password-title">{password.title}</h3>
                        {password.category && (
                          <span className="password-category">
                            <i className="fas fa-tag me-1"></i>{password.category}
                          </span>
                        )}
                      </div>
                      <div className="password-body">
                        <div className="password-field">
                          <small>Username</small><br />
                          {password.username}
                        </div>
                        <div className="password-field">
                          <small>Password</small><br />
                          <span className="text-muted">••••••••</span>
                        </div>
                        {password.notes && (
                          <div className="password-field">
                            <small>Notes</small><br />
                            {password.notes}
                          </div>
                        )}
                        <div className="password-actions">
                          <button className="btn btn-action" onClick={() => handleCopyPassword(password.id)}>
                            <i className="fas fa-copy me-1"></i>Copy
                          </button>
                          <button className="btn btn-action" onClick={() => handleDeletePassword(password.id)}>
                            <i className="fas fa-trash me-1"></i>Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Password Modal */}
      {showAddModal && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add New Password</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddModal(false)}></button>
              </div>
              <form onSubmit={handleAddPassword}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Title</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Category</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Notes</label>
                    <textarea
                      className="form-control"
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                      rows="3"
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast.show && (
        <div className={`toast show position-fixed bottom-0 end-0 m-3 ${toast.type === 'error' ? 'bg-danger' : 'bg-success'}`}>
          <div className="toast-body text-white">
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
