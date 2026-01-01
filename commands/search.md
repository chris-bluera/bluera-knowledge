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

3. Format and display results with rich context:

   ```
   ## Search Results: "query" (hybrid search)

   **1. [Score: 0.95] 🎯 store-name**
   📄 path/to/file.ts
   → Purpose description here
   🔑 Top Terms (in this chunk): concept1, concept2, concept3
   📦 Imports (in this chunk): package1, package2

   **2. [Score: 0.87] 🔍 store-name**
   📄 path/to/file.js
   → Another purpose here
   🔑 Top Terms (in this chunk): other-concept

   ---
   **Found 10 results in 45ms**

   💡 **Next Steps:**
   - Read file: `Read /path/to/file.ts`
   - Get full code: `mcp__bluera-knowledge__get_full_context("result-id")`
   - Refine search: Use keywords above
   ```

   **Formatting rules:**
   - Header: `## Search Results: "query" (mode search)` - Extract mode from response (vector/fts/hybrid)
   - Each result on its own block with blank line between
   - Result header: `**N. [Score: X.XX] {{badge}} storeName**` where badge is:
     - 🎯 if result.rankingMetadata has both vectorRank AND ftsRank (found by both methods)
     - 🔍 if result.rankingMetadata has only vectorRank (semantic match only)
     - 📝 if result.rankingMetadata has only ftsRank (keyword match only)
   - File: `📄 filename` (strip repoRoot prefix from location)
   - Purpose: `→ purpose text` (arrow prefix, keep concise)
   - Top Terms: `🔑 Top Terms (in this chunk): ...` (top 5 most frequent words from this chunk, comma-separated)
   - Imports: `📦 Imports (in this chunk): ...` (import statements from this chunk, first 3-4, comma-separated)
   - Skip Top Terms/Imports lines if arrays are empty
   - Footer: `**Found {{totalResults}} results in {{timeMs}}ms**` with separator line above

4. For the footer next steps, include:
   - First result's ID in the get_full_context example
   - First result's actual file path in the Read example
   - Use the actual keywords from top results

5. If no results:
   ```
   No results found for "query"

   Try:
   - Broadening your search terms
   - Checking indexed stores: /bluera-knowledge:stores
   ```
