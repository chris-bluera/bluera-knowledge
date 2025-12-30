---
name: index
description: Re-index a knowledge store
arguments:
  - name: store
    description: Store name or ID
    required: true
allowed-tools: [Bash]
---

Updates the search index for a store (e.g., after pulling new commits).

Usage:
```
/ckb:index vue
/ckb:index pydantic
```
