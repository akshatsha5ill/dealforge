import { useState, useEffect, useCallback } from 'react';
import { Mail, ChevronDown, ChevronRight, Edit3, Save, Send, PenLine, Users, CheckCircle, XCircle, Link2, Loader } from 'lucide-react';
import { EmailDraft } from '../../types';
import { getMeetings, getDrafts, getDraftsByMeeting, updateDraft, markSent, saveDrafts, DraftMeeting } from '../../services/email-drafts';
import { sendEmail } from '../../services/ai/ai-service';
import { getEmailIntegrationStatus, startEmailOAuth, IntegrationInfo, EmailProvider } from '../../services/email-integration';
import { apiClient } from '../../services/api/client';
import { useStore } from '../../store';

interface GenerateResponse {
  drafts: Array<{ attendeeEmail: string; attendeeName: string; subject: string; body: string }>;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function EmailDraftsPage() {
  const openAiKey = useStore((state) => state.openAiKey);
  const [meetings, setMeetings] = useState<DraftMeeting[]>([]);
  const [draftsByMeeting, setDraftsByMeeting] = useState<Record<string, EmailDraft[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [sending, setSending] = useState<{ id: string; provider: EmailProvider } | null>(null);
  const [sendProviders, setSendProviders] = useState<Record<string, EmailProvider>>({});
  const [sendErrors, setSendErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genTopic, setGenTopic] = useState('');
  const [genTranscript, setGenTranscript] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [connecting, setConnecting] = useState<EmailProvider | null>(null);

  const load = useCallback(async () => {
    try {
      const [meetingList, allDrafts] = await Promise.all([getMeetings(), getDrafts()]);
      setMeetings(meetingList);
      const grouped: Record<string, EmailDraft[]> = {};
      for (const m of meetingList) {
        grouped[m.meetingId] = allDrafts.filter((d) => d.meetingId === m.meetingId);
      }
      setDraftsByMeeting(grouped);
      setExpanded((prev) => {
        const next = { ...prev };
        if (meetingList.length > 0 && !Object.prototype.hasOwnProperty.call(next, meetingList[0].meetingId)) {
          next[meetingList[0].meetingId] = true;
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to load drafts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    getEmailIntegrationStatus()
      .then((res) => setIntegrations(res.integrations))
      .catch(() => setIntegrations([]));
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth_success') === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname);
      getEmailIntegrationStatus()
        .then((res) => setIntegrations(res.integrations))
        .catch(() => setIntegrations([]));
    }
  }, []);

  const refreshMeeting = async (meetingId: string) => {
    const drafts = await getDraftsByMeeting(meetingId);
    setDraftsByMeeting((prev) => ({ ...prev, [meetingId]: drafts }));
    const meetingList = await getMeetings();
    setMeetings(meetingList);
  };

  const connectedProviders = integrations.filter((i) => i.connected).map((i) => i.provider);

  const startEdit = (draft: EmailDraft) => {
    setEditingId(draft.id);
    setEditSubject(draft.subject);
    setEditBody(draft.body);
    setSendErrors((prev) => ({ ...prev, [draft.id]: '' }));
  };

  const saveEdit = async (draft: EmailDraft) => {
    try {
      await updateDraft(draft.id, { subject: editSubject.trim(), body: editBody });
      setEditingId(null);
      await refreshMeeting(draft.meetingId);
    } catch (err) {
      setSendErrors((prev) => ({ ...prev, [draft.id]: err instanceof Error ? err.message : 'Failed to save draft' }));
    }
  };

  const handleSend = async (draft: EmailDraft, provider: EmailProvider) => {
    setSending({ id: draft.id, provider });
    setSendErrors((prev) => ({ ...prev, [draft.id]: '' }));
    try {
      await sendEmail(draft.email, draft.subject, draft.body, '', undefined, provider);
      await markSent(draft.id);
      await refreshMeeting(draft.meetingId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send email';
      setSendErrors((prev) => ({ ...prev, [draft.id]: msg }));
      await updateDraft(draft.id, { status: 'error', error: msg });
    } finally {
      setSending(null);
    }
  };

  const connectProvider = async (provider: EmailProvider) => {
    setConnecting(provider);
    try {
      const { url } = await startEmailOAuth(provider, window.location.href);
      window.location.href = url;
    } catch (err) {
      setSendErrors((prev) => ({ ...prev, connect: err instanceof Error ? err.message : 'Failed to start email connection' }));
      setConnecting(null);
    }
  };

  const parseAttendees = (text: string): { email: string; name: string; questions: string[] }[] => {
    const seen = new Set<string>();
    const attendees: { email: string; name: string; questions: string[] }[] = [];
    const emailRe = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
    const lines = text.split('\n');
    for (const line of lines) {
      const match = line.match(emailRe);
      if (!match) continue;
      const email = match[0];
      if (seen.has(email)) continue;
      seen.add(email);
      const local = email.split('@')[0];
      const name = local.charAt(0).toUpperCase() + local.slice(1).replace(/[._-]+/g, ' ');
      const questionMatch = line.match(/:\s*(.+)|-\s*(.+)|—\s*(.+)/);
      const questions = questionMatch ? [questionMatch[1] || questionMatch[2] || questionMatch[3]].filter(Boolean) : [];
      attendees.push({ email, name, questions });
    }
    return attendees;
  };

  const generateDrafts = async () => {
    setGenerating(true);
    setGenError('');
    try {
      const attendees = parseAttendees(genTranscript);
      if (attendees.length === 0) {
        setGenError('No email addresses found in the pasted transcript.');
        return;
      }
      const meetingId = `manual-${Date.now()}`;
      const res = await apiClient.post<GenerateResponse>('/chatbot/generate-followups', {
        sessionId: meetingId,
        attendees,
        meetingTopic: genTopic || 'Webinar',
        companyName: 'our company',
        apiKey: openAiKey,
      });
      const now = new Date().toISOString();
      const drafts: EmailDraft[] = (res.drafts || []).map((d, i) => ({
        id: `${meetingId}-${i}`,
        meetingId,
        meetingTopic: genTopic || 'Webinar',
        email: d.attendeeEmail,
        name: d.attendeeName,
        subject: d.subject,
        body: d.body,
        status: 'draft',
        createdAt: now,
      }));
      if (drafts.length > 0) {
        await saveDrafts(drafts);
      }
      setGenTranscript('');
      setGenTopic('');
      setShowGenerate(false);
      await load();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate drafts. Make sure the server is reachable and you are signed in.');
    } finally {
      setGenerating(false);
    }
  };

  const totalEmails = Object.values(draftsByMeeting).reduce((sum, list) => sum + list.length, 0);

  if (loading) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center', padding: '80px', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>Follow-up Emails</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Review AI-drafted follow-ups for each attendee and send them from your inbox.
        </p>
      </div>

      <button
        onClick={() => setShowGenerate((s) => !s)}
        className="ds-btn-ghost"
        style={{ marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border)' }}
      >
        <PenLine size={14} /> Generate drafts from pasted transcript
      </button>

      {showGenerate && (
        <div className="ds-panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Generate drafts from pasted transcript</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              className="ds-input"
              type="text"
              placeholder="Meeting topic (e.g. Q3 Product Demo)"
              value={genTopic}
              onChange={(e) => setGenTopic(e.target.value)}
            />
            <textarea
              className="ds-input"
              rows={6}
              placeholder={'Paste transcript or Q&A text containing attendee emails (e.g. "sarah@techcorp.com: What does pricing include?")'}
              value={genTranscript}
              onChange={(e) => setGenTranscript(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
            />
            {genError && (
              <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)', fontSize: '13px' }}>
                {genError}
              </div>
            )}
            <div>
              <button onClick={generateDrafts} disabled={generating || !genTranscript.trim()} className="ds-btn-primary">
                {generating ? <Loader size={14} /> : <Send size={14} />} {generating ? 'Generating...' : 'Generate Drafts'}
              </button>
            </div>
          </div>
        </div>
      )}

      {meetings.length === 0 ? (
        <div className="ds-panel" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <Mail size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500 }}>
            No follow-up drafts yet — run a live meeting with the AI chatbot to generate them.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {meetings.map((m) => (
            <div key={m.meetingId} className="ds-panel" style={{ padding: '0', overflow: 'hidden' }}>
              <div
                onClick={() => setExpanded((prev) => ({ ...prev, [m.meetingId]: !prev[m.meetingId] }))}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 24px', cursor: 'pointer' }}
              >
                {expanded[m.meetingId] ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>{m.meetingTopic || 'Untitled meeting'}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    {formatDate(m.createdAt)} - {m.count} {m.count === 1 ? 'email' : 'emails'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <Users size={14} /> {m.count} attendee{m.count === 1 ? '' : 's'}
                </div>
              </div>

              {expanded[m.meetingId] && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {(draftsByMeeting[m.meetingId] || []).map((draft) => (
                    <div key={draft.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '18px', backgroundColor: 'var(--bg-secondary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '12px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{draft.email}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{draft.name}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {draft.status === 'sent' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500, backgroundColor: 'rgba(34, 197, 94, 0.12)', color: 'var(--success)' }}>
                              <CheckCircle size={13} /> Sent{draft.sentAt ? ` ${formatDate(draft.sentAt)}` : ''}
                            </span>
                          )}
                          {draft.status === 'error' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500, backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)' }}>
                              <XCircle size={13} /> Error
                            </span>
                          )}
                          {editingId !== draft.id && draft.status !== 'sent' && (
                            <button onClick={() => startEdit(draft)} className="ds-btn-ghost" style={{ border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <Edit3 size={13} /> Edit
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input
                          className="ds-input"
                          type="text"
                          value={editingId === draft.id ? editSubject : draft.subject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          disabled={editingId !== draft.id}
                          placeholder="Subject"
                          style={{ padding: '10px 14px', fontSize: '14px', fontWeight: 500 }}
                        />
                        <textarea
                          className="ds-input"
                          rows={5}
                          value={editingId === draft.id ? editBody : draft.body}
                          onChange={(e) => setEditBody(e.target.value)}
                          disabled={editingId !== draft.id}
                          placeholder="Email body"
                          style={{ resize: 'vertical', fontSize: '13px', lineHeight: 1.6 }}
                        />
                      </div>

                      {editingId === draft.id && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                          <button onClick={() => saveEdit(draft)} className="ds-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Save size={14} /> Save
                          </button>
                          <button onClick={() => { setEditingId(null); setSendErrors((prev) => ({ ...prev, [draft.id]: '' })); }} className="ds-btn-ghost" style={{ border: '1px solid var(--border)' }}>
                            Cancel
                          </button>
                          {(editSubject !== draft.subject || editBody !== draft.body) && (
                            <span style={{ fontSize: '12px', color: 'var(--warning)' }}>Unsaved changes</span>
                          )}
                        </div>
                      )}

                      {(sendErrors[draft.id] || draft.error) && (
                        <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)', fontSize: '13px' }}>
                          {sendErrors[draft.id] || draft.error}
                        </div>
                      )}

                      {draft.status !== 'sent' && (
                        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          {connectedProviders.length > 0 ? (
                            <>
                              <select
                                className="ds-input"
                                style={{ width: '200px', padding: '8px 12px' }}
                                value={sendProviders[draft.id] || connectedProviders[0]}
                                onChange={(e) => setSendProviders((prev) => ({ ...prev, [draft.id]: e.target.value as EmailProvider }))}
                              >
                                {connectedProviders.map((p) => (
                                  <option key={p} value={p}>Send via {p === 'gmail' ? 'Gmail' : 'Outlook'}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleSend(draft, sendProviders[draft.id] || connectedProviders[0])}
                                disabled={sending !== null}
                                className="ds-btn-primary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                {sending?.id === draft.id ? <Loader size={14} /> : <Send size={14} />}
                                {sending?.id === draft.id ? 'Sending...' : `Send via ${(sendProviders[draft.id] || connectedProviders[0]) === 'gmail' ? 'Gmail' : 'Outlook'}`}
                              </button>
                            </>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Connect an email provider to send follow-ups:</span>
                              {(['gmail', 'outlook'] as EmailProvider[]).map((p) => (
                                <button
                                  key={p}
                                  onClick={() => connectProvider(p)}
                                  disabled={connecting !== null}
                                  className="ds-btn-ghost"
                                  style={{ border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                >
                                  <Link2 size={13} /> {connecting === p ? 'Redirecting...' : `Connect ${p === 'gmail' ? 'Gmail' : 'Outlook'}`}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {(draftsByMeeting[m.meetingId] || []).length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No drafts for this meeting.
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {sendErrors.connect && (
            <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)', fontSize: '13px' }}>
              {sendErrors.connect}
            </div>
          )}
        </div>
      )}

      {meetings.length > 0 && (
        <div style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
          {totalEmails} total {totalEmails === 1 ? 'draft' : 'drafts'} across {meetings.length} {meetings.length === 1 ? 'meeting' : 'meetings'}
        </div>
      )}
    </div>
  );
}
