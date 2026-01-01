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

| Score | Store        | File                                          | Purpose                                          |
|------:|--------------|-----------------------------------------------|--------------------------------------------------|
|  1.00 | react        | src/components/Button.tsx                     | Reusable button component with variants          |
|  0.87 | react        | src/hooks/useButton.ts                        | Custom hook for button state management          |
|  0.65 | lodash       | src/array.js                                  | Array utility functions                          |
|  0.52 | very-long... | plugins/some-plugin/very/deep/nested/path/... | This is a very long purpose that gets truncat... |

**Found**: 4 results
```

4. Format each column with FIXED widths (CRITICAL - cells must be exactly the same width in every row):

   **Column Widths** (including padding spaces):
   - Score: 7 chars (including surrounding spaces: ` 1.00 `)
   - Store: 14 chars (including surrounding spaces: ` react        `)
   - File: 47 chars (including surrounding spaces: ` src/...      `)
   - Purpose: 50 chars (including surrounding spaces: ` Purpose...   `)

   **Formatting Rules**:

   **Score** (7 chars total including spaces):
   - Format: ` XX.XX ` (space + number + space)
   - Right-align the number within the 7-char cell
   - Example: `  1.00 ` (2 spaces + "1.00" + 1 space = 7 chars)

   **Store** (14 chars total including spaces):
   - Extract store name from summary.storeName
   - Format: ` name         ` (space + name + padding + space)
   - If name > 12 chars: truncate to 12, replace last 3 with "..."
   - Pad with spaces to reach exactly 12 chars
   - Add surrounding spaces to reach 14 chars total
   - Example: ` react        ` (space + "react" + 7 spaces + space = 14 chars)

   **File** (47 chars total including spaces):
   - Strip repoRoot prefix from summary.location
   - Format: ` path...                                      ` (space + path + padding + space)
   - If path > 45 chars: truncate to 45, replace last 3 with "..."
   - Pad with spaces to reach exactly 45 chars
   - Add surrounding spaces to reach 47 chars total
   - Example: ` src/components/Button.tsx                     ` (space + path + spaces + space = 47 chars)

   **Purpose** (50 chars total including spaces):
   - Extract from summary.purpose
   - Format: ` purpose text...                              ` (space + text + padding + space)
   - If text > 48 chars: truncate to 48, replace last 3 with "..."
   - Pad with spaces to reach exactly 48 chars
   - Add surrounding spaces to reach 50 chars total
   - Example: ` Reusable button component with variants          ` (space + text + spaces + space = 50 chars)

   **CRITICAL**:
   - Every cell in a column MUST be exactly the same width in every row
   - This ensures vertical alignment of column borders (`|`)
   - The separator row dashes MUST match these exact widths

5. If no results found:

```
No results found for "your query"

Try:
- Broadening your search terms
- Checking if the relevant stores are indexed
- Using /bluera-knowledge:stores to see available stores
```
