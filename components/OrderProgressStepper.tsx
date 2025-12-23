/**
 * Order Progress Stepper Component
 * Shows order progress: Payment Pending → Verifying → Preparing → Out for Delivery → Delivered
 */

import React from 'react';
import { CheckCircle, Clock, Package, Truck, CheckCircle2, Loader2 } from 'lucide-react';
import { Order, PaymentStatus } from '../types';

interface OrderProgressStepperProps {
  order: Order;
}

type ProgressStep = {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: 'completed' | 'current' | 'pending';
};

export const OrderProgressStepper: React.FC<OrderProgressStepperProps> = ({ order }) => {
  const getProgressSteps = (): ProgressStep[] => {
    const steps: ProgressStep[] = [
      {
        id: 'payment',
        label: 'Payment Pending',
        icon: <Clock className="w-5 h-5" />,
        status: 'pending'
      },
      {
        id: 'verifying',
        label: 'Verifying',
        icon: <Loader2 className="w-5 h-5" />,
        status: 'pending'
      },
      {
        id: 'preparing',
        label: 'Preparing',
        icon: <Package className="w-5 h-5" />,
        status: 'pending'
      },
      {
        id: 'out-for-delivery',
        label: 'Out for Delivery',
        icon: <Truck className="w-5 h-5" />,
        status: 'pending'
      },
      {
        id: 'delivered',
        label: 'Delivered',
        icon: <CheckCircle2 className="w-5 h-5" />,
        status: 'pending'
      }
    ];

    // Determine current step based on order status
    const paymentStatus = order.paymentStatus || 'PENDING';
    
    if (paymentStatus === 'PENDING_VERIFICATION' || paymentStatus === 'PENDING') {
      if (order.status === 'Pending') {
        steps[0].status = 'current'; // Payment Pending
      } else {
        steps[0].status = 'completed';
        steps[1].status = 'current'; // Verifying
      }
    } else if (paymentStatus === 'PAID' && order.status === 'Processing') {
      steps[0].status = 'completed'; // Payment done
      steps[1].status = 'completed'; // Verification done
      steps[2].status = 'current'; // Preparing
    } else if (order.status === 'In Transit' || order.status === 'DISPATCHED') {
      steps[0].status = 'completed';
      steps[1].status = 'completed';
      steps[2].status = 'completed';
      steps[3].status = 'current'; // Out for Delivery
    } else if (order.status === 'Delivered') {
      steps.forEach(step => {
        step.status = 'completed';
      });
    }

    return steps;
  };

  const steps = getProgressSteps();

  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        {/* Connection Lines */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-neutral-200 dark:bg-neutral-700 -z-10">
          <div 
            className="h-full bg-orange-600 transition-all duration-500"
            style={{ 
              width: `${(steps.filter(s => s.status === 'completed').length / (steps.length - 1)) * 100}%` 
            }}
          />
        </div>

        {/* Steps */}
        {steps.map((step, index) => (
          <div key={step.id} className="flex flex-col items-center flex-1 relative z-10">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                step.status === 'completed'
                  ? 'bg-orange-600 border-orange-600 text-white'
                  : step.status === 'current'
                  ? 'bg-orange-100 dark:bg-orange-900/20 border-orange-600 text-orange-600 animate-pulse'
                  : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-400'
              }`}
            >
              {step.status === 'completed' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                step.icon
              )}
            </div>
            <div className="mt-2 text-center">
              <p
                className={`text-xs font-medium ${
                  step.status === 'completed'
                    ? 'text-orange-600 dark:text-orange-400'
                    : step.status === 'current'
                    ? 'text-orange-600 dark:text-orange-400 font-bold'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {step.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

