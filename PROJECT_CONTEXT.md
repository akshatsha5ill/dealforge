# Project Context — DealForge

## Status
Active development. Zoom Marketplace AI meeting intelligence SaaS.

## Billing — Stripe Removed, Dodo Payments Planned

**All Stripe/billing code has been completely removed from both server and client:**

- `server/.env` — All `STRIPE_*` environment variables deleted
- `server/src/routes/billing.ts` — Removed
- `client/src/pages/dashboard/BillingPage.tsx` — Removed
- `package-lock.json` — Stripe dependency entry remains but is no longer referenced in source

**Replacement:** Dodo Payments will be integrated as the payment/billing provider.

## Completed Work
- Phase 1: MVP & Meeting Intelligence (complete)
- Phase 2: Lead Management & Pipeline (complete)
- Phase 3: Email Outreach (complete)
- Phase 4: Analytics (charts complete, billing replaced by Dodo Payments plan)

## Open Items
- Billing integration via Dodo Payments (pending)
- Zoom Marketplace submission (blocked on real Zoom credentials)
