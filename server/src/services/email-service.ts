import { Resend } from 'resend';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';

// Sentinel Note: In a production app, the Resend API key would ideally be configured securely
// via env vars or per-user integrations. Using a generic error if not provided.
const sendDraft = async (to: string, subject: string, body: string, { apiKey = config.email.resendApiKey, from = config.email.from } = {}) => {
  if (!apiKey) {
    throw new AppError('Resend API Key is missing.', 400);
  }
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: subject,
    html: body,
  });

  if (error) {
    throw new AppError(error.message, 500);
  }
  return data;
};

const sendViaGmail = async (accessToken: string, to: string, subject: string, body: string) => {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: Buffer.from(message, 'utf8').toString('base64url') }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new AppError(`Gmail send failed: ${detail || res.statusText}`, 500);
  }
  return { id: (await res.json() as { id: string }).id, via: 'gmail' };
};

const sendViaOutlook = async (accessToken: string, to: string, subject: string, body: string) => {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new AppError(`Outlook send failed: ${detail || res.statusText}`, 500);
  }
  return { id: `outlook-${Date.now()}`, via: 'outlook' };
};

export { sendDraft, sendViaGmail, sendViaOutlook };
