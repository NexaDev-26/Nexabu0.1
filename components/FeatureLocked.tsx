/**
 * Feature Locked Component
 * Shows when a feature is locked due to subscription tier or payment verification
 */

import React from 'react';
import { Lock, ArrowRight, Zap } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { needsPaymentVerification, getSubscriptionStatusMessage } from '../utils/featureGating';
import { UserRole } from '../types';

interface FeatureLockedProps {
  feature: string;
  requiredPlan: 'Premium' | 'Enterprise';
  children?: React.ReactNode;
}

export const FeatureLocked: React.FC<FeatureLockedProps> = ({ 
  feature, 
  requiredPlan,
  children 
}) => {
  const { user, showNotification } = useAppContext();
  const needsVerification = needsPaymentVerification(user);
  const statusMessage = getSubscriptionStatusMessage(user);
  const currentPlan = user?.subscriptionPlan || 'Starter';

  const handleUpgrade = () => {
    // Navigate to subscription page
    if (window.location.hash) {
      window.location.hash = '#subscription';
    } else {
      window.location.href = '#subscription';
    }
    showNotification('Redirecting to subscription page...', 'info');
  };

  // Check if feature is locked
  const isLocked = () => {
    if (!user) return true;
    if (user.role === UserRole.ADMIN) return false; // Admin always has access
    
    // Check if payment verification is needed
    if (needsVerification) return true;
    
    // Check plan tier
    if (requiredPlan === 'Premium') {
      return currentPlan === 'Starter';
    }
    if (requiredPlan === 'Enterprise') {
      return currentPlan === 'Starter' || currentPlan === 'Premium';
    }
    
    return false;
  };

  if (!isLocked()) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Blurred/Locked Content */}
      <div className="opacity-50 pointer-events-none select-none">
        {children}
      </div>
      
      {/* Lock Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm rounded-xl z-10">
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-8 max-w-md mx-4 border border-neutral-200 dark:border-neutral-800 shadow-2xl">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-orange-600" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              Feature Locked
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              This feature requires <strong>{requiredPlan}</strong> plan or higher.
            </p>
            
            {needsVerification && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  {statusMessage}
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={handleUpgrade}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 font-medium flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Upgrade Plan
              </button>
              <button
                onClick={() => {
                  if (window.location.hash) {
                    window.location.hash = '#subscription';
                  } else {
                    window.location.href = '#subscription';
                  }
                }}
                className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2"
              >
                View Plans
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

