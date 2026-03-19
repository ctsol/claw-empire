# Branch Protection: Non-RU/EN Locale Guard

**Date:** 2026-03-19
**Owner:** DevSecOps
**Status:** Required — must be applied to `main` before the RU/EN locale removal PR is merged.

---

## Purpose

Block any PR that re-introduces non-RU/EN locale codes (`ko`, `ja`, `zh`, `de`, `fr`, `es`, `pt`, `it`) from being merged into `main`. This is enforced at two layers:

1. **CI gate** — `pnpm run locale:guard` (`scripts/check-locale-guard.mjs`) runs on every PR/push and exits non-zero if forbidden locale codes are found.
2. **Branch protection rule** — The CI check is marked as *required*, so GitHub refuses to merge PRs where the check is failing or has not run.

---

## Setup Instructions (one-time, admin action)

### Using GitHub CLI

```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --header "Accept: application/vnd.github+json" \
  --field required_status_checks='{"strict":true,"contexts":["test"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null
```

> Replace `{owner}/{repo}` with the actual repository path.
> The `"test"` context matches the job name in `.github/workflows/ci.yml` (`jobs.test`).

### Using GitHub UI

1. Go to **Settings → Branches → Branch protection rules → Add rule**
2. Branch name pattern: `main`
3. Enable **Require status checks to pass before merging**
4. Search for and add: `test` (the CI job)
5. Enable **Require branches to be up to date before merging**
6. Enable **Include administrators** (enforce_admins)
7. Optionally: **Require a pull request before merging** (1 approving review)
8. Save

---

## CI Job Reference

The locale guard is the **first** step after dependency install in `.github/workflows/ci.yml`:

```yaml
- name: Run locale guard (no non-RU/EN locale codes)
  run: pnpm run locale:guard
```

Script: `scripts/check-locale-guard.mjs`
npm script: `pnpm run locale:guard`

---

## What the Guard Checks

Scans `src/` and `server/` for any of these locale codes used as object keys or string values:

| Code | Language  |
|------|-----------|
| `ko` | Korean    |
| `ja` | Japanese  |
| `zh` | Chinese   |
| `de` | German    |
| `fr` | French    |
| `es` | Spanish   |
| `pt` | Portuguese|
| `it` | Italian   |

Exit code `1` (fails CI) if any match is found.
Only `ru` and `en` are permitted.

---

## Verification

After applying branch protection, verify via:

```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  --jq '.required_status_checks.contexts'
# Expected output: ["test"]
```

---

## Recurring Monitoring

Operations has scheduled a weekly automated scan (via CI cron or manual trigger). See `docs/devsecops/locale-monitoring.md` for the cron schedule.
