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

2. Call mcp__bluera-knowledge__search with:
   - query: The search query string
   - stores: Array of store names (if --stores specified)
   - limit: Number of results (if --limit specified, default 10)
   - detail: "contextual"
   - intent: "find-implementation"

3. Format and display results in a clean list format:

   ```
   ## Search Results: "query"

   **1. [Score: 0.95] store-name**
   📄 path/to/file.ts
   → Purpose description here

   **2. [Score: 0.87] store-name**
   📄 path/to/file.js
   → Another purpose here

   ---
   **Found 10 results**
   ```

   **Formatting rules:**
   - Each result on its own block with blank line between
   - Header: `**N. [Score: X.XX] storeName**` (bold, with rank and score)
   - File: `📄 filename` (strip repoRoot prefix from location)
   - Purpose: `→ purpose text` (arrow prefix, keep concise)
   - Footer: Total count with separator line above

4. If no results:
   ```
   No results found for "query"

   Try:
   - Broadening your search terms
   - Checking indexed stores: /bluera-knowledge:stores
   ```
