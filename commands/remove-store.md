---
description: Delete a knowledge store and all associated data
argument-hint: "[store-name-or-id]"
allowed-tools: ["mcp__bluera-knowledge__delete_store"]
---

# Remove Knowledge Store

Delete a knowledge store and all associated data: **$ARGUMENTS**

## Steps

1. Parse the store name or ID from $ARGUMENTS (required)
   - If no store provided, show error and suggest using /bluera-knowledge:stores to list available stores

2. Use mcp__bluera-knowledge__delete_store tool:
   - store: The store name or ID from $ARGUMENTS

3. Display deletion result:

```
Store "react" deleted successfully.

Removed:
- Store registry entry
- LanceDB search index
- Cloned repository files (for repo stores)
```

## What Gets Deleted

When you remove a store:
- **Registry entry** - Store is removed from the list
- **Search index** - LanceDB vector embeddings are dropped
- **Cloned files** - For repo stores created from URLs, the cloned repository is deleted

## Warning

This action is **permanent**. The store and all indexed data will be deleted.
To re-create, you'll need to add and re-index the source again.

## Error Handling

If store not found:

```
Store not found: nonexistent-store

Available stores:
- Use /bluera-knowledge:stores to list all stores
- Check spelling of store name or ID
```
