---
name: atomic-commits
description: Methodology for creating atomic git commits grouped by logical features. Use when committing changes, organizing commits, or deciding how to group changes into commits.
---

# Atomic Commit Methodology

## Grouping Rules

**Group together:**
- Feature code + its documentation
- Feature code + its tests
- Feature code + its configuration
- API changes + API documentation

**Keep separate:**
- Unrelated features
- Independent bug fixes
- Standalone doc improvements
- Pure refactoring

## Commit Message Format

```
<type>(<scope>): <description>

[optional body explaining why]
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`

## Workflow

### 1. Analyze
```bash
git diff HEAD                              # All changes
git diff --cached                          # Staged only
git ls-files --others --exclude-standard   # Untracked
```

### 2. Group by Feature
Each commit = one complete, testable change.

### 3. Commit Each Group
```bash
git add <files>        # Stage related files
bun run precommit      # Validate (already quiet)
# If fails: fix issues, re-stage, re-validate
git commit -m "..."    # Commit when valid
```

### 4. Handle Untracked Files
- **Should commit**: Add to appropriate commit
- **Should ignore**: Suggest `.gitignore` (ask first)
- **Intentional**: Document why untracked

Goal: Clean `git status` after commits

## Safety

- Never force push
- Never amend commits from other sessions
- Ask if unsure about grouping
- Always report final `git status`
