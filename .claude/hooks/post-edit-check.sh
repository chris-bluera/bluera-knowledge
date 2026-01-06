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

# Run typecheck (can't auto-fix, just report)
tsc --noEmit --pretty false 2>&1 | head -20

# Check for anti-patterns in code files
if git diff -- ':!.claude/' | grep -E '\b(fallback|deprecated|backward compatibility)\b' | grep -v '^-' | grep -qE '^\+'; then
  echo 'Anti-pattern detected (fallback/deprecated/backward compatibility). Review CLAUDE.md.' >&2
  exit 2
fi

exit 0
