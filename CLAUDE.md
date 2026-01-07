# THIS IS CLAUDE.md - YOUR MEMORY FILE

**STOP. READ THIS FIRST.**

This file is YOUR (Claude's) project memory. It is NOT user documentation. It is NOT a README.

| File | Purpose | Audience |
|------|---------|----------|
| **CLAUDE.md** (this file) | Claude Code's memory - scripts, workflows, coding rules | YOU (Claude) |
| **README.md** | User-facing documentation - features, installation, API | HUMANS (users) |

**When to update this file:** When scripts, CI/CD workflows, build processes, or coding conventions change.

**Keep this file LEAN.** This entire file loads into your context every session. Be concise. No prose. No redundancy. Every line must earn its place.

**CLAUDE.md is hierarchical.** Any subdirectory can have its own CLAUDE.md that auto-loads when you work in that directory. Use this pattern:
- **Root CLAUDE.md** (this file): Project-wide info - scripts, CI/CD, general conventions
- **Subdirectory CLAUDE.md**: Directory-specific context scoped to files below it
- Nest as deep as needed - each level inherits from parents

**Stay DRY with includes.** Use `@path/to/file` syntax to import content instead of duplicating. Not evaluated inside code blocks.

---

## Package Manager

**Use `bun`** - not npm or yarn. All scripts should be run with `bun run <script>`.

---

## Scripts

**Development:**
- `bun run build` - Compile TypeScript
- `bun run test:run` - Run tests once
- `bun run precommit` - Full validation (lint, typecheck, tests, build)

**Versioning (after code changes):**
- `bun run version:patch` - Bump patch version (updates package.json, plugin.json, README badge, CHANGELOG.md)
- `bun run version:minor` - Bump minor version
- `bun run version:major` - Bump major version

**Releasing (Fully Automated):**
1. Bump version: `bun run version:patch` (or minor/major)
2. Commit: `git commit -am "chore: bump version to X.Y.Z"`
3. Push: `git push`
4. **Done!** GitHub Actions handles the rest automatically

**What happens automatically:**
- `CI` workflow runs (lint, typecheck, tests, build)
- `Auto Release` workflow waits for CI, then creates & pushes tag
- `Release` workflow creates GitHub release
- `Update Marketplace` workflow updates `blueraai/bluera-marketplace`

**Manual release scripts (legacy, not needed):**
- `bun run release:patch` - Bump + commit + tag + push
- `bun run release:minor` - Same for minor version
- `bun run release:major` - Same for major version

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
- Uses: `MARKETPLACE_PAT` for checkout/push (GITHUB_TOKEN can't trigger other workflows)
- **This is what makes releases fully automated**
- **Important:** Must use PAT, not GITHUB_TOKEN, to allow tag push to trigger Release workflow

**Release Workflow** (`.github/workflows/release.yml`)
- Triggers: Tag push (v*)
- Creates: GitHub release with auto-generated notes

**Update Marketplace Workflow** (`.github/workflows/update-marketplace.yml`)
- Triggers: After Release workflow completes (via `workflow_run`)
- Waits for: CI workflow success (via `wait-on-check-action`)
- Updates: `blueraai/bluera-marketplace` plugin version automatically
- Requires: `MARKETPLACE_PAT` secret (repo-scoped PAT with write access to marketplace repo)
- Note: Uses `workflow_run` trigger because GitHub prevents `GITHUB_TOKEN` workflows from triggering other workflows

## Distribution Requirements

**`dist/` MUST be committed to git** - This is intentional, not an oversight:

1. **Claude Code plugins are copied to a cache during installation** - no build step runs
   - Plugins need pre-built files ready to execute immediately
   - Source: https://code.claude.com/docs/en/discover-plugins

2. **npm publishing also uses committed dist/** - No `files` array in package.json, so npm includes whatever isn't in `.gitignore`

**After any code change:**
1. Run `bun run build` (or `bun run precommit` which includes build)
2. Commit both source AND dist/ changes together

## ALWAYS

* use the `bun run version:*` commands after changes
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
