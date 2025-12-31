---
description: List all indexed library stores
allowed-tools: ["mcp__bluera-knowledge__list_stores"]
---

# List Knowledge Stores

Show all configured knowledge stores in the project.

## Steps

1. Use the mcp__bluera-knowledge__list_stores tool to retrieve all stores

2. Present results in a clean table format:

```
| Name | Type | ID | Source |
|------|------|----|--------------------|
| react | repo | a1b2c3d4 | https://github.com/facebook/react |
| lodash | repo | e5f6g7h8 | https://github.com/lodash/lodash |
| my-docs | file | i9j0k1l2 | ~/docs |

**Total**: 3 stores
```

3. Format each row:
   - **Name**: The store name
   - **Type**: Store type (repo, file, or web)
   - **ID**: First 8 characters of the store ID (no ellipsis)
   - **Source**:
     - For repo stores: The git URL
     - For file stores: The local path (use ~ for home directory to keep it concise)
     - For web stores: The base URL

## If No Stores Found

If no stores exist, show:

```
## No Knowledge Stores Found

You haven't created any knowledge stores yet.

To get started:
- `/bluera-knowledge:add-repo <url> --name=<name>` - Clone and index a library repository
- `/bluera-knowledge:add-folder <path> --name=<name>` - Index a local folder of documentation

Example:
```
/bluera-knowledge:add-repo https://github.com/facebook/react --name=react
```

After creating stores, they will be searchable via the MCP search tool.
```
