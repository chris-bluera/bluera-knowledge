---
description: Clone and index a library source repository
argument-hint: "[git-url] [--name store-name] [--branch branch-name]"
allowed-tools: ["mcp__bluera-knowledge__create_store", "mcp__bluera-knowledge__index_store"]
---

# Add Repository to Knowledge Stores

Clone and index a library source repository: **$ARGUMENTS**

## Steps

1. Parse arguments from $ARGUMENTS:
   - Extract the git URL (required, first positional argument)
   - Extract --name parameter (optional, defaults to repo name from URL)
   - Extract --branch parameter (optional, defaults to default branch)

2. Use mcp__bluera-knowledge__create_store tool:
   - name: Store name (from --name or extracted from URL)
   - type: "repo"
   - source: The git URL
   - branch: Branch name (if --branch specified)

3. After successful creation, use mcp__bluera-knowledge__index_store tool:
   - store: The store name that was just created

4. Display progress and results:

```
✓ Cloning https://github.com/facebook/react...
✓ Created store: react (a1b2c3d4...)
  Location: ~/.local/share/bluera-knowledge/stores/a1b2c3d4.../

✓ Indexing...
✓ Indexed 1,247 files

Store is ready for searching!
```

## Error Handling

If creation fails (e.g., invalid URL, network error, git not available):

```
✗ Failed to clone repository: [error message]

Common issues:
- Check that the git URL is valid and accessible
- Ensure you have network connectivity
- Verify git is installed on your system
- For private repos, check your SSH keys or credentials
```
