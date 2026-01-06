---
description: Create atomic commits grouped by logical features. See atomic-commits Skill for methodology.
allowed-tools: Bash(git:*), Read, Glob, Grep
---

# Commit

Create atomic, well-organized commits with each logical feature in its own commit.

## Context

!`git status && echo "---STAGED---" && git diff --cached --stat && echo "---UNSTAGED---" && git diff --stat && echo "---UNTRACKED---" && git ls-files --others --exclude-standard && echo "---HISTORY---" && git log --oneline -10`

## Workflow

**1. Analyze**: Run `git diff HEAD` to see all changes

**2. README Check**: Evaluate if changes need README updates (see atomic-commits Skill table)

**3. Group**: Identify logical features (use atomic-commits Skill for grouping rules)

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
