---
description: Create atomic commits grouped by logical features with README.md and CLAUDE.md awareness.
allowed-tools: Bash(git:*), Read, Glob, Grep
---

# Commit

Create atomic, well-organized commits with each logical feature in its own commit.

## Context

!`git status && echo "---STAGED---" && git diff --cached --stat && echo "---UNSTAGED---" && git diff --stat && echo "---UNTRACKED---" && git ls-files --others --exclude-standard && echo "---HISTORY---" && git log --oneline -10`

## Workflow

**1. Analyze**: Run `git diff HEAD` to see all changes

**2. Documentation Check**: Evaluate if changes need README.md or CLAUDE.md updates.

### README.md (User-facing documentation)

| Change Type | README Section to Update |
|-------------|-------------------------|
| MCP tools added/removed/renamed | MCP Tools table, MCP Integration section |
| New commands or skills | Commands/Skills documentation |
| CLI interface changes | Usage examples |
| Configuration changes | Configuration/Environment sections |
| Breaking API changes | Upgrade/migration notes |
| New features | Feature documentation |
| Installation changes | Installation section |

**Trigger files → check README.md:**
- `src/mcp/server.ts` - MCP tool surface
- `plugin.json` - Plugin metadata
- `commands/*.md` - Command documentation

### CLAUDE.md (Claude Code memory)

| Change Type | CLAUDE.md Section to Update |
|-------------|----------------------------|
| package.json scripts | Scripts section |
| CI/CD workflow changes | GitHub Actions Workflows section |
| Build/dist process changes | Distribution Requirements section |
| Coding conventions | ALWAYS/NEVER sections |

**Trigger files → check CLAUDE.md:**
- `package.json` scripts - Development commands
- `.github/workflows/*.yml` - CI/CD workflows
- `tsconfig.json`, `tsup.config.ts` - Build configuration
- `.husky/*` - Git hooks

**3. Group**: Identify logical features by grouping related files:
- Same feature = same commit
- Infrastructure/config = separate commit
- Tests = with their implementation OR separate if test-only

**4. Commit each group**:
```bash
git add <files>        # Stage related files
bun run precommit      # Validate (smart - skips checks for doc-only changes)
# Fix issues if needed, re-stage, re-validate
git commit -m "<type>(<scope>): <description>"
```

**5. Handle untracked**: Categorize each untracked file as commit/ignore/intentional

**6. Report**: Show commits created and final `git status --short`

## Validation

The precommit script is smart about file types:
- **Doc-only changes**: Skips all validation (instant)
- **Code changes**: Runs lint + typecheck + tests + build

If validation fails, fix issues and re-run `bun run precommit`

## Safety

- Never force push
- Never amend commits from other sessions
- Ask if unsure about grouping
- Always report final working directory status
