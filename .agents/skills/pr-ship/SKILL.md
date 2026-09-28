---
name: pr-ship
description: Ship finished work the DeskFlow way — branch, push, open PR, squash-merge, delete branch. Invoke after any change is complete and locally verified.
---

# pr-ship — branch → PR → squash-merge → delete branch

Deterministic manual alternative to the automatic `.agents/workflows/pr-merge-squash.yml`
(which fires on every push to `agent/**`). Use this skill when you want the merge
**now** instead of waiting on the workflow, or when driving the release from chat.

## Preconditions (same gates as `.agents/rules.md`)

1. `python -m pytest backend-edge/tests -q` — green (from repo root).
2. `node graphify/render_graph.js --check` — 16 nodes / 15 edges, no dangling refs.
3. `cd web && npm run build` — green (only if `web/` changed; needs `npm install` once).
4. Nothing secret staged: no `.env*` (except `.env.example`), no `*.key`, no service-account JSON.

## Scripted path (recommended)

```powershell
cd D:\projects\DeskFlow-VLA
.agents/skills/pr-ship/ship.ps1 -Slug "<short-task-slug>" -Message "feat(scope): what changed"
```

The script: creates `agent/<slug>-<yyyymmdd>` → `git add -A` → commits → pushes with
upstream → `gh pr create` against `main` → `gh pr merge --squash --delete-branch` →
checks out `main`, fast-forward pulls, drops the local branch. Each step echoes so a
failure points at the exact leg (commit / push / pr / merge / sync).

## Manual path (if `gh` is missing or you need control)

```bash
git checkout -b agent/<slug>-<yyyymmdd>
git add -A && git commit -m "feat(scope): what changed"
git push -u origin HEAD
gh pr create --base main --title "feat(scope): what changed" \
  --body "Gates: pytest + graph check green. Squash-merge and delete branch."
gh pr merge --squash --delete-branch <pr-url-or-number>
git checkout main && git pull --ff-only
git branch -D agent/<slug>-<yyyymmdd>   # -D: squash means Git sees it as unmerged
```

## Notes

- Requires GitHub CLI authenticated with `repo` scope (`gh auth status`).
- Branch MUST match `agent/**` or the CI workflow ignores the push.
- If `pr-merge-squash.yml` beats you to the merge (it also auto-PRs on push), don't
  fight it: `git checkout main && git pull --ff-only`, delete the local branch, done.
- Never `--force` push, never commit to `main` directly, one logical change per PR.
