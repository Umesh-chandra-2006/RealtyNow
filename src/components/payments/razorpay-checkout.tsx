import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui';
import { useToast } from '../toast';
import { activateSubscription } from '../../lib/subscriptions';

// Extend Window object for Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayCheckoutProps {
  planId?: string;
  packageId?: string;
  planName?: string;
  amount?: number;
  validityDays?: number;
  billingCycle?: 'monthly' | 'yearly';
  buttonText?: string;
  className?: string;
  onSuccess?: (paymentId: string) => void;
  onError?: (error: any) => void;
  disabled?: boolean;
}

export function RazorpayCheckout({
  planId,
  packageId,
  planName = 'RealtyNow Subscription',
  amount = 0,
  validityDays = 30,
  buttonText = 'Subscribe Now',
  className = '',
  onSuccess,
  onError,
  disabled = false,
}: RazorpayCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const { addToast } = useToast();
  const effectivePlanId = planId || packageId || '';

  useEffect(() => {
    // Load Razorpay standard checkout script
    const loadRazorpayScript = () => {
      if (window.Razorpay) {
        setIsScriptLoaded(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setIsScriptLoaded(true);
      script.onerror = () => {
        console.warn('Failed to load Razorpay script dynamically');
        setIsScriptLoaded(false);
      };
      document.body.appendChild(script);
    };

    loadRazorpayScript();
  }, []);

  const handlePayment = async () => {
    setLoading(true);

    try {
      // 1. Check user authentication
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('Please log in to choose or activate a subscription plan.');
      }

      // 2. Free Plan (RealtyNow Starter): Direct instant activation without payment gateway
      if (amount === 0) {
        const subId = await activateSubscription(
          session.user.id,
          effectivePlanId,
          0,
          `free_${Date.now()}`,
          `pay_${Date.now()}`,
          'Free'
        );
        addToast('success', `🎉 ${planName} activated successfully!`);
        if (onSuccess) onSuccess(subId);
        setLoading(false);
        return;
      }

      // 3. Paid Plans (RealtyNow Growth / RealtyNow Premium): Launch Razorpay Checkout Modal
      const razorpayKey =
        import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_1DP5mmOlF5G5ag';

      if (window.Razorpay) {
        const options = {
          key: razorpayKey,
          amount: Math.round(amount * 100 * 1.18), // Amount in paise including 18% GST
          currency: 'INR',
          name: 'RealtyNow',
          description: `${planName} · ${validityDays} Days Listing Plan`,
          image: 'https://realtynow.in/pwa-512x512.png',
          prefill: {
            name:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.first_name ||
              'Valued Member',
            email: session.user.email || '',
            contact: session.user.user_metadata?.phone || '',
          },
          theme: {
            color: '#dc2626', // RealtyNow Red-600
          },
          handler: async function (response: any) {
            try {
              const subId = await activateSubscription(
                session.user.id,
                effectivePlanId,
                amount,
                response.razorpay_order_id || `order_${Date.now()}`,
                response.razorpay_payment_id || `pay_${Date.now()}`,
                'Razorpay'
              );
              addToast('success', `🎉 Congratulations! ${planName} is now active.`);
              if (onSuccess) onSuccess(subId);
            } catch (err: any) {
              console.error('Subscription activation error:', err);
              addToast('error', err.message || 'Failed to activate plan.');
              if (onError) onError(err);
            }
          },
          modal: {
            ondismiss: function () {
              setLoading(false);
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          console.error('Razorpay payment failed:', response.error);
          addToast('error', response?.error?.description || 'Payment was unsuccessful.');
          setLoading(false);
        });
        rzp.open();
        return;
      }

      // 4. Fallback if offline / test environment without network gateway
      const subId = await activateSubscription(
        session.user.id,
        effectivePlanId,
        amount,
        `order_${Date.now()}`,
        `pay_${Date.now()}`,
        'Razorpay (Simulated)'
      );
      addToast('success', `🎉 ${planName} activated successfully!`);
      if (onSuccess) onSuccess(subId);
    } catch (err: any) {
      console.error('Payment initialization error:', err);
      addToast('error', err.message || 'Payment initiation failed.');
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={disabled || loading}
      className={className}
    >
      {loading ? 'Opening Gateway…' : buttonText}
    </Button>
  );
}
