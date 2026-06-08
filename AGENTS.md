# AGENTS.md

## Project Shape
- Electron desktop app: main/preload code lives in `src/electron`, React renderer entrypoint is `src/mainview/main.tsx`, and app shell/state is in `src/app/App.tsx`.
- Backend services are exposed through typed IPC: update `src/shared/rpc.ts`, `src/electron/index.ts` handlers, and `src/electron/ipc-validation.ts` together when adding/changing renderer-to-main requests.
- Shared types used by both Electron and React live under `src/shared`; feature UI and hooks live under `src/features`.

## Commands
- Use pnpm 10.23.0 (`packageManager` is pinned): `pnpm install`.
- Validate TypeScript with `pnpm run typecheck`; this runs `panda:build` before `tsc --noEmit`.
- Run tests with `pnpm run test`; Vitest only includes `src/**/*.test.ts`.
- Run one test file with `pnpm vitest run src/path/to/file.test.ts`.
- Lint with `pnpm run lint`; format with `pnpm run format`; full Biome lint/format check is `pnpm run check`.
- Local app startup is `pnpm run dev` (`panda:build`, Vite build, Electron build, then `electron .`); HMR mode is `pnpm run dev:hmr`.
- Build app code with `pnpm run build`; package desktop artifacts to `artifacts/` with `pnpm run build:app` or `pnpm run build:canary`.

## Generated And Build Outputs
- Panda CSS generates `styled-system/`; it is gitignored. Do not hand-edit it; change `panda.config.ts` or `src/theme/*` and rerun `pnpm run panda:build`.
- `build/`, `dist/`, `artifacts/`, and `styled-system/` are generated/ignored outputs.
- Vite root is `src/mainview`, but output goes to root `dist/`; Electron bundles to `build/electron` via `build:electron`.

## Runtime And Data Quirks
- The app shells out to `gh`; GitHub commands generally run with `GH_PROMPT_DISABLED=1` except the explicit login flow.
- Review generation shells out to local agents `pi`, `claude`, `opencode`, or `codex`; avoid tests or changes that assume these CLIs are installed unless explicitly testing availability behavior.
- App settings and reviewer instructions are stored in the legacy config dir `~/.config/reviewer-agent/` (`settings.json`, `reviewer-instructions.md`).
- Generated reviews are stored under Electron `app.getPath('userData')` in `generated-reviews.json`; old SQLite data may be migrated from the legacy data dir.

## Style Notes
- Biome uses tabs, line width 100, single quotes, and no semicolons.
- Use `@/` imports for `src/*` and `styled-system/*` for Panda output; these aliases are configured in both Vite and TypeScript.
- Styling is Panda CSS with semantic tokens/recipes in `src/theme`; prefer theme tokens over hardcoded colors when adding reusable UI.

## Release Notes
- GitHub Actions releases only on pushed `v*` tags; the workflow builds Linux, macOS, and Windows with Node 22 and pnpm 10.23.0.
- Release version bumps are manual in `package.json`; docs expect commit message `chore: release v0.x.x` before tagging.
