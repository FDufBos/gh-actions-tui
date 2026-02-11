# gh-actions-tui (TypeScript + Bun + Ink)

Single-screen terminal UI for monitoring GitHub checks on your authored pull requests.

## UI Layout

- Header: auth/scope/refresh status
- Overview box (top): open PRs authored by your account in watched repos
- Details box (bottom): empty until you select a PR, then shows checks and workflow runs

## Requirements

- Bun 1.3+
- GitHub CLI (`gh`) installed and authenticated
  - `gh auth login`
  - account/token with `repo` and `workflow` access

## Install

```bash
cd ~/Apps/gh-actions-tui
bun install
```

## Run

```bash
bun run start
```

## Build

```bash
bun run build
```

Output: `dist/gh-actions-tui.js`

## First Use

1. Start the app.
2. Press `s` to enter watched repos.
3. Type repos separated by comma or spaces:
   - `owner/repo`
   - `https://github.com/owner/repo`
4. Press `enter` to save.

Config is saved to:

`~/.config/gh-actions-tui/config.json`

## Keybindings

- `j/k` or arrows: move cursor
- `enter`: select highlighted PR and load details
- `tab`: switch focus between overview/detail
- `[` or `]`: switch detail tab (`checks` / `runs`)
- `r`: manual refresh
- `o`: open selected PR in browser
- `s`: edit watched repositories inline
- `esc`: cancel repo input mode
- `q` or `ctrl+c`: quit

## Status Categories

- `running`
- `queued`
- `pending`
- `failed`
- `cancelled`
- `passed`
- `skipped`

Overview rollup logic:

- any in-progress -> in-progress
- else any failed -> failed
- else -> passed

## Validation and Smoke

```bash
bun run smoke
```

This runs:

- `bun run typecheck`
- `bun test`

## Troubleshooting

- Auth errors: run `gh auth status`
- Missing PRs: verify watched repo scope and your authored-open PRs exist
- Empty checks/runs: verify workflows/checks started on the PR head SHA
