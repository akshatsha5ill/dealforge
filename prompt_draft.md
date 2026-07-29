# Teamwork Project Prompt — Draft

> Status: Step 9 — Assembling and validating
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Fix linting issues in a React/TypeScript codebase for production code quality.

Working directory: /home/akshat/vigilant-goggles
Integrity mode: development

## Requirements

### R1. Remove unused imports
Remove the following unused imports from the specified files:
- EmailIntegrationSettings.tsx: AlertCircle
- LandingPage.tsx: ArrowRight, Activity, Shield
- App.tsx: verifyPermission
- AnalyticsPage.tsx: Activity, Timer
- LeadDetailPage.tsx: Deal, EmailCampaign, Meeting

### R2. Fix unused variables
Fix unused variable warnings in CookieConsent.tsx by removing the unused consented destructure.

### R3. Fix missing hook dependencies
Fix missing hook dependencies in ComposeEmailCard.tsx by adding form.sequence.length and form.sequence to the useEffect dependency array.

## Verification

### Programmatic Verification
Run the project's linter (ESLint or similar) after all fixes are applied. The verification passes if:
- No unused import errors remain in the specified files
- No unused variable warnings remain in CookieConsent.tsx
- No missing hook dependency warnings remain in ComposeEmailCard.tsx

### Verification Commands
The implementing agent should run the project's lint command (e.g., `npm run lint`, `yarn lint`, or equivalent) to verify all fixes are applied correctly.

## Acceptance Criteria

### Linting fixes
- [ ] All unused imports removed from EmailIntegrationSettings.tsx, LandingPage.tsx, App.tsx, AnalyticsPage.tsx, LeadDetailPage.tsx
- [ ] Unused variable warning fixed in CookieConsent.tsx
- [ ] Missing hook dependencies fixed in ComposeEmailCard.tsx
- [ ] Project linter passes with no errors in the specified files
- [ ] No new linting errors introduced by the fixes

---
*Next: when approved → delegate via invoke_subagent (see Delegation Protocol)*
