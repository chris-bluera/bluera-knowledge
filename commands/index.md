---
description: Re-index a knowledge store
argument-hint: "[store-name-or-id]"
allowed-tools: [Bash(*)]
---

Re-indexing store: $ARGUMENTS

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/index.js index $ARGUMENTS
```

The store's search index will be updated with any new or modified files.
