# Development

## Prerequisites

- [pnpm](https://pnpm.io/)
- GitHub CLI (`gh`)
- A supported review agent if you want to test generation locally: Pi, Claude, opencode, or Codex.

## Install dependencies

```bash
pnpm install
```

## Run locally

Electron development mode:

```bash
pnpm run dev
```

Vite HMR + Electron:

```bash
pnpm run dev:hmr
```

## Checks

```bash
pnpm run typecheck
pnpm run lint
pnpm run check
```

## Build

Renderer build:

```bash
pnpm run build
```

Desktop app build:

```bash
pnpm run build:app
```

The packaged app is written under `artifacts/`.

## Scripts

- `pnpm run panda:build` — generate Panda CSS system and styles.
- `pnpm run typecheck` — generate Panda output and run TypeScript checks.
- `pnpm run build` — generate Panda output and build the React renderer plus Electron entrypoints.
- `pnpm run build:app` — generate Panda output and package the Electron app.
- `pnpm run lint` — lint with Biome.
- `pnpm run format` — format with Biome.
- `pnpm run check` — run Biome lint and format checks.
