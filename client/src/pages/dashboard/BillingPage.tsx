import { useState, useEffect } from 'react';
import { CreditCard, Check, Zap, Crown } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { PLAN_CONFIGS, SubscriptionPlan } from '../../types/billing';
import { toast } from '../../components/common/Toast';
import styles from './BillingPage.module.css';

interface Subscription {
  plan: SubscriptionPlan;
  status: string;
  currentPeriodEnd: string | null;
  customerId: string | null;
  subscriptionId: string | null;
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const data = await apiClient.get<Subscription>('/billing/subscription');
        setSubscription(data);
      } catch (err) {
        console.error('Failed to fetch subscription:', err);
        setSubscription({
          plan: 'free',
          status: 'active',
          currentPeriodEnd: null,
          customerId: null,
          subscriptionId: null,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchSubscription();
  }, []);

  const handleCheckout = async (plan: SubscriptionPlan) => {
    if (plan === 'free') return;
    setCheckoutLoading(plan);
    try {
      const response = await apiClient.post<{ checkout_url: string }>('/billing/checkout', { plan });
      if (response.checkout_url) {
        window.location.href = response.checkout_url;
      }
    } catch (err) {
      console.error('Checkout failed:', err);
      toast.error('Failed to start checkout. Please try again.');
      setCheckoutLoading(null);
    }
  };

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      await apiClient.post('/billing/cancel');
      setSubscription((prev) => prev ? { ...prev, status: 'cancelled' } : prev);
      toast.success('Subscription cancelled. It will remain active until the end of the billing period.');
    } catch (err) {
      console.error('Cancel failed:', err);
      toast.error('Failed to cancel subscription. Please try again.');
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className={styles.loading}>Loading subscription...</div>
      </div>
    );
  }

  const currentPlan = subscription?.plan || 'free';
  const planConfig = PLAN_CONFIGS[currentPlan];

  return (
    <div className="animate-fade-in">
      <div className={styles.billingContainer}>
        <h1 className={styles.billingTitle}>Billing</h1>
        <p className={styles.billingSubtitle}>Manage your subscription and plan details.</p>
      </div>

      <div className={`ds-panel ${styles.currentPlan}`}>
        <div className={styles.currentPlanHeader}>
          <span className={styles.currentPlanName}>Current Plan</span>
          <span className={`${styles.statusBadge} ${styles[subscription?.status || 'active']}`}>
            {subscription?.status || 'active'}
          </span>
        </div>
        <div className={styles.planDetails}>
          <div>
            <div className={styles.planPrice}>{planConfig.priceLabel}</div>
            <div className={styles.planPeriod}>per month</div>
          </div>
          {subscription?.currentPeriodEnd && (
            <div className={styles.planRenewal}>
              {subscription.status === 'cancelled'
                ? `Expires ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                : `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
            </div>
          )}
        </div>
      </div>

      <div className={styles.plansSection}>
        <h2 className={styles.plansSectionTitle}>Available Plans</h2>
        <div className={styles.plansGrid}>
          {(Object.entries(PLAN_CONFIGS) as [SubscriptionPlan, typeof planConfig][]).map(([key, plan]) => {
            const isCurrent = key === currentPlan;
            const isUpgrade = key !== 'free' && PLAN_CONFIGS[key].price > PLAN_CONFIGS[currentPlan].price;
            const isDowngrade = key !== 'free' && PLAN_CONFIGS[key].price < PLAN_CONFIGS[currentPlan].price;
            const planIcon = key === 'enterprise' ? Crown : Zap;

            return (
              <div key={key} className={`${styles.planCard} ${isCurrent ? styles.current : ''}`}>
                <div className={styles.planCardHeader}>
                  {isCurrent && <div className={styles.currentLabel}>Current Plan</div>}
                  <div className={styles.planCardName}>{plan.name}</div>
                  <div className={styles.planCardPrice}>
                    {plan.priceLabel}
                    <span className={styles.planCardPeriod}>/mo</span>
                  </div>
                </div>
                <ul className={styles.planCardFeatures}>
                  {plan.features.map((feature) => (
                    <li key={feature} className={styles.planCardFeature}>
                      <Check size={14} style={{ color: 'var(--tertiary)', flexShrink: 0 }} />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <button className={`${styles.planCardButton} ${styles.primary}`} disabled>
                    Current Plan
                  </button>
                ) : key === 'free' ? (
                  <button className={styles.planCardButton} disabled>
                    Free Forever
                  </button>
                ) : isUpgrade || currentPlan === 'free' ? (
                  <button
                    className={`${styles.planCardButton} ${styles.primary}`}
                    onClick={() => handleCheckout(key)}
                    disabled={checkoutLoading !== null}
                  >
                    {checkoutLoading === key ? 'Redirecting...' : 'Upgrade'}
                  </button>
                ) : isDowngrade ? (
                  <button
                    className={styles.planCardButton}
                    disabled
                  >
                    Downgrade
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {currentPlan !== 'free' && subscription?.status === 'active' && (
        <div className={`ds-panel ${styles.cancelSection}`}>
          <h3 className={styles.cancelSectionTitle}>Cancel Subscription</h3>
          <p className={styles.cancelDescription}>
            Your subscription will remain active until the end of the current billing period.
            You will not be charged again after cancellation.
          </p>
          <button
            className={styles.cancelButton}
            onClick={handleCancel}
            disabled={cancelLoading}
          >
            {cancelLoading ? 'Cancelling...' : 'Cancel Subscription'}
          </button>
        </div>
      )}
    </div>
  );
}
