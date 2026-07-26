import { db } from '../services/local-db/db';

export interface Stage {
  id: string;
  label: string;
  color: string;
}

export const DEFAULT_STAGES: Stage[] = [
  { id: 'lead_identified', label: 'Lead Identified', color: 'var(--accent-primary)' },
  { id: 'qualified', label: 'Qualified', color: '#6366f1' },
  { id: 'proposal', label: 'Proposal', color: 'var(--warning)' },
  { id: 'negotiation', label: 'Negotiation', color: '#f97316' },
  { id: 'closed_won', label: 'Closed Won', color: 'var(--success)' },
  { id: 'closed_lost', label: 'Closed Lost', color: 'var(--danger)' },
];

export async function getPipelineStages(): Promise<Stage[]> {
  try {
    const setting = await db.settings.get('pipeline_stages');
    if (setting && Array.isArray(setting.value)) {
      return setting.value;
    }
  } catch (err) {
    console.error('Failed to get pipeline stages', err);
  }
  return DEFAULT_STAGES;
}

export async function savePipelineStages(stages: Stage[]) {
  await db.settings.put({ key: 'pipeline_stages', value: stages });
}
