#!/bin/bash
# Search command that uses Python formatter for deterministic table output

set -euo pipefail

# Parse arguments
QUERY=""
STORES=""
LIMIT=10

while [[ $# -gt 0 ]]; do
  case $1 in
    --stores)
      STORES="$2"
      shift 2
      ;;
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    *)
      # Everything else is the query
      if [ -z "$QUERY" ]; then
        QUERY="$1"
      else
        QUERY="$QUERY $1"
      fi
      shift
      ;;
  esac
done

# Remove quotes from query if present
QUERY=$(echo "$QUERY" | sed 's/^["'\'']*//;s/["'\'']*$//')

if [ -z "$QUERY" ]; then
  echo "Error: No search query provided"
  exit 1
fi

# Build MCP tool call JSON
TOOL_INPUT=$(cat <<EOF
{
  "query": "$QUERY",
  "limit": $LIMIT,
  "detail": "contextual",
  "intent": "find-implementation"
}
EOF
)

# Call MCP tool (this would need to be done via Claude)
# For now, output instructions for Claude
cat <<EOF
Please call mcp__bluera-knowledge__search with these parameters and pipe the results through the formatter:

Query: $QUERY
Limit: $LIMIT
Detail: contextual
Intent: find-implementation

Then execute: echo '<results_json>' | ${CLAUDE_PLUGIN_ROOT}/hooks/format-search-results.py
EOF
