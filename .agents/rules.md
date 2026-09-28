# DeskFlow-VLA — Agent Branch Execution & Validation Policies

## 1. Branching
- All automated work MUST branch from `main` as `agent/<short-task-slug>-<yyyymmdd>`.
  e.g. `agent/cbf-tuning-20260928`
- Never commit directly to `main`. Never use `--force` push.
- Keep branches short-lived; the CI workflow squash-merges and deletes them.

## 2. Pre-push validation (mandatory)
1. `cd backend-edge && pytest -q` — CBF math + fallback client must be green.
2. `cd web && npm run build` — Next.js production build must succeed.
3. `node graphify/render_graph.js --check` — architecture graph must parse.
- If any gate fails, fix on the same `agent/**` branch; do not open a PR manually
  (the workflow opens/merges it automatically after green checks).

## 3. Commit conventions
- `feat(scope): ...`, `fix(scope): ...`, `hardware: ...`, `web: ...`,
  `edge: ...`, `docs: ...`, `chore: ...`
- One logical change per commit. No secrets, no `.env`, no `*.key` files.

## 4. Safety invariants (non-negotiable)
- No trajectory may bypass `cbf_safety.validate_trajectory()`.
- Stall-current trip (2800 mA) and vacuum-vent behavior in firmware must not
  be weakened without a hardware review + updated `hardware/schematics/bom.json`.
- Razorpay `verify` route must always HMAC-SHA256 check `razorpay_signature`
  with `RAZORPAY_KEY_SECRET` via timing-safe compare.

## 5. UI invariants
- Mobile-first: touch targets ≥ 44px, `dvh` units, bottom nav + sheet drawers.
- No generic purple/indigo gradient hero. Industrial tactile theme only
  (zinc/slate, hairline borders, noise overlay, Geist/JetBrains Mono).
- bklit-ui → React Bits → shadcn/Radix precedence for new components.
