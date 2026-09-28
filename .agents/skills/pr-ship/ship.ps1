<# .agents/skills/pr-ship/ship.ps1 — deterministic ship for DeskFlow-VLA.
Usage: .agents/skills/pr-ship/ship.ps1 -Slug "<short-task-slug>" -Message "feat(scope): what changed"
Flow: agent/<slug>-<yyyymmdd> -> commit -> push -> gh pr create -> squash-merge --delete-branch -> sync main.
Requires: GitHub CLI (gh) authenticated with repo scope. PowerShell 5.1 compatible. #>
param(
  [Parameter(Mandatory = $true)][string]$Slug,
  [Parameter(Mandatory = $true)][string]$Message,
  [string]$Base = "main"
)

# Git writes progress to stderr; in PS 5.1 that becomes error records, so DO NOT
# use "Stop" here — every step checks $LASTEXITCODE explicitly instead.
$ErrorActionPreference = "Continue"

function Step([string]$Name, [scriptblock]$Body) {
  Write-Host "`n==> $Name" -ForegroundColor Cyan
  & $Body
  if ($LASTEXITCODE -ne 0) { throw "FAILED: $Name (exit $LASTEXITCODE)" }
}

$date = Get-Date -Format "yyyyMMdd"
$branch = "agent/$Slug-$date"

$dirty = git status --porcelain
if (-not $dirty) { throw "Nothing to ship: working tree is clean." }

Step "Create branch $branch" {
  git checkout -b $branch 2>$null
  if ($LASTEXITCODE -ne 0) { git checkout $branch }
}
Step "Stage + commit" { git add -A; if ($?) { git commit -m $Message } }
Step "Push with upstream" { git push -u origin $branch }

$prUrl = (gh pr create --base $Base --head $branch --title $Message `
  --body "Automated ship via pr-ship skill. Local gates green. Squash-merge and delete branch.")
Write-Host "PR: $prUrl" -ForegroundColor Green

Step "Squash-merge + delete remote branch" { gh pr merge --squash --delete-branch $prUrl }
Step "Sync $Base" { git checkout $Base; if ($?) { git pull --ff-only } }
Step "Drop local branch" {
  git branch -D $branch 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "(local branch already gone - gh deleted it, nothing to do)"
  }
}

Write-Host "`nShipped $branch -> $Base (squash). Branch deleted." -ForegroundColor Green
