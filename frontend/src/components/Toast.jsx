import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';
import { ToastContext } from './toastContext.js';

// Individual Toast Component
function Toast({ id, message, type = 'info', onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(id), 300);
    }, 4000);

    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(id), 300);
  };

  const icons = {
    success: <CheckCircle size={18} />,
    error: <AlertCircle size={18} />,
    info: <Info size={18} />,
    warning: <AlertCircle size={18} />,
  };

  return (
    <div className={`toast toast-${type} ${isExiting ? 'toast-exit' : 'toast-enter'}`}>
      <div className="toast-icon">{icons[type]}</div>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={handleDismiss}>
        <X size={14} />
      </button>
    </div>
  );
}

// Toast Provider & Container
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <Toast key={t.id} id={t.id} message={t.message} type={t.type} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
