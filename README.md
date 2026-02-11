# gh-actions-tui (TypeScript + Bun + Ink)

TUI for monitoring GitHub checks on your authored pull requests.

## Requirements

- Node.js 20+
- GitHub CLI (`gh`) installed and authenticated
  - `gh auth login`
  - account/token with `repo` and `workflow` access

## Install

```bash
npm i -g gh-actions-tui
```

## Run

```bash
gh-actions-tui
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
- `r`: manual refresh
- `o`: open selected PR in browser
- `s`: edit watched repositories inline
- `q` or `ctrl+c`: quit

## Status Categories

- `running`
- `queued`
- `pending`
- `failed`
- `cancelled`
- `passed`
- `skipped`

Overview rollup statuses:

- any in-progress -> in-progress (yellow)
- else any failed -> failed (red)
- else -> passed (green)

- Auth errors: run `gh auth status`
- Missing PRs: verify watched repo scope and your authored-open PRs exist
- Empty checks/runs: verify workflows/checks started on the PR head SHA
