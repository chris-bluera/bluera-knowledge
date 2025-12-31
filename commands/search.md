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

3. Display results clearly:

```
## Search Results for "your query"

Found N results:

---

**Score: 0.95** - `src/components/Button.tsx:15`

**Purpose**: Implements a reusable button component with variants

**Context**:
- Exports: Button, ButtonProps
- Uses: React, styled-components

---

**Score: 0.87** - `src/hooks/useButton.ts:8`

**Purpose**: Custom hook for button state management

---

[Continue for all results...]
```

4. For each result, show:
   - **Score**: Relevance score (0-1, formatted to 2 decimals)
   - **Location**: File path and line number
   - **Purpose**: Summary of what the code does
   - **Context**: Key imports, exports, or dependencies (if available)

5. If no results found:

```
No results found for "your query"

Try:
- Broadening your search terms
- Checking if the relevant stores are indexed
- Using /bluera-knowledge:stores to see available stores
```
