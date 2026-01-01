---
description: Search indexed library sources
argument-hint: "[query] [--stores names] [--limit N]"
allowed-tools: ["mcp__bluera-knowledge__search"]
---

# Search Knowledge Stores

Search indexed library sources for: **$ARGUMENTS**

## Steps

1. Parse the query from $ARGUMENTS:
   - Extract the search query (required)
   - Extract --stores parameter (optional, comma-separated store names)
   - Extract --limit parameter (optional, default 10)

2. Use mcp__bluera-knowledge__search tool with:
   - query: The search query string
   - stores: Array of store names (if --stores specified)
   - limit: Number of results (if --limit specified, default 10)
   - detail: "contextual" (shows summary, location, and context)
   - intent: "find-implementation" (for general searches)

3. The results will be automatically formatted by the PostToolUse hook.

4. If no results found, suggest:
   - Broadening search terms
   - Checking if relevant stores are indexed
   - Using /bluera-knowledge:stores to see available stores
