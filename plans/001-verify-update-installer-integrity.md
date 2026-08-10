# 001 — Verify update installer integrity

- **Status**: TODO
- **Commit**: 44835be
- **Severity**: HIGH
- **Category**: Security
- **Rule**: react-doctor/plugin-update-trust-risk
- **Estimated scope**: 1 file, medium change

## Problem

`src/electron/services/update.ts:120` and `src/electron/services/update.ts:128` build commands that download remote installer scripts from GitHub and execute them directly through a shell:

```ts
// src/electron/services/update.ts:111 — current
function getUpdateCommand(): { command: string; args: string[] } | null {
	if (process.platform === 'win32') {
		return {
			command: 'powershell.exe',
			args: [
				'-NoProfile',
				'-ExecutionPolicy',
				'Bypass',
				'-Command',
				`irm '${INSTALL_SCRIPT_PS_URL}' | iex`,
			],
		}
	}

	if (process.platform === 'linux' || process.platform === 'darwin') {
		return {
			command: 'sh',
			args: ['-lc', `curl -fsSL '${INSTALL_SCRIPT_URL}' | bash`],
		}
	}

	return null
}
```

This is a privileged Electron auto-update path. If the script URL, GitHub account, network path, or release branch is compromised, the app executes attacker-controlled code.

## Target

Canonical recipe from `react-doctor/plugin-update-trust-risk`:

> Verify integrity before running any downloaded update or plugin: check a pinned SHA-256 (or `gpg --verify` a signature) and abort on mismatch. Pin the update or repository URL to a trusted host (no user-supplied `repoUrl`), serve it over HTTPS, and never pipe a download straight into a shell (`curl … | sh`). Keep custom-repository or third-party plugin installs behind an explicit user confirmation.

Target shape for this repo:

```ts
// target shape — do not pipe remote content to a shell
const REPO = 'tiagovicente2/reviewer-agent'
const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`
// Download a release asset plus its .sha256/.sig from the latest release, verify it,
// then execute only the verified local file.
```

The exact asset names depend on the release process. Stop and report if releases do not publish checksums/signatures; do not replace the current pipe-to-shell with another unverified download.

## Repo conventions to follow

- Keep update code in `src/electron/services/update.ts`.
- Follow the existing `UpdateResult` style: return `{ ok: false, message }` instead of throwing user-facing errors.
- Imitate existing process-spawn conventions in `src/electron/services/update.ts:63` and `src/electron/process.ts`.

## Steps

1. In `src/electron/services/update.ts`, remove the `INSTALL_SCRIPT_URL`, `INSTALL_SCRIPT_PS_URL`, and pipe-to-shell command construction.
2. Add a verified download flow: fetch the latest release asset from the trusted `tiagovicente2/reviewer-agent` release, download the matching checksum/signature, compute the local SHA-256 with Node `crypto`, and abort if it does not match.
3. Execute only the verified local installer/artifact via `spawn`; keep `windowsHide: true` and existing restart behavior.
4. If the GitHub release does not expose a checksum/signature asset, stop and report that release publishing must add one before this diagnostic can be safely fixed.
5. Preserve explicit user confirmation in the UI before installation; do not add silent background installation.

## Boundaries

- Do NOT execute remote scripts with `curl | bash`, `irm | iex`, `eval`, or equivalent.
- Do NOT accept user-supplied update URLs.
- Do NOT add dependencies unless the repo already has no native way to verify the artifact; prefer Node `crypto`.
- STOP if `src/electron/services/update.ts` has drifted substantially from commit `44835be`.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` clears `react-doctor/plugin-update-trust-risk` and the score does not regress.
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
- **Behavior check**: Open Settings → updates. Confirm update checking still shows available/no-update/error states, and install refuses to proceed when checksum/signature verification is missing or mismatched.
- **Done when**: no pipe-to-shell remains in update installation, verification failures are surfaced to the user, and checks pass.
