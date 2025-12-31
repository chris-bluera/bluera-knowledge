---
description: Re-index a knowledge store
argument-hint: "[store-name-or-id]"
allowed-tools: ["mcp__bluera-knowledge__index_store"]
---

# Re-index Knowledge Store

Re-index a knowledge store: **$ARGUMENTS**

## Steps

1. Parse the store name or ID from $ARGUMENTS (required)

2. Use mcp__bluera-knowledge__index_store tool:
   - store: The store name or ID from $ARGUMENTS

3. Display progress and results:

```
✓ Indexing store: react...
✓ Indexed 1,247 documents in 3,421ms

Store search index is up to date!
```

## When to Re-index

Re-index a store when:
- The source repository has been updated (for repo stores)
- Files have been added or modified (for file stores)
- You want to refresh embeddings with an updated model
- Search results seem out of date

## Error Handling

If indexing fails:

```
✗ Failed to index store: [error message]

Common issues:
- Store name or ID not found - use /bluera-knowledge:stores to list available stores
- Source directory no longer exists (for file stores)
- Network issues pulling latest changes (for repo stores)
```
