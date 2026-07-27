import React from 'react';
import { Send, Trash2, Pause, Play } from 'lucide-react';
import { EmailCampaign } from '../../types';
import './Email.css';

interface StatusConfig {
  color: string;
  bg: string;
  icon: typeof Send;
  label: string;
}

interface EmailCampaignCardProps {
  campaign: EmailCampaign & { isDrip?: boolean; rawStatus?: string };
  statusConfig: Record<string, StatusConfig>;
  getLeadName: (id: string) => string;
  getLeadEmail: (id: string) => string;
  handleSendDraft: (campaign: EmailCampaign) => void;
  handleDelete: (id: string) => void;
  handleToggleDripStatus?: (id: string, newStatus: string) => void;
}

export const EmailCampaignCard: React.FC<EmailCampaignCardProps> = ({
  campaign,
  statusConfig,
  getLeadName,
  getLeadEmail,
  handleSendDraft,
  handleDelete,
  handleToggleDripStatus,
}) => {
  const status = statusConfig[campaign.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  const dateText = campaign.sentAt
    ? new Date(campaign.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : campaign.scheduledAt
    ? `Scheduled: ${new Date(campaign.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : campaign.createdAt
    ? new Date(campaign.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';

  return (
    <div className="ds-panel campaign-card">
      <div className="status-icon-wrapper" style={{ backgroundColor: status.bg }}>
        <StatusIcon size={18} style={{ color: status.color }} />
      </div>

      <div className="campaign-content">
        <div className="campaign-title-row">
          <h4 className="campaign-subject">{campaign.subject || 'Untitled'}</h4>
          <span
            className="campaign-badge"
            style={{ backgroundColor: status.bg, color: status.color }}
          >
            {status.label}
          </span>
        </div>
        <div className="campaign-lead-info">
          <span>
            To: <strong className="campaign-lead-name">{getLeadName(campaign.leadId)}</strong>
          </span>
          <span>{getLeadEmail(campaign.leadId)}</span>
        </div>
      </div>

      <div className="campaign-actions">
        <div className="campaign-date">{dateText}</div>
        <div className="action-btn-group">
          {campaign.status === 'draft' && (
            <>
              <button
                className="send-btn"
                onClick={() => handleSendDraft(campaign)}
              >
                <Send size={12} /> Send
              </button>
              <button
                className="btn-danger"
                style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', backgroundColor: 'transparent', border: '1px solid var(--danger)', borderRadius: '6px', color: 'var(--danger)', cursor: 'pointer' }}
                onClick={() => handleDelete(campaign.id)}
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
          {campaign.isDrip && campaign.rawStatus !== 'completed' && handleToggleDripStatus && (
            <button
              onClick={() => handleToggleDripStatus(campaign.id, campaign.rawStatus === 'active' ? 'paused' : 'active')}
              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
            >
              {campaign.rawStatus === 'active' ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Resume</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
