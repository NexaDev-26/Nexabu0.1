/**
 * Subscription Status Banner
 * Shows payment verification status and subscription information
 */

import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Clock, XCircle, ArrowRight } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { needsPaymentVerification, getSubscriptionStatusMessage } from '../utils/featureGating';
import { SubscriptionStatusModal } from './SubscriptionStatusModal';

export const SubscriptionStatusBanner: React.FC = () => {
  const { user } = useAppContext();
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  
  if (!user) return null;
  
  const needsVerification = needsPaymentVerification(user);
  const statusMessage = getSubscriptionStatusMessage(user);
  const isActive = user.status === 'Active';
  const isPending = user.status === 'Pending Payment Verification';
  const isRejected = user.status === 'Payment Rejected';

  // Don't show banner for active subscriptions
  if (isActive && !needsVerification) return null;

  const getBannerConfig = () => {
    if (isPending) {
      return {
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-200 dark:border-yellow-800',
        text: 'text-yellow-800 dark:text-yellow-200',
        icon: <Clock className="w-5 h-5 text-yellow-600" />,
        title: 'Payment Verification Pending'
      };
    }
    if (isRejected) {
      return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-800 dark:text-red-200',
        icon: <XCircle className="w-5 h-5 text-red-600" />,
        title: 'Payment Rejected'
      };
    }
    return null;
  };

  const config = getBannerConfig();
  if (!config) return null;

  return (
    <div className={`${config.bg} border-l-4 ${config.border} p-4 mb-6 rounded-r-lg`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {config.icon}
        </div>
        <div className="flex-1">
          <h4 className={`font-semibold ${config.text} mb-1`}>
            {config.title}
          </h4>
          <p className={`text-sm ${config.text} opacity-90`}>
            {statusMessage}
          </p>
          {(isPending || isRejected) && (
            <button
              onClick={() => setIsStatusModalOpen(true)}
              className="mt-2 text-sm font-medium text-yellow-800 dark:text-yellow-200 hover:underline flex items-center gap-1"
            >
              Check Subscription Status
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Subscription Status Modal */}
      <SubscriptionStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
      />
    </div>
  );
};

