# Test Plugin

Comprehensive test of all Bluera Knowledge plugin functionality (MCP tools + slash commands).

## Context

!`echo "=== BK Plugin Test ===" && ls -la .bluera/bluera-knowledge/ 2>/dev/null || echo "No BK data dir yet (will be created)"`

## Test Content Setup

First, create test content for indexing:

```bash
mkdir -p .bluera/bluera-knowledge/test-content
cat > .bluera/bluera-knowledge/test-content/test-file.md << 'EOF'
# BK Plugin Test File

This file contains unique test content for validating the Bluera Knowledge plugin.

## Test Function

The `validateBKPlugin` function performs comprehensive testing of all plugin features.
It checks MCP connectivity, store operations, search functionality, and cleanup.

Keywords: bluera-knowledge-test, plugin-validation, mcp-test
EOF
```

## Workflow

Execute each test in order. Mark each as PASS or FAIL.

### Part 1: MCP Tools

1. **MCP Connection**: Call MCP tool `execute` with `{ command: "help" }`
   - Expected: Returns list of available commands
   - PASS if response contains "Available commands"

2. **List Stores (MCP)**: Call MCP tool `execute` with `{ command: "stores" }`
   - Expected: Returns store list (may be empty initially)
   - PASS if no error

3. **Create Store**: Call MCP tool `execute` with:
   ```json
   { "command": "store:create", "args": { "name": "bk-test-store", "type": "file", "path": ".bluera/bluera-knowledge/test-content" } }
   ```
   - Expected: Store created successfully
   - PASS if response indicates success

4. **Store Info**: Call MCP tool `execute` with:
   ```json
   { "command": "store:info", "args": { "store": "bk-test-store" } }
   ```
   - Expected: Returns store metadata including name, type, path
   - PASS if response contains store details

5. **Index Store**: Call MCP tool `execute` with:
   ```json
   { "command": "store:index", "args": { "store": "bk-test-store" } }
   ```
   - Expected: Indexing completes (may take a few seconds)
   - PASS if response indicates indexing succeeded

6. **Search (MCP)**: Call MCP tool `search` with:
   ```json
   { "query": "validateBKPlugin", "stores": ["bk-test-store"] }
   ```
   - Expected: Returns results containing test content
   - PASS if results array is non-empty and contains test file

7. **Get Full Context**: If search returned results, call MCP tool `get_full_context` with:
   ```json
   { "resultId": "<id from search result>" }
   ```
   - Expected: Returns full file content
   - PASS if response contains "BK Plugin Test File"

### Part 2: Slash Commands

8. **Stores Command**: Run `/bluera-knowledge:stores`
   - Expected: Shows bk-test-store in output
   - PASS if store is listed

9. **Search Command**: Run `/bluera-knowledge:search "bluera-knowledge-test"`
   - Expected: Returns results from test store
   - PASS if results are shown

10. **Suggest Command**: Run `/bluera-knowledge:suggest`
    - Expected: Runs without error (may show no suggestions if no package.json)
    - PASS if no error thrown

### Part 3: Cleanup

11. **Delete Store**: Call MCP tool `execute` with:
    ```json
    { "command": "store:delete", "args": { "store": "bk-test-store" } }
    ```
    - Expected: Store deleted
    - PASS if deletion succeeds

12. **Remove Test Content**: Run bash command:
    ```bash
    rm -rf .bluera/bluera-knowledge/test-content
    ```
    - Expected: Directory removed
    - PASS if command succeeds

13. **Verify Cleanup**: Call MCP tool `execute` with `{ command: "stores" }`
    - Expected: bk-test-store is NOT in the list
    - PASS if test store is gone

## Output Format

After running all tests, report results in this format:

### Plugin Test Results

| # | Test | Status |
|---|------|--------|
| 1 | MCP Connection (help) | ? |
| 2 | List Stores (MCP) | ? |
| 3 | Create Store | ? |
| 4 | Store Info | ? |
| 5 | Index Store | ? |
| 6 | Search (MCP) | ? |
| 7 | Get Full Context | ? |
| 8 | /stores Command | ? |
| 9 | /search Command | ? |
| 10 | /suggest Command | ? |
| 11 | Delete Store | ? |
| 12 | Remove Test Content | ? |
| 13 | Verify Cleanup | ? |

**Result: X/13 tests passed**

## Error Recovery

If tests fail partway through, clean up manually:

1. Delete test store (if exists):
   ```
   execute → { command: "store:delete", args: { store: "bk-test-store" } }
   ```

2. Remove test content directory:
   ```bash
   rm -rf .bluera/bluera-knowledge/test-content
   ```
