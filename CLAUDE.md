## NPM Scripts

**Development:**
- `npm run build` - Compile TypeScript
- `npm run test:run` - Run tests once
- `npm run precommit` - Full validation (lint, typecheck, tests, build)

**Versioning (after code changes):**
- `npm run version:patch` - Bump patch version (updates package.json, plugin.json, README badge)
- `npm run version:minor` - Bump minor version
- `npm run version:major` - Bump major version

**Releasing (Fully Automated):**
1. Bump version: `npm run version:patch` (or minor/major)
2. Commit: `git commit -am "chore: bump version to X.Y.Z"`
3. Push: `git push`
4. **Done!** GitHub Actions handles the rest automatically

**What happens automatically:**
- `CI` workflow runs (lint, typecheck, tests, build)
- `Auto Release` workflow waits for CI, then creates & pushes tag
- `Release` workflow creates GitHub release
- `Update Marketplace` workflow updates `blueraai/bluera-marketplace`

**Manual release scripts (legacy, not needed):**
- `npm run release:patch` - Bump + commit + tag + push
- `npm run release:minor` - Same for minor version
- `npm run release:major` - Same for major version
- `npm run release:current` - Tag + push current version (deprecated, use auto-release instead)

## GitHub Actions Workflows

**CI Workflow** (`.github/workflows/ci.yml`)
- Triggers: Push to main, pull requests, tag pushes
- Runs: Lint, typecheck, tests, build
- Required to pass before auto-release creates tag

**Auto Release Workflow** (`.github/workflows/auto-release.yml`) **← NEW!**
- Triggers: Push to main
- Waits for: CI workflow to pass
- Checks: If version in package.json has no matching tag
- Creates: Tag and pushes it (triggers Release workflow)
- **This is what makes releases fully automated**

**Release Workflow** (`.github/workflows/release.yml`)
- Triggers: Tag push (v*)
- Creates: GitHub release with auto-generated notes

**Update Marketplace Workflow** (`.github/workflows/update-marketplace.yml`)
- Triggers: After Release workflow completes (via `workflow_run`)
- Waits for: CI workflow success (via `wait-on-check-action`)
- Updates: `blueraai/bluera-marketplace` plugin version automatically
- Requires: `MARKETPLACE_PAT` secret (repo-scoped PAT with write access to marketplace repo)
- Note: Uses `workflow_run` trigger because GitHub prevents `GITHUB_TOKEN` workflows from triggering other workflows

## ALWAYS

* use the `npm run version:*` commands after changes
    * without this, the changes would not be detected by Claude Code
* push to main after version bump - releases happen automatically (no manual tagging needed)
* fail early and fast
  * our code is expected to *work* as-designed
    * use "throw" when state is unexpected or for any error condition
    * use 100% strict typing; no "any" no "as", unless completely unavoidable and considerd best practice

## NEVER

* use `--no-verify` on Git commits; this anti-pattern completely circumvents the code protections we have in place
* write "fallback code" or "graceful degradation" code or implement "defaults" *unless* it's part of the specification
* leave commented code, nor reference outdated/deprecated implementations
