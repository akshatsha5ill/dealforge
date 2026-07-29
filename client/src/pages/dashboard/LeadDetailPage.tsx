import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { db } from '../../services/local-db/db';
import { Lead } from '../../types';
import { ArrowLeft, Clock, Mail, CheckCircle, Video, Briefcase } from 'lucide-react';

interface TimelineEvent {
  id: string;
  date: Date;
  type: 'meeting' | 'deal' | 'email' | 'creation';
  title: string;
  description: string;
  icon: any;
  color: string;
}

export default function LeadDetailPage() {
  const { id } = useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const leadData = await db.leads.get(id);
        if (!leadData) {
          setLoading(false);
          return;
        }
        setLead(leadData);

        const events: TimelineEvent[] = [];

        // 1. Lead Creation Event
        if (leadData.createdAt) {
          events.push({
            id: 'creation',
            date: new Date(leadData.createdAt),
            type: 'creation',
            title: 'Lead Created',
            description: `Identified via AI analysis. Initial Stage: ${leadData.stage}`,
            icon: CheckCircle,
            color: 'var(--success)',
          });
        }

        // 2. Meeting Event
        if (leadData.meetingId) {
          const meeting = await db.meetings.get(leadData.meetingId);
          if (meeting) {
            events.push({
              id: `meeting_${meeting.id}`,
              date: new Date(meeting.startTime),
              type: 'meeting',
              title: 'Zoom Meeting',
              description: `Attended: ${meeting.title} (${meeting.duration} min)`,
              icon: Video,
              color: 'var(--accent-primary)',
            });
          }
        }

        // 3. Deals
        const deals = await db.deals.where('leadId').equals(id).toArray();
        for (const deal of deals) {
          if (deal.createdAt) {
            events.push({
              id: `deal_${deal.id}`,
              date: new Date(deal.createdAt),
              type: 'deal',
              title: 'Deal Pipeline Activity',
              description: `Added to Pipeline: ${deal.title} ($${deal.value}) in stage "${deal.stage}"`,
              icon: Briefcase,
              color: 'var(--warning)',
            });
          }
        }

        // 4. Emails
        const emails = await db.email_campaigns.where('leadId').equals(id).toArray();
        for (const email of emails) {
          if (email.createdAt || email.scheduledAt) {
            events.push({
              id: `email_${email.id}`,
              date: new Date(email.sentAt || email.scheduledAt || email.createdAt || Date.now()),
              type: 'email',
              title: 'Email Sequence',
              description: `Subject: "${email.subject}" - Status: ${email.status}`,
              icon: Mail,
              color: '#06b6d4',
            });
          }
        }

        events.sort((a, b) => b.date.getTime() - a.date.getTime());
        setTimeline(events);
      } catch (err) {
        console.error('Failed to load lead details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading lead details...
      </div>
    );
  }

  if (!lead) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Lead not found.
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--success)';
    if (score >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <Link to="/dashboard/leads" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500 }}>
          <ArrowLeft size={16} /> Back to Leads
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Sidebar: Lead Profile */}
        <div className="ds-panel" style={{ padding: '24px', position: 'sticky', top: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', fontWeight: 700 }}>
              {lead.name.charAt(0)}
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>{lead.name}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>{lead.role} at {lead.company}</p>
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Lead Score</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="data-text" style={{ fontSize: '24px', fontWeight: 700, color: getScoreColor(lead.score) }}>{lead.score}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Current Stage</div>
              <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, backgroundColor: 'var(--accent-primary)', color: '#fff' }}>{lead.stage}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Email Address</div>
              <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{lead.email || '—'}</div>
            </div>
            {lead.reasoning && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>AI Score Reasoning</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5, padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', borderLeft: `2px solid ${getScoreColor(lead.score)}` }}>
                  "{lead.reasoning}"
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Content: Activity Timeline */}
        <div className="ds-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} style={{ color: 'var(--accent-primary)' }} />
            Activity Timeline
          </h2>
          
          {timeline.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No activity recorded for this lead.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {timeline.map((event, index) => {
                const Icon = event.icon;
                return (
                  <div key={event.id} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                    {index !== timeline.length - 1 && (
                      <div style={{ position: 'absolute', left: '19px', top: '40px', bottom: '-20px', width: '2px', backgroundColor: 'var(--border)' }} />
                    )}
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: `${event.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1, border: `1px solid ${event.color}30` }}>
                      <Icon size={18} style={{ color: event.color }} />
                    </div>
                    <div style={{ flex: 1, paddingBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>{event.title}</h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {event.date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                        {event.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
