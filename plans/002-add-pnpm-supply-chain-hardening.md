# 002 — Add pnpm supply-chain hardening

- **Status**: TODO
- **Commit**: 44835be
- **Severity**: MEDIUM
- **Category**: Security
- **Rule**: react-doctor/require-pnpm-hardening
- **Estimated scope**: 1 config file, small change

## Problem

React Doctor reported `pnpm-workspace.yaml:0` twice, but this repository currently has no `pnpm-workspace.yaml` at all. It is still a pnpm-managed project because `package.json` declares `"packageManager": "pnpm@10.23.0"` and the repo has `pnpm-lock.yaml`.

```json
// package.json — current
"packageManager": "pnpm@10.23.0"
```

Without project-level pnpm hardening, newly published malicious packages can be installed immediately, and packages whose provenance/signature trust weakens can be accepted silently.

## Target

Canonical recipe from `react-doctor/require-pnpm-hardening`:

> Add the missing keys to `pnpm-workspace.yaml` and re-lock with `pnpm install`: set `minimumReleaseAge: 10080` (7 days) so freshly published — and quickly-unpublished-malware — versions aren't installed the moment they land; set `trustPolicy: no-downgrade` so pnpm refuses packages whose provenance/signature trust weakens between resolutions; and leave `blockExoticSubdeps: true` (the recent-pnpm default) — never set it to `false`, which lets transitive deps come from `git:`/`file:`/tarball URLs that bypass the registry.

Create:

```yaml
# pnpm-workspace.yaml
minimumReleaseAge: 10080
trustPolicy: no-downgrade
```

If pnpm requires an explicit workspace package list for this single-package repo, add:

```yaml
packages:
  - .
minimumReleaseAge: 10080
trustPolicy: no-downgrade
```

## Repo conventions to follow

- Keep package-manager config at repository root next to `package.json` and `pnpm-lock.yaml`.
- Do not change dependencies or scripts for this plan.

## Steps

1. Create root `pnpm-workspace.yaml` if it still does not exist.
2. Add `minimumReleaseAge: 10080` and `trustPolicy: no-downgrade` exactly.
3. Do not set `blockExoticSubdeps: false`; omit it or set it to `true` only if pnpm requires it.
4. Run `pnpm install` only if needed to refresh lockfile metadata; do not upgrade dependencies.

## Boundaries

- Do NOT change dependency versions.
- Do NOT run broad package upgrades.
- STOP if the repo has added equivalent org-level registry hardening since commit `44835be`; report the documented equivalent instead.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` clears `react-doctor/require-pnpm-hardening` and the score does not regress.
  - `pnpm install --frozen-lockfile` succeeds after any lockfile changes.
  - `pnpm run typecheck`
  - `pnpm run lint`
- **Behavior check**: Install a normal existing dependency set from a clean checkout and confirm pnpm no longer reports missing workspace settings.
- **Done when**: React Doctor no longer reports missing `minimumReleaseAge` or `trustPolicy`.
