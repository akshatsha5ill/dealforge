import { ReactNode } from 'react';
import { useStore } from '../../store';
import { canUseFeature, FeatureKey } from '../../services/feature-gate';
import UpgradePrompt from './UpgradePrompt';

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  description?: string;
  compact?: boolean;
}

export default function FeatureGate({ feature, children, description, compact }: FeatureGateProps) {
  const plan = useStore((state) => state.subscription?.plan);

  if (canUseFeature(plan, feature)) {
    return <>{children}</>;
  }

  return <UpgradePrompt feature={feature} description={description} compact={compact} />;
}
