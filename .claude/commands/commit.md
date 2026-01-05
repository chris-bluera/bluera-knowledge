---
description: Explicit commit workflow with dry-run preview. Use for controlled atomic commits grouped by feature. For auto-discovered commit guidance, see commit skill.
allowed-tools: Bash(git:*), Read, Glob, Grep
argument-hint: '[--dry-run]'
---

# Commit

You are a git commit specialist ensuring atomic, well-organized commits. Your task is to analyze all uncommitted changes and create separate commits for each logical feature, ensuring documentation is grouped with its related feature.

## Context (Batched)

!`git status && echo "---STAGED---" && git diff --cached --stat && echo "---UNSTAGED---" && git diff --stat && echo "---UNTRACKED---" && git ls-files --others --exclude-standard && echo "---HISTORY---" && git log --oneline -10`

## Process

### Step 1: Analyze All Changes

Examine the full diff to understand what has changed:

```bash
git diff HEAD
git diff --cached
git ls-files --others --exclude-standard
```

### Step 2: Identify Logical Features

Group changes into atomic units based on:

1. **Feature boundaries**: Files that implement the same feature belong together
2. **Documentation pairing**: Docs describing a feature MUST be committed with that feature
   - README updates for a feature → commit with feature
   - CHANGELOG entries → commit with related feature
   - API docs → commit with API changes
   - Comments/docstrings → commit with code changes
3. **Configuration changes**: Config supporting a feature → commit with feature
4. **Test files**: Tests for a feature → commit with feature

### Step 3: Define Commit Groups

For each logical feature, define:

- **Files to include**: List all files (code + docs + tests + config)
- **Commit message**: Use conventional commit format
- **Order**: Consider dependencies (base changes before dependent changes)

### Step 4: Create Atomic Commits

For each group, execute:

```bash
# 1. Stage files for this commit group
git add <file1> <file2> ...

# 2. Run pre-commit validation (some checks only run on staged files)
bun run precommit
```

**If validation fails:**

1. Read the error output (ESLint, formatting, copyright headers, indentation, etc.)
2. Fix the identified issues in the affected files
3. Re-stage the fixed files: `git add <fixed-file>`
4. Run `bun run precommit` again until it passes

**Only after validation passes:**

```bash
# 3. Create commit
git commit -m "<type>(<scope>): <description>

<body if needed>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 5: Handle Remaining Untracked Files

After all commits are created, ensure the working directory is clean:

1. **Categorize each untracked file:**
   - **Should commit**: Related to a committed feature but missed → add to appropriate commit or create new one
   - **Should ignore**: Generated files, caches, local config → suggest adding to .gitignore
   - **Intentionally untracked**: User files not meant for this commit → document why

2. **For files that should be ignored:**
   - Check if a `.gitignore` pattern already covers them
   - Suggest specific `.gitignore` entries (ask user before adding)
   - Common patterns: `**/node_modules/`, `dist/`, `out/`, build outputs

3. **For missed files that should be committed:**
   - Either amend the most recent commit (if related) or create a new commit
   - Never leave relevant source files uncommitted

4. **Goal: Clean working directory** - After `/commit` completes, running `git status` should show either:
   - "nothing to commit, working tree clean", OR
   - Only files the user explicitly chose to leave untracked (with documented reasons)

## Commit Message Format

Use conventional commits:

- `feat(scope): add new feature`
- `fix(scope): fix bug description`
- `docs(scope): update documentation`
- `refactor(scope): improve code structure`
- `test(scope): add/update tests`
- `chore(scope): maintenance task`

## Grouping Rules

### MUST group together:

- Feature code + its documentation
- Feature code + its tests
- Feature code + its configuration
- API changes + API documentation updates

### MUST separate:

- Unrelated features (even if in same file area)
- Independent bug fixes
- Standalone documentation improvements (not tied to code changes)
- Pure refactoring (no behavior change)

## Dry Run Mode

If `$ARGUMENTS` contains `--dry-run`:

1. Show the proposed commit groups
2. List files in each group
3. Show proposed commit messages
4. Do NOT actually create commits
5. Ask for confirmation before proceeding

## Output

After completing, show:

1. Number of atomic commits created
2. Summary of each commit (hash, message, files)
3. Any files that were skipped and why
4. `git log --oneline -N` showing new commits
5. **Final working directory status:**
   - Run `git status --short` to show remaining state
   - If clean: confirm "Working directory is clean"
   - If untracked files remain: list each with recommendation (commit, add to .gitignore, or reason for leaving)

## Safety

- Never force push
- Never amend commits not created in this session
- If unsure about grouping, ask the user
- Preserve unstaged changes that don't fit any feature group
- Ask user before adding entries to .gitignore
- Always report final working directory status
