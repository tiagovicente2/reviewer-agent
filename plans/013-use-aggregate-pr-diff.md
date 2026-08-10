# 013 — Use GitHub’s aggregate pull request diff

- **Status**: DONE
- **Commit**: `4c1804f`
- **Worktree snapshot**: `99c3495697f4f9fd94775b41b9a64c2f6a9372c7a24f45f80995c95f2813f1e5`
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 2–4 files, small backend fix plus cache migration

## Problem

GitHub reports PR `px-center/px-torre-core#7622` has 11 changed files, and `gh pr view` returns exactly 11 final paths. The app renders many more diff cards because `src/electron/services/github.ts:829-846` requests commit patches:

```ts
const diff = await runGh([
  'pr',
  'diff',
  String(params.pullRequestNumber),
  '--repo',
  params.repo,
  '--patch',
  '--color=never',
])
```

Runtime evidence:

```text
gh pr diff ... --patch       => 32 diff headers, 14 unique paths, 92,765 bytes
gh pr diff ...               => 11 diff headers, 11 unique paths, 39,054 bytes
gh pr view ... changedFiles  => 11
```

`--patch` emits commit-by-commit patches. Paths modified in several commits appear several times, including intermediate files later deleted or renamed. GitHub’s web PR Files view uses the aggregate base-to-head diff, which is what this app intends to display and send to review generation.

Existing cached diffs are keyed only by repo, PR number, and head SHA. Removing `--patch` without changing the cache key would keep serving stale commit-by-commit data for already viewed heads.

## Target

Request the aggregate diff:

```ts
const diff = await runGh([
  'pr',
  'diff',
  String(params.pullRequestNumber),
  '--repo',
  params.repo,
  '--color=never',
])
```

Version only diff cache keys so old patch-mode entries are ignored:

```ts
const PULL_REQUEST_DIFF_CACHE_VERSION = 2

function getPullRequestDiffCacheKey(params: DiffIdentity) {
  return `${getPullRequestCacheKey(params)}:diff-v${PULL_REQUEST_DIFF_CACHE_VERSION}`
}
```

Use the versioned key in `getCachedPullRequestDiff` and `saveCachedPullRequestDiff`; do not invalidate metadata/detail cache entries.

## Repo conventions to follow

- Keep GitHub CLI execution in `src/electron/services/github.ts`.
- Keep cache ownership in `src/electron/services/pull-request-cache.ts`.
- Follow existing mocked-process tests in `src/electron/services/review-publish.test.ts` where practical.

## Steps

1. Remove only the `--patch` argument from `getGitHubPullRequestDiff`; preserve `--color=never`, repo selection, timeout, error handling, and return shape.
2. Add a diff-specific versioned cache key in `pull-request-cache.ts`. Update diff get/save paths to use it while details continue using the existing key.
3. Add a focused backend/helper test proving the generated GitHub CLI args omit `--patch` and retain `--color=never`. If importing the service makes the cache/electron environment unsuitable, extract a small pure `getPullRequestDiffArgs` helper and test it under Node Vitest rather than adding a browser harness.
4. Add a cache test proving an unversioned legacy diff is not returned as a version-2 aggregate diff, if this can use the existing isolated cache test conventions without writing user data.
5. Verify no code deduplicates parsed files as a substitute; deduplication would retain the wrong intermediate patch and is not an acceptable fix.
6. Rebuild and restart the app. Refresh the PR so the aggregate diff is fetched.

## Boundaries

- Do NOT deduplicate `parsePatch(...).files` in the renderer.
- Do NOT alter the metadata `changedFilesCount` to match the erroneous rendered list.
- Do NOT change diff rendering, review prompts, or GitHub detail queries.
- Do NOT clear all app caches; version only diff entries.
- Do NOT add frontend component tests.
- STOP on source drift from the stamped snapshot.

## Verification

- **Mechanical**:
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
  - `pnpm run build`
- **Backend/helper tests**: command arguments and cache-version behavior pass under Node Vitest.
- **Behavior check**:
  - `gh pr view 7622 --repo px-center/px-torre-core --json changedFiles --jq .changedFiles` returns `11`.
  - The app Code tab renders exactly 11 diff cards for that PR.
  - Every right-side path corresponds to the final left tree; no intermediate deleted `app/Nova/*` files appear.
  - Review generation receives the 11-file aggregate diff.
- **Done when**: metadata, tree, rendered diff, and generated-review input all represent the same final base-to-head change set.
