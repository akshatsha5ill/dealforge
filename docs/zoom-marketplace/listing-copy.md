# App Listing Copy — Zoom Marketplace

Copy-paste ready for the **App Listing** section of the Zoom build flow.

## App Name

> **DealForge AI** (20 chars, under the 50-char limit)

## Short Description

> AI meeting intelligence and sales CRM that keeps your data in your browser. Real-time transcription, lead scoring, pipeline, and email follow-up — with privacy by design.

(2 sentences, describes core value + the differentiator.)

## Long Description

> DealForge turns every Zoom meeting into revenue. It captures live transcription, scores leads in real time, manages your deal pipeline, and drafts AI-powered follow-up emails — all inside the Zoom meeting experience.
>
> **Privacy by design.** Unlike other meeting intelligence tools, DealForge stores your transcripts, AI analyses, leads, and email drafts locally in your browser's IndexedDB. Our backend acts only as a stateless relay — we never see or store your meeting content on our servers. You can even bring your own AI API key (OpenAI, Anthropic, or Gemini) so your data flows directly from your browser to the AI provider you choose.
>
> **Works with Zoom, and without it.** Start analysis from a Zoom meeting, or paste any transcript from Google Meet, Microsoft Teams, or in-person conversations. Same AI analysis either way.
>
> **Key features:**
>
> - **Real-time transcription & live suggestions** — follow the conversation in the in-meeting panel with AI suggestions without switching tabs
> - **Automatic lead scoring** — prospects are scored on BANT signals extracted from the conversation
> - **Deal pipeline management** — drag-and-drop deals through custom stages, all from meeting insights
> - **AI follow-up emails** — automatically draft personalized follow-ups and schedule drip campaigns
> - **Action items & meeting summaries** — every meeting becomes an asset, searchable and exportable
> - **Manual transcript mode** — paste or upload transcripts (.txt/.srt/.vtt) from any source
> - **Multi-provider AI** — OpenAI, Anthropic, or Google Gemini, with your own API keys (BYOK)
> - **Free tier available** — no credit card required to start

## Category & Segment

- **Category**: Sales & Marketing (also matches Productivity/CRM)
- **Segment**: Sales / CRM

## Keywords (for search)

`AI meeting notes`, `meeting transcription`, `sales intelligence`, `CRM`, `lead scoring`, `meeting summary`, `follow-up automation`, `deal pipeline`, `privacy`, `BYOK`

## Company Name

> DealForge

## Developer Contact

> engineering@dealforge.app (monitored — required by Zoom; replace with the real monitored inbox)

## URLs (must be HTTPS, FQDN)

| Field | Value |
|-------|-------|
| Home URL | `https://<your-domain>/` |
| Privacy Policy URL | `https://<your-domain>/privacy` |
| Terms of Use URL | `https://<your-domain>/terms` |
| OAuth Redirect URL | `https://<your-server-domain>/api/zoom/oauth/callback` |
| Webhook Callback URL | `https://<your-server-domain>/api/zoom/webhook` |
| Deauth Notification URL | `https://<your-server-domain>/api/zoom/deauth` |

> The client routes `/privacy`, `/terms`, and `/support` exist (`client/src/pages/landing/`) and are expanded to meet Zoom's data-disclosure requirements (12-section Privacy Policy, 18-section Terms of Service).
