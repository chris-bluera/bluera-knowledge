# Code Review

Review the local codebase using multi-agent analysis. See @.claude/skills/code-review-repo/skill.md for process details.

## Context

!`echo "---PROJECT---" && ls -la && echo "---CLAUDE.md FILES---" && find . -name CLAUDE.md 2>/dev/null`

## Workflow

1. **Gather context**: Find all CLAUDE.md files and source files
2. **Multi-agent review**: Launch 5 parallel agents (CLAUDE.md compliance, bug scan, git history, PR comments, code comments)
3. **Score issues**: Haiku agents score each issue 0-100 for confidence
4. **Filter**: Only report issues with confidence >= 80
5. **Output**: Print formatted results to console
