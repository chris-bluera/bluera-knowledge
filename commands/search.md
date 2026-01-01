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

3. **CRITICAL**: Format the results using the Python formatter for deterministic table output.

   After calling the MCP tool, construct a JSON object for the formatter:
   ```json
   {
     "tool_name": "mcp__bluera-knowledge__search",
     "tool_input": { <the parameters you used> },
     "tool_result": { <the full MCP response> }
   }
   ```

   Then execute this bash command to format and display results:
   ```bash
   echo '<json_object>' | ${CLAUDE_PLUGIN_ROOT}/hooks/format-search-results.py
   ```

   The formatter outputs a fixed-width table that renders correctly in terminals.

4. If the formatter fails or if you cannot execute it, fall back to a simple list format:
   ```
   ## Search Results: "query"

   1. [0.95] store-name: path/to/file.ts
      Purpose: Brief description
   ```
