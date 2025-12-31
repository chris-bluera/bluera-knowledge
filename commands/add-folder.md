---
description: Index a local folder of reference material
argument-hint: "[path] [--name store-name]"
allowed-tools: ["mcp__bluera-knowledge__create_store", "mcp__bluera-knowledge__index_store"]
---

# Add Local Folder to Knowledge Stores

Index a local folder of reference material: **$ARGUMENTS**

## Steps

1. Parse arguments from $ARGUMENTS:
   - Extract the folder path (required, first positional argument)
   - Extract --name parameter (optional, defaults to folder name)

2. Use mcp__bluera-knowledge__create_store tool:
   - name: Store name (from --name or folder basename)
   - type: "file"
   - source: The folder path

3. After successful creation, use mcp__bluera-knowledge__index_store tool:
   - store: The store name that was just created

4. Display progress and results:

```
✓ Adding folder: /Users/me/my-docs...
✓ Created store: my-docs (e5f6g7h8...)
  Location: ~/.local/share/bluera-knowledge/stores/e5f6g7h8.../

✓ Indexing...
✓ Indexed 342 files

Store is ready for searching!
```

## Error Handling

If creation fails (e.g., path doesn't exist, permission denied):

```
✗ Failed to add folder: [error message]

Common issues:
- Check that the path exists
- Ensure you have read permissions for the folder
- Verify the path is a directory, not a file
- Use absolute paths to avoid ambiguity
```
