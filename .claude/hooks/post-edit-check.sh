#!/bin/bash
# Smart post-edit auto-fix hook
# Auto-fixes lint issues and validates types on modified files

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Get modified TS/JS files (uncommitted changes)
MODIFIED_TS_FILES=$(git diff --name-only HEAD 2>/dev/null | grep -E '\.(ts|tsx|js|jsx)$' || true)

# If no TS/JS changes, skip
if [ -z "$MODIFIED_TS_FILES" ]; then
  exit 0
fi

# Auto-fix lint issues on modified files only (fast)
echo "$MODIFIED_TS_FILES" | xargs npx eslint --fix --quiet 2>/dev/null || true

# Check for remaining lint errors (exit 2 to block and show to Claude)
LINT_OUTPUT=$(echo "$MODIFIED_TS_FILES" | xargs npx eslint --quiet 2>&1)
if [ -n "$LINT_OUTPUT" ]; then
  echo "$LINT_OUTPUT" >&2
  exit 2
fi

# Run typecheck (exit 2 to block and show to Claude)
TYPE_OUTPUT=$(npx tsc --noEmit --pretty false 2>&1)
if [ -n "$TYPE_OUTPUT" ]; then
  echo "$TYPE_OUTPUT" | head -20 >&2
  exit 2
fi

# Check for anti-patterns in code files only (not docs/markdown)
ANTI_PATTERN=$(git diff -- '*.ts' '*.tsx' '*.js' '*.jsx' ':!dist/' | grep -E '\b(fallback|deprecated|backward compatibility|legacy)\b' | grep -v '^-' | grep -E '^\+' || true)
if [ -n "$ANTI_PATTERN" ]; then
  echo 'Anti-pattern detected (fallback/deprecated/backward compatibility/legacy). Review CLAUDE.md.' >&2
  echo "$ANTI_PATTERN" >&2
  exit 2
fi

exit 0
