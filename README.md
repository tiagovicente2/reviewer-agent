# Reviewer Agent

Local-first desktop app for generating and publishing AI-assisted GitHub pull request review drafts.

<img width="1569" height="891" alt="image" src="https://github.com/user-attachments/assets/db35f315-7fa9-4b97-8f47-a298b117196d" />

## What it does

Reviewer Agent gives you a focused inbox for PRs that need your review. You can inspect the PR summary and diff, generate a draft review with a local coding agent, edit the suggested comments, and submit only the review decision or comments you choose.

## Core features

- Review inbox for GitHub PRs requesting your review.
- Manual PR lookup by URL, `owner/repo#123`, or `owner/repo 123`.
- GitHub-flavored Markdown PR summaries, including GitHub-hosted images.
- Changed-file tree with collapsible per-file diffs.
- Local draft review generation with selectable agents:
  - Pi
  - Claude
  - opencode
  - Codex
- Agent/model settings with readiness checks.
- Locally saved generated reviews.
- Explicit publish flow for generated inline comments.
- Manual approve and request-changes review submission with editable summary comments.

## Install

Linux/macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/tiagovicente2/reviewer-agent/main/scripts/install.sh | bash
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/tiagovicente2/reviewer-agent/main/scripts/install.ps1 | iex
```

## Requirements

- [GitHub CLI](https://cli.github.com/) authenticated with access to the target repositories.
- At least one supported review agent installed and authenticated: `pi`, `claude`, `opencode`, or `codex`.

Authenticate GitHub in the app onboarding flow or manually:

```bash
gh auth login --web --git-protocol https
```

## Safety model

Reviewer Agent does not approve, request changes, merge, or submit GitHub reviews automatically. Generated content stays local until you explicitly publish selected inline comments or submit a review decision from the UI.

## Documentation

- [Development](docs/development.md)
- [Releases](docs/releases.md)
- [Architecture notes](docs/architecture.md)

## Quick development start

```bash
pnpm install
pnpm run typecheck
pnpm run dev
```
