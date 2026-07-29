## 2026-07-29T23:14:12Z
<USER_REQUEST>
You are teamwork_preview_worker_m3_1, an implementation worker.
Your working directory is: /home/akshat/vigilant-goggles/.agents/teamwork_preview_worker_m3_1

MANDATORY INSTRUCTION: Read the original request file at /home/akshat/vigilant-goggles/.agents/ORIGINAL_REQUEST.md before starting work. Do NOT skip reading this file.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context & Scope:
- Read PROJECT.md at /home/akshat/vigilant-goggles/PROJECT.md
- Read Explorer Analysis report at /home/akshat/vigilant-goggles/.agents/teamwork_preview_explorer_survey_3/analysis.md
- You exclusively own and are modifying the following files:
  - client/src/services/api/client.test.ts
  - client/src/services/drip-worker.test.ts
  - client/src/store/store.test.ts
  - client/src/services/firebase/auth.ts
  - client/src/services/lead-automation.ts
  - client/src/services/local-db/backup.ts
  - client/tsconfig.json
  - client/package.json

Your Objectives:
1. Fix test typings in `client.test.ts`:
   - Annotate implicit any parameters (`data: any`, `statusText: string`, `errorData: any`).
   - Cast `(global.fetch as any).mockResolvedValueOnce(...)` or use `vi.mocked(global.fetch)`.
2. Fix test typings in `drip-worker.test.ts`:
   - Update `sendEmail` expectations and calls to match the 5-argument signature (`lead.email`, `subject`, `body`, `emailApiKey`, `campaignId`).
3. Fix test typings in `store.test.ts`:
   - Replace `loading: false` with `isLoading: false` in `StoreState` mock.
4. Fix remaining service compilation errors in `auth.ts`, `lead-automation.ts`, and `backup.ts` (e.g. `import.meta.env`, Dexie nullability, or missing properties).
5. Add `typecheck` script (`"typecheck": "tsc --noEmit"`) in `client/package.json` and configure `tsconfig.json` as needed.
6. Run `npx tsc --noEmit` in `/home/akshat/vigilant-goggles/client` to verify **0 errors remain across the ENTIRE client repository**.
7. Run `npm test` in `/home/akshat/vigilant-goggles/client` to verify **all test suites pass 100% (32/32 tests pass cleanly)**.
8. Document all changes and write handoff report to `/home/akshat/vigilant-goggles/.agents/teamwork_preview_worker_m3_1/handoff.md`.
9. Send a message to orchestrator when done.
</USER_REQUEST>
