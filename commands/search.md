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

| Score | Store     | File                                          | Purpose                                          |
|------:|-----------|-----------------------------------------------|--------------------------------------------------|
|  1.00 | react     | src/components/Button.tsx                     | Reusable button component with variants          |
|  0.87 | react     | src/hooks/useButton.ts                        | Custom hook for button state management          |
|  0.65 | lodash    | src/array.js                                  | Array utility functions                          |
|  0.52 | very-lo...| plugins/some-plugin/very/deep/nested/path/... | This is a very long purpose that gets truncat...|

**Found**: 4 results
```

4. Format each column (IMPORTANT - truncate content to fit):
   - **Score**: Relevance score (0-1, formatted to 2 decimals), right-aligned
   - **Store**: Store name from summary.storeName
     - Truncate to 12 chars if longer, replace last 3 chars with "..."
   - **File**: Relative file path within repo (strip repoRoot prefix if present)
     - Truncate to 45 chars if longer, replace last 3 chars with "..."
     - Example: "plugins/plugin-dev/skills/command-dev..." (45 chars total)
   - **Purpose**: Brief summary from summary.purpose
     - Truncate to 48 chars if longer, replace last 3 chars with "..."
     - Example: "Comprehensive guide for creating Claude Co..." (48 chars total)

   CRITICAL: Ensure each cell content does NOT exceed its max length. Truncation must happen BEFORE rendering the table.

5. If no results found:

```
No results found for "your query"

Try:
- Broadening your search terms
- Checking if the relevant stores are indexed
- Using /bluera-knowledge:stores to see available stores
```
