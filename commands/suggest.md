---
description: Suggest important dependencies to add to knowledge stores
allowed-tools: [Bash(*)]
---

Analyzing project dependencies and suggesting important libraries to add:

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/index.js suggest
```

This scans your project's dependency files and suggests major libraries that would be useful to index as knowledge stores.
