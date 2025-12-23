/**
 * Offline Indicator Component
 * Shows connection status and pending sync items
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { isOnline, getPendingOrdersCount } from '../services/offlineService';
import { useAppContext } from '../hooks/useAppContext';

export const OfflineIndicator: React.FC = () => {
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const { showNotification } = useAppContext();

  useEffect(() => {
    const updateOnlineStatus = () => {
      const wasOffline = !online;
      const nowOnline = isOnline();
      setOnline(nowOnline);

      if (wasOffline && nowOnline) {
        showNotification('Connection restored. Syncing pending orders...', 'success');
        // Trigger sync (will be handled by sync service)
        window.dispatchEvent(new Event('online-sync'));
      } else if (!wasOffline && !nowOnline) {
        showNotification('You are offline. Orders will be queued for sync.', 'info');
      }
    };

    // Check pending count periodically
    const updatePendingCount = async () => {
      const count = await getPendingOrdersCount();
      setPendingCount(count);
    };

    // Initial check
    updatePendingCount();
    const countInterval = setInterval(updatePendingCount, 5000); // Check every 5 seconds

    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      clearInterval(countInterval);
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [online, showNotification]);

  if (online && pendingCount === 0) {
    return null; // Don't show when online and nothing pending
  }

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium transition-all ${
        !online
          ? 'bg-yellow-500 text-white'
          : pendingCount > 0
          ? 'bg-blue-500 text-white'
          : 'bg-green-500 text-white'
      }`}
    >
      {!online ? (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Offline Mode</span>
          {pendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs">
              {pendingCount} pending
            </span>
          )}
        </>
      ) : pendingCount > 0 ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Syncing {pendingCount} order{pendingCount !== 1 ? 's' : ''}...</span>
        </>
      ) : (
        <>
          <Wifi className="w-4 h-4" />
          <span>Online</span>
        </>
      )}
    </div>
  );
};

