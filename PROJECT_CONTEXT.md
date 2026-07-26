# Project Context: DealForge 🔥

## Current State
- **Phase 1-4 Complete**: Most UI, logic, database schemas, and AI integration have been scaffolded and implemented.
- **Completed Fixes (2026-07-26)**:
  - Fixed runtime crashes in `AnalyticsPage.tsx` (missing `useMemo`) and `LeadsPage.tsx` (missing `apiClient`).
  - Added 7 missing CSS design tokens to `client/src/index.css` (fixed broken styling on 8/14 pages).
  - Made Stripe billing optional in `server/src/routes/billing.ts` (returns 503 when unconfigured).
  - Fixed Firebase Admin credential handling (`GOOGLE_APPLICATION_CREDENTIALS` or individual env vars).
  - Fixed Buffer Service Firestore doc size bomb: moved to per-key documents in `buffer_backups` collection.
  - Fixed destructive `GET /events` endpoint: now read-only; added `DELETE /events` for explicit acknowledgment.
  - Replaced hardcoded Vercel URLs in `zoom-manifest.json` with `DEALFORGE_DOMAIN` placeholder.
  - Added missing `SESSION_SECRET` and `EMAIL_FROM` env vars to `render.yaml`.
  - Created `.github/workflows/deploy.yml` for Render deploy hooks.
- **Previously Completed Fixes**:
  - ESM/CJS mismatch fixed in `server/tsconfig.json`.
  - Deployment `startCommand` and Stripe env vars verified in `render.yaml`.
  - `docker-compose.yml` updated for correct build contexts.
  - `vite.config.ts` test paths confirmed accurate.
  - Landing page updated with assertive email capture form.

## Remaining Open Issues
- Missing real `.env` credentials (Firebase, Zoom, Stripe, Resend, AI provider keys).
- `zoom-manifest.json` needs `DEALFORGE_DOMAIN` replaced with actual Render domain.
- Pre-existing TypeScript errors across server codebase (`admin.firestore()` typing, `import.meta`, etc.).
- Zoom real-time transcription not wired (no client code captures Zoom captions).
- Gmail/Outlook OAuth buttons are non-functional placeholders.
- Design system inconsistencies: fonts (Inter vs Fraunces/Newsreader), `border-radius` usage.
- GitHub secrets needed: `RENDER_SERVER_DEPLOY_HOOK`, `RENDER_CLIENT_DEPLOY_HOOK`.

## Next Steps
1. Populate real `.env` credentials and replace `DEALFORGE_DOMAIN` in `zoom-manifest.json`.
2. Fix pre-existing TypeScript errors across server codebase.
3. Validate and submit Zoom Marketplace application.
4. Wire up Gmail/Outlook OAuth flows.
5. Resolve design system font and spacing inconsistencies.
