export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';

export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing';

export interface UserSubscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  customerId: string | null;
  subscriptionId: string | null;
}

export interface PlanConfig {
  name: string;
  price: number;
  priceLabel: string;
  features: string[];
  limits: {
    meetingsPerMonth: number | null;
    aiModels: number;
    emailOutreach: boolean;
    pipeline: boolean;
    prioritySupport: boolean;
    customStages: boolean;
    teamFeatures: boolean;
    apiAccess: boolean;
    transcriptHistoryDays: number | null;
  };
  productId: string | null;
}

export const PLAN_CONFIGS: Record<SubscriptionPlan, PlanConfig> = {
  free: {
    name: 'Free',
    price: 0,
    priceLabel: '$0',
    features: [
      '3 meetings/month',
      'Basic meeting summaries',
      '1 AI model',
      '30-day transcript history',
      'Local data storage',
    ],
    limits: {
      meetingsPerMonth: 3,
      aiModels: 1,
      emailOutreach: false,
      pipeline: false,
      prioritySupport: false,
      customStages: false,
      teamFeatures: false,
      apiAccess: false,
      transcriptHistoryDays: 30,
    },
    productId: null,
  },
  pro: {
    name: 'Pro',
    price: 29,
    priceLabel: '$29',
    features: [
      'Unlimited meetings',
      'All AI features',
      'Email outreach',
      'Pipeline management',
      'All AI models',
      'API access',
      'Advanced analytics',
    ],
    limits: {
      meetingsPerMonth: null,
      aiModels: 3,
      emailOutreach: true,
      pipeline: true,
      prioritySupport: false,
      customStages: false,
      teamFeatures: false,
      apiAccess: true,
      transcriptHistoryDays: null,
    },
    productId: null,
  },
  enterprise: {
    name: 'Enterprise',
    price: 79,
    priceLabel: '$79',
    features: [
      'Everything in Pro',
      'Priority support',
      'Custom pipeline stages',
      'Team features',
      'Custom integrations',
      'Dedicated account manager',
    ],
    limits: {
      meetingsPerMonth: null,
      aiModels: 3,
      emailOutreach: true,
      pipeline: true,
      prioritySupport: true,
      customStages: true,
      teamFeatures: true,
      apiAccess: true,
      transcriptHistoryDays: null,
    },
    productId: null,
  },
};
