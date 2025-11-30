/**
 * Network Status Indicator
 * Shows connection status and provides offline recovery
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';

interface NetworkStatusProps {
  onRetry?: () => void;
  className?: string;
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({ onRetry, className = '' }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOffline(false);
      // Auto-retry when coming back online
      if (onRetry) {
        setTimeout(onRetry, 500);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onRetry]);

  if (!showOffline && isOnline) {
    return null;
  }

  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 ${className}`}
      role="status"
      aria-live="polite"
    >
      {!isOnline ? (
        <div className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in-down">
          <WifiOff className="w-5 h-5" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium">No Internet Connection</p>
            <p className="text-sm text-red-100">Please check your network and try again</p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1 bg-white text-red-600 rounded text-sm font-medium hover:bg-red-50 transition-colors"
              aria-label="Retry connection"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <div className="bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in-down">
          <Wifi className="w-5 h-5" aria-hidden="true" />
          <p className="font-medium">Back Online</p>
        </div>
      )}
    </div>
  );
};

/**
 * Hook to monitor network status
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

/**
 * Inline Network Status Badge
 * Shows small indicator in UI
 */
export const NetworkStatusBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const isOnline = useNetworkStatus();

  return (
    <div
      className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs ${
        isOnline ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
      } ${className}`}
      role="status"
      aria-label={isOnline ? 'Online' : 'Offline'}
    >
      <div
        className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-600' : 'bg-red-600'}`}
        aria-hidden="true"
      />
      <span className="font-medium">{isOnline ? 'Online' : 'Offline'}</span>
    </div>
  );
};

// Add CSS animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slide-in-down {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
    .animate-slide-in-down {
      animation: slide-in-down 0.3s ease-out;
    }
  `;
  document.head.appendChild(style);
}
