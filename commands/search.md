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

3. Display results in a table format:

```
## Search Results for "your query"

| Score | Store | File | Purpose |
|-------|-------|------|---------|
| 1.00 | react | src/components/Button.tsx | Reusable button component with variants |
| 0.87 | react | src/hooks/useButton.ts | Custom hook for button state management |
| 0.65 | lodash | src/array.js | Array utility functions |

**Found**: 3 results
```

4. Format each column:
   - **Score**: Relevance score (0-1, formatted to 2 decimals)
   - **Store**: Store name (from summary.storeName)
   - **File**: Relative file path within repo (strip repoRoot prefix if present)
   - **Purpose**: Brief summary - truncate to ~50 chars if needed

5. If no results found:

```
No results found for "your query"

Try:
- Broadening your search terms
- Checking if the relevant stores are indexed
- Using /bluera-knowledge:stores to see available stores
```
