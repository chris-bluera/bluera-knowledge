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

**2. Group**: Identify logical features (use atomic-commits Skill for grouping rules)

**3. Commit each group**:
```bash
git add <files>        # Stage related files
bun run precommit      # Validate
# Fix issues if needed, re-stage, re-validate
git commit -m "<type>(<scope>): <description>"
```

**4. Handle untracked**: Categorize each untracked file as commit/ignore/intentional

**5. Report**: Show commits created and final `git status --short`

## Validation

If `bun run precommit` fails:
1. Read the error output
2. Fix the issues
3. Re-stage: `git add <fixed-file>`
4. Re-run `bun run precommit`

## Safety

- Never force push
- Never amend commits from other sessions
- Ask if unsure about grouping
- Always report final working directory status
