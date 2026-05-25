# Project review findings

Date: 2026-05-25

## Summary

The project has a solid overall structure. The separation between `src/app`, `src/features`, `src/components`, `src/electron`, and `src/shared` is clear, and the Electron main/renderer boundary is mostly well handled.

Main improvement areas:

- Long-lived job/process cleanup
- IPC validation hardening
- Electron security hardening
- Reducing responsibilities in large coordinator components/hooks
- Improving safety around AI-generated review publishing

Tests checked:

```sh
pnpm test
```

Result: 3 test files passed, 14 tests passed.

## Findings

### 1. Review generation jobs can grow forever

File: `src/electron/services/review-generation-jobs.ts`

Completed and failed jobs are kept in a process-level `Map` and are never evicted. Since the key includes PR/head SHA, this can grow for the full app session.

Recommendation:

- Add TTL cleanup for completed/failed jobs.
- Optionally keep only the latest N jobs.
- Clear timers defensively when jobs finish.

Severity: medium  
Area: performance / memory safety

---

### 2. Child processes need stronger timeout cleanup

File: `src/electron/process.ts`

On timeout, the direct child process is killed, but descendant processes may survive if the CLI agent spawns subprocesses.

Recommendation:

- Consider detached process groups where supported.
- Kill the full process group on timeout.
- Escalate from `SIGTERM` to `SIGKILL` after a grace period.
- Add max stdout/stderr buffer limits to avoid unbounded memory usage.

Severity: medium  
Area: safety / resource management

---

### 3. IPC validation is type-based but not strict enough

File: `src/electron/ipc-validation.ts`

Validation checks basic field types, but does not enforce many bounds or strict schemas. For example, it can accept negative PR numbers, very large strings, extra fields, arbitrary repo strings, and unbounded diff payloads.

Recommendation:

- Validate integer ranges for PR numbers, line numbers, additions, and deletions.
- Enforce max string lengths, especially for diff and review body payloads.
- Validate repository format as `owner/name`.
- Consider rejecting unknown fields for security-sensitive IPC payloads.
- Consider a schema library such as `zod` or `valibot`.

Severity: medium  
Area: safety / IPC hardening

---

### 4. Electron window can be hardened further

File: `src/electron/index.ts`

Good settings are already present:

```ts
contextIsolation: true,
nodeIntegration: false,
```

Additional hardening is recommended.

Recommendation:

- Add `sandbox: true` if compatible with the preload setup.
- Add a Content Security Policy to `src/mainview/index.html`.
- Wrap navigation URL parsing in `try/catch`.
- Restrict external URL opening to expected schemes and possibly expected hosts.

Severity: medium  
Area: security

---

### 5. `App.tsx` owns too many responsibilities

File: `src/app/App.tsx`

`App` currently handles settings loading, onboarding, auth, GitHub login, review request loading, search filtering, error log routing, settings routing, and setup state.

Recommendation:

Extract smaller hooks/components such as:

- `useStartupSetup`
- `useGitHubConnection`
- `useAppNavigation`
- `useReviewSearchFilter`

Severity: low/medium  
Area: componentization / single responsibility

---

### 6. `ReviewDetail` mixes UI, generation, publishing, and diff-comment derivation

File: `src/features/reviews/components/ReviewDetail.tsx`

The component coordinates tabs, PR header, diff loading, review generation, publishing, submitting approvals/change requests, and inline comment merging.

Recommendation:

Split into smaller pieces such as:

- `ReviewDetailHeader`
- `ReviewSubmitActions`
- `ReviewGenerationActions`
- `useDiffInlineComments`

Severity: low/medium  
Area: componentization / maintainability

---

### 7. Review generation job identity is duplicated

Files:

- `src/electron/services/review-generation-jobs.ts`
- `src/features/reviews/hooks/useGeneratedReview.ts`

The frontend and backend both know how to build the review generation job ID. If one side changes the format, job resume/polling can break.

Recommendation:

- Move job key creation to a shared helper in `src/shared`, or
- expose backend lookup by PR identity instead of raw job ID.

Severity: low  
Area: maintainability

---

### 8. Publishing should validate AI-generated file/line targets

File: `src/electron/services/review-publish.ts`

The app publishes AI-generated findings using file paths and line numbers. GitHub will reject invalid targets, but the app can provide better validation before publishing.

Recommendation:

- Validate `finding.filePath` against `pullRequest.files`.
- Validate `lineStart` is a positive integer.
- Deduplicate comments before publishing.
- Prefer batch review submission where possible.

Severity: low/medium  
Area: safety / UX

## Good practices already present

- Clear source layout and feature grouping.
- Shared RPC schema in `src/shared/rpc.ts`.
- Electron preload uses `contextBridge` instead of exposing Node directly.
- GitHub CLI calls use argument arrays instead of shell interpolation.
- Review-generation prompt includes protection against prompt injection from PR text/diff.
- Existing tests cover important review-generation and parsing behavior.
- Markdown rendering uses React escaping by default.
- `ReviewDetail` is lazy-loaded, which is good for initial renderer performance.

## Suggested priority order

1. Add review job cleanup and stronger child-process cleanup/buffer limits.
2. Harden Electron security with CSP, sandboxing, and safer navigation handling.
3. Strengthen IPC validation with bounds, max lengths, and stricter payload checks.
4. Extract startup/auth logic from `App.tsx`.
5. Extract review generation/publish subcomponents from `ReviewDetail`.
6. Deduplicate review job ID creation.
