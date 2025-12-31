---
description: Index a local folder of reference material
argument-hint: "[path] [--name store-name]"
allowed-tools: [Bash(*)]
---

Indexing folder: $ARGUMENTS

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/index.js add-folder $ARGUMENTS
```

The folder will be added as a knowledge store and automatically indexed for searching.
