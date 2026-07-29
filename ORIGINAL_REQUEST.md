# Original User Request

## 2026-07-29T17:14:49Z

<USER_REQUEST>
# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Fix a failing test in `server/src/routes/zoom.test.ts` where the test expects a 500 error but receives a 401, due to configuration state pollution.

Working directory: /home/akshat/vigilant-goggles
Integrity mode: development

## Requirements

### R1. Fix Test State Pollution
The test "should return 500 if webhook secret is not configured" currently fails. The root cause is that `config.zoom.webhookSecretToken` is loaded during module initialization and isn't cleared when `process.env.ZOOM_WEBHOOK_SECRET_TOKEN` is deleted in the test. You must fix the test by either clearing `config.zoom.webhookSecretToken` in the test setup or refactoring the configuration loading to be properly isolated for testing.

## Acceptance Criteria

### Test Pass Verification
- [ ] The command `npm test -- server/src/routes/zoom.test.ts` (or equivalent test command for this file) passes successfully.
- [ ] Other tests in the file continue to pass without regression.
</USER_REQUEST>
