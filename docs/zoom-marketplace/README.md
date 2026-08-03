# Zoom Marketplace Submission Package

Everything needed to submit DealForge to the Zoom App Marketplace. This package covers **3A** of the SaaS Profitability Plan.

## Before You Submit (Pre-Flight)

DealForge must be fully deployed and functional before submission. The Zoom review team will test the live app.

| # | Item | Status | Where |
|---|------|--------|-------|
| 1 | Client deployed to Vercel | TODO | `vercel deploy` (Vercel dashboard) |
| 2 | Server deployed to Render | TODO | Render dashboard |
| 3 | Production env vars set (Zoom OAuth, webhook secret, SESSION_SECRET, Resend, Firebase) | TODO | Render dashboard → Environment |
| 4 | Custom domain or verified Render domain (no default `*.onrender.com` per Zoom policy) | TODO | Domain registrar / Vercel + Render |
| 5 | `ZOOM_VERIFY_TOKEN` set and serving at `/zoomverify/verifyzoom.html` | TODO | Render env; route exists at `server/src/app.ts:155` |
| 6 | OAuth redirect URI registered in Zoom dashboard + allow list | TODO | Zoom App Dashboard → App Credentials |
| 7 | Deauth endpoint registered in Zoom dashboard (`/api/zoom/deauth`) | TODO | Zoom App Dashboard → App Credentials |
| 8 | Webhook endpoint registered (`/api/zoom/webhook`) with `endpoint.url_validation` | TODO | Zoom App Dashboard → Features → Event Subscriptions |
| 9 | Domain validation completed (privacy, terms, redirect, webhook, home URLs) | TODO | Zoom build flow → Domain Validation |
| 10 | `zoom-manifest.json` placeholders replaced with production values | TODO | `zoom-manifest.json` in repo root |
| 11 | Test account created for reviewers (Firebase auth email/password) | TODO | Firebase console → Authentication |
| 12 | Demo video recorded (script below) | TODO | `demo-video-script.md` |
| 13 | Screenshots captured | TODO | `demo-video-script.md` (screenshot list) |

> **Zoom policy notes**: All URLs must use HTTPS with FQDN. Do not use `localhost`, `ngrok`, or default Render domains in production. Review the [Security requirements](https://developers.zoom.us/docs/distribute/security-requirements/) before submitting.

## Package Contents

| File | Purpose |
|------|---------|
| `listing-copy.md` | App name, short/long description, categories, keywords — copy-paste ready |
| `technical-design.md` | Technical Design Document (TDD) for the build flow's Technical Design section |
| `reviewer-test-guide.md` | Step-by-step test plan — paste into "Release notes for app reviewer" |
| `demo-video-script.md` | Shot-by-shot demo video script + screenshot list |

## Submission Workflow

1. Complete all pre-flight items above.
2. Fill the build flow: **App Listing** → copy from `listing-copy.md`.
3. **Features** → enable Event Subscriptions pointing at `/api/zoom/webhook`, register OAuth redirect.
4. **App Credentials** → add deauth endpoint URL, add redirect URIs to allow list, grab Production Client ID/Secret → set `ZOOM_CLIENT_ID`/`ZOOM_CLIENT_SECRET` in Render env.
5. **Technical Design** → paste content from `technical-design.md`.
6. **App Submission** → verify domains, paste `reviewer-test-guide.md` into release notes, add reviewer test account, agree to the Marketplace Developer Agreement, submit.
7. Respond to review notes promptly — check the speech-bubble icon in the app status panel.

## Positioning (Key Message)

DealForge **works great with Zoom, but also works standalone** — users can paste any transcript (Google Meet, Teams, in-person) and get the same AI analysis. This is honest, de-risks Zoom dependency, and differentiates on privacy: meeting data lives in the user's browser (IndexedDB), never on our servers.

**Moat**: Privacy-first, BYOK architecture. Gong, Chorus, and Otter.ai store data on their servers; DealForge doesn't.
