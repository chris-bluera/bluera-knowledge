---
name: search
description: Search indexed library sources
arguments:
  - name: query
    description: Natural language search query
    required: true
  - name: --stores
    description: Comma-separated store names
    required: false
  - name: --limit
    description: Max results (default 10)
    required: false
allowed-tools: [Bash]
---

Searches indexed library sources using semantic (vector) + full-text search.

Usage:
```
/ckb:search "how does Vue handle reactivity"
/ckb:search "pydantic validators" --stores=pydantic --limit=5
```

Note: This searches the definitive library sources you've indexed, not your current project.
For project files, use Grep/Read directly.
