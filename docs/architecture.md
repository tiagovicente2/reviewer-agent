# Architecture notes

## App shape

PR Review Agent is an Electron desktop app with a React renderer and Node.js main-process services.

Important areas:

- `src/app` — app shell, routing state, shared hooks, RPC client, toast provider.
- `src/electron` — Electron main/preload code and backend services exposed through IPC.
- `src/features` — feature-focused UI and hooks.
- `src/components` — shared UI and markdown components.
- `src/shared` — types shared by frontend and backend.
- `src/theme` — Panda CSS tokens, recipes, and global styles.

## Review generation

Review generation is local-first. The app sends PR metadata and diff text to the selected local coding agent and expects strict JSON back.

Supported agents:

- Pi
- Claude
- opencode
- Codex

The selected model is read from app settings.

## Styling

The project uses Panda CSS with:

- JSX style props for local layout.
- Recipes for reusable UI primitives.
- Semantic tokens for app colors.

Prefer semantic tokens over hardcoded values. If a custom color is reused, add it to the Panda theme instead of using inline styles or runtime constants.
